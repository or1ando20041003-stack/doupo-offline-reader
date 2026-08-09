import type { ImportStage } from '../book-processing/types'

const STAGE_LABELS: Readonly<Record<ImportStage, string>> = {
  reading: '正在读取文件……',
  decoding: '正在识别文本编码……',
  cleaning: '正在清理正文……',
  parsing: '正在识别章节……',
  saving: '正在建立离线数据库……',
  complete: '导入完成',
  error: '导入未完成',
}

export function ImportStatus({ stage }: { stage: ImportStage | null }) {
  if (!stage) return null
  return (
    <div className="import-status" role="status" aria-live="polite">
      <span className={stage === 'complete' || stage === 'error' ? 'status-dot stopped' : 'status-dot'} />
      {STAGE_LABELS[stage]}
    </div>
  )
}
