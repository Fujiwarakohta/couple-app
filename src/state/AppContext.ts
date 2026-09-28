import { createContext, useContext } from 'react'
import type { AuthUser, SignInMethod } from '../lib/backend'
import type {
  AdviceState,
  FatherPlace,
  Household,
  Presence,
  Receipt,
  RecordItem,
  Role,
  ScheduleEvent,
  Settings,
  Task,
  TaskAction,
  Ymd,
} from '../types'

export type AppStatus =
  /** 起動中 */
  | 'loading'
  /** .env.local に Firebase の設定値が無い */
  | 'unconfigured'
  | 'signedOut'
  /** ログイン後、権限と初期データを確認中 */
  | 'checking'
  /** 許可 UID 以外。データは一切読み込まない */
  | 'denied'
  /** 初回はオンラインでの読み込みが必要 */
  | 'needOnline'
  /** 父・母の選択がまだ */
  | 'needRole'
  | 'ready'

export type TaskPatch = Partial<
  Pick<
    Task,
    'phase' | 'category' | 'owner' | 'title' | 'dueDate' | 'status' | 'note' | 'deleted' | 'doneBy'
  >
>

export type NewTask = Pick<Task, 'phase' | 'category' | 'owner' | 'title' | 'dueDate' | 'note'>

export type EventInput = Pick<
  ScheduleEvent,
  'title' | 'window' | 'owner' | 'type' | 'fatherAttend' | 'critical' | 'done'
> & {
  date?: Ymd
  offsetDays?: number
  place: string
  memo: string
}

export type RecordInput = Omit<RecordItem, 'id' | 'updatedBy'>
export type ReceiptInput = Omit<Receipt, 'id' | 'updatedBy' | 'deadline' | 'deleted'>

export interface AppData {
  household: Household
  settings: Settings
  tasks: Task[]
  events: ScheduleEvent[]
  presence: Presence[]
  records: RecordItem[]
  receipts: Receipt[]
  adviceState: AdviceState
}

export interface AppActions {
  signIn(method?: SignInMethod): Promise<void>
  signOut(): Promise<void>
  setRole(role: Role): void
  updateTask(id: string, patch: TaskPatch, action: TaskAction): void
  /** 担当が「両方」のタスクで、自分の完了チェックを付ける／外す。 */
  setTaskCheck(task: Task, checked: boolean): void
  addTask(task: NewTask): void
  saveEvent(id: string | null, input: EventInput): void
  patchEvent(id: string, patch: { done?: boolean; deleted?: boolean }): void
  setPresence(dates: Ymd[], place: FatherPlace | null): void
  saveRecord(id: string | null, input: RecordInput): void
  removeRecord(id: string): void
  saveReceipt(id: string | null, input: ReceiptInput): string
  removeReceipt(id: string): void
  setAdviceState(next: AdviceState): void
  saveSettings(next: Settings): void
  dismissError(): void
}

export interface AppContextValue {
  status: AppStatus
  isDemo: boolean
  /** 使えるログイン方式。先頭が既定。 */
  signInMethods: readonly SignInMethod[]
  user: AuthUser | null
  role: Role | null
  partnerUid: string | null
  data: AppData | null
  /** 直近のエラー（書き込み失敗・ログイン失敗など） */
  error: string | null
  today: Ymd
  actions: AppActions
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('AppProvider の外で useApp が呼ばれました')
  return value
}

/** データが読み込み済みの画面で使う。 */
export function useAppData(): AppContextValue & { data: AppData } {
  const value = useApp()
  if (!value.data) throw new Error('データの読み込み前に useAppData が呼ばれました')
  return value as AppContextValue & { data: AppData }
}
