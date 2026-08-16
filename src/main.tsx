import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ProfileProvider } from './features/profile/ProfileContext';

/**
 * Anything that rejects outside a React boundary — a fire-and-forget storage
 * write, a stream that outlives its component — otherwise disappeared entirely.
 * There is no server to send this to, so it goes to the console with a prefix
 * anyone reading a bug report can grep for, and the user is told once rather
 * than left with a UI that silently did nothing.
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('[booksum] unhandled rejection', event.reason);
});

window.addEventListener('error', (event) => {
  console.error('[booksum] uncaught error', event.error ?? event.message);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ProfileProvider>
      <App />
    </ProfileProvider>
  </React.StrictMode>,
);
