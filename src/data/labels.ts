import type {
  EventType,
  FatherPlace,
  Owner,
  Role,
  TaskCategory,
  TaskStatus,
} from '../types'

export const OWNERS: Owner[] = ['母', '父', '両']

export const OWNER_LABEL: Record<Owner, string> = {
  母: '母',
  父: '父',
  両: '両方',
}

/** 担当色：母＝ローズ系、父＝ブルー系、両＝グリーン系。 */
export const OWNER_BADGE_CLASS: Record<Owner, string> = {
  母: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  父: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  両: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200',
}

export const OWNER_DOT_CLASS: Record<Owner, string> = {
  母: 'bg-rose-600 dark:bg-rose-400',
  父: 'bg-blue-600 dark:bg-blue-400',
  両: 'bg-green-600 dark:bg-green-400',
}

export const CATEGORIES: TaskCategory[] = ['procedure', 'money', 'health', 'prep', 'father_work']

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  procedure: '行政・医療・労務手続き',
  money: '保険・補助金・お金',
  health: 'からだ・栄養',
  prep: '準備・民間優待',
  father_work: '父の稼働設計',
}

export const CATEGORY_SHORT_LABEL: Record<TaskCategory, string> = {
  procedure: '手続き',
  money: 'お金',
  health: 'からだ',
  prep: '準備',
  father_work: '父の稼働',
}

export const STATUSES: TaskStatus[] = ['todo', 'doing', 'done', 'na']

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '未着手',
  doing: '進行中',
  done: '完了',
  na: '該当なし',
}

export const EVENT_TYPES: EventType[] = [
  'medical',
  'admin',
  'money',
  'work',
  'travel',
  'class',
  'milestone',
  'prep',
]

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  medical: '医療',
  admin: '行政',
  money: 'お金',
  work: '仕事',
  travel: '移動',
  class: '教室',
  milestone: '節目',
  prep: '準備',
}

export const FATHER_PLACES: FatherPlace[] = ['ishigaki', 'ishikawa', 'kyoto', 'other']

export const FATHER_PLACE_LABEL: Record<FatherPlace, string> = {
  ishigaki: '石垣',
  ishikawa: '石川',
  kyoto: '京都',
  other: 'その他',
}

/** 父の所在の帯の色。文字を重ねるので濃い色＋白文字にしている。 */
export const FATHER_PLACE_CLASS: Record<FatherPlace, string> = {
  ishigaki: 'bg-sky-700 text-white',
  ishikawa: 'bg-violet-700 text-white',
  kyoto: 'bg-amber-800 text-white',
  other: 'bg-neutral-600 text-white',
}

export const ROLE_LABEL: Record<Role, string> = {
  father: '父',
  mother: '母',
}

/** 相手の呼び方（「妻がt042を完了にしました」形式）。 */
export const PARTNER_CALL: Record<Role, string> = {
  father: '夫',
  mother: '妻',
}

export const ROLE_OWNER: Record<Role, Owner> = {
  father: '父',
  mother: '母',
}

export const DISCLAIMER =
  '一般情報です。主治医の指示を優先してください。制度・金額は各機関の最新情報を確認してください。'
