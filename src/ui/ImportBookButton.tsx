interface ImportBookButtonProps {
  disabled?: boolean
  compact?: boolean
  onClick: () => void
}

export function ImportBookButton({ disabled = false, compact = false, onClick }: ImportBookButtonProps) {
  return (
    <span className={compact ? 'bookshelf-import compact' : 'bookshelf-import'}>
      <button type="button" className={compact ? 'button button-secondary' : 'button'} disabled={disabled} onClick={onClick}>
        ＋ 导入 TXT
      </button>
    </span>
  )
}
