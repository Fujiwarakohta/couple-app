import type { AdviceItem, AdviceState, Role, ScheduleEvent, Task, Ymd } from '../types'
import { diffDays, eventRange, type EventRange, type StageInput } from './dates'
import { isOpen } from './tasks'

export const URGENT_DAYS = 7
export const PARTNER_UPDATE_HOURS = 24
export const HOME_ADVICE_MAX = 3

export type UrgentItem =
  | {
      kind: 'task'
      id: string
      task: Task
      date: Ymd
      /** 期限までの日数。超過は負。 */
      daysLeft: number
      overdue: boolean
    }
  | {
      kind: 'event'
      id: string
      event: ScheduleEvent
      range: EventRange
      /** 'start'＝開始が近い / 'end'＝期間の終わり（期限）が近い / 'overdue'＝期限超過 */
      phase: 'start' | 'end' | 'overdue'
      date: Ymd
      daysLeft: number
      overdue: boolean
    }

/**
 * 「期限まで7日以内」の未完了タスクとイベント。
 * - タスク：dueDate が今日から7日以内、または期限超過の未完了分。
 * - イベント：開始日または期間の終了日が今日から7日以内のもの。
 * - critical:true のイベントは、済みにするまで期限超過後も残す。
 */
export function urgentItems(
  tasks: Task[],
  events: ScheduleEvent[],
  input: StageInput,
  today: Ymd,
): UrgentItem[] {
  const out: UrgentItem[] = []

  for (const task of tasks) {
    if (task.deleted || !task.dueDate || !isOpen(task.status)) continue
    const daysLeft = diffDays(task.dueDate, today)
    if (daysLeft > URGENT_DAYS) continue
    out.push({ kind: 'task', id: task.id, task, date: task.dueDate, daysLeft, overdue: daysLeft < 0 })
  }

  for (const event of events) {
    if (event.deleted || event.done) continue
    const range = eventRange(event, input)
    if (!range) continue
    const toStart = diffDays(range.start, today)
    const toEnd = diffDays(range.end, today)

    if (toEnd < 0) {
      if (event.critical) {
        out.push({
          kind: 'event',
          id: event.id,
          event,
          range,
          phase: 'overdue',
          date: range.end,
          daysLeft: toEnd,
          overdue: true,
        })
      }
      continue
    }
    if (toStart >= 0 && toStart <= URGENT_DAYS) {
      out.push({
        kind: 'event',
        id: event.id,
        event,
        range,
        phase: 'start',
        date: range.start,
        daysLeft: toStart,
        overdue: false,
      })
    } else if (toStart < 0 && toEnd <= URGENT_DAYS) {
      out.push({
        kind: 'event',
        id: event.id,
        event,
        range,
        phase: 'end',
        date: range.end,
        daysLeft: toEnd,
        overdue: false,
      })
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

export function urgentLabel(item: UrgentItem): string {
  if (item.overdue) return `期限超過（${Math.abs(item.daysLeft)}日）`
  if (item.daysLeft === 0) {
    return item.kind === 'event' && item.phase === 'start' ? '今日' : '今日まで'
  }
  if (item.kind === 'event' && item.phase === 'start') return `あと${item.daysLeft}日`
  return `期限まで${item.daysLeft}日`
}

export interface HomeAdvice {
  /** 未読で表示するもの（最大3件） */
  visible: AdviceItem[]
  /** 既読でたたむもの */
  read: AdviceItem[]
  /** 未読のうち、件数上限で表示しきれなかった数 */
  moreUnread: number
}

export function adviceForWeek(items: AdviceItem[], week: number): AdviceItem[] {
  return items.filter((a) => week >= a.weeks[0] && week <= a.weeks[1])
}

/**
 * ホームに出す今週のアドバイス。
 * 並び順：ピン留め → （父のログイン時は「父」タグ）→ seed の並び。既読はたたむ。
 */
export function homeAdvice(
  items: AdviceItem[],
  week: number,
  state: AdviceState,
  role: Role | null,
): HomeAdvice {
  const pinned = new Set(state.pinned)
  const readIds = new Set(state.read)
  const score = (a: AdviceItem) =>
    (pinned.has(a.id) ? 0 : 2) + (role === 'father' && a.tags.includes('父') ? 0 : 1)

  const matched = adviceForWeek(items, week)
    .map((a, index) => ({ a, index }))
    .sort((x, y) => score(x.a) - score(y.a) || x.index - y.index)
    .map((x) => x.a)

  const unread = matched.filter((a) => !readIds.has(a.id))
  return {
    visible: unread.slice(0, HOME_ADVICE_MAX),
    read: matched.filter((a) => readIds.has(a.id)),
    moreUnread: Math.max(0, unread.length - HOME_ADVICE_MAX),
  }
}

export interface PartnerUpdate {
  task: Task
  updatedAt: number
  text: string
}

function actionText(task: Task): string {
  switch (task.lastAction) {
    case 'create':
      return 'を追加しました'
    case 'delete':
      return 'を削除しました'
    case 'edit':
      return 'を編集しました'
    case 'check':
      return task.status === 'done'
        ? 'を完了にしました（2人とも完了）'
        : 'の自分の分を完了にしました'
    case 'uncheck':
      return 'の完了チェックを外しました'
    case 'status':
    default:
      break
  }
  switch (task.status) {
    case 'done':
      return 'を完了にしました'
    case 'doing':
      return 'を進行中にしました'
    case 'na':
      return 'を該当なしにしました'
    case 'todo':
      return 'を未着手に戻しました'
  }
}

/** 相手が直近24時間に更新したタスク（「妻がt042を完了にしました」形式）。新しい順。 */
export function partnerUpdates(
  tasks: Task[],
  myUid: string,
  partnerName: string,
  now: number,
): PartnerUpdate[] {
  const since = now - PARTNER_UPDATE_HOURS * 60 * 60 * 1000
  const out: PartnerUpdate[] = []
  for (const task of tasks) {
    if (!task.updatedBy || task.updatedBy === myUid || task.updatedBy === 'seed') continue
    if (typeof task.updatedAt !== 'number' || task.updatedAt < since) continue
    out.push({
      task,
      updatedAt: task.updatedAt,
      text: `${partnerName}が${task.id}${actionText(task)}`,
    })
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}
