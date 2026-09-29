// デモモードでの動作確認（Firebase には接続しない）。
// 使い方:
//   1. npm run dev:demo -- --port 5183   （別の端末で起動しておく）
//   2. node scripts/e2e-demo.mjs
// 端末に入っている Chrome / Edge を使う。
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
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'OK  ' : 'NG  '} ${name}${detail ? `  … ${detail}` : ''}`)
}

async function text(page) {
  return page.evaluate(() => document.body.innerText)
}

async function clickBy(page, text, { selector = 'button, a', nth = 0 } = {}) {
  const handles = await page.$$(selector)
  const hits = []
  for (const h of handles) {
    const label = await h.evaluate((el) => `${el.getAttribute('aria-label') ?? ''}|${el.textContent}`)
    const visible = await h.evaluate((el) => !!el.offsetParent || el.closest('dialog[open]') !== null)
    if (label.includes(text) && visible) hits.push(h)
  }
  if (!hits[nth]) throw new Error(`「${text}」が見つかりません`)
  await hits[nth].evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await hits[nth].click()
  await wait(200)
}

async function fill(page, selector, value) {
  await page.$eval(selector, (el) => el.scrollIntoView({ block: 'center' }))
  await page.click(selector, { clickCount: 3 })
  await page.keyboard.press('Backspace')
  await page.type(selector, value)
}

/** type=date の入力は、ネイティブの setter で値を入れて input イベントを出す。 */
async function setDate(page, selector, value) {
  await page.$eval(
    selector,
    (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    },
    value,
  )
  await wait(100)
}

mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({ executablePath, headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

try {
  // ---- 初回投入 ----
  await page.goto(`${BASE}/?as=father`, { waitUntil: 'networkidle0' })
  const counts = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('couple-app-demo-db') ?? '{}')
    const keys = Object.keys(db)
    return {
      tasks: keys.filter((k) => k.startsWith('households/main/tasks/')).length,
      events: keys.filter((k) => k.startsWith('households/main/events/')).length,
      edd: db['households/main']?.settings?.edd,
      lmp: db['households/main']?.settings?.lmp,
    }
  })
  check('初回投入：タスク173件', counts.tasks === 173, `${counts.tasks}件`)
  check('初回投入：イベント42件', counts.events === 42, `${counts.events}件`)
  check('初回投入：EDD / LMP は seed の値', counts.edd === '2027-05-24' && counts.lmp === '2026-08-17')

  await page.reload({ waitUntil: 'networkidle0' })
  const again = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('couple-app-demo-db') ?? '{}')
    return Object.keys(db).filter((k) => k.startsWith('households/main/tasks/')).length
  })
  check('再読み込みしても二重に投入されない', again === 173, `${again}件`)

  // ---- ホーム ----
  let body = await text(page)
  check('ホーム：週数を「○週○日」形式で表示', /\d+週\d日/.test(body) && !/\d+w\d+d/.test(body))
  check('ホーム：日付を「2027-05-24（月）」形式で表示', body.includes('2027-05-24（月）'))
  check('ホーム：免責の固定文を表示', body.includes('一般情報です。主治医の指示を優先してください。'))
  const adviceCount = await page.$$eval('article', (els) => els.length)
  check('ホーム：今週の助言は最大3件', adviceCount <= 3 && adviceCount > 0, `${adviceCount}件`)

  // ---- ホーム：タスクと助言を分けて表示 ----
  {
    const home = await page.evaluate(() => {
      const section = (id) => document.getElementById(id)?.closest('section')
      const now = section('now-title')
      const advice = section('advice-title')
      const order = [...document.querySelectorAll('main h2')].map((h) => h.id)
      return {
        order,
        nowRows: now ? now.querySelectorAll('li').length : -1,
        nowText: now?.innerText ?? '',
        nowHasAdviceCard: now ? now.querySelectorAll('article').length : -1,
        adviceHasTaskButton: advice
          ? [...advice.querySelectorAll('button')].some((b) => b.textContent.includes('完了'))
          : null,
        adviceChips: advice
          ? [...advice.querySelectorAll('article')].every((a) => a.textContent.startsWith('助言'))
          : null,
        taskButtonColor: now ? getComputedStyle(now.querySelector('li button')).backgroundColor : '',
        adviceButtonBorder: advice
          ? getComputedStyle(advice.querySelector('article button')).borderColor
          : '',
      }
    })
    check(
      'ホーム：見出しの順は「期限」→「いまやるタスク」→「今週の助言」→「相手の更新」',
      home.order.join(',') === 'urgent-title,now-title,advice-title,partner-title',
      home.order.join(','),
    )
    check('ホーム：「いまやるタスク」は最大5件', home.nowRows > 0 && home.nowRows <= 5, `${home.nowRows}件`)
    check('ホーム：タスクの欄に助言のカードが混ざらない', home.nowHasAdviceCard === 0)
    check('ホーム：助言の欄に「完了」ボタンが無い', home.adviceHasTaskButton === false)
    check('ホーム：助言のカードは先頭に「助言」のラベル', home.adviceChips === true)
    check(
      'ホーム：タスクのボタンと助言のボタンで色が違う',
      home.taskButtonColor !== '' && home.taskButtonColor !== home.adviceButtonBorder,
      `${home.taskButtonColor} / ${home.adviceButtonBorder}`,
    )
    check('ホーム：父には母だけの担当のタスクを出さない（自分の担当）', !home.nowText.includes('葉酸サプリ'))

    // タスクの本文から編集シートを開く
    const firstLink = await page.$('section a[href*="/tasks?edit="]')
    const href = await firstLink.evaluate((a) => a.getAttribute('href'))
    await firstLink.click()
    await page.waitForSelector('dialog[open]', { timeout: 5000 })
    const sheetTitle = await page.$eval('dialog[open] h2', (h) => h.textContent)
    check('ホーム：タスクの本文を押すと、そのタスクの編集シートが開く', sheetTitle === 'タスクを編集', href)
    await clickBy(page, '閉じる', { selector: 'dialog[open] button' })
    const url = await page.evaluate(() => location.search)
    check('編集シートを閉じると URL の ?edit= が消える', !url.includes('edit='), url)
    await page.goto(`${BASE}/?as=father`, { waitUntil: 'networkidle0' })
    body = await text(page)
  }

  // ---- 母がタスクを完了 → 父のホームに表示 ----
  await page.goto(`${BASE}/tasks?as=mother`, { waitUntil: 'networkidle0' })
  await clickBy(page, '心拍確認まで通院する（妊娠届は確認後）」を完了にする', { selector: 'button' })
  body = await text(page)
  check('タスク：完了にすると進捗が 1 / 173 になる', body.includes('1 / 173'))
  await page.goto(`${BASE}/?as=father`, { waitUntil: 'networkidle0' })
  body = await text(page)
  check('ホーム：相手の更新「妻がt001を完了にしました」', body.includes('妻がt001を完了にしました'))

  // ---- タスク：該当なしは分母から除外 ----
  await page.goto(`${BASE}/tasks?as=father`, { waitUntil: 'networkidle0' })
  await clickBy(page, '紹介状の作成時期を相談する」を編集', { selector: 'button' })
  await clickBy(page, '該当なし', { selector: 'dialog[open] button' })
  await clickBy(page, '保存', { selector: 'dialog[open] button' })
  body = await text(page)
  check('タスク：該当なしは分母から除外（1 / 172）', body.includes('1 / 172'))

  // ---- タスク：期限を設定 → ホームの「7日以内」に赤で表示 ----
  const soon = await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  })
  await clickBy(page, '葉酸サプリ（1日400μg）を開始または継続する」を編集', { selector: 'button' })
  await setDate(page, '#task-due', soon)
  await clickBy(page, '保存', { selector: 'dialog[open] button' })
  await page.goto(`${BASE}/?as=father`, { waitUntil: 'networkidle0' })
  body = await text(page)
  check('ホーム：期限3日後のタスクが「期限まで3日」で出る', body.includes('期限まで3日') && body.includes('葉酸サプリ'))
  const alertCount = await page.$$eval('[data-urgent]', (els) => els.length)
  check('ホーム：期限7日以内は警告（赤）の枠で表示', alertCount >= 1)
  await page.screenshot({ path: resolve(OUT, 'home-urgent.png') })

  // ---- 未確認の表示 ----
  await page.goto(`${BASE}/tasks?as=father`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)))
  const unconfirmed = await page.evaluate(() => {
    const out = {}
    for (const id of ['歯科健診の有無', '無痛分娩の追加費用', '離島患者等通院費助成', '受診月の翌月から2年以内', '助成上限3,500円']) {
      const row = [...document.querySelectorAll('li')].find((li) => li.textContent.includes(id))
      out[id] = !!row && row.textContent.includes('未確認')
    }
    return out
  })
  for (const [k, v] of Object.entries(unconfirmed)) check(`未確認バッジ：${k}`, v)

  // ---- 設定：EDD 変更で再計算 ----
  await page.goto(`${BASE}/settings?as=father`, { waitUntil: 'networkidle0' })
  await setDate(page, '#st-edd', '2027-05-31')
  await fill(page, '#st-weight', '52')
  await fill(page, '#st-height', '160')
  await fill(page, '#st-tel-shonan', '000-000-0000')
  await clickBy(page, '設定を保存', { selector: 'button' })
  await page.goto(`${BASE}/?as=father`, { waitUntil: 'networkidle0' })
  body = await text(page)
  check('EDD 変更：ホームの予定日が 2027-05-31（月）になる', body.includes('2027-05-31（月）'))
  check('EDD 変更：週数が再計算される（7日ぶん戻る）', /5週\d日/.test(body), body.match(/\d+週\d日/)?.[0])
  await page.goto(`${BASE}/schedule?as=father&mode=list`, { waitUntil: 'networkidle0' })
  await clickBy(page, '過ぎた予定も表示', { selector: 'label' })
  body = await text(page)
  check('EDD 変更：出産予定日のイベントが 2027-05-31 に動く', /2027-05-31（月）\s*\n?\s*出産予定日/.test(body))
  check('EDD 変更：出生届 期限が 2027-06-14 に動く', body.includes('2027-06-14（月）'))

  // 窓口の tel: リンク
  await page.goto(`${BASE}/settings?as=father`, { waitUntil: 'networkidle0' })
  const tels = await page.$$eval('a[href^="tel:"]', (els) => els.map((a) => a.getAttribute('href')))
  check('窓口：電話番号が tel: リンク', tels.includes('tel:0980880088') && tels.includes('tel:0762742155'), tels.join(', '))
  check('窓口：設定で入力した番号も tel: リンクになる', tels.includes('tel:0000000000'))

  // ---- 設定：出生日入力で産後表示に切替 ----
  await setDate(page, '#st-edd', '2027-05-24')
  await setDate(page, '#st-birth', '2026-09-20')
  await clickBy(page, '設定を保存', { selector: 'button' })
  await page.goto(`${BASE}/?as=father`, { waitUntil: 'networkidle0' })
  body = await text(page)
  check('出生日入力：ホームが「生後○日・月齢」に切り替わる', /生後/.test(body) && /月齢 0か月/.test(body))
  await page.goto(`${BASE}/settings?as=father`, { waitUntil: 'networkidle0' })
  await clickBy(page, '消す', { selector: 'button' })
  await clickBy(page, '設定を保存', { selector: 'button' })
  await page.goto(`${BASE}/?as=father`, { waitUntil: 'networkidle0' })
  body = await text(page)
  check('出生日を消すと妊娠週数の表示に戻る', /6週\d日/.test(body))

  // ---- 記録：体重とグラフ ----
  await page.goto(`${BASE}/records?as=mother`, { waitUntil: 'networkidle0' })
  await fill(page, '#weight-kg', '53.4')
  await clickBy(page, '体重を記録', { selector: 'button' })
  body = await text(page)
  check('記録：体重が一覧に出る（丸めない）', body.includes('53.4kg'))
  check('記録：増加の目安は seed(a06) の表記', body.includes('10〜13kg'))
  const chart = await page.$eval('svg[role="img"]', (el) => el.getAttribute('aria-label'))
  check('記録：グラフに目安と妊娠前体重を重ねる', chart.includes('10〜13kg') && chart.includes('52kg'), chart)
  await page.screenshot({ path: resolve(OUT, 'records-weight-chart.png') })

  // ---- 償還払い ----
  await page.goto(`${BASE}/records?tab=receipts&as=mother`, { waitUntil: 'networkidle0' })
  await clickBy(page, '領収書を追加', { selector: 'button' })
  await setDate(page, '#rc-date', '2027-04-20')
  await fill(page, '#rc-facility', '松南病院')
  await fill(page, '#rc-amount', '6000')
  await page.select('#rc-ticket', '9-8')
  await clickBy(page, '追加', { selector: 'dialog[open] button[type="submit"]' })
  await clickBy(page, '領収書を追加', { selector: 'button' })
  await setDate(page, '#rc-date', '2027-05-11')
  await fill(page, '#rc-amount', '4500')
  await page.select('#rc-ticket', '9-9')
  await clickBy(page, '追加', { selector: 'dialog[open] button[type="submit"]' })
  body = await text(page)
  check('償還払い：見込み返金額 = min(実費, 上限) の合計（5,090 + 4,500）', body.includes('9,590円'))
  check('償還払い：妊婦健診の期限は最終受診日から1年', body.includes('2028-05-11'))
  check('償還払い：証憑の不足を表示', body.includes('証憑に不足あり'))
  await page.screenshot({ path: resolve(OUT, 'records-receipts-filled.png'), fullPage: true })

  // ---- 担当が「両方」のタスク：2人ともチェックで完了 ----
  {
    const SHARED = '受入れ可否を確認する'
    const progress = async () => {
      const m = /全体\s*(\d+) \/ (\d+)/.exec(await text(page))
      return m ? { done: Number(m[1]), total: Number(m[2]) } : null
    }
    const rowText = () =>
      page.evaluate((t) => {
        const li = [...document.querySelectorAll('li')].find((el) => el.textContent.includes(t))
        return li ? li.textContent : ''
      }, SHARED)

    await page.goto(`${BASE}/tasks?as=father`, { waitUntil: 'networkidle0' })
    const before = await progress()

    await clickBy(page, `${SHARED}」の自分の完了チェックを付ける`, { selector: 'button' })
    let row = await rowText()
    let now = await progress()
    check('両方：父だけチェック → 「父 済・母 未」で、完了にはならない', row.includes('父 済・母 未') && row.includes('進行中') && !row.includes('完了'))
    check('両方：父だけチェック → 進捗は増えない', now.done === before.done, `${now.done} / ${now.total}`)

    await page.goto(`${BASE}/?as=mother`, { waitUntil: 'networkidle0' })
    body = await text(page)
    check('両方：母のホームに「夫がt004の自分の分を完了にしました」', body.includes('夫がt004の自分の分を完了にしました'))

    await page.goto(`${BASE}/tasks?as=mother`, { waitUntil: 'networkidle0' })
    await clickBy(page, `${SHARED}」の自分の完了チェックを付ける`, { selector: 'button' })
    row = await rowText()
    now = await progress()
    check('両方：母もチェック → 「父 済・母 済」で完了になる', row.includes('父 済・母 済') && row.includes('完了'))
    check('両方：2人そろうと進捗が1つ増える', now.done === before.done + 1, `${now.done} / ${now.total}`)

    await page.goto(`${BASE}/?as=father`, { waitUntil: 'networkidle0' })
    body = await text(page)
    check('両方：父のホームに「妻がt004を完了にしました（2人とも完了）」', body.includes('妻がt004を完了にしました（2人とも完了）'))

    await page.goto(`${BASE}/tasks?as=father`, { waitUntil: 'networkidle0' })
    await clickBy(page, `${SHARED}」の自分の完了チェックを外す`, { selector: 'button' })
    row = await rowText()
    now = await progress()
    check('両方：父がチェックを外す → 完了ではなくなり、母のチェックは残る', row.includes('父 未・母 済') && now.done === before.done)

    // 2人が同時にチェックして、どちらも「進行中」で保存した場合
    await page.evaluate(() => {
      const key = 'couple-app-demo-db'
      const db = JSON.parse(localStorage.getItem(key))
      const path = 'households/main/tasks/t005'
      db[path] = { ...db[path], status: 'doing', doneBy: { father: true, mother: true } }
      localStorage.setItem(key, JSON.stringify(db))
    })
    await page.reload({ waitUntil: 'networkidle0' })
    const raced = await page.evaluate(() => {
      const li = [...document.querySelectorAll('li')].find((el) => el.textContent.includes('出生前検査'))
      return li ? li.textContent : ''
    })
    check('両方：同時にチェックして保存値がずれても、2人そろっていれば完了と表示', raced.includes('父 済・母 済') && raced.includes('完了'))

    // 編集シートでは「完了」を手で選べない
    await clickBy(page, `${SHARED}」を編集`, { selector: 'button' })
    const sheet = await page.evaluate(() => {
      const d = document.querySelector('dialog[open]')
      const statusButtons = [...d.querySelectorAll('fieldset')]
        .find((f) => f.querySelector('legend')?.textContent === 'ステータス')
      return {
        options: [...statusButtons.querySelectorAll('button')].map((b) => b.textContent),
        text: d.innerText,
      }
    })
    check('両方：編集シートのステータスに「完了」が無い', !sheet.options.includes('完了') && sheet.options.includes('該当なし'), sheet.options.join('・'))
    check('両方：編集シートに自分と相手のチェック状況が出る', sheet.text.includes('自分（父）の分は完了した') && sheet.text.includes('相手（母）：チェック済み'))
    await page.screenshot({ path: resolve(OUT, 'tasks-shared-edit.png') })
    await clickBy(page, '閉じる', { selector: 'dialog[open] button' })
    await page.screenshot({ path: resolve(OUT, 'tasks-shared.png') })
  }

  // ---- ホームからタスクを完了にする ----
  {
    await page.goto(`${BASE}/?as=father`, { waitUntil: 'networkidle0' })
    const rows = () =>
      page.evaluate(() => {
        const s = document.getElementById('now-title')?.closest('section')
        return s ? [...s.querySelectorAll('li a')].map((a) => a.getAttribute('href')) : []
      })
    const before = await rows()
    const target = await page.evaluateHandle(() => {
      const s = document.getElementById('now-title')?.closest('section')
      return [...s.querySelectorAll('li button')].find((b) => b.textContent.trim() === '完了')
    })
    const label = await target.evaluate((b) => b.getAttribute('aria-label'))
    await target.evaluate((b) => b.scrollIntoView({ block: 'center' }))
    await target.click()
    await wait(300)
    const after = await rows()
    check(
      'ホーム：「完了」を押すと「いまやるタスク」から消える',
      after.length <= before.length && JSON.stringify(after) !== JSON.stringify(before),
      label,
    )
    await page.screenshot({ path: resolve(OUT, 'home-new.png') })
    await page.screenshot({ path: resolve(OUT, 'home-new-full.png'), fullPage: true })
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    await page.screenshot({ path: resolve(OUT, 'home-new-dark-full.png'), fullPage: true })
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  }

  // ---- 許可していないアカウント ----
  const dbBefore = await page.evaluate(() => localStorage.getItem('couple-app-demo-db'))
  for (const path of ['/', '/tasks', '/schedule', '/advice', '/records', '/settings']) {
    await page.goto(`${BASE}${path}?as=stranger`, { waitUntil: 'networkidle0' })
    body = await text(page)
    const denied = body.includes('このアカウントは許可されていません')
    const leaked = /d+週d日|八重山病院|松南病院|葉酸|出産予定日|53.4|9,590/.test(body)
    check(`許可なし：${path} はデータを一切表示しない`, denied && !leaked, leaked ? 'データが表示されています' : '')
  }
  check('許可なし：自分の UID は表示する（セットアップ用）', body.includes('demo-stranger'))
  const dbAfter = await page.evaluate(() => localStorage.getItem('couple-app-demo-db'))
  check('許可なし：データを書き換えない', dbBefore === dbAfter)
  await page.screenshot({ path: resolve(OUT, 'denied.png') })

  // ---- 禁止事項：入力欄の確認 ----
  const forbidden = []
  for (const path of ['/', '/tasks', '/schedule', '/advice', '/records', '/records?tab=receipts', '/settings']) {
    await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}as=father`, { waitUntil: 'networkidle0' })
    const labels = await page.$$eval('label, legend, input, textarea, select', (els) =>
      els.map((el) => `${el.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('placeholder') ?? ''} ${el.getAttribute('name') ?? ''} ${el.id}`),
    )
    for (const l of labels) {
      if (/保険証番号|口座番号|住所を入力|address|account/i.test(l)) forbidden.push(`${path}: ${l.trim()}`)
    }
  }
  check('保険証番号・口座番号・住所の入力欄が無い', forbidden.length === 0, forbidden.join(' / '))
} catch (e) {
  check(`途中で停止：${e.message}`, false)
  await page.screenshot({ path: resolve(OUT, 'e2e-failure.png') })
}

check('コンソールエラーなし', errors.length === 0, errors.join(' / '))
await browser.close()

const ng = results.filter((r) => !r.ok)
console.log(`\n${results.length - ng.length} / ${results.length} 件 OK`)
process.exit(ng.length ? 1 : 0)
