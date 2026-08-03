// Scheda cliente - sezione "Risorse Umane" (Anagrafiche.tsx).
//
// Anagrafica completa del personale del cliente: e' l'insieme SUPERIORE
// dell'organigramma sicurezza. Non tutte le persone ricoprono una figura
// (RSPP, preposto, addetto...): qui si censiscono tutti i lavoratori; nel tab
// Organigramma si assegnano le nomine solo a chi le ricopre. Le due viste
// leggono e scrivono la STESSA tabella `persona`, quindi non esistono doppioni.
//
// Import massivo: si carica un Excel/CSV (Cognome, Nome, Codice fiscale,
// Mansione, Reparto, Data assunzione), si vede l'anteprima (nuove / aggiornate
// per CF / scartate) e si applica. Il match con le persone gia' presenti e' sul
// codice fiscale; le righe senza nome vengono scartate e mostrate.

import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  caricaPersone, caricaRuoliPerPersona, salvaPersona, eliminaPersona, type Persona,
} from '../lib/admin/formazione';
import { newId } from '../lib/types';
import { valido as cfValido, pulisci as cfPulisci } from './codiceFiscale';
import { LibrettoPersona } from './Libretto';

type RischioPersona = Persona['livello_rischio'];

function personaVuota(clienteId: string): Persona {
  return {
    id: '', cliente_id: clienteId, nome: '', cognome: null, codice_fiscale: null,
    mansione: null, reparto: null, data_assunzione: null, data_cessazione: null,
    livello_rischio: null, attivo: true, note: null, formazione_pregressa: false,
  };
}

const svuota = (s: string): string | null => {
  const v = s.trim();
  return v === '' ? null : v;
};

// ============================ componente ============================

export function RisorseUmane({ clienteId, clienteNome, onCambia, onConteggio }: {
  clienteId: string;
  clienteNome?: string;
  onCambia?: () => void;
  onConteggio?: (n: number) => void;
}) {
  const [persone, setPersone] = useState<Persona[]>([]);
  const [fase, setFase] = useState<'carico' | 'pronto' | 'errore'>('carico');
  const [mostraInattivi, setMostraInattivi] = useState(false);
  const [agg, setAgg] = useState(false);
  const [importa, setImporta] = useState(false);
  const [q, setQ] = useState('');
  // Ruoli dell'organigramma per persona: etichetta in riga e filtro. Caricati a
  // parte e in modo non bloccante - se la lettura fallisce, l'anagrafica si vede
  // lo stesso, senza pill.
  const [ruoli, setRuoli] = useState<Map<string, string[]>>(new Map());
  const [ruolo, setRuolo] = useState('');   // '' = tutti | '-' = senza ruolo | nome figura
  // Libretto formativo aperto (id persona). Uno per volta: e' un dossier da
  // leggere, non una colonna della tabella.
  const [libretto, setLibretto] = useState<string | null>(null);
  // Il libretto si monta DOPO la tabella: con un'anagrafica lunga (decine di
  // righe dopo un import) esce sotto il fondo pagina e il clic sembra non aver
  // fatto niente. Due rAF perche' il primo frame monta il "Carico..." e la sua
  // altezza definitiva arriva dopo.
  const librettoRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!libretto) return;
    const t = requestAnimationFrame(() => requestAnimationFrame(() =>
      librettoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })));
    return () => cancelAnimationFrame(t);
  }, [libretto]);

  function ricarica() {
    setFase('carico');
    caricaPersone(clienteId)
      .then((p) => {
        setPersone(p);
        setFase('pronto');
        onConteggio?.(p.filter((x) => x.attivo).length);
        caricaRuoliPerPersona(p.map((x) => x.id))
          .then(setRuoli)
          .catch(() => setRuoli(new Map()));
      })
      .catch(() => setFase('errore'));
  }
  useEffect(ricarica, [clienteId]);

  const cambiato = () => { ricarica(); onCambia?.(); };

  const ago = q.trim().toLowerCase();
  const ruoliDi = (id: string): string[] => ruoli.get(id) ?? [];
  // Tendina dei ruoli: solo quelli davvero assegnati in questo cliente, non tutto
  // il catalogo delle figure - un filtro che offre voci senza nessuno dietro fa
  // sembrare vuota l'anagrafica.
  const ruoliPresenti = [...new Set([...ruoli.values()].flat())].sort((a, b) => a.localeCompare(b, 'it'));
  const visibili = persone.filter((p) => {
    if (!mostraInattivi && !p.attivo) return false;
    const suoi = ruoliDi(p.id);
    if (ruolo === '-' && suoi.length > 0) return false;
    if (ruolo && ruolo !== '-' && !suoi.includes(ruolo)) return false;
    if (!ago) return true;
    return [p.cognome, p.nome, p.codice_fiscale, p.mansione, p.reparto, ...suoi]
      .some((v) => (v ?? '').toLowerCase().includes(ago));
  });

  return (
    <>
      <style>{`
        .ru-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
        .ru-tbl thead th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft,#5c5f66);font-weight:800;padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08)}
        .ru-tr td{padding:8px;border-bottom:1px solid rgba(0,0,0,.06);vertical-align:middle}
        .ru-tr:last-child td{border-bottom:none}
        .ru-tr.dim{opacity:.5}
        .ru-cog{width:17%;font-weight:700}
        .ru-nom{width:15%;font-weight:600}
        .ru-cf{width:21%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#3a3d43}
        .ru-cf.bad{color:var(--no,#d24028)}
        .ru-man{width:17%}
        .ru-ruoli{width:24%}
        .ru-ruolo{display:inline-block;font-size:11px;font-weight:700;line-height:1.4;padding:1px 7px;margin:1px 4px 1px 0;border-radius:999px;background:#eef5ef;border:1px solid #cfe6d8;color:#1f5b38}
        .ru-noruolo{color:var(--ink-soft,#5c5f66)}
        .ru-act{width:6%;text-align:right;white-space:nowrap}
      `}</style>
      <div className="bo-row" style={{ margin: '0 0 10px' }}>
        <p className="bo-sub grow" style={{ margin: 0 }}>
          Tutto il personale del cliente. Le nomine (RSPP, preposto, addetti…) si assegnano
          nel tab Organigramma alle sole persone che le ricoprono.
        </p>
        {!agg && !importa && (
          <>
            <button className="bo-btn ghost sm" onClick={() => setImporta(true)}>Importa da Excel</button>
            <button className="bo-btn sm" onClick={() => setAgg(true)}>+ Aggiungi</button>
          </>
        )}
      </div>

      {importa && (
        <PannelloImport clienteId={clienteId} esistenti={persone}
          onFatto={() => { setImporta(false); cambiato(); }}
          onAnnulla={() => setImporta(false)} />
      )}

      {fase === 'carico' && <div className="bo-empty">Carico…</div>}
      {fase === 'errore' && <div className="bo-err">Errore nel caricamento del personale.</div>}

      {fase === 'pronto' && persone.length > 0 && (
        <div className="bo-row" style={{ margin: '0 0 10px', alignItems: 'center' }}>
          <input type="text" placeholder="Cerca per cognome, nome, CF, mansione, reparto o ruolo…"
            value={q} onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 380, margin: 0 }} />
          {ruoliPresenti.length > 0 && (
            <select value={ruolo} onChange={(e) => setRuolo(e.target.value)}
              style={{ maxWidth: 260, margin: 0 }}>
              <option value="">Tutti i ruoli</option>
              {ruoliPresenti.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="-">Senza ruolo assegnato</option>
            </select>
          )}
        </div>
      )}

      {fase === 'pronto' && visibili.length === 0 && !agg && (
        <div className="bo-empty">
          {ago ? 'Nessuna persona corrisponde alla ricerca.' : 'Nessuna persona. Aggiungine una o importa da Excel.'}
        </div>
      )}

      {(agg || visibili.length > 0) && (
        <table className="ru-tbl">
          <thead>
            <tr>
              <th>Cognome</th>
              <th>Nome</th>
              <th>CF</th>
              <th>Mansione</th>
              <th>Ruoli organigramma</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {agg && (
              <RigaPersona persona={personaVuota(clienteId)}
                onCambia={() => { setAgg(false); cambiato(); }}
                onAnnulla={() => setAgg(false)} />
            )}
            {visibili.map((p) => (
              <RigaPersona key={p.id} persona={p} onCambia={cambiato} ruoli={ruoliDi(p.id)}
                onLibretto={() => setLibretto((cur) => (cur === p.id ? null : p.id))} />
            ))}
          </tbody>
        </table>
      )}

      {/* Fuori dalla tabella e non dentro una riga: e' un documento, e infilarlo
          in un <td> lo comprimerebbe nella colonna. La key sull'id lo rimonta
          quando si passa da una persona all'altra. */}
      {libretto && (
        <div ref={librettoRef}>
          <LibrettoPersona key={libretto} clienteId={clienteId} personaId={libretto}
            clienteNome={clienteNome ?? ''} onChiudi={() => setLibretto(null)} />
        </div>
      )}

      {fase === 'pronto' && persone.some((p) => !p.attivo) && (
        <label className="chk" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={mostraInattivi}
            onChange={(e) => setMostraInattivi(e.target.checked)} />
          Mostra anche i disattivati
        </label>
      )}
    </>
  );
}

// ============================ riga persona ============================

function RigaPersona({ persona, onCambia, onAnnulla, onLibretto, ruoli = [] }: {
  persona: Persona; onCambia: () => void; onAnnulla?: () => void;
  onLibretto?: () => void; ruoli?: string[];
}) {
  const nuova = !persona.id;
  const [modifica, setModifica] = useState(nuova);
  const [p, setP] = useState<Persona>(persona);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setP(persona); }, [persona]);
  const set = (patch: Partial<Persona>) => setP((x) => ({ ...x, ...patch }));

  async function salva() {
    if (!p.nome.trim()) { setMsg('Il nome è obbligatorio.'); return; }
    setBusy(true); setMsg(null);
    try {
      await salvaPersona({ ...p, id: p.id || newId() });
      if (nuova) setP(personaVuota(persona.cliente_id));
      setModifica(false);
      onCambia();
    } catch (e: any) { setMsg(e?.message ?? 'Salvataggio non riuscito.'); }
    finally { setBusy(false); }
  }
  async function toggle() {
    setBusy(true); setMsg(null);
    // Disattivare = la persona ha cessato: se non c'e' gia' una data, la si mette
    // a oggi. Riattivare azzera la cessazione. La data resta comunque editabile a
    // mano nel form (retrodatare dimissioni gia' avvenute).
    const disattiva = persona.attivo;
    const data_cessazione = disattiva
      ? (persona.data_cessazione ?? new Date().toISOString().slice(0, 10))
      : null;
    try { await salvaPersona({ ...persona, attivo: !persona.attivo, data_cessazione }); onCambia(); }
    catch (e: any) { setMsg(e?.message ?? 'Operazione non riuscita.'); }
    finally { setBusy(false); }
  }
  async function elimina() {
    if (!confirm('Eliminare questa persona? Verranno rimosse anche le sue nomine e formazioni.')) return;
    setBusy(true); setMsg(null);
    try { await eliminaPersona(persona.id); onCambia(); }
    catch (e: any) { setMsg(e?.message ?? 'Eliminazione non riuscita.'); setBusy(false); }
  }

  if (!modifica) {
    const cfBad = p.codice_fiscale != null && !cfValido(p.codice_fiscale);
    return (
      <tr className={'ru-tr' + (p.attivo ? '' : ' dim')}>
        <td className="ru-cog">{p.cognome ?? '—'}</td>
        <td className="ru-nom">{p.nome || '—'}</td>
        <td className={'ru-cf' + (cfBad ? ' bad' : '')}>
          {p.codice_fiscale ?? '—'}{cfBad ? ' · CF non valido' : ''}
        </td>
        <td className="ru-man">
          {p.mansione ?? '—'}
          {!p.attivo && <span className="bo-pill archiviato" style={{ marginLeft: 8 }}>
            {p.data_cessazione ? `cessato ${p.data_cessazione.split('-').reverse().join('/')}` : 'disattivato'}
          </span>}
        </td>
        {/* Le nomine si assegnano nel tab Organigramma: qui sono in sola lettura,
            e il loro posto e' l'anagrafica perche' e' li' che si cerca una
            persona ("chi e' il preposto del reparto X?"). */}
        <td className="ru-ruoli">
          {ruoli.length === 0
            ? <span className="ru-noruolo">—</span>
            : ruoli.map((r) => <span key={r} className="ru-ruolo">{r}</span>)}
        </td>
        <td className="ru-act">
          {onLibretto && (
            <button className="bo-btn ghost sm" onClick={onLibretto} title="Ruoli, formazione svolta e scadenze di questa persona">Libretto</button>
          )}
          <button className="bo-btn ghost sm" onClick={() => setModifica(true)}>Modifica</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="ru-tr">
      <td colSpan={6} style={{ padding: 0 }}>
        <div className="bo-card flat" style={{ marginBottom: 8 }}>
          {msg && <div className="bo-err">{msg}</div>}
          <div className="bo-grid">
            <label className="bo-field">
              <span>Cognome</span>
              <input type="text" value={p.cognome ?? ''}
                onChange={(e) => set({ cognome: e.target.value.toUpperCase() || null })} />
            </label>
            <label className="bo-field">
              <span>Nome *</span>
              <input type="text" value={p.nome}
                onChange={(e) => set({ nome: e.target.value.toUpperCase() })} />
            </label>
            <label className="bo-field">
              <span>Codice fiscale</span>
              <input type="text" value={p.codice_fiscale ?? ''}
                onChange={(e) => set({ codice_fiscale: e.target.value.toUpperCase().trim() || null })} />
            </label>
            <label className="bo-field">
              <span>Data assunzione</span>
              <input type="date" value={p.data_assunzione ?? ''}
                onChange={(e) => set({ data_assunzione: e.target.value || null })} />
            </label>
            <label className="bo-field">
              <span>Data cessazione</span>
              <input type="date" value={p.data_cessazione ?? ''}
                onChange={(e) => set({ data_cessazione: e.target.value || null })} />
            </label>
            <label className="bo-field">
              <span>Mansione</span>
              <input type="text" value={p.mansione ?? ''}
                onChange={(e) => set({ mansione: e.target.value || null })} />
            </label>
            <label className="bo-field">
              <span>Reparto</span>
              <input type="text" value={p.reparto ?? ''}
                onChange={(e) => set({ reparto: e.target.value || null })} />
            </label>
            <label className="bo-field">
              <span>Rischio (override)</span>
              <select value={p.livello_rischio ?? ''}
                onChange={(e) => set({ livello_rischio: (e.target.value || null) as RischioPersona })}>
                <option value="">— eredita dal cliente —</option>
                <option value="basso">basso</option>
                <option value="medio">medio</option>
                <option value="alto">alto</option>
              </select>
            </label>
            <label className="bo-field" style={{ marginBottom: 0 }}>
              <span>Note</span>
              <input type="text" value={p.note ?? ''}
                onChange={(e) => set({ note: e.target.value || null })} />
            </label>
          </div>
          <div className="bo-bar">
            <button className="bo-btn sm" onClick={() => void salva()} disabled={busy}>
              {busy ? 'Salvo…' : nuova ? 'Aggiungi' : 'Salva'}
            </button>
            {nuova
              ? onAnnulla && <button className="bo-btn ghost sm" onClick={onAnnulla} disabled={busy}>Annulla</button>
              : <>
                  <button className="bo-btn ghost sm" onClick={() => { setP(persona); setModifica(false); }} disabled={busy}>Chiudi</button>
                  <button className="bo-btn ghost sm" onClick={() => void toggle()} disabled={busy}>
                    {persona.attivo ? 'Disattiva' : 'Riattiva'}
                  </button>
                  <span className="bo-sp" />
                  <button className="bo-btn danger sm" onClick={() => void elimina()} disabled={busy}>Elimina</button>
                </>}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ============================ import massivo ============================

interface PianoImport {
  persone: Persona[];   // da scrivere (nuove + aggiornate)
  nuove: number;
  aggiornate: number;
  scartate: number;     // righe senza nome
  cfNonValidi: number;
}

const normHeader = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

// Data da cella Excel: Date (cellDates), oppure stringa dd/mm/yyyy | yyyy-mm-dd.
function isoData(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, '0'), mo = m[2].padStart(2, '0');
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${mo}-${d}`;
  }
  return null;
}

function pianifica(righe: Record<string, unknown>[], esistenti: Persona[], clienteId: string): PianoImport {
  const perCf = new Map<string, Persona>();
  for (const p of esistenti) {
    if (p.codice_fiscale) perCf.set(cfPulisci(p.codice_fiscale), p);
  }

  const out = new Map<string, Persona>(); // chiave: CF o "riga:N" per i senza-CF
  let scartate = 0, cfNonValidi = 0, senzaCf = 0;

  for (const r of righe) {
    // mappa header -> valore, tollerante ad accenti/spazi/maiuscole
    const col: Record<string, string> = {};
    for (const k of Object.keys(r)) col[normHeader(k)] = String(r[k] ?? '').trim();
    const pick = (...keys: string[]) => { for (const k of keys) if (col[k]) return col[k]; return ''; };

    const cognome = pick('cognome');
    let nome = pick('nome');
    if (!nome) nome = pick('nominativo', 'dipendente', 'cognomeenome', 'nomecognome', 'nominativocompleto');
    if (!nome.trim()) { scartate++; continue; }

    const cfRaw = pick('codicefiscale', 'cf', 'cfiscale', 'c');
    const cf = cfRaw ? cfPulisci(cfRaw) : '';
    if (cf && !cfValido(cf)) cfNonValidi++;

    const esist = cf ? perCf.get(cf) : undefined;
    const base: Persona = esist
      ? { ...esist }
      : { ...personaVuota(clienteId), id: newId() };

    const p: Persona = {
      ...base,
      nome: nome.toUpperCase(),
      cognome: cognome ? cognome.toUpperCase() : base.cognome,
      codice_fiscale: cf || base.codice_fiscale,
      mansione: svuota(pick('mansione', 'ruolo', 'qualifica', 'profilo', 'profiloprofessionale')) ?? base.mansione,
      reparto: svuota(pick('reparto', 'area', 'settore', 'ufficio')) ?? base.reparto,
      data_assunzione: isoData(pick('dataassunzione', 'assunzione', 'dataassunz', 'datadiassunzione', 'datainizio')) ?? base.data_assunzione,
      attivo: true,
    };

    const chiave = cf || `riga:${senzaCf++}`;
    out.set(chiave, p);
  }

  const persone = [...out.values()];
  const nuove = persone.filter((p) => !esistenti.some((e) => e.id === p.id)).length;
  return { persone, nuove, aggiornate: persone.length - nuove, scartate, cfNonValidi };
}

function PannelloImport({ clienteId, esistenti, onFatto, onAnnulla }: {
  clienteId: string; esistenti: Persona[]; onFatto: () => void; onAnnulla: () => void;
}) {
  const [piano, setPiano] = useState<PianoImport | null>(null);
  const [busy, setBusy] = useState<'' | 'leggo' | 'applico'>('');
  const [err, setErr] = useState<string | null>(null);
  const [nomeFile, setNomeFile] = useState<string | null>(null);

  async function leggi(file: File) {
    setBusy('leggo'); setErr(null); setPiano(null); setNomeFile(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const righe = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      const pi = pianifica(righe, esistenti, clienteId);
      if (pi.persone.length === 0 && pi.scartate === 0) {
        setErr('Nessuna riga leggibile nel foglio. Attese colonne: Cognome, Nome, Codice fiscale, Mansione, Reparto, Data assunzione.');
      } else {
        setPiano(pi);
      }
    } catch (e: any) { setErr(e?.message ?? 'File non leggibile.'); }
    finally { setBusy(''); }
  }

  async function applica() {
    if (!piano) return;
    setBusy('applico'); setErr(null);
    try {
      for (const p of piano.persone) await salvaPersona(p);
      onFatto();
    } catch (e: any) { setErr(e?.message ?? 'Import non riuscito.'); setBusy(''); }
  }

  function scaricaModello() {
    const esempio = [
      { Cognome: 'ROSSI', Nome: 'MARIO', 'Codice fiscale': 'RSSMRA80A01H501U', Mansione: 'Operaio', Reparto: 'Produzione', 'Data assunzione': '01/03/2020' },
      { Cognome: 'BIANCHI', Nome: 'LUCIA', 'Codice fiscale': 'BNCLCU85M41F205X', Mansione: 'Impiegata', Reparto: 'Uffici', 'Data assunzione': '15/09/2019' },
    ];
    const ws = XLSX.utils.json_to_sheet(esempio, {
      header: ['Cognome', 'Nome', 'Codice fiscale', 'Mansione', 'Reparto', 'Data assunzione'],
    });
    ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personale');
    XLSX.writeFile(wb, 'modello_risorse_umane.xlsx');
  }

  return (
    <div className="bo-card" style={{ marginBottom: 10, borderColor: 'var(--hi)' }}>
      <div className="bo-row" style={{ marginBottom: 8 }}>
        <div className="grow"><div className="bo-title">Importazione massiva</div></div>
        <button className="bo-btn ghost sm" onClick={scaricaModello} disabled={busy !== ''}>Scarica modello</button>
        <button className="bo-btn ghost sm" onClick={onAnnulla} disabled={busy !== ''}>Chiudi</button>
      </div>
      <p className="bo-sub" style={{ marginTop: 0 }}>
        Excel o CSV con una riga per persona. Intestazioni riconosciute (in qualsiasi ordine):
        <b> Cognome, Nome, Codice fiscale, Mansione, Reparto, Data assunzione</b>. Le persone
        già presenti vengono aggiornate in base al codice fiscale; l'anteprima non scrive nulla.
      </p>

      <label className="bo-field" style={{ marginBottom: 8 }}>
        <span>File (.xlsx / .csv)</span>
        <input type="file" accept=".xlsx,.xls,.csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void leggi(f); }} />
      </label>

      {busy === 'leggo' && <div className="bo-note">Leggo {nomeFile}…</div>}
      {err && <div className="bo-err">{err}</div>}

      {piano && (
        <>
          <div className="bo-note">
            Da <b>{nomeFile}</b>: <b>{piano.nuove}</b> nuove, <b>{piano.aggiornate}</b> aggiornate
            {piano.scartate > 0 && <> · {piano.scartate} righe scartate (senza nome)</>}
            {piano.cfNonValidi > 0 && <> · {piano.cfNonValidi} con CF non valido (importate comunque)</>}.
          </div>
          <div className="bo-bar">
            <button className="bo-btn" onClick={() => void applica()} disabled={busy !== '' || piano.persone.length === 0}>
              {busy === 'applico' ? 'Applico…' : `Applica (${piano.persone.length})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
