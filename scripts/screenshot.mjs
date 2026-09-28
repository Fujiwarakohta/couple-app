// スマホ幅（375×812）で各画面のスクリーンショットを撮る。
// 使い方:
//   1. npm run dev:demo -- --port 5183   （別の端末で起動しておく）
//   2. node scripts/screenshot.mjs [シナリオ名 ...]
// 画像は screenshots/ に保存される。端末に入っている Chrome / Edge を使う（ダウンロードしない）。
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.env.SHOT_BASE_URL ?? 'http://localhost:5183'
const OUT = resolve('screenshots')
const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

const executablePath = CANDIDATES.find((p) => existsSync(p))
if (!executablePath) {
  console.error('Chrome / Edge が見つかりません。CHROME_PATH を指定してください。')
  process.exit(1)
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function clickText(page, selector, text) {
  const handles = await page.$$(selector)
  for (const h of handles) {
    const label = await h.evaluate((el) => (el.getAttribute('aria-label') ?? '') + '|' + el.textContent)
    if (label.includes(text)) {
      await h.evaluate((el) => el.scrollIntoView({ block: 'center' }))
      await h.click()
      await wait(250)
      return true
    }
  }
  throw new Error(`「${text}」が見つかりません（${selector}）`)
}

/** シナリオ：{ 名前: async (page, shot) => void }。shot(name, {full}) で保存する。 */
const scenarios = {
  home: async (page, shot) => {
    await page.goto(`${BASE}/?as=father`, { waitUntil: 'networkidle0' })
    await shot('home')
    await shot('home-full', { full: true })
  },
  'home-dark': async (page, shot) => {
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    await page.goto(`${BASE}/?as=father`, { waitUntil: 'networkidle0' })
    await shot('home-dark')
  },
  tasks: async (page, shot) => {
    await page.goto(`${BASE}/tasks?as=father`, { waitUntil: 'networkidle0' })
    await shot('tasks')
    await shot('tasks-full', { full: true })
    await clickText(page, 'button', '34週頃まで受診）」を編集')
    await shot('tasks-edit')
    await page.evaluate(() => document.querySelector('dialog[open] .overflow-y-auto')?.scrollTo(0, 600))
    await shot('tasks-edit-2')
  },
  schedule: async (page, shot) => {
    await page.goto(`${BASE}/schedule?as=father`, { waitUntil: 'networkidle0' })
    await shot('schedule-month')
    await clickText(page, 'button', 'リスト')
    await shot('schedule-list')
    await shot('schedule-list-full', { full: true })
  },
  'schedule-may': async (page, shot) => {
    await page.goto(`${BASE}/schedule?as=father&month=2027-05-01`, { waitUntil: 'networkidle0' })
    await shot('schedule-month-2027-05')
    await shot('schedule-month-2027-05-full', { full: true })
    await clickText(page, 'button', '2027-05-24')
    await shot('schedule-day')
  },
  advice: async (page, shot) => {
    await page.goto(`${BASE}/advice?as=father`, { waitUntil: 'networkidle0' })
    await shot('advice')
    await shot('advice-full', { full: true })
  },
  records: async (page, shot) => {
    await page.goto(`${BASE}/records?as=mother`, { waitUntil: 'networkidle0' })
    await shot('records')
    await shot('records-full', { full: true })
    await clickText(page, 'button', '償還払い')
    await shot('records-receipts')
    await shot('records-receipts-full', { full: true })
  },
  settings: async (page, shot) => {
    await page.goto(`${BASE}/settings?as=father`, { waitUntil: 'networkidle0' })
    await shot('settings')
    await shot('settings-full', { full: true })
  },
}

const names = process.argv.slice(2)
const targets = names.length ? names : Object.keys(scenarios)
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({ executablePath, headless: true })
let failed = false
try {
  for (const name of targets) {
    const run = scenarios[name]
    if (!run) {
      console.error(`未定義のシナリオ: ${name}`)
      failed = true
      continue
    }
    const page = await browser.newPage()
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    // 既定はライト表示で撮る（ダーク表示はシナリオ側で切り替える）
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    const shot = async (file, { full = false } = {}) => {
      const path = resolve(OUT, `${file}.png`)
      await page.screenshot({ path, fullPage: full })
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      console.log(`${file}.png  横はみ出し=${overflow}px`)
      if (overflow > 0) failed = true
    }
    try {
      await run(page, shot)
    } catch (e) {
      console.error(`[${name}] ${e.message}`)
      failed = true
    }
    if (errors.length) {
      console.error(`[${name}] コンソールエラー:\n  ${errors.join('\n  ')}`)
      failed = true
    }
    await page.close()
  }
} finally {
  await browser.close()
}
process.exit(failed ? 1 : 0)
