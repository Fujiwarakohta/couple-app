import adviceJson from '../../seed/advice.json'
import ninpuJson from '../../seed/ninpu_limits.json'
import phasesJson from '../../seed/phases.json'
import type { AdviceItem, Phase } from '../types'

/**
 * 静的にバンドルする seed（advice / phases / 妊婦健診の上限額）。
 * 値は seed のまま使い、アプリ側で書き換えない。
 * 画面ごとの JS にだけ含めるため、初回投入（seed.ts）とはファイルを分けている。
 */

export interface NinpuLimit {
  ticketNo: string
  label: string
  limitYen: number
}

export const PHASES = phasesJson as Phase[]
export const ADVICE = adviceJson.items as AdviceItem[]

export const NINPU_LIMITS: NinpuLimit[] = [...ninpuJson.tickets, ...ninpuJson.antibodyTests]
export const NINPU_LIMITS_SOURCE: string = ninpuJson.source
export const NINPU_USAGE_NOTE: string = ninpuJson.usageNote
export const NINPU_APPLICATION_NOTE: string = ninpuJson.applicationNote

export function ninpuLimitYen(ticketNo: string | null): number | null {
  if (!ticketNo) return null
  return NINPU_LIMITS.find((t) => t.ticketNo === ticketNo)?.limitYen ?? null
}
