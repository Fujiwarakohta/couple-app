import { useState } from 'react'
import { UidBox } from '../components/Gate'
import { InstallBanner } from '../components/InstallBanner'
import { Page } from '../components/Layout'
import { ContactCard, Field, UnconfirmedBadge } from '../components/ui'
import { CONTACTS, UNCONFIRMED_PROGRAMS } from '../data/contacts'
import { ROLE_LABEL } from '../data/labels'
import { eddFromLmp, formatJaDate, isValidYmd, todayYmd } from '../lib/dates'
import { useAppData, type AppData } from '../state/AppContext'
import type { Contacts, Settings as SettingsValue } from '../types'

function toNumberOrNull(text: string): number | null {
  if (text.trim() === '') return null
  const n = Number(text)
  return Number.isFinite(n) && n > 0 ? n : null
}

function exportJson(data: AppData) {
  const payload = {
    exportedAt: new Date().toISOString(),
    note: '領収書の写真は端末内にのみ保存されているため、このファイルには含まれません。',
    household: data.household,
    tasks: data.tasks,
    events: data.events,
    presence: data.presence,
    records: data.records,
    receipts: data.receipts,
    adviceState: data.adviceState,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `couple-app-export-${todayYmd()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function SettingsForm() {
  const { data, actions } = useAppData()
  const s = data.settings
  const [edd, setEdd] = useState(s.edd)
  const [lmp, setLmp] = useState(s.lmp)
  const [birthDate, setBirthDate] = useState(s.birthDate ?? '')
  const [weight, setWeight] = useState(s.prePregnancyWeightKg?.toString() ?? '')
  const [height, setHeight] = useState(s.heightCm?.toString() ?? '')
  const [motherName, setMotherName] = useState(s.motherName)
  const [fatherName, setFatherName] = useState(s.fatherName)
  const [babyName, setBabyName] = useState(s.babyName)
  const [contacts, setContacts] = useState<Contacts>(s.contacts)
  const [saved, setSaved] = useState(false)

  const valid = isValidYmd(edd) && isValidYmd(lmp) && (birthDate === '' || isValidYmd(birthDate))
  const eddFromLmpValue = isValidYmd(lmp) ? eddFromLmp(lmp) : null
  const mismatch = valid && eddFromLmpValue !== null && eddFromLmpValue !== edd
  const touch = () => setSaved(false)

  const save = () => {
    if (!valid) return
    const next: SettingsValue = {
      edd,
      lmp,
      birthDate: birthDate || null,
      prePregnancyWeightKg: toNumberOrNull(weight),
      heightCm: toNumberOrNull(height),
      motherName: motherName.trim(),
      fatherName: fatherName.trim(),
      babyName: babyName.trim(),
      contacts: {
        shonan: contacts.shonan.trim(),
        yaeyama: contacts.yaeyama.trim(),
        motherHr: contacts.motherHr.trim(),
        fatherGa: contacts.fatherGa.trim(),
      },
    }
    actions.saveSettings(next)
    setSaved(true)
  }

  return (
    <form
      className="space-y-5"
      onChange={touch}
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <section aria-labelledby="st-dates" className="card space-y-4">
        <h2 id="st-dates" className="section-title">
          日付
        </h2>
        <Field
          label="出産予定日（EDD）"
          htmlFor="st-edd"
          hint="変更すると、週数・予定の日付・アドバイスがすべて再計算されます。"
        >
          <input id="st-edd" type="date" className="input" value={edd} onChange={(e) => setEdd(e.target.value)} required />
        </Field>
        <Field label="最終月経日（LMP）" htmlFor="st-lmp">
          <input id="st-lmp" type="date" className="input" value={lmp} onChange={(e) => setLmp(e.target.value)} required />
        </Field>
        {mismatch && eddFromLmpValue && (
          <div className="rounded-lg border border-neutral-500 p-3 text-sm">
            <p>
              最終月経日から数えた予定日は {formatJaDate(eddFromLmpValue)} です。
              このアプリの週数は「出産予定日」を基準に計算します。
            </p>
            <button
              type="button"
              className="btn btn-ghost mt-2 w-full"
              onClick={() => {
                setEdd(eddFromLmpValue)
                touch()
              }}
            >
              予定日を {eddFromLmpValue} にする
            </button>
          </div>
        )}
        <Field
          label="出生日"
          htmlFor="st-birth"
          hint="入力すると産後の表示（生後日数・月齢）に切り替わり、産後の予定は出生日を基準に再計算されます。"
        >
          <div className="flex gap-2">
            <input id="st-birth" type="date" className="input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            {birthDate && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setBirthDate('')
                  touch()
                }}
              >
                消す
              </button>
            )}
          </div>
        </Field>
      </section>

      <section aria-labelledby="st-body" className="card space-y-4">
        <h2 id="st-body" className="section-title">
          体重の目安に使う値
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="妊娠前体重（kg）" htmlFor="st-weight">
            <input id="st-weight" type="number" inputMode="decimal" step="0.1" min={20} max={200} className="input" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
          <Field label="身長（cm）" htmlFor="st-height">
            <input id="st-height" type="number" inputMode="decimal" step="0.1" min={100} max={220} className="input" value={height} onChange={(e) => setHeight(e.target.value)} />
          </Field>
        </div>
      </section>

      <section aria-labelledby="st-names" className="card space-y-4">
        <h2 id="st-names" className="section-title">
          名前（表示用）
        </h2>
        <Field label="母" htmlFor="st-mother">
          <input id="st-mother" type="text" className="input" autoComplete="off" value={motherName} onChange={(e) => setMotherName(e.target.value)} />
        </Field>
        <Field label="父" htmlFor="st-father">
          <input id="st-father" type="text" className="input" autoComplete="off" value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
        </Field>
        <Field label="子" htmlFor="st-baby">
          <input id="st-baby" type="text" className="input" autoComplete="off" value={babyName} onChange={(e) => setBabyName(e.target.value)} />
        </Field>
      </section>

      <section aria-labelledby="st-contacts" className="card space-y-4">
        <h2 id="st-contacts" className="section-title">
          窓口
        </h2>
        <p className="muted text-sm">電話番号だけを入力してください。住所は入力しません。</p>
        {CONTACTS.map((c) => {
          const key = c.settingsKey
          return (
            <div key={c.id} className="space-y-2">
              <ContactCard entry={c} contacts={contacts} />
              {key && (
                <Field label={`${c.name} の電話番号`} htmlFor={`st-tel-${c.id}`}>
                  <input
                    id={`st-tel-${c.id}`}
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    className="input"
                    value={contacts[key]}
                    onChange={(e) => setContacts((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </Field>
              )}
              {c.unconfirmed && (
                <ul className="space-y-1 text-sm">
                  {c.unconfirmed.map((u) => (
                    <li key={u} className="flex items-start gap-2">
                      <UnconfirmedBadge />
                      <span>{u}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
        <div>
          <h3 className="field-label">確認先がまだ決まっていない制度</h3>
          <ul className="space-y-1 text-sm">
            {UNCONFIRMED_PROGRAMS.map((u) => (
              <li key={u} className="flex items-start gap-2">
                <UnconfirmedBadge />
                <span>{u}（対象になるか、どの窓口かを確認してください）</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="sticky bottom-20 z-10">
        <button type="submit" className="btn btn-primary w-full shadow-lg" disabled={!valid}>
          {saved ? '保存しました' : '設定を保存'}
        </button>
        <p className="sr-only" role="status">
          {saved ? '設定を保存しました' : ''}
        </p>
      </div>
    </form>
  )
}

function AccountSection() {
  const { user, role, partnerUid, data, actions, isDemo } = useAppData()
  const partner = partnerUid ? data.household.members[partnerUid] : null
  return (
    <section aria-labelledby="st-account" className="card space-y-3">
      <h2 id="st-account" className="section-title">
        アカウント
      </h2>
      <p className="text-sm">
        あなた：{role ? ROLE_LABEL[role] : '未設定'}
        {user?.email ? `（${user.email}）` : ''}
      </p>
      {user && <UidBox uid={user.uid} label="あなたの UID" />}
      {partnerUid ? (
        <UidBox
          uid={partnerUid}
          label={`相手の UID${partner ? `（${ROLE_LABEL[partner.role]}）` : ''}`}
        />
      ) : (
        <p className="text-sm">相手はまだログインしていません。ログインすると、ここに相手の UID が表示されます。</p>
      )}
      <p className="muted text-xs">
        UID は Firestore のセキュリティルールに設定する値です（README の「セットアップ手順」4）。
      </p>
      {!isDemo && (
        <button type="button" className="btn btn-ghost w-full" onClick={() => void actions.signOut()}>
          ログアウト
        </button>
      )}
    </section>
  )
}

export default function Settings() {
  const { data } = useAppData()
  return (
    <Page title="設定" backTo="/">
      <SettingsForm />
      <AccountSection />
      <section aria-labelledby="st-export" className="card space-y-3">
        <h2 id="st-export" className="section-title">
          データのエクスポート
        </h2>
        <p className="text-sm">
          タスク・予定・記録などを JSON ファイルとしてこの端末に保存します。領収書の写真は含まれません。
        </p>
        <button type="button" className="btn btn-ghost w-full" onClick={() => exportJson(data)}>
          JSON をダウンロード
        </button>
      </section>
      <InstallBanner />
    </Page>
  )
}
