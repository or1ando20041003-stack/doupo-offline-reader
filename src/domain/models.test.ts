import { describe, expect, it } from 'vitest'
import { DEFAULT_READER_SETTINGS, type ReadingProgress } from './models'

describe('reader state models', () => {
  it('defines a structural reading anchor instead of a pixel position', () => {
    const progress: ReadingProgress = {
      bookId: 'book-1',
      chapterId: 'chapter-3',
      paragraphIndex: 8,
      characterOffset: 12,
      chapterProgress: 0.25,
      globalProgress: 0.12,
      updatedAt: '2026-08-09T00:00:00.000Z',
    }
    expect(progress).toMatchObject({ chapterId: 'chapter-3', paragraphIndex: 8, characterOffset: 12 })
    expect(progress).not.toHaveProperty('scrollTop')
  })

  it('provides the requested local reader defaults', () => {
    expect(DEFAULT_READER_SETTINGS.fontSize).toBe(19)
    expect(DEFAULT_READER_SETTINGS.lineHeight).toBe(1.8)
    expect(DEFAULT_READER_SETTINGS.horizontalPadding).toBe(20)
    expect(DEFAULT_READER_SETTINGS.contentWidth).toBe(760)
    expect(DEFAULT_READER_SETTINGS.paragraphIndent).toBe('2em')
    expect(DEFAULT_READER_SETTINGS.readingMode).toBe('scroll')
    expect(DEFAULT_READER_SETTINGS.theme).toBe('paper')
  })
})
