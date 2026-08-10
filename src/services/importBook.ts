import type { Book, Chapter, ReadingProgress } from '../domain/models'
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
import { ReaderRepository, readerRepository } from '../db/repositories'
import { createChapterId } from '../domain/chapterId'

export type ImportWarning = ParseWarning | CleaningWarning
export type DuplicateAction = 'overwrite' | 'keep'

export interface PreparedBookImport {
  fileName: string
  fileSize: number
  referenceFileName?: string
  referenceFileSize?: number
  suggestedTitle: string
  parsed: WorkerParsedPayload
  warnings: ImportWarning[]
  duplicateBook?: Book
  summary: {
    encoding: Book['sourceEncoding']
    mainChapterCount: number
    extraChapterCount: number
    totalChapters: number
    totalCharacterCount: number
    warningCount: number
    timings: ProcessingTimings
    chapterAlignment?: WorkerParsedPayload['chapterAlignment']
  }
}

export interface BookImportFiles {
  bodyFile: File
  referenceFile?: File
}

export interface ConfirmBookImportOptions {
  title: string
  duplicateAction?: DuplicateAction
}

interface ImportWorkerLike {
  onmessage: ((event: MessageEvent<WorkerImportResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: WorkerImportRequest, transfer: Transferable[]): void
  terminate(): void
}

type ImportWorkerFactory = () => ImportWorkerLike

function defaultWorkerFactory(): ImportWorkerLike {
  return new Worker(new URL('../workers/bookImport.worker.ts', import.meta.url), { type: 'module' })
}

export function inferBookTitle(fileName: string): string {
  const withoutExtension = fileName.replace(/\.txt$/iu, '').trim()
  const withoutEditionSuffix = withoutExtension
    .replace(/[\s._-]*[（(【\[]?(?:完整版|全本|全集)[）)】\]]?$/u, '')
    .trim()
  return withoutEditionSuffix || '未命名小说'
}

export function getImportErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (/请选择扩展名|文件为空|没有可保存|无效控制字符|后台文本处理程序/u.test(error.message)) {
      return error.message
    }
    if (error.name === 'NotReadableError' || /read|读取/iu.test(error.message)) {
      return '无法读取这个 TXT 文件，请确认文件没有损坏后重新选择。'
    }
  }
  return '无法解析这个 TXT 文件，请确认它是完整的纯文本小说。'
}

export function parseBookBufferInWorker(
  buffer: ArrayBuffer,
  onStage: (stage: ImportStage) => void,
  createWorker: ImportWorkerFactory = defaultWorkerFactory,
  reference?: { buffer: ArrayBuffer; sourceFileName: string },
  sourceFileName = '未命名.txt',
): Promise<WorkerParsedPayload> {
  return new Promise((resolve, reject) => {
    const worker = createWorker()

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

    const request: WorkerImportRequest = { type: 'import', payload: { buffer, sourceFileName, reference } }
    const transfer: Transferable[] = reference ? [buffer, reference.buffer] : [buffer]
    worker.postMessage(request, transfer)
  })
}

async function findDuplicateBook(
  title: string,
  parsed: WorkerParsedPayload,
  repository: ReaderRepository,
): Promise<Book | undefined> {
  const hashMatch = await repository.getBookBySourceHash(parsed.contentHash)
  if (hashMatch) return hashMatch

  const normalizedTitle = title.trim().toLocaleLowerCase('zh-CN')
  const books = await repository.getBooks()
  return books.find((book) => (
    book.title.trim().toLocaleLowerCase('zh-CN') === normalizedTitle
    && book.totalChapters === parsed.chapters.length
    && book.totalCharacterCount === parsed.totalCharacterCount
  ))
}

export async function prepareBookImport(
  file: File,
  onStage: (stage: ImportStage) => void,
  repository: ReaderRepository = readerRepository,
  createWorker: ImportWorkerFactory = defaultWorkerFactory,
): Promise<PreparedBookImport> {
  return prepareBookImportFiles({ bodyFile: file }, onStage, repository, createWorker)
}

export async function prepareBookImportFiles(
  files: BookImportFiles,
  onStage: (stage: ImportStage) => void,
  repository: ReaderRepository = readerRepository,
  createWorker: ImportWorkerFactory = defaultWorkerFactory,
): Promise<PreparedBookImport> {
  const { bodyFile: file, referenceFile } = files
  if (!file.name.toLowerCase().endsWith('.txt')) {
    throw new Error('请选择扩展名为 .txt 的小说文件。')
  }

  onStage('reading')
  let buffer: ArrayBuffer
  try {
    buffer = await file.arrayBuffer()
  } catch (error) {
    throw new Error(getImportErrorMessage(error))
  }
  let reference: { buffer: ArrayBuffer; sourceFileName: string } | undefined
  let referenceReadWarning: string | undefined
  if (referenceFile) {
    if (!referenceFile.name.toLowerCase().endsWith('.txt')) {
      referenceReadWarning = '章节目录不是 TXT 文件，已自动忽略并使用普通章节解析。'
    } else {
      try {
        reference = { buffer: await referenceFile.arrayBuffer(), sourceFileName: referenceFile.name }
      } catch {
        referenceReadWarning = '无法读取章节目录 TXT，已自动忽略；正文仍可继续导入。'
      }
    }
  }
  const parsed = await parseBookBufferInWorker(buffer, onStage, createWorker, reference, file.name)
  if (referenceFile && referenceReadWarning && !parsed.chapterAlignment) {
    parsed.chapterAlignment = {
      referenceSourceFileName: referenceFile.name,
      referenceEntries: 0,
      bodyCandidateCount: parsed.chapters.length,
      originalChapterCount: parsed.chapters.length,
      rawExactMatches: 0,
      normalizedExactMatches: 0,
      bodyPrefixMatches: 0,
      referencePrefixMatches: 0,
      fuzzyMatches: 0,
      unresolvedReferences: 0,
      bodyOnlyEntries: parsed.chapters.length,
      finalEntries: parsed.chapters.length,
      chapterNumberResets: 0,
      alignmentMs: 0,
      warning: referenceReadWarning,
    }
  }
  const suggestedTitle = inferBookTitle(file.name)
  const duplicateBook = await findDuplicateBook(suggestedTitle, parsed, repository)
  const warnings: ImportWarning[] = [...parsed.cleaningWarnings, ...parsed.warnings]
  onStage('reviewing')
  return {
    fileName: file.name,
    fileSize: file.size,
    referenceFileName: referenceFile?.name,
    referenceFileSize: referenceFile?.size,
    suggestedTitle,
    parsed,
    warnings,
    duplicateBook,
    summary: {
      encoding: parsed.encoding,
      mainChapterCount: parsed.chapters.filter(({ section }) => section === 'main').length,
      extraChapterCount: parsed.chapters.filter(({ section }) => section === 'extra').length,
      totalChapters: parsed.chapters.length,
      totalCharacterCount: parsed.totalCharacterCount,
      warningCount: warnings.length,
      timings: parsed.timings,
      chapterAlignment: parsed.chapterAlignment,
    },
  }
}

export async function confirmBookImport(
  prepared: PreparedBookImport,
  options: ConfirmBookImportOptions,
  onStage: (stage: ImportStage) => void,
  repository: ReaderRepository = readerRepository,
  now = new Date(),
): Promise<Book> {
  const title = options.title.trim()
  if (!title) throw new Error('请输入书名后再确认导入。')
  if (prepared.duplicateBook && !options.duplicateAction) {
    throw new Error('这本小说已经存在，请选择覆盖、保留两本或取消。')
  }

  const overwrite = prepared.duplicateBook && options.duplicateAction === 'overwrite'
  const bookId = overwrite ? prepared.duplicateBook!.id : crypto.randomUUID()
  const chapters: Chapter[] = prepared.parsed.chapters.map((chapter) => ({
    ...chapter,
    id: createChapterId(bookId, chapter.section, chapter.order),
    bookId,
  }))
  const firstChapter = [...chapters].sort((left, right) => left.order - right.order)[0]
  if (!firstChapter) throw new Error('文件中没有可保存的章节。')

  const timestamp = now.toISOString()
  const previous = overwrite ? prepared.duplicateBook : undefined
  const book: Book = {
    id: bookId,
    title,
    author: previous?.author,
    description: previous?.description,
    sourceFileName: prepared.fileName,
    sourceEncoding: prepared.parsed.encoding,
    sourceHash: prepared.parsed.contentHash,
    importedAt: previous?.importedAt ?? timestamp,
    updatedAt: timestamp,
    totalChapters: chapters.length,
    mainChapterCount: prepared.summary.mainChapterCount,
    extraChapterCount: prepared.summary.extraChapterCount,
    totalCharacterCount: prepared.parsed.totalCharacterCount,
    wordCount: prepared.parsed.totalCharacterCount,
    mainCharacterCount: prepared.parsed.mainCharacterCount,
    extraCharacterCount: prepared.parsed.extraCharacterCount,
    parserVersion: PARSER_VERSION,
    cleanerVersion: CLEANER_VERSION,
    importDiagnostics: prepared.summary.chapterAlignment ? {
      referenceEntries: prepared.summary.chapterAlignment.referenceEntries,
      bodyCandidateCount: prepared.summary.chapterAlignment.bodyCandidateCount,
      rawExactMatches: prepared.summary.chapterAlignment.rawExactMatches,
      normalizedExactMatches: prepared.summary.chapterAlignment.normalizedExactMatches,
      bodyPrefixMatches: prepared.summary.chapterAlignment.bodyPrefixMatches,
      referencePrefixMatches: prepared.summary.chapterAlignment.referencePrefixMatches,
      fuzzyMatches: prepared.summary.chapterAlignment.fuzzyMatches,
      unresolvedReferences: prepared.summary.chapterAlignment.unresolvedReferences,
      bodyOnlyEntries: prepared.summary.chapterAlignment.bodyOnlyEntries,
      finalEntries: prepared.summary.chapterAlignment.finalEntries,
      chapterNumberResets: prepared.summary.chapterAlignment.chapterNumberResets,
      alignmentMs: prepared.summary.chapterAlignment.alignmentMs,
    } : undefined,
  }
  const initialProgress: ReadingProgress = {
    bookId,
    chapterId: firstChapter.id,
    paragraphIndex: 0,
    characterOffset: 0,
    chapterProgress: 0,
    globalProgress: 0,
    updatedAt: timestamp,
  }

  onStage('saving')
  if (overwrite) {
    await repository.replaceBook(bookId, book, chapters, initialProgress)
  } else {
    await repository.addBook(book, chapters, initialProgress)
  }
  onStage('complete')
  return book
}
