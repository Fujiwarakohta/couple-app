import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckIcon, ChevronRightIcon, PlusIcon } from '../components/Icons'
import { Page } from '../components/Layout'
import { Sheet } from '../components/Sheet'
import {
  Check,
  Choice,
  ContactCard,
  EmptyText,
  Field,
  OwnerBadge,
  ProgressBar,
  UnconfirmedBadge,
  UnconfirmedNote,
} from '../components/ui'
import { CONTACTS, contactPhone, matchContacts, noteTemplate } from '../data/contacts'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_SHORT_LABEL,
  OWNERS,
  OWNER_LABEL,
  ROLE_LABEL,
  STATUSES,
  STATUS_LABEL,
} from '../data/labels'
import { PHASES } from '../data/static'
import { taskUnconfirmed } from '../data/unconfirmed'
import { formatJaDate, lifeStage } from '../lib/dates'
import { BOTH_CHECKED, anyChecked, checkSummary, isShared } from '../lib/sharedTask'
import {
  DEFAULT_TASK_FILTER,
  currentPhaseId,
  filterTasks,
  progressOf,
  sortTasks,
  type TaskFilter,
} from '../lib/tasks'
import { useAppData, type NewTask } from '../state/AppContext'
import type { Owner, Task, TaskCategory, TaskStatus } from '../types'

const OWNER_FILTER_OPTIONS = [
  { value: 'all', label: 'すべて' },
  ...OWNERS.map((o) => ({ value: o, label: OWNER_LABEL[o] })),
] as const

const OWNER_OPTIONS = OWNERS.map((o) => ({ value: o, label: OWNER_LABEL[o] }))
const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))
/** 担当が「両方」のときは、完了を手で選べない（2人のチェックで自動的に完了になる）。 */
const SHARED_STATUS_OPTIONS = STATUS_OPTIONS.filter((o) => o.value !== 'done')

function StatusToggle({ task }: { task: Task }) {
  const { actions, role } = useAppData()
  const shared = isShared(task.owner)
  const done = task.status === 'done'
  // 「両方」のタスクでは、このボタンは自分の完了チェックを表す
  const mine = shared && role ? task.doneBy[role] : done
  const next: TaskStatus = done || task.status === 'na' ? 'todo' : 'done'
  const label = shared
    ? `「${task.title}」の自分の完了チェックを${mine ? '外す' : '付ける'}（${checkSummary(task.doneBy)}）`
    : `「${task.title}」を${next === 'done' ? '完了にする' : '未着手に戻す'}`
  const toggle = () => {
    if (shared) actions.setTaskCheck(task, !mine)
    else actions.updateTask(task.id, { status: next }, 'status')
  }
  return (
    <button
      type="button"
      className="flex size-11 shrink-0 items-center justify-center"
      aria-label={label}
      aria-pressed={mine}
      onClick={toggle}
    >
      <span
        className={`flex size-7 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
          done
            ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-300 dark:bg-emerald-300 dark:text-neutral-900'
            : mine
              ? 'border-emerald-700 bg-emerald-100 text-emerald-900 dark:border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200'
              : 'border-neutral-600 dark:border-neutral-300'
        }`}
      >
        {(done || mine) && <CheckIcon size={18} />}
        {task.status === 'na' && !mine && <span aria-hidden="true">−</span>}
      </span>
    </button>
  )
}

function TaskRow({ task, onEdit }: { task: Task; onEdit: (task: Task) => void }) {
  const unconfirmed = taskUnconfirmed(task.id, task.title)
  const closed = task.status === 'done' || task.status === 'na'
  return (
    <li className="flex items-start gap-1 border-t border-neutral-200 py-1 first:border-t-0 dark:border-neutral-700">
      <StatusToggle task={task} />
      <button
        type="button"
        className="min-h-11 min-w-0 flex-1 py-2 text-left"
        aria-label={`「${task.title}」を編集`}
        onClick={() => onEdit(task)}
      >
        <span
          className={`block text-[15px] ${closed ? 'muted line-through' : ''}`}
        >
          {task.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          <OwnerBadge owner={task.owner} />
          {task.status !== 'todo' && (
            <span className="badge border border-current">{STATUS_LABEL[task.status]}</span>
          )}
          {isShared(task.owner) && anyChecked(task.doneBy) && (
            <span className="badge border border-current">{checkSummary(task.doneBy)}</span>
          )}
          {unconfirmed && <UnconfirmedBadge reason={unconfirmed.reason} />}
          {task.dueDate ? (
            <span className="tabular-nums">期限 {formatJaDate(task.dueDate)}</span>
          ) : (
            task.dueHint && <span className="muted">目安 {task.dueHint}</span>
          )}
          {task.note && <span className="muted">メモあり</span>}
        </span>
      </button>
    </li>
  )
}

function ContactTemplate({
  task,
  onInsert,
}: {
  task: { title: string; category: TaskCategory }
  onInsert: (text: string) => void
}) {
  const { data } = useAppData()
  const matched = useMemo(() => matchContacts(task.title), [task.title])
  const [pickedId, setPickedId] = useState('')
  if (task.category !== 'procedure' && task.category !== 'money') return null

  const picked = CONTACTS.find((c) => c.id === pickedId) ?? null
  const shown = matched.length > 0 ? matched : picked ? [picked] : []
  const first = shown[0] ?? null

  return (
    <section aria-label="窓口" className="space-y-2">
      <h3 className="field-label">窓口・電話番号</h3>
      {matched.length === 0 && (
        <select
          className="input"
          aria-label="窓口を選ぶ"
          value={pickedId}
          onChange={(e) => setPickedId(e.target.value)}
        >
          <option value="">窓口を選ぶ</option>
          {CONTACTS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {shown.map((c) => (
        <ContactCard key={c.id} entry={c} contacts={data.settings.contacts} />
      ))}
      <button
        type="button"
        className="btn btn-ghost w-full"
        onClick={() =>
          onInsert(noteTemplate(first, first ? contactPhone(first, data.settings.contacts) : null))
        }
      >
        メモに雛形を入れる（窓口・電話・必要書類）
      </button>
    </section>
  )
}

function EditTaskForm({ task, onClose }: { task: Task; onClose: () => void }) {
  const { actions, role } = useAppData()
  const [title, setTitle] = useState(task.title)
  const [owner, setOwner] = useState<Owner>(task.owner)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [statusTouched, setStatusTouched] = useState(false)
  const [myCheck, setMyCheck] = useState(role ? task.doneBy[role] : false)
  const shared = isShared(owner)
  const partnerRole = role === 'father' ? 'mother' : 'father'
  const [dueDate, setDueDate] = useState(task.dueDate ?? '')
  const [note, setNote] = useState(task.note)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const unconfirmed = taskUnconfirmed(task.id, title)

  const save = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    const edited =
      trimmed !== task.title ||
      owner !== task.owner ||
      (dueDate || null) !== task.dueDate ||
      note !== task.note
    // 「両方」のタスクでは、ステータスを選び直したときだけ書き換える（完了はチェックで決まる）
    const statusChanged = shared ? statusTouched && status !== 'done' : status !== task.status
    const becameShared = shared && !isShared(task.owner)
    if (edited || statusChanged) {
      actions.updateTask(
        task.id,
        {
          title: trimmed,
          owner,
          dueDate: dueDate || null,
          note,
          ...(statusChanged ? { status } : {}),
          // 完了済みのタスクを「両方」に変えたときは、2人ともチェック済みとして引き継ぐ
          ...(becameShared && task.status === 'done' ? { doneBy: BOTH_CHECKED } : {}),
        },
        edited ? 'edit' : 'status',
      )
    }
    if (shared && !becameShared && role && myCheck !== task.doneBy[role]) {
      actions.setTaskCheck(task, myCheck)
    }
    onClose()
  }

  const remove = () => {
    actions.updateTask(task.id, { deleted: true }, 'delete')
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
      <p className="muted text-xs">
        {task.id}・{CATEGORY_LABEL[task.category]}
      </p>
      <Field label="タイトル" htmlFor="task-title">
        <textarea
          id="task-title"
          className="input"
          rows={4}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </Field>
      <Choice legend="担当" options={OWNER_OPTIONS} value={owner} onChange={setOwner} />
      {shared && isShared(task.owner) && role && (
        <fieldset className="rounded-lg border border-neutral-400 p-3">
          <legend className="px-1 text-sm font-semibold">完了チェック</legend>
          <p className="muted text-sm">2人ともチェックすると、このタスクは完了になります。</p>
          <Check
            id="task-my-check"
            label={`自分（${ROLE_LABEL[role]}）の分は完了した`}
            checked={myCheck}
            onChange={setMyCheck}
          />
          <p className="text-[15px]">
            相手（{ROLE_LABEL[partnerRole]}）：{task.doneBy[partnerRole] ? 'チェック済み' : 'まだ'}
          </p>
        </fieldset>
      )}
      {shared && !isShared(task.owner) && (
        <p className="muted text-sm">
          担当を「両方」にすると、2人がそれぞれチェックしたときに完了になります。保存後にチェックできます。
        </p>
      )}
      <Choice
        legend="ステータス"
        options={shared ? SHARED_STATUS_OPTIONS : STATUS_OPTIONS}
        value={status}
        onChange={(s) => {
          setStatus(s)
          setStatusTouched(true)
        }}
      />
      {shared && (
        <p className="muted -mt-2 text-xs">
          「完了」は選べません。2人のチェックがそろうと自動で完了になります。
        </p>
      )}
      <Field
        label="期限"
        htmlFor="task-due"
        hint={task.dueHint ? `元資料の目安：${task.dueHint}` : undefined}
      >
        <div className="flex gap-2">
          <input
            id="task-due"
            type="date"
            className="input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          {dueDate && (
            <button type="button" className="btn btn-ghost" onClick={() => setDueDate('')}>
              消す
            </button>
          )}
        </div>
      </Field>
      {unconfirmed && <UnconfirmedNote reason={unconfirmed.reason} />}
      <ContactTemplate
        task={{ title, category: task.category }}
        onInsert={(text) => setNote((n) => (n ? `${n}\n\n${text}` : text))}
      />
      <Field
        label="メモ"
        htmlFor="task-note"
        hint="窓口で確認した結果、金額、担当者名など。住所・保険証番号・口座番号は書かないでください。"
      >
        <textarea
          id="task-note"
          className="input"
          rows={6}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap justify-between gap-2 pt-2">
        {confirmDelete ? (
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
        )}
        <button type="submit" className="btn btn-primary ml-auto px-8">
          保存
        </button>
      </div>
    </form>
  )
}

function AddTaskForm({ defaultPhase, onClose }: { defaultPhase: string; onClose: () => void }) {
  const { actions, role } = useAppData()
  const [title, setTitle] = useState('')
  const [phase, setPhase] = useState(defaultPhase)
  const [category, setCategory] = useState<TaskCategory>('procedure')
  const [owner, setOwner] = useState<Owner>(role === 'father' ? '父' : '母')
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')

  const save = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    const task: NewTask = { title: trimmed, phase, category, owner, dueDate: dueDate || null, note }
    actions.addTask(task)
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
      <Field label="タイトル" htmlFor="new-title">
        <textarea
          id="new-title"
          className="input"
          rows={3}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </Field>
      <Field label="フェーズ" htmlFor="new-phase">
        <select id="new-phase" className="input" value={phase} onChange={(e) => setPhase(e.target.value)}>
          {PHASES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="カテゴリ" htmlFor="new-category">
        <select
          id="new-category"
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value as TaskCategory)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </Field>
      <Choice legend="担当" options={OWNER_OPTIONS} value={owner} onChange={setOwner} />
      <Field label="期限（任意）" htmlFor="new-due">
        <input
          id="new-due"
          type="date"
          className="input"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </Field>
      <Field label="メモ（任意）" htmlFor="new-note">
        <textarea
          id="new-note"
          className="input"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn btn-primary px-8" disabled={!title.trim()}>
          追加
        </button>
      </div>
    </form>
  )
}

function PhaseSection({
  phaseId,
  all,
  visible,
  defaultOpen,
  onEdit,
}: {
  phaseId: string
  all: Task[]
  visible: Task[]
  defaultOpen: boolean
  onEdit: (task: Task) => void
}) {
  const phase = PHASES.find((p) => p.id === phaseId)
  const groups = CATEGORIES.map((category) => ({
    category,
    tasks: visible.filter((t) => t.category === category),
  })).filter((g) => g.tasks.length > 0)

  return (
    <details className="group card p-0" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-start gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <span className="mt-0.5 shrink-0 transition-transform duration-150 group-open:rotate-90">
          <ChevronRightIcon size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <h2 className="text-base font-bold">{phase?.title ?? phaseId}</h2>
          <span className="muted block text-xs">{phase?.when}</span>
          <span className="mt-2 block">
            <ProgressBar progress={progressOf(all)} label="進捗" />
          </span>
        </span>
      </summary>
      <div className="px-3 pb-3">
        {phase?.note && <p className="mb-2 px-1 text-sm">{phase.note}</p>}
        {groups.length === 0 && <EmptyText>条件に合うタスクはありません。</EmptyText>}
        {groups.map((g) => (
          <div key={g.category} className="mt-2">
            <h3 className="rounded bg-neutral-200 px-2 py-1 text-sm font-bold dark:bg-neutral-700">
              {CATEGORY_LABEL[g.category]}
              <span className="muted ml-2 text-xs font-normal">{g.tasks.length}件</span>
            </h3>
            <ul>
              {g.tasks.map((t) => (
                <TaskRow key={t.id} task={t} onEdit={onEdit} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  )
}

export default function Tasks() {
  const { data, today } = useAppData()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<TaskFilter>(DEFAULT_TASK_FILTER)
  const [editingId, setEditingIdState] = useState<string | null>(() => params.get('edit'))
  const setEditingId = (id: string | null) => {
    setEditingIdState(id)
    // 閉じたら URL の ?edit= を消す（戻る・再読み込みで開き直さないように）
    if (id === null && params.has('edit')) {
      const next = new URLSearchParams(params)
      next.delete('edit')
      setParams(next, { replace: true })
    }
  }
  const [adding, setAdding] = useState(false)

  const { edd, birthDate } = data.settings
  const currentPhase = currentPhaseId(lifeStage({ edd, birthDate }, today))
  const live = useMemo(() => sortTasks(data.tasks.filter((t) => !t.deleted)), [data.tasks])
  const visible = useMemo(() => filterTasks(live, filter), [live, filter])
  const editing = editingId ? (live.find((t) => t.id === editingId) ?? null) : null

  // seed に無いフェーズIDのタスクがあっても表示できるようにする
  const phaseIds = useMemo(() => {
    const ids = PHASES.map((p) => p.id)
    for (const t of live) if (!ids.includes(t.phase)) ids.push(t.phase)
    return ids
  }, [live])

  return (
    <Page
      title="タスク"
      action={
        <button type="button" className="btn btn-task px-3 text-sm" onClick={() => setAdding(true)}>
          <PlusIcon size={18} />
          追加
        </button>
      }
    >
      <section aria-label="全体の進捗" className="card">
        <ProgressBar progress={progressOf(live)} label="全体" />
        <p className="muted mt-2 text-xs">「該当なし」にしたタスクは進捗の分母から除きます。</p>
      </section>

      <section aria-label="絞り込み" className="space-y-3">
        <Choice
          legend="担当で絞り込み"
          options={OWNER_FILTER_OPTIONS}
          value={filter.owner}
          onChange={(owner) => setFilter((f) => ({ ...f, owner }))}
        />
        <Field label="カテゴリで絞り込み" htmlFor="filter-category">
          <select
            id="filter-category"
            className="input"
            value={filter.category}
            onChange={(e) =>
              setFilter((f) => ({ ...f, category: e.target.value as TaskFilter['category'] }))
            }
          >
            <option value="all">すべてのカテゴリ</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_SHORT_LABEL[c]}（{CATEGORY_LABEL[c]}）
              </option>
            ))}
          </select>
        </Field>
        <Check
          id="filter-open"
          label="未完了のみ"
          checked={filter.openOnly}
          onChange={(openOnly) => setFilter((f) => ({ ...f, openOnly }))}
        />
        <p className="muted text-sm" role="status">
          {visible.length}件を表示中
        </p>
      </section>

      <div className="space-y-3">
        {phaseIds.map((id) => (
          <PhaseSection
            key={id}
            phaseId={id}
            all={live.filter((t) => t.phase === id)}
            visible={visible.filter((t) => t.phase === id)}
            defaultOpen={id === currentPhase}
            onEdit={(t) => setEditingId(t.id)}
          />
        ))}
      </div>

      <Sheet open={!!editing} title="タスクを編集" onClose={() => setEditingId(null)}>
        {editing && (
          <EditTaskForm key={editing.id} task={editing} onClose={() => setEditingId(null)} />
        )}
      </Sheet>
      <Sheet open={adding} title="タスクを追加" onClose={() => setAdding(false)}>
        <AddTaskForm defaultPhase={currentPhase} onClose={() => setAdding(false)} />
      </Sheet>
    </Page>
  )
}
