import { describe, expect, it, vi } from 'vitest'
import type { Book, Chapter } from '../domain/models'
import { createReadingProgress, ProgressSaveScheduler } from './readingProgress'

const book: Book = {
  id: 'book', title: '测试', sourceFileName: 'test.txt', sourceEncoding: 'utf-8', importedAt: '',
  updatedAt: '', totalChapters: 3,
  mainChapterCount: 2, extraChapterCount: 1, totalCharacterCount: 130,
  mainCharacterCount: 100, extraCharacterCount: 30, parserVersion: '2', cleanerVersion: '2',
}

function chapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'm2', bookId: 'book', order: 1, chapterNumber: 9, title: '第九章', section: 'main',
    paragraphs: ['甲乙', '丙丁戊'], characterCount: 5, cumulativeCharacterStart: 40,
    sectionCharacterStart: 40, ...overrides,
  }
}

describe('reading progress', () => {
  it('calculates chapter progress by characters', () => {
    expect(createReadingProgress(book, chapter(), { paragraphIndex: 1, characterOffset: 1 }).chapterProgress).toBe(0.6)
  })

  it('calculates main global progress using the main character total', () => {
    expect(createReadingProgress(book, chapter(), { paragraphIndex: 1, characterOffset: 1 }).globalProgress).toBe(0.43)
  })

  it('calculates extra progress inside the extra section', () => {
    const extra = chapter({ id: 'e1', section: 'extra', sectionCharacterStart: 10, characterCount: 5 })
    expect(createReadingProgress(book, extra, { paragraphIndex: 0, characterOffset: 2 }).globalProgress).toBe(0.4)
  })

  it('creates a zero anchor when a directory chapter is opened', () => {
    const progress = createReadingProgress(book, chapter(), { paragraphIndex: 0, characterOffset: 0 })
    expect(progress).toMatchObject({ paragraphIndex: 0, characterOffset: 0, chapterProgress: 0, globalProgress: 0.4 })
  })

  it('clamps invalid paragraph and character offsets', () => {
    expect(createReadingProgress(book, chapter(), { paragraphIndex: 99, characterOffset: 99 })).toMatchObject({ paragraphIndex: 1, characterOffset: 3 })
  })

  it('never persists a temporary paged page index', () => {
    const progress = createReadingProgress(book, chapter(), { paragraphIndex: 1, characterOffset: 1, pageIndex: 8 } as never)
    expect(progress).not.toHaveProperty('pageIndex')
  })

  it('throttles saves and persists only the newest pending anchor', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async () => undefined)
    const scheduler = new ProgressSaveScheduler(save, 1000)
    const first = createReadingProgress(book, chapter(), { paragraphIndex: 0, characterOffset: 1 })
    const second = createReadingProgress(book, chapter(), { paragraphIndex: 1, characterOffset: 1 })
    scheduler.schedule(first)
    scheduler.schedule(second)
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(second)
    vi.useRealTimers()
  })

  it('flushes a pending save for lifecycle events', async () => {
    const save = vi.fn(async () => undefined)
    const scheduler = new ProgressSaveScheduler(save, 10000)
    const progress = createReadingProgress(book, chapter(), { paragraphIndex: 0, characterOffset: 1 })
    scheduler.schedule(progress)
    await scheduler.flush()
    expect(save).toHaveBeenCalledWith(progress)
  })
})
