import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AdviceCard } from '../components/AdviceCard'
import { AlertIcon } from '../components/Icons'
import { InstallBanner } from '../components/InstallBanner'
import { Page } from '../components/Layout'
import { EmptyText, OwnerBadge } from '../components/ui'
import { DISCLAIMER, EVENT_TYPE_LABEL, PARTNER_CALL } from '../data/labels'
import { ADVICE } from '../data/static'
import { adviceWeek, formatJaDate, formatJaRange, formatWeeks, lifeStage } from '../lib/dates'
import { homeAdvice, partnerUpdates, urgentItems, urgentLabel, type UrgentItem } from '../lib/home'
import { checkSummary, isShared } from '../lib/sharedTask'
import { useAppData } from '../state/AppContext'
import type { Role } from '../types'

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

function UrgentRow({ item }: { item: UrgentItem }) {
  const { actions, role } = useAppData()
  const title = item.kind === 'task' ? item.task.title : item.event.title
  const owner = item.kind === 'task' ? item.task.owner : item.event.owner
  // 担当が「両方」のタスクは、自分の完了チェックだけを切り替える
  const sharedTask = item.kind === 'task' && isShared(item.task.owner) ? item.task : null
  const mine = sharedTask && role ? sharedTask.doneBy[role] : false
  const complete = () => {
    if (sharedTask) actions.setTaskCheck(sharedTask, !mine)
    else if (item.kind === 'task') actions.updateTask(item.id, { status: 'done' }, 'status')
    else actions.patchEvent(item.id, { done: true })
  }
  const buttonText = sharedTask
    ? mine
      ? '自分は済み'
      : '自分の分を完了'
    : item.kind === 'task'
      ? '完了'
      : '済み'
  const buttonLabel = sharedTask
    ? `「${title}」の自分の完了チェックを${mine ? '外す' : '付ける'}`
    : `「${title}」を${item.kind === 'task' ? '完了' : '済み'}にする`
  return (
    <li className="flex items-start gap-2 border-t border-red-700/40 py-3 first:border-t-0 first:pt-0 last:pb-0 dark:border-red-400/40">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
          <span>{urgentLabel(item)}</span>
          <OwnerBadge owner={owner} />
          {item.kind === 'event' && item.event.critical && (
            <span className="badge border border-current">重要</span>
          )}
        </p>
        <p className="mt-0.5 text-[15px]">{title}</p>
        <p className="mt-0.5 text-sm tabular-nums">
          {item.kind === 'event'
            ? `${EVENT_TYPE_LABEL[item.event.type]}・${formatJaRange(item.range)}`
            : `タスク ${item.id}・期限 ${formatJaDate(item.date)}`}
        </p>
        {sharedTask && (
          <p className="mt-0.5 text-sm">
            完了チェック：{checkSummary(sharedTask.doneBy)}（2人ともチェックで完了）
          </p>
        )}
      </div>
      <button
        type="button"
        className="btn border border-red-800 bg-white px-3 text-sm text-red-900 dark:border-red-300 dark:bg-red-950 dark:text-red-100"
        aria-label={buttonLabel}
        aria-pressed={sharedTask ? mine : undefined}
        onClick={complete}
      >
        {buttonText}
      </button>
    </li>
  )
}

function UrgentSection() {
  const { data, today } = useAppData()
  const { edd, birthDate } = data.settings
  const items = useMemo(
    () => urgentItems(data.tasks, data.events, { edd, birthDate }, today),
    [data.tasks, data.events, edd, birthDate, today],
  )

  return (
    <section aria-labelledby="urgent-title">
      <h2 id="urgent-title" className="section-title mb-2">
        期限まで7日以内
      </h2>
      {items.length === 0 ? (
        <div className="card">
          <EmptyText>7日以内に期限が来るタスク・予定はありません。</EmptyText>
        </div>
      ) : (
        <div className="alert">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-bold">
            <AlertIcon size={18} />
            {items.length}件あります
          </p>
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
      <div className="mb-2 flex items-center justify-between">
        <h2 id="advice-title" className="section-title">
          今週のアドバイス
        </h2>
        <Link to="/advice" className="btn -mr-3 px-3 text-sm underline">
          すべて見る
        </Link>
      </div>
      <p className="muted mb-3 text-xs">{DISCLAIMER}</p>
      <div className="space-y-3">
        {advice.visible.length === 0 && (
          <div className="card">
            <EmptyText>未読のアドバイスはありません。</EmptyText>
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
      <h2 id="partner-title" className="section-title mb-2">
        相手の更新（24時間以内）
      </h2>
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
  return (
    <Page title="ふたりノート" showSettings>
      <StageCard />
      <UrgentSection />
      <AdviceSection />
      <PartnerSection />
      <InstallBanner />
    </Page>
  )
}
