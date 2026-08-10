import { describe, expect, it } from 'vitest'
import { normalizeReferenceLabel, parseReferenceChapters } from './referenceChapters'

describe('parseReferenceChapters loose ordered entries', () => {
  it('removes only a high-confidence first directory header and keeps every later non-empty line', () => {
    const result = parseReferenceChapters([
      '\uFEFF《覆汉》目录',
      '',
      '楔子',
      '第一章 卢龙塞',
      '完本总结',
      '附录1:人物表',
      '无法分类但有效的边界文字',
    ].join('\r\n'), '覆汉-目录.txt')
    expect(result.headerLine).toBe('《覆汉》目录')
    expect(result.entries.map(({ rawLabel }) => rawLabel)).toEqual([
      '楔子', '第一章 卢龙塞', '完本总结', '附录1:人物表', '无法分类但有效的边界文字',
    ])
    expect(result.entries.at(-1)?.kind).toBe('unknown')
  })

  it('extracts optional group and chapter metadata without deciding entry validity', () => {
    const result = parseReferenceChapters([
      '洪武大帝 前言',
      '洪武大帝 引子',
      '洪武大帝第一章 童年',
      '洪武大帝第二章 灾难',
      '万国来朝第一章 新篇',
      '大结局 后记',
    ].join('\n'), '明朝-目录.txt')
    expect(result.entries).toHaveLength(6)
    expect(result.entries[2]).toMatchObject({ groupTitle: '洪武大帝', chapterNumber: 1, chapterTitle: '童年' })
    expect(result.entries[4]).toMatchObject({ groupTitle: '万国来朝', chapterNumber: 1 })
    expect(result.entries[0]?.kind).toBe('preface')
    expect(result.entries[1]?.kind).toBe('prologue')
    expect(result.entries[5]?.kind).toBe('epilogue')
  })

  it('records chapter number resets as information and retains repeated numbers', () => {
    const result = parseReferenceChapters(
      '第一章 A\n第二章 B\n第三章 C\n第一章 D\n第二章 E\n第三章 F',
      '目录.txt',
    )
    expect(result.entries).toHaveLength(6)
    expect(result.entries.map(({ chapterNumber }) => chapterNumber)).toEqual([1, 2, 3, 1, 2, 3])
    expect(result.chapterNumberResets).toBe(1)
    expect(result.warnings.join('')).not.toContain('重置')
  })

  it('keeps nonstandard 章 typo as a valid exact-match entry', () => {
    const result = parseReferenceChapters('第二十三张 故垒萧萧夏如秋', '目录.txt')
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]).toMatchObject({ rawLabel: '第二十三张 故垒萧萧夏如秋', chapterNumber: 23 })
  })

  it('keeps one physical non-empty directory line as one ordered entry', () => {
    const result = parseReferenceChapters('第一章 A 第二章 B', '目录.txt')
    expect(result.entries.map(({ rawLabel }) => rawLabel)).toEqual(['第一章 A 第二章 B'])
  })

  it('normalizes common width, whitespace and punctuation differences only for comparison', () => {
    expect(normalizeReferenceLabel('第一百章　大战开始！')).toBe(normalizeReferenceLabel('第一百章 大战开始'))
  })

  it('returns an empty non-fatal index for an empty directory file', () => {
    expect(parseReferenceChapters('\n\t\n', '空目录.txt').entries).toEqual([])
  })
})
