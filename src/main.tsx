import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')!;
createRoot(root).render(<App />);
// Boot splash has served its purpose — the app now paints for itself.
requestAnimationFrame(() => document.getElementById('boot')?.remove());
