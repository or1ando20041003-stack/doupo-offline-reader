import { describe, expect, it } from 'vitest'
import { cleanText } from './cleanText'

describe('cleanText', () => {
  it('applies only safe baseline cleanup rules', () => {
    const input = '\uFEFF<p>第一章 测试</p>\r\n\r\n\r\n正文尾部   \r下一段'
    const result = cleanText(input)
    expect(result.text).toBe('第一章 测试\n\n正文尾部\n下一段')
    expect(result.appliedRuleIds).toContain('normalize-newlines')
    expect(result.cleanerVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('does not guess at novel-specific advertising text', () => {
    expect(cleanText('他在故事里提到“求票文本”这个词。').text).toBe('他在故事里提到“求票文本”这个词。')
  })

  it('removes the measured 武动乾坤 paragraph suffix without damaging punctuation', () => {
    expect(cleanText('一段人工剧情武动乾坤。\n另一段人工剧情。武动乾坤', { profile: 'doupoLegacy' }).text).toBe(
      '一段人工剧情。\n另一段人工剧情。',
    )
  })

  it('removes a whole new-book promotion instead of leaving empty delimiters', () => {
    const result = cleanText('人工正文。\n宣传一下新书《武动乾坤》，请大家收藏推荐。\n下一段。', { profile: 'doupoLegacy' })
    expect(result.text).toBe('人工正文。\n下一段。')
    expect(result.text).not.toContain('《》')
    expect(result.ruleHits['remove-wudongqiankun-promotion-lines']).toBe(1)
  })

  it('removes confirmed HTML dd residues and damaged suffixes', () => {
    expect(cleanText('<dd>人工正文。</dd>\n下一段。/dd').text).toBe('人工正文。\n下一段。')
  })

  it('removes high-confidence vote requests but preserves ordinary story lines', () => {
    const result = cleanText('人工剧情提到一张票。\n（求推荐票，请大家看完投一张，谢谢。）\n剧情继续。')
    expect(result.text).toBe('人工剧情提到一张票。\n\n剧情继续。')
    expect(result.ruleHits['remove-vote-request-lines']).toBe(1)
  })

  it('trims an attached vote-request tail without deleting the narrative prefix', () => {
    expect(cleanText('人工剧情在这里结束。（诸位看完后，请投几张推荐票吧。）').text).toBe(
      '人工剧情在这里结束。',
    )
    expect(cleanText('另一段人工编写的剧情到此结束。求月票，请大家支持。').text).toBe(
      '另一段人工编写的剧情到此结束。',
    )
  })

  it('removes a serialization marker while retaining the story sentence', () => {
    expect(cleanText('门在身后关上。（未完待续）').text).toBe('门在身后关上。')
  })

  it('does not delete similar normal words or collapse normal Chinese punctuation', () => {
    const input = '他参悟武道乾坤，问道：“真的？”众人答：“是！”'
    expect(cleanText(input).text).toBe(input)
  })

  it('removes an inline site watermark while preserving adjacent story text', () => {
    expect(cleanText('手机端阅读请登陆m.zhuaji.org人工剧情继续。', { profile: 'doupoLegacy' }).text).toBe('人工剧情继续。')
  })

  it('removes confirmed chapter-more/support-author boilerplate variants', () => {
    expect(cleanText('人工剧情。章节更多”支持作者”支持正版阅读！').text).toBe('人工剧情。')
  })

  it('removes bounded author postscript and malformed empty delimiters', () => {
    expect(cleanText('剧情结尾。\nps：因为协议，番外会继续更新。').text).toBe('剧情结尾。')
    expect(cleanText('雷声落下。（)').text).toBe('雷声落下。')
  })

  it('removes only an isolated site character after terminal punctuation', () => {
    expect(cleanText('人工结局。网').text).toBe('人工结局。')
    expect(cleanText('他撒下一张网。').text).toBe('他撒下一张网。')
  })

  it('allows an individual rule to be disabled for diagnostics', () => {
    const result = cleanText('人工剧情武动乾坤。', {
      profile: 'doupoLegacy',
      disabledRuleIds: new Set(['remove-wudongqiankun-suffix']),
    })
    expect(result.text).toContain('武动乾坤')
    expect(result.appliedRuleIds).not.toContain('remove-wudongqiankun-suffix')
  })

  it('does not run Doupo-specific rules for a generic book', () => {
    const input = '人物在正文中讨论武动乾坤。'
    const result = cleanText(input)
    expect(result.text).toBe(input)
    expect(result.appliedRuleIds).not.toContain('remove-wudongqiankun-suffix')
    expect(result.appliedRuleIds).not.toContain('remove-book-title-banner')
  })
})
