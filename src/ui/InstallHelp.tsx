import { useEffect, useState } from 'react'
import { getInstallHelpMode, isStandaloneDisplay } from '../pwa/installPrompt'

interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const navigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return isStandaloneDisplay(window.matchMedia('(display-mode: standalone)').matches, navigatorStandalone)
}

export function InstallHelp() {
  const [installPrompt, setInstallPrompt] = useState<DeferredInstallPrompt | null>(null)
  const [installed, setInstalled] = useState(false)
  const standalone = detectStandalone()
  const mode = getInstallHelpMode({ standalone, installed, hasPrompt: Boolean(installPrompt) })

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as DeferredInstallPrompt)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  if (mode === 'hidden') return null

  return (
    <aside className="install-help" aria-label="安装阅读器">
      {mode === 'prompt' && (
        <button
          type="button"
          className="install-button"
          onClick={() => {
            if (!installPrompt) return
            void (async () => {
              await installPrompt.prompt()
              const choice = await installPrompt.userChoice
              if (choice.outcome === 'accepted') setInstalled(true)
              setInstallPrompt(null)
            })()
          }}
        >
          安装到手机
        </button>
      )}
      <details>
        <summary>{mode === 'prompt' ? '安装说明' : '如何安装到手机'}</summary>
        <p>Android Chrome：打开右上角菜单，选择“安装应用”或“添加到主屏幕”。安装后仍在本机选择 TXT，小说不会上传。</p>
      </details>
    </aside>
  )
}
