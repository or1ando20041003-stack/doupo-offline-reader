/// <reference lib="webworker" />

import { cleanText } from '../book-processing/cleanText'
import { decodeText } from '../book-processing/decodeText'
import { parseChapters } from '../book-processing/parseChapters'
import type { WorkerImportRequest, WorkerImportResponse } from '../book-processing/types'

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

function post(response: WorkerImportResponse): void {
  workerScope.postMessage(response)
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function handleImport(event: MessageEvent<WorkerImportRequest>): Promise<void> {
  if (event.data.type !== 'import') return

  try {
    const totalStartedAt = performance.now()
    const contentHash = await sha256(event.data.payload.buffer)
    post({ type: 'progress', stage: 'decoding' })
    const decodeStartedAt = performance.now()
    const decoded = decodeText(event.data.payload.buffer)
    const decodeMs = performance.now() - decodeStartedAt

    post({ type: 'progress', stage: 'cleaning' })
    const cleanStartedAt = performance.now()
    const cleaned = cleanText(decoded.text)
    const cleanMs = performance.now() - cleanStartedAt

    post({ type: 'progress', stage: 'parsing' })
    const parseStartedAt = performance.now()
    const parsed = parseChapters(cleaned.text)
    const parseMs = performance.now() - parseStartedAt
    if (parsed.chapters.length === 0) {
      throw new Error('文件为空或没有可保存的正文。')
    }

    const mainCharacterCount = parsed.chapters
      .filter((chapter) => chapter.section === 'main')
      .reduce((sum, chapter) => sum + chapter.characterCount, 0)
    const extraCharacterCount = parsed.chapters
      .filter((chapter) => chapter.section === 'extra')
      .reduce((sum, chapter) => sum + chapter.characterCount, 0)
    post({
      type: 'result',
      payload: {
        contentHash,
        encoding: decoded.encoding,
        chapters: parsed.chapters,
        warnings: parsed.warnings,
        cleaningWarnings: cleaned.warnings,
        appliedCleaningRuleIds: cleaned.appliedRuleIds,
        cleaningRuleHits: cleaned.ruleHits,
        canonicalEndingDetected: parsed.canonicalEndingDetected,
        timings: {
          decodeMs,
          cleanMs,
          parseMs,
          totalMs: performance.now() - totalStartedAt,
        },
        totalCharacterCount: mainCharacterCount + extraCharacterCount,
        mainCharacterCount,
        extraCharacterCount,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '导入过程中发生未知错误。'
    const details = error instanceof Error ? error.stack : String(error)
    post({ type: 'error', message, details })
  }
}

workerScope.onmessage = (event: MessageEvent<WorkerImportRequest>) => {
  void handleImport(event)
}

export {}
