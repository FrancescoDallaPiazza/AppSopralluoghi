// Strato dati del back-office · SCADENZARIO.
//
// Lo scadenzario raccoglie SOLO scadenze: date che discendono da un fatto
// registrato (un attestato, un DVR, un CPI, una visita medica). Sono
// prevedibili, ricalcolabili, spesso ricorrenti. Nessuno le crea a mano: si
// registra il fatto a monte e la scadenza ne discende.
//
// Cio' che invece nasce da un'osservazione in campo (le correttive) o dalla
// pianificazione (le sedute) NON sta qui: vive in `cosedafare.ts`. Sono
// oggetti diversi: quelli hanno un ciclo di vita e un responsabile, si creano
// a mano, e non si "ricalcolano".
//
// Quattro blocchi, due sorgenti:
//   - formazione     : righe `azione` del Ramo A (origine_formazione_id /
//                      origine_esonero_id / origine_ramo='formazione'), che il
//                      motore materializza gia' da se'. Hanno stato editabile.
//   - documenti      |
//   - autorizzazioni | : righe `adempimento`, lette DIRETTE (nessuna
//   - sorveglianza   |   materializzazione in `azione`: la riga ha gia'
//                        data_scadenza, lo stato si deriva da quella).

import { supabase } from '../supabase';
import type { Adempimento, AdempimentoCategoria, Azione } from '../types';

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

export type CategoriaScadenza = 'formazione' | 'documenti' | 'autorizzazioni' | 'sorveglianza';

const CATEGORIA_DA_ADEMPIMENTO: Record<AdempimentoCategoria, CategoriaScadenza> = {
  documento: 'documenti',
  autorizzazione: 'autorizzazioni',
  sorveglianza: 'sorveglianza',
};

interface RigaBase {
  id: string;
  categoria: CategoriaScadenza;
  descrizione: string;
  data: string | null;               // la scadenza
  scaduta: boolean;
  conclusa: boolean;
  cliente_id: string | null;
  cliente_nome: string | null;
  persona_nome: string | null;       // discente (formazione) o lavoratore (sorveglianza)
  corso_nome: string | null;         // tipo corso / tipo adempimento
  ore: number | null;
  periodicita_mesi: number | null;
  sede_nome: string | null;
}

// Union discriminata su `kind`: le righe di formazione portano l'Azione
// completa (stato editabile + email); gli adempimenti portano la riga di
// adempimento e hanno stato DERIVATO dalla data.
export type RigaScadenzario =
  | (RigaBase & { kind: 'azione'; azione: Azione; adempimento: null })
  | (RigaBase & { kind: 'adempimento'; azione: null; adempimento: Adempimento });

export async function caricaScadenzario(clienteId?: string): Promise<RigaScadenzario[]> {
  const [formative, adempimenti] = await Promise.all([
    caricaScadenzeFormative(),
    caricaAdempimenti(),
  ]);
  const tutte = [...formative, ...adempimenti];
  // Scadenzario della scheda cliente: stessa vista, filtrata sul cliente.
  return clienteId ? tutte.filter((r) => r.cliente_id === clienteId) : tutte;
}

// Ramo A: le azioni gia' materializzate dal motore formazione.
async function caricaScadenzeFormative(): Promise<RigaScadenzario[]> {
  const { data, error } = await supabase
    .from('azione')
    .select(`
      ${COLONNE_AZIONE.join(', ')},
      cli_resp:cliente!responsabile_cliente_id ( id, ragione_sociale ),
      f_orig:formazione!origine_formazione_id ( corso_codice, persona:persona!persona_id ( cliente_id, nome, cognome ) ),
      e_orig:esonero!origine_esonero_id ( corso_codice, persona:persona!persona_id ( cliente_id, nome, cognome ) )
    `)
    .or('origine_formazione_id.not.is.null,origine_esonero_id.not.is.null,origine_ramo.eq.formazione');
  if (error) throw error;
  const o = oggiISO();

  // Ore + nome corso dal catalogo: corso_codice e' testo libero (nessuna FK),
  // quindi niente embed PostgREST, si risolve via mappa.
  const { data: corsiData } = await supabase
    .from('corso_catalogo').select('codice, nome, ore, ore_aggiornamento');
  const corsoInfo = new Map<string, { nome: string | null; ore: number | null }>(
    ((corsiData ?? []) as { codice: string; nome: string | null; ore: number | null; ore_aggiornamento: number | null }[])
      .map((c) => [c.codice, { nome: c.nome, ore: c.ore_aggiornamento ?? c.ore ?? null }]),
  );

  return (data ?? []).map((r: any): RigaScadenzario => {
    const cliResp = uno<any>(r.cli_resp);
    const fPers = uno<any>(uno<any>(r.f_orig)?.persona);
    const ePers = uno<any>(uno<any>(r.e_orig)?.persona);
    const corsoCodice: string | null =
      uno<any>(r.f_orig)?.corso_codice ?? uno<any>(r.e_orig)?.corso_codice ?? null;
    const ci = corsoCodice ? corsoInfo.get(corsoCodice) : undefined;
    const pAnag = fPers ?? ePers;

    const azione: Record<string, unknown> = {};
    for (const k of COLONNE_AZIONE) azione[k] = r[k] ?? null;
    const conclusa = r.stato === 'conclusa';

    return {
      kind: 'azione',
      id: r.id,
      categoria: 'formazione',
      descrizione: r.descrizione,
      data: r.data_scadenza ?? null,
      scaduta: !!(r.data_scadenza && r.data_scadenza < o && !conclusa),
      conclusa,
      cliente_id: r.responsabile_cliente_id ?? fPers?.cliente_id ?? ePers?.cliente_id ?? null,
      cliente_nome: cliResp?.ragione_sociale ?? null,
      persona_nome: pAnag ? ([pAnag.cognome, pAnag.nome].filter(Boolean).join(' ') || null) : null,
      corso_nome: ci?.nome ?? null,
      ore: ci?.ore ?? null,
      periodicita_mesi: r.periodicita_mesi ?? null,
      sede_nome: null,
      azione: azione as unknown as Azione,
      adempimento: null,
    };
  });
}

// Documenti / autorizzazioni / sorveglianza: lettura diretta.
// Stato derivato: scaduta se la data e' passata. Non c'e' un "concluso":
// un adempimento si rinnova (nuova data), non si chiude.
async function caricaAdempimenti(): Promise<RigaScadenzario[]> {
  const { data, error } = await supabase
    .from('adempimento')
    .select(`
      id, cliente_id, categoria, sede_id, persona_id, tipo, descrizione,
      data_rilascio, data_scadenza, periodicita_mesi, medico, note,
      allegato_path, import_key,
      cliente:cliente!cliente_id ( ragione_sociale ),
      sede:sede!sede_id ( nome ),
      persona:persona!persona_id ( nome, cognome )
    `);
  if (error) throw error;
  const o = oggiISO();

  return (data ?? []).map((r: any): RigaScadenzario => {
    const cli = uno<any>(r.cliente);
    const sede = uno<any>(r.sede);
    const pers = uno<any>(r.persona);

    const adempimento: Adempimento = {
      id: r.id, cliente_id: r.cliente_id, categoria: r.categoria,
      sede_id: r.sede_id ?? null, persona_id: r.persona_id ?? null,
      tipo: r.tipo, descrizione: r.descrizione ?? null,
      data_rilascio: r.data_rilascio ?? null, data_scadenza: r.data_scadenza ?? null,
      periodicita_mesi: r.periodicita_mesi ?? null, medico: r.medico ?? null,
      note: r.note ?? null, allegato_path: r.allegato_path ?? null,
      import_key: r.import_key ?? null,
    };

    return {
      kind: 'adempimento',
      id: r.id,
      categoria: CATEGORIA_DA_ADEMPIMENTO[r.categoria as AdempimentoCategoria],
      descrizione: r.descrizione || r.tipo,
      data: r.data_scadenza ?? null,
      scaduta: !!(r.data_scadenza && r.data_scadenza < o),
      conclusa: false,
      cliente_id: r.cliente_id,
      cliente_nome: cli?.ragione_sociale ?? null,
      persona_nome: pers ? ([pers.cognome, pers.nome].filter(Boolean).join(' ') || null) : null,
      corso_nome: r.tipo,
      ore: null,
      periodicita_mesi: r.periodicita_mesi ?? null,
      sede_nome: sede?.nome ?? null,
      azione: null,
      adempimento,
    };
  });
}

export const LABEL_CATEGORIA: Record<CategoriaScadenza, string> = {
  formazione: 'Formazione',
  documenti: 'Documenti',
  autorizzazioni: 'Autorizzazioni',
  sorveglianza: 'Sorveglianza sanitaria',
};
