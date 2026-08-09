import type { ImportStage } from '../book-processing/types'
import { FilePicker } from './FilePicker'
import { ImportStatus } from './ImportStatus'
import { InstallHelp } from './InstallHelp'

interface ImportScreenProps {
  stage: ImportStage | null
  error: string | null
  onFile: (file: File) => void
}

export function ImportScreen({ stage, error, onFile }: ImportScreenProps) {
  const busy = stage !== null && !['complete', 'error'].includes(stage)
  return (
    <main className="app-shell import-layout">
      <section className="import-card">
        <div className="book-mark" aria-hidden="true">斗</div>
        <p className="eyebrow">私人 · 本地 · 离线</p>
        <h1>斗破苍穹</h1>
        <p className="lead">
          导入小说文件后，即可完全离线阅读。<br />小说内容只保存在当前设备。
        </p>
        <FilePicker label="选择 TXT 文件" disabled={busy} onFile={onFile} />
        <ImportStatus stage={stage} />
        {error && <p className="error-text" role="alert">{error}</p>}
        <p className="privacy-note">文件不会上传，也不会离开这台设备。</p>
        <InstallHelp />
      </section>
    </main>
  )
}
