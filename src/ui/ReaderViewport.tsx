import { useRef, type RefObject } from 'react'
import type { Chapter, ReadingMode } from '../domain/models'
import { ReaderChapter } from './ReaderChapter'

interface ReaderViewportProps {
  chapter?: Chapter
  mode: ReadingMode
  loading: boolean
  error?: string
  viewportRef: RefObject<HTMLDivElement | null>
  contentRef: RefObject<HTMLElement | null>
  onToggleControls: () => void
  onPreviousPage: () => void
  onNextPage: () => void
  onPositionChange: () => void
}

export function ReaderViewport({
  chapter,
  mode,
  loading,
  error,
  viewportRef,
  contentRef,
  onToggleControls,
  onPreviousPage,
  onNextPage,
  onPositionChange,
}: ReaderViewportProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  return (
    <div
      ref={viewportRef}
      className={`reader-viewport reader-${mode}`}
      role="region"
      aria-label="小说正文"
      tabIndex={0}
      onScroll={onPositionChange}
      onClick={(event) => {
        if (!chapter || loading || error) return
        if ((event.target as HTMLElement).closest('button, input, select, a')) return
        if (window.getSelection()?.toString()) return
        const rect = event.currentTarget.getBoundingClientRect()
        const ratio = (event.clientX - rect.left) / rect.width
        if (mode === 'paged') {
          if (ratio < 0.25) onPreviousPage()
          else if (ratio > 0.75) onNextPage()
          else onToggleControls()
        } else if (ratio >= 0.25 && ratio <= 0.75) {
          onToggleControls()
        }
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0]
        if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY }
      }}
      onTouchEnd={(event) => {
        if (mode !== 'paged' || !touchStart.current) return
        const touch = event.changedTouches[0]
        if (!touch) return
        const dx = touch.clientX - touchStart.current.x
        const dy = touch.clientY - touchStart.current.y
        touchStart.current = null
        if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.3) return
        if (dx < 0) onNextPage()
        else onPreviousPage()
      }}
    >
      {loading && <div className="reader-loading" role="status">正在打开章节……</div>}
      {error && <div className="reader-inline-error" role="alert">{error}</div>}
      {chapter && !error && <ReaderChapter chapter={chapter} contentRef={contentRef} />}
    </div>
  )
}
