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
