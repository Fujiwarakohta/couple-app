import { useState } from 'react'
import type { ReactNode } from 'react'
import { ROLE_LABEL } from '../data/labels'
import { useApp } from '../state/AppContext'
import type { Role } from '../types'

const APP_LEAD = '夫婦2人で共有する、妊娠〜育児のタスク・予定・記録です。'

function Centered({ title, children }: { title: string; children: ReactNode }) {
  const { error } = useApp()
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-bold">{title}</h1>
      {error && (
        <p role="alert" className="alert text-sm">
          {error}
        </p>
      )}
      {children}
    </main>
  )
}

export function UidBox({ uid, label }: { uid: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(uid)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="card">
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 font-mono text-sm break-all select-all">{uid}</p>
      <button type="button" className="btn btn-ghost mt-3 w-full" onClick={copy}>
        {copied ? 'コピーしました' : 'UID をコピー'}
      </button>
    </div>
  )
}

export function LoadingScreen({ message }: { message: string }) {
  // ログイン画面と同じ見出し・説明を先に出し、読み込み後に画面が大きく変わらないようにする
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-bold">ふたりノート</h1>
      <p className="text-[15px]">{APP_LEAD}</p>
      <p className="muted flex min-h-11 items-center text-sm" role="status">
        {message}
      </p>
    </main>
  )
}

export function UnconfiguredScreen() {
  return (
    <Centered title="Firebase の設定がまだです">
      <p className="text-sm">
        <code className="font-mono">.env.local</code> に Firebase の設定値（
        <code className="font-mono">VITE_FIREBASE_*</code>
        ）が入っていません。README の「セットアップ手順」に沿って設定してください。
      </p>
      <p className="muted text-sm">
        画面だけを確認したい場合は <code className="font-mono">npm run dev:demo</code>{' '}
        で、Firebase に接続しないデモモードを起動できます。
      </p>
    </Centered>
  )
}

export function SignInScreen() {
  const { actions } = useApp()
  const [busy, setBusy] = useState(false)
  const signIn = async () => {
    setBusy(true)
    await actions.signIn()
    setBusy(false)
  }
  return (
    <Centered title="ふたりノート">
      <p className="text-[15px]">{APP_LEAD}</p>
      <button type="button" className="btn btn-primary w-full" onClick={signIn} disabled={busy}>
        {busy ? 'ログイン中…' : 'Google でログイン'}
      </button>
      <p className="muted text-xs">許可された2つの Google アカウントだけが利用できます。</p>
    </Centered>
  )
}

export function DeniedScreen() {
  const { user, actions } = useApp()
  return (
    <Centered title="このアカウントは許可されていません">
      <p className="text-sm">
        このアプリは、許可された2つの Google アカウントだけが利用できます。データは表示されません。
      </p>
      {user && (
        <>
          <p className="muted text-sm">
            初回のセットアップ中であれば、下の UID を控えて{' '}
            <code className="font-mono">.env.local</code> の{' '}
            <code className="font-mono">VITE_ALLOWED_UIDS</code>{' '}
            に記入し、ルールを反映してください（README 参照）。
          </p>
          <UidBox uid={user.uid} label="あなたの UID" />
          {user.email && <p className="muted text-sm">ログイン中：{user.email}</p>}
        </>
      )}
      <button type="button" className="btn btn-ghost w-full" onClick={() => void actions.signOut()}>
        ログアウト
      </button>
    </Centered>
  )
}

export function NeedOnlineScreen() {
  const { actions } = useApp()
  return (
    <Centered title="初回はオンラインで開いてください">
      <p className="text-sm">
        この端末にはまだデータがありません。電波のある場所で一度開くと、次回からはオフラインでも閲覧できます。
      </p>
      <button type="button" className="btn btn-primary w-full" onClick={() => location.reload()}>
        もう一度読み込む
      </button>
      <button type="button" className="btn btn-ghost w-full" onClick={() => void actions.signOut()}>
        ログアウト
      </button>
    </Centered>
  )
}

export function RoleScreen() {
  const { actions, user } = useApp()
  const [picked, setPicked] = useState<Role | null>(null)
  const roles: Role[] = ['mother', 'father']
  return (
    <Centered title="あなたはどちらですか？">
      <p className="text-sm">
        担当の表示や「相手の更新」に使います。あとから設定画面で確認できます。
      </p>
      <div className="flex gap-3">
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            className="chip flex-1"
            aria-pressed={picked === r}
            onClick={() => setPicked(r)}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={!picked}
        onClick={() => picked && actions.setRole(picked)}
      >
        決定
      </button>
      {user?.email && <p className="muted text-sm">ログイン中：{user.email}</p>}
    </Centered>
  )
}
