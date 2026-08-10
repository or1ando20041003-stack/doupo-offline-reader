import { describe, expect, it } from 'vitest'
import { normalizeChapterTitleForMatch, parseReferenceChapters } from './referenceChapters'

describe('parseReferenceChapters', () => {
  it('accepts Chinese, Arabic, list, spacing, punctuation and multiple headings per line', () => {
    const result = parseReferenceChapters([
      '第一章：开始',
      '第2章　继续',
      '3. 转折',
      '',
      '第四章 AAA    第五章 BBB    第六章 CCC',
      '网页导航文字',
    ].join('\n'), '测试-目录.txt')

    expect(result.chapters.map(({ chapterNumber }) => chapterNumber)).toEqual([1, 2, 3, 4, 5, 6])
    expect(result.chapters.map(({ title }) => title)).toContain('第3章 转折')
    expect(result.unrecognizedLineCount).toBe(1)
    expect(result.sourceFileName).toBe('测试-目录.txt')
  })

  it('keeps special chapters without inventing a chapter number', () => {
    const result = parseReferenceChapters('序章 初见\n番外 新故事\n后记', '目录.txt')
    expect(result.chapters).toHaveLength(3)
    expect(result.chapters.every(({ chapterNumber }) => chapterNumber === null)).toBe(true)
  })

  it('reports duplicate numbers and titles as non-fatal warnings', () => {
    const result = parseReferenceChapters('第一章 A\n第一章 B\n第二章 C\n第二章 C', '目录.txt')
    expect(result.duplicateChapterNumberCount).toBe(2)
    expect(result.duplicateTitleCount).toBe(1)
    expect(result.warnings).toHaveLength(2)
  })

  it('normalizes only for comparison', () => {
    expect(normalizeChapterTitleForMatch('第一百章　大战开始！')).toBe('第100章大战开始')
    expect(normalizeChapterTitleForMatch('第100章 大战开始')).toBe('第100章大战开始')
  })

  it('returns an empty non-fatal index for an empty directory file', () => {
    const result = parseReferenceChapters('\n\t\n', '空目录.txt')
    expect(result.chapters).toEqual([])
    expect(result.unrecognizedLineCount).toBe(0)
  })
})
