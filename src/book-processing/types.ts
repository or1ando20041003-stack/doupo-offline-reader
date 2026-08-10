import type { BookSection, SourceEncoding } from '../domain/models'

export const PARSER_VERSION = '2.2.0'
export const CLEANER_VERSION = '2.1.0'

export type ParseWarningCode =
  | 'EMPTY_TEXT'
  | 'NO_CHAPTER_HEADINGS'
  | 'DUPLICATE_CHAPTER_TITLE'
  | 'CONTENT_BEFORE_FIRST_CHAPTER'
  | 'CANONICAL_ENDING_NOT_CONFIRMED'
  | 'NON_MONOTONIC_HEADING_IGNORED'
  | 'MAIN_CHAPTER_GAP'
  | 'NORMALIZED_CHAPTER_NUMERAL'
  | 'SUSPICIOUS_HEADING_RETAINED_AS_TEXT'

export interface ParseWarning {
  code: ParseWarningCode
  message: string
  priority?: 'info' | 'warning' | 'high'
  count?: number
}

export type CleaningRuleCategory =
  | 'NORMALIZATION'
  | 'STRUCTURAL_CLEANUP'
  | 'KNOWN_NOISE'
  | 'READING_CLEANUP'
  | 'PARAGRAPH_NORMALIZATION'

export interface CleaningWarning {
  code: 'POSSIBLE_READING_NOISE_RETAINED' | 'PUNCTUATION_ONLY_LINE_RETAINED'
  message: string
  priority: 'warning'
  count: number
  lineNumbers: number[]
}

export interface ParsedChapter {
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
  referenceMatchType?: Exclude<ChapterMatchType, 'unresolved'>
}

export type ReferenceEntryKind =
  | 'chapter'
  | 'preface'
  | 'prologue'
  | 'epilogue'
  | 'appendix'
  | 'special'
  | 'unknown'

export interface ReferenceEntry {
  order: number
  rawLabel: string
  normalizedLabel: string
  chapterNumber: number | null
  chapterTitle?: string
  groupTitle?: string
  kind: ReferenceEntryKind
  sourceLine: number
}

export interface ReferenceChapterIndex {
  entries: ReferenceEntry[]
  sourceFileName: string
  headerLine?: string
  duplicateChapterNumberCount: number
  duplicateLabelCount: number
  chapterNumberResets: number
  warnings: string[]
}

export type ChapterMatchType =
  | 'raw-exact'
  | 'normalized-exact'
  | 'body-prefix'
  | 'reference-prefix'
  | 'fuzzy'
  | 'unresolved'

export type ChapterMatchReason =
  | 'NUMBER_EXACT'
  | 'RAW_LINE_EXACT'
  | 'NORMALIZED_LINE_EXACT'
  | 'BODY_PREFIX_OF_REFERENCE'
  | 'REFERENCE_PREFIX_OF_BODY'
  | 'TITLE_SIMILAR'
  | 'ORDER_CONSISTENT'
  | 'ATTACHED_TEXT'
  | 'NO_BODY_MATCH'

export interface ChapterAlignmentMatch {
  referenceOrder: number
  bodyLineNumber?: number
  bodyStartOffset?: number
  matchType: ChapterMatchType
  score: number
  reasons: ChapterMatchReason[]
}

export interface ChapterAlignmentDiagnostics {
  referenceSourceFileName: string
  referenceEncoding?: SourceEncoding
  referenceEntries: number
  bodyCandidateCount: number
  originalChapterCount: number
  rawExactMatches: number
  normalizedExactMatches: number
  bodyPrefixMatches: number
  referencePrefixMatches: number
  fuzzyMatches: number
  unresolvedReferences: number
  bodyOnlyEntries: number
  finalEntries: number
  chapterNumberResets: number
  alignmentMs: number
  warning?: string
}

export interface ChapterAlignmentResult {
  chapters: ParsedChapter[]
  matches: ChapterAlignmentMatch[]
  diagnostics: ChapterAlignmentDiagnostics
}

export interface ParseResult {
  chapters: ParsedChapter[]
  warnings: ParseWarning[]
  canonicalEndingDetected: boolean
  conclusionOrder: number | null
}

export interface DecodeResult {
  text: string
  encoding: SourceEncoding
}

export type ImportStage =
  | 'reading'
  | 'decoding'
  | 'cleaning'
  | 'parsing'
  | 'reviewing'
  | 'saving'
  | 'complete'
  | 'error'

export interface WorkerImportRequest {
  type: 'import'
  payload: {
    buffer: ArrayBuffer
    sourceFileName: string
    reference?: {
      buffer: ArrayBuffer
      sourceFileName: string
    }
  }
}

export interface WorkerParsedPayload {
  contentHash: string
  encoding: SourceEncoding
  chapters: ParsedChapter[]
  warnings: ParseWarning[]
  cleaningWarnings: CleaningWarning[]
  appliedCleaningRuleIds: string[]
  cleaningRuleHits: Record<string, number>
  canonicalEndingDetected: boolean
  timings: ProcessingTimings
  totalCharacterCount: number
  mainCharacterCount: number
  extraCharacterCount: number
  chapterAlignment?: ChapterAlignmentDiagnostics
}

export interface ProcessingTimings {
  decodeMs: number
  cleanMs: number
  parseMs: number
  totalMs: number
}

export type WorkerImportResponse =
  | { type: 'progress'; stage: 'decoding' | 'cleaning' | 'parsing' }
  | { type: 'result'; payload: WorkerParsedPayload }
  | { type: 'error'; message: string; details?: string }
