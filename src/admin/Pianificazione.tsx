// Pianificazione dei sopralluoghi. Elenco incarichi con avanzamento; aprendone
// uno si generano e si assegnano le sedute (tecnico, data, durata, località).

import { useEffect, useState } from 'react';
import {
  caricaIncarichi, caricaPiano, caricaTecnici, eliminaSopralluogo,
  generaSopralluoghiMancanti, salvaSopralluogo,
  type IncaricoPiano, type PianoIncarico,
} from '../lib/admin/pianificazione';
import type { Sopralluogo, Tecnico } from '../lib/types';

const STATO_LABEL: Record<string, string> = {
  attivo: 'attivo', sospeso: 'sospeso', chiuso: 'chiuso',
};

// Ordina per il numero del progressivo (k in "k/N"), non come testo: così
// 2/53 viene prima di 10/53 (e non dopo, come farebbe l'ordinamento alfabetico).
const numProg = (p: string | null): number => {
  const n = parseInt((p ?? '').split('/')[0], 10);
  return Number.isFinite(n) ? n : 0;
};

export default function Pianificazione() {
  const [sel, setSel] = useState<string | null>(null);
  if (sel) return <DettaglioPiano incaricoId={sel} onIndietro={() => setSel(null)} />;
  return <ElencoIncarichi onApri={setSel} />;
}

// ---------------- elenco incarichi ----------------
function ElencoIncarichi({ onApri }: { onApri: (id: string) => void }) {
  const [righe, setRighe] = useState<IncaricoPiano[]>([]);
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');

  useEffect(() => {
    caricaIncarichi()
      .then((r) => { setRighe(r); setStato('ok'); })
      .catch(() => setStato('errore'));
  }, []);

  return (
    <>
      <h2 className="bo-h">Pianificazione</h2>
      <p className="bo-sub">Genera e assegna i sopralluoghi di ciascun incarico.</p>

      {stato === 'loading' && <div className="bo-empty">Carico…</div>}
      {stato === 'errore' && <div className="bo-err">Errore nel caricamento degli incarichi.</div>}
      {stato === 'ok' && righe.length === 0 && (
        <div className="bo-empty">Nessun incarico presente.</div>
      )}

      {righe.map((r) => {
        const completo = r.assegnati >= r.totale_previsti;
        return (
          <div key={r.incarico.id} className={`bo-card ${r.incarico.stato !== 'attivo' ? 'dim' : ''}`}>
            <div className="bo-row">
              <div className="grow">
                <div className="bo-title">{r.cliente_nome}</div>
                <div className="bo-meta">
                  <span><b>{r.incarico.tipo_attivita}</b></span>
                  {r.cliente_localita && <span>{r.cliente_localita}</span>}
                  <span>{r.incarico.periodo_inizio} → {r.incarico.periodo_fine}</span>
                  <span className={`bo-pill ${r.incarico.stato === 'attivo' ? 'attivo' : 'archiviato'}`}>
                    {STATO_LABEL[r.incarico.stato] ?? r.incarico.stato}
                  </span>
                </div>
                <div className="bo-meta" style={{ marginTop: 6 }}>
                  <span className={`bo-pill ${completo ? 'attivo' : 'warn'}`}>
                    {r.assegnati}/{r.totale_previsti} assegnati
                  </span>
                  {r.creati !== r.totale_previsti && <span>{r.creati} sedute create</span>}
                </div>
              </div>
              <button className="bo-btn" onClick={() => onApri(r.incarico.id)}>Pianifica</button>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---------------- dettaglio di un incarico ----------------
function DettaglioPiano({ incaricoId, onIndietro }: { incaricoId: string; onIndietro: () => void }) {
  const [piano, setPiano] = useState<PianoIncarico | null>(null);
  const [tecnici, setTecnici] = useState<Tecnico[]>([]);
  const [righe, setRighe] = useState<Sopralluogo[]>([]);
  const [fase, setFase] = useState<'carico' | 'pronto' | 'errore'>('carico');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function carica() {
    setFase('carico');
    Promise.all([caricaPiano(incaricoId), caricaTecnici()])
      .then(([p, t]) => {
        setPiano(p); setTecnici(t); setRighe(p.sopralluoghi); setFase('pronto');
      })
      .catch(() => setFase('errore'));
  }
  useEffect(carica, [incaricoId]);

  const patch = (id: string, p: Partial<Sopralluogo>) =>
    setRighe((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  async function genera() {
    if (!piano) return;
    setBusy(true); setMsg(null);
    try {
      const nuovi = await generaSopralluoghiMancanti({ ...piano, sopralluoghi: righe });
      setRighe((rs) => [...rs, ...nuovi]);
      setMsg(`Generate ${nuovi.length} sedute con date proposte nel periodo (modificabili).`);
    } catch (e: any) {
      setMsg(e?.message ?? 'Generazione non riuscita.');
    } finally { setBusy(false); }
  }

  async function salvaTutto() {
    setBusy(true); setMsg(null);
    try {
      for (const r of righe.filter((x) => x.stato === 'pianificato')) await salvaSopralluogo(r);
      setMsg('Pianificazione salvata.');
    } catch (e: any) {
      setMsg(e?.message ?? 'Salvataggio non riuscito.');
    } finally { setBusy(false); }
  }

  async function rimuovi(id: string) {
    if (!confirm('Eliminare questa seduta pianificata?')) return;
    setBusy(true); setMsg(null);
    try {
      await eliminaSopralluogo(id);
      setRighe((rs) => rs.filter((r) => r.id !== id));
    } catch (e: any) {
      setMsg(e?.message ?? 'Eliminazione non riuscita.');
    } finally { setBusy(false); }
  }

  if (fase === 'carico') return <div className="bo-empty">Carico il piano…</div>;
  if (fase === 'errore' || !piano) {
    return (
      <div>
        <div className="bo-err">Impossibile caricare l'incarico.</div>
        <button className="bo-btn ghost" onClick={onIndietro}>Indietro</button>
      </div>
    );
  }

  const mancano = piano.incarico.n_sopralluoghi - righe.length;

  return (
    <div>
      <div className="bo-row" style={{ marginBottom: 4 }}>
        <button className="bo-iconbtn" onClick={onIndietro} title="Indietro">←</button>
        <div className="grow"><h2 className="bo-h" style={{ margin: 0 }}>{piano.cliente_nome}</h2></div>
      </div>
      <p className="bo-sub">
        {piano.incarico.tipo_attivita} · {piano.cliente_localita ?? '—'} ·
        {' '}previsti {piano.incarico.n_sopralluoghi} sopralluoghi
        {' '}({piano.incarico.periodo_inizio} → {piano.incarico.periodo_fine})
      </p>

      {msg && <div className="bo-note">{msg}</div>}

      <div className="bo-bar" style={{ marginTop: 0, marginBottom: 14 }}>
        {mancano > 0 && (
          <button className="bo-btn ghost" onClick={() => void genera()} disabled={busy}>
            + Genera {mancano} sedute mancanti
          </button>
        )}
        <span className="bo-sp" />
        <button className="bo-btn" onClick={() => void salvaTutto()} disabled={busy}>
          {busy ? 'Salvo…' : 'Salva pianificazione'}
        </button>
      </div>

      {righe.length === 0 && (
        <div className="bo-empty">Nessuna seduta. Usa “Genera sedute mancanti”.</div>
      )}

      {[...righe].sort((a, b) => numProg(a.progressivo) - numProg(b.progressivo)).map((r) => {
        const bloccato = r.stato !== 'pianificato';
        return (
          <div className="bo-card" key={r.id}>
            <div className="bo-row" style={{ marginBottom: bloccato ? 0 : 10 }}>
              <div className="grow">
                <div className="bo-title">Sopralluogo {r.progressivo ?? '—'}</div>
              </div>
              {bloccato
                ? <span className="bo-pill archiviato">{r.stato}</span>
                : (
                  <button className="bo-btn danger sm" onClick={() => void rimuovi(r.id)} disabled={busy}>
                    Elimina
                  </button>
                )}
            </div>

            {!bloccato && (
              <div className="bo-grid">
                <label className="bo-field">
                  <span>Tecnico</span>
                  <select value={r.tecnico_id ?? ''}
                    onChange={(e) => patch(r.id, { tecnico_id: e.target.value || null })}>
                    <option value="">— non assegnato —</option>
                    {tecnici.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </label>
                <label className="bo-field">
                  <span>Data pianificata</span>
                  <input type="date" value={r.data_pianificata ?? ''}
                    onChange={(e) => patch(r.id, { data_pianificata: e.target.value || null })} />
                </label>
                <label className="bo-field" style={{ marginBottom: 0 }}>
                  <span>Durata stimata (min)</span>
                  <input type="number" min={0} value={r.durata_stimata_min ?? ''}
                    onChange={(e) => patch(r.id, { durata_stimata_min: e.target.value ? Number(e.target.value) : null })} />
                </label>
                <label className="bo-field" style={{ marginBottom: 0 }}>
                  <span>Località</span>
                  <input type="text" value={r.localita ?? ''}
                    onChange={(e) => patch(r.id, { localita: e.target.value || null })} />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
