// Tipi di dominio · allineati a 001_init.sql
// Gli id sono uuid generati lato client (crypto.randomUUID()) per upsert offline.

export type SopralluogoStato = 'pianificato' | 'in_corso' | 'completato' | 'sincronizzato';
export type EsitoStato = 'conforme' | 'non_conforme' | 'non_applicabile';
export type AzioneTipo = 'azione_correttiva' | 'scadenza_ricorrente';
export type AzioneResponsabile = 'cliente' | 'risorsa_interna';
export type AzionePriorita = 'bassa' | 'media' | 'alta';
export type AzioneStato = 'aperta' | 'in_corso' | 'conclusa';
// Ruoli: 'tecnico' (app da campo), 'admin' (back-office), 'interno'
// (destinatario di cose da fare, senza sopralluoghi: vede solo "Le mie cose
// da fare"). Allineato alla migration 011.
export type RuoloTecnico = 'tecnico' | 'admin' | 'interno';
export type IncaricoStato = 'attivo' | 'sospeso' | 'chiuso';
export type ChecklistTmplStato = 'attivo' | 'archiviato';
export type CadenzaUnita = 'giorni' | 'settimane' | 'mesi';

export interface Tecnico {
  id: string;
  user_id: string | null;
  nome: string;
  cognome: string | null;
  base_localita: string | null;
  base_lat: number | null;
  base_lng: number | null;
  calendario_ref: string | null;
  capienza_ore_settimana: number | null;
  attivo: boolean;
  ruolo: RuoloTecnico;
  // Token segreto per il feed iCal sottoscrivibile (migration 014). Costruisce
  // un URL pubblico verso la Edge Function `calendario-ics`; rigenerarlo
  // invalida l'URL precedente.
  calendario_token?: string;
}

// Nome completo per la visualizzazione: "Nome Cognome" se il cognome c'è,
// altrimenti solo il nome (retrocompatibile con i tecnici creati prima della
// migration 010, che hanno cognome = null).
export function nomeCompleto(
  t: { nome?: string | null; cognome?: string | null } | null | undefined,
): string {
  const n = (t?.nome ?? '').trim();
  const c = (t?.cognome ?? '').trim();
  return [n, c].filter(Boolean).join(' ') || 'Tecnico';
}

// --- anagrafiche / contratto (back-office) ---
export interface Cliente {
  id: string;
  werp_id: string | null;
  ragione_sociale: string;
  // Anagrafica fiscale (migration 040): mostrati nel blocco "Ragione sociale".
  partita_iva: string | null;
  codice_fiscale: string | null;
  codice_ateco: string | null;
  // Livello di rischio (colonna da migration 015): proposto in anagrafica dal
  // codice ATECO (Allegato IV ASR 2025) e sovrascrivibile dall'organigramma.
  livello_rischio: 'basso' | 'medio' | 'alto' | null;
  // Emergenze (migration 041/049): livello rischio incendio e gruppo primo
  // soccorso, definiti a monte; guidano il corso richiesto agli addetti.
  livello_antincendio: '1' | '2' | '3' | null;
  antincendio_definito_mediante: string | null;
  gruppo_primo_soccorso: 'A' | 'B' | 'C' | 'BC' | null;
  primo_soccorso_definito_mediante: string | null;
  referente: string | null;
  telefono: string | null;
  email: string | null;
  // Referente amministrativo e commerciale (migration 049).
  referente_amm: string | null;
  telefono_amm: string | null;
  email_amm: string | null;
  referente_commerciale: string | null;
  canale_commerciale: string | null;
  // Sede legale (migration 049 aggiunge cap e provincia in sigla).
  localita: string | null;
  indirizzo: string | null;
  cap: string | null;
  provincia: string | null;
  lat: number | null;
  lng: number | null;
  attivo: boolean;
}

export interface Incarico {
  id: string;
  cliente_id: string;
  werp_id: string | null;
  tipo_attivita: string;
  n_sopralluoghi: number;
  periodo_inizio: string;
  periodo_fine: string;
  durata_seduta_stimata_min: number | null;
  stato: IncaricoStato;
  // Cadenza opzionale (migration 007): se valorizzata, n_sopralluoghi è
  // calcolato dalla cadenza sul periodo. Se null, incarico a "numero fisso".
  cadenza_valore: number | null;
  cadenza_unita: CadenzaUnita | null;
  // Sede di default dell'incarico (migration 029): il sopralluogo la eredita.
  sede_id?: string | null;
}

// --- modello "form configurabile" (vedi migration 002) ---
// Nota: dalla "modalità di rilievo unica" (commit a35cf45) la compilazione offre
// su OGNI voce evidenze (nota+foto), cose da fare, scadenza ricorrente ed esito
// esplicito. L'opzione di una 'scelta' è quindi solo la risposta descrittiva e
// non deriva più esito né azioni: niente più stato/genera_azione sull'opzione.
export type VoceTipo =
  | 'scelta' | 'multiscelta' | 'testo' | 'data' | 'numero' | 'slider' | 'foto' | 'rilievo';

export interface OpzioneVoce {
  chiave: string;
  etichetta: string;
}
export interface VoceConfig {
  opzioni?: OpzioneVoce[];
  scadenza?: { periodicita_default_mesi?: number }; // default proposto in compilazione
  min?: number;               // slider
  max?: number;               // slider
  ripetibile?: boolean;       // foto/rilievo
  etichetta_aggiunta?: string;   // rilievo: etichetta del bottone di aggiunta (default "Aggiungi rilievo")
}

export interface VoceTemplate {
  id: string;
  // Per i template piatti e' valorizzato; per le voci-box (migration 030) e'
  // NULL lato DB (la voce appartiene a una box_sezione via sezione_id).
  template_id: string | null;
  // Modello box (migration 030): se valorizzato, la voce appartiene a una
  // box_sezione invece che a un template piatto (template_id null lato DB).
  sezione_id?: string | null;
  codice: string | null;
  sezione: string | null;
  ordine: number;
  testo_requisito: string;
  descrizione: string | null;
  tipo: VoceTipo;
  obbligatoria: boolean;
  parent_voce_id: string | null;
  mostra_se_chiave: string | null;
  calendarizzabile: boolean;
  config: VoceConfig;
}

export interface ChecklistTemplate {
  id: string;
  nome: string;
  tipo_attivita: string;
  versione: number;
  stato: ChecklistTmplStato;
  note: string | null;
  voci?: VoceTemplate[];
}

export interface Sopralluogo {
  id: string;
  incarico_id: string;
  progressivo: string | null;
  tecnico_id: string | null;
  data_pianificata: string | null;
  data_effettiva: string | null;
  durata_stimata_min: number | null;
  durata_effettiva_min: number | null;
  localita: string | null;
  stato: SopralluogoStato;
  werp_attivita_id: string | null;
  revisione_corrente?: number;   // versione corrente (1 = primo completamento)
  sede_id?: string | null;       // sede ispezionata (migration 029)
  template_id?: string | null;       // checklist scelta in PIANIFICAZIONE (migration 039)
  template_versione?: number | null; // versione del template scelto
}

export interface ChecklistCompilata {
  id: string;
  sopralluogo_id: string;
  template_id: string;
  template_versione: number;
  data_compilazione: string | null;
}

export interface EsitoVoce {
  id: string;
  checklist_compilata_id: string;
  voce_template_id: string | null;
  voce_tipo: VoceTipo | null;
  voce_testo: string;
  voce_sezione: string | null;
  ordine: number;
  parent_esito_id: string | null;
  stato: EsitoStato | null;
  valore: unknown | null;   // chiave opzione | string | number | string[] (multiscelta)
  note: string | null;
  genera_azione: boolean;
  // Sezioni ripetibili (migration 032): esito riferito a un componente del
  // registro di sede; null per le sezioni singole e i template legacy.
  componente_id?: string | null;
}

export interface Foto {
  id: string;
  esito_voce_id: string;
  url: string;          // path nel bucket storage
  thumb_url: string | null;
  scattata_il: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  ordine: number;
}

export interface Azione {
  id: string;
  tipo: AzioneTipo;
  origine_esito_id: string | null;
  sopralluogo_origine_id: string | null;
  descrizione: string;
  responsabile_tipo: AzioneResponsabile;
  responsabile_cliente_id: string | null;
  responsabile_interno_id: string | null;
  responsabile_area_id: string | null;
  data_scadenza: string | null;
  priorita: AzionePriorita;
  stato: AzioneStato;
  sopralluogo_verifica_id: string | null;
  data_verifica: string | null;
  periodicita_mesi: number | null;
  werp_attivita_id: string | null;
  notificata_il: string | null;
  // Cosa da fare/scadenza riferita a un componente di sede (migration 032).
  componente_id?: string | null;
  // Azione di scadenzario collegata a una formazione (migration 042): id azione
  // = id formazione, per upsert idempotente al rinnovo; cascade all'eliminazione.
  origine_formazione_id?: string | null;
  // Idem per un esonero/credito con scadenza (migration 043): id azione = id esonero.
  origine_esonero_id?: string | null;
}

// Area/funzione interna (Formazione, Preventivi, …): destinatario di una
// "cosa da fare" interna alternativo al tecnico (migration 009).
export interface AreaInterna {
  id: string;
  nome: string;
  email: string | null;
  attiva: boolean;
}

// =====================================================================
// Modello "box-argomento" (migration 029-032): composizione modulare del
// sopralluogo. Il box e' un livello sopra al motore voci; le voci di un box
// restano VoceTemplate (con sezione_id valorizzato).
// =====================================================================

// Sede/sito del cliente (migration 029): un cliente ha 1..N sedi; i componenti
// e le cose da fare pregresse si filtrano per sede.
export interface Sede {
  id: string;
  cliente_id: string;
  nome: string;
  indirizzo: string | null;
  attivo: boolean;
}

// generico = box a voci; smart = incapsula un subapp (es. organigramma);
// fisso = vista calcolata iniettata sempre (es. cose da fare pregresse).
export type BoxTipo = 'generico' | 'smart' | 'fisso';

export interface BoxCatalogo {
  id: string;
  codice: string;
  nome: string;
  descrizione: string | null;
  tipo: BoxTipo;
  ref_smart: string | null;   // per 'smart': es. 'organigramma'
  ordine_default: number;
  versione: number;           // congelata nella composizione
  attivo: boolean;
}

export interface BoxSezione {
  id: string;
  box_id: string;
  codice: string;
  nome: string;
  ordine: number;
  ripetibile: boolean;        // true = N componenti per sezione
  etichetta_componente: string | null;  // testo del bottone "+ Aggiungi ..."
}

// Composizione di default salvata sul template (migration 031, D2).
export interface ChecklistTemplateBox {
  id: string;
  template_id: string;
  box_id: string;
  box_versione: number;
  ordine: number;
}

export type SopralluogoBoxOrigine =
  | 'template' | 'aggiunto_ufficio' | 'aggiunto_campo' | 'fisso';

// Composizione effettiva e congelata del singolo sopralluogo (migration 031).
export interface SopralluogoBox {
  id: string;
  sopralluogo_id: string;
  box_id: string;
  box_versione: number;
  ordine: number;
  origine: SopralluogoBoxOrigine;
}

// Registro persistente dei componenti di una sezione ripetibile (migration 032):
// appartiene alla sede e si ri-verifica a ogni sopralluogo.
export interface ComponenteSito {
  id: string;
  sede_id: string;
  box_id: string;
  sezione_codice: string;
  etichetta: string;
  matricola: string | null;
  ubicazione: string | null;
  attivo: boolean;
}

export const newId = (): string => crypto.randomUUID();
