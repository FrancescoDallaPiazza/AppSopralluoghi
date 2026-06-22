// Strato dati del back-office per i CAPITOLI (box del catalogo, migration 030+).
//
// Un capitolo = un box_catalogo 'generico' con N box_sezione, ciascuna con le
// proprie voci (voce_template con sezione_id valorizzato, template_id NULL).
// Qui: elenco, caricamento completo, anteprima (sola lettura per il compositore),
// creazione, salvataggio in place, duplica, archivia/riattiva.
//
// Regola di sicurezza (come i template): un capitolo gia' CONGELATO in almeno un
// sopralluogo (sopralluogo_box) non si modifica a ritroso -> si duplica. I box
// 'smart'/'fisso' (ORGANIGRAMMA, PREGRESSE) sono moduli speciali: si elencano
// ma non si editano da qui.
//
// Online-first: parla diretto con Supabase.

import { supabase } from '../supabase';
import { newId, type BoxCatalogo, type BoxSezione, type VoceTemplate } from '../types';

const COLONNE_BOX =
  'id, codice, nome, descrizione, tipo, ref_smart, ordine_default, versione, attivo';
const COLONNE_SEZ =
  'id, box_id, codice, nome, ordine, ripetibile, etichetta_componente';
const COLONNE_VOCE =
  'id, template_id, sezione_id, codice, sezione, ordine, testo_requisito, descrizione, tipo, ' +
  'obbligatoria, parent_voce_id, mostra_se_chiave, calendarizzabile, config';

export interface CapitoloRiga {
  box: BoxCatalogo;
  n_sezioni: number;
  n_voci: number;
  usato: boolean;   // congelato in almeno un sopralluogo
}

// ---- elenco ----
export async function caricaCapitoli(): Promise<CapitoloRiga[]> {
  const { data: bc, error } = await supabase
    .from('box_catalogo').select(COLONNE_BOX)
    .order('ordine_default', { ascending: true });
  if (error) throw error;
  const boxes = (bc ?? []) as unknown as BoxCatalogo[];

  const { data: sez } = await supabase.from('box_sezione').select('id, box_id');
  const { data: voci } = await supabase
    .from('voce_template').select('sezione_id').not('sezione_id', 'is', null);
  const { data: usati } = await supabase.from('sopralluogo_box').select('box_id');

  const sezId2box = new Map<string, string>();
  const sezPerBox = new Map<string, number>();
  for (const s of (sez ?? []) as { id: string; box_id: string }[]) {
    sezId2box.set(s.id, s.box_id);
    sezPerBox.set(s.box_id, (sezPerBox.get(s.box_id) ?? 0) + 1);
  }
  const vociPerBox = new Map<string, number>();
  for (const v of (voci ?? []) as { sezione_id: string }[]) {
    const b = sezId2box.get(v.sezione_id);
    if (b) vociPerBox.set(b, (vociPerBox.get(b) ?? 0) + 1);
  }
  const setUsati = new Set((usati ?? []).map((r: { box_id: string }) => r.box_id));

  return boxes.map((box): CapitoloRiga => ({
    box,
    n_sezioni: sezPerBox.get(box.id) ?? 0,
    n_voci: vociPerBox.get(box.id) ?? 0,
    usato: setUsati.has(box.id),
  }));
}

// ---- caricamento completo (editor) ----
export interface CapitoloCompleto {
  box: BoxCatalogo;
  sezioni: BoxSezione[];
  voci: VoceTemplate[];
  usato: boolean;
}

async function vociDelBox(sezioniIds: string[]): Promise<VoceTemplate[]> {
  if (!sezioniIds.length) return [];
  const { data, error } = await supabase
    .from('voce_template').select(COLONNE_VOCE)
    .in('sezione_id', sezioniIds)
    .order('ordine', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as VoceTemplate[];
}

export async function caricaCapitoloCompleto(boxId: string): Promise<CapitoloCompleto> {
  const { data: b, error: e1 } = await supabase
    .from('box_catalogo').select(COLONNE_BOX).eq('id', boxId).maybeSingle();
  if (e1) throw e1;
  if (!b) throw new Error('Capitolo non trovato.');

  const { data: sez, error: e2 } = await supabase
    .from('box_sezione').select(COLONNE_SEZ).eq('box_id', boxId)
    .order('ordine', { ascending: true });
  if (e2) throw e2;
  const sezioni = (sez ?? []) as unknown as BoxSezione[];
  const voci = await vociDelBox(sezioni.map((s) => s.id));

  const { count } = await supabase
    .from('sopralluogo_box').select('id', { count: 'exact', head: true }).eq('box_id', boxId);

  return { box: b as unknown as BoxCatalogo, sezioni, voci, usato: (count ?? 0) > 0 };
}

// Anteprima (sola lettura) per il compositore: sezioni + voci di un box.
export interface AnteprimaCapitolo { sezioni: BoxSezione[]; voci: VoceTemplate[]; }
export async function caricaAnteprimaCapitolo(boxId: string): Promise<AnteprimaCapitolo> {
  const { data: sez } = await supabase
    .from('box_sezione').select(COLONNE_SEZ).eq('box_id', boxId)
    .order('ordine', { ascending: true });
  const sezioni = (sez ?? []) as unknown as BoxSezione[];
  const voci = await vociDelBox(sezioni.map((s) => s.id));
  return { sezioni, voci };
}

// ---- helpers di scrittura ----
const rigaSez = (s: BoxSezione, boxId: string) => ({
  id: s.id, box_id: boxId, codice: s.codice, nome: s.nome, ordine: s.ordine,
  ripetibile: s.ripetibile, etichetta_componente: s.etichetta_componente,
});
const rigaVoce = (v: VoceTemplate) => ({
  id: v.id, template_id: null, sezione_id: v.sezione_id ?? null,
  codice: v.codice, sezione: null, ordine: v.ordine,
  testo_requisito: v.testo_requisito, descrizione: v.descrizione, tipo: v.tipo,
  obbligatoria: v.obbligatoria, parent_voce_id: v.parent_voce_id,
  mostra_se_chiave: v.mostra_se_chiave, calendarizzabile: v.calendarizzabile,
  config: v.config ?? {},
});

export interface DatiCapitolo {
  nome: string;
  descrizione: string | null;
  sezioni: BoxSezione[];
  voci: VoceTemplate[];
}

async function prossimoOrdineDefault(): Promise<number> {
  const { data } = await supabase
    .from('box_catalogo').select('ordine_default')
    .order('ordine_default', { ascending: false }).limit(1).maybeSingle();
  return ((data as { ordine_default: number } | null)?.ordine_default ?? 0) + 1;
}

// Nuovo capitolo (generico). Ritorna l'id del box.
export async function creaCapitolo(d: DatiCapitolo): Promise<string> {
  const nome = d.nome.trim();
  if (!nome) throw new Error('Indicare un nome per il capitolo.');
  const id = newId();
  const codice = 'USR_' + id.slice(0, 8).toUpperCase();
  const ordine = await prossimoOrdineDefault();

  const { error: e1 } = await supabase.from('box_catalogo').insert({
    id, codice, nome, descrizione: d.descrizione,
    tipo: 'generico', ref_smart: null, ordine_default: ordine, versione: 1, attivo: true,
  });
  if (e1) throw e1;

  if (d.sezioni.length) {
    const { error } = await supabase.from('box_sezione').insert(d.sezioni.map((s) => rigaSez(s, id)));
    if (error) throw error;
  }
  if (d.voci.length) {
    const { error } = await supabase.from('voce_template').insert(d.voci.map(rigaVoce));
    if (error) throw error;
  }
  return id;
}

// Salvataggio in place (solo capitolo NON ancora usato): aggiorna meta, riconcilia
// sezioni e voci (upsert correnti, elimina rimosse).
export async function salvaCapitoloInPlace(
  boxId: string, d: DatiCapitolo, sezOrigId: string[], vociOrigId: string[],
): Promise<void> {
  const nome = d.nome.trim();
  if (!nome) throw new Error('Indicare un nome per il capitolo.');

  const { error: e0 } = await supabase.from('box_catalogo')
    .update({ nome, descrizione: d.descrizione }).eq('id', boxId);
  if (e0) throw e0;

  // 1) upsert sezioni correnti (i FK delle voci puntano qui)
  if (d.sezioni.length) {
    const { error } = await supabase.from('box_sezione')
      .upsert(d.sezioni.map((s) => rigaSez(s, boxId)), { onConflict: 'id' });
    if (error) throw error;
  }
  // 2) elimina voci rimosse, poi sezioni rimosse (cascade pulisce eventuali resti)
  const vCorr = new Set(d.voci.map((v) => v.id));
  const vDel = vociOrigId.filter((x) => !vCorr.has(x));
  if (vDel.length) {
    const { error } = await supabase.from('voce_template').delete().in('id', vDel);
    if (error) throw error;
  }
  const sCorr = new Set(d.sezioni.map((s) => s.id));
  const sDel = sezOrigId.filter((x) => !sCorr.has(x));
  if (sDel.length) {
    const { error } = await supabase.from('box_sezione').delete().in('id', sDel);
    if (error) throw error;
  }
  // 3) upsert voci correnti
  if (d.voci.length) {
    const { error } = await supabase.from('voce_template')
      .upsert(d.voci.map(rigaVoce), { onConflict: 'id' });
    if (error) throw error;
  }
}

// Duplica un capitolo (anche per modificarne uno gia' usato): rigenera tutti gli
// id (sezioni + voci, rimappando parent_voce_id e sezione_id). Ritorna il nuovo id.
export async function duplicaCapitolo(boxId: string): Promise<string> {
  const c = await caricaCapitoloCompleto(boxId);
  const mapSez = new Map<string, string>();
  for (const s of c.sezioni) mapSez.set(s.id, newId());
  const mapVoce = new Map<string, string>();
  for (const v of c.voci) mapVoce.set(v.id, newId());

  const sezioni: BoxSezione[] = c.sezioni.map((s) => ({ ...s, id: mapSez.get(s.id)! }));
  const voci: VoceTemplate[] = c.voci.map((v) => ({
    ...v,
    id: mapVoce.get(v.id)!,
    sezione_id: v.sezione_id ? (mapSez.get(v.sezione_id) ?? null) : null,
    parent_voce_id: v.parent_voce_id ? (mapVoce.get(v.parent_voce_id) ?? null) : null,
  }));
  return creaCapitolo({ nome: `Copia di ${c.box.nome}`, descrizione: c.box.descrizione, sezioni, voci });
}

export async function impostaStatoCapitolo(boxId: string, attivo: boolean): Promise<void> {
  const { error } = await supabase.from('box_catalogo').update({ attivo }).eq('id', boxId);
  if (error) throw error;
}
