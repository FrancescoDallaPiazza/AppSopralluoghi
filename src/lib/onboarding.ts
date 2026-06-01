// Helper client per l'onboarding di un tecnico (creazione/invito del login +
// collegamento automatico di `tecnico.user_id`), via Edge Function
// `invita-tecnico`. Stessa convenzione di src/lib/report.ts.
//
// supabase.functions.invoke aggiunge da sé l'header Authorization con il JWT
// dell'utente loggato: la funzione lo usa per verificare che il chiamante sia
// staff autenticato.

import { supabase } from './supabase';

export type ModalitaInvito = 'invito' | 'link' | 'password';

export interface InvitaTecnicoInput {
  /** Collega un tecnico ESISTENTE (alternativo a `nome`). */
  tecnicoId?: string;
  /** Crea un tecnico NUOVO (alternativo a `tecnicoId`). */
  nome?: string;
  /** Email del login (obbligatoria). */
  email: string;
  baseLocalita?: string;
  capienzaOreSettimana?: number;
  /** 'invito' (Supabase manda l'email) | 'link' (ritorna il link) | 'password' (account già attivo). */
  modalita?: ModalitaInvito;
  /** Obbligatoria con modalita 'password' (min 8 caratteri). */
  password?: string;
  /** Dove atterra l'utente dopo aver scelto la password. */
  redirectTo?: string;
}

export interface InvitaTecnicoResult {
  tecnico_id: string;
  user_id: string;
  email: string;
  modalita: ModalitaInvito;
  /** Presente solo con modalita 'link': da inviare al tecnico a mano. */
  action_link: string | null;
  /** L'account di login esisteva già: è stato solo collegato. */
  gia_esistente: boolean;
  collegato: boolean;
}

export async function invitaTecnico(
  input: InvitaTecnicoInput,
): Promise<InvitaTecnicoResult> {
  const { data, error } = await supabase.functions.invoke('invita-tecnico', {
    body: {
      tecnico_id: input.tecnicoId,
      nome: input.nome,
      email: input.email.trim(),
      base_localita: input.baseLocalita,
      capienza_ore_settimana: input.capienzaOreSettimana,
      modalita: input.modalita ?? 'invito',
      password: input.password,
      redirect_to: input.redirectTo,
    },
  });

  // Le Edge Function ritornano gli errori applicativi come { error } in body:
  // supabase-js segnala lo status non-2xx in `error`, ma il dettaglio leggibile
  // sta nel body, quindi proviamo a estrarlo.
  const d = (data ?? null) as ({ error?: string } & Partial<InvitaTecnicoResult>) | null;
  if (error) {
    const msg = d?.error ?? error.message ?? 'Invito non riuscito.';
    throw new Error(msg);
  }
  if (!d || d.error || !d.collegato) {
    throw new Error(d?.error ?? 'Invito non riuscito.');
  }
  return d as InvitaTecnicoResult;
}
