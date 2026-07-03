// OrganigrammaView - COMPONENTE DI RENDERING CONDIVISO dell'organigramma
// sicurezza/formazione, usato IDENTICO dal back-office (src/admin/Formazione.tsx)
// e dal campo (src/FormazioneRiepilogo.tsx). UNICA sorgente di verita' della UI:
// una modifica qui si riflette in entrambi i contesti.
//   - Le LETTURE arrivano gia' valutate dal motore puro assemblaRiepilogo (lo
//     stesso per i due contesti): il componente riceve `riep` + `catalogo`.
//   - Le SCRITTURE passano per un ADAPTER iniettato dal guscio: il back-office
//     inietta le funzioni ONLINE (Supabase), il campo quelle OFFLINE (sync.ts).
//   - Tutto inline (niente modali): figure-first con guida, incaricati, data di
//     nomina, requisiti per ruolo + editor attestato/esonero, moduli aggiuntivi,
//     assegnazione e scelta formazione pregressa.
// Eredita la palette del contesto (var --ok/--no/--hi/--ink/--line) con fallback,
// quindi rende bene sia sotto .compila (campo) sia nel back-office (.bo).

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { pulisci as pulisciCF, valido as cfValido, crossCheck as cfCrossCheck, analizzaCF, type DatiCF } from './codiceFiscale';
import {
  type RiepilogoCliente, type RequisitoValutato, type StatoRequisito,
  type TipoEsonero, type Formazione, type Esonero,
  type Persona, type Nomina, type FiguraSicurezza, type ModuloValutato, type EsoneroAmmesso,
  type CorsoCatalogo, type Catalogo,
  nomePersona, CATEGORIE_NO_PREGRESSA, figuraChiedePregressa, corsoEmergenzaRichiesto,
} from '../lib/admin/formazione';
import { newId } from '../lib/types';

// Adapter delle SCRITTURE: il guscio inietta online (back-office) o offline (campo).
export interface OrganigrammaAdapter {
  salvaPersona(p: Persona): Promise<Persona>;
  eliminaPersona(id: string): Promise<void>;
  salvaNomina(n: Nomina): Promise<Nomina>;
  eliminaNomina(id: string): Promise<void>;
  salvaFormazione(f: Formazione): Promise<Formazione>;
  salvaFormazioneConAllegato(f: Formazione, file: File): Promise<Formazione>;
  eliminaFormazione(id: string): Promise<void>;
  salvaEsonero(e: Esonero): Promise<Esonero>;
  eliminaEsonero(id: string): Promise<void>;
  apriAllegato(path: string): Promise<void>;
  maxAllegatoBytes: number;
  onCambia(): Promise<void>;   // ricarica/rivaluta dopo una scrittura
}

const AdapterCtx = createContext<OrganigrammaAdapter | null>(null);
function useAdapter(): OrganigrammaAdapter {
  const a = useContext(AdapterCtx);
  if (!a) throw new Error('OrganigrammaView: adapter mancante (manca il Provider).');
  return a;
}

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

const oggiISO = () => new Date().toISOString().slice(0, 10);

const CSS = `
.fzr{font-size:13px;}
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
.fzr-dot.neutro{background:#b9bdc4;}
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
.fzr-cop-bar{padding:9px 11px; background:#f6f2ea; border-bottom:1px solid var(--line,#e3ddd2);}
.fzr-cop-barhead{font-size:12px; font-weight:700; color:var(--ink-soft,#5b5f66); margin-bottom:8px;}
.fzr-figgrp{margin-bottom:8px;}
.fzr-figgrp:last-child{margin-bottom:0;}
.fzr-figgrp-name{font-size:10.5px; font-weight:800; letter-spacing:.03em; text-transform:uppercase; color:var(--ink-soft,#5b5f66); margin-bottom:5px;}
.fzr-figchips{display:flex; flex-wrap:wrap; gap:8px;}
/* Chip figura: piu' grandi e con lo STATO come colore di sfondo pieno (non solo la spia). */
.fzr-figchip{display:inline-flex; align-items:center; gap:8px; border:1.5px solid transparent; background:#fff; border-radius:12px; padding:9px 14px; font:inherit; font-size:14px; font-weight:700; color:#fff; cursor:pointer; transition:.12s; box-shadow:0 1px 2px rgba(0,0,0,.06);}
.fzr-figchip:hover{filter:brightness(1.04); box-shadow:0 2px 6px rgba(0,0,0,.12);}
.fzr-figchip.on{box-shadow:0 0 0 3px rgba(0,0,0,.14), 0 2px 6px rgba(0,0,0,.12);}
.fzr-figchip .fzr-dot{width:12px; height:12px; box-shadow:0 0 0 2px rgba(255,255,255,.6);}
.fzr-figchip.critico{background:var(--no,#d8442f); border-color:#b8371f;}
.fzr-figchip.in_scadenza{background:var(--hi,#f4a012); border-color:#cf8608; color:#3a2a05;}
.fzr-figchip.conforme{background:var(--ok,#1f9d57); border-color:#178046;}
.fzr-figchip.esonerato{background:#3b6fd0; border-color:#2f5aad;}
.fzr-figchip.da_verificare{background:#7a8aa6; border-color:#657495;}
.fzr-figchip.neutro{background:#eef0f2; border-color:#dcdfe3; color:var(--ink-soft,#5b5f66);}
.fzr-figchip.neutro .fzr-dot{box-shadow:0 0 0 2px rgba(255,255,255,.9);}
/* ---- Diagramma grafico dell'organigramma (schema gerarchico D.Lgs. 81/08) ---- */
.fzr-diag{border:1px solid var(--line,#e3ddd2); border-radius:10px; margin:4px 0 12px; padding:0; background:var(--paper,#faf7f1); overflow:hidden;}
.fzr-diag-svgwrap{min-width:380px; padding:14px 12px 16px; overflow-x:auto;}
.fzr-diag svg{display:block; width:100%; height:auto; overflow:visible;}
.fzr-onode{box-sizing:border-box; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:0; border-radius:7px; border:1px solid transparent; padding:1px 3px; cursor:pointer; color:#fff; line-height:1.05; transition:.12s; box-shadow:0 1px 2px rgba(0,0,0,.06);}
.fzr-onode:hover{filter:brightness(1.05);}
.fzr-onode.on{box-shadow:0 0 0 1.5px #1c1d20, 0 1px 2px rgba(0,0,0,.06);}
.fzr-onode-lab{font-size:8px; font-weight:600;}
.fzr-onode-n{font-size:7px; font-weight:500; opacity:.9;}
.fzr-onode.critico{background:var(--no,#d8442f); border-color:#b8371f;}
.fzr-onode.in_scadenza{background:var(--hi,#f4a012); border-color:#cf8608; color:#3a2a05;}
.fzr-onode.conforme{background:var(--ok,#1f9d57); border-color:#178046;}
.fzr-onode.esonerato{background:#3b6fd0; border-color:#2f5aad;}
.fzr-onode.da_verificare{background:#7a8aa6; border-color:#657495;}
.fzr-onode.neutro{background:#eef0f2; border-color:#dcdfe3; color:#5b5f66;}
.fzr-diag-line{stroke:#b9b2a4; stroke-width:1.6; fill:none;}
.fzr-legenda{display:flex; flex-wrap:wrap; gap:10px 14px; margin:0 0 9px; font-size:11px; color:var(--ink-soft,#5b5f66);}
.fzr-legenda span{display:inline-flex; align-items:center; gap:5px;}
.fzr-emerg{font-size:11.5px; color:var(--hi-dark,#9a6206); background:#fbf0d6; border-radius:8px; padding:5px 8px; margin:5px 0 0 18px; line-height:1.4;}
.fzr-figchip-nome{white-space:nowrap;}
.fzr-figchip-n{font-size:11px; font-weight:800; background:rgba(255,255,255,.28); color:inherit; border-radius:999px; padding:1px 7px; min-width:18px; text-align:center;}
.fzr-figchip.neutro .fzr-figchip-n{background:#e0e2e6;}
.fzr-figchip-pm{font-size:16px; font-weight:800; color:inherit; opacity:.85; width:13px; text-align:center; line-height:1;}
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
/* ---- Layout ORGANIGRAMMA ATTUALE (tabella) + azione AGGIORNA ---- */
.fzr-split{display:flex; gap:12px; align-items:flex-start;}
.fzr-split-main{flex:0 0 80%; max-width:80%; min-width:0;}
.fzr-split-side{flex:1 1 20%; min-width:0; display:flex; flex-direction:column; gap:8px; position:sticky; top:8px;}
.fzr-col-title{font-size:12px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:var(--ink,#2a2c30); margin:0 0 8px;}
.fzr-aggiorna{width:100%; background:var(--ink,#2a2c30); color:#fff; border:none; border-radius:10px; padding:12px 14px; font:inherit; font-size:13px; font-weight:800; cursor:pointer; text-transform:uppercase; letter-spacing:.02em; box-shadow:0 1px 2px rgba(0,0,0,.08);}
.fzr-aggiorna:hover{filter:brightness(1.08);}
.fzr-aggiorna.on{background:var(--no,#d8442f);}
.fzr-side-note{font-size:11.5px; font-weight:700; color:var(--no,#d8442f); text-align:center;}
.fzr-tab{border:1px solid var(--line,#e3ddd2); border-radius:10px; overflow:hidden;}
.fzr-tab table{width:100%; border-collapse:collapse; font-size:12px;}
.fzr-tab thead th{text-align:left; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-soft,#5b5f66); background:#faf7f1; border-bottom:1px solid var(--line,#e3ddd2); padding:6px 10px; font-weight:800;}
.fzr-tab td{border-top:1px solid var(--line,#e3ddd2); padding:7px 10px; vertical-align:top;}
.fzr-tab tr.clic{cursor:pointer;} .fzr-tab tr.clic:hover td{background:#faf7ef;}
.fzr-tab .ruolo{font-weight:700; width:24%; white-space:nowrap;}
.fzr-tab .cpers{width:26%;}
.fzr-tab .pn{font-weight:600;} .fzr-tab .pm{font-size:11px; color:var(--ink-soft,#5b5f66); margin-top:1px;}
.fzr-tab .vuoto{color:var(--no,#d8442f); font-style:italic;}
.fzr-tab .ev{display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:2px 0;}
.fzr-tab .ev + .ev{border-top:1px dotted #ece7dd;}
.fzr-tab .corso{font-size:11.5px; line-height:1.35;}
.fzr-tab .scad{color:var(--ink-soft,#5b5f66);}
.fzr-tab .none{color:#9a958c; font-style:italic; font-size:11.5px;}
@media (max-width:720px){ .fzr-split{flex-direction:column;} .fzr-split-main,.fzr-split-side{flex:1 1 100%; max-width:100%;} .fzr-split-side{position:static;} }
`;

interface Props {
  clienteId: string;
  riep: RiepilogoCliente;
  catalogo: Catalogo;
  adapter: OrganigrammaAdapter;
  // RLS territoriale: mostrato solo se il guscio fornisce la scrittura (back-office).
  rlsTerritoriale?: boolean | null;
  onRlsTerritoriale?: (v: boolean) => Promise<void>;
  // Evidenze pregresse (batch): extra del back-office, aperto dal form persona.
  onEvidenzePregresse?: (persona: Persona) => void;
  // Schema grafico: on/off pilotato dal guscio (bottone nella barra in alto).
  mostraSchema?: boolean;
}

// ---------- form anagrafica persona (nuova o modifica) ----------
function PersonaForm({
  persona, clienteId, onSaved, onClose, onEvidenzePregresse, mostraRimuoviPersona = true,
}: {
  persona: Persona | null;
  clienteId: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onEvidenzePregresse?: (persona: Persona) => void;
  mostraRimuoviPersona?: boolean;
}) {
  const adapter = useAdapter();
  const [cognome, setCognome] = useState(persona?.cognome ?? '');
  const [nome, setNome] = useState(persona?.nome ?? '');
  const [mansione, setMansione] = useState(persona?.mansione ?? '');
  const [cf, setCf] = useState(persona?.codice_fiscale ?? '');
  const [cfInfo, setCfInfo] = useState<DatiCF | null>(null);
  useEffect(() => {
    let vivo = true;
    if (!cfValido(cf)) { setCfInfo(null); return; }
    analizzaCF(cf).then((d) => { if (vivo) setCfInfo(d); }).catch(() => { if (vivo) setCfInfo(null); });
    return () => { vivo = false; };
  }, [cf]);
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
      await adapter.salvaPersona(p);
      await onSaved();
      onClose();
    } finally { setBusy(false); }
  }

  async function rimuovi() {
    if (!persona) return;
    if (!window.confirm('Rimuovere definitivamente ' + nomePersona(persona) + ' dall\u2019organigramma?\n\nVerr\u00e0 tolta da TUTTI i ruoli a cui \u00e8 assegnata, con le sue nomine, attestati ed esoneri. L\u2019operazione non si pu\u00f2 annullare.\n\nPer toglierla da un solo ruolo, usa invece \u00abRimuovi dal ruolo\u00bb nella scheda del ruolo.')) return;
    setBusy(true);
    try { await adapter.eliminaPersona(persona.id); await onSaved(); onClose(); }
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
        {(() => {
          const c = pulisciCF(cf);
          if (c.length === 0) return null;
          if (c.length !== 16) return <small style={{ color: 'var(--faint)' }}>Codice fiscale incompleto ({c.length}/16).</small>;
          if (!cfValido(c)) return <small style={{ color: 'var(--no)' }}>Carattere di controllo non valido.</small>;
          const x = cfCrossCheck(cognome, nome, c);
          const warn: string[] = [];
          if (x.cognomeOk === false) warn.push('cognome');
          if (x.nomeOk === false) warn.push('nome');
          return warn.length
            ? <small style={{ color: 'var(--hi-dark)' }}>Valido, ma non combacia col {warn.join(' e ')}.</small>
            : <small style={{ color: 'var(--ok)' }}>Codice fiscale valido.</small>;
        })()}
        {cfInfo && cfInfo.dataISO && (
          <small style={{ color: 'var(--faint)', display: 'block' }}>
            Nato il {cfInfo.dataISO.split('-').reverse().join('/')}
            {cfInfo.luogoNoto ? ` a ${cfInfo.estero ? cfInfo.stato : `${cfInfo.comune} (${cfInfo.prov})`}` : ''}
            {` \u00b7 ${cfInfo.sesso === 'F' ? 'F' : 'M'}`}
          </small>
        )}
      </div>
      <label className="chk" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '2px 0 4px' }}>
        <input type="checkbox" checked={pregressa} onChange={(e) => setPregressa(e.target.checked)} />
        <span>Formazione pregressa (azienda già operante prima dell'ASR 2025): i requisiti senza attestato risultano "da verificare" invece di "critici".</span>
      </label>
      {pregressa && persona && onEvidenzePregresse && (
        <div className="fzr-actions" style={{ marginBottom: 4 }}>
          <button className="fzr-btn ghost" disabled={busy} onClick={() => onEvidenzePregresse(persona)}>Evidenze pregresse</button>
        </div>
      )}
      <div className="fzr-actions">
        <button className="fzr-btn primary" disabled={busy} onClick={() => void salva()}>{persona ? 'Salva' : 'Aggiungi'}</button>
        <button className="fzr-btn ghost" disabled={busy} onClick={onClose}>Annulla</button>
      </div>
      {persona && mostraRimuoviPersona && (
        <div className="fzr-actions" style={{ marginTop: 8 }}>
          <button className="fzr-btn danger" disabled={busy} onClick={() => void rimuovi()}>Rimuovi persona (da tutti i ruoli)</button>
        </div>
      )}
    </div>
  );
}

// ---------- pannello assegnazione PER FIGURA (paradigma back-office) ----------
// Aperto dal bottone "assegna/modifica" di una riga-figura: si spuntano le
// persone gia' in organigramma da incaricare di QUELLA figura, e/o se ne crea
// una nuova al volo (cognome/nome). Per chi viene assegnato per la prima volta a
// un ruolo con formazione soggetta al regime ASR 2025 si chiede (scelta esplicita
// SI/NO) se ha formazione pregressa. Scritture via adapter.
function AssegnaFiguraPanel({
  figura, persone, titolari, clienteId, chiediPregressa, onSaved, onClose, onEvidenzePregresse,
}: {
  figura: FiguraSicurezza;
  persone: Persona[];
  titolari: { personaId: string; nominaId: string | null }[];
  clienteId: string;
  chiediPregressa: boolean;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onEvidenzePregresse?: (p: Persona) => void;
}) {
  const adapter = useAdapter();
  const titolariIds = useMemo(() => titolari.map((t) => t.personaId), [titolari]);
  const [sel, setSel] = useState<Set<string>>(() => new Set(titolariIds));
  const [busy, setBusy] = useState(false);
  // passo 2: per chi e' appena stato assegnato si chiede la formazione pregressa
  const [step, setStep] = useState<'assegna' | 'pregressa'>('assegna');
  const [nuove, setNuove] = useState<Persona[]>([]);
  const [risposte, setRisposte] = useState<Record<string, 'si' | 'no'>>({});

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function salva() {
    if (busy) return;
    setBusy(true);
    try {
      const dopo = new Set(sel);
      const aggiunte: Persona[] = [];
      // aggiunte: selezionati ora ma non titolari prima
      for (const id of dopo) {
        if (titolariIds.includes(id)) continue;
        await adapter.salvaNomina({ id: newId(), persona_id: id, figura_codice: figura.codice, data_nomina: oggiISO(), attiva: true, note: null });
        if (!aggiunte.some((a) => a.id === id)) {
          const p = persone.find((x) => x.id === id);
          if (p) aggiunte.push(p);
        }
      }
      // rimozioni: titolari prima ma non piu' selezionati
      for (const t of titolari) {
        if (dopo.has(t.personaId)) continue;
        if (t.nominaId) await adapter.eliminaNomina(t.nominaId);
      }
      // passo 2 (pregressa) solo per chi e' stato assegnato ex-novo a un ruolo
      // con formazione soggetta al regime ASR 2025.
      if (chiediPregressa && aggiunte.length > 0) {
        setNuove(aggiunte);
        setRisposte(Object.fromEntries(aggiunte.map((p) => [p.id, 'no'])) as Record<string, 'si' | 'no'>);
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
      const conPregressa: Persona[] = [];
      for (const p of nuove) {
        if (risposte[p.id] === 'si') {
          const agg = { ...p, formazione_pregressa: true };
          await adapter.salvaPersona(agg);
          conPregressa.push(agg);
        }
      }
      await onSaved();
      onClose();
      // Apri SUBITO il pannello "Evidenze pregresse" per la prima persona
      // dichiarata pregressa: l'utente carica gli attestati senza doverli
      // cercare/aprire riga per riga (la scelta pregressa implica il caricamento).
      if (conPregressa.length > 0 && onEvidenzePregresse) onEvidenzePregresse(conPregressa[0]);
    } finally { setBusy(false); }
  }

  if (step === 'pregressa') {
    const tutteScelte = nuove.every((p) => risposte[p.id] === 'si' || risposte[p.id] === 'no');
    return (
      <div className="fzr-ed">
        <div className="fzr-hint" style={{ marginTop: 0 }}>
          Per ogni persona appena assegnata a &laquo;{figura.nome}&raquo;: l'azienda era gi&agrave;
          operante prima dell'ASR 2025 con formazione pregressa? Se <b>S&igrave;</b> i requisiti
          senza attestato risultano &laquo;da verificare&raquo; invece di &laquo;critici&raquo;;
          se <b>No</b> si procede con la formazione prevista dall'ASR 2025.
        </div>
        {nuove.map((p) => (
          <div key={p.id} className="fzr-preg-row">
            <span className="fzr-preg-nome">{nomePersona(p)}</span>
            <span className="fzr-preg-choice">
              <button className={'fzr-mini' + (risposte[p.id] === 'si' ? ' on' : '')} disabled={busy}
                onClick={() => setRisposte((r) => ({ ...r, [p.id]: 'si' }))}>S&igrave;, pregressa</button>
              <button className={'fzr-mini' + (risposte[p.id] === 'no' ? ' on' : '')} disabled={busy}
                onClick={() => setRisposte((r) => ({ ...r, [p.id]: 'no' }))}>No, ASR 2025</button>
            </span>
          </div>
        ))}
        <div className="fzr-actions" style={{ marginTop: 8 }}>
          <button className="fzr-btn primary" disabled={busy || !tutteScelte} onClick={() => void confermaPregressa()}>Conferma</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fzr-ed">
      <div className="fzr-grp" style={{ marginTop: 0 }}>Assegnatari del ruolo</div>
      {persone.filter((p) => sel.has(p.id)).length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
          {persone.filter((p) => sel.has(p.id)).map((p) => (
            <span key={p.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
              background: '#eef5ef', border: '1px solid #cfe6d8', color: '#1f5b38',
              borderRadius: 999, padding: '3px 6px 3px 11px',
            }}>
              {nomePersona(p)}{p.mansione ? ' \u00b7 ' + p.mansione : ''}
              <button type="button" disabled={busy} onClick={() => toggle(p.id)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 800, fontSize: 14, lineHeight: 1 }}>&times;</button>
            </span>
          ))}
        </div>
      ) : (
        <div className="fzr-d" style={{ marginTop: 0 }}>Nessun assegnatario: scegli una o pi&ugrave; risorse dalla tendina.</div>
      )}

      <div className="fzr-field" style={{ marginTop: 8 }}>
        <label>Aggiungi assegnatario (dalle risorse umane)</label>
        <select value="" disabled={busy || persone.filter((p) => !sel.has(p.id)).length === 0}
          onChange={(e) => { const id = e.target.value; if (id) toggle(id); }}>
          <option value="">
            {persone.filter((p) => !sel.has(p.id)).length ? '+ scegli una risorsa\u2026' : 'tutte le risorse sono gi\u00e0 assegnate'}
          </option>
          {persone.filter((p) => !sel.has(p.id)).map((p) => (
            <option key={p.id} value={p.id}>{nomePersona(p)}{p.mansione ? ' \u00b7 ' + p.mansione : ''}</option>
          ))}
        </select>
      </div>
      {persone.length === 0 && (
        <div className="fzr-hint" style={{ marginTop: 8 }}>
          Nessuna risorsa disponibile: aggiungi prima le persone nella sezione &laquo;Risorse Umane&raquo; della scheda cliente.
        </div>
      )}

      <div className="fzr-actions">
        <button className="fzr-btn primary" disabled={busy} onClick={() => void salva()}>Salva</button>
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
  const adapter = useAdapter();
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
  const [esonScad, setEsonScad] = useState('');
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
              try { await adapter.eliminaEsonero(req.esonero_id as string); await onSaved(); onClose(); }
              finally { setBusy(false); }
            }}
          >Rimuovi esonero</button>
          <button className="fzr-btn ghost" disabled={busy} onClick={onClose}>Chiudi</button>
        </div>
      </div>
    );
  }

  async function rimuoviAttestato() {
    if (!req.formazione_id) return;
    if (!window.confirm('Eliminare l\u2019attestato registrato per questo requisito? L\u2019operazione non si puo\u2019 annullare.')) return;
    setBusy(true);
    try { await adapter.eliminaFormazione(req.formazione_id); await onSaved(); onClose(); }
    finally { setBusy(false); }
  }

  async function salvaAttestato() {
    if (!dataAtt) { window.alert('Indica la data di completamento dell\u2019attestato.'); return; }
    if (multiPath && !corsoScelto) { window.alert('Scegli il corso (livello/gruppo) effettivamente svolto.'); return; }
    if (file && file.size > adapter.maxAllegatoBytes) { window.alert('Il file supera 20 MB: scegline uno piu\u2019 piccolo.'); return; }
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
      if (file) await adapter.salvaFormazioneConAllegato(f, file);
      else await adapter.salvaFormazione(f);
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
        scadenza: esonScad || null,
        attivo: true,
        note: null,
      };
      await adapter.salvaEsonero(e);
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
          {req.formazione_id && (
            <div className="fzr-eson-cur" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span>Attestato registrato{req.scadenza ? ' \u2014 scadenza ' + req.scadenza : ''}.</span>
              <span style={{ display: 'flex', gap: 8 }}>
                {req.allegato_url && <button type="button" className="fzr-mini" disabled={busy} onClick={() => void adapter.apriAllegato(req.allegato_url as string)}>vedi allegato</button>}
                <button type="button" className="fzr-mini" disabled={busy} onClick={() => void rimuoviAttestato()}>rimuovi attestato</button>
              </span>
            </div>
          )}
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
          <div className="fzr-field">
            <label>Data di scadenza del credito (se il credito e&apos; un corso che scade)</label>
            <input type="date" value={esonScad} onChange={(e) => setEsonScad(e.target.value)} />
            <div className="fzr-d">Se valorizzata, la scadenza viene monitorata nello scadenzario (area Formazione) come un corso.</div>
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
  const adapter = useAdapter();
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
    try { await adapter.salvaNomina({ ...nomina, data_nomina: nuovo }); await onSaved(); }
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
  const adapter = useAdapter();
  const [applicabile, setApplicabile] = useState(false);
  const [data, setData] = useState('');
  const [ore, setOre] = useState(corso?.ore != null ? String(corso.ore) : '');
  const [ente, setEnte] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function registra() {
    if (!data || !corso) return;
    if (file && file.size > adapter.maxAllegatoBytes) { window.alert('Il file supera 20 MB: scegline uno piu\u2019 piccolo.'); return; }
    setBusy(true);
    try {
      const f: Formazione = {
        id: newId(), persona_id: personaId, corso_codice: corso.codice, corso_nome: corso.nome,
        categoria: corso.categoria, data_completamento: data, ore: ore === '' ? null : Number(ore),
        ente_formatore: ente.trim() || null, is_aggiornamento: false, scadenza: null, allegato_url: null, note: null,
      };
      if (file) await adapter.salvaFormazioneConAllegato(f, file); else await adapter.salvaFormazione(f);
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

export default function OrganigrammaView({ clienteId, riep, catalogo, adapter, rlsTerritoriale, onRlsTerritoriale, onEvidenzePregresse, mostraSchema = false }: Props) {
  // pannelli aperti (stato locale di UI)
  const [editKey, setEditKey] = useState<string | null>(null);       // requisito (personaId|figura|corso)
  const [editPersona, setEditPersona] = useState<string | null>(null); // anagrafica (personaId|figura oppure personaId)
  const [aperte, setAperte] = useState<Set<string>>(new Set());
  const [aggiornaOpen, setAggiornaOpen] = useState(false);   // box di lavoro (ruoli/evidenze) aperto da "Aggiorna organigramma"
  const initAperte = useRef(false);                          // apri tutte le figure una sola volta
  const figRef = useRef<Record<string, HTMLDivElement | null>>({}); // ancore per scroll dalla tabella
  const [assegnaFigura, setAssegnaFigura] = useState<string | null>(null);
  const toggleFigura = (codice: string) => setAperte((s) => {
    const n = new Set(s);
    if (n.has(codice)) n.delete(codice); else n.add(codice);
    return n;
  });

  const ricarica = adapter.onCambia;
  const vuoto = riep.persone.length === 0;

  // Il Datore di lavoro che svolge l'RSPP copre la figura RSPP: non la riproponiamo.
  const dlRsppCoperto = riep.persone.some((pv) => pv.figure.some((f) => f.codice === 'dl_rspp'));

  // Copertura figure attese: tutte le figure del catalogo, raggruppate per blocco.
  const scoperteSet = new Set(riep.figureScoperte.map((f) => f.codice));
  // #6: se il Datore di lavoro svolge l'RSPP, l'INTERA area SPP (RSPP + ASPP)
  // sparisce, non solo la riga RSPP.
  const figureAttese = catalogo.figure.filter((f) => f.attiva)
    .filter((f) => !((f.codice === 'rspp' || f.codice === 'aspp') && dlRsppCoperto))
    .slice().sort((a, b) => (a.gruppo_ordine ?? 999) - (b.gruppo_ordine ?? 999) || a.ordine - b.ordine);
  const figureChePregressa = new Set<string>();
  for (const f of figureAttese) {
    if (figuraChiedePregressa(f.codice, catalogo.requisiti, catalogo.corsi)) figureChePregressa.add(f.codice);
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

  // Vista tipo-PDF: all'ingresso apriamo TUTTE le figure attese cosi' l'organigramma
  // si vede subito per intero (ruolo -> persone -> evidenze), gia' interattivo.
  // Una sola volta: dopo, l'utente resta libero di collassare/espandere le singole figure.
  useEffect(() => {
    if (initAperte.current || figureAttese.length === 0) return;
    initAperte.current = true;
    setAperte(new Set(figureAttese.map((f) => f.codice)));
  }, [figureAttese]);

  // #5: colore del bottone-figura con una ratio chiara, dallo stato REALE:
  //   - nessun incaricato + ruolo obbligatorio scoperto -> critico (rosso)
  //   - nessun incaricato + ruolo eventuale/condizionale -> neutro (grigio)
  //   - incaricati presenti -> stato PEGGIORE della formazione per quella figura
  //     (critico > in scadenza > da verificare > conforme/esonerato).
  type StatoFig = 'critico' | 'in_scadenza' | 'da_verificare' | 'conforme' | 'esonerato' | 'neutro';
  const RANK: Record<string, number> = { critico: 5, in_scadenza: 4, da_verificare: 3, conforme: 2, esonerato: 2, neutro: 1 };
  const statoFigura = (figura: FiguraSicurezza, assegnate: RigaCop['assegnate']): StatoFig => {
    if (assegnate.length === 0) return scoperteSet.has(figura.codice) ? 'critico' : 'neutro';
    let worst: StatoFig = 'conforme';
    for (const pv of assegnate) {
      for (const r of pv.requisiti.filter((x) => x.figura_codici.includes(figura.codice))) {
        if ((RANK[r.stato] ?? 0) > (RANK[worst] ?? 0)) worst = r.stato as StatoFig;
      }
      for (const m of pv.moduli.filter((x) => x.figura_codice === figura.codice && x.stato !== 'esonerato')) {
        if ((RANK[m.stato] ?? 0) > (RANK[worst] ?? 0)) worst = m.stato as StatoFig;
      }
    }
    return worst;
  };

  const tuttePersone = riep.persone.map((p) => p.persona);
  const corsoByCodice = new Map(catalogo.corsi.map((c) => [c.codice, c]));
  const ammessoById = new Map(catalogo.esoneriAmmessi.map((a) => [a.id, a]));

  // ---- Diagramma grafico ADATTIVO dell'organigramma (schema art. 2 D.Lgs. 81/08) ----
  // Riepilogo per-codice dalle righe di copertura (stato reale via statoFigura).
  const figByCodice = new Map<string, { figura: FiguraSicurezza; stato: StatoFig; n: number }>();
  for (const g of gruppiCopertura) {
    for (const { figura, assegnate } of g.righe) {
      figByCodice.set(figura.codice, { figura, stato: statoFigura(figura, assegnate), n: assegnate.length });
    }
  }
  // Topologia fissa (la gerarchia e' normativa); le coordinate si calcolano dal dato.
  // - Il vertice e' UNO: 'datore_lavoro' e 'dl_rspp' sono la stessa figura (il secondo e'
  //   il datore che svolge anche l'RSPP) -> conteggio per PERSONE DISTINTE, non somma.
  // - RSPP: coperto dal datore (dl_rspp) o interno/esterno (rspp). ASPP a se'.
  // - Addetti separati: antincendio e primo soccorso.
  type ONodo = { key: string; label: string; codici: string[]; parent: string | null };
  const O_NODI: ONodo[] = [
    { key: 'dl',   label: 'Datore di lavoro',       codici: ['datore_lavoro', 'dl_rspp'], parent: null },
    { key: 'rspp', label: 'RSPP',                   codici: ['rspp', 'dl_rspp'],          parent: 'dl' },
    { key: 'aspp', label: 'ASPP',                   codici: ['aspp'],                     parent: 'dl' },
    { key: 'dir',  label: 'Dirigenti',              codici: ['dirigente'],                parent: 'dl' },
    { key: 'mc',   label: 'Medico competente',      codici: ['medico_competente'],        parent: 'dl' },
    { key: 'prep', label: 'Preposti',               codici: ['preposto'],                 parent: 'dir' },
    { key: 'ai',   label: 'Addetto antincendio',    codici: ['addetto_antincendio'],      parent: 'dir' },
    { key: 'ps',   label: 'Addetto primo soccorso', codici: ['addetto_primo_soccorso'],   parent: 'dir' },
    { key: 'rls',  label: 'RLS',                    codici: ['rls'],                      parent: 'prep' },
    { key: 'lav',  label: 'Lavoratori',             codici: ['lavoratore'],               parent: 'prep' },
  ];
  const nodeById = new Map(O_NODI.map((n) => [n.key, n]));
  const nodeStato = (codici: string[]): StatoFig => {
    let worst: StatoFig = 'neutro';
    for (const c of codici) { const i = figByCodice.get(c); if (i && (RANK[i.stato] ?? 0) > (RANK[worst] ?? 0)) worst = i.stato; }
    return worst;
  };
  // Persone DISTINTE tra i codici del nodo (evita il doppio-conteggio datore/dl_rspp).
  const nodeCount = (codici: string[]): number => {
    const ids = new Set<string>();
    for (const pv of riep.persone) if (pv.figure.some((f) => codici.includes(f.codice))) ids.add(pv.persona.id);
    return ids.size;
  };
  const nodeVisible = (n: ONodo): boolean => n.codici.some((c) => figByCodice.has(c));
  const visibili = O_NODI.filter(nodeVisible);
  const visSet = new Set(visibili.map((n) => n.key));
  // Antenato visibile piu' vicino (se il parent e' nascosto, si risale).
  const parentVis = (n: ONodo): string | null => {
    let p = n.parent;
    while (p) { if (visSet.has(p)) return p; p = nodeById.get(p)?.parent ?? null; }
    return null;
  };
  const depth = (n: ONodo): number => {
    let d = 0, p = n.parent;
    while (p) { d++; p = nodeById.get(p)?.parent ?? null; }
    return d;
  };
  const NODE_W = 86, NODE_H = 38, GAP_X = 14, GAP_Y = 24, PAD = 6;
  const perLivello = new Map<number, ONodo[]>();
  for (const n of visibili) { const d = depth(n); if (!perLivello.has(d)) perLivello.set(d, []); perLivello.get(d)!.push(n); }
  const livelli = [...perLivello.keys()].sort((a, b) => a - b);
  const maxCount = Math.max(...livelli.map((l) => perLivello.get(l)!.length), 1);
  const DIAG_W = PAD * 2 + maxCount * NODE_W + (maxCount - 1) * GAP_X;
  const DIAG_H = PAD * 2 + livelli.length * NODE_H + Math.max(livelli.length - 1, 0) * GAP_Y;
  const layout = new Map<string, { x: number; y: number }>();
  livelli.forEach((l, ri) => {
    const row = perLivello.get(l)!;
    const rowW = row.length * NODE_W + (row.length - 1) * GAP_X;
    const x0 = (DIAG_W - rowW) / 2;
    const y = PAD + ri * (NODE_H + GAP_Y);
    row.forEach((n, ci) => layout.set(n.key, { x: x0 + ci * (NODE_W + GAP_X), y }));
  });
  const apriNodo = (n: ONodo) => { const t = n.codici.find((c) => figByCodice.has(c)) ?? n.codici[0]; if (t) toggleFigura(t); };
  const nodoAperto = (n: ONodo) => n.codici.some((c) => aperte.has(c));


  // Scheda di una figura: usata INLINE dentro il proprio gruppo (#4), non in coda.
  const renderFigCard = (figura: FiguraSicurezza, assegnate: RigaCop['assegnate']) => {
    const scoperta = scoperteSet.has(figura.codice);
    const stato = statoFigura(figura, assegnate);
    const aperto = assegnaFigura === figura.codice;
    const guidaRighe = (figura.guida ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
    const emerg = corsoEmergenzaRichiesto(figura.codice, riep.livello_antincendio, riep.gruppo_primo_soccorso);
    const titolari = assegnate.map((pv) => ({
      personaId: pv.persona.id,
      nominaId: pv.figure.find((x) => x.codice === figura.codice)?.nomina_id ?? null,
    }));
    return (
      <div key={figura.codice} className="fzr-figrow" ref={(el) => { figRef.current[figura.codice] = el; }}>
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
          <button className="fzr-edit-btn" title="Chiudi scheda" onClick={() => toggleFigura(figura.codice)}>{'\u2212'}</button>
        </div>

        {figura.codice === 'rls' && onRlsTerritoriale && (
          <div className="fzr-figrow-people" style={{ marginLeft: 18 }}>
            <button className={'fzr-mini' + (!rlsTerritoriale ? ' on' : '')} onClick={() => void onRlsTerritoriale(false)}>Interno</button>
            <button className={'fzr-mini' + (rlsTerritoriale ? ' on' : '')} onClick={() => void onRlsTerritoriale(true)}>RLS territoriale</button>
          </div>
        )}

        {guidaRighe.length > 0 && (
          <ul className="fzr-guida">
            {guidaRighe.map((l, i) => (
              l.startsWith('- ') ? <li key={i} className="sub">{l.slice(2).trim()}</li> : <li key={i}>{l}</li>
            ))}
          </ul>
        )}

        {aperto && (
          <AssegnaFiguraPanel
            figura={figura}
            persone={tuttePersone}
            titolari={titolari}
            clienteId={clienteId}
            chiediPregressa={figureChePregressa.has(figura.codice)}
            onSaved={ricarica}
            onClose={() => setAssegnaFigura(null)}
            onEvidenzePregresse={onEvidenzePregresse}
          />
        )}

        {assegnate.length === 0 ? (
          <>
            <div className="fzr-figrow-people">
              <span className={scoperta ? 'fzr-figrow-crit' : 'fzr-figrow-empty'}>
                {scoperta ? 'scoperto (obbligatorio)' : 'non assegnata'}
              </span>
            </div>
            {emerg && (
              <div className="fzr-emerg">
                {emerg.definito
                  ? 'Corso da erogare: ' + emerg.testo
                  : emerg.testo.charAt(0).toUpperCase() + emerg.testo.slice(1) + ' (anagrafica cliente).'}
              </div>
            )}
          </>
        ) : (
          <div className="fzr-inc">
            <div className="fzr-inc-h">Incaricati</div>
            {assegnate.map((pv) => {
              const fg = pv.figure.find((x) => x.codice === figura.codice);
              const nomina: Nomina | null = fg
                ? { id: fg.nomina_id ?? '', persona_id: pv.persona.id, figura_codice: figura.codice, data_nomina: fg.data_nomina, attiva: true, note: null }
                : null;
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
                    {pv.persona.formazione_pregressa && onEvidenzePregresse
                      && figureChePregressa.has(figura.codice)
                      && reqs.some((r) => r.stato === 'da_verificare' || r.stato === 'critico') && (
                      <button className="fzr-edit-btn" style={{ borderColor: 'var(--hi-dark,#9a6206)', color: 'var(--hi-dark,#9a6206)' }}
                        onClick={() => onEvidenzePregresse(pv.persona)}>
                        Evidenze pregresse
                      </button>
                    )}
                    <button className="fzr-edit-btn" onClick={() => setEditPersona(anagAperto ? null : anagKey)}>
                      {anagAperto ? 'Chiudi' : 'Modifica'}
                    </button>
                    {fg?.nomina_id && (
                      <button className="fzr-edit-btn" style={{ borderColor: 'var(--no,#d8442f)', color: 'var(--no,#d8442f)' }}
                        title={'Toglie ' + nomePersona(pv.persona) + ' solo da questo ruolo'}
                        onClick={() => {
                          if (!window.confirm('Togliere ' + nomePersona(pv.persona) + ' dal ruolo \u00ab' + figura.nome + '\u00bb? Resta negli altri ruoli a cui \u00e8 assegnata.')) return;
                          void (async () => { await adapter.eliminaNomina(fg.nomina_id!); await ricarica(); })();
                        }}>
                        Rimuovi dal ruolo
                      </button>
                    )}
                  </div>

                  {anagAperto && (
                    <PersonaForm persona={pv.persona} clienteId={clienteId} onSaved={ricarica} onClose={() => setEditPersona(null)} onEvidenzePregresse={onEvidenzePregresse} mostraRimuoviPersona={false} />
                  )}

                  {nomina && (nomina.id || nomina.data_nomina) && <NominaInline nomina={nomina} onSaved={ricarica} />}

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
                            alternative={catalogo.corsi.filter((c) => (c.categoria ?? '') === r.categoria)}
                            onSaved={ricarica}
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
                        onSaved={ricarica}
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
  };

  // Apre (non toggle) la scheda di una figura, apre il box di lavoro e ci scorre.
  const apriFigura = (codice: string) => {
    setAggiornaOpen(true);
    setAperte((s) => { const n = new Set(s); n.add(codice); return n; });
    requestAnimationFrame(() => requestAnimationFrame(() =>
      figRef.current[codice]?.scrollIntoView({ behavior: 'smooth', block: 'center' })));
  };

  // Evidenze di una persona LIMITATE alla figura (stesso filtro della scheda e del PDF).
  const evidenzePerFigura = (pv: RiepilogoCliente['persone'][number], figuraCodice: string) => {
    const reqs = pv.requisiti.filter((r) => r.figura_codici.includes(figuraCodice));
    const mods = pv.moduli.filter((m) => m.figura_codice === figuraCodice && m.stato !== 'esonerato');
    return { reqs, mods };
  };

  // ORGANIGRAMMA ATTUALE: tabella ruolo -> persona -> evidenze (esito, gemella del PDF),
  // interattiva: clic su una riga apre il box di lavoro alla figura corrispondente.
  const renderTabella = () => (
    <div className="fzr-tab">
      <table>
        <thead><tr><th>Ruolo organigramma</th><th>Anagrafica persona</th><th>Evidenze formazione / esonero</th></tr></thead>
        <tbody>
          {gruppiCopertura.flatMap((g) => g.righe).map(({ figura, assegnate }) => {
            if (assegnate.length === 0) {
              const sc = riep.figureScoperte.find((f) => f.codice === figura.codice);
              const em = corsoEmergenzaRichiesto(figura.codice, riep.livello_antincendio, riep.gruppo_primo_soccorso);
              return (
                <tr key={figura.codice} className="clic" onClick={() => apriFigura(figura.codice)}>
                  <td className="ruolo">{figura.nome}</td>
                  <td className="vuoto" colSpan={2}>Nessun incaricato{sc && em ? ' (corso: ' + em.testo + ')' : ''}</td>
                </tr>
              );
            }
            return assegnate.map((pv, i) => {
              const { reqs, mods } = evidenzePerFigura(pv, figura.codice);
              return (
                <tr key={figura.codice + '|' + pv.persona.id} className="clic" onClick={() => apriFigura(figura.codice)}>
                  {i === 0 && <td className="ruolo" rowSpan={assegnate.length}>{figura.nome}</td>}
                  <td className="cpers">
                    <div className="pn">{nomePersona(pv.persona)}</div>
                    {(pv.persona.mansione || pv.persona.reparto) && (
                      <div className="pm">{[pv.persona.mansione, pv.persona.reparto].filter(Boolean).join(' \u00b7 ')}</div>
                    )}
                    <div style={{ marginTop: 3 }}><span className={'fzr-st ' + pv.stato}>{TXT[pv.stato]}</span></div>
                  </td>
                  <td>
                    {reqs.length === 0 && mods.length === 0 && <span className="none">nessuna evidenza</span>}
                    {reqs.map((r) => (
                      <div key={r.corso_codice} className="ev">
                        <span className="corso">{r.corso_nome}{r.dettaglio ? ' \u2014 ' + r.dettaglio : ''}{r.scadenza ? ' ' : ''}<span className="scad">{r.scadenza ? '(scad. ' + r.scadenza + ')' : ''}</span></span>
                        <span className={'fzr-st ' + r.stato}>{TXT[r.stato]}</span>
                      </div>
                    ))}
                    {mods.map((m) => (
                      <div key={'m-' + m.corso_codice} className="ev">
                        <span className="corso">{m.corso_nome}<span className="fzr-modtag">modulo</span>{m.dettaglio ? ' \u2014 ' + m.dettaglio : ''}</span>
                        <span className={'fzr-st ' + m.stato}>{TXT[m.stato]}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <AdapterCtx.Provider value={adapter}>
    <div className="fzr">
      <style>{CSS}</style>

      {figureAttese.length > 0 && mostraSchema && (
        <div className="fzr-diag">
          <div className="fzr-diag-svgwrap">
            <svg viewBox={`0 0 ${DIAG_W} ${DIAG_H}`} role="img" aria-label="Schema organigramma sicurezza">
              {visibili.map((n) => {
                const pk = parentVis(n); if (!pk) return null;
                const a = layout.get(pk); const b = layout.get(n.key);
                if (!a || !b) return null;
                const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H;
                const x2 = b.x + NODE_W / 2, y2 = b.y;
                const my = (y1 + y2) / 2;
                return (
                  <path key={'e-' + n.key} className="fzr-diag-line"
                    d={`M ${x1} ${y1} L ${x1} ${my} L ${x2} ${my} L ${x2} ${y2}`} />
                );
              })}
              {visibili.map((n) => {
                const p = layout.get(n.key); if (!p) return null;
                const stato = nodeStato(n.codici);
                const cnt = nodeCount(n.codici);
                const on = nodoAperto(n);
                return (
                  <foreignObject key={n.key} x={p.x} y={p.y} width={NODE_W} height={NODE_H}>
                    <div className={'fzr-onode ' + stato + (on ? ' on' : '')} onClick={() => apriNodo(n)}>
                      <span className="fzr-onode-lab">{n.label}</span>
                      {cnt > 0 && <span className="fzr-onode-n">{cnt} {cnt === 1 ? 'incaricato' : 'incaricati'}</span>}
                    </div>
                  </foreignObject>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {figureAttese.length > 0 && (
        <div className="fzr-split">
          <div className="fzr-split-main">
            <div className="fzr-col-title">Organigramma attuale</div>
            {renderTabella()}
          </div>
          <div className="fzr-split-side">
            <button type="button" className={'fzr-aggiorna' + (aggiornaOpen ? ' on' : '')}
              onClick={() => setAggiornaOpen((v) => !v)}>
              {aggiornaOpen ? 'Chiudi aggiornamento' : 'Aggiorna organigramma'}
            </button>
            {riep.figureScoperte.length > 0 && (
              <div className="fzr-side-note">{riep.figureScoperte.length} {riep.figureScoperte.length === 1 ? 'figura scoperta' : 'figure scoperte'}</div>
            )}
          </div>
        </div>
      )}

      {figureAttese.length > 0 && aggiornaOpen && (
        <div className="fzr-cop">
          <div className="fzr-cop-bar">
            <div className="fzr-cop-barhead">
              Organigramma atteso {'\u2014'} ruoli, incaricati ed evidenze formative
              {riep.figureScoperte.length > 0 && (
                <span style={{ color: 'var(--no,#d8442f)', fontWeight: 800 }}> {'\u00b7'} {riep.figureScoperte.length} scoperte</span>
              )}
            </div>
            <div className="fzr-legenda">
              <span><span className="fzr-dot critico" /> obbligatorio scoperto / criticità</span>
              <span><span className="fzr-dot in_scadenza" /> in scadenza</span>
              <span><span className="fzr-dot da_verificare" /> da verificare</span>
              <span><span className="fzr-dot conforme" /> in regola</span>
              <span><span className="fzr-dot neutro" /> non assegnata (eventuale)</span>
            </div>
            {gruppiCopertura.map((g) => {
              const aperteGrp = g.righe.filter(({ figura }) => aperte.has(figura.codice));
              return (
              <div key={g.nome} className="fzr-figgrp">
                <div className="fzr-figgrp-name">{g.nome}</div>
                <div className="fzr-figchips">
                  {g.righe.map(({ figura, assegnate }) => {
                    const stato = statoFigura(figura, assegnate);
                    const open = aperte.has(figura.codice);
                    return (
                      <button key={figura.codice} type="button"
                        className={'fzr-figchip ' + stato + (open ? ' on' : '')}
                        onClick={() => toggleFigura(figura.codice)}>
                        <span className={'fzr-dot ' + stato} />
                        <span className="fzr-figchip-nome">{figura.nome}</span>
                        {assegnate.length > 0 && <span className="fzr-figchip-n">{assegnate.length}</span>}
                        <span className="fzr-figchip-pm">{open ? '\u2212' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
                {aperteGrp.length > 0 && (
                  <div className="fzr-cop-body" style={{ padding: '6px 0 0' }}>
                    {aperteGrp.map(({ figura, assegnate }) => renderFigCard(figura, assegnate))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}

      {vuoto && (
        <div className="empty">Nessuna persona in organigramma. Usa &laquo;Aggiorna organigramma&raquo; e assegna un nominativo a una figura.</div>
      )}
    </div>
    </AdapterCtx.Provider>
  );
}
