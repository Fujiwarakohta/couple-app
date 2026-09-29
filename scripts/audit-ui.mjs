// 全画面をライト／ダークの両方で開き、次を確認する。
//   - axe-core によるアクセシビリティ検査（コントラスト比 4.5:1、ラベル、aria など）
//   - タップ領域が 44px 以上か
//   - 横方向のはみ出しが無いか（375px 幅）
// 使い方:
//   1. npm run dev:demo -- --port 5183   （別の端末で起動しておく）
//   2. node scripts/audit-ui.mjs
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import puppeteer from 'puppeteer-core'

const require = createRequire(import.meta.url)
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

const BASE = process.env.SHOT_BASE_URL ?? 'http://localhost:5183'
const MIN_TAP = 44
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

async function clickBy(page, text, selector = 'button') {
  const handles = await page.$$(selector)
  for (const h of handles) {
    const label = await h.evaluate((el) => `${el.getAttribute('aria-label') ?? ''}|${el.textContent}`)
    if (label.includes(text)) {
      await h.evaluate((el) => el.scrollIntoView({ block: 'center' }))
      await h.click()
      await wait(300)
      return
    }
  }
  throw new Error(`「${text}」が見つかりません`)
}

/** 画面ごとの準備（シートを開くなど）。 */
const views = [
  { name: 'ホーム', path: '/' },
  { name: 'タスク', path: '/tasks', prepare: (p) => p.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true))) },
  { name: 'タスク編集シート', path: '/tasks', prepare: (p) => clickBy(p, '34週頃まで受診）」を編集') },
  { name: 'タスク追加シート', path: '/tasks', prepare: (p) => clickBy(p, '追加') },
  { name: 'スケジュール（月）', path: '/schedule?month=2027-05-01', prepare: (p) => p.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true))) },
  { name: 'スケジュール（日のシート）', path: '/schedule?month=2027-05-01', prepare: (p) => clickBy(p, '2027-05-24（月） 予定') },
  { name: 'スケジュール（リスト）', path: '/schedule?mode=list' },
  { name: '予定の編集シート', path: '/schedule?mode=list', prepare: (p) => clickBy(p, '妊娠届・親子健康手帳交付・支援給付金(1回目)面談」を編集') },
  { name: '助言', path: '/advice' },
  { name: 'ホーム（母）', path: '/', as: 'mother' },
  { name: '記録（体重）', path: '/records' },
  { name: '記録（血圧）', path: '/records', prepare: (p) => clickBy(p, '血圧') },
  { name: '記録（胎動）', path: '/records', prepare: (p) => clickBy(p, '胎動') },
  { name: '償還払いファイル', path: '/records?tab=receipts', prepare: (p) => p.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true))) },
  { name: '領収書の追加シート', path: '/records?tab=receipts', prepare: (p) => clickBy(p, '領収書を追加') },
  { name: '設定', path: '/settings' },
]

/** デモ用のデータを入れて、グラフ・一覧・警告枠なども検査対象にする。 */
async function seedDemoData(page) {
  await page.goto(`${BASE}/?as=father`, { waitUntil: 'networkidle0' })
  // 初回投入が終わるまで待つ
  await page.waitForFunction(
    () => !!JSON.parse(localStorage.getItem('couple-app-demo-db') ?? '{}')['households/main/tasks/t173'],
    { timeout: 15000 },
  )
  await page.evaluate(() => {
    const key = 'couple-app-demo-db'
    const db = JSON.parse(localStorage.getItem(key) ?? '{}')
    const pad = (n) => String(n).padStart(2, '0')
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const soon = new Date()
    soon.setDate(soon.getDate() + 2)
    const today = ymd(new Date())
    const h = 'households/main'
    db[h].settings.prePregnancyWeightKg = 52
    db[h].settings.heightCm = 160
    db[h].settings.contacts.shonan = '000-000-0000'
    db[`${h}/tasks/t010`] = { ...db[`${h}/tasks/t010`], dueDate: ymd(soon) }
    db[`${h}/tasks/t001`] = { ...db[`${h}/tasks/t001`], status: 'done', lastAction: 'status', updatedBy: 'demo-mother', updatedAt: Date.now() - 60000 }
    db[`${h}/tasks/t003`] = { ...db[`${h}/tasks/t003`], status: 'na' }
    db[`${h}/events/u-demo`] = { title: '健診の予約', date: ymd(soon), window: 0, owner: '母', type: 'medical', critical: true, fatherAttend: true, place: '八重山病院', updatedAt: null, updatedBy: null }
    db[`${h}/presence/${today}`] = { father: 'ishigaki' }
    db[`${h}/presence/2027-05-20`] = { father: 'ishikawa' }
    db[`${h}/presence/2027-05-21`] = { father: 'kyoto' }
    db[`${h}/presence/2027-05-22`] = { father: 'other' }
    db[`${h}/records/w1`] = { kind: 'weight', date: today, value: 53.4, memo: '朝', updatedBy: 'demo-mother' }
    db[`${h}/records/b1`] = { kind: 'bp', date: today, value: { sys: 112, dia: 70 }, memo: '', updatedBy: 'demo-mother' }
    db[`${h}/records/m1`] = { kind: 'movement', date: today, value: 25, memo: '夜', updatedBy: 'demo-mother' }
    const receipt = { facility: '松南病院', hasReceipt: true, hasStatement: false, hasTicketFilled: false, epdsDone: false, requestLetterObtained: false, deadline: null, claimedAt: null, deleted: false, updatedBy: 'demo-mother' }
    db[`${h}/receipts/r1`] = { ...receipt, kind: 'ninpu', date: '2027-04-20', amountYen: 6000, ticketNo: '9-8' }
    db[`${h}/receipts/r2`] = { ...receipt, kind: 'hearing', date: '2027-05-27', amountYen: 5000, ticketNo: null }
    db[`${h}/receipts/r3`] = { ...receipt, kind: 'kodomo_iryo', date: today, amountYen: 1200, ticketNo: null }
    db[`${h}/adviceState/demo-father`] = { read: ['a01'], pinned: ['a06'] }
    localStorage.setItem(key, JSON.stringify(db))
  })
}

const browser = await puppeteer.launch({ executablePath, headless: true })
let problems = 0
let checkedTargets = 0

try {
  const setup = await browser.newPage()
  await seedDemoData(setup)
  await setup.close()

  for (const scheme of ['light', 'dark']) {
    for (const view of views) {
      const page = await browser.newPage()
      await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: scheme },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ])
      const sep = view.path.includes('?') ? '&' : '?'
      await page.goto(`${BASE}${view.path}${sep}as=${view.as ?? 'father'}`, { waitUntil: 'networkidle0' })
      const issues = []
      try {
        if (view.prepare) await view.prepare(page)
        await wait(200)

        // axe-core
        await page.evaluate(axeSource)
        const axe = await page.evaluate(() =>
          window.axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
          }),
        )
        for (const v of axe.violations) {
          issues.push(`axe ${v.id}（${v.impact}）: ${v.nodes.length}か所  例: ${v.nodes[0].target.join(' ')} ${v.nodes[0].failureSummary?.split('\n')[1]?.trim() ?? ''}`)
        }

        // タップ領域
        const small = await page.evaluate((min) => {
          const scope = document.querySelector('dialog[open]') ?? document
          const out = []
          let count = 0
          const els = scope.querySelectorAll('button, a[href], input, select, textarea, summary')
          for (const el of els) {
            if (scope === document && el.closest('dialog')) continue
            const style = getComputedStyle(el)
            if (style.display === 'none' || style.visibility === 'hidden') continue
            let rect = el.getBoundingClientRect()
            if (rect.width === 0 || rect.height === 0) continue
            // チェックボックスは、包んでいる label 全体がタップ領域
            if (el.matches('input[type="checkbox"], input[type="radio"]')) {
              const label = el.closest('label')
              if (label) rect = label.getBoundingClientRect()
            }
            count += 1
            if (rect.width < min - 0.5 || rect.height < min - 0.5) {
              out.push(`${el.tagName.toLowerCase()}「${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}」 ${Math.round(rect.width)}x${Math.round(rect.height)}`)
            }
          }
          return { out, count }
        }, MIN_TAP)
        checkedTargets += small.count
        for (const s of small.out) issues.push(`タップ領域が ${MIN_TAP}px 未満: ${s}`)

        // 横はみ出し
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        if (overflow > 0) issues.push(`横はみ出し ${overflow}px`)
      } catch (e) {
        issues.push(`確認できませんでした: ${e.message}`)
      }

      console.log(`${issues.length ? 'NG  ' : 'OK  '} [${scheme}] ${view.name}`)
      for (const i of issues) console.log(`       - ${i}`)
      problems += issues.length
      await page.close()
    }
  }
} finally {
  await browser.close()
}

console.log(`\n画面 ${views.length} × 配色 2 = ${views.length * 2} 通り、操作できる要素 のべ ${checkedTargets} 個を確認。問題 ${problems} 件。`)
process.exit(problems ? 1 : 0)
