// Strato dati del back-office · gestione dei template di checklist.
//
// Online-first: il back-office si usa da scrivania, quindi parla direttamente
// con Supabase (niente coda offline come nel campo).
//
// Regola d'oro del VERSIONAMENTO: un template GIÀ USATO (esiste almeno una
// `checklist_compilata` che lo riferisce) non si modifica mai a ritroso —
// le checklist compilate congelano `template_id` e gli esiti puntano alle
// righe `voce_template`. Modificare un template usato significa quindi creare
// una NUOVA VERSIONE (nuova riga template + voci nuove) e archiviare la vecchia.
// Un template mai usato si modifica in place.

import { supabase } from '../supabase';
import { newId, type ChecklistTemplate, type VoceTemplate } from '../types';

const COLONNE_TEMPLATE = 'id, nome, tipo_attivita, versione, stato, note';
const COLONNE_VOCE =
  'id, template_id, codice, sezione, ordine, testo_requisito, descrizione, tipo, ' +
  'obbligatoria, parent_voce_id, mostra_se_chiave, calendarizzabile, config';

export interface TemplateRiga {
  template: ChecklistTemplate;
  usato: boolean;     // ha almeno una checklist compilata che lo riferisce
  n_voci: number;
}

// ---- elenco (raggruppabile per nome lato UI) ----
export async function caricaTemplates(): Promise<TemplateRiga[]> {
  const { data: tmpl, error } = await supabase
    .from('checklist_template')
    .select(COLONNE_TEMPLATE)
    .order('nome', { ascending: true })
    .order('versione', { ascending: false });
  if (error) throw error;

  const { data: voci } = await supabase.from('voce_template').select('template_id');
  const conta = new Map<string, number>();
  for (const v of (voci ?? []) as { template_id: string }[]) {
    conta.set(v.template_id, (conta.get(v.template_id) ?? 0) + 1);
  }

  const { data: usati } = await supabase.from('checklist_compilata').select('template_id');
  const setUsati = new Set((usati ?? []).map((r: { template_id: string }) => r.template_id));

  return (tmpl ?? []).map((t: any): TemplateRiga => ({
    template: t as ChecklistTemplate,
    usato: setUsati.has(t.id),
    n_voci: conta.get(t.id) ?? 0,
  }));
}

// ---- caricamento completo per l'editor ----
export interface TemplateCompleto {
  template: ChecklistTemplate;
  voci: VoceTemplate[];
  usato: boolean;
}

export async function caricaTemplateCompleto(id: string): Promise<TemplateCompleto> {
  const { data: t, error: e1 } = await supabase
    .from('checklist_template').select(COLONNE_TEMPLATE).eq('id', id).maybeSingle();
  if (e1) throw e1;
  if (!t) throw new Error('Template non trovato.');

  const { data: voci, error: e2 } = await supabase
    .from('voce_template').select(COLONNE_VOCE).eq('template_id', id)
    .order('ordine', { ascending: true });
  if (e2) throw e2;

  const { count } = await supabase
    .from('checklist_compilata')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', id);

  return {
    template: t as ChecklistTemplate,
    voci: (voci ?? []) as unknown as VoceTemplate[],
    usato: (count ?? 0) > 0,
  };
}

// ---- helpers di scrittura ----
function rigaVoce(v: VoceTemplate, templateId: string): Record<string, unknown> {
  return {
    id: v.id,
    template_id: templateId,
    codice: v.codice,
    sezione: v.sezione,
    ordine: v.ordine,
    testo_requisito: v.testo_requisito,
    descrizione: v.descrizione,
    tipo: v.tipo,
    obbligatoria: v.obbligatoria,
    parent_voce_id: v.parent_voce_id,
    mostra_se_chiave: v.mostra_se_chiave,
    calendarizzabile: v.calendarizzabile,
    config: v.config ?? {},
  };
}

// Rigenera gli id (e rimappa i parent_voce_id) per una nuova riga template.
function rimappaVoci(voci: VoceTemplate[], templateId: string): Record<string, unknown>[] {
  const map = new Map<string, string>();
  for (const v of voci) map.set(v.id, newId());
  return voci.map((v) =>
    rigaVoce(
      {
        ...v,
        id: map.get(v.id)!,
        parent_voce_id: v.parent_voce_id ? (map.get(v.parent_voce_id) ?? null) : null,
      },
      templateId,
    ),
  );
}

async function prossimaVersione(nome: string): Promise<number> {
  const { data } = await supabase
    .from('checklist_template').select('versione')
    .eq('nome', nome).order('versione', { ascending: false }).limit(1).maybeSingle();
  return ((data as { versione: number } | null)?.versione ?? 0) + 1;
}

interface MetaTemplate {
  nome: string;
  tipo_attivita: string;
  note: string | null;
}

// Inserisce una riga template nuova (versione calcolata) con le sue voci.
// Restituisce l'id del nuovo template.
async function inserisciTemplateConVoci(meta: MetaTemplate, voci: VoceTemplate[]): Promise<string> {
  const id = newId();
  const versione = await prossimaVersione(meta.nome);
  const { error: e1 } = await supabase.from('checklist_template').insert({
    id, nome: meta.nome, tipo_attivita: meta.tipo_attivita,
    versione, stato: 'attivo', note: meta.note,
  });
  if (e1) throw e1;

  if (voci.length) {
    const { error: e2 } = await supabase.from('voce_template').insert(rimappaVoci(voci, id));
    if (e2) throw e2;
  }
  return id;
}

// Nuovo template (anche da "duplica"): versione 1 se il nome è nuovo, altrimenti
// max+1. Non archivia nulla (è un nome a sé).
export async function salvaComeNuovo(meta: MetaTemplate, voci: VoceTemplate[]): Promise<string> {
  return inserisciTemplateConVoci(meta, voci);
}

// Nuova versione di un template ESISTENTE già usato: crea la versione successiva
// e archivia la versione di partenza.
export async function salvaComeNuovaVersione(
  meta: MetaTemplate, voci: VoceTemplate[], sorgenteId: string,
): Promise<string> {
  const nuovoId = await inserisciTemplateConVoci(meta, voci);
  const { error } = await supabase
    .from('checklist_template').update({ stato: 'archiviato' }).eq('id', sorgenteId);
  if (error) throw error;
  return nuovoId;
}

// Salvataggio in place (solo template MAI usato): aggiorna i metadati, fa
// upsert delle voci correnti ed elimina quelle rimosse rispetto all'originale.
export async function salvaInPlace(
  template: ChecklistTemplate, voci: VoceTemplate[], vociOriginariId: string[],
): Promise<void> {
  const { error: e1 } = await supabase.from('checklist_template')
    .update({ nome: template.nome, tipo_attivita: template.tipo_attivita, note: template.note })
    .eq('id', template.id);
  if (e1) throw e1;

  const idCorrenti = new Set(voci.map((v) => v.id));
  const daEliminare = vociOriginariId.filter((id) => !idCorrenti.has(id));
  if (daEliminare.length) {
    const { error } = await supabase.from('voce_template').delete().in('id', daEliminare);
    if (error) throw error;
  }

  if (voci.length) {
    const righe = voci.map((v) => rigaVoce({ ...v, template_id: template.id }, template.id));
    const { error } = await supabase.from('voce_template').upsert(righe, { onConflict: 'id' });
    if (error) throw error;
  }
}

export async function impostaStatoTemplate(
  id: string, stato: 'attivo' | 'archiviato',
): Promise<void> {
  const { error } = await supabase.from('checklist_template').update({ stato }).eq('id', id);
  if (error) throw error;
}
