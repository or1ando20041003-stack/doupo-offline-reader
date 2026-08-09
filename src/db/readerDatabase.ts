import Dexie, { type EntityTable } from 'dexie'
import type { Book, Chapter, ReaderSettings, ReadingProgress } from '../domain/models'
import { upgradeToMultiBookSchema } from './migrations'

export const DATABASE_VERSION = 3

export class ReaderDatabase extends Dexie {
  books!: EntityTable<Book, 'id'>
  chapters!: EntityTable<Chapter, 'id'>
  progress!: EntityTable<ReadingProgress, 'bookId'>
  settings!: EntityTable<ReaderSettings, 'id'>

  constructor(name = 'doupo-offline-reader') {
    super(name)

    this.version(1).stores({
      books: '&id, importedAt',
      chapters: '&id, bookId, [bookId+order], [bookId+section]',
      progress: '&bookId, chapterId, updatedAt',
      settings: '&id',
    })

    this.version(2).stores({
      books: '&id, importedAt, updatedAt, lastReadAt',
      chapters: '&id, bookId, [bookId+order], [bookId+section], [bookId+chapterNumber]',
      progress: '&bookId, chapterId, updatedAt',
      settings: '&id',
    }).upgrade(upgradeToMultiBookSchema)

    this.version(DATABASE_VERSION).stores({
      books: '&id, importedAt, updatedAt, lastReadAt, sourceHash',
      chapters: '&id, bookId, [bookId+order], [bookId+section], [bookId+chapterNumber]',
      progress: '&bookId, chapterId, updatedAt',
      settings: '&id',
    })
  }
}

export const readerDatabase = new ReaderDatabase()
