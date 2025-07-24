import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Add PWA update notification
// @ts-ignore: vite-plugin-pwa virtual module
import { useRegisterSW } from 'virtual:pwa-register/react';

function PWAToast() {
  const { needRefresh, updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#3b82f6',
      color: 'white',
      padding: '12px 24px',
      borderRadius: 8,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }}>
      <span>New version available!</span>
      <button
        style={{
          background: 'white',
          color: '#3b82f6',
          border: 'none',
          borderRadius: 4,
          padding: '4px 12px',
          cursor: 'pointer',
          fontWeight: 600
        }}
        onClick={() => updateServiceWorker(true)}
      >
        Refresh
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <PWAToast />
  </React.StrictMode>
);
