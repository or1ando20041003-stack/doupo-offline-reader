import type { Transaction } from 'dexie'
import type { Book, Chapter, ReadingProgress } from '../domain/models'

type LegacyBook = Omit<Book, 'updatedAt' | 'totalChapters'> & {
  updatedAt?: string
  totalChapters?: number
}

type LegacyChapter = Omit<Chapter, 'bookId'> & { bookId?: string }
type LegacyReadingProgress = Omit<ReadingProgress, 'bookId'> & { bookId?: string }

function requireSoleBookId(books: readonly LegacyBook[], recordType: string): string {
  if (books.length === 1) return books[0]!.id
  throw new Error(`数据库升级无法确定${recordType}所属书籍，已安全回滚。`)
}

/** Upgrade the phase-3 single-book records in place. Dexie runs this atomically. */
export async function upgradeToMultiBookSchema(transaction: Transaction): Promise<void> {
  const booksTable = transaction.table<LegacyBook, string>('books')
  const chaptersTable = transaction.table<LegacyChapter, string>('chapters')
  const progressTable = transaction.table<LegacyReadingProgress, string>('progress')

  const books = await booksTable.toArray()
  const progressRecords = await progressTable.toArray()
  const fallbackBookId = books.length === 1 ? books[0]!.id : undefined

  await chaptersTable.toCollection().modify((chapter) => {
    if (!chapter.bookId) chapter.bookId = fallbackBookId ?? requireSoleBookId(books, '章节')
  })

  await progressTable.toCollection().modify((progress) => {
    if (!progress.bookId) progress.bookId = fallbackBookId ?? requireSoleBookId(books, '阅读进度')
  })

  const progressByBook = new Map(
    progressRecords
      .filter((progress): progress is LegacyReadingProgress & { bookId: string } => Boolean(progress.bookId))
      .map((progress) => [progress.bookId, progress]),
  )
  await booksTable.toCollection().modify((book) => {
    const progress = progressByBook.get(book.id)
    book.updatedAt ??= progress?.updatedAt ?? book.importedAt
    book.totalChapters ??= book.mainChapterCount + book.extraChapterCount
    if (!book.lastReadAt && progress?.updatedAt) book.lastReadAt = progress.updatedAt
  })
}
