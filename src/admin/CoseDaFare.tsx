// Back-office · "Cose da fare" / scadenzario. Vista d'insieme di tutte le azioni
// (formative, correttive, sopralluoghi pianificati), ANNIDIATA nelle 4 voci
// della tassonomia (Formazione · Documenti · Autorizzazioni · Cose da fare),
// ciascuna in un blocco col proprio colore e titolo. Filtri per stato,
// destinatario e scadenza, evidenza delle scadute, cambio stato. Online-first.
//
// Riuso: con `clienteId` la stessa vista diventa lo SCADENZARIO della scheda
// cliente (tab Anagrafiche), filtrato sul cliente d'origine.

import { useEffect, useMemo, useState } from 'react';
import {
  caricaCoseDaFare, aggiornaStatoAzioneAdmin,
  LABEL_STATO_AZIONE, LABEL_RIGA,
  type CosaDaFareAdmin, type DestinatarioTipo, type RigaTipo,
} from '../lib/admin/cosedafare';
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
type FDest = 'tutti' | DestinatarioTipo;

// Tassonomia lato cliente del feed unico. Oggi hanno dati solo 'formazione'
// (Ramo A) e 'cosedafare' (correttive + sopralluoghi, Ramo B). 'documenti' e
// 'autorizzazioni' sono i rami Edificio/Lavorazioni della mappa dei flussi:
// previsti ma non ancora modellati, quindi il blocco esiste ma resta vuoto
// finche' quel ramo non produce righe (nessuna tabella speculativa).
type Categoria = 'formazione' | 'documenti' | 'autorizzazioni' | 'cosedafare';
const CATEGORIA_DI: Record<RigaTipo, Categoria> = {
  formazione: 'formazione',
  correttiva: 'cosedafare',
  sopralluogo: 'cosedafare',
};

// Blocchi nell'ordine di visualizzazione, con il proprio colore identificativo.
const CATEGORIE: { key: Categoria; titolo: string; bg: string; bordo: string; ink: string }[] = [
  { key: 'formazione', titolo: 'Formazione', bg: '#e7f3ea', bordo: '#bfe0c8', ink: '#1f6b3a' },
  { key: 'documenti', titolo: 'Documenti', bg: '#e6eefb', bordo: '#c4d6f2', ink: '#274a86' },
  { key: 'autorizzazioni', titolo: 'Autorizzazioni', bg: '#fbf1dd', bordo: '#ecd9ad', ink: '#8a6212' },
  { key: 'cosedafare', titolo: 'Cose da fare', bg: '#f1eee9', bordo: '#ddd5c7', ink: '#4a4a4a' },
];

const STATI: AzioneStato[] = ['aperta', 'in_corso', 'conclusa'];

export default function CoseDaFare({ clienteId }: { clienteId?: string } = {}) {
  const [righe, setRighe] = useState<CosaDaFareAdmin[]>([]);
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [fStato, setFStato] = useState<FStato>('aperte');
  const [fScad, setFScad] = useState<FScad>('tutte');
  const [fDest, setFDest] = useState<FDest>('tutti');
  const [q, setQ] = useState('');

  const dentroScheda = clienteId != null; // usato come scadenzario nella scheda cliente

  function carica() {
    setStato('loading');
    caricaCoseDaFare(clienteId).then((r) => { setRighe(r); setStato('ok'); }).catch(() => setStato('errore'));
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
      if (fDest !== 'tutti' && r.destinatario_tipo !== fDest) return false;
      if (fScad === 'scadute' && !r.scaduta) return false;
      if (fScad === 'prossime' && !(r.data && r.data >= o && r.data <= lim)) return false;
      if (ago) {
        const blob = [r.descrizione, r.cliente_nome, r.destinatario_nome, r.origine_voce, r.sopralluogo_label]
          .filter(Boolean).join(' ').toLowerCase();
        if (!blob.includes(ago)) return false;
      }
      return true;
    }).sort((x, y) => {
      const dx = x.data ?? '9999-99-99';
      const dy = y.data ?? '9999-99-99';
      return dx < dy ? -1 : dx > dy ? 1 : 0;
    });
  }, [righe, fStato, fScad, fDest, q]);

  const scadute = useMemo(() => righe.filter((r) => r.scaduta).length, [righe]);

  const destLabel = (t: DestinatarioTipo) =>
    t === 'cliente' ? 'Cliente' : t === 'area' ? 'Area' : 'Tecnico';

  // Rimuove i prefissi tecnici e il suffisso persona dalla descrizione, come fallback
  // quando i campi strutturati (persona_nome/corso_nome) non sono disponibili.
  function corsoDaDescrizione(desc: string): string {
    return desc
      .replace(/^Rinnovo formazione - /, '')
      .replace(/^Rinnovo credito\/esonero - /, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
  }

  function Riga({ r, formazione }: { r: CosaDaFareAdmin; formazione: boolean }) {
    const scaduta = r.scaduta;
    const statoCell = r.kind === 'azione' ? (
      <select value={r.azione.stato} disabled={busy === r.id}
        onChange={(e) => void cambiaStato(r.id, e.target.value as AzioneStato)}>
        {STATI.map((s) => <option key={s} value={s}>{LABEL_STATO_AZIONE[s]}</option>)}
      </select>
    ) : <span className="bo-sub">—</span>;
    const actCell = r.kind === 'azione' && r.destinatario_tipo !== 'cliente' && !r.conclusa ? (
      <button className="bo-btn ghost sm" disabled={busy === r.id}
        onClick={() => void avvisa(r.id)}
        title="Invia un'email di avviso al destinatario interno">✉</button>
    ) : null;
    const scadCell = (
      <td className={'cdf-scad' + (scaduta ? ' warn' : '')}>
        {scaduta ? 'Scaduta ' : (r.kind === 'sopralluogo' ? 'Pianif. ' : '')}{fmt(r.data)}
      </td>
    );

    if (formazione) {
      const corso = r.corso_nome ?? corsoDaDescrizione(r.descrizione);
      return (
        <tr className={'cdf-tr' + (r.conclusa ? ' dim' : '') + (scaduta ? ' scad' : '')}>
          <td className="cdf-disc"><div className="cdf-d">{r.persona_nome ?? '—'}</div></td>
          <td className="cdf-corso">{corso}</td>
          <td className="cdf-ore">{r.ore != null ? r.ore + 'h' : '—'}</td>
          {scadCell}
          <td className="cdf-stato">{statoCell}</td>
          <td className="cdf-act">{actCell}</td>
        </tr>
      );
    }

    return (
      <tr className={'cdf-tr' + (r.conclusa ? ' dim' : '') + (scaduta ? ' scad' : '')}>
        <td className="cdf-desc">
          <div className="cdf-d">{r.descrizione}</div>
          <div className="cdf-sub">
            {!dentroScheda && r.cliente_nome && <span>{r.cliente_nome}</span>}
            <span>{LABEL_RIGA[r.riga_tipo]}</span>
            {r.kind === 'azione' && r.azione.tipo === 'scadenza_ricorrente' && r.azione.periodicita_mesi != null &&
              <span>ogni {r.azione.periodicita_mesi} mesi</span>}
            {r.sopralluogo_label && <span>{r.sopralluogo_label}</span>}
            {r.origine_voce && <span>da: {r.origine_voce}</span>}
          </div>
        </td>
        <td className="cdf-dest">
          <span className={`bo-pill ${r.destinatario_tipo === 'area' ? 'usato' : 'archiviato'}`}>
            {destLabel(r.destinatario_tipo)}{r.destinatario_nome ? `: ${r.destinatario_nome}` : ''}
          </span>
        </td>
        {scadCell}
        <td className="cdf-stato">{statoCell}</td>
        <td className="cdf-act">{actCell}</td>
      </tr>
    );
  }

  return (
    <>
      <style>{`
        .cdf-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
        .cdf-tbl thead th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft,#5b5f66);font-weight:800;padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08)}
        .cdf-tr td{padding:7px 8px;border-bottom:1px solid rgba(0,0,0,.06);vertical-align:middle}
        .cdf-tr:last-child td{border-bottom:none}
        .cdf-tr.dim{opacity:.5}
        .cdf-tr.scad td.cdf-desc{box-shadow:inset 3px 0 0 var(--no,#d8442f)}
        .cdf-desc{width:44%}
        .cdf-disc{width:26%;font-weight:600}
        .cdf-corso{width:34%;line-height:1.25}
        .cdf-d{font-weight:600;line-height:1.25}
        .cdf-sub{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px;font-size:11px;color:var(--ink-soft,#5b5f66)}
        .cdf-ore{width:9%;white-space:nowrap;font-weight:700;color:#3a3d43}
        .cdf-dest{width:19%}
        .cdf-scad{width:14%;white-space:nowrap;color:var(--ink-soft,#5b5f66)}
        .cdf-scad.warn{color:var(--no,#d8442f);font-weight:700}
        .cdf-stato{width:12%}
        .cdf-stato select{width:100%;font-size:12px;padding:4px 6px}
        .cdf-act{width:6%;text-align:center}
        .cdf-act .bo-btn{padding:4px 8px;min-width:0}
      `}</style>
      {!dentroScheda && (
        <div className="bo-row" style={{ marginBottom: 6 }}>
          <div className="grow">
            <h2 className="bo-h">Cose da fare</h2>
            <p className="bo-sub" style={{ margin: 0 }}>
              Scadenze formative, documenti, autorizzazioni e attività dal campo, in un unico elenco per categoria.
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
        {!dentroScheda && (
          <label className="bo-field" style={{ margin: 0, minWidth: 150 }}>
            <span>Destinatario</span>
            <select value={fDest} onChange={(e) => setFDest(e.target.value as FDest)}>
              <option value="tutti">Tutti</option>
              <option value="cliente">Cliente</option>
              <option value="tecnico">Tecnico</option>
              <option value="area">Area</option>
            </select>
          </label>
        )}
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
          <input type="text" placeholder="Descrizione, destinatario…"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {msg && <div className="bo-err">{msg}</div>}
      {stato === 'loading' && <div className="bo-empty">Carico…</div>}
      {stato === 'errore' && <div className="bo-err">Errore nel caricamento delle cose da fare.</div>}

      {stato === 'ok' && CATEGORIE.map((cat) => {
        const gruppo = visibili.filter((r) => CATEGORIA_DI[r.riga_tipo] === cat.key);
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
              <table className="cdf-tbl">
                <thead>
                  {cat.key === 'formazione' ? (
                    <tr>
                      <th>Dati discente</th>
                      <th>Corso aggiornamento</th>
                      <th>Ore corso</th>
                      <th>Scadenza</th>
                      <th>Stato</th>
                      <th></th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Descrizione</th>
                      <th>Destinatario</th>
                      <th>Scadenza</th>
                      <th>Stato</th>
                      <th></th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {gruppo.map((r) => <Riga key={r.id} r={r} formazione={cat.key === 'formazione'} />)}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </>
  );
}
