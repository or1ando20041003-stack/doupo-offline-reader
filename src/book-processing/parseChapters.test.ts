import { describe, expect, it } from 'vitest'
import { classifySections } from './classifySections'
import { matchChapterHeading, parseChapters } from './parseChapters'
import type { ParsedChapter } from './types'

const ARTIFICIAL_NOVEL = `第一章 风从山下来
这是人工编写的第一段。

这是第二段。
第二章 城里的灯
灯火在雨里亮起。
第一千六百二十四章 结束，也是开始。(大结局)
故事在这里收束。
第五章 附加故事重新编号
这是附加内容。`

function chapter(overrides: Partial<ParsedChapter> = {}): ParsedChapter {
  return {
    order: 0,
    chapterNumber: 1,
    title: '第一章 普通章节',
    section: 'main',
    paragraphs: ['内容'],
    characterCount: 2,
    cumulativeCharacterStart: 0,
    sectionCharacterStart: 0,
    ...overrides,
  }
}

describe('chapter parsing', () => {
  it('recognizes Chinese and Arabic chapter headings', () => {
    expect(matchChapterHeading('第一章 开始')).toEqual({
      chapterNumber: 1,
      title: '第一章 开始',
      numeralNormalized: false,
    })
    expect(matchChapterHeading('第六百八十七章 远方')).toEqual({
      chapterNumber: 687,
      title: '第六百八十七章 远方',
      numeralNormalized: false,
    })
    expect(matchChapterHeading('第2048章 未来')).toEqual({
      chapterNumber: 2048,
      title: '第2048章 未来',
      numeralNormalized: false,
    })
  })

  it('recognizes the confirmed 1624 ending and puts only following chapters in extra', () => {
    const result = parseChapters(ARTIFICIAL_NOVEL)
    expect(result.canonicalEndingDetected).toBe(true)
    expect(result.chapters).toHaveLength(4)
    expect(result.chapters.map((item) => item.section)).toEqual(['main', 'main', 'main', 'extra'])
    expect(result.chapters[2]?.chapterNumber).toBe(1624)
    expect(result.chapters[3]?.chapterNumber).toBe(5)
  })

  it('keeps natural lines as paragraphs and records global/section character offsets', () => {
    const result = parseChapters(ARTIFICIAL_NOVEL)
    expect(result.chapters[0]?.paragraphs).toEqual(['这是人工编写的第一段。', '这是第二段。'])
    expect(result.chapters[0]?.cumulativeCharacterStart).toBe(0)
    expect(result.chapters[1]?.cumulativeCharacterStart).toBe(result.chapters[0]?.characterCount)
    expect(result.chapters[3]?.sectionCharacterStart).toBe(0)
  })

  it('normalizes high-confidence OCR chapter numeral glyphs', () => {
    expect(matchChapterHeading('第六佰五十三章 血战')).toMatchObject({
      chapterNumber: 653,
      numeralNormalized: true,
    })
    expect(matchChapterHeading('第一干六百零一章 大战')).toMatchObject({
      chapterNumber: 1601,
      numeralNormalized: true,
    })
  })

  it('rejects body-like overlong heading candidates', () => {
    expect(matchChapterHeading(`第五章 ${'人工正文'.repeat(30)}`)).toBeNull()
  })

  it('returns an explicit warning for empty text', () => {
    const result = parseChapters('   \n\n')
    expect(result.chapters).toEqual([])
    expect(result.warnings[0]?.code).toBe('EMPTY_TEXT')
  })

  it('keeps text without headings as one chapter and warns', () => {
    const result = parseChapters('一段没有标题的文字。\n另一段。')
    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0]?.title).toBe('全文')
    expect(result.warnings.map((warning) => warning.code)).toContain('NO_CHAPTER_HEADINGS')
  })

  it('ignores repeated main numbers and reports them instead of creating duplicate chapters', () => {
    const result = parseChapters('第一章 相遇\n甲。\n第一章 重复标题\n乙。\n第二章 继续\n丙。')
    expect(result.chapters.map((item) => item.chapterNumber)).toEqual([1, 2])
    expect(result.warnings.map((warning) => warning.code)).toContain('NON_MONOTONIC_HEADING_IGNORED')
  })

  it('reports source gaps without inventing missing chapter numbers', () => {
    const result = parseChapters('第一章 开始\n甲。\n第三章 跳号\n乙。')
    expect(result.chapters.map((item) => item.chapterNumber)).toEqual([1, 3])
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'MAIN_CHAPTER_GAP', count: 1 }))
  })

  it('does not classify extras silently when the canonical ending is absent', () => {
    const classified = classifySections([chapter({ section: 'extra' })])
    expect(classified.chapters[0]?.section).toBe('main')
    expect(classified.warnings[0]?.code).toBe('CANONICAL_ENDING_NOT_CONFIRMED')
    expect(classified.warnings[0]?.priority).toBe('high')
  })

  it('requires both chapter 1624 and the confirmed ending title', () => {
    const chapters = [
      chapter({ chapterNumber: 1624, title: '第一千六百二十四章 普通标题' }),
      chapter({ order: 1, chapterNumber: 1, title: '第一章 附加内容' }),
    ]
    expect(classifySections(chapters).canonicalEndingDetected).toBe(false)
  })
})
