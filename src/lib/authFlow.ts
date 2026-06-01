// Rileva, all'avvio, se l'utente è arrivato da un link di INVITO o di RECUPERO
// password. In quei casi Supabase apre una sessione valida, ma l'account non ha
// (ancora) una password scelta dall'utente: l'app deve mostrare la schermata
// "Imposta password" invece di entrare diretta.
//
// La lettura avviene all'import del modulo, PRIMA che supabase-js
// (detectSessionInUrl) ripulisca l'hash dell'URL. Per questo qui NON importiamo
// il client supabase e questo file va importato per primo in AuthProvider.

export type AzioneAuth = 'invite' | 'recovery' | null;

function leggiTipoAzione(): AzioneAuth {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const tipo = new URLSearchParams(raw).get('type');
    return tipo === 'invite' || tipo === 'recovery' ? tipo : null;
  } catch {
    return null;
  }
}

// Valutato una sola volta, all'avvio dell'app.
export const azioneAuthIniziale: AzioneAuth = leggiTipoAzione();

// Rimuove i parametri auth dall'URL: estetico, ed evita di riattivare il flusso
// se l'utente ricarica la pagina.
export function pulisciHashAuth(): void {
  try {
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      );
    }
  } catch {
    /* ignora */
  }
}
