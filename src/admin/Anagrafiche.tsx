// Anagrafiche del back-office: clienti e relativi incarichi. È il blocco a
// monte della Pianificazione — finché non ci sono clienti/incarichi, la scheda
// Pianificazione resta vuota. Online-first (scrivania).

import { useEffect, useMemo, useState } from 'react';
import {
  caricaClienti, salvaCliente, impostaStatoCliente, eliminaCliente, clienteVuoto,
  caricaIncarichiCliente, salvaIncarico, impostaStatoIncarico, eliminaIncarico,
  incaricoVuoto, tipiAttivitaSuggeriti,
  type ClienteRiga, type IncaricoRiga,
} from '../lib/admin/anagrafiche';
import { dateDaCadenza } from '../lib/admin/calendario';
import type { Cliente, Incarico, IncaricoStato, CadenzaUnita } from '../lib/types';

const STATO_INC: { v: IncaricoStato; l: string }[] = [
  { v: 'attivo', l: 'Attivo' }, { v: 'sospeso', l: 'Sospeso' }, { v: 'chiuso', l: 'Chiuso' },
];
const UNITA: { v: CadenzaUnita; l: string }[] = [
  { v: 'giorni', l: 'giorni' }, { v: 'settimane', l: 'settimane' }, { v: 'mesi', l: 'mesi' },
];
const fmtData = (d: string | null) => {
  if (!d) return '—';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y}`;
};

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
                {r.cliente.indirizzo && <span>{r.cliente.indirizzo}</span>}
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
  const [tipi, setTipi] = useState<string[]>([]);
  const [fase, setFase] = useState<'carico' | 'pronto' | 'errore'>(nuovo ? 'pronto' : 'carico');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ inc: Incarico; nuovo: boolean } | null>(null);

  function caricaTutto() {
    tipiAttivitaSuggeriti().then(setTipi).catch(() => setTipi([]));
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

  function ricaricaIncarichi() {
    caricaIncarichiCliente(cliente.id).then(setIncarichi).catch(() => {});
  }

  async function salvaIncaricoCorrente(inc: Incarico) {
    setBusy(true); setMsg(null);
    try {
      await salvaIncarico(inc);
      setEdit(null);
      ricaricaIncarichi();
      setMsg('Incarico salvato.');
    } catch (e: any) {
      setMsg(e?.message ?? 'Salvataggio incarico non riuscito.');
    } finally { setBusy(false); }
  }

  async function cambiaStatoIncarico(id: string, stato: IncaricoStato) {
    setBusy(true); setMsg(null);
    try {
      await impostaStatoIncarico(id, stato);
      ricaricaIncarichi();
    } catch (e: any) {
      setMsg(e?.message ?? 'Operazione non riuscita.');
    } finally { setBusy(false); }
  }

  async function rimuoviIncarico(id: string) {
    if (!confirm('Eliminare questo incarico?')) return;
    setBusy(true); setMsg(null);
    try {
      await eliminaIncarico(id);
      ricaricaIncarichi();
    } catch (e: any) {
      setMsg(e?.message ?? 'Eliminazione non riuscita.');
    } finally { setBusy(false); }
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
            onChange={(e) => patch({ ragione_sociale: e.target.value })} />
        </label>
        <div className="bo-grid">
          <label className="bo-field">
            <span>Località</span>
            <input type="text" value={cliente.localita ?? ''}
              onChange={(e) => patch({ localita: e.target.value || null })} />
          </label>
          <label className="bo-field">
            <span>Indirizzo</span>
            <input type="text" value={cliente.indirizzo ?? ''}
              onChange={(e) => patch({ indirizzo: e.target.value || null })} />
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

      {/* --- incarichi --- */}
      <div className="bo-row" style={{ margin: '22px 0 12px' }}>
        <div className="grow"><h2 className="bo-h" style={{ margin: 0 }}>Incarichi</h2></div>
        {persistito && !edit && (
          <button className="bo-btn"
            onClick={() => setEdit({ inc: incaricoVuoto(cliente.id), nuovo: true })}>
            + Nuovo incarico
          </button>
        )}
      </div>

      {!persistito && (
        <div className="bo-empty">Salva il cliente per aggiungere i suoi incarichi.</div>
      )}

      {edit && (
        <EditorIncarico
          incarico={edit.inc} tipi={tipi} busy={busy}
          onSalva={salvaIncaricoCorrente}
          onAnnulla={() => setEdit(null)}
        />
      )}

      {persistito && !edit && incarichi.length === 0 && (
        <div className="bo-empty">Nessun incarico. Aggiungine uno con “Nuovo incarico”.</div>
      )}

      {persistito && !edit && incarichi.map((r) => (
        <div key={r.incarico.id} className={`bo-card ${r.incarico.stato === 'attivo' ? '' : 'dim'}`}>
          <div className="bo-row">
            <div className="grow">
              <div className="bo-title">{r.incarico.tipo_attivita}</div>
              <div className="bo-meta">
                <span><b>{r.incarico.n_sopralluoghi}</b> sopralluoghi</span>
                {r.incarico.cadenza_valore && r.incarico.cadenza_unita && (
                  <span>1 ogni {r.incarico.cadenza_valore} {r.incarico.cadenza_unita}</span>
                )}
                <span>{fmtData(r.incarico.periodo_inizio)} → {fmtData(r.incarico.periodo_fine)}</span>
                {r.incarico.durata_seduta_stimata_min != null &&
                  <span>{r.incarico.durata_seduta_stimata_min} min/seduta</span>}
                <span className={`bo-pill ${r.incarico.stato === 'attivo' ? 'attivo' : 'archiviato'}`}>
                  {r.incarico.stato}
                </span>
                {r.creati > 0 && <span className="bo-pill usato">{r.creati} sedute create</span>}
              </div>
            </div>
            <button className="bo-btn ghost sm"
              onClick={() => setEdit({ inc: r.incarico, nuovo: false })} disabled={busy}>
              Modifica
            </button>
          </div>
          <div className="bo-bar" style={{ marginTop: 12 }}>
            <label className="bo-field" style={{ margin: 0, minWidth: 150 }}>
              <span>Stato</span>
              <select value={r.incarico.stato}
                onChange={(e) => void cambiaStatoIncarico(r.incarico.id, e.target.value as IncaricoStato)}
                disabled={busy}>
                {STATO_INC.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </label>
            <span className="bo-sp" />
            {r.creati === 0 && (
              <button className="bo-btn danger sm" onClick={() => void rimuoviIncarico(r.incarico.id)} disabled={busy}>
                Elimina
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// --------------------------- editor di un incarico ---------------------------
function EditorIncarico({
  incarico, tipi, busy, onSalva, onAnnulla,
}: {
  incarico: Incarico;
  tipi: string[];
  busy: boolean;
  onSalva: (i: Incarico) => void;
  onAnnulla: () => void;
}) {
  const [i, setI] = useState<Incarico>(incarico);
  const [modo, setModo] = useState<'cadenza' | 'numero'>(
    incarico.cadenza_valore != null ? 'cadenza' : 'numero',
  );
  const patch = (p: Partial<Incarico>) => setI((x) => ({ ...x, ...p }));
  const listId = 'tipi-attivita';

  const tipoNonCoperto =
    i.tipo_attivita.trim() !== '' && tipi.length > 0 &&
    !tipi.some((t) => t.toLowerCase() === i.tipo_attivita.trim().toLowerCase());

  function cambiaModo(m: 'cadenza' | 'numero') {
    setModo(m);
    if (m === 'numero') {
      patch({ cadenza_valore: null, cadenza_unita: null });
    } else {
      patch({ cadenza_valore: i.cadenza_valore ?? 3, cadenza_unita: i.cadenza_unita ?? 'mesi' });
    }
  }

  // Anteprima delle date a cadenza (e quindi del numero di sedute calcolato).
  const anteprima = useMemo(() => {
    if (modo !== 'cadenza' || !i.cadenza_valore || !i.cadenza_unita) return [];
    return dateDaCadenza(i.periodo_inizio, i.periodo_fine, i.cadenza_valore, i.cadenza_unita);
  }, [modo, i.cadenza_valore, i.cadenza_unita, i.periodo_inizio, i.periodo_fine]);

  function salva() {
    if (modo === 'cadenza') {
      onSalva({ ...i, n_sopralluoghi: Math.max(1, anteprima.length) });
    } else {
      onSalva({ ...i, cadenza_valore: null, cadenza_unita: null });
    }
  }

  return (
    <div className="bo-card" style={{ borderLeft: '3px solid var(--hi)' }}>
      <div className="bo-title" style={{ marginBottom: 12 }}>
        {incarico.tipo_attivita ? 'Modifica incarico' : 'Nuovo incarico'}
      </div>

      <label className="bo-field">
        <span>Tipo di attività *</span>
        <input type="text" list={listId} value={i.tipo_attivita}
          placeholder="es. DVR, RSPP/Audit periodico…"
          onChange={(e) => patch({ tipo_attivita: e.target.value })} />
        <datalist id={listId}>
          {tipi.map((t) => <option key={t} value={t} />)}
        </datalist>
      </label>
      {tipoNonCoperto && (
        <div className="bo-note" style={{ marginTop: -4 }}>
          Nessun template attivo per “{i.tipo_attivita.trim()}”. La pianificazione funziona
          comunque, ma in compilazione servirà un template con questo tipo di attività.
        </div>
      )}

      <label className="bo-field">
        <span>Come definire i sopralluoghi</span>
        <select value={modo} onChange={(e) => cambiaModo(e.target.value as 'cadenza' | 'numero')}>
          <option value="cadenza">Per cadenza (1 ogni …)</option>
          <option value="numero">Numero fisso nel periodo</option>
        </select>
      </label>

      {modo === 'cadenza' ? (
        <>
          <div className="bo-grid">
            <label className="bo-field">
              <span>1 sopralluogo ogni</span>
              <input type="number" min={1} value={i.cadenza_valore ?? ''}
                onChange={(e) => patch({ cadenza_valore: e.target.value ? Number(e.target.value) : null })} />
            </label>
            <label className="bo-field">
              <span>Unità</span>
              <select value={i.cadenza_unita ?? 'mesi'}
                onChange={(e) => patch({ cadenza_unita: e.target.value as CadenzaUnita })}>
                {UNITA.map((u) => <option key={u.v} value={u.v}>{u.l}</option>)}
              </select>
            </label>
          </div>
          <div className="bo-note" style={{ marginTop: -2 }}>
            {anteprima.length > 0
              ? `≈ ${anteprima.length} ${anteprima.length === 1 ? 'seduta' : 'sedute'} nel periodo `
                + `(prima ${fmtData(anteprima[0])}, ultima ${fmtData(anteprima[anteprima.length - 1])}). `
                + 'Il numero viene calcolato in automatico.'
              : 'Imposta cadenza e periodo per calcolare il numero di sedute.'}
          </div>
        </>
      ) : (
        <div className="bo-grid">
          <label className="bo-field">
            <span>N. sopralluoghi *</span>
            <input type="number" min={1} value={i.n_sopralluoghi}
              onChange={(e) => patch({ n_sopralluoghi: Number(e.target.value) || 0 })} />
          </label>
          <span />
        </div>
      )}

      <div className="bo-grid">
        <label className="bo-field">
          <span>Durata seduta (min)</span>
          <input type="number" min={0} value={i.durata_seduta_stimata_min ?? ''}
            onChange={(e) => patch({ durata_seduta_stimata_min: e.target.value ? Number(e.target.value) : null })} />
        </label>
        <label className="bo-field">
          <span>Stato</span>
          <select value={i.stato} onChange={(e) => patch({ stato: e.target.value as IncaricoStato })}>
            {STATO_INC.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </label>
        <label className="bo-field">
          <span>Inizio periodo *</span>
          <input type="date" value={i.periodo_inizio}
            onChange={(e) => patch({ periodo_inizio: e.target.value })} />
        </label>
        <label className="bo-field">
          <span>Fine periodo *</span>
          <input type="date" value={i.periodo_fine}
            onChange={(e) => patch({ periodo_fine: e.target.value })} />
        </label>
        <label className="bo-field" style={{ marginBottom: 0 }}>
          <span>ID Werp (opzionale)</span>
          <input type="text" value={i.werp_id ?? ''}
            onChange={(e) => patch({ werp_id: e.target.value || null })} />
        </label>
      </div>

      <div className="bo-bar">
        <button className="bo-btn" onClick={salva} disabled={busy}>
          {busy ? 'Salvo…' : 'Salva incarico'}
        </button>
        <button className="bo-btn ghost" onClick={onAnnulla} disabled={busy}>Annulla</button>
      </div>
    </div>
  );
}
