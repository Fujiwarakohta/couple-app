/**
 * 資料で「要確認」とされている項目。確認済みに変わるまで断定表示しない（指示書 10・付録）。
 * seed の本文は書き換えず、画面側で「未確認」の表示を重ねる。
 */

export interface UnconfirmedInfo {
  /** 何が未確認か */
  reason: string
}

/** 指示書 付録の5項目と、seed 本文に「要確認」と明記されている項目。 */
const TASKS: Record<string, string> = {
  t042: '石垣市の妊婦歯科健診の有無・条件',
  t057: 'RSウイルスワクチンの費用',
  t058: '無痛分娩の追加費用（調査報告書では10万円〜税別。公式未確認）',
  t059: '離島通院費助成が里帰り（県外）出産に適用されるか',
  t125: 'こども医療費（県外受診分）の申請期限2年',
  t130: '新生児聴覚検査助成の上限3,500円・要件',
}

const ADVICE: Record<string, string> = {
  a13: '石垣市の妊婦歯科健診の有無',
  a15: 'RSウイルスワクチンの費用・接種可否',
  a18: '航空会社ごとの搭乗条件',
  a26: '航空会社ごとの搭乗条件',
  a30: '無痛分娩の追加費用（調査報告書では10万円〜税別。公式未確認）',
  a32: '新生児聴覚検査助成の上限3,500円・要件',
  a33: '里帰り滞在先で受け取れるか（規約）',
}

const MARKER = /要確認|未確認/

export function taskUnconfirmed(id: string, title: string): UnconfirmedInfo | null {
  if (TASKS[id]) return { reason: TASKS[id] }
  if (MARKER.test(title)) return { reason: '本文に「要確認」の記載あり' }
  return null
}

export function adviceUnconfirmed(id: string, body: string, source: string): UnconfirmedInfo | null {
  if (ADVICE[id]) return { reason: ADVICE[id] }
  if (MARKER.test(body) || MARKER.test(source)) return { reason: '本文に「要確認」の記載あり' }
  return null
}

export const UNCONFIRMED_TASK_IDS = Object.keys(TASKS)
export const UNCONFIRMED_ADVICE_IDS = Object.keys(ADVICE)
