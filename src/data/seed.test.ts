import { describe, expect, it } from 'vitest'
import ninpu from '../../seed/ninpu_limits.json'
import schedule from '../../seed/schedule.json'
import tasks from '../../seed/tasks.json'
import { buildSeedOps, paths } from './seed'
import advice from '../../seed/advice.json'
import {
  ADVICE,
  GUIDE_ADVICE,
  NINPU_LIMITS,
  PHASES,
  SEED_ADVICE,
  ninpuLimitYen,
} from './static'
import type { SeedSchedule, SeedTask } from './seed'

describe('seed の件数', () => {
  it('tasks 173 / events 42 / advice 33 / phases 9', () => {
    expect(tasks).toHaveLength(173)
    expect(schedule.events).toHaveLength(42)
    expect(SEED_ADVICE).toHaveLength(33)
    expect(PHASES).toHaveLength(9)
  })
})

describe('追加したアドバイス（advice_guide.json）', () => {
  it('元の advice.json の33件は、内容も順序もそのまま', () => {
    expect(SEED_ADVICE).toEqual(advice.items)
    expect(ADVICE.slice(0, 33)).toEqual(advice.items)
  })

  it('25件を追加し、元の項目の後ろに並べる', () => {
    expect(GUIDE_ADVICE).toHaveLength(25)
    expect(ADVICE).toHaveLength(33 + 25)
    expect(ADVICE.slice(33)).toEqual(GUIDE_ADVICE)
  })

  it('ID が重複しない', () => {
    const ids = ADVICE.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('すべての項目に出典・本文・タグ・週数がある', () => {
    for (const a of GUIDE_ADVICE) {
      expect(a.source, a.id).toContain('調査報告書')
      expect(a.title.length, a.id).toBeGreaterThan(0)
      expect(a.body.length, a.id).toBeGreaterThan(0)
      expect(a.tags.length, a.id).toBeGreaterThan(0)
      expect(a.weeks[0], a.id).toBeLessThanOrEqual(a.weeks[1])
    }
  })

  it('数値は報告書の値のまま', () => {
    const body = (id: string) => GUIDE_ADVICE.find((a) => a.id === id)?.body ?? ''
    expect(body('g01')).toContain('400μg')
    expect(body('g01')).toContain('1,000μg/日')
    expect(body('g02')).toContain('+50kcal/日')
    expect(body('g02')).toContain('+250kcal/日')
    expect(body('g02')).toContain('+450kcal/日')
    expect(body('g09')).toContain('+2.0mg/日')
    expect(body('g10')).toContain('9.0μg/日')
    expect(body('g11')).toContain('約20倍')
    expect(body('g13')).toContain('0.4〜1%')
    expect(body('g13')).toContain('15〜20秒')
    expect(body('g14')).toContain('2,000μg/日')
    expect(body('g21')).toContain('玉露160mg')
    expect(body('g21')).toContain('コーヒー60mg')
    expect(body('g23')).toContain('16週未満')
    expect(body('g24')).toContain('28週0日から36週6日')
  })

  it('既存の項目と記載が異なるものは、未確認として理由を持つ', () => {
    const verify = (id: string) => GUIDE_ADVICE.find((a) => a.id === id)?.verify ?? ''
    expect(verify('g21')).toContain('既存の項目')
    expect(verify('g24')).toContain('既存の項目')
    expect(verify('g14')).toContain('既存の項目')
  })

  it('公的機関・学会の資料が出典にない項目は、未確認にしている', () => {
    const official = /厚生労働省|食品安全委員会|こども家庭庁|学会|医会|コンセンサスガイド/
    for (const a of GUIDE_ADVICE) {
      if (!official.test(a.source)) expect(a.verify, a.id).toBeTruthy()
    }
  })
})

describe('buildSeedOps', () => {
  const ops = buildSeedOps(tasks as SeedTask[], schedule as SeedSchedule)

  it('世帯1 + タスク173 + イベント42 を書き込む（Firestore の一括書き込み上限 500 以内）', () => {
    expect(ops).toHaveLength(1 + 173 + 42)
    expect(ops.length).toBeLessThanOrEqual(500)
  })

  it('settings.edd / lmp は schedule.json の値', () => {
    const household = ops.find((o) => o.path === paths.household)
    expect(household?.data.settings).toMatchObject({ edd: '2027-05-24', lmp: '2026-08-17', birthDate: null })
  })

  it('タスクは seed の値を書き換えずに投入する', () => {
    for (const t of tasks) {
      const op = ops.find((o) => o.path === `${paths.tasks}/${t.id}`)
      expect(op, t.id).toBeDefined()
      const { id: _id, ...rest } = t
      expect(op?.data).toEqual({ ...rest, deleted: false, createdBy: 'seed' })
    }
  })

  it('イベントは seed の値を書き換えずに投入する', () => {
    for (const e of schedule.events) {
      const op = ops.find((o) => o.path === `${paths.events}/${e.id}`)
      expect(op, e.id).toBeDefined()
      const { id: _id, ...rest } = e
      expect(op?.data).toEqual({ ...rest, updatedAt: null, updatedBy: null })
    }
  })
})

describe('妊婦健診の上限額', () => {
  it('受診票 1〜5、9-1〜9-9 と抗体検査2種がある', () => {
    expect(ninpu.tickets.map((t) => t.ticketNo)).toEqual([
      '1', '2', '3', '4', '5',
      '9-1', '9-2', '9-3', '9-4', '9-5', '9-6', '9-7', '9-8', '9-9',
    ])
    expect(NINPU_LIMITS).toHaveLength(16)
  })

  it('利用者から受領した値と一致する', () => {
    const expected: Record<string, number> = {
      '1': 24460,
      '2': 8970,
      '3': 10940,
      '4': 10830,
      '5': 17630,
      '9-1': 5490,
      '9-2': 10270,
      '9-3': 5490,
      '9-4': 9870,
      '9-5': 5490,
      '9-6': 9870,
      '9-7': 5490,
      '9-8': 5090,
      '9-9': 5090,
      'ab-hiv-rubella-chlamydia': 6180,
      'ab-htlv1': 3030,
    }
    for (const [ticketNo, yen] of Object.entries(expected)) {
      expect(ninpuLimitYen(ticketNo), ticketNo).toBe(yen)
    }
  })

  it('未設定・不明な番号は null', () => {
    expect(ninpuLimitYen(null)).toBeNull()
    expect(ninpuLimitYen('10')).toBeNull()
  })
})
