import type { SourceEncoding } from '../domain/models'
import type { DecodeResult } from './types'

export class TextDecodingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'TextDecodingError'
  }
}

function decodeWith(buffer: ArrayBuffer, encoding: SourceEncoding): string {
  return new TextDecoder(encoding, { fatal: true }).decode(buffer)
}

function validateDecodedText(text: string): boolean {
  if (text.includes('\uFFFD') || text.includes('\u0000')) return false
  if (text.length === 0) return true

  let suspiciousControls = 0
  for (const character of text) {
    const code = character.charCodeAt(0)
    if (code < 32 && character !== '\n' && character !== '\r' && character !== '\t') {
      suspiciousControls += 1
    }
  }
  return suspiciousControls / text.length < 0.005
}

export function decodeText(buffer: ArrayBuffer): DecodeResult {
  try {
    const text = decodeWith(buffer, 'utf-8')
    if (validateDecodedText(text)) return { text, encoding: 'utf-8' }
  } catch {
    // Invalid UTF-8 is expected for legacy Chinese TXT files.
  }

  try {
    const text = decodeWith(buffer, 'gb18030')
    if (validateDecodedText(text)) return { text, encoding: 'gb18030' }
  } catch (error) {
    throw new TextDecodingError('无法使用 UTF-8 或 GB18030 解码此文件。', { cause: error })
  }

  throw new TextDecodingError('文件包含过多无效控制字符，已停止导入以避免保存乱码。')
}
