// Strato dati della schermata "le mie cose da fare" (utente interno).
//
// Lettura  : le azioni assegnate al tecnico, con il contesto (cliente,
//            sopralluogo, voce d'origine) preso dal server con una join.
// Scrittura: il cambio di stato vive prima in locale + in coda (come tutto il
//            resto dell'app), così funziona anche offline; in più lascia una
//            riga di storico in `aggiornamento_azione`.

import { supabase } from './supabase';
import { db, enqueueRow } from './db';
import { runSync } from './sync';
import { newId, type Azione, type AzioneStato, type AreaInterna } from './types';

// Azione + etichette di contesto per la UI (NON sono colonne di `azione`:
// vanno tolte prima di salvare/upsert, vedi toBaseAzione).
export interface AzioneConContesto extends Azione {
  cliente_nome: string | null;
  sopralluogo_label: string | null;
  origine_voce: string | null;
  area_nome: string | null;
}

// Aree/funzioni interne attive, per i menù di assegnazione.
export async function caricaAreeInterne(): Promise<AreaInterna[]> {
  const { data, error } = await supabase
    .from('area_interna')
    .select('id, nome, email, attiva')
    .eq('attiva', true)
    .order('nome', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AreaInterna[];
}

// Le sole colonne reali della tabella `azione` (allineate a 001_init.sql).
const COLONNE_AZIONE = [
  'id', 'tipo', 'origine_esito_id', 'sopralluogo_origine_id', 'descrizione',
  'responsabile_tipo', 'responsabile_cliente_id', 'responsabile_interno_id',
  'responsabile_area_id',
  'data_scadenza', 'priorita', 'stato', 'sopralluogo_verifica_id',
  'data_verifica', 'periodicita_mesi', 'werp_attivita_id',
] as const;

// Ricava la sola Azione "pulita" (senza i campi di contesto) per upsert/locale.
export function toBaseAzione(a: AzioneConContesto | Azione): Azione {
  const out: Record<string, unknown> = {};
  const src = a as unknown as Record<string, unknown>;
  for (const k of COLONNE_AZIONE) out[k] = k in src ? src[k] : null;
  return out as unknown as Azione;
}

// Carica dal server le azioni assegnate all'utente interno, con il contesto.
// NB: `azione` ha due FK verso `sopralluogo` (origine e verifica), quindi la
// join va disambiguata col nome della colonna FK: sopralluogo!sopralluogo_origine_id.
// Se PostgREST lamenta l'ambiguità, sostituire con il nome del vincolo
// (es. sopralluogo!azione_sopralluogo_origine_id_fkey).
export async function caricaMieAzioni(tecnicoId: string): Promise<AzioneConContesto[]> {
  const { data, error } = await supabase
    .from('azione')
    .select(`
      ${COLONNE_AZIONE.join(', ')},
      origine:esito_voce!origine_esito_id ( voce_testo, voce_sezione ),
      area:area_interna!responsabile_area_id ( nome ),
      sopr:sopralluogo!sopralluogo_origine_id (
        progressivo,
        incarico:incarico!incarico_id (
          tipo_attivita,
          cliente:cliente!cliente_id ( ragione_sociale )
        )
      )
    `)
    .eq('responsabile_tipo', 'risorsa_interna')
    .eq('responsabile_interno_id', tecnicoId);

  if (error) throw error;

  // PostgREST può restituire l'embed come oggetto o (raramente) come array:
  // lo normalizziamo prendendo il primo elemento quando serve.
  const uno = <T,>(v: T | T[] | null | undefined): T | undefined =>
    Array.isArray(v) ? v[0] : (v ?? undefined);

  return (data ?? []).map((r: any): AzioneConContesto => {
    const sopr = uno<any>(r.sopr);
    const inc = uno<any>(sopr?.incarico);
    const cli = uno<any>(inc?.cliente);
    const orig = uno<any>(r.origine);
    const area = uno<any>(r.area);
    const label = sopr
      ? [inc?.tipo_attivita, sopr.progressivo].filter(Boolean).join(' · ') || null
      : null;
    return {
      ...toBaseAzione(r as Azione),
      cliente_nome: cli?.ragione_sociale ?? null,
      sopralluogo_label: label,
      origine_voce: orig?.voce_testo ?? null,
      area_nome: area?.nome ?? null,
    };
  });
}

// Cambia stato a un'azione: scrive in locale + coda (offline-safe) e accoda
// una riga di storico. La UI, in ascolto su Dexie, si aggiorna da sola.
export async function cambiaStatoAzione(
  azione: Azione | AzioneConContesto,
  nuovoStato: AzioneStato,
  opts?: { nota?: string; autoreId?: string | null },
): Promise<void> {
  const base = toBaseAzione(azione);
  const aggiornata: Azione = { ...base, stato: nuovoStato };

  await db.azioni.put(aggiornata);
  await enqueueRow('azione', aggiornata as unknown as Record<string, unknown>);

  await enqueueRow('aggiornamento_azione', {
    id: newId(),
    azione_id: base.id,
    data: new Date().toISOString(),
    nuovo_stato: nuovoStato,
    nota: opts?.nota?.trim() ? opts.nota.trim() : null,
    autore_id: opts?.autoreId ?? null,
  });

  void runSync();
}

// ---------------------------------------------------------------------------
// Giro precedente: azioni APERTE dei sopralluoghi precedenti dello stesso
// incarico, da verificare/chiudere nel sopralluogo corrente.
//
// NB: il filtro sull'incarico è sull'embed `sopr` (la FK origine), reso
// !inner così funge da filtro. Se PostgREST lamenta l'alias, filtra con il
// nome del vincolo (azione_sopralluogo_origine_id_fkey).
// ---------------------------------------------------------------------------
export async function caricaGiroPrecedente(
  incaricoId: string,
  sopralluogoCorrenteId: string,
): Promise<AzioneConContesto[]> {
  let data: any[] | null = null;
  try {
    const res = await supabase
      .from('azione')
      .select(`
        ${COLONNE_AZIONE.join(', ')},
        origine:esito_voce!origine_esito_id ( voce_testo, voce_sezione ),
        area:area_interna!responsabile_area_id ( nome ),
        sopr:sopralluogo!sopralluogo_origine_id!inner (
          progressivo, incarico_id,
          incarico:incarico!incarico_id (
            tipo_attivita,
            cliente:cliente!cliente_id ( ragione_sociale )
          )
        )
      `)
      .eq('sopr.incarico_id', incaricoId)
      .neq('sopralluogo_origine_id', sopralluogoCorrenteId)
      .neq('stato', 'conclusa');
    if (res.error) throw res.error;
    data = res.data;
  } catch {
    // Offline: ripiego sulle azioni in cache locale, filtrate per incarico
    // tramite i sopralluoghi locali (db.sopralluoghi ha incarico_id).
    return await giroPrecedenteLocale(incaricoId, sopralluogoCorrenteId);
  }

  const uno = <T,>(v: T | T[] | null | undefined): T | undefined =>
    Array.isArray(v) ? v[0] : (v ?? undefined);

  const out = (data ?? []).map((r: any): AzioneConContesto => {
    const sopr = uno<any>(r.sopr);
    const inc = uno<any>(sopr?.incarico);
    const cli = uno<any>(inc?.cliente);
    const orig = uno<any>(r.origine);
    const area = uno<any>(r.area);
    const label = sopr
      ? [inc?.tipo_attivita, sopr.progressivo].filter(Boolean).join(' · ') || null
      : null;
    return {
      ...toBaseAzione(r as Azione),
      cliente_nome: cli?.ragione_sociale ?? null,
      sopralluogo_label: label,
      origine_voce: orig?.voce_testo ?? null,
      area_nome: area?.nome ?? null,
    };
  });

  // semina in locale SENZA sovrascrivere modifiche locali non sincronizzate
  const presenti = new Set(
    (await db.azioni.bulkGet(out.map((o) => o.id)))
      .filter(Boolean)
      .map((a) => (a as Azione).id),
  );
  const daSeminare = out.filter((o) => !presenti.has(o.id)).map(toBaseAzione);
  if (daSeminare.length) await db.azioni.bulkPut(daSeminare);

  return out;
}

// Giro precedente dalla sola cache locale (offline).
async function giroPrecedenteLocale(
  incaricoId: string,
  sopralluogoCorrenteId: string,
): Promise<AzioneConContesto[]> {
  const sopr = await db.sopralluoghi.where('incarico_id').equals(incaricoId).toArray();
  const idsIncarico = new Set(sopr.map((s) => s.id));
  const azioni = await db.azioni.toArray();
  return azioni
    .filter((a) =>
      a.stato !== 'conclusa' &&
      a.sopralluogo_origine_id != null &&
      idsIncarico.has(a.sopralluogo_origine_id) &&
      a.sopralluogo_origine_id !== sopralluogoCorrenteId)
    .map((a) => ({ ...a, cliente_nome: null, sopralluogo_label: null, origine_voce: null, area_nome: null }));
}

// Prefetch (online): azioni aperte dei sopralluoghi degli incarichi indicati,
// seminate in locale (senza sovrascrivere modifiche non sincronizzate). Serve
// al "giro precedente" offline.
export async function prefetchAzioniIncarichi(incaricoIds: string[]): Promise<number> {
  if (!incaricoIds.length) return 0;
  const { data, error } = await supabase
    .from('azione')
    .select(`
      ${COLONNE_AZIONE.join(', ')},
      sopr:sopralluogo!sopralluogo_origine_id!inner ( incarico_id )
    `)
    .in('sopr.incarico_id', incaricoIds)
    .neq('stato', 'conclusa');
  if (error) throw error;

  const out = (data ?? []).map((r: any) => toBaseAzione(r as Azione));
  const presenti = new Set(
    (await db.azioni.bulkGet(out.map((o) => o.id)))
      .filter(Boolean)
      .map((a) => (a as Azione).id),
  );
  const nuovi = out.filter((o) => !presenti.has(o.id));
  if (nuovi.length) await db.azioni.bulkPut(nuovi);
  return out.length;
}

// Verifica/chiusura di un'azione DENTRO un sopralluogo: la chiude e registra
// dove/quando è stata verificata. Offline-safe (locale + coda + storico).
export async function verificaAzione(
  azione: Azione | AzioneConContesto,
  sopralluogoVerificaId: string,
  opts?: { nota?: string; autoreId?: string | null },
): Promise<void> {
  const base = toBaseAzione(azione);
  const aggiornata: Azione = {
    ...base,
    stato: 'conclusa',
    sopralluogo_verifica_id: sopralluogoVerificaId,
    data_verifica: new Date().toISOString().slice(0, 10), // colonna `date`
  };

  await db.azioni.put(aggiornata);
  await enqueueRow('azione', aggiornata as unknown as Record<string, unknown>);

  await enqueueRow('aggiornamento_azione', {
    id: newId(),
    azione_id: base.id,
    data: new Date().toISOString(),
    nuovo_stato: 'conclusa',
    nota: opts?.nota?.trim() ? opts.nota.trim() : 'Verificata in sopralluogo',
    autore_id: opts?.autoreId ?? null,
  });

  void runSync();
}
