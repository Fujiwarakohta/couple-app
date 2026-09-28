/**
 * データの保存先を抽象化する。
 * 本番は Firestore（src/lib/firebase.ts）、デモモードはブラウザ内（src/lib/localBackend.ts）。
 */

export interface AuthUser {
  uid: string
  displayName: string | null
  email: string | null
}

export type Unsub = () => void
export type DocData = Record<string, unknown>
export type DocWithId = DocData & { id: string }

export type BackendErrorCode = 'permission-denied' | 'unavailable' | 'unknown'

export interface BackendError {
  code: BackendErrorCode
  message: string
}

/** 書き込み時にサーバー時刻へ置き換える目印。 */
export const SERVER_TIME = '__SERVER_TIME__'

export interface WriteOp {
  path: string
  data: DocData
  merge?: boolean
}

export interface Backend {
  readonly kind: 'firestore' | 'demo'
  onAuthChange(cb: (user: AuthUser | null) => void): Unsub
  signIn(): Promise<void>
  signOut(): Promise<void>
  watchDoc(path: string, cb: (data: DocData | null) => void, onError: (e: BackendError) => void): Unsub
  watchCollection(
    path: string,
    cb: (docs: DocWithId[]) => void,
    onError: (e: BackendError) => void,
  ): Unsub
  /**
   * 書き込み。オフライン中は端末内にキューされ、復帰時に同期される。
   * 返り値の Promise はサーバー到達時に解決するため、画面側では待たない。
   */
  write(op: WriteOp): Promise<void>
  writeBatch(ops: WriteOp[]): Promise<void>
  remove(path: string): Promise<void>
  /** サーバーに問い合わせて存在を確認する（キャッシュは使わない）。 */
  existsOnServer(path: string): Promise<boolean>
  newId(): string
}

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === '1'
}

export interface FirebaseEnv {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  messagingSenderId: string
}

/** .env.local の値を読む。必須の値が欠けていれば null。 */
export function readFirebaseEnv(): FirebaseEnv | null {
  const env = import.meta.env
  const apiKey = env.VITE_FIREBASE_API_KEY
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN
  const projectId = env.VITE_FIREBASE_PROJECT_ID
  const appId = env.VITE_FIREBASE_APP_ID
  if (!apiKey || !authDomain || !projectId || !appId) return null
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  }
}

let cached: Promise<Backend | null> | null = null

/** バックエンドを遅延読み込みする（Firebase SDK を初期表示の JS から切り離すため）。 */
export function loadBackend(): Promise<Backend | null> {
  if (!cached) {
    cached = (async () => {
      if (isDemoMode()) {
        const mod = await import('./localBackend')
        return mod.createLocalBackend()
      }
      const env = readFirebaseEnv()
      if (!env) return null
      const mod = await import('./firebase')
      return mod.createFirebaseBackend(env)
    })()
  }
  return cached
}
