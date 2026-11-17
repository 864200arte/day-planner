import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { registerSW } from './lib/pwa';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
registerSW();

// Лише в режимі розробки — для автоматичних перевірок у консолі браузера
if (import.meta.env.DEV) {
  Promise.all([import('./ui/uiStore'), import('./lib/store')]).then(([u, s]) => { (window as any).__dp = { ui: u.ui, getUI: u.getUI, S: s }; });
}
