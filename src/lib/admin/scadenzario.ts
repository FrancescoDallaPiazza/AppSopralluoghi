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
//   - formazione     : righe `azione` del Ramo A, che il motore materializza
//                      gia' da se'. Hanno stato editabile. NON si ricaricano
//                      qui: si riusa `caricaAzioniAdmin` di cosedafare.ts e se
//                      ne prende la meta' 'formazione'. Un solo caricatore e
//                      una sola classificazione per le due viste, cosi' nessuna
//                      riga puo' finire in entrambe o in nessuna.
//   - documenti      |
//   - autorizzazioni | : righe `adempimento`, lette DIRETTE (nessuna
//   - sorveglianza   |   materializzazione in `azione`: la riga ha gia'
//                        data_scadenza, lo stato si deriva da quella).

import { supabase } from '../supabase';
import { caricaAzioniAdmin } from './cosedafare';
import type { Adempimento, AdempimentoCategoria, Azione } from '../types';

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
  // Dovuto SUBITO: formazione mancante per cui non esiste una data, perche' non
  // c'e' un attestato da cui calcolarla ne' un termine di legge — il corso e'
  // semplicemente da erogare. Non e' "senza data" nel senso di dato incompleto:
  // e' la piu' urgente delle righe, e la vista la mostra come "SUBITO" prima di
  // ogni scadenza datata. Solo sulle righe di formazione: un adempimento senza
  // data e' un'altra cosa (manca il dato, non e' un lavoro in ritardo).
  subito: boolean;
  scaduta: boolean;
  conclusa: boolean;
  cliente_id: string | null;
  cliente_nome: string | null;
  persona_nome: string | null;       // discente (formazione) o lavoratore (sorveglianza)
  corso_nome: string | null;         // tipo corso / tipo adempimento
  ore: number | null;
  // Formazione: true se cio' che scade e' l'aggiornamento di un corso gia'
  // svolto (le `ore` sono allora quelle dell'aggiornamento). Sugli adempimenti
  // non ha senso e resta false.
  aggiornamento: boolean;
  // Perche' le ore mancano, quando mancano perche' il dato che le determina non
  // e' stato ancora confermato (vedi cosedafare.ts).
  ore_nota: string | null;
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

// Ramo A: le azioni gia' materializzate dal motore, prese dal caricatore
// condiviso e rimappate sulla forma dello scadenzario.
async function caricaScadenzeFormative(): Promise<RigaScadenzario[]> {
  const azioni = await caricaAzioniAdmin();
  return azioni
    .filter((r) => r.riga_tipo === 'formazione' && r.kind === 'azione')
    .map((r): RigaScadenzario => ({
      kind: 'azione',
      id: r.id,
      categoria: 'formazione',
      descrizione: r.descrizione,
      data: r.data,
      // Una riga di formazione senza data e' per costruzione un corso dovuto e
      // mai erogato: le scadenze vere una data ce l'hanno sempre (dall'attestato
      // o dalla norma). Vale sia per le righe automatiche del motore sia per i
      // gap generati a mano dal pannello dell'organigramma.
      subito: r.data === null && !r.conclusa,
      scaduta: r.scaduta,
      conclusa: r.conclusa,
      cliente_id: r.cliente_id,
      cliente_nome: r.cliente_nome,
      persona_nome: r.persona_nome,
      corso_nome: r.corso_nome,
      ore: r.ore,
      aggiornamento: r.aggiornamento,
      ore_nota: r.ore_nota,
      periodicita_mesi: r.kind === 'azione' ? (r.azione.periodicita_mesi ?? null) : null,
      sede_nome: null,
      azione: (r as { azione: Azione }).azione,
      adempimento: null,
    }));
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
      // Un adempimento senza data non e' un lavoro in ritardo: e' una riga a cui
      // manca il dato. Non si promuove a "SUBITO".
      subito: false,
      scaduta: !!(r.data_scadenza && r.data_scadenza < o),
      conclusa: false,
      cliente_id: r.cliente_id,
      cliente_nome: cli?.ragione_sociale ?? null,
      persona_nome: pers ? ([pers.cognome, pers.nome].filter(Boolean).join(' ') || null) : null,
      corso_nome: r.tipo,
      ore: null,
      aggiornamento: false,
      ore_nota: null,
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
