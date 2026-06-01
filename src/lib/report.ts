// Helper client per generare il report di un sopralluogo via Edge Function.
// Chiede l'HTML (resa A4 stampabile, funziona senza servizio PDF esterno) e
// restituisce un URL firmato all'artefatto nel bucket privato 'report'.

import { supabase } from './supabase';

export type VarianteReport = 'cliente' | 'interna';

export async function generaReport(
  sopralluogoId: string,
  variante: VarianteReport,
  formato: 'html' | 'pdf' = 'html',
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('genera-report', {
    body: { sopralluogo_id: sopralluogoId, variante, formato },
  });
  if (error) throw error;
  const d = data as { url?: string; error?: string };
  if (!d?.url) throw new Error(d?.error ?? 'Report non generato.');
  return d.url;
}

export interface EsitoInvioReport {
  url: string;
  emailed: boolean;
  emailTo: string | null;
  reason: string | null;
}

// Genera la variante CLIENTE e la invia via email. Se `emailDestinatario` non è
// passato, la funzione server usa l'email del cliente in anagrafica.
export async function inviaReportCliente(
  sopralluogoId: string,
  emailDestinatario?: string,
  formato: 'html' | 'pdf' = 'html',
): Promise<EsitoInvioReport> {
  const { data, error } = await supabase.functions.invoke('genera-report', {
    body: {
      sopralluogo_id: sopralluogoId,
      variante: 'cliente',
      formato,
      invia_email: true,
      email_destinatario: emailDestinatario,
    },
  });
  if (error) throw error;
  const d = data as {
    url?: string; emailed?: boolean; email_to?: string | null;
    email_reason?: string | null; error?: string;
  };
  if (!d?.url) throw new Error(d?.error ?? 'Report non generato.');
  return {
    url: d.url,
    emailed: !!d.emailed,
    emailTo: d.email_to ?? null,
    reason: d.email_reason ?? null,
  };
}
