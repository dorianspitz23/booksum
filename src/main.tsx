import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ProfileProvider } from './features/profile/ProfileContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ProfileProvider>
      <App />
    </ProfileProvider>
  </React.StrictMode>
);
