import { describe, expect, it } from 'vitest'
import { parseChapterNumber } from './chineseNumber'

describe('parseChapterNumber', () => {
  it.each([
    ['零', 0],
    ['〇', 0],
    ['十', 10],
    ['二十一', 21],
    ['两百零三', 203],
    ['六百八十七', 687],
    ['一千六百二十四', 1624],
    ['一万零二', 10002],
    ['二〇二四', 2024],
    ['2048', 2048],
  ])('converts %s to %i', (input, expected) => {
    expect(parseChapterNumber(input)).toBe(expected)
  })

  it('returns null for unsupported input', () => {
    expect(parseChapterNumber('甲')).toBeNull()
  })
})
