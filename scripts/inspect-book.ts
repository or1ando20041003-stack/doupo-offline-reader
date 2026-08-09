import 'fake-indexeddb/auto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { inspectBookText } from '../src/book-processing/analyzeBook'
import { cleanText } from '../src/book-processing/cleanText'
import { decodeText } from '../src/book-processing/decodeText'
import { parseChapters } from '../src/book-processing/parseChapters'
import { CLEANER_VERSION, PARSER_VERSION, type ParsedChapter } from '../src/book-processing/types'
import { ReaderDatabase } from '../src/db/readerDatabase'
import { ReaderRepository } from '../src/db/repositories'
import type { Book, Chapter } from '../src/domain/models'

function exactArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length
}

function selectQaSamples(chapters: readonly ParsedChapter[]) {
  const main = chapters.filter((chapter) => chapter.section === 'main')
  const extra = chapters.filter((chapter) => chapter.section === 'extra')
  const requested = [
    { label: '第一章', chapter: main.find((chapter) => chapter.chapterNumber === 1) },
    { label: '第二章', chapter: main.find((chapter) => chapter.chapterNumber === 2) },
    { label: '约第100章', chapter: main.find((chapter) => chapter.chapterNumber === 100) },
    { label: '约第500章', chapter: main.find((chapter) => chapter.chapterNumber === 500) },
    { label: '约第1000章', chapter: main.find((chapter) => chapter.chapterNumber === 1000) },
    { label: '第1600章附近', chapter: main.find((chapter) => chapter.chapterNumber === 1600) },
    { label: '第1624章大结局', chapter: main.find((chapter) => chapter.chapterNumber === 1624) },
    { label: '第一个 extra', chapter: extra[0] },
    { label: 'extra 中部', chapter: extra[Math.floor(extra.length / 2)] },
    { label: '最后一个章节', chapter: chapters[chapters.length - 1] },
  ]

  return requested.map(({ label, chapter }) => {
    if (!chapter) return { label, status: 'warning', issueTypes: ['CHAPTER_NOT_FOUND'] }
    const joined = chapter.paragraphs.join('\n')
    const issueTypes: string[] = []
    if (chapter.paragraphs.length === 0) issueTypes.push('EMPTY_CHAPTER')
    if (joined.includes('武动乾坤')) issueTypes.push('WUDONG_RESIDUE')
    if (/<\/?[A-Za-z]|&nbsp;|\/dd\s*$/im.test(joined)) issueTypes.push('HTML_RESIDUE')
    if (/推荐票|月票|手机.{0,6}阅读|支持正版阅读/.test(joined)) issueTypes.push('LIKELY_NOISE')
    return {
      label,
      order: chapter.order,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      section: chapter.section,
      paragraphCount: chapter.paragraphs.length,
      characterCount: chapter.characterCount,
      status: issueTypes.length === 0 ? 'pass' : 'warning',
      issueTypes,
    }
  })
}

const inputPath = process.argv[2]
const showSampleText = process.argv.includes('--show-samples')
if (!inputPath) {
  console.error('用法：npm run inspect:book -- "C:\\path\\to\\book.txt"')
  process.exitCode = 1
} else {
  const resolvedInput = resolve(inputPath)
  const totalStartedAt = performance.now()
  const bytes = await readFile(resolvedInput)

  const decodeStartedAt = performance.now()
  const decoded = decodeText(exactArrayBuffer(bytes))
  const decodeMs = performance.now() - decodeStartedAt

  const cleanStartedAt = performance.now()
  const cleaned = cleanText(decoded.text)
  const cleanMs = performance.now() - cleanStartedAt

  const parseStartedAt = performance.now()
  const parsed = parseChapters(cleaned.text)
  const parseMs = performance.now() - parseStartedAt

  const inspection = inspectBookText(
    decoded.text,
    {
      sourceFileName: basename(resolvedInput),
      fileSize: bytes.byteLength,
      encoding: decoded.encoding,
    },
    { cleaned, parsed },
  )

  const bookId = 'qa-current-book'
  const chapters: Chapter[] = parsed.chapters.map((chapter) => ({
    ...chapter,
    id: `${bookId}:${chapter.section}:${chapter.order}`,
    bookId,
  }))
  const mainCharacterCount = chapters
    .filter((chapter) => chapter.section === 'main')
    .reduce((sum, chapter) => sum + chapter.characterCount, 0)
  const extraCharacterCount = chapters
    .filter((chapter) => chapter.section === 'extra')
    .reduce((sum, chapter) => sum + chapter.characterCount, 0)
  const book: Book = {
    id: bookId,
    title: '斗破苍穹 QA',
    sourceFileName: basename(resolvedInput),
    sourceEncoding: decoded.encoding,
    importedAt: new Date().toISOString(),
    mainChapterCount: chapters.filter((chapter) => chapter.section === 'main').length,
    extraChapterCount: chapters.filter((chapter) => chapter.section === 'extra').length,
    totalCharacterCount: mainCharacterCount + extraCharacterCount,
    mainCharacterCount,
    extraCharacterCount,
    parserVersion: PARSER_VERSION,
    cleanerVersion: CLEANER_VERSION,
  }

  const database = new ReaderDatabase(`doupo-qa-${Date.now()}`)
  const repository = new ReaderRepository(database)
  const saveStartedAt = performance.now()
  await repository.replaceBookData(book, chapters)
  const saveMs = performance.now() - saveStartedAt
  const persistedChapterCount =
    (await repository.getChaptersBySection(bookId, 'main')).length +
    (await repository.getChaptersBySection(bookId, 'extra')).length
  await database.delete()

  const performanceReport = {
    decodeMs: round(decodeMs),
    cleanMs: round(cleanMs),
    parseMs: round(parseMs),
    saveMs: round(saveMs),
    totalMs: round(performance.now() - totalStartedAt),
  }
  const generatedAt = new Date().toISOString()
  const analysisOutput = {
    generatedAt,
    ...inspection,
    performance: performanceReport,
    privacy: '仅包含统计、章节标题和最多 120 字的异常行摘要，不包含完整小说正文。',
  }
  const qaOutput = {
    generatedAt,
    source: inspection.source,
    cleaning: {
      cleanerVersion: CLEANER_VERSION,
      ruleHits: cleaned.ruleHits,
      warnings: cleaned.warnings,
      beforeCounts: {
        wudongqiankun: inspection.raw.wudongqiankunOccurrences,
        htmlResidues: inspection.raw.htmlResidueOccurrences,
        likelyNoiseLines: inspection.raw.likelyNoiseLines,
      },
      afterCounts: {
        wudongqiankun: countMatches(cleaned.text, /武动乾坤/g),
        htmlResidues: inspection.cleaning.htmlResidueAfter,
        likelyNoiseLines: inspection.cleaning.likelyNoiseLinesAfter,
      },
    },
    chapters: {
      parserVersion: PARSER_VERSION,
      total: inspection.chapters.total,
      main: inspection.chapters.main,
      extra: inspection.chapters.extra,
      missingMainNumbers: inspection.chapters.missingMainNumbers,
      duplicateMainNumbers: inspection.chapters.duplicateMainNumbers,
      canonicalEndingDetected: inspection.chapters.canonicalEndingDetected,
      emptyChapters: inspection.chapters.emptyChapters,
      suspiciousShortChapters: inspection.chapters.suspiciousShortChapters,
      suspiciousLongChapters: inspection.chapters.suspiciousLongChapters,
      warnings: inspection.chapters.parserWarnings,
    },
    characters: {
      main: mainCharacterCount,
      extra: extraCharacterCount,
      total: book.totalCharacterCount,
      rule: '仅统计清洗后 paragraphs 中的 Unicode 字符，不计章节标题和结构空行。',
    },
    performance: performanceReport,
    persistence: {
      expectedChapterCount: chapters.length,
      persistedChapterCount,
      atomicReplacementVerified: persistedChapterCount === chapters.length,
      backend: 'fake-indexeddb（Node QA；浏览器导入使用同一 Dexie transaction）',
    },
    samples: selectQaSamples(parsed.chapters),
    privacy: '不含完整正文、首段或尾段文本；抽样只保存标题、计数和问题类型。',
  }

  const diagnosticsDirectory = resolve('.local-diagnostics')
  await mkdir(diagnosticsDirectory, { recursive: true })
  const analysisPath = resolve(diagnosticsDirectory, 'book-analysis.json')
  const qaPath = resolve(diagnosticsDirectory, 'doupo-qa-report.json')
  await Promise.all([
    writeFile(analysisPath, `${JSON.stringify(analysisOutput, null, 2)}\n`, 'utf8'),
    writeFile(qaPath, `${JSON.stringify(qaOutput, null, 2)}\n`, 'utf8'),
  ])

  console.log(
    JSON.stringify(
      {
        source: inspection.source,
        cleaning: qaOutput.cleaning,
        chapters: qaOutput.chapters,
        characters: qaOutput.characters,
        performance: performanceReport,
        persistence: qaOutput.persistence,
        sampleStatuses: qaOutput.samples.map((sample) => ({
          label: sample.label,
          status: sample.status,
          issueTypes: sample.issueTypes,
        })),
      },
      null,
      2,
    ),
  )
  console.log(`\n分析文件：${analysisPath}`)
  console.log(`QA 文件：${qaPath}`)
  if (showSampleText) {
    console.log('\n人工抽样短摘要（仅输出到终端，不写入诊断文件）：')
    for (const sample of qaOutput.samples) {
      const chapter =
        'order' in sample && typeof sample.order === 'number'
          ? parsed.chapters[sample.order]
          : undefined
      if (!chapter) {
        console.log(`- ${sample.label}: 未找到`)
        continue
      }
      const first = chapter.paragraphs[0]?.slice(0, 100) ?? ''
      const last = chapter.paragraphs.at(-1)?.slice(0, 100) ?? ''
      console.log(`- ${sample.label} | ${chapter.title} | 首段：${first} | 尾段：${last}`)
    }
  }
}
