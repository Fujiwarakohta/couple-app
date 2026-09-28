import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import type { Backend, BackendError, FirebaseEnv, Unsub } from './backend'
import type { Store } from './firestoreStore'

/**
 * Firebase の初期化、Google ログイン、Firestore（永続キャッシュつき）。
 *
 * 初回表示を軽くするため、読み込みを2段階に分けている。
 *   1. 認証（このファイル）……ログイン状態の確認に必要
 *   2. Firestore（firestoreStore.ts）……ログイン済みと分かってから読み込む。
 *      persistentLocalCache の設定は firestoreStore.ts にある。
 */

/** 前回ログイン済みだったかの目印（真偽だけ）。Firestore の先読みに使う。 */
const SIGNED_IN_HINT = 'couple-app-signed-in'

function readHint(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_HINT) === '1'
  } catch {
    return false
  }
}

function writeHint(signedIn: boolean) {
  try {
    if (signedIn) localStorage.setItem(SIGNED_IN_HINT, '1')
    else localStorage.removeItem(SIGNED_IN_HINT)
  } catch {
    // 保存できなくても動作には影響しない
  }
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** Firestore の自動IDと同じ形式（英数字20文字）。 */
function randomId(): string {
  const bytes = new Uint8Array(40)
  let id = ''
  while (id.length < 20) {
    crypto.getRandomValues(bytes)
    for (const b of bytes) {
      // 62 の倍数に収まる値だけを使い、偏りをなくす
      if (b < 248 && id.length < 20) id += ID_CHARS[b % 62]
    }
  }
  return id
}

export function createFirebaseBackend(env: FirebaseEnv): Backend {
  const app = initializeApp({
    apiKey: env.apiKey,
    authDomain: env.authDomain,
    projectId: env.projectId,
    appId: env.appId,
    messagingSenderId: env.messagingSenderId,
  })

  // popupRedirectResolver を初期化時に渡すと、スマホではログイン用の iframe を先に読み込む。
  // 表示は少し重くなるが、ボタンを押してからポップアップが開くまでに通信を挟まないので、
  // iPhone の Safari でポップアップがブロックされにくい。ログインの確実さを優先する。
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  })

  // Authentication は Google プロバイダのみ。
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  let storePromise: Promise<Store> | null = null
  const store = (): Promise<Store> => {
    storePromise ??= import('./firestoreStore').then((m) => m.createStore(app))
    return storePromise
  }
  if (readHint()) void store().catch(() => undefined)

  const loadError = (e: unknown): BackendError => {
    const known = e as Partial<BackendError>
    if (known?.code === 'permission-denied' || known?.code === 'unavailable' || known?.code === 'unknown') {
      return known as BackendError
    }
    // Firestore 本体を読み込めなかった（オフラインで未キャッシュなど）
    return { code: 'unavailable', message: String(e) }
  }

  /** Firestore の読み込みを待ってから購読する。読み込み前に解除されたら何もしない。 */
  const watch = (start: (s: Store) => Unsub, onError: (e: BackendError) => void): Unsub => {
    let cancelled = false
    let unsub: Unsub = () => undefined
    store()
      .then((s) => {
        if (!cancelled) unsub = start(s)
      })
      .catch((e) => {
        if (!cancelled) onError(loadError(e))
      })
    return () => {
      cancelled = true
      unsub()
    }
  }

  return {
    kind: 'firestore',

    onAuthChange(cb) {
      return onAuthStateChanged(auth, (user) => {
        writeHint(!!user)
        if (user) void store().catch(() => undefined)
        cb(user ? { uid: user.uid, displayName: user.displayName, email: user.email } : null)
      })
    },

    async signIn() {
      await signInWithPopup(auth, provider)
    },

    async signOut() {
      await signOut(auth)
    },

    watchDoc(path, cb, onError) {
      return watch((s) => s.watchDoc(path, cb, onError), onError)
    },

    watchCollection(path, cb, onError) {
      return watch((s) => s.watchCollection(path, cb, onError), onError)
    },

    async write(op) {
      try {
        await (await store()).write(op)
      } catch (e) {
        throw loadError(e)
      }
    },

    async writeBatch(ops) {
      try {
        await (await store()).writeBatch(ops)
      } catch (e) {
        throw loadError(e)
      }
    },

    async remove(path) {
      try {
        await (await store()).remove(path)
      } catch (e) {
        throw loadError(e)
      }
    },

    async existsOnServer(path) {
      try {
        return await (await store()).existsOnServer(path)
      } catch (e) {
        throw loadError(e)
      }
    },

    newId() {
      return randomId()
    },
  }
}
