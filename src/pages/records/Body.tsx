import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Choice, EmptyText, Field } from '../../components/ui'
import { WeightChart } from '../../components/WeightChart'
import { ADVICE } from '../../data/static'
import { formatJaDate, isValidYmd } from '../../lib/dates'
import { WEIGHT_GAIN_ADVICE_ID, bmi, gainRange } from '../../lib/weight'
import { useAppData } from '../../state/AppContext'
import type { BpValue, RecordItem, RecordKind, Ymd } from '../../types'

const KIND_OPTIONS = [
  { value: 'weight', label: '体重' },
  { value: 'bp', label: '血圧' },
  { value: 'movement', label: '胎動' },
] as const

function isBp(v: RecordItem['value']): v is BpValue {
  return typeof v === 'object' && v !== null
}

function valueText(r: RecordItem): string {
  if (r.kind === 'weight') return typeof r.value === 'number' ? `${r.value}kg` : ''
  if (r.kind === 'bp') return isBp(r.value) ? `${r.value.sys} / ${r.value.dia} mmHg` : ''
  return typeof r.value === 'number' ? `10回まで ${r.value}分` : ''
}

function RecordList({ items }: { items: RecordItem[] }) {
  const { actions } = useAppData()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  if (items.length === 0) return <EmptyText>まだ記録がありません。</EmptyText>
  return (
    <ul>
      {items.map((r) => (
        <li
          key={r.id}
          className="flex items-center gap-2 border-t border-neutral-200 py-1 first:border-t-0 dark:border-neutral-700"
        >
          <div className="min-w-0 flex-1 py-2">
            <p className="text-sm tabular-nums">{formatJaDate(r.date)}</p>
            <p className="text-[15px] font-semibold tabular-nums">{valueText(r)}</p>
            {r.memo && <p className="muted text-sm">{r.memo}</p>}
          </div>
          {confirmId === r.id ? (
            <>
              <button type="button" className="btn btn-danger px-3 text-sm" onClick={() => actions.removeRecord(r.id)}>
                削除する
              </button>
              <button type="button" className="btn btn-ghost px-3 text-sm" onClick={() => setConfirmId(null)}>
                やめる
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-ghost px-3 text-sm"
              aria-label={`${formatJaDate(r.date)} の記録を削除`}
              onClick={() => setConfirmId(r.id)}
            >
              削除
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function WeightForm({ today }: { today: Ymd }) {
  const { actions } = useAppData()
  const [date, setDate] = useState<Ymd>(today)
  const [kg, setKg] = useState('')
  const [memo, setMemo] = useState('')
  const value = Number(kg)
  const valid = isValidYmd(date) && kg !== '' && value >= 20 && value <= 200

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        actions.saveRecord(null, { kind: 'weight', date, value, memo })
        setKg('')
        setMemo('')
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="日付" htmlFor="weight-date">
          <input id="weight-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="体重（kg）" htmlFor="weight-kg">
          <input
            id="weight-kg"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={20}
            max={200}
            className="input"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="メモ（任意）" htmlFor="weight-memo">
        <input id="weight-memo" type="text" className="input" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>
      <button type="submit" className="btn btn-primary w-full" disabled={!valid}>
        体重を記録
      </button>
    </form>
  )
}

function BpForm({ today }: { today: Ymd }) {
  const { actions } = useAppData()
  const [date, setDate] = useState<Ymd>(today)
  const [sys, setSys] = useState('')
  const [dia, setDia] = useState('')
  const [memo, setMemo] = useState('')
  const s = Number(sys)
  const d = Number(dia)
  const valid = isValidYmd(date) && s >= 50 && s <= 260 && d >= 30 && d <= 200

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        actions.saveRecord(null, { kind: 'bp', date, value: { sys: s, dia: d }, memo })
        setSys('')
        setDia('')
        setMemo('')
      }}
    >
      <Field label="日付" htmlFor="bp-date">
        <input id="bp-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="上（収縮期）" htmlFor="bp-sys">
          <input id="bp-sys" type="number" inputMode="numeric" min={50} max={260} className="input" value={sys} onChange={(e) => setSys(e.target.value)} required />
        </Field>
        <Field label="下（拡張期）" htmlFor="bp-dia">
          <input id="bp-dia" type="number" inputMode="numeric" min={30} max={200} className="input" value={dia} onChange={(e) => setDia(e.target.value)} required />
        </Field>
      </div>
      <Field label="メモ（任意）" htmlFor="bp-memo">
        <input id="bp-memo" type="text" className="input" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>
      <button type="submit" className="btn btn-primary w-full" disabled={!valid}>
        血圧を記録
      </button>
    </form>
  )
}

function MovementForm({ today }: { today: Ymd }) {
  const { actions } = useAppData()
  const [date, setDate] = useState<Ymd>(today)
  const [minutes, setMinutes] = useState('')
  const [memo, setMemo] = useState('')
  const m = Number(minutes)
  const hasMinutes = minutes !== ''
  const valid = isValidYmd(date) && (hasMinutes ? m > 0 && m <= 600 : memo.trim() !== '')

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        actions.saveRecord(null, { kind: 'movement', date, value: hasMinutes ? m : null, memo })
        setMinutes('')
        setMemo('')
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="日付" htmlFor="mv-date">
          <input id="mv-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="10回までの分数" htmlFor="mv-min">
          <input id="mv-min" type="number" inputMode="numeric" min={1} max={600} className="input" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
      </div>
      <Field label="メモ" htmlFor="mv-memo" hint="分数かメモのどちらかを入力してください。">
        <input id="mv-memo" type="text" className="input" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>
      <button type="submit" className="btn btn-primary w-full" disabled={!valid}>
        胎動を記録
      </button>
    </form>
  )
}

export function BodyRecords() {
  const { data, today } = useAppData()
  const [kind, setKind] = useState<RecordKind>('weight')
  const { edd, prePregnancyWeightKg, heightCm } = data.settings

  const items = useMemo(
    () =>
      data.records
        .filter((r) => r.kind === kind)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [data.records, kind],
  )
  const weightPoints = useMemo(
    () =>
      data.records
        .filter((r) => r.kind === 'weight' && typeof r.value === 'number')
        .map((r) => ({ date: r.date, kg: r.value as number })),
    [data.records],
  )
  const range = gainRange(prePregnancyWeightKg, heightCm)
  const preBmi =
    prePregnancyWeightKg !== null && heightCm !== null ? bmi(prePregnancyWeightKg, heightCm) : null
  const source = ADVICE.find((a) => a.id === WEIGHT_GAIN_ADVICE_ID)

  return (
    <div className="space-y-5">
      <Choice legend="記録の種類" hideLegend options={KIND_OPTIONS} value={kind} onChange={setKind} />

      {kind === 'weight' && (
        <>
          <section aria-label="体重のグラフ" className="card">
            {range && preBmi !== null ? (
              <p className="text-sm">
                妊娠前BMI <span className="tabular-nums">{preBmi.toFixed(1)}</span>（{range.bmiLabel}）：
                妊娠全期間の増加の目安 <span className="font-bold">{range.text}</span>
              </p>
            ) : (
              <p className="text-sm">
                <Link to="/settings" className="underline">
                  設定
                </Link>
                で妊娠前体重と身長を入力すると、増加の目安を重ねて表示します。
              </p>
            )}
            {weightPoints.length === 0 && prePregnancyWeightKg === null ? (
              <EmptyText>体重を記録するとグラフが表示されます。</EmptyText>
            ) : (
              <div className="mt-2">
                <WeightChart
                  points={weightPoints}
                  edd={edd}
                  prePregnancyWeightKg={prePregnancyWeightKg}
                  range={range}
                />
              </div>
            )}
            {source && <p className="muted mt-1 text-xs">目安の出典：{source.source}。週1回、同じ条件で計測。</p>}
          </section>
          <section aria-label="体重を記録" className="card">
            <WeightForm today={today} />
          </section>
        </>
      )}
      {kind === 'bp' && (
        <section aria-label="血圧を記録" className="card">
          <BpForm today={today} />
        </section>
      )}
      {kind === 'movement' && (
        <section aria-label="胎動を記録" className="card">
          <MovementForm today={today} />
        </section>
      )}

      <section aria-label="記録の一覧" className="card">
        <h2 className="section-title mb-1 text-sm">記録の一覧</h2>
        <RecordList items={items} />
      </section>
    </div>
  )
}
