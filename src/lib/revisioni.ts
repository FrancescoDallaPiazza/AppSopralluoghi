// Revisioni di un sopralluogo completato.
//
// "Modifica" su un sopralluogo già chiuso non lo riapre soltanto: prima CONGELA
// lo stato attuale (esiti + azioni) come revisione, poi lo rende modificabile.
// Così la versione precedente resta archiviata e rileggibile per intero, e il
// contatore `revisione_corrente` avanza.
//
// Offline-safe: lo snapshot viene costruito dallo stato LOCALE (Dexie) e
// accodato come ogni altra riga; la riapertura aggiorna il sopralluogo in locale
// e in coda. La storia delle revisioni si rilegge dal server (online).

import { db, enqueueRow } from './db';
import { supabase } from './supabase';
import { runSync } from './sync';
import { newId, type Azione, type EsitoVoce, type Sopralluogo } from './types';

export interface SnapshotRevisione {
  creato_il: string;
  esiti: EsitoVoce[];
  azioni: Azione[];
}

export interface Revisione {
  id: string;
  sopralluogo_id: string;
  numero: number;
  creata_il: string;
  autore_tecnico_id: string | null;
  motivo: string | null;
  snapshot: SnapshotRevisione;
}

// Stato LOCALE del sopralluogo: esiti (via le sue compilate) + azioni.
async function statoLocale(
  sopralluogoId: string,
): Promise<{ esiti: EsitoVoce[]; azioni: Azione[] }> {
  const compilate = await db.compilate.where('sopralluogo_id').equals(sopralluogoId).toArray();
  const compIds = new Set(compilate.map((c) => c.id));
  const esiti = (await db.esiti.toArray()).filter((e) => compIds.has(e.checklist_compilata_id));
  const azioni = (await db.azioni.toArray()).filter((a) => a.sopralluogo_origine_id === sopralluogoId);
  return { esiti, azioni };
}

// Stato dal SERVER (autorevole): esiti via le compilate + azioni. Si usa quando
// c'è rete, così lo snapshot cattura la versione reale anche su un dispositivo
// che non ha la cache locale del sopralluogo.
async function statoServer(
  sopralluogoId: string,
): Promise<{ esiti: EsitoVoce[]; azioni: Azione[] }> {
  const { data: comp } = await supabase
    .from('checklist_compilata').select('id').eq('sopralluogo_id', sopralluogoId);
  const compIds = (comp ?? []).map((c: any) => c.id);
  let esiti: any[] = [];
  if (compIds.length) {
    const { data } = await supabase
      .from('esito_voce').select('*').in('checklist_compilata_id', compIds);
    esiti = data ?? [];
  }
  const { data: az } = await supabase
    .from('azione').select('*').eq('sopralluogo_origine_id', sopralluogoId);
  return { esiti: esiti as unknown as EsitoVoce[], azioni: (az ?? []) as unknown as Azione[] };
}

// Congela lo stato attuale come revisione `revisione_corrente` e prepara la
// modifica: riporta il sopralluogo in stato modificabile e incrementa il
// contatore. Ritorna il sopralluogo aggiornato (per riaprire la compilazione).
export async function apriRevisione(
  sopralluogo: Sopralluogo,
  opts?: { autoreId?: string | null; motivo?: string | null },
): Promise<Sopralluogo> {
  const numero = sopralluogo.revisione_corrente ?? 1;
  // Snapshot dal server quando c'è rete (stato autorevole), altrimenti locale.
  let esiti: EsitoVoce[]; let azioni: Azione[];
  if (navigator.onLine) {
    try { ({ esiti, azioni } = await statoServer(sopralluogo.id)); }
    catch { ({ esiti, azioni } = await statoLocale(sopralluogo.id)); }
  } else {
    ({ esiti, azioni } = await statoLocale(sopralluogo.id));
  }

  const snapshot: SnapshotRevisione = { creato_il: new Date().toISOString(), esiti, azioni };
  const riga = {
    id: newId(),
    sopralluogo_id: sopralluogo.id,
    numero,
    creata_il: snapshot.creato_il,
    autore_tecnico_id: opts?.autoreId ?? null,
    motivo: opts?.motivo?.trim() ? opts.motivo.trim() : null,
    snapshot,
  };
  await enqueueRow('sopralluogo_revisione', riga as unknown as Record<string, unknown>);

  // riapri il sopralluogo per la modifica e porta avanti la revisione corrente
  const aggiornato: Sopralluogo = {
    ...sopralluogo,
    stato: 'in_corso',
    revisione_corrente: numero + 1,
  };
  await db.sopralluoghi.put(aggiornato);
  await enqueueRow('sopralluogo', aggiornato as unknown as Record<string, unknown>);

  void runSync();
  return aggiornato;
}

// Storia delle revisioni congelate di un sopralluogo (più recente prima).
export async function caricaRevisioni(sopralluogoId: string): Promise<Revisione[]> {
  const { data, error } = await supabase
    .from('sopralluogo_revisione')
    .select('id, sopralluogo_id, numero, creata_il, autore_tecnico_id, motivo, snapshot')
    .eq('sopralluogo_id', sopralluogoId)
    .order('numero', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Revisione[];
}
