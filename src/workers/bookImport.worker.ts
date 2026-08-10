/// <reference lib="webworker" />

import { cleanText } from '../book-processing/cleanText'
import { decodeText } from '../book-processing/decodeText'
import { parseChapters } from '../book-processing/parseChapters'
import { parseReferenceChapters } from '../book-processing/referenceChapters'
import { alignChaptersWithReference } from '../book-processing/chapterAlignment'
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
    let finalChapters = parsed.chapters
    let chapterAlignment
    const reference = event.data.payload.reference
    if (reference) {
      try {
        const decodedReference = decodeText(reference.buffer)
        const referenceIndex = parseReferenceChapters(decodedReference.text, reference.sourceFileName)
        if (referenceIndex.chapters.length > 0) {
          const aligned = alignChaptersWithReference(parsed.chapters, referenceIndex, decodedReference.encoding)
          finalChapters = aligned.chapters
          chapterAlignment = aligned.diagnostics
        } else {
          chapterAlignment = {
            referenceSourceFileName: reference.sourceFileName,
            referenceEncoding: decodedReference.encoding,
            referenceChapterCount: 0,
            referenceUnrecognizedLines: referenceIndex.unrecognizedLineCount,
            bodyCandidateCount: parsed.chapters.length,
            originalChapterCount: parsed.chapters.length,
            exactMatches: 0,
            highMatches: 0,
            fuzzyMatches: 0,
            unresolvedReferences: 0,
            bodyOnlyChapters: parsed.chapters.length,
            finalChapterCount: parsed.chapters.length,
            alignmentTimeMs: 0,
            warning: '章节目录为空或未识别到可靠条目，已自动使用普通章节解析结果。',
          }
        }
      } catch (error) {
        chapterAlignment = {
          referenceSourceFileName: reference.sourceFileName,
          referenceChapterCount: 0,
          referenceUnrecognizedLines: 0,
          bodyCandidateCount: parsed.chapters.length,
          originalChapterCount: parsed.chapters.length,
          exactMatches: 0,
          highMatches: 0,
          fuzzyMatches: 0,
          unresolvedReferences: 0,
          bodyOnlyChapters: parsed.chapters.length,
          finalChapterCount: parsed.chapters.length,
          alignmentTimeMs: 0,
          warning: '无法识别章节目录的编码或内容，已自动改用普通章节解析；正文仍可继续导入。',
        }
        console.warn('Reference chapter parsing skipped:', error)
      }
    }
    const parseMs = performance.now() - parseStartedAt
    if (finalChapters.length === 0) {
      throw new Error('文件为空或没有可保存的正文。')
    }

    const mainCharacterCount = finalChapters
      .filter((chapter) => chapter.section === 'main')
      .reduce((sum, chapter) => sum + chapter.characterCount, 0)
    const extraCharacterCount = finalChapters
      .filter((chapter) => chapter.section === 'extra')
      .reduce((sum, chapter) => sum + chapter.characterCount, 0)
    post({
      type: 'result',
      payload: {
        contentHash,
        encoding: decoded.encoding,
        chapters: finalChapters,
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
        chapterAlignment,
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
