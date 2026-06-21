// Prefetch e composizione del modello "box-argomento" (migration 029-032).
//
// Lato campo: mette in cache il CATALOGO box (sola lettura), le SEDI/COMPONENTI
// del cliente (registro persistente) e le COMPOSIZIONI gia' fatte (es.
// dall'ufficio), cosi' i box si possono aprire e compilare offline.
//
// La GENERAZIONE della composizione di default (box del template + box fissi)
// avviene all'apertura del sopralluogo, non in prefetch: vedi assicuraComposizione.
// Le scritture in locale non sovrascrivono il lavoro di campo non sincronizzato.

import { supabase } from './supabase';
import { db, enqueueRow } from './db';
import { newId } from './types';
import type {
  Sede, BoxCatalogo, BoxSezione, VoceTemplate, ChecklistTemplateBox,
  SopralluogoBox, ComponenteSito,
} from './types';

// le voci dei box: come COLONNE_VOCE della compilazione, piu' sezione_id.
const COLONNE_VOCE_BOX =
  'id, template_id, sezione_id, codice, sezione, ordine, testo_requisito, descrizione, tipo, ' +
  'obbligatoria, parent_voce_id, mostra_se_chiave, calendarizzabile, config';

// 1) Catalogo box (sola lettura): box attivi, sezioni, voci-box, composizioni
// di default sui template. Reference data: si rinfresca sempre (bulkPut).
export async function prefetchCatalogoBox(): Promise<void> {
  if (!navigator.onLine) return;
  const [bc, bs, ctb] = await Promise.all([
    supabase.from('box_catalogo').select('*').eq('attivo', true),
    supabase.from('box_sezione').select('*'),
    supabase.from('checklist_template_box').select('*'),
  ]);
  if (!bc.error && bc.data) await db.boxCatalogo.bulkPut(bc.data as BoxCatalogo[]);
  if (!bs.error && bs.data) await db.boxSezioni.bulkPut(bs.data as BoxSezione[]);
  if (!ctb.error && ctb.data) await db.templateBox.bulkPut(ctb.data as ChecklistTemplateBox[]);

  // voci appartenenti a un box (sezione_id valorizzato)
  const vb = await supabase
    .from('voce_template')
    .select(COLONNE_VOCE_BOX)
    .not('sezione_id', 'is', null)
    .order('ordine', { ascending: true });
  if (!vb.error && vb.data) await db.vociBox.bulkPut(vb.data as unknown as VoceTemplate[]);
}

// 2) Sedi + componenti per i clienti coinvolti. I componenti NON sovrascrivono
// quelli gia' in locale (possibili modifiche di campo non sincronizzate).
export async function prefetchSediComponenti(clienteIds: string[]): Promise<void> {
  if (!navigator.onLine || !clienteIds.length) return;
  const se = await supabase
    .from('sede').select('*').in('cliente_id', clienteIds).eq('attivo', true);
  if (se.error || !se.data) return;
  const sedi = se.data as Sede[];
  if (sedi.length) await db.sediLocali.bulkPut(sedi);

  const sedeIds = sedi.map((s) => s.id);
  if (!sedeIds.length) return;
  const co = await supabase
    .from('componente_sito').select('*').in('sede_id', sedeIds).eq('attivo', true);
  if (co.error || !co.data) return;
  const comp = co.data as ComponenteSito[];
  const presenti = new Set(
    (await db.componenti.bulkGet(comp.map((c) => c.id)))
      .filter(Boolean).map((c) => (c as ComponenteSito).id),
  );
  const nuovi = comp.filter((c) => !presenti.has(c.id));
  if (nuovi.length) await db.componenti.bulkPut(nuovi);
}

// 3) Composizioni gia' esistenti (es. fatte dall'ufficio) per i sopralluoghi da
// fare: si scaricano senza sovrascrivere quelle gia' presenti in locale.
export async function prefetchComposizioni(sopralluogoIds: string[]): Promise<void> {
  if (!navigator.onLine || !sopralluogoIds.length) return;
  const sb = await supabase
    .from('sopralluogo_box').select('*').in('sopralluogo_id', sopralluogoIds);
  if (sb.error || !sb.data) return;
  const righe = sb.data as SopralluogoBox[];
  const presenti = new Set(
    (await db.sopralluogoBox.bulkGet(righe.map((r) => r.id)))
      .filter(Boolean).map((r) => (r as SopralluogoBox).id),
  );
  const nuove = righe.filter((r) => !presenti.has(r.id));
  if (nuove.length) await db.sopralluogoBox.bulkPut(nuove);
}

// Genera la composizione di default di un sopralluogo SE non ne esiste gia' una
// (locale o lato server): box del template (checklist_template_box) + box fissi
// iniettati sempre. Idempotente. Pensata per l'apertura del sopralluogo, anche
// offline (lavora sul catalogo in cache); le righe create vanno in outbox.
export async function assicuraComposizione(
  sopralluogoId: string,
  templateId: string,
): Promise<SopralluogoBox[]> {
  // se online, scarica prima un'eventuale composizione gia' fatta dall'ufficio
  try { await prefetchComposizioni([sopralluogoId]); } catch { /* offline: dal locale */ }

  const locali = await db.sopralluogoBox.where('sopralluogo_id').equals(sopralluogoId).toArray();
  if (locali.length) return locali.sort((a, b) => a.ordine - b.ordine);

  // box del template (default) + box fissi, dal catalogo in cache
  const tb = (await db.templateBox.where('template_id').equals(templateId).toArray())
    .sort((a, b) => a.ordine - b.ordine);
  const fissi = (await db.boxCatalogo.where('tipo').equals('fisso').toArray())
    .filter((b) => b.attivo)
    .sort((a, b) => a.ordine_default - b.ordine_default);

  const righe: SopralluogoBox[] = [];
  let ordine = 0;
  for (const r of tb) {
    righe.push({
      id: newId(), sopralluogo_id: sopralluogoId, box_id: r.box_id,
      box_versione: r.box_versione, ordine: ordine++, origine: 'template',
    });
  }
  for (const b of fissi) {
    if (righe.some((x) => x.box_id === b.id)) continue;
    righe.push({
      id: newId(), sopralluogo_id: sopralluogoId, box_id: b.id,
      box_versione: b.versione, ordine: ordine++, origine: 'fisso',
    });
  }
  if (!righe.length) return [];
  await db.sopralluogoBox.bulkPut(righe);
  for (const r of righe) await enqueueRow('sopralluogo_box', r as unknown as Record<string, unknown>);
  return righe;
}
