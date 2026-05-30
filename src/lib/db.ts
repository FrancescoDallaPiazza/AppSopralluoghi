// Database locale offline (IndexedDB via Dexie).
// Tiene il sopralluogo in corso, gli esiti, le foto (come blob) e una
// coda "outbox" di operazioni da spingere al server alla riconnessione.

import Dexie, { type Table } from 'dexie';
import type { Sopralluogo, ChecklistCompilata, EsitoVoce, Foto, Azione } from './types';

// Un'operazione in coda: una riga da fare upsert, oppure una foto da caricare.
export interface OutboxOp {
  seq?: number;                 // auto-increment, garantisce l'ordine
  kind: 'row' | 'photo';
  table?: 'sopralluogo' | 'checklist_compilata' | 'esito_voce' | 'foto' | 'azione' | 'aggiornamento_azione';
  payload?: Record<string, unknown>;
  fotoId?: string;             // per kind 'photo': id della foto/blob da caricare
}

export interface FotoBlob {
  id: string;                  // = foto.id
  blob: Blob;
}

class LocalDB extends Dexie {
  sopralluoghi!: Table<Sopralluogo, string>;
  compilate!: Table<ChecklistCompilata, string>;
  esiti!: Table<EsitoVoce, string>;
  foto!: Table<Foto, string>;
  fotoBlob!: Table<FotoBlob, string>;
  azioni!: Table<Azione, string>;
  outbox!: Table<OutboxOp, number>;

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
