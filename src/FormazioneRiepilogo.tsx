// Organigramma sicurezza del cliente durante il sopralluogo (sheet della
// Compilazione). OFFLINE-FIRST + COMPILABILE DA ZERO in campo:
//   - i dati si leggono dalla cache locale (Dexie) con caricaOrganigrammaLocale
//     e si valutano con la funzione PURA assemblaRiepilogo (la stessa del
//     back-office): funziona anche senza rete una volta scaricato il catalogo;
//   - con rete, all'apertura fa un prefetch best-effort (prefetchOrganigramma) e
//     mette in cache il livello di rischio del cliente (per le ore LAV_SPEC);
//   - il tecnico puo' costruire l'organigramma da zero: aggiungere/modificare/
//     rimuovere PERSONE e assegnare/togliere FIGURE (nomine), poi per ogni
//     requisito registrare/aggiornare l'ATTESTATO o registrare/rimuovere un
//     ESONERO. Tutte scritture offline (outbox) via sync.ts, con rivalutazione
//     immediata dei semafori;
//   - a fine consultazione, una CONFERMA tracciata (tecnico + data + tipo
//     compilato/confermato/variato) viene salvata su organigramma_conferma.
// Eredita la palette del campo (var --ok/--no/--hi su .compila) con fallback.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type RiepilogoCliente, type RequisitoValutato, type StatoRequisito,
  type LivelloRischio, type TipoEsonero, type Formazione, type Esonero,
  type Persona, type Nomina, type FiguraSicurezza, type ModuloValutato, type EsoneroAmmesso,
  type CorsoCatalogo,
  assemblaRiepilogo, nomePersona, CATEGORIE_NO_PREGRESSA, figuraChiedePregressa,
} from './lib/admin/formazione';
import { costruisciSnapshot, firmaOrganigramma } from './lib/admin/organigramma-revisioni';
import {
  caricaOrganigrammaLocale, prefetchOrganigramma, type OrganigrammaLocale,
  salvaFormazione, salvaFormazioneConAllegato, salvaEsonero, eliminaEsonero, salvaConfermaOrganigramma,
  salvaPersona, eliminaPersona, salvaNomina, eliminaNomina, accodaRevisioneOrganigramma,
} from './lib/sync';
import { supabase, MAX_ATTESTATO_BYTES } from './lib/supabase';
import { db, type OrganigrammaConferma } from './lib/db';
import { newId } from './lib/types';

const TXT: Record<StatoRequisito, string> = {
  conforme: 'Conforme', in_scadenza: 'In scadenza', critico: 'Critico', esonerato: 'Esonerato', facoltativo: 'Facoltativo', da_verificare: 'Da verificare',
};

// Badge obbligo della figura (stesso wording del back-office).
const LABEL_OBBLIGO: Record<string, string> = {
  sempre: 'sempre', condizionale: 'se ricorre', eventuale: 'eventuale',
};

const TIPI_ESONERO: Array<{ v: TipoEsonero; l: string }> = [
  { v: 'titolo_studio', l: 'Titolo di studio' },
  { v: 'abilitazione', l: 'Abilitazione' },
  { v: 'ruolo_equipollente', l: 'Ruolo equipollente' },
  { v: 'credito_pregresso', l: 'Credito pregresso' },
  { v: 'altro', l: 'Altro' },
];

const RK_KEY = (clienteId: string) => 'formazione:rischio:' + clienteId;
// Firma dell'ultimo snapshot organigramma salvato da QUESTO dispositivo: dedup
// locale (offline-safe) per non duplicare la revisione se nulla e' cambiato.
const FIRMA_KEY = (clienteId: string) => 'organigramma:firma:' + clienteId;
const oggiISO = () => new Date().toISOString().slice(0, 10);

function leggiRischioLocale(clienteId: string): LivelloRischio | null {
  try {
    const v = localStorage.getItem(RK_KEY(clienteId));
    return v === 'basso' || v === 'medio' || v === 'alto' ? v : null;
  } catch { return null; }
}

const CSS = `
.fzr{font-size:13px;}
.fzr-head{display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px;}
.fzr-tot{display:flex; gap:8px; flex-wrap:wrap;}
.fzr-add{flex:0 0 auto; background:var(--ink,#2a2c30); color:#fff; border:none; border-radius:8px; padding:7px 12px; font-size:12.5px; font-weight:800; cursor:pointer;}
.fzr-sem{font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; white-space:nowrap;}
.fzr-sem.conforme{background:var(--ok-bg,#e7f5ec); color:var(--ok,#1f9d57);}
.fzr-sem.in_scadenza{background:#fbf0d6; color:var(--hi-dark,#9a6206);}
.fzr-sem.critico{background:var(--no-bg,#fbeae6); color:var(--no,#d8442f);}
.fzr-sem.esonerato{background:#e8eefc; color:#27508f;}
.fzr-sem.da_verificare{background:#e8ebf0; color:#51607a;}
.fzr-p{border:1px solid var(--line,#e3ddd2); border-radius:12px; padding:12px; margin-bottom:10px; background:var(--card,#fff);}
.fzr-p-top{display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:6px;}
.fzr-fig{color:var(--ink-soft,#5b5f66); font-size:11.5px; margin-top:2px;}
.fzr-p-actions{display:flex; gap:6px; margin:6px 0 2px; flex-wrap:wrap;}
.fzr-mini{background:#fff; border:1px solid var(--line,#e3ddd2); border-radius:8px; padding:4px 10px; font-size:11.5px; font-weight:700; color:var(--ink,#2a2c30); cursor:pointer;}
.fzr-mini.on{background:var(--ink,#2a2c30); color:#fff; border-color:var(--ink,#2a2c30);}
.fzr-r{padding:7px 0; border-top:1px solid var(--line,#e3ddd2);}
.fzr-r-main{display:flex; align-items:center; justify-content:space-between; gap:10px;}
.fzr-r-name{display:flex; align-items:center; gap:8px; min-width:0;}
.fzr-dot{width:10px; height:10px; border-radius:50%; flex:0 0 auto;}
.fzr-dot.conforme{background:var(--ok,#1f9d57);}
.fzr-dot.in_scadenza{background:var(--hi,#f4a012);}
.fzr-dot.critico{background:var(--no,#d8442f);}
.fzr-dot.esonerato{background:#3b6fd0;}
.fzr-dot.da_verificare{background:#7a8aa6;}
.fzr-d{color:var(--ink-soft,#5b5f66); font-size:11.5px; margin-top:2px;}
.fzr-hint{font-size:11.5px; color:#27508f; background:#eef3fc; border-radius:8px; padding:5px 8px; margin-top:5px; line-height:1.4;}
.fzr-edit-btn{flex:0 0 auto; background:none; border:1px solid var(--line,#e3ddd2); border-radius:8px; padding:3px 9px; font-size:11.5px; font-weight:700; color:var(--ink,#2a2c30); cursor:pointer;}
.fzr-ed{margin-top:8px; border:1px solid var(--line,#e3ddd2); border-radius:10px; padding:10px; background:var(--paper,#faf7f1);}
.fzr-tabs{display:flex; gap:6px; margin-bottom:8px;}
.fzr-tabs button{flex:1; padding:6px 8px; border-radius:8px; border:1px solid var(--line,#e3ddd2); background:#fff; font-size:12px; font-weight:700; color:var(--ink-soft,#5b5f66); cursor:pointer;}
.fzr-tabs button.on{background:var(--ink,#2a2c30); color:#fff; border-color:var(--ink,#2a2c30);}
.fzr-field{margin-bottom:8px;}
.fzr-field label{display:block; font-size:11px; font-weight:700; color:var(--ink-soft,#5b5f66); margin-bottom:3px;}
.fzr-field input, .fzr-field select{width:100%; box-sizing:border-box; padding:8px 9px; border:1px solid var(--line,#e3ddd2); border-radius:8px; font-size:13px; font-family:inherit; background:#fff; color:var(--ink,#2a2c30);}
.fzr-row2{display:flex; gap:8px;} .fzr-row2 > *{flex:1;}
.fzr-actions{display:flex; gap:8px; margin-top:4px;}
.fzr-btn{flex:1; padding:8px 10px; border-radius:8px; border:none; font-size:12.5px; font-weight:800; cursor:pointer;}
.fzr-btn.primary{background:var(--ok,#1f9d57); color:#fff;}
.fzr-btn.ghost{background:#fff; border:1px solid var(--line,#e3ddd2); color:var(--ink,#2a2c30);}
.fzr-btn.danger{background:var(--no-bg,#fbeae6); color:var(--no,#d8442f);}
.fzr-btn:disabled{opacity:.55; cursor:default;}
.fzr-eson-cur{font-size:12px; color:#27508f; background:#eef3fc; border-radius:8px; padding:8px 10px; margin-bottom:8px;}
.fzr-grp{font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-soft,#5b5f66); margin:8px 0 3px;}
.fzr-fig-row{display:flex; align-items:center; gap:9px; padding:5px 2px; font-size:12.5px; cursor:pointer;}
.fzr-fig-row input{width:18px; height:18px; flex:0 0 auto;}
.fzr-conf{margin-top:14px; border-top:2px solid var(--line,#e3ddd2); padding-top:12px;}
.fzr-conf h4{margin:0 0 6px; font-size:13px; font-weight:800;}
.fzr-conf-last{font-size:11.5px; color:var(--ink-soft,#5b5f66); margin-bottom:8px;}
.fzr-conf textarea{width:100%; box-sizing:border-box; padding:8px 9px; border:1px solid var(--line,#e3ddd2); border-radius:8px; font-size:13px; font-family:inherit; min-height:54px; resize:vertical; background:#fff; color:var(--ink,#2a2c30); margin-bottom:8px;}
.fzr-warn{font-size:11.5px; color:var(--hi-dark,#9a6206); background:#fbf0d6; border-radius:8px; padding:6px 9px; margin-bottom:10px;}
.fzr-cop{border:1px solid var(--line,#e3ddd2); border-radius:10px; margin:4px 0 12px; overflow:hidden;}
.fzr-cop-h{width:100%; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:9px 11px; border:none; background:#f6f2ea; cursor:pointer; font:inherit; font-weight:700; font-size:13px;}
.fzr-cop-body{padding:4px 11px 10px;}
.fzr-figrow{padding:7px 2px; border-top:1px solid var(--line,#e3ddd2);}
.fzr-figrow:first-child{border-top:none;}
.fzr-figrow-top{display:flex; align-items:center; gap:8px;}
.fzr-dot-wrap{flex:0 0 auto; display:flex; align-items:center;}
.fzr-figrow-nome{flex:1 1 auto; min-width:0; font-size:13px; font-weight:600; display:flex; align-items:center; gap:6px; flex-wrap:wrap;}
.fzr-badge{font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.03em; padding:1px 6px; border-radius:999px;}
.fzr-badge.sempre{background:var(--no-bg,#fbeae6); color:var(--no,#d8442f);}
.fzr-badge.condizionale{background:#fbf0d6; color:var(--hi-dark,#9a6206);}
.fzr-badge.eventuale{background:#e8ebf0; color:#51607a;}
.fzr-figrow-people{display:flex; flex-wrap:wrap; gap:6px; margin:5px 0 0 18px;}
.fzr-figrow-chip{display:inline-flex; align-items:center; gap:6px; font-size:11.5px; color:var(--ink,#2a2c30); background:#f1ede5; border-radius:999px; padding:2px 9px;}
.fzr-figrow-crit{font-size:11.5px; font-weight:700; color:var(--no,#d8442f);}
.fzr-figrow-empty{font-size:11.5px; color:var(--ink-soft,#5b5f66);}
.fzr-guida{margin:6px 0 6px 20px; padding:0; font-size:11.5px; color:var(--ink-soft,#5b5f66); line-height:1.45;}
.fzr-guida li{margin:1px 0;}
.fzr-guida li.sub{list-style:none; margin-left:-6px;}
.fzr-guida li.sub::before{content:'\\2013\\00a0'; }
.fzr-inc{margin:6px 0 2px 6px;}
.fzr-inc-h{font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-soft,#5b5f66); margin:4px 0 4px;}
.fzr-inc-card{border:1px solid var(--line,#e3ddd2); border-radius:10px; padding:9px 10px; margin-bottom:8px; background:var(--card,#fff);}
.fzr-inc-top{display:flex; align-items:center; justify-content:space-between; gap:8px;}
.fzr-inc-nome{display:flex; align-items:center; gap:7px; font-size:13px; font-weight:700; min-width:0;}
.fzr-nomina{display:flex; align-items:center; gap:8px; margin:7px 0; font-size:11.5px; color:var(--ink-soft,#5b5f66);}
.fzr-nomina span{flex:0 0 auto;}
.fzr-nomina input{flex:1 1 auto; min-width:0; padding:6px 8px; border:1px solid var(--line,#e3ddd2); border-radius:8px; font-size:12.5px; font-family:inherit; background:#fff; color:var(--ink,#2a2c30);}
.fzr-r-right{display:flex; align-items:center; gap:8px; flex:0 0 auto;}
.fzr-st{font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.03em; padding:2px 7px; border-radius:999px; white-space:nowrap;}
.fzr-st.conforme{background:var(--ok-bg,#e7f5ec); color:var(--ok,#1f9d57);}
.fzr-st.in_scadenza{background:#fbf0d6; color:var(--hi-dark,#9a6206);}
.fzr-st.critico{background:var(--no-bg,#fbeae6); color:var(--no,#d8442f);}
.fzr-st.esonerato{background:#e8eefc; color:#27508f;}
.fzr-st.da_verificare,.fzr-st.facoltativo{background:#e8ebf0; color:#51607a;}
.fzr-modtag{font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:.03em; margin-left:6px; padding:1px 6px; border-radius:999px; background:#e8ebf0; color:#51607a;}
.fzr-mod{margin-top:6px;}
.fzr-mod-stato{display:flex; align-items:center; gap:7px; font-size:11.5px; color:var(--ink-soft,#5b5f66); margin:4px 0;}
`;

interface Props {
  clienteId: string | null;
  sopralluogoId: string;
  tecnicoId: string;
  tecnicoNome: string | null;
}

// ---------- form anagrafica persona (nuova o modifica) ----------
function PersonaForm({
  persona, clienteId, onSaved, onClose,
}: {
  persona: Persona | null;
  clienteId: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [cognome, setCognome] = useState(persona?.cognome ?? '');
  const [nome, setNome] = useState(persona?.nome ?? '');
  const [mansione, setMansione] = useState(persona?.mansione ?? '');
  const [cf, setCf] = useState(persona?.codice_fiscale ?? '');
  const [pregressa, setPregressa] = useState(persona?.formazione_pregressa ?? false);
  const [busy, setBusy] = useState(false);

  async function salva() {
    if (!nome.trim() && !cognome.trim()) { window.alert('Indica almeno nome o cognome.'); return; }
    setBusy(true);
    try {
      const p: Persona = {
        id: persona?.id ?? newId(),
        cliente_id: clienteId,
        nome: nome.trim(),
        cognome: cognome.trim() || null,
        codice_fiscale: cf.trim() || null,
        mansione: mansione.trim() || null,
        reparto: persona?.reparto ?? null,
        data_assunzione: persona?.data_assunzione ?? null,
        livello_rischio: persona?.livello_rischio ?? null,
        attivo: true,
        note: persona?.note ?? null,
        formazione_pregressa: pregressa,
      };
      await salvaPersona(p);
      await onSaved();
      onClose();
    } finally { setBusy(false); }
  }

  async function rimuovi() {
    if (!persona) return;
    if (!window.confirm('Rimuovere ' + nomePersona(persona) + ' dall\u2019organigramma? Verranno tolte anche le sue nomine, attestati ed esoneri.')) return;
    setBusy(true);
    try { await eliminaPersona(persona.id); await onSaved(); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <div className="fzr-ed">
      <div className="fzr-row2">
        <div className="fzr-field">
          <label>Cognome</label>
          <input type="text" value={cognome} onChange={(e) => setCognome(e.target.value.toUpperCase())} />
        </div>
        <div className="fzr-field">
          <label>Nome</label>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value.toUpperCase())} />
        </div>
      </div>
      <div className="fzr-field">
        <label>Mansione</label>
        <input type="text" value={mansione} onChange={(e) => setMansione(e.target.value.toUpperCase())} />
      </div>
      <div className="fzr-field">
        <label>Codice fiscale (facoltativo)</label>
        <input type="text" value={cf} onChange={(e) => setCf(e.target.value.toUpperCase())} />
      </div>
      <label className="chk" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '2px 0 4px' }}>
        <input type="checkbox" checked={pregressa} onChange={(e) => setPregressa(e.target.checked)} />
        <span>Formazione pregressa (azienda già operante prima dell'ASR 2025): i requisiti senza attestato risultano "da verificare" invece di "critici".</span>
      </label>
      <div className="fzr-actions">
        <button className="fzr-btn primary" disabled={busy} onClick={() => void salva()}>{persona ? 'Salva' : 'Aggiungi'}</button>
        <button className="fzr-btn ghost" disabled={busy} onClick={onClose}>Annulla</button>
      </div>
      {persona && (
        <div className="fzr-actions" style={{ marginTop: 8 }}>
          <button className="fzr-btn danger" disabled={busy} onClick={() => void rimuovi()}>Rimuovi persona</button>
        </div>
      )}
    </div>
  );
}

// ---------- pannello assegnazione PER FIGURA (paradigma back-office) ----------
// Aperto dal bottone "assegna/modifica" di una riga-figura: si spuntano le
// persone gia' in organigramma da incaricare di QUELLA figura, e/o se ne crea
// una nuova al volo (cognome/nome). Per chi viene assegnato per la prima volta a
// un ruolo con formazione soggetta al regime ASR 2025 si chiede se ha formazione
// pregressa. Tutte scritture offline (outbox) via sync.ts.
function AssegnaFiguraPanel({
  figura, persone, clienteId, chiediPregressa, onSaved, onClose,
}: {
  figura: FiguraSicurezza;
  persone: Persona[];
  clienteId: string;
  chiediPregressa: boolean;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [nomine, setNomineLocal] = useState<Nomina[]>([]);
  // titolari attuali della figura (nomine attive)
  const titolari = useMemo(
    () => nomine.filter((n) => n.attiva && n.figura_codice === figura.codice).map((n) => n.persona_id),
    [nomine, figura.codice],
  );
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [nuovoCognome, setNuovoCognome] = useState('');
  const [nuovoNome, setNuovoNome] = useState('');
  const [busy, setBusy] = useState(false);
  // passo 2: per chi e' appena stato assegnato si chiede la formazione pregressa
  const [step, setStep] = useState<'assegna' | 'pregressa'>('assegna');
  const [nuove, setNuove] = useState<Persona[]>([]);
  const [risposte, setRisposte] = useState<Record<string, boolean>>({});

  // carico le nomine correnti dalla cache locale (offline-safe)
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const o = await caricaOrganigrammaLocale(clienteId);
      if (!vivo) return;
      setNomineLocal(o.nomine);
      setSel(new Set(o.nomine.filter((n) => n.attiva && n.figura_codice === figura.codice).map((n) => n.persona_id)));
    })();
    return () => { vivo = false; };
  }, [clienteId, figura.codice]);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function salva() {
    if (busy) return;
    setBusy(true);
    try {
      const dopo = new Set(sel);
      const aggiunte: Persona[] = [];
      // crea la nuova persona, se indicata
      if (nuovoCognome.trim() || nuovoNome.trim()) {
        const creata: Persona = {
          id: newId(), cliente_id: clienteId,
          nome: nuovoNome.trim(), cognome: nuovoCognome.trim() || null,
          codice_fiscale: null, mansione: null, reparto: null, data_assunzione: null,
          livello_rischio: null, attivo: true, note: null, formazione_pregressa: false,
        };
        await salvaPersona(creata);
        dopo.add(creata.id);
        aggiunte.push(creata);
      }
      // aggiunte: selezionati ora ma non titolari prima
      for (const id of dopo) {
        if (titolari.includes(id)) continue;
        const esistente = nomine.find((n) => n.persona_id === id && n.figura_codice === figura.codice);
        if (esistente) await salvaNomina({ ...esistente, attiva: true });
        else await salvaNomina({ id: newId(), persona_id: id, figura_codice: figura.codice, data_nomina: oggiISO(), attiva: true, note: null });
        if (!aggiunte.some((a) => a.id === id)) {
          const p = persone.find((x) => x.id === id);
          if (p) aggiunte.push(p);
        }
      }
      // rimozioni: titolari prima ma non piu' selezionati
      for (const id of titolari) {
        if (dopo.has(id)) continue;
        const att = nomine.find((n) => n.persona_id === id && n.figura_codice === figura.codice && n.attiva);
        if (att) await eliminaNomina(att.id);
      }
      // passo 2 (pregressa) solo per chi e' stato assegnato ex-novo a un ruolo
      // con formazione soggetta al regime ASR 2025.
      if (chiediPregressa && aggiunte.length > 0) {
        setNuove(aggiunte);
        setRisposte(Object.fromEntries(aggiunte.map((p) => [p.id, false])));
        setStep('pregressa');
        await onSaved();
        setBusy(false);
        return;
      }
      await onSaved();
      onClose();
    } finally { setBusy(false); }
  }

  async function confermaPregressa() {
    if (busy) return;
    setBusy(true);
    try {
      for (const p of nuove) {
        if (risposte[p.id]) await salvaPersona({ ...p, formazione_pregressa: true });
      }
      await onSaved();
      onClose();
    } finally { setBusy(false); }
  }

  if (step === 'pregressa') {
    return (
      <div className="fzr-ed">
        <div className="fzr-hint" style={{ marginTop: 0 }}>
          Per ogni persona appena assegnata a &laquo;{figura.nome}&raquo;: l'azienda era gi&agrave;
          operante prima dell'ASR 2025 con formazione pregressa? Se s&igrave;, i requisiti senza
          attestato risultano &laquo;da verificare&raquo; invece di &laquo;critici&raquo;.
        </div>
        {nuove.map((p) => (
          <label key={p.id} className="fzr-fig-row">
            <input type="checkbox" checked={!!risposte[p.id]} disabled={busy}
              onChange={(e) => setRisposte((r) => ({ ...r, [p.id]: e.target.checked }))} />
            <span>{nomePersona(p)} {'\u2014'} formazione pregressa</span>
          </label>
        ))}
        <div className="fzr-actions" style={{ marginTop: 8 }}>
          <button className="fzr-btn primary" disabled={busy} onClick={() => void confermaPregressa()}>Conferma</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fzr-ed">
      {persone.length > 0 ? (
        <>
          <div className="fzr-grp" style={{ marginTop: 0 }}>Assegna una persona gi&agrave; in organigramma</div>
          {persone.map((p) => (
            <label key={p.id} className="fzr-fig-row">
              <input type="checkbox" checked={sel.has(p.id)} disabled={busy} onChange={() => toggle(p.id)} />
              <span>{nomePersona(p)}{p.mansione ? ' \u00b7 ' + p.mansione : ''}</span>
            </label>
          ))}
        </>
      ) : (
        <div className="fzr-d" style={{ marginTop: 0 }}>Nessuna persona ancora in organigramma: creane una qui sotto.</div>
      )}
      <div className="fzr-grp">Crea e assegna una nuova persona</div>
      <div className="fzr-row2">
        <div className="fzr-field">
          <label>Cognome</label>
          <input type="text" value={nuovoCognome} disabled={busy} onChange={(e) => setNuovoCognome(e.target.value.toUpperCase())} />
        </div>
        <div className="fzr-field">
          <label>Nome</label>
          <input type="text" value={nuovoNome} disabled={busy} onChange={(e) => setNuovoNome(e.target.value.toUpperCase())} />
        </div>
      </div>
      <div className="fzr-actions">
        <button className="fzr-btn primary" disabled={busy} onClick={() => void salva()}>Salva</button>
        <button className="fzr-btn ghost" disabled={busy} onClick={onClose}>Annulla</button>
      </div>
    </div>
  );
}

// ---------- pannello assegnazione figure (nomine) ----------
function FigurePanel({
  persona, figure, nomine, onSaved, onClose,
}: {
  persona: Persona;
  figure: FiguraSicurezza[];
  nomine: Nomina[];
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const nomineP = nomine.filter((n) => n.persona_id === persona.id);
  const attiveCodici = new Set(nomineP.filter((n) => n.attiva).map((n) => n.figura_codice));
  // Selezione IN STADIO: spuntare non salva; si conferma con "Salva", "Annulla" scarta.
  const [sel, setSel] = useState<Set<string>>(() => new Set(attiveCodici));

  const gruppi = useMemo(() => {
    const fs = figure
      .filter((f) => f.attiva !== false)
      .slice()
      .sort((a, b) => (a.gruppo_ordine ?? 999) - (b.gruppo_ordine ?? 999) || a.ordine - b.ordine);
    const map = new Map<string, FiguraSicurezza[]>();
    for (const f of fs) {
      const g = f.gruppo || 'Altre figure';
      const arr = map.get(g);
      if (arr) arr.push(f); else map.set(g, [f]);
    }
    return [...map.entries()];
  }, [figure]);

  const toggleSel = (codice: string) => setSel((s) => {
    const n = new Set(s);
    if (n.has(codice)) n.delete(codice); else n.add(codice);
    return n;
  });

  const sporco = sel.size !== attiveCodici.size || [...sel].some((c) => !attiveCodici.has(c));

  async function salva() {
    if (busy) return;
    setBusy(true);
    try {
      // aggiunte: selezionate ora ma non attive prima
      for (const codice of sel) {
        if (attiveCodici.has(codice)) continue;
        const esistente = nomineP.find((n) => n.figura_codice === codice);
        if (esistente) await salvaNomina({ ...esistente, attiva: true });
        else await salvaNomina({ id: newId(), persona_id: persona.id, figura_codice: codice, data_nomina: oggiISO(), attiva: true, note: null });
      }
      // rimozioni: attive prima ma non piu' selezionate
      for (const codice of attiveCodici) {
        if (sel.has(codice)) continue;
        const att = nomineP.find((n) => n.figura_codice === codice && n.attiva);
        if (att) await eliminaNomina(att.id);
      }
      await onSaved();
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <div className="fzr-ed">
      {gruppi.map(([g, fs]) => (
        <div key={g}>
          <div className="fzr-grp">{g}</div>
          {fs.map((f) => (
            <label key={f.codice} className="fzr-fig-row">
              <input type="checkbox" checked={sel.has(f.codice)} disabled={busy} onChange={() => toggleSel(f.codice)} />
              <span>{f.nome}</span>
            </label>
          ))}
        </div>
      ))}
      <div className="fzr-actions" style={{ marginTop: 8 }}>
        <button className="fzr-btn primary" disabled={busy || !sporco} onClick={() => void salva()}>Salva</button>
        <button className="fzr-btn ghost" disabled={busy} onClick={onClose}>Annulla</button>
      </div>
    </div>
  );
}

// ---------- editor inline di un singolo requisito (attestato / esonero) ----------
function EditorRequisito({
  personaId, req, figuraCodice, alternative, onSaved, onClose,
}: {
  personaId: string;
  req: RequisitoValutato;
  figuraCodice: string | null;
  alternative: { codice: string; nome: string; ore: number | null; categoria: string | null }[];
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  // Requisito a percorsi multipli (antincendio liv.1/2/3, primo soccorso A / B-C):
  // il corso effettivo lo sceglie qui chi compila, non lo decide l'app.
  const multiPath = alternative.length > 1;
  // Antincendio (DM 02/09/2021) e primo soccorso (DM 388/2003) sono fuori dal
  // regime ASR 2025: nessun esonero/credito Allegato III, quindi niente tab esonero.
  const noEsonero = CATEGORIE_NO_PREGRESSA.has(req.categoria);
  const [tab, setTab] = useState<'att' | 'eson'>('att');
  const [corsoScelto, setCorsoScelto] = useState('');
  const [dataAtt, setDataAtt] = useState('');
  const [oreAtt, setOreAtt] = useState(req.ore != null ? String(req.ore) : '');
  const [enteAtt, setEnteAtt] = useState('');
  const [esonTipo, setEsonTipo] = useState<TipoEsonero>('titolo_studio');
  const [esonMot, setEsonMot] = useState('');
  const [esonRif, setEsonRif] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  function scegliCorso(codice: string) {
    setCorsoScelto(codice);
    const c = alternative.find((x) => x.codice === codice);
    if (c && c.ore != null) setOreAtt(String(c.ore));
  }

  if (req.esonero_id) {
    return (
      <div className="fzr-ed">
        <div className="fzr-eson-cur">{req.dettaglio}</div>
        <div className="fzr-actions">
          <button
            className="fzr-btn danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await eliminaEsonero(req.esonero_id as string); await onSaved(); onClose(); }
              finally { setBusy(false); }
            }}
          >Rimuovi esonero</button>
          <button className="fzr-btn ghost" disabled={busy} onClick={onClose}>Chiudi</button>
        </div>
      </div>
    );
  }

  async function salvaAttestato() {
    if (!dataAtt) { window.alert('Indica la data di completamento dell\u2019attestato.'); return; }
    if (multiPath && !corsoScelto) { window.alert('Scegli il corso (livello/gruppo) effettivamente svolto.'); return; }
    if (file && file.size > MAX_ATTESTATO_BYTES) { window.alert('Il file supera 20 MB: scegline uno piu\u2019 piccolo.'); return; }
    setBusy(true);
    try {
      const scelto = multiPath ? alternative.find((c) => c.codice === corsoScelto) : null;
      const f: Formazione = {
        id: req.formazione_id ?? newId(),
        persona_id: personaId,
        corso_codice: scelto?.codice ?? req.corso_codice,
        corso_nome: scelto?.nome ?? req.corso_nome,
        categoria: req.categoria || null,
        data_completamento: dataAtt,
        ore: oreAtt.trim() ? Number(oreAtt) : (req.ore ?? null),
        ente_formatore: enteAtt.trim() || null,
        is_aggiornamento: false,
        scadenza: null,
        allegato_url: null,
        note: null,
      };
      if (file) await salvaFormazioneConAllegato(f, file);
      else await salvaFormazione(f);
      await onSaved();
      onClose();
    } finally { setBusy(false); }
  }

  async function salvaEson() {
    if (!esonMot.trim()) { window.alert('Indica la motivazione dell\u2019esonero.'); return; }
    setBusy(true);
    try {
      const e: Esonero = {
        id: newId(),
        persona_id: personaId,
        corso_codice: req.corso_codice,
        figura_codice: figuraCodice,
        tipo: esonTipo,
        motivazione: esonMot.trim(),
        riferimento_norm: esonRif.trim() || null,
        documento_url: null,
        data_riconoscimento: oggiISO(),
        attivo: true,
        note: null,
      };
      await salvaEsonero(e);
      await onSaved();
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <div className="fzr-ed">
      {!noEsonero && (
        <div className="fzr-tabs">
          <button className={tab === 'att' ? 'on' : ''} onClick={() => setTab('att')}>Attestato</button>
          <button className={tab === 'eson' ? 'on' : ''} onClick={() => setTab('eson')}>Esonero</button>
        </div>
      )}

      {tab === 'att' ? (
        <>
          {multiPath && (
            <div className="fzr-field">
              <label>Corso svolto (livello/gruppo)</label>
              <select value={corsoScelto} onChange={(e) => scegliCorso(e.target.value)}>
                <option value="">— scegli il corso —</option>
                {alternative.map((c) => <option key={c.codice} value={c.codice}>{c.nome}{c.ore != null ? ' (' + c.ore + 'h)' : ''}</option>)}
              </select>
            </div>
          )}
          <div className="fzr-field">
            <label>Data completamento</label>
            <input type="date" value={dataAtt} onChange={(e) => setDataAtt(e.target.value)} />
          </div>
          <div className="fzr-row2">
            <div className="fzr-field">
              <label>Ore</label>
              <input type="number" inputMode="decimal" value={oreAtt} onChange={(e) => setOreAtt(e.target.value)} />
            </div>
            <div className="fzr-field">
              <label>Ente formatore</label>
              <input type="text" value={enteAtt} onChange={(e) => setEnteAtt(e.target.value)} />
            </div>
          </div>
          <div className="fzr-field">
            <label>Allegato (PDF o foto, facoltativo)</label>
            <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {file && (
            <div className="fzr-d">
              Allegato: {file.name} ({Math.round(file.size / 1024)} KB)
              {!navigator.onLine ? ' \u00b7 verra\u2019 caricato al ritorno della rete' : ''}
            </div>
          )}
          <div className="fzr-actions">
            <button className="fzr-btn primary" disabled={busy} onClick={() => void salvaAttestato()}>Salva attestato</button>
            <button className="fzr-btn ghost" disabled={busy} onClick={onClose}>Annulla</button>
          </div>
        </>
      ) : (
        <>
          <div className="fzr-field">
            <label>Tipo</label>
            <select value={esonTipo} onChange={(e) => setEsonTipo(e.target.value as TipoEsonero)}>
              {TIPI_ESONERO.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <div className="fzr-field">
            <label>Motivazione</label>
            <input type="text" value={esonMot} onChange={(e) => setEsonMot(e.target.value)} />
          </div>
          <div className="fzr-field">
            <label>Riferimento normativo (facoltativo)</label>
            <input type="text" value={esonRif} onChange={(e) => setEsonRif(e.target.value)} />
          </div>
          <div className="fzr-actions">
            <button className="fzr-btn primary" disabled={busy} onClick={() => void salvaEson()}>Salva esonero</button>
            <button className="fzr-btn ghost" disabled={busy} onClick={onClose}>Annulla</button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- data di nomina inline (offline, salva all'uscita dal campo) ----------
function NominaInline({ nomina, onSaved }: { nomina: Nomina | null; onSaved: () => Promise<void>; }) {
  const [v, setV] = useState(nomina?.data_nomina ?? '');
  const [busy, setBusy] = useState(false);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setV(nomina?.data_nomina ?? ''); }, [nomina?.data_nomina]);

  async function commit() {
    editing.current = false;
    const nuovo = v || null;
    if (!nomina) return;
    if ((nomina.data_nomina ?? '') === (nuovo ?? '')) return;
    if (nuovo) { const anno = Number(nuovo.slice(0, 4)); if (!(anno >= 1990 && anno <= 2100)) return; }
    setBusy(true);
    try { await salvaNomina({ ...nomina, data_nomina: nuovo }); await onSaved(); }
    finally { setBusy(false); }
  }

  return (
    <label className="fzr-nomina">
      <span>Data di nomina</span>
      <input type="date" value={v} disabled={busy || !nomina} min="1990-01-01" max="2100-12-31"
        onFocus={() => { editing.current = true; }}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => void commit()} />
    </label>
  );
}

// ---------- modulo aggiuntivo condizionato (es. cantieri), offline ----------
function ModuloInline({
  ammesso, corso, personaId, valutato, onSaved,
}: {
  ammesso: EsoneroAmmesso; corso: CorsoCatalogo | undefined; personaId: string;
  valutato: ModuloValutato | undefined; onSaved: () => Promise<void>;
}) {
  const [applicabile, setApplicabile] = useState(false);
  const [data, setData] = useState('');
  const [ore, setOre] = useState(corso?.ore != null ? String(corso.ore) : '');
  const [ente, setEnte] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function registra() {
    if (!data || !corso) return;
    if (file && file.size > MAX_ATTESTATO_BYTES) { window.alert('Il file supera 20 MB: scegline uno piu\u2019 piccolo.'); return; }
    setBusy(true);
    try {
      const f: Formazione = {
        id: newId(), persona_id: personaId, corso_codice: corso.codice, corso_nome: corso.nome,
        categoria: corso.categoria, data_completamento: data, ore: ore === '' ? null : Number(ore),
        ente_formatore: ente.trim() || null, is_aggiornamento: false, scadenza: null, allegato_url: null, note: null,
      };
      if (file) await salvaFormazioneConAllegato(f, file); else await salvaFormazione(f);
      await onSaved();
    } finally { setBusy(false); }
  }

  return (
    <div className="fzr-mod">
      <div className="fzr-hint">{ammesso.descrizione}{ammesso.riferimento_norm ? ' \u2014 ' + ammesso.riferimento_norm : ''}</div>
      {valutato && (
        <div className="fzr-mod-stato">
          <span className={'fzr-dot ' + valutato.stato} title={TXT[valutato.stato]} />
          <span>{valutato.dettaglio}</span>
        </div>
      )}
      <label className="fzr-fig-row">
        <input type="checkbox" checked={applicabile} disabled={busy} onChange={(e) => setApplicabile(e.target.checked)} />
        <span>L'azienda ricade nell'obbligo di questo modulo aggiuntivo</span>
      </label>
      {applicabile && corso && (
        <>
          <div className="fzr-field">
            <label>Data completamento</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="fzr-row2">
            <div className="fzr-field"><label>Ore</label><input type="number" inputMode="decimal" value={ore} onChange={(e) => setOre(e.target.value)} /></div>
            <div className="fzr-field"><label>Ente formatore</label><input type="text" value={ente} onChange={(e) => setEnte(e.target.value)} /></div>
          </div>
          <div className="fzr-field">
            <label>Allegato (PDF o foto, facoltativo)</label>
            <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="fzr-actions">
            <button className="fzr-btn primary" disabled={busy || !data} onClick={() => void registra()}>Registra modulo</button>
          </div>
        </>
      )}
      {applicabile && !corso && <div className="fzr-d">Corso del modulo non trovato a catalogo.</div>}
    </div>
  );
}

export default function FormazioneRiepilogo({ clienteId, sopralluogoId, tecnicoId, tecnicoNome }: Props) {
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [errMsg, setErrMsg] = useState<string>('');
  const [riep, setRiep] = useState<RiepilogoCliente | null>(null);
  const [org, setOrg] = useState<OrganigrammaLocale | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  // pannelli aperti
  const [editKey, setEditKey] = useState<string | null>(null);       // requisito (personaId|corso)
  const [figPersona, setFigPersona] = useState<string | null>(null); // figure di una persona
  const [editPersona, setEditPersona] = useState<string | null>(null); // anagrafica di una persona
  const [addPersona, setAddPersona] = useState(false);
  const [coperturaAperta, setCoperturaAperta] = useState(true); // checklist figure attese (azionabile)
  const [assegnaFigura, setAssegnaFigura] = useState<string | null>(null); // codice figura in assegnazione

  // conferma tracciata
  const [conferma, setConferma] = useState<OrganigrammaConferma | null>(null);
  const [nota, setNota] = useState('');
  const [confBusy, setConfBusy] = useState(false);
  const [confMsg, setConfMsg] = useState<string>('');

  // Rivaluta SEMPRE dalla cache locale (cosi' riflette anche le scritture
  // offline appena fatte, prima della sincronizzazione).
  const ricaricaLocale = useCallback(async () => {
    if (!clienteId) { setStato('errore'); setErrMsg('Cliente non collegato a questo sopralluogo.'); return; }
    const o = await caricaOrganigrammaLocale(clienteId);
    if (o.figure.length === 0) {
      setRiep(null); setOrg(null);
      setStato('errore');
      setErrMsg(navigator.onLine
        ? 'Catalogo formazione non disponibile per questo cliente.'
        : 'Catalogo non disponibile offline: apri con connessione almeno una volta, o usa "Scarica per offline".');
      return;
    }
    const rischio = leggiRischioLocale(clienteId);
    const r = assemblaRiepilogo(
      clienteId,
      rischio,
      { persone: o.persone, nomine: o.nomine, formazioni: o.formazioni, esoneri: o.esoneri },
      { corsi: o.corsi, figure: o.figure, requisiti: o.requisiti, esoneriAmmessi: o.esoneriAmmessi },
    );
    setOrg(o);
    setRiep(r);
    setStato('ok');
  }, [clienteId]);

  useEffect(() => {
    const su = () => setOnline(true);
    const giu = () => setOnline(false);
    window.addEventListener('online', su);
    window.addEventListener('offline', giu);
    return () => { window.removeEventListener('online', su); window.removeEventListener('offline', giu); };
  }, []);

  useEffect(() => {
    if (!clienteId) { setStato('errore'); setErrMsg('Cliente non collegato a questo sopralluogo.'); return; }
    let vivo = true;
    setStato('loading');
    (async () => {
      if (navigator.onLine) {
        try { await prefetchOrganigramma(clienteId); } catch { /* best-effort */ }
        try {
          const { data } = await supabase.from('cliente').select('livello_rischio').eq('id', clienteId).single();
          localStorage.setItem(RK_KEY(clienteId), String((data as { livello_rischio?: string | null } | null)?.livello_rischio ?? ''));
        } catch { /* best-effort */ }
      }
      try {
        const cs = await db.conferme.where('sopralluogo_id').equals(sopralluogoId).toArray();
        cs.sort((a, b) => (b.data_conferma ?? '').localeCompare(a.data_conferma ?? ''));
        if (vivo && cs.length) setConferma(cs[0] ?? null);
      } catch { /* nessuna conferma locale */ }
      if (!vivo) return;
      try { await ricaricaLocale(); }
      catch { if (vivo) { setStato('errore'); setErrMsg('Impossibile leggere i dati di formazione.'); } }
    })();
    return () => { vivo = false; };
  }, [clienteId, sopralluogoId, ricaricaLocale]);

  async function conferma_(tipo: 'compilato' | 'confermato' | 'variato') {
    if (confBusy) return;
    setConfBusy(true);
    setConfMsg('');
    try {
      const c: OrganigrammaConferma = {
        id: newId(),
        sopralluogo_id: sopralluogoId,
        cliente_id: clienteId,
        tecnico_id: tecnicoId,
        tecnico_nome: tecnicoNome,
        tipo,
        data_conferma: new Date().toISOString(),
        note: nota.trim() || null,
      };
      const salvata = await salvaConfermaOrganigramma(c);
      setConferma(salvata);
      setNota('');

      // Snapshot versionato dell'organigramma (Parte 3): congela lo stato
      // corrente come revisione. Dedup locale per firma: niente revisione se
      // nulla e' cambiato dall'ultima salvata su questo dispositivo. Offline-safe
      // (accodata via outbox); non deve far fallire la conferma in caso di errore.
      try {
        if (riep && org && clienteId) {
          const rischioFirma = leggiRischioLocale(clienteId);
          const firma = firmaOrganigramma(
            { persone: org.persone, nomine: org.nomine, formazioni: org.formazioni, esoneri: org.esoneri },
            rischioFirma,
          );
          let firmaNota: string | null = null;
          try { firmaNota = localStorage.getItem(FIRMA_KEY(clienteId)); } catch { /* no storage */ }
          if (firma !== firmaNota) {
            let clienteNome = '';
            try { clienteNome = (await db.contesto.get(sopralluogoId))?.cliente_nome ?? ''; } catch { /* best-effort */ }
            await accodaRevisioneOrganigramma({
              id: newId(),
              cliente_id: clienteId,
              creata_il: new Date().toISOString(),
              autore: tecnicoNome,
              autore_tecnico_id: tecnicoId,
              origine: 'campo',
              firma,
              snapshot: costruisciSnapshot(riep, clienteNome),
            });
            try { localStorage.setItem(FIRMA_KEY(clienteId), firma); } catch { /* no storage */ }
          }
        }
      } catch { /* lo snapshot non deve far fallire la conferma */ }

      setConfMsg(tipo === 'variato' ? 'Variazione registrata.' : tipo === 'compilato' ? 'Organigramma compilato.' : 'Organigramma confermato.');
    } catch {
      setConfMsg('Salvataggio non riuscito, riprova.');
    } finally {
      setConfBusy(false);
    }
  }

  if (!clienteId) return <div className="empty">Cliente non collegato a questo sopralluogo.</div>;
  if (stato === 'loading') return <p className="muted">Carico lo stato formativo{'\u2026'}</p>;
  if (stato === 'errore') return <div className="empty">{errMsg || 'Dati non disponibili.'}</div>;
  if (!riep) return <div className="empty">Dati non disponibili.</div>;

  const vuoto = riep.persone.length === 0;

  // Copertura figure attese (come il tab Formazione del back-office): tutte le
  // figure del catalogo, raggruppate per blocco, con chi le copre e quali sono
  // scoperte. Qui la lista e' AZIONABILE: ogni figura ha "assegna/modifica" per
  // attaccarle un nominativo (persona esistente o nuova al volo).
  const scoperteSet = new Set(riep.figureScoperte.map((f) => f.codice));
  const figureAttese = (org?.figure ?? []).filter((f) => f.attiva)
    .slice().sort((a, b) => (a.gruppo_ordine ?? 999) - (b.gruppo_ordine ?? 999) || a.ordine - b.ordine);
  // mappa per capire se una figura, assegnandole una persona nuova, deve
  // chiedere la formazione pregressa. Usa la funzione CONDIVISA col back-office
  // (esclude antincendio/primo soccorso e il corso nuovo del Datore di lavoro).
  const reqCat = org?.requisiti ?? [];
  const corsiCat = org?.corsi ?? [];
  const figureChePregressa = new Set<string>();
  for (const f of figureAttese) {
    if (figuraChiedePregressa(f.codice, reqCat, corsiCat)) figureChePregressa.add(f.codice);
  }
  type RigaCop = { figura: FiguraSicurezza; assegnate: typeof riep.persone };
  const gruppiCopertura: { nome: string; righe: RigaCop[] }[] = [];
  for (const f of figureAttese) {
    const assegnate = riep.persone.filter((p) => p.figure.some((x) => x.codice === f.codice));
    const g = f.gruppo || 'Altre figure';
    let grp = gruppiCopertura.find((x) => x.nome === g);
    if (!grp) { grp = { nome: g, righe: [] }; gruppiCopertura.push(grp); }
    grp.righe.push({ figura: f, assegnate });
  }
  // tutte le persone in organigramma (per il selettore di assegnazione)
  const tuttePersone = riep.persone.map((p) => p.persona);
  // catalogo: corso per codice (per i moduli) ed esoneri ammessi attivi
  const corsoByCodice = new Map((org?.corsi ?? []).map((c) => [c.codice, c]));
  const ammessoById = new Map((org?.esoneriAmmessi ?? []).map((a) => [a.id, a]));
  // persone senza alcuna figura assegnata (per non perderle: vanno gestite a parte)
  const orfani = riep.persone.filter((p) => p.figure.length === 0);

  return (
    <div className="fzr">
      <style>{CSS}</style>

      {!online && <div className="fzr-warn">Sei offline: le modifiche vengono salvate e sincronizzate al ritorno della rete.</div>}

      <div className="fzr-head">
        <div className="fzr-tot">
          <span className="fzr-sem conforme">{riep.conteggi.conforme} conformi</span>
          <span className="fzr-sem in_scadenza">{riep.conteggi.in_scadenza} in scadenza</span>
          <span className="fzr-sem critico">{riep.conteggi.critico} critici</span>
          {riep.conteggi.esonerato > 0 && <span className="fzr-sem esonerato">{riep.conteggi.esonerato} esonerati</span>}
          {riep.conteggi.da_verificare > 0 && <span className="fzr-sem da_verificare">{riep.conteggi.da_verificare} da verificare</span>}
        </div>
        <button className="fzr-add" onClick={() => { setAddPersona((v) => !v); setEditPersona(null); }}>+ Persona</button>
      </div>

      {addPersona && (
        <div className="fzr-p">
          <b>Nuova persona</b>
          <PersonaForm persona={null} clienteId={clienteId} onSaved={ricaricaLocale} onClose={() => setAddPersona(false)} />
        </div>
      )}

      {figureAttese.length > 0 && (
        <div className="fzr-cop">
          <button type="button" className="fzr-cop-h" onClick={() => setCoperturaAperta((v) => !v)}>
            <span>
              Figure attese (copertura)
              {riep.figureScoperte.length > 0 && (
                <span style={{ color: 'var(--no,#d8442f)', fontWeight: 800 }}> {'\u00b7'} {riep.figureScoperte.length} scoperte</span>
              )}
            </span>
            <span style={{ fontSize: 16 }}>{coperturaAperta ? '\u2212' : '+'}</span>
          </button>
          {coperturaAperta && (
            <div className="fzr-cop-body">
              {gruppiCopertura.map((g) => (
                <div key={g.nome}>
                  <div className="fzr-grp">{g.nome}</div>
                  {g.righe.map(({ figura, assegnate }) => {
                    const scoperta = scoperteSet.has(figura.codice);
                    const stato = assegnate.length ? 'conforme' : (scoperta ? 'critico' : 'in_scadenza');
                    const aperto = assegnaFigura === figura.codice;
                    const guidaRighe = (figura.guida ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
                    return (
                      <div key={figura.codice} className="fzr-figrow">
                        <div className="fzr-figrow-top">
                          <span className="fzr-dot-wrap">
                            <span className={'fzr-dot ' + stato} />
                          </span>
                          <span className="fzr-figrow-nome">
                            {figura.nome}
                            {figura.obbligo && <span className={'fzr-badge ' + figura.obbligo}>{LABEL_OBBLIGO[figura.obbligo] ?? figura.obbligo}</span>}
                          </span>
                          <button className="fzr-edit-btn" onClick={() => setAssegnaFigura(aperto ? null : figura.codice)}>
                            {aperto ? 'Chiudi' : (assegnate.length ? 'Modifica' : 'Assegna')}
                          </button>
                        </div>

                        {guidaRighe.length > 0 && (
                          <ul className="fzr-guida">
                            {guidaRighe.map((l, i) => (
                              l.startsWith('- ') ? <li key={i} className="sub">{l.slice(2).trim()}</li> : <li key={i}>{l}</li>
                            ))}
                          </ul>
                        )}

                        {aperto && org && (
                          <AssegnaFiguraPanel
                            figura={figura}
                            persone={tuttePersone}
                            clienteId={clienteId}
                            chiediPregressa={figureChePregressa.has(figura.codice)}
                            onSaved={ricaricaLocale}
                            onClose={() => setAssegnaFigura(null)}
                          />
                        )}

                        {assegnate.length === 0 ? (
                          <div className={'fzr-figrow-people'}>
                            <span className={scoperta ? 'fzr-figrow-crit' : 'fzr-figrow-empty'}>
                              {scoperta ? 'scoperto (obbligatorio)' : 'non assegnata'}
                            </span>
                          </div>
                        ) : (
                          <div className="fzr-inc">
                            <div className="fzr-inc-h">Incaricati</div>
                            {assegnate.map((pv) => {
                              const fg = pv.figure.find((x) => x.codice === figura.codice);
                              const nomina = (org?.nomine ?? []).find((n) => n.id === fg?.nomina_id) ?? null;
                              const anagKey = pv.persona.id + '|' + figura.codice;
                              const anagAperto = editPersona === anagKey;
                              const reqs = pv.requisiti.filter((r) => r.figura_codici.includes(figura.codice));
                              const mods = pv.moduli.filter((m) => m.figura_codice === figura.codice && m.stato !== 'esonerato');
                              return (
                                <div key={pv.persona.id} className="fzr-inc-card">
                                  <div className="fzr-inc-top">
                                    <span className="fzr-inc-nome">
                                      <span className={'fzr-dot ' + pv.stato} title={TXT[pv.stato]} />
                                      {nomePersona(pv.persona)}
                                    </span>
                                    <button className="fzr-edit-btn" onClick={() => setEditPersona(anagAperto ? null : anagKey)}>
                                      {anagAperto ? 'Chiudi' : 'Modifica'}
                                    </button>
                                  </div>

                                  {anagAperto && (
                                    <PersonaForm persona={pv.persona} clienteId={clienteId} onSaved={ricaricaLocale} onClose={() => setEditPersona(null)} />
                                  )}

                                  <NominaInline nomina={nomina} onSaved={ricaricaLocale} />

                                  {reqs.map((r) => {
                                    const key = pv.persona.id + '|' + figura.codice + '|' + r.corso_codice;
                                    const apertoR = editKey === key;
                                    return (
                                      <div key={r.corso_codice} className="fzr-r">
                                        <div className="fzr-r-main">
                                          <span className="fzr-r-name">
                                            <span className={'fzr-dot ' + r.stato} title={TXT[r.stato]} />
                                            <span>{r.corso_nome}{r.ore != null ? ' \u00b7 ' + r.ore + 'h' : ''}</span>
                                          </span>
                                          <span className="fzr-r-right">
                                            <span className={'fzr-st ' + r.stato}>{TXT[r.stato]}</span>
                                            <button className="fzr-edit-btn" onClick={() => setEditKey(apertoR ? null : key)}>
                                              {apertoR ? 'Chiudi' : (r.esonero_id ? 'Esonero' : 'Registra')}
                                            </button>
                                          </span>
                                        </div>
                                        <div className="fzr-d">{r.dettaglio}</div>
                                        {!apertoR && r.promemoria.map((a) => (
                                          <div key={a.id} className="fzr-hint">
                                            {a.descrizione}{a.riferimento_norm ? ' \u2014 ' + a.riferimento_norm : ''}
                                          </div>
                                        ))}
                                        {apertoR && (
                                          <EditorRequisito
                                            personaId={pv.persona.id}
                                            req={r}
                                            figuraCodice={figura.codice}
                                            alternative={(org?.corsi ?? []).filter((c) => (c.categoria ?? '') === r.categoria)}
                                            onSaved={ricaricaLocale}
                                            onClose={() => setEditKey(null)}
                                          />
                                        )}
                                      </div>
                                    );
                                  })}

                                  {mods.map((mv) => (
                                    <div key={'mod-' + mv.corso_codice} className="fzr-r">
                                      <div className="fzr-r-main">
                                        <span className="fzr-r-name">
                                          <span className={'fzr-dot ' + mv.stato} title={TXT[mv.stato]} />
                                          <span>{mv.corso_nome}<span className="fzr-modtag">modulo</span></span>
                                        </span>
                                        <span className={'fzr-st ' + mv.stato}>{TXT[mv.stato]}</span>
                                      </div>
                                      <ModuloInline
                                        ammesso={ammessoById.get(mv.ammesso_id) ?? { id: mv.ammesso_id, corso_codice: mv.corso_codice, figura_codice: figura.codice, tipo: 'altro', descrizione: mv.dettaglio, riferimento_norm: null, ordine: 0, attivo: true }}
                                        corso={corsoByCodice.get(mv.corso_codice)}
                                        personaId={pv.persona.id}
                                        valutato={mv}
                                        onSaved={ricaricaLocale}
                                      />
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {orfani.length > 0 && (
        <div className="fzr-grp" style={{ marginTop: 14 }}>Persone non ancora assegnate a una figura</div>
      )}

      {vuoto && !addPersona && (
        <div className="empty">Nessuna persona in organigramma. Assegna un nominativo a una figura qui sopra, oppure usa "+ Persona".</div>
      )}

      {orfani.map((pv) => {
        const figAperto = figPersona === pv.persona.id;
        const anagAperto = editPersona === pv.persona.id;
        return (
          <div key={pv.persona.id} className="fzr-p">
            <div className="fzr-p-top">
              <div>
                <b>{nomePersona(pv.persona)}</b>
                <div className="fzr-fig">{pv.persona.mansione || 'nessuna figura assegnata'}</div>
              </div>
              <span className={'fzr-sem ' + pv.stato}>{TXT[pv.stato]}</span>
            </div>
            <div className="fzr-p-actions">
              <button className={'fzr-mini' + (figAperto ? ' on' : '')} onClick={() => { setFigPersona(figAperto ? null : pv.persona.id); setEditPersona(null); }}>Assegna figure</button>
              <button className={'fzr-mini' + (anagAperto ? ' on' : '')} onClick={() => { setEditPersona(anagAperto ? null : pv.persona.id); setFigPersona(null); }}>Modifica</button>
            </div>
            {anagAperto && (
              <PersonaForm persona={pv.persona} clienteId={clienteId} onSaved={ricaricaLocale} onClose={() => setEditPersona(null)} />
            )}
            {figAperto && org && (
              <FigurePanel persona={pv.persona} figure={org.figure} nomine={org.nomine} onSaved={ricaricaLocale} onClose={() => setFigPersona(null)} />
            )}
          </div>
        );
      })}

      <div className="fzr-conf">
        <h4>Conferma organigramma</h4>
        {conferma && (
          <div className="fzr-conf-last">
            Ultima: <b>{conferma.tipo === 'variato' ? 'variato' : conferma.tipo === 'compilato' ? 'compilato' : 'confermato'}</b>
            {conferma.data_conferma ? ' il ' + new Date(conferma.data_conferma).toLocaleDateString('it-IT') : ''}
            {conferma.tecnico_nome ? ' da ' + conferma.tecnico_nome : ''}
          </div>
        )}
        <textarea
          placeholder="Nota sulla conferma (facoltativa)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
        <div className="fzr-actions">
          {vuoto ? (
            <button className="fzr-btn ghost" disabled>Aggiungi almeno una persona</button>
          ) : conferma ? (
            <>
              <button className="fzr-btn primary" disabled={confBusy} onClick={() => void conferma_('confermato')}>Conferma (nessuna variazione)</button>
              <button className="fzr-btn ghost" disabled={confBusy} onClick={() => void conferma_('variato')}>Salva variazione</button>
            </>
          ) : (
            <button className="fzr-btn primary" disabled={confBusy} onClick={() => void conferma_('compilato')}>Conferma organigramma compilato</button>
          )}
        </div>
        {confMsg && <div className="fzr-conf-last" style={{ marginTop: 8 }}>{confMsg}</div>}
      </div>
    </div>
  );
}
