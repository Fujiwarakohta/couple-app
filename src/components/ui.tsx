import type { ReactNode } from 'react'
import { contactPhone, telHref, type ContactEntry } from '../data/contacts'
import { OWNER_BADGE_CLASS, OWNER_LABEL } from '../data/labels'
import {
  KIND_CHIP_CLASS,
  KIND_ICON_CLASS,
  KIND_LABEL,
  TAG_CLASS,
  TAG_FAMILY_LABEL,
  tagFamily,
  type ItemKind,
} from '../data/theme'
import type { Progress } from '../lib/tasks'
import type { Contacts, Owner } from '../types'
import { PhoneIcon } from './Icons'

export function OwnerBadge({ owner }: { owner: Owner }) {
  return (
    <span className={`badge ${OWNER_BADGE_CLASS[owner]}`}>
      <span className="sr-only">担当：</span>
      {OWNER_LABEL[owner]}
    </span>
  )
}

/** 種類（タスク／予定／助言）を示すラベル。色と文字の両方で示す。 */
export function KindChip({ kind }: { kind: ItemKind }) {
  return <span className={`badge ${KIND_CHIP_CLASS[kind]}`}>{KIND_LABEL[kind]}</span>
}

/** 助言のタグ。分野ごとに色を分ける。 */
export function TagChip({ tag }: { tag: string }) {
  const family = tagFamily(tag)
  return (
    <span className={`badge ${TAG_CLASS[family]}`} title={TAG_FAMILY_LABEL[family]}>
      {tag}
    </span>
  )
}

interface SectionHeaderProps {
  id: string
  kind: ItemKind | 'soon' | 'partner'
  title: string
  icon: ReactNode
  count?: number
  action?: ReactNode
}

/** 画面内の節の見出し。種類の色のアイコンを付ける。 */
export function SectionHeader({ id, kind, title, icon, count, action }: SectionHeaderProps) {
  return (
    <div className="mb-2 flex min-h-11 items-center justify-between gap-2">
      <h2 id={id} className="section-title flex items-center gap-2">
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${KIND_ICON_CLASS[kind]}`}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span>{title}</span>
        {typeof count === 'number' && (
          <span className="muted text-sm font-normal tabular-nums">{count}件</span>
        )}
      </h2>
      {action}
    </div>
  )
}

/** 資料で「要確認」の項目に付ける。断定表示にしないための目印。 */
export function UnconfirmedBadge({ reason }: { reason?: string }) {
  return (
    <span
      className="badge border border-neutral-700 bg-white text-neutral-900 dark:border-neutral-300 dark:bg-neutral-900 dark:text-neutral-100"
      title={reason}
    >
      未確認
    </span>
  )
}

export function UnconfirmedNote({ reason }: { reason: string }) {
  return (
    <p className="rounded-lg border border-dashed border-neutral-600 p-3 text-sm dark:border-neutral-400">
      <UnconfirmedBadge />
      <span className="ml-2">
        {reason}。窓口・公式情報で確認するまで、確定した情報として扱わないでください。
      </span>
    </p>
  )
}

export function ProgressBar({ progress, label }: { progress: Progress; label: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="muted tabular-nums">
          {progress.done} / {progress.total}（{progress.percent}%）
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}の進捗`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="h-2.5 overflow-hidden rounded-full bg-neutral-300 dark:bg-neutral-600"
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width] duration-200 dark:bg-emerald-400"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="muted mt-1 text-xs">{hint}</p>}
    </div>
  )
}

interface ChoiceProps<T extends string> {
  legend: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  hideLegend?: boolean
}

/** 1つだけ選ぶ切り替え（担当・ステータスなど）。 */
export function Choice<T extends string>({
  legend,
  options,
  value,
  onChange,
  hideLegend,
}: ChoiceProps<T>) {
  return (
    <fieldset>
      <legend className={hideLegend ? 'sr-only' : 'field-label'}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="chip"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function Check({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 items-center gap-3 text-[15px]">
      <input
        id={id}
        type="checkbox"
        className="size-6 shrink-0 accent-neutral-900 dark:accent-neutral-100"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

export function ContactCard({
  entry,
  contacts,
  compact,
}: {
  entry: ContactEntry
  contacts: Contacts
  compact?: boolean
}) {
  const phone = contactPhone(entry, contacts)
  return (
    <div className="rounded-lg border border-neutral-300 p-3 dark:border-neutral-600">
      <p className="text-sm font-bold">{entry.name}</p>
      {!compact && <p className="muted mt-0.5 text-xs">{entry.topics.join('／')}</p>}
      {phone ? (
        <a
          href={telHref(phone)}
          className="btn btn-ghost mt-2 w-full tabular-nums"
          aria-label={`${entry.name}に電話する ${phone}`}
        >
          <PhoneIcon size={18} />
          {phone}
        </a>
      ) : (
        <p className="muted mt-2 text-sm">電話番号は未入力です（設定画面で入力できます）。</p>
      )}
    </div>
  )
}

export function EmptyText({ children }: { children: ReactNode }) {
  return <p className="muted py-2 text-sm">{children}</p>
}
