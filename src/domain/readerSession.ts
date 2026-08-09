import type { ChapterListItem } from '../db/repositories'
import type { ReadingProgress } from './models'
import type { TextAnchor } from './progressMetrics'

export interface ChapterNeighbors {
  previous?: ChapterListItem
  next?: ChapterListItem
}

export function resolveInitialChapter(
  chapters: readonly ChapterListItem[],
  progress?: Pick<ReadingProgress, 'chapterId'>,
): ChapterListItem | undefined {
  if (progress) {
    const saved = chapters.find((chapter) => chapter.id === progress.chapterId)
    if (saved) return saved
  }
  return chapters.find((chapter) => chapter.section === 'main') ?? chapters[0]
}

export function getChapterNeighbors(
  chapters: readonly ChapterListItem[],
  currentChapterId: string,
): ChapterNeighbors {
  const index = chapters.findIndex((chapter) => chapter.id === currentChapterId)
  if (index < 0) return {}
  return {
    previous: index > 0 ? chapters[index - 1] : undefined,
    next: index < chapters.length - 1 ? chapters[index + 1] : undefined,
  }
}

export function chapterStartAnchor(): TextAnchor {
  return { paragraphIndex: 0, characterOffset: 0 }
}

export function preserveAnchorForLayoutChange(anchor: TextAnchor): TextAnchor {
  return {
    paragraphIndex: Math.max(0, Math.trunc(anchor.paragraphIndex)),
    characterOffset: Math.max(0, Math.trunc(anchor.characterOffset)),
  }
}

export function chapterEndAnchor(paragraphs: readonly string[]): TextAnchor {
  const paragraphIndex = Math.max(0, paragraphs.length - 1)
  return {
    paragraphIndex,
    characterOffset: paragraphs[paragraphIndex]?.length ?? 0,
  }
}

export function anchorForSavedProgress(
  chapterId: string,
  progress?: Pick<ReadingProgress, 'chapterId' | 'paragraphIndex' | 'characterOffset'>,
): TextAnchor {
  return progress?.chapterId === chapterId
    ? { paragraphIndex: progress.paragraphIndex, characterOffset: progress.characterOffset }
    : chapterStartAnchor()
}
