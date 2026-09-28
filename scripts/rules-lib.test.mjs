import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLACEHOLDER, parseEnv, parseUids, renderRules } from './rules-lib.mjs'

const template = readFileSync(resolve(import.meta.dirname, '..', 'firestore.rules.template'), 'utf8')
const UID_A = 'AbCdEfGhIjKlMnOpQrStUvWxYz01'
const UID_B = 'Zz9876543210yXwVuTsRqPoNmLkJ'

describe('parseEnv', () => {
  it('コメントと空行を無視する', () => {
    const env = parseEnv('# コメント\n\nA=1\nB = "x y"\nC=\n')
    expect(env).toEqual({ A: '1', B: 'x y', C: '' })
  })
})

describe('parseUids', () => {
  it('2つの UID を受け付ける', () => {
    expect(parseUids(`${UID_A}, ${UID_B}`)).toEqual([UID_A, UID_B])
  })

  it('空・1つ・3つ・重複は拒否する', () => {
    expect(() => parseUids('')).toThrow()
    expect(() => parseUids(UID_A)).toThrow(/2 つ必要/)
    expect(() => parseUids(`${UID_A},${UID_B},abcdefgh`)).toThrow(/2 つ必要/)
    expect(() => parseUids(`${UID_A},${UID_A}`)).toThrow(/重複/)
  })

  it('ルールを壊す文字を含む UID は拒否する', () => {
    expect(() => parseUids(`${UID_A},x'] || true || ['`)).toThrow(/形式/)
    expect(() => parseUids(`${UID_A},abc def`)).toThrow(/形式/)
  })
})

describe('renderRules', () => {
  const rules = renderRules(template, [UID_A, UID_B])

  it('UID を埋め込み、目印を残さない', () => {
    expect(rules).toContain(`request.auth.uid in ['${UID_A}', '${UID_B}']`)
    expect(rules).not.toContain(PLACEHOLDER)
  })

  it('ログイン必須で、世帯の下だけを許可し、それ以外は拒否する', () => {
    expect(rules).toContain("rules_version = '2';")
    expect(rules).toContain('request.auth != null')
    expect(rules).toContain('match /households/main {')
    expect(rules).toContain('match /households/main/{document=**} {')
    expect(rules).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;/)
  })

  it('無条件に許可する記述が無い', () => {
    expect(rules).not.toMatch(/allow [^;]*: if true/)
    expect(rules).not.toMatch(/allow [^;:]*;/)
  })

  it('雛形そのものはデプロイできない（目印が残っている）', () => {
    expect(template).toContain(PLACEHOLDER)
  })
})
