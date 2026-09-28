import { useEffect, useMemo, useState } from 'react'
import { PlusIcon } from '../../components/Icons'
import { Sheet } from '../../components/Sheet'
import { Check, EmptyText, Field, UnconfirmedBadge, UnconfirmedNote } from '../../components/ui'
import {
  NINPU_APPLICATION_NOTE,
  NINPU_LIMITS,
  NINPU_LIMITS_SOURCE,
  NINPU_USAGE_NOTE,
  ninpuLimitYen,
} from '../../data/static'
import { diffDays, formatJaDate, isValidYmd } from '../../lib/dates'
import { deletePhoto, loadPhoto, savePhoto } from '../../lib/photos'
import {
  DEADLINE_RULE_LABEL,
  DEADLINE_UNCONFIRMED,
  RECEIPT_KINDS,
  RECEIPT_KIND_LABEL,
  deadlineFor,
  expectedRefundYen,
  formatYen,
  isReceiptComplete,
  kindDeadlines,
  ninpuRefundSummary,
} from '../../lib/receipts'
import { useAppData, type ReceiptInput } from '../../state/AppContext'
import type { Receipt, ReceiptKind, Ymd } from '../../types'

function ticketLabel(ticketNo: string | null): string {
  if (!ticketNo) return '受診票 未選択'
  const found = NINPU_LIMITS.find((t) => t.ticketNo === ticketNo)
  return found ? `受診票 ${found.label}` : `受診票 ${ticketNo}`
}

function usePhoto(id: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!id) return
    let alive = true
    let created: string | null = null
    loadPhoto(id)
      .then((blob) => {
        if (!alive || !blob) return
        created = URL.createObjectURL(blob)
        setUrl(created)
      })
      .catch(() => undefined)
    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [id])
  return url
}

function Summary({ receipts, today }: { receipts: Receipt[]; today: Ymd }) {
  const refund = useMemo(() => ninpuRefundSummary(receipts, ninpuLimitYen), [receipts])
  const deadlines = useMemo(() => kindDeadlines(receipts), [receipts])

  return (
    <section aria-label="償還払いのまとめ" className="card space-y-4">
      <div>
        <h2 className="section-title text-sm">妊婦健診の見込み返金額</h2>
        <p className="my-1 text-3xl leading-tight font-bold tabular-nums">{formatYen(refund.totalYen)}</p>
        <p className="muted text-xs">
          受診票ごとに「実費」と「石垣市の上限額」の小さい方を合計（{refund.counted}件）。
          健保適用分・初診料は対象外です。実際の返金額は石垣市の審査で決まります。
        </p>
        {refund.missingTicket > 0 && (
          <p className="mt-1 text-sm font-semibold">
            受診票番号が未選択の {refund.missingTicket}件は合計に含めていません。
          </p>
        )}
      </div>

      <div>
        <h2 className="section-title text-sm">申請期限（未申請分）</h2>
        {deadlines.length === 0 ? (
          <EmptyText>未申請の領収書はありません。</EmptyText>
        ) : (
          <ul className="mt-1 space-y-2">
            {deadlines.map((d) => {
              const left = diffDays(d.deadline, today)
              const urgent = left <= 30
              return (
                <li key={d.kind} className={urgent ? 'alert p-3' : ''}>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                    {RECEIPT_KIND_LABEL[d.kind]}（{d.count}件）
                    {d.unconfirmed && <UnconfirmedBadge />}
                  </p>
                  <p className="text-[15px] tabular-nums">
                    {d.unconfirmed ? '期限の目安 ' : '期限 '}
                    {formatJaDate(d.deadline)}
                    <span className="ml-2 text-sm">
                      {left < 0 ? `（${Math.abs(left)}日超過）` : `（あと${left}日）`}
                    </span>
                  </p>
                  <p className="muted text-xs tabular-nums">
                    {d.rule}（起算：{formatJaDate(d.basisDate)}）
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <details>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
          妊婦健診の上限額の表
        </summary>
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">受診票ごとの石垣市上限額</caption>
          <thead>
            <tr className="border-b border-neutral-400 text-left">
              <th scope="col" className="py-1 font-semibold">
                受診票
              </th>
              <th scope="col" className="py-1 text-right font-semibold">
                上限額
              </th>
            </tr>
          </thead>
          <tbody>
            {NINPU_LIMITS.map((t) => (
              <tr key={t.ticketNo} className="border-b border-neutral-200 dark:border-neutral-700">
                <th scope="row" className="py-1 text-left font-normal">
                  {t.label}
                </th>
                <td className="py-1 text-right">{formatYen(t.limitYen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm">{NINPU_USAGE_NOTE}</p>
        <p className="mt-1 text-sm">{NINPU_APPLICATION_NOTE}</p>
        <p className="muted mt-1 text-xs">出典：{NINPU_LIMITS_SOURCE}</p>
      </details>
    </section>
  )
}

function ReceiptRow({ receipt, onEdit }: { receipt: Receipt; onEdit: (r: Receipt) => void }) {
  const complete = isReceiptComplete(receipt)
  const refund =
    receipt.kind === 'ninpu'
      ? expectedRefundYen(receipt.amountYen, ninpuLimitYen(receipt.ticketNo))
      : null
  return (
    <li className="border-t border-neutral-200 first:border-t-0 dark:border-neutral-700">
      <button
        type="button"
        className="min-h-11 w-full py-3 text-left"
        aria-label={`${formatJaDate(receipt.date)} ${receipt.facility} ${formatYen(receipt.amountYen)} を編集`}
        onClick={() => onEdit(receipt)}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-sm tabular-nums">{formatJaDate(receipt.date)}</span>
          <span className="text-[15px] font-bold tabular-nums">{formatYen(receipt.amountYen)}</span>
        </span>
        <span className="block text-[15px]">{receipt.facility || '（施設名なし）'}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          {receipt.kind === 'ninpu' && (
            <span className="badge bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100">
              {ticketLabel(receipt.ticketNo)}
            </span>
          )}
          {refund !== null && <span className="tabular-nums">見込み返金 {formatYen(refund)}</span>}
          <span
            className={`badge border ${
              complete ? 'border-current' : 'border-red-800 text-red-800 dark:border-red-300 dark:text-red-300'
            }`}
          >
            {complete ? '証憑そろい' : '証憑に不足あり'}
          </span>
          {receipt.claimedAt && (
            <span className="badge border border-current">申請済み {receipt.claimedAt}</span>
          )}
        </span>
      </button>
    </li>
  )
}

function ReceiptForm({
  receipt,
  today,
  onClose,
}: {
  receipt: Receipt | null
  today: Ymd
  onClose: () => void
}) {
  const { actions } = useAppData()
  const [kind, setKind] = useState<ReceiptKind>(receipt?.kind ?? 'ninpu')
  const [date, setDate] = useState<Ymd>(receipt?.date ?? today)
  const [facility, setFacility] = useState(receipt?.facility ?? '')
  const [amount, setAmount] = useState(receipt ? String(receipt.amountYen) : '')
  const [ticketNo, setTicketNo] = useState(receipt?.ticketNo ?? '')
  const [hasReceipt, setHasReceipt] = useState(!!receipt?.hasReceipt)
  const [hasStatement, setHasStatement] = useState(!!receipt?.hasStatement)
  const [hasTicketFilled, setHasTicketFilled] = useState(!!receipt?.hasTicketFilled)
  const [epdsDone, setEpdsDone] = useState(!!receipt?.epdsDone)
  const [requestLetter, setRequestLetter] = useState(!!receipt?.requestLetterObtained)
  const [claimedAt, setClaimedAt] = useState(receipt?.claimedAt ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const savedUrl = usePhoto(receipt?.id ?? null)
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])
  const shownUrl = previewUrl ?? (removePhoto ? null : savedUrl)

  const yen = Number(amount)
  const valid = isValidYmd(date) && amount !== '' && Number.isInteger(yen) && yen >= 0
  const limit = kind === 'ninpu' ? ninpuLimitYen(ticketNo || null) : null
  const refund = kind === 'ninpu' && valid ? expectedRefundYen(yen, limit) : null
  const deadline = isValidYmd(date) ? deadlineFor(kind, date) : null
  const usesTicket = kind === 'ninpu' || kind === 'sanpu'

  const save = async () => {
    if (!valid) return
    const input: ReceiptInput = {
      kind,
      date,
      facility: facility.trim(),
      amountYen: yen,
      ticketNo: kind === 'ninpu' && ticketNo ? ticketNo : null,
      hasReceipt,
      hasStatement,
      hasTicketFilled: usesTicket ? hasTicketFilled : false,
      epdsDone: kind === 'sanpu' ? epdsDone : false,
      requestLetterObtained: kind === 'vaccine' ? requestLetter : false,
      claimedAt: claimedAt || null,
    }
    const id = actions.saveReceipt(receipt?.id ?? null, input)
    try {
      if (file && id) await savePhoto(id, file)
      else if (removePhoto && id) await deletePhoto(id)
    } catch {
      setPhotoError('写真を保存できませんでした（文字情報は保存済みです）。')
      return
    }
    onClose()
  }

  const remove = () => {
    if (receipt) actions.removeReceipt(receipt.id)
    onClose()
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Field label="種別" htmlFor="rc-kind">
        <select id="rc-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as ReceiptKind)}>
          {RECEIPT_KINDS.map((k) => (
            <option key={k} value={k}>
              {RECEIPT_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </Field>
      {kind === 'hearing' && (
        <UnconfirmedNote reason="石垣市の助成は上限3,500円・原則1回（調査報告書の記載）。要件は窓口未確認" />
      )}
      <Field label={kind === 'vaccine' ? '接種日' : '受診日'} htmlFor="rc-date">
        <input id="rc-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <Field label="施設" htmlFor="rc-facility" hint="施設名のみ。住所は書かないでください。">
        <input id="rc-facility" type="text" className="input" value={facility} onChange={(e) => setFacility(e.target.value)} />
      </Field>
      <Field label="支払った金額（円）" htmlFor="rc-amount">
        <input
          id="rc-amount"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          className="input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </Field>
      {kind === 'ninpu' && (
        <Field
          label="受診票番号"
          htmlFor="rc-ticket"
          hint={
            limit !== null
              ? `上限額 ${formatYen(limit)}${refund !== null ? `／見込み返金額 ${formatYen(refund)}` : ''}`
              : '選ぶと上限額と見込み返金額を表示します。'
          }
        >
          <select id="rc-ticket" className="input" value={ticketNo} onChange={(e) => setTicketNo(e.target.value)}>
            <option value="">未選択</option>
            {NINPU_LIMITS.map((t) => (
              <option key={t.ticketNo} value={t.ticketNo}>
                {t.label}（上限 {formatYen(t.limitYen)}）
              </option>
            ))}
          </select>
        </Field>
      )}

      <fieldset>
        <legend className="field-label">{usesTicket ? '3点セット' : '証憑'}</legend>
        <Check id="rc-receipt" label="領収書原本" checked={hasReceipt} onChange={setHasReceipt} />
        <Check
          id="rc-statement"
          label="診療明細書（自費欄が分かるもの）"
          checked={hasStatement}
          onChange={setHasStatement}
        />
        {usesTicket && (
          <Check
            id="rc-ticket-filled"
            label="医師記入済み受診票"
            checked={hasTicketFilled}
            onChange={setHasTicketFilled}
          />
        )}
        {kind === 'sanpu' && (
          <Check
            id="rc-epds"
            label="EPDS（産後うつ病質問票）を実施した"
            checked={epdsDone}
            onChange={setEpdsDone}
          />
        )}
        {kind === 'vaccine' && (
          <Check
            id="rc-letter"
            label="予防接種依頼書を事前に取得した"
            checked={requestLetter}
            onChange={setRequestLetter}
          />
        )}
      </fieldset>

      {deadline && (
        <div className="rounded-lg border border-neutral-400 p-3 text-sm">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold">
            この領収書の申請期限{DEADLINE_UNCONFIRMED[kind] ? 'の目安' : ''}
            {DEADLINE_UNCONFIRMED[kind] && <UnconfirmedBadge />}
          </p>
          <p className="tabular-nums">
            {formatJaDate(deadline)}（{DEADLINE_RULE_LABEL[kind]}）
          </p>
        </div>
      )}

      <Field label="申請した日（申請後に入力）" htmlFor="rc-claimed">
        <div className="flex gap-2">
          <input id="rc-claimed" type="date" className="input" value={claimedAt} onChange={(e) => setClaimedAt(e.target.value)} />
          {claimedAt && (
            <button type="button" className="btn btn-ghost" onClick={() => setClaimedAt('')}>
              消す
            </button>
          )}
        </div>
      </Field>

      <Field
        label="領収書の写真"
        htmlFor="rc-photo"
        hint="写真はこの端末の中にだけ保存されます。相手の端末やクラウドには送られません。"
      >
        <input
          id="rc-photo"
          type="file"
          accept="image/*"
          className="input py-2"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setRemovePhoto(false)
          }}
        />
      </Field>
      {shownUrl && (
        <div className="space-y-2">
          <img src={shownUrl} alt="領収書の写真" className="max-h-80 w-full rounded-lg border border-neutral-400 object-contain" />
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => {
              setFile(null)
              setRemovePhoto(true)
            }}
          >
            写真を外す
          </button>
        </div>
      )}
      {photoError && (
        <p role="alert" className="alert text-sm">
          {photoError}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2 pt-2">
        {receipt &&
          (confirmDelete ? (
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-danger" onClick={remove}>
                本当に削除
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                やめる
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              削除
            </button>
          ))}
        <button type="submit" className="btn btn-primary ml-auto px-8" disabled={!valid}>
          {receipt ? '保存' : '追加'}
        </button>
      </div>
    </form>
  )
}

type Editing = { kind: 'add' } | { kind: 'edit'; id: string } | null

export function Receipts() {
  const { data, today } = useAppData()
  const [editing, setEditing] = useState<Editing>(null)

  const live = useMemo(
    () =>
      data.receipts
        .filter((r) => !r.deleted)
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    [data.receipts],
  )
  const groups = RECEIPT_KINDS.map((kind) => ({
    kind,
    items: live.filter((r) => r.kind === kind),
  })).filter((g) => g.items.length > 0)
  const editingReceipt =
    editing?.kind === 'edit' ? (live.find((r) => r.id === editing.id) ?? null) : null

  return (
    <div className="space-y-5">
      <p className="text-sm">
        里帰り先で自費払いした費用を、帰島後に石垣市へまとめて申請するための台帳です。
      </p>
      <Summary receipts={live} today={today} />

      <button type="button" className="btn btn-primary w-full" onClick={() => setEditing({ kind: 'add' })}>
        <PlusIcon size={18} />
        領収書を追加
      </button>

      {groups.length === 0 && (
        <div className="card">
          <EmptyText>まだ領収書がありません。</EmptyText>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.kind} className="card px-3 py-2" aria-label={RECEIPT_KIND_LABEL[g.kind]}>
          <h2 className="flex flex-wrap items-center gap-1.5 rounded bg-neutral-200 px-2 py-1 text-sm font-bold dark:bg-neutral-700">
            {RECEIPT_KIND_LABEL[g.kind]}
            <span className="muted text-xs font-normal">{g.items.length}件</span>
            {(g.kind === 'hearing' || g.kind === 'kodomo_iryo') && <UnconfirmedBadge />}
          </h2>
          <ul>
            {g.items.map((r) => (
              <ReceiptRow key={r.id} receipt={r} onEdit={(x) => setEditing({ kind: 'edit', id: x.id })} />
            ))}
          </ul>
        </section>
      ))}

      <Sheet
        open={editing?.kind === 'add' || !!editingReceipt}
        title={editing?.kind === 'add' ? '領収書を追加' : '領収書を編集'}
        onClose={() => setEditing(null)}
      >
        {editing?.kind === 'add' && <ReceiptForm receipt={null} today={today} onClose={() => setEditing(null)} />}
        {editingReceipt && (
          <ReceiptForm
            key={editingReceipt.id}
            receipt={editingReceipt}
            today={today}
            onClose={() => setEditing(null)}
          />
        )}
      </Sheet>
    </div>
  )
}
