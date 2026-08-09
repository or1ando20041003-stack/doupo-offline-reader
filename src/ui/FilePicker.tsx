import { useRef } from 'react'

interface FilePickerProps {
  label: string
  disabled?: boolean
  secondary?: boolean
  onFile: (file: File) => void
}

export function FilePicker({ label, disabled = false, secondary = false, onFile }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        className={secondary ? 'button button-secondary' : 'button'}
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".txt,text/plain"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ''
        }}
      />
    </>
  )
}
