// Back-office · "Cose da fare" / scadenzario. Vista d'insieme di tutte le azioni
// (correttive e scadenze ricorrenti) con filtri per stato, destinatario e
// scadenza, evidenza delle scadute, e cambio stato. Online-first.

import { useEffect, useMemo, useState } from 'react';
import {
  caricaCoseDaFare, aggiornaStatoAzioneAdmin,
  LABEL_STATO_AZIONE, LABEL_PRIORITA, LABEL_RIGA,
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
type FTipo = 'tutti' | RigaTipo;

const STATI: AzioneStato[] = ['aperta', 'in_corso', 'conclusa'];

export default function CoseDaFare() {
  const [righe, setRighe] = useState<CosaDaFareAdmin[]>([]);
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [fStato, setFStato] = useState<FStato>('aperte');
  const [fScad, setFScad] = useState<FScad>('tutte');
  const [fDest, setFDest] = useState<FDest>('tutti');
  const [fTipo, setFTipo] = useState<FTipo>('tutti');
  const [q, setQ] = useState('');

  function carica() {
    setStato('loading');
    caricaCoseDaFare().then((r) => { setRighe(r); setStato('ok'); }).catch(() => setStato('errore'));
  }
  useEffect(carica, []);

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
      if (fTipo !== 'tutti' && r.riga_tipo !== fTipo) return false;
      if (fScad === 'scadute' && !r.scaduta) return false;
      if (fScad === 'prossime' && !(r.data && r.data >= o && r.data <= lim)) return false;
      if (ago) {
        const blob = [r.descrizione, r.cliente_nome, r.destinatario_nome, r.origine_voce, r.sopralluogo_label]
          .filter(Boolean).join(' ').toLowerCase();
        if (!blob.includes(ago)) return false;
      }
      return true;
    }).sort((x, y) => {
      // scadenza crescente, nulli in fondo
      const dx = x.data ?? '9999-99-99';
      const dy = y.data ?? '9999-99-99';
      return dx < dy ? -1 : dx > dy ? 1 : 0;
    });
  }, [righe, fStato, fScad, fDest, fTipo, q]);

  const scadute = useMemo(() => righe.filter((r) => r.scaduta).length, [righe]);

  const destLabel = (t: DestinatarioTipo) =>
    t === 'cliente' ? 'Cliente' : t === 'area' ? 'Area' : 'Tecnico';

  return (
    <>
      <div className="bo-row" style={{ marginBottom: 6 }}>
        <div className="grow">
          <h2 className="bo-h">Cose da fare</h2>
          <p className="bo-sub" style={{ margin: 0 }}>
            Scadenze formative, azioni correttive e sopralluoghi pianificati, in un unico elenco.
          </p>
        </div>
        {scadute > 0 && <span className="bo-pill warn">{scadute} scadute</span>}
      </div>

      <div className="bo-row" style={{ gap: 16, flexWrap: 'wrap', margin: '12px 0 4px' }}>
        <label className="bo-field" style={{ margin: 0, minWidth: 150 }}>
          <span>Stato</span>
          <select value={fStato} onChange={(e) => setFStato(e.target.value as FStato)}>
            <option value="aperte">Da fare (aperte/in corso)</option>
            <option value="concluse">Concluse</option>
            <option value="tutte">Tutte</option>
          </select>
        </label>
        <label className="bo-field" style={{ margin: 0, minWidth: 150 }}>
          <span>Destinatario</span>
          <select value={fDest} onChange={(e) => setFDest(e.target.value as FDest)}>
            <option value="tutti">Tutti</option>
            <option value="cliente">Cliente</option>
            <option value="tecnico">Tecnico</option>
            <option value="area">Area</option>
          </select>
        </label>
        <label className="bo-field" style={{ margin: 0, minWidth: 150 }}>
          <span>Tipo</span>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value as FTipo)}>
            <option value="tutti">Tutti</option>
            <option value="formazione">Formazione</option>
            <option value="correttiva">Correttive</option>
            <option value="sopralluogo">Sopralluoghi</option>
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
          <input type="text" placeholder="Descrizione, cliente, destinatario…"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {msg && <div className="bo-err">{msg}</div>}
      {stato === 'loading' && <div className="bo-empty">Carico…</div>}
      {stato === 'errore' && <div className="bo-err">Errore nel caricamento delle cose da fare.</div>}
      {stato === 'ok' && visibili.length === 0 && (
        <div className="bo-empty">Nessuna cosa da fare con questi filtri.</div>
      )}

      {visibili.map((r) => {
        const scaduta = r.scaduta;
        return (
          <div key={r.id} className={`bo-card ${r.conclusa ? 'dim' : ''}`}
            style={scaduta ? { borderLeft: '3px solid var(--no)' } : undefined}>
            <div className="bo-row">
              <div className="grow">
                <div className="bo-title">{r.descrizione}</div>
                <div className="bo-meta">
                  {r.cliente_nome && <span>{r.cliente_nome}</span>}
                  <span className={`bo-pill ${r.destinatario_tipo === 'area' ? 'usato' : 'archiviato'}`}>
                    {destLabel(r.destinatario_tipo)}{r.destinatario_nome ? `: ${r.destinatario_nome}` : ''}
                  </span>
                  <span>{LABEL_RIGA[r.riga_tipo]}</span>
                  {r.kind === 'azione' && r.azione.tipo === 'scadenza_ricorrente' && r.azione.periodicita_mesi != null &&
                    <span>ogni {r.azione.periodicita_mesi} mesi</span>}
                  {r.kind === 'azione' && <span>priorità {LABEL_PRIORITA[r.azione.priorita]}</span>}
                </div>
                <div className="bo-meta" style={{ marginTop: 6 }}>
                  <span className={scaduta ? 'bo-pill warn' : ''}>
                    {scaduta ? 'Scaduta · ' : (r.kind === 'sopralluogo' ? 'Pianificata ' : 'Scadenza ')}{fmt(r.data)}
                  </span>
                  {r.sopralluogo_label && <span>{r.sopralluogo_label}</span>}
                  {r.origine_voce && <span>da: {r.origine_voce}</span>}
                </div>
              </div>
              {r.kind === 'azione' && (
                <label className="bo-field" style={{ margin: 0, minWidth: 140 }}>
                  <span>Stato</span>
                  <select value={r.azione.stato} disabled={busy === r.id}
                    onChange={(e) => void cambiaStato(r.id, e.target.value as AzioneStato)}>
                    {STATI.map((s) => <option key={s} value={s}>{LABEL_STATO_AZIONE[s]}</option>)}
                  </select>
                </label>
              )}
            </div>
            {r.kind === 'azione' && r.destinatario_tipo !== 'cliente' && !r.conclusa && (
              <div className="bo-bar" style={{ marginTop: 10 }}>
                <span className="bo-sp" />
                <button className="bo-btn ghost sm" disabled={busy === r.id}
                  onClick={() => void avvisa(r.id)}
                  title="Invia un'email di avviso al destinatario interno">
                  ✉ Avvisa via email
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
