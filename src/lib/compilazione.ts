// Apertura e persistenza della compilazione di un sopralluogo · modello
// "form configurabile" (migration 002).
//
// All'apertura: riprende la checklist compilata (locale/server) se esiste,
// altrimenti propone la SCELTA della checklist (default = quella dell'incarico,
// modificabile tra i template attivi); confermata la scelta, congela una
// checklist_compilata sul template scelto e semina UN esito per ogni voce di
// PRIMO LIVELLO non ripetibile. Le sotto-domande (figlie) e i rilievi vengono
// creati on-demand in campo. Tutto offline-first (locale + coda).
//
// Nota: il template scelto resta CONGELATO sulla compilazione; le cose da fare
// non dipendono dal template ma dall'incarico (il "giro precedente" filtra per
// incarico), quindi cambiare checklist tra una seduta e l'altra non spezza la
// continuità delle azioni.

import { supabase } from './supabase';
import { db, enqueueRow } from './db';
import { salvaAzione, runSync } from './sync';
import { toBaseSopralluogo, type SopralluogoConContesto } from './sopralluoghi';
import {
  newId,
  type Azione, type AzioneTipo, type AzioneResponsabile, type AzionePriorita,
  type ChecklistCompilata, type EsitoVoce, type Sopralluogo,
  type SopralluogoStato, type VoceTemplate,
} from './types';

export interface DatiCompilazione {
  compilataId: string;
  templateId: string;    // template congelato della compilazione (per i box del template)
  voci: VoceTemplate[];   // intero albero del template (flat, con parent_voce_id)
  esiti: EsitoVoce[];     // top-level non ripetibili + eventuali esistenti (incl. figli/rilievi)
}

// Una checklist selezionabile in campo all'apertura di un sopralluogo.
export interface TemplateScelta {
  id: string;
  nome: string;
  tipo_attivita: string;
  versione: number;
}

// Esito dell'apertura:
//   * 'pronto' -> la compilazione è pronta (ripresa di una esistente, oppure
//     ripiego offline sul template dell'incarico): si va dritti al form;
//   * 'scelta' -> serve scegliere la checklist (default = quella dell'incarico).
export type AperturaCompilazione =
  | ({ modo: 'pronto' } & DatiCompilazione)
  | { modo: 'scelta'; templates: TemplateScelta[]; defaultTemplateId: string | null };

const COLONNE_VOCE =
  'id, template_id, codice, sezione, ordine, testo_requisito, descrizione, tipo, ' +
  'obbligatoria, parent_voce_id, mostra_se_chiave, calendarizzabile, config';

const COLONNE_ESITO =
  'id, checklist_compilata_id, voce_template_id, voce_tipo, voce_testo, voce_sezione, ' +
  'ordine, parent_esito_id, stato, valore, note, genera_azione, componente_id';

// ---- helper modello ----
export const isRipetibile = (v: VoceTemplate) => v.tipo === 'rilievo';

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

// ---- cache locale dell'elenco dei template attivi (scelta offline) ----
const CHIAVE_TMPL_ATTIVI = 'tmplattivi:all';
function scriviCacheTmplAttivi(lista: TemplateScelta[]) {
  try { localStorage.setItem(CHIAVE_TMPL_ATTIVI, JSON.stringify(lista)); } catch { /* ignora */ }
}
function leggiCacheTmplAttivi(): TemplateScelta[] {
  try {
    const raw = localStorage.getItem(CHIAVE_TMPL_ATTIVI);
    return raw ? (JSON.parse(raw) as TemplateScelta[]) : [];
  } catch { return []; }
}

// Elenco dei template ATTIVI selezionabili in campo. Online: query autorevole +
// cache. Offline: cache (riempita dal prefetch). Una sola riga per nome (la
// versione più alta), così non compaiono duplicati di versione.
export async function caricaTemplatesAttivi(): Promise<TemplateScelta[]> {
  try {
    const { data, error } = await supabase
      .from('checklist_template')
      .select('id, nome, tipo_attivita, versione')
      .eq('stato', 'attivo')
      .order('nome', { ascending: true })
      .order('versione', { ascending: false });
    if (error) throw error;
    const righe = (data ?? []) as unknown as TemplateScelta[];
    const perNome = new Map<string, TemplateScelta>();
    for (const t of righe) if (!perNome.has(t.nome)) perNome.set(t.nome, t);
    const lista = [...perNome.values()];
    if (lista.length) scriviCacheTmplAttivi(lista);
    return lista;
  } catch {
    return leggiCacheTmplAttivi();
  }
}

// Prefetch (online): elenco dei template attivi + le loro voci, così in campo
// si può SCEGLIERE la checklist (default = quella dell'incarico) anche offline.
export async function prefetchTemplatesAttivi(): Promise<number> {
  const lista = await caricaTemplatesAttivi();
  for (const t of lista) {
    try { await caricaVoci(t.id); } catch { /* best-effort */ }
  }
  return lista.length;
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

// ---- creazione (interna): congela la compilata sul template scelto ----
// Crea la checklist compilata sul template indicato, semina gli esiti di primo
// livello non ripetibili e avvia il sopralluogo. Il template resta CONGELATO
// sulla compilata: scelto una volta, non cambia più (le revisioni lo conservano).
async function creaCompilazione(
  sopralluogo: SopralluogoConContesto,
  templateId: string,
  templateVersione: number,
): Promise<DatiCompilazione> {
  const voci = await caricaVoci(templateId);

  const compilata: ChecklistCompilata = {
    id: newId(),
    sopralluogo_id: sopralluogo.id,
    template_id: templateId,
    template_versione: templateVersione,
    data_compilazione: new Date().toISOString(),
  };
  await db.compilate.put(compilata);
  await enqueueRow('checklist_compilata', compilata as unknown as Record<string, unknown>);

  // semina un esito per ogni voce di PRIMO LIVELLO non ripetibile
  const daSeminare = voci.filter((v) => v.parent_voce_id === null && !isRipetibile(v));
  const esiti = daSeminare.map((v) => nuovoEsito(compilata.id, v));
  await db.esiti.bulkPut(esiti);
  for (const e of esiti) {
    await enqueueRow('esito_voce', e as unknown as Record<string, unknown>);
  }

  await avviaSopralluogo(sopralluogo);
  void runSync();

  return { compilataId: compilata.id, templateId, voci, esiti };
}

// ---- API principale ----
// Apertura di un sopralluogo:
//   * se esiste già una checklist compilata -> la riprende (template CONGELATO,
//     niente scelta: vale anche per le revisioni);
//   * altrimenti propone la SCELTA della checklist (default = quella dell'incarico).
// Ripiego: se si è offline SENZA elenco in cache (mai prefetchato) ma si conosce
// il template dell'incarico, si apre direttamente con quello (comportamento storico).
export async function apriCompilazione(
  sopralluogo: SopralluogoConContesto,
): Promise<AperturaCompilazione> {
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

  // 2a) riprendi (template congelato)
  if (compilata) {
    const voci = await caricaVoci(compilata.template_id);
    const esiti = await caricaEsitiEsistenti(compilata.id);
    return { modo: 'pronto', compilataId: compilata.id, templateId: compilata.template_id, voci, esiti };
  }

  // 2b) nuova compilazione -> scelta del template (default = quello dell'incarico)
  const elenco = await caricaTemplatesAttivi();

  // Offline senza elenco in cache: ripiega sul template dell'incarico, se noto.
  if (elenco.length === 0) {
    const def = sopralluogo.tipo_attivita
      ? await caricaTemplateAttivo(sopralluogo.tipo_attivita)
      : null;
    if (!def) {
      throw new Error(
        sopralluogo.tipo_attivita
          ? `Nessuna checklist attiva per "${sopralluogo.tipo_attivita}".`
          : 'Nessuna checklist attiva disponibile.',
      );
    }
    const dati = await creaCompilazione(sopralluogo, def.id, def.versione);
    return { modo: 'pronto', ...dati };
  }

  const defaultTemplateId =
    (sopralluogo.tipo_attivita
      ? elenco.find((t) => t.tipo_attivita === sopralluogo.tipo_attivita)?.id
      : undefined) ?? null;

  return { modo: 'scelta', templates: elenco, defaultTemplateId };
}

// Conferma della scelta: crea la compilazione sul template scelto. Difensiva:
// se nel frattempo una compilata fosse già stata creata, la riprende (niente
// doppioni).
export async function iniziaCompilazione(
  sopralluogo: SopralluogoConContesto,
  template: { id: string; versione: number },
): Promise<DatiCompilazione> {
  const esistente =
    (await db.compilate.where('sopralluogo_id').equals(sopralluogo.id).first()) ?? null;
  if (esistente) {
    const voci = await caricaVoci(esistente.template_id);
    const esiti = await caricaEsitiEsistenti(esistente.id);
    return { compilataId: esistente.id, templateId: esistente.template_id, voci, esiti };
  }
  return creaCompilazione(sopralluogo, template.id, template.versione);
}

// ---- azione generata ----
// Chiave di identità dell'azione:
//   * se `azioneId` è passato (cose da fare correttive), la riga è identificata
//     da QUELL'id: niente dedup per esito, così uno stesso rilievo può generare
//     PIÙ cose da fare. Resta idempotente: ripetere la chiamata con lo stesso
//     azioneId fa un upsert, non un duplicato.
//   * se `azioneId` è assente (es. scadenze ricorrenti, una per esito), si
//     mantiene il dedup storico per (origine_esito_id + tipo).
export interface InputAzione {
  azioneId?: string;               // chiave stabile per-bozza (cose da fare multiple)
  esitoId: string;
  sopralluogoId: string;
  tipo: AzioneTipo;
  descrizione: string;
  responsabileTipo: AzioneResponsabile;
  dataScadenza: string | null;
  priorita: AzionePriorita;
  clienteId: string | null;
  tecnicoId: string;               // destinatario interno (può essere un tecnico diverso da chi compila)
  areaId?: string | null;          // se interno -> a un'area invece che al tecnico
  periodicitaMesi?: number | null;
  componenteId?: string | null;    // componente del box ripetibile (origine dell'esito)
}

export async function generaAzione(i: InputAzione): Promise<Azione> {
  let id: string;
  if (i.azioneId) {
    id = i.azioneId;
  } else {
    const esistenti = await db.azioni.toArray();
    const gia = esistenti.find((a) => a.origine_esito_id === i.esitoId && a.tipo === i.tipo);
    id = gia?.id ?? newId();
  }

  // Interno: destinatario = area se indicata, altrimenti il tecnico.
  const versoArea = i.responsabileTipo === 'risorsa_interna' && !!i.areaId;

  // Se l'azione esiste già (ricompletamento dello stesso sopralluogo), si
  // conservano lo stato di avanzamento, gli estremi di verifica e soprattutto
  // notificata_il: così ricompletare NON rispedisce le email già inviate e NON
  // riapre azioni eventualmente già chiuse. È un upsert, non un duplicato.
  const esistente = await db.azioni.get(id);

  const azione: Azione = {
    id,
    tipo: i.tipo,
    origine_esito_id: i.esitoId,
    sopralluogo_origine_id: i.sopralluogoId,
    descrizione: i.descrizione,
    responsabile_tipo: i.responsabileTipo,
    responsabile_cliente_id: i.responsabileTipo === 'cliente' ? i.clienteId : null,
    responsabile_interno_id:
      i.responsabileTipo === 'risorsa_interna' && !versoArea ? i.tecnicoId : null,
    responsabile_area_id: versoArea ? i.areaId! : null,
    data_scadenza: i.dataScadenza,
    priorita: i.priorita,
    stato: esistente?.stato ?? 'aperta',
    sopralluogo_verifica_id: esistente?.sopralluogo_verifica_id ?? null,
    data_verifica: esistente?.data_verifica ?? null,
    periodicita_mesi: i.tipo === 'scadenza_ricorrente' ? (i.periodicitaMesi ?? null) : null,
    werp_attivita_id: esistente?.werp_attivita_id ?? null,
    notificata_il: esistente?.notificata_il ?? null,
    componente_id: i.componenteId ?? null,
  };
  await salvaAzione(azione);
  return azione;
}

// Aggiorna i metadati di testata del sopralluogo (sede ispezionata, data
// effettiva) durante la compilazione: persiste via outbox come gli altri update.
export async function aggiornaTestataSopralluogo(
  sopr: SopralluogoConContesto,
  patch: { sede_id?: string | null; data_effettiva?: string | null },
): Promise<void> {
  const agg: Sopralluogo = { ...toBaseSopralluogo(sopr), ...patch };
  await db.sopralluoghi.put(agg);
  await enqueueRow('sopralluogo', agg as unknown as Record<string, unknown>);
  void runSync();
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
