// Strato dati del COMPOSITORE di template (back-office).
//
// Un template di checklist puo' essere assemblato dai "capitoli" (box del
// catalogo, migration 030/033/034/035) invece che dalle voci piatte. Qui:
//  - si elencano i box disponibili (capitoli generici + moduli speciali);
//  - si crea un nuovo template attivo che li aggancia via checklist_template_box.
//
// I moduli speciali (ORGANIGRAMMA 'smart', PREGRESSE 'fisso') sono sempre
// PROPOSTI dalla UI (flag `sempre`) ma vengono inclusi solo se confermati: non
// c'e' piu' alcuna auto-iniezione lato campo (vedi assicuraComposizione).
//
// Online-first come il resto del back-office: parla diretto con Supabase.

import { supabase } from '../supabase';
import { newId, type BoxCatalogo } from '../types';

export interface BoxDisponibile {
  box: BoxCatalogo;
  n_sezioni: number;   // solo per i 'generico'
  n_voci: number;      // solo per i 'generico'
  sempre: boolean;     // true per smart/fisso (moduli speciali, proposti sempre)
}

// Elenco dei box attivi del catalogo, con il conteggio di sezioni/voci per i
// generici. I moduli speciali (smart/fisso) sono marcati `sempre`.
export async function caricaBoxDisponibili(): Promise<BoxDisponibile[]> {
  const { data: bc, error } = await supabase
    .from('box_catalogo')
    .select('id, codice, nome, descrizione, tipo, ref_smart, ordine_default, versione, attivo')
    .eq('attivo', true)
    .order('ordine_default', { ascending: true });
  if (error) throw error;
  const boxes = (bc ?? []) as unknown as BoxCatalogo[];

  const { data: sez } = await supabase.from('box_sezione').select('id, box_id');
  const { data: voci } = await supabase
    .from('voce_template').select('sezione_id').not('sezione_id', 'is', null);

  const sezPerBox = new Map<string, Set<string>>();
  for (const s of (sez ?? []) as { id: string; box_id: string }[]) {
    (sezPerBox.get(s.box_id) ?? sezPerBox.set(s.box_id, new Set()).get(s.box_id)!).add(s.id);
  }
  const sezId2box = new Map<string, string>();
  for (const s of (sez ?? []) as { id: string; box_id: string }[]) sezId2box.set(s.id, s.box_id);
  const vociPerBox = new Map<string, number>();
  for (const v of (voci ?? []) as { sezione_id: string }[]) {
    const boxId = sezId2box.get(v.sezione_id);
    if (boxId) vociPerBox.set(boxId, (vociPerBox.get(boxId) ?? 0) + 1);
  }

  return boxes.map((box): BoxDisponibile => ({
    box,
    n_sezioni: sezPerBox.get(box.id)?.size ?? 0,
    n_voci: vociPerBox.get(box.id) ?? 0,
    sempre: box.tipo !== 'generico',
  }));
}

async function prossimaVersione(nome: string): Promise<number> {
  const { data } = await supabase
    .from('checklist_template').select('versione')
    .eq('nome', nome).order('versione', { ascending: false }).limit(1).maybeSingle();
  return ((data as { versione: number } | null)?.versione ?? 0) + 1;
}

export interface NuovoTemplateDaBox {
  nome: string;
  tipo_attivita: string;
  note: string | null;
  boxIds: string[];   // ordinati: l'ordine in cui appariranno nel sopralluogo
}

// Crea un template attivo composto dai box scelti. La versione segue il nome
// (1 se nuovo, altrimenti max+1, coerente con i template piatti). I box vengono
// agganciati via checklist_template_box con la loro versione di catalogo
// congelata. Ritorna l'id del nuovo template.
export async function creaTemplateDaBox(d: NuovoTemplateDaBox): Promise<string> {
  const nome = d.nome.trim();
  const tipo = d.tipo_attivita.trim();
  if (!nome) throw new Error('Indicare un nome per il template.');
  if (!tipo) throw new Error('Indicare il tipo attivita (aggancio con l\'incarico).');
  if (!d.boxIds.length) throw new Error('Selezionare almeno un capitolo.');

  // versioni di catalogo dei box scelti
  const { data: bc, error: eBox } = await supabase
    .from('box_catalogo').select('id, versione').in('id', d.boxIds);
  if (eBox) throw eBox;
  const verById = new Map<string, number>();
  for (const b of (bc ?? []) as { id: string; versione: number }[]) verById.set(b.id, b.versione);

  const id = newId();
  const versione = await prossimaVersione(nome);
  const { error: e1 } = await supabase.from('checklist_template').insert({
    id, nome, tipo_attivita: tipo, versione, stato: 'attivo', note: d.note,
  });
  if (e1) throw e1;

  const righe = d.boxIds.map((boxId, i) => ({
    id: newId(),
    template_id: id,
    box_id: boxId,
    box_versione: verById.get(boxId) ?? 1,
    ordine: i * 10,
  }));
  const { error: e2 } = await supabase.from('checklist_template_box').insert(righe);
  if (e2) throw e2;

  return id;
}

// ---- modifica composizione di un template ESISTENTE ----

export interface ComposizioneTemplate {
  templateId: string;
  nome: string;
  tipo_attivita: string;
  note: string | null;
  versione: number;
  boxIds: string[];        // ordinati per ordine crescente
  haVociPiatte: boolean;   // true se ha anche voci piatte (template "classico")
}

export async function caricaComposizioneTemplate(templateId: string): Promise<ComposizioneTemplate> {
  const { data: t, error } = await supabase
    .from('checklist_template')
    .select('id, nome, tipo_attivita, note, versione')
    .eq('id', templateId).maybeSingle();
  if (error) throw error;
  if (!t) throw new Error('Template non trovato.');

  const { data: links } = await supabase
    .from('checklist_template_box').select('box_id, ordine')
    .eq('template_id', templateId).order('ordine', { ascending: true });

  const { count } = await supabase
    .from('voce_template').select('id', { count: 'exact', head: true }).eq('template_id', templateId);

  const tt = t as { nome: string; tipo_attivita: string; note: string | null; versione: number };
  return {
    templateId,
    nome: tt.nome,
    tipo_attivita: tt.tipo_attivita,
    note: tt.note ?? null,
    versione: tt.versione,
    boxIds: ((links ?? []) as { box_id: string }[]).map((l) => l.box_id),
    haVociPiatte: (count ?? 0) > 0,
  };
}

// Aggiorna in place la composizione (capitoli + ordine) e i metadati del
// template. La composizione guida solo l'apertura dei NUOVI sopralluoghi: quelli
// gia' compilati hanno la propria copia congelata (sopralluogo_box), quindi non
// serve versionare. Sostituisce i link checklist_template_box.
export async function aggiornaComposizioneTemplate(
  templateId: string, d: NuovoTemplateDaBox,
): Promise<void> {
  const nome = d.nome.trim();
  const tipo = d.tipo_attivita.trim();
  if (!nome) throw new Error('Indicare un nome per il template.');
  if (!tipo) throw new Error('Indicare il tipo attivita (aggancio con l\'incarico).');
  if (!d.boxIds.length) throw new Error('Selezionare almeno un capitolo.');

  const { data: bc, error: eBox } = await supabase
    .from('box_catalogo').select('id, versione').in('id', d.boxIds);
  if (eBox) throw eBox;
  const verById = new Map<string, number>();
  for (const b of (bc ?? []) as { id: string; versione: number }[]) verById.set(b.id, b.versione);

  const { error: e1 } = await supabase.from('checklist_template')
    .update({ nome, tipo_attivita: tipo, note: d.note }).eq('id', templateId);
  if (e1) throw e1;

  const { error: e2 } = await supabase.from('checklist_template_box')
    .delete().eq('template_id', templateId);
  if (e2) throw e2;

  const righe = d.boxIds.map((boxId, i) => ({
    id: newId(), template_id: templateId, box_id: boxId,
    box_versione: verById.get(boxId) ?? 1, ordine: i * 10,
  }));
  const { error: e3 } = await supabase.from('checklist_template_box').insert(righe);
  if (e3) throw e3;
}
