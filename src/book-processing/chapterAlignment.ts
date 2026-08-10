import { buildBodyLineIndex, type BodyLine, type BodyLineIndex } from './bodyLineIndex'
import { cleanText } from './cleanText'
import { classifySections } from './classifySections'
import type { ProcessingProfile } from './processingProfile'
import { extractReferenceMetadata, normalizeReferenceLabel } from './referenceChapters'
import type {
  ChapterAlignmentMatch,
  ChapterAlignmentResult,
  ChapterMatchReason,
  ChapterMatchType,
  ParsedChapter,
  ReferenceChapterIndex,
  ReferenceEntry,
} from './types'

interface ReferenceAnchor {
  entry: ReferenceEntry
  line: BodyLine
  matchType: Exclude<ChapterMatchType, 'unresolved'>
  score: number
  reasons: ChapterMatchReason[]
}

interface FinalAnchor {
  line: BodyLine
  title: string
  chapterNumber: number | null
  source: 'reference' | 'body-only'
  reference?: ReferenceAnchor
  bodyChapter?: ParsedChapter
}

function firstAfter(lines: readonly BodyLine[] | undefined, minimumOffset: number): BodyLine | undefined {
  return lines?.find(({ startCharacterOffset }) => startCharacterOffset > minimumOffset)
}

function resolveStrongAnchors(index: BodyLineIndex, entries: readonly ReferenceEntry[]): ReferenceAnchor[] {
  const anchors: ReferenceAnchor[] = []
  let previousOffset = -1
  for (const entry of entries) {
    const raw = firstAfter(index.byTrimmedLine.get(entry.rawLabel.trim()), previousOffset)
    if (raw) {
      anchors.push({
        entry,
        line: raw,
        matchType: 'raw-exact',
        score: 1,
        reasons: ['RAW_LINE_EXACT', 'ORDER_CONSISTENT'],
      })
      previousOffset = raw.startCharacterOffset
      continue
    }
    const normalized = firstAfter(index.byNormalizedLine.get(entry.normalizedLabel), previousOffset)
    if (normalized) {
      anchors.push({
        entry,
        line: normalized,
        matchType: 'normalized-exact',
        score: 0.96,
        reasons: ['NORMALIZED_LINE_EXACT', 'ORDER_CONSISTENT'],
      })
      previousOffset = normalized.startCharacterOffset
    }
  }
  return anchors
}

function boundsFor(referenceOrder: number, anchors: readonly ReferenceAnchor[]): { after: number; before: number } {
  let after = -1
  let before = Number.POSITIVE_INFINITY
  for (const anchor of anchors) {
    if (anchor.entry.order < referenceOrder) after = Math.max(after, anchor.line.startCharacterOffset)
    if (anchor.entry.order > referenceOrder) before = Math.min(before, anchor.line.startCharacterOffset)
  }
  return { after, before }
}

function similarity(left: string, right: string): number {
  if (left === right) return 1
  if (left.length < 2 || right.length < 2) return 0
  const pairs = new Map<string, number>()
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2)
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1)
  }
  let overlap = 0
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2)
    const count = pairs.get(pair) ?? 0
    if (count > 0) {
      overlap += 1
      pairs.set(pair, count - 1)
    }
  }
  return (2 * overlap) / (left.length + right.length - 2)
}

function resolvePrefixAndFuzzyAnchors(
  index: BodyLineIndex,
  entries: readonly ReferenceEntry[],
  strongAnchors: readonly ReferenceAnchor[],
): ReferenceAnchor[] {
  const anchors = [...strongAnchors]
  const resolvedOrders = new Set(anchors.map(({ entry }) => entry.order))
  const usedOffsets = new Set(anchors.map(({ line }) => line.startCharacterOffset))
  const unresolved = entries.filter(({ order }) => !resolvedOrders.has(order))

  for (const entry of unresolved) {
    const { after, before } = boundsFor(entry.order, anchors)
    const candidates = index.nonEmptyLines.filter((line) => (
      line.startCharacterOffset > after
      && line.startCharacterOffset < before
      && !usedOffsets.has(line.startCharacterOffset)
      && line.normalizedLine.length >= 4
    ))
    let best: ReferenceAnchor | undefined
    for (const line of candidates) {
      const bodyPrefix = entry.normalizedLabel.startsWith(line.normalizedLine)
        && line.normalizedLine.length / Math.max(1, entry.normalizedLabel.length) >= 0.3
      const referencePrefix = line.normalizedLine.startsWith(entry.normalizedLabel)
        && entry.normalizedLabel.length >= 4
      if (bodyPrefix) {
        const score = 0.9 + 0.05 * (line.normalizedLine.length / entry.normalizedLabel.length)
        if (!best || score > best.score) {
          best = {
            entry,
            line,
            matchType: 'body-prefix',
            score,
            reasons: ['BODY_PREFIX_OF_REFERENCE', 'ORDER_CONSISTENT'],
          }
        }
      } else if (referencePrefix) {
        const score = 0.86 + 0.05 * (entry.normalizedLabel.length / line.normalizedLine.length)
        if (!best || score > best.score) {
          best = {
            entry,
            line,
            matchType: 'reference-prefix',
            score,
            reasons: ['REFERENCE_PREFIX_OF_BODY', 'ATTACHED_TEXT', 'ORDER_CONSISTENT'],
          }
        }
      }
    }

    if (!best && unresolved.length <= 100 && entry.chapterNumber !== null) {
      for (const line of candidates.filter(({ trimmedLine }) => trimmedLine.length <= 120)) {
        const metadata = extractReferenceMetadata(line.trimmedLine)
        if (metadata.chapterNumber !== entry.chapterNumber) continue
        const score = similarity(line.normalizedLine, entry.normalizedLabel)
        if (score >= 0.88 && (!best || score > best.score)) {
          best = {
            entry,
            line,
            matchType: 'fuzzy',
            score,
            reasons: ['NUMBER_EXACT', 'TITLE_SIMILAR', 'ORDER_CONSISTENT'],
          }
        }
      }
    }

    if (best) {
      anchors.push(best)
      usedOffsets.add(best.line.startCharacterOffset)
    }
  }
  return anchors.sort((left, right) => left.entry.order - right.entry.order)
}

function locateBodyOnlyAnchors(
  index: BodyLineIndex,
  bodyChapters: readonly ParsedChapter[],
  referenceAnchors: readonly ReferenceAnchor[],
): FinalAnchor[] {
  const referenceOffsets = new Set(referenceAnchors.map(({ line }) => line.startCharacterOffset))
  const anchors: FinalAnchor[] = []
  let previousOffset = -1
  for (const chapter of bodyChapters) {
    if (chapter.title === '全文' || chapter.title === '前言') continue
    const raw = firstAfter(index.byTrimmedLine.get(chapter.title.trim()), previousOffset)
    const line = raw ?? firstAfter(index.byNormalizedLine.get(normalizeReferenceLabel(chapter.title)), previousOffset)
    if (!line) continue
    previousOffset = line.startCharacterOffset
    if (referenceOffsets.has(line.startCharacterOffset)) continue
    anchors.push({
      line,
      title: chapter.title,
      chapterNumber: chapter.chapterNumber,
      source: 'body-only',
      bodyChapter: chapter,
    })
  }
  return anchors
}

function extractAttachedBody(line: string, normalizedPrefix: string): string {
  let normalized = ''
  for (let index = 0; index < line.length; index += 1) {
    normalized = normalizeReferenceLabel(line.slice(0, index + 1))
    if (normalized === normalizedPrefix) {
      return line.slice(index + 1).replace(/^[：:，,。！!？?\s]+/u, '').trim()
    }
    if (!normalizedPrefix.startsWith(normalized)) break
  }
  return ''
}

function paragraphsFromSegment(segment: string, profile: ProcessingProfile): string[] {
  const cleaned = cleanText(segment, { profile }).text
  return cleaned.split('\n').map((line) => line.trim()).filter(Boolean)
}

function recalculate(chapters: readonly ParsedChapter[], profile: ProcessingProfile): ParsedChapter[] {
  const classified = classifySections(chapters, profile)
  let cumulativeCharacterStart = 0
  const sectionStarts = { main: 0, extra: 0 }
  return classified.chapters.map((chapter, order) => {
    const characterCount = chapter.paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0)
    const positioned = {
      ...chapter,
      order,
      characterCount,
      cumulativeCharacterStart,
      sectionCharacterStart: sectionStarts[chapter.section],
    }
    cumulativeCharacterStart += characterCount
    sectionStarts[chapter.section] += characterCount
    return positioned
  })
}

function buildFinalChapters(
  index: BodyLineIndex,
  referenceAnchors: readonly ReferenceAnchor[],
  bodyChapters: readonly ParsedChapter[],
  profile: ProcessingProfile,
): { chapters: ParsedChapter[]; bodyOnlyEntries: number } {
  const referenceFinal: FinalAnchor[] = referenceAnchors.map((anchor) => ({
    line: anchor.line,
    title: anchor.matchType === 'body-prefix' ? anchor.line.trimmedLine : anchor.entry.rawLabel,
    chapterNumber: anchor.entry.chapterNumber,
    source: 'reference',
    reference: anchor,
  }))
  const bodyOnly = locateBodyOnlyAnchors(index, bodyChapters, referenceAnchors)
  const anchors = [...referenceFinal, ...bodyOnly]
    .sort((left, right) => left.line.startCharacterOffset - right.line.startCharacterOffset)
  if (anchors.length === 0) return { chapters: [...bodyChapters], bodyOnlyEntries: bodyChapters.length }

  const chapters: ParsedChapter[] = []
  const prefaceText = index.text.slice(0, anchors[0]?.line.startCharacterOffset ?? 0)
  const prefaceParagraphs = paragraphsFromSegment(prefaceText, profile)
  if (prefaceParagraphs.length > 0) {
    chapters.push({
      order: 0,
      chapterNumber: null,
      title: '前言',
      section: 'main',
      paragraphs: prefaceParagraphs,
      characterCount: 0,
      cumulativeCharacterStart: 0,
      sectionCharacterStart: 0,
    })
  }

  anchors.forEach((anchor, indexInAnchors) => {
    const nextOffset = anchors[indexInAnchors + 1]?.line.startCharacterOffset ?? index.text.length
    const bodyStart = Math.min(index.text.length, anchor.line.endCharacterOffset + 1)
    let segment = index.text.slice(bodyStart, nextOffset)
    if (anchor.reference?.matchType === 'reference-prefix') {
      const attached = extractAttachedBody(anchor.line.trimmedLine, anchor.reference.entry.normalizedLabel)
      if (attached) segment = `${attached}\n${segment}`
    }
    const matchType = anchor.reference?.matchType
    chapters.push({
      order: chapters.length,
      chapterNumber: anchor.chapterNumber,
      title: anchor.title,
      section: 'main',
      paragraphs: paragraphsFromSegment(segment, profile),
      characterCount: 0,
      cumulativeCharacterStart: 0,
      sectionCharacterStart: 0,
      rawTitle: anchor.line.trimmedLine,
      referenceTitle: anchor.reference?.entry.rawLabel,
      referenceMatchType: matchType,
    })
  })
  return { chapters: recalculate(chapters, profile), bodyOnlyEntries: bodyOnly.length + (prefaceParagraphs.length > 0 ? 1 : 0) }
}

export function alignChaptersWithReference(
  bodyText: string,
  bodyChapters: readonly ParsedChapter[],
  referenceIndex: ReferenceChapterIndex,
  options: { profile?: ProcessingProfile; referenceEncoding?: 'utf-8' | 'gb18030' } = {},
): ChapterAlignmentResult {
  const startedAt = performance.now()
  const profile = options.profile ?? 'generic'
  const bodyIndex = buildBodyLineIndex(bodyText)
  const strong = resolveStrongAnchors(bodyIndex, referenceIndex.entries)
  const anchors = resolvePrefixAndFuzzyAnchors(bodyIndex, referenceIndex.entries, strong)
  const resolvedOrders = new Set(anchors.map(({ entry }) => entry.order))
  const built = buildFinalChapters(bodyIndex, anchors, bodyChapters, profile)
  const matches: ChapterAlignmentMatch[] = anchors.map(({ entry, line, matchType, score, reasons }) => ({
    referenceOrder: entry.order,
    bodyLineNumber: line.lineNumber,
    bodyStartOffset: line.startCharacterOffset,
    matchType,
    score,
    reasons,
  }))
  for (const entry of referenceIndex.entries) {
    if (!resolvedOrders.has(entry.order)) {
      matches.push({ referenceOrder: entry.order, matchType: 'unresolved', score: 0, reasons: ['NO_BODY_MATCH'] })
    }
  }
  const count = (type: ChapterMatchType) => anchors.filter(({ matchType }) => matchType === type).length
  return {
    chapters: built.chapters,
    matches: matches.sort((left, right) => left.referenceOrder - right.referenceOrder),
    diagnostics: {
      referenceSourceFileName: referenceIndex.sourceFileName,
      referenceEncoding: options.referenceEncoding,
      referenceEntries: referenceIndex.entries.length,
      bodyCandidateCount: bodyChapters.length,
      originalChapterCount: bodyChapters.length,
      rawExactMatches: count('raw-exact'),
      normalizedExactMatches: count('normalized-exact'),
      bodyPrefixMatches: count('body-prefix'),
      referencePrefixMatches: count('reference-prefix'),
      fuzzyMatches: count('fuzzy'),
      unresolvedReferences: referenceIndex.entries.length - anchors.length,
      bodyOnlyEntries: built.bodyOnlyEntries,
      finalEntries: built.chapters.length,
      chapterNumberResets: referenceIndex.chapterNumberResets,
      alignmentMs: performance.now() - startedAt,
    },
  }
}
