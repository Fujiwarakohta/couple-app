import { describe, expect, it } from 'vitest'
import scheduleJson from '../../seed/schedule.json'
import { ADVICE } from '../data/static'
import type { ScheduleEvent, Task } from '../types'
import {
  NOW_TASKS_MAX,
  adviceForWeek,
  homeAdvice,
  isMine,
  nowTasks,
  partnerUpdates,
  urgentItems,
  urgentLabel,
} from './home'

const EDD = '2027-05-24'
const input = { edd: EDD }

function task(partial: Partial<Task>): Task {
  return {
    id: 't001',
    phase: 'p0',
    category: 'procedure',
    owner: '母',
    title: 'タスク',
    dueHint: '',
    dueDate: null,
    status: 'todo',
    doneBy: { father: false, mother: false },
    doneByStored: false,
    note: '',
    deleted: false,
    updatedAt: null,
    updatedBy: null,
    createdBy: 'seed',
    ...partial,
  }
}

function event(partial: Partial<ScheduleEvent>): ScheduleEvent {
  return {
    id: 'e01',
    title: 'イベント',
    window: 0,
    owner: '両',
    type: 'admin',
    updatedAt: null,
    updatedBy: null,
    ...partial,
  }
}

const seedEvents = scheduleJson.events.map((e) => ({ ...e, updatedAt: null, updatedBy: null })) as ScheduleEvent[]

describe('urgentItems：タスク', () => {
  const today = '2027-01-10'

  it('期限が7日以内の未完了タスクを出す（7日後は含む、8日後は含まない）', () => {
    const items = urgentItems(
      [
        task({ id: 't1', dueDate: '2027-01-17' }),
        task({ id: 't2', dueDate: '2027-01-18' }),
        task({ id: 't3', dueDate: '2027-01-10' }),
      ],
      [],
      input,
      today,
    )
    expect(items.map((i) => i.id)).toEqual(['t3', 't1'])
  })

  it('完了・該当なし・削除済み・期限なしは出さない', () => {
    const items = urgentItems(
      [
        task({ id: 't1', dueDate: '2027-01-11', status: 'done' }),
        task({ id: 't2', dueDate: '2027-01-11', status: 'na' }),
        task({ id: 't3', dueDate: '2027-01-11', deleted: true }),
        task({ id: 't4', dueDate: null }),
      ],
      [],
      input,
      today,
    )
    expect(items).toEqual([])
  })

  it('期限超過の未完了タスクは残す', () => {
    const items = urgentItems([task({ id: 't1', dueDate: '2027-01-05', status: 'doing' })], [], input, today)
    expect(items[0]).toMatchObject({ overdue: true, daysLeft: -5 })
    expect(urgentLabel(items[0])).toBe('期限から5日')
  })
})

describe('urgentItems：イベント', () => {
  it('開始が7日以内のイベントを出す', () => {
    // e24 出生届 期限 = EDD+14 = 2027-06-07
    const items = urgentItems([], seedEvents, input, '2027-06-01')
    expect(items.some((i) => i.id === 'e24')).toBe(true)
    const e24 = items.find((i) => i.id === 'e24')
    expect(e24).toMatchObject({ date: '2027-06-07', daysLeft: 6, overdue: false })
  })

  it('critical は期限超過後も残る。済みにすると消える', () => {
    const today = '2027-06-20'
    const items = urgentItems([], seedEvents, input, today)
    const e24 = items.find((i) => i.id === 'e24')
    expect(e24).toMatchObject({ overdue: true, daysLeft: -13 })

    const done = seedEvents.map((e) => (e.id === 'e24' ? { ...e, done: true } : e))
    expect(urgentItems([], done, input, today).some((i) => i.id === 'e24')).toBe(false)
  })

  it('critical でないイベントは期限を過ぎたら消える', () => {
    // e23 出産予定日（critical ではない）
    const items = urgentItems([], seedEvents, input, '2027-05-25')
    expect(items.some((i) => i.id === 'e23')).toBe(false)
  })

  it('期間つきのイベントは、終了が7日以内になったら「期限まで」で出す', () => {
    const e = event({ id: 'x1', date: '2027-01-01', window: 14 }) // 〜01-15
    expect(urgentItems([], [e], input, '2027-01-05')).toEqual([]) // 終了まで10日
    const items = urgentItems([], [e], input, '2027-01-09') // 終了まで6日
    expect(items[0]).toMatchObject({ phase: 'end', date: '2027-01-15', daysLeft: 6 })
    expect(urgentLabel(items[0])).toBe('期限まで6日')
  })

  it('出生日入力後、産後のイベントは出生日基準で判定する', () => {
    const born = { edd: EDD, birthDate: '2027-05-18' }
    const items = urgentItems([], seedEvents, born, '2027-05-28')
    // e24 = 出生日+14 = 2027-06-01
    expect(items.find((i) => i.id === 'e24')).toMatchObject({ date: '2027-06-01', daysLeft: 4 })
  })

  it('2026-09-28 時点では seed のイベントに7日以内のものは無い', () => {
    expect(urgentItems([], seedEvents, input, '2026-09-28')).toEqual([])
  })
})

describe('adviceForWeek', () => {
  it('6週では weeks[0] <= 6 <= weeks[1] のものだけ', () => {
    const items = adviceForWeek(ADVICE, 6)
    expect(items.length).toBeGreaterThan(0)
    for (const a of items) {
      expect(a.weeks[0]).toBeLessThanOrEqual(6)
      expect(a.weeks[1]).toBeGreaterThanOrEqual(6)
    }
    expect(items.some((a) => a.id === 'a01')).toBe(true)
    expect(items.some((a) => a.id === 'a09')).toBe(false) // 8〜20週
  })

  it('レンジの両端を含む', () => {
    expect(adviceForWeek(ADVICE, 8).some((a) => a.id === 'a09')).toBe(true)
    expect(adviceForWeek(ADVICE, 20).some((a) => a.id === 'a09')).toBe(true)
    expect(adviceForWeek(ADVICE, 21).some((a) => a.id === 'a09')).toBe(false)
  })
})

describe('homeAdvice', () => {
  const empty = { read: [], pinned: [] }

  it('最大3件', () => {
    const result = homeAdvice(ADVICE, 6, empty, 'mother')
    expect(result.visible).toHaveLength(3)
    expect(result.moreUnread).toBeGreaterThan(0)
  })

  it('父のログイン時は「父」タグを優先する', () => {
    const result = homeAdvice(ADVICE, 6, empty, 'father')
    expect(result.visible[0].id).toBe('a08')
    const mother = homeAdvice(ADVICE, 6, empty, 'mother')
    expect(mother.visible[0].id).toBe('a01')
  })

  it('ピン留めは最優先、既読はたたむ', () => {
    const result = homeAdvice(ADVICE, 6, { read: ['a01'], pinned: ['a06'] }, 'mother')
    expect(result.visible[0].id).toBe('a06')
    expect(result.visible.some((a) => a.id === 'a01')).toBe(false)
    expect(result.read.map((a) => a.id)).toEqual(['a01'])
  })
})

describe('nowTasks（いまやるタスク）', () => {
  const list = [
    task({ id: 't001', phase: 'p0', owner: '母' }),
    task({ id: 't002', phase: 'p0', owner: '父' }),
    task({ id: 't003', phase: 'p0', owner: '両' }),
    task({ id: 't004', phase: 'p0', owner: '両', status: 'doing', doneBy: { father: false, mother: true } }),
    task({ id: 't005', phase: 'p0', owner: '両', status: 'doing', doneBy: { father: true, mother: false } }),
    task({ id: 't006', phase: 'p0', owner: '父', status: 'done' }),
    task({ id: 't007', phase: 'p0', owner: '父', status: 'na' }),
    task({ id: 't008', phase: 'p0', owner: '父', deleted: true }),
    task({ id: 't009', phase: 'p1', owner: '父' }),
    task({ id: 't010', phase: 'p0', owner: '父', status: 'doing' }),
    task({ id: 't011', phase: 'p0', owner: '父', dueDate: '2026-10-20' }),
  ]

  it('今のフェーズの、自分の担当の未完了タスクだけを出す', () => {
    const r = nowTasks(list, 'p0', 'father', 'mine')
    expect(r.visible.map((t) => t.id)).toEqual(['t004', 't010', 't011', 't002', 't003'])
    expect(r.total).toBe(5)
  })

  it('「両方」のタスクは、自分がチェック済みなら自分の担当から外す', () => {
    expect(isMine(list[4], 'father')).toBe(false)
    expect(isMine(list[4], 'mother')).toBe(true)
    expect(nowTasks(list, 'p0', 'father', 'mine').visible.some((t) => t.id === 't005')).toBe(false)
  })

  it('相手が先にチェックして自分を待っているタスクを先頭にする', () => {
    expect(nowTasks(list, 'p0', 'father', 'mine').visible[0].id).toBe('t004')
    expect(nowTasks(list, 'p0', 'mother', 'mine').visible[0].id).toBe('t005')
  })

  it('母の担当は母にだけ出る', () => {
    const r = nowTasks(list, 'p0', 'mother', 'mine')
    expect(r.visible.map((t) => t.id)).toEqual(['t005', 't001', 't003'])
  })

  it('「2人分」は担当に関係なく出す', () => {
    const r = nowTasks(list, 'p0', 'father', 'all')
    expect(r.total).toBe(7)
    expect(r.visible).toHaveLength(NOW_TASKS_MAX)
  })

  it('「期限まで7日以内」に出ているタスクは除く', () => {
    const r = nowTasks(list, 'p0', 'father', 'mine', new Set(['t011']))
    expect(r.visible.some((t) => t.id === 't011')).toBe(false)
    expect(r.total).toBe(4)
  })

  it('完了・該当なし・削除済み・別のフェーズは出さない', () => {
    const ids = nowTasks(list, 'p0', 'father', 'all').visible.map((t) => t.id)
    for (const id of ['t006', 't007', 't008', 't009']) expect(ids).not.toContain(id)
  })
})

describe('partnerUpdates：担当が「両方」のタスク', () => {
  const now = Date.parse('2027-01-10T12:00:00+09:00')

  it('片方のチェックと、2人そろった完了を言い分ける', () => {
    const result = partnerUpdates(
      [
        task({ id: 't004', owner: '両', status: 'doing', lastAction: 'check', updatedBy: 'mother', updatedAt: now - 1 }),
        task({ id: 't005', owner: '両', status: 'done', lastAction: 'check', updatedBy: 'mother', updatedAt: now - 2 }),
        task({ id: 't011', owner: '両', status: 'todo', lastAction: 'uncheck', updatedBy: 'mother', updatedAt: now - 3 }),
      ],
      'me',
      '妻',
      now,
    )
    expect(result.map((r) => r.text)).toEqual([
      '妻がt004の自分の分を完了にしました',
      '妻がt005を完了にしました（2人とも完了）',
      '妻がt011の完了チェックを外しました',
    ])
  })
})

describe('partnerUpdates', () => {
  const now = Date.parse('2027-01-10T12:00:00+09:00')
  const hour = 60 * 60 * 1000

  it('相手が24時間以内に更新したタスクを新しい順に出す', () => {
    const result = partnerUpdates(
      [
        task({ id: 't042', status: 'done', lastAction: 'status', updatedBy: 'mother', updatedAt: now - 2 * hour }),
        task({ id: 't010', status: 'doing', lastAction: 'status', updatedBy: 'mother', updatedAt: now - hour }),
        task({ id: 't011', status: 'done', updatedBy: 'mother', updatedAt: now - 25 * hour }),
        task({ id: 't012', status: 'done', updatedBy: 'me', updatedAt: now - hour }),
        task({ id: 't013' }),
      ],
      'me',
      '妻',
      now,
    )
    expect(result.map((r) => r.text)).toEqual(['妻がt010を進行中にしました', '妻がt042を完了にしました'])
  })

  it('編集・追加・削除は操作に合わせた文言', () => {
    const result = partnerUpdates(
      [
        task({ id: 't1', status: 'done', lastAction: 'edit', updatedBy: 'father', updatedAt: now - 1 }),
        task({ id: 'u2', lastAction: 'create', updatedBy: 'father', updatedAt: now - 2 }),
        task({ id: 't3', deleted: true, lastAction: 'delete', updatedBy: 'father', updatedAt: now - 3 }),
      ],
      'me',
      '夫',
      now,
    )
    expect(result.map((r) => r.text)).toEqual([
      '夫がt1を編集しました',
      '夫がu2を追加しました',
      '夫がt3を削除しました',
    ])
  })
})
