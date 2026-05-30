import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import Login from './Login';
import MieiSopralluoghi from './MieiSopralluoghi';
import MieCoseDaFare from './MieCoseDaFare';
import Compilazione from './Compilazione';
import { avviaSyncAuto, runSync } from './lib/sync';
import type { Tecnico } from './lib/types';
import type { SopralluogoConContesto } from './lib/sopralluoghi';

function Schermo({ titolo, testo, azione }: {
  titolo: string;
  testo: string;
  azione?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
      background: '#d9d4ca', textAlign: 'center',
      fontFamily: '-apple-system,system-ui,sans-serif', color: '#16181c',
    }}>
      <div style={{ fontWeight: 800, fontSize: 17 }}>{titolo}</div>
      <div style={{ fontSize: 13.5, color: '#5b5f66', maxWidth: 320, lineHeight: 1.5 }}>{testo}</div>
      {azione && (
        <button onClick={azione.onClick} style={{
          marginTop: 6, border: '1px solid #c9c2b4', background: '#fff',
          borderRadius: 10, padding: '9px 16px', fontWeight: 700, cursor: 'pointer',
        }}>{azione.label}</button>
      )}
    </div>
  );
}

// Le due schede + la schermata di campo.
function Home({ tecnico }: { tecnico: Tecnico }) {
  const [tab, setTab] = useState<'sopralluoghi' | 'cose'>('sopralluoghi');
  const [aperto, setAperto] = useState<SopralluogoConContesto | null>(null);

  if (aperto) {
    return (
      <Compilazione
        sopralluogo={aperto}
        tecnicoId={tecnico.id}
        onChiudi={() => setAperto(null)}
      />
    );
  }

  return tab === 'sopralluoghi' ? (
    <MieiSopralluoghi
      tecnicoId={tecnico.id}
      tecnicoNome={tecnico.nome}
      onApriCoseDaFare={() => setTab('cose')}
      onApriSopralluogo={setAperto}
    />
  ) : (
    <MieCoseDaFare
      tecnicoId={tecnico.id}
      tecnicoNome={tecnico.nome}
      onApriSopralluoghi={() => setTab('sopralluoghi')}
    />
  );
}

function Gate() {
  const { fase, tecnico, signOut } = useAuth();

  useEffect(() => { avviaSyncAuto(); }, []);
  useEffect(() => { if (fase === 'pronto') void runSync(); }, [fase]);

  switch (fase) {
    case 'avvio':
    case 'risolvo':
      return <Schermo titolo="Sopralluoghi" testo="Carico…" />;
    case 'anon':
      return <Login />;
    case 'non_collegato':
      return <Schermo titolo="Account non collegato"
        testo="Questo accesso non è associato a nessun tecnico. Contatta l'amministratore."
        azione={{ label: 'Esci', onClick: signOut }} />;
    case 'disattivato':
      return <Schermo titolo="Account disattivato"
        testo="Il tuo profilo tecnico risulta non attivo. Contatta l'amministratore."
        azione={{ label: 'Esci', onClick: signOut }} />;
    case 'offline':
      return <Schermo titolo="Sei offline"
        testo="Non ho ancora i tuoi dati su questo dispositivo. Connettiti una volta per completare l'accesso."
        azione={{ label: 'Esci', onClick: signOut }} />;
    case 'pronto':
      return <Home tecnico={tecnico!} />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
