import { classifySections, defaultConclusionMatcher } from './classifySections'
import { parseChapterNumber } from './chineseNumber'
import type { ParsedChapter, ParseResult, ParseWarning } from './types'

export const MAX_CHAPTER_TITLE_LENGTH = 60

const CHAPTER_HEADING = new RegExp(
  `^\\s*第\\s*([零〇一二两三四五六七八九十百千万佰仟干\\d]+)\\s*章\\s*(.{0,${MAX_CHAPTER_TITLE_LENGTH}})\\s*$`,
)
const LOOSE_CHAPTER_HEADING = /^\s*第.{1,18}章/

export interface ChapterHeading {
  chapterNumber: number | null
  title: string
  numeralNormalized: boolean
}

interface HeadingEntry {
  index: number
  heading: ChapterHeading
}

interface HeadingSelection {
  accepted: HeadingEntry[]
  ignoredLineIndexes: ReadonlySet<number>
}

export function matchChapterHeading(line: string): ChapterHeading | null {
  const match = CHAPTER_HEADING.exec(line)
  if (!match) return null
  const numeral = match[1]
  if (!numeral) return null
  const suffix = match[2]?.trim() ?? ''
  return {
    chapterNumber: parseChapterNumber(numeral),
    title: `第${numeral}章${suffix ? ` ${suffix}` : ''}`,
    numeralNormalized: /[佰仟干]/.test(numeral),
  }
}

function paragraphsFrom(lines: readonly string[]): string[] {
  return lines.map((line) => line.trim()).filter((line) => line.length > 0)
}

function buildParsedChapter(
  order: number,
  heading: ChapterHeading,
  bodyLines: readonly string[],
): ParsedChapter {
  const paragraphs = paragraphsFrom(bodyLines)
  return {
    order,
    chapterNumber: heading.chapterNumber,
    title: heading.title,
    section: 'main',
    paragraphs,
    characterCount: paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0),
    cumulativeCharacterStart: 0,
    sectionCharacterStart: 0,
  }
}

function findAcceptedHeadings(lines: readonly string[], warnings: ParseWarning[]): HeadingSelection {
  const candidates: HeadingEntry[] = []
  let suspiciousHeadingCount = 0
  lines.forEach((line, index) => {
    const heading = matchChapterHeading(line)
    if (heading) candidates.push({ index, heading })
    else if (LOOSE_CHAPTER_HEADING.test(line)) suspiciousHeadingCount += 1
  })

  if (suspiciousHeadingCount > 0) {
    warnings.push({
      code: 'SUSPICIOUS_HEADING_RETAINED_AS_TEXT',
      message: `${suspiciousHeadingCount} 行疑似标题因格式或长度不可靠而保留为正文。`,
      priority: 'warning',
      count: suspiciousHeadingCount,
    })
  }

  const canonicalCandidateIndex = candidates.findIndex((entry) =>
    defaultConclusionMatcher({
      ...buildParsedChapter(0, entry.heading, []),
      chapterNumber: entry.heading.chapterNumber,
    }),
  )
  const accepted: HeadingEntry[] = []
  let lastMainNumber: number | null = null
  let ignoredCount = 0
  const ignoredLineIndexes = new Set<number>()
  let normalizedNumeralCount = 0
  const gaps: Array<{ after: number; before: number }> = []

  candidates.forEach((entry, candidateIndex) => {
    if (entry.heading.numeralNormalized) normalizedNumeralCount += 1
    const isExtraCandidate = canonicalCandidateIndex >= 0 && candidateIndex > canonicalCandidateIndex
    const number = entry.heading.chapterNumber
    if (!isExtraCandidate && lastMainNumber !== null && number !== null) {
      if (number <= lastMainNumber) {
        ignoredCount += 1
        ignoredLineIndexes.add(entry.index)
        return
      }
      if (number > lastMainNumber + 1) gaps.push({ after: lastMainNumber, before: number })
    }
    accepted.push(entry)
    if (!isExtraCandidate && number !== null) lastMainNumber = number
  })

  if (ignoredCount > 0) {
    warnings.push({
      code: 'NON_MONOTONIC_HEADING_IGNORED',
      message: `正文区忽略了 ${ignoredCount} 个重复、倒退或正文型标题候选。`,
      priority: 'warning',
      count: ignoredCount,
    })
  }
  if (gaps.length > 0) {
    const missingCount = gaps.reduce((sum, gap) => sum + gap.before - gap.after - 1, 0)
    warnings.push({
      code: 'MAIN_CHAPTER_GAP',
      message: `真实源文件的正文标题序列存在 ${missingCount} 个缺号，解析器未擅自补号。`,
      priority: 'high',
      count: missingCount,
    })
  }
  if (normalizedNumeralCount > 0) {
    warnings.push({
      code: 'NORMALIZED_CHAPTER_NUMERAL',
      message: `识别了 ${normalizedNumeralCount} 个“佰/仟/干”等高置信 OCR 章节数字。`,
      priority: 'info',
      count: normalizedNumeralCount,
    })
  }
  return { accepted, ignoredLineIndexes }
}

function applyCharacterPositions(chapters: readonly ParsedChapter[]): ParsedChapter[] {
  let cumulativeCharacterStart = 0
  const sectionStarts = { main: 0, extra: 0 }
  return chapters.map((chapter, order) => {
    const positioned = {
      ...chapter,
      order,
      cumulativeCharacterStart,
      sectionCharacterStart: sectionStarts[chapter.section],
    }
    cumulativeCharacterStart += chapter.characterCount
    sectionStarts[chapter.section] += chapter.characterCount
    return positioned
  })
}

export function parseChapters(text: string): ParseResult {
  if (!text.trim()) {
    return {
      chapters: [],
      warnings: [{ code: 'EMPTY_TEXT', message: '文本为空，未解析到章节。', priority: 'high' }],
      canonicalEndingDetected: false,
      conclusionOrder: null,
    }
  }

  const lines = text.split('\n')
  const warnings: ParseWarning[] = []
  const selection = findAcceptedHeadings(lines, warnings)
  const headings = selection.accepted
  const contentLines = lines.map((line, index) =>
    selection.ignoredLineIndexes.has(index) ? '' : line,
  )

  if (headings.length === 0) {
    const paragraphs = paragraphsFrom(lines)
    const fallback: ParsedChapter = {
      order: 0,
      chapterNumber: null,
      title: '全文',
      section: 'main',
      paragraphs,
      characterCount: paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0),
      cumulativeCharacterStart: 0,
      sectionCharacterStart: 0,
    }
    return {
      chapters: [fallback],
      warnings: [
        { code: 'NO_CHAPTER_HEADINGS', message: '未识别到章节标题，已将内容作为单章“全文”导入。', priority: 'high' },
        { code: 'CANONICAL_ENDING_NOT_CONFIRMED', message: '未找到可靠的大结局标志，内容暂归正文。', priority: 'high' },
      ],
      canonicalEndingDetected: false,
      conclusionOrder: null,
    }
  }

  const firstHeadingIndex = headings[0]?.index ?? 0
  const prefaceLines = contentLines.slice(0, firstHeadingIndex)
  if (paragraphsFrom(prefaceLines).length > 0) {
    warnings.push({
      code: 'CONTENT_BEFORE_FIRST_CHAPTER',
      message: '首个章节标题前存在内容，已作为“前言”章节保留。',
      priority: 'info',
    })
  }

  const chapters: ParsedChapter[] = []
  if (paragraphsFrom(prefaceLines).length > 0) {
    chapters.push(
      buildParsedChapter(
        chapters.length,
        { chapterNumber: null, title: '前言', numeralNormalized: false },
        prefaceLines,
      ),
    )
  }

  headings.forEach((entry, headingIndex) => {
    const nextLineIndex = headings[headingIndex + 1]?.index ?? lines.length
    const chapter = buildParsedChapter(
      chapters.length,
      entry.heading,
      contentLines.slice(entry.index + 1, nextLineIndex),
    )
    chapters.push(chapter)
  })

  const seenTitles = new Set<string>()
  let duplicateTitleCount = 0
  for (const chapter of chapters) {
    if (seenTitles.has(chapter.title)) duplicateTitleCount += 1
    seenTitles.add(chapter.title)
  }
  if (duplicateTitleCount > 0) {
    warnings.push({
      code: 'DUPLICATE_CHAPTER_TITLE',
      message: `检测到 ${duplicateTitleCount} 个重复章节标题。`,
      priority: 'warning',
      count: duplicateTitleCount,
    })
  }

  const classified = classifySections(chapters)
  return {
    chapters: applyCharacterPositions(classified.chapters),
    warnings: [...warnings, ...classified.warnings],
    canonicalEndingDetected: classified.canonicalEndingDetected,
    conclusionOrder: classified.conclusionOrder,
  }
}
