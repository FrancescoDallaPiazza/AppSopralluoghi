import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SUPABASE_CONFIGURATO } from './lib/supabase';

// Schermata leggibile al posto della pagina bianca: usata sia per la
// configurazione mancante sia dall'ErrorBoundary per gli errori a runtime.
function Schermo({ titolo, dettaglio }: { titolo: string; dettaglio?: string }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
      background: '#d9d4ca', textAlign: 'center',
      fontFamily: '-apple-system,system-ui,sans-serif', color: '#16181c',
    }}>
      <div style={{ fontWeight: 800, fontSize: 17 }}>{titolo}</div>
      {dettaglio && (
        <div style={{
          fontSize: 12.5, color: '#5b5f66', maxWidth: 460, lineHeight: 1.5,
          whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace,Menlo,monospace',
          background: '#fff', border: '1px solid #c9c2b4', borderRadius: 10, padding: '10px 12px',
        }}>{dettaglio}</div>
      )}
    </div>
  );
}

// Rete di sicurezza: qualunque errore in fase di render mostra un messaggio
// invece dello schermo bianco muto (che non dice nulla su cosa sia andato storto).
class ErrorBoundary extends Component<{ children: ReactNode }, { errore: Error | null }> {
  state = { errore: null as Error | null };
  static getDerivedStateFromError(errore: Error) { return { errore }; }
  componentDidCatch(errore: Error) { console.error('Errore in render:', errore); }
  render() {
    if (this.state.errore) {
      return <Schermo titolo="Si è verificato un errore" dettaglio={this.state.errore.message} />;
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root')!);

if (!SUPABASE_CONFIGURATO) {
  root.render(
    <Schermo
      titolo="Configurazione mancante"
      dettaglio={
        'Le variabili VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY non sono presenti in questa build.\n\n' +
        'Impostarle in Vercel → Project → Settings → Environment Variables (Production) e rifare il deploy.'
      }
    />,
  );
} else {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
