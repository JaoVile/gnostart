import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

type NavigatorWithCapabilities = Navigator & {
  deviceMemory?: number
  connection?: { saveData?: boolean; effectiveType?: string }
}

const detectLowPerfDevice = () => {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as NavigatorWithCapabilities
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 && nav.deviceMemory <= 2) return true
  if (nav.connection?.saveData) return true
  if (nav.connection?.effectiveType && /(^|-)(2g|slow-2g)$/.test(nav.connection.effectiveType)) return true
  return false
}

if (detectLowPerfDevice()) {
  document.documentElement.classList.add('low-perf')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
