import type { BookSection } from './models'

export function createChapterId(bookId: string, section: BookSection, order: number): string {
  return `${bookId}:${section}:${order}`
}
