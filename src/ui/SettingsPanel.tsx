import type { ReaderSettings, ReaderTheme, ReadingMode } from '../domain/models'

interface SettingsPanelProps {
  open: boolean
  settings: ReaderSettings
  onChange: (patch: Partial<ReaderSettings>) => void
  onReimport: () => void
  onClose: () => void
}

const FONT_OPTIONS = [
  { label: '系统默认', value: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: '宋体 / 衬线', value: 'ui-serif, "Songti SC", "STSong", "SimSun", serif' },
  { label: '黑体 / 无衬线', value: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif' },
  { label: '楷体', value: '"Kaiti SC", "STKaiti", "KaiTi", serif' },
]

const THEMES: { label: string; value: ReaderTheme }[] = [
  { label: '纸张', value: 'paper' }, { label: '明亮', value: 'light' },
  { label: '护眼', value: 'eyeCare' }, { label: '夜间', value: 'dark' },
]

function RangeSetting({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void }) {
  const adjust = (direction: -1 | 1) => {
    const next = Math.min(max, Math.max(min, Number((value + direction * step).toFixed(2))))
    onChange(next)
  }
  return (
    <label className="setting-range">
      <span><strong>{label}</strong><output>{value}{unit}</output></span>
      <span className="setting-range-controls">
        <button type="button" aria-label={`减小${label}`} disabled={value <= min} onClick={() => adjust(-1)}>−</button>
        <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
        <button type="button" aria-label={`增大${label}`} disabled={value >= max} onClick={() => adjust(1)}>+</button>
      </span>
    </label>
  )
}

export function SettingsPanel({ open, settings, onChange, onReimport, onClose }: SettingsPanelProps) {
  if (!open) return null
  return (
    <div className="reader-overlay settings-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-label="阅读设置">
        <header className="panel-header"><strong>阅读设置</strong><button type="button" className="icon-button" aria-label="关闭阅读设置" onClick={onClose}>×</button></header>
        <div className="settings-scroll">
          <fieldset className="segmented-setting">
            <legend>阅读方式</legend>
            {(['scroll', 'paged'] as ReadingMode[]).map((mode) => <button key={mode} type="button" className={settings.readingMode === mode ? 'is-selected' : ''} onClick={() => onChange({ readingMode: mode })}>{mode === 'scroll' ? '上下滚动' : '左右翻页'}</button>)}
          </fieldset>
          <label className="select-setting"><span>字体</span><select value={settings.fontFamily} onChange={(event) => onChange({ fontFamily: event.target.value })}>{FONT_OPTIONS.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}</select></label>
          <RangeSetting label="字号" value={settings.fontSize} min={14} max={32} step={1} unit="px" onChange={(fontSize) => onChange({ fontSize })} />
          <RangeSetting label="行距" value={settings.lineHeight} min={1.4} max={2.4} step={0.1} unit="" onChange={(lineHeight) => onChange({ lineHeight })} />
          <RangeSetting label="页面边距" value={settings.horizontalPadding} min={12} max={36} step={2} unit="px" onChange={(horizontalPadding) => onChange({ horizontalPadding })} />
          <RangeSetting label="桌面内容宽度" value={settings.contentWidth} min={560} max={960} step={20} unit="px" onChange={(contentWidth) => onChange({ contentWidth })} />
          <fieldset className="segmented-setting"><legend>首行缩进</legend><button type="button" className={settings.paragraphIndent === '2em' ? 'is-selected' : ''} onClick={() => onChange({ paragraphIndent: '2em' })}>开启</button><button type="button" className={settings.paragraphIndent === '0' ? 'is-selected' : ''} onClick={() => onChange({ paragraphIndent: '0' })}>关闭</button></fieldset>
          <fieldset className="theme-setting"><legend>主题</legend>{THEMES.map((theme) => <button key={theme.value} type="button" data-theme-preview={theme.value} className={settings.theme === theme.value ? 'is-selected' : ''} onClick={() => onChange({ theme: theme.value })}><span />{theme.label}</button>)}</fieldset>
          <div className="settings-danger"><button type="button" onClick={onReimport}>重新导入 TXT</button><small>重新导入会重新生成章节，并可能清除当前阅读位置。</small></div>
        </div>
      </aside>
    </div>
  )
}
