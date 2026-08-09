import {
  CLEANER_VERSION,
  type CleaningRuleCategory,
  type CleaningWarning,
} from './types'

export interface CleaningRuleOutput {
  text: string
  hits: number
}

export interface CleaningRule {
  id: string
  description: string
  category: CleaningRuleCategory
  enabledByDefault: boolean
  apply: (text: string) => CleaningRuleOutput
}

export interface CleanTextOptions {
  rules?: readonly CleaningRule[]
  disabledRuleIds?: ReadonlySet<string>
}

export interface CleanTextResult {
  text: string
  cleanerVersion: string
  appliedRuleIds: string[]
  ruleHits: Record<string, number>
  warnings: CleaningWarning[]
}

function replacePattern(
  text: string,
  pattern: RegExp,
  replacement: string | ((substring: string, ...args: string[]) => string),
): CleaningRuleOutput {
  let hits = 0
  const output = text.replace(pattern, (...args: [string, ...string[]]) => {
    hits += 1
    return typeof replacement === 'function' ? replacement(...args) : replacement
  })
  return { text: output, hits }
}

function removeMatchingLines(text: string, predicate: (line: string) => boolean): CleaningRuleOutput {
  let hits = 0
  const lines = text.split('\n').filter((line) => {
    if (!predicate(line.trim())) return true
    hits += 1
    return false
  })
  return { text: lines.join('\n'), hits }
}

function cleanAuthorMetaLines(
  text: string,
  matchesMeta: (line: string) => boolean,
): CleaningRuleOutput {
  let hits = 0
  const authorStart = /^\s*[（(【\[]?(?:p?s[：:]|第[一二三四五六七八九十\d]+更|更新|求|拜|恳请|月票|推荐票|周初|马上|诸位|兄弟|弟兄|大家|今天|今日|十号|距离\d|说句实在|中午|这个月|终于|新的一周|又是)/i
  const authorIdentity = /(?:土豆|作者|诸位|弟兄|兄弟|读者|码字|更新|票榜|投给斗破|开单章|新书)/
  const directTailMarker = /(?:p?s[：:]|更新(?:到|完毕)[～~!！。，,\s]*|(?:求|拜求|恳请|急求|继续求)[^。！？\n]{0,16}(?:月票|推荐票))/i

  const lines = text.split('\n').map((line) => {
    if (!matchesMeta(line)) return line
    const bracketIndexes = ['（', '(', '{', '\\{']
      .map((marker) => line.lastIndexOf(marker))
      .filter((index) => index > 0 && matchesMeta(line.slice(index)))
    const directMatch = directTailMarker.exec(line)
    const tailIndexes = [...bracketIndexes]
    if (directMatch && directMatch.index > 0) tailIndexes.push(directMatch.index)
    const tailIndex = tailIndexes.length > 0 ? Math.min(...tailIndexes) : -1

    if (tailIndex > 0) {
      const narrativePrefix = line.slice(0, tailIndex).trimEnd()
      if (narrativePrefix.length >= 10) {
        hits += 1
        return narrativePrefix
      }
    }
    if (authorStart.test(line) || authorIdentity.test(line)) {
      hits += 1
      return ''
    }
    return line
  })
  return { text: lines.join('\n'), hits }
}

const VOTE_META = /(?:推荐票|月票)/
const VOTE_ACTION = /(?:求|请|要票|拉一下|投|票榜|保底|拜|支持|首页|双倍|爆|码字|更新|订阅|收藏|土豆|读者|弟兄|兄弟|童鞋|票票|作者)/
const UPDATE_META = /(?:第[一二三四五六七八九十\d]+更|更新(?:到|完毕)|码字|今日.{0,8}[更章]|今天.{0,8}[更章])/i
const AUTHOR_AUDIENCE = /(?:土豆|作者|诸位|大家|弟兄|兄弟|读者|童鞋|朋友|收藏|推荐|月票|订阅|更新)/

export const READING_CLEANING_RULES: readonly CleaningRule[] = [
  {
    id: 'normalize-newlines',
    description: '统一 CRLF/CR 换行为 LF',
    category: 'NORMALIZATION',
    enabledByDefault: true,
    apply: (text) => replacePattern(text, /\r\n?|\u2028|\u2029/g, '\n'),
  },
  {
    id: 'remove-bom',
    description: '删除文件开头的 Unicode BOM',
    category: 'NORMALIZATION',
    enabledByDefault: true,
    apply: (text) => replacePattern(text, /^\uFEFF/, ''),
  },
  {
    id: 'trim-line-endings',
    description: '删除每行末尾多余空白',
    category: 'NORMALIZATION',
    enabledByDefault: true,
    apply: (text) => replacePattern(text, /[ \t]+$/gm, ''),
  },
  {
    id: 'remove-book-title-banner',
    description: '删除文件开头重复的书名横幅',
    category: 'STRUCTURAL_CLEANUP',
    enabledByDefault: true,
    apply: (text) => replacePattern(text, /^\s*[《〈]?斗破苍穹[》〉]?\s*\n+/, ''),
  },
  {
    id: 'remove-known-html-residues',
    description: '删除已确认的 dd/br/p/div/span 标签、损坏的行尾 /dd 与 nbsp',
    category: 'STRUCTURAL_CLEANUP',
    enabledByDefault: true,
    apply: (text) =>
      replacePattern(
        text,
        /<\/?(?:dd|br|p|div|span|html|body)(?:\s[^>\n]*)?\s*\/?>|&nbsp;|\/dd(?=\s*$)/gim,
        '',
      ),
  },
  {
    id: 'remove-wudongqiankun-promotion-lines',
    description: '整行删除已确认的《武动乾坤》新书宣传',
    category: 'KNOWN_NOISE',
    enabledByDefault: true,
    apply: (text) =>
      removeMatchingLines(
        text,
        (line) =>
          line.includes('武动乾坤') &&
          /(?:宣传|新书)/.test(line) &&
          /(?:收藏|推荐|发布|发出来|同步更新|支持)/.test(line),
      ),
  },
  {
    id: 'remove-new-book-promotion-lines',
    description: '整行删除具有新书、推荐/收藏动作的高置信宣传',
    category: 'KNOWN_NOISE',
    enabledByDefault: true,
    apply: (text) =>
      removeMatchingLines(
        text,
        (line) =>
          /(?:新书|推荐一本|书名[：:\[《])/.test(line) &&
          /(?:宣传|推荐|收藏|发布|上传|支持|点击|书名)/.test(line) &&
          /(?:作者|土豆|朋友|大家|诸位|读者|新书|书名)/.test(line),
      ),
  },
  {
    id: 'remove-vote-request-lines',
    description: '整行删除同时包含票类词和明确拉票动作的作者附言',
    category: 'READING_CLEANUP',
    enabledByDefault: true,
    apply: (text) =>
      cleanAuthorMetaLines(text, (line) => VOTE_META.test(line) && VOTE_ACTION.test(line)),
  },
  {
    id: 'remove-update-notice-lines',
    description: '整行删除同时具有更新/码字模板和作者受众特征的连载通知',
    category: 'READING_CLEANUP',
    enabledByDefault: true,
    apply: (text) =>
      cleanAuthorMetaLines(text, (line) => UPDATE_META.test(line) && AUTHOR_AUDIENCE.test(line)),
  },
  {
    id: 'remove-zhuaji-site-markers',
    description: '删除真实文件中反复粘连的 m.zhuaji.org 手机端阅读水印',
    category: 'KNOWN_NOISE',
    enabledByDefault: true,
    apply: (text) =>
      replacePattern(text, /手机端阅读请登陆\s*m\.zhuaji\.org[\\/]*/gi, ''),
  },
  {
    id: 'remove-fast-update-markers',
    description: '删除已确认的“中文书库最快更新”固定水印',
    category: 'KNOWN_NOISE',
    enabledByDefault: true,
    apply: (text) => replacePattern(text, /中文书库最快更新/g, ''),
  },
  {
    id: 'remove-author-postscript-lines',
    description: '删除以 ps 或“如欲知后事如何”开头且明确谈及协议、番外、订阅、更新的作者附言',
    category: 'READING_CLEANUP',
    enabledByDefault: true,
    apply: (text) =>
      cleanAuthorMetaLines(text, (line) =>
        /(?:^\s*p?s[：:].*(?:番外|协议|订阅|更新|新书)|^\s*[（(]?\s*[，,]?如欲知后事如何.*(?:协议|订阅|更新|起点))/i.test(
          line,
        ),
      ),
  },
  {
    id: 'remove-site-boilerplate',
    description: '删除支持正版、章节更多等固定小说站模板',
    category: 'KNOWN_NOISE',
    enabledByDefault: true,
    apply: (text) =>
      replacePattern(
        text,
        /[，,；;\s]*(?:(?:如欲[知中]后事如何[，,]?)?请登陆[^，。！？\n]{0,40}[，,]?)?章节更多[”，,]支持作者[”，,]支持正版阅读[！!]?/g,
        '',
      ),
  },
  {
    id: 'remove-mobile-reading-markers',
    description: '删除已确认的 16k/手机阅读/下载 TXT 行内站点标记',
    category: 'KNOWN_NOISE',
    enabledByDefault: true,
    apply: (text) =>
      replacePattern(
        text,
        /[（(]?(?:下载txt格式小说[，,])?手机用户登陆[）)]?|[（(]?手机(?:快速|轻松)?阅读[：:]?(?:文字版首发|[\wαΑ|.○〇cC/\\-]{1,36}(?:整理)?)[）)]?|…手机轻松阅读[：:][^\s，。！？\n]{1,40}整理/gi,
        '',
      ),
  },
  {
    id: 'remove-isolated-site-character',
    description: '删除终止标点后孤立在行尾的“网”字站点残留',
    category: 'KNOWN_NOISE',
    enabledByDefault: true,
    apply: (text) =>
      replacePattern(text, /([。！？!?])网(?=\s*$)/gm, (_match, punctuation) => punctuation),
  },
  {
    id: 'remove-serialization-markers',
    description: '删除独立或句尾的“未完待续”固定连载标记',
    category: 'READING_CLEANUP',
    enabledByDefault: true,
    apply: (text) =>
      replacePattern(text, /\s*[（(《]?未完待续[）》)]?/g, ''),
  },
  {
    id: 'remove-wudongqiankun-suffix',
    description: '删除真实文件中反复附着在自然段行尾的“武动乾坤”污染词',
    category: 'KNOWN_NOISE',
    enabledByDefault: true,
    apply: (text) => replacePattern(text, /武动乾坤(?=[。！？!?]*\s*$)/gm, ''),
  },
  {
    id: 'remove-empty-delimiter-artifacts',
    description: '删除清洗直接产生的空书名号或空括号',
    category: 'PARAGRAPH_NORMALIZATION',
    enabledByDefault: true,
    apply: (text) => replacePattern(text, /《\s*》|〈\s*〉|[（(]\s*[）)]/g, ''),
  },
  {
    id: 'normalize-blank-lines',
    description: '将三个以上连续换行规范为两个',
    category: 'PARAGRAPH_NORMALIZATION',
    enabledByDefault: true,
    apply: (text) => replacePattern(text, /\n{3,}/g, '\n\n'),
  },
]

// Backwards-compatible export name used by stage 1 callers/tests.
export const BASIC_CLEANING_RULES = READING_CLEANING_RULES

const POSSIBLE_READING_NOISE = /推荐票|月票|求.{0,4}(?:收藏|订阅|点击)|最快更新|手机.{0,6}阅读|手机用户|https?:\/\/|www\.|支持正版阅读|新书.{0,16}(?:发布|上传|推荐|收藏)/i
const PUNCTUATION_ONLY_LINE = /^[，。！？、；：~～…·“”‘’（）()《》〈〉\-—\s]+$/

function collectWarnings(text: string): CleaningWarning[] {
  const possibleNoiseLines: number[] = []
  const punctuationOnlyLines: number[] = []
  text.split('\n').forEach((line, index) => {
    const trimmed = line.trim()
    if (POSSIBLE_READING_NOISE.test(trimmed)) possibleNoiseLines.push(index + 1)
    if (trimmed && PUNCTUATION_ONLY_LINE.test(trimmed)) punctuationOnlyLines.push(index + 1)
  })
  const warnings: CleaningWarning[] = []
  if (possibleNoiseLines.length > 0) {
    warnings.push({
      code: 'POSSIBLE_READING_NOISE_RETAINED',
      message: `保留了 ${possibleNoiseLines.length} 行无法高置信度判定的疑似连载噪音，请人工抽样。`,
      priority: 'warning',
      count: possibleNoiseLines.length,
      lineNumbers: possibleNoiseLines.slice(0, 100),
    })
  }
  if (punctuationOnlyLines.length > 0) {
    warnings.push({
      code: 'PUNCTUATION_ONLY_LINE_RETAINED',
      message: `保留了 ${punctuationOnlyLines.length} 行可能作为场景分隔符的纯标点。`,
      priority: 'warning',
      count: punctuationOnlyLines.length,
      lineNumbers: punctuationOnlyLines.slice(0, 100),
    })
  }
  return warnings
}

export function cleanText(input: string, options: CleanTextOptions = {}): CleanTextResult {
  const rules = options.rules ?? READING_CLEANING_RULES
  const enabledRules = rules.filter(
    (rule) => rule.enabledByDefault && !options.disabledRuleIds?.has(rule.id),
  )
  const ruleHits: Record<string, number> = {}
  let text = input
  for (const rule of enabledRules) {
    const output = rule.apply(text)
    text = output.text
    ruleHits[rule.id] = output.hits
  }
  text = text.trim()
  return {
    text,
    cleanerVersion: CLEANER_VERSION,
    appliedRuleIds: enabledRules.map((rule) => rule.id),
    ruleHits,
    warnings: collectWarnings(text),
  }
}
