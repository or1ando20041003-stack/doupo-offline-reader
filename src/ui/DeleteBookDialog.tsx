import type { Book } from '../domain/models'

interface DeleteBookDialogProps {
  book?: Book
  deleting: boolean
  error?: string
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteBookDialog({ book, deleting, error, onCancel, onConfirm }: DeleteBookDialogProps) {
  if (!book) return null
  return (
    <div className="bookshelf-dialog-backdrop" onMouseDown={(event) => {
      if (!deleting && event.target === event.currentTarget) onCancel()
    }}>
      <section className="delete-book-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-book-title" aria-describedby="delete-book-description">
        <p className="eyebrow">删除小说</p>
        <h2 id="delete-book-title">确定删除《{book.title}》？</h2>
        <p id="delete-book-description">将删除章节数据和阅读进度。<br />不会删除手机中的 TXT 文件。</p>
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button button-secondary" disabled={deleting} onClick={onCancel}>取消</button>
          <button type="button" className="button danger-button" disabled={deleting} onClick={onConfirm}>{deleting ? '正在删除…' : '确认删除'}</button>
        </div>
      </section>
    </div>
  )
}
