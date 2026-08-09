import type { Book, Chapter, ReadingProgress } from '../domain/models'
import type { TextAnchor } from '../domain/progressMetrics'
import { characterOffsetInChapter } from '../domain/progressMetrics'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function createReadingProgress(
  book: Readonly<Book>,
  chapter: Readonly<Chapter>,
  anchor: TextAnchor,
  now = new Date(),
): ReadingProgress {
  const chapterOffset = characterOffsetInChapter(chapter, anchor)
  const sectionTotal = chapter.section === 'main' ? book.mainCharacterCount : book.extraCharacterCount
  const characterPosition = chapter.sectionCharacterStart + chapterOffset
  return {
    bookId: book.id,
    chapterId: chapter.id,
    paragraphIndex: clamp(anchor.paragraphIndex, 0, Math.max(0, chapter.paragraphs.length - 1)),
    characterOffset: clamp(
      anchor.characterOffset,
      0,
      chapter.paragraphs[clamp(anchor.paragraphIndex, 0, Math.max(0, chapter.paragraphs.length - 1))]?.length ?? 0,
    ),
    chapterProgress: chapter.characterCount === 0 ? 0 : clamp(chapterOffset / chapter.characterCount, 0, 1),
    globalProgress: sectionTotal === 0 ? 0 : clamp(characterPosition / sectionTotal, 0, 1),
    updatedAt: now.toISOString(),
  }
}

export class ProgressSaveScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined
  private pending: ReadingProgress | undefined

  constructor(
    private readonly save: (progress: ReadingProgress) => Promise<void>,
    private readonly delayMs = 1000,
  ) {}

  schedule(progress: ReadingProgress): void {
    this.pending = progress
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.flush()
    }, this.delayMs)
  }

  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    const progress = this.pending
    this.pending = undefined
    if (progress) await this.save(progress)
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    this.pending = undefined
  }
}
