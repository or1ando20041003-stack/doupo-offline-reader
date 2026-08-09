import { describe, expect, it } from 'vitest'
import type { Chapter } from './models'
import { calculateProgress, characterOffsetInChapter } from './progressMetrics'

const chapters: Chapter[] = [
  {
    id: 'main-1', bookId: 'book', order: 0, chapterNumber: 1, title: '第一章', section: 'main',
    paragraphs: ['甲乙', '丙丁'], characterCount: 4, cumulativeCharacterStart: 0, sectionCharacterStart: 0,
  },
  {
    id: 'main-2', bookId: 'book', order: 1, chapterNumber: 2, title: '第二章', section: 'main',
    paragraphs: ['戊己'], characterCount: 2, cumulativeCharacterStart: 4, sectionCharacterStart: 4,
  },
  {
    id: 'extra-1', bookId: 'book', order: 2, chapterNumber: 1, title: '第一章 附加', section: 'extra',
    paragraphs: ['庚辛'], characterCount: 2, cumulativeCharacterStart: 6, sectionCharacterStart: 0,
  },
]

describe('text-based progress metrics', () => {
  it('calculates paragraph anchors without structural whitespace', () => {
    expect(characterOffsetInChapter(chapters[0]!, { paragraphIndex: 1, characterOffset: 1 })).toBe(3)
  })

  it('supports main, extra, and all scopes', () => {
    expect(calculateProgress(chapters[1]!, { paragraphIndex: 0, characterOffset: 1 }, chapters, 'main')).toMatchObject({
      characterPosition: 5,
      scopeCharacterCount: 6,
      scopeProgress: 5 / 6,
    })
    expect(calculateProgress(chapters[2]!, { paragraphIndex: 0, characterOffset: 1 }, chapters, 'extra')).toMatchObject({
      characterPosition: 1,
      scopeCharacterCount: 2,
      scopeProgress: 0.5,
    })
    expect(calculateProgress(chapters[2]!, { paragraphIndex: 0, characterOffset: 1 }, chapters, 'all').scopeProgress).toBe(7 / 8)
  })
})
