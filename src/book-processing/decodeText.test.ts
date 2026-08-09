import { describe, expect, it } from 'vitest'
import { decodeText, TextDecodingError } from './decodeText'

function utf8Buffer(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer as ArrayBuffer
}

describe('decodeText', () => {
  it('decodes valid UTF-8 text strictly', () => {
    expect(decodeText(utf8Buffer('第一章 测试\n这是一段正文。'))).toEqual({
      text: '第一章 测试\n这是一段正文。',
      encoding: 'utf-8',
    })
  })

  it('falls back to GB18030 for legacy Chinese bytes', () => {
    // “中文小说”的 GBK bytes；GBK is a compatible subset of GB18030.
    const bytes = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4, 0xd0, 0xa1, 0xcb, 0xb5])
    expect(decodeText(bytes.buffer)).toEqual({ text: '中文小说', encoding: 'gb18030' })
  })

  it('rejects decoded text containing null bytes', () => {
    expect(() => decodeText(new Uint8Array([0, 0, 0, 0]).buffer)).toThrow(TextDecodingError)
  })
})
