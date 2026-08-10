import type {
  ChapterAlignmentMatch,
  ChapterAlignmentResult,
  ChapterMatchReason,
  ChapterMatchType,
  ParsedChapter,
  ReferenceChapter,
  ReferenceChapterIndex,
} from './types'
import { getChapterTitleParts, normalizeChapterTitleContent, normalizeChapterTitleForMatch } from './referenceChapters'

interface BodyCandidate {
  order: number
  kind: 'boundary' | 'attached'
  chapterIndex: number
  paragraphIndex?: number
  chapterNumber: number | null
  rawTitle: string
  normalizedTitle: string
  normalizedContent: string
}

interface CandidateMatch {
  candidate: BodyCandidate
  reference: ReferenceChapter
  matchType: Exclude<ChapterMatchType, 'unresolved'>
  score: number
  reasons: ChapterMatchReason[]
}

const ATTACHED_HEADING = /^\s*(第\s*[零〇一二两三四五六七八九十百千万佰仟干\d]+\s*章)\s*[:：、.．\-—]?\s*(.+)$/u
const SPECIAL_HEADING = /^\s*(序章|楔子|引子|终章|尾声|后记|番外(?:\s*[零〇一二两三四五六七八九十百千万\d]+)?)(?:\s*[:：、.．\-—]?\s*.*)?$/u

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

function buildCandidates(chapters: readonly ParsedChapter[]): BodyCandidate[] {
  const candidates: BodyCandidate[] = []
  chapters.forEach((chapter, chapterIndex) => {
    candidates.push({
      order: candidates.length,
      kind: 'boundary',
      chapterIndex,
      chapterNumber: chapter.chapterNumber,
      rawTitle: chapter.title,
      normalizedTitle: normalizeChapterTitleForMatch(chapter.title),
      normalizedContent: normalizeChapterTitleContent(chapter.title),
    })
    chapter.paragraphs.forEach((paragraph, paragraphIndex) => {
      const heading = ATTACHED_HEADING.exec(paragraph)
      const specialHeading = SPECIAL_HEADING.test(paragraph)
      if (!heading && !specialHeading) return
      const rawTitle = heading ? `${heading[1]} ${heading[2]}` : paragraph
      const parts = getChapterTitleParts(rawTitle)
      if (heading && parts.chapterNumber === null) return
      candidates.push({
        order: candidates.length,
        kind: 'attached',
        chapterIndex,
        paragraphIndex,
        chapterNumber: parts.chapterNumber,
        rawTitle,
        normalizedTitle: normalizeChapterTitleForMatch(rawTitle),
        normalizedContent: normalizeChapterTitleContent(rawTitle),
      })
    })
  })
  return candidates
}

function classifyMatch(candidate: BodyCandidate, reference: ReferenceChapter): Omit<CandidateMatch, 'candidate' | 'reference'> | null {
  const sameNumber = candidate.chapterNumber !== null
    && reference.chapterNumber !== null
    && candidate.chapterNumber === reference.chapterNumber
  const bothSpecial = candidate.chapterNumber === null && reference.chapterNumber === null
  if (!sameNumber && !bothSpecial) return null

  const referenceContent = normalizeChapterTitleContent(reference.title)
  const reasons: ChapterMatchReason[] = ['ORDER_CONSISTENT']
  if (sameNumber) reasons.push('NUMBER_EXACT')
  const rawEqual = candidate.rawTitle.replace(/\u3000/gu, ' ').replace(/\s+/gu, ' ').trim()
    === reference.title.replace(/\u3000/gu, ' ').replace(/\s+/gu, ' ').trim()
  if (rawEqual) {
    reasons.push('TITLE_EXACT')
    return { matchType: 'exact', score: 1, reasons }
  }
  if (candidate.normalizedTitle === reference.normalizedTitle) {
    reasons.push('TITLE_NORMALIZED')
    return { matchType: 'high', score: 0.94, reasons }
  }

  const prefix = referenceContent.length >= 2 && candidate.normalizedContent.startsWith(referenceContent)
  const titleSimilarity = similarity(candidate.normalizedContent, referenceContent)
  if (sameNumber && (prefix || titleSimilarity >= 0.82)) {
    reasons.push(prefix ? 'TITLE_PREFIX' : 'TITLE_SIMILAR')
    if (candidate.kind === 'attached' || prefix) reasons.push('ATTACHED_TEXT')
    return { matchType: 'fuzzy', score: prefix ? 0.86 : 0.82, reasons }
  }
  return null
}

function selectMatches(candidates: readonly BodyCandidate[], references: readonly ReferenceChapter[]): CandidateMatch[] {
  const byNumber = new Map<number, ReferenceChapter[]>()
  const special: ReferenceChapter[] = []
  for (const reference of references) {
    if (reference.chapterNumber === null) special.push(reference)
    else byNumber.set(reference.chapterNumber, [...(byNumber.get(reference.chapterNumber) ?? []), reference])
  }

  const selected: CandidateMatch[] = []
  const usedReferences = new Set<number>()
  let lastReferenceOrder = -1
  for (const candidate of candidates) {
    const options = candidate.chapterNumber === null ? special : (byNumber.get(candidate.chapterNumber) ?? [])
    const viable = options
      .filter((reference) => reference.order > lastReferenceOrder && !usedReferences.has(reference.order))
      .map((reference) => {
        const classification = classifyMatch(candidate, reference)
        return classification ? { candidate, reference, ...classification } : null
      })
      .filter((match): match is CandidateMatch => match !== null)
      .sort((left, right) => right.score - left.score || left.reference.order - right.reference.order)
    const best = viable[0]
    if (!best) continue
    selected.push(best)
    usedReferences.add(best.reference.order)
    lastReferenceOrder = best.reference.order
  }
  return selected
}

function splitHeadingFromBody(rawTitle: string, reference: ReferenceChapter): string {
  const heading = ATTACHED_HEADING.exec(rawTitle)
  if (!heading) return ''
  const remainder = heading[2] ?? ''
  const target = normalizeChapterTitleContent(reference.title)
  if (!target || !normalizeChapterTitleContent(rawTitle).startsWith(target)) return ''
  let normalized = ''
  for (let index = 0; index < remainder.length; index += 1) {
    normalized = normalizeChapterTitleContent(`第1章 ${remainder.slice(0, index + 1)}`)
    if (normalized === target) return remainder.slice(index + 1).replace(/^[：:，,。！!？?\s]+/u, '').trim()
    if (!target.startsWith(normalized)) break
  }
  return ''
}

function recalculate(chapters: readonly ParsedChapter[]): ParsedChapter[] {
  let cumulativeCharacterStart = 0
  const sectionStarts = { main: 0, extra: 0 }
  return chapters.map((chapter, order) => {
    const characterCount = chapter.paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0)
    const result = {
      ...chapter,
      order,
      characterCount,
      cumulativeCharacterStart,
      sectionCharacterStart: sectionStarts[chapter.section],
    }
    cumulativeCharacterStart += characterCount
    sectionStarts[chapter.section] += characterCount
    return result
  })
}

function applyMatches(chapters: readonly ParsedChapter[], matches: readonly CandidateMatch[]): ParsedChapter[] {
  const boundaryMatches = new Map<number, CandidateMatch>()
  const attachedMatches = new Map<number, CandidateMatch[]>()
  for (const match of matches) {
    if (match.candidate.kind === 'boundary') boundaryMatches.set(match.candidate.chapterIndex, match)
    else attachedMatches.set(match.candidate.chapterIndex, [...(attachedMatches.get(match.candidate.chapterIndex) ?? []), match])
  }

  const output: ParsedChapter[] = []
  chapters.forEach((original, chapterIndex) => {
    const boundary = boundaryMatches.get(chapterIndex)
    const recoveredBoundaryBody = boundary?.matchType === 'fuzzy'
      ? splitHeadingFromBody(original.title, boundary.reference)
      : ''
    const base: ParsedChapter = boundary ? {
      ...original,
      chapterNumber: boundary.reference.chapterNumber,
      rawTitle: original.title,
      referenceTitle: boundary.reference.title,
      referenceMatchType: boundary.matchType,
      title: boundary.reference.title,
      paragraphs: [recoveredBoundaryBody, ...original.paragraphs].filter(Boolean),
    } : { ...original, paragraphs: [...original.paragraphs] }

    const splits = (attachedMatches.get(chapterIndex) ?? [])
      .sort((left, right) => (left.candidate.paragraphIndex ?? 0) - (right.candidate.paragraphIndex ?? 0))
    if (splits.length === 0) {
      output.push(base)
      return
    }

    let start = 0
    let currentTemplate = { ...base, paragraphs: [] }
    let currentPrefix = recoveredBoundaryBody ? [recoveredBoundaryBody] : []
    for (const split of splits) {
      const paragraphIndex = split.candidate.paragraphIndex ?? 0
      const before = original.paragraphs.slice(start, paragraphIndex)
      const completed = { ...currentTemplate, paragraphs: [...currentPrefix, ...before] }
      if (completed.paragraphs.length > 0) output.push(completed)
      const attachedBody = splitHeadingFromBody(original.paragraphs[paragraphIndex] ?? '', split.reference)
      currentTemplate = {
        ...original,
        chapterNumber: split.reference.chapterNumber,
        title: split.reference.title,
        rawTitle: original.paragraphs[paragraphIndex],
        referenceTitle: split.reference.title,
        referenceMatchType: split.matchType,
        paragraphs: [],
      }
      currentPrefix = attachedBody ? [attachedBody] : []
      start = paragraphIndex + 1
    }
    const final = { ...currentTemplate, paragraphs: [...currentPrefix, ...original.paragraphs.slice(start)] }
    if (final.paragraphs.length > 0) output.push(final)
  })
  return recalculate(output)
}

export function alignChaptersWithReference(
  bodyChapters: readonly ParsedChapter[],
  referenceIndex: ReferenceChapterIndex,
  referenceEncoding?: 'utf-8' | 'gb18030',
): ChapterAlignmentResult {
  const startedAt = performance.now()
  const candidates = buildCandidates(bodyChapters)
  const selected = selectMatches(candidates, referenceIndex.chapters)
  const selectedReferenceOrders = new Set(selected.map(({ reference }) => reference.order))
  const chapters = applyMatches(bodyChapters, selected)
  const matches: ChapterAlignmentMatch[] = selected.map(({ candidate, reference, matchType, score, reasons }) => ({
    referenceOrder: reference.order,
    bodyCandidateOrder: candidate.order,
    matchType,
    score,
    reasons,
  }))
  for (const reference of referenceIndex.chapters) {
    if (!selectedReferenceOrders.has(reference.order)) {
      matches.push({ referenceOrder: reference.order, matchType: 'unresolved', score: 0, reasons: ['NO_BODY_MATCH'] })
    }
  }
  const exactMatches = selected.filter(({ matchType }) => matchType === 'exact').length
  const highMatches = selected.filter(({ matchType }) => matchType === 'high').length
  const fuzzyMatches = selected.filter(({ matchType }) => matchType === 'fuzzy').length
  return {
    chapters,
    matches: matches.sort((left, right) => left.referenceOrder - right.referenceOrder),
    diagnostics: {
      referenceSourceFileName: referenceIndex.sourceFileName,
      referenceEncoding,
      referenceChapterCount: referenceIndex.chapters.length,
      referenceUnrecognizedLines: referenceIndex.unrecognizedLineCount,
      bodyCandidateCount: candidates.length,
      originalChapterCount: bodyChapters.length,
      exactMatches,
      highMatches,
      fuzzyMatches,
      unresolvedReferences: referenceIndex.chapters.length - selected.length,
      bodyOnlyChapters: chapters.filter(({ referenceMatchType }) => !referenceMatchType).length,
      finalChapterCount: chapters.length,
      alignmentTimeMs: performance.now() - startedAt,
    },
  }
}
