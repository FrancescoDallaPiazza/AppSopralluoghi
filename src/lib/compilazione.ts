// Apertura e persistenza della compilazione di un sopralluogo · modello
// "form configurabile" (migration 002).
//
// All'apertura: riprende la checklist compilata (locale/server) se esiste,
// altrimenti scarica il template attivo per il tipo_attività dell'incarico,
// congela una checklist_compilata e semina UN esito per ogni voce di PRIMO
// LIVELLO non ripetibile. Le sotto-domande (figlie) e i rilievi vengono creati
// on-demand in campo. Tutto offline-first (locale + coda).

import { supabase } from './supabase';
import { db, enqueueRow } from './db';
import { salvaAzione, runSync } from './sync';
import { toBaseSopralluogo, type SopralluogoConContesto } from './sopralluoghi';
import {
  newId,
  type Azione, type AzioneTipo, type AzioneResponsabile, type AzionePriorita,
  type ChecklistCompilata, type EsitoStato, type EsitoVoce, type Sopralluogo,
  type SopralluogoStato, type VoceTemplate, type OpzioneVoce,
} from './types';

export interface DatiCompilazione {
  compilataId: string;
  voci: VoceTemplate[];   // intero albero del template (flat, con parent_voce_id)
  esiti: EsitoVoce[];     // top-level non ripetibili + eventuali esistenti (incl. figli/rilievi)
}

const COLONNE_VOCE =
  'id, template_id, codice, sezione, ordine, testo_requisito, descrizione, tipo, ' +
  'obbligatoria, parent_voce_id, mostra_se_chiave, calendarizzabile, config';

const COLONNE_ESITO =
  'id, checklist_compilata_id, voce_template_id, voce_tipo, voce_testo, voce_sezione, ' +
  'ordine, parent_esito_id, stato, valore, note, genera_azione';

// ---- helper modello ----
export const isRipetibile = (v: VoceTemplate) => v.tipo === 'rilievo';

export function opzioneDi(v: VoceTemplate, chiave: unknown): OpzioneVoce | undefined {
  if (typeof chiave !== 'string') return undefined;
  return (v.config?.opzioni ?? []).find((o) => o.chiave === chiave);
}

export function statoEsito(v: VoceTemplate, chiave: unknown): EsitoStato | null {
  const s = opzioneDi(v, chiave)?.stato;
  return s === 'positivo' ? 'conforme'
    : s === 'da_fare' ? 'non_conforme'
      : s === 'non_applicabile' ? 'non_applicabile'
        : null;
}

export const figliDi = (voci: VoceTemplate[], parentId: string | null) =>
  voci.filter((v) => v.parent_voce_id === parentId).sort((a, b) => a.ordine - b.ordine);

export function nuovoEsito(
  compilataId: string,
  v: VoceTemplate,
  parentEsitoId: string | null = null,
): EsitoVoce {
  return {
    id: newId(),
    checklist_compilata_id: compilataId,
    voce_template_id: v.id,
    voce_tipo: v.tipo,
    voce_testo: v.testo_requisito,
    voce_sezione: v.sezione,
    ordine: v.ordine,
    parent_esito_id: parentEsitoId,
    stato: null,
    valore: null,
    note: null,
    genera_azione: false,
  };
}

// ---- cache locale dell'albero voci (resume offline) ----
const chiaveVoci = (templateId: string) => `voci:${templateId}`;
function scriviCacheVoci(templateId: string, voci: VoceTemplate[]) {
  try { localStorage.setItem(chiaveVoci(templateId), JSON.stringify(voci)); } catch { /* ignora */ }
}
function leggiCacheVoci(templateId: string): VoceTemplate[] | null {
  try {
    const raw = localStorage.getItem(chiaveVoci(templateId));
    return raw ? (JSON.parse(raw) as VoceTemplate[]) : null;
  } catch { return null; }
}

// ---- cache locale del template attivo per tipo attività ----
// Senza questa, offline non si saprebbe QUALE template/versione usare per un
// sopralluogo mai aperto: la prefetch la riempie, l'apertura offline la legge.
type TemplateAttivo = { id: string; versione: number };
const chiaveTmpl = (tipo: string) => `tmplattivo:${tipo}`;
function scriviCacheTmpl(tipo: string, t: TemplateAttivo) {
  try { localStorage.setItem(chiaveTmpl(tipo), JSON.stringify(t)); } catch { /* ignora */ }
}
function leggiCacheTmpl(tipo: string): TemplateAttivo | null {
  try {
    const raw = localStorage.getItem(chiaveTmpl(tipo));
    return raw ? (JSON.parse(raw) as TemplateAttivo) : null;
  } catch { return null; }
}

async function caricaVoci(templateId: string): Promise<VoceTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('voce_template')
      .select(COLONNE_VOCE)
      .eq('template_id', templateId)
      .order('ordine', { ascending: true });
    if (error) throw error;
    const voci = (data ?? []) as unknown as VoceTemplate[];
    if (voci.length) scriviCacheVoci(templateId, voci);
    return voci;
  } catch {
    const cache = leggiCacheVoci(templateId);
    if (cache) return cache;
    throw new Error('Voci del template non disponibili offline.');
  }
}

async function caricaTemplateAttivo(tipoAttivita: string): Promise<TemplateAttivo | null> {
  try {
    const { data, error } = await supabase
      .from('checklist_template')
      .select('id, versione')
      .eq('tipo_attivita', tipoAttivita)
      .eq('stato', 'attivo')
      .order('versione', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const t = data as TemplateAttivo;
      scriviCacheTmpl(tipoAttivita, t);
      return t;
    }
    return null; // online ma nessun template attivo: risposta autorevole
  } catch {
    return leggiCacheTmpl(tipoAttivita); // offline: ripiego sulla cache
  }
}

// Prefetch (online): scarica e mette in cache il template attivo + le voci per
// un tipo attività, così il sopralluogo si potrà aprire offline. Ritorna true
// se un template attivo esiste.
export async function prefetchTemplatePerTipo(tipoAttivita: string): Promise<boolean> {
  const tmpl = await caricaTemplateAttivo(tipoAttivita);
  if (!tmpl) return false;
  await caricaVoci(tmpl.id);
  return true;
}

// ---- esiti esistenti (resume): server + locale, locale vince ----
async function caricaEsitiEsistenti(compilataId: string): Promise<EsitoVoce[]> {
  let server: EsitoVoce[] = [];
  try {
    const { data } = await supabase
      .from('esito_voce')
      .select(COLONNE_ESITO)
      .eq('checklist_compilata_id', compilataId);
    server = (data ?? []) as unknown as EsitoVoce[];
    if (server.length) await db.esiti.bulkPut(server);
  } catch { /* offline */ }

  const locali = await db.esiti.where('checklist_compilata_id').equals(compilataId).toArray();
  const map = new Map<string, EsitoVoce>();
  for (const e of server) map.set(e.id, e);
  for (const e of locali) map.set(e.id, e);
  return [...map.values()].sort((a, b) => a.ordine - b.ordine);
}

async function avviaSopralluogo(sopr: Sopralluogo) {
  if (sopr.stato !== 'pianificato') return;
  const agg: Sopralluogo = {
    ...toBaseSopralluogo(sopr),
    stato: 'in_corso',
    data_effettiva: sopr.data_effettiva ?? new Date().toISOString(),
  };
  await db.sopralluoghi.put(agg);
  await enqueueRow('sopralluogo', agg as unknown as Record<string, unknown>);
}

// ---- API principale ----
export async function apriCompilazione(
  sopralluogo: SopralluogoConContesto,
): Promise<DatiCompilazione> {
  const soprId = sopralluogo.id;

  // 1) compilata esistente? (locale, poi server)
  let compilata =
    (await db.compilate.where('sopralluogo_id').equals(soprId).first()) ?? null;
  if (!compilata) {
    try {
      const { data } = await supabase
        .from('checklist_compilata')
        .select('id, sopralluogo_id, template_id, template_versione, data_compilazione')
        .eq('sopralluogo_id', soprId)
        .maybeSingle();
      if (data) {
        compilata = data as ChecklistCompilata;
        await db.compilate.put(compilata);
      }
    } catch { /* offline */ }
  }

  // 2a) riprendi
  if (compilata) {
    const voci = await caricaVoci(compilata.template_id);
    const esiti = await caricaEsitiEsistenti(compilata.id);
    return { compilataId: compilata.id, voci, esiti };
  }

  // 2b) nuova: serve il template (richiede rete almeno una volta)
  if (!sopralluogo.tipo_attivita) {
    throw new Error('Tipo attività sconosciuto: impossibile scegliere la checklist.');
  }
  const tmpl = await caricaTemplateAttivo(sopralluogo.tipo_attivita);
  if (!tmpl) throw new Error(`Nessuna checklist attiva per "${sopralluogo.tipo_attivita}".`);

  const voci = await caricaVoci(tmpl.id);

  compilata = {
    id: newId(),
    sopralluogo_id: soprId,
    template_id: tmpl.id,
    template_versione: tmpl.versione,
    data_compilazione: new Date().toISOString(),
  };
  await db.compilate.put(compilata);
  await enqueueRow('checklist_compilata', compilata as unknown as Record<string, unknown>);

  // semina un esito per ogni voce di PRIMO LIVELLO non ripetibile
  const daSeminare = voci.filter((v) => v.parent_voce_id === null && !isRipetibile(v));
  const esiti = daSeminare.map((v) => nuovoEsito(compilata!.id, v));
  await db.esiti.bulkPut(esiti);
  for (const e of esiti) {
    await enqueueRow('esito_voce', e as unknown as Record<string, unknown>);
  }

  await avviaSopralluogo(sopralluogo);
  void runSync();

  return { compilataId: compilata.id, voci, esiti };
}

// ---- azione generata (idempotente per esito + tipo) ----
export interface InputAzione {
  esitoId: string;
  sopralluogoId: string;
  tipo: AzioneTipo;
  descrizione: string;
  responsabileTipo: AzioneResponsabile;
  dataScadenza: string | null;
  priorita: AzionePriorita;
  clienteId: string | null;
  tecnicoId: string;
  periodicitaMesi?: number | null;
}

export async function generaAzione(i: InputAzione): Promise<Azione> {
  const esistenti = await db.azioni.toArray();
  const gia = esistenti.find((a) => a.origine_esito_id === i.esitoId && a.tipo === i.tipo);

  const azione: Azione = {
    id: gia?.id ?? newId(),
    tipo: i.tipo,
    origine_esito_id: i.esitoId,
    sopralluogo_origine_id: i.sopralluogoId,
    descrizione: i.descrizione,
    responsabile_tipo: i.responsabileTipo,
    responsabile_cliente_id: i.responsabileTipo === 'cliente' ? i.clienteId : null,
    responsabile_interno_id: i.responsabileTipo === 'risorsa_interna' ? i.tecnicoId : null,
    data_scadenza: i.dataScadenza,
    priorita: i.priorita,
    stato: 'aperta',
    sopralluogo_verifica_id: null,
    data_verifica: null,
    periodicita_mesi: i.tipo === 'scadenza_ricorrente' ? (i.periodicitaMesi ?? null) : null,
    werp_attivita_id: null,
  };
  await salvaAzione(azione);
  return azione;
}

export async function completaSopralluogo(sopr: Sopralluogo): Promise<void> {
  const base = toBaseSopralluogo(sopr);
  const agg: Sopralluogo = {
    ...base,
    stato: 'completato' as SopralluogoStato,
    data_effettiva: base.data_effettiva ?? new Date().toISOString(),
  };
  await db.sopralluoghi.put(agg);
  await enqueueRow('sopralluogo', agg as unknown as Record<string, unknown>);
}
