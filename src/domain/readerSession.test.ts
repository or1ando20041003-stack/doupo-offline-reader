import { describe, expect, it } from 'vitest'
import type { ChapterListItem } from '../db/repositories'
import {
  anchorForSavedProgress,
  chapterEndAnchor,
  chapterStartAnchor,
  getChapterNeighbors,
  preserveAnchorForLayoutChange,
  resolveInitialChapter,
} from './readerSession'

const chapters: ChapterListItem[] = [
  { id: 'm-1', bookId: 'book', order: 4, chapterNumber: 1, title: '第一章', section: 'main', characterCount: 10, cumulativeCharacterStart: 0, sectionCharacterStart: 0 },
  { id: 'm-9', bookId: 'book', order: 7, chapterNumber: 9, title: '第九章', section: 'main', characterCount: 10, cumulativeCharacterStart: 10, sectionCharacterStart: 10 },
  { id: 'e-1', bookId: 'book', order: 20, chapterNumber: 1, title: '附加第一章', section: 'extra', characterCount: 8, cumulativeCharacterStart: 20, sectionCharacterStart: 0 },
]

describe('reader session navigation', () => {
  it('starts at the saved chapter when progress is valid', () => {
    expect(resolveInitialChapter(chapters, { chapterId: 'm-9' })?.id).toBe('m-9')
  })

  it('starts at the first main chapter without progress', () => {
    expect(resolveInitialChapter(chapters)?.id).toBe('m-1')
  })

  it('falls back to the first main chapter for invalid progress', () => {
    expect(resolveInitialChapter(chapters, { chapterId: 'missing' })?.id).toBe('m-1')
  })

  it('uses order-array neighbors instead of chapterNumber arithmetic', () => {
    const neighbors = getChapterNeighbors(chapters, 'm-9')
    expect(neighbors.previous?.id).toBe('m-1')
    expect(neighbors.next?.id).toBe('e-1')
  })

  it('moves from the final main chapter into the first extra chapter', () => {
    expect(getChapterNeighbors(chapters, 'm-9').next?.section).toBe('extra')
  })

  it('has no previous chapter at the beginning', () => {
    expect(getChapterNeighbors(chapters, 'm-1').previous).toBeUndefined()
  })

  it('has no next chapter after the final extra chapter', () => {
    expect(getChapterNeighbors(chapters, 'e-1').next).toBeUndefined()
  })

  it('creates chapter start and end anchors without page indexes', () => {
    expect(chapterStartAnchor()).toEqual({ paragraphIndex: 0, characterOffset: 0 })
    expect(chapterEndAnchor(['甲', '乙丙'])).toEqual({ paragraphIndex: 1, characterOffset: 2 })
  })

  it('restores a saved text anchor only for the matching chapter', () => {
    const progress = { chapterId: 'm-9', paragraphIndex: 3, characterOffset: 7 }
    expect(anchorForSavedProgress('m-9', progress)).toEqual({ paragraphIndex: 3, characterOffset: 7 })
    expect(anchorForSavedProgress('m-1', progress)).toEqual(chapterStartAnchor())
  })

  it('preserves the authoritative text anchor across layout mode changes', () => {
    const pagedUiState = { paragraphIndex: 5, characterOffset: 12, pageIndex: 99 }
    expect(preserveAnchorForLayoutChange(pagedUiState)).toEqual({ paragraphIndex: 5, characterOffset: 12 })
  })
})
