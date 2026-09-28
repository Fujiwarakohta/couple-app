/**
 * Google へ直接移動してログインする方式（OpenID Connect の implicit flow）。
 *
 * Firebase の中継ページ（<project>.firebaseapp.com/__/auth/handler）を通さない。
 * iPhone では、中継ページが sessionStorage に置いた情報を Google から戻ったときに読めず、
 * 「missing initial state」で失敗することがあるため。
 *
 * 流れ:
 *   1. state と nonce を作って localStorage に保存し、Google のログイン画面へ移動する
 *   2. Google が ID トークンを URL の # 以降に付けて、アプリへ戻す
 *   3. state と nonce を照合し、ID トークンを Firebase に渡してログインする
 *
 * 保存先を localStorage にしているのは、別のタブで戻ってきても読めるようにするため。
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const STORAGE_KEY = 'couple-app-oauth'
/** ログイン開始から戻るまでの有効時間 */
export const MAX_AGE_MS = 10 * 60 * 1000

export interface PendingLogin {
  state: string
  nonce: string
  createdAt: number
}

export type CallbackResult =
  | { kind: 'none' }
  | { kind: 'token'; idToken: string }
  | { kind: 'error'; code: RedirectErrorCode }

export type RedirectErrorCode =
  /** ユーザーが Google の画面でキャンセルした */
  | 'cancelled'
  /** 開始時の情報が無い・古い・一致しない */
  | 'state-mismatch'
  /** トークンの中身が開始時の情報と一致しない */
  | 'nonce-mismatch'
  /** Google がエラーを返した（設定の不足など） */
  | 'provider-error'

export function randomToken(bytes = 24): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function buildAuthUrl(clientId: string, redirectUri: string, pending: PendingLogin): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce: pending.nonce,
    state: pending.state,
    prompt: 'select_account',
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

/** JWT の中身（2番目の部分）を読む。署名の検証は Firebase 側が行う。 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Google から戻ってきた URL の # 以降を調べる。
 * @param hash location.hash（先頭の # を含んでよい）
 * @param pending 開始時に保存した情報（無ければ null）
 */
export function parseCallback(hash: string, pending: PendingLogin | null, now: number): CallbackResult {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const idToken = params.get('id_token')
  const error = params.get('error')
  if (!idToken && !error) return { kind: 'none' }

  if (error) {
    return { kind: 'error', code: error === 'access_denied' ? 'cancelled' : 'provider-error' }
  }

  const state = params.get('state')
  if (!pending || !state || state !== pending.state || now - pending.createdAt > MAX_AGE_MS) {
    return { kind: 'error', code: 'state-mismatch' }
  }
  const payload = decodeJwtPayload(idToken as string)
  if (!payload || payload.nonce !== pending.nonce) {
    return { kind: 'error', code: 'nonce-mismatch' }
  }
  return { kind: 'token', idToken: idToken as string }
}

export function isCallbackHash(hash: string): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  return params.has('id_token') || (params.has('error') && params.has('state'))
}

export function savePending(pending: PendingLogin): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
}

export function loadPending(): PendingLogin | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<PendingLogin>
    if (typeof v.state !== 'string' || typeof v.nonce !== 'string' || typeof v.createdAt !== 'number') {
      return null
    }
    return { state: v.state, nonce: v.nonce, createdAt: v.createdAt }
  } catch {
    return null
  }
}

export function clearPending(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 消せなくても、有効時間が過ぎれば使えなくなる
  }
}

/** アプリの入口の URL（Google に登録する「承認済みのリダイレクト URI」と同じ値）。 */
export function appRedirectUri(): string {
  return new URL(import.meta.env.BASE_URL, location.origin).href
}

/** Google のログイン画面へ移動する。 */
export function startRedirect(clientId: string): void {
  const pending: PendingLogin = { state: randomToken(), nonce: randomToken(), createdAt: Date.now() }
  savePending(pending)
  location.assign(buildAuthUrl(clientId, appRedirectUri(), pending))
}

let taken: CallbackResult | null = null

/**
 * Google から戻ってきた直後に呼ぶ（起動時に1回。2回目以降は同じ結果を返す）。
 * ID トークンが URL に残らないよう、結果に関わらず # 以降を消す。
 */
export function takeCallback(): CallbackResult {
  if (taken) return taken
  if (!isCallbackHash(location.hash)) {
    taken = { kind: 'none' }
    return taken
  }
  taken = parseCallback(location.hash, loadPending(), Date.now())
  clearPending()
  history.replaceState(null, '', location.pathname + location.search)
  return taken
}

export function redirectErrorMessage(code: RedirectErrorCode): string {
  switch (code) {
    case 'cancelled':
      return 'ログインが中断されました。'
    case 'state-mismatch':
      return 'ログインの確認に失敗しました。時間をおかずに、もう一度ログインしてください。'
    case 'nonce-mismatch':
      return 'ログインの確認に失敗しました。もう一度ログインしてください。'
    case 'provider-error':
      return 'Google のログインでエラーになりました。設定（承認済みのリダイレクト URI）を確認してください。'
  }
}
