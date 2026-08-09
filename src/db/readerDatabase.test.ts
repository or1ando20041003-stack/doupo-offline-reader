import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import type { Book, Chapter, ReadingProgress } from '../domain/models'
import { DATABASE_VERSION, ReaderDatabase } from './readerDatabase'

const databaseNames: string[] = []

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)))
})

describe('ReaderDatabase v2 migration', () => {
  it('preserves the phase-3 book, chapter count, and reading progress', async () => {
    const name = `migration-${crypto.randomUUID()}`
    databaseNames.push(name)
    const legacy = new Dexie(name)
    legacy.version(1).stores({
      books: '&id, importedAt',
      chapters: '&id, bookId, [bookId+order], [bookId+section]',
      progress: '&bookId, chapterId, updatedAt',
      settings: '&id',
    })
    const legacyBook = {
      id: 'current-book',
      title: '斗破苍穹',
      sourceFileName: '斗破苍穹.txt',
      sourceEncoding: 'utf-8' as const,
      importedAt: '2026-08-01T00:00:00.000Z',
      mainChapterCount: 2,
      extraChapterCount: 0,
      totalCharacterCount: 8,
      mainCharacterCount: 8,
      extraCharacterCount: 0,
      parserVersion: '2.0.0',
      cleanerVersion: '2.0.0',
    }
    const chapters = [0, 1].map((order) => ({
      id: `current-book:main:${order}`,
      ...(order === 0 ? {} : { bookId: 'current-book' }),
      order,
      chapterNumber: order + 1,
      title: `第${order + 1}章`,
      section: 'main',
      paragraphs: ['测试正文'],
      characterCount: 4,
      cumulativeCharacterStart: order * 4,
      sectionCharacterStart: order * 4,
    }))
    const progress: ReadingProgress = {
      bookId: 'current-book',
      chapterId: 'current-book:main:1',
      paragraphIndex: 0,
      characterOffset: 2,
      chapterProgress: 0.5,
      globalProgress: 0.75,
      updatedAt: '2026-08-08T00:00:00.000Z',
    }
    await legacy.table('books').add(legacyBook)
    await legacy.table('chapters').bulkAdd(chapters)
    await legacy.table('progress').add(progress)
    const before = {
      books: await legacy.table('books').count(),
      chapters: await legacy.table('chapters').count(),
      progress: await legacy.table('progress').count(),
    }
    legacy.close()

    const upgraded = new ReaderDatabase(name)
    await upgraded.open()
    expect(upgraded.verno).toBe(DATABASE_VERSION)
    expect({
      books: await upgraded.books.count(),
      chapters: await upgraded.chapters.count(),
      progress: await upgraded.progress.count(),
    }).toEqual(before)
    expect(await upgraded.books.get('current-book')).toMatchObject({
      ...legacyBook,
      updatedAt: progress.updatedAt,
      lastReadAt: progress.updatedAt,
      totalChapters: 2,
    } satisfies Partial<Book>)
    expect(((await upgraded.chapters.toArray()) as Chapter[]).every(
      (chapter) => chapter.bookId === 'current-book',
    )).toBe(true)
    expect(await upgraded.progress.get('current-book')).toEqual(progress)
    upgraded.close()

    const reopened = new ReaderDatabase(name)
    await reopened.open()
    expect({
      books: await reopened.books.count(),
      chapters: await reopened.chapters.count(),
      progress: await reopened.progress.count(),
    }).toEqual(before)
    reopened.close()
  })
})
