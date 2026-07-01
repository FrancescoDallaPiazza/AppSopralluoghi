// Modulo "Organigramma sicurezza & Formazione" - strato dati + motore.
//
// Online-first come il resto del back-office (parla direttamente con Supabase,
// niente coda offline). Vive sopra le tabelle della migration 014:
//   corso_catalogo, figura_sicurezza, figura_requisito, persona, nomina,
//   formazione, esonero, esonero_ammesso  (+ cliente.livello_rischio).
//
// I tipi del modulo sono co-locati qui per non toccare il types.ts condiviso.
//
// Motore (puro): dati una persona, le sue nomine e i suoi attestati, calcola
// per ogni requisito previsto lo stato (conforme / in_scadenza / critico /
// esonerato), la scadenza, e i promemoria di possibile esonero da mostrare in
// campo. Crediti automatici applicati: la formazione generale non scade (a
// catalogo aggiornamento_mesi = null) e un corso richiesto da piu' ruoli della
// stessa persona si conta una volta sola (dedup per codice corso).

import { supabase } from '../supabase';
import { newId } from '../types';
import { applicaCreditiAllegatoIII } from '../../formazione/creditiAllegatoIII';

// ============================ TIPI ============================

export type LivelloRischio = 'basso' | 'medio' | 'alto';
export type TipoEsonero =
  | 'titolo_studio' | 'abilitazione' | 'ruolo_equipollente'
  | 'credito_pregresso' | 'altro';

export interface CorsoCatalogo {
  id: string;
  codice: string;
  nome: string;
  categoria: string;
  ore: number | null;
  aggiornamento_mesi: number | null;
  ore_aggiornamento: number | null;
  prerequisito_codice: string | null;
  note: string | null;
  attivo: boolean;
}

export interface FiguraSicurezza {
  id: string;
  codice: string;
  nome: string;
  ordine: number;
  attiva: boolean;
  gruppo?: string | null;
  gruppo_ordine?: number | null;
  guida?: string | null;
  obbligo?: string | null;
}

export interface FiguraRequisito {
  id: string;
  figura_codice: string;
  corso_codice: string;
  obbligatorio: boolean;
  per_categoria: boolean;
  note: string | null;
}

export interface Persona {
  id: string;
  cliente_id: string;
  nome: string;
  cognome: string | null;
  codice_fiscale: string | null;
  mansione: string | null;
  reparto: string | null;
  data_assunzione: string | null;
  livello_rischio: LivelloRischio | null;
  attivo: boolean;
  note: string | null;
  formazione_pregressa: boolean;
}

export interface Nomina {
  id: string;
  persona_id: string;
  figura_codice: string;
  data_nomina: string | null;
  attiva: boolean;
  note: string | null;
}

export interface Formazione {
  id: string;
  persona_id: string;
  corso_codice: string | null;
  corso_nome: string;
  categoria: string | null;
  data_completamento: string | null;
  ore: number | null;
  ente_formatore: string | null;
  is_aggiornamento: boolean;
  scadenza: string | null;
  allegato_url: string | null;
  note: string | null;
}

export interface Esonero {
  id: string;
  persona_id: string;
  corso_codice: string | null;
  figura_codice: string | null;
  tipo: TipoEsonero;
  motivazione: string;
  riferimento_norm: string | null;
  documento_url: string | null;
  data_riconoscimento: string | null;
  // Scadenza del credito (migration 043): se il credito/esonero corrisponde a un
  // corso che scade (es. attestato RSPP usato come credito), la sua scadenza viene
  // monitorata come una formazione (azione collegata -> area Formazione).
  scadenza: string | null;
  attivo: boolean;
  note: string | null;
}

export interface EsoneroAmmesso {
  id: string;
  corso_codice: string | null;
  figura_codice: string | null;
  tipo: TipoEsonero;
  descrizione: string;
  riferimento_norm: string | null;
  ordine: number;
  attivo: boolean;
}

export interface AreaInterna {
  id: string;
  nome: string;
  email: string | null;
  attiva: boolean;
}

// --- output del motore ---

export type StatoRequisito = 'conforme' | 'in_scadenza' | 'critico' | 'esonerato' | 'facoltativo' | 'da_verificare';

export interface RequisitoValutato {
  figura_codici: string[];      // figure (della persona) che richiedono questo corso
  corso_codice: string;
  corso_nome: string;
  categoria: string;
  ore: number | null;           // espanse per rischio nel caso LAV_SPEC
  obbligatorio: boolean;
  stato: StatoRequisito;
  scadenza: string | null;      // calcolata o esplicita
  dettaglio: string;            // testo breve di spiegazione
  formazione_id: string | null;
  esonero_id: string | null;
  allegato_url: string | null; // path attestato nel bucket privato (se presente)
  promemoria: EsoneroAmmesso[]; // possibili esoneri da mostrare in campo
}

// Modulo formativo condizionato (es. cantieri): non e' un obbligo della figura
// ma un corso aggiuntivo che si applica solo a certe imprese. Valutato a parte,
// con stato 'facoltativo' (neutro) quando non registrato, cosi' non genera falsi
// gap. Non entra nei conteggi ne' nello stato peggiore della persona.
export interface ModuloValutato {
  ammesso_id: string;          // esonero_ammesso.id che descrive il modulo
  figura_codice: string;
  corso_codice: string;
  corso_nome: string;
  categoria: string;
  ore: number | null;
  stato: StatoRequisito;       // 'facoltativo' se non registrato, altrimenti reale
  scadenza: string | null;
  dettaglio: string;
  formazione_id: string | null;
  allegato_url: string | null;
}

export interface PersonaValutata {
  persona: Persona;
  figure: { codice: string; nome: string; nomina_id: string | null; data_nomina: string | null }[];
  requisiti: RequisitoValutato[];
  stato: StatoRequisito;        // peggiore tra i requisiti (esonerato non peggiora)
  moduli: ModuloValutato[];     // moduli condizionati (cantieri, ...), valutati a parte
  promemoria_figura: EsoneroAmmesso[]; // ammessi legati alla figura (senza corso)
}

export interface ConteggiStato {
  conforme: number;
  in_scadenza: number;
  critico: number;
  esonerato: number;
  da_verificare: number;
}

export interface RiepilogoCliente {
  cliente_id: string;
  livello_rischio: LivelloRischio | null;
  // Emergenze: definiti a monte sul cliente (migration 041). Determinano il
  // corso richiesto agli addetti antincendio / primo soccorso.
  livello_antincendio: LivelloAntincendio | null;
  gruppo_primo_soccorso: GruppoPrimoSoccorso | null;
  persone: PersonaValutata[];
  conteggi: ConteggiStato;
  figureScoperte: FiguraSicurezza[];
}

// Catalogo di riferimento caricato una volta e passato al motore.
export interface Catalogo {
  corsi: CorsoCatalogo[];
  figure: FiguraSicurezza[];
  requisiti: FiguraRequisito[];
  esoneriAmmessi: EsoneroAmmesso[];
}

// ============================ COSTANTI / HELPER ============================

// Finestra di preavviso per lo stato "in scadenza" (scelta concordata: 6 mesi).
export const MESI_PREAVVISO = 6;

// Corso base datore di lavoro (DATORE_LAVORO): obbligo introdotto dall'ASR
// 17/04/2025, prima applicazione entro il 19/05/2027. Fino a quella data il
// requisito, se non ancora assolto, e' "in scadenza" (non critico).
const CORSO_DATORE_BASE = 'DATORE_LAVORO';
const SCAD_PRIMA_DATORE = '2027-05-19';

// Marcatore (prefisso di `formazione.note`) che identifica un attestato inserito
// come EVIDENZA PREGRESSA (formazione ante ASR 2025, dicitura libera). Quando un
// requisito risulta coperto da un'evidenza pregressa, l'organigramma mostra la
// dicitura scritta dal consulente al posto del nome modulare ASR 2025 a catalogo.
export const MARCA_PREGRESSA = 'Evidenza pregressa';

// Categorie di corso NON soggette al regime transitorio "formazione pregressa"
// dell'ASR 17/04/2025: antincendio (DM 02/09/2021) e primo soccorso (DM 388/2003)
// hanno regimi propri e non prevedono il concetto di formazione pregressa "da
// verificare". Per questi, un attestato mancante e' direttamente critico (non
// "da verificare") e non vanno proposti nel flusso pregressa.
export const CATEGORIE_NO_PREGRESSA = new Set(['antincendio', 'primo_soccorso']);

// ---- Emergenze: livello rischio incendio + gruppo primo soccorso ----------
// Definiti a monte sul cliente. Determinano il corso che gli addetti devono
// avere e, se l'addetto manca, il corso da erogare (indicato nel report).
export type LivelloAntincendio = '1' | '2' | '3';
export type GruppoPrimoSoccorso = 'A' | 'BC';

// Corsi antincendio per livello (DM 02/09/2021): 4h / 8h / 16h.
export const CORSI_ANTINCENDIO: Record<LivelloAntincendio, { codice: string; nome: string; ore: number }> = {
  '1': { codice: 'AI_LIV1', nome: 'Addetto antincendio livello 1', ore: 4 },
  '2': { codice: 'AI_LIV2', nome: 'Addetto antincendio livello 2', ore: 8 },
  '3': { codice: 'AI_LIV3', nome: 'Addetto antincendio livello 3', ore: 16 },
};
// Corsi primo soccorso per gruppo aziendale (DM 388/2003): A = 16h, B/C = 12h.
export const CORSI_PRIMO_SOCCORSO: Record<GruppoPrimoSoccorso, { codice: string; nome: string; ore: number }> = {
  'A':  { codice: 'PS_GRA',  nome: 'Addetto primo soccorso gruppo A', ore: 16 },
  'BC': { codice: 'PS_GRBC', nome: 'Addetto primo soccorso gruppi B e C', ore: 12 },
};

// Indicazione del corso richiesto per una figura di emergenza, dati i livelli
// definiti sul cliente. Ritorna null se la figura non e' di emergenza;
// { definito:false } se manca la scelta di livello/gruppo (va definita prima).
export function corsoEmergenzaRichiesto(
  figuraCodice: string,
  livAntincendio: LivelloAntincendio | null,
  gruppoPS: GruppoPrimoSoccorso | null,
): { definito: boolean; codice: string | null; testo: string } | null {
  if (figuraCodice === 'addetto_antincendio') {
    if (!livAntincendio) return { definito: false, codice: null, testo: 'definire prima il livello di rischio incendio (1, 2 o 3)' };
    const c = CORSI_ANTINCENDIO[livAntincendio];
    return { definito: true, codice: c.codice, testo: c.nome + ' (' + c.ore + 'h)' };
  }
  if (figuraCodice === 'addetto_primo_soccorso') {
    if (!gruppoPS) return { definito: false, codice: null, testo: 'definire prima il gruppo di primo soccorso (A oppure B/C)' };
    const c = CORSI_PRIMO_SOCCORSO[gruppoPS];
    return { definito: true, codice: c.codice, testo: c.nome + ' (' + c.ore + 'h)' };
  }
  return null;
}

// Vero se, assegnando una persona a QUESTA figura, ha senso chiederle la
// formazione pregressa. La figura deve avere almeno un requisito il cui corso:
//  (a) non sia antincendio / primo soccorso (regimi propri, CATEGORIE_NO_PREGRESSA);
//  (b) non sia il corso base del Datore di lavoro: e' un obbligo NUOVO dell'ASR
//      2025, quindi il flag formazione_pregressa non ne cambia la valutazione
//      (resta "in scadenza"/"critico", mai "da verificare").
// UNICA sorgente di verita', condivisa da back-office e campo: cosi' una modifica
// fatta in campo resta coerente con il back-office.
export function figuraChiedePregressa(
  figuraCodice: string,
  requisiti: { figura_codice: string; corso_codice: string }[],
  corsi: { codice: string; categoria: string }[],
): boolean {
  const catDi = new Map(corsi.map((c) => [c.codice, c.categoria]));
  return requisiti.some((r) =>
    r.figura_codice === figuraCodice
    && r.corso_codice !== CORSO_DATORE_BASE
    && !CATEGORIE_NO_PREGRESSA.has(catDi.get(r.corso_codice) ?? ''));
}

// Ore di formazione specifica lavoratori per livello di rischio.
const ORE_SPECIFICA: Record<LivelloRischio, number> = { basso: 4, medio: 8, alto: 12 };

const vuotoNull = (s: string | null | undefined): string | null => {
  const v = (s ?? '').trim();
  return v === '' ? null : v;
};

export function nomePersona(p: { nome?: string | null; cognome?: string | null }): string {
  const n = (p.nome ?? '').trim();
  const c = (p.cognome ?? '').trim();
  return [n, c].filter(Boolean).join(' ') || 'Persona';
}

function oggi(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isoToDate(iso: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function addMesi(iso: string, mesi: number): string {
  const d = isoToDate(iso);
  if (!d) return iso;
  const r = new Date(d.getFullYear(), d.getMonth() + mesi, d.getDate());
  const yyyy = r.getFullYear();
  const mm = String(r.getMonth() + 1).padStart(2, '0');
  const dd = String(r.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function dataIT(iso: string | null): string {
  const d = isoToDate(iso);
  if (!d) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const peso: Record<StatoRequisito, number> = { conforme: 0, esonerato: 0, facoltativo: 0, da_verificare: 1, in_scadenza: 2, critico: 3 };
function peggiore(a: StatoRequisito, b: StatoRequisito): StatoRequisito {
  return peso[a] >= peso[b] ? a : b;
}

// Stato + testo a partire dalla scadenza calcolata di un attestato gia' svolto.
// Estratto per riuso tra i requisiti obbligatori e i moduli condizionati.
function statoDaScadenza(scad: string | null, dataComp: string): { stato: StatoRequisito; dettaglio: string } {
  if (!scad) {
    return { stato: 'conforme', dettaglio: 'Svolto il ' + dataIT(dataComp) + ' - non scade' };
  }
  const ds = isoToDate(scad)!;
  const limite = oggi();
  const soglia = new Date(limite.getFullYear(), limite.getMonth() + MESI_PREAVVISO, limite.getDate());
  if (ds < limite) return { stato: 'critico', dettaglio: 'Scaduto il ' + dataIT(scad) };
  if (ds <= soglia) return { stato: 'in_scadenza', dettaglio: 'Scade il ' + dataIT(scad) };
  return { stato: 'conforme', dettaglio: 'Valido fino al ' + dataIT(scad) };
}

// ============================ MOTORE (puro) ============================

interface DatiPersona {
  persona: Persona;
  nomine: Nomina[];
  formazioni: Formazione[];
  esoneri: Esonero[];
}

// Categoria effettiva di un attestato (esplicita o ricavata dal catalogo).
function categoriaFormazione(f: Formazione, byCodice: Map<string, CorsoCatalogo>): string | null {
  if (f.categoria) return f.categoria;
  if (f.corso_codice) return byCodice.get(f.corso_codice)?.categoria ?? null;
  return null;
}

function scegliFormazione(
  req: { corso_codice: string; per_categoria: boolean; categoria: string },
  formazioni: Formazione[],
  byCodice: Map<string, CorsoCatalogo>,
): Formazione | null {
  const candidate = formazioni.filter((f) => {
    if (f.corso_codice && f.corso_codice === req.corso_codice) return true;
    if (req.per_categoria && categoriaFormazione(f, byCodice) === req.categoria) return true;
    return false;
  });
  if (!candidate.length) return null;
  // la piu' recente per data_completamento (null in coda)
  candidate.sort((a, b) => (b.data_completamento ?? '').localeCompare(a.data_completamento ?? ''));
  return candidate[0];
}

// Valuta i moduli condizionati (es. cantieri): esoneri_ammessi tipo 'altro' con
// corso e figura, agganciati alle figure della persona. Non sono obblighi: se
// coperti da un esonero/credito attivo risultano 'esonerato'; se non registrati
// restano 'facoltativo' (neutro); altrimenti seguono la scadenza reale. Dedup
// per codice corso. Non concorrono a conteggi/stato persona.
function valutaModuli(
  figureSet: Set<string>,
  formazioni: Formazione[],
  esoneriAttivi: Esonero[],
  byCodice: Map<string, CorsoCatalogo>,
  cat: Catalogo,
): ModuloValutato[] {
  const out = new Map<string, ModuloValutato>();
  for (const a of cat.esoneriAmmessi) {
    if (!a.attivo || a.tipo !== 'altro' || !a.corso_codice || !a.figura_codice) continue;
    if (!figureSet.has(a.figura_codice)) continue;
    if (out.has(a.corso_codice)) continue;
    const corso = byCodice.get(a.corso_codice);
    if (!corso) continue;
    const categoria = corso.categoria ?? '';

    // esonero/credito che copre questo modulo? (per corso, o per figura senza corso)
    const eson = esoneriAttivi.find(
      (e) =>
        (e.corso_codice && e.corso_codice === a.corso_codice && (!e.figura_codice || figureSet.has(e.figura_codice))) ||
        (!e.corso_codice && e.figura_codice && e.figura_codice === a.figura_codice),
    );
    if (eson) {
      out.set(a.corso_codice, {
        ammesso_id: a.id, figura_codice: a.figura_codice, corso_codice: a.corso_codice,
        corso_nome: corso.nome, categoria, ore: corso.ore ?? null,
        stato: 'esonerato', scadenza: null,
        dettaglio: 'Esonero: ' + eson.motivazione + (eson.riferimento_norm ? ' (' + eson.riferimento_norm + ')' : ''),
        formazione_id: null, allegato_url: null,
      });
      continue;
    }

    const f = scegliFormazione({ corso_codice: a.corso_codice, per_categoria: false, categoria }, formazioni, byCodice);
    if (!f || !f.data_completamento) {
      out.set(a.corso_codice, {
        ammesso_id: a.id, figura_codice: a.figura_codice, corso_codice: a.corso_codice,
        corso_nome: corso.nome, categoria, ore: corso.ore ?? null,
        stato: 'facoltativo', scadenza: null, dettaglio: 'Modulo condizionato: non registrato',
        formazione_id: null, allegato_url: null,
      });
    } else {
      const aggMesi = corso.aggiornamento_mesi ?? null;
      const scad = f.scadenza ?? (aggMesi ? addMesi(f.data_completamento, aggMesi) : null);
      const { stato, dettaglio } = statoDaScadenza(scad, f.data_completamento);
      out.set(a.corso_codice, {
        ammesso_id: a.id, figura_codice: a.figura_codice, corso_codice: a.corso_codice,
        corso_nome: corso.nome, categoria, ore: corso.ore ?? null,
        stato, scadenza: scad, dettaglio, formazione_id: f.id, allegato_url: f.allegato_url,
      });
    }
  }
  return [...out.values()].sort((x, y) => x.corso_nome.localeCompare(y.corso_nome));
}

export function valutaPersona(d: DatiPersona, cat: Catalogo, rischioCliente: LivelloRischio | null): PersonaValutata {
  const byCodice = new Map(cat.corsi.map((c) => [c.codice, c]));
  const figureCodici = d.nomine.filter((n) => n.attiva).map((n) => n.figura_codice);
  const figureSet = new Set(figureCodici);
  const nominaByFigura = new Map(d.nomine.filter((n) => n.attiva).map((n) => [n.figura_codice, n]));
  const figure = cat.figure
    .filter((f) => figureSet.has(f.codice))
    .sort((a, b) => a.ordine - b.ordine)
    .map((f) => ({
      codice: f.codice, nome: f.nome,
      nomina_id: nominaByFigura.get(f.codice)?.id ?? null,
      data_nomina: nominaByFigura.get(f.codice)?.data_nomina ?? null,
    }));

  const rischio = d.persona.livello_rischio ?? rischioCliente;

  // requisiti uniti per le figure della persona, dedup per codice corso
  const reqByCorso = new Map<string, { corso_codice: string; obbligatorio: boolean; per_categoria: boolean; figure: string[] }>();
  for (const r of cat.requisiti) {
    if (!figureSet.has(r.figura_codice)) continue;
    const cur = reqByCorso.get(r.corso_codice);
    if (cur) {
      cur.obbligatorio = cur.obbligatorio || r.obbligatorio;
      cur.per_categoria = cur.per_categoria || r.per_categoria;
      if (!cur.figure.includes(r.figura_codice)) cur.figure.push(r.figura_codice);
    } else {
      reqByCorso.set(r.corso_codice, {
        corso_codice: r.corso_codice,
        obbligatorio: r.obbligatorio,
        per_categoria: r.per_categoria,
        figure: [r.figura_codice],
      });
    }
  }

  const esoneriAttivi = d.esoneri.filter((e) => e.attivo);

  const requisiti: RequisitoValutato[] = [];
  for (const r of reqByCorso.values()) {
    const corso = byCodice.get(r.corso_codice);
    const categoria = corso?.categoria ?? '';
    const corsoNome = corso?.nome ?? r.corso_codice;
    // Requisito a percorsi multipli: per_categoria con piu' corsi nella stessa
    // categoria (es. antincendio liv.1/2/3, primo soccorso gruppo A / B-C). Per
    // questi NON si assume un livello: senza attestato la riga dice "corso da
    // scegliere" e il livello/gruppo lo sceglie il consulente registrando
    // l'attestato della persona. (Il lavoratore specifico NON e' qui: e' un solo
    // corso le cui ore si derivano dal rischio.)
    const altCategoria = cat.corsi.filter((c) => (c.categoria ?? '') === categoria);
    const multiPath = r.per_categoria && altCategoria.length > 1;
    const corsoNomeNeutro = multiPath ? ((corsoNome.split(' - ')[0] ?? corsoNome) + ' (corso da scegliere)') : corsoNome;

    // ore: caso LAV_SPEC -> espanse per rischio
    let ore = corso?.ore ?? null;
    if (r.corso_codice === 'LAV_SPEC') ore = rischio ? ORE_SPECIFICA[rischio] : null;

    // promemoria esoneri ammessi per questo corso
    const promemoria = cat.esoneriAmmessi.filter(
      (a) => a.attivo && a.corso_codice === r.corso_codice,
    );

    // 1) esonero registrato?
    const eson = esoneriAttivi.find(
      (e) =>
        (e.corso_codice && e.corso_codice === r.corso_codice && (!e.figura_codice || figureSet.has(e.figura_codice))) ||
        (!e.corso_codice && e.figura_codice && figureSet.has(e.figura_codice)),
    );
    if (eson) {
      // Esonero senza scadenza: copre il requisito (esonerato). Esonero da credito
      // con scadenza: si comporta come un attestato che scade (esonerato finche'
      // valido, poi in scadenza/critico) ed entra nello scadenzario.
      const base = 'Esonero: ' + eson.motivazione + (eson.riferimento_norm ? ' (' + eson.riferimento_norm + ')' : '');
      if (eson.scadenza) {
        const { stato: st, dettaglio: dt } = statoDaScadenza(eson.scadenza, eson.data_riconoscimento ?? eson.scadenza);
        requisiti.push({
          figura_codici: r.figure, corso_codice: r.corso_codice, corso_nome: corsoNome,
          categoria, ore, obbligatorio: r.obbligatorio,
          stato: st === 'conforme' ? 'esonerato' : st, scadenza: eson.scadenza,
          dettaglio: base + ' \u00b7 ' + dt,
          formazione_id: null, esonero_id: eson.id, allegato_url: null, promemoria,
        });
      } else {
        requisiti.push({
          figura_codici: r.figure, corso_codice: r.corso_codice, corso_nome: corsoNome,
          categoria, ore, obbligatorio: r.obbligatorio, stato: 'esonerato', scadenza: null,
          dettaglio: base,
          formazione_id: null, esonero_id: eson.id, allegato_url: null, promemoria,
        });
      }
      continue;
    }

    // 2) attestato corrispondente?
    const f = scegliFormazione({ corso_codice: r.corso_codice, per_categoria: r.per_categoria, categoria }, d.formazioni, byCodice);
    if (!f || !f.data_completamento) {
      // Nessun attestato e nessun esonero registrato.
      let stato: StatoRequisito = 'critico';
      let dettaglio = 'Mai svolto';
      let scadenza: string | null = null;
      if (r.corso_codice === CORSO_DATORE_BASE) {
        // Obbligo nuovo (ASR 2025): prima applicazione entro il 19/05/2027.
        scadenza = SCAD_PRIMA_DATORE;
        if (isoToDate(SCAD_PRIMA_DATORE)! < oggi()) {
          stato = 'critico'; dettaglio = 'Prima formazione scaduta (termine ' + dataIT(SCAD_PRIMA_DATORE) + ')';
        } else {
          stato = 'in_scadenza'; dettaglio = 'Prima formazione entro il ' + dataIT(SCAD_PRIMA_DATORE);
        }
      } else if (d.persona.formazione_pregressa && !CATEGORIE_NO_PREGRESSA.has(categoria)) {
        // Persona con formazione pregressa (regime ante ASR 2025): non "mai svolto"
        // ma "da verificare", finche' non si recupera/registra l'attestato.
        // Antincendio e primo soccorso sono esclusi: regime proprio, restano critici.
        stato = 'da_verificare';
        dettaglio = 'Formazione pregressa dichiarata: attestato da recuperare e registrare';
      }
      if (multiPath && dettaglio === 'Mai svolto') {
        dettaglio = 'Corso da scegliere e registrare (livello/gruppo)';
      }
      requisiti.push({
        figura_codici: r.figure, corso_codice: r.corso_codice, corso_nome: corsoNomeNeutro,
        categoria, ore, obbligatorio: r.obbligatorio, stato, scadenza,
        dettaglio, formazione_id: f?.id ?? null, esonero_id: null, allegato_url: f?.allegato_url ?? null, promemoria,
      });
      continue;
    }

    // 3) calcolo scadenza e stato
    const aggMesi = corso?.aggiornamento_mesi ?? null;
    const scad = f.scadenza ?? (aggMesi ? addMesi(f.data_completamento, aggMesi) : null);
    const { stato, dettaglio } = statoDaScadenza(scad, f.data_completamento);
    // Evidenza pregressa: l'attestato e' un corso degli accordi precedenti con
    // dicitura libera. Mostriamo QUELLA dicitura al posto del nome modulare ASR
    // 2025 a catalogo, indicando nel dettaglio quale requisito ASR 2025 copre.
    // Etichetta mostrata: per i requisiti a percorsi multipli (e per le evidenze
    // pregresse a dicitura libera) si mostra il corso EFFETTIVO dell'attestato
    // (livello/gruppo realmente svolto), non il segnaposto del requisito.
    const pregressa = (f.note ?? '').startsWith(MARCA_PREGRESSA) && f.corso_nome.trim() !== '';
    const usaNomeAttestato = (pregressa || multiPath) && f.corso_nome.trim() !== '';
    const nomeMostrato = usaNomeAttestato ? f.corso_nome.trim() : corsoNome;
    const dettaglioMostrato = pregressa ? dettaglio + ' \u00b7 pregresso, copre: ' + (corsoNome.split(' - ')[0] ?? corsoNome) : dettaglio;
    requisiti.push({
      figura_codici: r.figure, corso_codice: r.corso_codice, corso_nome: nomeMostrato,
      categoria, ore, obbligatorio: r.obbligatorio, stato, scadenza: scad,
      dettaglio: dettaglioMostrato, formazione_id: f.id, esonero_id: null, allegato_url: f.allegato_url, promemoria,
    });
  }

  // ordine di presentazione: per figura/ordine catalogo non banale -> per nome corso
  requisiti.sort((a, b) => a.corso_nome.localeCompare(b.corso_nome));

  // Crediti tra ruoli (Allegato III ASR 17/04/2025): un ruolo posseduto puo'
  // creditare il corso richiesto da un altro ruolo della stessa persona. Marca
  // 'esonerato' i requisiti coperti, prima di derivare lo stato complessivo.
  const nomeFigura = new Map(cat.figure.map((f) => [f.codice, f.nome]));
  applicaCreditiAllegatoIII(requisiti, figureSet, (c) => nomeFigura.get(c) ?? c);

  const statoPersona = requisiti.reduce<StatoRequisito>((acc, r) => peggiore(acc, r.stato), 'conforme');

  const promemoriaFigura = cat.esoneriAmmessi.filter(
    (a) => a.attivo && !a.corso_codice && a.figura_codice && figureSet.has(a.figura_codice),
  );

  const moduli = valutaModuli(figureSet, d.formazioni, esoneriAttivi, byCodice, cat);

  return { persona: d.persona, figure, requisiti, stato: statoPersona, moduli, promemoria_figura: promemoriaFigura };
}

// ============================ CARICAMENTO DATI ============================

export async function caricaCatalogo(): Promise<Catalogo> {
  const [c, f, r, ea] = await Promise.all([
    supabase.from('corso_catalogo').select('*').order('categoria'),
    supabase.from('figura_sicurezza').select('*').order('gruppo_ordine', { nullsFirst: false }).order('ordine'),
    supabase.from('figura_requisito').select('*'),
    supabase.from('esonero_ammesso').select('*').order('ordine'),
  ]);
  if (c.error) throw c.error;
  if (f.error) throw f.error;
  if (r.error) throw r.error;
  if (ea.error) throw ea.error;
  return {
    corsi: (c.data ?? []) as CorsoCatalogo[],
    figure: (f.data ?? []) as FiguraSicurezza[],
    requisiti: (r.data ?? []) as FiguraRequisito[],
    esoneriAmmessi: (ea.data ?? []) as EsoneroAmmesso[],
  };
}

export async function caricaAreeInterne(): Promise<AreaInterna[]> {
  const { data, error } = await supabase
    .from('area_interna').select('id, nome, email, attiva')
    .eq('attiva', true).order('nome');
  if (error) throw error;
  return (data ?? []) as AreaInterna[];
}

export async function caricaPersone(clienteId: string): Promise<Persona[]> {
  const { data, error } = await supabase
    .from('persona').select('*')
    .eq('cliente_id', clienteId).order('cognome').order('nome');
  if (error) throw error;
  return (data ?? []) as Persona[];
}

async function caricaPerPersone<T>(tabella: string, personaIds: string[]): Promise<T[]> {
  if (!personaIds.length) return [];
  const { data, error } = await supabase.from(tabella).select('*').in('persona_id', personaIds);
  if (error) throw error;
  return (data ?? []) as T[];
}

// Dati grezzi dell'organigramma di un cliente, gia' caricati da qualunque
// sorgente: Supabase (online, back-office) oppure cache locale Dexie (offline,
// campo). Alimentano la funzione di assemblaggio pura qui sotto.
export interface DatiOrganigramma {
  persone: Persona[];
  nomine: Nomina[];
  formazioni: Formazione[];
  esoneri: Esonero[];
}

// Assemblaggio del riepilogo cliente: PURO. Dati il catalogo, il rischio del
// cliente e i dati grezzi (persone + nomine + formazioni + esoneri), valuta ogni
// persona attiva con il motore puro `valutaPersona` e aggrega i conteggi. Non
// tocca la rete: la stessa logica serve il back-office (dati da Supabase) e la
// compilazione di campo (dati dalla cache offline tramite caricaOrganigrammaLocale).
export function assemblaRiepilogo(
  clienteId: string,
  rischio: LivelloRischio | null,
  dati: DatiOrganigramma,
  cat: Catalogo,
  opts?: {
    rlsTerritoriale?: boolean;
    livAntincendio?: LivelloAntincendio | null;
    gruppoPS?: GruppoPrimoSoccorso | null;
  },
): RiepilogoCliente {
  const valutate = dati.persone
    .filter((p) => p.attivo)
    .map((p) =>
      valutaPersona(
        {
          persona: p,
          nomine: dati.nomine.filter((n) => n.persona_id === p.id),
          formazioni: dati.formazioni.filter((f) => f.persona_id === p.id),
          esoneri: dati.esoneri.filter((e) => e.persona_id === p.id),
        },
        cat,
        rischio,
      ),
    );

  const conteggi: ConteggiStato = { conforme: 0, in_scadenza: 0, critico: 0, esonerato: 0, da_verificare: 0 };
  for (const pv of valutate) {
    for (const r of pv.requisiti) {
      // I requisiti non assumono mai 'facoltativo' (e' uno stato dei soli moduli
      // condizionati, contati a parte), ma il tipo StatoRequisito ora lo include:
      // si salta esplicitamente per restringere l'indice alle chiavi di ConteggiStato.
      if (r.stato === 'facoltativo') continue;
      conteggi[r.stato]++;
    }
  }

  // Figure obbligatorie (obbligo 'sempre') senza alcun incaricato attivo = ruoli
  // scoperti (criticita' di organigramma). Eccezioni: l'RSPP non e' richiesto se
  // il datore svolge il ruolo di RSPP (dl_rspp coperta); l'RLS non e' scoperto se
  // l'azienda dichiara di essere coperta dal rappresentante territoriale (RLST).
  const coperte = new Set<string>();
  for (const pv of valutate) for (const fg of pv.figure) coperte.add(fg.codice);
  const dlRsppCoperto = coperte.has('dl_rspp');
  const rlsTerritoriale = opts?.rlsTerritoriale ?? false;
  const figureScoperte = cat.figure.filter(
    (f) => f.attiva && f.obbligo === 'sempre' && !coperte.has(f.codice)
      && !((f.codice === 'rspp' || f.codice === 'aspp') && dlRsppCoperto)
      && !(f.codice === 'rls' && rlsTerritoriale),
  );

  return {
    cliente_id: clienteId,
    livello_rischio: rischio,
    livello_antincendio: opts?.livAntincendio ?? null,
    gruppo_primo_soccorso: opts?.gruppoPS ?? null,
    persone: valutate, conteggi, figureScoperte,
  };
}

// Carica i dati grezzi dell'organigramma di un cliente da Supabase (rischio +
// persone/nomine/formazioni/esoneri), pronti per `assemblaRiepilogo`. Estratto
// da `valutaCliente` per essere riusato dallo snapshot versionato (revisioni).
export async function caricaDatiOrganigramma(
  clienteId: string,
): Promise<{
  rischio: LivelloRischio | null;
  rlsTerritoriale: boolean;
  livAntincendio: LivelloAntincendio | null;
  gruppoPS: GruppoPrimoSoccorso | null;
  dati: DatiOrganigramma;
}> {
  const cli = await supabase.from('cliente')
    .select('livello_rischio, rls_territoriale, livello_antincendio, gruppo_primo_soccorso')
    .eq('id', clienteId).single();
  if (cli.error) throw cli.error;
  const rischio = (cli.data?.livello_rischio ?? null) as LivelloRischio | null;
  const rlsTerritoriale = (cli.data?.rls_territoriale ?? false) as boolean;
  const livAntincendio = (cli.data?.livello_antincendio ?? null) as LivelloAntincendio | null;
  const gruppoPS = (cli.data?.gruppo_primo_soccorso ?? null) as GruppoPrimoSoccorso | null;

  const persone = await caricaPersone(clienteId);
  const ids = persone.map((p) => p.id);
  const [nomine, formazioni, esoneri] = await Promise.all([
    caricaPerPersone<Nomina>('nomina', ids),
    caricaPerPersone<Formazione>('formazione', ids),
    caricaPerPersone<Esonero>('esonero', ids),
  ]);
  return { rischio, rlsTerritoriale, livAntincendio, gruppoPS, dati: { persone, nomine, formazioni, esoneri } };
}

// Valuta l'intero cliente: organigramma + stato formativo per persona.
// Online-first: carica i dati da Supabase e delega l'assemblaggio alla funzione
// pura `assemblaRiepilogo` (la medesima usata offline in campo).
export async function valutaCliente(clienteId: string, cat?: Catalogo): Promise<RiepilogoCliente> {
  const catalogo = cat ?? (await caricaCatalogo());
  const { rischio, rlsTerritoriale, livAntincendio, gruppoPS, dati } = await caricaDatiOrganigramma(clienteId);
  return assemblaRiepilogo(clienteId, rischio, dati, catalogo, { rlsTerritoriale, livAntincendio, gruppoPS });
}

// ============================ CRUD ============================

export async function salvaPersona(p: Persona): Promise<Persona> {
  const row = {
    id: p.id || newId(),
    cliente_id: p.cliente_id,
    nome: p.nome.trim(),
    cognome: vuotoNull(p.cognome),
    codice_fiscale: vuotoNull(p.codice_fiscale),
    mansione: vuotoNull(p.mansione),
    reparto: vuotoNull(p.reparto),
    data_assunzione: vuotoNull(p.data_assunzione),
    livello_rischio: p.livello_rischio,
    attivo: p.attivo,
    note: vuotoNull(p.note),
    formazione_pregressa: p.formazione_pregressa,
  };
  const { data, error } = await supabase.from('persona').upsert(row).select().single();
  if (error) throw error;
  return data as Persona;
}

export async function eliminaPersona(id: string): Promise<void> {
  const { error } = await supabase.from('persona').delete().eq('id', id);
  if (error) throw error;
}

export async function salvaNomina(n: Nomina): Promise<Nomina> {
  const row = {
    id: n.id || newId(),
    persona_id: n.persona_id,
    figura_codice: n.figura_codice,
    data_nomina: vuotoNull(n.data_nomina),
    attiva: n.attiva,
    note: vuotoNull(n.note),
  };
  const { data, error } = await supabase.from('nomina').upsert(row).select().single();
  if (error) throw error;
  return data as Nomina;
}

export async function eliminaNomina(id: string): Promise<void> {
  const { error } = await supabase.from('nomina').delete().eq('id', id);
  if (error) throw error;
}

// Aggiorna solo la data di nomina di una nomina esistente (per id), senza
// toccare gli altri campi. Usata dai box di assegnazione dell'organigramma.
export async function aggiornaDataNomina(id: string, data_nomina: string | null): Promise<void> {
  const { error } = await supabase.from('nomina').update({ data_nomina: vuotoNull(data_nomina) }).eq('id', id);
  if (error) throw error;
}

// id area interna "Formazione" (memo di sessione): l'azione di scadenza viene
// indirizzata a quest'area per il monitoraggio e l'invito ai corsi interni.
let _areaFormazioneId: string | null | undefined;
export async function areaFormazioneId(): Promise<string | null> {
  if (_areaFormazioneId !== undefined) return _areaFormazioneId;
  const r = await supabase.from('area_interna').select('id, nome, attiva').eq('attiva', true);
  const a = (r.data ?? []).find((x: { nome?: string | null }) => /formazione/i.test(x.nome ?? ''));
  _areaFormazioneId = (a?.id ?? null) as string | null;
  return _areaFormazioneId;
}

// Costruisce la riga dell'azione di scadenzario COLLEGATA a una formazione con
// scadenza. id = id formazione (upsert idempotente per id: rinnovo -> update;
// FK on delete cascade). Indirizzata all'AREA FORMAZIONE interna (monitoraggio +
// invito ai corsi); tiene anche `responsabile_cliente_id` per contesto/filtro.
// Se l'area Formazione non e' configurata, ripiega sul cliente. Omette di
// proposito `stato`/`priorita`: in upsert PostgREST non tocca le colonne assenti,
// quindi un eventuale stato gia' chiuso dall'utente NON viene riaperto; in insert
// valgono i default. Null se non c'e' scadenza da monitorare.
export function azioneScadenzaFormazione(
  f: Formazione, clienteId: string, areaFormazione: string | null, personaNome?: string,
): Record<string, unknown> | null {
  if (!f.scadenza) return null;
  const nome = (f.corso_nome ?? '').trim() || f.corso_codice || 'corso';
  const az: Record<string, unknown> = {
    id: f.id,
    tipo: 'azione_correttiva',
    origine_esito_id: null,
    sopralluogo_origine_id: null,
    origine_formazione_id: f.id,
    descrizione: 'Rinnovo formazione - ' + nome + (personaNome ? ' (' + personaNome + ')' : ''),
    responsabile_cliente_id: clienteId,
    data_scadenza: f.scadenza,
  };
  if (areaFormazione) {
    az.responsabile_tipo = 'risorsa_interna';
    az.responsabile_area_id = areaFormazione;
  } else {
    az.responsabile_tipo = 'cliente';
  }
  return az;
}

// Gemello di azioneScadenzaFormazione per un esonero/credito con scadenza.
// id azione = id esonero; origine_esonero_id = id esonero. Stesse regole
// (indirizzata all'area Formazione; omette stato/priorita). Null se senza scadenza.
export function azioneScadenzaEsonero(
  e: Esonero, clienteId: string, areaFormazione: string | null, personaNome?: string, corsoNome?: string,
): Record<string, unknown> | null {
  if (!e.scadenza) return null;
  const nome = (corsoNome ?? '').trim() || e.corso_codice || (e.motivazione ?? '').trim() || 'credito';
  const az: Record<string, unknown> = {
    id: e.id,
    tipo: 'azione_correttiva',
    origine_esito_id: null,
    sopralluogo_origine_id: null,
    origine_esonero_id: e.id,
    descrizione: 'Rinnovo credito/esonero - ' + nome + (personaNome ? ' (' + personaNome + ')' : ''),
    responsabile_cliente_id: clienteId,
    data_scadenza: e.scadenza,
  };
  if (areaFormazione) {
    az.responsabile_tipo = 'risorsa_interna';
    az.responsabile_area_id = areaFormazione;
  } else {
    az.responsabile_tipo = 'cliente';
  }
  return az;
}

export async function salvaFormazione(f: Formazione): Promise<Formazione> {
  const row = {
    id: f.id || newId(),
    persona_id: f.persona_id,
    corso_codice: vuotoNull(f.corso_codice),
    corso_nome: f.corso_nome.trim(),
    categoria: vuotoNull(f.categoria),
    data_completamento: vuotoNull(f.data_completamento),
    ore: f.ore,
    ente_formatore: vuotoNull(f.ente_formatore),
    is_aggiornamento: f.is_aggiornamento,
    scadenza: vuotoNull(f.scadenza),
    allegato_url: vuotoNull(f.allegato_url),
    note: vuotoNull(f.note),
  };
  const { data, error } = await supabase.from('formazione').upsert(row).select().single();
  if (error) throw error;
  const salvata = data as Formazione;

  // Mantieni l'azione di scadenzario collegata (monitoraggio scadenza). Best-effort:
  // la formazione e' gia' salvata, non deve fallire per un problema sullo scadenzario.
  try {
    const per = await supabase.from('persona').select('cliente_id, nome, cognome').eq('id', salvata.persona_id).single();
    const clienteId = (per.data?.cliente_id ?? null) as string | null;
    if (clienteId) {
      const areaId = await areaFormazioneId();
      const az = azioneScadenzaFormazione(salvata, clienteId, areaId, nomePersona(per.data as { nome?: string | null; cognome?: string | null }));
      if (az) await supabase.from('azione').upsert(az);
      else await supabase.from('azione').delete().eq('origine_formazione_id', salvata.id);
    }
  } catch (e) { console.error('azione scadenza formazione (online):', e); }

  return salvata;
}

export async function eliminaFormazione(id: string): Promise<void> {
  const { error } = await supabase.from('formazione').delete().eq('id', id);
  if (error) throw error;
}

export async function salvaEsonero(e: Esonero): Promise<Esonero> {
  const row = {
    id: e.id || newId(),
    persona_id: e.persona_id,
    corso_codice: vuotoNull(e.corso_codice),
    figura_codice: vuotoNull(e.figura_codice),
    tipo: e.tipo,
    motivazione: e.motivazione.trim(),
    riferimento_norm: vuotoNull(e.riferimento_norm),
    documento_url: vuotoNull(e.documento_url),
    data_riconoscimento: vuotoNull(e.data_riconoscimento),
    scadenza: vuotoNull(e.scadenza),
    attivo: e.attivo,
    note: vuotoNull(e.note),
  };
  const { data, error } = await supabase.from('esonero').upsert(row).select().single();
  if (error) throw error;
  const salvato = data as Esonero;

  // Azione di scadenzario collegata (solo se il credito ha una scadenza). Best-effort.
  try {
    const per = await supabase.from('persona').select('cliente_id, nome, cognome').eq('id', salvato.persona_id).single();
    const clienteId = (per.data?.cliente_id ?? null) as string | null;
    if (clienteId) {
      const areaId = await areaFormazioneId();
      let corsoNome: string | undefined;
      if (salvato.corso_codice) {
        const c = await supabase.from('corso_catalogo').select('nome').eq('codice', salvato.corso_codice).maybeSingle();
        corsoNome = (c.data?.nome ?? undefined) as string | undefined;
      }
      const az = azioneScadenzaEsonero(salvato, clienteId, areaId, nomePersona(per.data as { nome?: string | null; cognome?: string | null }), corsoNome);
      if (az) await supabase.from('azione').upsert(az);
      else await supabase.from('azione').delete().eq('origine_esonero_id', salvato.id);
    }
  } catch (err) { console.error('azione scadenza esonero (online):', err); }

  return salvato;
}

export async function eliminaEsonero(id: string): Promise<void> {
  const { error } = await supabase.from('esonero').delete().eq('id', id);
  if (error) throw error;
}

// --- editor del catalogo: esoneri ammessi (promemoria in campo) ---

export async function salvaEsoneroAmmesso(a: EsoneroAmmesso): Promise<EsoneroAmmesso> {
  const row = {
    id: a.id || newId(),
    corso_codice: vuotoNull(a.corso_codice),
    figura_codice: vuotoNull(a.figura_codice),
    tipo: a.tipo,
    descrizione: a.descrizione.trim(),
    riferimento_norm: vuotoNull(a.riferimento_norm),
    ordine: a.ordine,
    attivo: a.attivo,
  };
  const { data, error } = await supabase.from('esonero_ammesso').upsert(row).select().single();
  if (error) throw error;
  return data as EsoneroAmmesso;
}

export async function eliminaEsoneroAmmesso(id: string): Promise<void> {
  const { error } = await supabase.from('esonero_ammesso').delete().eq('id', id);
  if (error) throw error;
}

// ============================ GENERA COSE DA FARE ============================

export interface OpzioniGenerazione {
  // includi anche i requisiti "in scadenza" (oltre ai "critici")
  includiInScadenza: boolean;
  // destinatario: area interna OPPURE cliente
  versoArea: boolean;
  areaId: string | null;       // se versoArea
  clienteId: string | null;    // se !versoArea
}

export interface CosaDaFareProposta {
  persona_id: string | null;
  persona_nome: string;
  descrizione: string;
  scadenza: string | null;
  priorita: 'alta' | 'media' | 'bassa';
}

// Calcola (senza scrivere) le cose da fare per i gap del cliente.
export function proponiCoseDaFare(riep: RiepilogoCliente, includiInScadenza: boolean): CosaDaFareProposta[] {
  const out: CosaDaFareProposta[] = [];
  for (const pv of riep.persone) {
    for (const r of pv.requisiti) {
      const gap = r.stato === 'critico' || (includiInScadenza && r.stato === 'in_scadenza');
      if (!gap) continue;
      // Le scadenze di formazioni gia' registrate (r.scadenza valorizzata) sono
      // monitorate automaticamente da un'azione collegata (migration 042): non
      // duplicarle qui. Restano i veri gap (requisito senza attestato: scadenza nulla).
      if (r.scadenza) continue;
      out.push({
        persona_id: pv.persona.id,
        persona_nome: nomePersona(pv.persona),
        descrizione: 'Formazione - ' + nomePersona(pv.persona) + ': ' + r.corso_nome + ' (' + r.dettaglio + ')',
        scadenza: r.scadenza,
        priorita: r.stato === 'critico' ? 'alta' : 'media',
      });
    }
  }
  // Addetti emergenza scoperti (nessun nominativo): il report indica il corso
  // da erogare, derivato dal livello/gruppo definito sul cliente. Se il
  // livello/gruppo non e' stato definito, l'azione invita a definirlo prima.
  for (const f of riep.figureScoperte) {
    const em = corsoEmergenzaRichiesto(f.codice, riep.livello_antincendio, riep.gruppo_primo_soccorso);
    if (!em) continue;
    out.push({
      persona_id: null,
      persona_nome: f.nome,
      descrizione: em.definito
        ? 'Emergenze - nominare e formare ' + f.nome + ': ' + em.testo
        : 'Emergenze - ' + f.nome + ' non assegnato: ' + em.testo,
      scadenza: null,
      priorita: 'alta',
    });
  }
  return out;
}

// Scrive le cose da fare proposte come righe `azione` (online-first).
// Le azioni nascono senza sopralluogo di origine (colonne nullable) e con
// tipo 'azione_correttiva'; il webhook email su azione e' dismesso, quindi
// non parte alcuna notifica automatica.
export async function generaCoseDaFare(
  proposte: CosaDaFareProposta[],
  opt: OpzioniGenerazione,
): Promise<number> {
  if (!proposte.length) return 0;
  if (opt.versoArea && !opt.areaId) throw new Error('Area destinataria mancante');
  if (!opt.versoArea && !opt.clienteId) throw new Error('Cliente destinatario mancante');

  const righe = proposte.map((p) => ({
    id: newId(),
    tipo: 'azione_correttiva' as const,
    origine_esito_id: null,
    sopralluogo_origine_id: null,
    descrizione: p.descrizione,
    responsabile_tipo: opt.versoArea ? ('risorsa_interna' as const) : ('cliente' as const),
    responsabile_cliente_id: opt.versoArea ? null : opt.clienteId,
    responsabile_interno_id: null,
    responsabile_area_id: opt.versoArea ? opt.areaId : null,
    data_scadenza: p.scadenza,
    priorita: p.priorita,
    stato: 'aperta' as const,
  }));

  const { error } = await supabase.from('azione').insert(righe);
  if (error) throw error;
  return righe.length;
}
