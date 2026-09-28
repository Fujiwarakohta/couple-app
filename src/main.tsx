import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { loadBackend } from './lib/backend'
import { AppProvider } from './state/AppProvider'

// 画面の描画と並行して、保存先（Firebase）の読み込みを始めておく
void loadBackend().catch(() => undefined)

// vite.config.ts の base（例: /couple-app/）をルーターにも伝える
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter basename={basename}>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}
