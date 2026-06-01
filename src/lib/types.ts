// Tipi di dominio · allineati a 001_init.sql
// Gli id sono uuid generati lato client (crypto.randomUUID()) per upsert offline.

export type SopralluogoStato = 'pianificato' | 'in_corso' | 'completato' | 'sincronizzato';
export type EsitoStato = 'conforme' | 'non_conforme' | 'non_applicabile';
export type AzioneTipo = 'azione_correttiva' | 'scadenza_ricorrente';
export type AzioneResponsabile = 'cliente' | 'risorsa_interna';
export type AzionePriorita = 'bassa' | 'media' | 'alta';
export type AzioneStato = 'aperta' | 'in_corso' | 'conclusa';
export type RuoloTecnico = 'tecnico' | 'admin';
export type IncaricoStato = 'attivo' | 'sospeso' | 'chiuso';
export type ChecklistTmplStato = 'attivo' | 'archiviato';
export type CadenzaUnita = 'giorni' | 'settimane' | 'mesi';

export interface Tecnico {
  id: string;
  user_id: string | null;
  nome: string;
  base_localita: string | null;
  base_lat: number | null;
  base_lng: number | null;
  calendario_ref: string | null;
  capienza_ore_settimana: number | null;
  attivo: boolean;
  ruolo: RuoloTecnico;
}

// --- anagrafiche / contratto (back-office) ---
export interface Cliente {
  id: string;
  werp_id: string | null;
  ragione_sociale: string;
  referente: string | null;
  telefono: string | null;
  email: string | null;
  localita: string | null;
  indirizzo: string | null;
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
}

// --- modello "form configurabile" (vedi migration 002) ---
export type VoceTipo =
  | 'scelta' | 'multiscelta' | 'testo' | 'data' | 'numero' | 'slider' | 'foto' | 'rilievo';
export type StatoLogico = 'positivo' | 'da_fare' | 'non_applicabile' | 'neutro';

export interface OpzioneVoce {
  chiave: string;
  etichetta: string;
  stato?: StatoLogico;        // default 'neutro'
  genera_azione?: boolean;    // selezionandola si crea una "cosa da fare"
}
export interface VoceConfig {
  opzioni?: OpzioneVoce[];
  scadenza?: { abilitata?: boolean; periodicita_default_mesi?: number };
  richiedi_foto_se?: string[];
  min?: number;               // slider
  max?: number;               // slider
  ripetibile?: boolean;       // foto/rilievo
  azione_opzionale?: boolean; // rilievo
}

export interface VoceTemplate {
  id: string;
  template_id: string;
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
}

// Area/funzione interna (Formazione, Preventivi, …): destinatario di una
// "cosa da fare" interna alternativo al tecnico (migration 009).
export interface AreaInterna {
  id: string;
  nome: string;
  email: string | null;
  attiva: boolean;
}

export const newId = (): string => crypto.randomUUID();
