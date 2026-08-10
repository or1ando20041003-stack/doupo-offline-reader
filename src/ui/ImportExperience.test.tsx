import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Book } from '../domain/models'
import type { PreparedBookImport } from '../services/importBook'
import { ImportConfirmation } from './ImportConfirmation'
import { ImportProgress } from './ImportProgress'
import { DeleteBookDialog } from './DeleteBookDialog'
import { ImportSetupDialog } from './ImportSetupDialog'

function preparedImport(duplicateBook?: Book): PreparedBookImport {
  return {
    fileName: '斗破苍穹完整版.TXT',
    fileSize: 12_345,
    suggestedTitle: '斗破苍穹',
    parsed: {
      encoding: 'utf-8',
      contentHash: 'sha256-test',
      chapters: [],
      totalCharacterCount: 12_345,
      warnings: [],
      cleaningWarnings: [],
      appliedCleaningRuleIds: [],
      cleaningRuleHits: {},
      canonicalEndingDetected: false,
      timings: { decodeMs: 1, cleanMs: 2, parseMs: 3, totalMs: 6 },
      mainCharacterCount: 12_345,
      extraCharacterCount: 0,
    },
    warnings: [],
    duplicateBook,
    summary: {
      encoding: 'utf-8',
      mainChapterCount: 1_500,
      extraChapterCount: 45,
      totalChapters: 1_545,
      totalCharacterCount: 12_345,
      warningCount: 0,
      timings: { decodeMs: 1, cleanMs: 2, parseMs: 3, totalMs: 6 },
    },
  }
}

describe('book import UI', () => {
  it('clearly distinguishes required body TXT from optional reference TXT', () => {
    const html = renderToStaticMarkup(
      <ImportSetupDialog onCancel={() => undefined} onStart={() => undefined} />,
    )
    expect(html).toContain('小说正文 TXT')
    expect(html).toContain('章节目录 TXT')
    expect(html).toContain('必选')
    expect(html).toContain('可选')
    expect(html).toContain('保持正文原有合并状态，不影响导入')
    expect(html).toContain('disabled=""')
  })

  it('shows a concise step-by-step import status', () => {
    const html = renderToStaticMarkup(
      <ImportProgress fileName="斗破苍穹.txt" stage="parsing" onDismiss={() => undefined} />,
    )
    expect(html).toContain('正在导入')
    expect(html).toContain('斗破苍穹.txt')
    expect(html).toContain('读取文件')
    expect(html).toContain('编码识别')
    expect(html).toContain('文本清洗')
    expect(html).toContain('章节解析')
    expect(html).toContain('保存数据')
  })

  it('shows editable metadata and waits for explicit confirmation', () => {
    const html = renderToStaticMarkup(
      <ImportConfirmation
        prepared={preparedImport()}
        saving={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    )
    expect(html).toContain('value="斗破苍穹"')
    expect(html).toContain('1,545')
    expect(html).toContain('1.2 万 字')
    expect(html).toContain('重新选择')
    expect(html).toContain('确认导入')
  })

  it('requires an explicit duplicate action and defaults to no overwrite', () => {
    const duplicate = {
      id: 'existing',
      title: '斗破苍穹',
      sourceFileName: '斗破苍穹.txt',
      sourceEncoding: 'utf-8',
      importedAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      totalChapters: 1_545,
      mainChapterCount: 1_545,
      extraChapterCount: 0,
      totalCharacterCount: 12_345,
      mainCharacterCount: 12_345,
      extraCharacterCount: 0,
      parserVersion: '2.0.0',
      cleanerVersion: '2.0.0',
    } satisfies Book
    const html = renderToStaticMarkup(
      <ImportConfirmation
        prepared={preparedImport(duplicate)}
        saving={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    )
    expect(html).toContain('书架中已存在《斗破苍穹》')
    expect(html).toContain('默认不会覆盖')
    expect(html).toContain('取消')
    expect(html).toContain('保留两本')
    expect(html).toContain('覆盖原书')
  })

  it('shows alignment statistics as non-blocking information', () => {
    const prepared = preparedImport()
    prepared.summary.chapterAlignment = {
      referenceSourceFileName: '斗破苍穹-目录.txt',
      referenceEncoding: 'utf-8',
      referenceChapterCount: 1_520,
      referenceUnrecognizedLines: 2,
      bodyCandidateCount: 1_478,
      originalChapterCount: 1_478,
      exactMatches: 1_400,
      highMatches: 40,
      fuzzyMatches: 24,
      unresolvedReferences: 56,
      bodyOnlyChapters: 14,
      finalChapterCount: 1_492,
      alignmentTimeMs: 31,
    }
    const html = renderToStaticMarkup(
      <ImportConfirmation prepared={prepared} saving={false} onCancel={() => undefined} onConfirm={() => undefined} />,
    )
    expect(html).toContain('章节目录辅助结果')
    expect(html).toContain('未找到目录章节')
    expect(html).toContain('56')
    expect(html).toContain('已保持与相邻正文合并，不影响导入')
    expect(html).toContain('确认导入')
  })

  it('shows the selected book details before deletion', () => {
    const book = {
      id: 'book-to-delete',
      title: '斗破苍穹',
      sourceFileName: '斗破苍穹.txt',
      sourceEncoding: 'gb18030',
      importedAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-08T00:00:00.000Z',
      lastReadAt: '2026-08-08T00:00:00.000Z',
      totalChapters: 1_545,
      mainChapterCount: 1_533,
      extraChapterCount: 12,
      totalCharacterCount: 5_134_036,
      mainCharacterCount: 5_104_646,
      extraCharacterCount: 29_390,
      parserVersion: '2.0.0',
      cleanerVersion: '2.0.0',
    } satisfies Book
    const html = renderToStaticMarkup(
      <DeleteBookDialog
        entry={{
          book,
          progress: {
            bookId: book.id,
            chapterId: `${book.id}:main:686`,
            paragraphIndex: 0,
            characterOffset: 0,
            chapterProgress: 0,
            globalProgress: 0.423,
            updatedAt: book.lastReadAt,
          },
          currentChapterTitle: '第六百八十七章',
        }}
        deleting={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    )
    expect(html).toContain('确定删除《斗破苍穹》')
    expect(html).toContain('1,545')
    expect(html).toContain('第六百八十七章')
    expect(html).toContain('42.3%')
    expect(html).toContain('不会删除手机中的 TXT 文件')
  })
})
