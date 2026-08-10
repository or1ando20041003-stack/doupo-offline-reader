import { useState } from 'react'
import type { BookImportFiles } from '../services/importBook'
import { FilePicker } from './FilePicker'

interface ImportSetupDialogProps {
  onCancel: () => void
  onStart: (files: BookImportFiles) => void
}

function FileSelection({ label, file, optional, onFile, onClear }: {
  label: string
  file?: File
  optional?: boolean
  onFile: (file: File) => void
  onClear?: () => void
}) {
  return (
    <section className="import-file-selection">
      <div>
        <strong>{label}</strong>
        <span>{optional ? '可选' : '必选'}</span>
      </div>
      <p title={file?.name}>{file?.name ?? '尚未选择'}</p>
      <div className="import-file-actions">
        <FilePicker label={file ? '重新选择' : '选择 TXT'} secondary onFile={onFile} />
        {file && optional && <button type="button" className="text-button" onClick={onClear}>移除目录</button>}
      </div>
    </section>
  )
}

export function ImportSetupDialog({ onCancel, onStart }: ImportSetupDialogProps) {
  const [bodyFile, setBodyFile] = useState<File>()
  const [referenceFile, setReferenceFile] = useState<File>()
  return (
    <div className="bookshelf-dialog-backdrop">
      <section className="import-setup-card" role="dialog" aria-modal="true" aria-labelledby="import-setup-title">
        <p className="eyebrow">本地导入</p>
        <h2 id="import-setup-title">导入小说</h2>
        <FileSelection label="小说正文 TXT" file={bodyFile} onFile={setBodyFile} />
        <FileSelection
          label="章节目录 TXT"
          file={referenceFile}
          optional
          onFile={setReferenceFile}
          onClear={() => setReferenceFile(undefined)}
        />
        <p className="import-helper-text">
          章节目录是可选的。它可以帮助识别格式不规则的章节标题；如果某些目录章节无法在正文中可靠找到，将保持正文原有合并状态，不影响导入。
        </p>
        <div className="dialog-actions">
          <button type="button" className="button button-secondary" onClick={onCancel}>取消</button>
          <button
            type="button"
            className="button"
            disabled={!bodyFile}
            onClick={() => { if (bodyFile) onStart({ bodyFile, referenceFile }) }}
          >
            开始分析
          </button>
        </div>
      </section>
    </div>
  )
}
