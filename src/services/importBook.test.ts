import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportStage, WorkerImportResponse, WorkerParsedPayload } from '../book-processing/types'
import { ReaderDatabase } from '../db/readerDatabase'
import { ReaderRepository } from '../db/repositories'
import { loadBookshelf } from './bookshelf'
import {
  confirmBookImport,
  getImportErrorMessage,
  inferBookTitle,
  parseBookBufferInWorker,
  prepareBookImport,
  prepareBookImportFiles,
} from './importBook'

const parsed: WorkerParsedPayload = {
  contentHash: 'abc123',
  encoding: 'utf-8',
  chapters: [{
    order: 0,
    chapterNumber: 1,
    title: '第一章',
    section: 'main',
    paragraphs: ['测试正文'],
    characterCount: 4,
    cumulativeCharacterStart: 0,
    sectionCharacterStart: 0,
  }],
  warnings: [],
  cleaningWarnings: [],
  appliedCleaningRuleIds: [],
  cleaningRuleHits: {},
  canonicalEndingDetected: false,
  timings: { decodeMs: 1, cleanMs: 1, parseMs: 1, totalMs: 3 },
  totalCharacterCount: 4,
  mainCharacterCount: 4,
  extraCharacterCount: 0,
}

function testFile(name = '测试小说 完整版.TXT'): File {
  const bytes = new TextEncoder().encode('第一章\n测试正文')
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer.slice(0),
  } as File
}

function fakeWorker(result: WorkerImportResponse = { type: 'result', payload: parsed }) {
  return () => {
    const worker = {
      onmessage: null as ((event: MessageEvent<WorkerImportResponse>) => void) | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
      postMessage: vi.fn(() => {
        queueMicrotask(() => {
          if (result.type === 'result') {
            for (const stage of ['decoding', 'cleaning', 'parsing'] as const) {
              worker.onmessage?.({ data: { type: 'progress', stage } } as MessageEvent<WorkerImportResponse>)
            }
          }
          worker.onmessage?.({ data: result } as MessageEvent<WorkerImportResponse>)
        })
      }),
      terminate: vi.fn(),
    }
    return worker
  }
}

describe('two-phase book import', () => {
  let database: ReaderDatabase
  let repository: ReaderRepository

  beforeEach(() => {
    database = new ReaderDatabase(`import-${crypto.randomUUID()}`)
    repository = new ReaderRepository(database)
  })

  afterEach(async () => {
    await database.delete()
  })

  it('parses first, writes nothing before confirmation, then imports successfully', async () => {
    const stages: ImportStage[] = []
    const prepared = await prepareBookImport(testFile(), (stage) => stages.push(stage), repository, fakeWorker())
    expect(await repository.getBooks()).toEqual([])
    expect(prepared.suggestedTitle).toBe('测试小说')
    expect(prepared.summary).toMatchObject({ totalChapters: 1, totalCharacterCount: 4 })

    const book = await confirmBookImport(
      prepared,
      { title: prepared.suggestedTitle },
      (stage) => stages.push(stage),
      repository,
      new Date('2026-08-09T01:00:00.000Z'),
    )
    expect(book).toMatchObject({ title: '测试小说', sourceHash: 'abc123', wordCount: 4 })
    expect(await repository.getBookById(book.id)).toEqual(book)
    expect((await loadBookshelf(repository))[0]?.book.title).toBe('测试小说')
    expect(stages).toEqual(['reading', 'decoding', 'cleaning', 'parsing', 'reviewing', 'saving', 'complete'])
  })

  it('keeps parsing off the calling stack by using the worker protocol', async () => {
    let settled = false
    const promise = parseBookBufferInWorker(new ArrayBuffer(20 * 1024 * 1024), () => undefined, fakeWorker())
      .then((payload) => { settled = true; return payload })
    expect(settled).toBe(false)
    expect((await promise).contentHash).toBe('abc123')
  })

  it('cancels without creating any database records', async () => {
    await prepareBookImport(testFile(), () => undefined, repository, fakeWorker())
    expect(await repository.getBooks()).toEqual([])
    expect(await database.chapters.count()).toBe(0)
    expect(await database.progress.count()).toBe(0)
  })

  it('uses an optional reference file without creating it as another Book', async () => {
    const alignment = {
      referenceSourceFileName: '测试小说-目录.txt',
      referenceEncoding: 'utf-8' as const,
      referenceChapterCount: 1,
      referenceUnrecognizedLines: 0,
      bodyCandidateCount: 1,
      originalChapterCount: 1,
      exactMatches: 1,
      highMatches: 0,
      fuzzyMatches: 0,
      unresolvedReferences: 0,
      bodyOnlyChapters: 0,
      finalChapterCount: 1,
      alignmentTimeMs: 2,
    }
    const prepared = await prepareBookImportFiles(
      { bodyFile: testFile('测试小说.txt'), referenceFile: testFile('测试小说-目录.txt') },
      () => undefined,
      repository,
      fakeWorker({ type: 'result', payload: { ...parsed, chapterAlignment: alignment } }),
    )
    expect(prepared.summary.chapterAlignment).toEqual(alignment)
    await confirmBookImport(prepared, { title: '测试小说' }, () => undefined, repository)
    const books = await repository.getBooks()
    expect(books).toHaveLength(1)
    expect(books[0]).toMatchObject({ sourceFileName: '测试小说.txt', importDiagnostics: { exactMatches: 1 } })
    expect(books.some(({ sourceFileName }) => sourceFileName.includes('目录'))).toBe(false)
  })

  it('keeps each reference index scoped to its own import task', async () => {
    const firstPayload = {
      ...parsed,
      contentHash: 'book-a-hash',
      chapterAlignment: {
        referenceSourceFileName: '甲目录.txt', referenceChapterCount: 1, referenceUnrecognizedLines: 0,
        bodyCandidateCount: 1, originalChapterCount: 1, exactMatches: 1, highMatches: 0, fuzzyMatches: 0,
        unresolvedReferences: 0, bodyOnlyChapters: 0, finalChapterCount: 1, alignmentTimeMs: 1,
      },
    }
    const secondPayload = {
      ...parsed,
      contentHash: 'book-b-hash',
      chapterAlignment: {
        ...firstPayload.chapterAlignment,
        referenceSourceFileName: '乙目录.txt',
        exactMatches: 0,
        highMatches: 1,
      },
    }
    const first = await prepareBookImportFiles(
      { bodyFile: testFile('甲书.txt'), referenceFile: testFile('甲目录.txt') },
      () => undefined, repository, fakeWorker({ type: 'result', payload: firstPayload }),
    )
    const second = await prepareBookImportFiles(
      { bodyFile: testFile('乙书.txt'), referenceFile: testFile('乙目录.txt') },
      () => undefined, repository, fakeWorker({ type: 'result', payload: secondPayload }),
    )
    await confirmBookImport(first, { title: '甲书' }, () => undefined, repository)
    await confirmBookImport(second, { title: '乙书' }, () => undefined, repository)
    const books = await repository.getBooks()
    expect(books).toHaveLength(2)
    expect(books.find(({ title }) => title === '甲书')?.importDiagnostics?.exactMatches).toBe(1)
    expect(books.find(({ title }) => title === '乙书')?.importDiagnostics?.highMatches).toBe(1)
  })

  it('falls back to normal parsing when the reference file cannot be read', async () => {
    const brokenReference = {
      name: '乱码目录.txt',
      size: 10,
      arrayBuffer: async () => { throw new DOMException('read failed', 'NotReadableError') },
    } as unknown as File
    const prepared = await prepareBookImportFiles(
      { bodyFile: testFile(), referenceFile: brokenReference },
      () => undefined,
      repository,
      fakeWorker(),
    )
    expect(prepared.summary.chapterAlignment?.warning).toContain('正文仍可继续导入')
    await confirmBookImport(prepared, { title: '仍可导入' }, () => undefined, repository)
    expect(await repository.getBooks()).toHaveLength(1)
  })

  it('detects a duplicate by hash and never overwrites by default', async () => {
    const firstDraft = await prepareBookImport(testFile('斗破苍穹.txt'), () => undefined, repository, fakeWorker())
    const first = await confirmBookImport(firstDraft, { title: '斗破苍穹' }, () => undefined, repository)
    const duplicateDraft = await prepareBookImport(testFile('斗破苍穹 全本.txt'), () => undefined, repository, fakeWorker())

    expect(duplicateDraft.duplicateBook?.id).toBe(first.id)
    await expect(confirmBookImport(duplicateDraft, { title: '斗破苍穹' }, () => undefined, repository))
      .rejects.toThrow('请选择覆盖、保留两本或取消')
    expect(await repository.getBooks()).toHaveLength(1)

    await confirmBookImport(duplicateDraft, { title: '斗破苍穹', duplicateAction: 'keep' }, () => undefined, repository)
    expect(await repository.getBooks()).toHaveLength(2)
  })

  it('overwrites only after explicit confirmation and resets that book progress', async () => {
    const firstDraft = await prepareBookImport(testFile('斗破苍穹.txt'), () => undefined, repository, fakeWorker())
    const first = await confirmBookImport(
      firstDraft,
      { title: '斗破苍穹' },
      () => undefined,
      repository,
      new Date('2026-08-01T00:00:00.000Z'),
    )
    const firstProgress = await repository.getProgress(first.id)
    await repository.saveProgress({ ...firstProgress!, characterOffset: 3, updatedAt: '2026-08-08T00:00:00.000Z' })

    const duplicateDraft = await prepareBookImport(testFile('斗破苍穹全集.txt'), () => undefined, repository, fakeWorker())
    const overwritten = await confirmBookImport(
      duplicateDraft,
      { title: '斗破苍穹·校订版', duplicateAction: 'overwrite' },
      () => undefined,
      repository,
      new Date('2026-08-09T00:00:00.000Z'),
    )

    expect(overwritten.id).toBe(first.id)
    expect(overwritten.importedAt).toBe(first.importedAt)
    expect(overwritten.title).toBe('斗破苍穹·校订版')
    expect((await repository.getBooks())).toHaveLength(1)
    expect(await repository.getProgress(first.id)).toMatchObject({ characterOffset: 0, globalProgress: 0 })
  })

  it('recovers from worker and unreadable-file failures with understandable messages', async () => {
    const workerFailure = prepareBookImport(
      testFile(),
      () => undefined,
      repository,
      fakeWorker({ type: 'error', message: '文件为空或没有可保存的正文。' }),
    )
    await expect(workerFailure).rejects.toThrow('文件为空')

    const brokenFile = {
      name: '损坏.txt',
      arrayBuffer: async () => { throw new DOMException('read failed', 'NotReadableError') },
    } as unknown as File
    await expect(prepareBookImport(brokenFile, () => undefined, repository, fakeWorker()))
      .rejects.toThrow('无法读取这个 TXT 文件')
    expect(getImportErrorMessage(new SyntaxError('Unexpected token'))).not.toContain('Unexpected token')
    expect(await repository.getBooks()).toEqual([])
  })
})

describe('inferBookTitle', () => {
  it.each([
    ['斗破苍穹.txt', '斗破苍穹'],
    ['斗破苍穹 完整版.TXT', '斗破苍穹'],
    ['凡人修仙传（全本）.txt', '凡人修仙传'],
    ['诡秘之主-全集.txt', '诡秘之主'],
    ['全本高手.txt', '全本高手'],
  ])('infers %s as %s', (fileName, title) => {
    expect(inferBookTitle(fileName)).toBe(title)
  })
})
