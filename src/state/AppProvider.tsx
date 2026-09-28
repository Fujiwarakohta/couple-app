import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { SEED_EDD, SEED_LMP, defaultSettings, paths, seedIfNeeded } from '../data/seed'
import {
  SERVER_TIME,
  isDemoMode,
  loadBackend,
  type AuthUser,
  type Backend,
  type BackendError,
  type Unsub,
  type WriteOp,
} from '../lib/backend'
import { todayYmd } from '../lib/dates'
import { deletePhoto } from '../lib/photos'
import { deadlineFor } from '../lib/receipts'
import { checkWrite } from '../lib/sharedTask'
import { newTaskId } from '../lib/tasks'
import type {
  AdviceState,
  Household,
  Presence,
  Receipt,
  RecordItem,
  ScheduleEvent,
  Task,
  Ymd,
} from '../types'
import {
  AppContext,
  type AppActions,
  type AppContextValue,
  type AppData,
  type AppStatus,
} from './AppContext'
import {
  toAdviceState,
  toEvent,
  toHousehold,
  toPresence,
  toReceipt,
  toRecord,
  toTask,
} from './normalize'

const FALLBACK_SETTINGS = defaultSettings(SEED_EDD, SEED_LMP)
const EMPTY_ADVICE_STATE: AdviceState = { read: [], pinned: [] }

function useToday(): Ymd {
  const [today, setToday] = useState(() => todayYmd())
  useEffect(() => {
    const check = () => setToday(todayYmd())
    const timer = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}

function notNull<T>(v: T | null): v is T {
  return v !== null
}

function signInErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'ログインが中断されました。'
  }
  if (code === 'auth/popup-blocked') {
    return 'ログイン画面がブロックされました。ブラウザのポップアップ許可を確認してください。'
  }
  if (code === 'auth/network-request-failed') {
    return '通信できませんでした。電波の良い場所でもう一度お試しください。'
  }
  if (code === 'auth/unauthorized-domain') {
    return 'このドメインは Firebase の「承認済みドメイン」に登録されていません。'
  }
  return 'ログインできませんでした。'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null)
  const [unconfigured, setUnconfigured] = useState(false)
  /** undefined＝未確定 / null＝未ログイン */
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const [denied, setDenied] = useState(false)
  /** undefined＝未読込 / null＝世帯データが無い */
  const [household, setHousehold] = useState<Household | null | undefined>(undefined)
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [presence, setPresence] = useState<Presence[]>([])
  const [records, setRecords] = useState<RecordItem[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [adviceState, setAdviceStateValue] = useState<AdviceState>(EMPTY_ADVICE_STATE)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const today = useToday()

  const resetData = useCallback(() => {
    setHousehold(undefined)
    setTasks([])
    setEvents([])
    setPresence([])
    setRecords([])
    setReceipts([])
    setAdviceStateValue(EMPTY_ADVICE_STATE)
  }, [])

  // 1. 保存先の読み込み
  useEffect(() => {
    let cancelled = false
    loadBackend()
      .then((b) => {
        if (cancelled) return
        if (!b) {
          setUnconfigured(true)
          return
        }
        setBackend(b)
        // Google から戻ってきた直後のログインで失敗していれば、理由を表示する
        void b.pendingSignInError().then((message) => {
          if (!cancelled && message) setError(message)
        })
      })
      .catch(() => {
        if (cancelled) return
        setError('アプリの読み込みに失敗しました。通信状況を確認して開き直してください。')
        setUnconfigured(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 2. ログイン状態の監視
  useEffect(() => {
    if (!backend) return
    return backend.onAuthChange((u) => {
      setDenied(false)
      resetData()
      setUser(u)
    })
  }, [backend, resetData])

  // 3. ログイン後：権限の確認 → 初回投入 → 購読
  const uid = user?.uid ?? null
  useEffect(() => {
    if (!backend || !uid) return
    let cancelled = false
    const unsubs: Unsub[] = []

    const stopAll = () => {
      for (const u of unsubs.splice(0)) u()
    }
    const onError = (e: BackendError) => {
      if (cancelled) return
      if (e.code === 'permission-denied') {
        // 許可 UID 以外：読み込み済みのデータも捨てる
        stopAll()
        resetData()
        setDenied(true)
      } else if (e.code !== 'unavailable') {
        setError('データの読み込みでエラーが発生しました。')
      }
    }

    void (async () => {
      const result = await seedIfNeeded(backend)
      if (cancelled) return
      if (result === 'denied') {
        setDenied(true)
        return
      }
      unsubs.push(
        backend.watchDoc(
          paths.household,
          (d) => setHousehold(d ? toHousehold(d, FALLBACK_SETTINGS) : null),
          onError,
        ),
        backend.watchCollection(paths.tasks, (docs) => setTasks(docs.map(toTask)), onError),
        backend.watchCollection(paths.events, (docs) => setEvents(docs.map(toEvent)), onError),
        backend.watchCollection(
          paths.presence,
          (docs) => setPresence(docs.map(toPresence).filter(notNull)),
          onError,
        ),
        backend.watchCollection(
          paths.records,
          (docs) => setRecords(docs.map(toRecord).filter(notNull)),
          onError,
        ),
        backend.watchCollection(
          paths.receipts,
          (docs) => setReceipts(docs.map(toReceipt).filter(notNull)),
          onError,
        ),
        backend.watchDoc(
          `${paths.adviceState}/${uid}`,
          (d) => setAdviceStateValue(toAdviceState(d)),
          onError,
        ),
      )
    })()

    return () => {
      cancelled = true
      stopAll()
    }
  }, [backend, uid, retry, resetData])

  // 初回がオフラインだった場合、オンラインに戻ったら確認し直す
  const needOnline = !!uid && !denied && household === null
  useEffect(() => {
    if (!needOnline) return
    const again = () => setRetry((n) => n + 1)
    window.addEventListener('online', again)
    return () => window.removeEventListener('online', again)
  }, [needOnline])

  const status: AppStatus = useMemo(() => {
    if (unconfigured) return 'unconfigured'
    if (!backend || user === undefined) return 'loading'
    if (user === null) return 'signedOut'
    if (denied) return 'denied'
    if (household === undefined) return 'checking'
    if (household === null) return 'needOnline'
    if (!household.members[user.uid]) return 'needRole'
    return 'ready'
  }, [unconfigured, backend, user, denied, household])

  // 最新の値を actions から参照するための ref（actions を作り直さないため）
  const myRole = user && household ? (household.members[user.uid]?.role ?? null) : null
  const ctx = useRef({ backend, user, role: myRole })
  useEffect(() => {
    ctx.current = { backend, user, role: myRole }
  }, [backend, user, myRole])

  const actions: AppActions = useMemo(() => {
    const fail = (e: unknown) => {
      const code = (e as BackendError)?.code
      if (code === 'permission-denied') {
        setError('保存できませんでした（権限がありません）。')
      } else if (code !== 'unavailable') {
        setError('保存できませんでした。通信状況を確認してください。')
      }
    }
    const current = () => {
      const { backend: b, user: u } = ctx.current
      return b && u ? { b, uid: u.uid, name: u.displayName ?? '' } : null
    }
    const write = (op: WriteOp) => {
      const c = current()
      if (c) void c.b.write(op).catch(fail)
    }
    const stamp = (uidValue: string) => ({ updatedAt: SERVER_TIME, updatedBy: uidValue })

    return {
      async signIn(method) {
        const b = ctx.current.backend
        if (!b) return
        try {
          setError(null)
          await b.signIn(method)
        } catch (e) {
          setError(signInErrorMessage(e))
        }
      },

      async signOut() {
        const b = ctx.current.backend
        if (!b) return
        try {
          await b.signOut()
        } catch {
          setError('ログアウトできませんでした。')
        }
      },

      setRole(role) {
        const c = current()
        if (!c) return
        write({
          path: paths.household,
          data: { members: { [c.uid]: { role, displayName: c.name } } },
          merge: true,
        })
      },

      updateTask(id, patch, action) {
        const c = current()
        if (!c) return
        write({
          path: `${paths.tasks}/${id}`,
          data: { ...patch, lastAction: action, ...stamp(c.uid) },
          merge: true,
        })
      },

      setTaskCheck(task, checked) {
        const c = current()
        const role = ctx.current.role
        if (!c || !role) return
        const w = checkWrite(task, role, checked)
        write({
          path: `${paths.tasks}/${task.id}`,
          data: { doneBy: w.doneBy, status: w.status, lastAction: w.action, ...stamp(c.uid) },
          merge: true,
        })
      },

      addTask(task) {
        const c = current()
        if (!c) return
        const id = newTaskId(c.b.newId())
        write({
          path: `${paths.tasks}/${id}`,
          data: {
            ...task,
            dueHint: '',
            status: 'todo',
            doneBy: { father: false, mother: false },
            deleted: false,
            createdBy: c.uid,
            lastAction: 'create',
            ...stamp(c.uid),
          },
        })
      },

      saveEvent(id, input) {
        const c = current()
        if (!c) return
        const { date, offsetDays, place, memo, ...rest } = input
        const data: Record<string, unknown> = { ...rest, deleted: false, ...stamp(c.uid) }
        // 絶対日付を優先。相対日数（seed 由来）は日付を変えない限りそのまま残す。
        if (date) data.date = date
        else if (typeof offsetDays === 'number') data.offsetDays = offsetDays
        if (place.trim()) data.place = place.trim()
        if (memo.trim()) data.memo = memo.trim()
        write({ path: `${paths.events}/${id ?? `u${c.b.newId()}`}`, data })
      },

      patchEvent(id, patch) {
        const c = current()
        if (!c) return
        write({ path: `${paths.events}/${id}`, data: { ...patch, ...stamp(c.uid) }, merge: true })
      },

      setPresence(dates, place) {
        const c = current()
        if (!c || dates.length === 0) return
        if (place === null) {
          for (const d of dates) void c.b.remove(`${paths.presence}/${d}`).catch(fail)
          return
        }
        void c.b
          .writeBatch(dates.map((d) => ({ path: `${paths.presence}/${d}`, data: { father: place } })))
          .catch(fail)
      },

      saveRecord(id, input) {
        const c = current()
        if (!c) return
        write({
          path: `${paths.records}/${id ?? c.b.newId()}`,
          data: { ...input, updatedBy: c.uid },
        })
      },

      removeRecord(id) {
        const c = current()
        if (c) void c.b.remove(`${paths.records}/${id}`).catch(fail)
      },

      saveReceipt(id, input) {
        const c = current()
        if (!c) return ''
        const receiptId = id ?? c.b.newId()
        write({
          path: `${paths.receipts}/${receiptId}`,
          data: {
            ...input,
            deadline: deadlineFor(input.kind, input.date),
            deleted: false,
            updatedBy: c.uid,
          },
        })
        return receiptId
      },

      removeReceipt(id) {
        const c = current()
        if (!c) return
        write({
          path: `${paths.receipts}/${id}`,
          data: { deleted: true, updatedBy: c.uid },
          merge: true,
        })
        void deletePhoto(id).catch(() => undefined)
      },

      setAdviceState(next) {
        const c = current()
        if (!c) return
        write({ path: `${paths.adviceState}/${c.uid}`, data: { read: next.read, pinned: next.pinned } })
      },

      saveSettings(next) {
        write({ path: paths.household, data: { settings: { ...next } }, merge: true })
      },

      dismissError() {
        setError(null)
      },
    }
  }, [])

  const data: AppData | null = useMemo(() => {
    if (status !== 'ready' && status !== 'needRole') return null
    if (!household) return null
    return {
      household,
      settings: household.settings,
      tasks,
      events,
      presence,
      records,
      receipts,
      adviceState,
    }
  }, [status, household, tasks, events, presence, records, receipts, adviceState])

  const value: AppContextValue = useMemo(() => {
    const myUid = user?.uid ?? null
    const members = household?.members ?? {}
    const role = myUid ? (members[myUid]?.role ?? null) : null
    const partnerUid = Object.keys(members).find((k) => k !== myUid) ?? null
    return {
      status,
      isDemo: isDemoMode(),
      signInMethods: backend?.signInMethods ?? [],
      user: user ?? null,
      role,
      partnerUid,
      data,
      error,
      today,
      actions,
    }
  }, [status, backend, user, household, data, error, today, actions])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
