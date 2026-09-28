// firestore.rules を生成するための関数（テストできるように分けている）。

export const PLACEHOLDER = '__ALLOWED_UIDS__'
export const REQUIRED_UID_COUNT = 2

/** KEY=VALUE 形式の .env を読む。# 以降はコメント。 */
export function parseEnv(text) {
  const out = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

/**
 * VITE_ALLOWED_UIDS を検証して配列にする。
 * ルールに文字列として埋め込むので、英数字・ハイフン・アンダースコア以外は受け付けない。
 */
export function parseUids(value) {
  if (!value || !value.trim()) {
    throw new Error('VITE_ALLOWED_UIDS が空です。.env.local に父・母の UID をカンマ区切りで記入してください。')
  }
  const uids = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const uid of uids) {
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(uid)) {
      throw new Error(`UID の形式が正しくありません: ${uid}`)
    }
  }
  if (new Set(uids).size !== uids.length) {
    throw new Error('同じ UID が重複しています。父・母それぞれの UID を記入してください。')
  }
  if (uids.length !== REQUIRED_UID_COUNT) {
    throw new Error(
      `UID は ${REQUIRED_UID_COUNT} つ必要です（現在 ${uids.length} つ）。利用者は父・母の2名固定です。`,
    )
  }
  return uids
}

export function renderRules(template, uids) {
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(`雛形に ${PLACEHOLDER} がありません。`)
  }
  const list = uids.map((u) => `'${u}'`).join(', ')
  return template
    .replaceAll(PLACEHOLDER, list)
    .replace(
      /^\/\/ Firestore セキュリティルールの雛形。[\s\S]*?(?=rules_version)/,
      '// このファイルは「npm run rules」で生成されたもの。直接編集しない。\n// 変更するときは firestore.rules.template と .env.local を直して、生成し直す。\n',
    )
}
