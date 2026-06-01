import { useEffect, useState, type CSSProperties } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import Login from './Login';
import ImpostaPassword from './ImpostaPassword';
import CambiaPassword from './CambiaPassword';
import MieiSopralluoghi from './MieiSopralluoghi';
import MieCoseDaFare from './MieCoseDaFare';
import Compilazione from './Compilazione';
import BackOffice from './admin/BackOffice';
import { avviaSyncAuto, runSync } from './lib/sync';
import type { Tecnico } from './lib/types';
import { nomeCompleto } from './lib/types';
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

// Menu account dell'app da campo: Cambia password + Esci. Fisso in basso a
// destra, compare solo nelle viste-elenco (non durante la compilazione).
function MenuAccount() {
  const { signOut } = useAuth();
  const [apri, setApri] = useState(false);
  const [cambia, setCambia] = useState(false);

  return (
    <>
      {cambia && <CambiaPassword onChiudi={() => setCambia(false)} />}
      <div style={{ position: 'fixed', right: 14, bottom: 16, zIndex: 9998,
        fontFamily: '-apple-system,system-ui,sans-serif' }}>
        {apri && (
          <div style={{
            position: 'absolute', right: 0, bottom: 52, width: 190,
            background: '#fffdf9', border: '1px solid #c9c2b4', borderRadius: 12,
            boxShadow: '0 18px 40px -20px rgba(0,0,0,.5)', overflow: 'hidden',
          }}>
            <button onClick={() => { setApri(false); setCambia(true); }}
              style={menuItem}>Cambia password</button>
            <div style={{ height: 1, background: '#ece7dd' }} />
            <button onClick={() => void signOut()}
              style={{ ...menuItem, color: '#b23b2a', fontWeight: 800 }}>Esci</button>
          </div>
        )}
        <button onClick={() => setApri((v) => !v)} aria-label="Account"
          style={{
            width: 46, height: 46, borderRadius: '50%', border: '1px solid #2c2f36',
            background: '#16181c', color: '#fff', fontSize: 18, fontWeight: 800,
            cursor: 'pointer', boxShadow: '0 10px 24px -10px rgba(0,0,0,.6)',
          }}>⋯</button>
      </div>
    </>
  );
}

const menuItem: CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', border: 'none',
  background: 'none', padding: '12px 14px', fontSize: 14, fontWeight: 700,
  color: '#16181c', cursor: 'pointer', fontFamily: 'inherit',
};

// Le due schede + la schermata di campo.
function Home({ tecnico }: { tecnico: Tecnico }) {
  const [tab, setTab] = useState<'sopralluoghi' | 'cose'>('sopralluoghi');
  const [aperto, setAperto] = useState<SopralluogoConContesto | null>(null);

  // Utente interno: non fa sopralluoghi -> vede SOLO "Le mie cose da fare".
  // Niente prop onApriSopralluoghi => la tab verso i sopralluoghi non compare.
  if (tecnico.ruolo === 'interno') {
    return (
      <>
        <MieCoseDaFare tecnicoId={tecnico.id} tecnicoNome={nomeCompleto(tecnico)} />
        <MenuAccount />
      </>
    );
  }

  if (aperto) {
    return (
      <Compilazione
        sopralluogo={aperto}
        tecnicoId={tecnico.id}
        onChiudi={() => setAperto(null)}
      />
    );
  }

  return (
    <>
      {tab === 'sopralluoghi' ? (
        <MieiSopralluoghi
          tecnicoId={tecnico.id}
          tecnicoNome={nomeCompleto(tecnico)}
          onApriCoseDaFare={() => setTab('cose')}
          onApriSopralluogo={setAperto}
        />
      ) : (
        <MieCoseDaFare
          tecnicoId={tecnico.id}
          tecnicoNome={nomeCompleto(tecnico)}
          onApriSopralluoghi={() => setTab('sopralluoghi')}
        />
      )}
      <MenuAccount />
    </>
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
