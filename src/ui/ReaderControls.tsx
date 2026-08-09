interface ReaderControlsProps {
  title: string
  progressLabel: string
  canPrevious: boolean
  canNext: boolean
  onBack: () => void
  onOpenChapters: () => void
  onOpenSettings: () => void
  onPrevious: () => void
  onNext: () => void
}

export function ReaderControls({
  title,
  progressLabel,
  canPrevious,
  canNext,
  onBack,
  onOpenChapters,
  onOpenSettings,
  onPrevious,
  onNext,
}: ReaderControlsProps) {
  return (
    <div className="reader-controls" aria-label="阅读控制">
      <header className="reader-topbar">
        <span className="reader-topbar-actions">
          <button type="button" className="reader-control-button" aria-label="返回书架" onClick={onBack}>书架</button>
          <button type="button" className="reader-control-button" aria-label="打开章节目录" onClick={onOpenChapters}>目录</button>
        </span>
        <span className="reader-control-title" title={title}>{title}</span>
        <button type="button" className="reader-control-button" aria-label="打开阅读设置" onClick={onOpenSettings}>设置</button>
      </header>
      <footer className="reader-bottombar">
        <button type="button" className="reader-control-button" disabled={!canPrevious} aria-label="上一章" onClick={onPrevious}>上一章</button>
        <div className="reader-control-progress" aria-label={`当前进度 ${progressLabel}`}>
          <span>{progressLabel}</span>
          <span className="reader-progress-track"><span style={{ width: progressLabel }} /></span>
        </div>
        <button type="button" className="reader-control-button" disabled={!canNext} aria-label="下一章" onClick={onNext}>下一章</button>
      </footer>
    </div>
  )
}
