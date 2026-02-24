import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx' // Assicurati che il file GenogrammaDigitale sia rinominato in App.tsx
import './index.css'

// Error Boundary: Cattura errori che bloccano l'intera app (es. pagina bianca)
class GlobalErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Errore Critico di Avvio:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ color: '#dc2626', fontSize: '1.5rem', marginBottom: '1rem' }}>
            Si è verificato un errore critico
          </h1>
          <p style={{ marginBottom: '1rem', color: '#4b5563' }}>
            L'applicazione non è riuscita ad avviarsi. Ecco i dettagli tecnici:
          </p>
          <div style={{ backgroundColor: '#f3f4f6', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', border: '1px solid #e5e7eb' }}>
            <code style={{ color: '#dc2626', fontSize: '0.875rem' }}>
              {this.state.error?.message}
            </code>
            <pre style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#374151' }}>
              {this.state.error?.stack}
            </pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              marginTop: '1.5rem', 
              padding: '0.5rem 1rem', 
              backgroundColor: '#2563eb', 
              color: 'white', 
              border: 'none', 
              borderRadius: '0.25rem',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Ricarica Applicazione
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  document.body.innerHTML = '<div style="color: red; padding: 20px; font-weight: bold;">ERRORE FATALE: Impossibile trovare l\'elemento con id="root" nel file index.html.</div>';
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <App />
      </GlobalErrorBoundary>
    </React.StrictMode>,
  )
}