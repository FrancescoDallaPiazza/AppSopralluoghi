// Tecnici del back-office: anagrafica delle risorse (nome, base, capienza,
// ruolo) usate dalla pianificazione assistita. Online-first.
//
// Onboarding: dalla scheda tecnico si crea/invita l'account di login e si
// collega `tecnico.user_id` in automatico (Edge Function `invita-tecnico`).
// Resta disponibile, nascosto in un dettaglio, il collegamento manuale di un
// user_id già esistente.

import { useEffect, useMemo, useState } from 'react';
import {
  caricaTecniciTutti, salvaTecnico, impostaStatoTecnico, eliminaTecnico, tecnicoVuoto,
  type TecnicoRiga,
} from '../lib/admin/tecnici';
import { invitaTecnico, type ModalitaInvito } from '../lib/onboarding';
import type { Tecnico, RuoloTecnico } from '../lib/types';

const RUOLI: { v: RuoloTecnico; l: string }[] = [
  { v: 'tecnico', l: 'Tecnico' }, { v: 'admin', l: 'Amministratore' },
];

export default function Tecnici() {
  const [apri, setApri] = useState<{ id?: string; nuovo?: boolean } | null>(null);
  if (apri) return <SchedaTecnico tecnicoId={apri.id ?? null} onIndietro={() => setApri(null)} />;
  return <ElencoTecnici onApri={(id) => setApri({ id })} onNuovo={() => setApri({ nuovo: true })} />;
}

// ------------------------------ elenco ------------------------------
function ElencoTecnici({
  onApri, onNuovo,
}: { onApri: (id: string) => void; onNuovo: () => void }) {
  const [righe, setRighe] = useState<TecnicoRiga[]>([]);
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [mostraInattivi, setMostraInattivi] = useState(false);

  useEffect(() => {
    caricaTecniciTutti()
      .then((r) => { setRighe(r); setStato('ok'); })
      .catch(() => setStato('errore'));
  }, []);

  const visibili = useMemo(
    () => righe.filter((r) => mostraInattivi || r.tecnico.attivo),
    [righe, mostraInattivi],
  );

  return (
    <>
      <div className="bo-row" style={{ marginBottom: 14 }}>
        <div className="grow">
          <h2 className="bo-h">Tecnici</h2>
          <p className="bo-sub" style={{ margin: 0 }}>
            Risorse assegnabili ai sopralluoghi: base, capienza settimanale e ruolo.
          </p>
        </div>
        <button className="bo-btn" onClick={onNuovo}>+ Nuovo tecnico</button>
      </div>

      <div className="bo-row" style={{ marginBottom: 14 }}>
        <label className="chk">
          <input type="checkbox" checked={mostraInattivi}
            onChange={(e) => setMostraInattivi(e.target.checked)} />
          Mostra anche i disattivati
        </label>
      </div>

      {stato === 'loading' && <div className="bo-empty">Carico…</div>}
      {stato === 'errore' && <div className="bo-err">Errore nel caricamento dei tecnici.</div>}
      {stato === 'ok' && visibili.length === 0 && (
        <div className="bo-empty">
          {righe.length === 0
            ? 'Nessun tecnico. Creane uno con “Nuovo tecnico”.'
            : 'Nessun tecnico attivo.'}
        </div>
      )}

      {visibili.map((r) => (
        <div key={r.tecnico.id} className={`bo-card ${r.tecnico.attivo ? '' : 'dim'}`}>
          <div className="bo-row">
            <div className="grow">
              <div className="bo-title">{r.tecnico.nome}</div>
              <div className="bo-meta">
                {r.tecnico.base_localita && <span>{r.tecnico.base_localita}</span>}
                {r.tecnico.capienza_ore_settimana != null &&
                  <span>{r.tecnico.capienza_ore_settimana} h/sett.</span>}
                <span className={`bo-pill ${r.tecnico.ruolo === 'admin' ? 'usato' : 'archiviato'}`}>
                  {r.tecnico.ruolo === 'admin' ? 'amministratore' : 'tecnico'}
                </span>
                {!r.tecnico.user_id && <span className="bo-pill warn">login non collegato</span>}
                {r.assegnati > 0 && <span>{r.assegnati} sopralluoghi</span>}
                {!r.tecnico.attivo && <span className="bo-pill archiviato">disattivato</span>}
              </div>
            </div>
            <button className="bo-btn ghost sm" onClick={() => onApri(r.tecnico.id)}>Apri</button>
          </div>
        </div>
      ))}
    </>
  );
}

// ------------------------------ scheda ------------------------------
function SchedaTecnico({
  tecnicoId, onIndietro,
}: { tecnicoId: string | null; onIndietro: () => void }) {
  const nuovo = tecnicoId === null;
  const [t, setT] = useState<Tecnico>(() => tecnicoVuoto());
  const [persistito, setPersistito] = useState(!nuovo);
  const [assegnati, setAssegnati] = useState(0);
  const [fase, setFase] = useState<'carico' | 'pronto' | 'errore'>(nuovo ? 'pronto' : 'carico');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // --- onboarding: invito / creazione account di login ---
  const [emailInvito, setEmailInvito] = useState('');
  const [modInvito, setModInvito] = useState<ModalitaInvito>('link');
  const [linkInvito, setLinkInvito] = useState<string | null>(null);

  useEffect(() => {
    if (nuovo) return;
    setFase('carico');
    caricaTecniciTutti()
      .then((righe) => {
        const r = righe.find((x) => x.tecnico.id === tecnicoId);
        if (!r) { setFase('errore'); return; }
        setT(r.tecnico); setAssegnati(r.assegnati); setFase('pronto');
      })
      .catch(() => setFase('errore'));
  }, [tecnicoId, nuovo]);

  const patch = (p: Partial<Tecnico>) => setT((x) => ({ ...x, ...p }));

  async function salva() {
    if (!t.nome.trim()) { setMsg('Il nome è obbligatorio.'); return; }
    setBusy(true); setMsg(null);
    try {
      await salvaTecnico(t);
      setPersistito(true);
      setMsg('Tecnico salvato.');
    } catch (e: any) {
      setMsg(e?.message ?? 'Salvataggio non riuscito.');
    } finally { setBusy(false); }
  }

  async function toggleAttivo() {
    setBusy(true); setMsg(null);
    try {
      await impostaStatoTecnico(t.id, !t.attivo);
      patch({ attivo: !t.attivo });
    } catch (e: any) {
      setMsg(e?.message ?? 'Operazione non riuscita.');
    } finally { setBusy(false); }
  }

  async function elimina() {
    if (!confirm('Eliminare definitivamente questo tecnico?')) return;
    setBusy(true); setMsg(null);
    try {
      await eliminaTecnico(t.id);
      onIndietro();
    } catch (e: any) {
      setMsg(e?.message ?? 'Eliminazione non riuscita.');
      setBusy(false);
    }
  }

  // Crea/invita l'account di login e collega user_id (via Edge Function).
  async function invita() {
    const email = emailInvito.trim();
    if (!email || !email.includes('@')) {
      setMsg('Indica un indirizzo email valido per l’invito.');
      return;
    }
    setBusy(true); setMsg(null); setLinkInvito(null);
    try {
      const res = await invitaTecnico({ tecnicoId: t.id, email, modalita: modInvito });
      patch({ user_id: res.user_id });
      if (res.action_link) setLinkInvito(res.action_link);
      setMsg(
        res.gia_esistente
          ? 'Account già esistente: l’ho collegato a questo tecnico.'
          : modInvito === 'invito'
            ? 'Invito inviato via email e account collegato.'
            : 'Account creato e collegato. Copia il link qui sotto e invialo al tecnico.',
      );
    } catch (e: any) {
      setMsg(e?.message ?? 'Invito non riuscito.');
    } finally { setBusy(false); }
  }

  if (fase === 'carico') return <div className="bo-empty">Carico la scheda…</div>;
  if (fase === 'errore') {
    return (
      <div>
        <div className="bo-err">Impossibile caricare il tecnico.</div>
        <button className="bo-btn ghost" onClick={onIndietro}>Indietro</button>
      </div>
    );
  }

  return (
    <div>
      <div className="bo-row" style={{ marginBottom: 8 }}>
        <button className="bo-iconbtn" onClick={onIndietro} title="Indietro">←</button>
        <div className="grow">
          <h2 className="bo-h" style={{ margin: 0 }}>
            {nuovo && !persistito ? 'Nuovo tecnico' : t.nome || 'Tecnico'}
          </h2>
        </div>
        {persistito && (
          <span className={`bo-pill ${t.attivo ? 'attivo' : 'archiviato'}`}>
            {t.attivo ? 'attivo' : 'disattivato'}
          </span>
        )}
      </div>

      {msg && <div className="bo-note">{msg}</div>}

      <div className="bo-card">
        <label className="bo-field">
          <span>Nome *</span>
          <input type="text" value={t.nome}
            onChange={(e) => patch({ nome: e.target.value })} />
        </label>

        <div className="bo-grid">
          <label className="bo-field">
            <span>Ruolo</span>
            <select value={t.ruolo} onChange={(e) => patch({ ruolo: e.target.value as RuoloTecnico })}>
              {RUOLI.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </label>
          <label className="bo-field">
            <span>Capienza (ore/settimana)</span>
            <input type="number" min={0} step="0.5" value={t.capienza_ore_settimana ?? ''}
              onChange={(e) => patch({ capienza_ore_settimana: e.target.value ? Number(e.target.value) : null })} />
          </label>
          <label className="bo-field">
            <span>Base (località)</span>
            <input type="text" value={t.base_localita ?? ''}
              onChange={(e) => patch({ base_localita: e.target.value || null })} />
          </label>
          <label className="bo-field">
            <span>Calendario (rif. opzionale)</span>
            <input type="text" value={t.calendario_ref ?? ''}
              onChange={(e) => patch({ calendario_ref: e.target.value || null })} />
          </label>
          <label className="bo-field">
            <span>Base · latitudine</span>
            <input type="number" step="any" value={t.base_lat ?? ''}
              onChange={(e) => patch({ base_lat: e.target.value ? Number(e.target.value) : null })} />
          </label>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>Base · longitudine</span>
            <input type="number" step="any" value={t.base_lng ?? ''}
              onChange={(e) => patch({ base_lng: e.target.value ? Number(e.target.value) : null })} />
          </label>
        </div>

        {/* ---------- account di login (onboarding) ---------- */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <div className="bo-field" style={{ marginBottom: 8 }}>
            <span>Account di login</span>
          </div>

          {t.user_id ? (
            <>
              <div className="bo-note">
                Login collegato (user_id <code>{t.user_id}</code>). Il tecnico può accedere all’app.
              </div>
              <details style={{ marginTop: 8 }}>
                <summary className="bo-sub" style={{ cursor: 'pointer' }}>Scollega / modifica manualmente</summary>
                <label className="bo-field" style={{ marginTop: 8, marginBottom: 0 }}>
                  <span>user_id (UUID Supabase)</span>
                  <input type="text" value={t.user_id ?? ''} placeholder="UUID dell'utente Supabase"
                    onChange={(e) => patch({ user_id: e.target.value || null })} />
                </label>
                <div className="bo-sub" style={{ marginTop: 6 }}>
                  Svuota il campo e premi “Salva tecnico” per scollegare l’accesso.
                </div>
              </details>
            </>
          ) : !persistito ? (
            <div className="bo-note">
              Salva prima il tecnico, poi qui potrai creare e collegare il suo accesso all’app.
            </div>
          ) : (
            <>
              <p className="bo-sub" style={{ margin: '0 0 10px' }}>
                Crea l’accesso del tecnico e collegalo in automatico — niente più user_id da
                incollare a mano da Supabase.
              </p>
              <div className="bo-grid">
                <label className="bo-field">
                  <span>Email del tecnico</span>
                  <input type="email" value={emailInvito} placeholder="nome@studio.it"
                    onChange={(e) => setEmailInvito(e.target.value)} />
                </label>
                <label className="bo-field" style={{ marginBottom: 0 }}>
                  <span>Modalità</span>
                  <select value={modInvito} onChange={(e) => setModInvito(e.target.value as ModalitaInvito)}>
                    <option value="link">Genera link da inviare</option>
                    <option value="invito">Invia email d’invito</option>
                  </select>
                </label>
              </div>
              <div className="bo-bar">
                <button className="bo-btn" onClick={() => void invita()} disabled={busy}>
                  {busy ? 'Procedo…' : 'Crea / invita account'}
                </button>
              </div>
              {linkInvito && (
                <label className="bo-field" style={{ marginTop: 8, marginBottom: 0 }}>
                  <span>Link d’invito (selezionalo, copialo e invialo al tecnico)</span>
                  <input type="text" readOnly value={linkInvito}
                    onFocus={(e) => e.currentTarget.select()} />
                </label>
              )}
              <details style={{ marginTop: 10 }}>
                <summary className="bo-sub" style={{ cursor: 'pointer' }}>Collega manualmente un user_id esistente</summary>
                <label className="bo-field" style={{ marginTop: 8, marginBottom: 0 }}>
                  <span>user_id (UUID Supabase)</span>
                  <input type="text" value={t.user_id ?? ''} placeholder="UUID dell'utente Supabase"
                    onChange={(e) => patch({ user_id: e.target.value || null })} />
                </label>
              </details>
            </>
          )}
        </div>

        <div className="bo-bar">
          <button className="bo-btn" onClick={() => void salva()} disabled={busy}>
            {busy ? 'Salvo…' : 'Salva tecnico'}
          </button>
          {persistito && (
            <button className="bo-btn ghost" onClick={() => void toggleAttivo()} disabled={busy}>
              {t.attivo ? 'Disattiva' : 'Riattiva'}
            </button>
          )}
          <span className="bo-sp" />
          {persistito && assegnati === 0 && (
            <button className="bo-btn danger sm" onClick={() => void elimina()} disabled={busy}>
              Elimina
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
