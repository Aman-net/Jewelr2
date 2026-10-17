import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')!
createRoot(root).render(<App />)
// Boot splash hands over smoothly: a quick fade, then out of the DOM —
// no hard cut between splash and app, no flicker of unstyled content.
requestAnimationFrame(() => {
  const boot = document.getElementById('boot')
  if (!boot) return
  boot.style.pointerEvents = 'none'
  boot.style.transition = 'opacity 160ms ease-out'
  boot.style.opacity = '0'
  setTimeout(() => boot.remove(), 180)
})
