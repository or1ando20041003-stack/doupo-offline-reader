import type { Book, BookSection, Chapter, ReaderSettings, ReadingProgress } from '../domain/models'
import { DEFAULT_READER_SETTINGS } from '../domain/models'
import { ReaderDatabase, readerDatabase } from './readerDatabase'

export type ChapterListItem = Pick<
  Chapter,
  'id' | 'bookId' | 'order' | 'chapterNumber' | 'title' | 'section' | 'characterCount' | 'cumulativeCharacterStart' | 'sectionCharacterStart'
>

export class ReaderRepository {
  constructor(private readonly database: ReaderDatabase = readerDatabase) {}

  async saveBook(book: Book): Promise<void> {
    await this.database.books.put(book)
  }

  async getBooks(): Promise<Book[]> {
    const books = await this.database.books.toArray()
    return books.sort((left, right) => {
      const leftDate = left.lastReadAt ?? left.importedAt
      const rightDate = right.lastReadAt ?? right.importedAt
      return rightDate.localeCompare(leftDate)
    })
  }

  async getBookById(bookId: string): Promise<Book | undefined> {
    return this.database.books.get(bookId)
  }

  async saveChapters(bookId: string, chapters: readonly Chapter[]): Promise<void> {
    if (chapters.some((chapter) => chapter.bookId !== bookId)) {
      throw new Error('章节所属书籍与保存目标不一致。')
    }
    await this.database.chapters.bulkPut([...chapters])
  }

  async getChapter(bookId: string, chapterId: string): Promise<Chapter | undefined> {
    const chapter = await this.database.chapters.get(chapterId)
    return chapter?.bookId === bookId ? chapter : undefined
  }

  async getChapters(bookId: string): Promise<Chapter[]> {
    return this.database.chapters.where('bookId').equals(bookId).sortBy('order')
  }

  async getChapterIndex(bookId: string): Promise<ChapterListItem[]> {
    const items: ChapterListItem[] = []
    await this.database.chapters.where('bookId').equals(bookId).each((chapter) => {
      const { paragraphs: _paragraphs, ...item } = chapter
      items.push(item)
    })
    return items.sort((left, right) => left.order - right.order)
  }

  async getChaptersBySection(bookId: string, section: BookSection): Promise<Chapter[]> {
    return this.database.chapters
      .where('[bookId+section]')
      .equals([bookId, section])
      .sortBy('order')
  }

  async saveProgress(progress: ReadingProgress): Promise<void> {
    await this.database.transaction('rw', [this.database.books, this.database.progress], async () => {
      await this.database.progress.put(progress)
      await this.database.books.update(progress.bookId, {
        lastReadAt: progress.updatedAt,
        updatedAt: progress.updatedAt,
      })
    })
  }

  async getProgress(bookId: string): Promise<ReadingProgress | undefined> {
    return this.database.progress.get(bookId)
  }

  async saveSettings(settings: ReaderSettings): Promise<void> {
    await this.database.settings.put(settings)
  }

  async getSettings(): Promise<ReaderSettings> {
    const stored = await this.database.settings.get('reader-settings')
    return stored ? { ...DEFAULT_READER_SETTINGS, ...stored } : { ...DEFAULT_READER_SETTINGS }
  }

  async addBook(
    book: Book,
    chapters: readonly Chapter[],
    initialProgress: ReadingProgress,
  ): Promise<void> {
    if (chapters.length === 0 || chapters.some((chapter) => chapter.bookId !== book.id)) {
      throw new Error('书籍必须包含属于自身的章节。')
    }
    if (initialProgress.bookId !== book.id || !chapters.some(({ id }) => id === initialProgress.chapterId)) {
      throw new Error('初始阅读进度与书籍不一致。')
    }
    await this.database.transaction(
      'rw',
      [this.database.books, this.database.chapters, this.database.progress],
      async () => {
        await this.database.books.add(book)
        await this.database.chapters.bulkAdd([...chapters])
        await this.database.progress.add(initialProgress)
      },
    )
  }

  async deleteBook(bookId: string): Promise<void> {
    await this.database.transaction(
      'rw',
      [this.database.books, this.database.chapters, this.database.progress],
      async () => {
        await this.database.chapters.where('bookId').equals(bookId).delete()
        await this.database.progress.delete(bookId)
        await this.database.books.delete(bookId)
      },
    )
  }

  async close(): Promise<void> {
    this.database.close()
  }
}

export const readerRepository = new ReaderRepository()
