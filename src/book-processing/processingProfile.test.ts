import { describe, expect, it } from 'vitest'
import { selectProcessingProfile } from './processingProfile'

describe('selectProcessingProfile', () => {
  it('uses the legacy profile only for an explicitly named Doupo source', () => {
    expect(selectProcessingProfile('斗破苍穹.txt')).toBe('doupoLegacy')
    expect(selectProcessingProfile('斗破苍穹 全本.TXT')).toBe('doupoLegacy')
    expect(selectProcessingProfile('覆汉.txt')).toBe('generic')
    expect(selectProcessingProfile('明朝那些事儿.txt')).toBe('generic')
  })
})
