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

  async getBook(bookId?: string): Promise<Book | undefined> {
    if (bookId) return this.database.books.get(bookId)
    return this.database.books.orderBy('importedAt').last()
  }

  async saveChapters(chapters: readonly Chapter[]): Promise<void> {
    await this.database.chapters.bulkPut([...chapters])
  }

  async getChapter(chapterId: string): Promise<Chapter | undefined> {
    return this.database.chapters.get(chapterId)
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
    await this.database.progress.put(progress)
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

  async clearBookData(): Promise<void> {
    await this.database.transaction(
      'rw',
      [this.database.books, this.database.chapters, this.database.progress],
      async () => {
        await Promise.all([
          this.database.books.clear(),
          this.database.chapters.clear(),
          this.database.progress.clear(),
        ])
      },
    )
  }

  async replaceBookData(
    book: Book,
    chapters: readonly Chapter[],
  ): Promise<{ clearedProgress: boolean }> {
    return this.database.transaction(
      'rw',
      [this.database.books, this.database.chapters, this.database.progress],
      async () => {
        const clearedProgress = (await this.database.progress.count()) > 0
        await this.database.books.clear()
        await this.database.chapters.clear()
        await this.database.progress.clear()
        await this.database.books.put(book)
        await this.database.chapters.bulkPut([...chapters])
        return { clearedProgress }
      },
    )
  }

  async close(): Promise<void> {
    this.database.close()
  }
}

export const readerRepository = new ReaderRepository()
