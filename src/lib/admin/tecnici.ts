// Strato dati del back-office · tecnici.
//
// Gestisce l'ANAGRAFICA del tecnico (nome, base geografica, capienza oraria,
// ruolo, attivo). NON crea account di login: la riga in auth.users nasce quando
// la persona si registra/viene invitata in Supabase; qui si può solo COLLEGARE
// un tecnico a un user_id già esistente (campo opzionale).
//
// Vincoli dallo schema:
//  * tecnico.user_id è UNIQUE e nullable → empty string va salvata come NULL,
//    e due tecnici non possono condividere lo stesso user_id.
//  * ruolo ∈ {tecnico, admin} (migration 006).
//  * capienza_ore_settimana è numeric(5,1) → ammette i decimali (es. 37.5).
//  * tecnico è referenziato da sopralluogo.tecnico_id e azione con ON DELETE
//    RESTRICT → niente eliminazione se ci sono assegnazioni; si disattiva.

import { supabase } from '../supabase';
import { newId, type Tecnico, type RuoloTecnico } from '../types';

const COLONNE_TECNICO =
  'id, user_id, nome, base_localita, base_lat, base_lng, calendario_ref, ' +
  'capienza_ore_settimana, attivo, ruolo';

const vuotoNull = (s: string | null | undefined): string | null => {
  const v = (s ?? '').trim();
  return v === '' ? null : v;
};

export interface TecnicoRiga {
  tecnico: Tecnico;
  assegnati: number;       // sopralluoghi con questo tecnico
}

export async function caricaTecniciTutti(): Promise<TecnicoRiga[]> {
  const { data, error } = await supabase
    .from('tecnico').select(COLONNE_TECNICO)
    .order('attivo', { ascending: false })
    .order('nome', { ascending: true });
  if (error) throw error;

  const { data: sopr } = await supabase
    .from('sopralluogo').select('tecnico_id').not('tecnico_id', 'is', null);
  const conteggio = new Map<string, number>();
  for (const s of (sopr ?? []) as { tecnico_id: string }[]) {
    conteggio.set(s.tecnico_id, (conteggio.get(s.tecnico_id) ?? 0) + 1);
  }

  return (data ?? []).map((t: any): TecnicoRiga => ({
    tecnico: t as Tecnico,
    assegnati: conteggio.get(t.id) ?? 0,
  }));
}

export async function salvaTecnico(t: Tecnico): Promise<void> {
  const nome = t.nome.trim();
  if (!nome) throw new Error('Il nome del tecnico è obbligatorio.');
  if (t.capienza_ore_settimana != null &&
      (!Number.isFinite(t.capienza_ore_settimana) || t.capienza_ore_settimana < 0)) {
    throw new Error('La capienza settimanale non è valida.');
  }

  const { error } = await supabase.from('tecnico').upsert({
    id: t.id,
    user_id: vuotoNull(t.user_id),
    nome,
    base_localita: vuotoNull(t.base_localita),
    base_lat: t.base_lat,
    base_lng: t.base_lng,
    calendario_ref: vuotoNull(t.calendario_ref),
    capienza_ore_settimana: t.capienza_ore_settimana,
    attivo: t.attivo,
    ruolo: t.ruolo,
  }, { onConflict: 'id' });
  if (error) {
    // messaggio più chiaro sul conflitto di user_id (UNIQUE)
    if ((error as any)?.code === '23505') {
      throw new Error('Questo account di login (user_id) è già collegato a un altro tecnico.');
    }
    throw error;
  }
}

export async function impostaStatoTecnico(id: string, attivo: boolean): Promise<void> {
  const { error } = await supabase.from('tecnico').update({ attivo }).eq('id', id);
  if (error) throw error;
}

// Eliminabile solo se non ha sopralluoghi assegnati (FK ON DELETE RESTRICT).
export async function eliminaTecnico(id: string): Promise<void> {
  const { count } = await supabase
    .from('sopralluogo').select('id', { count: 'exact', head: true }).eq('tecnico_id', id);
  if ((count ?? 0) > 0) {
    throw new Error('Il tecnico ha sopralluoghi assegnati: disattivalo invece di eliminarlo.');
  }
  const { error } = await supabase.from('tecnico').delete().eq('id', id);
  if (error) throw error;
}

export function tecnicoVuoto(): Tecnico {
  return {
    id: newId(), user_id: null, nome: '',
    base_localita: null, base_lat: null, base_lng: null,
    calendario_ref: null, capienza_ore_settimana: 40, attivo: true,
    ruolo: 'tecnico' as RuoloTecnico,
  };
}
