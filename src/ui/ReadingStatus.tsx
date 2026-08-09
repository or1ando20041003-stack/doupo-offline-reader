interface ReadingStatusProps {
  title: string
  percentage: string
  hidden?: boolean
}

export function ReadingStatus({ title, percentage, hidden = false }: ReadingStatusProps) {
  return <div className="reading-status" aria-hidden={hidden}>{title} · {percentage}</div>
}
