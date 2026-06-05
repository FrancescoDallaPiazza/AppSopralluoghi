// Strato dati del back-office · tecnici.
//
// Gestisce l'ANAGRAFICA del tecnico (nome, cognome, base geografica, capienza
// oraria, ruolo, attivo). NON crea account di login: l'account nasce via Edge
// Function `invita-tecnico` (o registrazione in Supabase) e qui si collega il
// profilo a un user_id.
//
// Vincoli dallo schema:
//  * tecnico.user_id è UNIQUE e nullable → empty string va salvata come NULL,
//    e due tecnici non possono condividere lo stesso user_id.
//  * ruolo ∈ {tecnico, admin} (migration 006).
//  * cognome è nullable nel DB (migration 010) per retrocompatibilità; il form
//    lo richiede per i nuovi/aggiornati.
//  * capienza_ore_settimana è numeric(5,1) → ammette i decimali (es. 37.5).
//  * tecnico è referenziato da sopralluogo.tecnico_id e azione con ON DELETE
//    RESTRICT → niente eliminazione se ci sono assegnazioni; si disattiva.

import { supabase } from '../supabase';
import { newId, type Tecnico, type RuoloTecnico } from '../types';

const COLONNE_TECNICO =
  'id, user_id, nome, cognome, base_localita, base_lat, base_lng, calendario_ref, ' +
  'capienza_ore_settimana, attivo, ruolo, calendario_token';

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
    .order('cognome', { ascending: true, nullsFirst: false })
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
  const cognome = (t.cognome ?? '').trim();
  if (!nome) throw new Error('Il nome del tecnico è obbligatorio.');
  if (!cognome) throw new Error('Il cognome del tecnico è obbligatorio.');
  if (t.capienza_ore_settimana != null &&
      (!Number.isFinite(t.capienza_ore_settimana) || t.capienza_ore_settimana < 0)) {
    throw new Error('La capienza settimanale non è valida.');
  }

  const { error } = await supabase.from('tecnico').upsert({
    id: t.id,
    user_id: vuotoNull(t.user_id),
    nome,
    cognome,
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
    id: newId(), user_id: null, nome: '', cognome: null,
    base_localita: null, base_lat: null, base_lng: null,
    calendario_ref: null, capienza_ore_settimana: 40, attivo: true,
    ruolo: 'tecnico' as RuoloTecnico,
  };
}

// Rilegge dal server il `calendario_token` del tecnico (DEFAULT gen_random_uuid
// del DB): serve subito dopo aver creato un nuovo tecnico, per mostrare l'URL
// del feed senza dover riaprire la scheda.
export async function leggiCalendarioToken(id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('tecnico').select('calendario_token').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data?.calendario_token as string | null) ?? null;
}

// Rigenera il token del feed iCal (invalida l'URL precedentemente condiviso).
// Affidiamo la generazione del nuovo UUID al DEFAULT della colonna (migration
// 013): un UPDATE con `calendario_token: null` non basterebbe perché la colonna
// è NOT NULL, quindi forziamo lato client una nuova chiave random.
export async function rigeneraCalendarioToken(id: string): Promise<string> {
  const nuovo = newId();
  const { error } = await supabase
    .from('tecnico').update({ calendario_token: nuovo }).eq('id', id);
  if (error) throw error;
  return nuovo;
}

// Costruisce l'URL pubblico del feed iCal (Edge Function `calendario-ics`).
// Punta alla stessa istanza di Supabase usata dall'app (VITE_SUPABASE_URL).
export function urlFeedCalendario(tecnicoId: string, token: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
  if (!base) return '';
  return `${base}/functions/v1/calendario-ics?tecnico=${tecnicoId}&token=${token}`;
}
