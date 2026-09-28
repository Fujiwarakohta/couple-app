import {
  SERVER_TIME,
  type AuthUser,
  type Backend,
  type BackendError,
  type DocData,
  type DocWithId,
} from './backend'

/**
 * デモモード用の保存先。Firebase に接続せず、ブラウザの localStorage にだけ保存する。
 * 画面確認用であり、端末間の同期は行わない。
 * URL に ?as=mother を付けると母として、?as=father で父としてログインした状態になる。
 * ?as=stranger は「許可していないアカウント」の再現用で、本番のルールと同じく読み書きをすべて拒否する。
 */

const STORAGE_KEY = 'couple-app-demo-db'
const USER_KEY = 'couple-app-demo-user'

/** 本番の Firestore ルール（許可 UID のみ）に相当する、デモ用の許可リスト。 */
const ALLOWED_UIDS = ['demo-father', 'demo-mother']
const DENIED: BackendError = { code: 'permission-denied', message: 'デモ：許可されていないアカウント' }

type Db = Record<string, DocData>

function load(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Db) : {}
  } catch {
    return {}
  }
}

function resolveTimes(value: unknown, now: number): unknown {
  if (value === SERVER_TIME) return now
  if (Array.isArray(value)) return value.map((v) => resolveTimes(v, now))
  if (value && typeof value === 'object') {
    const out: DocData = {}
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = resolveTimes(v, now)
    }
    return out
  }
  return value
}

function mergeDeep(base: DocData, patch: DocData): DocData {
  const out: DocData = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k]
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      cur &&
      typeof cur === 'object' &&
      !Array.isArray(cur)
    ) {
      out[k] = mergeDeep(cur as DocData, v as DocData)
    } else {
      out[k] = v
    }
  }
  return out
}

function demoUser(): AuthUser {
  const param = new URLSearchParams(location.search).get('as')
  if (param === 'mother' || param === 'father' || param === 'stranger') {
    sessionStorage.setItem(USER_KEY, param)
  }
  const role = sessionStorage.getItem(USER_KEY)
  if (role === 'stranger') {
    return { uid: 'demo-stranger', displayName: 'デモ（許可なし）', email: null }
  }
  return role === 'mother'
    ? { uid: 'demo-mother', displayName: 'デモ（母）', email: null }
    : { uid: 'demo-father', displayName: 'デモ（父）', email: null }
}

export function createLocalBackend(): Backend {
  let db = load()
  const listeners = new Set<() => void>()
  let signedIn = true
  const authListeners = new Set<(u: AuthUser | null) => void>()

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    } catch {
      // 保存できなくても画面確認は続けられる
    }
    for (const l of listeners) l()
  }

  const apply = (path: string, data: DocData, merge: boolean | undefined, now: number) => {
    const resolved = resolveTimes(data, now) as DocData
    // デモでは父・母の選択を省く（初回投入時の空の members に、デモ用の2人を入れる）
    if (
      !merge &&
      resolved.members &&
      typeof resolved.members === 'object' &&
      Object.keys(resolved.members).length === 0
    ) {
      resolved.members = {
        'demo-father': { role: 'father', displayName: 'デモ（父）' },
        'demo-mother': { role: 'mother', displayName: 'デモ（母）' },
      }
    }
    db = { ...db, [path]: merge && db[path] ? mergeDeep(db[path], resolved) : resolved }
  }

  const isDenied = () => !signedIn || !ALLOWED_UIDS.includes(demoUser().uid)

  const collectionDocs = (path: string): DocWithId[] => {
    const prefix = `${path}/`
    const out: DocWithId[] = []
    for (const [key, value] of Object.entries(db)) {
      if (!key.startsWith(prefix)) continue
      const id = key.slice(prefix.length)
      if (id.includes('/')) continue
      out.push({ ...value, id })
    }
    return out
  }

  // 別タブでの変更を反映する
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    db = load()
    for (const l of listeners) l()
  })

  return {
    kind: 'demo',
    signInMethods: ['popup'],

    async pendingSignInError() {
      return null
    },

    onAuthChange(cb) {
      authListeners.add(cb)
      queueMicrotask(() => cb(signedIn ? demoUser() : null))
      return () => authListeners.delete(cb)
    },

    async signIn() {
      signedIn = true
      for (const l of authListeners) l(demoUser())
    },

    async signOut() {
      signedIn = false
      for (const l of authListeners) l(null)
    },

    watchDoc(path, cb, onError) {
      if (isDenied()) {
        queueMicrotask(() => onError(DENIED))
        return () => undefined
      }
      const emit = () => cb(db[path] ?? null)
      listeners.add(emit)
      queueMicrotask(emit)
      return () => listeners.delete(emit)
    },

    watchCollection(path, cb, onError) {
      if (isDenied()) {
        queueMicrotask(() => onError(DENIED))
        return () => undefined
      }
      const emit = () => cb(collectionDocs(path))
      listeners.add(emit)
      queueMicrotask(emit)
      return () => listeners.delete(emit)
    },

    async write({ path, data, merge }) {
      if (isDenied()) throw DENIED
      apply(path, data, merge, Date.now())
      persist()
    },

    async writeBatch(ops) {
      if (isDenied()) throw DENIED
      const now = Date.now()
      for (const op of ops) apply(op.path, op.data, op.merge, now)
      persist()
    },

    async remove(path) {
      if (isDenied()) throw DENIED
      const next = { ...db }
      delete next[path]
      db = next
      persist()
    },

    async existsOnServer(path) {
      if (isDenied()) throw DENIED
      return path in db
    },

    newId() {
      return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    },
  }
}
