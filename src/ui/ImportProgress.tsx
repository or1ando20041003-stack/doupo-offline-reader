import type { ImportStage } from '../book-processing/types'

interface ImportProgressProps {
  fileName: string
  stage: ImportStage
  error?: string
  onDismiss: () => void
}

const STEPS = ['读取文件', '编码识别', '文本清洗', '章节解析', '保存数据'] as const

function completedStepCount(stage: ImportStage): number {
  switch (stage) {
    case 'reading': return 0
    case 'decoding': return 1
    case 'cleaning': return 2
    case 'parsing': return 3
    case 'reviewing': return 4
    case 'saving': return 4
    case 'complete': return 5
    case 'error': return 0
  }
}

export function ImportProgress({ fileName, stage, error, onDismiss }: ImportProgressProps) {
  const completed = completedStepCount(stage)
  const failed = stage === 'error'
  return (
    <div className="bookshelf-dialog-backdrop">
      <section className="import-progress-card" role="dialog" aria-modal="true" aria-labelledby="import-progress-title">
        <p className="eyebrow">正在导入</p>
        <h2 id="import-progress-title" title={fileName}>{fileName}</h2>
        {failed ? (
          <>
            <p className="error-text" role="alert">{error ?? '导入失败，请重新选择文件。'}</p>
            <button type="button" className="button" onClick={onDismiss}>返回书架</button>
          </>
        ) : (
          <ol className="import-step-list">
            {STEPS.map((label, index) => {
              const done = index < completed
              const current = index === completed && stage !== 'reviewing' && stage !== 'complete'
              return (
                <li key={label} className={done ? 'is-done' : current ? 'is-current' : ''}>
                  <span aria-hidden="true">{done ? '✓' : current ? '●' : '○'}</span>
                  {label}
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
