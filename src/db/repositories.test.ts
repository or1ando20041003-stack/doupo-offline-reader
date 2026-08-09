import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Book, Chapter, ReadingProgress } from '../domain/models'
import { ReaderDatabase } from './readerDatabase'
import { ReaderRepository } from './repositories'

const book: Book = {
  id: 'current-book',
  title: '人工测试书',
  sourceFileName: 'artificial.txt',
  sourceEncoding: 'utf-8',
  importedAt: '2026-08-09T00:00:00.000Z',
  mainChapterCount: 1,
  extraChapterCount: 0,
  totalCharacterCount: 4,
  mainCharacterCount: 4,
  extraCharacterCount: 0,
  parserVersion: '1.0.0',
  cleanerVersion: '1.0.0',
}

const chapter: Chapter = {
  id: 'current-book:chapter:0',
  bookId: 'current-book',
  order: 0,
  chapterNumber: 1,
  title: '第一章 测试',
  section: 'main',
  paragraphs: ['人工正文'],
  characterCount: 4,
  cumulativeCharacterStart: 0,
  sectionCharacterStart: 0,
}

describe('ReaderRepository', () => {
  let database: ReaderDatabase
  let repository: ReaderRepository

  beforeEach(() => {
    database = new ReaderDatabase(`test-${crypto.randomUUID()}`)
    repository = new ReaderRepository(database)
  })

  afterEach(async () => {
    await database.delete()
  })

  it('persists books, chapters, progress, and settings', async () => {
    await repository.replaceBookData(book, [chapter])
    expect(await repository.getBook()).toEqual(book)
    expect(await repository.getChapter(chapter.id)).toEqual(chapter)
    expect(await repository.getChaptersBySection(book.id, 'main')).toEqual([chapter])
    expect(await repository.getChapterIndex(book.id)).toEqual([{ ...chapter, paragraphs: undefined }].map(({ paragraphs: _paragraphs, ...item }) => item))

    const progress: ReadingProgress = {
      bookId: book.id,
      chapterId: chapter.id,
      paragraphIndex: 0,
      characterOffset: 2,
      chapterProgress: 0.5,
      globalProgress: 0.5,
      updatedAt: '2026-08-09T01:00:00.000Z',
    }
    await repository.saveProgress(progress)
    expect(await repository.getProgress(book.id)).toEqual(progress)

    const settings = await repository.getSettings()
    await repository.saveSettings({ ...settings, fontSize: 22, theme: 'dark' })
    expect(await repository.getSettings()).toMatchObject({ fontSize: 22, theme: 'dark' })
  })

  it('uses phase 3 reader defaults and merges older partial settings records', async () => {
    expect(await repository.getSettings()).toMatchObject({ fontSize: 19, lineHeight: 1.8, theme: 'paper', readingMode: 'scroll' })
    await database.settings.put({ id: 'reader-settings', theme: 'dark' } as never)
    expect(await repository.getSettings()).toMatchObject({ fontSize: 19, theme: 'dark', horizontalPadding: 20 })
  })

  it('atomically replaces prior imported chapters and progress', async () => {
    await repository.replaceBookData(book, [chapter])
    await repository.saveProgress({
      bookId: book.id,
      chapterId: chapter.id,
      paragraphIndex: 0,
      characterOffset: 1,
      chapterProgress: 0.25,
      globalProgress: 0.25,
      updatedAt: '2026-08-09T01:00:00.000Z',
    })

    const replacement = { ...chapter, id: 'current-book:chapter:1', order: 1, title: '第二章 新内容' }
    const result = await repository.replaceBookData({ ...book, title: '重新导入' }, [replacement])
    expect(result.clearedProgress).toBe(true)
    expect(await repository.getChapter(chapter.id)).toBeUndefined()
    expect(await repository.getChapter(replacement.id)).toEqual(replacement)
    expect(await repository.getProgress(book.id)).toBeUndefined()
  })
})
