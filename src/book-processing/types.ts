import type { BookSection, SourceEncoding } from '../domain/models'

export const PARSER_VERSION = '2.0.0'
export const CLEANER_VERSION = '2.0.0'

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
  | 'saving'
  | 'complete'
  | 'error'

export interface WorkerImportRequest {
  type: 'import'
  payload: {
    buffer: ArrayBuffer
  }
}

export interface WorkerParsedPayload {
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
