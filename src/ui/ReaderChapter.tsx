import type { Chapter } from '../domain/models'

interface ReaderChapterProps {
  chapter: Chapter
  contentRef: React.RefObject<HTMLElement | null>
}

export function ReaderChapter({ chapter, contentRef }: ReaderChapterProps) {
  return (
    <article ref={contentRef} className="reader-chapter" aria-labelledby="reader-chapter-title">
      <h1 id="reader-chapter-title" className="reader-chapter-title">{chapter.title}</h1>
      <div className="reader-paragraphs">
        {chapter.paragraphs.map((paragraph, index) => (
          <p key={index} data-paragraph-index={index}>{paragraph}</p>
        ))}
      </div>
    </article>
  )
}
