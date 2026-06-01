// Client della Edge Function `notifica-azione`: invia l'email al destinatario
// interno (tecnico o area) di una cosa-da-fare. Best-effort: in campo si chiama
// dopo la creazione, ma solo se c'è rete; il fallimento non blocca nulla.

import { supabase } from './supabase';

export interface EsitoNotifica {
  sent: boolean;
  reason?: string | null;
}

export async function notificaAzione(azioneId: string, force = false): Promise<EsitoNotifica> {
  const { data, error } = await supabase.functions.invoke('notifica-azione', {
    body: { azione_id: azioneId, force },
  });
  if (error) return { sent: false, reason: error.message };
  return { sent: !!data?.sent, reason: data?.reason ?? null };
}
