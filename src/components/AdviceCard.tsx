import { adviceUnconfirmed } from '../data/unconfirmed'
import type { AdviceItem, AdviceState } from '../types'
import { CheckIcon, PinIcon } from './Icons'
import { UnconfirmedBadge } from './ui'

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

function weeksLabel(weeks: [number, number]): string {
  return `${weeks[0]}〜${weeks[1]}週`
}

interface AdviceCardProps {
  item: AdviceItem
  state: AdviceState
  onChange: (next: AdviceState) => void
  /** 見出しの階層。画面の見出しの直下なら h2、節の中なら h3。 */
  heading?: 'h2' | 'h3'
}

/** 本文・数値は seed の値をそのまま表示する（丸め・加工をしない）。出典を必ず表示する。 */
export function AdviceCard({ item, state, onChange, heading: Heading = 'h3' }: AdviceCardProps) {
  const read = state.read.includes(item.id)
  const pinned = state.pinned.includes(item.id)
  const unconfirmed = adviceUnconfirmed(item.id, item.body, item.source)

  return (
    <article className="card">
      <div className="flex flex-wrap items-center gap-1.5">
        {item.tags.map((tag) => (
          <span
            key={tag}
            className="badge bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
          >
            {tag}
          </span>
        ))}
        <span className="muted text-xs">{weeksLabel(item.weeks)}</span>
        {pinned && <span className="badge border border-current">ピン留め</span>}
        {unconfirmed && <UnconfirmedBadge reason={unconfirmed.reason} />}
      </div>
      <Heading className="mt-2 text-base font-bold">{item.title}</Heading>
      <p className="mt-1 text-[15px]">{item.body}</p>
      {unconfirmed && (
        <p className="mt-2 text-sm">
          <span className="font-semibold">未確認：</span>
          {unconfirmed.reason}
        </p>
      )}
      <p className="muted mt-2 text-xs">出典：{item.source}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="chip flex-1"
          aria-pressed={read}
          onClick={() => onChange({ ...state, read: toggleId(state.read, item.id) })}
        >
          <CheckIcon size={18} />
          <span className="ml-1">{read ? '既読' : '既読にする'}</span>
        </button>
        <button
          type="button"
          className="chip flex-1"
          aria-pressed={pinned}
          onClick={() => onChange({ ...state, pinned: toggleId(state.pinned, item.id) })}
        >
          <PinIcon size={18} />
          <span className="ml-1">{pinned ? 'ピン留め中' : 'ピン留め'}</span>
        </button>
      </div>
    </article>
  )
}
