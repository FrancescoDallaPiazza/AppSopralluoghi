// Pulsante "Invia al cliente" per la report-bar di MieiSopralluoghi.
// Componente isolato: genera la variante CLIENTE e la invia via email al
// cliente (email presa dall'anagrafica lato server). Mostra l'esito inline.
//
// Tenuto separato dal corpo di MieiSopralluoghi per non toccarne la logica:
// lì basta importarlo e renderlo nella report-bar.

import { useState, type CSSProperties } from 'react';
import { inviaReportCliente } from './lib/report';

type Stato =
  | { fase: 'idle' }
  | { fase: 'invio' }
  | { fase: 'ok'; to: string | null }
  | { fase: 'no_email' }
  | { fase: 'errore'; msg: string };

export default function BottoneInviaCliente({ sopralluogoId }: { sopralluogoId: string }) {
  const [s, setS] = useState<Stato>({ fase: 'idle' });

  async function invia() {
    if (s.fase === 'invio') return;
    setS({ fase: 'invio' });
    try {
      const r = await inviaReportCliente(sopralluogoId);
      if (r.emailed) setS({ fase: 'ok', to: r.emailTo });
      else if (r.reason && /email/i.test(r.reason) && !r.emailTo)
        setS({ fase: 'no_email' });
      else setS({ fase: 'errore', msg: r.reason ?? 'Invio non riuscito.' });
    } catch (e) {
      setS({ fase: 'errore', msg: String((e as Error)?.message ?? e) });
    }
  }

  return (
    <>
      <button
        className="rb-btn"
        disabled={s.fase === 'invio'}
        onClick={() => void invia()}
        title="Genera il report cliente e invialo via email"
      >
        {s.fase === 'invio' ? 'Invio…' : '✉ Invia al cliente'}
      </button>
      {s.fase === 'ok' && (
        <span style={msgStyle('#1f9d57')}>
          Inviato{ s.to ? ` a ${s.to}` : '' } ✓
        </span>
      )}
      {s.fase === 'no_email' && (
        <span style={msgStyle('#9a6206')}>
          Manca l’email del cliente (aggiungila in Anagrafiche)
        </span>
      )}
      {s.fase === 'errore' && (
        <span style={msgStyle('#d8442f')}>{s.msg}</span>
      )}
    </>
  );
}

function msgStyle(color: string): CSSProperties {
  return {
    flexBasis: '100%',
    fontSize: 11.5,
    fontWeight: 600,
    color,
    paddingTop: 4,
  };
}
