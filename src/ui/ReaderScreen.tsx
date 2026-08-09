import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { ImportStage } from '../book-processing/types'
import { readerRepository, type ChapterListItem } from '../db/repositories'
import type { Book, Chapter, ReaderSettings, ReadingProgress } from '../domain/models'
import type { TextAnchor } from '../domain/progressMetrics'
import { anchorForSavedProgress, chapterEndAnchor, chapterStartAnchor, getChapterNeighbors, preserveAnchorForLayoutChange, resolveInitialChapter } from '../domain/readerSession'
import { getAnchorAtViewportPoint, getPagedLayout, restorePagedAnchor, restoreScrollAnchor } from '../services/readingAnchor'
import { createReadingProgress, ProgressSaveScheduler } from '../services/readingProgress'
import { ChapterDrawer } from './ChapterDrawer'
import { ImportStatus } from './ImportStatus'
import { ReaderControls } from './ReaderControls'
import { ReaderViewport } from './ReaderViewport'
import { ReadingStatus } from './ReadingStatus'
import { SettingsPanel } from './SettingsPanel'

interface ReaderScreenProps {
  book: Book
  initialProgress?: ReadingProgress
  initialSettings: ReaderSettings
  stage: ImportStage | null
  importError: string | null
  onFile: (file: File) => void
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function ReaderScreen({ book, initialProgress, initialSettings, stage, importError, onFile }: ReaderScreenProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [chapters, setChapters] = useState<ChapterListItem[]>([])
  const [chapter, setChapter] = useState<Chapter>()
  const [progress, setProgress] = useState<ReadingProgress | undefined>(initialProgress)
  const [loading, setLoading] = useState(true)
  const [readerError, setReaderError] = useState<string>()
  const [controlsOpen, setControlsOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [layoutEpoch, setLayoutEpoch] = useState(0)
  const [extraNotice, setExtraNotice] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chapterRef = useRef<Chapter | undefined>(undefined)
  const settingsRef = useRef<ReaderSettings>(initialSettings)
  const pendingAnchorRef = useRef<TextAnchor | undefined>(undefined)
  const lastAnchorRef = useRef<TextAnchor>(chapterStartAnchor())
  const requestSequenceRef = useRef(0)
  const positionTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const settingsTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const schedulerRef = useRef<ProgressSaveScheduler | null>(null)

  if (!schedulerRef.current) {
    schedulerRef.current = new ProgressSaveScheduler((nextProgress) => readerRepository.saveProgress(nextProgress), 1000)
  }

  useEffect(() => { chapterRef.current = chapter }, [chapter])
  useEffect(() => { settingsRef.current = settings }, [settings])

  const captureAnchor = useCallback((): TextAnchor => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return lastAnchorRef.current
    const anchor = getAnchorAtViewportPoint(viewport, content) ?? lastAnchorRef.current
    lastAnchorRef.current = anchor
    return anchor
  }, [])

  const persistAnchor = useCallback(async (anchor: TextAnchor, immediate: boolean) => {
    const currentChapter = chapterRef.current
    if (!currentChapter) return
    const nextProgress = createReadingProgress(book, currentChapter, anchor)
    setProgress(nextProgress)
    if (immediate) {
      schedulerRef.current?.cancel()
      await readerRepository.saveProgress(nextProgress)
    } else {
      schedulerRef.current?.schedule(nextProgress)
    }
  }, [book])

  const openChapter = useCallback(async (
    item: ChapterListItem,
    target: TextAnchor | 'end' = chapterStartAnchor(),
    persist = true,
  ) => {
    const sequence = ++requestSequenceRef.current
    setLoading(true)
    setReaderError(undefined)
    try {
      const loaded = await readerRepository.getChapter(book.id, item.id)
      if (sequence !== requestSequenceRef.current) return
      if (!loaded) throw new Error('找不到所选章节。')
      const anchor = target === 'end' ? chapterEndAnchor(loaded.paragraphs) : target
      lastAnchorRef.current = anchor
      pendingAnchorRef.current = anchor
      chapterRef.current = loaded
      setChapter(loaded)
      const nextProgress = createReadingProgress(book, loaded, anchor)
      setProgress(nextProgress)
      if (persist) await readerRepository.saveProgress(nextProgress)
      setLoading(false)
    } catch (error) {
      if (sequence !== requestSequenceRef.current) return
      console.error('Chapter loading failed:', error)
      setLoading(false)
      setReaderError(error instanceof Error ? error.message : '章节加载失败。')
    }
  }, [book])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const index = await readerRepository.getChapterIndex(book.id)
        if (!active) return
        setChapters(index)
        const initial = resolveInitialChapter(index, initialProgress)
        if (!initial) throw new Error('本地书库中没有可阅读章节。')
        const anchor = anchorForSavedProgress(initial.id, initialProgress)
        const invalidProgress = Boolean(initialProgress && initialProgress.chapterId !== initial.id)
        await openChapter(initial, anchor, invalidProgress)
      } catch (error) {
        console.error('Reader startup failed:', error)
        if (active) {
          setLoading(false)
          setReaderError(error instanceof Error ? error.message : '阅读器启动失败。')
        }
      }
    })()
    return () => { active = false }
  }, [book.id, initialProgress, openChapter])

  useLayoutEffect(() => {
    if (!chapter) return
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const viewport = viewportRef.current
        const content = contentRef.current
        if (!viewport || !content) return
        const anchor = pendingAnchorRef.current ?? lastAnchorRef.current
        if (settings.readingMode === 'paged') {
          const layout = getPagedLayout(viewport, content)
          setPageCount(layout.pageCount)
          const restored = restorePagedAnchor(viewport, content, anchor)
          setPageIndex(Math.min(restored?.pageIndex ?? 0, layout.pageCount - 1))
        } else {
          restoreScrollAnchor(viewport, content, anchor)
          setPageIndex(0)
          setPageCount(1)
        }
        pendingAnchorRef.current = undefined
      })
    })
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame) }
  }, [chapter, settings.readingMode, settings.fontFamily, settings.fontSize, settings.lineHeight, settings.contentWidth, settings.horizontalPadding, settings.paragraphIndent, layoutEpoch])

  const neighbors = useMemo(() => chapter ? getChapterNeighbors(chapters, chapter.id) : {}, [chapters, chapter])

  const navigateChapter = useCallback(async (target: ChapterListItem | undefined, edge: 'start' | 'end' = 'start') => {
    if (!target || loading) return
    await persistAnchor(captureAnchor(), true)
    const enteredExtra = chapterRef.current?.section === 'main' && target.section === 'extra'
    await openChapter(target, edge === 'end' ? 'end' : chapterStartAnchor(), true)
    setDrawerOpen(false)
    if (enteredExtra) {
      setExtraNotice(true)
      setTimeout(() => setExtraNotice(false), 2400)
    }
  }, [captureAnchor, loading, openChapter, persistAnchor])

  const queuePositionSave = useCallback(() => {
    if (positionTimerRef.current) clearTimeout(positionTimerRef.current)
    positionTimerRef.current = setTimeout(() => {
      if (settings.readingMode === 'paged' && viewportRef.current && contentRef.current) {
        const layout = getPagedLayout(viewportRef.current, contentRef.current)
        setPageIndex(Math.min(layout.pageIndex, layout.pageCount - 1))
        setPageCount(layout.pageCount)
      }
      void persistAnchor(captureAnchor(), false)
    }, 250)
  }, [captureAnchor, persistAnchor, settings.readingMode])

  const turnPage = useCallback((direction: -1 | 1) => {
    const viewport = viewportRef.current
    if (!viewport || !chapter || loading) return
    if (direction > 0 && pageIndex >= pageCount - 1) {
      void navigateChapter(neighbors.next)
      return
    }
    if (direction < 0 && pageIndex <= 0) {
      void navigateChapter(neighbors.previous, 'end')
      return
    }
    const nextPage = Math.min(pageCount - 1, Math.max(0, pageIndex + direction))
    viewport.scrollTo({ left: nextPage * viewport.clientWidth, behavior: 'smooth' })
    setPageIndex(nextPage)
    queuePositionSave()
  }, [chapter, loading, navigateChapter, neighbors.next, neighbors.previous, pageCount, pageIndex, queuePositionSave])

  const updateSettings = useCallback((patch: Partial<ReaderSettings>) => {
    const anchor = preserveAnchorForLayoutChange(captureAnchor())
    pendingAnchorRef.current = anchor
    lastAnchorRef.current = anchor
    if (patch.readingMode && patch.readingMode !== settings.readingMode) void persistAnchor(anchor, true)
    setSettings((current) => ({ ...current, ...patch }))
  }, [captureAnchor, persistAnchor, settings.readingMode])

  useEffect(() => {
    document.documentElement.dataset.readerTheme = settings.theme
    window.localStorage.setItem('doupo-reader-theme', settings.theme)
    if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current)
    settingsTimerRef.current = setTimeout(() => { void readerRepository.saveSettings(settings) }, 300)
  }, [settings])

  useEffect(() => {
    if (!controlsOpen) return
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => setControlsOpen(false), 4500)
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current) }
  }, [controlsOpen])

  useEffect(() => {
    const handleResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
      // resize/orientationchange fires after the viewport dimensions have changed.
      // Reuse the last anchor captured in the old layout instead of probing the
      // partially reflowed DOM, which would accumulate paragraph drift.
      const anchor = lastAnchorRef.current
      resizeTimerRef.current = setTimeout(() => {
        pendingAnchorRef.current = anchor
        setLayoutEpoch((value) => value + 1)
      }, 140)
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
    }
  }, [captureAnchor])

  useEffect(() => {
    const forceSave = () => {
      void persistAnchor(captureAnchor(), true)
      void readerRepository.saveSettings(settingsRef.current)
    }
    const visibility = () => { if (document.visibilityState === 'hidden') forceSave() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', forceSave)
    window.addEventListener('beforeunload', forceSave)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', forceSave)
      window.removeEventListener('beforeunload', forceSave)
    }
  }, [captureAnchor, persistAnchor])

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false); setSettingsOpen(false); setControlsOpen(false)
        return
      }
      if (drawerOpen || settingsOpen || settings.readingMode !== 'paged') return
      if (['ArrowRight', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); turnPage(1) }
      if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); turnPage(-1) }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [drawerOpen, settingsOpen, settings.readingMode, turnPage])

  useEffect(() => () => {
    if (positionTimerRef.current) clearTimeout(positionTimerRef.current)
    if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current)
    void readerRepository.saveSettings(settingsRef.current)
    schedulerRef.current?.flush().catch((error) => console.error('Final progress save failed:', error))
  }, [])

  const requestReimport = () => {
    const confirmed = window.confirm('重新导入会重新生成章节，并可能清除当前阅读位置。确定继续吗？')
    if (confirmed) fileInputRef.current?.click()
  }

  const percentage = formatPercentage(progress?.globalProgress ?? 0)
  const busy = stage !== null && !['complete', 'error'].includes(stage)
  const style = {
    '--reader-font-family': settings.fontFamily,
    '--reader-font-size': `${settings.fontSize}px`,
    '--reader-line-height': settings.lineHeight,
    '--reader-content-width': `${settings.contentWidth}px`,
    '--reader-horizontal-padding': `${settings.horizontalPadding}px`,
    '--reader-paragraph-indent': settings.paragraphIndent,
  } as CSSProperties

  return (
    <main className="reader-shell" data-reader-theme={settings.theme} style={style}>
      <ReaderViewport
        chapter={chapter}
        mode={settings.readingMode}
        loading={loading}
        error={readerError}
        viewportRef={viewportRef}
        contentRef={contentRef}
        onToggleControls={() => setControlsOpen((value) => !value)}
        onPreviousPage={() => turnPage(-1)}
        onNextPage={() => turnPage(1)}
        onPositionChange={queuePositionSave}
      />
      {chapter && !controlsOpen && <ReadingStatus title={chapter.title} percentage={percentage} />}
      {controlsOpen && chapter && (
        <ReaderControls
          title={chapter.title}
          progressLabel={percentage}
          canPrevious={Boolean(neighbors.previous) && !loading}
          canNext={Boolean(neighbors.next) && !loading}
          onOpenChapters={() => { setDrawerOpen(true); setControlsOpen(false) }}
          onOpenSettings={() => { setSettingsOpen(true); setControlsOpen(false) }}
          onPrevious={() => { void navigateChapter(neighbors.previous) }}
          onNext={() => { void navigateChapter(neighbors.next) }}
        />
      )}
      <ChapterDrawer open={drawerOpen} bookTitle={book.title} chapters={chapters} currentChapterId={chapter?.id} onSelect={(item) => { void navigateChapter(item) }} onClose={() => setDrawerOpen(false)} />
      <SettingsPanel open={settingsOpen} settings={settings} onChange={updateSettings} onReimport={requestReimport} onClose={() => setSettingsOpen(false)} />
      {extraNotice && <div className="reader-toast" role="status">已进入附加内容</div>}
      {busy && <div className="reader-import-overlay"><ImportStatus stage={stage} /></div>}
      {importError && <div className="reader-toast error-text" role="alert">{importError}</div>}
      {readerError && (
        <div className="reader-error-actions">
          <button type="button" onClick={() => window.location.reload()}>重新加载</button>
          <button type="button" onClick={requestReimport}>重新导入</button>
        </div>
      )}
      <input ref={fileInputRef} className="visually-hidden" type="file" accept=".txt,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = '' }} />
    </main>
  )
}
