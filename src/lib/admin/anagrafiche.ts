// Strato dati del back-office · anagrafiche (clienti + incarichi).
//
// Online-first come il resto del back-office: parla direttamente con Supabase
// (niente coda offline come nel campo). È il blocco a monte del flusso:
//   cliente → incarico → (Pianificazione) sopralluoghi → (campo) compilazione.
//
// Vincoli ereditati dallo schema (001_init.sql):
//  * cliente.werp_id e incarico.werp_id sono UNIQUE → l'empty string va salvata
//    come NULL (qui normalizzata da `vuotoNull`), altrimenti due record "senza
//    werp" collidono.
//  * incarico.n_sopralluoghi > 0 ; incarico.periodo_fine >= incarico.periodo_inizio.
//  * cliente referenziato da incarico con ON DELETE RESTRICT, e incarico da
//    sopralluogo con ON DELETE RESTRICT → l'eliminazione è consentita solo se
//    non ci sono figli (altrimenti si archivia/sospende).

import { supabase } from '../supabase';
import {
  newId, type Cliente, type Incarico, type IncaricoStato,
} from '../types';

const COLONNE_CLIENTE =
  'id, werp_id, ragione_sociale, localita, indirizzo, lat, lng, attivo';
const COLONNE_INCARICO =
  'id, cliente_id, werp_id, tipo_attivita, n_sopralluoghi, periodo_inizio, ' +
  'periodo_fine, durata_seduta_stimata_min, stato';

const vuotoNull = (s: string | null | undefined): string | null => {
  const v = (s ?? '').trim();
  return v === '' ? null : v;
};

// ============================ CLIENTI ============================

export interface ClienteRiga {
  cliente: Cliente;
  n_incarichi: number;
  n_incarichi_attivi: number;
}

export async function caricaClienti(): Promise<ClienteRiga[]> {
  const { data: cli, error } = await supabase
    .from('cliente')
    .select(COLONNE_CLIENTE)
    .order('ragione_sociale', { ascending: true });
  if (error) throw error;

  const { data: inc } = await supabase
    .from('incarico').select('cliente_id, stato');
  const tot = new Map<string, number>();
  const att = new Map<string, number>();
  for (const r of (inc ?? []) as { cliente_id: string; stato: IncaricoStato }[]) {
    tot.set(r.cliente_id, (tot.get(r.cliente_id) ?? 0) + 1);
    if (r.stato === 'attivo') att.set(r.cliente_id, (att.get(r.cliente_id) ?? 0) + 1);
  }

  return (cli ?? []).map((c: any): ClienteRiga => ({
    cliente: c as Cliente,
    n_incarichi: tot.get(c.id) ?? 0,
    n_incarichi_attivi: att.get(c.id) ?? 0,
  }));
}

// Upsert per id (gli id sono generati lato client, come nel resto dell'app).
export async function salvaCliente(c: Cliente): Promise<void> {
  const { error } = await supabase.from('cliente').upsert({
    id: c.id,
    werp_id: vuotoNull(c.werp_id),
    ragione_sociale: c.ragione_sociale.trim(),
    localita: vuotoNull(c.localita),
    indirizzo: vuotoNull(c.indirizzo),
    lat: c.lat,
    lng: c.lng,
    attivo: c.attivo,
  }, { onConflict: 'id' });
  if (error) throw error;
}

export async function impostaStatoCliente(id: string, attivo: boolean): Promise<void> {
  const { error } = await supabase.from('cliente').update({ attivo }).eq('id', id);
  if (error) throw error;
}

// Eliminabile solo se non ha incarichi (FK ON DELETE RESTRICT). In caso
// contrario si disattiva (soft) tramite `attivo`.
export async function eliminaCliente(id: string): Promise<void> {
  const { count } = await supabase
    .from('incarico').select('id', { count: 'exact', head: true }).eq('cliente_id', id);
  if ((count ?? 0) > 0) {
    throw new Error('Il cliente ha incarichi collegati: disattivalo invece di eliminarlo.');
  }
  const { error } = await supabase.from('cliente').delete().eq('id', id);
  if (error) throw error;
}

export function clienteVuoto(): Cliente {
  return {
    id: newId(), werp_id: null, ragione_sociale: '', localita: null,
    indirizzo: null, lat: null, lng: null, attivo: true,
  };
}

// =========================== INCARICHI ===========================

export interface IncaricoRiga {
  incarico: Incarico;
  creati: number;     // righe sopralluogo esistenti
}

export async function caricaIncarichiCliente(clienteId: string): Promise<IncaricoRiga[]> {
  const { data: inc, error } = await supabase
    .from('incarico').select(COLONNE_INCARICO)
    .eq('cliente_id', clienteId)
    .order('stato', { ascending: true })
    .order('periodo_inizio', { ascending: false });
  if (error) throw error;

  const ids = (inc ?? []).map((r: any) => r.id);
  const creati = new Map<string, number>();
  if (ids.length) {
    const { data: sopr } = await supabase
      .from('sopralluogo').select('incarico_id').in('incarico_id', ids);
    for (const s of (sopr ?? []) as { incarico_id: string }[]) {
      creati.set(s.incarico_id, (creati.get(s.incarico_id) ?? 0) + 1);
    }
  }

  return (inc ?? []).map((r: any): IncaricoRiga => ({
    incarico: r as Incarico,
    creati: creati.get(r.id) ?? 0,
  }));
}

export async function salvaIncarico(i: Incarico): Promise<void> {
  const tipo = i.tipo_attivita.trim();
  if (!tipo) throw new Error('Indica il tipo di attività.');
  if (!Number.isFinite(i.n_sopralluoghi) || i.n_sopralluoghi <= 0) {
    throw new Error('Il numero di sopralluoghi deve essere maggiore di zero.');
  }
  if (!i.periodo_inizio || !i.periodo_fine) {
    throw new Error('Indica inizio e fine del periodo.');
  }
  if (i.periodo_fine < i.periodo_inizio) {
    throw new Error('La fine del periodo non può precedere l’inizio.');
  }

  const { error } = await supabase.from('incarico').upsert({
    id: i.id,
    cliente_id: i.cliente_id,
    werp_id: vuotoNull(i.werp_id),
    tipo_attivita: tipo,
    n_sopralluoghi: i.n_sopralluoghi,
    periodo_inizio: i.periodo_inizio,
    periodo_fine: i.periodo_fine,
    durata_seduta_stimata_min: i.durata_seduta_stimata_min,
    stato: i.stato,
  }, { onConflict: 'id' });
  if (error) throw error;
}

export async function impostaStatoIncarico(id: string, stato: IncaricoStato): Promise<void> {
  const { error } = await supabase.from('incarico').update({ stato }).eq('id', id);
  if (error) throw error;
}

// Eliminabile solo se non sono ancora stati generati sopralluoghi
// (FK ON DELETE RESTRICT). Altrimenti si chiude/sospende.
export async function eliminaIncarico(id: string): Promise<void> {
  const { count } = await supabase
    .from('sopralluogo').select('id', { count: 'exact', head: true }).eq('incarico_id', id);
  if ((count ?? 0) > 0) {
    throw new Error('L’incarico ha già sopralluoghi: chiudilo invece di eliminarlo.');
  }
  const { error } = await supabase.from('incarico').delete().eq('id', id);
  if (error) throw error;
}

export function incaricoVuoto(clienteId: string): Incarico {
  const oggi = new Date();
  const traUnAnno = new Date(oggi);
  traUnAnno.setFullYear(oggi.getFullYear() + 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    id: newId(), cliente_id: clienteId, werp_id: null, tipo_attivita: '',
    n_sopralluoghi: 1, periodo_inizio: iso(oggi), periodo_fine: iso(traUnAnno),
    durata_seduta_stimata_min: 180, stato: 'attivo',
  };
}

// Tipi di attività già coperti da un template attivo: servono ad allineare
// incarico.tipo_attivita con un template, così Pianificazione → Compilazione
// trova la checklist giusta. Si offrono come suggerimenti, non come vincolo.
export async function tipiAttivitaSuggeriti(): Promise<string[]> {
  const { data, error } = await supabase
    .from('checklist_template').select('tipo_attivita').eq('stato', 'attivo');
  if (error) throw error;
  const set = new Set<string>();
  for (const r of (data ?? []) as { tipo_attivita: string }[]) set.add(r.tipo_attivita);
  return [...set].sort((a, b) => a.localeCompare(b));
}
