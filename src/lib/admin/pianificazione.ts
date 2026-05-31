// Strato dati del back-office · pianificazione dei sopralluoghi.
//
// Online-first (scrivania). Dall'incarico (cliente, tipo attività, quanti
// sopralluoghi, periodo, durata stimata) si generano e si assegnano le righe
// `sopralluogo`: tecnico, data pianificata, durata, località, progressivo.
// Si toccano SOLO i sopralluoghi ancora 'pianificato' (non avviati in campo).

import { supabase } from '../supabase';
import { distribuisciDate } from './calendario';
import { newId, type Incarico, type Sopralluogo, type Tecnico } from '../types';

const COLONNE_SOPRALLUOGO =
  'id, incarico_id, progressivo, tecnico_id, data_pianificata, data_effettiva, ' +
  'durata_stimata_min, durata_effettiva_min, localita, stato, werp_attivita_id';

const uno = <T,>(v: T | T[] | null | undefined): T | undefined =>
  Array.isArray(v) ? v[0] : (v ?? undefined);

// ---- elenco incarichi con avanzamento pianificazione ----
export interface IncaricoPiano {
  incarico: Incarico;
  cliente_nome: string;
  cliente_localita: string | null;
  totale_previsti: number;   // incarico.n_sopralluoghi
  creati: number;            // righe sopralluogo esistenti
  assegnati: number;         // con tecnico E data pianificata
}

export async function caricaIncarichi(): Promise<IncaricoPiano[]> {
  const { data: inc, error } = await supabase
    .from('incarico')
    .select(`
      id, cliente_id, werp_id, tipo_attivita, n_sopralluoghi,
      periodo_inizio, periodo_fine, durata_seduta_stimata_min, stato,
      cliente:cliente!cliente_id ( ragione_sociale, localita )
    `)
    .order('stato', { ascending: true })
    .order('periodo_inizio', { ascending: true });
  if (error) throw error;

  const { data: sopr } = await supabase
    .from('sopralluogo').select('incarico_id, tecnico_id, data_pianificata');
  const creati = new Map<string, number>();
  const assegnati = new Map<string, number>();
  for (const s of (sopr ?? []) as any[]) {
    creati.set(s.incarico_id, (creati.get(s.incarico_id) ?? 0) + 1);
    if (s.tecnico_id && s.data_pianificata) {
      assegnati.set(s.incarico_id, (assegnati.get(s.incarico_id) ?? 0) + 1);
    }
  }

  return (inc ?? []).map((r: any): IncaricoPiano => {
    const cli = uno<any>(r.cliente);
    const { cliente, ...incarico } = r;
    void cliente;
    return {
      incarico: incarico as Incarico,
      cliente_nome: cli?.ragione_sociale ?? '—',
      cliente_localita: cli?.localita ?? null,
      totale_previsti: r.n_sopralluoghi,
      creati: creati.get(r.id) ?? 0,
      assegnati: assegnati.get(r.id) ?? 0,
    };
  });
}

// ---- dettaglio piano di un incarico ----
export interface PianoIncarico {
  incarico: Incarico;
  cliente_nome: string;
  cliente_localita: string | null;
  cliente_indirizzo: string | null;
  sopralluoghi: Sopralluogo[];
}

export async function caricaPiano(incaricoId: string): Promise<PianoIncarico> {
  const { data: inc, error: e1 } = await supabase
    .from('incarico')
    .select(`
      id, cliente_id, werp_id, tipo_attivita, n_sopralluoghi,
      periodo_inizio, periodo_fine, durata_seduta_stimata_min, stato,
      cliente:cliente!cliente_id ( ragione_sociale, localita, indirizzo )
    `)
    .eq('id', incaricoId).maybeSingle();
  if (e1) throw e1;
  if (!inc) throw new Error('Incarico non trovato.');

  const { data: sopr, error: e2 } = await supabase
    .from('sopralluogo').select(COLONNE_SOPRALLUOGO)
    .eq('incarico_id', incaricoId)
    .order('progressivo', { ascending: true });
  if (e2) throw e2;

  const cli = uno<any>((inc as any).cliente);
  const { cliente, ...incarico } = inc as any;
  void cliente;
  return {
    incarico: incarico as Incarico,
    cliente_nome: cli?.ragione_sociale ?? '—',
    cliente_localita: cli?.localita ?? null,
    cliente_indirizzo: cli?.indirizzo ?? null,
    sopralluoghi: (sopr ?? []) as unknown as Sopralluogo[],
  };
}

// ---- genera i sopralluoghi mancanti fino a n_sopralluoghi ----
// Le sedute vengono numerate per posizione (k/N) e ricevono una DATA PROPOSTA
// distribuita uniformemente nel periodo dell'incarico, evitando weekend e
// festività nazionali (vedi calendario.ts). Le date restano modificabili a
// mano. La proposta è calcolata sulle posizioni 1..N, così la seduta k ha
// sempre la stessa data anche rigenerando dopo aver eliminato le ultime.
export async function generaSopralluoghiMancanti(piano: PianoIncarico): Promise<Sopralluogo[]> {
  const { incarico, cliente_localita } = piano;
  const esistenti = piano.sopralluoghi.length;
  const mancano = incarico.n_sopralluoghi - esistenti;
  if (mancano <= 0) return [];

  const dateProposte = distribuisciDate(
    incarico.periodo_inizio, incarico.periodo_fine, incarico.n_sopralluoghi,
  );

  const nuovi: Sopralluogo[] = [];
  for (let k = esistenti + 1; k <= incarico.n_sopralluoghi; k++) {
    nuovi.push({
      id: newId(),
      incarico_id: incarico.id,
      progressivo: `${k}/${incarico.n_sopralluoghi}`,
      tecnico_id: null,
      data_pianificata: dateProposte[k - 1] ?? null,
      data_effettiva: null,
      durata_stimata_min: incarico.durata_seduta_stimata_min,
      durata_effettiva_min: null,
      localita: cliente_localita,
      stato: 'pianificato',
      werp_attivita_id: null,
    });
  }
  const { error } = await supabase.from('sopralluogo').insert(
    nuovi.map((s) => ({
      id: s.id, incarico_id: s.incarico_id, progressivo: s.progressivo,
      tecnico_id: s.tecnico_id, data_pianificata: s.data_pianificata,
      durata_stimata_min: s.durata_stimata_min, localita: s.localita, stato: s.stato,
    })),
  );
  if (error) throw error;
  return nuovi;
}

// ---- salva l'assegnazione di un singolo sopralluogo (solo pianificato) ----
export async function salvaSopralluogo(s: Sopralluogo): Promise<void> {
  const { error } = await supabase.from('sopralluogo').upsert({
    id: s.id,
    incarico_id: s.incarico_id,
    progressivo: s.progressivo,
    tecnico_id: s.tecnico_id,
    data_pianificata: s.data_pianificata,
    durata_stimata_min: s.durata_stimata_min,
    localita: s.localita,
    stato: s.stato,
  }, { onConflict: 'id' });
  if (error) throw error;
}

// ---- elimina un sopralluogo pianificato e non ancora compilato ----
export async function eliminaSopralluogo(id: string): Promise<void> {
  const { count } = await supabase
    .from('checklist_compilata').select('id', { count: 'exact', head: true })
    .eq('sopralluogo_id', id);
  if ((count ?? 0) > 0) {
    throw new Error('Il sopralluogo ha già una compilazione: non eliminabile.');
  }
  const { error } = await supabase
    .from('sopralluogo').delete().eq('id', id).eq('stato', 'pianificato');
  if (error) throw error;
}

// ---- tecnici assegnabili ----
export async function caricaTecnici(): Promise<Tecnico[]> {
  const { data, error } = await supabase
    .from('tecnico')
    .select('id, user_id, nome, base_localita, base_lat, base_lng, calendario_ref, capienza_ore_settimana, attivo, ruolo')
    .eq('attivo', true)
    .order('nome', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Tecnico[];
}
