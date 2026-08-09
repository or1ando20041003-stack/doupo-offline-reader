import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Book, Chapter, ReadingProgress } from '../domain/models'
import { ReaderDatabase } from './readerDatabase'
import { ReaderRepository } from './repositories'

function makeBook(id: string): Book {
  return {
    id,
    title: `测试书 ${id}`,
    sourceFileName: `${id}.txt`,
    sourceEncoding: 'utf-8',
    importedAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    totalChapters: 1,
    mainChapterCount: 1,
    extraChapterCount: 0,
    totalCharacterCount: 4,
    mainCharacterCount: 4,
    extraCharacterCount: 0,
    parserVersion: '1.0.0',
    cleanerVersion: '1.0.0',
  }
}

function makeChapter(bookId: string): Chapter {
  return {
    id: `${bookId}:main:0`,
    bookId,
    order: 0,
    chapterNumber: 1,
    title: '第一章 测试',
    section: 'main',
    paragraphs: ['人工正文'],
    characterCount: 4,
    cumulativeCharacterStart: 0,
    sectionCharacterStart: 0,
  }
}

function makeProgress(bookId: string, chapterId: string, characterOffset = 0): ReadingProgress {
  return {
    bookId,
    chapterId,
    paragraphIndex: 0,
    characterOffset,
    chapterProgress: characterOffset / 4,
    globalProgress: characterOffset / 4,
    updatedAt: '2026-08-09T01:00:00.000Z',
  }
}

describe('ReaderRepository multi-book storage', () => {
  let database: ReaderDatabase
  let repository: ReaderRepository

  beforeEach(() => {
    database = new ReaderDatabase(`test-${crypto.randomUUID()}`)
    repository = new ReaderRepository(database)
  })

  afterEach(async () => {
    await database.delete()
  })

  it('stores two books with duplicate display chapter numbers and unique IDs', async () => {
    const bookA = makeBook('book-a')
    const bookB = makeBook('book-b')
    const chapterA = makeChapter(bookA.id)
    const chapterB = makeChapter(bookB.id)
    await repository.addBook(bookA, [chapterA], makeProgress(bookA.id, chapterA.id))
    await repository.addBook(bookB, [chapterB], makeProgress(bookB.id, chapterB.id))

    expect(await repository.getBooks()).toHaveLength(2)
    expect((await repository.getChapters(bookA.id))[0]!.chapterNumber).toBe(1)
    expect((await repository.getChapters(bookB.id))[0]!.chapterNumber).toBe(1)
    expect(chapterA.id).not.toBe(chapterB.id)
    expect(await repository.getBookById(bookA.id)).toEqual(bookA)
    expect(await repository.getChapter(bookA.id, chapterB.id)).toBeUndefined()
    expect(await repository.getChapterIndex(bookA.id)).toEqual([
      {
        id: chapterA.id,
        bookId: bookA.id,
        order: 0,
        chapterNumber: 1,
        title: chapterA.title,
        section: 'main',
        characterCount: 4,
        cumulativeCharacterStart: 0,
        sectionCharacterStart: 0,
      },
    ])
  })

  it('keeps reading progress isolated by bookId', async () => {
    const bookA = makeBook('book-a')
    const bookB = makeBook('book-b')
    const chapterA = makeChapter(bookA.id)
    const chapterB = makeChapter(bookB.id)
    await repository.addBook(bookA, [chapterA], makeProgress(bookA.id, chapterA.id, 1))
    await repository.addBook(bookB, [chapterB], makeProgress(bookB.id, chapterB.id, 3))

    await repository.saveProgress(makeProgress(bookA.id, chapterA.id, 2))
    expect((await repository.getProgress(bookA.id))?.characterOffset).toBe(2)
    expect((await repository.getProgress(bookB.id))?.characterOffset).toBe(3)
  })

  it('deletes only the selected book and its dependent records', async () => {
    const bookA = makeBook('book-a')
    const bookB = makeBook('book-b')
    const chapterA = makeChapter(bookA.id)
    const chapterB = makeChapter(bookB.id)
    await repository.addBook(bookA, [chapterA], makeProgress(bookA.id, chapterA.id))
    await repository.addBook(bookB, [chapterB], makeProgress(bookB.id, chapterB.id))

    await repository.deleteBook(bookA.id)
    expect(await repository.getBookById(bookA.id)).toBeUndefined()
    expect(await repository.getChapters(bookA.id)).toEqual([])
    expect(await repository.getProgress(bookA.id)).toBeUndefined()
    expect(await repository.getBookById(bookB.id)).toEqual(bookB)
    expect(await repository.getChapters(bookB.id)).toEqual([chapterB])
    expect(await repository.getProgress(bookB.id)).toEqual(makeProgress(bookB.id, chapterB.id))
  })

  it('keeps reader settings global and merges older partial records', async () => {
    expect(await repository.getSettings()).toMatchObject({ fontSize: 19, theme: 'paper', readingMode: 'scroll' })
    await database.settings.put({ id: 'reader-settings', theme: 'dark' } as never)
    expect(await repository.getSettings()).toMatchObject({ fontSize: 19, theme: 'dark', horizontalPadding: 20 })
  })
})
