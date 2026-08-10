export type ProcessingProfile = 'generic' | 'doupoLegacy'

export function selectProcessingProfile(sourceFileName: string): ProcessingProfile {
  const baseName = sourceFileName.replace(/\.txt$/iu, '').trim()
  return /^斗破苍穹(?:[\s._-]*(?:完整版|全本|全集))?$/u.test(baseName) ? 'doupoLegacy' : 'generic'
}
