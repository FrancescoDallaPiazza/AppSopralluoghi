import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import Login from './Login';
import ImpostaPassword from './ImpostaPassword';
import MieiSopralluoghi from './MieiSopralluoghi';
import MieCoseDaFare from './MieCoseDaFare';
import Compilazione from './Compilazione';
import BackOffice from './admin/BackOffice';
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

// Dopo il login: l'amministratore entra nel back-office (con scorciatoia
// all'app da campo); il tecnico entra direttamente nell'app da campo.
function Pronto({ tecnico }: { tecnico: Tecnico }) {
  const [vista, setVista] = useState<'auto' | 'campo'>('auto');
  const isAdmin = tecnico.ruolo === 'admin';

  if (isAdmin && vista === 'auto') {
    return <BackOffice tecnico={tecnico} onVaiAllApp={() => setVista('campo')} />;
  }

  return (
    <>
      <Home tecnico={tecnico} />
      {isAdmin && (
        <button
          onClick={() => setVista('auto')}
          style={{
            position: 'fixed', top: 8, right: 8, zIndex: 9999,
            border: '1px solid #c9c2b4', background: '#fffdf9', color: '#16181c',
            borderRadius: 999, padding: '6px 12px', fontWeight: 800, fontSize: 12,
            fontFamily: '-apple-system,system-ui,sans-serif', cursor: 'pointer',
            boxShadow: '0 6px 18px -10px rgba(0,0,0,.5)',
          }}
        >
          ← Back-office
        </button>
      )}
    </>
  );
}

function Gate() {
  const { fase, tecnico, session, richiediPassword, confermaPasswordImpostata, signOut } = useAuth();

  useEffect(() => { avviaSyncAuto(); }, []);
  useEffect(() => { if (fase === 'pronto') void runSync(); }, [fase]);

  // Invito / recupero password: prima di tutto, l'utente sceglie la password.
  if (richiediPassword) {
    if (!session) {
      return <Schermo titolo="Sopralluoghi" testo="Apro l’invito…" />;
    }
    return <ImpostaPassword onFatto={confermaPasswordImpostata} />;
  }

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
      return <Pronto tecnico={tecnico!} />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
