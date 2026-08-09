import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { deploymentAssetPath, normalizeDeploymentBase } from './src/deployment/basePath'

const basePath = normalizeDeploymentBase(process.env.VITE_BASE_PATH)

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeManifestIcons: false,
      scope: basePath,
      manifest: {
        name: '斗破苍穹 Offline Reader',
        short_name: '离线阅读器',
        description: '完全在设备本地导入与保存中文 TXT 小说的离线阅读器',
        lang: 'zh-CN',
        id: basePath,
        start_url: basePath,
        scope: basePath,
        display: 'standalone',
        orientation: 'any',
        background_color: '#f5efe2',
        theme_color: '#6f3427',
        icons: [
          { src: deploymentAssetPath(basePath, 'icon-192.png'), sizes: '192x192', type: 'image/png' },
          { src: deploymentAssetPath(basePath, 'icon-512.png'), sizes: '512x512', type: 'image/png' },
          { src: deploymentAssetPath(basePath, 'maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallback: deploymentAssetPath(basePath, 'index.html'),
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ]
})
