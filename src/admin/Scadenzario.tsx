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

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  caricaScadenzario, type RigaScadenzario, type CategoriaScadenza,
} from '../lib/admin/scadenzario';
import { aggiornaStatoAzioneAdmin, LABEL_STATO_AZIONE } from '../lib/admin/cosedafare';
import { sincronizzaScadenzarioCliente } from '../lib/admin/formazione';
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

// Niente 'conclusa'. Una scadenza formativa non si conclude a mano: o l'attestato
// c'e' (e allora la registri nell'organigramma, il requisito acquista
// formazione_id e la riga si aggiorna o sparisce da se'), o non c'e' (e allora
// marcarla conclusa la nasconde dal filtro "Da fare" mentre l'organigramma
// continua a dire che la persona non e' formata -- e il campo `stato` non e' nel
// payload dell'upsert, quindi la bugia sopravvive a ogni sincronizzazione).
// 'in_corso' resta: e' tracciamento legittimo (corso prenotato o in erogazione).
const STATI: AzioneStato[] = ['aperta', 'in_corso'];

// `onApriOrganigramma`: una scadenza formativa non si "chiude" da qui. Si chiude
// registrando l'attestato, che e' un fatto e vive nell'organigramma; fatto quello,
// la riga si aggiorna o sparisce da se'. Questo pulsante ti porta li'. Dove il
// riquadro Organigramma non esiste (tab di back-office, tutti i clienti) la prop
// non arriva e il pulsante non compare: meglio assente che finto.
export default function Scadenzario(
  { clienteId, onApriOrganigramma }: { clienteId?: string; onApriOrganigramma?: () => void },
) {
  const [righe, setRighe] = useState<RigaScadenzario[]>([]);
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [fStato, setFStato] = useState<FStato>('aperte');
  const [fScad, setFScad] = useState<FScad>('tutte');
  const [q, setQ] = useState('');
  const [ordine, setOrdine] = useState<'scadenza' | 'discente'>('scadenza');

  const dentroScheda = clienteId != null;

  const syncFattaPer = useRef<string | null>(null);

  // Lo scadenzario di un cliente si allinea DA SE'. Prima dipendeva dall'aver
  // aperto il pannello Organigramma (l'unico che chiamava il backfill), quindi
  // mostrava lo stato dell'ultima visita a un altro tab. Ora la sincronizzazione
  // e' idempotente e sta qui: si entra e si vede il vero.
  // Senza clienteId (tab di back-office, tutti i clienti) non si sincronizza:
  // vorrebbe dire valutare l'organigramma di ogni cliente a ogni apertura.
  function carica() {
    setStato('loading');
    const pronta = clienteId && syncFattaPer.current !== clienteId
      ? (syncFattaPer.current = clienteId,
         sincronizzaScadenzarioCliente(clienteId).catch((e) => {
           console.error('sync scadenzario:', e);
         }))
      : Promise.resolve();
    pronta
      .then(() => caricaScadenzario(clienteId))
      .then((r) => { setRighe(r); setStato('ok'); })
      .catch(() => setStato('errore'));
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
      // "Scadute" e "Prossime" devono contenere il dovuto SUBITO: non ha una
      // data, ma e' il piu' in ritardo di tutti. Escluderlo lo renderebbe
      // invisibile proprio nei due filtri che si usano per lavorare.
      if (fScad === 'scadute' && !r.scaduta && !r.subito) return false;
      if (fScad === 'prossime' && !r.subito && !(r.data && r.data >= o && r.data <= lim)) return false;
      if (ago) {
        const blob = [r.descrizione, r.cliente_nome, r.persona_nome, r.corso_nome, r.sede_nome]
          .filter(Boolean).join(' ').toLowerCase();
        if (!blob.includes(ago)) return false;
      }
      return true;
    }).sort((x, y) => {
      // Il dovuto SUBITO viene prima di qualunque data: non e' "senza scadenza",
      // e' scaduto da sempre. Ordinandolo come null finiva in fondo alla lista,
      // dietro anche alle scadenze del 2030 — cioe' la mancanza piu' grave era
      // l'ultima che si leggeva. Fra loro le righe SUBITO restano ordinate per
      // discente dal criterio piu' sotto.
      const dx = x.subito ? '' : x.data ?? '9999-99-99';
      const dy = y.subito ? '' : y.data ?? '9999-99-99';
      // I discenti sono gia' "COGNOME Nome" (caricaAzioniAdmin li compone cosi'),
      // quindi l'ordine alfabetico e' quello per cognome. `sensitivity: base`
      // perche' dal gestionale i nomi arrivano in maiuscolo e con accenti.
      const nx = x.persona_nome ?? '￿';
      const ny = y.persona_nome ?? '￿';
      const perNome = nx.localeCompare(ny, 'it', { sensitivity: 'base' });
      // Di default lo scadenzario e' cronologico - e' il suo mestiere: dice cosa
      // scade prima. A parita' di data ordina per discente, cosi' le righe dello
      // stesso giorno non escono in ordine arbitrario. Con "Discente" i due
      // criteri si scambiano: si legge per persona, e per ciascuna in ordine di
      // scadenza.
      if (ordine === 'discente') return perNome !== 0 ? perNome : (dx < dy ? -1 : dx > dy ? 1 : 0);
      return dx < dy ? -1 : dx > dy ? 1 : perNome;
    });
  }, [righe, fStato, fScad, q, ordine]);

  // Il dovuto SUBITO conta come in ritardo: non ha una data da superare, ma e'
  // dovuto da prima di qualunque riga scaduta. Lasciarlo fuori dal contatore
  // avrebbe detto "0 scadute" con dei lavoratori senza formazione alcuna.
  const scadute = useMemo(() => righe.filter((r) => r.scaduta || r.subito).length, [righe]);

  // Riga di formazione: discente · corso · ore · scadenza · stato editabile.
  function RigaFormazione({ r }: { r: RigaScadenzario }) {
    const base = r.corso_nome ?? r.descrizione
      .replace(/^Rinnovo formazione - /, '')
      .replace(/^Rinnovo credito\/esonero - /, '')
      .replace(/^Prima formazione - /, '')
      .replace(/^Formazione da erogare - /, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
    // Cio' che e' dovuto alla scadenza e' l'AGGIORNAMENTO, non il corso iniziale:
    // il catalogo non tiene un corso a parte per il rinnovo (stessa riga, con
    // `ore_aggiornamento` e `aggiornamento_mesi`), quindi il nome va qualificato
    // qui. Le ore nella colonna accanto sono gia' quelle dell'aggiornamento: con
    // il solo nome del corso iniziale sembravano sbagliate.
    const corso = r.aggiornamento && base ? 'Aggiornamento — ' + base : base;
    // Righe gia' concluse da prima di questa regola: l'opzione va comunque
    // mostrata, altrimenti la select renderizza un valore che non esiste fra le
    // sue opzioni e appare vuota. Si puo' solo riaprirle, non concluderne di nuove.
    const opzioni: AzioneStato[] = r.kind === 'azione' && r.azione.stato === 'conclusa'
      ? [...STATI, 'conclusa'] : STATI;
    const statoCell = r.kind === 'azione' ? (
      <select value={r.azione.stato} disabled={busy === r.id}
        onChange={(e) => void cambiaStato(r.id, e.target.value as AzioneStato)}>
        {opzioni.map((s) => <option key={s} value={s}>{LABEL_STATO_AZIONE[s]}</option>)}
      </select>
    ) : <span className="bo-sub">—</span>;
    return (
      <tr className={'sc-tr' + (r.conclusa ? ' dim' : '') + (r.scaduta || r.subito ? ' scad' : '')}>
        <td className="sc-disc">
          <div className="sc-d">{r.persona_nome ?? '—'}</div>
          {!dentroScheda && r.cliente_nome && <div className="sc-sub"><span>{r.cliente_nome}</span></div>}
        </td>
        <td className="sc-corso">{corso}</td>
        {/* Ore ignote perche' manca un dato che le determina: si dichiara, non si
            stampa il minimo. Il testo dice anche dove si rimedia. */}
        <td className="sc-ore">
          {r.ore != null
            ? r.ore + 'h'
            : r.ore_nota
              ? <span className="sc-daconf" title={r.ore_nota}>{r.ore_nota}</span>
              : '—'}
        </td>
        {/* Nessuna data da mostrare, ma non e' un vuoto: il corso non e' mai
            stato svolto e va erogato adesso. "—" si leggeva come "non scade". */}
        <td className={'sc-scad' + (r.scaduta || r.subito ? ' warn' : '')}>
          {r.subito
            ? <span className="sc-subito" title="Formazione mai svolta: non c’e’ una scadenza da rispettare, e’ gia’ dovuta.">SUBITO</span>
            : <>{r.scaduta ? 'Scaduta ' : ''}{fmt(r.data)}</>}
        </td>
        <td className="sc-stato">{statoCell}</td>
        <td className="sc-act">
          {onApriOrganigramma && (
            <button className="bo-btn ghost sm" onClick={onApriOrganigramma}
              title={'Registra l\u2019attestato di ' + (r.persona_nome ?? 'questa persona')
                     + ' nell\u2019organigramma: la scadenza si aggiorna da se\u2019.'}>&#8599;</button>
          )}
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
        .sc-ore{width:11%;white-space:nowrap;font-weight:700;color:#3a3d43}
        .sc-daconf{display:inline-block;white-space:normal;font-size:11px;font-weight:700;line-height:1.25;color:#8a6212}
        .sc-scad{width:16%;white-space:nowrap;color:var(--ink-soft,#5c5f66)}
        .sc-scad.warn{color:var(--no,#d24028);font-weight:700}
        /* Non e' una data: si distingue anche dalle date scadute, che sono
           rosse ma leggibili come giorno. */
        .sc-subito{display:inline-block;padding:1px 7px;border-radius:999px;background:var(--no,#d24028);color:#fff;font-size:11px;font-weight:800;letter-spacing:.04em}
        .sc-stato{width:14%}
        .sc-stato select{width:100%;font-size:12px;padding:4px 6px}
        .sc-act{width:10%;text-align:center;white-space:nowrap}
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
        <label className="bo-field" style={{ margin: 0, minWidth: 150 }}>
          <span>Ordina per</span>
          <select value={ordine} onChange={(e) => setOrdine(e.target.value as 'scadenza' | 'discente')}>
            <option value="scadenza">Scadenza</option>
            <option value="discente">Discente (A-Z)</option>
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
