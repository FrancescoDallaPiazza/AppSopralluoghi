// Strato dati della schermata "I miei sopralluoghi" (tecnico).
//
// Lettura : i sopralluoghi assegnati al tecnico, con contesto (cliente, tipo
//           attività) preso dal server con una join.
// Overlay : le modifiche locali (Dexie) si sovrappongono, così i cambi di
//           stato compaiono subito e funzionano offline.

import { supabase } from './supabase';
import type { Sopralluogo } from './types';

export interface SopralluogoConContesto extends Sopralluogo {
  cliente_nome: string | null;
  cliente_id: string | null;
  tipo_attivita: string | null;
}

// Colonne reali della tabella `sopralluogo` (allineate a 001_init.sql).
const COLONNE_SOPRALLUOGO = [
  'id', 'incarico_id', 'progressivo', 'tecnico_id', 'data_pianificata',
  'data_effettiva', 'durata_stimata_min', 'durata_effettiva_min', 'localita',
  'stato', 'werp_attivita_id', 'revisione_corrente',
] as const;

// Ricava il solo Sopralluogo "pulito" (senza contesto) per upsert/locale.
export function toBaseSopralluogo(
  s: SopralluogoConContesto | Sopralluogo,
): Sopralluogo {
  const out: Record<string, unknown> = {};
  const src = s as unknown as Record<string, unknown>;
  for (const k of COLONNE_SOPRALLUOGO) out[k] = k in src ? src[k] : null;
  return out as unknown as Sopralluogo;
}

export async function caricaMieiSopralluoghi(
  tecnicoId: string,
): Promise<SopralluogoConContesto[]> {
  const { data, error } = await supabase
    .from('sopralluogo')
    .select(`
      ${COLONNE_SOPRALLUOGO.join(', ')},
      incarico:incarico!incarico_id (
        tipo_attivita,
        cliente:cliente!cliente_id ( id, ragione_sociale )
      )
    `)
    .eq('tecnico_id', tecnicoId);

  if (error) throw error;

  // PostgREST può restituire l'embed come oggetto o (raramente) come array.
  const uno = <T,>(v: T | T[] | null | undefined): T | undefined =>
    Array.isArray(v) ? v[0] : (v ?? undefined);

  return (data ?? []).map((r: any): SopralluogoConContesto => {
    const inc = uno<any>(r.incarico);
    const cli = uno<any>(inc?.cliente);
    return {
      ...toBaseSopralluogo(r as Sopralluogo),
      cliente_nome: cli?.ragione_sociale ?? null,
      cliente_id: cli?.id ?? null,
      tipo_attivita: inc?.tipo_attivita ?? null,
    };
  });
}
