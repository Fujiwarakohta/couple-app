import type { LifeStage } from './dates'
import type { Owner, Task, TaskCategory, TaskStatus } from '../types'

export interface Progress {
  done: number
  /** 分母。na（該当なし）と削除済みは含めない。 */
  total: number
  /** 0〜100 の整数。分母が 0 のときは 0。 */
  percent: number
}

export function progressOf(tasks: Task[]): Progress {
  let done = 0
  let total = 0
  for (const t of tasks) {
    if (t.deleted || t.status === 'na') continue
    total += 1
    if (t.status === 'done') done += 1
  }
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export interface TaskFilter {
  owner: Owner | 'all'
  category: TaskCategory | 'all'
  openOnly: boolean
}

export const DEFAULT_TASK_FILTER: TaskFilter = { owner: 'all', category: 'all', openOnly: false }

export function isOpen(status: TaskStatus): boolean {
  return status === 'todo' || status === 'doing'
}

export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  return tasks.filter((t) => {
    if (t.deleted) return false
    if (filter.owner !== 'all' && t.owner !== filter.owner) return false
    if (filter.category !== 'all' && t.category !== filter.category) return false
    if (filter.openOnly && !isOpen(t.status)) return false
    return true
  })
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
}

/**
 * 現在のフェーズ。週数の区切りは seed/phases.json の title の記載による
 * （p0:〜7週 / p1:8〜11週 / p2:12〜19週 / p3:20〜27週 / p4:28〜33週 / p5:34週〜出産 /
 *   p6:産後0〜8週 / p7:産後8週〜1歳 / p8:復職前後）。
 */
export function currentPhaseId(stage: LifeStage): string {
  if (stage.kind === 'born') {
    if (stage.ageDays < 56) return 'p6'
    if (stage.ageMonths < 12) return 'p7'
    return 'p8'
  }
  const w = stage.weeks
  if (w < 8) return 'p0'
  if (w < 12) return 'p1'
  if (w < 20) return 'p2'
  if (w < 28) return 'p3'
  if (w < 34) return 'p4'
  return 'p5'
}

/** ユーザーが追加するタスクのID。seed の t001〜 と衝突しないよう接頭辞を変える。 */
export function newTaskId(random: string): string {
  return `u${random}`
}
