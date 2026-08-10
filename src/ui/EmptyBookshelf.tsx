import { ImportBookButton } from './ImportBookButton'
import { InstallHelp } from './InstallHelp'

interface EmptyBookshelfProps {
  busy: boolean
  onImport: () => void
}

export function EmptyBookshelf({ busy, onImport }: EmptyBookshelfProps) {
  return (
    <section className="empty-bookshelf" aria-labelledby="empty-bookshelf-title">
      <div className="empty-book-stack" aria-hidden="true"><span /><span /><span /></div>
      <h2 id="empty-bookshelf-title">你的书架还是空的</h2>
      <p>导入 TXT 开始阅读<br />小说内容只保存在当前设备。</p>
      <ImportBookButton disabled={busy} onClick={onImport} />
      <InstallHelp />
    </section>
  )
}
