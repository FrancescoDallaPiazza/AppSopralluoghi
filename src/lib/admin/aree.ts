// Strato dati del back-office · aree/funzioni interne (Formazione, Preventivi…).
// Online-first. Destinatari delle "cose da fare" interne alternativi al tecnico.

import { supabase } from '../supabase';
import { newId, type AreaInterna } from '../types';

const COLONNE = 'id, nome, email, attiva';

const vuotoNull = (s: string | null | undefined): string | null => {
  const v = (s ?? '').trim();
  return v === '' ? null : v;
};

export interface AreaRiga {
  area: AreaInterna;
  azioni: number;          // cose-da-fare assegnate all'area
}

export async function caricaAree(): Promise<AreaRiga[]> {
  const { data, error } = await supabase
    .from('area_interna').select(COLONNE)
    .order('attiva', { ascending: false })
    .order('nome', { ascending: true });
  if (error) throw error;

  const { data: az } = await supabase
    .from('azione').select('responsabile_area_id').not('responsabile_area_id', 'is', null);
  const conteggio = new Map<string, number>();
  for (const a of (az ?? []) as { responsabile_area_id: string }[]) {
    conteggio.set(a.responsabile_area_id, (conteggio.get(a.responsabile_area_id) ?? 0) + 1);
  }

  return (data ?? []).map((a: any): AreaRiga => ({
    area: a as AreaInterna,
    azioni: conteggio.get(a.id) ?? 0,
  }));
}

export async function salvaArea(a: AreaInterna): Promise<void> {
  const nome = a.nome.trim();
  if (!nome) throw new Error('Il nome dell’area è obbligatorio.');
  const { error } = await supabase.from('area_interna').upsert({
    id: a.id, nome, email: vuotoNull(a.email), attiva: a.attiva,
  }, { onConflict: 'id' });
  if (error) throw error;
}

export async function impostaStatoArea(id: string, attiva: boolean): Promise<void> {
  const { error } = await supabase.from('area_interna').update({ attiva }).eq('id', id);
  if (error) throw error;
}

export async function eliminaArea(id: string): Promise<void> {
  const { count } = await supabase
    .from('azione').select('id', { count: 'exact', head: true }).eq('responsabile_area_id', id);
  if ((count ?? 0) > 0) {
    throw new Error('L’area ha cose-da-fare collegate: disattivala invece di eliminarla.');
  }
  const { error } = await supabase.from('area_interna').delete().eq('id', id);
  if (error) throw error;
}

export function areaVuota(): AreaInterna {
  return { id: newId(), nome: '', email: null, attiva: true };
}
