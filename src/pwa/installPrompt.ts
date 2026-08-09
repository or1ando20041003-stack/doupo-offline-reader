export type InstallHelpMode = 'hidden' | 'prompt' | 'manual'

export function isStandaloneDisplay(displayModeStandalone: boolean, navigatorStandalone = false): boolean {
  return displayModeStandalone || navigatorStandalone
}

export function getInstallHelpMode(options: {
  standalone: boolean
  installed: boolean
  hasPrompt: boolean
}): InstallHelpMode {
  if (options.standalone || options.installed) return 'hidden'
  return options.hasPrompt ? 'prompt' : 'manual'
}
