import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// Filter out benign Chromium engine warning regarding iframe sandbox attribute in reader
const originalWarn = console.warn;
console.warn = function (...args: any[]) {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('An iframe which has both allow-scripts and allow-same-origin')
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register PWA Service Worker for offline capability & mobile installation
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration error:', err);
      });
  });
}
