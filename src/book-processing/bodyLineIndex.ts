import { normalizeReferenceLabel } from './referenceChapters'

export interface BodyLine {
  rawLine: string
  trimmedLine: string
  normalizedLine: string
  lineNumber: number
  startCharacterOffset: number
  endCharacterOffset: number
}

export interface BodyLineIndex {
  text: string
  lines: BodyLine[]
  nonEmptyLines: BodyLine[]
  byTrimmedLine: ReadonlyMap<string, readonly BodyLine[]>
  byNormalizedLine: ReadonlyMap<string, readonly BodyLine[]>
}

export function lightNormalizeBodyForIndex(text: string): string {
  return text.replace(/^\uFEFF/u, '').replace(/\r\n?|\u2028|\u2029/gu, '\n')
}

function append(map: Map<string, BodyLine[]>, key: string, line: BodyLine): void {
  if (!key) return
  const matches = map.get(key)
  if (matches) matches.push(line)
  else map.set(key, [line])
}

export function buildBodyLineIndex(input: string): BodyLineIndex {
  const text = lightNormalizeBodyForIndex(input)
  const rawLines = text.split('\n')
  const byTrimmedLine = new Map<string, BodyLine[]>()
  const byNormalizedLine = new Map<string, BodyLine[]>()
  const lines: BodyLine[] = []
  let offset = 0
  rawLines.forEach((rawLine, index) => {
    const trimmedLine = rawLine.trim()
    const line: BodyLine = {
      rawLine,
      trimmedLine,
      normalizedLine: normalizeReferenceLabel(trimmedLine),
      lineNumber: index + 1,
      startCharacterOffset: offset,
      endCharacterOffset: offset + rawLine.length,
    }
    lines.push(line)
    append(byTrimmedLine, trimmedLine, line)
    append(byNormalizedLine, line.normalizedLine, line)
    offset += rawLine.length + (index < rawLines.length - 1 ? 1 : 0)
  })
  return {
    text,
    lines,
    nonEmptyLines: lines.filter(({ trimmedLine }) => trimmedLine.length > 0),
    byTrimmedLine,
    byNormalizedLine,
  }
}
