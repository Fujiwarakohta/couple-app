import { describe, expect, it } from 'vitest'
import schedule from '../../seed/schedule.json'
import {
  addDaysYmd,
  adviceWeek,
  ageSinceBirth,
  daysUntilEdd,
  eddFromLmp,
  eventRange,
  formatJaDate,
  formatJaRange,
  formatWeeks,
  gestationalAge,
  isValidYmd,
  lifeStage,
  pregnancyStart,
} from './dates'

const EDD = '2027-05-24'
const LMP = '2026-08-17'

describe('seed の基準日', () => {
  it('seed の EDD は LMP + 280日と一致する', () => {
    expect(schedule.edd).toBe(EDD)
    expect(schedule.lmp).toBe(LMP)
    expect(eddFromLmp(LMP)).toBe(EDD)
    expect(pregnancyStart(EDD)).toBe(LMP)
  })
})

describe('gestationalAge', () => {
  it('起算日は 0週0日', () => {
    expect(gestationalAge(EDD, LMP)).toEqual({ totalDays: 0, weeks: 0, days: 0 })
  })

  it('2026-09-28 は 6週0日', () => {
    expect(gestationalAge(EDD, '2026-09-28')).toMatchObject({ weeks: 6, days: 0 })
  })

  it('週の境界：6日目と7日目', () => {
    expect(gestationalAge(EDD, addDaysYmd(LMP, 6))).toMatchObject({ weeks: 0, days: 6 })
    expect(gestationalAge(EDD, addDaysYmd(LMP, 7))).toMatchObject({ weeks: 1, days: 0 })
  })

  it('14週3日', () => {
    expect(gestationalAge(EDD, addDaysYmd(LMP, 14 * 7 + 3))).toMatchObject({ weeks: 14, days: 3 })
  })

  it('seed の節目と一致する（34週0日＝EDD-42、37週0日＝EDD-21）', () => {
    expect(gestationalAge(EDD, addDaysYmd(EDD, -42))).toMatchObject({ weeks: 34, days: 0 })
    expect(gestationalAge(EDD, addDaysYmd(EDD, -21))).toMatchObject({ weeks: 37, days: 0 })
    expect(addDaysYmd(EDD, -21)).toBe('2027-05-03')
  })

  it('起算日より前は 0週0日に丸める（totalDays は負のまま返す）', () => {
    expect(gestationalAge(EDD, addDaysYmd(LMP, -3))).toEqual({ totalDays: -3, weeks: 0, days: 0 })
  })

  it('EDD を変更すると週数も変わる', () => {
    const newEdd = addDaysYmd(EDD, 7)
    expect(gestationalAge(newEdd, '2026-09-28')).toMatchObject({ weeks: 5, days: 0 })
  })
})

describe('境界：EDD 当日', () => {
  it('40週0日、残り0日、超過ではない', () => {
    const stage = lifeStage({ edd: EDD }, EDD)
    expect(stage).toEqual({
      kind: 'pregnant',
      weeks: 40,
      days: 0,
      totalDays: 280,
      daysUntilEdd: 0,
      overdue: false,
    })
  })

  it('前日は 39週6日、残り1日', () => {
    const stage = lifeStage({ edd: EDD }, '2027-05-23')
    expect(stage).toMatchObject({ kind: 'pregnant', weeks: 39, days: 6, daysUntilEdd: 1, overdue: false })
  })
})

describe('境界：EDD 超過', () => {
  it('翌日は 40週1日、超過1日', () => {
    const stage = lifeStage({ edd: EDD }, '2027-05-25')
    expect(stage).toMatchObject({ kind: 'pregnant', weeks: 40, days: 1, daysUntilEdd: -1, overdue: true })
  })

  it('出生日が未入力なら 41週6日になっても妊娠中のまま', () => {
    const stage = lifeStage({ edd: EDD, birthDate: null }, addDaysYmd(EDD, 13))
    expect(stage).toMatchObject({ kind: 'pregnant', weeks: 41, days: 6, overdue: true })
    expect(daysUntilEdd(EDD, addDaysYmd(EDD, 13))).toBe(-13)
  })
})

describe('境界：出生日入力後の切替', () => {
  it('出生当日は生後0日・0か月', () => {
    expect(lifeStage({ edd: EDD, birthDate: '2027-05-20' }, '2027-05-20')).toEqual({
      kind: 'born',
      ageDays: 0,
      ageMonths: 0,
    })
  })

  it('出生日の前日はまだ妊娠中', () => {
    const stage = lifeStage({ edd: EDD, birthDate: '2027-05-20' }, '2027-05-19')
    expect(stage.kind).toBe('pregnant')
  })

  it('EDD より前に生まれても、EDD を超過して生まれても産後に切り替わる', () => {
    expect(lifeStage({ edd: EDD, birthDate: '2027-05-10' }, '2027-05-24')).toMatchObject({
      kind: 'born',
      ageDays: 14,
    })
    expect(lifeStage({ edd: EDD, birthDate: '2027-05-30' }, '2027-05-31')).toMatchObject({
      kind: 'born',
      ageDays: 1,
    })
  })

  it('月齢は満で数える', () => {
    expect(ageSinceBirth('2027-05-24', '2027-06-23')).toEqual({ days: 30, months: 0 })
    expect(ageSinceBirth('2027-05-24', '2027-06-24')).toEqual({ days: 31, months: 1 })
    expect(ageSinceBirth('2027-05-24', '2028-05-24')).toEqual({ days: 366, months: 12 })
  })

  it('不正な出生日は無視する', () => {
    expect(lifeStage({ edd: EDD, birthDate: 'abc' }, '2027-05-25').kind).toBe('pregnant')
  })
})

describe('adviceWeek', () => {
  it('妊娠中は妊娠週数', () => {
    expect(adviceWeek({ edd: EDD }, '2026-09-28')).toBe(6)
  })

  it('産後は 40 + 生後週数', () => {
    expect(adviceWeek({ edd: EDD, birthDate: '2027-05-10' }, '2027-05-10')).toBe(40)
    expect(adviceWeek({ edd: EDD, birthDate: '2027-05-10' }, '2027-05-17')).toBe(41)
  })
})

describe('eventRange', () => {
  it('offsetDays は EDD 基準で絶対日付になる', () => {
    expect(eventRange({ offsetDays: -197, window: 14 }, { edd: EDD })).toEqual({
      start: '2026-11-08',
      end: '2026-11-22',
    })
    expect(eventRange({ offsetDays: 0, window: 0 }, { edd: EDD })).toEqual({ start: EDD, end: EDD })
  })

  it('EDD を変えると再計算される', () => {
    expect(eventRange({ offsetDays: -42, window: 0 }, { edd: '2027-05-31' })?.start).toBe('2027-04-19')
  })

  it('出生日入力後、産後イベント（offsetDays > 0）は出生日基準になる', () => {
    const input = { edd: EDD, birthDate: '2027-05-18' }
    expect(eventRange({ offsetDays: 14, window: 0 }, input)?.start).toBe('2027-06-01')
    expect(eventRange({ offsetDays: 15, window: 0 }, input)?.start).toBe('2027-06-02')
  })

  it('出生日入力後も、産前イベントと予定日そのものは EDD 基準のまま', () => {
    const input = { edd: EDD, birthDate: '2027-05-18' }
    expect(eventRange({ offsetDays: -21, window: 0 }, input)?.start).toBe('2027-05-03')
    expect(eventRange({ offsetDays: 0, window: 0 }, input)?.start).toBe(EDD)
  })

  it('絶対日付のイベントは EDD の影響を受けない', () => {
    expect(eventRange({ date: '2027-01-15', window: 2 }, { edd: '2027-06-01' })).toEqual({
      start: '2027-01-15',
      end: '2027-01-17',
    })
  })

  it('日付を決められないイベントは null', () => {
    expect(eventRange({ window: 0 }, { edd: EDD })).toBeNull()
  })

  it('seed の全イベントが日付に変換できる', () => {
    for (const e of schedule.events) {
      const range = eventRange(e, { edd: schedule.edd })
      expect(range, e.id).not.toBeNull()
    }
  })
})

describe('表示形式', () => {
  it('日付は 2027-05-24（月）形式', () => {
    expect(formatJaDate('2027-05-24')).toBe('2027-05-24（月）')
    expect(formatJaDate('2026-09-28')).toBe('2026-09-28（月）')
  })

  it('期間', () => {
    expect(formatJaRange({ start: '2027-05-24', end: '2027-05-24' })).toBe('2027-05-24（月）')
    expect(formatJaRange({ start: '2027-04-05', end: '2027-04-18' })).toBe(
      '2027-04-05（月）〜2027-04-18（日）',
    )
  })

  it('週数は 14週3日形式', () => {
    expect(formatWeeks(14, 3)).toBe('14週3日')
  })

  it('isValidYmd', () => {
    expect(isValidYmd('2027-05-24')).toBe(true)
    expect(isValidYmd('2027-02-30')).toBe(false)
    expect(isValidYmd('2027/05/24')).toBe(false)
    expect(isValidYmd(null)).toBe(false)
  })
})
