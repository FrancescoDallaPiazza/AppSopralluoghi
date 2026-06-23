// Anagrafiche del back-office: clienti e relativi incarichi. È il blocco a
// monte della Pianificazione — finché non ci sono clienti/incarichi, la scheda
// Pianificazione resta vuota. Online-first (scrivania).

import { useEffect, useMemo, useState } from 'react';
import {
  caricaClienti, salvaCliente, impostaStatoCliente, eliminaCliente, clienteVuoto,
  caricaIncarichiCliente,
  type ClienteRiga, type IncaricoRiga,
} from '../lib/admin/anagrafiche';
import {
  caricaSedi, salvaSede, impostaStatoSede, sedeVuota,
} from '../lib/admin/sedi';
import type { Cliente, Sede } from '../lib/types';

export default function Anagrafiche() {
  // null = elenco; { id } = scheda esistente; { nuovo:true } = scheda nuova
  const [apri, setApri] = useState<{ id?: string; nuovo?: boolean } | null>(null);

  if (apri) {
    return (
      <SchedaCliente
        clienteId={apri.id ?? null}
        onIndietro={() => setApri(null)}
      />
    );
  }
  return <ElencoClienti onApri={(id) => setApri({ id })} onNuovo={() => setApri({ nuovo: true })} />;
}

// ----------------------------- elenco clienti -----------------------------
function ElencoClienti({
  onApri, onNuovo,
}: { onApri: (id: string) => void; onNuovo: () => void }) {
  const [righe, setRighe] = useState<ClienteRiga[]>([]);
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [q, setQ] = useState('');
  const [mostraInattivi, setMostraInattivi] = useState(false);

  useEffect(() => {
    caricaClienti()
      .then((r) => { setRighe(r); setStato('ok'); })
      .catch(() => setStato('errore'));
  }, []);

  const visibili = useMemo(() => {
    const ago = q.trim().toLowerCase();
    return righe.filter((r) => {
      if (!mostraInattivi && !r.cliente.attivo) return false;
      if (!ago) return true;
      return (
        r.cliente.ragione_sociale.toLowerCase().includes(ago) ||
        (r.cliente.localita ?? '').toLowerCase().includes(ago)
      );
    });
  }, [righe, q, mostraInattivi]);

  return (
    <>
      <div className="bo-row" style={{ marginBottom: 14 }}>
        <div className="grow">
          <h2 className="bo-h">Clienti</h2>
          <p className="bo-sub" style={{ margin: 0 }}>
            Anagrafica clienti e incarichi: la base della pianificazione.
          </p>
        </div>
        <button className="bo-btn" onClick={onNuovo}>+ Nuovo cliente</button>
      </div>

      <div className="bo-row" style={{ marginBottom: 14, gap: 14 }}>
        <input type="text" placeholder="Cerca per ragione sociale o località…"
          value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360 }} />
        <label className="chk">
          <input type="checkbox" checked={mostraInattivi}
            onChange={(e) => setMostraInattivi(e.target.checked)} />
          Mostra anche i disattivati
        </label>
      </div>

      {stato === 'loading' && <div className="bo-empty">Carico…</div>}
      {stato === 'errore' && <div className="bo-err">Errore nel caricamento dei clienti.</div>}
      {stato === 'ok' && visibili.length === 0 && (
        <div className="bo-empty">
          {righe.length === 0
            ? 'Nessun cliente. Creane uno con “Nuovo cliente”.'
            : 'Nessun cliente corrisponde ai filtri.'}
        </div>
      )}

      {visibili.map((r) => (
        <div key={r.cliente.id} className={`bo-card ${r.cliente.attivo ? '' : 'dim'}`}>
          <div className="bo-row">
            <div className="grow">
              <div className="bo-title">{r.cliente.ragione_sociale}</div>
              <div className="bo-meta">
                {r.cliente.localita && <span>{r.cliente.localita}</span>}
                {r.cliente.referente && <span>{r.cliente.referente}</span>}
                {r.cliente.telefono && <span>{r.cliente.telefono}</span>}
                {r.cliente.email && <span>{r.cliente.email}</span>}
                <span className={`bo-pill ${r.n_incarichi_attivi > 0 ? 'attivo' : 'archiviato'}`}>
                  {r.n_incarichi} {r.n_incarichi === 1 ? 'incarico' : 'incarichi'}
                </span>
                {!r.cliente.attivo && <span className="bo-pill archiviato">disattivato</span>}
              </div>
            </div>
            <button className="bo-btn ghost sm" onClick={() => onApri(r.cliente.id)}>Apri</button>
          </div>
        </div>
      ))}
    </>
  );
}

// ----------------------------- scheda cliente -----------------------------
function SchedaCliente({
  clienteId, onIndietro,
}: { clienteId: string | null; onIndietro: () => void }) {
  const nuovo = clienteId === null;
  const [cliente, setCliente] = useState<Cliente>(() => clienteVuoto());
  const [persistito, setPersistito] = useState(!nuovo); // esiste sul DB?
  const [incarichi, setIncarichi] = useState<IncaricoRiga[]>([]);
  const [sedi, setSedi] = useState<Sede[]>([]);
  const [fase, setFase] = useState<'carico' | 'pronto' | 'errore'>(nuovo ? 'pronto' : 'carico');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function caricaTutto() {
    if (nuovo) return;
    setFase('carico');
    Promise.all([caricaClienti(), caricaIncarichiCliente(clienteId!)])
      .then(([cls, inc]) => {
        const c = cls.find((x) => x.cliente.id === clienteId);
        if (!c) { setFase('errore'); return; }
        setCliente(c.cliente);
        setIncarichi(inc);
        setFase('pronto');
      })
      .catch(() => setFase('errore'));
    caricaSedi(clienteId!).then(setSedi).catch(() => setSedi([]));
  }
  useEffect(caricaTutto, [clienteId]);

  const patch = (p: Partial<Cliente>) => setCliente((c) => ({ ...c, ...p }));

  async function salva() {
    if (!cliente.ragione_sociale.trim()) { setMsg('La ragione sociale è obbligatoria.'); return; }
    setBusy(true); setMsg(null);
    try {
      await salvaCliente(cliente);
      setPersistito(true);
      setMsg('Cliente salvato.');
    } catch (e: any) {
      setMsg(e?.message ?? 'Salvataggio non riuscito.');
    } finally { setBusy(false); }
  }

  async function toggleAttivo() {
    setBusy(true); setMsg(null);
    try {
      await impostaStatoCliente(cliente.id, !cliente.attivo);
      patch({ attivo: !cliente.attivo });
    } catch (e: any) {
      setMsg(e?.message ?? 'Operazione non riuscita.');
    } finally { setBusy(false); }
  }

  async function elimina() {
    if (!confirm('Eliminare definitivamente questo cliente?')) return;
    setBusy(true); setMsg(null);
    try {
      await eliminaCliente(cliente.id);
      onIndietro();
    } catch (e: any) {
      setMsg(e?.message ?? 'Eliminazione non riuscita.');
      setBusy(false);
    }
  }

  function ricaricaSedi() {
    caricaSedi(cliente.id).then(setSedi).catch(() => {});
  }

  if (fase === 'carico') return <div className="bo-empty">Carico la scheda…</div>;
  if (fase === 'errore') {
    return (
      <div>
        <div className="bo-err">Impossibile caricare il cliente.</div>
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
            {nuovo && !persistito ? 'Nuovo cliente' : cliente.ragione_sociale || 'Cliente'}
          </h2>
        </div>
        {persistito && (
          <span className={`bo-pill ${cliente.attivo ? 'attivo' : 'archiviato'}`}>
            {cliente.attivo ? 'attivo' : 'disattivato'}
          </span>
        )}
      </div>

      {msg && <div className="bo-note">{msg}</div>}

      {/* --- dati cliente --- */}
      <div className="bo-card">
        <label className="bo-field">
          <span>Ragione sociale *</span>
          <input type="text" value={cliente.ragione_sociale}
            onChange={(e) => patch({ ragione_sociale: e.target.value.toUpperCase() })} />
        </label>
        <div className="bo-grid">
          <label className="bo-field">
            <span>Referente</span>
            <input type="text" value={cliente.referente ?? ''}
              onChange={(e) => patch({ referente: e.target.value.toUpperCase() || null })} />
          </label>
          <label className="bo-field">
            <span>Telefono</span>
            <input type="tel" value={cliente.telefono ?? ''}
              onChange={(e) => patch({ telefono: e.target.value || null })} />
          </label>
          <label className="bo-field">
            <span>Email</span>
            <input type="email" value={cliente.email ?? ''}
              onChange={(e) => patch({ email: e.target.value || null })} />
          </label>
          <label className="bo-field">
            <span>Località</span>
            <input type="text" value={cliente.localita ?? ''}
              onChange={(e) => patch({ localita: e.target.value.toUpperCase() || null })} />
          </label>
          <label className="bo-field">
            <span>Indirizzo</span>
            <input type="text" value={cliente.indirizzo ?? ''}
              onChange={(e) => patch({ indirizzo: e.target.value.toUpperCase() || null })} />
          </label>
          <label className="bo-field">
            <span>Latitudine</span>
            <input type="number" step="any" value={cliente.lat ?? ''}
              onChange={(e) => patch({ lat: e.target.value ? Number(e.target.value) : null })} />
          </label>
          <label className="bo-field">
            <span>Longitudine</span>
            <input type="number" step="any" value={cliente.lng ?? ''}
              onChange={(e) => patch({ lng: e.target.value ? Number(e.target.value) : null })} />
          </label>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>ID Werp (opzionale)</span>
            <input type="text" value={cliente.werp_id ?? ''}
              onChange={(e) => patch({ werp_id: e.target.value || null })} />
          </label>
        </div>

        <div className="bo-bar">
          <button className="bo-btn" onClick={() => void salva()} disabled={busy}>
            {busy ? 'Salvo…' : 'Salva cliente'}
          </button>
          {persistito && (
            <button className="bo-btn ghost" onClick={() => void toggleAttivo()} disabled={busy}>
              {cliente.attivo ? 'Disattiva' : 'Riattiva'}
            </button>
          )}
          <span className="bo-sp" />
          {persistito && incarichi.length === 0 && (
            <button className="bo-btn danger sm" onClick={() => void elimina()} disabled={busy}>
              Elimina
            </button>
          )}
        </div>
      </div>

      {/* --- sedi --- */}
      {persistito && (
        <SediCliente clienteId={cliente.id} sedi={sedi} onCambia={ricaricaSedi} />
      )}

      {/* --- incarichi: si creano e si pianificano nel tab Pianificazione --- */}
      {persistito && (
        <>
          <div className="bo-row" style={{ margin: '22px 0 12px' }}>
            <div className="grow"><h2 className="bo-h" style={{ margin: 0 }}>Incarichi</h2></div>
          </div>
          <div className="bo-note">
            {incarichi.length === 0
              ? 'Nessun incarico per questo cliente. Gli incarichi si creano e si pianificano nel tab Pianificazione.'
              : `${incarichi.length} ${incarichi.length === 1 ? 'incarico' : 'incarichi'} `
                + `(${incarichi.filter((r) => r.incarico.stato === 'attivo').length} attivi). `
                + 'Si gestiscono nel tab Pianificazione.'}
          </div>
        </>
      )}

    </div>
  );
}

// --------------------------- sedi di un cliente ---------------------------
function RigaSede({ sede, onCambia }: { sede: Sede; onCambia: () => void }) {
  const [s, setS] = useState<Sede>(sede);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const nuova = !sede.nome;

  async function salva() {
    setBusy(true); setMsg(null);
    try { await salvaSede(s); onCambia(); if (nuova) setS(sedeVuota(sede.cliente_id)); }
    catch (e) { setMsg((e as Error)?.message ?? 'Salvataggio non riuscito.'); }
    finally { setBusy(false); }
  }
  async function toggle() {
    setBusy(true); setMsg(null);
    try { await impostaStatoSede(sede.id, !sede.attivo); onCambia(); }
    catch { setMsg('Operazione non riuscita.'); }
    finally { setBusy(false); }
  }

  return (
    <div className={`bo-card ${s.attivo ? '' : 'dim'}`} style={{ marginBottom: 8 }}>
      {msg && <div className="bo-err">{msg}</div>}
      <div className="bo-grid">
        <label className="bo-field">
          <span>Nome sede</span>
          <input type="text" value={s.nome}
            onChange={(e) => setS({ ...s, nome: e.target.value.toUpperCase() })}
            placeholder="es. SEDE LEGALE, STABILIMENTO 1" />
        </label>
        <label className="bo-field" style={{ marginBottom: 0 }}>
          <span>Indirizzo</span>
          <input type="text" value={s.indirizzo ?? ''}
            onChange={(e) => setS({ ...s, indirizzo: e.target.value.toUpperCase() || null })} />
        </label>
      </div>
      <div className="bo-bar">
        <button className="bo-btn sm" onClick={() => void salva()} disabled={busy}>
          {busy ? 'Salvo…' : nuova ? 'Aggiungi sede' : 'Salva'}
        </button>
        {!nuova && (
          <button className="bo-btn ghost sm" onClick={() => void toggle()} disabled={busy}>
            {sede.attivo ? 'Archivia' : 'Riattiva'}
          </button>
        )}
      </div>
    </div>
  );
}

function SediCliente({ clienteId, sedi, onCambia }: {
  clienteId: string; sedi: Sede[]; onCambia: () => void;
}) {
  const [agg, setAgg] = useState(false);
  return (
    <>
      <div className="bo-row" style={{ margin: '22px 0 12px' }}>
        <div className="grow"><h2 className="bo-h" style={{ margin: 0 }}>Sedi</h2></div>
        {!agg && <button className="bo-btn" onClick={() => setAgg(true)}>+ Aggiungi sede</button>}
      </div>
      <p className="bo-sub" style={{ margin: '0 0 10px' }}>
        Una societa puo avere piu sedi. L'incarico ne sceglie una e il sopralluogo la eredita
        (modificabile in testata). Senza sedi, vale l'indirizzo del cliente.
      </p>

      {agg && (
        <RigaSede sede={sedeVuota(clienteId)}
          onCambia={() => { onCambia(); setAgg(false); }} />
      )}
      {sedi.length === 0 && !agg && (
        <div className="bo-empty">Nessuna sede registrata.</div>
      )}
      {sedi.map((s) => <RigaSede key={s.id} sede={s} onCambia={onCambia} />)}
    </>
  );
}
