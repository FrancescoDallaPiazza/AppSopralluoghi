// Revisioni (snapshot) dell'organigramma sicurezza, per cliente.
//
// Obiettivo (Parte 3): tenere una storia versionata dell'organigramma. Ogni
// modifica congela uno snapshot completo (figure + incaricati + stato + ruoli
// scoperti) e una "firma" dei soli fatti che lo definiscono. Una nuova revisione
// nasce solo se la firma e' cambiata rispetto all'ultima (dedup): aprire la
// scheda o ri-salvare senza variazioni non crea revisioni a vuoto.
//
// Due percorsi condividono la tabella `organigramma_revisione` (migration 027):
//  - BACK-OFFICE (online): `registraSnapshotOrganigramma` ricarica i dati dal
//    server, assembla il riepilogo con la PURA `assemblaRiepilogo` (la stessa
//    dell'app) e fa dedup lato server confrontando la firma con l'ultima.
//  - CAMPO (offline): la conferma organigramma costruisce la riga dallo stato
//    LOCALE gia' valutato e la accoda (vedi sync.ts); il progressivo `numero`
//    arriva null e viene assegnato dal trigger lato DB.
//
// Lo snapshot e' gia' "pronto da rendere": il PDF (Edge Function organigramma-pdf)
// e la vista storico leggono questa stessa struttura senza ricalcolare nulla.

import { supabase } from '../supabase';
import {
  assemblaRiepilogo, caricaDatiOrganigramma,
  type Catalogo, type RiepilogoCliente, type ConteggiStato,
  type StatoRequisito, type LivelloRischio, type DatiOrganigramma,
} from './formazione';

// ============================ TIPI SNAPSHOT ============================

export interface SnapshotPersona {
  nome: string;
  mansione: string | null;
  reparto: string | null;
  stato: StatoRequisito;
  figure: { codice: string; nome: string }[];
  requisiti: { corso_nome: string; stato: StatoRequisito; dettaglio: string; scadenza: string | null }[];
  moduli: { corso_nome: string; stato: StatoRequisito; dettaglio: string }[];
}

export interface SnapshotOrganigramma {
  cliente_id: string;
  cliente_nome: string;
  livello_rischio: LivelloRischio | null;
  generato_il: string;                 // ISO
  conteggi: ConteggiStato;
  figure_scoperte: { codice: string; nome: string; obbligo: string | null }[];
  persone: SnapshotPersona[];
}

// Riga della tabella organigramma_revisione (storia).
export interface RevisioneOrganigramma {
  id: string;
  cliente_id: string;
  numero: number | null;
  creata_il: string;
  autore: string | null;
  autore_tecnico_id: string | null;
  origine: string;
  firma: string;
  snapshot: SnapshotOrganigramma;
}

// ============================ FUNZIONI PURE ============================

// Costruisce lo snapshot "renderizzabile" a partire da un riepilogo gia'
// valutato. Compatto: tiene solo cio' che serve a storia e PDF (figure, nomi,
// stato, dettaglio, scadenza). I moduli esonerati sono omessi (come nell'UI).
export function costruisciSnapshot(
  riep: RiepilogoCliente,
  clienteNome: string,
  generatoIl?: string,
): SnapshotOrganigramma {
  return {
    cliente_id: riep.cliente_id,
    cliente_nome: clienteNome,
    livello_rischio: riep.livello_rischio,
    generato_il: generatoIl ?? new Date().toISOString(),
    conteggi: { ...riep.conteggi },
    figure_scoperte: riep.figureScoperte.map((f) => ({
      codice: f.codice, nome: f.nome, obbligo: f.obbligo ?? null,
    })),
    persone: riep.persone.map((pv) => ({
      nome: nomeDa(pv.persona),
      mansione: pv.persona.mansione,
      reparto: pv.persona.reparto,
      stato: pv.stato,
      figure: pv.figure.map((f) => ({ codice: f.codice, nome: f.nome })),
      requisiti: pv.requisiti.map((r) => ({
        corso_nome: r.corso_nome, stato: r.stato, dettaglio: r.dettaglio, scadenza: r.scadenza,
      })),
      moduli: pv.moduli
        .filter((m) => m.stato !== 'esonerato')
        .map((m) => ({ corso_nome: m.corso_nome, stato: m.stato, dettaglio: m.dettaglio })),
    })),
  };
}

function nomeDa(p: { nome?: string | null; cognome?: string | null }): string {
  const n = (p.nome ?? '').trim();
  const c = (p.cognome ?? '').trim();
  return [n, c].filter(Boolean).join(' ') || 'Persona';
}

// Firma deterministica dei SOLI fatti che definiscono l'organigramma: due stati
// con la stessa firma sono equivalenti ai fini della storia. Volutamente NON
// include lo stato calcolato (che dipende dalla data odierna): cosi' lo scorrere
// del tempo da solo non genera revisioni; solo una modifica reale lo fa. Include
// tutte le persone (anche disattivate) per cogliere l'attivazione/disattivazione.
export function firmaOrganigramma(
  dati: DatiOrganigramma,
  rischio: LivelloRischio | null,
  rlsTerritoriale = false,
): string {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  const persone = [...dati.persone].sort(byId).map((p) => [
    p.id, p.nome, p.cognome, p.mansione, p.reparto, p.livello_rischio, p.attivo, p.formazione_pregressa,
  ]);
  const nomine = [...dati.nomine].sort(byId).map((n) => [n.persona_id, n.figura_codice, n.attiva]);
  const formazioni = [...dati.formazioni].sort(byId).map((f) => [
    f.persona_id, f.corso_codice, f.corso_nome, f.data_completamento, f.ore,
    f.ente_formatore, f.is_aggiornamento, f.scadenza, f.allegato_url ? 1 : 0,
  ]);
  const esoneri = [...dati.esoneri].sort(byId).map((e) => [
    e.persona_id, e.corso_codice, e.figura_codice, e.tipo, e.attivo, e.motivazione, e.riferimento_norm,
  ]);
  return JSON.stringify({ rischio, rlsTerritoriale, persone, nomine, formazioni, esoneri });
}

// ============================ DATA-ACCESS (online) ============================

export interface EsitoSnapshot { creata: boolean; numero: number | null; }

// Snapshot automatico del back-office: ricarica i dati del cliente, assembla il
// riepilogo, calcola la firma e crea una revisione SOLO se la firma e' cambiata
// rispetto all'ultima. Non solleva sull'UI: chi chiama puo' ignorare l'errore
// (uno snapshot mancato non deve bloccare il salvataggio del dato).
export async function registraSnapshotOrganigramma(
  clienteId: string,
  opts: {
    catalogo: Catalogo;
    clienteNome: string;
    autore?: string | null;
    autoreTecnicoId?: string | null;
    origine?: string;
  },
): Promise<EsitoSnapshot> {
  const { rischio, rlsTerritoriale, livAntincendio, gruppoPS, dati } = await caricaDatiOrganigramma(clienteId);
  const riep = assemblaRiepilogo(clienteId, rischio, dati, opts.catalogo, { rlsTerritoriale, livAntincendio, gruppoPS });
  const firma = firmaOrganigramma(dati, rischio, rlsTerritoriale);

  const ultima = await supabase
    .from('organigramma_revisione')
    .select('firma')
    .eq('cliente_id', clienteId)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ultima.error && ultima.data && (ultima.data as { firma?: string }).firma === firma) {
    return { creata: false, numero: null };
  }

  let autore = opts.autore ?? null;
  if (!autore) {
    try {
      const u = await supabase.auth.getUser();
      autore = u.data.user?.email ?? null;
    } catch { /* anonimo */ }
  }

  const snapshot = costruisciSnapshot(riep, opts.clienteNome);
  // `numero` omesso di proposito: lo assegna il trigger lato DB.
  const riga = {
    cliente_id: clienteId,
    creata_il: snapshot.generato_il,
    autore,
    autore_tecnico_id: opts.autoreTecnicoId ?? null,
    origine: opts.origine ?? 'back-office',
    firma,
    snapshot,
  };
  const ins = await supabase
    .from('organigramma_revisione')
    .insert(riga)
    .select('numero')
    .single();
  if (ins.error) throw ins.error;
  return { creata: true, numero: (ins.data as { numero?: number | null }).numero ?? null };
}

// Storia delle revisioni di un cliente (piu' recente prima). Snapshot escluso
// dall'elenco per leggerezza: si carica on-demand con caricaRevisioneOrganigramma.
export async function caricaRevisioniOrganigramma(clienteId: string): Promise<RevisioneOrganigramma[]> {
  const { data, error } = await supabase
    .from('organigramma_revisione')
    .select('id, cliente_id, numero, creata_il, autore, autore_tecnico_id, origine, firma')
    .eq('cliente_id', clienteId)
    .order('numero', { ascending: false });
  if (error) throw error;
  // snapshot non selezionato: si valorizza vuoto, caricato a parte quando serve.
  return (data ?? []).map((r) => ({ ...(r as object), snapshot: undefined } as unknown as RevisioneOrganigramma));
}

// Una singola revisione, snapshot incluso (per la vista di dettaglio).
export async function caricaRevisioneOrganigramma(id: string): Promise<RevisioneOrganigramma> {
  const { data, error } = await supabase
    .from('organigramma_revisione')
    .select('id, cliente_id, numero, creata_il, autore, autore_tecnico_id, origine, firma, snapshot')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as RevisioneOrganigramma;
}

// ============================ PDF (Edge Function) ============================

// Esporta il riassunto dell'organigramma in PDF via Edge Function
// `organigramma-pdf`. Due modalita':
//  - snapshot corrente: si passa `riepilogo` (gia' valutato lato client) +
//    cliente_nome; la funzione lo rende fedelmente.
//  - revisione storica: si passa `revisione_id`; la funzione legge lo snapshot
//    archiviato dal DB.
// Ritorna l'URL firmato dell'artefatto (PDF, o HTML se PDFBolt non e'
// configurato lato server, come per i report).
export async function esportaPdfOrganigramma(
  arg:
    | { riepilogo: SnapshotOrganigramma }
    | { revisione_id: string },
): Promise<string> {
  const body = 'riepilogo' in arg
    ? { riepilogo: arg.riepilogo }
    : { revisione_id: arg.revisione_id };
  const { data, error } = await supabase.functions.invoke('organigramma-pdf', { body });
  if (error) throw error;
  const d = data as { url?: string; error?: string };
  if (!d?.url) throw new Error(d?.error ?? 'PDF non generato.');
  return d.url;
}
