// Login Supabase (email/password) e risoluzione utente -> tecnico.
//
// L'app ragiona in `tecnico.id` (responsabile_interno_id ecc.); l'auth conosce
// solo auth.users.id. Il ponte è tecnico.user_id.
//
// Offline-first: la sessione la persiste supabase-js; la riga tecnico arriva
// dalla rete e la mettiamo in cache, così al riavvio senza segnale l'utente
// resta "risolto" e si entra nell'app.

import { supabase } from './supabase';
import type { Tecnico } from './types';

const COLONNE_TECNICO =
  'id, user_id, nome, cognome, base_localita, base_lat, base_lng, calendario_ref, capienza_ore_settimana, attivo, ruolo, calendario_token';

const chiaveCache = (userId: string) => `tecnico:${userId}`;

function leggiCache(userId: string): Tecnico | null {
  try {
    const raw = localStorage.getItem(chiaveCache(userId));
    return raw ? (JSON.parse(raw) as Tecnico) : null;
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  // best-effort: pulisci le cache tecnico di questo device
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('tecnico:')) localStorage.removeItem(k);
    }
  } catch {
    /* ignora */
  }
  await supabase.auth.signOut();
}

// Lanciato quando siamo offline e il tecnico non è MAI stato risolto su questo
// device (niente rete, niente cache): non sappiamo ancora chi è l'utente.
export class TecnicoNonRisolto extends Error {
  constructor() {
    super('Tecnico non ancora risolto e nessuna rete disponibile.');
    this.name = 'TecnicoNonRisolto';
  }
}

// Traduce l'utente autenticato nella sua riga `tecnico`.
//   online + trovato       -> Tecnico (aggiorna cache)
//   online + non trovato   -> null  (account non collegato a un tecnico)
//   offline + cache        -> Tecnico dalla cache
//   offline + niente cache -> throw TecnicoNonRisolto
export async function risolviTecnico(userId: string): Promise<Tecnico | null> {
  try {
    const { data, error } = await supabase
      .from('tecnico')
      .select(COLONNE_TECNICO)
      .eq('user_id', userId)
      .maybeSingle(); // user_id è UNIQUE -> 0 o 1 riga

    if (error) throw error;

    if (data) {
      localStorage.setItem(chiaveCache(userId), JSON.stringify(data));
      return data as Tecnico;
    }
    // online ma nessuna riga: l'account non è (ancora) collegato a un tecnico
    localStorage.removeItem(chiaveCache(userId));
    return null;
  } catch {
    // probabile errore di rete: ripiega sull'ultimo tecnico noto
    const cache = leggiCache(userId);
    if (cache) return cache;
    throw new TecnicoNonRisolto();
  }
}
