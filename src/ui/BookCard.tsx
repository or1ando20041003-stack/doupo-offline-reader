import type { BookshelfEntry } from '../services/bookshelf'

interface BookCardProps {
  entry: BookshelfEntry
  now?: Date
  onOpen: (bookId: string) => void
  onDelete: (bookId: string) => void
}

export function formatBookshelfProgress(entry: BookshelfEntry): string {
  if (!entry.book.lastReadAt || !entry.progress) return '未开始阅读'
  const progress = Math.min(1, Math.max(0, entry.progress.globalProgress))
  return `${(progress * 100).toFixed(1)}%`
}

export function formatLastReadAt(lastReadAt: string | undefined, now = new Date()): string {
  if (!lastReadAt) return '尚未阅读'
  const timestamp = new Date(lastReadAt).getTime()
  const elapsedMs = Math.max(0, now.getTime() - timestamp)
  const minutes = Math.floor(elapsedMs / 60_000)
  if (minutes < 1) return '刚刚阅读'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(timestamp)
}

export function BookCard({ entry, now = new Date(), onOpen, onDelete }: BookCardProps) {
  const { book } = entry
  const started = Boolean(book.lastReadAt && entry.progress)
  const chapterLabel = started
    ? entry.currentChapterTitle ?? '上次阅读位置'
    : '未开始阅读'
  const progressLabel = formatBookshelfProgress(entry)

  return (
    <article className="book-card">
      <button className="book-card-open" type="button" aria-label={`打开《${book.title}》`} onClick={() => onOpen(book.id)}>
        <span className="book-card-spine" aria-hidden="true">{book.title.trim().charAt(0) || '书'}</span>
        <span className="book-card-content">
          <strong title={book.title}>{book.title}</strong>
          {book.author && <small>{book.author}</small>}
          <span className="book-card-chapter">{chapterLabel}</span>
          <span className="book-card-meta">
            <span>{progressLabel}</span>
            <span>{formatLastReadAt(book.lastReadAt, now)}</span>
          </span>
          <span className="continue-label">继续阅读 <span aria-hidden="true">→</span></span>
        </span>
      </button>
      <details className="book-card-menu">
        <summary aria-label={`《${book.title}》更多操作`}>•••</summary>
        <div><button type="button" onClick={() => onDelete(book.id)}>删除小说</button></div>
      </details>
    </article>
  )
}
