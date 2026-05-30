// Apertura e persistenza della compilazione di un sopralluogo.
//
// All'apertura: se esiste già una checklist compilata (locale o sul server) la
// riprende; altrimenti scarica il template attivo per il tipo attività
// dell'incarico, congela una checklist_compilata e semina un esito_voce per
// ogni voce. Tutto vive in locale + coda (offline-safe), una volta che il
// template è stato scaricato almeno una volta.

import { supabase } from './supabase';
import { db, enqueueRow } from './db';
import { salvaAzione, runSync } from './sync';
import { toBaseSopralluogo, type SopralluogoConContesto } from './sopralluoghi';
import {
  newId,
  type Azione, type AzioneTipo, type AzioneResponsabile, type AzionePriorita,
  type ChecklistCompilata, type EsitoVoce, type Sopralluogo, type SopralluogoStato,
} from './types';

// Voce in compilazione = esito + il flag calendarizzabile (che vive nel
// template, non in esito_voce; lo recuperiamo e lo teniamo in cache locale).
export interface VoceCompilazione extends EsitoVoce {
  calendarizzabile: boolean;
}

export interface DatiCompilazione {
  compilataId: string;
  voci: VoceCompilazione[];
}

const toEsito = (v: VoceCompilazione): EsitoVoce => {
  const { calendarizzabile: _c, ...e } = v;
  return e;
};

// ---- cache "calendarizzabile per ordine" (per il resume offline) ----
const chiaveCal = (id: string) => `cal:${id}`;
function scriviCacheCal(id: string, mappa: Record<number, boolean>) {
  try {
    localStorage.setItem(chiaveCal(id), JSON.stringify(mappa));
  } catch {
    /* ignora */
  }
}
function leggiCacheCal(id: string): Record<number, boolean> {
  try {
    const raw = localStorage.getItem(chiaveCal(id));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// ---- template attivo per tipo attività ----
async function caricaTemplateAttivo(tipoAttivita: string) {
  const { data, error } = await supabase
    .from('checklist_template')
    .select(`
      id, versione,
      voci:voce_template ( sezione, ordine, testo_requisito, calendarizzabile )
    `)
    .eq('tipo_attivita', tipoAttivita)
    .eq('stato', 'attivo')
    .order('versione', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as
    | {
        id: string; versione: number;
        voci: Array<{
          sezione: string | null; ordine: number;
          testo_requisito: string; calendarizzabile: boolean;
        }>;
      }
    | null;
}

// ---- esiti esistenti (resume): server + locale, con locale che vince ----
async function caricaVociEsistenti(c: ChecklistCompilata): Promise<VoceCompilazione[]> {
  let server: EsitoVoce[] = [];
  try {
    const { data } = await supabase
      .from('esito_voce')
      .select('id, checklist_compilata_id, voce_testo, voce_sezione, ordine, stato, note, genera_azione')
      .eq('checklist_compilata_id', c.id);
    server = (data ?? []) as EsitoVoce[];
    if (server.length) await db.esiti.bulkPut(server);
  } catch {
    /* offline */
  }

  const locali = await db.esiti.where('checklist_compilata_id').equals(c.id).toArray();
  const map = new Map<string, EsitoVoce>();
  for (const e of server) map.set(e.id, e);
  for (const e of locali) map.set(e.id, e); // mutazioni locali non sincronizzate

  // calendarizzabile: cache locale, arricchita dal template se c'è rete
  let cal = leggiCacheCal(c.id);
  try {
    const { data } = await supabase
      .from('voce_template')
      .select('ordine, calendarizzabile')
      .eq('template_id', c.template_id);
    if (data && data.length) {
      cal = {};
      for (const v of data as any[]) cal[v.ordine] = v.calendarizzabile;
      scriviCacheCal(c.id, cal);
    }
  } catch {
    /* offline: uso la cache */
  }

  return [...map.values()]
    .sort((a, b) => a.ordine - b.ordine)
    .map((e) => ({ ...e, calendarizzabile: cal[e.ordine] ?? false }));
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
    } catch {
      /* offline */
    }
  }

  // 2a) riprendi
  if (compilata) {
    return { compilataId: compilata.id, voci: await caricaVociEsistenti(compilata) };
  }

  // 2b) nuova: serve il template (richiede rete almeno una volta)
  if (!sopralluogo.tipo_attivita) {
    throw new Error('Tipo attività sconosciuto: impossibile scegliere la checklist.');
  }
  const tmpl = await caricaTemplateAttivo(sopralluogo.tipo_attivita);
  if (!tmpl) {
    throw new Error(`Nessuna checklist attiva per "${sopralluogo.tipo_attivita}".`);
  }

  compilata = {
    id: newId(),
    sopralluogo_id: soprId,
    template_id: tmpl.id,
    template_versione: tmpl.versione,
    data_compilazione: new Date().toISOString(),
  };
  const tVoci = [...(tmpl.voci ?? [])].sort((a, b) => a.ordine - b.ordine);
  const voci: VoceCompilazione[] = tVoci.map((v) => ({
    id: newId(),
    checklist_compilata_id: compilata!.id,
    voce_testo: v.testo_requisito,
    voce_sezione: v.sezione,
    ordine: v.ordine,
    stato: null,
    note: null,
    genera_azione: false,
    calendarizzabile: v.calendarizzabile,
  }));

  // persisti compilata + esiti (locale + coda)
  await db.compilate.put(compilata);
  await enqueueRow('checklist_compilata', compilata as unknown as Record<string, unknown>);
  await db.esiti.bulkPut(voci.map(toEsito));
  for (const v of voci) {
    await enqueueRow('esito_voce', toEsito(v) as unknown as Record<string, unknown>);
  }
  scriviCacheCal(
    compilata.id,
    Object.fromEntries(voci.map((v) => [v.ordine, v.calendarizzabile])),
  );

  await avviaSopralluogo(sopralluogo);
  void runSync();

  return { compilataId: compilata.id, voci };
}

// ---- azione generata da una voce (idempotente per esito+tipo) ----
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
}

export async function generaAzione(i: InputAzione): Promise<Azione> {
  // riusa l'eventuale azione già creata per (esito, tipo): niente doppioni
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
    werp_attivita_id: null,
  };
  await salvaAzione(azione); // locale + coda + runSync
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
