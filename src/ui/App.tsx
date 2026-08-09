import { useCallback, useEffect, useState } from 'react'
import type { ImportStage } from '../book-processing/types'
import { readerRepository } from '../db/repositories'
import type { BookshelfEntry, ReaderBookState } from '../services/bookshelf'
import { loadBookshelf, loadReaderBook } from '../services/bookshelf'
import { importBook } from '../services/importBook'
import { BookshelfScreen } from './BookshelfScreen'
import { ReaderScreen } from './ReaderScreen'

type AppState =
  | { kind: 'loading' }
  | { kind: 'bookshelf'; entries: BookshelfEntry[] }
  | { kind: 'reader'; bookId: string; reader: ReaderBookState }
  | { kind: 'error'; message: string }

export function createReaderState(bookId: string, reader: ReaderBookState): AppState {
  return { kind: 'reader', bookId, reader }
}

export function App() {
  const [state, setState] = useState<AppState>({ kind: 'loading' })
  const [stage, setStage] = useState<ImportStage | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const showBookshelf = useCallback(async () => {
    const entries = await loadBookshelf()
    setState({ kind: 'bookshelf', entries })
  }, [])

  useEffect(() => {
    let active = true
    void loadBookshelf()
      .then((entries) => { if (active) setState({ kind: 'bookshelf', entries }) })
      .catch((error) => {
        console.error('Database startup failed:', error)
        if (active) setState({ kind: 'error', message: '无法打开本地书架，请检查浏览器存储权限。' })
      })
    return () => { active = false }
  }, [])

  const handleFile = useCallback(async (file: File) => {
    setImportError(null)
    try {
      await importBook(file, setStage)
      await showBookshelf()
    } catch (error) {
      console.error('Import failed:', error)
      setStage('error')
      setImportError(error instanceof Error ? error.message : '导入失败，请重试。')
    }
  }, [showBookshelf])

  const openBook = useCallback(async (bookId: string) => {
    try {
      setStage(null)
      setImportError(null)
      const reader = await loadReaderBook(bookId)
      document.documentElement.dataset.readerTheme = reader.settings.theme
      setState(createReaderState(bookId, reader))
    } catch (error) {
      console.error('Opening book failed:', error)
      setState({ kind: 'error', message: error instanceof Error ? error.message : '无法打开这本小说。' })
    }
  }, [])

  const deleteBook = useCallback(async (bookId: string) => {
    await readerRepository.deleteBook(bookId)
    await showBookshelf()
  }, [showBookshelf])

  if (state.kind === 'loading') {
    return <main className="app-shell status-screen">正在打开本地书架……</main>
  }
  if (state.kind === 'error') {
    return <main className="app-shell status-screen error-text">{state.message}</main>
  }
  if (state.kind === 'bookshelf') {
    return (
      <BookshelfScreen
        entries={state.entries}
        stage={stage}
        error={importError}
        onFile={handleFile}
        onOpen={(bookId) => { void openBook(bookId) }}
        onDelete={deleteBook}
      />
    )
  }
  return (
    <ReaderScreen
      key={state.bookId}
      bookId={state.bookId}
      book={state.reader.book}
      initialProgress={state.reader.progress}
      initialSettings={state.reader.settings}
      onBack={() => { void showBookshelf() }}
    />
  )
}
