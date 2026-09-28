import { describe, expect, it } from 'vitest'
import ninpu from '../../seed/ninpu_limits.json'
import schedule from '../../seed/schedule.json'
import tasks from '../../seed/tasks.json'
import { buildSeedOps, paths } from './seed'
import { ADVICE, NINPU_LIMITS, PHASES, ninpuLimitYen } from './static'
import type { SeedSchedule, SeedTask } from './seed'

describe('seed の件数', () => {
  it('tasks 173 / events 42 / advice 33 / phases 9', () => {
    expect(tasks).toHaveLength(173)
    expect(schedule.events).toHaveLength(42)
    expect(ADVICE).toHaveLength(33)
    expect(PHASES).toHaveLength(9)
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
