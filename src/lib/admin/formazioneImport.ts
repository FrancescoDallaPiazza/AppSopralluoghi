// C1b - import della formazione dal GESTIONALE esterno.
//
// Sorgente: l'export "Ricerca Visite/Formazioni" (file `ExportExcel.xlsx`), che
// e' il registro dei fatti - una riga per attestato, con persona, corso, data e
// ore. NON confonderlo con `scadenzarioSedi.xlsx`, che e' un DERIVATO: elenca
// le scadenze gia' calcolate dal gestionale, senza data del corso ne' ore, e
// importarlo significherebbe dedurre gli attestati invece di leggerli.
//
// FATTI VERIFICATI SUL FILE (foglio unico, 127 righe di prova su Ecodent):
//  * riga 0 = titolo "Elenco Visite/Formazioni", riga 1 VUOTA, riga 2 = header,
//    dati dalla riga 3. Attenzione: e' diverso dagli altri due export del
//    gestionale, che hanno l'header a riga 1;
//  * `Genere` (col Y) vale 'Formazione' oppure 'Visita': l'export mescola le
//    due cose. Le visite mediche NON sono formazione e si scartano qui - il
//    loro posto e' `adempimento` categoria sorveglianza, non `formazione`;
//  * `Tipo` (col Z) e' il NOME DEL CORSO, ed e' lo stesso vocabolario del
//    dizionario alias: verificato che 28 testi distinti su 28 risolvono;
//  * `Codice Fiscale` (col P) e' valorizzato su tutte le righe: l'aggancio alle
//    persone e' per CF, non per nome. Niente match su stringa;
//  * `Data` (col AC) e `Durata Formazione` (col AA) sono sempre presenti;
//  * le date sono SERIALI Excel (43545 = 21/03/2019), non stringhe.
//
// UNITA' = (P.IVA, Sede). Una stessa P.IVA compare con piu' sedi: Ecodent ha
// Villafranca (11 persone) e Trevenzuolo (9), ognuna con la propria squadra di
// emergenza. Poiche' in app un cliente = un organigramma (deciso 2026-07-08) e
// gli addetti alle emergenze si designano per LUOGO DI LAVORO, ogni unita' del
// file va su un cliente distinto (deciso 2026-07-31). Percio' la P.IVA da sola
// NON identifica il cliente e l'abbinamento unita' -> cliente lo conferma
// l'operatore nell'anteprima.
//
// L'import NON crea i clienti. Un cliente nato dal file sarebbe privo di ATECO,
// livello di rischio e livelli di emergenza - dati che il file non ha e che
// guidano il motore: con `livello_rischio` nullo non si sa nemmeno quante ore
// di formazione specifica siano dovute. L'anteprima segnala l'unita' senza
// cliente e mostra i dati da usare per crearlo a mano, completo.

import * as XLSX from 'xlsx';
import { supabase } from '../supabase';
import { normalizzaTestoGestionale, type CorsoAlias } from './aliasCorsi';
import { salvaPersona, type Persona, type CorsoCatalogo } from './formazione';
import { newId } from '../types';

// ============================ TIPI ============================

export interface RigaGestionale {
  riga: number;                 // numero di riga nel file, per i messaggi
  partita_iva: string;
  societa: string;
  sede: string;
  indirizzo: string;
  cap: string;
  provincia: string;
  citta: string;
  cf: string;
  cognome: string;
  nome: string;
  mansione: string;
  data_assunzione: string | null;
  corso: string;                // testo originale (col Z)
  corso_norm: string;           // chiave del dizionario alias
  data: string | null;          // ISO
  ore: number | null;
}

// Un gruppo (P.IVA + Sede) del file: e' cio' che va abbinato a UN cliente.
export interface UnitaFile {
  chiave: string;               // partita_iva + '|' + sede
  partita_iva: string;
  societa: string;
  sede: string;
  indirizzo: string;
  cap: string;
  provincia: string;
  citta: string;
  righe: RigaGestionale[];
  persone: number;              // CF distinti
}

export interface PersonaMancante {
  cf: string;
  cognome: string;
  nome: string;
  mansione: string;
  data_assunzione: string | null;
  righe: number;                // quanti attestati resterebbero orfani
}

// Una riga pronta per diventare un record `formazione`.
export interface VoceImport {
  riga: RigaGestionale;
  persona_id: string | null;    // null = persona non ancora in app
  corso_codice: string;
  is_aggiornamento: boolean;
  pregressa: boolean;
  parziale: boolean;
  import_key: string;
  ore_dovute: number | null;    // per la segnalazione "ore insufficienti"
}

export interface EsitoUnita {
  unita: UnitaFile;
  cliente_id: string | null;
  nuove: VoceImport[];
  gia_presenti: number;
  ignorate: number;             // alias marcato `ignorato`: fuori perimetro
  senza_alias: string[];        // corso non nel dizionario (testi distinti)
  senza_codice: string[];       // alias presente ma non ancora mappato
  personeMancanti: PersonaMancante[];
  oreInsufficienti: VoceImport[];
}

export interface EsitoImport {
  righeLette: number;
  visiteScartate: number;
  unita: EsitoUnita[];
}

// ============================ [1] LETTURA ============================

const S = (v: unknown): string => (v == null ? '' : String(v)).trim();

// Le date arrivano come seriali Excel (base 30/12/1899). Si formatta in UTC:
// costruire una Date locale sposterebbe il giorno indietro nei fusi a est.
export function dataDaExcel(v: unknown): string | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  // Difesa: se un giorno l'export cambiasse e mandasse gia' stringhe.
  const s = String(v).trim();
  const it = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (it) return `${it[3]}-${it[2]}-${it[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// Le colonne si trovano per INTESTAZIONE e non per posizione: l'export ha 34
// colonne e un domani il gestionale potrebbe infilarne una in mezzo. Il
// confronto e' tollerante su spazi e maiuscole perche' le intestazioni del
// gestionale non sono stabili nemmeno in quello ("P.iva", non "P.IVA").
const chiave = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

function mappaColonne(header: unknown[]): Map<string, number> {
  const m = new Map<string, number>();
  header.forEach((h, i) => {
    const k = chiave(S(h));
    if (k && !m.has(k)) m.set(k, i);
  });
  return m;
}

function campo(riga: unknown[], cols: Map<string, number>, ...nomi: string[]): string {
  for (const n of nomi) {
    const i = cols.get(chiave(n));
    if (i != null) {
      const v = S(riga[i]);
      if (v !== '') return v;
    }
  }
  return '';
}

function grezzo(riga: unknown[], cols: Map<string, number>, nome: string): unknown {
  const i = cols.get(chiave(nome));
  return i == null ? null : riga[i];
}

export interface LetturaExport {
  righe: RigaGestionale[];
  visiteScartate: number;
}

export async function leggiExportFormazioni(file: File): Promise<LetturaExport> {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]!];
  if (!ws) return { righe: [], visiteScartate: 0 };
  const griglia = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false });

  // L'header non e' a riga fissa: riga 0 titolo, riga 1 vuota, riga 2 header.
  // Lo si cerca invece di darlo per scontato - una riga vuota in piu' o in meno
  // nel titolo manderebbe fuori fase tutto il file in silenzio.
  const iHeader = griglia.findIndex((r) => r.some((c) => chiave(S(c)) === 'codice fiscale'));
  if (iHeader < 0) throw new Error('Intestazioni non riconosciute: manca la colonna "Codice Fiscale".');
  const cols = mappaColonne(griglia[iHeader]!);

  const righe: RigaGestionale[] = [];
  let visiteScartate = 0;
  for (let i = iHeader + 1; i < griglia.length; i++) {
    const r = griglia[i]!;
    const cf = campo(r, cols, 'Codice Fiscale').toUpperCase();
    const corso = campo(r, cols, 'Tipo');
    if (!cf && !corso) continue;

    // Visite mediche: stesso export, altro dominio. Si contano e si scartano.
    const genere = campo(r, cols, 'Genere');
    if (genere && genere.toLowerCase() !== 'formazione') { visiteScartate++; continue; }

    const ore = Number(campo(r, cols, 'Durata Formazione'));
    righe.push({
      riga: i + 1,
      partita_iva: campo(r, cols, 'P.iva', 'P.IVA', 'Partita IVA'),
      societa: campo(r, cols, 'Societa', 'Società'),
      sede: campo(r, cols, 'Sede'),
      indirizzo: campo(r, cols, 'Indirizzo'),
      cap: campo(r, cols, 'CAP'),
      provincia: campo(r, cols, 'Provincia'),
      citta: campo(r, cols, 'Citta', 'Città'),
      cf,
      cognome: campo(r, cols, 'Cognome'),
      nome: campo(r, cols, 'Nome'),
      mansione: campo(r, cols, 'Mansione'),
      data_assunzione: dataDaExcel(grezzo(r, cols, 'Data di Assunzione')),
      corso,
      corso_norm: normalizzaTestoGestionale(corso),
      data: dataDaExcel(grezzo(r, cols, 'Data')),
      ore: Number.isFinite(ore) && ore > 0 ? ore : null,
    });
  }
  return { righe, visiteScartate };
}

// ============================ [2] UNITA' ============================

export function raggruppaUnita(righe: RigaGestionale[]): UnitaFile[] {
  const m = new Map<string, UnitaFile>();
  for (const r of righe) {
    const k = r.partita_iva + '|' + r.sede;
    let u = m.get(k);
    if (!u) {
      u = {
        chiave: k, partita_iva: r.partita_iva, societa: r.societa, sede: r.sede,
        indirizzo: r.indirizzo, cap: r.cap, provincia: r.provincia, citta: r.citta,
        righe: [], persone: 0,
      };
      m.set(k, u);
    }
    u.righe.push(r);
  }
  for (const u of m.values()) u.persone = new Set(u.righe.map((r) => r.cf)).size;
  return [...m.values()].sort((a, b) => a.societa.localeCompare(b.societa) || a.sede.localeCompare(b.sede));
}

// Proposta di abbinamento unita' -> cliente. La P.IVA da sola non basta (due
// clienti la condividono, per scelta): fra i clienti con quella P.IVA vince
// quello la cui localita' o CAP corrisponde alla sede del file. Se resta
// ambiguo non si propone nulla: sceglie l'operatore. Meglio un menu da aprire
// che un abbinamento sbagliato applicato in silenzio.
export interface ClienteScelta {
  id: string;
  ragione_sociale: string;
  partita_iva: string | null;
  localita: string | null;
  cap: string | null;
}

export function proponiCliente(
  u: UnitaFile,
  clienti: ClienteScelta[],
  tutte: UnitaFile[] = [u],
): string | null {
  const piva = (u.partita_iva || '').replace(/\s/g, '');
  const conPiva = clienti.filter((c) => (c.partita_iva ?? '').replace(/\s/g, '') === piva && piva !== '');
  // Quante unita' del FILE condividono questa P.IVA. Se sono piu' di una, il
  // fatto che in app esista un solo cliente con quella P.IVA non lo rende il
  // cliente giusto: al massimo e' quello giusto per UNA delle unita', e per le
  // altre manca. Proporlo lo stesso fonderebbe due sedi in un organigramma solo
  // - il caso Ecodent (Villafranca + Trevenzuolo, squadre di emergenza
  // distinte). Quindi con piu' unita' si passa oltre e si pretende un riscontro
  // sul luogo: sede/citta' o CAP.
  const unitaStessaPiva = tutte.filter(
    (x) => (x.partita_iva || '').replace(/\s/g, '') === piva).length;
  if (conPiva.length === 1 && unitaStessaPiva <= 1) return conPiva[0]!.id;
  const sede = chiave(u.sede);
  const citta = chiave(u.citta);
  const perLuogo = conPiva.filter((c) => {
    const loc = chiave(c.localita ?? '');
    return (loc !== '' && (loc === sede || loc === citta))
      || (!!u.cap && (c.cap ?? '').trim() === u.cap.trim());
  });
  return perLuogo.length === 1 ? perLuogo[0]!.id : null;
}

export async function caricaClientiScelta(): Promise<ClienteScelta[]> {
  const { data, error } = await supabase
    .from('cliente')
    .select('id, ragione_sociale, partita_iva, localita, cap')
    .eq('attivo', true)
    .order('ragione_sociale');
  if (error) throw error;
  return (data ?? []) as ClienteScelta[];
}

// ============================ [3] RICONCILIAZIONE ============================

// Chiave di idempotenza: identifica la RIGA DI ORIGINE, non il record che ne
// nasce. Si usa il testo del corso e non il codice mappato di proposito: se
// domani un alias viene rimappato su un altro codice, lo stesso attestato reale
// deve restare UNA riga e non diventarne due.
export const chiaveImport = (r: RigaGestionale): string =>
  `gest:${r.cf}:${r.corso_norm}:${r.data ?? ''}`;

export async function chiaviGiaImportate(chiavi: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  // `in` su liste lunghe va spezzato: l'URL della query ha un limite.
  for (let i = 0; i < chiavi.length; i += 200) {
    const blocco = chiavi.slice(i, i + 200);
    const { data, error } = await supabase
      .from('formazione').select('import_key').in('import_key', blocco);
    if (error) throw error;
    for (const r of (data ?? []) as { import_key: string }[]) out.add(r.import_key);
  }
  return out;
}

export interface ContestoRiconcilia {
  alias: CorsoAlias[];
  corsi: CorsoCatalogo[];
  personeCliente: Persona[];
  chiaviPresenti: Set<string>;
}

export function riconciliaUnita(
  unita: UnitaFile,
  clienteId: string | null,
  ctx: ContestoRiconcilia,
): EsitoUnita {
  const byAlias = new Map(ctx.alias.map((a) => [a.testo_gestionale, a]));
  const byCodice = new Map(ctx.corsi.map((c) => [c.codice, c]));
  const byCf = new Map(
    ctx.personeCliente
      .filter((p) => p.codice_fiscale)
      .map((p) => [p.codice_fiscale!.trim().toUpperCase(), p]),
  );

  const out: EsitoUnita = {
    unita, cliente_id: clienteId, nuove: [], gia_presenti: 0, ignorate: 0,
    senza_alias: [], senza_codice: [], personeMancanti: [], oreInsufficienti: [],
  };
  const mancanti = new Map<string, PersonaMancante>();
  const sa = new Set<string>();
  const sc = new Set<string>();

  for (const r of unita.righe) {
    const a = byAlias.get(r.corso_norm);
    if (!a) { sa.add(r.corso); continue; }
    if (a.ignorato) { out.ignorate++; continue; }
    if (!a.corso_codice) { sc.add(r.corso); continue; }

    const key = chiaveImport(r);
    if (ctx.chiaviPresenti.has(key)) { out.gia_presenti++; continue; }

    const persona = byCf.get(r.cf);
    if (!persona) {
      const m = mancanti.get(r.cf) ?? {
        cf: r.cf, cognome: r.cognome, nome: r.nome,
        mansione: r.mansione, data_assunzione: r.data_assunzione, righe: 0,
      };
      m.righe++;
      mancanti.set(r.cf, m);
    }

    const corso = byCodice.get(a.corso_codice);
    // Ore dovute: quelle dell'aggiornamento se la riga e' un aggiornamento.
    // `corso.ore` e' null sui corsi a ore variabili (LAV_SPEC dipende dal
    // rischio): li' non si segnala nulla invece di inventare un confronto.
    const dovute = a.is_aggiornamento
      ? (corso?.ore_aggiornamento ?? null)
      : (corso?.ore ?? null);

    const v: VoceImport = {
      riga: r,
      persona_id: persona?.id ?? null,
      corso_codice: a.corso_codice,
      is_aggiornamento: a.is_aggiornamento,
      pregressa: a.pregressa,
      parziale: a.parziale,
      import_key: key,
      ore_dovute: dovute,
    };
    out.nuove.push(v);
    if (dovute != null && r.ore != null && r.ore < dovute) out.oreInsufficienti.push(v);
  }

  out.senza_alias = [...sa].sort();
  out.senza_codice = [...sc].sort();
  out.personeMancanti = [...mancanti.values()].sort(
    (x, y) => (x.cognome + x.nome).localeCompare(y.cognome + y.nome));
  return out;
}

// ============================ [4] APPLICAZIONE ============================

// Marcatore delle evidenze di vecchio regime: stesso usato dal back-office, cosi'
// il motore mostra la dicitura originale al posto del nome modulare ASR 2025.
const MARCA_PREGRESSA = 'Evidenza pregressa';

export interface OpzioniApplica {
  creaPersone: boolean;         // crea le persone mancanti dell'unita'
}

export interface RisultatoApplica {
  personeCreate: number;
  formazioniInserite: number;
  saltatePerPersona: number;    // righe orfane lasciate indietro
}

export async function applicaUnita(
  esito: EsitoUnita,
  opz: OpzioniApplica,
): Promise<RisultatoApplica> {
  const res: RisultatoApplica = { personeCreate: 0, formazioniInserite: 0, saltatePerPersona: 0 };
  if (!esito.cliente_id) throw new Error('Unita’ senza cliente abbinato.');

  // 1) persone mancanti. Si creano PRIMA, cosi' le righe che le riguardano
  //    trovano l'id. Il livello di rischio resta null: e' un dato del cliente o
  //    una scelta del consulente, non qualcosa che l'export sappia.
  const idPerCf = new Map<string, string>();
  if (opz.creaPersone) {
    for (const m of esito.personeMancanti) {
      const p: Persona = {
        id: newId(),
        cliente_id: esito.cliente_id,
        nome: m.nome,
        cognome: m.cognome || null,
        codice_fiscale: m.cf,
        mansione: m.mansione || null,
        reparto: null,
        data_assunzione: m.data_assunzione,
        livello_rischio: null,
        attivo: true,
        note: null,
        formazione_pregressa: false,
      };
      const salvata = await salvaPersona(p);
      idPerCf.set(m.cf, salvata.id);
      res.personeCreate++;
    }
  }

  // 2) attestati. Insert in blocco: sono decine per unita' e una upsert per
  //    riga moltiplicherebbe i round-trip senza guadagno.
  const righe: Record<string, unknown>[] = [];
  for (const v of esito.nuove) {
    const personaId = v.persona_id ?? idPerCf.get(v.riga.cf) ?? null;
    if (!personaId) { res.saltatePerPersona++; continue; }
    righe.push({
      id: newId(),
      persona_id: personaId,
      corso_codice: v.corso_codice,
      // Il nome VERO del corso come lo chiama il gestionale, non quello a
      // catalogo: sulle evidenze pregresse il motore mostra questa dicitura.
      corso_nome: v.riga.corso,
      categoria: null,
      data_completamento: v.riga.data,
      ore: v.riga.ore,
      ente_formatore: null,
      is_aggiornamento: v.is_aggiornamento,
      parziale: v.parziale,
      // Scadenza calcolata dal motore su data + aggiornamento_mesi: scriverla
      // qui la congelerebbe, e un cambio di catalogo non la aggiornerebbe piu'.
      scadenza: null,
      allegato_url: null,
      note: v.pregressa ? MARCA_PREGRESSA + ' (import gestionale)' : null,
      import_key: v.import_key,
    });
  }
  for (let i = 0; i < righe.length; i += 200) {
    const blocco = righe.slice(i, i + 200);
    // `insert` e non `upsert`: l'indice di idempotenza della 055 e' PARZIALE
    // (`where import_key is not null`) e ON CONFLICT non aggancia gli indici
    // parziali - PostgREST non permette di passarne il predicato, quindi un
    // upsert fallirebbe con "no unique or exclusion constraint matching".
    // L'idempotenza la garantisce il filtro a monte su `chiaviGiaImportate`;
    // l'indice resta la rete di sicurezza e, nel caso limite di due import
    // lanciati insieme, il secondo fallisce a voce alta invece di duplicare.
    const { error } = await supabase.from('formazione').insert(blocco);
    if (error) throw error;
    res.formazioniInserite += blocco.length;
  }
  return res;
}

// Comodita' per la UI: un solo modulo da cui importare tutto il necessario.
export { caricaAlias } from './aliasCorsi';
