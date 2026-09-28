import { describe, expect, it } from 'vitest'
import { ninpuLimitYen } from '../data/static'
import type { Receipt } from '../types'
import {
  deadlineFor,
  expectedRefundYen,
  formatYen,
  isReceiptComplete,
  kindDeadlines,
  ninpuRefundSummary,
} from './receipts'

function receipt(partial: Partial<Receipt>): Receipt {
  return {
    id: 'r1',
    kind: 'ninpu',
    date: '2027-04-20',
    facility: '松南病院',
    amountYen: 0,
    ticketNo: null,
    hasReceipt: false,
    hasStatement: false,
    hasTicketFilled: false,
    epdsDone: false,
    requestLetterObtained: false,
    deadline: null,
    claimedAt: null,
    updatedBy: null,
    ...partial,
  }
}

describe('deadlineFor', () => {
  it('健診・聴覚検査は受診日から1年', () => {
    expect(deadlineFor('ninpu', '2027-05-20')).toBe('2028-05-20')
    expect(deadlineFor('sanpu', '2027-06-23')).toBe('2028-06-23')
    expect(deadlineFor('hearing', '2027-05-27')).toBe('2028-05-27')
  })

  it('予防接種は接種後6か月', () => {
    expect(deadlineFor('vaccine', '2027-07-24')).toBe('2028-01-24')
  })

  it('予防接種：月末の繰り上がりは月末に丸める', () => {
    expect(deadlineFor('vaccine', '2027-08-31')).toBe('2028-02-29')
  })

  it('こども医療費は受診月の翌月から2年', () => {
    expect(deadlineFor('kodomo_iryo', '2027-06-10')).toBe('2029-06-30')
    expect(deadlineFor('kodomo_iryo', '2027-06-30')).toBe('2029-06-30')
    expect(deadlineFor('kodomo_iryo', '2027-12-05')).toBe('2029-12-31')
  })

  it('その他・不正な日付は期限なし', () => {
    expect(deadlineFor('other', '2027-06-10')).toBeNull()
    expect(deadlineFor('ninpu', '')).toBeNull()
  })
})

describe('kindDeadlines', () => {
  it('健診は最終受診日、予防接種は最も早い接種日を起算にする', () => {
    const result = kindDeadlines([
      receipt({ id: 'a', kind: 'ninpu', date: '2027-04-20' }),
      receipt({ id: 'b', kind: 'ninpu', date: '2027-05-18' }),
      receipt({ id: 'c', kind: 'vaccine', date: '2027-07-24' }),
      receipt({ id: 'd', kind: 'vaccine', date: '2027-08-21' }),
    ])
    expect(result.find((r) => r.kind === 'ninpu')).toMatchObject({
      basisDate: '2027-05-18',
      deadline: '2028-05-18',
      count: 2,
    })
    expect(result.find((r) => r.kind === 'vaccine')).toMatchObject({
      basisDate: '2027-07-24',
      deadline: '2028-01-24',
    })
  })

  it('申請済み・削除済みは除く', () => {
    const result = kindDeadlines([
      receipt({ id: 'a', kind: 'sanpu', date: '2027-06-07', claimedAt: '2027-08-01' }),
      receipt({ id: 'b', kind: 'hearing', date: '2027-05-27', deleted: true }),
    ])
    expect(result).toEqual([])
  })

  it('こども医療費の期限は未確認として扱う', () => {
    const result = kindDeadlines([receipt({ kind: 'kodomo_iryo', date: '2027-06-10' })])
    expect(result[0].unconfirmed).toBe(true)
  })
})

describe('見込み返金額', () => {
  it('実費と上限の小さい方', () => {
    expect(expectedRefundYen(6000, 5490)).toBe(5490)
    expect(expectedRefundYen(4000, 5490)).toBe(4000)
    expect(expectedRefundYen(5490, 5490)).toBe(5490)
  })

  it('上限額が不明なら計算しない', () => {
    expect(expectedRefundYen(6000, null)).toBeNull()
  })

  it('合計は上限額が分かるものだけを足す', () => {
    const summary = ninpuRefundSummary(
      [
        receipt({ id: 'a', ticketNo: '9-8', amountYen: 6000 }), // 上限 5,090
        receipt({ id: 'b', ticketNo: '9-9', amountYen: 4500 }), // 実費 4,500
        receipt({ id: 'c', ticketNo: null, amountYen: 7000 }), // 番号未選択
        receipt({ id: 'd', kind: 'sanpu', amountYen: 5000 }), // 対象外
        receipt({ id: 'e', ticketNo: '9-7', amountYen: 9000, deleted: true }),
      ],
      ninpuLimitYen,
    )
    expect(summary).toEqual({ totalYen: 5090 + 4500, counted: 2, missingTicket: 1 })
  })
})

describe('isReceiptComplete', () => {
  it('妊婦健診は3点セット', () => {
    expect(isReceiptComplete(receipt({ hasReceipt: true, hasStatement: true }))).toBe(false)
    expect(
      isReceiptComplete(receipt({ hasReceipt: true, hasStatement: true, hasTicketFilled: true })),
    ).toBe(true)
  })

  it('産婦健診は3点セット + EPDS', () => {
    const base = { kind: 'sanpu' as const, hasReceipt: true, hasStatement: true, hasTicketFilled: true }
    expect(isReceiptComplete(receipt(base))).toBe(false)
    expect(isReceiptComplete(receipt({ ...base, epdsDone: true }))).toBe(true)
  })

  it('予防接種は領収書 + 依頼書', () => {
    expect(isReceiptComplete(receipt({ kind: 'vaccine', hasReceipt: true }))).toBe(false)
    expect(
      isReceiptComplete(receipt({ kind: 'vaccine', hasReceipt: true, requestLetterObtained: true })),
    ).toBe(true)
  })
})

describe('formatYen', () => {
  it('3桁区切り', () => {
    expect(formatYen(24460)).toBe('24,460円')
  })
})
