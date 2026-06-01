// Aree/funzioni interne del back-office (Formazione, Preventivi, …).
// Destinatari delle "cose da fare" interne alternativi al tecnico. Online-first.

import { useEffect, useState } from 'react';
import {
  caricaAree, salvaArea, impostaStatoArea, eliminaArea, areaVuota,
  type AreaRiga,
} from '../lib/admin/aree';
import type { AreaInterna } from '../lib/types';

export default function Aree() {
  const [righe, setRighe] = useState<AreaRiga[]>([]);
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [edit, setEdit] = useState<AreaInterna | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function carica() {
    setStato('loading');
    caricaAree().then((r) => { setRighe(r); setStato('ok'); }).catch(() => setStato('errore'));
  }
  useEffect(carica, []);

  async function salva() {
    if (!edit) return;
    setBusy(true); setMsg(null);
    try { await salvaArea(edit); setEdit(null); carica(); }
    catch (e: any) { setMsg(e?.message ?? 'Salvataggio non riuscito.'); }
    finally { setBusy(false); }
  }
  async function toggle(id: string, attiva: boolean) {
    setBusy(true); setMsg(null);
    try { await impostaStatoArea(id, attiva); carica(); }
    catch (e: any) { setMsg(e?.message ?? 'Operazione non riuscita.'); }
    finally { setBusy(false); }
  }
  async function rimuovi(id: string) {
    if (!confirm('Eliminare quest’area?')) return;
    setBusy(true); setMsg(null);
    try { await eliminaArea(id); carica(); }
    catch (e: any) { setMsg(e?.message ?? 'Eliminazione non riuscita.'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="bo-row" style={{ marginBottom: 14 }}>
        <div className="grow">
          <h2 className="bo-h">Aree interne</h2>
          <p className="bo-sub" style={{ margin: 0 }}>
            Funzioni del team (es. Formazione, Preventivi) a cui assegnare le cose da fare.
          </p>
        </div>
        {!edit && <button className="bo-btn" onClick={() => setEdit(areaVuota())}>+ Nuova area</button>}
      </div>

      {msg && <div className="bo-note">{msg}</div>}

      {edit && (
        <div className="bo-card" style={{ borderLeft: '3px solid var(--hi)' }}>
          <div className="bo-grid">
            <label className="bo-field">
              <span>Nome *</span>
              <input type="text" value={edit.nome} placeholder="es. Area Formazione"
                onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
            </label>
            <label className="bo-field" style={{ marginBottom: 0 }}>
              <span>Email (opzionale)</span>
              <input type="email" value={edit.email ?? ''}
                onChange={(e) => setEdit({ ...edit, email: e.target.value || null })} />
            </label>
          </div>
          <div className="bo-bar">
            <button className="bo-btn" onClick={() => void salva()} disabled={busy}>
              {busy ? 'Salvo…' : 'Salva area'}
            </button>
            <button className="bo-btn ghost" onClick={() => setEdit(null)} disabled={busy}>Annulla</button>
          </div>
        </div>
      )}

      {stato === 'loading' && <div className="bo-empty">Carico…</div>}
      {stato === 'errore' && <div className="bo-err">Errore nel caricamento delle aree.</div>}
      {stato === 'ok' && righe.length === 0 && !edit && (
        <div className="bo-empty">Nessuna area. Creane una con “Nuova area”.</div>
      )}

      {righe.map((r) => (
        <div key={r.area.id} className={`bo-card ${r.area.attiva ? '' : 'dim'}`}>
          <div className="bo-row">
            <div className="grow">
              <div className="bo-title">{r.area.nome}</div>
              <div className="bo-meta">
                {r.area.email && <span>{r.area.email}</span>}
                {r.azioni > 0 && <span>{r.azioni} cose da fare</span>}
                {!r.area.attiva && <span className="bo-pill archiviato">disattivata</span>}
              </div>
            </div>
            <button className="bo-btn ghost sm" onClick={() => setEdit(r.area)} disabled={busy}>Modifica</button>
          </div>
          <div className="bo-bar" style={{ marginTop: 10 }}>
            <button className="bo-btn ghost sm" onClick={() => void toggle(r.area.id, !r.area.attiva)} disabled={busy}>
              {r.area.attiva ? 'Disattiva' : 'Riattiva'}
            </button>
            <span className="bo-sp" />
            {r.azioni === 0 && (
              <button className="bo-btn danger sm" onClick={() => void rimuovi(r.area.id)} disabled={busy}>
                Elimina
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
