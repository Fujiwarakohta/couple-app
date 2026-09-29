import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../components/Icons'
import { Page } from '../components/Layout'
import { Sheet } from '../components/Sheet'
import { Check, Choice, ContactCard, EmptyText, Field, OwnerBadge } from '../components/ui'
import { matchContacts } from '../data/contacts'
import {
  EVENT_TYPES,
  EVENT_TYPE_LABEL,
  FATHER_PLACES,
  FATHER_PLACE_CLASS,
  FATHER_PLACE_LABEL,
  OWNERS,
  OWNER_DOT_CLASS,
  OWNER_LABEL,
} from '../data/labels'
import { formatJaDate, formatJaRange, isValidYmd } from '../lib/dates'
import {
  BAND_CLASS,
  bandsOnDay,
  buildBands,
  eachYmd,
  eventsOnDay,
  formatMonth,
  monthDays,
  monthGrid,
  monthStart,
  resolveEvents,
  shiftMonth,
  type Band,
  type ResolvedEvent,
} from '../lib/schedule'
import { useAppData, type EventInput } from '../state/AppContext'
import type { EventType, FatherPlace, Owner, ScheduleEvent, Ymd } from '../types'

type Mode = 'month' | 'list'

const MODE_OPTIONS = [
  { value: 'month', label: '月' },
  { value: 'list', label: 'リスト' },
] as const

const OWNER_OPTIONS = OWNERS.map((o) => ({ value: o, label: OWNER_LABEL[o] }))
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

type PlaceChoice = FatherPlace | 'none'
const PLACE_OPTIONS: { value: PlaceChoice; label: string }[] = [
  ...FATHER_PLACES.map((p) => ({ value: p, label: FATHER_PLACE_LABEL[p] })),
  { value: 'none', label: '未設定' },
]

function Legend({ bands }: { bands: Band[] }) {
  return (
    <details className="card p-0">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">
        色の見方
      </summary>
      <div className="space-y-3 px-4 pb-4 text-sm">
        <div>
          <p className="font-semibold">父の所在（日付の上の帯）</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {FATHER_PLACES.map((p) => (
              <li key={p} className={`badge ${FATHER_PLACE_CLASS[p]}`}>
                {FATHER_PLACE_LABEL[p]}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold">期間（背景の色）</p>
          <ul className="mt-1 space-y-1">
            {bands.map((b) => (
              <li key={b.kind} className="flex items-start gap-2">
                <span
                  className={`mt-1 inline-block size-4 shrink-0 rounded border border-neutral-500 ${BAND_CLASS[b.kind]}`}
                  aria-hidden="true"
                />
                <span>
                  <span className="font-semibold">{b.label}</span>
                  <span className="tabular-nums">：{formatJaRange(b.range)}</span>
                  <span className="muted block text-xs">{b.basis}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold">予定の点（担当）</p>
          <ul className="mt-1 flex flex-wrap gap-3">
            {OWNERS.map((o) => (
              <li key={o} className="flex items-center gap-1">
                <span className={`inline-block size-2.5 rounded-full ${OWNER_DOT_CLASS[o]}`} aria-hidden="true" />
                {OWNER_LABEL[o]}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  )
}

/** 父の所在レーン：表示中の月を1日ずつ横に並べる。 */
function PresenceLane({
  month,
  presence,
  today,
  onPick,
}: {
  month: Ymd
  presence: Map<Ymd, FatherPlace>
  today: Ymd
  onPick: (day: Ymd) => void
}) {
  return (
    <section aria-label="父の所在">
      <h2 className="section-title mb-1 text-sm">父の所在</h2>
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2">
        {monthDays(month).map((day) => {
          const place = presence.get(day)
          return (
            <li key={day} className="shrink-0">
              <button
                type="button"
                className={`flex h-14 w-11 flex-col items-center justify-center rounded-lg border text-xs leading-tight ${
                  place
                    ? `${FATHER_PLACE_CLASS[place]} border-transparent`
                    : 'border-neutral-500 bg-white dark:border-neutral-400 dark:bg-neutral-800'
                } ${day === today ? 'ring-2 ring-neutral-900 ring-offset-1 dark:ring-white' : ''}`}
                aria-label={`${formatJaDate(day)} 父の所在：${place ? FATHER_PLACE_LABEL[place] : '未設定'}`}
                onClick={() => onPick(day)}
              >
                <span className="font-bold tabular-nums">{Number(day.slice(8))}</span>
                <span>{place ? FATHER_PLACE_LABEL[place] : '−'}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function MonthView({
  month,
  today,
  resolved,
  bands,
  presence,
  onPick,
}: {
  month: Ymd
  today: Ymd
  resolved: ResolvedEvent[]
  bands: Band[]
  presence: Map<Ymd, FatherPlace>
  onPick: (day: Ymd) => void
}) {
  const cells = useMemo(() => monthGrid(month), [month])
  return (
    <div>
      <div className="grid grid-cols-7 text-center text-xs font-semibold" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <ul className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-neutral-400 bg-neutral-400 dark:border-neutral-600 dark:bg-neutral-600">
        {cells.map((cell) => {
          const dayEvents = eventsOnDay(resolved, cell.ymd)
          const dayBands = bandsOnDay(bands, cell.ymd)
          const place = presence.get(cell.ymd)
          const label = [
            formatJaDate(cell.ymd),
            dayEvents.length ? `予定${dayEvents.length}件` : '予定なし',
            place ? `父：${FATHER_PLACE_LABEL[place]}` : '',
            ...dayBands.map((b) => b.label),
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <li key={cell.ymd}>
              <button
                type="button"
                aria-label={label}
                aria-current={cell.ymd === today ? 'date' : undefined}
                onClick={() => onPick(cell.ymd)}
                className={`relative flex h-16 w-full flex-col items-center overflow-hidden bg-white dark:bg-neutral-800 ${
                  cell.inMonth ? '' : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {/* 期間の帯（重なる場合は縦に分割して全部見せる） */}
                {dayBands.length > 0 && (
                  <span className="absolute inset-0 flex flex-col" aria-hidden="true">
                    {dayBands.map((b) => (
                      <span key={b.kind} className={`flex-1 ${BAND_CLASS[b.kind]}`} />
                    ))}
                  </span>
                )}
                <span
                  className={`relative h-1.5 w-full ${place ? FATHER_PLACE_CLASS[place] : ''}`}
                  aria-hidden="true"
                />
                <span
                  className={`relative mt-1 flex size-7 items-center justify-center rounded-full text-sm tabular-nums ${
                    cell.ymd === today
                      ? 'bg-neutral-900 font-bold text-white dark:bg-white dark:text-neutral-900'
                      : ''
                  }`}
                >
                  {cell.day}
                </span>
                <span className="relative mt-1 flex items-center gap-0.5" aria-hidden="true">
                  {dayEvents.slice(0, 3).map((r) => (
                    <span
                      key={r.event.id}
                      className={`size-2 rounded-full ${OWNER_DOT_CLASS[r.event.owner]}`}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] leading-none font-bold">+{dayEvents.length - 3}</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function EventRow({ item, onEdit }: { item: ResolvedEvent; onEdit: (e: ScheduleEvent) => void }) {
  const { actions } = useAppData()
  const { event, range } = item
  return (
    <li className="flex items-start gap-1 border-t border-neutral-200 py-1 first:border-t-0 dark:border-neutral-700">
      <button
        type="button"
        className="min-h-11 min-w-0 flex-1 py-2 text-left"
        aria-label={`「${event.title}」を編集`}
        onClick={() => onEdit(event)}
      >
        <span className="block text-sm font-semibold tabular-nums">{formatJaRange(range)}</span>
        <span className={`block text-[15px] ${event.done ? 'muted line-through' : ''}`}>
          {event.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          <OwnerBadge owner={event.owner} />
          <span className="badge bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100">
            {EVENT_TYPE_LABEL[event.type]}
          </span>
          {event.critical && (
            <span className="badge border border-red-800 text-red-800 dark:border-red-300 dark:text-red-300">
              重要
            </span>
          )}
          {event.fatherAttend && <span className="badge border border-current">父同伴</span>}
          {event.place && <span className="muted">{event.place}</span>}
        </span>
      </button>
      <button
        type="button"
        className="chip mt-1 px-3 text-xs"
        aria-pressed={!!event.done}
        aria-label={`「${event.title}」を${event.done ? '未済に戻す' : '済みにする'}`}
        onClick={() => actions.patchEvent(event.id, { done: !event.done })}
      >
        {event.done ? '済み' : '済みにする'}
      </button>
    </li>
  )
}

function ListView({
  resolved,
  today,
  onEdit,
}: {
  resolved: ResolvedEvent[]
  today: Ymd
  onEdit: (e: ScheduleEvent) => void
}) {
  const [showPast, setShowPast] = useState(false)
  const shown = showPast ? resolved : resolved.filter((r) => r.range.end >= today)
  const groups = useMemo(() => {
    const map = new Map<Ymd, ResolvedEvent[]>()
    for (const r of shown) {
      const key = monthStart(r.range.start)
      const list = map.get(key) ?? []
      list.push(r)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [shown])

  return (
    <div className="space-y-3">
      <Check id="show-past" label="過ぎた予定も表示" checked={showPast} onChange={setShowPast} />
      {groups.length === 0 && <EmptyText>表示する予定はありません。</EmptyText>}
      {groups.map(([month, items]) => (
        <section key={month} className="card px-3 py-2" aria-label={formatMonth(month)}>
          <h2 className="rounded bg-neutral-200 px-2 py-1 text-sm font-bold dark:bg-neutral-700">
            {formatMonth(month)}
          </h2>
          <ul>
            {items.map((r) => (
              <EventRow key={r.event.id} item={r} onEdit={onEdit} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function EventForm({
  event,
  defaultDate,
  resolvedStart,
  onClose,
}: {
  event: ScheduleEvent | null
  defaultDate: Ymd
  resolvedStart: Ymd | null
  onClose: () => void
}) {
  const { actions, data, role } = useAppData()
  const initialDate = resolvedStart ?? event?.date ?? defaultDate
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState<Ymd>(initialDate)
  const [window, setWindow] = useState(String(event?.window ?? 0))
  const [owner, setOwner] = useState<Owner>(event?.owner ?? (role === 'father' ? '父' : '母'))
  const [type, setType] = useState<EventType>(event?.type ?? 'medical')
  const [place, setPlace] = useState(event?.place ?? '')
  const [memo, setMemo] = useState(event?.memo ?? '')
  const [fatherAttend, setFatherAttend] = useState(!!event?.fatherAttend)
  const [critical, setCritical] = useState(!!event?.critical)
  const [done, setDone] = useState(!!event?.done)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const relative = typeof event?.offsetDays === 'number'
  const keepRelative = relative && date === initialDate
  const contacts = useMemo(() => matchContacts(`${place} ${title}`), [place, title])
  const valid = title.trim() !== '' && isValidYmd(date)

  const save = () => {
    if (!valid) return
    const days = Math.max(0, Math.floor(Number(window) || 0))
    const input: EventInput = {
      title: title.trim(),
      window: days,
      owner,
      type,
      place,
      memo,
      fatherAttend,
      critical,
      done,
      ...(keepRelative ? { offsetDays: event?.offsetDays } : { date }),
    }
    actions.saveEvent(event?.id ?? null, input)
    onClose()
  }

  const remove = () => {
    if (event) actions.patchEvent(event.id, { deleted: true })
    onClose()
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <Field label="タイトル" htmlFor="event-title">
        <textarea
          id="event-title"
          className="input"
          rows={2}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </Field>
      <Field
        label="日付（開始日）"
        htmlFor="event-date"
        hint={
          relative
            ? keepRelative
              ? `出産予定日${event.offsetDays && event.offsetDays > 0 ? '（出生日の入力後は出生日）' : ''}から ${
                  (event.offsetDays ?? 0) >= 0 ? '+' : '−'
                }${Math.abs(event.offsetDays ?? 0)}日。予定日を変更すると自動で再計算されます。`
              : '日付を変更したため、固定の日付として保存されます（予定日を変更しても動きません）。'
            : undefined
        }
      >
        <input
          id="event-date"
          type="date"
          className="input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </Field>
      <Field label="期間の幅（日数）" htmlFor="event-window" hint="0 は1日のみ。7 なら開始日から7日後まで。">
        <input
          id="event-window"
          type="number"
          inputMode="numeric"
          min={0}
          max={400}
          className="input"
          value={window}
          onChange={(e) => setWindow(e.target.value)}
        />
      </Field>
      <Choice legend="担当" options={OWNER_OPTIONS} value={owner} onChange={setOwner} />
      <Field label="種別" htmlFor="event-type">
        <select
          id="event-type"
          className="input"
          value={type}
          onChange={(e) => setType(e.target.value as EventType)}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="場所" htmlFor="event-place" hint="施設名など。住所は書かないでください。">
        <input
          id="event-place"
          type="text"
          className="input"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
        />
      </Field>
      {contacts.length > 0 && (
        <div className="space-y-2">
          {contacts.map((c) => (
            <ContactCard key={c.id} entry={c} contacts={data.settings.contacts} compact />
          ))}
        </div>
      )}
      <Field label="メモ" htmlFor="event-memo">
        <textarea
          id="event-memo"
          className="input"
          rows={3}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </Field>
      <div>
        <Check id="event-father" label="父が同伴する" checked={fatherAttend} onChange={setFatherAttend} />
        <Check
          id="event-critical"
          label="重要（期限を過ぎてもホームに残す）"
          checked={critical}
          onChange={setCritical}
        />
        <Check id="event-done" label="済み" checked={done} onChange={setDone} />
      </div>
      <div className="flex flex-wrap justify-between gap-2 pt-2">
        {event &&
          (confirmDelete ? (
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-danger" onClick={remove}>
                本当に削除
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                やめる
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              削除
            </button>
          ))}
        <button type="submit" className="btn btn-primary ml-auto px-8" disabled={!valid}>
          {event ? '保存' : '追加'}
        </button>
      </div>
    </form>
  )
}

function DayPanel({
  day,
  resolved,
  bands,
  place,
  onEdit,
  onAdd,
}: {
  day: Ymd
  resolved: ResolvedEvent[]
  bands: Band[]
  place: FatherPlace | undefined
  onEdit: (e: ScheduleEvent) => void
  onAdd: () => void
}) {
  const { actions } = useAppData()
  const [until, setUntil] = useState<Ymd>(day)
  const dayEvents = eventsOnDay(resolved, day)
  const dayBands = bandsOnDay(bands, day)
  const range = isValidYmd(until) && until >= day ? eachYmd(day, until, 120) : [day]

  const pick = (value: PlaceChoice) => {
    actions.setPresence(range, value === 'none' ? null : value)
  }

  return (
    <div className="space-y-5">
      {dayBands.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {dayBands.map((b) => (
            <li
              key={b.kind}
              className={`badge border border-neutral-500 text-neutral-900 dark:text-neutral-100 ${BAND_CLASS[b.kind]}`}
            >
              {b.label}
            </li>
          ))}
        </ul>
      )}

      <section aria-label="この日の予定">
        <h3 className="field-label">予定</h3>
        {dayEvents.length === 0 ? (
          <EmptyText>この日の予定はありません。</EmptyText>
        ) : (
          <ul>
            {dayEvents.map((r) => (
              <EventRow key={r.event.id} item={r} onEdit={onEdit} />
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-ghost mt-2 w-full" onClick={onAdd}>
          <PlusIcon size={18} />
          この日に予定を追加
        </button>
      </section>

      <section aria-label="父の所在" className="space-y-3">
        <Choice
          legend="父の所在"
          options={PLACE_OPTIONS}
          value={place ?? 'none'}
          onChange={pick}
        />
        <Field
          label="まとめて設定する最終日"
          htmlFor="presence-until"
          hint={`先に最終日を選んでから、上の所在を押してください（${range.length}日分に設定、最大120日）。`}
        >
          <input
            id="presence-until"
            type="date"
            className="input"
            min={day}
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </Field>
      </section>
    </div>
  )
}

type Editing = { kind: 'edit'; id: string } | { kind: 'add'; date: Ymd } | null

export default function Schedule() {
  const { data, today } = useAppData()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Editing>(null)
  const [pickedDay, setPickedDay] = useState<Ymd | null>(null)

  const mode: Mode = params.get('mode') === 'list' ? 'list' : 'month'
  const monthParam = params.get('month')
  const month = monthStart(isValidYmd(monthParam) ? monthParam : today)

  const update = (next: { mode?: Mode; month?: Ymd }) => {
    const p = new URLSearchParams(params)
    if (next.mode) p.set('mode', next.mode)
    if (next.month) p.set('month', next.month)
    setParams(p, { replace: true })
  }

  const { edd, birthDate } = data.settings
  const resolved = useMemo(
    () => resolveEvents(data.events, { edd, birthDate }),
    [data.events, edd, birthDate],
  )
  const bands = useMemo(() => buildBands(data.events, { edd, birthDate }), [data.events, edd, birthDate])
  const presence = useMemo(
    () => new Map(data.presence.map((p) => [p.id, p.father] as const)),
    [data.presence],
  )

  const editingItem =
    editing?.kind === 'edit' ? (resolved.find((r) => r.event.id === editing.id) ?? null) : null
  const formOpen = editing?.kind === 'add' || !!editingItem

  const openEdit = (e: ScheduleEvent) => {
    setPickedDay(null)
    setEditing({ kind: 'edit', id: e.id })
  }
  const openAdd = (date: Ymd) => {
    setPickedDay(null)
    setEditing({ kind: 'add', date })
  }

  return (
    <Page
      title="スケジュール"
      action={
        <button type="button" className="btn btn-event px-3 text-sm" onClick={() => openAdd(today)}>
          <PlusIcon size={18} />
          追加
        </button>
      }
    >
      <Choice
        legend="表示の切り替え"
        hideLegend
        options={MODE_OPTIONS}
        value={mode}
        onChange={(m) => update({ mode: m })}
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="btn btn-ghost px-3"
          aria-label="前の月"
          onClick={() => update({ month: shiftMonth(month, -1) })}
        >
          <ChevronLeftIcon size={20} />
        </button>
        <div className="text-center">
          <p className="text-lg font-bold tabular-nums" aria-live="polite">
            {formatMonth(month)}
          </p>
          {month !== monthStart(today) && (
            <button
              type="button"
              className="btn px-3 text-sm underline"
              onClick={() => update({ month: monthStart(today) })}
            >
              今月に戻る
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost px-3"
          aria-label="次の月"
          onClick={() => update({ month: shiftMonth(month, 1) })}
        >
          <ChevronRightIcon size={20} />
        </button>
      </div>

      <PresenceLane month={month} presence={presence} today={today} onPick={setPickedDay} />

      {mode === 'month' ? (
        <MonthView
          month={month}
          today={today}
          resolved={resolved}
          bands={bands}
          presence={presence}
          onPick={setPickedDay}
        />
      ) : (
        <ListView resolved={resolved} today={today} onEdit={openEdit} />
      )}

      <Legend bands={bands} />

      <Sheet
        open={!!pickedDay}
        title={pickedDay ? formatJaDate(pickedDay) : ''}
        onClose={() => setPickedDay(null)}
      >
        {pickedDay && (
          <DayPanel
            key={pickedDay}
            day={pickedDay}
            resolved={resolved}
            bands={bands}
            place={presence.get(pickedDay)}
            onEdit={openEdit}
            onAdd={() => openAdd(pickedDay)}
          />
        )}
      </Sheet>

      <Sheet
        open={formOpen}
        title={editing?.kind === 'add' ? '予定を追加' : '予定を編集'}
        onClose={() => setEditing(null)}
      >
        {editing?.kind === 'add' && (
          <EventForm
            key={`add-${editing.date}`}
            event={null}
            defaultDate={editing.date}
            resolvedStart={null}
            onClose={() => setEditing(null)}
          />
        )}
        {editingItem && (
          <EventForm
            key={editingItem.event.id}
            event={editingItem.event}
            defaultDate={today}
            resolvedStart={editingItem.range.start}
            onClose={() => setEditing(null)}
          />
        )}
      </Sheet>
    </Page>
  )
}
