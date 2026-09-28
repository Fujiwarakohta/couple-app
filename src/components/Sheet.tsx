import { useEffect, useId, useRef } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { CloseIcon } from './Icons'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** 下部に固定するボタン類 */
  footer?: ReactNode
}

/**
 * 画面下から出る編集用のシート。
 * ネイティブの <dialog> を使い、フォーカスの閉じ込めと Esc での閉じる動作をブラウザに任せる。
 */
export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const onBackdrop = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={onBackdrop}
      className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[92dvh] w-full max-w-xl overflow-hidden rounded-t-2xl bg-white p-0 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-neutral-300 py-1 pr-1 pl-4 dark:border-neutral-600">
            <h2 id={titleId} className="text-base font-bold">
              {title}
            </h2>
            <button type="button" className="btn" aria-label="閉じる" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer && (
            <div
              className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-300 p-3 dark:border-neutral-600"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
