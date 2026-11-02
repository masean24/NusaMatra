import '@fontsource-variable/lexend';
import '@fontsource-variable/jetbrains-mono';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

/*
 * A page chunk that fails to download usually means a new version was deployed while this tab was
 * open: reload once to fetch the new files. The session flag stops a reload loop when the network
 * itself is down; the route error page then offers "Muat ulang".
 */
const PRELOAD_RELOAD_KEY = 'nusa-matra:preload-reload';
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem(PRELOAD_RELOAD_KEY)) return;
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, '1');
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});
window.addEventListener('load', () => {
  // Clear the flag a while after a successful load, so a later deploy can reload again.
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(PRELOAD_RELOAD_KEY);
    } catch {
      // Storage unavailable: nothing to clear.
    }
  }, 10_000);
});

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
