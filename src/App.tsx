import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import {
  DeniedScreen,
  LoadingScreen,
  NeedOnlineScreen,
  RoleScreen,
  SignInScreen,
  UnconfiguredScreen,
} from './components/Gate'
import { useApp } from './state/AppContext'

// 画面ごとに分割して、初回に読み込む JS を小さくする
const Home = lazy(() => import('./pages/Home'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Schedule = lazy(() => import('./pages/Schedule'))
const Advice = lazy(() => import('./pages/Advice'))
const Records = lazy(() => import('./pages/Records'))
const Settings = lazy(() => import('./pages/Settings'))

export default function App() {
  const { status } = useApp()

  switch (status) {
    case 'loading':
      return <LoadingScreen message="読み込み中…" />
    case 'unconfigured':
      return <UnconfiguredScreen />
    case 'signedOut':
      return <SignInScreen />
    case 'checking':
      return <LoadingScreen message="データを確認しています…" />
    case 'denied':
      return <DeniedScreen />
    case 'needOnline':
      return <NeedOnlineScreen />
    case 'needRole':
      return <RoleScreen />
    case 'ready':
      return (
        <Suspense fallback={<LoadingScreen message="読み込み中…" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/advice" element={<Advice />} />
            <Route path="/records" element={<Records />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      )
  }
}
