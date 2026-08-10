import type { SourceEncoding } from '../domain/models'
import { cleanText, type CleanTextResult } from './cleanText'
import { matchChapterHeading, parseChapters } from './parseChapters'
import { selectProcessingProfile } from './processingProfile'
import {
  CLEANER_VERSION,
  PARSER_VERSION,
  type ParsedChapter,
  type ParseResult,
} from './types'

const LOOSE_HEADING = /^\s*第.{1,18}[章回节卷]/
const HTML_RESIDUE = /<\/?(?:dd|br|div|p|span|html|body)(?:\s[^>\n]*)?\s*\/?>|&nbsp;|\/dd(?=\s*$)/gim
const LIKELY_NOISE = /未完待续|推荐票|月票|求.{0,4}(?:收藏|订阅|点击)|最快更新|手机.{0,6}阅读|手机用户|https?:\/\/|www\.|新书.{0,16}(?:发布|上传|推荐|收藏)|支持正版阅读/i

export interface NumberOccurrence {
  chapterNumber: number
  count: number
}

export interface CandidateHeadingIssue {
  lineNumber: number
  summary: string
}

export interface CandidateSequenceIssue extends CandidateHeadingIssue {
  previousChapterNumber: number
  chapterNumber: number
}

export interface BookInspectionReport {
  source: {
    sourceFileName: string
    fileSize: number
    encoding: SourceEncoding
    totalLines: number
    nonEmptyLines: number
    decodedCharacters: number
  }
  raw: {
    wudongqiankunOccurrences: number
    htmlResidueOccurrences: number
    likelyNoiseLines: number
    candidateChapterHeadings: number
    candidateChapterNumberRange: { min: number | null; max: number | null }
    duplicateCandidateNumbers: NumberOccurrence[]
    missingCandidateNumbers: number[]
    candidateSequenceIssues: CandidateSequenceIssue[]
    unparsedCandidateHeadings: CandidateHeadingIssue[]
    endingCandidates: CandidateHeadingIssue[]
  }
  cleaning: {
    cleanerVersion: string
    appliedRuleIds: string[]
    ruleHits: Record<string, number>
    warnings: CleanTextResult['warnings']
    wudongqiankunAfter: number
    htmlResidueAfter: number
    likelyNoiseLinesAfter: number
    residualNoiseSamples: CandidateHeadingIssue[]
  }
  chapters: {
    parserVersion: string
    total: number
    main: number
    extra: number
    missingMainNumbers: number[]
    duplicateMainNumbers: NumberOccurrence[]
    unnumberedMainChapters: number
    outOfOrderMainChapters: number
    canonicalEndingDetected: boolean
    chaptersAfterEnding: number
    emptyChapters: Array<{ order: number; title: string }>
    suspiciousShortChapters: Array<{ order: number; chapterNumber: number | null; title: string; characterCount: number }>
    suspiciousLongChapters: Array<{ order: number; chapterNumber: number | null; title: string; characterCount: number }>
    parserWarnings: Array<{ code: string; message: string }>
  }
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length
}

function duplicateNumbers(numbers: readonly number[]): NumberOccurrence[] {
  const counts = new Map<number, number>()
  for (const number of numbers) counts.set(number, (counts.get(number) ?? 0) + 1)
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([chapterNumber, count]) => ({ chapterNumber, count }))
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
}

function missingNumbers(numbers: readonly number[], start: number, end: number): number[] {
  const present = new Set(numbers)
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index).filter(
    (number) => !present.has(number),
  )
}

function summarizeLine(line: string): string {
  const normalized = line.trim().replace(/\s+/g, ' ')
  return normalized.length <= 120 ? normalized : `${normalized.slice(0, 117)}…`
}

function analyzeChapterLengths(chapters: readonly ParsedChapter[]) {
  const emptyChapters = chapters
    .filter((chapter) => chapter.characterCount === 0)
    .map(({ order, title }) => ({ order, title }))
  const suspiciousShortChapters = chapters
    .filter((chapter) => chapter.characterCount > 0 && chapter.characterCount < 200)
    .map(({ order, chapterNumber, title, characterCount }) => ({ order, chapterNumber, title, characterCount }))
  const suspiciousLongChapters = chapters
    .filter((chapter) => chapter.characterCount > 20_000)
    .map(({ order, chapterNumber, title, characterCount }) => ({ order, chapterNumber, title, characterCount }))
  return { emptyChapters, suspiciousShortChapters, suspiciousLongChapters }
}

export function inspectBookText(
  text: string,
  source: { sourceFileName: string; fileSize: number; encoding: SourceEncoding },
  processing?: { cleaned: CleanTextResult; parsed: ParseResult },
): BookInspectionReport {
  const profile = selectProcessingProfile(source.sourceFileName)
  const lines = text.split(/\r\n|\n|\r/)
  const candidateEntries: Array<{ chapterNumber: number; lineNumber: number; summary: string }> = []
  const unparsedCandidateHeadings: CandidateHeadingIssue[] = []
  const endingCandidates: CandidateHeadingIssue[] = []

  lines.forEach((line, index) => {
    const heading = matchChapterHeading(line)
    if (heading?.chapterNumber !== null && heading?.chapterNumber !== undefined) {
      candidateEntries.push({
        chapterNumber: heading.chapterNumber,
        lineNumber: index + 1,
        summary: summarizeLine(line),
      })
    } else if (LOOSE_HEADING.test(line)) {
      unparsedCandidateHeadings.push({ lineNumber: index + 1, summary: summarizeLine(line) })
    }
    if (profile === 'doupoLegacy' && /大结局|结束[，,、]?也(?:是)?开始/.test(line)) {
      endingCandidates.push({ lineNumber: index + 1, summary: summarizeLine(line) })
    }
  })

  const cleaned = processing?.cleaned ?? cleanText(text, { profile })
  const parsed = processing?.parsed ?? parseChapters(cleaned.text, { profile })
  const mainChapters = parsed.chapters.filter((chapter) => chapter.section === 'main')
  const extraChapters = parsed.chapters.filter((chapter) => chapter.section === 'extra')
  const mainNumbers = mainChapters
    .map((chapter) => chapter.chapterNumber)
    .filter((number): number is number => (
      number !== null && number >= 1 && (profile !== 'doupoLegacy' || number <= 1624)
    ))
  let outOfOrderMainChapters = 0
  for (let index = 1; index < mainNumbers.length; index += 1) {
    if ((mainNumbers[index] ?? 0) <= (mainNumbers[index - 1] ?? 0)) outOfOrderMainChapters += 1
  }
  const endingIndex = profile === 'doupoLegacy' ? parsed.chapters.findIndex(
    (chapter) => chapter.chapterNumber === 1624 && /(?:大结局|结束[，,、]?也(?:是)?开始)/.test(chapter.title),
  ) : -1
  const candidateNumbers = candidateEntries.map((entry) => entry.chapterNumber)
  const candidateSequenceIssues: CandidateSequenceIssue[] = []
  for (let index = 1; profile === 'doupoLegacy' && index < candidateEntries.length; index += 1) {
    const previous = candidateEntries[index - 1]
    const current = candidateEntries[index]
    if (previous && current && current.chapterNumber !== previous.chapterNumber + 1) {
      candidateSequenceIssues.push({
        lineNumber: current.lineNumber,
        summary: current.summary,
        previousChapterNumber: previous.chapterNumber,
        chapterNumber: current.chapterNumber,
      })
    }
  }
  const candidateMin = candidateNumbers.length > 0 ? Math.min(...candidateNumbers) : null
  const candidateMax = candidateNumbers.length > 0 ? Math.max(...candidateNumbers) : null

  return {
    source: {
      ...source,
      totalLines: lines.length,
      nonEmptyLines: lines.filter((line) => line.trim().length > 0).length,
      decodedCharacters: text.length,
    },
    raw: {
      wudongqiankunOccurrences: countMatches(text, /武动乾坤/g),
      htmlResidueOccurrences: countMatches(text, new RegExp(HTML_RESIDUE.source, HTML_RESIDUE.flags)),
      likelyNoiseLines: lines.filter((line) => LIKELY_NOISE.test(line)).length,
      candidateChapterHeadings: candidateNumbers.length,
      candidateChapterNumberRange: { min: candidateMin, max: candidateMax },
      duplicateCandidateNumbers: duplicateNumbers(candidateNumbers),
      missingCandidateNumbers:
        profile === 'doupoLegacy' && candidateMin !== null && candidateMax !== null
          ? missingNumbers(candidateNumbers, candidateMin, Math.min(candidateMax, 1624))
          : [],
      candidateSequenceIssues: candidateSequenceIssues.slice(0, 250),
      unparsedCandidateHeadings: unparsedCandidateHeadings.slice(0, 200),
      endingCandidates: endingCandidates.slice(0, 20),
    },
    cleaning: {
      cleanerVersion: CLEANER_VERSION,
      appliedRuleIds: cleaned.appliedRuleIds,
      ruleHits: cleaned.ruleHits,
      warnings: cleaned.warnings,
      wudongqiankunAfter: countMatches(cleaned.text, /武动乾坤/g),
      htmlResidueAfter: countMatches(
        cleaned.text,
        new RegExp(HTML_RESIDUE.source, HTML_RESIDUE.flags),
      ),
      likelyNoiseLinesAfter: cleaned.text.split('\n').filter((line) => LIKELY_NOISE.test(line)).length,
      residualNoiseSamples: cleaned.text
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => LIKELY_NOISE.test(line))
        .slice(0, 120)
        .map(({ line, index }) => ({ lineNumber: index + 1, summary: summarizeLine(line) })),
    },
    chapters: {
      parserVersion: PARSER_VERSION,
      total: parsed.chapters.length,
      main: mainChapters.length,
      extra: extraChapters.length,
      missingMainNumbers: profile === 'doupoLegacy' ? missingNumbers(mainNumbers, 1, 1624) : [],
      duplicateMainNumbers: duplicateNumbers(mainNumbers),
      unnumberedMainChapters: mainChapters.filter((chapter) => chapter.chapterNumber === null).length,
      outOfOrderMainChapters,
      canonicalEndingDetected: parsed.canonicalEndingDetected && endingIndex >= 0,
      chaptersAfterEnding: endingIndex >= 0 ? parsed.chapters.length - endingIndex - 1 : 0,
      ...analyzeChapterLengths(parsed.chapters),
      parserWarnings: parsed.warnings,
    },
  }
}
