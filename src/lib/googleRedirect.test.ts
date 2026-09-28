import { describe, expect, it } from 'vitest'
import {
  MAX_AGE_MS,
  buildAuthUrl,
  decodeJwtPayload,
  isCallbackHash,
  parseCallback,
  randomToken,
  type PendingLogin,
} from './googleRedirect'

const NOW = 1_800_000_000_000
const pending: PendingLogin = { state: 'state-abc', nonce: 'nonce-xyz', createdAt: NOW - 30_000 }

function base64url(text: string): string {
  const binary = Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 検証用の JWT（署名はダミー。署名の検証は Firebase 側の役目）。 */
function fakeJwt(payload: Record<string, unknown>): string {
  return `${base64url('{"alg":"RS256"}')}.${base64url(JSON.stringify(payload))}.signature`
}

describe('buildAuthUrl', () => {
  const url = new URL(buildAuthUrl('client-123.apps.googleusercontent.com', 'https://example.github.io/couple-app/', pending))

  it('Google の認可エンドポイントへ向かう', () => {
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
  })

  it('ID トークンだけを要求し、state と nonce を付ける', () => {
    expect(url.searchParams.get('response_type')).toBe('id_token')
    expect(url.searchParams.get('scope')).toBe('openid email profile')
    expect(url.searchParams.get('client_id')).toBe('client-123.apps.googleusercontent.com')
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.github.io/couple-app/')
    expect(url.searchParams.get('state')).toBe('state-abc')
    expect(url.searchParams.get('nonce')).toBe('nonce-xyz')
  })

  it('アクセストークンは要求しない', () => {
    expect(url.searchParams.get('response_type')).not.toContain('token ')
    expect(url.searchParams.get('response_type')).not.toContain('code')
  })
})

describe('randomToken', () => {
  it('毎回違う値で、十分な長さがある', () => {
    const a = randomToken()
    const b = randomToken()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f]{48}$/)
  })
})

describe('decodeJwtPayload', () => {
  it('中身を読む（日本語も含む）', () => {
    expect(decodeJwtPayload(fakeJwt({ nonce: 'n', name: '山田' }))).toEqual({ nonce: 'n', name: '山田' })
  })

  it('形式が違えば null', () => {
    expect(decodeJwtPayload('abc')).toBeNull()
    expect(decodeJwtPayload('a.b')).toBeNull()
    expect(decodeJwtPayload('a.%%%.c')).toBeNull()
  })
})

describe('parseCallback', () => {
  const token = fakeJwt({ nonce: pending.nonce, email: 'x@example.com' })

  it('# 以降にログインの情報が無ければ何もしない', () => {
    expect(parseCallback('', pending, NOW)).toEqual({ kind: 'none' })
    expect(parseCallback('#section', pending, NOW)).toEqual({ kind: 'none' })
  })

  it('state と nonce が一致すればトークンを返す', () => {
    expect(parseCallback(`#id_token=${token}&state=state-abc`, pending, NOW)).toEqual({
      kind: 'token',
      idToken: token,
    })
  })

  it('state が違えば拒否する', () => {
    expect(parseCallback(`#id_token=${token}&state=other`, pending, NOW)).toEqual({
      kind: 'error',
      code: 'state-mismatch',
    })
    expect(parseCallback(`#id_token=${token}`, pending, NOW)).toEqual({
      kind: 'error',
      code: 'state-mismatch',
    })
  })

  it('開始時の情報が無ければ拒否する（他人が作ったリンクを踏んだ場合など）', () => {
    expect(parseCallback(`#id_token=${token}&state=state-abc`, null, NOW)).toEqual({
      kind: 'error',
      code: 'state-mismatch',
    })
  })

  it('有効時間を過ぎていれば拒否する', () => {
    const old = { ...pending, createdAt: NOW - MAX_AGE_MS - 1 }
    expect(parseCallback(`#id_token=${token}&state=state-abc`, old, NOW)).toEqual({
      kind: 'error',
      code: 'state-mismatch',
    })
  })

  it('nonce が違うトークンは拒否する', () => {
    const other = fakeJwt({ nonce: 'someone-else' })
    expect(parseCallback(`#id_token=${other}&state=state-abc`, pending, NOW)).toEqual({
      kind: 'error',
      code: 'nonce-mismatch',
    })
    expect(parseCallback('#id_token=broken&state=state-abc', pending, NOW)).toEqual({
      kind: 'error',
      code: 'nonce-mismatch',
    })
  })

  it('キャンセルと、その他のエラーを区別する', () => {
    expect(parseCallback('#error=access_denied&state=state-abc', pending, NOW)).toEqual({
      kind: 'error',
      code: 'cancelled',
    })
    expect(parseCallback('#error=redirect_uri_mismatch&state=state-abc', pending, NOW)).toEqual({
      kind: 'error',
      code: 'provider-error',
    })
  })
})

describe('isCallbackHash', () => {
  it('ログインの戻りだけを対象にする', () => {
    expect(isCallbackHash('#id_token=a&state=b')).toBe(true)
    expect(isCallbackHash('#error=access_denied&state=b')).toBe(true)
    expect(isCallbackHash('#error=something')).toBe(false)
    expect(isCallbackHash('')).toBe(false)
  })
})
