import { KIND_BORDER_CLASS } from '../data/theme'
import { adviceUnconfirmed } from '../data/unconfirmed'
import type { AdviceItem, AdviceState } from '../types'
import { telHref } from '../data/contacts'
import { CheckIcon, PhoneIcon, PinIcon } from './Icons'
import { KindChip, TagChip, UnconfirmedBadge } from './ui'

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

/**
 * 助言（知っておくこと）のカード。タスク（やること）と見分けられるよう、
 * 左の帯と「助言」のラベルを青緑にし、操作は「既読」「ピン留め」だけにしている。
 * 本文・数値は seed の値をそのまま表示する（丸め・加工をしない）。出典を必ず表示する。
 */
export function AdviceCard({ item, state, onChange, heading: Heading = 'h3' }: AdviceCardProps) {
  const read = state.read.includes(item.id)
  const pinned = state.pinned.includes(item.id)
  const unconfirmed = adviceUnconfirmed(item)

  return (
    <article className={`card ${KIND_BORDER_CLASS.advice}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <KindChip kind="advice" />
        {item.tags.map((tag) => (
          <TagChip key={tag} tag={tag} />
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
      {item.contacts && item.contacts.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="問い合わせ先">
          {item.contacts.map((c) => (
            <li key={c.phone + c.name}>
              <a
                href={telHref(c.phone)}
                className="btn btn-ghost w-full justify-start px-3 text-left text-sm"
                aria-label={`${c.name}に電話する ${c.phone}`}
              >
                <PhoneIcon size={18} />
                <span className="min-w-0 flex-1 py-1.5">
                  <span className="block font-normal">{c.name}</span>
                  <span className="block tabular-nums">{c.phone}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="muted mt-2 text-xs">出典：{item.source}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="chip chip-advice flex-1"
          aria-pressed={read}
          onClick={() => onChange({ ...state, read: toggleId(state.read, item.id) })}
        >
          <CheckIcon size={18} />
          <span className="ml-1">{read ? '既読' : '既読にする'}</span>
        </button>
        <button
          type="button"
          className="chip chip-advice flex-1"
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
