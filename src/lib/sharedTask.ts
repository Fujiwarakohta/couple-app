import type { DoneBy, Owner, Role, Task, TaskAction, TaskStatus } from '../types'

/**
 * 担当が「両方」のタスクの完了チェック。
 * 父・母がそれぞれ自分の分をチェックし、2人ともチェックしたときだけ「完了」になる。
 *
 * 完了かどうかは、保存してある status ではなく doneBy から毎回求める。
 * 2人が同時に（あるいはオフライン中に）チェックしても、結果がずれないようにするため。
 */

export const NO_CHECKS: DoneBy = { father: false, mother: false }
export const BOTH_CHECKED: DoneBy = { father: true, mother: true }

export function isShared(owner: Owner): boolean {
  return owner === '両'
}

export function bothChecked(doneBy: DoneBy): boolean {
  return doneBy.father && doneBy.mother
}

export function anyChecked(doneBy: DoneBy): boolean {
  return doneBy.father || doneBy.mother
}

/**
 * 保存されている doneBy を読む。
 * doneBy がまだ無いタスク（この仕組みを入れる前に完了にしたもの）は、
 * 完了済みなら「2人ともチェック済み」として扱う。
 */
export function readDoneBy(raw: unknown, storedStatus: TaskStatus): { doneBy: DoneBy; stored: boolean } {
  if (raw && typeof raw === 'object') {
    const v = raw as Record<string, unknown>
    return { doneBy: { father: v.father === true, mother: v.mother === true }, stored: true }
  }
  return { doneBy: storedStatus === 'done' ? BOTH_CHECKED : NO_CHECKS, stored: false }
}

/** 画面に出すステータス。担当が「両方」のときは完了チェックから求める。 */
export function effectiveStatus(owner: Owner, storedStatus: TaskStatus, doneBy: DoneBy): TaskStatus {
  if (!isShared(owner)) return storedStatus
  if (storedStatus === 'na') return 'na'
  if (bothChecked(doneBy)) return 'done'
  if (anyChecked(doneBy)) return 'doing'
  // チェックが無いのに「完了」で保存されている場合は、完了にしない
  return storedStatus === 'done' ? 'todo' : storedStatus
}

export interface CheckWrite {
  doneBy: Partial<DoneBy>
  status: TaskStatus
  action: TaskAction
}

/** 自分の完了チェックを付ける／外すときに保存する内容。 */
export function checkWrite(
  task: Pick<Task, 'doneBy' | 'doneByStored' | 'status'>,
  role: Role,
  checked: boolean,
): CheckWrite {
  const next: DoneBy = { ...task.doneBy, [role]: checked }
  const status: TaskStatus = bothChecked(next)
    ? 'done'
    : anyChecked(next)
      ? 'doing'
      : task.status === 'doing'
        ? 'doing'
        : 'todo'
  return {
    // 相手の分は書き換えない（同時に操作しても相手のチェックを消さないため）。
    // doneBy がまだ保存されていないタスクだけ、2人分をまとめて書く。
    doneBy: task.doneByStored ? { [role]: checked } : next,
    status,
    action: checked ? 'check' : 'uncheck',
  }
}

const ROLE_NAME: Record<Role, string> = { father: '父', mother: '母' }

/** 「父 済・母 未」の形式。 */
export function checkSummary(doneBy: DoneBy): string {
  const mark = (v: boolean) => (v ? '済' : '未')
  return `${ROLE_NAME.father} ${mark(doneBy.father)}・${ROLE_NAME.mother} ${mark(doneBy.mother)}`
}
