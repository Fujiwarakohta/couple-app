import { describe, expect, it } from 'vitest'
import { toTask } from '../state/normalize'
import { progressOf } from './tasks'
import {
  BOTH_CHECKED,
  NO_CHECKS,
  checkSummary,
  checkWrite,
  effectiveStatus,
  readDoneBy,
} from './sharedTask'

const base = {
  id: 't004',
  phase: 'p0',
  category: 'procedure',
  title: '両方のタスク',
  dueHint: '',
  dueDate: null,
  note: '',
}

describe('effectiveStatus', () => {
  it('担当が「両方」：2人ともチェックしたときだけ完了', () => {
    expect(effectiveStatus('両', 'todo', NO_CHECKS)).toBe('todo')
    expect(effectiveStatus('両', 'todo', { father: true, mother: false })).toBe('doing')
    expect(effectiveStatus('両', 'todo', { father: false, mother: true })).toBe('doing')
    expect(effectiveStatus('両', 'todo', BOTH_CHECKED)).toBe('done')
  })

  it('保存されている status が古くても、チェックの状態を優先する', () => {
    // 2人が同時にチェックし、どちらも「進行中」で保存した場合
    expect(effectiveStatus('両', 'doing', BOTH_CHECKED)).toBe('done')
    // 片方しかチェックしていないのに「完了」で保存されている場合
    expect(effectiveStatus('両', 'done', { father: true, mother: false })).toBe('doing')
    expect(effectiveStatus('両', 'done', NO_CHECKS)).toBe('todo')
  })

  it('該当なしは、チェックがあっても該当なしのまま', () => {
    expect(effectiveStatus('両', 'na', BOTH_CHECKED)).toBe('na')
  })

  it('担当が父・母のタスクは、今までどおり status で決まる', () => {
    expect(effectiveStatus('母', 'done', NO_CHECKS)).toBe('done')
    expect(effectiveStatus('父', 'todo', BOTH_CHECKED)).toBe('todo')
  })
})

describe('readDoneBy', () => {
  it('保存されている値を読む', () => {
    expect(readDoneBy({ father: true }, 'doing')).toEqual({
      doneBy: { father: true, mother: false },
      stored: true,
    })
  })

  it('doneBy が無い完了済みのタスクは、2人ともチェック済みとして扱う', () => {
    expect(readDoneBy(undefined, 'done')).toEqual({ doneBy: BOTH_CHECKED, stored: false })
    expect(readDoneBy(undefined, 'todo')).toEqual({ doneBy: NO_CHECKS, stored: false })
  })
})

describe('checkWrite', () => {
  const task = (doneBy = NO_CHECKS, doneByStored = true, status = 'todo' as const) => ({
    doneBy,
    doneByStored,
    status,
  })

  it('1人目のチェックでは完了にならない', () => {
    expect(checkWrite(task(), 'father', true)).toEqual({
      doneBy: { father: true },
      status: 'doing',
      action: 'check',
    })
  })

  it('2人目のチェックで完了になる', () => {
    expect(checkWrite(task({ father: true, mother: false }), 'mother', true)).toEqual({
      doneBy: { mother: true },
      status: 'done',
      action: 'check',
    })
  })

  it('片方がチェックを外すと完了ではなくなる', () => {
    expect(checkWrite(task(BOTH_CHECKED), 'father', false)).toEqual({
      doneBy: { father: false },
      status: 'doing',
      action: 'uncheck',
    })
  })

  it('最後のチェックを外すと未着手に戻る', () => {
    expect(checkWrite(task({ father: true, mother: false }), 'father', false).status).toBe('todo')
  })

  it('相手の分は書き込まない', () => {
    const w = checkWrite(task({ father: false, mother: true }), 'father', true)
    expect(Object.keys(w.doneBy)).toEqual(['father'])
  })

  it('doneBy が未保存のタスクは、2人分をまとめて書く（相手の分を失わないため）', () => {
    const w = checkWrite(task(BOTH_CHECKED, false), 'father', false)
    expect(w.doneBy).toEqual({ father: false, mother: true })
  })
})

describe('toTask（読み込み）', () => {
  it('担当が「両方」で片方だけチェック：進行中', () => {
    const t = toTask({ ...base, owner: '両', status: 'todo', doneBy: { mother: true } })
    expect(t.status).toBe('doing')
    expect(t.doneBy).toEqual({ father: false, mother: true })
  })

  it('担当が「両方」で2人ともチェック：完了', () => {
    const t = toTask({ ...base, owner: '両', status: 'doing', doneBy: { father: true, mother: true } })
    expect(t.status).toBe('done')
  })

  it('担当が母：status のまま', () => {
    const t = toTask({ ...base, owner: '母', status: 'done' })
    expect(t.status).toBe('done')
  })

  it('seed のまま（doneBy なし・未着手）：未着手', () => {
    const t = toTask({ ...base, owner: '両', status: 'todo' })
    expect(t.status).toBe('todo')
    expect(t.doneByStored).toBe(false)
  })
})

describe('進捗', () => {
  it('「両方」のタスクは、2人ともチェックするまで完了に数えない', () => {
    const one = toTask({ ...base, id: 'a', owner: '両', status: 'doing', doneBy: { father: true } })
    const both = toTask({ ...base, id: 'b', owner: '両', status: 'done', doneBy: BOTH_CHECKED })
    const single = toTask({ ...base, id: 'c', owner: '父', status: 'done' })
    expect(progressOf([one, both, single])).toEqual({ done: 2, total: 3, percent: 67 })
  })
})

describe('checkSummary', () => {
  it('「父 済・母 未」の形式', () => {
    expect(checkSummary({ father: true, mother: false })).toBe('父 済・母 未')
    expect(checkSummary(BOTH_CHECKED)).toBe('父 済・母 済')
  })
})
