/** 日付は 'yyyy-MM-dd' の文字列で持つ（タイムゾーンのずれを避けるため）。 */
export type Ymd = string

export type Owner = '母' | '父' | '両'
export type Role = 'father' | 'mother'

export type TaskStatus = 'todo' | 'doing' | 'done' | 'na'
export type TaskCategory = 'procedure' | 'money' | 'health' | 'prep' | 'father_work'
export type TaskAction = 'create' | 'edit' | 'status' | 'delete' | 'check' | 'uncheck'

/** 担当が「両方」のタスクの完了チェック（父・母それぞれ）。 */
export interface DoneBy {
  father: boolean
  mother: boolean
}

export interface Task {
  id: string
  phase: string
  category: TaskCategory
  owner: Owner
  title: string
  /** 期限の文字表記（元資料の記述）。アプリでは解釈しない。 */
  dueHint: string
  dueDate: Ymd | null
  /**
   * 担当が「両方」のときは、doneBy から求めた値（2人ともチェックで done）。
   * それ以外は保存されている値。
   */
  status: TaskStatus
  /** 完了チェック。担当が「両方」のときだけ使う（指示書のモデルへの追加項目）。 */
  doneBy: DoneBy
  /** doneBy が Firestore に保存済みか（未保存のタスクを最初に書くときの判断に使う）。 */
  doneByStored: boolean
  note: string
  deleted: boolean
  updatedAt: number | null
  updatedBy: string | null
  createdBy: string | null
  /** 「相手の更新」を正しく表示するための直近の操作種別（指示書のモデルへの追加項目）。 */
  lastAction?: TaskAction
}

export type EventType =
  | 'medical'
  | 'admin'
  | 'money'
  | 'work'
  | 'travel'
  | 'class'
  | 'milestone'
  | 'prep'

export interface ScheduleEvent {
  id: string
  title: string
  /** seed 由来のイベントは EDD（出生後で offsetDays>0 なら出生日）からの相対日数。 */
  offsetDays?: number
  /** ユーザーが追加したイベントは絶対日付。 */
  date?: Ymd
  /** 期間の幅（日数）。0 は1日のみ。 */
  window: number
  owner: Owner
  place?: string
  type: EventType
  memo?: string
  fatherAttend?: boolean
  critical?: boolean
  /** 済みにしたイベントはホームの期限表示から外す（指示書のモデルへの追加項目）。 */
  done?: boolean
  deleted?: boolean
  updatedAt: number | null
  updatedBy: string | null
}

export type FatherPlace = 'ishigaki' | 'ishikawa' | 'kyoto' | 'other'

export interface Presence {
  /** ドキュメントID＝日付 */
  id: Ymd
  father: FatherPlace
}

export type RecordKind = 'weight' | 'bp' | 'movement'

export interface BpValue {
  sys: number
  dia: number
}

export interface RecordItem {
  id: string
  kind: RecordKind
  date: Ymd
  /** weight: kg / bp: 収縮期・拡張期 / movement: 10回感じるまでの分数（任意） */
  value: number | BpValue | null
  memo: string
  updatedBy: string | null
}

export type ReceiptKind = 'ninpu' | 'sanpu' | 'hearing' | 'vaccine' | 'kodomo_iryo' | 'other'

export interface Receipt {
  id: string
  kind: ReceiptKind
  date: Ymd
  facility: string
  amountYen: number
  /** 妊婦健診のみ：受診票番号 */
  ticketNo: string | null
  hasReceipt: boolean
  hasStatement: boolean
  hasTicketFilled: boolean
  /** 産婦健診のみ */
  epdsDone: boolean
  /** 予防接種のみ */
  requestLetterObtained: boolean
  deadline: Ymd | null
  claimedAt: Ymd | null
  deleted?: boolean
  updatedBy: string | null
}

export interface AdviceState {
  read: string[]
  pinned: string[]
}

export interface Contacts {
  /** 恵愛会松南病院 */
  shonan: string
  /** 沖縄県立八重山病院 */
  yaeyama: string
  /** 母の勤務先 人事 */
  motherHr: string
  /** 父の会社 総務 */
  fatherGa: string
}

export interface Settings {
  edd: Ymd
  lmp: Ymd
  /** 出生日。入力後は産後表示に切り替わる（指示書 8-2 に基づく追加項目）。 */
  birthDate: Ymd | null
  prePregnancyWeightKg: number | null
  heightCm: number | null
  motherName: string
  fatherName: string
  babyName: string
  contacts: Contacts
}

export interface Member {
  role: Role
  displayName: string
}

export interface Household {
  settings: Settings
  members: Record<string, Member>
  seededAt: number | null
}

export interface Phase {
  id: string
  title: string
  when: string
  note: string
}

export interface AdviceItem {
  id: string
  weeks: [number, number]
  tags: string[]
  title: string
  body: string
  source: string
}
