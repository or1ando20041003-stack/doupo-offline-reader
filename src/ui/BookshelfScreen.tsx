import { useMemo, useState } from 'react'
import type { ImportStage } from '../book-processing/types'
import type { BookshelfEntry } from '../services/bookshelf'
import { BookCard } from './BookCard'
import { DeleteBookDialog } from './DeleteBookDialog'
import { EmptyBookshelf } from './EmptyBookshelf'
import { ImportBookButton } from './ImportBookButton'
import { ImportStatus } from './ImportStatus'

interface BookshelfScreenProps {
  entries: readonly BookshelfEntry[]
  stage: ImportStage | null
  error: string | null
  onFile: (file: File) => void
  onOpen: (bookId: string) => void
  onDelete: (bookId: string) => Promise<void>
}

export function BookshelfScreen({ entries, stage, error, onFile, onOpen, onDelete }: BookshelfScreenProps) {
  const [deleteBookId, setDeleteBookId] = useState<string>()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string>()
  const busy = stage !== null && !['complete', 'error'].includes(stage)
  const deleteBook = useMemo(
    () => entries.find((entry) => entry.book.id === deleteBookId)?.book,
    [deleteBookId, entries],
  )

  const confirmDelete = async () => {
    if (!deleteBook) return
    setDeleting(true)
    setDeleteError(undefined)
    try {
      await onDelete(deleteBook.id)
      setDeleteBookId(undefined)
    } catch (error) {
      console.error('Deleting book failed:', error)
      setDeleteError(error instanceof Error ? error.message : '删除失败，请重试。')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="app-shell bookshelf-shell">
      <header className="bookshelf-header">
        <div>
          <p className="eyebrow">私人 · 本地 · 离线</p>
          <h1>我的书架</h1>
          <p>{entries.length > 0 ? `${entries.length} 本小说保存在这台设备` : '安静地收好每一本故事'}</p>
        </div>
        {entries.length > 0 && <ImportBookButton compact disabled={busy} onFile={onFile} />}
      </header>

      {entries.length === 0 ? (
        <EmptyBookshelf busy={busy} onFile={onFile} />
      ) : (
        <section className="bookshelf-grid" aria-label="小说书架">
          {entries.map((entry) => (
            <BookCard key={entry.book.id} entry={entry} onOpen={onOpen} onDelete={(bookId) => {
              setDeleteError(undefined)
              setDeleteBookId(bookId)
            }} />
          ))}
        </section>
      )}

      <div className="bookshelf-feedback">
        <ImportStatus stage={stage} />
        {error && <p className="error-text" role="alert">{error}</p>}
      </div>
      <p className="bookshelf-privacy">TXT 与阅读记录只保存在当前设备，不会上传。</p>

      <DeleteBookDialog
        book={deleteBook}
        deleting={deleting}
        error={deleteError}
        onCancel={() => { setDeleteError(undefined); setDeleteBookId(undefined) }}
        onConfirm={() => { void confirmDelete() }}
      />
    </main>
  )
}
