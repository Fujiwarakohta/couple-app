import type { Contacts } from '../types'

/**
 * 窓口マスタ（指示書 2.6）。電話番号は指示書の記載どおり。
 * phone が null の窓口は、設定画面で利用者が入力する（settingsKey）。
 */
export interface ContactEntry {
  id: string
  name: string
  phone: string | null
  settingsKey: keyof Contacts | null
  topics: string[]
  /** タスク本文・場所とこの窓口を結び付けるための語 */
  keywords: string[]
  /** 資料で「要確認」の事項。断定表示しない。 */
  unconfirmed?: string[]
}

export const CONTACTS: ContactEntry[] = [
  {
    id: 'ishigaki-health',
    name: '石垣市健康福祉センター 健康づくり係／地域保健係',
    phone: '0980-88-0088',
    settingsKey: null,
    topics: [
      '妊娠届',
      '妊婦健診・産婦健診（償還払い）',
      '支援給付金',
      '産後ケア',
      '離島通院費助成',
    ],
    keywords: ['健康福祉センター', '妊娠届', '償還払い', '支援給付金', '産後ケア', '通院費助成', '予防接種依頼', '受診票'],
    unconfirmed: [
      '離島通院費助成が里帰り（県外）出産に適用されるか',
      '新生児聴覚検査助成の上限3,500円・要件',
      '妊婦歯科健診の有無',
    ],
  },
  {
    id: 'ishigaki-kodomo',
    name: '石垣市こども家庭課 給付係',
    phone: '0980-87-0771',
    settingsKey: null,
    topics: ['こども医療費助成', '児童手当（マイナポータル電子申請も可）'],
    keywords: ['こども家庭課', 'こども医療費', '児童手当'],
    unconfirmed: ['こども医療費（県外受診分）の申請期限2年'],
  },
  {
    id: 'shonan',
    name: '恵愛会松南病院',
    phone: null,
    settingsKey: 'shonan',
    topics: [
      '分娩',
      '初診の電話予約',
      '直接支払制度',
      '出産手当金の医師記入',
      '新生児聴覚検査',
    ],
    keywords: ['松南病院'],
    unconfirmed: ['無痛分娩の追加費用（調査報告書では10万円〜税別、公式未確認）'],
  },
  {
    id: 'yaeyama',
    name: '沖縄県立八重山病院',
    phone: null,
    settingsKey: 'yaeyama',
    topics: ['初診・妊婦健診', '松南病院宛の紹介状'],
    keywords: ['八重山病院'],
  },
  {
    id: 'hakusan-health',
    name: '白山市いきいき健康課',
    phone: '076-274-2155',
    settingsKey: null,
    topics: ['里帰り中の母子保健の相談'],
    keywords: ['いきいき健康課', '白山市の母子保健'],
  },
  {
    id: 'hakusan-kosodate',
    name: '白山市子育て支援課',
    phone: '076-274-9575',
    settingsKey: null,
    topics: ['里帰り中の子育て支援の相談'],
    keywords: ['子育て支援課'],
  },
  {
    id: 'mother-hr',
    name: '母の勤務先 人事',
    phone: null,
    settingsKey: 'motherHr',
    topics: ['産休・育休', '出産手当金', '育休給付'],
    keywords: ['就業規則', '産休', '育休', '出産手当金', '育児休業給付', '勤務先', '人事'],
  },
  {
    id: 'father-ga',
    name: '父の会社 総務',
    phone: null,
    settingsKey: 'fatherGa',
    topics: ['子の健保加入'],
    keywords: ['健保加入', '健康保険に加入', '被扶養者', '総務'],
  },
]

/**
 * 資料で「要確認」とされ、対応する窓口が資料上で特定されていない制度。
 * 断定表示せず、確認先も決め打ちしない。
 */
export const UNCONFIRMED_PROGRAMS: string[] = [
  '妊婦のための遠方の分娩取扱施設への交通費・宿泊費支援',
]

export function contactPhone(entry: ContactEntry, contacts: Contacts | undefined): string | null {
  if (entry.phone) return entry.phone
  if (entry.settingsKey && contacts) {
    const value = contacts[entry.settingsKey]?.trim()
    return value ? value : null
  }
  return null
}

/** tel: リンク用に数字と + だけを残す。 */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

/** タスク本文・場所の文字列から、関係する窓口を探す。 */
export function matchContacts(text: string): ContactEntry[] {
  return CONTACTS.filter((c) => c.keywords.some((k) => text.includes(k)))
}

/** メモに挿入する雛形。住所・保険証番号・口座番号の欄は作らない。 */
export function noteTemplate(entry: ContactEntry | null, phone: string | null): string {
  return [
    `窓口：${entry?.name ?? ''}`,
    `電話：${phone ?? ''}`,
    '必要書類：',
    '確認日：',
    '担当者：',
    '確認結果：',
  ].join('\n')
}
