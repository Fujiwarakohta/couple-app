import type { FirebaseApp } from 'firebase/app'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import type { FirestoreError } from 'firebase/firestore'
import { SERVER_TIME, type Backend, type BackendError, type DocData } from './backend'

/**
 * Firestore を使う部分。容量が大きいので、ログイン済みと分かってから読み込む
 * （src/lib/firebase.ts から動的に import される）。
 */
export type Store = Pick<
  Backend,
  'watchDoc' | 'watchCollection' | 'write' | 'writeBatch' | 'remove' | 'existsOnServer'
>

/** Firestore の Timestamp をミリ秒の数値に直す（入れ子のマップも対象）。 */
function fromFirestore(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toMillis()
  if (Array.isArray(value)) return value.map(fromFirestore)
  if (value && typeof value === 'object') {
    const out: DocData = {}
    for (const [k, v] of Object.entries(value)) out[k] = fromFirestore(v)
    return out
  }
  return value
}

/** SERVER_TIME の目印を serverTimestamp() に置き換える。undefined は Firestore が拒否するので落とす。 */
function toFirestore(value: unknown): unknown {
  if (value === SERVER_TIME) return serverTimestamp()
  if (Array.isArray(value)) return value.map(toFirestore)
  if (value && typeof value === 'object') {
    const out: DocData = {}
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = toFirestore(v)
    }
    return out
  }
  return value
}

function toBackendError(e: unknown): BackendError {
  const err = e as Partial<FirestoreError>
  const message = typeof err?.message === 'string' ? err.message : String(e)
  if (err?.code === 'permission-denied') return { code: 'permission-denied', message }
  if (err?.code === 'unavailable') return { code: 'unavailable', message }
  return { code: 'unknown', message }
}

export function createStore(app: FirebaseApp): Store {
  // オフラインでも閲覧・編集できるよう、端末内の永続キャッシュを有効にする。
  // オフライン中の書き込みは端末内にキューされ、復帰時に同期される。
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })

  return {
    watchDoc(path, cb, onError) {
      return onSnapshot(
        doc(db, path),
        (snap) => {
          cb(snap.exists() ? (fromFirestore(snap.data({ serverTimestamps: 'estimate' })) as DocData) : null)
        },
        (e) => onError(toBackendError(e)),
      )
    },

    watchCollection(path, cb, onError) {
      return onSnapshot(
        collection(db, path),
        (snap) => {
          cb(
            snap.docs.map((d) => ({
              ...(fromFirestore(d.data({ serverTimestamps: 'estimate' })) as DocData),
              id: d.id,
            })),
          )
        },
        (e) => onError(toBackendError(e)),
      )
    },

    async write({ path, data, merge }) {
      try {
        await setDoc(doc(db, path), toFirestore(data) as DocData, { merge: merge ?? false })
      } catch (e) {
        throw toBackendError(e)
      }
    },

    async writeBatch(ops) {
      try {
        const batch = writeBatch(db)
        for (const op of ops) {
          batch.set(doc(db, op.path), toFirestore(op.data) as DocData, { merge: op.merge ?? false })
        }
        await batch.commit()
      } catch (e) {
        throw toBackendError(e)
      }
    },

    async remove(path) {
      try {
        await deleteDoc(doc(db, path))
      } catch (e) {
        throw toBackendError(e)
      }
    },

    async existsOnServer(path) {
      try {
        const snap = await getDocFromServer(doc(db, path))
        return snap.exists()
      } catch (e) {
        throw toBackendError(e)
      }
    },
  }
}
