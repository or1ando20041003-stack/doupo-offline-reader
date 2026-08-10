import { useMemo, useState } from 'react'
import type { BookshelfEntry } from '../services/bookshelf'
import { BookCard } from './BookCard'
import { DeleteBookDialog } from './DeleteBookDialog'
import { EmptyBookshelf } from './EmptyBookshelf'
import { ImportBookButton } from './ImportBookButton'

interface BookshelfScreenProps {
  entries: readonly BookshelfEntry[]
  importDisabled: boolean
  onImport: () => void
  onOpen: (bookId: string) => void
  onDelete: (bookId: string) => Promise<void>
}

export function BookshelfScreen({ entries, importDisabled, onImport, onOpen, onDelete }: BookshelfScreenProps) {
  const [deleteBookId, setDeleteBookId] = useState<string>()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string>()
  const deleteEntry = useMemo(
    () => entries.find((entry) => entry.book.id === deleteBookId),
    [deleteBookId, entries],
  )

  const confirmDelete = async () => {
    if (!deleteEntry) return
    setDeleting(true)
    setDeleteError(undefined)
    try {
      await onDelete(deleteEntry.book.id)
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
        {entries.length > 0 && <ImportBookButton compact disabled={importDisabled} onClick={onImport} />}
      </header>

      {entries.length === 0 ? (
        <EmptyBookshelf busy={importDisabled} onImport={onImport} />
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

      <p className="bookshelf-privacy">TXT 与阅读记录只保存在当前设备，不会上传。</p>

      <DeleteBookDialog
        entry={deleteEntry}
        deleting={deleting}
        error={deleteError}
        onCancel={() => { setDeleteError(undefined); setDeleteBookId(undefined) }}
        onConfirm={() => { void confirmDelete() }}
      />
    </main>
  )
}
