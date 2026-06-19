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

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type RiepilogoCliente, type RequisitoValutato, type StatoRequisito,
  type LivelloRischio, type TipoEsonero, type Formazione, type Esonero,
  type Persona, type Nomina, type FiguraSicurezza,
  assemblaRiepilogo, nomePersona, CATEGORIE_NO_PREGRESSA,
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
.fzr-field input, .fzr-field select{width:100%; box-sizing:border-box; padding:8px 9px; border:1px solid var(--line,#e3ddd2); border-radius:8px; font-size:13px; background:#fff; color:var(--ink,#2a2c30);}
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
.fzr-conf textarea{width:100%; box-sizing:border-box; padding:8px 9px; border:1px solid var(--line,#e3ddd2); border-radius:8px; font-size:13px; min-height:54px; resize:vertical; background:#fff; color:var(--ink,#2a2c30); margin-bottom:8px;}
.fzr-warn{font-size:11.5px; color:var(--hi-dark,#9a6206); background:#fbf0d6; border-radius:8px; padding:6px 9px; margin-bottom:10px;}
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
          <input type="text" value={cognome} onChange={(e) => setCognome(e.target.value)} />
        </div>
        <div className="fzr-field">
          <label>Nome</label>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
      </div>
      <div className="fzr-field">
        <label>Mansione</label>
        <input type="text" value={mansione} onChange={(e) => setMansione(e.target.value)} />
      </div>
      <div className="fzr-field">
        <label>Codice fiscale (facoltativo)</label>
        <input type="text" value={cf} onChange={(e) => setCf(e.target.value)} />
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
  personaId, req, alternative, onSaved, onClose,
}: {
  personaId: string;
  req: RequisitoValutato;
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
        figura_codice: null,
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

      {vuoto && !addPersona && (
        <div className="empty">Nessuna persona in organigramma. Usa "+ Persona" per iniziare a compilarlo.</div>
      )}

      {riep.persone.map((pv) => {
        const figAperto = figPersona === pv.persona.id;
        const anagAperto = editPersona === pv.persona.id;
        return (
          <div key={pv.persona.id} className="fzr-p">
            <div className="fzr-p-top">
              <div>
                <b>{nomePersona(pv.persona)}</b>
                <div className="fzr-fig">{pv.figure.map((f) => f.nome).join(' \u00b7 ') || 'nessuna figura'}</div>
              </div>
              <span className={'fzr-sem ' + pv.stato}>{TXT[pv.stato]}</span>
            </div>

            <div className="fzr-p-actions">
              <button className={'fzr-mini' + (figAperto ? ' on' : '')} onClick={() => { setFigPersona(figAperto ? null : pv.persona.id); setEditPersona(null); }}>Figure</button>
              <button className={'fzr-mini' + (anagAperto ? ' on' : '')} onClick={() => { setEditPersona(anagAperto ? null : pv.persona.id); setFigPersona(null); }}>Modifica</button>
            </div>

            {anagAperto && (
              <PersonaForm persona={pv.persona} clienteId={clienteId} onSaved={ricaricaLocale} onClose={() => setEditPersona(null)} />
            )}

            {figAperto && org && (
              <FigurePanel persona={pv.persona} figure={org.figure} nomine={org.nomine} onSaved={ricaricaLocale} onClose={() => setFigPersona(null)} />
            )}

            {pv.requisiti.map((r) => {
              const key = pv.persona.id + '|' + r.corso_codice;
              const aperto = editKey === key;
              return (
                <div key={r.corso_codice} className="fzr-r">
                  <div className="fzr-r-main">
                    <span className="fzr-r-name">
                      <span className={'fzr-dot ' + r.stato} title={TXT[r.stato]} />
                      <span>{r.corso_nome}{r.ore != null ? ' \u00b7 ' + r.ore + 'h' : ''}</span>
                    </span>
                    <button className="fzr-edit-btn" onClick={() => setEditKey(aperto ? null : key)}>
                      {aperto ? 'Chiudi' : (r.esonero_id ? 'Esonero' : 'Registra')}
                    </button>
                  </div>
                  <div className="fzr-d">{r.dettaglio}</div>
                  {!aperto && r.promemoria.map((a) => (
                    <div key={a.id} className="fzr-hint">
                      {a.descrizione}{a.riferimento_norm ? ' \u2014 ' + a.riferimento_norm : ''}
                    </div>
                  ))}
                  {aperto && (
                    <EditorRequisito
                      personaId={pv.persona.id}
                      req={r}
                      alternative={(org?.corsi ?? []).filter((c) => (c.categoria ?? '') === r.categoria)}
                      onSaved={ricaricaLocale}
                      onClose={() => setEditKey(null)}
                    />
                  )}
                </div>
              );
            })}
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
