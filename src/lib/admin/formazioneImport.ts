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
  // L'attestato documenta solo una parte del percorso (mig. 060): il requisito
  // resta assolto, ma resta da recuperare il pezzo mancante. `nota` dice quale.
  evidenza_incompleta: boolean;
  nota: string | null;
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
  // Righe che il dizionario marca come SPEZZONE: da sole non assolvono il
  // requisito. Vanno dette qui e non scoperte mesi dopo - il pezzo che manca
  // spesso e' un modulo e-learning di cui nessuno ha piu' la data se non lo si
  // chiede subito (caso vero: integrazione preposti 3h in aula, coda di un
  // corso le cui prime 5h erano a distanza).
  spezzoni: VoceImport[];
  // Attestati che documentano solo una parte del percorso: il requisito e'
  // assolto, ma agli atti manca un pezzo e va recuperato finche' qualcuno se ne
  // ricorda. Dopo l'import diventano voci in "Cose da fare".
  incomplete: VoceImport[];
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
export interface Luogo {
  localita: string | null;
  cap: string | null;
}

export interface ClienteScelta {
  id: string;
  ragione_sociale: string;
  partita_iva: string | null;
  // Anagrafica del cliente = la sede LEGALE. Per un'azienda con piu' stabilimenti
  // e' identica su tutti i clienti che la rappresentano: da sola non li separa.
  localita: string | null;
  cap: string | null;
  // Sede OPERATIVA attiva (mig. 054), se c'e'. E' il luogo dove si lavora, ed e'
  // quello che l'export del gestionale chiama "Sede": due clienti Ecodent hanno
  // la stessa sede legale e sedi operative diverse, quindi e' l'unico dato che
  // li distingue - sia per l'abbinamento sia per l'occhio di chi apre la tendina.
  operativa: Luogo | null;
}

// Etichetta della tendina. Mostra il luogo che DISTINGUE (l'operativa se c'e')
// e il CAP: senza, due clienti della stessa azienda compaiono come due voci
// identiche e la scelta a mano diventa un tiro a indovinare.
export function etichettaCliente(c: ClienteScelta): string {
  const l = c.operativa ?? { localita: c.localita, cap: c.cap };
  const dove = [l.localita, l.cap ? `(${l.cap})` : ''].filter(Boolean).join(' ').trim();
  return c.ragione_sociale + (dove ? ` — ${dove}` : '');
}

// Divergenze fra il luogo del cliente scelto e lo stabilimento del file. Non
// bloccano: l'abbinamento puo' essere giusto lo stesso e il gestionale non e' la
// fonte di verita' dell'anagrafica. Ma un CAP sbagliato in anagrafica non si
// vede da nessuna parte finche' non sposta un abbinamento in silenzio - qui lo
// si ha sotto gli occhi accanto ai dati veri, ed e' il momento buono per dirlo.
export function incoerenzeLuogo(u: UnitaFile, c: ClienteScelta): string[] {
  const l = c.operativa ?? { localita: c.localita, cap: c.cap };
  const dove = c.operativa ? 'sede operativa' : 'anagrafica';
  const out: string[] = [];
  const capApp = (l.cap ?? '').trim();
  if (u.cap && capApp && capApp !== u.cap.trim()) {
    out.push(`CAP ${capApp} in ${dove}, ${u.cap} nel file`);
  }
  const loc = chiave(l.localita ?? '');
  if (loc !== '' && loc !== chiave(u.sede) && loc !== chiave(u.citta)) {
    out.push(`localita' "${l.localita}" in ${dove}, "${u.citta || u.sede}" nel file`);
  }
  return out;
}

// I luoghi su cui un cliente puo' agganciare, in ordine di forza.
const luoghiCliente = (c: ClienteScelta): { operativa: Luogo | null; legale: Luogo } => ({
  operativa: c.operativa,
  legale: { localita: c.localita, cap: c.cap },
});

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

  // Riscontro sul luogo. Si guarda PRIMA la sede operativa e solo dopo la
  // legale, e non e' un dettaglio di priorita': la riga del file descrive uno
  // stabilimento, e per un'azienda multi-sede la legale e' identica ovunque -
  // cercare li' per primi vuol dire trovare due clienti buoni uguali e non
  // proporre niente, pur avendo in mano il dato che li separa. Se l'operativa
  // decide, si e' finito; se nessuno ha operativa (cliente a sede unica) si
  // ricade sull'anagrafica, che li' e' proprio il luogo di lavoro.
  const sede = chiave(u.sede);
  const citta = chiave(u.citta);
  const combacia = (l: Luogo | null): boolean => {
    if (!l) return false;
    const loc = chiave(l.localita ?? '');
    if (loc !== '' && (loc === sede || loc === citta)) return true;
    // Il CAP da solo puo' agganciare - serve quando la localita' e' scritta in
    // forma abbreviata ("Villafranca V.se" per "Villafranca di Verona") - ma
    // NON quando la localita' in app dice apertamente un altro paese: li' un
    // CAP che combacia e' quasi sempre un errore di digitazione, e fidarsene
    // significa mandare gli attestati di uno stabilimento sull'altro. Il
    // riscontro e' sulla prima parola, che le abbreviazioni conservano sempre.
    if (!u.cap || (l.cap ?? '').trim() !== u.cap.trim()) return false;
    if (loc === '') return true;
    const p = loc.split(' ')[0] ?? '';
    return p !== '' && (p === sede.split(' ')[0] || p === citta.split(' ')[0]);
  };

  const perOperativa = conPiva.filter((c) => combacia(luoghiCliente(c).operativa));
  if (perOperativa.length === 1) return perOperativa[0]!.id;
  if (perOperativa.length > 1) return null;   // ambiguo davvero: decide l'operatore

  // Nel ripiego sulla legale si scartano i clienti che HANNO una sede operativa:
  // se ce l'hanno, e' li' che si lavora e la legale non e' un indirizzo di
  // lavoro (per questo la si aggiunge - il caso del commercialista). Senza
  // questa esclusione l'azienda con due stabilimenti e una sola sede legale
  // resterebbe ambigua per sempre: la sede legale combacia con tutti.
  const perLegale = conPiva.filter((c) => !c.operativa && combacia(luoghiCliente(c).legale));
  return perLegale.length === 1 ? perLegale[0]!.id : null;
}

// Proposte per TUTTE le unita' del file in un colpo solo, ed e' il punto: la
// proposta per unita' non basta a garantire che due unita' non finiscano sullo
// stesso cliente. Il passo sul luogo puo' arrivarci per due strade diverse -
// Villafranca aggancia per localita', Trevenzuolo per CAP, se il cliente in app
// tiene la localita' di una sede e il CAP dell'altra (caso reale: un cliente ha
// UN solo campo CAP, quello della sede legale). Il risultato sarebbe un
// abbinamento sbagliato gia' scritto nella tendina, che nessuno ha scelto e che
// si legge come una conferma. Quindi: se un cliente risulta proposto a piu' di
// una unita', la proposta si ritira per tutte e decide l'operatore.
export function proponiAbbinamenti(
  unita: UnitaFile[],
  clienti: ClienteScelta[],
): Record<string, string> {
  const prop = new Map<string, string | null>();
  const quante = new Map<string, number>();
  for (const u of unita) {
    const id = proponiCliente(u, clienti, unita);
    prop.set(u.chiave, id);
    if (id) quante.set(id, (quante.get(id) ?? 0) + 1);
  }
  const out: Record<string, string> = {};
  for (const u of unita) {
    const id = prop.get(u.chiave) ?? null;
    out[u.chiave] = id && (quante.get(id) ?? 0) === 1 ? id : '';
  }
  return out;
}

export async function caricaClientiScelta(): Promise<ClienteScelta[]> {
  const { data, error } = await supabase
    .from('cliente')
    .select('id, ragione_sociale, partita_iva, localita, cap')
    .eq('attivo', true)
    .order('ragione_sociale');
  if (error) throw error;
  const clienti = (data ?? []) as Omit<ClienteScelta, 'operativa'>[];

  // Sedi operative attive (`principale = false`): una per cliente nel modello a
  // un solo organigramma. Query separata e non join annidata: PostgREST la
  // renderebbe come array da appiattire comunque, e cosi' resta leggibile.
  const { data: sedi, error: errSedi } = await supabase
    .from('sede')
    .select('cliente_id, localita, cap')
    .eq('attivo', true)
    .eq('principale', false);
  if (errSedi) throw errSedi;
  const perCliente = new Map<string, Luogo>();
  for (const s of (sedi ?? []) as { cliente_id: string; localita: string | null; cap: string | null }[]) {
    if (!perCliente.has(s.cliente_id)) perCliente.set(s.cliente_id, { localita: s.localita, cap: s.cap });
  }
  return clienti.map((c) => ({ ...c, operativa: perCliente.get(c.id) ?? null }));
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
    spezzoni: [], incomplete: [],
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
      evidenza_incompleta: a.evidenza_incompleta,
      nota: a.note,
      import_key: key,
      ore_dovute: dovute,
    };
    out.nuove.push(v);
    if (v.evidenza_incompleta) out.incomplete.push(v);
    if (v.parziale) out.spezzoni.push(v);
    // Uno spezzone ha per definizione meno ore di quelle dovute: segnalarlo due
    // volte direbbe due problemi dove ce n'e' uno, e quello vero e' l'altro.
    else if (dovute != null && r.ore != null && r.ore < dovute) out.oreInsufficienti.push(v);
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
  assegnaLavoratore: boolean;   // ...e le mette in organigramma come Lavoratori
}

export interface RisultatoApplica {
  personeCreate: number;
  nomineCreate: number;
  formazioniInserite: number;
  saltatePerPersona: number;    // righe orfane lasciate indietro
}

export async function applicaUnita(
  esito: EsitoUnita,
  opz: OpzioniApplica,
): Promise<RisultatoApplica> {
  const res: RisultatoApplica = {
    personeCreate: 0, nomineCreate: 0, formazioniInserite: 0, saltatePerPersona: 0,
  };
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
        data_cessazione: null,
        livello_rischio: null,
        attivo: true,
        note: null,
        formazione_pregressa: false,
      };
      const salvata = await salvaPersona(p);
      idPerCf.set(m.cf, salvata.id);
      res.personeCreate++;
    }

    // 1-bis) ...e entrano nell'organigramma come LAVORATORI. Non e' un extra: le
    // figure di una persona si ricavano dalle sue nomine, e senza nomine non ha
    // figure, quindi nessun requisito - e la formazione l'app la mostra solo
    // appesa a un requisito. Importare gli attestati senza questo passo lascia
    // righe scritte e invisibili, e lo scadenzario muto. Ogni dipendente e'
    // comunque un lavoratore (art. 37) e per questa figura non e' dovuto un atto
    // di nomina, quindi non si sta dando per fatto un adempimento che non c'e'.
    // Solo per le persone appena create: chi era gia' in organigramma ha i suoi
    // ruoli, decisi da qualcuno, e non si tocca.
    if (opz.assegnaLavoratore && idPerCf.size > 0) {
      const dataPerCf = new Map<string, string | null>(
        esito.personeMancanti.map((m) => [m.cf, m.data_assunzione] as [string, string | null]));
      const nomine = [...idPerCf.entries()].map(([cf, personaId]) => ({
        id: newId(),
        persona_id: personaId,
        figura_codice: 'lavoratore',
        // La data di assunzione quando il file ce l'ha: e' da li' che decorrono
        // gli obblighi formativi del lavoratore, non dal giorno dell'import.
        data_nomina: dataPerCf.get(cf) ?? null,
        attiva: true,
        note: null,
      }));
      const { error } = await supabase.from('nomina').insert(nomine);
      if (error) throw error;
      res.nomineCreate = nomine.length;
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
      evidenza_incompleta: v.evidenza_incompleta,
      // Scadenza calcolata dal motore su data + aggiornamento_mesi: scriverla
      // qui la congelerebbe, e un cambio di catalogo non la aggiornerebbe piu'.
      scadenza: null,
      allegato_url: null,
      // La nota del dizionario viaggia con l'attestato: e' li' che spiega cosa
      // manca ("prime 5h in e-learning"), e senza copiarla l'avviso in libretto e
      // la voce in Cose da fare direbbero solo "manca qualcosa".
      note: [
        v.pregressa ? MARCA_PREGRESSA + ' (import gestionale)' : null,
        v.nota,
      ].filter(Boolean).join(' · ') || null,
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
