import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './services/syncDebugger';

// Global Patch: ensure shadow roots created by foliate-js have open mode and zero-width scrollbar to keep reading text perfectly centered
if (typeof Element !== 'undefined' && !(Element.prototype as any).__velvet_shadow_patched) {
  const origAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init: ShadowRootInit) {
    const shadow = origAttachShadow.call(this, { ...init, mode: 'open' });
    try {
      const style = document.createElement('style');
      style.id = 'velvet-global-shadow-style';
      style.textContent = `
        :host([flow="scrolled"]) #container, #container, div#container {
          overflow-y: auto !important;
          overflow-x: hidden !important;
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        #container::-webkit-scrollbar, :host([flow="scrolled"]) #container::-webkit-scrollbar, div#container::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }
      `;
      shadow.appendChild(style);
    } catch {}
    return shadow;
  };
  (Element.prototype as any).__velvet_shadow_patched = true;
}

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
