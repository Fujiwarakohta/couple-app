/**
 * 領収書の写真。Firebase Storage は使わず、この端末の IndexedDB にだけ保存する。
 * 写真は相手の端末には同期されない（金額・日付・施設名などの文字情報のみ Firestore に同期する）。
 */

const DB_NAME = 'couple-app-photos'
const STORE = 'photos'
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.8

interface PhotoRow {
  id: string
  blob: Blob
  savedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('この端末では写真を保存できません'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB を開けません'))
  })
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('写真の保存に失敗しました'))
        tx.oncomplete = () => db.close()
        tx.onabort = () => db.close()
      }),
  )
}

/** 長辺 1600px の JPEG に縮小する（端末の容量を節約するため）。 */
async function shrink(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    return blob ?? file
  } catch {
    return file
  }
}

export async function savePhoto(id: string, file: Blob): Promise<void> {
  const blob = await shrink(file)
  const row: PhotoRow = { id, blob, savedAt: Date.now() }
  await run('readwrite', (store) => store.put(row))
}

export async function loadPhoto(id: string): Promise<Blob | null> {
  const row = await run<PhotoRow | undefined>('readonly', (store) => store.get(id))
  return row?.blob ?? null
}

export async function deletePhoto(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id))
}

export async function listPhotoIds(): Promise<string[]> {
  const keys = await run<IDBValidKey[]>('readonly', (store) => store.getAllKeys())
  return keys.filter((k): k is string => typeof k === 'string')
}
