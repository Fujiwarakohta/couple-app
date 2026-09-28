import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// GitHub Pages は https://<user>.github.io/<リポジトリ名>/ で配信される。
// リポジトリ名を変えた場合は VITE_BASE を変えるか、ここを書き換える。
const REPO_NAME = 'couple-app'

// GitHub Pages には SPA 用の書き換えが無いので、index.html を 404.html として複製する。
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const index = resolve(outDir, 'index.html')
      if (existsSync(index)) copyFileSync(index, resolve(outDir, '404.html'))
    },
  }
}

export default defineConfig(({ command, isPreview }) => {
  // 開発中（npm run dev）は /、ビルドとその確認（npm run preview）は /<リポジトリ名>/
  const base = process.env.VITE_BASE ?? (command === 'build' || isPreview ? `/${REPO_NAME}/` : '/')
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'ふたりノート（妊娠〜育児）',
          short_name: 'ふたりノート',
          description: '夫婦2人で共有する妊娠〜育児のタスク・予定・記録',
          lang: 'ja',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#ffffff',
          theme_color: '#171717',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
        },
      }),
      spaFallback(),
    ],
    build: {
      target: 'es2022',
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    },
  }
})
