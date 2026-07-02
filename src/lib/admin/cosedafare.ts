// Strato dati del back-office · "cose da fare" / scadenzario UNICO.
//
// Feed unico che fonde DUE sorgenti in un'unica lista ordinabile/filtrabile,
// online-first (scrivania):
//   - azione  : correttive dei sopralluoghi + scadenze formative. Il Ramo A
//               (formazione) materializza gia' azioni reali con
//               origine_formazione_id/origine_esonero_id, instradate all'area
//               Formazione, quindi entrano da se'.
//   - sopralluogo pianificato : le prossime uscite in campo (Ramo B) non ancora
//               effettuate. NON vengono duplicate in `azione`: restano righe
//               `sopralluogo` col proprio ciclo di vita e qui compaiono in sola
//               lettura (read-model). Il ciclo del sopralluogo si governa in
//               Pianificazione/campo, non da questa vista.
//
// E' anche il posto dove diventano consultabili le cose-da-fare assegnate a
// un'AREA (Formazione, Preventivi...), che la schermata di campo "Le mie cose
// da fare" non mostra perche' e' legata al singolo tecnico.

import { supabase } from '../supabase';
import { newId, type Azione, type AzioneStato, type AzioneTipo, type AzionePriorita } from '../types';

const COLONNE_AZIONE = [
  'id', 'tipo', 'origine_esito_id', 'sopralluogo_origine_id', 'descrizione',
  'responsabile_tipo', 'responsabile_cliente_id', 'responsabile_interno_id',
  'responsabile_area_id',
  'data_scadenza', 'priorita', 'stato', 'sopralluogo_verifica_id',
  'data_verifica', 'periodicita_mesi', 'werp_attivita_id', 'notificata_il',
  'origine_formazione_id', 'origine_esonero_id', 'origine_ramo',
] as const;

const uno = <T,>(v: T | T[] | null | undefined): T | undefined =>
  Array.isArray(v) ? v[0] : (v ?? undefined);

const oggiISO = () => new Date().toISOString().slice(0, 10);

export type DestinatarioTipo = 'cliente' | 'tecnico' | 'area';

// Tipo di riga del feed unico, per il filtro "Tipo".
export type RigaTipo = 'formazione' | 'correttiva' | 'sopralluogo';

interface CosaDaFareBase {
  id: string;
  riga_tipo: RigaTipo;
  descrizione: string;
  data: string | null;               // scadenza (azione) o data pianificata (sopralluogo)
  scaduta: boolean;                  // in ritardo e non ancora conclusa
  conclusa: boolean;                 // "fatto" (i sopralluoghi pianificati qui non lo sono mai)
  cliente_id: string | null;         // cliente d'origine (per lo scadenzario per-anagrafica)
  cliente_nome: string | null;       // cliente d'origine (di quale cliente parla)
  sopralluogo_label: string | null;
  origine_voce: string | null;
  destinatario_tipo: DestinatarioTipo;
  destinatario_nome: string | null;  // nome del responsabile risolto
}

// Union discriminata su `kind`: solo le righe azione portano l'Azione completa
// (per i controlli stato/email); i sopralluoghi sono in sola lettura.
export type CosaDaFareAdmin =
  | (CosaDaFareBase & { kind: 'azione'; azione: Azione })
  | (CosaDaFareBase & { kind: 'sopralluogo'; azione: null });

export async function caricaCoseDaFare(clienteId?: string): Promise<CosaDaFareAdmin[]> {
  const [azioni, sopralluoghi] = await Promise.all([
    caricaAzioni(),
    caricaSopralluoghiPianificati(),
  ]);
  const tutte = [...azioni, ...sopralluoghi];
  // Scadenzario per-anagrafica: stessa vista, filtrata sul cliente d'origine.
  return clienteId ? tutte.filter((r) => r.cliente_id === clienteId) : tutte;
}

async function caricaAzioni(): Promise<CosaDaFareAdmin[]> {
  const { data, error } = await supabase
    .from('azione')
    .select(`
      ${COLONNE_AZIONE.join(', ')},
      origine:esito_voce!origine_esito_id ( voce_testo ),
      area:area_interna!responsabile_area_id ( nome ),
      tecnico:tecnico!responsabile_interno_id ( nome ),
      cli_resp:cliente!responsabile_cliente_id ( id, ragione_sociale ),
      f_orig:formazione!origine_formazione_id ( persona:persona!persona_id ( cliente_id ) ),
      e_orig:esonero!origine_esonero_id ( persona:persona!persona_id ( cliente_id ) ),
      sopr:sopralluogo!sopralluogo_origine_id (
        progressivo,
        incarico:incarico!incarico_id (
          tipo_attivita,
          cliente:cliente!cliente_id ( id, ragione_sociale )
        )
      )
    `);
  if (error) throw error;
  const o = oggiISO();

  return (data ?? []).map((r: any): CosaDaFareAdmin => {
    const sopr = uno<any>(r.sopr);
    const inc = uno<any>(sopr?.incarico);
    const cliOrig = uno<any>(inc?.cliente);
    const orig = uno<any>(r.origine);
    const area = uno<any>(r.area);
    const tec = uno<any>(r.tecnico);
    const cliResp = uno<any>(r.cli_resp);
    const fPers = uno<any>(uno<any>(r.f_orig)?.persona);
    const ePers = uno<any>(uno<any>(r.e_orig)?.persona);

    // Cliente d'origine: sopralluogo (correttive) -> responsabile cliente
    // (formazione verso cliente) -> persona della formazione/esonero (azioni
    // di formazione instradate a un'area, senza responsabile_cliente_id).
    const clienteId: string | null =
      cliOrig?.id ?? r.responsabile_cliente_id ?? fPers?.cliente_id ?? ePers?.cliente_id ?? null;
    const clienteNome: string | null = cliOrig?.ragione_sociale ?? cliResp?.ragione_sociale ?? null;

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

    const conclusa = r.stato === 'conclusa';
    const riga_tipo: RigaTipo =
      (r.origine_formazione_id || r.origine_esonero_id || r.origine_ramo === 'formazione') ? 'formazione' : 'correttiva';

    return {
      kind: 'azione',
      id: r.id,
      riga_tipo,
      descrizione: r.descrizione,
      data: r.data_scadenza ?? null,
      scaduta: !!(r.data_scadenza && r.data_scadenza < o && !conclusa),
      conclusa,
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      sopralluogo_label: label,
      origine_voce: orig?.voce_testo ?? null,
      destinatario_tipo: dTipo,
      destinatario_nome: dNome,
      azione: azione as unknown as Azione,
    };
  });
}

// Ramo B: sedute pianificate non ancora effettuate (stato pianificato/in_corso).
// ponytail: carica tutte le righe aperte senza paginazione — e' una vista di
// scrivania; aggiungere un filtro periodo se il volume crescesse.
async function caricaSopralluoghiPianificati(): Promise<CosaDaFareAdmin[]> {
  const { data, error } = await supabase
    .from('sopralluogo')
    .select(`
      id, progressivo, data_pianificata, stato,
      tecnico:tecnico!tecnico_id ( nome, cognome ),
      incarico:incarico!incarico_id (
        tipo_attivita,
        cliente:cliente!cliente_id ( id, ragione_sociale )
      )
    `)
    .in('stato', ['pianificato', 'in_corso']);
  if (error) throw error;
  const o = oggiISO();

  return (data ?? []).map((r: any): CosaDaFareAdmin => {
    const inc = uno<any>(r.incarico);
    const cli = uno<any>(inc?.cliente);
    const tec = uno<any>(r.tecnico);
    const tecNome = tec ? [tec.nome, tec.cognome].filter(Boolean).join(' ') || null : null;

    return {
      kind: 'sopralluogo',
      id: r.id,
      riga_tipo: 'sopralluogo',
      descrizione: 'Sopralluogo' + (r.progressivo ? ' ' + r.progressivo : ''),
      data: r.data_pianificata ?? null,
      // per definizione del filtro stato la seduta non e' completata:
      // se la data e' passata, e' in ritardo.
      scaduta: !!(r.data_pianificata && r.data_pianificata < o),
      conclusa: false,
      cliente_id: cli?.id ?? null,
      cliente_nome: cli?.ragione_sociale ?? null,
      sopralluogo_label: inc?.tipo_attivita ?? null,
      origine_voce: null,
      destinatario_tipo: 'tecnico',
      destinatario_nome: tecNome,
      azione: null,
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
export const LABEL_RIGA: Record<RigaTipo, string> = {
  formazione: 'Formazione', correttiva: 'Correttiva', sopralluogo: 'Sopralluogo',
};
