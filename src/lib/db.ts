// Database locale offline (IndexedDB via Dexie).
// Tiene il sopralluogo in corso, gli esiti, le foto (come blob) e una
// coda "outbox" di operazioni da spingere al server alla riconnessione.

import Dexie, { type Table } from 'dexie';
import type { Sopralluogo, ChecklistCompilata, EsitoVoce, Foto, Azione } from './types';
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
  kind: 'row' | 'photo' | 'delete';
  table?: 'sopralluogo' | 'checklist_compilata' | 'esito_voce' | 'foto' | 'azione' | 'aggiornamento_azione' | 'sopralluogo_revisione'
        | 'persona' | 'nomina' | 'formazione' | 'esonero' | 'organigramma_conferma';
  payload?: Record<string, unknown>;
  fotoId?: string;             // per kind 'photo': id della foto/blob da caricare
  id?: string;                 // per kind 'delete': id della riga da cancellare
}

export interface FotoBlob {
  id: string;                  // = foto.id
  blob: Blob;
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
