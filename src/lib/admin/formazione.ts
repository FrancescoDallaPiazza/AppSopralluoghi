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
import { oreModuloSettore } from '../../formazione/ateco';

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
  // Macro-blocco della scheda organigramma: 'obbligatoria' (figure che ci devono
  // essere) oppure 'eventuale' (valutazione caso per caso). Vedi migration 053.
  macro?: string | null;
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
  // La persona appartiene a una sede (mig. 054). Puo' essere null solo in
  // transitorio: salvaPersona la riaggancia alla sede legale del cliente.
  sede_id?: string | null;
  nome: string;
  cognome: string | null;
  codice_fiscale: string | null;
  mansione: string | null;
  reparto: string | null;
  data_assunzione: string | null;
  data_cessazione: string | null;
  livello_rischio: LivelloRischio | null;
  attivo: boolean;
  note: string | null;
  formazione_pregressa: boolean;
  // Nasce da una copia di un'altra sede: va rivista/confermata (mig. 054).
  da_confermare?: boolean;
}

export interface Nomina {
  id: string;
  persona_id: string;
  figura_codice: string;
  data_nomina: string | null;
  attiva: boolean;
  note: string | null;
  // Estremi della procura, valorizzati solo per il datore delegato ex art. 16
  // (repertorio/data/notaio). Vedi migration 053.
  estremi_procura?: string | null;
}

// Evidenza documentale collegata a una nomina (atto di nomina, e per il datore
// e il delegato ex art. 16 anche visura camerale e atto/procura notarile).
// Il file vive su Storage (bucket attestati), come gli attestati. Migration 053.
export interface NominaEvidenza {
  id: string;
  nomina_id: string;
  tipo: string;                 // visura_camerale | atto_procura | atto_nomina | altro
  allegato_url: string | null;
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
  // Spezzone di formazione frazionata: NON assolve il requisito da solo,
  // concorre con le sue `ore` insieme agli altri spezzoni dello stesso corso.
  // Il gestionale eroga alcuni corsi a pezzi ("...PARZIALE 6H 1\2" + "2/2" =
  // 12h = specifica rischio alto). Senza questo flag il motore prenderebbe il
  // pezzo piu' recente come attestato pieno: 2h su 6 = requisito assolto.
  parziale: boolean;
  // Documentazione incompleta (migration 060): agli atti c'e' solo una parte
  // del percorso svolto - tipicamente la sola aula di un corso iniziato in
  // e-learning. NON incide sulla conformita', apre una pendenza documentale.
  // Cosa manchi sta in `note`.
  evidenza_incompleta: boolean;
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
  // Formazione frazionata ancora SOTTO soglia per questo requisito: ore
  // accumulate e ore dovute. Vuoto quando non ci sono spezzoni aperti. Serve a
  // chi legge - e alle cose da fare - per distinguere "mai fatto" da "iniziato e
  // non chiuso": sono due lavori diversi, il primo e' erogare un corso, il
  // secondo e' recuperare la data del pezzo mancante.
  frazionata: { ore: number; soglia: number; aggiornamento: boolean }[];
  // Data dell'attestato da cui la scadenza e' stata calcolata. Senza, la UI puo'
  // mostrare solo il "quando scade" e non il "quando e' stato fatto": chi
  // controlla un attestato ha bisogno del secondo per ritrovarlo, e una scadenza
  // senza data di svolgimento non e' verificabile. Null se il requisito e'
  // scoperto o coperto da un esonero senza attestato.
  data_completamento: string | null;
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
  figure: { codice: string; nome: string; nomina_id: string | null; data_nomina: string | null; estremi_procura: string | null; evidenza_mancante: boolean }[];
  requisiti: RequisitoValutato[];
  // Codici dei corsi di cui la persona ha un attestato registrato, QUALUNQUE sia
  // il suo ruolo. I requisiti raccontano solo le figure che la persona ha gia':
  // chi ha il corso antincendio ma e' a organigramma come semplice lavoratore
  // li' non compare, ed e' proprio la persona che si cerca quando si deve
  // designare un addetto. Serve a proporre i candidati giusti, non a valutare.
  corsiSvolti: string[];
  // Attestati che documentano solo una PARTE del percorso (migration 060).
  // Stanno qui e non sui requisiti perche' la pendenza e' dell'ATTESTATO: quello
  // dell'integrazione preposti e' del 2022, mentre il requisito da preposto e'
  // coperto dall'aggiornamento del 2026 - leggendola dal requisito, il buco
  // documentale del 2022 spariva proprio perche' la persona si e' aggiornata.
  // Cosi' si vedono anche quelli fuori da ogni requisito dei suoi ruoli.
  evidenzeIncomplete: {
    formazione_id: string;
    corso_nome: string;
    data_completamento: string | null;
    note: string | null;
  }[];
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
export type GruppoPrimoSoccorso = 'A' | 'B' | 'C' | 'BC';

// Corsi antincendio per livello (DM 02/09/2021): 4h / 8h / 16h.
export const CORSI_ANTINCENDIO: Record<LivelloAntincendio, { codice: string; nome: string; ore: number }> = {
  '1': { codice: 'AI_LIV1', nome: 'Addetto antincendio livello 1', ore: 4 },
  '2': { codice: 'AI_LIV2', nome: 'Addetto antincendio livello 2', ore: 8 },
  '3': { codice: 'AI_LIV3', nome: 'Addetto antincendio livello 3', ore: 16 },
};
// Corsi primo soccorso per gruppo aziendale (DM 388/2003): A = 16h, B/C = 12h.
// Il gruppo si determina col flusso in anagrafica; B e C sono distinti per
// registrazione ma richiedono lo stesso corso 12h (PS_GRBC). 'BC' resta per i
// dati storici.
export const CORSI_PRIMO_SOCCORSO: Record<GruppoPrimoSoccorso, { codice: string; nome: string; ore: number }> = {
  'A':  { codice: 'PS_GRA',  nome: 'Addetto primo soccorso gruppo A', ore: 16 },
  'B':  { codice: 'PS_GRBC', nome: 'Addetto primo soccorso gruppo B', ore: 12 },
  'C':  { codice: 'PS_GRBC', nome: 'Addetto primo soccorso gruppo C', ore: 12 },
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

// Ore dell'AGGIORNAMENTO del datore di lavoro-RSPP, anch'esse per rischio.
// `corso_catalogo.ore_aggiornamento` ne tiene una sola (6) e la sua nota dice
// "storicamente 6/10/14 per rischio: verificare caso": va bene per mostrare un
// numero, non per fare da soglia. Serve qui perche' la somma degli spezzoni si
// misura contro le ore DOVUTE: con 6 al posto di 14 tre spezzoni da 2h
// chiuderebbero un obbligo che ne vuole sette. Valori confermati dall'export
// del gestionale (aggiornamento RSPP DL rischio basso 6h / medio 10h / alto 14h).
const ORE_AGG_DL_RSPP: Record<LivelloRischio, number> = { basso: 6, medio: 10, alto: 14 };

const vuotoNull = (s: string | null | undefined): string | null => {
  const v = (s ?? '').trim();
  return v === '' ? null : v;
};

export function nomePersona(p: { nome?: string | null; cognome?: string | null }): string {
  const n = (p.nome ?? '').trim();
  const c = (p.cognome ?? '').trim();
  return [n, c].filter(Boolean).join(' ') || 'Persona';
}

// "Cognome Nome" - la forma da ELENCO. Dove si sceglie una persona fra molte
// (assegnazione a un ruolo, candidati con il corso svolto) si cerca per cognome,
// e un elenco ordinato per cognome ma scritto "Nome Cognome" costringe a leggere
// ogni riga fino in fondo per capire dove si e' arrivati. `nomePersona` resta la
// forma discorsiva, per le frasi e i documenti; questa e' per le liste.
export function nomePersonaCognome(p: { nome?: string | null; cognome?: string | null }): string {
  const n = (p.nome ?? '').trim();
  const c = (p.cognome ?? '').trim();
  return [c, n].filter(Boolean).join(' ') || 'Persona';
}

// Ordinamento alfabetico cognome-poi-nome. `localeCompare` con sensitivity base
// perche' gli elenchi veri hanno accenti e maiuscole miste (dal gestionale
// arrivano tutti in maiuscolo, dall'inserimento a mano no): senza, "D'Onofrio"
// e "DE STEFANO" finiscono in ordine arbitrario rispetto a "Dubyna".
export function confrontaPersone(
  a: { nome?: string | null; cognome?: string | null },
  b: { nome?: string | null; cognome?: string | null },
): number {
  const ca = (a.cognome ?? '').trim();
  const cb = (b.cognome ?? '').trim();
  const perCognome = ca.localeCompare(cb, 'it', { sensitivity: 'base' });
  if (perCognome !== 0) return perCognome;
  return (a.nome ?? '').trim().localeCompare((b.nome ?? '').trim(), 'it', { sensitivity: 'base' });
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

// Esportata perche' il libretto formativo calcola la scadenza anche degli
// attestati che non servono a nessun requisito (li' non passa il motore, ma la
// regola deve restare una sola).
export function addMesi(iso: string, mesi: number): string {
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
    // Uno spezzone non puo' MAI vincere come attestato: da solo non assolve.
    // Se il suo gruppo raggiunge la soglia, `componiSpezzoni` immette in questa
    // stessa lista un attestato virtuale (parziale = false) che qui concorre
    // normalmente. Filtrare qui, e non nei chiamanti, mette al riparo tutti e
    // tre i punti che usano questa funzione.
    if (f.parziale) return false;
    if (f.corso_codice && f.corso_codice === req.corso_codice) return true;
    if (req.per_categoria && categoriaFormazione(f, byCodice) === req.categoria) return true;
    return false;
  });
  if (!candidate.length) return null;
  // la piu' recente per data_completamento (null in coda)
  candidate.sort((a, b) => (b.data_completamento ?? '').localeCompare(a.data_completamento ?? ''));
  return candidate[0];
}

// ---------- Formazione frazionata ----------
//
// Alcuni corsi il gestionale li eroga a spezzoni, e l'obbligo si assolve
// sommandoli: "FORMAZIONE SPECIFICA RISCHIO ALTO PARZIALE 6H 1\2" + "2/2" fanno
// 12h, cioe' la specifica per il rischio alto. Gli spezzoni arrivano marcati da
// `corso_alias.parziale` (dizionario del gestionale) e l'import li scrive in
// `formazione.parziale`.
//
// Iniziale e aggiornamento si sommano SEPARATAMENTE: sono due obblighi distinti
// con soglie diverse (12h la specifica, 6h il suo rinnovo), e `is_aggiornamento`
// e' gia' li' a distinguerli. Un gruppo che raggiunge la soglia diventa un
// attestato VIRTUALE datato allo spezzone piu' recente del gruppo: e' quel
// giorno che l'obbligo si e' chiuso, ed e' da quel giorno che deve decorrere la
// scadenza. Sotto soglia non si produce nulla -- il requisito resta scoperto e
// `progresso` dice a che punto e'.
//
// Uno spezzone senza ore o senza data non puo' concorrere: viene contato come 0.
// E' conservativo di proposito, l'errore possibile e' un falso ROSSO (si chiede
// una formazione gia' fatta), mai un falso verde.
//
// LIMITE NOTO: la somma non ha finestra temporale, prende tutti gli spezzoni del
// gruppo. Se una persona ha 6h nel 2018 e 6h nel 2024 senza aver mai chiuso il
// corso, i due pezzi risultano un obbligo assolto nel 2024. Nei dati veri gli
// spezzoni sono erogati in sequenza ravvicinata (1\2 e 2/2 dello stesso corso),
// quindi il caso e' teorico; una finestra andrebbe legata al ciclo di
// aggiornamento del corso e introdurrebbe errori suoi. Se emerge nei dati, la
// si aggiunge qui.
interface EsitoSpezzoni {
  virtuali: Formazione[];
  progresso: { ore: number; soglia: number; aggiornamento: boolean }[];
}

function componiSpezzoni(
  corsoCodice: string,
  formazioni: Formazione[],
  oreIniziale: number | null,
  oreAggiornamento: number | null,
): EsitoSpezzoni {
  const out: EsitoSpezzoni = { virtuali: [], progresso: [] };
  const spezzoni = formazioni.filter(
    (f) => f.parziale && f.corso_codice === corsoCodice && f.data_completamento,
  );
  if (!spezzoni.length) return out;

  for (const agg of [false, true]) {
    const gruppo = spezzoni.filter((f) => f.is_aggiornamento === agg);
    if (!gruppo.length) continue;
    const soglia = agg ? oreAggiornamento : oreIniziale;
    if (soglia == null || soglia <= 0) continue;  // soglia ignota: non si conclude nulla
    const ore = gruppo.reduce((s, f) => s + (f.ore ?? 0), 0);
    if (ore < soglia) {
      out.progresso.push({ ore, soglia, aggiornamento: agg });
      continue;
    }
    // Il piu' recente del gruppo: la data in cui l'obbligo si e' chiuso.
    const ultimo = gruppo.reduce((a, b) =>
      (b.data_completamento ?? '').localeCompare(a.data_completamento ?? '') > 0 ? b : a);
    out.virtuali.push({
      ...ultimo,
      parziale: false,   // da qui in poi vale come attestato pieno
      ore,
      // La scadenza esplicita del singolo spezzone non ha senso per il gruppo:
      // la si lascia calcolare al motore da data + aggiornamento_mesi.
      scadenza: null,
    });
  }
  return out;
}

// "4h su 6h" / "4h su 6h (aggiornamento)" per il dettaglio del requisito.
function testoProgresso(p: EsitoSpezzoni['progresso']): string {
  return p
    .map((x) => `${x.ore}h su ${x.soglia}h${x.aggiornamento ? ' (aggiornamento)' : ''}`)
    .join(', ');
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

// Regola A (esonero/credito coprono la sola formazione INIZIALE): dato un corso con
// aggiornamento periodico, calcola lo stato/scadenza del RINNOVO, che resta dovuto e
// va gestito come una scadenza normale. Base di calcolo: attestato di aggiornamento
// registrato, altrimenti la data di partenza fornita (riconoscimento esonero o nomina).
// Ritorna null se il corso NON e' periodico (in quel caso l'esonero/credito copre tutto).
export interface EsitoAggiornamento { stato: StatoRequisito; scadenza: string | null; data_completamento: string | null; dettaglio: string; formazione_id: string | null; allegato_url: string | null; ore: number | null; }
export function statoAggiornamentoDopoEsonero(
  corso: CorsoCatalogo | undefined,
  req: { corso_codice: string; per_categoria: boolean; categoria: string },
  formazioni: Formazione[],
  byCodice: Map<string, CorsoCatalogo>,
  dataPartenza: string | null,
): EsitoAggiornamento | null {
  const aggMesi = corso?.aggiornamento_mesi ?? null;
  if (aggMesi == null) return null; // corso non periodico -> nessun aggiornamento
  const ore = corso?.ore_aggiornamento ?? corso?.ore ?? null;
  const fAgg = scegliFormazione(req, formazioni, byCodice);
  if (fAgg && fAgg.data_completamento) {
    const scad = fAgg.scadenza ?? addMesi(fAgg.data_completamento, aggMesi);
    const { stato, dettaglio } = statoDaScadenza(scad, fAgg.data_completamento);
    // Iniziale coperto dall'esonero: finche' il rinnovo e' lontano (conforme) la riga
    // resta ESONERATO; si accende (in scadenza/critico) solo quando serve agire.
    return { stato: stato === 'conforme' ? 'esonerato' : stato, scadenza: scad, data_completamento: fAgg.data_completamento, dettaglio: 'aggiornamento periodico: ' + dettaglio, formazione_id: fAgg.id, allegato_url: fAgg.allegato_url, ore };
  }
  if (dataPartenza) {
    const scad = addMesi(dataPartenza, aggMesi);
    const { stato, dettaglio } = statoDaScadenza(scad, dataPartenza);
    return { stato: stato === 'conforme' ? 'esonerato' : stato, scadenza: scad, data_completamento: null, dettaglio: 'aggiornamento periodico: ' + dettaglio, formazione_id: null, allegato_url: null, ore };
  }
  // nessuna data di partenza: dovuto, scadenza da determinare
  return { stato: 'da_verificare', scadenza: null, data_completamento: null, dettaglio: 'aggiornamento periodico dovuto: registrare l\u2019ultimo attestato di aggiornamento', formazione_id: null, allegato_url: null, ore };
}

export function valutaPersona(d: DatiPersona, cat: Catalogo, rischioCliente: LivelloRischio | null, atecoCliente: string | null = null, nomineConEvidenza?: Set<string>): PersonaValutata {
  const byCodice = new Map(cat.corsi.map((c) => [c.codice, c]));
  const figureCodici = d.nomine.filter((n) => n.attiva).map((n) => n.figura_codice);
  const figureSet = new Set(figureCodici);
  const nominaByFigura = new Map(d.nomine.filter((n) => n.attiva).map((n) => [n.figura_codice, n]));
  // Evidenza dell'atto di nomina: dovuta per ogni figura tranne i Lavoratori.
  // "Da ottenere" = nomina identificata ma senza alcuna evidenza caricata. Si
  // valuta solo se l'insieme e' noto (online): offline non si segnala.
  const evidenzaMancante = (codice: string, nominaId: string | null): boolean =>
    codice !== 'lavoratore' && !!nominaId && nomineConEvidenza != null && !nomineConEvidenza.has(nominaId);
  const figure = cat.figure
    .filter((f) => figureSet.has(f.codice))
    .sort((a, b) => a.ordine - b.ordine)
    .map((f) => {
      const nId = nominaByFigura.get(f.codice)?.id ?? null;
      return {
        codice: f.codice, nome: f.nome,
        nomina_id: nId,
        data_nomina: nominaByFigura.get(f.codice)?.data_nomina ?? null,
        estremi_procura: nominaByFigura.get(f.codice)?.estremi_procura ?? null,
        evidenza_mancante: evidenzaMancante(f.codice, nId),
      };
    });

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

  // Prerequisiti come requisiti: se un corso richiesto ha un prerequisito a
  // catalogo che nessuna figura della persona richiede gia', lo si fa emergere
  // una volta sola, attribuito alle STESSE figure (cosi' i crediti Allegato III
  // non se lo auto-creditano). Caso tipico: il Datore-RSPP assegnato senza la
  // figura datore_lavoro -> il corso base 16h (DATORE_LAVORO), prerequisito del
  // modulo comune, comparirebbe altrimenti come obbligo mancante. Nei percorsi
  // gia' completi (lavoratore, preposto, RSPP) i prerequisiti sono gia' requisiti
  // diretti della stessa figura: qui non aggiunge nulla.
  for (const r of [...reqByCorso.values()]) {
    let codice = byCodice.get(r.corso_codice)?.prerequisito_codice ?? null;
    const visti = new Set<string>([r.corso_codice]);
    while (codice && !visti.has(codice)) {
      visti.add(codice);
      const pre = byCodice.get(codice);
      if (pre && pre.attivo && !reqByCorso.has(codice)) {
        reqByCorso.set(codice, { corso_codice: codice, obbligatorio: true, per_categoria: false, figure: r.figure.slice() });
      }
      codice = pre?.prerequisito_codice ?? null;
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
    // moduli di settore DL-RSPP / RSPP: ore espanse dall'ATECO del cliente. Se
    // l'ATECO non e' tra i settori speciali (o non e' noto) il modulo NON si
    // applica: si salta il requisito (niente falso "mancante").
    if (r.corso_codice === 'DL_RSPP_SETTORE' || r.corso_codice === 'RSPP_MOD_B_SETTORE') {
      const oreSettore = oreModuloSettore(atecoCliente, r.corso_codice === 'DL_RSPP_SETTORE' ? 'dl_rspp' : 'rspp');
      if (oreSettore == null) continue;
      ore = oreSettore;
    }

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
          data_completamento: null, frazionata: [],
          dettaglio: base + ' \u00b7 ' + dt,
          formazione_id: null, esonero_id: eson.id, allegato_url: null, promemoria,
        });
      } else {
        // Esonero SENZA scadenza. Copre la formazione INIZIALE; se il corso ha un
        // aggiornamento periodico, il rinnovo resta dovuto e si gestisce come una
        // scadenza normale (regola A, uniforme con i crediti Allegato III).
        const dataPartenza = eson.data_riconoscimento
          ?? nominaByFigura.get(eson.figura_codice ?? '')?.data_nomina
          ?? d.nomine.find((n) => n.attiva && r.figure.includes(n.figura_codice))?.data_nomina
          ?? null;
        const agg = statoAggiornamentoDopoEsonero(corso, { corso_codice: r.corso_codice, per_categoria: r.per_categoria, categoria }, d.formazioni, byCodice, dataPartenza);
        if (agg) {
          requisiti.push({
            figura_codici: r.figure, corso_codice: r.corso_codice, corso_nome: corsoNome,
            categoria, ore: agg.ore, obbligatorio: r.obbligatorio,
            stato: agg.stato, scadenza: agg.scadenza, data_completamento: agg.data_completamento,
            frazionata: [],
            dettaglio: base + ' (iniziale) \u00b7 ' + agg.dettaglio,
            formazione_id: agg.formazione_id, esonero_id: eson.id, allegato_url: agg.allegato_url, promemoria,
          });
        } else {
          // Corso senza aggiornamento periodico: l'esonero copre tutto.
          requisiti.push({
            figura_codici: r.figure, corso_codice: r.corso_codice, corso_nome: corsoNome,
            categoria, ore, obbligatorio: r.obbligatorio, stato: 'esonerato', scadenza: null,
            data_completamento: null, frazionata: [],
            dettaglio: base,
            formazione_id: null, esonero_id: eson.id, allegato_url: null, promemoria,
          });
        }
      }
      continue;
    }

    // 2) attestato corrispondente?
    // Gli spezzoni si sommano qui, dove le ore RICHIESTE sono note: `ore` e'
    // gia' espansa per rischio (LAV_SPEC) e per ATECO (moduli di settore), che
    // e' esattamente la soglia contro cui confrontare la somma. Un gruppo che
    // arriva a soglia entra in gioco come attestato virtuale e da qui in poi
    // segue la strada di tutti gli altri.
    const oreAggDovute = r.corso_codice === 'DL_RSPP_BASE' && rischio
      ? ORE_AGG_DL_RSPP[rischio]
      : (corso?.ore_aggiornamento ?? null);
    const spezzoni = componiSpezzoni(r.corso_codice, d.formazioni, ore, oreAggDovute);
    const inGara = spezzoni.virtuali.length ? [...d.formazioni, ...spezzoni.virtuali] : d.formazioni;
    const f = scegliFormazione({ corso_codice: r.corso_codice, per_categoria: r.per_categoria, categoria }, inGara, byCodice);
    const noteSpezzoni = spezzoni.progresso.length
      ? 'Formazione frazionata in corso: ' + testoProgresso(spezzoni.progresso)
      : null;
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
      // Spezzoni sotto soglia: il requisito NON e' assolto, ma "mai svolto" e'
      // falso e manda il consulente a cercare un corso intero che in parte e'
      // gia' stato fatto. Si dice quante ore mancano.
      if (noteSpezzoni) {
        dettaglio = dettaglio === 'Mai svolto' ? noteSpezzoni : dettaglio + ' · ' + noteSpezzoni;
      }
      requisiti.push({
        figura_codici: r.figure, corso_codice: r.corso_codice, corso_nome: corsoNomeNeutro,
        categoria, ore, obbligatorio: r.obbligatorio, stato, scadenza,
        data_completamento: f?.data_completamento ?? null, frazionata: spezzoni.progresso,
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
    const dettaglioBase = pregressa ? dettaglio + ' \u00b7 pregresso, copre: ' + (corsoNome.split(' - ')[0] ?? corsoNome) : dettaglio;
    // Il requisito e' coperto, ma c'e' anche un gruppo di spezzoni incompleto
    // (tipico: iniziale a posto, rinnovo iniziato a meta'). Dirlo qui evita che
    // quelle ore sembrino perdute.
    const dettaglioMostrato = noteSpezzoni ? dettaglioBase + ' \u00b7 ' + noteSpezzoni : dettaglioBase;
    requisiti.push({
      figura_codici: r.figure, corso_codice: r.corso_codice, corso_nome: nomeMostrato,
      categoria, ore, obbligatorio: r.obbligatorio, stato, scadenza: scad,
      data_completamento: f.data_completamento, frazionata: spezzoni.progresso,
      dettaglio: dettaglioMostrato, formazione_id: f.id, esonero_id: null, allegato_url: f.allegato_url, promemoria,
    });
  }

  // ordine di presentazione: per figura/ordine catalogo non banale -> per nome corso
  requisiti.sort((a, b) => a.corso_nome.localeCompare(b.corso_nome));

  // Crediti tra ruoli (Allegato III ASR 17/04/2025): un ruolo posseduto puo'
  // creditare il corso richiesto da un altro ruolo della stessa persona. Marca
  // 'esonerato' i requisiti coperti (regola A: il credito copre solo la formazione
  // iniziale; per i corsi periodici il rinnovo resta dovuto come scadenza normale).
  const nomeFigura = new Map(cat.figure.map((f) => [f.codice, f.nome]));
  applicaCreditiAllegatoIII(requisiti, figureSet, (c) => nomeFigura.get(c) ?? c, (r) => {
    const corso = byCodice.get(r.corso_codice);
    const dataPartenza = r.figura_codici
      .map((fc) => nominaByFigura.get(fc)?.data_nomina)
      .find((dt): dt is string => !!dt) ?? null;
    return statoAggiornamentoDopoEsonero(corso, { corso_codice: r.corso_codice, per_categoria: false, categoria: corso?.categoria ?? '' }, d.formazioni, byCodice, dataPartenza);
  });

  const statoPersona = requisiti.reduce<StatoRequisito>((acc, r) => peggiore(acc, r.stato), 'conforme');

  const promemoriaFigura = cat.esoneriAmmessi.filter(
    (a) => a.attivo && !a.corso_codice && a.figura_codice && figureSet.has(a.figura_codice),
  );

  const moduli = valutaModuli(figureSet, d.formazioni, esoneriAttivi, byCodice, cat);

  // Corsi con attestato registrato, indipendentemente dai ruoli. Gli spezzoni
  // sono esclusi: mezzo corso non e' il corso, e chi cerca un candidato gia'
  // formato verrebbe mandato su una persona che non lo e'.
  const corsiSvolti = [...new Set(
    d.formazioni
      .filter((f) => f.corso_codice && f.data_completamento && !f.parziale)
      .map((f) => f.corso_codice as string),
  )];

  const evidenzeIncomplete = d.formazioni
    .filter((f) => f.evidenza_incompleta)
    .map((f) => ({
      formazione_id: f.id, corso_nome: f.corso_nome,
      data_completamento: f.data_completamento, note: f.note,
    }))
    .sort((a, b) => (a.data_completamento ?? '').localeCompare(b.data_completamento ?? ''));

  return { persona: d.persona, figure, requisiti, corsiSvolti, evidenzeIncomplete, stato: statoPersona, moduli, promemoria_figura: promemoriaFigura };
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

// Persone di una SEDE (mig. 054): base della valutazione per sede.
export async function caricaPersonePerSede(sedeId: string): Promise<Persona[]> {
  const { data, error } = await supabase
    .from('persona').select('*')
    .eq('sede_id', sedeId).order('cognome').order('nome');
  if (error) throw error;
  return (data ?? []) as Persona[];
}

// Id della sede legale (principale) di un cliente, o null se non c'e'.
export async function sedePrincipaleId(clienteId: string): Promise<string | null> {
  const { data } = await supabase
    .from('sede').select('id').eq('cliente_id', clienteId).eq('principale', true).maybeSingle();
  return (data?.id ?? null) as string | null;
}

// Sede del (singolo) organigramma del cliente: la sede OPERATIVA attiva se presente
// (aggiunta solo quando la legale non e' la sede di lavoro, es. commercialista),
// altrimenti la sede LEGALE. C'e' un solo organigramma per cliente.
export async function sedeOrganigrammaId(clienteId: string): Promise<string | null> {
  const { data } = await supabase.from('sede')
    .select('id, principale, attivo').eq('cliente_id', clienteId);
  const righe = (data ?? []) as { id: string; principale: boolean; attivo: boolean }[];
  const operativa = righe.find((s) => !s.principale && s.attivo);
  if (operativa) return operativa.id;
  return righe.find((s) => s.principale)?.id ?? righe[0]?.id ?? null;
}

// Porta TUTTE le persone del cliente sulla sede dell'organigramma corrente. Da
// chiamare quando si aggiunge/archivia la sede operativa, cosi' l'unico
// organigramma segue la sede di lavoro. Idempotente.
export async function allineaPersoneOrganigramma(clienteId: string): Promise<void> {
  const sedeId = await sedeOrganigrammaId(clienteId);
  if (!sedeId) return;
  const { error } = await supabase.from('persona').update({ sede_id: sedeId }).eq('cliente_id', clienteId);
  if (error) throw error;
}

async function caricaPerPersone<T>(tabella: string, personaIds: string[]): Promise<T[]> {
  if (!personaIds.length) return [];
  const { data, error } = await supabase.from(tabella).select('*').in('persona_id', personaIds);
  if (error) throw error;
  return (data ?? []) as T[];
}

// Ruoli dell'organigramma per persona (nomine ATTIVE), come nomi gia' pronti da
// mostrare. Serve all'etichetta e al filtro in Risorse Umane: li' l'organigramma
// non si valuta, si legge solo chi ricopre cosa, quindi non si passa da
// `valutaCliente` (che tirerebbe dentro formazioni, esoneri e motore per
// stampare una pill).
export async function caricaRuoliPerPersona(personaIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!personaIds.length) return out;
  const [nomine, fig] = await Promise.all([
    caricaPerPersone<Nomina>('nomina', personaIds),
    supabase.from('figura_sicurezza').select('codice, nome, gruppo_ordine, ordine'),
  ]);
  if (fig.error) throw fig.error;
  const righe = (fig.data ?? []) as { codice: string; nome: string; gruppo_ordine: number | null; ordine: number }[];
  const nomeDi = new Map(righe.map((f) => [f.codice, f.nome]));
  // Ordine del catalogo (gruppo, poi ordine) e non quello di inserimento delle
  // nomine: le pill di una persona devono leggersi sempre nella stessa sequenza,
  // e chi ha piu' ruoli va letto dal piu' alto in organigramma.
  const pos = new Map([...righe]
    .sort((a, b) => (a.gruppo_ordine ?? 999) - (b.gruppo_ordine ?? 999) || a.ordine - b.ordine)
    .map((f, i) => [f.codice, i] as const));
  const codiciPer = new Map<string, string[]>();
  for (const n of nomine) {
    if (!n.attiva) continue;
    if (!nomeDi.has(n.figura_codice)) continue;   // figura non piu' a catalogo
    const l = codiciPer.get(n.persona_id) ?? [];
    if (!l.includes(n.figura_codice)) l.push(n.figura_codice);
    codiciPer.set(n.persona_id, l);
  }
  for (const [personaId, codici] of codiciPer) {
    out.set(personaId, codici
      .sort((a, b) => (pos.get(a) ?? 999) - (pos.get(b) ?? 999))
      .map((c) => nomeDi.get(c) as string));
  }
  return out;
}

// Dati grezzi dell'organigramma di un cliente, gia' caricati da qualunque
// sorgente: Supabase (online, back-office) oppure cache locale Dexie (offline,
// campo). Alimentano la funzione di assemblaggio pura qui sotto.
export interface DatiOrganigramma {
  persone: Persona[];
  nomine: Nomina[];
  formazioni: Formazione[];
  esoneri: Esonero[];
  // Id delle nomine che hanno almeno un'evidenza documentale caricata. Popolato
  // solo online (back-office); offline resta undefined e non si segnala nulla.
  nomineConEvidenza?: Set<string>;
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
    atecoCliente?: string | null;
  },
): RiepilogoCliente {
  const atecoCliente = opts?.atecoCliente ?? null;
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
        atecoCliente,
        dati.nomineConEvidenza,
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
  ateco: string | null;
  dati: DatiOrganigramma;
}> {
  const cli = await supabase.from('cliente')
    .select('livello_rischio, rls_territoriale, livello_antincendio, gruppo_primo_soccorso, codice_ateco')
    .eq('id', clienteId).single();
  if (cli.error) throw cli.error;
  const rischio = (cli.data?.livello_rischio ?? null) as LivelloRischio | null;
  const rlsTerritoriale = (cli.data?.rls_territoriale ?? false) as boolean;
  const livAntincendio = (cli.data?.livello_antincendio ?? null) as LivelloAntincendio | null;
  const gruppoPS = (cli.data?.gruppo_primo_soccorso ?? null) as GruppoPrimoSoccorso | null;
  const ateco = (cli.data?.codice_ateco ?? null) as string | null;

  const persone = await caricaPersone(clienteId);
  const ids = persone.map((p) => p.id);
  const [nomine, formazioni, esoneri] = await Promise.all([
    caricaPerPersone<Nomina>('nomina', ids),
    caricaPerPersone<Formazione>('formazione', ids),
    caricaPerPersone<Esonero>('esonero', ids),
  ]);
  // Nomine con almeno un'evidenza documentale caricata (per il flag "da ottenere").
  const nominaIds = nomine.map((n) => n.id).filter(Boolean);
  const nomineConEvidenza = new Set<string>();
  if (nominaIds.length) {
    const ev = await supabase.from('nomina_evidenza').select('nomina_id').in('nomina_id', nominaIds);
    for (const r of (ev.data ?? []) as { nomina_id: string }[]) nomineConEvidenza.add(r.nomina_id);
  }
  return { rischio, rlsTerritoriale, livAntincendio, gruppoPS, ateco, dati: { persone, nomine, formazioni, esoneri, nomineConEvidenza } };
}

// Come sopra ma per una SEDE (mig. 054): rischio/ATECO/PS/antincendio/RLS letti
// dalla sede, persone filtrate per sede_id. Ritorna anche il cliente_id della
// sede (serve allo stamp del riepilogo e allo scadenzario a livello cliente).
export async function caricaDatiOrganigrammaSede(
  sedeId: string,
): Promise<{
  clienteId: string;
  rischio: LivelloRischio | null;
  rlsTerritoriale: boolean;
  livAntincendio: LivelloAntincendio | null;
  gruppoPS: GruppoPrimoSoccorso | null;
  ateco: string | null;
  dati: DatiOrganigramma;
}> {
  const sed = await supabase.from('sede').select('cliente_id').eq('id', sedeId).single();
  if (sed.error) throw sed.error;
  const clienteId = sed.data?.cliente_id as string;
  // Gli attributi che guidano l'organigramma (rischio/ATECO/PS/antincendio/RLS)
  // sono AZIENDALI: si leggono dal cliente (anagrafica), non dalla sede. La sede
  // fornisce solo l'inquadramento (indirizzo) e il raggruppamento delle persone.
  const cli = await supabase.from('cliente')
    .select('livello_rischio, rls_territoriale, livello_antincendio, gruppo_primo_soccorso, codice_ateco')
    .eq('id', clienteId).single();
  if (cli.error) throw cli.error;
  const rischio = (cli.data?.livello_rischio ?? null) as LivelloRischio | null;
  const rlsTerritoriale = (cli.data?.rls_territoriale ?? false) as boolean;
  const livAntincendio = (cli.data?.livello_antincendio ?? null) as LivelloAntincendio | null;
  const gruppoPS = (cli.data?.gruppo_primo_soccorso ?? null) as GruppoPrimoSoccorso | null;
  const ateco = (cli.data?.codice_ateco ?? null) as string | null;

  const persone = await caricaPersonePerSede(sedeId);
  const ids = persone.map((p) => p.id);
  const [nomine, formazioni, esoneri] = await Promise.all([
    caricaPerPersone<Nomina>('nomina', ids),
    caricaPerPersone<Formazione>('formazione', ids),
    caricaPerPersone<Esonero>('esonero', ids),
  ]);
  const nominaIds = nomine.map((n) => n.id).filter(Boolean);
  const nomineConEvidenza = new Set<string>();
  if (nominaIds.length) {
    const ev = await supabase.from('nomina_evidenza').select('nomina_id').in('nomina_id', nominaIds);
    for (const r of (ev.data ?? []) as { nomina_id: string }[]) nomineConEvidenza.add(r.nomina_id);
  }
  return { clienteId, rischio, rlsTerritoriale, livAntincendio, gruppoPS, ateco, dati: { persone, nomine, formazioni, esoneri, nomineConEvidenza } };
}

// Valuta una SEDE: organigramma + stato formativo delle persone della sede.
export async function valutaSede(sedeId: string, cat?: Catalogo): Promise<RiepilogoCliente> {
  const catalogo = cat ?? (await caricaCatalogo());
  const { clienteId, rischio, rlsTerritoriale, livAntincendio, gruppoPS, ateco, dati } = await caricaDatiOrganigrammaSede(sedeId);
  return assemblaRiepilogo(clienteId, rischio, dati, catalogo, { rlsTerritoriale, livAntincendio, gruppoPS, atecoCliente: ateco });
}

// Valuta il cliente attraverso la sua SEDE LEGALE (principale). Compat: finche' la
// UI e' per-cliente, mostra l'organigramma della sede legale (dove la mig. 054 ha
// riagganciato tutte le persone). Fallback al vecchio percorso per-cliente solo se
// manca la sede legale (non dovrebbe capitare post-054).
export async function valutaCliente(clienteId: string, cat?: Catalogo): Promise<RiepilogoCliente> {
  const catalogo = cat ?? (await caricaCatalogo());
  const sedeId = await sedeOrganigrammaId(clienteId);
  if (sedeId) return valutaSede(sedeId, catalogo);
  const { rischio, rlsTerritoriale, livAntincendio, gruppoPS, ateco, dati } = await caricaDatiOrganigramma(clienteId);
  return assemblaRiepilogo(clienteId, rischio, dati, catalogo, { rlsTerritoriale, livAntincendio, gruppoPS, atecoCliente: ateco });
}

// ============================ CRUD ============================

export async function salvaPersona(p: Persona): Promise<Persona> {
  // Ogni persona sta sulla sede dell'unico organigramma del cliente (operativa se
  // presente, altrimenti legale). Se non specificata, la si aggancia li'.
  const sedeId = p.sede_id ?? (await sedeOrganigrammaId(p.cliente_id));
  const row = {
    id: p.id || newId(),
    cliente_id: p.cliente_id,
    sede_id: sedeId,
    nome: p.nome.trim(),
    cognome: vuotoNull(p.cognome),
    codice_fiscale: vuotoNull(p.codice_fiscale),
    mansione: vuotoNull(p.mansione),
    reparto: vuotoNull(p.reparto),
    data_assunzione: vuotoNull(p.data_assunzione),
    data_cessazione: vuotoNull(p.data_cessazione),
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
    estremi_procura: vuotoNull(n.estremi_procura ?? null),
  };
  const { data, error } = await supabase.from('nomina').upsert(row).select().single();
  if (error) throw error;
  return data as Nomina;
}

// --- Evidenze documentali della nomina (Storage) - migration 053 ---------------
export async function caricaEvidenzeNomina(nominaId: string): Promise<NominaEvidenza[]> {
  const { data, error } = await supabase
    .from('nomina_evidenza').select('*').eq('nomina_id', nominaId).order('created_at');
  if (error) throw error;
  return (data ?? []) as NominaEvidenza[];
}

export async function salvaEvidenzaNomina(e: NominaEvidenza): Promise<NominaEvidenza> {
  const row = {
    id: e.id || newId(),
    nomina_id: e.nomina_id,
    tipo: e.tipo,
    allegato_url: e.allegato_url,
    note: vuotoNull(e.note),
  };
  const { data, error } = await supabase.from('nomina_evidenza').upsert(row).select().single();
  if (error) throw error;
  return data as NominaEvidenza;
}

export async function eliminaEvidenzaNomina(id: string): Promise<void> {
  const { error } = await supabase.from('nomina_evidenza').delete().eq('id', id);
  if (error) throw error;
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
// valgono i default.
// La scadenza da monitorare e' quella EFFETTIVA: esplicita (f.scadenza) oppure
// derivata dalla periodicita' del corso (data_completamento + aggiornamento_mesi),
// esattamente come la calcola il motore. Senza aggMesi valorizzato e senza scadenza
// esplicita il corso "non scade" -> nessuna azione.
export function azioneScadenzaFormazione(
  f: Formazione, clienteId: string, areaFormazione: string | null, personaNome?: string, aggMesi?: number | null,
): Record<string, unknown> | null {
  let scadenza = f.scadenza ?? null;
  if (!scadenza && aggMesi != null && f.data_completamento) scadenza = addMesi(f.data_completamento, aggMesi);
  if (!scadenza) return null;
  const nome = (f.corso_nome ?? '').trim() || f.corso_codice || 'corso';
  const az: Record<string, unknown> = {
    id: f.id,
    tipo: 'azione_correttiva',
    origine_esito_id: null,
    sopralluogo_origine_id: null,
    origine_formazione_id: f.id,
    descrizione: 'Rinnovo formazione - ' + nome + (personaNome ? ' (' + personaNome + ')' : ''),
    responsabile_cliente_id: clienteId,
    data_scadenza: scadenza,
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
// (indirizzata all'area Formazione; omette stato/priorita).
// Regola A: se l'esonero NON ha scadenza propria ma copre un corso con aggiornamento
// periodico, il rinnovo resta dovuto: la scadenza si calcola dalla data di
// riconoscimento (o dalla nomina) + aggiornamento_mesi. Null solo se non c'e' alcuna
// scadenza da monitorare (esonero senza scadenza su corso non periodico).
export function azioneScadenzaEsonero(
  e: Esonero, clienteId: string, areaFormazione: string | null, personaNome?: string, corsoNome?: string,
  aggMesi?: number | null, dataNomina?: string | null,
): Record<string, unknown> | null {
  let scadenza = e.scadenza ?? null;
  if (!scadenza && aggMesi != null) {
    const base = e.data_riconoscimento ?? dataNomina ?? null;
    if (base) scadenza = addMesi(base, aggMesi);
  }
  if (!scadenza) return null;
  const nome = (corsoNome ?? '').trim() || e.corso_codice || (e.motivazione ?? '').trim() || 'credito';
  const az: Record<string, unknown> = {
    id: e.id,
    tipo: 'azione_correttiva',
    origine_esito_id: null,
    sopralluogo_origine_id: null,
    origine_esonero_id: e.id,
    descrizione: 'Rinnovo credito/esonero - ' + nome + (personaNome ? ' (' + personaNome + ')' : ''),
    responsabile_cliente_id: clienteId,
    data_scadenza: scadenza,
  };
  if (areaFormazione) {
    az.responsabile_tipo = 'risorsa_interna';
    az.responsabile_area_id = areaFormazione;
  } else {
    az.responsabile_tipo = 'cliente';
  }
  return az;
}

// Sincronizza lo scadenzario formativo di un cliente PARTENDO DAI REQUISITI VALUTATI
// dal motore (non dai record grezzi): il motore ha gia' scelto, per ogni corso,
// l'attestato piu' recente (vincente) e calcolato la scadenza corretta, applicando
// esoneri/crediti/pregressa. Cosi' si evitano azioni "fantasma" da attestati superati
// e ogni discrepanza tra la vista e lo scadenzario.
// Idempotente. Chiave azione, in ordine di precedenza:
//   - id dell'attestato vincente  (origine_formazione_id)
//   - id del credito/esonero      (origine_esonero_id)
//   - persona_id:corso_codice     (origine_requisito_key, migration 056) per i
//     requisiti CON scadenza ma SENZA attestato ne' esonero: la prima formazione
//     mai erogata, la cui scadenza viene dalla legge e non da un attestato.
//     Senza questo terzo caso quelle scadenze non arrivavano MAI allo
//     scadenzario: il backfill le saltava per mancanza di chiave e
//     `proponiCoseDaFare` le saltava perche' avevano gia' una scadenza.
// Fa upsert delle azioni attese (requisiti CON scadenza) e cancella gli orfani.
export async function backfillAzioniEsoneri(clienteId: string, riep?: RiepilogoCliente): Promise<number> {
  if (!riep) return 0; // senza requisiti valutati non si sincronizza
  const areaId = await areaFormazioneId();

  // Azioni attese, indicizzate per azione.id.
  const attese = new Map<string, Record<string, unknown>>();
  // Requisiti senza attestato ne' esonero: l'id non e' noto a priori, si risolve
  // dopo dalla chiave naturale (esistente -> stesso id, nuovo -> id nuovo).
  const perChiave: { key: string; az: Record<string, unknown> }[] = [];
  for (const pv of riep.persone) {
    const nome = nomePersona(pv.persona);
    for (const r of pv.requisiti) {
      if (!r.scadenza) continue; // solo scadenze monitorabili
      const base = (extra: Record<string, unknown>): Record<string, unknown> => {
        const az: Record<string, unknown> = {
          tipo: 'azione_correttiva', origine_esito_id: null, sopralluogo_origine_id: null,
          origine_formazione_id: null, origine_esonero_id: null, origine_requisito_key: null,
          responsabile_cliente_id: clienteId, data_scadenza: r.scadenza, ...extra,
        };
        if (areaId) { az.responsabile_tipo = 'risorsa_interna'; az.responsabile_area_id = areaId; }
        else { az.responsabile_tipo = 'cliente'; }
        return az;
      };
      if (r.formazione_id) {
        attese.set(r.formazione_id, base({
          id: r.formazione_id, origine_formazione_id: r.formazione_id,
          descrizione: 'Rinnovo formazione - ' + r.corso_nome + ' (' + nome + ')',
        }));
      } else if (r.esonero_id) {
        attese.set(r.esonero_id, base({
          id: r.esonero_id, origine_esonero_id: r.esonero_id,
          descrizione: 'Rinnovo credito/esonero - ' + r.corso_nome + ' (' + nome + ')',
        }));
      } else {
        // Scadenza senza attestato ne' esonero: corso mai erogato, termine di
        // legge. E' una scadenza formativa a tutti gli effetti (ha discente,
        // corso, ore e data), solo senza una carta dietro.
        const key = pv.persona.id + ':' + r.corso_codice;
        perChiave.push({
          key,
          az: base({
            origine_requisito_key: key,
            descrizione: 'Prima formazione - ' + r.corso_nome + ' (' + nome + ')',
          }),
        });
      }
    }
  }

  // Risolve chiave naturale -> azione.id, cosi' l'upsert resta sulla primary key
  // (l'indice unique della 056 e' parziale: ON CONFLICT non lo aggancerebbe).
  if (perChiave.length) {
    const { data: gia } = await supabase
      .from('azione').select('id, origine_requisito_key')
      .in('origine_requisito_key', perChiave.map((x) => x.key));
    const perKey = new Map(
      ((gia ?? []) as { id: string; origine_requisito_key: string }[])
        .map((a) => [a.origine_requisito_key, a.id]),
    );
    for (const { key, az } of perChiave) {
      const id = perKey.get(key) ?? newId();
      attese.set(id, { ...az, id });
    }
  }

  if (attese.size) {
    const { error } = await supabase.from('azione').upsert([...attese.values()]);
    if (error) throw error;
  }

  // Delete orfani: azioni collegate a formazioni/esoneri delle persone del cliente,
  // il cui id non e' piu' tra le attese (attestati superati o scadenze sparite).
  const persIds = riep.persone.map((p) => p.persona.id);
  if (persIds.length) {
    const [foR, esR] = await Promise.all([
      supabase.from('formazione').select('id').in('persona_id', persIds),
      supabase.from('esonero').select('id').in('persona_id', persIds),
    ]);
    const origiIds = [
      ...((foR.data ?? []) as { id: string }[]).map((x) => x.id),
      ...((esR.data ?? []) as { id: string }[]).map((x) => x.id),
    ];
    if (origiIds.length) {
      const es = await supabase.from('azione').select('id, origine_formazione_id, origine_esonero_id')
        .or(`origine_formazione_id.in.(${origiIds.join(',')}),origine_esonero_id.in.(${origiIds.join(',')})`);
      const daCancellare = ((es.data ?? []) as { id: string }[]).map((a) => a.id).filter((id) => !attese.has(id));
      if (daCancellare.length) await supabase.from('azione').delete().in('id', daCancellare);
    }
  }

  // Orfani a chiave requisito: la scadenza e' sparita, oppure e' arrivato
  // l'attestato e il requisito e' passato su origine_formazione_id.
  const { data: reqEs } = await supabase
    .from('azione').select('id')
    .eq('responsabile_cliente_id', clienteId)
    .not('origine_requisito_key', 'is', null);
  const reqOrfani = ((reqEs ?? []) as { id: string }[])
    .map((a) => a.id).filter((id) => !attese.has(id));
  if (reqOrfani.length) await supabase.from('azione').delete().in('id', reqOrfani);

  return attese.size;
}

// Allinea lo scadenzario formativo di un cliente: valuta l'organigramma e
// materializza le azioni (scadenze dei corsi + evidenze di nomina mancanti).
//
// Esiste perche' il backfill viveva SOLO dentro il pannello Organigramma: lo
// Scadenzario leggeva `azione` e basta, quindi mostrava cio' che l'ultima
// apertura dell'Organigramma aveva scritto. Una vista che dice il vero solo se
// prima sei passato da un altro tab non e' una vista, e' una trappola.
// Va chiamata da OGNI superficie che presenta lo scadenzario di un cliente.
//
// I due backfill sono volutamente SEQUENZIALI: entrambi cancellano i propri
// orfani, e farli correre in parallelo rende l'esito dipendente dall'ordine di
// arrivo delle delete.
//
// Idempotente (upsert su chiavi stabili) ma non gratuita: valuta l'organigramma.
// Passa `riep` se ce l'hai gia', per non rivalutarlo.
export async function sincronizzaScadenzarioCliente(
  clienteId: string,
  opt?: { catalogo?: Catalogo; riep?: RiepilogoCliente },
): Promise<number> {
  const riep = opt?.riep ?? await valutaCliente(clienteId, opt?.catalogo ?? await caricaCatalogo());
  const scadenze = await backfillAzioniEsoneri(clienteId, riep);
  const evidenze = await backfillAzioniNominaEvidenza(clienteId, riep);
  return scadenze + evidenze;
}

// Sincronizza nello scadenzario ("Cose da fare") le EVIDENZE DI NOMINA DA OTTENERE:
// una azione (correttiva, verso il cliente, senza scadenza) per ogni nomina
// identificata ma priva di atto ufficiale (pv.figure[].evidenza_mancante).
// Chiave azione = id nomina (origine_nomina_id); idempotente: upsert delle attese
// e delete degli orfani (evidenza ora caricata o nomina rimossa). Richiede un riep
// valutato ONLINE (con nomineConEvidenza noto); offline non produce nulla.
export async function backfillAzioniNominaEvidenza(clienteId: string, riep?: RiepilogoCliente): Promise<number> {
  if (!riep) return 0;
  const attese = new Map<string, Record<string, unknown>>();
  for (const pv of riep.persone) {
    const nome = nomePersona(pv.persona);
    for (const f of pv.figure) {
      if (!f.evidenza_mancante || !f.nomina_id) continue;
      attese.set(f.nomina_id, {
        id: f.nomina_id,
        tipo: 'azione_correttiva',
        origine_esito_id: null, sopralluogo_origine_id: null,
        origine_formazione_id: null, origine_esonero_id: null,
        origine_nomina_id: f.nomina_id,
        descrizione: 'Evidenza di nomina da ottenere - ' + f.nome + ' (' + nome + '): manca l\u2019atto ufficiale',
        responsabile_tipo: 'cliente',
        responsabile_cliente_id: clienteId,
        data_scadenza: null,
      });
    }
  }

  if (attese.size) {
    const { error } = await supabase.from('azione').upsert([...attese.values()]);
    if (error) throw error;
  }

  // Delete orfani: azioni collegate a nomine delle persone del cliente il cui id
  // non e' piu' tra le attese (evidenza caricata) - le nomine rimosse cascano da sole.
  const persIds = riep.persone.map((p) => p.persona.id);
  if (persIds.length) {
    const nomR = await supabase.from('nomina').select('id').in('persona_id', persIds);
    const nomIds = ((nomR.data ?? []) as { id: string }[]).map((x) => x.id);
    if (nomIds.length) {
      const es = await supabase.from('azione').select('id, origine_nomina_id').in('origine_nomina_id', nomIds);
      const daCancellare = ((es.data ?? []) as { id: string }[]).map((a) => a.id).filter((id) => !attese.has(id));
      if (daCancellare.length) await supabase.from('azione').delete().in('id', daCancellare);
    }
  }

  // NB: qui si cancellano SOLO gli orfani a chiave nomina. Le azioni a chiave
  // requisito (prima formazione) appartengono a backfillAzioniEsoneri: toccarle
  // da qui significa cancellare cio' che l'altro backfill ha appena scritto,
  // visto che le `attese` di questa funzione contengono solo evidenze di nomina.
  return attese.size;
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
    parziale: f.parziale,
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
      let aggMesi: number | null = null;
      if (salvata.corso_codice) {
        const c = await supabase.from('corso_catalogo').select('aggiornamento_mesi').eq('codice', salvata.corso_codice).maybeSingle();
        aggMesi = (c.data?.aggiornamento_mesi ?? null) as number | null;
      }
      const az = azioneScadenzaFormazione(salvata, clienteId, areaId, nomePersona(per.data as { nome?: string | null; cognome?: string | null }), aggMesi);
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
      let aggMesi: number | null = null;
      if (salvato.corso_codice) {
        const c = await supabase.from('corso_catalogo').select('nome, aggiornamento_mesi').eq('codice', salvato.corso_codice).maybeSingle();
        corsoNome = (c.data?.nome ?? undefined) as string | undefined;
        aggMesi = (c.data?.aggiornamento_mesi ?? null) as number | null;
      }
      let dataNomina: string | null = null;
      if (salvato.figura_codice) {
        const nm = await supabase.from('nomina').select('data_nomina').eq('persona_id', salvato.persona_id).eq('figura_codice', salvato.figura_codice).eq('attiva', true).maybeSingle();
        dataNomina = (nm.data?.data_nomina ?? null) as string | null;
      }
      const az = azioneScadenzaEsonero(salvato, clienteId, areaId, nomePersona(per.data as { nome?: string | null; cognome?: string | null }), corsoNome, aggMesi, dataNomina);
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
  clienteId: string | null;    // cliente d'origine (sempre): destinatario se !versoArea, contesto se versoArea
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
      // Formazione frazionata aperta: e' un caso a se' e va PRIMA della regola
      // generica, altrimenti finisce fra i "mai svolto" e manda a comprare un
      // corso che in parte e' gia' stato erogato e pagato. Il caso vero:
      // l'integrazione preposti di 3h in aula, coda di un corso le cui prime 5h
      // erano in e-learning - il gestionale esporta solo l'aula, e cio' che
      // manca non e' formazione ma la DATA di chiusura della parte a distanza.
      // Si propone anche quando il requisito non e' critico: le ore erogate
      // scadono comunque, e ricostruire la data dopo anni non e' piu' possibile.
      if (r.frazionata.length > 0) {
        const dett = r.frazionata
          .map((x) => `${x.ore}h su ${x.soglia}h${x.aggiornamento ? ' (aggiornamento)' : ''}`)
          .join(', ');
        out.push({
          persona_id: pv.persona.id,
          persona_nome: nomePersona(pv.persona),
          descrizione: 'Formazione frazionata - ' + nomePersona(pv.persona) + ': ' + r.corso_nome
            + ' fermo a ' + dett + '. Recuperare e registrare la parte mancante con la sua data'
            + ' (se svolta in e-learning, la data di chiusura del modulo a distanza).',
          scadenza: null,
          priorita: 'alta',
        });
        continue;
      }
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
  // Pendenze DOCUMENTALI: l'attestato c'e' e il requisito e' assolto, ma agli
  // atti manca un pezzo del percorso (es. il modulo e-learning che precede
  // l'aula). Non e' una non conformita' e non tocca i semafori - e' lavoro da
  // fare, presto: a distanza di anni la data di quel modulo non la ricostruisce
  // piu' nessuno. Si scorrono per PERSONA e non per requisito, perche' e'
  // dell'attestato che si parla. Stessa impostazione delle evidenze di nomina.
  for (const pv of riep.persone) {
    for (const ev of pv.evidenzeIncomplete ?? []) {
      out.push({
        persona_id: pv.persona.id,
        persona_nome: nomePersona(pv.persona),
        descrizione: 'Evidenza formativa incompleta - ' + nomePersona(pv.persona) + ': '
          + ev.corso_nome + (ev.data_completamento ? ' del ' + dataIT(ev.data_completamento) : '')
          + ' documenta solo una parte del percorso'
          + (ev.note ? ' (' + ev.note + ')' : '')
          + '. Recuperare l’attestato mancante con la sua data e registrarlo.',
        scadenza: null,
        priorita: 'media',
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
  if (!opt.clienteId) throw new Error('Cliente d\u2019origine mancante');

  const righe = proposte.map((p) => ({
    id: newId(),
    tipo: 'azione_correttiva' as const,
    origine_esito_id: null,
    sopralluogo_origine_id: null,
    // Sono gap FORMATIVI: marca il ramo cosi' finiscono in categoria "Formazione"
    // (non hanno una riga `formazione` di origine da cui dedurlo).
    origine_ramo: 'formazione' as const,
    descrizione: p.descrizione,
    responsabile_tipo: opt.versoArea ? ('risorsa_interna' as const) : ('cliente' as const),
    // Sempre valorizzato (anche verso area): e' il cliente d'ORIGINE, cosi' il
    // gap compare nello Scadenzario della scheda cliente. Come le azioni di
    // formazione automatiche, che tengono responsabile_cliente_id per contesto.
    responsabile_cliente_id: opt.clienteId,
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
