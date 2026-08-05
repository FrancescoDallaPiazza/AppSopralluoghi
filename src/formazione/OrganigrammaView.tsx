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

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { pulisci as pulisciCF, valido as cfValido, crossCheck as cfCrossCheck, analizzaCF, type DatiCF } from './codiceFiscale';
import {
  type RiepilogoCliente, type RequisitoValutato, type StatoRequisito,
  type TipoEsonero, type Formazione, type Esonero,
  type Persona, type Nomina, type FiguraSicurezza, type ModuloValutato, type EsoneroAmmesso,
  type CorsoCatalogo, type Catalogo, type NominaEvidenza,
  nomePersona, nomePersonaCognome, confrontaPersone, mansioniUsate,
  dataIT, CATEGORIE_NO_PREGRESSA, figuraChiedePregressa, corsoEmergenzaRichiesto,
} from '../lib/admin/formazione';
import { newId } from '../lib/types';

// Adapter delle SCRITTURE: il guscio inietta online (back-office) o offline (campo).
export interface OrganigrammaAdapter {
  salvaPersona(p: Persona): Promise<Persona>;
  eliminaPersona(id: string): Promise<void>;
  // Conferma una copia (azzera da_confermare su persona + record collegati).
  // Opzionale: presente solo nel back-office.
  confermaPersona?(id: string): Promise<void>;
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
  // Evidenze documentali della nomina. Opzionali: presenti solo nel back-office
  // (scrivania). In campo l'organigramma resta in sola lettura su questo fronte.
  evidenzeNomina?(nominaId: string): Promise<NominaEvidenza[]>;
  caricaEvidenzaNomina?(nominaId: string, tipo: string, note: string | null, file: File): Promise<NominaEvidenza>;
  eliminaEvidenzaNomina?(id: string): Promise<void>;
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

// Confronto "da ricerca": senza accenti e senza maiuscole, perche' dal gestionale
// i cognomi arrivano in maiuscolo e accentati, a mano no, e chi cerca digita
// come gli viene.
const normalizza = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Tutti i termini digitati devono comparire, in qualunque ordine e in qualunque
// campo: "rossi mario" e "mario rossi" trovano la stessa persona, e "rossi
// saldatore" la trova per cognome e mansione insieme.
function corrispondePersona(p: Persona, termini: string[]): boolean {
  const campi = normalizza([p.cognome, p.nome, p.mansione, p.reparto, p.codice_fiscale].filter(Boolean).join(' '));
  return termini.every((t) => campi.includes(t));
}

// La guida di catalogo (`figura_sicurezza.guida`) e' un testo unico che tiene
// insieme due discorsi diversi: il PERCORSO FORMATIVO (corso base, moduli per
// ATECO/rischio, aggiornamento) e i CREDITI/ESONERI dell'Allegato III ASR 2025.
// Srotolati insieme sono cinque-otto righe sopra ogni ruolo: si leggono una
// volta e poi restano li' a spingere in basso cio' che si usa davvero. Qui si
// separano per riga, cosi' la scheda puo' mostrarli a richiesta, uno per volta.
// Regola: dalla prima riga che parla di esonero/credito in poi e' blocco
// esoneri; le sotto-righe ("- ...") seguono sempre la riga che le introduce.
function dividiGuida(guida: string | null | undefined): { formazione: string[]; esonero: string[] } {
  const formazione: string[] = [];
  const esonero: string[] = [];
  let inEsonero = false;
  for (const riga of (guida ?? '').split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (!riga.startsWith('- ')) inEsonero = /esoner|credito/i.test(riga);
    (inEsonero ? esonero : formazione).push(riga);
  }
  return { formazione, esonero };
}

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
.fzr-macro{margin-bottom:12px;}
.fzr-macro-name{font-size:12px; font-weight:800; letter-spacing:.02em; padding:5px 10px; border-radius:8px; margin:10px 0 8px;}
.fzr-macro-name.obbligatoria{background:var(--no-bg,#fdecea); color:var(--no,#d8442f);}
.fzr-macro-name.eventuale{background:#eef1f4; color:var(--ink-soft,#5b5f66);}
.fzr-evnom{margin:6px 0 2px;}
.fzr-evnom-h{font-size:10.5px; font-weight:800; letter-spacing:.03em; text-transform:uppercase; color:var(--ink-soft,#5b5f66); margin-bottom:6px;}
.fzr-evnom-empty{font-size:11.5px; color:var(--ink-soft,#8a8f98); margin-bottom:6px;}
.fzr-evnom-warn{display:flex; align-items:center; gap:7px; font-size:11.5px; font-weight:600; color:var(--hi-dark,#9a6206); background:var(--hi-bg,#fdf3e0); border:1px solid var(--hi,#e6a700); border-radius:8px; padding:5px 8px; margin-bottom:6px;}
.fzr-evnom-warn-dot{width:8px; height:8px; border-radius:50%; background:var(--hi,#e6a700); flex:0 0 auto;}
.fzr-evnom-row{display:flex; align-items:center; gap:8px; margin:3px 0; font-size:12px;}
.fzr-evnom-tipo{flex:1 1 auto; min-width:0; color:var(--ink,#2a2c30); font-weight:600;}
.fzr-evnom-add{display:flex; align-items:center; gap:8px; margin-top:6px; flex-wrap:wrap;}
.fzr-evnom-add select{padding:5px 8px; border:1px solid var(--line,#e3ddd2); border-radius:8px; font-size:12px; font-family:inherit; background:#fff; color:var(--ink,#2a2c30);}
.fzr-evnom-add input[type=file]{font-size:11.5px; max-width:100%;}
.fzr-mini.danger{color:var(--no,#d8442f); border-color:var(--no,#d8442f);}
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
.fzr-guida-tabs{display:inline-flex; flex-wrap:wrap; gap:6px; margin-left:auto;}
.fzr-guida-tabs .fzr-mini{text-transform:none; letter-spacing:normal; font-weight:700;}
.fzr-guida{margin:6px 0 6px 20px; padding:0; font-size:11.5px; color:var(--ink-soft,#5b5f66); line-height:1.45;}
.fzr-guida li{margin:1px 0;}
.fzr-guida li.sub{list-style:none; margin-left:-6px;}
.fzr-guida li.sub::before{content:'\\2013\\00a0'; }
.fzr-inc{margin:6px 0 2px 6px;}
.fzr-inc-h{font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-soft,#5b5f66); margin:4px 0 4px;}
.fzr-inc-card{border:1px solid var(--line,#e3ddd2); border-radius:10px; padding:9px 10px; margin-bottom:8px; background:var(--card,#fff);}
.fzr-dacnf{font-size:9.5px; font-weight:800; letter-spacing:.03em; text-transform:uppercase; color:var(--hi-dark,#9a6206); background:var(--hi-bg,#fdf3e0); border:1px solid var(--hi,#e6a700); border-radius:6px; padding:2px 6px; white-space:nowrap;}
.fzr-step{margin-top:8px; padding:8px 10px 6px; border:1px solid var(--line,#e3ddd2); border-radius:9px; background:#fcfbf9;}
.fzr-step + .fzr-step{margin-top:8px;}
.fzr-step-h{display:flex; align-items:center; gap:7px; font-size:10.5px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:var(--ink,#2a2c30); margin-bottom:6px;}
.fzr-step-n{display:inline-flex; align-items:center; justify-content:center; width:17px; height:17px; border-radius:50%; background:var(--ink,#2a2c30); color:#fff; font-size:10.5px; font-weight:800;}
.fzr-step-empty{font-size:11.5px; color:var(--ink-soft,#8a8f98);}
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
.fzr-cerca{display:flex; align-items:center; gap:6px; margin:0 0 8px;}
.fzr-cerca input{flex:1 1 auto; min-width:0; padding:8px 10px; border:1px solid var(--line,#e3ddd2); border-radius:8px; font-family:inherit; font-size:13px; background:#fff; color:var(--ink,#2a2c30);}
.fzr-cerca .fzr-mini{flex:0 0 auto;}
.fzr-aggiorna{width:100%; background:var(--ink,#2a2c30); color:#fff; border:none; border-radius:10px; padding:12px 14px; font:inherit; font-size:13px; font-weight:800; cursor:pointer; text-transform:uppercase; letter-spacing:.02em; box-shadow:0 1px 2px rgba(0,0,0,.08);}
.fzr-aggiorna:hover{filter:brightness(1.08);}
.fzr-aggiorna.on{background:var(--no,#d8442f);}
.fzr-side-note{font-size:11.5px; font-weight:700; color:var(--no,#d8442f); text-align:center;}
.fzr-tab{border:1px solid var(--line,#e3ddd2); border-radius:10px; overflow:hidden;}
.fzr-tab table{width:100%; border-collapse:collapse; font-size:12px;}
.fzr-tab thead th{text-align:left; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-soft,#5b5f66); background:#faf7f1; border-bottom:1px solid var(--line,#e3ddd2); padding:6px 10px; font-weight:800;}
.fzr-tab td{border-top:1px solid var(--line,#e3ddd2); padding:7px 10px; vertical-align:top;}
.fzr-tab tr.clic{cursor:pointer;} .fzr-tab tr.clic:hover td{background:#faf7ef;}
/* Riga-testata della fisarmonica: e' un ruolo, non un dato, quindi ha il fondo
   della thead e non le righe. Il +/- sta a sinistra con larghezza fissa perche'
   passando da + a - il nome non deve spostarsi. */
.fzr-tab tr.figrow{cursor:pointer; background:#faf7f1;}
.fzr-tab tr.figrow:hover td{background:#f4efe4;}
.fzr-tab tr.figrow td{padding:7px 10px;}
.fzr-tab .fzr-tab-pm{display:inline-block; width:12px; font-weight:800; color:var(--ink-soft,#5b5f66);}
.fzr-tab .fzr-tab-fn{font-weight:700; margin-left:2px;}
.fzr-tab .fzr-tab-n{font-size:11px; color:var(--ink-soft,#5b5f66); margin-left:7px;}
.fzr-tab .fzr-tab-n.crit{color:var(--no,#d8442f); font-style:italic; font-weight:700;}
.fzr-tab .ruolo{font-weight:700; width:24%; white-space:nowrap;}
.fzr-tab .cpers{width:32%;}
.fzr-tab .pn{font-weight:600;} .fzr-tab .pm{font-size:11px; color:var(--ink-soft,#5b5f66); margin-top:1px;}
.fzr-tab .vuoto{color:var(--no,#d8442f); font-style:italic;}
.fzr-tab-empty{display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;}
.fzr-tab-empty .fzr-mini{font-style:normal; flex:0 0 auto;}
.fzr-tab .ev{display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:2px 0;}
.fzr-tab .ev + .ev{border-top:1px dotted #ece7dd;}
.fzr-tab .corso{font-size:11.5px; line-height:1.35;}
.fzr-tab .scad{color:var(--ink-soft,#5b5f66);}
.fzr-tab .none{color:#9a958c; font-style:italic; font-size:11.5px;}
/* ---- Scheda figura singola (clic da tabella) + info formazione/esonero a comparsa ---- */
.fzr-focus{border:1px solid var(--line,#e3ddd2); border-radius:10px; margin:8px 0 12px; padding:10px 12px; background:var(--card,#fff);}
.fzr-focus-top{display:flex; align-items:center; gap:8px;}
.fzr-focus-nome{flex:1 1 auto; min-width:0; font-size:13.5px; font-weight:700; display:flex; align-items:center; gap:6px; flex-wrap:wrap;}
.fzr-focus-empty{margin:8px 0 2px;}
.fzr-focus-list{margin-top:8px; display:flex; flex-direction:column; gap:6px;}
/* Barra "stai guardando una persona sola": dice cosa e' nascosto e come rivederlo.
   Un filtro silenzioso su un ruolo con 40 adibiti si legge come "ne ha uno". */
.fzr-focus-filtro{display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:6px 0 2px; font-size:12px; color:#6b6257;}
.fzr-focus-row{display:flex; align-items:center; gap:8px; padding:6px 8px; border:1px solid var(--line,#e3ddd2); border-radius:9px; background:#fcfbf9;}
.fzr-focus-pn{flex:1 1 auto; min-width:0; font-size:12.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.fzr-infowrap{position:relative; flex:0 0 auto; display:inline-flex;}
.fzr-info{width:20px; height:20px; border-radius:50%; border:1px solid var(--line,#cfc8ba); background:#fff; color:var(--ink-soft,#5b5f66); font-size:12px; font-weight:800; font-style:italic; line-height:1; cursor:default; display:inline-flex; align-items:center; justify-content:center;}
.fzr-infowrap:hover .fzr-info,.fzr-infowrap:focus-within .fzr-info{border-color:var(--ink,#2a2c30); color:var(--ink,#2a2c30);}
.fzr-pop{position:absolute; right:0; top:calc(100% + 6px); z-index:40; width:290px; max-width:78vw; padding:9px 11px; background:#fff; border:1px solid var(--line,#d9d2c6); border-radius:10px; box-shadow:0 6px 20px rgba(0,0,0,.14); opacity:0; visibility:hidden; transform:translateY(-3px); transition:opacity .12s,transform .12s; pointer-events:none;}
.fzr-infowrap:hover .fzr-pop,.fzr-infowrap:focus-within .fzr-pop{opacity:1; visibility:visible; transform:translateY(0); pointer-events:auto;}
/* Variante ancorata a sinistra: la "i" del nome ruolo sta a inizio riga, e un
   popup che si apre verso sinistra finirebbe fuori dalla scheda. */
.fzr-pop.sx{right:auto; left:0;}
.fzr-pop .fzr-guida{color:var(--ink,#2a2c30);}
.fzr-pop-sec{font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-soft,#5b5f66); margin:6px 0 4px;}
.fzr-pop-sec:first-child{margin-top:0;}
.fzr-pop-line{font-size:11.5px; color:var(--ink,#2a2c30); line-height:1.4; margin:2px 0;}
.fzr-pop-ev{display:flex; align-items:center; gap:7px; padding:3px 0; border-top:1px dotted #ece7dd;}
.fzr-pop-ev:first-of-type{border-top:none;}
.fzr-pop-corso{flex:1 1 auto; min-width:0; font-size:11.5px; line-height:1.35;}
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
  mostraPregressa = true, onCreata, mansioni = [],
}: {
  persona: Persona | null;
  clienteId: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onEvidenzePregresse?: (persona: Persona) => void;
  mostraRimuoviPersona?: boolean;
  // Mansioni gia' usate in azienda, proposte in tendina sul campo Mansione. Le
  // due vie per creare una persona (qui e Risorse Umane) devono proporre lo
  // stesso vocabolario, altrimenti chi crea "al volo" durante un'assegnazione
  // ricomincia a inventare diciture.
  mansioni?: string[];
  // Dentro l'assegnazione la domanda "azienda pre-ASR 2025?" non si pone: li' si
  // sta scegliendo CHI ricopre il ruolo, e il regime formativo (iniziale oppure
  // credito/esonero) si decide dopo, sul percorso formativo. Resta nell'anagrafica.
  mostraPregressa?: boolean;
  // Chi crea la persona al volo deve poterla usare subito (selezionarla per il
  // ruolo): serve la riga salvata, non il solo "e' andata bene".
  onCreata?: (p: Persona) => void;
}) {
  const adapter = useAdapter();
  const listaMansioni = useId();
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
        data_cessazione: persona?.data_cessazione ?? null,
        livello_rischio: persona?.livello_rischio ?? null,
        attivo: true,
        note: persona?.note ?? null,
        formazione_pregressa: pregressa,
      };
      const salvata = await adapter.salvaPersona(p);
      await onSaved();
      if (!persona) onCreata?.(salvata ?? p);
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
        <input type="text" value={mansione} list={mansioni.length ? listaMansioni : undefined}
          onChange={(e) => setMansione(e.target.value.toUpperCase())} />
        {mansioni.length > 0 && (
          <datalist id={listaMansioni}>
            {mansioni.map((m) => <option key={m} value={m} />)}
          </datalist>
        )}
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
      {mostraPregressa && (
        <label className="chk" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '2px 0 4px' }}>
          <input type="checkbox" checked={pregressa} onChange={(e) => setPregressa(e.target.checked)} />
          <span>Formazione pregressa (azienda già operante prima dell'ASR 2025): i requisiti senza attestato risultano "da verificare" invece di "critici".</span>
        </label>
      )}
      {mostraPregressa && pregressa && persona && onEvidenzePregresse && (
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

// ---------- prescrizioni del ruolo a comparsa (la "i" accanto al nome) --------
// Un ruolo ancora scoperto non ha incaricati, quindi non ha il passo 2 dove
// stanno i due bottoni: senza questo, per sapere che formazione comporta un
// ruolo bisognava prima nominarci qualcuno - cioe' l'inverso di come si decide.
// A comparsa e non srotolato perche' e' testo di legge da consultare, non un
// dato del cliente: si guarda quando serve e non deve occupare la scheda.
function GuidaInfo({ guida }: { guida: { formazione: string[]; esonero: string[] } }) {
  if (guida.formazione.length === 0 && guida.esonero.length === 0) return null;
  const righe = (l: string[]) => (
    <ul className="fzr-guida" style={{ margin: '2px 0 0 14px' }}>
      {l.map((riga, i) => (riga.startsWith('- ')
        ? <li key={i} className="sub">{riga.slice(2).trim()}</li>
        : <li key={i}>{riga}</li>))}
    </ul>
  );
  return (
    <span className="fzr-infowrap">
      <button type="button" className="fzr-info" aria-label="Prescrizioni del ruolo">i</button>
      <div className="fzr-pop sx" role="tooltip">
        {guida.formazione.length > 0 && (
          <>
            <div className="fzr-pop-sec">Corsi e aggiornamenti</div>
            {righe(guida.formazione)}
          </>
        )}
        {guida.esonero.length > 0 && (
          <>
            <div className="fzr-pop-sec">Esonero e crediti</div>
            {righe(guida.esonero)}
          </>
        )}
      </div>
    </span>
  );
}

// ---------- pannello assegnazione PER FIGURA (paradigma back-office) ----------
// Aperto dal bottone "assegna/modifica" di una riga-figura, risponde a UNA sola
// domanda: CHI ricopre il ruolo. Si scelgono le persone gia' in organigramma, e
// chi non c'e' si crea al volo senza uscire dal pannello (l'elenco delle risorse
// umane non e' mai completo quando si compila un organigramma).
// Cio' che viene dopo NON sta qui: la data di nomina e i documenti a supporto
// sono il passo 1 della scheda dell'incaricato, il percorso formativo (con la
// scelta fra formazione e credito/esonero) e' il passo 2. Sono a due centimetri
// piu' sotto, e chiederli anche qui faceva vedere la stessa nomina due volte.
// Scritture via adapter.
function AssegnaFiguraPanel({
  figura, persone, titolari, clienteId, corsiAttinenti, corsiSvoltiPer,
  filtraDiDefault, onSaved, onClose,
}: {
  figura: FiguraSicurezza;
  persone: Persona[];
  titolari: { personaId: string; nominaId: string | null }[];
  clienteId: string;
  // Corsi che questa figura richiede, e corsi che ciascuna persona ha davvero
  // svolto. Servono a proporre i candidati sensati per gli addetti alle
  // emergenze: chi ha gia' il corso antincendio non e' scritto da nessuna parte
  // nell'organigramma finche' non lo si nomina, quindi senza questi due dati la
  // tendina e' un elenco alfabetico di tutta l'azienda e la persona giusta la
  // si deve ricordare a memoria.
  corsiAttinenti: string[];
  corsiSvoltiPer: Map<string, string[]>;
  // Il filtro parte acceso solo dove la domanda e' "chi ha gia' il corso?":
  // gli addetti alle emergenze si scelgono cosi'. Sui ruoli che riguardano
  // tutti - i Lavoratori - partirebbe nascondendo proprio le persone da
  // assegnare, che il corso ancora non ce l'hanno.
  filtraDiDefault: boolean;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const adapter = useAdapter();
  const titolariIds = useMemo(() => titolari.map((t) => t.personaId), [titolari]);
  const attinenti = useMemo(() => new Set(corsiAttinenti), [corsiAttinenti]);
  const haCorso = useCallback((id: string): boolean =>
    (corsiSvoltiPer.get(id) ?? []).some((c) => attinenti.has(c)), [corsiSvoltiPer, attinenti]);
  // Ordine alfabetico cognome-poi-nome, imposto QUI e non lasciato all'ordine di
  // arrivo: le persone risalgono dal riepilogo del motore, che le raggruppa per
  // valutazione, e dopo un import del gestionale sono decine. Una tendina in
  // ordine incerto si scorre due volte per trovare un cognome.
  const ordinate = useMemo(() => [...persone].sort(confrontaPersone), [persone]);
  // Vocabolario delle mansioni per la creazione al volo: `persone` e' gia' tutto
  // l'organico del cliente (il pannello lo riceve da `tuttePersone`), quindi la
  // proposta e' la stessa che si vede in Risorse Umane.
  const mansioni = useMemo(() => mansioniUsate(persone), [persone]);
  const formati = useMemo(() => ordinate.filter((p) => haCorso(p.id)), [ordinate, haCorso]);
  // Filtro acceso di default quando ha senso: la figura ha corsi propri e almeno
  // una persona li ha. Resta togliibile - il corso non e' un requisito per essere
  // designati (si puo' nominare e formare dopo), quindi non si nasconde nessuno
  // d'autorita'.
  const [soloFormati, setSoloFormati] = useState(
    () => filtraDiDefault && attinenti.size > 0 && formati.length > 0);
  const [sel, setSel] = useState<Set<string>>(() => new Set(titolariIds));
  const [busy, setBusy] = useState(false);
  // Chi si puo' proporre: filtrati se il filtro e' acceso, ma chi e' gia'
  // selezionato o titolare resta sempre visibile - un filtro che fa sparire una
  // persona gia' assegnata la farebbe togliere per sbaglio al Salva successivo.
  const candidati = useMemo(
    () => (soloFormati ? ordinate.filter((p) => haCorso(p.id) || sel.has(p.id)) : ordinate),
    [soloFormati, ordinate, haCorso, sel]);
  const daScegliere = useMemo(() => candidati.filter((p) => !sel.has(p.id)), [candidati, sel]);
  // creazione al volo di una persona che non e' ancora fra le risorse umane
  const [nuovaPersona, setNuovaPersona] = useState(false);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function salva() {
    if (busy) return;
    setBusy(true);
    try {
      const dopo = new Set(sel);
      // aggiunte: selezionati ora ma non titolari prima
      for (const id of dopo) {
        if (titolariIds.includes(id)) continue;
        await adapter.salvaNomina({ id: newId(), persona_id: id, figura_codice: figura.codice, data_nomina: oggiISO(), attiva: true, note: null });
      }
      // rimozioni: titolari prima ma non piu' selezionati
      for (const t of titolari) {
        if (dopo.has(t.personaId)) continue;
        if (t.nominaId) await adapter.eliminaNomina(t.nominaId);
      }
      await onSaved();
      // Qui il pannello ha finito il suo lavoro e si chiude. La data di nomina e
      // i documenti a supporto NON si chiedono qui: la scheda dell'incaricato,
      // che compare subito sotto, ha gia' il passo 1 "Nomina" con esattamente
      // quei campi. Chiederli anche nel pannello faceva vedere due volte la
      // stessa nomina, una sopra l'altra.
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <div className="fzr-ed">
      <div className="fzr-grp" style={{ marginTop: 0 }}>
        {figura.codice === 'lavoratore' ? 'Chi e’ adibito al ruolo' : 'Chi ricopre il ruolo'}
      </div>
      {ordinate.filter((p) => sel.has(p.id)).length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
          {ordinate.filter((p) => sel.has(p.id)).map((p) => (
            <span key={p.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
              background: '#eef5ef', border: '1px solid #cfe6d8', color: '#1f5b38',
              borderRadius: 999, padding: '3px 6px 3px 11px',
            }}>
              {nomePersonaCognome(p)}{p.mansione ? ' \u00b7 ' + p.mansione : ''}
              <button type="button" disabled={busy} onClick={() => toggle(p.id)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 800, fontSize: 14, lineHeight: 1 }}>&times;</button>
            </span>
          ))}
        </div>
      ) : (
        <div className="fzr-d" style={{ marginTop: 0 }}>Nessun assegnatario: scegli una o pi&ugrave; risorse dalla tendina.</div>
      )}

      {/* Assegnazione di massa. Serve per i ruoli che riguardano tutti - i
          Lavoratori in primis: dopo un import del gestionale sono decine, e
          sceglierli uno alla volta dalla tendina non e' un lavoro, e' un
          ostacolo. Nessuna scrittura qui: cambia la selezione, si conferma con
          Salva come per una scelta singola. */}
      {persone.length > 1 && (
        <div className="fzr-actions" style={{ marginTop: 8, marginBottom: 0 }}>
          <button type="button" className="fzr-mini" disabled={busy || candidati.every((p) => sel.has(p.id))}
            onClick={() => setSel(new Set([...sel, ...candidati.map((p) => p.id)]))}>
            Seleziona tutte ({candidati.length})
          </button>
          <button type="button" className="fzr-mini" disabled={busy || sel.size === 0}
            onClick={() => setSel(new Set())}>
            Deseleziona tutte
          </button>
        </div>
      )}

      {/* Candidati con il corso attinente gia' svolto. Per gli addetti alle
          emergenze e' la domanda vera - "chi ha fatto l'antincendio?" - e la
          risposta e' nei dati, non nella memoria di chi compila. Il filtro non
          e' un vincolo: si puo' designare chi il corso non ce l'ha e formarlo
          dopo, ed e' per questo che si toglie con un click. */}
      {attinenti.size > 0 && persone.length > 0 && (
        <label className="fzr-d" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <input type="checkbox" checked={soloFormati} disabled={busy}
            onChange={(e) => setSoloFormati(e.target.checked)} />
          <span>
            Mostra solo chi ha gia&rsquo; il corso attinente
            {' '}({formati.length} su {persone.length})
            {formati.length === 0 && ' — nessuno, il filtro nasconderebbe tutti'}
          </span>
        </label>
      )}

      <div className="fzr-field" style={{ marginTop: 8 }}>
        <label>Aggiungi assegnatario (dalle risorse umane)</label>
        <select value="" disabled={busy || daScegliere.length === 0}
          onChange={(e) => { const id = e.target.value; if (id) toggle(id); }}>
          <option value="">
            {daScegliere.length
              ? '+ scegli una risorsa\u2026'
              : (soloFormati ? 'nessun altro con il corso attinente' : 'tutte le risorse sono gi\u00e0 assegnate')}
          </option>
          {daScegliere.map((p) => (
            <option key={p.id} value={p.id}>
              {nomePersonaCognome(p)}{p.mansione ? ' \u00b7 ' + p.mansione : ''}{haCorso(p.id) ? ' \u00b7 corso svolto' : ''}
            </option>
          ))}
        </select>
      </div>
      {/* Chi non e' in elenco si crea QUI. Mandare in "Risorse Umane" e tornare
          indietro faceva perdere il ruolo su cui si stava lavorando, e con esso
          la selezione gia' fatta: chi compila un organigramma scopre le persone
          mancanti proprio mentre assegna, non prima. */}
      {nuovaPersona ? (
        <div style={{ marginTop: 8 }}>
          <div className="fzr-grp" style={{ marginTop: 0 }}>Nuova persona</div>
          <PersonaForm
            persona={null}
            clienteId={clienteId}
            mostraPregressa={false}
            mansioni={mansioni}
            onSaved={onSaved}
            onCreata={(p) => setSel((s) => new Set([...s, p.id]))}
            onClose={() => setNuovaPersona(false)}
          />
        </div>
      ) : (
        <div className="fzr-actions" style={{ marginTop: 0, marginBottom: 4 }}>
          <button type="button" className="fzr-mini" disabled={busy} onClick={() => setNuovaPersona(true)}>
            + Persona non in elenco
          </button>
        </div>
      )}

      {persone.length === 0 && !nuovaPersona && (
        <div className="fzr-hint" style={{ marginTop: 8 }}>
          Nessuna risorsa in anagrafica: creala qui con &laquo;Persona non in elenco&raquo;, oppure dalla sezione &laquo;Risorse Umane&raquo; della scheda cliente.
        </div>
      )}

      <div className="fzr-actions">
        <button className="fzr-btn primary" disabled={busy || nuovaPersona} onClick={() => void salva()}>Salva assegnazione</button>
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
  // Parte VUOTO anche quando le ore dovute sono note. Precompilarlo con req.ore
  // faceva salvare le ore DOVUTE come se fossero quelle lette sull'attestato:
  // il campo tornava indietro pieno e nessuno lo toccava. Cosi' `formazione.ore`
  // non era un fatto ma una copia del requisito, e un attestato da 4h su 8
  // dovute era indistinguibile da uno conforme. Le dovute restano a video come
  // placeholder (un suggerimento, non un dato). Fra lavoro ridondante e dato
  // sbagliato, si sceglie il lavoro ridondante.
  const [oreAtt, setOreAtt] = useState('');
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
        // La registrazione a mano documenta il percorso per intero: chi la
        // compila ha l'attestato sotto gli occhi. L'evidenza incompleta nasce
        // dall'import, dove il gestionale esporta solo un pezzo del corso.
        evidenza_incompleta: false,
        data_completamento: dataAtt,
        // Campo vuoto -> null, NON le ore dovute dal requisito. Copiarle
        // registrava come fatto ("l'attestato dice 8h") cio' che era solo un
        // buco, e rendeva impossibile distinguere un attestato conforme da uno
        // non compilato: gli altri due siti di scrittura (riga ~941 e
        // Formazione.tsx) hanno sempre lasciato null. Le ore mostrate nei
        // requisiti vengono dal catalogo, non da qui: nessun effetto sul motore.
        ore: oreAtt.trim() ? Number(oreAtt) : null,
        ente_formatore: enteAtt.trim() || null,
        is_aggiornamento: false,
        // Registrazione a mano: sempre un attestato intero. Gli spezzoni
        // arrivano solo dall'import del gestionale (alias marcato parziale).
        parziale: false,
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
              {/* Data di svolgimento accanto alla scadenza: la scadenza dice quando
                  agire, la data di svolgimento e' cio' che si legge sull'attestato
                  e che permette di ritrovarlo. Da sola la scadenza non e'
                  verificabile. */}
              <span>Attestato registrato{req.data_completamento ? ' \u2014 svolto il ' + dataIT(req.data_completamento) : ''}{req.scadenza ? ' \u00b7 scadenza ' + dataIT(req.scadenza) : ''}.</span>
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
              <input type="number" inputMode="decimal" value={oreAtt}
                placeholder={req.ore != null ? `dovute: ${req.ore}` : 'ore'}
                onChange={(e) => setOreAtt(e.target.value)} />
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

// ---------- estremi procura del datore delegato ex art. 16 (inline) ----------
function EstremiProcuraInline({ nomina, onSaved }: { nomina: Nomina; onSaved: () => Promise<void>; }) {
  const adapter = useAdapter();
  const [v, setV] = useState(nomina.estremi_procura ?? '');
  const [busy, setBusy] = useState(false);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setV(nomina.estremi_procura ?? ''); }, [nomina.estremi_procura]);
  async function commit() {
    editing.current = false;
    const nuovo = v.trim() || null;
    if ((nomina.estremi_procura ?? null) === nuovo) return;
    setBusy(true);
    try { await adapter.salvaNomina({ ...nomina, estremi_procura: nuovo }); await onSaved(); }
    finally { setBusy(false); }
  }
  return (
    <label className="fzr-nomina">
      <span>Estremi procura</span>
      <input type="text" value={v} disabled={busy || !nomina.id} placeholder="Repertorio, data, notaio (delega di funzioni)"
        onFocus={() => { editing.current = true; }}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => void commit()} />
    </label>
  );
}

// ---------- evidenze documentali della nomina (solo back-office) ----------
const LABEL_TIPO_EVIDENZA: Record<string, string> = {
  visura_camerale: 'Visura camerale',
  atto_procura: 'Atto / procura notarile',
  atto_nomina: 'Atto di nomina',
  altro: 'Altro',
};
// Il datore e il delegato ex art. 16 richiedono visura + atto/procura; le altre
// figure la sola evidenza dell'atto di nomina (con "Altro" a supporto).
function tipiEvidenzaPer(figuraCodice: string): Array<{ v: string; l: string }> {
  const base = (figuraCodice === 'datore_lavoro' || figuraCodice === 'datore_lavoro_art16')
    ? ['visura_camerale', 'atto_procura', 'atto_nomina', 'altro']
    : ['atto_nomina', 'altro'];
  return base.map((v) => ({ v, l: LABEL_TIPO_EVIDENZA[v] ?? v }));
}

function EvidenzeNomina({ nominaId, figuraCodice, onSaved }: { nominaId: string; figuraCodice: string; onSaved: () => Promise<void>; }) {
  const adapter = useAdapter();
  const tipi = tipiEvidenzaPer(figuraCodice);
  const [lista, setLista] = useState<NominaEvidenza[] | null>(null);
  const [tipo, setTipo] = useState<string>(tipi[0]?.v ?? 'atto_nomina');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const carica = useCallback(async () => {
    if (!adapter.evidenzeNomina) { setLista([]); return; }
    try { setLista(await adapter.evidenzeNomina(nominaId)); } catch { setLista([]); }
  }, [adapter, nominaId]);
  useEffect(() => { void carica(); }, [carica]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !adapter.caricaEvidenzaNomina) return;
    if (file.size > adapter.maxAllegatoBytes) {
      window.alert('File troppo grande (max ' + Math.round(adapter.maxAllegatoBytes / (1024 * 1024)) + ' MB).');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setBusy(true);
    try {
      await adapter.caricaEvidenzaNomina(nominaId, tipo, null, file);
      await carica();
      await onSaved();
    } catch (err: unknown) {
      window.alert('Caricamento non riuscito: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function rimuovi(id: string) {
    if (!adapter.eliminaEvidenzaNomina) return;
    if (!window.confirm('Rimuovere questa evidenza della nomina?')) return;
    setBusy(true);
    try { await adapter.eliminaEvidenzaNomina(id); await carica(); await onSaved(); }
    finally { setBusy(false); }
  }

  return (
    <div className="fzr-evnom">
      <div className="fzr-evnom-h">Evidenze della nomina</div>
      {lista === null ? (
        <div className="fzr-evnom-empty">{'\u2026'}</div>
      ) : lista.length === 0 ? (
        <div className="fzr-evnom-warn">
          <span className="fzr-evnom-warn-dot" />
          Evidenza da ottenere: nomina identificata ma manca l{'\u0027'}atto ufficiale.
        </div>
      ) : (
        lista.map((ev) => (
          <div key={ev.id} className="fzr-evnom-row">
            <span className="fzr-evnom-tipo">{LABEL_TIPO_EVIDENZA[ev.tipo] ?? ev.tipo}</span>
            {ev.allegato_url && (
              <button type="button" className="fzr-mini" disabled={busy}
                onClick={() => void adapter.apriAllegato(ev.allegato_url as string)}>vedi</button>
            )}
            <button type="button" className="fzr-mini danger" disabled={busy}
              onClick={() => void rimuovi(ev.id)}>rimuovi</button>
          </div>
        ))
      )}
      <div className="fzr-evnom-add">
        <select value={tipo} disabled={busy} onChange={(e) => setTipo(e.target.value)}>
          {tipi.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <input ref={fileRef} type="file" disabled={busy}
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" onChange={(e) => void onFile(e)} />
      </div>
    </div>
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
        ente_formatore: ente.trim() || null, is_aggiornamento: false, parziale: false,
        // Registrazione a mano: l'attestato e' sotto gli occhi di chi compila,
        // quindi documenta tutto. L'evidenza incompleta nasce dall'import.
        evidenza_incompleta: false,
        scadenza: null, allegato_url: null, note: null,
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
  const [focusFigura, setFocusFigura] = useState<string | null>(null); // scheda singola aperta dal clic sulla tabella
  const [focusEdit, setFocusEdit] = useState(false);                   // scheda singola in modalita' editor completo
  // Chi si e' cliccato: il clic su una RIGA-PERSONA chiede di quella persona, non
  // del ruolo. Senza, si apriva la scheda del ruolo con dentro tutti gli
  // incaricati, e su un ruolo con decine di adibiti (Lavoratori dopo un import)
  // la persona cercata andava ritrovata a mano in un secondo elenco.
  const [focusPersona, setFocusPersona] = useState<string | null>(null);
  const figRef = useRef<Record<string, HTMLDivElement | null>>({}); // ancore per scroll dalla tabella
  const focusRef = useRef<HTMLDivElement | null>(null);      // ancora per scroll alla scheda singola
  const [assegnaFigura, setAssegnaFigura] = useState<string | null>(null);
  // Ricerca per persona. L'organigramma e' ordinato per RUOLO, ma la domanda che
  // arriva a voce e' sull'individuo ("Rossi e' a posto?"): senza questo si
  // aprono i ruoli a uno a uno e si leggono gli elenchi finche' salta fuori.
  const [cerca, setCerca] = useState('');
  // Quale blocco delle prescrizioni e' aperto, per singola scheda incaricato
  // (chiave persona|figura): aprirlo su un incaricato non lo apre sugli altri.
  const [guidaOpen, setGuidaOpen] = useState<Record<string, 'form' | 'eson' | null>>({});
  const mostraGuida = (chiave: string, v: 'form' | 'eson') =>
    setGuidaOpen((g) => ({ ...g, [chiave]: g[chiave] === v ? null : v }));
  const toggleFigura = (codice: string) => setAperte((s) => {
    const n = new Set(s);
    if (n.has(codice)) n.delete(codice); else n.add(codice);
    return n;
  });

  const ricarica = adapter.onCambia;
  const vuoto = riep.persone.length === 0;
  // Gestione evidenze/estremi della nomina: solo dove l'adapter le fornisce
  // (back-office/scrivania). In campo l'organigramma resta in sola lettura qui.
  const gestioneNomina = typeof adapter.evidenzeNomina === 'function';

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

  // Corsi che una figura richiede davvero, per proporre i candidati sensati nel
  // pannello di assegnazione. Per gli addetti alle emergenze il corso NON e' a
  // catalogo sulla figura ma dipende dai livelli aziendali (rischio incendio,
  // gruppo di primo soccorso): li' la fonte e' `corsoEmergenzaRichiesto`, la
  // stessa che governa il requisito, altrimenti si filtrerebbe su un corso che
  // per questa azienda non e' quello dovuto.
  const corsiDellaFigura = (codice: string): string[] => {
    const emerg = corsoEmergenzaRichiesto(codice, riep.livello_antincendio, riep.gruppo_primo_soccorso);
    if (emerg) return emerg.codice ? [emerg.codice] : [];
    return catalogo.requisiti
      .filter((r) => r.figura_codice === codice && r.obbligatorio)
      .map((r) => r.corso_codice);
  };
  // Corsi svolti per persona: viene dal motore (`corsiSvolti`), che li legge
  // dagli attestati registrati e non dai ruoli - chi ha il corso antincendio ma
  // e' a organigramma come semplice lavoratore c'e' comunque.
  const corsiSvoltiPer = new Map<string, string[]>(
    riep.persone.map((pv) => [pv.persona.id, pv.corsiSvolti ?? []] as [string, string[]]));

  // Chi ha GIA' il corso che una figura scoperta richiede. Dirlo cambia
  // l'istruzione: "Corso da erogare" manda a comprare un corso che in azienda e'
  // gia' stato fatto, quando quello che manca e' la designazione. L'attestato si
  // aggancia da se' nel momento in cui la persona viene assegnata (il motore
  // cerca gli attestati per codice corso, non per nomina), quindi qui non c'e'
  // niente da collegare a mano: c'e' da nominare.
  const giaFormatiPer = (codice: string): typeof riep.persone => {
    const cors = new Set(corsiDellaFigura(codice));
    if (!cors.size) return [];
    return riep.persone
      .filter((pv) => (pv.corsiSvolti ?? []).some((c) => cors.has(c)))
      .sort((a, b) => confrontaPersone(a.persona, b.persona));
  };
  const testoGiaFormati = (l: typeof riep.persone): string => {
    const nomi = l.slice(0, 3).map((pv) => nomePersonaCognome(pv.persona)).join(', ');
    return (l.length === 1 ? '1 persona ha gia’ il corso richiesto' : l.length + ' persone hanno gia’ il corso richiesto')
      + ' (' + nomi + (l.length > 3 ? ', …' : '') + '): manca la designazione, non la formazione.';
  };
  type RigaCop = { figura: FiguraSicurezza; assegnate: typeof riep.persone };
  const gruppiCopertura: { nome: string; macro: string; righe: RigaCop[] }[] = [];
  for (const f of figureAttese) {
    // Ordinati per cognome: la lista degli incaricati di un ruolo si legge per
    // cercarci qualcuno, e su "Lavoratori" dopo un import sono decine.
    const assegnate = riep.persone
      .filter((p) => p.figure.some((x) => x.codice === f.codice))
      .sort((a, b) => confrontaPersone(a.persona, b.persona));
    const g = f.gruppo || 'Altre figure';
    let grp = gruppiCopertura.find((x) => x.nome === g);
    if (!grp) { grp = { nome: g, macro: f.macro || 'eventuale', righe: [] }; gruppiCopertura.push(grp); }
    grp.righe.push({ figura: f, assegnate });
  }

  // I ruoli partono CHIUSI. Aprirli tutti all'ingresso (com'era) rendeva la
  // pagina un muro: ogni scheda porta con se' incaricati, requisiti, evidenze e
  // moduli, quindi con un organigramma vero si apriva su decine di schermate e
  // per confrontare due ruoli si scorreva a lungo. La riga chiusa dice gia' cio'
  // che serve per scegliere dove entrare - nome, semaforo, numero di incaricati -
  // e il resto si apre a richiesta, uno o piu' alla volta.
  // I due bottoni "Espandi/Chiudi tutte" qui sotto tengono comunque a portata la
  // vista d'insieme di prima.

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
      // Nomina identificata ma senza atto ufficiale: attenzione (da verificare).
      const fe = pv.figure.find((x) => x.codice === figura.codice);
      if (fe?.evidenza_mancante && (RANK['da_verificare'] ?? 0) > (RANK[worst] ?? 0)) worst = 'da_verificare';
    }
    return worst;
  };

  // Chi risponde alla ricerca. Da due caratteri in su: con uno solo l'elenco
  // sarebbe mezza azienda, e la ricerca non risponderebbe a nulla.
  const terminiCerca = normalizza(cerca.trim()).split(/\s+/).filter(Boolean);
  const cercaAttiva = normalizza(cerca.trim()).length >= 2;
  const trovate = cercaAttiva
    ? riep.persone
      .filter((pv) => corrispondePersona(pv.persona, terminiCerca))
      .sort((a, b) => confrontaPersone(a.persona, b.persona))
    : [];

  const tuttePersone = riep.persone.map((p) => p.persona);
  const mansioniCliente = mansioniUsate(tuttePersone);
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
  const apriNodo = (n: ONodo) => { const t = n.codici.find((c) => figByCodice.has(c)) ?? n.codici[0]; if (t) apriFigura(t); };
  const nodoAperto = (n: ONodo) => n.codici.some((c) => aperte.has(c) || c === focusFigura);


  // Scheda di una figura: usata INLINE dentro il proprio gruppo (#4), non in coda,
  // oppure da sola nella scheda singola (onClose la riporta alla vista compatta).
  const renderFigCard = (figura: FiguraSicurezza, assegnate: RigaCop['assegnate'], onClose?: () => void, soloPersonaId?: string | null) => {
    const scoperta = scoperteSet.has(figura.codice);
    const stato = statoFigura(figura, assegnate);
    const aperto = assegnaFigura === figura.codice;
    // Prescrizioni del ruolo (testo di catalogo) divise nei due discorsi che
    // contiene. Non si mostrano qui in testa: appartengono al passo 2 di ogni
    // incaricato, che e' il momento in cui si decide come coprire il requisito.
    const guida = dividiGuida(figura.guida);
    const emerg = corsoEmergenzaRichiesto(figura.codice, riep.livello_antincendio, riep.gruppo_primo_soccorso);
    // Solo quando la figura e' senza incaricati: a ruolo coperto la domanda
    // non si pone piu'.
    const giaFormati = assegnate.length === 0 ? giaFormatiPer(figura.codice) : [];
    // `titolari` resta sull'elenco COMPLETO anche quando si guarda una sola
    // persona: e' quello che il pannello di assegnazione considera gia'
    // assegnato, e filtrarlo cancellerebbe gli altri incaricati al salvataggio.
    // Il filtro vale solo per le schede mostrate.
    const titolari = assegnate.map((pv) => ({
      personaId: pv.persona.id,
      nominaId: pv.figure.find((x) => x.codice === figura.codice)?.nomina_id ?? null,
    }));
    const incaricati = soloPersonaId ? assegnate.filter((pv) => pv.persona.id === soloPersonaId) : assegnate;
    return (
      <div key={figura.codice} className="fzr-figrow" ref={(el) => { figRef.current[figura.codice] = el; }}>
        <div className="fzr-figrow-top">
          <span className="fzr-dot-wrap">
            <span className={'fzr-dot ' + stato} />
          </span>
          <span className="fzr-figrow-nome">
            {figura.nome}
            <GuidaInfo guida={guida} />
            {figura.obbligo && <span className={'fzr-badge ' + figura.obbligo}>{LABEL_OBBLIGO[figura.obbligo] ?? figura.obbligo}</span>}
          </span>
          <button className="fzr-edit-btn" onClick={() => setAssegnaFigura(aperto ? null : figura.codice)}>
            {aperto ? 'Chiudi' : (assegnate.length ? 'Modifica' : 'Assegna')}
          </button>
          <button className="fzr-edit-btn" title="Chiudi scheda" onClick={() => (onClose ? onClose() : toggleFigura(figura.codice))}>{'\u2212'}</button>
        </div>

        {figura.codice === 'rls' && onRlsTerritoriale && (
          <div className="fzr-figrow-people" style={{ marginLeft: 18 }}>
            <button className={'fzr-mini' + (!rlsTerritoriale ? ' on' : '')} onClick={() => void onRlsTerritoriale(false)}>Interno</button>
            <button className={'fzr-mini' + (rlsTerritoriale ? ' on' : '')} onClick={() => void onRlsTerritoriale(true)}>RLS territoriale</button>
          </div>
        )}


        {aperto && (
          <AssegnaFiguraPanel
            figura={figura}
            persone={tuttePersone}
            titolari={titolari}
            clienteId={clienteId}
            corsiAttinenti={corsiDellaFigura(figura.codice)}
            corsiSvoltiPer={corsiSvoltiPer}
            filtraDiDefault={!!emerg}
            onSaved={ricarica}
            onClose={() => setAssegnaFigura(null)}
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
            {giaFormati.length > 0 && (
              <div className="fzr-emerg" style={{ marginTop: 6 }}>{testoGiaFormati(giaFormati)}</div>
            )}
          </>
        ) : (
          <div className="fzr-inc">
            <div className="fzr-inc-h">{incaricati.length < assegnate.length ? 'Incaricato' : 'Incaricati'}</div>
            {incaricati.map((pv) => {
              const fg = pv.figure.find((x) => x.codice === figura.codice);
              const nomina: Nomina | null = fg
                ? { id: fg.nomina_id ?? '', persona_id: pv.persona.id, figura_codice: figura.codice, data_nomina: fg.data_nomina, attiva: true, note: null, estremi_procura: fg.estremi_procura }
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
                      {nomePersonaCognome(pv.persona)}
                    </span>
                    {pv.persona.da_confermare && (
                      <span className="fzr-dacnf" title="Riga copiata da un'altra sede: verificala e confermala">copia da confermare</span>
                    )}
                    {pv.persona.da_confermare && adapter.confermaPersona && (
                      <button className="fzr-edit-btn" style={{ borderColor: 'var(--ok-dark,#1f6b3a)', color: 'var(--ok-dark,#1f6b3a)' }}
                        onClick={() => { void (async () => { await adapter.confermaPersona!(pv.persona.id); })(); }}>
                        Conferma
                      </button>
                    )}
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
                    <PersonaForm persona={pv.persona} clienteId={clienteId} mansioni={mansioniCliente} onSaved={ricarica} onClose={() => setEditPersona(null)} onEvidenzePregresse={onEvidenzePregresse} mostraRimuoviPersona={false} />
                  )}

                  <div className="fzr-step">
                    <div className="fzr-step-h"><span className="fzr-step-n">1</span>{figura.codice === 'lavoratore' ? 'Adibizione' : 'Nomina'}</div>
                    {nomina && (nomina.id || nomina.data_nomina) && <NominaInline nomina={nomina} onSaved={ricarica} />}
                    {gestioneNomina && nomina && nomina.id && figura.codice === 'datore_lavoro_art16' && (
                      <EstremiProcuraInline nomina={nomina} onSaved={ricarica} />
                    )}
                    {gestioneNomina && nomina && nomina.id && figura.codice !== 'lavoratore' && (
                      <EvidenzeNomina nominaId={nomina.id} figuraCodice={figura.codice} onSaved={ricarica} />
                    )}
                  </div>

                  <div className="fzr-step">
                    {/* Passo 2: qui si sceglie la strada, non si "registra" e
                        basta - la formazione iniziale e il credito/esonero sono
                        due risposte alla stessa domanda, e stanno nello stesso
                        editor (due schede). Le prescrizioni di catalogo stanno
                        dietro i due bottoni, non srotolate: sono il testo di
                        legge da consultare mentre si decide, e aperte dicono le
                        stesse cose che il requisito qui sotto gia' dice. */}
                    <div className="fzr-step-h">
                      <span className="fzr-step-n">2</span>Percorso formativo
                      {(guida.formazione.length > 0 || guida.esonero.length > 0) && (
                        <span className="fzr-guida-tabs">
                          {guida.formazione.length > 0 && (
                            <button type="button" className={'fzr-mini' + (guidaOpen[anagKey] === 'form' ? ' on' : '')}
                              onClick={() => mostraGuida(anagKey, 'form')}>
                              Corsi e aggiornamenti
                            </button>
                          )}
                          {guida.esonero.length > 0 && (
                            <button type="button" className={'fzr-mini' + (guidaOpen[anagKey] === 'eson' ? ' on' : '')}
                              onClick={() => mostraGuida(anagKey, 'eson')}>
                              Esonero e crediti
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                    {guidaOpen[anagKey] && (
                      <ul className="fzr-guida">
                        {(guidaOpen[anagKey] === 'form' ? guida.formazione : guida.esonero).map((l, i) => (
                          l.startsWith('- ') ? <li key={i} className="sub">{l.slice(2).trim()}</li> : <li key={i}>{l}</li>
                        ))}
                      </ul>
                    )}
                    {reqs.length === 0 && mods.length === 0 && (
                      <div className="fzr-step-empty">Nessun percorso formativo sicurezza per questa figura: e{'\u0027'} sufficiente la nomina.</div>
                    )}
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
                              {apertoR ? 'Chiudi'
                                : r.esonero_id ? 'Esonero'
                                : r.formazione_id ? 'Registra'
                                // Antincendio e primo soccorso hanno regime proprio: nessun
                                // credito da valutare, quindi non si offre una scelta che non c'e'.
                                : CATEGORIE_NO_PREGRESSA.has(r.categoria) ? 'Registra'
                                : 'Formazione o esonero'}
                            </button>
                          </span>
                        </div>
                        <div className="fzr-d">{r.dettaglio}</div>
                        {/* I promemoria sono gli esoneri ammessi per questo
                            requisito: la stessa cosa che dice il bottone
                            "Esonero e crediti" qui sopra. Srotolati sotto ogni
                            riga si leggevano due volte, quindi si mostrano solo
                            mentre l'editor e' aperto, dove servono a scegliere. */}
                        {apertoR && r.promemoria.map((a) => (
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Clic su una figura (tabella o schema): apre SOLO la scheda di quella figura.
  // Chiude il pannello "Aggiorna organigramma": le due viste sono alternative,
  // cosi' la figura non viene mai renderizzata due volte (ref/scroll ambigui).
  // `personaId` = si e' cliccato su una persona e non sul ruolo: la scheda si
  // apre sulla sola persona (restano un clic e un bottone per vedere gli altri
  // incaricati). Omesso = ruolo intero, come prima.
  const apriFigura = (codice: string, personaId?: string) => {
    setAggiornaOpen(false);
    setFocusEdit(false);
    setFocusFigura(codice);
    setFocusPersona(personaId ?? null);
    requestAnimationFrame(() => requestAnimationFrame(() =>
      focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })));
  };

  // Apre la figura DIRETTAMENTE sul pannello di assegnazione. Davanti a un ruolo
  // scoperto la domanda che nasce e' "chi ci metto?", e la risposta stava tre
  // clic sotto (riga -> scheda -> Modifica -> Assegna): la fisarmonica aperta
  // diceva solo "Nessun incaricato", senza via d'uscita visibile.
  const apriAssegna = (codice: string) => {
    setAggiornaOpen(false);
    setFocusFigura(codice);
    // Assegnare e' un'operazione sul RUOLO (si sceglie fra tutte le risorse e si
    // vedono i titolari attuali): un filtro su una persona qui nasconderebbe
    // proprio chi c'e' gia'.
    setFocusPersona(null);
    setFocusEdit(true);
    setAssegnaFigura(codice);
    requestAnimationFrame(() => requestAnimationFrame(() =>
      focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })));
  };

  // Evidenze di una persona LIMITATE alla figura (stesso filtro della scheda e del PDF).
  const evidenzePerFigura = (pv: RiepilogoCliente['persone'][number], figuraCodice: string) => {
    const reqs = pv.requisiti.filter((r) => r.figura_codici.includes(figuraCodice));
    const mods = pv.moduli.filter((m) => m.figura_codice === figuraCodice && m.stato !== 'esonerato');
    return { reqs, mods };
  };

  // Scheda singola compatta (aperta dal clic sulla tabella): ruolo + incaricati,
  // con le info di formazione ed esonero raccolte in un popup a comparsa (bottone "i").
  const renderFigFocus = (figura: FiguraSicurezza, assegnate: RigaCop['assegnate']) => {
    const stato = statoFigura(figura, assegnate);
    const scoperta = scoperteSet.has(figura.codice);
    const emerg = corsoEmergenzaRichiesto(figura.codice, riep.livello_antincendio, riep.gruppo_primo_soccorso);
    // Solo quando la figura e' senza incaricati: a ruolo coperto la domanda
    // non si pone piu'.
    const giaFormati = assegnate.length === 0 ? giaFormatiPer(figura.codice) : [];
    // Si e' cliccato su una persona: si mostra la sua sola scheda. Se quella
    // persona non e' (piu') fra gli incaricati - tolta dal ruolo mentre la
    // scheda era aperta - si ricade sull'elenco intero: meglio tutti che il
    // vuoto senza spiegazione.
    const mirate = focusPersona ? assegnate.filter((pv) => pv.persona.id === focusPersona) : [];
    const mostrate = mirate.length > 0 ? mirate : assegnate;
    const filtrata = mostrate.length < assegnate.length;
    const barraTutti = filtrata ? (
      <div className="fzr-focus-filtro">
        <span>{'Scheda di ' + nomePersonaCognome(mostrate[0].persona) + ' · il ruolo ha ' + assegnate.length + ' incaricati'}</span>
        <button type="button" className="fzr-mini" onClick={() => setFocusPersona(null)}>
          Vedi tutti gli incaricati ({assegnate.length})
        </button>
      </div>
    ) : null;
    // "Modifica": l'editor completo della SOLA figura scelta, qui dentro.
    if (focusEdit) {
      return (
        <div className="fzr-focus" ref={focusRef}>
          {barraTutti}
          {renderFigCard(figura, assegnate, () => setFocusEdit(false), filtrata ? mostrate[0].persona.id : null)}
        </div>
      );
    }
    return (
      <div className="fzr-focus" ref={focusRef}>
        <div className="fzr-focus-top">
          <span className={'fzr-dot ' + stato} />
          <span className="fzr-focus-nome">
            {figura.nome}
            <GuidaInfo guida={dividiGuida(figura.guida)} />
            {figura.obbligo && <span className={'fzr-badge ' + figura.obbligo}>{LABEL_OBBLIGO[figura.obbligo] ?? figura.obbligo}</span>}
          </span>
          {/* A ruolo vuoto "Modifica" non descrive cio' che serve fare (non c'e'
              niente da modificare): l'azione e' nominare, e porta dritta al
              pannello di assegnazione. */}
          <button className="fzr-edit-btn" onClick={() => (assegnate.length === 0 ? apriAssegna(figura.codice) : setFocusEdit(true))}>
            {assegnate.length === 0 ? (figura.codice === 'lavoratore' ? 'Adibisci' : 'Assegna') : 'Modifica'}
          </button>
          <button className="fzr-edit-btn" title="Chiudi scheda" onClick={() => { setFocusFigura(null); setFocusPersona(null); }}>{'\u2715'}</button>
        </div>

        {assegnate.length === 0 ? (
          <div className="fzr-focus-empty">
            <span className={scoperta ? 'fzr-figrow-crit' : 'fzr-figrow-empty'}>
              {scoperta ? 'scoperto (obbligatorio)' : 'non assegnata'}
            </span>
            {emerg && (
              <div className="fzr-emerg" style={{ margin: '6px 0 0' }}>
                {emerg.definito
                  ? 'Corso da erogare: ' + emerg.testo
                  : emerg.testo.charAt(0).toUpperCase() + emerg.testo.slice(1) + ' (anagrafica cliente).'}
              </div>
            )}
            {giaFormati.length > 0 && (
              <div className="fzr-emerg" style={{ margin: '6px 0 0' }}>{testoGiaFormati(giaFormati)}</div>
            )}
          </div>
        ) : (
          <div className="fzr-focus-list">
            {barraTutti}
            {mostrate.map((pv) => {
              const fg = pv.figure.find((x) => x.codice === figura.codice);
              const { reqs, mods } = evidenzePerFigura(pv, figura.codice);
              const nInfo = reqs.length + mods.length;
              return (
                <div key={pv.persona.id} className="fzr-focus-row">
                  <span className={'fzr-dot ' + pv.stato} title={TXT[pv.stato]} />
                  <span className="fzr-focus-pn">{nomePersonaCognome(pv.persona)}</span>
                  <span className={'fzr-st ' + pv.stato}>{TXT[pv.stato]}</span>
                  <span className="fzr-infowrap">
                    <button type="button" className="fzr-info" aria-label="Dettagli formazione ed esonero">i</button>
                    <div className="fzr-pop" role="tooltip">
                      <div className="fzr-pop-sec">Passo 1 {'\u2014'} {figura.codice === 'lavoratore' ? 'Adibizione' : 'Nomina'}</div>
                      <div className="fzr-pop-line">{fg?.data_nomina ? 'Registrata il ' + fg.data_nomina : 'Non registrata'}</div>
                      {figura.codice === 'datore_lavoro_art16' && (
                        <div className="fzr-pop-line">{fg?.estremi_procura ? 'Procura: ' + fg.estremi_procura : 'Estremi procura mancanti'}</div>
                      )}
                      <div className="fzr-pop-sec">Passo 2 {'\u2014'} Formazione ed esonero</div>
                      {nInfo === 0 && (
                        <div className="fzr-pop-line">Nessun percorso formativo: sufficiente la nomina.</div>
                      )}
                      {reqs.map((r) => (
                        <div key={r.corso_codice} className="fzr-pop-ev">
                          <span className={'fzr-dot ' + r.stato} title={TXT[r.stato]} />
                          <span className="fzr-pop-corso">{r.corso_nome}{r.ore != null ? ' \u00b7 ' + r.ore + 'h' : ''}{r.data_completamento ? ' \u00b7 ' + dataIT(r.data_completamento) : ''}{r.scadenza ? ' \u00b7 scad. ' + dataIT(r.scadenza) : ''}{r.esonero_id ? ' \u00b7 esonero' : ''}</span>
                          <span className={'fzr-st ' + r.stato}>{TXT[r.stato]}</span>
                        </div>
                      ))}
                      {mods.map((m) => (
                        <div key={'m-' + m.corso_codice} className="fzr-pop-ev">
                          <span className={'fzr-dot ' + m.stato} title={TXT[m.stato]} />
                          <span className="fzr-pop-corso">{m.corso_nome} (modulo)</span>
                          <span className={'fzr-st ' + m.stato}>{TXT[m.stato]}</span>
                        </div>
                      ))}
                    </div>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // RICERCA PERSONA: si scrive un cognome e si legge il suo stato, ruolo per
  // ruolo, con la stessa lettura delle evidenze della tabella. SOSTITUISCE la
  // tabella mentre e' attiva invece di affiancarsi: due viste degli stessi dati,
  // una sopra l'altra, sono il doppione che si e' appena tolto altrove.
  const renderRicerca = () => {
    if (trovate.length === 0) {
      return (
        <div className="fzr-tab" style={{ padding: '12px 14px' }}>
          <div className="fzr-figrow-crit">Nessuna persona trovata per &laquo;{cerca.trim()}&raquo;.</div>
          <div className="fzr-d">La ricerca guarda cognome, nome, mansione, reparto e codice fiscale.</div>
        </div>
      );
    }
    return (
      <div>
        <div className="fzr-d" style={{ margin: '0 0 6px' }}>
          {trovate.length === 1 ? '1 persona trovata' : trovate.length + ' persone trovate'}
          {' · '}la ricerca guarda cognome, nome, mansione, reparto e codice fiscale.
        </div>
        {trovate.map((pv) => (
          <div key={pv.persona.id} className="fzr-focus">
            <div className="fzr-focus-top">
              <span className={'fzr-dot ' + pv.stato} title={TXT[pv.stato]} />
              <span className="fzr-focus-nome">
                {nomePersonaCognome(pv.persona)}
                {(pv.persona.mansione || pv.persona.reparto) && (
                  <span className="fzr-d" style={{ marginTop: 0 }}>
                    {[pv.persona.mansione, pv.persona.reparto].filter(Boolean).join(' · ')}
                  </span>
                )}
                {!pv.persona.attivo && <span className="fzr-badge eventuale">non attivo</span>}
              </span>
              <span className={'fzr-st ' + pv.stato}>{TXT[pv.stato]}</span>
            </div>

            {/* Attestati che coprono solo un pezzo del percorso: sono dell'ATTESTATO,
                non di un ruolo, quindi vanno detti sulla persona. */}
            {pv.evidenzeIncomplete.length > 0 && (
              <div className="fzr-emerg" style={{ margin: '6px 0 0' }}>
                {pv.evidenzeIncomplete.length === 1
                  ? '1 attestato documenta solo una parte del percorso'
                  : pv.evidenzeIncomplete.length + ' attestati documentano solo una parte del percorso'}
                {': '}
                {pv.evidenzeIncomplete.map((e) => e.corso_nome).join(', ')}.
              </div>
            )}

            {pv.figure.length === 0 ? (
              <div className="fzr-step-empty" style={{ marginTop: 8 }}>
                Non ricopre alcun ruolo nell&rsquo;organigramma: e&rsquo; in anagrafica ma non assegnata.
              </div>
            ) : pv.figure.map((fg) => {
              const { reqs, mods } = evidenzePerFigura(pv, fg.codice);
              return (
                <div key={fg.codice} className="fzr-step">
                  <div className="fzr-step-h">
                    <span>{fg.nome}</span>
                    <button type="button" className="fzr-mini" style={{ marginLeft: 'auto' }}
                      onClick={() => { setCerca(''); apriFigura(fg.codice); }}>
                      Apri il ruolo
                    </button>
                  </div>
                  <div className="fzr-nomina" style={{ margin: '0 0 4px' }}>
                    <span>
                      {fg.codice === 'lavoratore' ? 'Adibito' : 'Nominato'}
                      {fg.data_nomina ? ' il ' + dataIT(fg.data_nomina) : ' — data non registrata'}
                    </span>
                    {fg.evidenza_mancante && <span className="fzr-dacnf">atto ufficiale mancante</span>}
                  </div>
                  {reqs.length === 0 && mods.length === 0 && (
                    <div className="fzr-step-empty">Nessun percorso formativo: e&rsquo; sufficiente la nomina.</div>
                  )}
                  {reqs.map((r) => (
                    <div key={r.corso_codice} className="fzr-r">
                      <div className="fzr-r-main">
                        <span className="fzr-r-name">
                          <span className={'fzr-dot ' + r.stato} title={TXT[r.stato]} />
                          <span>{r.corso_nome}{r.ore != null ? ' · ' + r.ore + 'h' : ''}</span>
                        </span>
                        <span className={'fzr-st ' + r.stato}>{TXT[r.stato]}</span>
                      </div>
                      <div className="fzr-d">{r.dettaglio}</div>
                    </div>
                  ))}
                  {mods.map((m) => (
                    <div key={'m-' + m.corso_codice} className="fzr-r">
                      <div className="fzr-r-main">
                        <span className="fzr-r-name">
                          <span className={'fzr-dot ' + m.stato} title={TXT[m.stato]} />
                          <span>{m.corso_nome}<span className="fzr-modtag">modulo</span></span>
                        </span>
                        <span className={'fzr-st ' + m.stato}>{TXT[m.stato]}</span>
                      </div>
                      {m.dettaglio && <div className="fzr-d">{m.dettaglio}</div>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // ORGANIGRAMMA ATTUALE: ruolo -> persona -> evidenze (esito, gemella del PDF).
  // A FISARMONICA: ogni figura e' una riga-testata richiudibile, e all'apertura
  // sono TUTTE chiuse (`aperte` parte vuoto). Il ruolo non e' piu' una colonna ma
  // la testata del suo blocco: srotolata tutta insieme, dopo un import del
  // gestionale la tabella e' lunga centinaia di righe e per confrontare due ruoli
  // si scorre a lungo. La riga chiusa dice gia' cio' che serve per decidere se
  // aprirla (semaforo, nome, quanti incaricati o se e' scoperta). Il clic su una
  // riga-persona continua ad aprire la scheda singola della figura.
  const renderTabella = () => (
    <div className="fzr-tab">
      <table>
        <thead><tr><th>Anagrafica persona</th><th>Evidenze formazione / esonero</th></tr></thead>
        {gruppiCopertura.flatMap((g) => g.righe).map(({ figura, assegnate }) => {
          const open = aperte.has(figura.codice);
          const stato = statoFigura(figura, assegnate);
          const sc = riep.figureScoperte.find((f) => f.codice === figura.codice);
          const em = corsoEmergenzaRichiesto(figura.codice, riep.livello_antincendio, riep.gruppo_primo_soccorso);
          return (
            <tbody key={figura.codice}>
              <tr className="figrow" onClick={() => toggleFigura(figura.codice)}>
                <td colSpan={2}>
                  <span className="fzr-tab-pm">{open ? '−' : '+'}</span>
                  <span className={'fzr-dot ' + stato} />
                  <span className="fzr-tab-fn">{figura.nome}</span>
                  <span className={'fzr-tab-n' + (assegnate.length === 0 && sc ? ' crit' : '')}>
                    {assegnate.length === 0
                      ? (sc ? 'scoperto (obbligatorio)' : 'nessun incaricato')
                      : assegnate.length + (assegnate.length === 1 ? ' incaricato' : ' incaricati')}
                  </span>
                </td>
              </tr>
              {open && assegnate.length === 0 && (
                <tr className="clic" onClick={() => apriFigura(figura.codice)}>
                  <td className="vuoto" colSpan={2}>
                    <div className="fzr-tab-empty">
                      <span>Nessun incaricato{sc && em ? ' (corso: ' + em.testo + ')' : ''}</span>
                      {/* L'azione sta QUI, dove nasce la domanda: la riga aperta
                          diceva solo che il ruolo e' vuoto, e chi compila doveva
                          indovinare che si nomina da un'altra vista. */}
                      <button type="button" className="fzr-mini"
                        onClick={(e) => { e.stopPropagation(); apriAssegna(figura.codice); }}>
                        {figura.codice === 'lavoratore' ? 'Adibisci…' : 'Assegna…'}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {open && assegnate.map((pv) => {
              const { reqs, mods } = evidenzePerFigura(pv, figura.codice);
              return (
                <tr key={figura.codice + '|' + pv.persona.id} className="clic" onClick={() => apriFigura(figura.codice, pv.persona.id)}>
                  <td className="cpers">
                    <div className="pn">{nomePersonaCognome(pv.persona)}</div>
                    {(pv.persona.mansione || pv.persona.reparto) && (
                      <div className="pm">{[pv.persona.mansione, pv.persona.reparto].filter(Boolean).join(' \u00b7 ')}</div>
                    )}
                    <div style={{ marginTop: 3 }}><span className={'fzr-st ' + pv.stato}>{TXT[pv.stato]}</span></div>
                  </td>
                  <td>
                    {reqs.length === 0 && mods.length === 0 && <span className="none">nessuna evidenza</span>}
                    {reqs.map((r) => (
                      <div key={r.corso_codice} className="ev">
                        {/* "svolto il" solo quando c'e' una scadenza: senza, il
                            dettaglio e' gia' "Svolto il gg/mm/aaaa - non scade"
                            (statoDaScadenza) e la data comparirebbe due volte. */}
                        <span className="corso">{r.corso_nome}{r.dettaglio ? ' \u2014 ' + r.dettaglio : ''}{r.data_completamento && r.scadenza ? ' \u00b7 svolto il ' + dataIT(r.data_completamento) : ''}{r.scadenza ? ' ' : ''}<span className="scad">{r.scadenza ? '(scad. ' + dataIT(r.scadenza) + ')' : ''}</span></span>
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
              })}
              {/* Anche a ruolo coperto la modifica degli incaricati deve essere
                  raggiungibile da qui: aggiungere una persona a un ruolo che ne
                  ha gia' una e' la stessa operazione del ruolo vuoto. */}
              {open && assegnate.length > 0 && (
                <tr>
                  <td colSpan={2} style={{ background: '#fdfcfa' }}>
                    <button type="button" className="fzr-mini"
                      onClick={() => apriAssegna(figura.codice)}>
                      {figura.codice === 'lavoratore' ? 'Modifica adibiti…' : 'Modifica incaricati…'}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
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
            <div className="fzr-cerca">
              <input type="search" value={cerca} onChange={(e) => setCerca(e.target.value)}
                placeholder="Cerca una persona: cognome, nome, mansione, codice fiscale" />
              {cerca !== '' && (
                <button type="button" className="fzr-mini" onClick={() => setCerca('')}>Pulisci</button>
              )}
            </div>
            {cercaAttiva ? renderRicerca() : (
              <>
                {/* Con i ruoli chiusi di default questa e' la sola via alla vista
                    d'insieme di prima (rileggere tutto l'organigramma, o controllarlo
                    prima di esportarlo), e "Chiudi tutte" e' il modo di tornare
                    indietro senza richiudere un ruolo per volta. */}
                <div className="fzr-actions" style={{ margin: '0 0 6px' }}>
                  <button type="button" className="fzr-mini"
                    disabled={figureAttese.every((f) => aperte.has(f.codice))}
                    onClick={() => setAperte(new Set(figureAttese.map((f) => f.codice)))}>
                    Espandi tutte ({figureAttese.length})
                  </button>
                  <button type="button" className="fzr-mini" disabled={aperte.size === 0}
                    onClick={() => setAperte(new Set())}>
                    Chiudi tutte
                  </button>
                </div>
                {renderTabella()}
              </>
            )}
          </div>
          <div className="fzr-split-side">
            <button type="button" className={'fzr-aggiorna' + (aggiornaOpen ? ' on' : '')}
              onClick={() => { setFocusFigura(null); setFocusEdit(false); setAggiornaOpen((v) => !v); }}>
              {aggiornaOpen ? 'Chiudi aggiornamento' : 'Aggiorna organigramma'}
            </button>
            {riep.figureScoperte.length > 0 && (
              <div className="fzr-side-note">{riep.figureScoperte.length} {riep.figureScoperte.length === 1 ? 'figura scoperta' : 'figure scoperte'}</div>
            )}
          </div>
        </div>
      )}

      {figureAttese.length > 0 && focusFigura && (() => {
        const riga = gruppiCopertura.flatMap((g) => g.righe).find((r) => r.figura.codice === focusFigura);
        return riga ? renderFigFocus(riga.figura, riga.assegnate) : null;
      })()}

      {figureAttese.length > 0 && aggiornaOpen && (
        <div className="fzr-cop">
          <div className="fzr-cop-bar">
            <div className="fzr-cop-barhead">
              Organigramma atteso {'\u2014'} ruoli, incaricati ed evidenze formative
              {riep.figureScoperte.length > 0 && (
                <span style={{ color: 'var(--no,#d8442f)', fontWeight: 800 }}> {'\u00b7'} {riep.figureScoperte.length} scoperte</span>
              )}
            </div>
            {/* Espansione di massa. Con i ruoli chiusi di default questa e' la
                sola via alla vista d'insieme di prima (utile per rileggere tutto
                l'organigramma o prima di esportarlo), e "Chiudi tutte" e' il modo
                di tornare indietro senza chiudere una scheda per volta. */}
            <div className="fzr-actions" style={{ margin: '0 0 6px' }}>
              <button type="button" className="fzr-mini"
                disabled={figureAttese.every((f) => aperte.has(f.codice))}
                onClick={() => setAperte(new Set(figureAttese.map((f) => f.codice)))}>
                Espandi tutte ({figureAttese.length})
              </button>
              <button type="button" className="fzr-mini" disabled={aperte.size === 0}
                onClick={() => setAperte(new Set())}>
                Chiudi tutte
              </button>
            </div>
            <div className="fzr-legenda">
              <span><span className="fzr-dot critico" /> obbligatorio scoperto / criticità</span>
              <span><span className="fzr-dot in_scadenza" /> in scadenza</span>
              <span><span className="fzr-dot da_verificare" /> da verificare</span>
              <span><span className="fzr-dot conforme" /> in regola</span>
              <span><span className="fzr-dot neutro" /> non assegnata (eventuale)</span>
            </div>
            {([
              { k: 'obbligatoria', l: 'Figure obbligatorie' },
              { k: 'eventuale', l: 'Figure eventuali (valutazione caso per caso)' },
            ] as const).map((macro) => {
              const grpMacro = gruppiCopertura.filter((g) => g.macro === macro.k);
              if (grpMacro.length === 0) return null;
              return (
              <div key={macro.k} className="fzr-macro">
                <div className={'fzr-macro-name ' + macro.k}>{macro.l}</div>
            {grpMacro.map((g) => {
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
