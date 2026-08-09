import type { Book, ReaderSettings, ReadingProgress } from '../domain/models'
import { ReaderRepository, readerRepository } from '../db/repositories'

export interface BookshelfEntry {
  book: Book
  progress?: ReadingProgress
  currentChapterTitle?: string
}

export interface ReaderBookState {
  book: Book
  progress?: ReadingProgress
  settings: ReaderSettings
}

export async function loadBookshelf(
  repository: ReaderRepository = readerRepository,
): Promise<BookshelfEntry[]> {
  const books = await repository.getBooks()
  return Promise.all(books.map(async (book) => {
    const progress = await repository.getProgress(book.id)
    const currentChapter = progress
      ? await repository.getChapter(book.id, progress.chapterId)
      : undefined
    return {
      book,
      progress,
      currentChapterTitle: currentChapter?.title,
    }
  }))
}

export async function loadReaderBook(
  bookId: string,
  repository: ReaderRepository = readerRepository,
): Promise<ReaderBookState> {
  const [book, progress, settings] = await Promise.all([
    repository.getBookById(bookId),
    repository.getProgress(bookId),
    repository.getSettings(),
  ])
  if (!book) throw new Error('书架中找不到这本小说。')
  return { book, progress, settings }
}
