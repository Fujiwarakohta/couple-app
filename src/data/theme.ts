/**
 * 色の使い分け。
 *
 * 種類（何の情報か）
 *   タスク＝オレンジ / 予定＝紫 / 助言＝青緑 / 期限の警告＝赤
 * 担当（だれの担当か）……labels.ts の OWNER_BADGE_CLASS
 *   母＝ローズ / 父＝ブルー / 両方＝グリーン
 * 助言のタグ（どの分野か）
 *   からだ・栄養＝黄緑 / 医療・薬＝水色 / 手続き・移動＝黄 / 産後＝赤紫 / 父向け＝ブルー
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
  task: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  event: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  advice: 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200',
}

/** カードの左の帯 */
export const KIND_BORDER_CLASS: Record<ItemKind, string> = {
  task: 'border-l-4 border-l-orange-600 dark:border-l-orange-400',
  event: 'border-l-4 border-l-violet-600 dark:border-l-violet-400',
  advice: 'border-l-4 border-l-teal-600 dark:border-l-teal-400',
}

/** 見出しの横のアイコンの地色 */
export const KIND_ICON_CLASS: Record<ItemKind | 'urgent' | 'partner', string> = {
  task: 'bg-orange-700 text-white dark:bg-orange-300 dark:text-neutral-900',
  event: 'bg-violet-700 text-white dark:bg-violet-300 dark:text-neutral-900',
  advice: 'bg-teal-700 text-white dark:bg-teal-300 dark:text-neutral-900',
  urgent: 'bg-red-700 text-white dark:bg-red-300 dark:text-neutral-900',
  partner: 'bg-neutral-700 text-white dark:bg-neutral-300 dark:text-neutral-900',
}

/** その種類の主な操作ボタン（index.css の .btn-task など） */
export const KIND_BUTTON_CLASS: Record<ItemKind, string> = {
  task: 'btn-task',
  event: 'btn-event',
  advice: 'btn-advice',
}

export type TagFamily = 'body' | 'medical' | 'admin' | 'postpartum' | 'father' | 'other'

export const TAG_FAMILY_LABEL: Record<TagFamily, string> = {
  body: 'からだ・栄養',
  medical: '医療・薬',
  admin: '手続き・移動',
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
  admin: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200',
  postpartum: 'bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200',
  father: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  other: 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100',
}

export const TAG_FAMILIES: TagFamily[] = ['body', 'medical', 'admin', 'postpartum', 'father']
