import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { WorkerParsedPayload } from '../book-processing/types'
import { ReaderDatabase } from '../db/readerDatabase'
import { ReaderRepository } from '../db/repositories'
import { persistParsedBook } from './importBook'

const parsed: WorkerParsedPayload = {
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

describe('persistParsedBook', () => {
  let database: ReaderDatabase
  let repository: ReaderRepository

  beforeEach(() => {
    database = new ReaderDatabase(`import-${crypto.randomUUID()}`)
    repository = new ReaderRepository(database)
  })

  afterEach(async () => {
    await database.delete()
  })

  it('generates a fresh bookId, unique chapter IDs, and initial progress per import', async () => {
    const first = await persistParsedBook({ name: '第一本.txt' }, parsed, repository)
    const second = await persistParsedBook({ name: '第二本.txt' }, parsed, repository)
    const firstChapter = (await repository.getChapters(first.id))[0]!
    const secondChapter = (await repository.getChapters(second.id))[0]!

    expect(first.id).not.toBe(second.id)
    expect(firstChapter.id).not.toBe(secondChapter.id)
    expect(firstChapter.chapterNumber).toBe(1)
    expect(secondChapter.chapterNumber).toBe(1)
    expect(await repository.getProgress(first.id)).toMatchObject({ bookId: first.id, chapterId: firstChapter.id })
    expect(await repository.getProgress(second.id)).toMatchObject({ bookId: second.id, chapterId: secondChapter.id })
  })
})
