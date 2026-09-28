// ビルド済みのアプリ（npm run preview）に対して、PWA としてインストールできるか、
// オフラインで開けるかを確認する。
// 使い方:
//   1. npm run build（または npm run build:demo）→ npm run preview -- --port 4173
//   2. node scripts/check-pwa.mjs
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const URL_ = process.env.PWA_URL ?? 'http://localhost:4173/couple-app/'
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

const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'OK  ' : 'NG  '} ${name}${detail ? `  … ${detail}` : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath, headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

try {
  await page.goto(URL_, { waitUntil: 'networkidle0' })

  // manifest
  const manifestHref = await page.$eval('link[rel="manifest"]', (el) => el.href).catch(() => null)
  check('manifest へのリンクがある', !!manifestHref, manifestHref ?? '')
  const manifest = manifestHref ? await page.evaluate((u) => fetch(u).then((r) => r.json()), manifestHref) : null
  check('manifest：display が standalone', manifest?.display === 'standalone')
  check('manifest：name / short_name / start_url がある', !!manifest?.name && !!manifest?.short_name && !!manifest?.start_url)
  const sizes = (manifest?.icons ?? []).map((i) => i.sizes)
  check('manifest：アイコン 192 / 512 がある', sizes.includes('192x192') && sizes.includes('512x512'), sizes.join(', '))
  check('manifest：maskable アイコンがある', (manifest?.icons ?? []).some((i) => i.purpose === 'maskable'))
  for (const icon of manifest?.icons ?? []) {
    const url = new URL(icon.src, manifestHref).href
    const info = await page.evaluate(
      (u) =>
        new Promise((res) => {
          const img = new Image()
          img.onload = () => res(`${img.naturalWidth}x${img.naturalHeight}`)
          img.onerror = () => res('読み込み失敗')
          img.src = u
        }),
      url,
    )
    check(`アイコンの実寸が一致：${icon.src}`, info === icon.sizes, info)
  }

  // Service Worker
  await page.evaluate(() => navigator.serviceWorker.ready)
  await wait(1500)
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    return { active: !!reg?.active, scope: reg?.scope ?? '' }
  })
  check('Service Worker が有効', sw.active, sw.scope)

  // Chrome のインストール可否の判定
  const cdp = await page.createCDPSession()
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
  check(
    'Chrome の判定：インストール可能（エラー 0 件）',
    installabilityErrors.length === 0,
    installabilityErrors.map((e) => e.errorId).join(', '),
  )

  // オフラインで開けるか
  await page.reload({ waitUntil: 'networkidle0' })
  await page.setOfflineMode(true)
  let offlineOk = false
  let offlineText = ''
  try {
    await page.reload({ waitUntil: 'load' })
    await wait(1500)
    offlineText = await page.evaluate(() => document.body.innerText)
    offlineOk = offlineText.trim().length > 0 && !/ERR_INTERNET_DISCONNECTED/.test(offlineText)
  } catch (e) {
    offlineText = e.message
  }
  check('オフラインでもアプリが開く', offlineOk, offlineText.split('\n').filter(Boolean).slice(0, 3).join(' / '))

  for (const path of ['schedule', 'tasks', 'advice']) {
    let ok = false
    let head = ''
    try {
      await page.goto(`${URL_}${path}`, { waitUntil: 'load' })
      await wait(1200)
      head = await page.evaluate(() => document.querySelector('h1')?.textContent ?? '')
      ok = head.length > 0
    } catch (e) {
      head = e.message
    }
    check(`オフラインで /${path} が開く`, ok, head)
  }
  await page.setOfflineMode(false)
} catch (e) {
  check(`途中で停止：${e.message}`, false)
}

await browser.close()
const ng = results.filter((r) => !r).length
console.log(`\n${results.length - ng} / ${results.length} 件 OK`)
process.exit(ng ? 1 : 0)
