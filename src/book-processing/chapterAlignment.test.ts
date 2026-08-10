import { describe, expect, it } from 'vitest'
import { alignChaptersWithReference } from './chapterAlignment'
import { parseChapters } from './parseChapters'
import { parseReferenceChapters } from './referenceChapters'
import type { ParsedChapter } from './types'

function align(body: string, reference: string) {
  const parsed = parseChapters(body)
  const index = parseReferenceChapters(reference, '人工目录.txt')
  return alignChaptersWithReference(parsed.chapters, index, 'utf-8')
}

describe('ChapterAlignmentEngine', () => {
  it('matches a complete body and reference exactly', () => {
    const result = align(
      '第一章 A\n正文A\n第二章 B\n正文B\n第三章 C\n正文C',
      '第一章 A\n第二章 B\n第三章 C',
    )
    expect(result.diagnostics).toMatchObject({ exactMatches: 3, unresolvedReferences: 0, finalChapterCount: 3 })
  })

  it('treats punctuation and spacing differences as high confidence', () => {
    const result = align('第一章　大战开始！\n正文', '第一章 大战开始')
    expect(result.diagnostics.highMatches).toBe(1)
    expect(result.chapters[0]?.title).toBe('第一章 大战开始')
    expect(result.chapters[0]?.rawTitle).toBe('第一章 大战开始！')
  })

  it('matches Chinese and Arabic chapter numbers', () => {
    const result = align('第一百二十章 魔兽山脉\n正文', '第120章 魔兽山脉')
    expect(result.diagnostics.highMatches).toBe(1)
    expect(result.chapters[0]?.chapterNumber).toBe(120)
  })

  it('conservatively separates a heading stuck to body text and preserves that text', () => {
    const result = align(
      '第一章 A\n正文A\n第二章 远行萧炎望向远方，继续前行。',
      '第一章 A\n第二章 远行',
    )
    expect(result.diagnostics.fuzzyMatches).toBe(1)
    expect(result.chapters).toHaveLength(2)
    expect(result.chapters[1]).toMatchObject({ title: '第二章 远行', paragraphs: ['萧炎望向远方，继续前行。'] })
  })

  it('never creates or force-splits an unresolved reference chapter', () => {
    const result = align(
      '第一章 A\n正文A以及原本合并在这里的内容\n第三章 C\n正文C',
      '第一章 A\n第二章 B\n第三章 C',
    )
    expect(result.diagnostics.unresolvedReferences).toBe(1)
    expect(result.chapters.map(({ chapterNumber }) => chapterNumber)).toEqual([1, 3])
    expect(result.chapters.some(({ title, paragraphs }) => title.includes('第二章') || paragraphs.length === 0)).toBe(false)
    expect(result.chapters[0]?.paragraphs).toContain('正文A以及原本合并在这里的内容')
  })

  it('imports successfully when 102 has no evidence and chapter numbers are not continuous', () => {
    const result = align(
      '第100章 A\n正文\n第101章 B\n正文\n第103章 D\n正文',
      '第100章 A\n第101章 B\n第102章 C\n第103章 D',
    )
    expect(result.diagnostics).toMatchObject({ unresolvedReferences: 1, finalChapterCount: 3 })
  })

  it('retains a reliable body-only chapter missing from the reference', () => {
    const result = align(
      '第一章 A\n正文\n第二章 BODY ONLY\n正文\n第三章 C\n正文',
      '第一章 A\n第三章 C',
    )
    expect(result.chapters.map(({ title }) => title)).toContain('第二章 BODY ONLY')
    expect(result.diagnostics.bodyOnlyChapters).toBe(1)
  })

  it('matches a special chapter without chapterNumber by title and order', () => {
    const body: ParsedChapter[] = [{
      order: 0,
      chapterNumber: null,
      title: '番外 新故事',
      section: 'extra',
      paragraphs: ['番外正文'],
      characterCount: 4,
      cumulativeCharacterStart: 0,
      sectionCharacterStart: 0,
    }]
    const reference = parseReferenceChapters('番外 新故事', '目录.txt')
    const result = alignChaptersWithReference(body, reference)
    expect(result.diagnostics.exactMatches).toBe(1)
    expect(result.chapters[0]?.chapterNumber).toBeNull()
  })

  it('keeps baseline parser output if every reference entry is unresolved', () => {
    const body = '第一章 A\n正文A\n第二章 B\n正文B'
    const parsed = parseChapters(body)
    const result = alignChaptersWithReference(
      parsed.chapters,
      parseReferenceChapters('第900章 X\n第901章 Y', '错误目录.txt'),
    )
    expect(result.diagnostics.unresolvedReferences).toBe(2)
    expect(result.chapters).toEqual(parsed.chapters)
  })

  it('uses a partial reference without removing unmatched body chapters', () => {
    const result = align(
      '第一章 A\n正文\n第二章 B\n正文\n第三章 C\n正文',
      '第二章 B',
    )
    expect(result.chapters).toHaveLength(3)
    expect(result.diagnostics).toMatchObject({ exactMatches: 1, bodyOnlyChapters: 2 })
  })

  it('aligns a 1500-chapter index with a single ordered scan', () => {
    const headings = Array.from({ length: 1_500 }, (_, index) => `第${index + 1}章 人工标题${index + 1}`)
    const body = headings.map((heading) => `${heading}\n人工正文`).join('\n')
    const parsed = parseChapters(body)
    const reference = parseReferenceChapters(headings.join('\n'), '大型人工目录.txt')
    const result = alignChaptersWithReference(parsed.chapters, reference)
    expect(result.diagnostics).toMatchObject({
      referenceChapterCount: 1_500,
      exactMatches: 1_500,
      unresolvedReferences: 0,
      finalChapterCount: 1_500,
    })
    expect(result.diagnostics.alignmentTimeMs).toBeLessThan(2_000)
  })
})
