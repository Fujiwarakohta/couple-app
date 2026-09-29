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
  t057:
    'RSウイルスワクチンの費用。2026年度から定期接種（対象は28週0日〜36週6日）になっており、このタスクの「任意接種・24〜36週」とは異なる',
  t058: '無痛分娩の追加費用（調査報告書では10万円〜税別。公式未確認）',
  t059: '離島通院費助成が里帰り（県外）出産に適用されるか',
}

const ADVICE: Record<string, string> = {
  a13: '石垣市の妊婦歯科健診の有無',
  a15:
    'RSウイルスワクチンの費用・接種可否。2026年度から定期接種（対象は28週0日〜36週6日）になっており、この項目の「任意・24〜36週」とは異なる',
  a18: '航空会社ごとの搭乗条件',
  a26: '航空会社ごとの搭乗条件',
  a30: '無痛分娩の追加費用（調査報告書では10万円〜税別。公式未確認）',
  a33: '里帰り滞在先で受け取れるか（規約）',
}

/**
 * 以前は「未確認」だったが、公式ページで確認できたので表示を外した項目。
 * 確認した日と出典を残しておく（内容が変わったときに見直せるように）。
 */
export const CONFIRMED: { ids: string[]; what: string; source: string; checkedOn: string }[] = [
  {
    ids: ['t130', 'a32'],
    what: '新生児聴覚検査助成の上限3,500円・検査1回（再検査の場合は確認検査を含め2回）・市外は償還払い・検査日から1年間',
    source: '石垣市 新生児聴覚検査費助成（2022-04-01 更新）',
    checkedOn: '2026-09-29',
  },
  {
    ids: ['t125'],
    what: 'こども医療費助成の県外受診分の申請期限（受診日の翌月から起算して2年以内）',
    source: '石垣市 こども医療費助成制度（2025-03-25 更新）',
    checkedOn: '2026-09-29',
  },
]

const MARKER = /要確認|未確認/

export function taskUnconfirmed(id: string, title: string): UnconfirmedInfo | null {
  if (TASKS[id]) return { reason: TASKS[id] }
  if (MARKER.test(title)) return { reason: '本文に「要確認」の記載あり' }
  return null
}

export function adviceUnconfirmed(item: {
  id: string
  body: string
  source: string
  verify?: string
}): UnconfirmedInfo | null {
  if (ADVICE[item.id]) return { reason: ADVICE[item.id] }
  // 追加したアドバイス（advice_guide.json）は、未確認の内容を項目ごとに持っている
  if (item.verify) return { reason: item.verify }
  if (MARKER.test(item.body) || MARKER.test(item.source)) {
    return { reason: '本文に「要確認」の記載あり' }
  }
  return null
}

export const UNCONFIRMED_TASK_IDS = Object.keys(TASKS)
export const UNCONFIRMED_ADVICE_IDS = Object.keys(ADVICE)
