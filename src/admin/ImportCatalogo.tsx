// Back-office - "Import catalogo" (Fase 1): pulizia e anteprima del catalogo
// corsi ASR dall'xlsx grezzo. Solo anteprima: il seeding di corso_catalogo
// (curato per codici) resta un passo SQL rivisto.

import { useState } from 'react';
import { leggiCatalogoXlsx, type RigaCatalogo } from '../lib/admin/catalogoImport';

export default function ImportCatalogo() {
  const [righe, setRighe] = useState<RigaCatalogo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function analizza(file: File | null) {
    if (!file) return;
    setBusy(true); setErr(null); setRighe(null);
    try { setRighe(await leggiCatalogoXlsx(file)); }
    catch (e: any) { setErr(e?.message ?? 'Errore in lettura.'); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <h2 className="bo-h">Import catalogo corsi (ASR)</h2>
      <p className="bo-sub">Pulizia e anteprima dell'xlsx grezzo (durata &rarr; ore, periodicita &rarr; mesi,
        figura a cascata). Il catalogo dell'app e' curato per codici: qui e' solo anteprima, il seeding
        resta un passo SQL rivisto.</p>

      <div className="bo-card">
        <label className="bo-field">
          <span>ASR26-TabellaCorsi.xlsx</span>
          <input type="file" accept=".xlsx" disabled={busy}
            onChange={(e) => void analizza(e.target.files?.[0] ?? null)} />
        </label>
        {busy && <p className="bo-sub">Lettura in corso&hellip;</p>}
        {err && <p className="bo-sub" style={{ color: 'var(--no)' }}>{err}</p>}
        {righe && <p className="bo-sub">{righe.length} corsi normalizzati.</p>}
      </div>

      {righe && (
        <div className="bo-card">
          {righe.map((r, i) => (
            <div key={i} className="bo-meta" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
              <b style={{ flex: '0 0 30%' }}>{r.figura || '\u2014'}</b>
              <span style={{ flex: 1 }}>{r.corso}{r.is_aggiornamento ? ' \u00b7 agg.' : ''}</span>
              <span>{r.ore != null ? `${r.ore}h` : '\u2014'}</span>
              <span>{r.periodicita_mesi != null ? `${r.periodicita_mesi} mesi` : '\u2014'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
