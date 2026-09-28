import { describe, expect, it } from 'vitest'
import { ADVICE } from '../data/static'
import { GAIN_RANGES, WEIGHT_GAIN_ADVICE_ID, bmi, gainRange, gainRangeForBmi } from './weight'

describe('体重増加の目安は seed(a06) と一致する', () => {
  const a06 = ADVICE.find((a) => a.id === WEIGHT_GAIN_ADVICE_ID)

  it('a06 が存在する', () => {
    expect(a06).toBeDefined()
  })

  it('各区分の表記が a06 の本文に含まれる', () => {
    for (const { range } of GAIN_RANGES) {
      expect(a06?.body, range.bmiLabel).toContain(`${range.bmiLabel}:${range.text}`)
    }
  })

  it('数値が表記と一致する', () => {
    for (const { range } of GAIN_RANGES) {
      if (range.minKg === null) {
        expect(range.text).toContain(`上限${range.maxKg}kg`)
      } else {
        expect(range.text).toBe(`${range.minKg}〜${range.maxKg}kg`)
      }
    }
  })
})

describe('bmi', () => {
  it('体重 ÷ 身長(m)²', () => {
    expect(bmi(50, 160)).toBeCloseTo(19.53, 2)
  })

  it('未入力・0 は null', () => {
    expect(bmi(0, 160)).toBeNull()
    expect(bmi(50, 0)).toBeNull()
  })
})

describe('gainRangeForBmi の境界', () => {
  it('18.5 未満 / 18.5 ちょうど', () => {
    expect(gainRangeForBmi(18.49).text).toBe('12〜15kg')
    expect(gainRangeForBmi(18.5).text).toBe('10〜13kg')
  })

  it('25 未満 / 25 ちょうど', () => {
    expect(gainRangeForBmi(24.99).text).toBe('10〜13kg')
    expect(gainRangeForBmi(25).text).toBe('7〜10kg')
  })

  it('30 未満 / 30 以上', () => {
    expect(gainRangeForBmi(29.99).text).toBe('7〜10kg')
    expect(gainRangeForBmi(30).text).toBe('個別対応(上限5kg目安)')
    expect(gainRangeForBmi(30).minKg).toBeNull()
  })
})

describe('gainRange', () => {
  it('妊娠前体重・身長が未入力なら null', () => {
    expect(gainRange(null, 160)).toBeNull()
    expect(gainRange(50, null)).toBeNull()
  })

  it('入力済みなら区分を返す', () => {
    expect(gainRange(50, 160)?.text).toBe('10〜13kg')
  })
})
