import { describe, expect, it } from 'vitest'
import { alignChaptersWithReference } from './chapterAlignment'
import { parseChapters } from './parseChapters'
import { parseReferenceChapters } from './referenceChapters'

function align(body: string, reference: string) {
  const parsed = parseChapters(body)
  return alignChaptersWithReference(body, parsed.chapters, parseReferenceChapters(reference, '人工目录.txt'))
}

describe('Reference-First ChapterAlignmentEngine', () => {
  it('uses raw independent body lines as the primary exact boundary source', () => {
    const result = align('第一章 A\n正文A\n第二章 B\n正文B', '第一章 A\n第二章 B')
    expect(result.diagnostics).toMatchObject({ rawExactMatches: 2, unresolvedReferences: 0, finalEntries: 2 })
  })

  it('recognizes a 明朝那些事儿-style directory without standard leading 第X章 labels', () => {
    const labels = [
      '某卷 前言', '某卷 引子', '某卷第一章 A', '某卷第二章 B',
      '另一卷第一章 C', '另一卷第二章 D', '最终卷 后记',
    ]
    const body = labels.map((label) => `${label}\n${label}正文`).join('\n')
    const result = align(body, labels.join('\n'))
    expect(result.diagnostics).toMatchObject({ referenceEntries: 7, rawExactMatches: 7, finalEntries: 7 })
    expect(result.chapters.map(({ title }) => title)).toEqual(labels)
  })

  it('allows chapter numbers to reset and navigates all entries by order', () => {
    const labels = ['第一章 A', '第二章 B', '第三章 C', '第一章 D', '第二章 E', '第三章 F']
    const body = labels.map((label) => `${label}\n正文`).join('\n')
    const result = align(body, labels.join('\n'))
    expect(result.chapters).toHaveLength(6)
    expect(result.chapters.map(({ chapterNumber }) => chapterNumber)).toEqual([1, 2, 3, 1, 2, 3])
    expect(result.chapters.map(({ order }) => order)).toEqual([0, 1, 2, 3, 4, 5])
    expect(result.diagnostics.chapterNumberResets).toBe(1)
  })

  it('turns special exact lines into navigable entries', () => {
    const labels = ['楔子', '某卷 前言', '某卷 引子', '第一章 A', '完本总结', '附录1:测试附录', '后记']
    const body = labels.map((label) => `${label}\n正文`).join('\n')
    const result = align(body, labels.join('\n'))
    expect(result.diagnostics.rawExactMatches).toBe(7)
    expect(result.chapters.map(({ title }) => title)).toEqual(labels)
  })

  it('accepts a 张 typo when the full line is exact', () => {
    const result = align('第二十三张 某标题\n正文内容', '第二十三张 某标题')
    expect(result.diagnostics.rawExactMatches).toBe(1)
    expect(result.chapters[0]?.title).toBe('第二十三张 某标题')
  })

  it('recovers the longest body-line prefix from a polluted reference entry', () => {
    const result = align(
      '第三十八章 夜夜酣歌感知己\n正文内容\n作者的一段额外说明',
      '第三十八章 夜夜酣歌感知己必须要单章感谢作者的一段额外说明',
    )
    expect(result.diagnostics.bodyPrefixMatches).toBe(1)
    expect(result.chapters[0]?.title).toBe('第三十八章 夜夜酣歌感知己')
  })

  it('recovers a reference prefix when the body heading is stuck to its first sentence', () => {
    const result = align('第一百章 某标题萧炎望向远方。\n后续正文', '第一百章 某标题')
    expect(result.diagnostics.referencePrefixMatches).toBe(1)
    expect(result.chapters[0]).toMatchObject({ title: '第一百章 某标题', paragraphs: ['萧炎望向远方。', '后续正文'] })
  })

  it('matches duplicate complete titles to successive body occurrences', () => {
    const label = '第一章 相同标题'
    const result = align(`${label}\n正文一\n${label}\n正文二`, `${label}\n${label}`)
    const exact = result.matches.filter(({ matchType }) => matchType === 'raw-exact')
    expect(exact).toHaveLength(2)
    expect(exact[1]!.bodyStartOffset).toBeGreaterThan(exact[0]!.bodyStartOffset!)
    expect(result.chapters).toHaveLength(2)
  })

  it('leaves unresolved references merged without creating or averaging a boundary', () => {
    const result = align(
      '第一章 A\n正文A以及合并内容\n第三章 C\n正文C',
      '第一章 A\n第二章 B\n第三章 C',
    )
    expect(result.diagnostics.unresolvedReferences).toBe(1)
    expect(result.chapters.map(({ chapterNumber }) => chapterNumber)).toEqual([1, 3])
    expect(result.chapters[0]?.paragraphs).toContain('正文A以及合并内容')
  })

  it('preserves a reliable body-only heading missing from the reference', () => {
    const result = align(
      '第一章 A\n正文\n第二章 BODY ONLY\n正文\n第三章 C\n正文',
      '第一章 A\n第三章 C',
    )
    expect(result.chapters.map(({ title }) => title)).toContain('第二章 BODY ONLY')
    expect(result.diagnostics.bodyOnlyEntries).toBe(1)
  })

  it('indexes and aligns 1500 exact ordered entries efficiently', () => {
    const labels = Array.from({ length: 1_500 }, (_, index) => `第${index + 1}章 人工标题${index + 1}`)
    const body = labels.map((label) => `${label}\n人工正文`).join('\n')
    const result = align(body, labels.join('\n'))
    expect(result.diagnostics).toMatchObject({ referenceEntries: 1_500, rawExactMatches: 1_500, finalEntries: 1_500 })
    expect(result.diagnostics.alignmentMs).toBeLessThan(2_000)
  })
})
