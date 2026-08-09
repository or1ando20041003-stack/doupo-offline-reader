import Dexie, { type EntityTable } from 'dexie'
import type { Book, Chapter, ReaderSettings, ReadingProgress } from '../domain/models'

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
  }
}

export const readerDatabase = new ReaderDatabase()
