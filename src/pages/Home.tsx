import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdviceCard } from '../components/AdviceCard'
import { AlertIcon, BulbIcon, CheckIcon, CheckListIcon, PartnerIcon } from '../components/Icons'
import { InstallBanner } from '../components/InstallBanner'
import { Page } from '../components/Layout'
import { Choice, EmptyText, KindChip, OwnerBadge, SectionHeader, UnconfirmedBadge } from '../components/ui'
import { DISCLAIMER, EVENT_TYPE_LABEL, PARTNER_CALL, STATUS_LABEL } from '../data/labels'
import { ADVICE, PHASES } from '../data/static'
import { KIND_BORDER_CLASS, KIND_BUTTON_CLASS } from '../data/theme'
import { taskUnconfirmed } from '../data/unconfirmed'
import { adviceWeek, formatJaDate, formatJaRange, formatWeeks, lifeStage } from '../lib/dates'
import {
  homeAdvice,
  nowTasks,
  partnerUpdates,
  urgentItems,
  urgentLabel,
  type TaskScope,
  type UrgentItem,
} from '../lib/home'
import { anyChecked, checkSummary, isShared } from '../lib/sharedTask'
import { currentPhaseId } from '../lib/tasks'
import { useAppData } from '../state/AppContext'
import type { Role, Task } from '../types'

const SCOPE_OPTIONS = [
  { value: 'mine', label: '自分の担当' },
  { value: 'all', label: '2人分' },
] as const

function StageCard() {
  const { data, today } = useAppData()
  const { edd, birthDate, babyName } = data.settings
  const stage = lifeStage({ edd, birthDate }, today)

  if (stage.kind === 'born') {
    return (
      <section aria-label="現在の状況" className="card">
        <p className="muted text-sm">{babyName ? `${babyName} 生後` : '生後'}</p>
        <p className="text-4xl leading-tight font-bold tabular-nums">{stage.ageDays}日</p>
        <p className="mt-1 text-[15px]">月齢 {stage.ageMonths}か月</p>
        {birthDate && <p className="muted mt-1 text-sm">出生日 {formatJaDate(birthDate)}</p>}
      </section>
    )
  }

  return (
    <section aria-label="現在の状況" className="card">
      <p className="muted text-sm">妊娠</p>
      <p className="text-4xl leading-tight font-bold tabular-nums">
        {formatWeeks(stage.weeks, stage.days)}
      </p>
      <p className="mt-1 text-[15px]">
        {stage.overdue ? (
          <>出産予定日を {Math.abs(stage.daysUntilEdd)}日 超過</>
        ) : stage.daysUntilEdd === 0 ? (
          <>今日が出産予定日</>
        ) : (
          <>出産予定日まで あと{stage.daysUntilEdd}日</>
        )}
      </p>
      <p className="muted mt-1 text-sm">出産予定日 {formatJaDate(edd)}</p>
      <p className="muted mt-2 text-xs">今日 {formatJaDate(today)}</p>
    </section>
  )
}

/** タスクを完了にするボタン。担当が「両方」のときは、自分の完了チェックを切り替える。 */
function TaskDoneButton({ task }: { task: Task }) {
  const { actions, role } = useAppData()
  const shared = isShared(task.owner)
  const mine = shared && role ? task.doneBy[role] : false
  const onClick = () => {
    if (shared) actions.setTaskCheck(task, !mine)
    else actions.updateTask(task.id, { status: 'done' }, 'status')
  }
  const text = shared ? (mine ? '自分は済み' : '自分の分を完了') : '完了'
  const label = shared
    ? `「${task.title}」の自分の完了チェックを${mine ? '外す' : '付ける'}`
    : `「${task.title}」を完了にする`
  return (
    <button
      type="button"
      className={`btn shrink-0 px-3 text-sm ${KIND_BUTTON_CLASS.task}`}
      aria-label={label}
      aria-pressed={shared ? mine : undefined}
      onClick={onClick}
    >
      <CheckIcon size={16} />
      {text}
    </button>
  )
}

function UrgentRow({ item }: { item: UrgentItem }) {
  const { actions } = useAppData()
  const title = item.kind === 'task' ? item.task.title : item.event.title
  const owner = item.kind === 'task' ? item.task.owner : item.event.owner
  const sharedTask = item.kind === 'task' && isShared(item.task.owner) ? item.task : null

  return (
    <li className="border-t border-neutral-300 py-2 first:border-t-0 dark:border-neutral-600">
      {/* 1段目：本文（押すと開く）。2段目：日付などの情報と、操作のボタン。 */}
      <Link
        to={item.kind === 'task' ? `/tasks?edit=${item.id}` : '/schedule?mode=list'}
        className="block min-h-11 py-1"
        aria-label={`「${title}」を開く`}
      >
        <span className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-bold text-red-800 dark:text-red-300">{urgentLabel(item)}</span>
          <KindChip kind={item.kind} />
          <OwnerBadge owner={owner} />
          {item.kind === 'event' && item.event.critical && (
            <span className="badge border border-red-800 text-red-800 dark:border-red-300 dark:text-red-300">
              重要
            </span>
          )}
        </span>
        <span className="mt-1 block text-[15px]">{title}</span>
      </Link>
      <div className="flex items-center justify-between gap-2">
        <p className="muted min-w-0 text-sm tabular-nums">
          {item.kind === 'event'
            ? `${EVENT_TYPE_LABEL[item.event.type]}・${formatJaRange(item.range)}`
            : `期限 ${formatJaDate(item.date)}`}
          {sharedTask && <span className="block">完了チェック：{checkSummary(sharedTask.doneBy)}</span>}
        </p>
        {item.kind === 'task' ? (
          <TaskDoneButton task={item.task} />
        ) : (
          <button
            type="button"
            className={`btn shrink-0 px-3 text-sm ${KIND_BUTTON_CLASS.event}`}
            aria-label={`「${title}」を済みにする`}
            onClick={() => actions.patchEvent(item.id, { done: true })}
          >
            <CheckIcon size={16} />
            済み
          </button>
        )}
      </div>
    </li>
  )
}

function UrgentSection({ items }: { items: UrgentItem[] }) {
  return (
    <section aria-labelledby="urgent-title">
      <SectionHeader
        id="urgent-title"
        kind="urgent"
        title="期限まで7日以内"
        icon={<AlertIcon size={18} />}
        count={items.length}
      />
      {items.length === 0 ? (
        <div className="card">
          <EmptyText>7日以内に期限が来るタスク・予定はありません。</EmptyText>
        </div>
      ) : (
        <div
          data-urgent
          className="rounded-xl border-2 border-red-700 bg-red-50 px-4 dark:border-red-400 dark:bg-neutral-800"
        >
          <ul>
            {items.map((item) => (
              <UrgentRow key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function NowTaskRow({ task }: { task: Task }) {
  const unconfirmed = taskUnconfirmed(task.id, task.title)
  return (
    <li className="border-t border-neutral-200 py-2 first:border-t-0 dark:border-neutral-700">
      <Link
        to={`/tasks?edit=${task.id}`}
        className="flex min-h-11 items-center py-1 text-[15px]"
        aria-label={`「${task.title}」を開く`}
      >
        {task.title}
      </Link>
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
          <OwnerBadge owner={task.owner} />
          {task.status === 'doing' && !isShared(task.owner) && (
            <span className="badge border border-current">{STATUS_LABEL.doing}</span>
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
        </p>
        <TaskDoneButton task={task} />
      </div>
    </li>
  )
}

function NowTasksSection({ urgentTaskIds }: { urgentTaskIds: ReadonlySet<string> }) {
  const { data, today, role } = useAppData()
  const [scope, setScope] = useState<TaskScope>('mine')
  const { edd, birthDate } = data.settings
  const phaseId = currentPhaseId(lifeStage({ edd, birthDate }, today))
  const phase = PHASES.find((p) => p.id === phaseId)
  const result = useMemo(
    () => nowTasks(data.tasks, phaseId, role, scope, urgentTaskIds),
    [data.tasks, phaseId, role, scope, urgentTaskIds],
  )
  const rest = result.total - result.visible.length

  return (
    <section aria-labelledby="now-title">
      <SectionHeader
        id="now-title"
        kind="task"
        title="いまやるタスク"
        icon={<CheckListIcon size={18} />}
        count={result.total}
        action={
          <Link to="/tasks" className="btn -mr-3 px-3 text-sm underline">
            すべて見る
          </Link>
        }
      />
      <p className="muted mb-2 text-xs">{phase?.title ?? phaseId} の未完了タスク</p>
      <div className="mb-3">
        <Choice
          legend="表示するタスク"
          hideLegend
          options={SCOPE_OPTIONS}
          value={scope}
          onChange={setScope}
        />
      </div>
      <div className={`card py-1 ${KIND_BORDER_CLASS.task}`}>
        {result.visible.length === 0 ? (
          <EmptyText>
            {scope === 'mine'
              ? 'このフェーズで、自分の担当の未完了タスクはありません。'
              : 'このフェーズの未完了タスクはありません。'}
          </EmptyText>
        ) : (
          <ul>
            {result.visible.map((t) => (
              <NowTaskRow key={t.id} task={t} />
            ))}
          </ul>
        )}
      </div>
      {rest > 0 && <p className="muted mt-2 text-sm">ほかに {rest}件あります。</p>}
    </section>
  )
}

function AdviceSection() {
  const { data, today, role, actions } = useAppData()
  const { edd, birthDate } = data.settings
  const week = adviceWeek({ edd, birthDate }, today)
  const advice = useMemo(
    () => homeAdvice(ADVICE, week, data.adviceState, role),
    [week, data.adviceState, role],
  )

  return (
    <section aria-labelledby="advice-title">
      <SectionHeader
        id="advice-title"
        kind="advice"
        title="今週の助言"
        icon={<BulbIcon size={18} />}
        action={
          <Link to="/advice" className="btn -mr-3 px-3 text-sm underline">
            すべて見る
          </Link>
        }
      />
      <p className="muted mb-1 text-xs">
        知っておくと役立つ情報です。読んだら「既読にする」を押すと、たたまれます。
      </p>
      <p className="muted mb-3 text-xs">{DISCLAIMER}</p>
      <div className="space-y-3">
        {advice.visible.length === 0 && (
          <div className="card">
            <EmptyText>未読の助言はありません。</EmptyText>
          </div>
        )}
        {advice.visible.map((item) => (
          <AdviceCard
            key={item.id}
            item={item}
            state={data.adviceState}
            onChange={actions.setAdviceState}
          />
        ))}
        {advice.moreUnread > 0 && (
          <p className="muted text-sm">ほかに未読が {advice.moreUnread}件あります。</p>
        )}
        {advice.read.length > 0 && (
          <details className="card p-0">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">
              既読 {advice.read.length}件
            </summary>
            <div className="space-y-3 p-3 pt-0">
              {advice.read.map((item) => (
                <AdviceCard
                  key={item.id}
                  item={item}
                  state={data.adviceState}
                  onChange={actions.setAdviceState}
                />
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  )
}

function PartnerSection() {
  const { data, user, role, today } = useAppData()
  const partnerRole: Role = role === 'father' ? 'mother' : 'father'
  const updates = useMemo(
    () => partnerUpdates(data.tasks, user?.uid ?? '', PARTNER_CALL[partnerRole], Date.now()),
    // today が変わったときにも 24 時間の範囲を計算し直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.tasks, user?.uid, partnerRole, today],
  )
  const time = (ms: number) =>
    new Date(ms).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

  return (
    <section aria-labelledby="partner-title">
      <SectionHeader
        id="partner-title"
        kind="partner"
        title="相手の更新（24時間以内）"
        icon={<PartnerIcon size={18} />}
      />
      <div className="card">
        {updates.length === 0 ? (
          <EmptyText>24時間以内の更新はありません。</EmptyText>
        ) : (
          <ul className="space-y-3">
            {updates.map((u) => (
              <li key={u.task.id}>
                <p className="text-[15px] font-semibold">{u.text}</p>
                <p className="muted text-sm">
                  <span className="tabular-nums">{time(u.updatedAt)}</span>・{u.task.title}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default function Home() {
  const { data, today } = useAppData()
  const { edd, birthDate } = data.settings
  const urgent = useMemo(
    () => urgentItems(data.tasks, data.events, { edd, birthDate }, today),
    [data.tasks, data.events, edd, birthDate, today],
  )
  const urgentTaskIds = useMemo(
    () => new Set(urgent.filter((u) => u.kind === 'task').map((u) => u.id)),
    [urgent],
  )

  return (
    <Page title="ふたりノート" showSettings>
      <StageCard />
      <UrgentSection items={urgent} />
      <NowTasksSection urgentTaskIds={urgentTaskIds} />
      <AdviceSection />
      <PartnerSection />
      <InstallBanner />
    </Page>
  )
}
