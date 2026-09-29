import { useMemo, useState } from 'react'
import { AdviceCard } from '../components/AdviceCard'
import { Page } from '../components/Layout'
import { Choice, EmptyText } from '../components/ui'
import { DISCLAIMER } from '../data/labels'
import { ADVICE } from '../data/static'
import { TAG_CLASS, TAG_FAMILIES, TAG_FAMILY_LABEL, tagFamily } from '../data/theme'
import { adviceWeek, formatWeeks, lifeStage } from '../lib/dates'
import { adviceForWeek } from '../lib/home'
import { useAppData } from '../state/AppContext'

type Scope = 'now' | 'all' | 'pinned'

const SCOPE_OPTIONS = [
  { value: 'now', label: '今の週数' },
  { value: 'all', label: 'すべて' },
  { value: 'pinned', label: 'ピン留め' },
] as const

/** タグは seed に出てくる順に並べる。 */
const TAGS = [...new Set(ADVICE.flatMap((a) => a.tags))]

export default function Advice() {
  const { data, today, actions } = useAppData()
  const [scope, setScope] = useState<Scope>('now')
  const [tag, setTag] = useState<string | null>(null)
  const [hideRead, setHideRead] = useState(false)

  const { edd, birthDate } = data.settings
  const stage = lifeStage({ edd, birthDate }, today)
  const week = adviceWeek({ edd, birthDate }, today)
  const state = data.adviceState

  const items = useMemo(() => {
    const pinned = new Set(state.pinned)
    const read = new Set(state.read)
    let list = scope === 'now' ? adviceForWeek(ADVICE, week) : ADVICE
    if (scope === 'pinned') list = list.filter((a) => pinned.has(a.id))
    if (tag) list = list.filter((a) => a.tags.includes(tag))
    if (hideRead) list = list.filter((a) => !read.has(a.id))
    // ピン留めを先頭に。それ以外は seed の並びのまま。
    return [...list].sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)))
  }, [scope, tag, hideRead, week, state])

  return (
    <Page title="助言">
      {/* 免責は固定文で常に表示する */}
      <p className="card text-sm font-semibold" role="note">
        {DISCLAIMER}
      </p>

      <section aria-label="絞り込み" className="space-y-3">
        <p className="text-sm">
          {stage.kind === 'pregnant'
            ? `現在：妊娠 ${formatWeeks(stage.weeks, stage.days)}`
            : `現在：生後 ${stage.ageDays}日（助言は ${week}週相当を表示）`}
        </p>
        <Choice legend="表示する範囲" options={SCOPE_OPTIONS} value={scope} onChange={setScope} />
        <fieldset>
          <legend className="field-label">タグ</legend>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
            <button
              type="button"
              className="chip"
              aria-pressed={tag === null}
              onClick={() => setTag(null)}
            >
              すべて
            </button>
            {TAGS.map((t) => (
              <button
                key={t}
                type="button"
                className="chip"
                aria-pressed={tag === t}
                onClick={() => setTag(tag === t ? null : t)}
              >
                <span
                  className={`mr-1.5 inline-block size-3 rounded-full border border-neutral-500 ${TAG_CLASS[tagFamily(t)].split(' ')[0]}`}
                  aria-hidden="true"
                />
                {t}
              </button>
            ))}
          </div>
          <ul className="flex flex-wrap gap-1.5 text-xs" aria-label="タグの色の見方">
            {TAG_FAMILIES.map((f) => (
              <li key={f} className={`badge ${TAG_CLASS[f]}`}>
                {TAG_FAMILY_LABEL[f]}
              </li>
            ))}
          </ul>
        </fieldset>
        <button
          type="button"
          className="chip"
          aria-pressed={hideRead}
          onClick={() => setHideRead((v) => !v)}
        >
          既読を隠す
        </button>
        <p className="muted text-sm" role="status">
          {items.length}件を表示中
        </p>
      </section>

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="card">
            <EmptyText>条件に合う助言はありません。</EmptyText>
          </div>
        )}
        {items.map((item) => (
          <AdviceCard
            key={item.id}
            item={item}
            state={state}
            onChange={actions.setAdviceState}
            heading="h2"
          />
        ))}
      </div>
    </Page>
  )
}
