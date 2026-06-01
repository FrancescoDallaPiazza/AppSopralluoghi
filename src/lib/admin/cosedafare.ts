// Strato dati del back-office · "cose da fare" / scadenzario.
//
// Vista d'insieme di TUTTE le azioni (correttive + scadenze ricorrenti), con il
// contesto (cliente d'origine, sopralluogo, voce) e il destinatario risolto
// (cliente / tecnico / area). Online-first (scrivania).
//
// È il posto dove diventano consultabili anche le cose-da-fare assegnate a
// un'AREA (Formazione, Preventivi…), che la schermata di campo "Le mie cose da
// fare" non mostra perché è legata al singolo tecnico.

import { supabase } from '../supabase';
import { newId, type Azione, type AzioneStato, type AzioneTipo, type AzionePriorita } from '../types';

const COLONNE_AZIONE = [
  'id', 'tipo', 'origine_esito_id', 'sopralluogo_origine_id', 'descrizione',
  'responsabile_tipo', 'responsabile_cliente_id', 'responsabile_interno_id',
  'responsabile_area_id',
  'data_scadenza', 'priorita', 'stato', 'sopralluogo_verifica_id',
  'data_verifica', 'periodicita_mesi', 'werp_attivita_id', 'notificata_il',
] as const;

const uno = <T,>(v: T | T[] | null | undefined): T | undefined =>
  Array.isArray(v) ? v[0] : (v ?? undefined);

export type DestinatarioTipo = 'cliente' | 'tecnico' | 'area';

export interface CosaDaFareAdmin {
  azione: Azione;
  cliente_nome: string | null;       // cliente d'origine (di quale cliente parla)
  sopralluogo_label: string | null;
  origine_voce: string | null;
  destinatario_tipo: DestinatarioTipo;
  destinatario_nome: string | null;  // nome del responsabile risolto
}

export async function caricaCoseDaFare(): Promise<CosaDaFareAdmin[]> {
  const { data, error } = await supabase
    .from('azione')
    .select(`
      ${COLONNE_AZIONE.join(', ')},
      origine:esito_voce!origine_esito_id ( voce_testo ),
      area:area_interna!responsabile_area_id ( nome ),
      tecnico:tecnico!responsabile_interno_id ( nome ),
      cli_resp:cliente!responsabile_cliente_id ( ragione_sociale ),
      sopr:sopralluogo!sopralluogo_origine_id (
        progressivo,
        incarico:incarico!incarico_id (
          tipo_attivita,
          cliente:cliente!cliente_id ( ragione_sociale )
        )
      )
    `);
  if (error) throw error;

  return (data ?? []).map((r: any): CosaDaFareAdmin => {
    const sopr = uno<any>(r.sopr);
    const inc = uno<any>(sopr?.incarico);
    const cliOrig = uno<any>(inc?.cliente);
    const orig = uno<any>(r.origine);
    const area = uno<any>(r.area);
    const tec = uno<any>(r.tecnico);
    const cliResp = uno<any>(r.cli_resp);

    let dTipo: DestinatarioTipo;
    let dNome: string | null;
    if (r.responsabile_tipo === 'cliente') {
      dTipo = 'cliente';
      dNome = cliResp?.ragione_sociale ?? cliOrig?.ragione_sociale ?? null;
    } else if (r.responsabile_area_id) {
      dTipo = 'area'; dNome = area?.nome ?? null;
    } else {
      dTipo = 'tecnico'; dNome = tec?.nome ?? null;
    }

    const label = sopr
      ? [inc?.tipo_attivita, sopr.progressivo].filter(Boolean).join(' · ') || null
      : null;

    // estrai solo le colonne reali dell'azione
    const azione: Record<string, unknown> = {};
    for (const k of COLONNE_AZIONE) azione[k] = r[k] ?? null;

    return {
      azione: azione as unknown as Azione,
      cliente_nome: cliOrig?.ragione_sociale ?? null,
      sopralluogo_label: label,
      origine_voce: orig?.voce_testo ?? null,
      destinatario_tipo: dTipo,
      destinatario_nome: dNome,
    };
  });
}

// Cambio stato dal back-office (online): aggiorna l'azione e lascia una riga di
// storico, coerente con il flusso di campo (che fa lo stesso via coda offline).
export async function aggiornaStatoAzioneAdmin(
  azioneId: string, nuovoStato: AzioneStato, nota?: string,
): Promise<void> {
  const { error: e1 } = await supabase
    .from('azione').update({ stato: nuovoStato }).eq('id', azioneId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('aggiornamento_azione').insert({
    id: newId(),
    azione_id: azioneId,
    data: new Date().toISOString(),
    nuovo_stato: nuovoStato,
    nota: nota?.trim() ? nota.trim() : 'Aggiornata dal back-office',
    autore_id: null,
  });
  if (e2) throw e2;
}

// helper di dominio per la UI
export const LABEL_STATO_AZIONE: Record<AzioneStato, string> = {
  aperta: 'Aperta', in_corso: 'In corso', conclusa: 'Conclusa',
};
export const LABEL_TIPO_AZIONE: Record<AzioneTipo, string> = {
  azione_correttiva: 'Correttiva', scadenza_ricorrente: 'Scadenza ricorrente',
};
export const LABEL_PRIORITA: Record<AzionePriorita, string> = {
  bassa: 'Bassa', media: 'Media', alta: 'Alta',
};
