import type { Book, Chapter } from '../domain/models'
import type {
  CleaningWarning,
  ImportStage,
  ParseWarning,
  ProcessingTimings,
  WorkerImportRequest,
  WorkerImportResponse,
  WorkerParsedPayload,
} from '../book-processing/types'
import { CLEANER_VERSION, PARSER_VERSION } from '../book-processing/types'
import { readerRepository } from '../db/repositories'
import { createChapterId } from '../domain/chapterId'

const CURRENT_BOOK_ID = 'current-book'

export type ImportWarning = ParseWarning | CleaningWarning

export interface ImportSummary {
  encoding: Book['sourceEncoding']
  mainChapterCount: number
  extraChapterCount: number
  totalCharacterCount: number
  appliedCleaningRuleCount: number
  cleaningRuleHits: Record<string, number>
  warningCount: number
  canonicalEndingDetected: boolean
  clearedPreviousProgress: boolean
  timings: ProcessingTimings & { saveMs: number }
}

export interface ImportResult {
  book: Book
  warnings: ImportWarning[]
  summary: ImportSummary
}

function parseInWorker(
  buffer: ArrayBuffer,
  onStage: (stage: ImportStage) => void,
): Promise<WorkerParsedPayload> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/bookImport.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (event: MessageEvent<WorkerImportResponse>) => {
      const response = event.data
      if (response.type === 'progress') {
        onStage(response.stage)
        return
      }
      worker.terminate()
      if (response.type === 'error') {
        console.error('Worker import failed:', response.details)
        reject(new Error(response.message))
        return
      }
      resolve(response.payload)
    }

    worker.onerror = (event) => {
      worker.terminate()
      console.error('Worker execution failed:', event)
      reject(new Error('后台文本处理程序启动失败，请刷新页面后重试。'))
    }

    const request: WorkerImportRequest = { type: 'import', payload: { buffer } }
    worker.postMessage(request, [buffer])
  })
}

export async function importBookFile(
  file: File,
  onStage: (stage: ImportStage) => void,
): Promise<ImportResult> {
  if (!file.name.toLowerCase().endsWith('.txt')) {
    throw new Error('请选择扩展名为 .txt 的小说文件。')
  }

  onStage('reading')
  const buffer = await file.arrayBuffer()
  const parsed = await parseInWorker(buffer, onStage)

  const chapters: Chapter[] = parsed.chapters.map((chapter) => ({
    ...chapter,
    id: createChapterId(CURRENT_BOOK_ID, chapter.section, chapter.order),
    bookId: CURRENT_BOOK_ID,
  }))
  const book: Book = {
    id: CURRENT_BOOK_ID,
    title: file.name.replace(/\.txt$/i, '').trim() || '斗破苍穹',
    sourceFileName: file.name,
    sourceEncoding: parsed.encoding,
    importedAt: new Date().toISOString(),
    mainChapterCount: chapters.filter((chapter) => chapter.section === 'main').length,
    extraChapterCount: chapters.filter((chapter) => chapter.section === 'extra').length,
    totalCharacterCount: parsed.totalCharacterCount,
    mainCharacterCount: parsed.mainCharacterCount,
    extraCharacterCount: parsed.extraCharacterCount,
    parserVersion: PARSER_VERSION,
    cleanerVersion: CLEANER_VERSION,
  }

  onStage('saving')
  const saveStartedAt = performance.now()
  const replacement = await readerRepository.replaceBookData(book, chapters)
  const saveMs = performance.now() - saveStartedAt
  onStage('complete')
  const warnings: ImportWarning[] = [...parsed.cleaningWarnings, ...parsed.warnings]
  return {
    book,
    warnings,
    summary: {
      encoding: parsed.encoding,
      mainChapterCount: book.mainChapterCount,
      extraChapterCount: book.extraChapterCount,
      totalCharacterCount: book.totalCharacterCount,
      appliedCleaningRuleCount: parsed.appliedCleaningRuleIds.length,
      cleaningRuleHits: parsed.cleaningRuleHits,
      warningCount: warnings.length,
      canonicalEndingDetected: parsed.canonicalEndingDetected,
      clearedPreviousProgress: replacement.clearedProgress,
      timings: { ...parsed.timings, saveMs },
    },
  }
}
