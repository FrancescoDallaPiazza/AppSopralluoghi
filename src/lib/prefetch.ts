// Prefetch offline (lato tecnico).
//
// Mentre c'è rete, scarica e mette in cache locale tutto ciò che serve per
// lavorare sul campo senza connessione:
//   1. la lista dei sopralluoghi "da fare" del tecnico + il loro contesto
//      (cliente, tipo attività), così la lista si vede offline;
//   2. il template attivo + le voci per ogni tipo attività coinvolto, così la
//      checklist si può APRIRE e compilare offline (anche se mai aperta prima);
//      più l'elenco di TUTTI i template attivi + voci, così la checklist si può
//      anche SCEGLIERE in campo (default = quella dell'incarico) da offline;
//   3. le azioni aperte del "giro precedente" per gli incarichi coinvolti.
//
// Le scritture in locale non sovrascrivono mai il lavoro non sincronizzato:
// i sopralluoghi già presenti in locale restano com'erano.

import { db } from './db';
import {
  caricaMieiSopralluoghi, toBaseSopralluogo, type SopralluogoConContesto,
} from './sopralluoghi';
import { prefetchTemplatePerTipo, prefetchTemplatesAttivi } from './compilazione';
import { prefetchAzioniIncarichi } from './azioni';
import type { Sopralluogo } from './types';

const META_KEY = 'prefetch:meta';

export interface PrefetchMeta {
  quando: string;       // ISO
  sopralluoghi: number;
  checklist: number;
}

export function leggiPrefetchMeta(): PrefetchMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as PrefetchMeta) : null;
  } catch { return null; }
}

export interface RisultatoPrefetch {
  sopralluoghi: number;
  checklist: number;
  tipiMancanti: string[]; // tipi attività senza template attivo
}

// Mette in cache lista + contesto. Riusabile anche dalla normale apertura
// della schermata (così il solo visitarla online prepara l'offline).
export async function cacheLista(sopralluoghi: SopralluogoConContesto[]): Promise<void> {
  if (!sopralluoghi.length) return;
  await db.contesto.bulkPut(
    sopralluoghi.map((s) => ({
      id: s.id,
      cliente_nome: s.cliente_nome,
      cliente_id: s.cliente_id,
      tipo_attivita: s.tipo_attivita,
    })),
  );
  // Sopralluoghi: aggiungi solo quelli NON già in locale (non sovrascrivere
  // lavoro di campo non sincronizzato).
  const ids = sopralluoghi.map((s) => s.id);
  const presenti = new Set(
    (await db.sopralluoghi.bulkGet(ids)).filter(Boolean).map((s) => (s as Sopralluogo).id),
  );
  const daAggiungere = sopralluoghi
    .filter((s) => !presenti.has(s.id))
    .map((s) => toBaseSopralluogo(s));
  if (daAggiungere.length) await db.sopralluoghi.bulkPut(daAggiungere);
}

export async function prefetchOffline(tecnicoId: string): Promise<RisultatoPrefetch> {
  if (!navigator.onLine) {
    throw new Error('Sei offline: collegati a internet per scaricare i dati.');
  }

  const lista = await caricaMieiSopralluoghi(tecnicoId);
  const daFare = lista.filter((s) => s.stato === 'pianificato' || s.stato === 'in_corso');

  // 1) lista + contesto
  await cacheLista(daFare);

  // 2) template per ogni tipo attività distinto
  const tipi = [...new Set(
    daFare.map((s) => s.tipo_attivita).filter((t): t is string => !!t),
  )];
  let checklist = 0;
  const tipiMancanti: string[] = [];
  for (const t of tipi) {
    try {
      if (await prefetchTemplatePerTipo(t)) checklist++;
      else tipiMancanti.push(t);
    } catch {
      tipiMancanti.push(t);
    }
  }

  // 2-bis) elenco completo dei template attivi + voci: serve a SCEGLIERE la
  // checklist in campo (default = quella dell'incarico) anche da offline.
  try { await prefetchTemplatesAttivi(); } catch { /* best-effort */ }

  // 3) azioni aperte del giro precedente (best-effort)
  const incarichi = [...new Set(daFare.map((s) => s.incarico_id))];
  try { await prefetchAzioniIncarichi(incarichi); } catch { /* best-effort */ }

  const meta: PrefetchMeta = {
    quando: new Date().toISOString(),
    sopralluoghi: daFare.length,
    checklist,
  };
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* ignora */ }

  return { sopralluoghi: daFare.length, checklist, tipiMancanti };
}
