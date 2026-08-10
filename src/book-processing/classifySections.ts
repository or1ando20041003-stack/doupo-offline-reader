import type { ParsedChapter, ParseWarning } from './types'
import type { ProcessingProfile } from './processingProfile'

export interface SectionClassificationResult {
  chapters: ParsedChapter[]
  warnings: ParseWarning[]
  conclusionOrder: number | null
  canonicalEndingDetected: boolean
}

export type ConclusionMatcher = (chapter: Readonly<ParsedChapter>) => boolean

export const defaultConclusionMatcher: ConclusionMatcher = (chapter) =>
  chapter.chapterNumber === 1624 &&
  /结束[，,、]?也(?:是)?开始/.test(chapter.title) &&
  /大结局/.test(chapter.title)

export function classifySections(
  chapters: readonly ParsedChapter[],
  profile: ProcessingProfile = 'generic',
  matcher: ConclusionMatcher = defaultConclusionMatcher,
): SectionClassificationResult {
  if (profile === 'generic') {
    return {
      chapters: chapters.map((chapter) => ({ ...chapter, section: 'main' })),
      warnings: [],
      conclusionOrder: null,
      canonicalEndingDetected: false,
    }
  }
  const conclusionIndex = chapters.findIndex(matcher)
  if (conclusionIndex < 0) {
    return {
      chapters: chapters.map((chapter) => ({ ...chapter, section: 'main' })),
      warnings: [
        {
          code: 'CANONICAL_ENDING_NOT_CONFIRMED',
          message: '未同时确认第 1624 章、真实结束标题和“大结局”标志，所有章节暂归正文。',
          priority: 'high',
        },
      ],
      conclusionOrder: null,
      canonicalEndingDetected: false,
    }
  }

  return {
    chapters: chapters.map((chapter, index) => ({
      ...chapter,
      section: index > conclusionIndex ? 'extra' : 'main',
    })),
    warnings: [],
    conclusionOrder: chapters[conclusionIndex]?.order ?? null,
    canonicalEndingDetected: true,
  }
}
