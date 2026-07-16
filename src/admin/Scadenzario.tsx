// Back-office · SCADENZARIO. Le scadenze della ditta in quattro blocchi:
// Formazione · Documenti · Autorizzazioni · Sorveglianza sanitaria.
//
// Qui non si crea nulla a mano: ogni riga discende da un fatto registrato
// (un attestato, un DVR, un CPI, una visita). Si consulta, si filtra, e sulle
// scadenze formative si cambia stato. Cio' che nasce dal campo sta in
// "Cose da fare", che e' un'altra cosa e un altro tab.
//
// Riuso: con `clienteId` la stessa vista diventa lo scadenzario della scheda
// cliente (tab Anagrafiche), filtrato sul cliente. Online-first.

import { useEffect, useMemo, useState } from 'react';
import {
  caricaScadenzario, type RigaScadenzario, type CategoriaScadenza,
} from '../lib/admin/scadenzario';
import { aggiornaStatoAzioneAdmin, LABEL_STATO_AZIONE } from '../lib/admin/cosedafare';
import type { AzioneStato } from '../lib/types';
import { notificaAzione } from '../lib/notifiche';

const oggiISO = () => new Date().toISOString().slice(0, 10);
const fra30 = () => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); };
const fmt = (d: string | null) => {
  if (!d) return '—';
  const [y, m, g] = d.split('-'); return `${g}/${m}/${y}`;
};

type FStato = 'aperte' | 'concluse' | 'tutte';
type FScad = 'tutte' | 'scadute' | 'prossime';

// Blocchi nell'ordine di visualizzazione, ciascuno col proprio colore.
const CATEGORIE: { key: CategoriaScadenza; titolo: string; bg: string; bordo: string; ink: string }[] = [
  { key: 'formazione', titolo: 'Formazione', bg: '#e7f3ea', bordo: '#bfe0c8', ink: '#1f6b3a' },
  { key: 'documenti', titolo: 'Documenti', bg: '#e6eefb', bordo: '#c4d6f2', ink: '#274a86' },
  { key: 'autorizzazioni', titolo: 'Autorizzazioni', bg: '#fbf1dd', bordo: '#ecd9ad', ink: '#8a6212' },
  { key: 'sorveglianza', titolo: 'Sorveglianza sanitaria', bg: '#f4eaf3', bordo: '#e0c8dd', ink: '#7a3a70' },
];

const STATI: AzioneStato[] = ['aperta', 'in_corso', 'conclusa'];

export default function Scadenzario({ clienteId }: { clienteId?: string }) {
  const [righe, setRighe] = useState<RigaScadenzario[]>([]);
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [fStato, setFStato] = useState<FStato>('aperte');
  const [fScad, setFScad] = useState<FScad>('tutte');
  const [q, setQ] = useState('');

  const dentroScheda = clienteId != null;

  function carica() {
    setStato('loading');
    caricaScadenzario(clienteId).then((r) => { setRighe(r); setStato('ok'); }).catch(() => setStato('errore'));
  }
  useEffect(carica, [clienteId]);

  async function cambiaStato(id: string, s: AzioneStato) {
    setBusy(id); setMsg(null);
    try {
      await aggiornaStatoAzioneAdmin(id, s);
      setRighe((rs) => rs.map((r) =>
        r.id === id && r.kind === 'azione'
          ? {
              ...r,
              conclusa: s === 'conclusa',
              scaduta: !!(r.data && r.data < oggiISO() && s !== 'conclusa'),
              azione: { ...r.azione, stato: s },
            }
          : r));
    } catch (e: any) {
      setMsg(e?.message ?? 'Aggiornamento non riuscito.');
    } finally { setBusy(null); }
  }

  async function avvisa(id: string) {
    setBusy(id); setMsg(null);
    try {
      const r = await notificaAzione(id, true);
      setMsg(r.sent ? 'Email inviata al destinatario.' : `Email non inviata: ${r.reason ?? 'motivo sconosciuto'}.`);
    } catch (e: any) {
      setMsg(e?.message ?? 'Invio non riuscito.');
    } finally { setBusy(null); }
  }

  const visibili = useMemo(() => {
    const ago = q.trim().toLowerCase();
    const o = oggiISO(); const lim = fra30();
    return righe.filter((r) => {
      if (fStato === 'aperte' && r.conclusa) return false;
      if (fStato === 'concluse' && !r.conclusa) return false;
      if (fScad === 'scadute' && !r.scaduta) return false;
      if (fScad === 'prossime' && !(r.data && r.data >= o && r.data <= lim)) return false;
      if (ago) {
        const blob = [r.descrizione, r.cliente_nome, r.persona_nome, r.corso_nome, r.sede_nome]
          .filter(Boolean).join(' ').toLowerCase();
        if (!blob.includes(ago)) return false;
      }
      return true;
    }).sort((x, y) => {
      const dx = x.data ?? '9999-99-99';
      const dy = y.data ?? '9999-99-99';
      return dx < dy ? -1 : dx > dy ? 1 : 0;
    });
  }, [righe, fStato, fScad, q]);

  const scadute = useMemo(() => righe.filter((r) => r.scaduta).length, [righe]);

  // Riga di formazione: discente · corso · ore · scadenza · stato editabile.
  function RigaFormazione({ r }: { r: RigaScadenzario }) {
    const corso = r.corso_nome ?? r.descrizione
      .replace(/^Rinnovo formazione - /, '')
      .replace(/^Rinnovo credito\/esonero - /, '')
      .replace(/^Prima formazione - /, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
    const statoCell = r.kind === 'azione' ? (
      <select value={r.azione.stato} disabled={busy === r.id}
        onChange={(e) => void cambiaStato(r.id, e.target.value as AzioneStato)}>
        {STATI.map((s) => <option key={s} value={s}>{LABEL_STATO_AZIONE[s]}</option>)}
      </select>
    ) : <span className="bo-sub">—</span>;
    return (
      <tr className={'sc-tr' + (r.conclusa ? ' dim' : '') + (r.scaduta ? ' scad' : '')}>
        <td className="sc-disc">
          <div className="sc-d">{r.persona_nome ?? '—'}</div>
          {!dentroScheda && r.cliente_nome && <div className="sc-sub"><span>{r.cliente_nome}</span></div>}
        </td>
        <td className="sc-corso">{corso}</td>
        <td className="sc-ore">{r.ore != null ? r.ore + 'h' : '—'}</td>
        <td className={'sc-scad' + (r.scaduta ? ' warn' : '')}>
          {r.scaduta ? 'Scaduta ' : ''}{fmt(r.data)}
        </td>
        <td className="sc-stato">{statoCell}</td>
        <td className="sc-act">
          {r.kind === 'azione' && !r.conclusa && (
            <button className="bo-btn ghost sm" disabled={busy === r.id}
              onClick={() => void avvisa(r.id)}
              title="Invia un'email di avviso al destinatario interno">✉</button>
          )}
        </td>
      </tr>
    );
  }

  // Riga di adempimento: nessuno stato editabile. Un CPI non si "conclude":
  // si rinnova, e il rinnovo e' una data nuova sul fatto, non un flag qui.
  function RigaAdempimento({ r }: { r: RigaScadenzario }) {
    const rif = r.categoria === 'sorveglianza' ? r.persona_nome : r.sede_nome;
    return (
      <tr className={'sc-tr' + (r.scaduta ? ' scad' : '')}>
        <td className="sc-desc">
          <div className="sc-d">{r.corso_nome}</div>
          <div className="sc-sub">
            {!dentroScheda && r.cliente_nome && <span>{r.cliente_nome}</span>}
            {rif && <span>{rif}</span>}
            {r.periodicita_mesi != null && <span>ogni {r.periodicita_mesi} mesi</span>}
            {r.descrizione !== r.corso_nome && <span>{r.descrizione}</span>}
          </div>
        </td>
        <td className={'sc-scad' + (r.scaduta ? ' warn' : '')}>
          {r.scaduta ? 'Scaduto ' : ''}{fmt(r.data)}
        </td>
        <td className="sc-stato">
          <span className={'bo-pill ' + (r.scaduta ? 'warn' : 'archiviato')}>
            {r.scaduta ? 'Scaduto' : r.data ? 'In corso' : 'Senza data'}
          </span>
        </td>
      </tr>
    );
  }

  return (
    <>
      <style>{`
        .sc-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
        .sc-tbl thead th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft,#5c5f66);font-weight:800;padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08)}
        .sc-tr td{padding:7px 8px;border-bottom:1px solid rgba(0,0,0,.06);vertical-align:middle}
        .sc-tr:last-child td{border-bottom:none}
        .sc-tr.dim{opacity:.5}
        .sc-tr.scad td:first-child{box-shadow:inset 3px 0 0 var(--no,#d24028)}
        .sc-desc{width:62%}
        .sc-disc{width:26%;font-weight:600}
        .sc-corso{width:34%;line-height:1.25}
        .sc-d{font-weight:600;line-height:1.25}
        .sc-sub{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px;font-size:11px;color:var(--ink-soft,#5c5f66)}
        .sc-ore{width:9%;white-space:nowrap;font-weight:700;color:#3a3d43}
        .sc-scad{width:16%;white-space:nowrap;color:var(--ink-soft,#5c5f66)}
        .sc-scad.warn{color:var(--no,#d24028);font-weight:700}
        .sc-stato{width:14%}
        .sc-stato select{width:100%;font-size:12px;padding:4px 6px}
        .sc-act{width:6%;text-align:center}
        .sc-act .bo-btn{padding:4px 8px;min-width:0}
      `}</style>

      {!dentroScheda && (
        <div className="bo-row" style={{ marginBottom: 6 }}>
          <div className="grow">
            <h2 className="bo-h">Scadenzario</h2>
            <p className="bo-sub" style={{ margin: 0 }}>
              Le scadenze della ditta per categoria. Ogni riga discende da un fatto
              registrato: si rinnova il fatto, la scadenza si ricalcola.
            </p>
          </div>
          {scadute > 0 && <span className="bo-pill warn">{scadute} scadute</span>}
        </div>
      )}

      <div className="bo-row" style={{ gap: 16, flexWrap: 'wrap', margin: dentroScheda ? '0 0 4px' : '12px 0 4px' }}>
        <label className="bo-field" style={{ margin: 0, minWidth: 150 }}>
          <span>Stato</span>
          <select value={fStato} onChange={(e) => setFStato(e.target.value as FStato)}>
            <option value="aperte">Da fare (aperte/in corso)</option>
            <option value="concluse">Concluse</option>
            <option value="tutte">Tutte</option>
          </select>
        </label>
        <label className="bo-field" style={{ margin: 0, minWidth: 150 }}>
          <span>Scadenza</span>
          <select value={fScad} onChange={(e) => setFScad(e.target.value as FScad)}>
            <option value="tutte">Tutte</option>
            <option value="scadute">Scadute</option>
            <option value="prossime">Prossimi 30 giorni</option>
          </select>
        </label>
        <label className="bo-field" style={{ margin: 0, flex: 1, minWidth: 200 }}>
          <span>Cerca</span>
          <input type="text" placeholder="Discente, corso, tipo, sede…"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {msg && <div className="bo-err">{msg}</div>}
      {stato === 'loading' && <div className="bo-empty">Carico…</div>}
      {stato === 'errore' && <div className="bo-err">Errore nel caricamento dello scadenzario.</div>}

      {stato === 'ok' && CATEGORIE.map((cat) => {
        const gruppo = visibili.filter((r) => r.categoria === cat.key);
        const formativo = cat.key === 'formazione';
        return (
          <div key={cat.key} style={{
            background: cat.bg, border: `1px solid ${cat.bordo}`, borderRadius: 14,
            padding: '12px 14px 14px', marginTop: 12,
          }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: gruppo.length ? 10 : 2,
            }}>
              <span style={{ fontWeight: 800, fontSize: 14.5, color: cat.ink }}>{cat.titolo}</span>
              <span style={{ fontSize: 12, color: cat.ink, opacity: .8 }}>
                {gruppo.length || 'nessuna voce'}
              </span>
            </div>
            {gruppo.length > 0 && (
              <table className="sc-tbl">
                <thead>
                  {formativo ? (
                    <tr>
                      <th>Dati discente</th>
                      <th>Corso</th>
                      <th>Ore corso</th>
                      <th>Scadenza</th>
                      <th>Stato</th>
                      <th></th>
                    </tr>
                  ) : (
                    <tr>
                      <th>{cat.key === 'sorveglianza' ? 'Visita' : 'Adempimento'}</th>
                      <th>Scadenza</th>
                      <th>Stato</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {gruppo.map((r) => formativo
                    ? <RigaFormazione key={r.id} r={r} />
                    : <RigaAdempimento key={r.id} r={r} />)}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </>
  );
}
