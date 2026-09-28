/**
 * 体重増加の目安。数値は seed/advice.json の a06
 * 「体重増加の目安(全期間)」（厚生労働省 妊娠中の体重増加指導の目安(2021)）と同じ値。
 * weight.test.ts で a06 の本文と一致することを検証している。
 */

export const WEIGHT_GAIN_ADVICE_ID = 'a06'

export interface GainRange {
  /** 妊娠前BMIの区分の表記（a06 の表記どおり） */
  bmiLabel: string
  /** 増加量の下限 kg。個別対応の区分は null。 */
  minKg: number | null
  /** 増加量の上限 kg */
  maxKg: number
  /** a06 の表記どおりの目安 */
  text: string
}

export const GAIN_RANGES: { upperBmi: number; range: GainRange }[] = [
  { upperBmi: 18.5, range: { bmiLabel: '18.5未満', minKg: 12, maxKg: 15, text: '12〜15kg' } },
  { upperBmi: 25, range: { bmiLabel: '18.5〜25未満', minKg: 10, maxKg: 13, text: '10〜13kg' } },
  { upperBmi: 30, range: { bmiLabel: '25〜30未満', minKg: 7, maxKg: 10, text: '7〜10kg' } },
  {
    upperBmi: Infinity,
    range: { bmiLabel: '30以上', minKg: null, maxKg: 5, text: '個別対応(上限5kg目安)' },
  },
]

export function bmi(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm > 0)) return null
  const m = heightCm / 100
  return weightKg / (m * m)
}

export function gainRangeForBmi(value: number): GainRange {
  for (const { upperBmi, range } of GAIN_RANGES) {
    if (value < upperBmi) return range
  }
  return GAIN_RANGES[GAIN_RANGES.length - 1].range
}

export function gainRange(prePregnancyWeightKg: number | null, heightCm: number | null): GainRange | null {
  if (prePregnancyWeightKg === null || heightCm === null) return null
  const value = bmi(prePregnancyWeightKg, heightCm)
  return value === null ? null : gainRangeForBmi(value)
}
