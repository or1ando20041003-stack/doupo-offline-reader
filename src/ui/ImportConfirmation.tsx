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

function formatFileSize(value: number): string {
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`
}

export function ImportConfirmation({ prepared, saving, error, onCancel, onConfirm }: ImportConfirmationProps) {
  const [title, setTitle] = useState(prepared.suggestedTitle)
  useEffect(() => { setTitle(prepared.suggestedTitle) }, [prepared])
  const duplicate = prepared.duplicateBook
  const highPriorityWarning = prepared.warnings.find((warning) => warning.priority === 'high')
  const alignment = prepared.summary.chapterAlignment

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
          <div><dt>正文文件</dt><dd title={prepared.fileName}>{prepared.fileName} · {formatFileSize(prepared.fileSize)}</dd></div>
          <div><dt>章节</dt><dd>{prepared.summary.totalChapters.toLocaleString('zh-CN')}</dd></div>
          <div><dt>正文</dt><dd>{formatCharacters(prepared.summary.totalCharacterCount)} 字</dd></div>
          <div><dt>编码</dt><dd>{prepared.summary.encoding.toUpperCase()}</dd></div>
        </dl>
        {alignment && (
          <section className="alignment-summary" aria-labelledby="alignment-summary-title">
            <h3 id="alignment-summary-title">章节目录辅助结果</h3>
            <p title={alignment.referenceSourceFileName}>目录：{alignment.referenceSourceFileName}</p>
            <dl className="alignment-stats">
              <div><dt>目录条目</dt><dd>{alignment.referenceEntries.toLocaleString('zh-CN')}</dd></div>
              <div><dt>正文初始候选</dt><dd>{alignment.originalChapterCount.toLocaleString('zh-CN')}</dd></div>
              <div><dt>精确定位</dt><dd>{alignment.rawExactMatches.toLocaleString('zh-CN')}</dd></div>
              <div><dt>格式修复</dt><dd>{alignment.normalizedExactMatches.toLocaleString('zh-CN')}</dd></div>
              <div><dt>前缀修复</dt><dd>{(alignment.bodyPrefixMatches + alignment.referencePrefixMatches).toLocaleString('zh-CN')}</dd></div>
              <div><dt>模糊匹配</dt><dd>{alignment.fuzzyMatches.toLocaleString('zh-CN')}</dd></div>
              <div><dt>未定位</dt><dd>{alignment.unresolvedReferences.toLocaleString('zh-CN')}</dd></div>
              <div><dt>正文独有</dt><dd>{alignment.bodyOnlyEntries.toLocaleString('zh-CN')}</dd></div>
              <div><dt>最终阅读条目</dt><dd>{alignment.finalEntries.toLocaleString('zh-CN')}</dd></div>
            </dl>
            {alignment.warning ? (
              <p className="alignment-note">{alignment.warning}</p>
            ) : alignment.unresolvedReferences > 0 ? (
              <p className="alignment-note">部分目录条目未在正文中找到可靠边界，已保持与相邻正文合并，不影响导入。</p>
            ) : null}
          </section>
        )}
        {highPriorityWarning && <p className="import-warning">{highPriorityWarning.message}</p>}
        {duplicate && (
          <div className="duplicate-notice" role="status">
            <strong>书架中已存在《{duplicate.title}》</strong>
            <span>默认不会覆盖。覆盖会重新处理正文，并将这本书的阅读进度重置到开头。</span>
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
