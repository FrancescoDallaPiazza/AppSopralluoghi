// Database locale offline (IndexedDB via Dexie).
// Tiene il sopralluogo in corso, gli esiti, le foto (come blob) e una
// coda "outbox" di operazioni da spingere al server alla riconnessione.

import Dexie, { type Table } from 'dexie';
import type {
  Sopralluogo, ChecklistCompilata, EsitoVoce, Foto, Azione,
  Sede, BoxCatalogo, BoxSezione, VoceTemplate, ChecklistTemplateBox,
  SopralluogoBox, ComponenteSito,
} from './types';
import type {
  Persona, Nomina, Formazione, Esonero,
  CorsoCatalogo, FiguraSicurezza, FiguraRequisito, EsoneroAmmesso,
} from './admin/formazione';

// Conferma organigramma legata a un sopralluogo (vedi migration 019).
export interface OrganigrammaConferma {
  id: string;
  sopralluogo_id: string;
  cliente_id: string | null;
  tecnico_id: string | null;
  tecnico_nome: string | null;
  tipo: 'compilato' | 'confermato' | 'variato';
  data_conferma: string;
  note: string | null;
}

// Un'operazione in coda: una riga da fare upsert, una foto da caricare, oppure
// una riga da cancellare lato server (per id).
export interface OutboxOp {
  seq?: number;                 // auto-increment, garantisce l'ordine
  kind: 'row' | 'photo' | 'delete' | 'attestato';
  table?: 'sopralluogo' | 'checklist_compilata' | 'esito_voce' | 'foto' | 'azione' | 'aggiornamento_azione' | 'sopralluogo_revisione'
        | 'persona' | 'nomina' | 'formazione' | 'esonero' | 'organigramma_conferma' | 'organigramma_revisione'
        | 'sopralluogo_box' | 'componente_sito';
  payload?: Record<string, unknown>;
  fotoId?: string;             // per kind 'photo': id della foto/blob da caricare
  attestatoId?: string;        // per kind 'attestato': id del blob allegato da caricare
  id?: string;                 // per kind 'delete': id della riga da cancellare
}

export interface FotoBlob {
  id: string;                  // = foto.id
  blob: Blob;
}

// Allegato attestato in attesa di upload (gemello di FotoBlob): il file, il path
// di destinazione nel bucket attestati e il suo content-type. Si svuota dopo
// l'upload in runSync. Non si ridimensiona: un attestato e' un documento legale,
// si conserva l'originale (a differenza delle foto).
export interface AttestatoBlob {
  id: string;                  // = fileId (univoco per upload)
  formazione_id: string;       // per la pulizia quando si elimina la formazione
  blob: Blob;
  path: string;                // path completo nel bucket attestati
  contentType: string;
}

// Contesto di un sopralluogo (cliente, tipo attività) messo in cache dal
// prefetch, così la lista di campo mostra i dati anche offline.
export interface ContestoSopralluogo {
  id: string;                  // = sopralluogo.id
  cliente_nome: string | null;
  cliente_id: string | null;
  tipo_attivita: string | null;
}

class LocalDB extends Dexie {
  sopralluoghi!: Table<Sopralluogo, string>;
  compilate!: Table<ChecklistCompilata, string>;
  esiti!: Table<EsitoVoce, string>;
  foto!: Table<Foto, string>;
  fotoBlob!: Table<FotoBlob, string>;
  attestatoBlob!: Table<AttestatoBlob, string>;
  azioni!: Table<Azione, string>;
  contesto!: Table<ContestoSopralluogo, string>;
  outbox!: Table<OutboxOp, number>;
  // organigramma & formazione (cache locale per consultazione/modifica offline)
  persone!: Table<Persona, string>;
  nomine!: Table<Nomina, string>;
  formazioni!: Table<Formazione, string>;
  esoneri!: Table<Esonero, string>;
  corsi!: Table<CorsoCatalogo, string>;
  figure!: Table<FiguraSicurezza, string>;
  requisiti!: Table<FiguraRequisito, string>;
  esoneriAmmessi!: Table<EsoneroAmmesso, string>;
  conferme!: Table<OrganigrammaConferma, string>;
  // modello box-argomento (migration 029-032): catalogo (sola lettura, cache di
  // prefetch) + composizione/componenti del sopralluogo (read+write via outbox).
  sediLocali!: Table<Sede, string>;
  boxCatalogo!: Table<BoxCatalogo, string>;
  boxSezioni!: Table<BoxSezione, string>;
  vociBox!: Table<VoceTemplate, string>;
  templateBox!: Table<ChecklistTemplateBox, string>;
  sopralluogoBox!: Table<SopralluogoBox, string>;
  componenti!: Table<ComponenteSito, string>;

  constructor() {
    super('sopralluoghi');
    this.version(1).stores({
      sopralluoghi: 'id, incarico_id, stato',
      compilate: 'id, sopralluogo_id',
      esiti: 'id, checklist_compilata_id',
      foto: 'id, esito_voce_id',
      fotoBlob: 'id',
      azioni: 'id, sopralluogo_origine_id, responsabile_interno_id, stato',
      outbox: '++seq, kind',
    });
    // v2: cache del contesto sopralluogo per il prefetch offline.
    this.version(2).stores({
      contesto: 'id',
    });
    // v3: organigramma & formazione, per consultazione e modifica offline.
    // I cataloghi (corsi/figure/requisiti/esoneri ammessi) sono di sola lettura
    // in campo: cache locale, niente coda. Le entita per-persona e la conferma
    // si scrivono via outbox (upsert per id, come il resto).
    this.version(3).stores({
      persone: 'id, cliente_id, attivo',
      nomine: 'id, persona_id, figura_codice',
      formazioni: 'id, persona_id, corso_codice',
      esoneri: 'id, persona_id',
      corsi: 'codice, categoria',
      figure: 'codice, gruppo_ordine, ordine',
      requisiti: 'id, figura_codice, corso_codice',
      esoneriAmmessi: 'id, corso_codice, figura_codice',
      conferme: 'id, sopralluogo_id, cliente_id',
    });
    // v4: blob degli allegati attestato in attesa di upload (bucket privato
    // "attestati", migration 021). Indicizzato anche per formazione_id, cosi'
    // eliminando una formazione si annullano gli upload ancora pendenti.
    this.version(4).stores({
      attestatoBlob: 'id, formazione_id',
    });
    // v5: modello box-argomento (migration 029-032). Catalogo (sede/box/sezioni/
    // voci/composizione default) in cache di sola lettura per la compilazione
    // offline; la composizione effettiva del giro (sopralluogoBox) e i componenti
    // di sede si scrivono via outbox (upsert per id, come il resto).
    this.version(5).stores({
      sediLocali: 'id, cliente_id',
      boxCatalogo: 'id, codice, tipo, attivo',
      boxSezioni: 'id, box_id',
      vociBox: 'id, sezione_id, parent_voce_id',
      templateBox: 'id, template_id, box_id',
      sopralluogoBox: 'id, sopralluogo_id, box_id',
      componenti: 'id, sede_id, box_id',
    });
  }
}

export const db = new LocalDB();

// Accoda una riga da sincronizzare (e la salva anche localmente).
export async function enqueueRow(
  table: NonNullable<OutboxOp['table']>,
  payload: Record<string, unknown>,
) {
  await db.outbox.add({ kind: 'row', table, payload });
}

// Accoda la cancellazione lato server di una riga (per id). L'ordine di coda
// (seq crescente) garantisce che eventuali upsert precedenti della stessa riga
// vengano applicati prima del delete; chi cancella si preoccupa anche di
// annullare gli upsert ancora pendenti per la stessa riga (vedi rimuoviEsito).
export async function enqueueDelete(
  table: NonNullable<OutboxOp['table']>,
  id: string,
) {
  await db.outbox.add({ kind: 'delete', table, id });
}
