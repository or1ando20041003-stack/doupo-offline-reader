const DIGITS: Readonly<Record<string, number>> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
}

const SMALL_UNITS: Readonly<Record<string, number>> = { 十: 10, 百: 100, 千: 1000 }

export function parseChapterNumber(value: string): number | null {
  const normalized = value.trim().replace(/佰/g, '百').replace(/[仟干]/g, '千')
  if (/^\d+$/.test(normalized)) {
    const result = Number(normalized)
    return Number.isSafeInteger(result) ? result : null
  }
  if (!/^[零〇一二两三四五六七八九十百千万]+$/.test(normalized)) return null

  if (!/[十百千万]/.test(normalized)) {
    return Number([...normalized].map((character) => DIGITS[character]).join(''))
  }

  let total = 0
  let section = 0
  let digit = 0
  for (const character of normalized) {
    const mappedDigit = DIGITS[character]
    if (mappedDigit !== undefined) {
      digit = mappedDigit
      continue
    }
    if (character === '万') {
      section = (section + digit) * 10_000
      total += section
      section = 0
      digit = 0
      continue
    }
    const unit = SMALL_UNITS[character]
    if (unit !== undefined) {
      section += (digit || 1) * unit
      digit = 0
    }
  }
  return total + section + digit
}
