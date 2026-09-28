import scheduleJson from '../../seed/schedule.json'
import { SERVER_TIME, type Backend, type BackendError, type WriteOp } from '../lib/backend'
import type { EventType, Owner, Settings, TaskCategory, TaskStatus, Ymd } from '../types'

// seed JSON の型定義と、初回投入のロジック。
// 静的にバンドルする advice / phases / 上限額は static.ts にある。

/** 1世帯のみなので固定文字列。 */
export const HOUSEHOLD_ID = 'main'
export const HOUSEHOLD_PATH = `households/${HOUSEHOLD_ID}`

export const paths = {
  household: HOUSEHOLD_PATH,
  tasks: `${HOUSEHOLD_PATH}/tasks`,
  events: `${HOUSEHOLD_PATH}/events`,
  presence: `${HOUSEHOLD_PATH}/presence`,
  records: `${HOUSEHOLD_PATH}/records`,
  receipts: `${HOUSEHOLD_PATH}/receipts`,
  adviceState: `${HOUSEHOLD_PATH}/adviceState`,
} as const

// ---- seed JSON の型 ----

export interface SeedTask {
  id: string
  phase: string
  category: TaskCategory
  owner: Owner
  title: string
  dueHint: string
  dueDate: Ymd | null
  status: TaskStatus
  note: string
  updatedAt: null
  updatedBy: null
}

export interface SeedEvent {
  id: string
  title: string
  offsetDays: number
  window: number
  owner: Owner
  place?: string
  type: EventType
  fatherAttend?: boolean
  critical?: boolean
}

export interface SeedSchedule {
  edd: Ymd
  lmp: Ymd
  events: SeedEvent[]
}

/** seed の基準日。settings.edd / lmp の初期値に使う。 */
export const SEED_EDD: Ymd = scheduleJson.edd
export const SEED_LMP: Ymd = scheduleJson.lmp

// ---- 初回投入 ----

export function defaultSettings(edd: Ymd, lmp: Ymd): Settings {
  return {
    edd,
    lmp,
    birthDate: null,
    prePregnancyWeightKg: null,
    heightCm: null,
    motherName: '',
    fatherName: '',
    babyName: '',
    contacts: { shonan: '', yaeyama: '', motherHr: '', fatherGa: '' },
  }
}

/** seed の値を書き換えずに、Firestore へ書き込む操作の一覧を作る。 */
export function buildSeedOps(tasks: SeedTask[], schedule: SeedSchedule): WriteOp[] {
  const ops: WriteOp[] = [
    {
      path: paths.household,
      data: {
        settings: { ...defaultSettings(schedule.edd, schedule.lmp) },
        members: {},
        seededAt: SERVER_TIME,
      },
    },
  ]
  for (const { id, ...rest } of tasks) {
    ops.push({
      path: `${paths.tasks}/${id}`,
      data: { ...rest, deleted: false, createdBy: 'seed' },
    })
  }
  for (const { id, ...rest } of schedule.events) {
    ops.push({
      path: `${paths.events}/${id}`,
      data: { ...rest, updatedAt: null, updatedBy: null },
    })
  }
  return ops
}

export type SeedResult = 'seeded' | 'exists' | 'offline' | 'denied'

/**
 * 初回ログイン時に tasks / schedule を一括投入する。既に世帯データがあれば何もしない。
 * オフラインで確認できないときは投入しない（次回オンライン時に再確認する）。
 */
export async function seedIfNeeded(backend: Backend): Promise<SeedResult> {
  let exists: boolean
  try {
    exists = await backend.existsOnServer(paths.household)
  } catch (e) {
    return (e as BackendError).code === 'permission-denied' ? 'denied' : 'offline'
  }
  if (exists) return 'exists'

  // タスクは件数が多いので、投入が必要なときだけ読み込む
  const tasks = await import('../../seed/tasks.json')
  const ops = buildSeedOps(tasks.default as SeedTask[], scheduleJson as SeedSchedule)
  try {
    await backend.writeBatch(ops)
  } catch (e) {
    return (e as BackendError).code === 'permission-denied' ? 'denied' : 'offline'
  }
  return 'seeded'
}
