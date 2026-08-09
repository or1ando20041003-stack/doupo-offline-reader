import { useEffect, useRef, useState } from 'react'
import type { ChapterListItem } from '../db/repositories'

interface ChapterDrawerProps {
  open: boolean
  bookTitle: string
  chapters: readonly ChapterListItem[]
  currentChapterId?: string
  onSelect: (chapter: ChapterListItem) => void
  onClose: () => void
}

export function ChapterDrawer({ open, bookTitle, chapters, currentChapterId, onSelect, onClose }: ChapterDrawerProps) {
  const currentRef = useRef<HTMLButtonElement>(null)
  const [extraOpen, setExtraOpen] = useState(false)
  const main = chapters.filter((chapter) => chapter.section === 'main')
  const extra = chapters.filter((chapter) => chapter.section === 'extra')

  useEffect(() => {
    if (!open) return
    if (chapters.find((chapter) => chapter.id === currentChapterId)?.section === 'extra') setExtraOpen(true)
    const frame = requestAnimationFrame(() => currentRef.current?.scrollIntoView({ block: 'center' }))
    return () => cancelAnimationFrame(frame)
  }, [open, currentChapterId, chapters])

  if (!open) return null

  const renderChapter = (chapter: ChapterListItem) => {
    const current = chapter.id === currentChapterId
    return (
      <li key={chapter.id}>
        <button
          ref={current ? currentRef : undefined}
          type="button"
          className={`chapter-list-item${current ? ' is-current' : ''}`}
          aria-current={current ? 'page' : undefined}
          onClick={() => onSelect(chapter)}
        >
          <span>{chapter.title}</span>
        </button>
      </li>
    )
  }

  return (
    <div className="reader-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside className="chapter-drawer" role="dialog" aria-modal="true" aria-label="章节目录">
        <header className="panel-header">
          <div><strong>{bookTitle}</strong><small>{chapters.length} 章</small></div>
          <button type="button" className="icon-button" aria-label="关闭章节目录" onClick={onClose}>×</button>
        </header>
        <div className="chapter-list-scroll">
          <section className="chapter-section" aria-labelledby="main-chapters-title">
            <h2 id="main-chapters-title">正文 <span>{main.length}</span></h2>
            <ol>{main.map(renderChapter)}</ol>
          </section>
          {extra.length > 0 && (
            <section className="chapter-section">
              <button type="button" className="chapter-section-toggle" aria-expanded={extraOpen} onClick={() => setExtraOpen((value) => !value)}>
                <span>附加内容 <small>{extra.length}</small></span><span aria-hidden="true">{extraOpen ? '−' : '+'}</span>
              </button>
              {extraOpen && <ol>{extra.map(renderChapter)}</ol>}
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}
