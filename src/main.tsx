import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './ui/App'
import './ui/styles.css'

const cachedTheme = window.localStorage.getItem('doupo-reader-theme')
if (cachedTheme && ['paper', 'light', 'eyeCare', 'dark'].includes(cachedTheme)) {
  document.documentElement.dataset.readerTheme = cachedTheme
}

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
