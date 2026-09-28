import type { DocData, DocWithId } from '../lib/backend'
import { isValidYmd } from '../lib/dates'
import { effectiveStatus, readDoneBy } from '../lib/sharedTask'
import type {
  AdviceState,
  BpValue,
  EventType,
  FatherPlace,
  Household,
  Member,
  Owner,
  Presence,
  Receipt,
  ReceiptKind,
  RecordItem,
  RecordKind,
  ScheduleEvent,
  Settings,
  Task,
  TaskAction,
  TaskCategory,
  TaskStatus,
  Ymd,
} from '../types'

/** Firestore から来た値を、型の決まった形に直す。欠けている値は既定値で埋める。 */

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const bool = (v: unknown): boolean => v === true
const ymd = (v: unknown): Ymd | null => (isValidYmd(v) ? v : null)
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

const OWNERS: readonly Owner[] = ['母', '父', '両']
const STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'done', 'na']
const CATEGORIES: readonly TaskCategory[] = ['procedure', 'money', 'health', 'prep', 'father_work']
const ACTIONS: readonly TaskAction[] = ['create', 'edit', 'status', 'delete', 'check', 'uncheck']
const EVENT_TYPES: readonly EventType[] = [
  'medical',
  'admin',
  'money',
  'work',
  'travel',
  'class',
  'milestone',
  'prep',
]
const PLACES: readonly FatherPlace[] = ['ishigaki', 'ishikawa', 'kyoto', 'other']
const RECORD_KINDS: readonly RecordKind[] = ['weight', 'bp', 'movement']
const RECEIPT_KINDS: readonly ReceiptKind[] = [
  'ninpu',
  'sanpu',
  'hearing',
  'vaccine',
  'kodomo_iryo',
  'other',
]

export function toTask(d: DocWithId): Task {
  const owner = oneOf(d.owner, OWNERS, '両')
  const storedStatus = oneOf(d.status, STATUSES, 'todo')
  const { doneBy, stored } = readDoneBy(d.doneBy, storedStatus)
  return {
    id: d.id,
    phase: str(d.phase, 'p0'),
    category: oneOf(d.category, CATEGORIES, 'procedure'),
    owner,
    title: str(d.title),
    dueHint: str(d.dueHint),
    dueDate: ymd(d.dueDate),
    status: effectiveStatus(owner, storedStatus, doneBy),
    doneBy,
    doneByStored: stored,
    note: str(d.note),
    deleted: bool(d.deleted),
    updatedAt: num(d.updatedAt),
    updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : null,
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : null,
    lastAction: typeof d.lastAction === 'string' ? oneOf(d.lastAction, ACTIONS, 'edit') : undefined,
  }
}

export function toEvent(d: DocWithId): ScheduleEvent {
  const offset = num(d.offsetDays)
  const date = ymd(d.date)
  return {
    id: d.id,
    title: str(d.title),
    offsetDays: date ? undefined : (offset ?? undefined),
    date: date ?? undefined,
    window: Math.max(0, num(d.window) ?? 0),
    owner: oneOf(d.owner, OWNERS, '両'),
    place: str(d.place) || undefined,
    type: oneOf(d.type, EVENT_TYPES, 'admin'),
    memo: str(d.memo) || undefined,
    fatherAttend: bool(d.fatherAttend),
    critical: bool(d.critical),
    done: bool(d.done),
    deleted: bool(d.deleted),
    updatedAt: num(d.updatedAt),
    updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : null,
  }
}

export function toPresence(d: DocWithId): Presence | null {
  if (!isValidYmd(d.id)) return null
  if (typeof d.father !== 'string' || !(PLACES as readonly string[]).includes(d.father)) return null
  return { id: d.id, father: d.father as FatherPlace }
}

function toBp(v: unknown): BpValue | null {
  if (!v || typeof v !== 'object') return null
  const o = v as DocData
  const sys = num(o.sys)
  const dia = num(o.dia)
  return sys !== null && dia !== null ? { sys, dia } : null
}

export function toRecord(d: DocWithId): RecordItem | null {
  const date = ymd(d.date)
  if (!date) return null
  const kind = oneOf(d.kind, RECORD_KINDS, 'weight')
  return {
    id: d.id,
    kind,
    date,
    value: kind === 'bp' ? toBp(d.value) : num(d.value),
    memo: str(d.memo),
    updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : null,
  }
}

export function toReceipt(d: DocWithId): Receipt | null {
  const date = ymd(d.date)
  if (!date) return null
  return {
    id: d.id,
    kind: oneOf(d.kind, RECEIPT_KINDS, 'other'),
    date,
    facility: str(d.facility),
    amountYen: num(d.amountYen) ?? 0,
    ticketNo: typeof d.ticketNo === 'string' && d.ticketNo ? d.ticketNo : null,
    hasReceipt: bool(d.hasReceipt),
    hasStatement: bool(d.hasStatement),
    hasTicketFilled: bool(d.hasTicketFilled),
    epdsDone: bool(d.epdsDone),
    requestLetterObtained: bool(d.requestLetterObtained),
    deadline: ymd(d.deadline),
    claimedAt: ymd(d.claimedAt),
    deleted: bool(d.deleted),
    updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : null,
  }
}

export function toAdviceState(d: DocData | null): AdviceState {
  return { read: strList(d?.read), pinned: strList(d?.pinned) }
}

export function toSettings(v: unknown, fallback: Settings): Settings {
  const o = (v && typeof v === 'object' ? v : {}) as DocData
  const c = (o.contacts && typeof o.contacts === 'object' ? o.contacts : {}) as DocData
  return {
    edd: ymd(o.edd) ?? fallback.edd,
    lmp: ymd(o.lmp) ?? fallback.lmp,
    birthDate: ymd(o.birthDate),
    prePregnancyWeightKg: num(o.prePregnancyWeightKg),
    heightCm: num(o.heightCm),
    motherName: str(o.motherName),
    fatherName: str(o.fatherName),
    babyName: str(o.babyName),
    contacts: {
      shonan: str(c.shonan),
      yaeyama: str(c.yaeyama),
      motherHr: str(c.motherHr),
      fatherGa: str(c.fatherGa),
    },
  }
}

export function toHousehold(d: DocData, fallback: Settings): Household {
  const members: Record<string, Member> = {}
  if (d.members && typeof d.members === 'object') {
    for (const [uid, value] of Object.entries(d.members as DocData)) {
      if (!value || typeof value !== 'object') continue
      const m = value as DocData
      if (m.role !== 'father' && m.role !== 'mother') continue
      members[uid] = { role: m.role, displayName: str(m.displayName) }
    }
  }
  return {
    settings: toSettings(d.settings, fallback),
    members,
    seededAt: num(d.seededAt),
  }
}
