import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { ScheduleEvent, Ymd } from '../types'
import { addDaysYmd, eventRange, fromYmd, toYmd, type EventRange, type StageInput } from './dates'

export interface ResolvedEvent {
  event: ScheduleEvent
  range: EventRange
}

export function resolveEvents(events: ScheduleEvent[], input: StageInput): ResolvedEvent[] {
  const out: ResolvedEvent[] = []
  for (const event of events) {
    if (event.deleted) continue
    const range = eventRange(event, input)
    if (range) out.push({ event, range })
  }
  return out.sort(
    (a, b) => a.range.start.localeCompare(b.range.start) || a.event.id.localeCompare(b.event.id),
  )
}

export function overlaps(range: EventRange, from: Ymd, to: Ymd): boolean {
  return range.start <= to && range.end >= from
}

export function eventsOnDay(resolved: ResolvedEvent[], day: Ymd): ResolvedEvent[] {
  return resolved.filter((r) => overlaps(r.range, day, day))
}

export type BandKind = 'ishikawa' | 'noTravel' | 'term'

export interface Band {
  kind: BandKind
  label: string
  range: EventRange
  /** 期間の決め方（画面に注記として出す） */
  basis: string
}

export const BAND_CLASS: Record<BandKind, string> = {
  ishikawa: 'bg-violet-100 dark:bg-violet-950',
  noTravel: 'bg-amber-100 dark:bg-amber-950',
  term: 'bg-teal-100 dark:bg-teal-950',
}

/** 正期産は 37週0日〜41週6日（EDD-21 〜 EDD+13）。開始日は seed の e22 と同じ。 */
const TERM_END_OFFSET = 13

/**
 * 背景の帯。期間は seed のイベント（e16 / e18 / e22 / e29）から求めるので、
 * EDD を変更したりイベントの日付を編集したりすると帯も連動する。
 */
export function buildBands(events: ScheduleEvent[], input: StageInput): Band[] {
  const byId = new Map(events.filter((e) => !e.deleted).map((e) => [e.id, e]))
  const rangeOf = (id: string) => {
    const e = byId.get(id)
    return e ? eventRange(e, input) : null
  }
  const bands: Band[] = []
  const birthOrEdd = input.birthDate ?? input.edd

  const goHome = rangeOf('e18')
  const comeBack = rangeOf('e29')
  if (goHome && comeBack && goHome.start <= comeBack.start) {
    bands.push({
      kind: 'ishikawa',
      label: '石川滞在',
      range: { start: goHome.start, end: comeBack.start },
      basis: '帰省（e18）の開始日〜帰島（e29・仮置き）の開始日',
    })
  }

  const noTravel = rangeOf('e16')
  if (noTravel && noTravel.start <= birthOrEdd) {
    bands.push({
      kind: 'noTravel',
      label: '島外出張なし期間',
      range: { start: noTravel.start, end: birthOrEdd },
      basis: input.birthDate
        ? '島外出張なし開始（e16）〜出生日'
        : '島外出張なし開始（e16）〜出産予定日',
    })
  }

  const term = rangeOf('e22')
  if (term) {
    bands.push({
      kind: 'term',
      label: '正期産期間',
      range: { start: term.start, end: addDaysYmd(input.edd, TERM_END_OFFSET) },
      basis: '正期産開始（e22・37週0日）〜41週6日',
    })
  }

  return bands
}

export function bandsOnDay(bands: Band[], day: Ymd): Band[] {
  return bands.filter((b) => overlaps(b.range, day, day))
}

export interface MonthCell {
  ymd: Ymd
  day: number
  inMonth: boolean
  weekday: number
}

/** 月カレンダーのマス目（日曜始まり、週単位で前後の月を含む）。 */
export function monthGrid(month: Ymd): MonthCell[] {
  const first = startOfMonth(fromYmd(month))
  const days = eachDayOfInterval({
    start: startOfWeek(first, { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(first), { weekStartsOn: 0 }),
  })
  return days.map((d) => ({
    ymd: toYmd(d),
    day: d.getDate(),
    inMonth: d.getMonth() === first.getMonth(),
    weekday: d.getDay(),
  }))
}

export function monthDays(month: Ymd): Ymd[] {
  const first = startOfMonth(fromYmd(month))
  return eachDayOfInterval({ start: first, end: endOfMonth(first) }).map(toYmd)
}

export function shiftMonth(month: Ymd, delta: number): Ymd {
  return toYmd(startOfMonth(addMonths(fromYmd(month), delta)))
}

export function monthStart(ymd: Ymd): Ymd {
  return toYmd(startOfMonth(fromYmd(ymd)))
}

export function formatMonth(month: Ymd): string {
  const d = fromYmd(month)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

/** 日付の範囲を1日ずつ列挙する（上限つき）。 */
export function eachYmd(from: Ymd, to: Ymd, max = 366): Ymd[] {
  if (from > to) return []
  const out: Ymd[] = []
  let cur = from
  while (cur <= to && out.length < max) {
    out.push(cur)
    cur = addDaysYmd(cur, 1)
  }
  return out
}
