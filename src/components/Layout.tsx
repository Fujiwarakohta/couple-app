import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { BulbIcon, CalendarIcon, ChartIcon, CheckListIcon, CloseIcon, GearIcon, HomeIcon } from './Icons'

const TABS = [
  { to: '/', label: 'ホーム', icon: HomeIcon, end: true },
  { to: '/schedule', label: '予定', icon: CalendarIcon, end: false },
  { to: '/tasks', label: 'タスク', icon: CheckListIcon, end: false },
  { to: '/advice', label: '助言', icon: BulbIcon, end: false },
  { to: '/records', label: '記録', icon: ChartIcon, end: false },
] as const

function TabNav() {
  return (
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                  isActive
                    ? 'text-neutral-900 dark:text-white'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-12 items-center justify-center rounded-full ${
                      isActive ? 'bg-neutral-200 dark:bg-neutral-700' : ''
                    }`}
                  >
                    <Icon size={22} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function ErrorBar() {
  const { error, actions } = useApp()
  if (!error) return null
  return (
    <div role="alert" className="alert mx-4 mt-3 flex items-start justify-between gap-2 py-2 pr-1">
      <p className="py-2 text-sm">{error}</p>
      <button type="button" className="btn" aria-label="エラー表示を閉じる" onClick={actions.dismissError}>
        <CloseIcon size={20} />
      </button>
    </div>
  )
}

interface PageProps {
  title: string
  /** ホームだけ右上に設定への入口を出す */
  showSettings?: boolean
  /** 設定画面など、タブに無い画面で戻る先 */
  backTo?: string
  action?: ReactNode
  children: ReactNode
}

export function Page({ title, showSettings, backTo, action, children }: PageProps) {
  const { isDemo } = useApp()
  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <header
        className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-2 border-b border-neutral-300 bg-white px-4 dark:border-neutral-700 dark:bg-neutral-900"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {backTo && (
            <Link to={backTo} className="btn -ml-3 px-2 text-sm">
              ← 戻る
            </Link>
          )}
          <h1 className="truncate text-lg font-bold">{title}</h1>
          {isDemo && (
            <span className="badge border border-neutral-700 dark:border-neutral-300">デモ</span>
          )}
        </div>
        <div className="flex items-center">
          {action}
          {showSettings && (
            <Link to="/settings" className="btn -mr-3 px-3 text-sm">
              <GearIcon size={20} />
              設定
            </Link>
          )}
        </div>
      </header>
      <ErrorBar />
      <main className="space-y-5 px-4 pt-4 pb-28">{children}</main>
      <TabNav />
    </div>
  )
}
