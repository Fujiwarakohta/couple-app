import { describe, expect, it } from 'vitest'
import tasksJson from '../../seed/tasks.json'
import scheduleJson from '../../seed/schedule.json'
import { ADVICE, PHASES } from '../data/static'
import {
  DUE_TEXT_CLASS,
  KIND_BORDER_CLASS,
  KIND_CHIP_CLASS,
  TAG_CLASS,
  TAG_FAMILIES,
  tagFamily,
} from '../data/theme'
import { CONTACTS, matchContacts, noteTemplate, telHref } from '../data/contacts'
import { UNCONFIRMED_TASK_IDS, adviceUnconfirmed, taskUnconfirmed } from '../data/unconfirmed'
import type { ScheduleEvent, Task } from '../types'
import { lifeStage } from './dates'
import { bandsOnDay, buildBands, eventsOnDay, monthGrid, resolveEvents } from './schedule'
import { currentPhaseId, filterTasks, progressOf } from './tasks'

const tasks = tasksJson.map((t) => ({
  ...t,
  doneBy: { father: false, mother: false },
  doneByStored: false,
  deleted: false,
  createdBy: 'seed',
})) as Task[]
const events = scheduleJson.events.map((e) => ({ ...e, updatedAt: null, updatedBy: null })) as ScheduleEvent[]
const EDD = '2027-05-24'

describe('progressOf', () => {
  it('na は分母から除外する', () => {
    const sample = tasks.slice(0, 4).map((t, i) => ({
      ...t,
      status: (['done', 'na', 'todo', 'doing'] as const)[i],
    }))
    expect(progressOf(sample)).toEqual({ done: 1, total: 3, percent: 33 })
  })

  it('削除済みも除外する。分母 0 は 0%', () => {
    expect(progressOf([{ ...tasks[0], deleted: true }])).toEqual({ done: 0, total: 0, percent: 0 })
  })

  it('初期状態は全体 0 / 173', () => {
    expect(progressOf(tasks)).toEqual({ done: 0, total: 173, percent: 0 })
  })
})

describe('filterTasks', () => {
  it('担当・カテゴリで絞り込む', () => {
    expect(filterTasks(tasks, { owner: '父', category: 'all', openOnly: false })).toHaveLength(45)
    expect(filterTasks(tasks, { owner: 'all', category: 'money', openOnly: false })).toHaveLength(30)
  })

  it('未完了のみ', () => {
    const changed = tasks.map((t, i) => (i === 0 ? { ...t, status: 'done' as const } : t))
    expect(filterTasks(changed, { owner: 'all', category: 'all', openOnly: true })).toHaveLength(172)
  })
})

describe('currentPhaseId', () => {
  const at = (today: string, birthDate: string | null = null) =>
    currentPhaseId(lifeStage({ edd: EDD, birthDate }, today))

  it('週数からフェーズを決める（phases.json の when の開始日と一致）', () => {
    expect(at('2026-09-28')).toBe('p0')
    expect(at('2026-10-11')).toBe('p0')
    expect(at('2026-10-12')).toBe('p1')
    expect(at('2026-11-09')).toBe('p2')
    expect(at('2027-01-04')).toBe('p3')
    expect(at('2027-03-01')).toBe('p4')
    expect(at('2027-04-12')).toBe('p5')
  })

  it('産後は出生日から決める', () => {
    expect(at('2027-05-24', '2027-05-24')).toBe('p6')
    expect(at('2027-07-18', '2027-05-24')).toBe('p6')
    expect(at('2027-07-19', '2027-05-24')).toBe('p7')
    expect(at('2028-05-24', '2027-05-24')).toBe('p8')
  })

  it('すべてのフェーズIDが phases.json にある', () => {
    const ids = new Set(PHASES.map((p) => p.id))
    for (const t of tasks) expect(ids.has(t.phase), t.id).toBe(true)
  })
})

describe('未確認の表示', () => {
  it('指定したタスクIDはすべて seed に存在する', () => {
    const ids = new Set(tasks.map((t) => t.id))
    for (const id of UNCONFIRMED_TASK_IDS) expect(ids.has(id), id).toBe(true)
  })

  it('指示書 付録の要確認項目に対応するタスクが未確認になる', () => {
    const byId = new Map(tasks.map((t) => [t.id, t]))
    for (const id of ['t042', 't058', 't059', 't125', 't130']) {
      const t = byId.get(id)
      expect(t && taskUnconfirmed(t.id, t.title), id).not.toBeNull()
    }
  })

  it('本文に「要確認」とあれば未確認になる', () => {
    expect(taskUnconfirmed('u1', '費用は要確認')).not.toBeNull()
    expect(taskUnconfirmed('u1', '葉酸サプリを続ける')).toBeNull()
    expect(
      adviceUnconfirmed({ id: 'x', body: '本文', source: '各航空会社 搭乗条件(要確認)' }),
    ).not.toBeNull()
    expect(adviceUnconfirmed({ id: 'x', body: '本文', source: '出典' })).toBeNull()
    expect(adviceUnconfirmed({ id: 'x', body: '本文', source: '出典', verify: '理由' })).toEqual({
      reason: '理由',
    })
  })
})

describe('色の使い分け', () => {
  it('助言に出てくるタグは、すべて分野が決まっている', () => {
    const tags = new Set(ADVICE.flatMap((a) => a.tags))
    for (const tag of tags) expect(tagFamily(tag), tag).not.toBe('other')
  })

  it('分野ごとに色が違う', () => {
    const classes = TAG_FAMILIES.map((f) => TAG_CLASS[f])
    expect(new Set(classes).size).toBe(classes.length)
  })

  // 「完了」ボタンが緑であることは、実際の画面の色で確認している（scripts/e2e-demo.mjs）
  it('赤は期限を過ぎたものだけ', () => {
    expect(DUE_TEXT_CLASS.overdue).toContain('red')
    expect(DUE_TEXT_CLASS.soon).not.toContain('red')
    // 種類の色・ボタンに赤やオレンジの塗りつぶしを使わない
    for (const c of [...Object.values(KIND_CHIP_CLASS), ...Object.values(KIND_BORDER_CLASS)]) {
      expect(c).not.toMatch(/red|orange/)
    }
  })

  it('種類（タスク・予定・助言）ごとに色が違う', () => {
    const chips = Object.values(KIND_CHIP_CLASS)
    expect(new Set(chips).size).toBe(3)
  })
})

describe('窓口マスタ', () => {
  it('指示書の電話番号', () => {
    const phone = (id: string) => CONTACTS.find((c) => c.id === id)?.phone
    expect(phone('ishigaki-health')).toBe('0980-88-0088')
    expect(phone('ishigaki-kodomo')).toBe('0980-87-0771')
    expect(phone('hakusan-health')).toBe('076-274-2155')
    expect(phone('hakusan-kosodate')).toBe('076-274-9575')
    expect(phone('shonan')).toBeNull()
  })

  it('tel: リンク', () => {
    expect(telHref('0980-88-0088')).toBe('tel:0980880088')
  })

  it('タスク本文から窓口を探す', () => {
    const t024 = tasks.find((t) => t.id === 't024')
    expect(matchContacts(t024?.title ?? '').map((c) => c.id)).toContain('ishigaki-health')
    const t002 = tasks.find((t) => t.id === 't002')
    expect(matchContacts(t002?.title ?? '').map((c) => c.id)).toContain('shonan')
  })

  it('メモの雛形に住所・保険証番号・口座番号の欄は無い', () => {
    const text = noteTemplate(CONTACTS[0], CONTACTS[0].phone)
    expect(text).toContain('窓口：石垣市健康福祉センター')
    expect(text).toContain('電話：0980-88-0088')
    expect(text).not.toMatch(/住所|保険証|口座/)
  })
})

describe('スケジュール', () => {
  const input = { edd: EDD }

  it('seed の 42 件がすべて日付順に並ぶ', () => {
    const resolved = resolveEvents(events, input)
    expect(resolved).toHaveLength(42)
    for (let i = 1; i < resolved.length; i++) {
      expect(resolved[i].range.start >= resolved[i - 1].range.start).toBe(true)
    }
  })

  it('出産予定日のマスに e23 がある', () => {
    const resolved = resolveEvents(events, input)
    expect(eventsOnDay(resolved, EDD).some((r) => r.event.id === 'e23')).toBe(true)
  })

  it('背景の帯：石川滞在・島外出張なし・正期産', () => {
    const bands = buildBands(events, input)
    expect(bands.find((b) => b.kind === 'ishikawa')?.range).toEqual({ start: '2027-04-05', end: '2027-07-08' })
    expect(bands.find((b) => b.kind === 'noTravel')?.range).toEqual({ start: '2027-03-29', end: EDD })
    expect(bands.find((b) => b.kind === 'term')?.range).toEqual({ start: '2027-05-03', end: '2027-06-06' })
    expect(bandsOnDay(bands, '2027-05-10').map((b) => b.kind).sort()).toEqual(['ishikawa', 'noTravel', 'term'])
    expect(bandsOnDay(bands, '2027-01-10')).toEqual([])
  })

  it('EDD を変えると帯も動く', () => {
    const bands = buildBands(events, { edd: '2027-05-31' })
    expect(bands.find((b) => b.kind === 'term')?.range.start).toBe('2027-05-10')
  })

  it('月のマス目は日曜始まりで7の倍数', () => {
    const grid = monthGrid('2027-05-01')
    expect(grid.length % 7).toBe(0)
    expect(grid[0].weekday).toBe(0)
    expect(grid.filter((c) => c.inMonth)).toHaveLength(31)
    expect(grid.find((c) => c.ymd === EDD)?.weekday).toBe(1)
  })
})
