import { PREGNANCY_DAYS, diffDays, pregnancyStart } from '../lib/dates'
import type { GainRange } from '../lib/weight'
import type { Ymd } from '../types'

export interface WeightPoint {
  date: Ymd
  kg: number
}

interface WeightChartProps {
  points: WeightPoint[]
  edd: Ymd
  prePregnancyWeightKg: number | null
  range: GainRange | null
}

const W = 343
const H = 230
const M = { left: 38, right: 10, top: 12, bottom: 28 }

function niceStep(span: number): number {
  if (span <= 6) return 1
  if (span <= 12) return 2
  if (span <= 30) return 5
  return 10
}

/**
 * 体重の折れ線グラフ（SVG 手描き）。
 * 増加の目安は「妊娠全期間での増加量」なので、妊娠前体重に目安を足した高さに横帯で示す。
 * 週ごとの増え方に直す（按分する）ことはしない。
 */
export function WeightChart({ points, edd, prePregnancyWeightKg, range }: WeightChartProps) {
  const start = pregnancyStart(edd)
  const data = [...points]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({ ...p, day: diffDays(p.date, start) }))

  const pre = prePregnancyWeightKg
  const bandLow = pre !== null && range && range.minKg !== null ? pre + range.minKg : null
  const bandHigh = pre !== null && range ? pre + range.maxKg : null

  const values = [
    ...data.map((d) => d.kg),
    ...(pre !== null ? [pre] : []),
    ...(bandLow !== null ? [bandLow] : []),
    ...(bandHigh !== null ? [bandHigh] : []),
  ]
  if (values.length === 0) return null

  const step = niceStep(Math.max(...values) - Math.min(...values))
  const yMin = Math.floor((Math.min(...values) - 1) / step) * step
  const yMax = Math.ceil((Math.max(...values) + 1) / step) * step
  const xMin = Math.min(0, ...data.map((d) => d.day))
  const xMax = Math.max(PREGNANCY_DAYS, ...data.map((d) => d.day))

  const x = (day: number) => M.left + ((day - xMin) / (xMax - xMin)) * (W - M.left - M.right)
  const y = (kg: number) => M.top + (1 - (kg - yMin) / (yMax - yMin)) * (H - M.top - M.bottom)

  const yTicks: number[] = []
  for (let v = yMin; v <= yMax; v += step) yTicks.push(v)
  const xTicks = [0, 10, 20, 30, 40].map((w) => w * 7).filter((d) => d >= xMin && d <= xMax)

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.day).toFixed(1)},${y(d.kg).toFixed(1)}`).join(' ')
  const last = data[data.length - 1]

  const summary = [
    data.length ? `体重の記録 ${data.length}件。最新は ${last.date} の ${last.kg}kg。` : '体重の記録はまだありません。',
    pre !== null ? `妊娠前体重 ${pre}kg。` : '',
    range ? `妊娠全期間の増加の目安は ${range.text}（妊娠前BMI ${range.bmiLabel}）。` : '',
  ].join('')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={summary}
      className="w-full text-neutral-900 dark:text-neutral-100"
    >
      {/* 増加の目安（横帯） */}
      {bandLow !== null && bandHigh !== null && (
        <rect
          x={M.left}
          y={y(bandHigh)}
          width={W - M.left - M.right}
          height={y(bandLow) - y(bandHigh)}
          className="fill-teal-200 dark:fill-teal-900"
        />
      )}
      {bandLow === null && bandHigh !== null && (
        <line
          x1={M.left}
          x2={W - M.right}
          y1={y(bandHigh)}
          y2={y(bandHigh)}
          className="stroke-teal-700 dark:stroke-teal-300"
          strokeWidth="2"
        />
      )}

      {/* 目盛り */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={M.left}
            x2={W - M.right}
            y1={y(v)}
            y2={y(v)}
            stroke="currentColor"
            strokeOpacity="0.2"
          />
          <text x={M.left - 5} y={y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor">
            {v}
          </text>
        </g>
      ))}
      {xTicks.map((d) => (
        <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize="11" fill="currentColor">
          {d / 7}週
        </text>
      ))}
      <line x1={M.left} x2={M.left} y1={M.top} y2={H - M.bottom} stroke="currentColor" />
      <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="currentColor" />
      <text x={4} y={10} fontSize="10" fill="currentColor">
        kg
      </text>

      {/* 妊娠前体重 */}
      {pre !== null && (
        <g>
          <line
            x1={M.left}
            x2={W - M.right}
            y1={y(pre)}
            y2={y(pre)}
            stroke="currentColor"
            strokeDasharray="4 4"
          />
          <text x={W - M.right - 2} y={y(pre) - 4} textAnchor="end" fontSize="10" fill="currentColor">
            妊娠前 {pre}kg
          </text>
        </g>
      )}
      {bandHigh !== null && range && (
        <text x={M.left + 4} y={y(bandHigh) + 12} fontSize="10" fill="currentColor">
          増加の目安 {range.text}
        </text>
      )}

      {/* 記録 */}
      {data.length > 1 && <path d={line} fill="none" stroke="currentColor" strokeWidth="2" />}
      {data.map((d) => (
        <circle key={d.date} cx={x(d.day)} cy={y(d.kg)} r="3.5" fill="currentColor" />
      ))}
    </svg>
  )
}
