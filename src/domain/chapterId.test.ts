import { describe, expect, it } from 'vitest'
import { createChapterId } from './chapterId'

describe('createChapterId', () => {
  it('stays unique when main/extra chapter numbers repeat or reset', () => {
    const ids = [
      createChapterId('book', 'main', 0),
      createChapterId('book', 'extra', 0),
      createChapterId('book', 'extra', 1),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })
})
