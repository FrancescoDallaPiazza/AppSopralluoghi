// Back-office - tab "Import Werp" (Fase 0).
// Quattro selettori file -> Analizza (dry-run, non scrive) -> Applica.
// Sotto, le liste Da rivedere / Da chiarire e gli esclusi, per il controllo
// a occhio prima e dopo la scrittura (la rete di sicurezza del vecchio Excel).

import { useState } from 'react';
import { leggiDaXlsx, analizzaWerp, applicaWerp, type EsitoImport } from '../lib/admin/werpImport';

type Files = { contratti: File | null; documenti: File | null; attivita: File | null; anagrafiche: File | null };
const VUOTO: Files = { contratti: null, documenti: null, attivita: null, anagrafiche: null };

const SELETTORI: { key: keyof Files; label: string }[] = [
  { key: 'contratti', label: 'Contratti' },
  { key: 'documenti', label: 'Documenti' },
  { key: 'attivita', label: 'Attivita' },
  { key: 'anagrafiche', label: 'Anagrafiche' },
];

export default function ImportWerp() {
  const [files, setFiles] = useState<Files>(VUOTO);
  const [esito, setEsito] = useState<EsitoImport | null>(null);
  const [busy, setBusy] = useState<'' | 'analizza' | 'applica'>('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pronto = files.contratti && files.documenti && files.attivita && files.anagrafiche;

  async function analizza() {
    if (!pronto) return;
    setBusy('analizza'); setErr(null); setMsg(null); setEsito(null);
    try {
      const s = await leggiDaXlsx({
        contratti: files.contratti!, documenti: files.documenti!,
        attivita: files.attivita!, anagrafiche: files.anagrafiche!,
      });
      setEsito(await analizzaWerp(s));
    } catch (e: any) { setErr(e?.message ?? 'Errore in analisi.'); }
    finally { setBusy(''); }
  }

  async function applica() {
    if (!esito) return;
    setBusy('applica'); setErr(null); setMsg(null);
    try {
      const r = await applicaWerp(esito);
      setMsg(`Applicato: ${r.clienti} clienti, ${r.incarichi} incarichi, ${r.sopralluoghi} sopralluoghi, ` +
        `${r.scaduti} chiusi, ${r.daRivedere} da rivedere, ${r.daChiarire} da chiarire.`);
      setEsito(null); setFiles(VUOTO);
    } catch (e: any) { setErr(e?.message ?? 'Errore in applicazione.'); }
    finally { setBusy(''); }
  }

  return (
    <div>
      <h2 className="bo-h">Import Werp</h2>
      <p className="bo-sub">Carica i 4 export Excel di Werp, analizza in anteprima (non scrive nulla),
        poi applica. Il lavoro manuale non viene mai sovrascritto.</p>

      <div className="bo-card">
        <div className="bo-grid">
          {SELETTORI.map(({ key, label }) => (
            <label key={key} className="bo-field">
              <span>{label}{files[key] ? ' \u2713' : ''}</span>
              <input type="file" accept=".xlsx"
                onChange={(e) => setFiles((f) => ({ ...f, [key]: e.target.files?.[0] ?? null }))} />
            </label>
          ))}
        </div>
        <div className="bo-row" style={{ gap: 8, marginTop: 4 }}>
          <button className="bo-btn" disabled={!pronto || busy !== ''} onClick={() => void analizza()}>
            {busy === 'analizza' ? 'Analisi\u2026' : 'Analizza'}
          </button>
          <button className="bo-btn ghost" disabled={!esito || busy !== ''} onClick={() => void applica()}>
            {busy === 'applica' ? 'Applico\u2026' : 'Applica'}
          </button>
        </div>
        {err && <p className="bo-sub" style={{ color: 'var(--no)', marginTop: 10 }}>{err}</p>}
        {msg && <p className="bo-sub" style={{ color: 'var(--ok)', marginTop: 10 }}>{msg}</p>}
      </div>

      {esito && <Anteprima esito={esito} />}
    </div>
  );
}

function Riga({ n, testo }: { n: number; testo: string }) {
  return (
    <div className="bo-meta" style={{ justifyContent: 'space-between' }}>
      <span>{testo}</span><b>{n}</b>
    </div>
  );
}

function Anteprima({ esito }: { esito: EsitoImport }) {
  return (
    <>
      <div className="bo-card">
        <div className="bo-title" style={{ marginBottom: 8 }}>Anteprima (nulla e' stato scritto)</div>
        <Riga n={esito.clientiNuovi.length} testo="Clienti nuovi" />
        <Riga n={esito.clientiAggiornati.length} testo="Clienti arricchiti" />
        <Riga n={esito._piano.incarichi.length} testo="Incarichi nuovi" />
        <Riga n={esito.sopralluoghiGenerati} testo="Sopralluoghi da generare" />
        <Riga n={esito.contrattiScaduti.length} testo="Contratti scaduti/disdetti" />
        <Riga n={esito.daRivedere.length} testo="Da rivedere" />
        <Riga n={esito.daChiarire.length} testo="Da chiarire" />
        <Riga n={esito.esclusi.length} testo="Esclusi (fuori scope)" />
      </div>

      {esito.daRivedere.length > 0 && (
        <div className="bo-card">
          <div className="bo-title" style={{ marginBottom: 8 }}>Da rivedere</div>
          {esito.daRivedere.map((r, i) => (
            <div key={i} className="bo-meta">
              <b>{r.cliente}</b><span>{r.campo}: app <b>{r.valore_app}</b> / Werp <b>{r.valore_werp}</b></span>
            </div>
          ))}
        </div>
      )}

      {esito.daChiarire.length > 0 && (
        <div className="bo-card">
          <div className="bo-title" style={{ marginBottom: 8 }}>Da chiarire (numero a mano)</div>
          {esito.daChiarire.map((r, i) => (
            <div key={i} className="bo-meta">
              <b>{r.cliente}</b><span>{r.oggetto}</span><span>{r.periodo}</span>
            </div>
          ))}
        </div>
      )}

      {esito.esclusi.length > 0 && (
        <div className="bo-card dim">
          <div className="bo-title" style={{ marginBottom: 8 }}>Esclusi</div>
          {esito.esclusi.map((r, i) => (
            <div key={i} className="bo-meta">
              <b>{r.cliente}</b><span>{r.oggetto}</span><span>{r.motivo}</span>
            </div>
          ))}
        </div>
      )}

      {esito.log.length > 0 && (
        <div className="bo-card flat">
          <div className="bo-title" style={{ marginBottom: 8 }}>Log</div>
          {esito.log.map((l, i) => <div key={i} className="bo-meta"><span>{l}</span></div>)}
        </div>
      )}
    </>
  );
}
