// ログイン（Google へ移動して戻る方式）の動作確認。
// Google や Firebase への通信は遮断し、アプリ側の動きだけを確認する。
// 使い方:
//   1. VITE_GOOGLE_CLIENT_ID などを設定して npm run build → npm run preview -- --port 4173
//   2. node scripts/check-login.mjs
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
const b64url = (text) => Buffer.from(text, 'utf8').toString('base64url')
const fakeJwt = (payload) => `${b64url('{"alg":"RS256"}')}.${b64url(JSON.stringify(payload))}.signature`

const browser = await puppeteer.launch({ executablePath, headless: true })

async function newPage() {
  const page = await browser.newPage()
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const external = []
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = req.url()
    if (url.startsWith(new URL(URL_).origin)) {
      void req.continue()
    } else {
      // 外部（Google・Firebase）には実際には接続しない
      external.push(url)
      void req.abort()
    }
  })
  return { page, external }
}

try {
  // ---- 1. ログインボタン → Google へ移動 ----
  {
    const { page, external } = await newPage()
    await page.goto(URL_, { waitUntil: 'networkidle0' })
    const beforeClick = external.filter((u) => u.includes('gapi') || u.includes('/__/auth/')).length
    check('起動時に Firebase の中継ページ（iframe）を読み込まない', beforeClick === 0, `${beforeClick}件`)

    const buttons = await page.$$('button')
    let clicked = false
    for (const b of buttons) {
      if ((await b.evaluate((el) => el.textContent)).includes('Google でログイン')) {
        await b.click()
        clicked = true
        break
      }
    }
    check('「Google でログイン」ボタンがある', clicked)
    await wait(1500)

    const target = external.find((u) => u.startsWith('https://accounts.google.com/o/oauth2/v2/auth'))
    check('Google のログイン画面へ直接移動する', !!target)
    const viaHandler = external.some((u) => u.includes('/__/auth/handler'))
    check('Firebase の中継ページ（/__/auth/handler）を通らない', !viaHandler)

    if (target) {
      const q = new URL(target).searchParams
      check('response_type=id_token', q.get('response_type') === 'id_token')
      check('戻り先がアプリの入口の URL', q.get('redirect_uri') === URL_, q.get('redirect_uri'))
      check('state と nonce が付いている', (q.get('state') ?? '').length >= 32 && (q.get('nonce') ?? '').length >= 32)
    }
    await page.close()
  }

  // ---- 2. 戻ってきたとき（正しい state・nonce）----
  {
    const { page, external } = await newPage()
    await page.goto(URL_, { waitUntil: 'networkidle0' })
    const pending = { state: 's'.repeat(48), nonce: 'n'.repeat(48), createdAt: Date.now() }
    await page.evaluate((p) => localStorage.setItem('couple-app-oauth', JSON.stringify(p)), pending)
    const token = fakeJwt({ nonce: pending.nonce, email: 'test@example.com' })
    await page.goto('about:blank')
    await page.goto(`${URL_}#id_token=${token}&state=${pending.state}`, { waitUntil: 'networkidle0' })
    await wait(1500)

    const hash = await page.evaluate(() => location.hash)
    check('ID トークンを URL から消す', hash === '', hash.slice(0, 30))
    const left = await page.evaluate(() => localStorage.getItem('couple-app-oauth'))
    check('開始時の情報を使い終わったら消す', left === null)
    const sent = external.some((u) => u.includes('identitytoolkit.googleapis.com') && u.includes('signInWithIdp'))
    check('受け取ったトークンを Firebase に渡してログインを試みる', sent)
    await page.close()
  }

  // ---- 3. 別タブで戻ってきても読める（localStorage を使う）----
  {
    const { page } = await newPage()
    await page.goto(URL_, { waitUntil: 'networkidle0' })
    const pending = { state: 'a'.repeat(48), nonce: 'b'.repeat(48), createdAt: Date.now() }
    await page.evaluate((p) => localStorage.setItem('couple-app-oauth', JSON.stringify(p)), pending)
    await page.close()

    const second = await newPage()
    const token = fakeJwt({ nonce: pending.nonce })
    await second.page.goto(`${URL_}#id_token=${token}&state=${pending.state}`, { waitUntil: 'networkidle0' })
    await wait(1500)
    const sent = second.external.some((u) => u.includes('signInWithIdp'))
    check('開始したタブと別のタブで戻ってきても、ログインを続けられる', sent)
    await second.page.close()
  }

  // ---- 4. state が違う（他人が作ったリンクなど）----
  {
    const { page, external } = await newPage()
    await page.goto(URL_, { waitUntil: 'networkidle0' })
    await page.evaluate(() => localStorage.removeItem('couple-app-oauth'))
    const token = fakeJwt({ nonce: 'x' })
    await page.goto('about:blank')
    await page.goto(`${URL_}#id_token=${token}&state=forged`, { waitUntil: 'networkidle0' })
    await wait(1500)
    const sent = external.some((u) => u.includes('signInWithIdp'))
    check('state が一致しないトークンは Firebase に渡さない', !sent)
    const body = await page.evaluate(() => document.body.innerText)
    check('失敗の理由を表示する', body.includes('ログインの確認に失敗しました'))
    check('ログイン画面に戻る', body.includes('Google でログイン'))
    const hash = await page.evaluate(() => location.hash)
    check('この場合も URL からトークンを消す', hash === '')
    await page.close()
  }

  // ---- 5. キャンセル ----
  {
    const { page } = await newPage()
    await page.goto(URL_, { waitUntil: 'networkidle0' })
    await page.goto('about:blank')
    await page.goto(`${URL_}#error=access_denied&state=abc`, { waitUntil: 'networkidle0' })
    await wait(1200)
    const body = await page.evaluate(() => document.body.innerText)
    check('キャンセルしたときは「中断されました」と表示する', body.includes('ログインが中断されました'))
    await page.close()
  }
} catch (e) {
  check(`途中で停止：${e.message}`, false)
}

await browser.close()
const ng = results.filter((r) => !r).length
console.log(`\n${results.length - ng} / ${results.length} 件 OK`)
process.exit(ng ? 1 : 0)
