import { useEffect, useState } from 'react'
import type { DuplicateAction, PreparedBookImport } from '../services/importBook'

interface ImportConfirmationProps {
  prepared: PreparedBookImport
  saving: boolean
  error?: string
  onCancel: () => void
  onConfirm: (title: string, duplicateAction?: DuplicateAction) => void
}

function formatCharacters(value: number): string {
  return value >= 10_000 ? `${(value / 10_000).toFixed(1)} 万` : value.toLocaleString('zh-CN')
}

export function ImportConfirmation({ prepared, saving, error, onCancel, onConfirm }: ImportConfirmationProps) {
  const [title, setTitle] = useState(prepared.suggestedTitle)
  useEffect(() => { setTitle(prepared.suggestedTitle) }, [prepared])
  const duplicate = prepared.duplicateBook
  const highPriorityWarning = prepared.warnings.find((warning) => warning.priority === 'high')

  return (
    <div className="bookshelf-dialog-backdrop">
      <section className="import-confirmation-card" role="dialog" aria-modal="true" aria-labelledby="import-confirmation-title">
        <p className="eyebrow">确认书籍信息</p>
        <h2 id="import-confirmation-title">解析完成</h2>
        <label className="import-title-field">
          <span>书名</span>
          <input value={title} maxLength={120} disabled={saving} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <dl className="import-book-facts">
          <div><dt>文件</dt><dd title={prepared.fileName}>{prepared.fileName}</dd></div>
          <div><dt>章节</dt><dd>{prepared.summary.totalChapters.toLocaleString('zh-CN')}</dd></div>
          <div><dt>正文</dt><dd>{formatCharacters(prepared.summary.totalCharacterCount)} 字</dd></div>
          <div><dt>编码</dt><dd>{prepared.summary.encoding.toUpperCase()}</dd></div>
        </dl>
        {highPriorityWarning && <p className="import-warning">{highPriorityWarning.message}</p>}
        {duplicate && (
          <div className="duplicate-notice" role="status">
            <strong>书架中已存在《{duplicate.title}》</strong>
            <span>默认不会覆盖，请选择处理方式。</span>
          </div>
        )}
        {error && <p className="error-text" role="alert">{error}</p>}
        {duplicate ? (
          <div className="duplicate-actions">
            <button type="button" className="button button-secondary" disabled={saving} onClick={onCancel}>取消</button>
            <button type="button" className="button button-secondary" disabled={saving || !title.trim()} onClick={() => onConfirm(title, 'keep')}>保留两本</button>
            <button type="button" className="button danger-button" disabled={saving || !title.trim()} onClick={() => onConfirm(title, 'overwrite')}>{saving ? '正在保存…' : '覆盖原书'}</button>
          </div>
        ) : (
          <div className="dialog-actions">
            <button type="button" className="button button-secondary" disabled={saving} onClick={onCancel}>重新选择</button>
            <button type="button" className="button" disabled={saving || !title.trim()} onClick={() => onConfirm(title)}>{saving ? '正在保存…' : '确认导入'}</button>
          </div>
        )}
      </section>
    </div>
  )
}
