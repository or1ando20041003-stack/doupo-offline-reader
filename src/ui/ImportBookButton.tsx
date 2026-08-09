import { FilePicker } from './FilePicker'

interface ImportBookButtonProps {
  disabled?: boolean
  compact?: boolean
  onFile: (file: File) => void
}

export function ImportBookButton({ disabled = false, compact = false, onFile }: ImportBookButtonProps) {
  return (
    <span className={compact ? 'bookshelf-import compact' : 'bookshelf-import'}>
      <FilePicker label="＋ 导入 TXT" disabled={disabled} secondary={compact} onFile={onFile} />
    </span>
  )
}
