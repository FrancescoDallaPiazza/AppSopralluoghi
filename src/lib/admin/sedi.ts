// Strato dati del back-office per le SEDI di un cliente (migration 029).
// Una societa' puo' avere piu' sedi; l'incarico ne sceglie una di default e il
// sopralluogo la eredita (override possibile in testata di compilazione).
// Online-first (scrivania); l'offline e' coperto da prefetchSediComponenti.

import { supabase } from '../supabase';
import { newId, type Sede } from '../types';

const COLONNE = 'id, cliente_id, nome, indirizzo, attivo';

export async function caricaSedi(clienteId: string): Promise<Sede[]> {
  const { data, error } = await supabase
    .from('sede').select(COLONNE)
    .eq('cliente_id', clienteId)
    .order('attivo', { ascending: false })
    .order('nome', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Sede[];
}

export function sedeVuota(clienteId: string): Sede {
  return { id: newId(), cliente_id: clienteId, nome: '', indirizzo: null, attivo: true };
}

export async function salvaSede(s: Sede): Promise<void> {
  const nome = s.nome.trim();
  if (!nome) throw new Error('Indica il nome della sede.');
  const { error } = await supabase.from('sede').upsert({
    id: s.id, cliente_id: s.cliente_id, nome,
    indirizzo: s.indirizzo?.trim() || null, attivo: s.attivo,
  }, { onConflict: 'id' });
  if (error) throw error;
}

export async function impostaStatoSede(id: string, attivo: boolean): Promise<void> {
  const { error } = await supabase.from('sede').update({ attivo }).eq('id', id);
  if (error) throw error;
}
