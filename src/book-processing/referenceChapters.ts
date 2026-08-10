import { parseChapterNumber } from './chineseNumber'
import type { ReferenceChapterIndex, ReferenceEntry, ReferenceEntryKind } from './types'

const NUMERAL = '[零〇一二两三四五六七八九十百千万佰仟干\\d]+'
const PREFIXED_CHAPTER = new RegExp(`^(.*?)第\\s*(${NUMERAL})\\s*[章张]\\s*[:：、.．\\-—]?\\s*(.*?)$`, 'u')
const ORDERED_ITEM = /^\s*(\d{1,5})\s*[.．、)）]\s*(\S.*?)\s*$/u
const DIRECTORY_HEADER = /^《[^》\n]{1,100}》\s*目录\s*$/u

export function normalizeReferenceLabel(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/^\uFEFF/u, '')
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(/[\p{P}\p{S}\s]/gu, '')
}

function classifyKind(label: string, hasChapterNumber: boolean): ReferenceEntryKind {
  if (/附录\s*[零〇一二两三四五六七八九十百千万\d]*/u.test(label)) return 'appendix'
  if (/完本总结|后记|尾声|终章/u.test(label)) return 'epilogue'
  if (/楔子|引子/u.test(label)) return 'prologue'
  if (/前言/u.test(label)) return 'preface'
  if (hasChapterNumber) return 'chapter'
  if (/序章|番外|大结局/u.test(label)) return 'special'
  return 'unknown'
}

export function extractReferenceMetadata(rawLabel: string): Omit<ReferenceEntry, 'order' | 'rawLabel' | 'normalizedLabel' | 'sourceLine'> {
  const chapter = PREFIXED_CHAPTER.exec(rawLabel)
  if (chapter) {
    const groupTitle = chapter[1]?.trim() || undefined
    const chapterNumber = parseChapterNumber(chapter[2] ?? '')
    const chapterTitle = chapter[3]?.trim() || undefined
    return { chapterNumber, chapterTitle, groupTitle, kind: classifyKind(rawLabel, true) }
  }
  const ordered = ORDERED_ITEM.exec(rawLabel)
  if (ordered) {
    return {
      chapterNumber: Number(ordered[1]),
      chapterTitle: ordered[2]?.trim() || undefined,
      kind: 'chapter',
    }
  }
  return { chapterNumber: null, kind: classifyKind(rawLabel, false) }
}

export function parseReferenceChapters(text: string, sourceFileName: string): ReferenceChapterIndex {
  const normalizedText = text.replace(/^\uFEFF/u, '').replace(/\r\n?|\u2028|\u2029/gu, '\n')
  const sourceLines = normalizedText.split('\n')
  const firstNonEmptyIndex = sourceLines.findIndex((line) => line.trim().length > 0)
  const headerLine = firstNonEmptyIndex >= 0 && DIRECTORY_HEADER.test(sourceLines[firstNonEmptyIndex]?.trim() ?? '')
    ? sourceLines[firstNonEmptyIndex]?.trim()
    : undefined
  const entries: ReferenceEntry[] = []

  sourceLines.forEach((source, lineIndex) => {
    const line = source.trim()
    if (!line || (lineIndex === firstNonEmptyIndex && headerLine)) return
    entries.push({
      order: entries.length,
      rawLabel: line,
      normalizedLabel: normalizeReferenceLabel(line),
      sourceLine: lineIndex + 1,
      ...extractReferenceMetadata(line),
    })
  })

  const numberCounts = new Map<number, number>()
  const labelCounts = new Map<string, number>()
  let chapterNumberResets = 0
  let previousNumber: number | null = null
  for (const entry of entries) {
    if (entry.chapterNumber !== null) {
      numberCounts.set(entry.chapterNumber, (numberCounts.get(entry.chapterNumber) ?? 0) + 1)
      if (previousNumber !== null && entry.chapterNumber < previousNumber) chapterNumberResets += 1
      previousNumber = entry.chapterNumber
    }
    labelCounts.set(entry.normalizedLabel, (labelCounts.get(entry.normalizedLabel) ?? 0) + 1)
  }
  const duplicateChapterNumberCount = [...numberCounts.values()].filter((count) => count > 1).length
  const duplicateLabelCount = [...labelCounts.values()].filter((count) => count > 1).length
  const warnings: string[] = []
  if (duplicateLabelCount > 0) warnings.push(`目录中有 ${duplicateLabelCount} 组重复完整标题，将按正文位置依次匹配。`)

  return {
    entries,
    sourceFileName,
    headerLine,
    duplicateChapterNumberCount,
    duplicateLabelCount,
    chapterNumberResets,
    warnings,
  }
}
