/**
 * 色の使い分け。全体のテーマは「安心感」。
 * 急かす・義務を感じさせる強い色（赤、濃い塗りつぶし）は最小限にし、淡い色を基調にする。
 *
 * 種類（何の情報か）
 *   タスク＝黄（はちみつ色） / 予定＝紫 / 助言＝青緑
 * 状態
 *   完了・済み＝緑 / もうすぐ期限＝オレンジ / 期限を過ぎた＝赤（ここだけ）
 * 担当（だれの担当か）……labels.ts の OWNER_BADGE_CLASS
 *   母＝ローズ / 父＝ブルー / 両方＝グリーン
 * 助言のタグ（どの分野か）
 *   からだ・栄養＝黄緑 / 医療・薬＝水色 / 手続き・準備＝ベージュ / 産後＝赤紫 / 父向け＝ブルー
 *
 * 色だけに頼らず、必ず文字のラベル（「タスク」「助言」など）を併記する。
 */

export type ItemKind = 'task' | 'event' | 'advice'

export const KIND_LABEL: Record<ItemKind, string> = {
  task: 'タスク',
  event: '予定',
  advice: '助言',
}

/** 種類を示す小さなラベル */
export const KIND_CHIP_CLASS: Record<ItemKind, string> = {
  task: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  event: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  advice: 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200',
}

/** カードの左の帯 */
export const KIND_BORDER_CLASS: Record<ItemKind, string> = {
  task: 'border-l-4 border-l-amber-400 dark:border-l-amber-500',
  event: 'border-l-4 border-l-violet-400 dark:border-l-violet-500',
  advice: 'border-l-4 border-l-teal-400 dark:border-l-teal-500',
}

/** 見出しの横のアイコンの地色（淡い色） */
export const KIND_ICON_CLASS: Record<ItemKind | 'soon' | 'partner', string> = {
  task: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  event: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  advice: 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200',
  soon: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  partner: 'bg-stone-200 text-stone-900 dark:bg-stone-700 dark:text-stone-100',
}

/** 「追加」など、その種類の画面の操作ボタン（index.css の .btn-task など。淡い色） */
export const KIND_BUTTON_CLASS: Record<Exclude<ItemKind, 'advice'>, string> = {
  task: 'btn-task',
  event: 'btn-event',
}

/** 期限の表示：近いものはオレンジ、過ぎたものだけ赤 */
export const DUE_TEXT_CLASS = {
  soon: 'text-orange-800 dark:text-orange-300',
  overdue: 'text-red-800 dark:text-red-300',
} as const

export type TagFamily = 'body' | 'medical' | 'admin' | 'postpartum' | 'father' | 'other'

export const TAG_FAMILY_LABEL: Record<TagFamily, string> = {
  body: 'からだ・栄養',
  medical: '医療・薬',
  admin: '手続き・準備',
  postpartum: '産後',
  father: '父向け',
  other: 'その他',
}

const TAG_FAMILY: Record<string, TagFamily> = {
  栄養: 'body',
  体重: 'body',
  運動: 'body',
  つわり: 'body',
  生活: 'body',
  医療: 'medical',
  薬: 'medical',
  症状: 'medical',
  感染予防: 'medical',
  心: 'medical',
  出産: 'medical',
  手続き: 'admin',
  里帰り: 'admin',
  移動: 'admin',
  準備: 'admin',
  買い物: 'admin',
  ライフハック: 'admin',
  石垣: 'admin',
  産後: 'postpartum',
  父: 'father',
}

export function tagFamily(tag: string): TagFamily {
  return TAG_FAMILY[tag] ?? 'other'
}

export const TAG_CLASS: Record<TagFamily, string> = {
  body: 'bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200',
  medical: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  admin: 'bg-stone-200 text-stone-900 dark:bg-stone-700 dark:text-stone-100',
  postpartum: 'bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200',
  father: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  other: 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100',
}

export const TAG_FAMILIES: TagFamily[] = ['body', 'medical', 'admin', 'postpartum', 'father']
