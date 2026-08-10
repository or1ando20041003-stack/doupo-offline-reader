import { useCallback, useEffect, useState } from 'react'
import type { ImportStage } from '../book-processing/types'
import { readerRepository } from '../db/repositories'
import type { BookshelfEntry, ReaderBookState } from '../services/bookshelf'
import { loadBookshelf, loadReaderBook } from '../services/bookshelf'
import type { BookImportFiles, DuplicateAction, PreparedBookImport } from '../services/importBook'
import { confirmBookImport, getImportErrorMessage, prepareBookImportFiles } from '../services/importBook'
import { BookshelfScreen } from './BookshelfScreen'
import { ImportConfirmation } from './ImportConfirmation'
import { ImportProgress } from './ImportProgress'
import { ImportSetupDialog } from './ImportSetupDialog'
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
  const [importTask, setImportTask] = useState<{ fileName: string; stage: ImportStage; error?: string }>()
  const [preparedImport, setPreparedImport] = useState<PreparedBookImport>()
  const [confirmError, setConfirmError] = useState<string>()
  const [savingImport, setSavingImport] = useState(false)
  const [showImportSetup, setShowImportSetup] = useState(false)

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

  const handleFiles = useCallback(async (files: BookImportFiles) => {
    const file = files.bodyFile
    setShowImportSetup(false)
    setPreparedImport(undefined)
    setConfirmError(undefined)
    const updateStage = (stage: ImportStage) => setImportTask({ fileName: file.name, stage })
    try {
      const prepared = await prepareBookImportFiles(files, updateStage)
      setPreparedImport(prepared)
    } catch (error) {
      console.error('Import failed:', error)
      setImportTask({ fileName: file.name, stage: 'error', error: getImportErrorMessage(error) })
    }
  }, [])

  const finishImport = useCallback(async (title: string, duplicateAction?: DuplicateAction) => {
    if (!preparedImport) return
    setSavingImport(true)
    setConfirmError(undefined)
    try {
      await confirmBookImport(
        preparedImport,
        { title, duplicateAction },
        (stage) => setImportTask({ fileName: preparedImport.fileName, stage }),
      )
      setPreparedImport(undefined)
      setImportTask(undefined)
      await showBookshelf()
    } catch (error) {
      console.error('Saving imported book failed:', error)
      setConfirmError(error instanceof Error && error.message.startsWith('请输入')
        ? error.message
        : '无法保存到本地书架，请检查设备存储空间后重试。')
    } finally {
      setSavingImport(false)
    }
  }, [preparedImport, showBookshelf])

  const cancelImport = useCallback(() => {
    setPreparedImport(undefined)
    setImportTask(undefined)
    setConfirmError(undefined)
    setSavingImport(false)
    setShowImportSetup(false)
  }, [])

  const openBook = useCallback(async (bookId: string) => {
    try {
      cancelImport()
      const reader = await loadReaderBook(bookId)
      document.documentElement.dataset.readerTheme = reader.settings.theme
      setState(createReaderState(bookId, reader))
    } catch (error) {
      console.error('Opening book failed:', error)
      setState({ kind: 'error', message: error instanceof Error ? error.message : '无法打开这本小说。' })
    }
  }, [cancelImport])

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
    return <>
      <BookshelfScreen
        entries={state.entries}
        importDisabled={Boolean(importTask || preparedImport || showImportSetup)}
        onImport={() => setShowImportSetup(true)}
        onOpen={(bookId) => { void openBook(bookId) }}
        onDelete={deleteBook}
      />
      {showImportSetup && (
        <ImportSetupDialog
          onCancel={() => setShowImportSetup(false)}
          onStart={(files) => { void handleFiles(files) }}
        />
      )}
      {importTask && (!preparedImport || savingImport) && (
        <ImportProgress
          fileName={importTask.fileName}
          stage={importTask.stage}
          error={importTask.error}
          onDismiss={cancelImport}
        />
      )}
      {preparedImport && !savingImport && (
        <ImportConfirmation
          prepared={preparedImport}
          saving={savingImport}
          error={confirmError}
          onCancel={cancelImport}
          onConfirm={(title, duplicateAction) => { void finishImport(title, duplicateAction) }}
        />
      )}
    </>
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
