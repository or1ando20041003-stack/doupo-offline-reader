import { Children, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Book } from '../domain/models'
import type { BookshelfEntry, ReaderBookState } from '../services/bookshelf'
import { createReaderState } from './App'
import { BookCard, formatBookshelfProgress, formatLastReadAt } from './BookCard'
import { BookshelfScreen } from './BookshelfScreen'

function entry(id: string, title: string, started = true): BookshelfEntry {
  const timestamp = '2026-08-09T01:00:00.000Z'
  const book: Book = {
    id, title, sourceFileName: `${title}.txt`, sourceEncoding: 'utf-8',
    importedAt: '2026-08-01T00:00:00.000Z', updatedAt: timestamp,
    lastReadAt: started ? timestamp : undefined,
    totalChapters: 1, mainChapterCount: 1, extraChapterCount: 0,
    totalCharacterCount: 10, mainCharacterCount: 10, extraCharacterCount: 0,
    parserVersion: '2.0.0', cleanerVersion: '2.0.0',
  }
  return {
    book,
    progress: {
      bookId: id, chapterId: `${id}:main:0`, paragraphIndex: 0, characterOffset: 4,
      chapterProgress: 0.4, globalProgress: 0.423, updatedAt: timestamp,
    },
    currentChapterTitle: started ? '第六百八十七章' : '第一章',
  }
}

const callbacks = {
  onFile: () => undefined,
  onOpen: () => undefined,
  onDelete: async () => undefined,
}

describe('BookshelfScreen', () => {
  it('renders multiple books and their reading summaries', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-09T01:00:20.000Z'))
    const html = renderToStaticMarkup(
      <BookshelfScreen entries={[entry('a', '斗破苍穹'), entry('b', '凡人修仙传')]} importDisabled={false} {...callbacks} />,
    )
    expect(html).toContain('斗破苍穹')
    expect(html).toContain('凡人修仙传')
    expect(html).toContain('第六百八十七章')
    expect(html).toContain('42.3%')
    expect(html).toContain('刚刚阅读')
    vi.useRealTimers()
  })

  it('renders EmptyBookshelf instead of an error for an empty database', () => {
    const html = renderToStaticMarkup(
      <BookshelfScreen entries={[]} importDisabled={false} {...callbacks} />,
    )
    expect(html).toContain('你的书架还是空的')
    expect(html).toContain('导入 TXT 开始阅读')
    expect(html).not.toContain('error-text')
  })

  it('opens the exact book selected from a card', () => {
    const onOpen = vi.fn()
    const card = BookCard({ entry: entry('book-b', '乙书'), onOpen, onDelete: () => undefined })
    const openButton = Children.toArray(card.props.children)[0] as ReactElement<{ onClick: () => void }>
    openButton.props.onClick()
    expect(onOpen).toHaveBeenCalledWith('book-b')
  })

  it('creates an explicit reader route with bookId instead of a default book', () => {
    const selected = entry('book-b', '乙书')
    const reader = {
      book: selected.book,
      progress: selected.progress,
      settings: {
        id: 'reader-settings', fontFamily: 'serif', fontSize: 19, lineHeight: 1.8,
        contentWidth: 760, horizontalPadding: 20, paragraphIndent: '2em', theme: 'paper', readingMode: 'scroll',
      },
    } satisfies ReaderBookState
    expect(createReaderState(selected.book.id, reader)).toMatchObject({ kind: 'reader', bookId: 'book-b' })
  })

  it('formats unstarted books and relative reading time', () => {
    expect(formatBookshelfProgress(entry('new', '新书', false))).toBe('未开始阅读')
    expect(formatLastReadAt(undefined)).toBe('尚未阅读')
    expect(formatLastReadAt('2026-08-09T00:00:00.000Z', new Date('2026-08-09T02:00:00.000Z'))).toBe('2 小时前')
  })
})
