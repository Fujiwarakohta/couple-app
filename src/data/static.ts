import adviceJson from '../../seed/advice.json'
import guideJson from '../../seed/advice_guide.json'
import roadmapJson from '../../seed/advice_roadmap.json'
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

/** 元の seed（advice.json）のアドバイス。 */
export const SEED_ADVICE = adviceJson.items as AdviceItem[]
/** 調査報告書「妊娠期の健康と栄養ガイド」から追加したアドバイス（advice_guide.json）。 */
export const GUIDE_ADVICE = guideJson.items as AdviceItem[]
/** 調査報告書「石垣市在住を前提とした…実務ロードマップ」から追加したアドバイス（advice_roadmap.json）。 */
export const ROADMAP_ADVICE = roadmapJson.items as AdviceItem[]
/** 画面に出すアドバイス。元の seed を先に、追加分を後に並べる。 */
export const ADVICE: AdviceItem[] = [...SEED_ADVICE, ...GUIDE_ADVICE, ...ROADMAP_ADVICE]

export const NINPU_LIMITS: NinpuLimit[] = [...ninpuJson.tickets, ...ninpuJson.antibodyTests]
export const NINPU_LIMITS_SOURCE: string = ninpuJson.source
export const NINPU_USAGE_NOTE: string = ninpuJson.usageNote
export const NINPU_APPLICATION_NOTE: string = ninpuJson.applicationNote

export function ninpuLimitYen(ticketNo: string | null): number | null {
  if (!ticketNo) return null
  return NINPU_LIMITS.find((t) => t.ticketNo === ticketNo)?.limitYen ?? null
}
