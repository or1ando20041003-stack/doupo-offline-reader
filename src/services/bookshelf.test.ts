import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Book, Chapter, ReadingProgress } from '../domain/models'
import { ReaderDatabase } from '../db/readerDatabase'
import { ReaderRepository } from '../db/repositories'
import { loadBookshelf, loadReaderBook } from './bookshelf'

function makeBook(id: string, title: string, lastReadAt?: string): Book {
  return {
    id,
    title,
    sourceFileName: `${title}.txt`,
    sourceEncoding: 'utf-8',
    importedAt: '2026-08-01T00:00:00.000Z',
    updatedAt: lastReadAt ?? '2026-08-01T00:00:00.000Z',
    lastReadAt,
    totalChapters: 1,
    mainChapterCount: 1,
    extraChapterCount: 0,
    totalCharacterCount: 4,
    mainCharacterCount: 4,
    extraCharacterCount: 0,
    parserVersion: '2.0.0',
    cleanerVersion: '2.0.0',
  }
}

function makeChapter(bookId: string, title: string): Chapter {
  return {
    id: `${bookId}:main:0`, bookId, order: 0, chapterNumber: 1, title, section: 'main',
    paragraphs: ['测试正文'], characterCount: 4, cumulativeCharacterStart: 0, sectionCharacterStart: 0,
  }
}

function makeProgress(bookId: string, chapterId: string, globalProgress: number): ReadingProgress {
  return {
    bookId, chapterId, paragraphIndex: 0, characterOffset: 2,
    chapterProgress: 0.5, globalProgress, updatedAt: '2026-08-09T01:00:00.000Z',
  }
}

describe('bookshelf service', () => {
  let database: ReaderDatabase
  let repository: ReaderRepository

  beforeEach(() => {
    database = new ReaderDatabase(`bookshelf-${crypto.randomUUID()}`)
    repository = new ReaderRepository(database)
  })

  afterEach(async () => {
    await database.delete()
  })

  it('loads multiple books with their own current chapter and progress', async () => {
    const bookA = makeBook('book-a', '斗破苍穹', '2026-08-09T01:00:00.000Z')
    const bookB = makeBook('book-b', '凡人修仙传', '2026-08-08T01:00:00.000Z')
    const chapterA = makeChapter(bookA.id, '第六百八十七章')
    const chapterB = makeChapter(bookB.id, '第十章')
    const progressA = makeProgress(bookA.id, chapterA.id, 0.423)
    const progressB = makeProgress(bookB.id, chapterB.id, 0.08)
    await repository.addBook(bookA, [chapterA], progressA)
    await repository.addBook(bookB, [chapterB], progressB)

    const entries = await loadBookshelf(repository)
    expect(entries.map(({ book }) => book.title)).toEqual(['斗破苍穹', '凡人修仙传'])
    expect(entries[0]).toMatchObject({ currentChapterTitle: '第六百八十七章', progress: progressA })
    expect(entries[1]).toMatchObject({ currentChapterTitle: '第十章', progress: progressB })
  })

  it('opens the requested bookId with only that book progress', async () => {
    const bookA = makeBook('book-a', '甲书')
    const bookB = makeBook('book-b', '乙书')
    const chapterA = makeChapter(bookA.id, '甲第一章')
    const chapterB = makeChapter(bookB.id, '乙第一章')
    const progressA = makeProgress(bookA.id, chapterA.id, 0.2)
    const progressB = makeProgress(bookB.id, chapterB.id, 0.8)
    await repository.addBook(bookA, [chapterA], progressA)
    await repository.addBook(bookB, [chapterB], progressB)

    const reader = await loadReaderBook(bookB.id, repository)
    expect(reader.book.id).toBe(bookB.id)
    expect(reader.progress).toEqual(progressB)
    expect(reader.progress).not.toEqual(progressA)
  })

  it('returns an empty bookshelf for a normal empty database', async () => {
    expect(await loadBookshelf(repository)).toEqual([])
  })
})
