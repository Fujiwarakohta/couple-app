import { addDays, differenceInCalendarDays, differenceInMonths } from 'date-fns'
import type { Ymd } from '../types'

/** 最終月経日から出産予定日までの日数（40週0日）。 */
export const PREGNANCY_DAYS = 280

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const
const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

// date-fns の format / parseISO は容量が大きいので、yyyy-MM-dd の変換だけ自前で行う。

/** 端末のタイムゾーンでの、その日の 0 時。 */
export function fromYmd(ymd: Ymd): Date {
  const m = YMD_PATTERN.exec(ymd)
  if (!m) return new Date(Number.NaN)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function toYmd(date: Date): Ymd {
  const y = String(date.getFullYear()).padStart(4, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 形式が正しく、実在する日付か（2027-02-30 のような日付は不可）。 */
export function isValidYmd(value: unknown): value is Ymd {
  if (typeof value !== 'string' || !YMD_PATTERN.test(value)) return false
  const d = fromYmd(value)
  return !Number.isNaN(d.getTime()) && toYmd(d) === value
}

export function addDaysYmd(ymd: Ymd, days: number): Ymd {
  return toYmd(addDays(fromYmd(ymd), days))
}

/** to − from の日数（暦日）。 */
export function diffDays(to: Ymd, from: Ymd): number {
  return differenceInCalendarDays(fromYmd(to), fromYmd(from))
}

export function eddFromLmp(lmp: Ymd): Ymd {
  return addDaysYmd(lmp, PREGNANCY_DAYS)
}

/** 週数の起算日（0週0日）。EDD を正とし、EDD の 280 日前とする。 */
export function pregnancyStart(edd: Ymd): Ymd {
  return addDaysYmd(edd, -PREGNANCY_DAYS)
}

export interface GestationalAge {
  totalDays: number
  weeks: number
  days: number
}

export function gestationalAge(edd: Ymd, today: Ymd): GestationalAge {
  const totalDays = diffDays(today, pregnancyStart(edd))
  const clamped = Math.max(0, totalDays)
  return { totalDays, weeks: Math.floor(clamped / 7), days: clamped % 7 }
}

/** 出産予定日までの日数。当日は 0、超過後は負の値。 */
export function daysUntilEdd(edd: Ymd, today: Ymd): number {
  return diffDays(edd, today)
}

export interface AgeSinceBirth {
  /** 生後日数。出生当日を 0 日とする。 */
  days: number
  /** 月齢（満）。 */
  months: number
}

export function ageSinceBirth(birthDate: Ymd, today: Ymd): AgeSinceBirth {
  return {
    days: diffDays(today, birthDate),
    months: differenceInMonths(fromYmd(today), fromYmd(birthDate)),
  }
}

export type LifeStage =
  | {
      kind: 'pregnant'
      weeks: number
      days: number
      totalDays: number
      /** 出産予定日までの日数。超過時は負。 */
      daysUntilEdd: number
      overdue: boolean
    }
  | {
      kind: 'born'
      ageDays: number
      ageMonths: number
    }

export interface StageInput {
  edd: Ymd
  birthDate?: Ymd | null
}

/**
 * 妊娠中か産後かを判定する。
 * 出生日が入力済みで、今日が出生日以降なら産後。出生日が未来の日付なら妊娠中として扱う。
 */
export function lifeStage({ edd, birthDate }: StageInput, today: Ymd): LifeStage {
  if (birthDate && isValidYmd(birthDate) && diffDays(today, birthDate) >= 0) {
    const age = ageSinceBirth(birthDate, today)
    return { kind: 'born', ageDays: age.days, ageMonths: age.months }
  }
  const ga = gestationalAge(edd, today)
  const until = daysUntilEdd(edd, today)
  return {
    kind: 'pregnant',
    weeks: ga.weeks,
    days: ga.days,
    totalDays: ga.totalDays,
    daysUntilEdd: until,
    overdue: until < 0,
  }
}

/**
 * アドバイスの出し分けに使う週数。
 * 妊娠中は妊娠週数、産後は 40 + 生後週数（seed の週数レンジが 40 週以降を産後として持つため）。
 */
export function adviceWeek(input: StageInput, today: Ymd): number {
  const stage = lifeStage(input, today)
  if (stage.kind === 'born') return 40 + Math.floor(stage.ageDays / 7)
  return stage.weeks
}

export interface DatedEvent {
  offsetDays?: number
  date?: Ymd
  window?: number
}

export interface EventRange {
  start: Ymd
  end: Ymd
}

/**
 * イベントの絶対日付を求める。
 * - date があればそれを使う。
 * - offsetDays は EDD 基準。ただし出生日が入力済みで offsetDays > 0（産後のイベント）は出生日基準。
 */
export function eventRange(event: DatedEvent, input: StageInput): EventRange | null {
  const window = Math.max(0, event.window ?? 0)
  let start: Ymd | null = null
  if (event.date && isValidYmd(event.date)) {
    start = event.date
  } else if (typeof event.offsetDays === 'number') {
    const useBirth = event.offsetDays > 0 && !!input.birthDate && isValidYmd(input.birthDate)
    const base = useBirth ? (input.birthDate as Ymd) : input.edd
    start = addDaysYmd(base, event.offsetDays)
  }
  if (!start) return null
  return { start, end: addDaysYmd(start, window) }
}

/** `2027-05-24（月）` 形式。 */
export function formatJaDate(ymd: Ymd): string {
  const d = fromYmd(ymd)
  return `${ymd}（${WEEKDAYS[d.getDay()]}）`
}

export function formatJaRange(range: EventRange): string {
  if (range.start === range.end) return formatJaDate(range.start)
  return `${formatJaDate(range.start)}〜${formatJaDate(range.end)}`
}

/** `14週3日` 形式。 */
export function formatWeeks(weeks: number, days: number): string {
  return `${weeks}週${days}日`
}

export function todayYmd(now: Date = new Date()): Ymd {
  return toYmd(now)
}
