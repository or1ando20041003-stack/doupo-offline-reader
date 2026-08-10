import { parseChapterNumber } from './chineseNumber'
import type { ReferenceChapter, ReferenceChapterIndex } from './types'

const CHAPTER_NUMERAL = '[零〇一二两三四五六七八九十百千万佰仟干\\d]+'
const NUMBERED_HEADING = new RegExp(`^\\s*第\\s*(${CHAPTER_NUMERAL})\\s*章\\s*[:：、.．\\-—]?\\s*(.*?)\\s*$`, 'u')
const HEADING_START = new RegExp(`第\\s*${CHAPTER_NUMERAL}\\s*章`, 'gu')
const ORDERED_ITEM = /^\s*(\d{1,5})\s*[.．、)）]\s*(\S.*?)\s*$/u
const SPECIAL_HEADING = /^\s*(序章|楔子|引子|终章|尾声|后记|番外(?:\s*[零〇一二两三四五六七八九十百千万\d]+)?)(?:\s*[:：、.．\-—]?\s*(.*?))?\s*$/u
const WEB_RESIDUE = /(?:加入书签|返回目录|手机阅读|最新网址|请收藏本站|章节目录)\s*$/giu

function normalizeSpaces(value: string): string {
  return value.replace(/\u3000/gu, ' ').replace(/[\t ]+/gu, ' ').trim()
}

export function getChapterTitleParts(title: string): { chapterNumber: number | null; content: string } {
  const numbered = NUMBERED_HEADING.exec(normalizeSpaces(title))
  if (numbered) {
    return {
      chapterNumber: parseChapterNumber(numbered[1] ?? ''),
      content: numbered[2] ?? '',
    }
  }
  const ordered = ORDERED_ITEM.exec(normalizeSpaces(title))
  if (ordered) {
    return { chapterNumber: Number(ordered[1]), content: ordered[2] ?? '' }
  }
  return { chapterNumber: null, content: normalizeSpaces(title) }
}

export function normalizeChapterTitleForMatch(title: string): string {
  const parts = getChapterTitleParts(title)
  const content = parts.content
    .replace(WEB_RESIDUE, '')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\p{P}\p{S}\s]/gu, '')
  return `${parts.chapterNumber === null ? '' : `第${parts.chapterNumber}章`}${content}`
}

export function normalizeChapterTitleContent(title: string): string {
  const parts = getChapterTitleParts(title)
  return parts.content
    .replace(WEB_RESIDUE, '')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\p{P}\p{S}\s]/gu, '')
}

function splitMultipleHeadings(line: string): string[] {
  const starts = [...line.matchAll(HEADING_START)].map((match) => match.index ?? 0)
  if (starts.length < 2) return [line]
  return starts.map((start, index) => line.slice(start, starts[index + 1] ?? line.length).trim())
}

function parseReferenceEntry(value: string, order: number, sourceLine: number): ReferenceChapter | null {
  const line = normalizeSpaces(value)
  const numbered = NUMBERED_HEADING.exec(line)
  if (numbered) {
    const numeral = numbered[1] ?? ''
    const suffix = normalizeSpaces(numbered[2] ?? '')
    const title = `第${numeral}章${suffix ? ` ${suffix}` : ''}`
    return {
      order,
      chapterNumber: parseChapterNumber(numeral),
      title,
      normalizedTitle: normalizeChapterTitleForMatch(title),
      sourceLine,
    }
  }

  const ordered = ORDERED_ITEM.exec(line)
  if (ordered) {
    const chapterNumber = Number(ordered[1])
    const title = `第${chapterNumber}章 ${normalizeSpaces(ordered[2] ?? '')}`
    return { order, chapterNumber, title, normalizedTitle: normalizeChapterTitleForMatch(title), sourceLine }
  }

  const special = SPECIAL_HEADING.exec(line)
  if (special) {
    const title = normalizeSpaces([special[1], special[2]].filter(Boolean).join(' '))
    return { order, chapterNumber: null, title, normalizedTitle: normalizeChapterTitleForMatch(title), sourceLine }
  }
  return null
}

export function parseReferenceChapters(text: string, sourceFileName: string): ReferenceChapterIndex {
  const chapters: ReferenceChapter[] = []
  let unrecognizedLineCount = 0
  text.split(/\r?\n/u).forEach((rawLine, lineIndex) => {
    const line = rawLine.trim()
    if (!line) return
    const segments = splitMultipleHeadings(line)
    let recognizedOnLine = false
    for (const segment of segments) {
      const chapter = parseReferenceEntry(segment, chapters.length, lineIndex + 1)
      if (chapter) {
        chapters.push(chapter)
        recognizedOnLine = true
      }
    }
    if (!recognizedOnLine) unrecognizedLineCount += 1
  })

  const numberCounts = new Map<number, number>()
  const titleCounts = new Map<string, number>()
  for (const chapter of chapters) {
    if (chapter.chapterNumber !== null) {
      numberCounts.set(chapter.chapterNumber, (numberCounts.get(chapter.chapterNumber) ?? 0) + 1)
    }
    titleCounts.set(chapter.normalizedTitle, (titleCounts.get(chapter.normalizedTitle) ?? 0) + 1)
  }
  const duplicateChapterNumberCount = [...numberCounts.values()].filter((count) => count > 1).length
  const duplicateTitleCount = [...titleCounts.values()].filter((count) => count > 1).length
  const warnings: string[] = []
  if (unrecognizedLineCount > 0) warnings.push(`${unrecognizedLineCount} 行未识别为章节目录，已忽略。`)
  if (duplicateChapterNumberCount > 0) warnings.push(`目录中有 ${duplicateChapterNumberCount} 组重复章号，将按出现顺序对齐。`)
  if (duplicateTitleCount > 0) warnings.push(`目录中有 ${duplicateTitleCount} 组可能重复标题，将按出现顺序对齐。`)

  return {
    chapters,
    sourceFileName,
    unrecognizedLineCount,
    duplicateChapterNumberCount,
    duplicateTitleCount,
    warnings,
  }
}
