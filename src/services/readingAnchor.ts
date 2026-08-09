import type { TextAnchor } from '../domain/progressMetrics'

type CaretDocument = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}

export interface RestoredAnchor {
  anchor: TextAnchor
  pageIndex?: number
}

function isInside(node: Node, container: HTMLElement): boolean {
  return node === container || container.contains(node.nodeType === Node.TEXT_NODE ? node.parentNode : node)
}

function textNodes(element: HTMLElement): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }
  return nodes
}

function offsetWithinParagraph(paragraph: HTMLElement, node: Node, nodeOffset: number): number {
  let total = 0
  for (const textNode of textNodes(paragraph)) {
    if (textNode === node) return total + Math.min(nodeOffset, textNode.data.length)
    total += textNode.data.length
  }
  return 0
}

function rangeAtOffset(paragraph: HTMLElement, requestedOffset: number): Range {
  const nodes = textNodes(paragraph)
  const maxOffset = paragraph.textContent?.length ?? 0
  let remaining = Math.min(Math.max(requestedOffset, 0), maxOffset)
  const range = document.createRange()
  for (const node of nodes) {
    if (remaining <= node.data.length) {
      range.setStart(node, remaining)
      range.collapse(true)
      return range
    }
    remaining -= node.data.length
  }
  range.selectNodeContents(paragraph)
  range.collapse(false)
  return range
}

function paragraphAtPoint(root: HTMLElement, x: number, y: number): HTMLElement | null {
  const direct = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-paragraph-index]')
  if (direct && root.contains(direct)) return direct

  let nearest: { paragraph: HTMLElement; distance: number } | undefined
  for (const paragraph of root.querySelectorAll<HTMLElement>('[data-paragraph-index]')) {
    for (const rect of Array.from(paragraph.getClientRects())) {
      const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0
      const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0
      const distance = Math.hypot(dx, dy)
      if (!nearest || distance < nearest.distance) nearest = { paragraph, distance }
    }
  }
  return nearest?.paragraph ?? null
}

function characterOffsetAtPoint(paragraph: HTMLElement, x: number, y: number): number {
  const caretPosition = document.caretPositionFromPoint?.(x, y)
  if (caretPosition && isInside(caretPosition.offsetNode, paragraph)) {
    return offsetWithinParagraph(paragraph, caretPosition.offsetNode, caretPosition.offset)
  }
  const caretRange = (document as CaretDocument).caretRangeFromPoint?.(x, y)
  if (caretRange && isInside(caretRange.startContainer, paragraph)) {
    return offsetWithinParagraph(paragraph, caretRange.startContainer, caretRange.startOffset)
  }

  const length = paragraph.textContent?.length ?? 0
  let low = 0
  let high = length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const rect = rangeAtOffset(paragraph, middle).getBoundingClientRect()
    const beforePoint = rect.top < y - 1 || (Math.abs(rect.top - y) <= Math.max(2, rect.height) && rect.left < x)
    if (beforePoint) low = middle + 1
    else high = middle
  }
  return Math.min(low, length)
}

export function getAnchorAtViewportPoint(
  viewport: HTMLElement,
  contentRoot: HTMLElement,
  probeRatio = 0.42,
): TextAnchor | null {
  const viewportRect = viewport.getBoundingClientRect()
  const x = viewportRect.left + viewportRect.width / 2
  const y = viewportRect.top + viewportRect.height * probeRatio
  const paragraph = paragraphAtPoint(contentRoot, x, y)
  if (!paragraph) return null
  const paragraphIndex = Number(paragraph.dataset.paragraphIndex)
  if (!Number.isInteger(paragraphIndex)) return null
  return { paragraphIndex, characterOffset: characterOffsetAtPoint(paragraph, x, y) }
}

export function restoreScrollAnchor(
  viewport: HTMLElement,
  contentRoot: HTMLElement,
  anchor: TextAnchor,
  probeRatio = 0.42,
): RestoredAnchor | null {
  const paragraph = contentRoot.querySelector<HTMLElement>(`[data-paragraph-index="${anchor.paragraphIndex}"]`)
  if (!paragraph) return null
  const range = rangeAtOffset(paragraph, anchor.characterOffset)
  const rect = range.getBoundingClientRect()
  const viewportRect = viewport.getBoundingClientRect()
  const top = viewport.scrollTop + rect.top - viewportRect.top - viewportRect.height * probeRatio
  viewport.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
  return { anchor }
}

export function restorePagedAnchor(
  viewport: HTMLElement,
  contentRoot: HTMLElement,
  anchor: TextAnchor,
): RestoredAnchor | null {
  const paragraph = contentRoot.querySelector<HTMLElement>(`[data-paragraph-index="${anchor.paragraphIndex}"]`)
  if (!paragraph) return null
  const range = rangeAtOffset(paragraph, anchor.characterOffset)
  const rect = range.getBoundingClientRect()
  const viewportRect = viewport.getBoundingClientRect()
  const pageWidth = Math.max(1, viewport.clientWidth)
  const contentX = viewport.scrollLeft + rect.left - viewportRect.left
  const pageIndex = Math.max(0, Math.floor(contentX / pageWidth))
  viewport.scrollTo({ left: pageIndex * pageWidth, behavior: 'auto' })
  return { anchor, pageIndex }
}

export function getPagedLayout(viewport: HTMLElement, contentRoot: HTMLElement): { pageCount: number; pageIndex: number } {
  const pageWidth = Math.max(1, viewport.clientWidth)
  return {
    pageCount: Math.max(1, Math.ceil(contentRoot.scrollWidth / pageWidth)),
    pageIndex: Math.max(0, Math.round(viewport.scrollLeft / pageWidth)),
  }
}
