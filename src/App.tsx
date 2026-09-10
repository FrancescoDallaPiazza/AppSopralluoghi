import { useEffect, useState, type CSSProperties } from 'react';
import { liveQuery } from 'dexie';
import { AuthProvider, useAuth } from './AuthProvider';
import Login from './Login';
import ImpostaPassword from './ImpostaPassword';
import CambiaPassword from './CambiaPassword';
import Quarantena from './Quarantena';
import MieiSopralluoghi from './MieiSopralluoghi';
import MieCoseDaFare from './MieCoseDaFare';
import Compilazione from './Compilazione';
import BackOffice from './admin/BackOffice';
import { avviaSyncAuto, runSync, contaQuarantena } from './lib/sync';
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
      background: '#d5cec1', textAlign: 'center',
      fontFamily: '"Hanken Grotesk Variable",-apple-system,system-ui,sans-serif', color: '#1b1c1f',
    }}>
      <div style={{ fontWeight: 800, fontSize: 17 }}>{titolo}</div>
      <div style={{ fontSize: 13.5, color: '#5c5f66', maxWidth: 320, lineHeight: 1.5 }}>{testo}</div>
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
//
// Ospita anche la via d'accesso alla quarantena, e solo quando serve: la voce e
// il pallino rosso compaiono se c'e' almeno un'operazione ferma. Una voce sempre
// presente non direbbe niente di utile - se non c'e' niente di bloccato, la
// risposta la da' la sua assenza; il pallino invece va visto senza aprire il
// menu, perche' nessuno apre un menu per cercare un problema che non sa di avere.
function MenuAccount() {
  const { signOut } = useAuth();
  const [apri, setApri] = useState(false);
  const [cambia, setCambia] = useState(false);
  const [bloccate, setBloccate] = useState(0);
  const [vediBloccate, setVediBloccate] = useState(false);

  useEffect(() => {
    const sub = liveQuery(() => contaQuarantena()).subscribe({
      next: setBloccate,
      error: (e) => console.warn('quarantena non leggibile:', e),
    });
    return () => sub.unsubscribe();
  }, []);

  return (
    <>
      {cambia && <CambiaPassword onChiudi={() => setCambia(false)} />}
      {vediBloccate && <Quarantena onChiudi={() => setVediBloccate(false)} />}
      <div style={{ position: 'fixed', right: 14, bottom: 16, zIndex: 9998,
        fontFamily: '"Hanken Grotesk Variable",-apple-system,system-ui,sans-serif' }}>
        {apri && (
          <div style={{
            position: 'absolute', right: 0, bottom: 52, width: 190,
            background: '#fffdf9', border: '1px solid #c9c2b4', borderRadius: 12,
            boxShadow: '0 18px 40px -20px rgba(0,0,0,.5)', overflow: 'hidden',
          }}>
            {bloccate > 0 && (
              <>
                <button onClick={() => { setApri(false); setVediBloccate(true); }}
                  style={{ ...menuItem, color: '#b23b2a' }}>
                  Non arrivate in ufficio ({bloccate})
                </button>
                <div style={{ height: 1, background: '#ece7dd' }} />
              </>
            )}
            <button onClick={() => { setApri(false); setCambia(true); }}
              style={menuItem}>Cambia password</button>
            <div style={{ height: 1, background: '#ece7dd' }} />
            <button onClick={() => void signOut()}
              style={{ ...menuItem, color: '#b23b2a', fontWeight: 800 }}>Esci</button>
          </div>
        )}
        <button onClick={() => setApri((v) => !v)}
          aria-label={bloccate > 0 ? `Account · ${bloccate} operazioni non arrivate in ufficio` : 'Account'}
          style={{
            position: 'relative',
            width: 46, height: 46, borderRadius: '50%', border: '1px solid #2c2f36',
            background: '#1b1c1f', color: '#fff', fontSize: 18, fontWeight: 800,
            cursor: 'pointer', boxShadow: '0 10px 24px -10px rgba(0,0,0,.6)',
          }}>
          ⋯
          {bloccate > 0 && (
            <span style={{
              position: 'absolute', top: 1, right: 1, minWidth: 17, height: 17,
              borderRadius: 999, background: '#b23b2a', border: '2px solid #1b1c1f',
              color: '#fff', fontSize: 10.5, fontWeight: 800, lineHeight: '15px',
            }}>{bloccate}</span>
          )}
        </button>
      </div>
    </>
  );
}

const menuItem: CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', border: 'none',
  background: 'none', padding: '12px 14px', fontSize: 14, fontWeight: 700,
  color: '#1b1c1f', cursor: 'pointer', fontFamily: 'inherit',
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
            border: '1px solid #c9c2b4', background: '#fffdf9', color: '#1b1c1f',
            borderRadius: 999, padding: '6px 12px', fontWeight: 800, fontSize: 12,
            fontFamily: '"Hanken Grotesk Variable",-apple-system,system-ui,sans-serif', cursor: 'pointer',
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
