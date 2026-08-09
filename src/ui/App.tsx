import { useCallback, useEffect, useState } from 'react'
import type { Book, ReaderSettings, ReadingProgress } from '../domain/models'
import type { ImportStage } from '../book-processing/types'
import { readerRepository } from '../db/repositories'
import { importBookFile } from '../services/importBook'
import { ImportScreen } from './ImportScreen'
import { ReaderScreen } from './ReaderScreen'

type AppState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'ready'; book: Book; progress?: ReadingProgress; settings: ReaderSettings }
  | { kind: 'error'; message: string }

export function App() {
  const [state, setState] = useState<AppState>({ kind: 'loading' })
  const [stage, setStage] = useState<ImportStage | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const book = await readerRepository.getBook()
        if (!active) return
        if (!book) {
          setState({ kind: 'empty' })
          return
        }
        const [progress, settings] = await Promise.all([
          readerRepository.getProgress(book.id),
          readerRepository.getSettings(),
        ])
        document.documentElement.dataset.readerTheme = settings.theme
        if (active) setState({ kind: 'ready', book, progress, settings })
      } catch (error) {
        console.error('Database startup failed:', error)
        if (active) setState({ kind: 'error', message: '无法打开本地数据库，请检查浏览器存储权限。' })
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const handleFile = useCallback(async (file: File) => {
    setImportError(null)
    try {
      const result = await importBookFile(file, setStage)
      const settings = await readerRepository.getSettings()
      setState({ kind: 'ready', book: result.book, settings })
    } catch (error) {
      console.error('Import failed:', error)
      setStage('error')
      setImportError(error instanceof Error ? error.message : '导入失败，请重试。')
    }
  }, [])

  if (state.kind === 'loading') {
    return <main className="app-shell status-screen">正在打开本地书库……</main>
  }
  if (state.kind === 'error') {
    return <main className="app-shell status-screen error-text">{state.message}</main>
  }
  if (state.kind === 'empty') {
    return <ImportScreen stage={stage} error={importError} onFile={handleFile} />
  }
  return (
    <ReaderScreen
      key={state.book.importedAt}
      book={state.book}
      initialProgress={state.progress}
      initialSettings={state.settings}
      stage={stage}
      importError={importError}
      onFile={handleFile}
    />
  )
}
