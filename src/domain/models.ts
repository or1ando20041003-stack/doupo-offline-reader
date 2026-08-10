export type BookSection = 'main' | 'extra'
export type ReaderTheme = 'paper' | 'light' | 'eyeCare' | 'dark'
export type ReadingMode = 'scroll' | 'paged'
export type SourceEncoding = 'utf-8' | 'gb18030'

export interface Book {
  id: string
  title: string
  author?: string
  description?: string
  sourceFileName: string
  sourceEncoding: SourceEncoding
  sourceHash?: string
  importedAt: string
  updatedAt: string
  lastReadAt?: string
  totalChapters: number
  mainChapterCount: number
  extraChapterCount: number
  totalCharacterCount: number
  wordCount?: number
  mainCharacterCount: number
  extraCharacterCount: number
  parserVersion: string
  cleanerVersion: string
  importDiagnostics?: {
    referenceChapterCount: number
    bodyCandidateCount: number
    exactMatches: number
    highMatches: number
    fuzzyMatches: number
    unresolvedReferences: number
    bodyOnlyChapters: number
    finalChapterCount: number
    alignmentTimeMs: number
  }
}

export interface Chapter {
  id: string
  bookId: string
  order: number
  chapterNumber: number | null
  title: string
  section: BookSection
  paragraphs: string[]
  characterCount: number
  cumulativeCharacterStart: number
  sectionCharacterStart: number
  rawTitle?: string
  referenceTitle?: string
  referenceMatchType?: 'exact' | 'high' | 'fuzzy'
}

export interface ReadingProgress {
  bookId: string
  chapterId: string
  paragraphIndex: number
  characterOffset: number
  chapterProgress: number
  globalProgress: number
  updatedAt: string
}

export interface ReaderSettings {
  id: 'reader-settings'
  fontFamily: string
  fontSize: number
  lineHeight: number
  contentWidth: number
  horizontalPadding: number
  paragraphIndent: string
  theme: ReaderTheme
  readingMode: ReadingMode
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  id: 'reader-settings',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  fontSize: 19,
  lineHeight: 1.8,
  contentWidth: 760,
  horizontalPadding: 20,
  paragraphIndent: '2em',
  theme: 'paper',
  readingMode: 'scroll',
}
