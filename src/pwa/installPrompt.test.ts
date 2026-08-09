import { describe, expect, it } from 'vitest'
import { getInstallHelpMode, isStandaloneDisplay } from './installPrompt'

describe('PWA install help state', () => {
  it('detects CSS display-mode standalone', () => {
    expect(isStandaloneDisplay(true, false)).toBe(true)
  })

  it('detects navigator standalone mode', () => {
    expect(isStandaloneDisplay(false, true)).toBe(true)
  })

  it('stays visible in an ordinary browser tab', () => {
    expect(isStandaloneDisplay(false, false)).toBe(false)
  })

  it('uses the native install prompt when available', () => {
    expect(getInstallHelpMode({ standalone: false, installed: false, hasPrompt: true })).toBe('prompt')
  })

  it('shows manual Android Chrome instructions when no prompt is exposed', () => {
    expect(getInstallHelpMode({ standalone: false, installed: false, hasPrompt: false })).toBe('manual')
  })

  it('hides after installation or in standalone mode', () => {
    expect(getInstallHelpMode({ standalone: false, installed: true, hasPrompt: true })).toBe('hidden')
    expect(getInstallHelpMode({ standalone: true, installed: false, hasPrompt: true })).toBe('hidden')
  })
})
