import { addMonths, addYears, startOfMonth, subDays } from 'date-fns'
import type { Receipt, ReceiptKind, Ymd } from '../types'
import { fromYmd, isValidYmd, toYmd } from './dates'

export const RECEIPT_KIND_LABEL: Record<ReceiptKind, string> = {
  ninpu: '妊婦健診',
  sanpu: '産婦健診',
  hearing: '新生児聴覚検査',
  vaccine: '予防接種',
  kodomo_iryo: 'こども医療費（県外）',
  other: 'その他',
}

export const RECEIPT_KINDS: ReceiptKind[] = [
  'ninpu',
  'sanpu',
  'hearing',
  'vaccine',
  'kodomo_iryo',
  'other',
]

export const DEADLINE_RULE_LABEL: Record<ReceiptKind, string | null> = {
  ninpu: '最終受診日から1年',
  sanpu: '最終受診日から1年',
  hearing: '最終受診日から1年',
  vaccine: '接種後6か月',
  kodomo_iryo: '受診月の翌月から2年',
  other: null,
}

/**
 * 期限の規定そのものが未確認の種別。
 * こども医療費（県外）の「2年」は、石垣市の公式ページで確認できたので外した（2026-09-29）。
 */
export const DEADLINE_UNCONFIRMED: Record<ReceiptKind, boolean> = {
  ninpu: false,
  sanpu: false,
  hearing: false,
  vaccine: false,
  kodomo_iryo: false,
  other: false,
}

/**
 * 1件の受診日から申請期限を求める。
 * - 健診・聴覚検査：受診日から1年（同じ月日）
 * - 予防接種：接種後6か月（同じ日）
 * - こども医療費：受診月の翌月1日から2年（＝2年後の前月末日）
 */
export function deadlineFor(kind: ReceiptKind, date: Ymd): Ymd | null {
  if (!isValidYmd(date)) return null
  const d = fromYmd(date)
  switch (kind) {
    case 'ninpu':
    case 'sanpu':
    case 'hearing':
      return toYmd(addYears(d, 1))
    case 'vaccine':
      return toYmd(addMonths(d, 6))
    case 'kodomo_iryo':
      return toYmd(subDays(addYears(startOfMonth(addMonths(d, 1)), 2), 1))
    case 'other':
      return null
  }
}

export interface KindDeadline {
  kind: ReceiptKind
  /** 期限の計算に使った日付 */
  basisDate: Ymd
  deadline: Ymd
  rule: string
  unconfirmed: boolean
  count: number
}

/**
 * 種別ごとの申請期限。
 * - 健診・聴覚検査は「最終受診日」起算なので、未申請分のうち最も遅い受診日を使う。
 * - 予防接種・こども医療費は受診ごとに期限が来るので、未申請分のうち最も早い受診日を使う。
 */
export function kindDeadlines(receipts: Receipt[]): KindDeadline[] {
  const out: KindDeadline[] = []
  for (const kind of RECEIPT_KINDS) {
    const rule = DEADLINE_RULE_LABEL[kind]
    if (!rule) continue
    const dates = receipts
      .filter((r) => r.kind === kind && !r.deleted && !r.claimedAt && isValidYmd(r.date))
      .map((r) => r.date)
      .sort()
    if (dates.length === 0) continue
    const useLast = kind === 'ninpu' || kind === 'sanpu' || kind === 'hearing'
    const basisDate = useLast ? dates[dates.length - 1] : dates[0]
    const deadline = deadlineFor(kind, basisDate)
    if (!deadline) continue
    out.push({
      kind,
      basisDate,
      deadline,
      rule,
      unconfirmed: DEADLINE_UNCONFIRMED[kind],
      count: dates.length,
    })
  }
  return out
}

/** 妊婦健診の見込み返金額：実費と上限額の小さい方。上限額が不明なら null。 */
export function expectedRefundYen(amountYen: number, limitYen: number | null): number | null {
  if (limitYen === null) return null
  if (!Number.isFinite(amountYen) || amountYen < 0) return null
  return Math.min(amountYen, limitYen)
}

export interface RefundSummary {
  /** 上限額が分かっている受診票の見込み返金額の合計 */
  totalYen: number
  /** 合計に含めた件数 */
  counted: number
  /** 受診票番号が未選択で合計に含められなかった件数 */
  missingTicket: number
}

export function ninpuRefundSummary(
  receipts: Receipt[],
  limitOf: (ticketNo: string | null) => number | null,
): RefundSummary {
  let totalYen = 0
  let counted = 0
  let missingTicket = 0
  for (const r of receipts) {
    if (r.kind !== 'ninpu' || r.deleted) continue
    const refund = expectedRefundYen(r.amountYen, limitOf(r.ticketNo))
    if (refund === null) {
      missingTicket += 1
    } else {
      totalYen += refund
      counted += 1
    }
  }
  return { totalYen, counted, missingTicket }
}

/** 種別ごとに必要な証憑が揃っているか。 */
export function isReceiptComplete(r: Receipt): boolean {
  switch (r.kind) {
    case 'ninpu':
      return r.hasReceipt && r.hasStatement && r.hasTicketFilled
    case 'sanpu':
      return r.hasReceipt && r.hasStatement && r.hasTicketFilled && r.epdsDone
    case 'vaccine':
      return r.hasReceipt && r.requestLetterObtained
    default:
      return r.hasReceipt
  }
}

export function formatYen(yen: number): string {
  return `${yen.toLocaleString('ja-JP')}円`
}
