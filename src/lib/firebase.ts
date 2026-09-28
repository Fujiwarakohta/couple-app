import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import type { Backend, BackendError, FirebaseEnv, SignInMethod, Unsub } from './backend'
import type { Store } from './firestoreStore'
import { redirectErrorMessage, startRedirect, takeCallback } from './googleRedirect'

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

  // 既定のログインは「Google へ移動して戻る」方式（googleRedirect.ts）。
  // Firebase の中継ページを使うポップアップ方式は、iPhone で
  // 「missing initial state」になることがあるため、予備として残している。
  const canRedirect = env.googleClientId !== ''
  const signInMethods: SignInMethod[] = canRedirect ? ['redirect', 'popup'] : ['popup']

  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    // ポップアップ方式しか使えないときは、ログイン用の iframe を先に読み込んでおく
    // （ボタンを押してから通信を挟むと、ポップアップがブロックされやすいため）。
    ...(canRedirect ? {} : { popupRedirectResolver: browserPopupRedirectResolver }),
  })

  // Authentication は Google プロバイダのみ。
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  // Google から戻ってきた直後なら、受け取った ID トークンでログインする
  const callback = takeCallback()
  let signInError: string | null = null
  const redirectDone: Promise<void> = (async () => {
    if (callback.kind === 'error') {
      signInError = redirectErrorMessage(callback.code)
      return
    }
    if (callback.kind !== 'token') return
    try {
      await signInWithCredential(auth, GoogleAuthProvider.credential(callback.idToken))
    } catch (e) {
      const code = (e as { code?: string })?.code ?? ''
      signInError =
        code === 'auth/network-request-failed'
          ? '通信できませんでした。電波の良い場所でもう一度ログインしてください。'
          : code === 'auth/invalid-credential'
            ? 'Google のクライアント ID が Firebase のプロジェクトと一致しません。設定を確認してください。'
            : 'ログインできませんでした。もう一度お試しください。'
    }
  })()

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
    signInMethods,

    onAuthChange(cb) {
      let active = true
      const unsub = onAuthStateChanged(auth, (user) => {
        if (!user) {
          // 戻ってきた直後のログインが終わるまでは「未ログイン」と伝えない
          void redirectDone.then(() => {
            if (!active || auth.currentUser) return
            writeHint(false)
            cb(null)
          })
          return
        }
        writeHint(true)
        void store().catch(() => undefined)
        cb({ uid: user.uid, displayName: user.displayName, email: user.email })
      })
      return () => {
        active = false
        unsub()
      }
    },

    async signIn(method) {
      const chosen = method && signInMethods.includes(method) ? method : signInMethods[0]
      if (chosen === 'redirect') {
        startRedirect(env.googleClientId)
        // 画面が切り替わるまで待つ（この Promise は解決しない）
        await new Promise<void>(() => undefined)
        return
      }
      await signInWithPopup(auth, provider, browserPopupRedirectResolver)
    },

    async pendingSignInError() {
      await redirectDone
      return signInError
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
