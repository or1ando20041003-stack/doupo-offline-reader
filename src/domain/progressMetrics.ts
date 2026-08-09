import type { BookSection, Chapter } from './models'

export type ProgressScope = BookSection | 'all'

export interface TextAnchor {
  paragraphIndex: number
  characterOffset: number
}

export interface CalculatedProgress {
  chapterProgress: number
  scopeProgress: number
  scope: ProgressScope
  characterPosition: number
  scopeCharacterCount: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function characterOffsetInChapter(chapter: Readonly<Chapter>, anchor: TextAnchor): number {
  if (chapter.paragraphs.length === 0) return 0
  const paragraphIndex = clamp(anchor.paragraphIndex, 0, chapter.paragraphs.length - 1)
  const precedingCharacters = chapter.paragraphs
    .slice(0, paragraphIndex)
    .reduce((sum, paragraph) => sum + paragraph.length, 0)
  const paragraph = chapter.paragraphs[paragraphIndex] ?? ''
  return precedingCharacters + clamp(anchor.characterOffset, 0, paragraph.length)
}

export function calculateProgress(
  chapter: Readonly<Chapter>,
  anchor: TextAnchor,
  chapters: readonly Chapter[],
  scope: ProgressScope = chapter.section,
): CalculatedProgress {
  if (scope !== 'all' && chapter.section !== scope) {
    throw new Error(`章节分区 ${chapter.section} 不属于进度范围 ${scope}。`)
  }
  const chapterOffset = characterOffsetInChapter(chapter, anchor)
  const scopeChapters = scope === 'all' ? chapters : chapters.filter((item) => item.section === scope)
  const scopeCharacterCount = scopeChapters.reduce((sum, item) => sum + item.characterCount, 0)
  const chapterStart = scope === 'all' ? chapter.cumulativeCharacterStart : chapter.sectionCharacterStart
  const characterPosition = chapterStart + chapterOffset
  return {
    chapterProgress:
      chapter.characterCount === 0 ? 0 : clamp(chapterOffset / chapter.characterCount, 0, 1),
    scopeProgress:
      scopeCharacterCount === 0 ? 0 : clamp(characterPosition / scopeCharacterCount, 0, 1),
    scope,
    characterPosition,
    scopeCharacterCount,
  }
}
