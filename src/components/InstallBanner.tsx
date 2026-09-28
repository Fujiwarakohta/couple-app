import { useEffect, useState } from 'react'
import { CloseIcon } from './Icons'

const DISMISS_KEY = 'couple-app-install-dismissed'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

function isIos(): boolean {
  const ua = navigator.userAgent
  // iPadOS は Mac と名乗るので、タッチ対応で見分ける
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** ホーム画面への追加の案内。iOS Safari は手順を文章で示す。 */
export function InstallBanner() {
  const [hidden, setHidden] = useState(() => isStandalone() || wasDismissed())
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const ios = isIos()

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as InstallPromptEvent)
    }
    const onInstalled = () => setHidden(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (hidden || (!ios && !promptEvent)) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // 保存できなくても閉じる
    }
    setHidden(true)
  }

  return (
    <section aria-label="ホーム画面への追加" className="card flex items-start gap-2 py-3 pr-1">
      <div className="flex-1 text-sm">
        <p className="font-bold">ホーム画面に追加すると、アプリのように使えます</p>
        {ios ? (
          <ol className="mt-1 list-decimal pl-5">
            <li>Safari の「共有」ボタンを押す</li>
            <li>「ホーム画面に追加」を選ぶ</li>
          </ol>
        ) : (
          <button
            type="button"
            className="btn btn-primary mt-2"
            onClick={() => void promptEvent?.prompt()}
          >
            ホーム画面に追加
          </button>
        )}
      </div>
      <button type="button" className="btn" aria-label="案内を閉じる" onClick={dismiss}>
        <CloseIcon size={20} />
      </button>
    </section>
  )
}
