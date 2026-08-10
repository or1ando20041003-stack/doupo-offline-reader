import { describe, expect, it } from 'vitest'
import { inspectBookText } from './analyzeBook'

describe('inspectBookText', () => {
  it('produces statistics without embedding a complete source copy', () => {
    const source = `《斗破苍穹》
第一章 人工开端
人工正文武动乾坤。
第一千六百二十四章 结束，也是开始。(大结局)
人工结局。
第一章 附加
附加正文。`
    const report = inspectBookText(source, {
      sourceFileName: '斗破苍穹.txt',
      fileSize: source.length,
      encoding: 'utf-8',
    })
    expect(report.raw.wudongqiankunOccurrences).toBe(1)
    expect(report.cleaning.wudongqiankunAfter).toBe(0)
    expect(report.chapters.canonicalEndingDetected).toBe(true)
    expect(report.chapters.extra).toBe(1)
    expect(JSON.stringify(report)).not.toContain('人工正文武动乾坤')
  })

  it('does not apply Doupo 1624 diagnostics to a generic novel', () => {
    const source = '第一章 A\n正文\n第一章 B\n正文'
    const report = inspectBookText(source, {
      sourceFileName: '覆汉.txt',
      fileSize: source.length,
      encoding: 'utf-8',
    })
    expect(report.raw.missingCandidateNumbers).toEqual([])
    expect(report.raw.candidateSequenceIssues).toEqual([])
    expect(report.chapters.missingMainNumbers).toEqual([])
    expect(report.chapters.parserWarnings.map(({ message }) => message).join('')).not.toContain('1624')
  })
})
