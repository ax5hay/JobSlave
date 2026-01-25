// Re-export from web app
// In production, copy the web app build here
// For now, this serves as a placeholder

import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#f9fafb',
    }}>
      <h1 style={{ fontSize: '2rem', color: '#2563eb', marginBottom: '1rem' }}>
        JobSlave
      </h1>
      <p style={{ color: '#6b7280' }}>
        Loading application...
      </p>
      <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '2rem' }}>
        In development mode, please run <code>pnpm dev:web</code> and <code>pnpm dev:api</code> separately.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
