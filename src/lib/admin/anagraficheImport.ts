// Import massivo delle ANAGRAFICHE: clienti e risorse umane, da un Excel/CSV.
//
// Perche' esiste, accanto agli import che c'erano gia':
//  * `werpImport.ts` crea clienti, ma dentro una pipeline a 7 stadi che porta
//    con se' contratti, incarichi e sopralluoghi: per rifare le sole anagrafiche
//    non e' utilizzabile;
//  * `formazioneImport.ts` sa creare le PERSONE mancanti, ma solo come effetto
//    collaterale degli attestati, e per scelta non crea i clienti;
//  * il pannello dentro Risorse Umane importa le persone di UN cliente alla
//    volta: per rifare la base di sette clienti si ricomincia sette volte.
// Qui l'ingresso e' uno solo e prende un file per volta: o un elenco di clienti,
// o un elenco di persone con dentro la colonna che dice a quale cliente vanno.
//
// DUE PRINCIPI, ereditati dal resto dell'app:
//  1. DRY-RUN. `pianifica*` non scrive niente: calcola un piano con gli id gia'
//     generati, che l'operatore vede e conferma. `applica*` scrive quel piano,
//     per upsert su id, quindi rieseguirlo non duplica.
//  2. MERGE NON DISTRUTTIVO (filosofia C di werpImport): su un cliente che
//     esiste gia' si riempiono solo i campi VUOTI. Un file non sa cosa e' stato
//     corretto a mano dopo, e non deve poterlo sovrascrivere.
//
// COSA IL FILE NON PUO' DARE. Livello antincendio e gruppo di primo soccorso
// non discendono da nessuna colonna: si scelgono, e l'app registra pure il
// perche'. Il cliente nato da qui e' quindi INCOMPLETO, e il piano lo dice voce
// per voce invece di lasciarlo scoprire mesi dopo. Il livello di rischio fa
// eccezione: NON e' una deduzione arbitraria ma la tabella dell'Allegato IV
// ASR 17/04/2025 (`formazione/ateco.ts`), la stessa che l'anagrafica applica da
// sempre scegliendo la divisione ATECO.
//
// UNA RIGA = UN CLIENTE, anche a parita' di P.IVA. Due stabilimenti della stessa
// societa' sono due clienti distinti (deciso 2026-07-31 sul caso Ecodent: un
// cliente = un organigramma, e gli addetti alle emergenze si designano per
// LUOGO di lavoro). `cliente.partita_iva` non ha vincolo di unicita' apposta.

import * as XLSX from 'xlsx';
import { supabase } from '../supabase';
import { caricaClienti, clienteVuoto, salvaCliente } from './anagrafiche';
import { salvaPersona, attivoDopoCessazione, type Persona } from './formazione';
// Tendina e abbinamento riusano il vocabolario dell'import formazione: li' e'
// gia' risolto il caso che qui si ripresenterebbe uguale - due clienti della
// stessa azienda hanno la STESSA sede legale, e solo la sede operativa li
// distingue, in tendina come nel match.
import { caricaClientiScelta, etichettaCliente, type ClienteScelta } from './formazioneImport';
import { risolviAteco, type AtecoDivisione } from '../../formazione/ateco';
import { valido as cfValido, pulisci as cfPulisci } from '../../formazione/codiceFiscale';
import { newId, type Cliente } from '../types';

// ============================ [1] LETTURA ============================

const S = (v: unknown): string => (v == null ? '' : String(v)).trim();

// Chiave di intestazione: minuscole, senza accenti, senza punteggiatura ne'
// spazi. Le intestazioni dei gestionali non sono stabili nemmeno dentro lo
// stesso export ("P.iva" e "P.IVA" convivono), quindi il confronto e' su questa.
export const normHeader = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// Nome d'azienda normalizzato per il confronto: come in werpImport, maiuscolo,
// spazi collassati, punti finali via. Nessuna rimozione delle forme giuridiche:
// "ROSSI SRL" e "ROSSI SNC" sono due societa' diverse, non due grafie.
const normNome = (s: unknown): string =>
  S(s).replace(/\s+/g, ' ').toUpperCase().replace(/\.+$/, '').trim();

// La colonna CF degli export gestionali contiene indifferentemente la P.IVA
// (11 cifre) o il codice fiscale (16 caratteri). Stessa regola di werpImport.
function pivaCf(v: string): { piva: string | null; codf: string | null } {
  const s = S(v).toUpperCase().replace(/\s/g, '');
  if (/^\d{11}$/.test(s)) return { piva: s, codf: null };
  if (/^[A-Z0-9]{16}$/.test(s)) return { piva: null, codf: s };
  return { piva: null, codf: null };
}

// Data da cella: Date (cellDates), seriale Excel, oppure stringa dd/mm/yyyy o
// yyyy-mm-dd. I seriali si formattano in UTC: costruire una Date locale
// sposterebbe il giorno indietro nei fusi a est (stessa cura di formazioneImport).
export function isoData(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())).toISOString().slice(0, 10);
  }
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  }
  const s = S(v);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const d = m[1]!.padStart(2, '0'), mo = m[2]!.padStart(2, '0');
    const y = m[3]!.length === 2 ? '20' + m[3] : m[3];
    return `${y}-${mo}-${d}`;
  }
  return null;
}

export type TipoFoglio = 'clienti' | 'persone' | 'incerto';

export interface Foglio {
  nomeFile: string;
  rigaHeader: number;            // 1-based, per i messaggi
  intestazioni: string[];        // testi originali dell'header
  righe: RigaFoglio[];
  tipo: TipoFoglio;
  motivoTipo: string;
  riconosciute: string[];        // intestazioni che l'app sa usare
  ignorate: string[];            // presenti nel file ma senza uso: dette, non taciute
}

export interface RigaFoglio {
  n: number;                                  // numero di riga nel foglio, 1-based
  col: Record<string, unknown>;               // chiave = intestazione normalizzata
}

// Vocabolario delle colonne. Ogni campo elenca i sinonimi accettati, in ordine
// di preferenza; il primo che ha un valore vince.
const COL_CLIENTE: Record<string, string[]> = {
  ragione_sociale: ['ragionesociale', 'denominazione', 'cliente', 'azienda', 'societa', 'dittaosocieta', 'nomeazienda'],
  partita_iva: ['partitaiva', 'piva', 'pi', 'vat'],
  codice_fiscale: ['codicefiscale', 'cfiscale', 'cfazienda'],
  cf_ambiguo: ['cf'],           // colonna degli export gestionali: P.IVA oppure CF
  codice_ateco: ['codiceateco', 'ateco', 'attivitaprevalente', 'atecoprevalente'],
  indirizzo: ['indirizzo', 'via', 'sedelegale', 'indirizzosedelegale'],
  cap: ['cap'],
  localita: ['localita', 'citta', 'comune', 'paese'],
  provincia: ['provincia', 'prov', 'pr', 'siglaprovincia'],
  email: ['email', 'mail', 'pec', 'indirizzopec', 'emailpec'],
  telefono: ['telefono', 'tel', 'telefono1', 'cellulare'],
  referente: ['referente', 'contatto', 'referentetecnico'],
  numero_lavoratori: ['numerolavoratori', 'nlavoratori', 'lavoratori', 'dipendenti', 'addetti', 'numeroaddetti', 'numerodipendenti'],
};

const COL_PERSONA: Record<string, string[]> = {
  cognome: ['cognome'],
  nome: ['nome', 'nominativo', 'dipendente', 'cognomeenome', 'nomecognome', 'nominativocompleto'],
  codice_fiscale: ['codicefiscale', 'cf', 'cfiscale'],
  mansione: ['mansione', 'ruolo', 'qualifica', 'profilo', 'profiloprofessionale'],
  reparto: ['reparto', 'area', 'settore', 'ufficio'],
  data_assunzione: ['dataassunzione', 'assunzione', 'dataassunz', 'datadiassunzione', 'datainizio'],
  data_cessazione: ['datacessazione', 'cessazione', 'datafine', 'datadicessazione'],
  // colonne che dicono A QUALE CLIENTE va la persona
  cliente_piva: ['partitaiva', 'piva', 'pi'],
  cliente_nome: ['ragionesociale', 'societa', 'azienda', 'cliente', 'denominazione'],
  cliente_sede: ['sede', 'unitalocale', 'stabilimento', 'unita'],
};

const valore = (col: Record<string, unknown>, sinonimi: string[]): unknown => {
  for (const k of sinonimi) {
    const v = col[k];
    if (v != null && S(v) !== '') return v;
  }
  return null;
};
const testo = (col: Record<string, unknown>, sinonimi: string[]): string => S(valore(col, sinonimi));

// Riconoscimento del tipo di file dalle sole intestazioni. Serve perche'
// l'ingresso e' uno solo: si carica il file e l'app dice cosa ci ha visto,
// invece di chiedere all'operatore di dichiararlo e sbagliare in silenzio se
// non combacia.
function riconosciTipo(chiavi: Set<string>): { tipo: TipoFoglio; motivo: string } {
  const ha = (sin: string[]) => sin.some((k) => chiavi.has(k));
  // Il segno inequivocabile delle persone e' una colonna anagrafica personale.
  const segniPersona = [
    ha(COL_PERSONA.cognome!) ? 'Cognome' : '',
    ha(COL_PERSONA.mansione!) ? 'Mansione' : '',
    ha(COL_PERSONA.data_assunzione!) ? 'Data assunzione' : '',
  ].filter(Boolean);
  const segniCliente = [
    ha(COL_CLIENTE.codice_ateco!) ? 'ATECO' : '',
    ha(COL_CLIENTE.numero_lavoratori!) ? 'Numero lavoratori' : '',
    ha(COL_CLIENTE.ragione_sociale!) ? 'Ragione sociale' : '',
  ].filter(Boolean);

  if (segniPersona.length > 0) {
    return { tipo: 'persone', motivo: `colonne di persona trovate: ${segniPersona.join(', ')}` };
  }
  if (segniCliente.length > 0) {
    return { tipo: 'clienti', motivo: `colonne di azienda trovate: ${segniCliente.join(', ')}` };
  }
  return {
    tipo: 'incerto',
    motivo: 'nessuna colonna riconosciuta: attese Ragione sociale / ATECO per i clienti, Cognome / Mansione per le persone',
  };
}

// L'header non e' sempre la prima riga: l'export "Ricerca Visite/Formazioni" ha
// un titolo e una riga vuota davanti. Si prende, fra le prime 10, la riga che
// riconosce piu' colonne; a parimerito vince la piu' in alto.
function trovaHeader(griglia: unknown[][]): number {
  const tutti = new Set<string>([
    ...Object.values(COL_CLIENTE).flat(), ...Object.values(COL_PERSONA).flat(),
  ]);
  let miglior = 0, punteggio = -1;
  for (let i = 0; i < Math.min(10, griglia.length); i++) {
    const celle = (griglia[i] ?? []).map((c) => normHeader(S(c))).filter(Boolean);
    if (celle.length === 0) continue;
    const p = celle.filter((c) => tutti.has(c)).length;
    if (p > punteggio) { punteggio = p; miglior = i; }
  }
  return miglior;
}

export async function leggiFoglio(file: File): Promise<Foglio> {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]!];
  if (!ws) throw new Error('Il file non contiene fogli leggibili.');
  // `blankrows: true` di proposito: le righe vuote si saltano piu' sotto, ma
  // devono restare nel conteggio. Il numero di riga che l'anteprima stampa e'
  // quello che si legge nella barra laterale di Excel - se salta le vuote,
  // "riga 6 scartata" manda a guardare la riga sbagliata.
  const griglia = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: true });
  if (griglia.length < 2) throw new Error("Il foglio e' vuoto o ha la sola intestazione.");

  const iH = trovaHeader(griglia);
  const intestazioni = (griglia[iH] ?? []).map((c) => S(c));
  const chiavi = intestazioni.map(normHeader);

  const righe: RigaFoglio[] = [];
  for (let i = iH + 1; i < griglia.length; i++) {
    const r = griglia[i] ?? [];
    const col: Record<string, unknown> = {};
    chiavi.forEach((k, j) => { if (k && col[k] === undefined) col[k] = r[j]; });
    // riga tutta vuota: fuori senza contarla fra le scartate
    if (Object.values(col).every((v) => S(v) === '')) continue;
    righe.push({ n: i + 1, col });
  }

  const set = new Set(chiavi.filter(Boolean));
  const { tipo, motivo } = riconosciTipo(set);
  const usate = new Set((tipo === 'persone' ? Object.values(COL_PERSONA) : Object.values(COL_CLIENTE)).flat());
  const riconosciute: string[] = [];
  const ignorate: string[] = [];
  intestazioni.forEach((h, j) => {
    if (!h) return;
    (usate.has(chiavi[j]!) ? riconosciute : ignorate).push(h);
  });

  return {
    nomeFile: file.name, rigaHeader: iH + 1, intestazioni, righe,
    tipo, motivoTipo: motivo, riconosciute, ignorate,
  };
}

// ============================ [2] CLIENTI ============================

export interface VoceCliente {
  riga: number;
  cliente: Cliente;             // gia' fuso con l'esistente: pronto da scrivere
  nuovo: boolean;
  campiTocc: string[];          // campi riempiti su un cliente che c'era gia'
  ateco: AtecoDivisione | null; // divisione riconosciuta -> rischio proposto
  atecoNonRisolto: string | null;
  mancanti: string[];           // cosa resta da compilare a mano: nasce incompleto
  nota: string | null;          // omonimie e altri avvisi
  scelto: boolean;              // l'operatore puo' escludere la singola riga
}

export interface PianoClienti {
  voci: VoceCliente[];
  nuovi: number;
  aggiornati: number;
  invariati: number;            // gia' presenti e gia' completi: nulla da scrivere
  scartate: { riga: number; motivo: string }[];
}

const vuotoNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());

function numeroIntero(v: unknown): number | null {
  if (v == null || S(v) === '') return null;
  const n = Number(S(v).replace(/[^\d-]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function pianificaClienti(f: Foglio, esistenti: Cliente[]): PianoClienti {
  // Indici dei clienti gia' in app. Un cliente puo' essere agganciato da UNA
  // sola riga: due unita' locali con la stessa P.IVA non devono finire tutte e
  // due sullo stesso record (sarebbe la fusione che la decisione del 31/07
  // vieta) - la seconda diventa un cliente nuovo.
  const consumati = new Set<string>();
  const perPiva = new Map<string, Cliente[]>();
  const perNome = new Map<string, Cliente[]>();
  const spingi = (m: Map<string, Cliente[]>, k: string, c: Cliente) => {
    if (!k) return;
    const l = m.get(k); if (l) l.push(c); else m.set(k, [c]);
  };
  for (const c of esistenti) {
    if (c.partita_iva) spingi(perPiva, S(c.partita_iva).toUpperCase(), c);
    if (c.codice_fiscale) spingi(perPiva, S(c.codice_fiscale).toUpperCase(), c);
    spingi(perNome, normNome(c.ragione_sociale), c);
  }

  const luogo = (c: { localita: string | null; indirizzo: string | null }) =>
    normNome(`${c.localita ?? ''} ${c.indirizzo ?? ''}`);

  const voci: VoceCliente[] = [];
  const scartate: { riga: number; motivo: string }[] = [];
  // Righe del file gia' viste, per accorgersi delle unita' omonime nello stesso file.
  const vistiInFile = new Map<string, number>();

  for (const r of f.righe) {
    const nome = testo(r.col, COL_CLIENTE.ragione_sociale!);
    if (!nome) { scartate.push({ riga: r.n, motivo: 'senza ragione sociale' }); continue; }

    let piva = testo(r.col, COL_CLIENTE.partita_iva!).replace(/\s/g, '').toUpperCase() || null;
    let codf = testo(r.col, COL_CLIENTE.codice_fiscale!).replace(/\s/g, '').toUpperCase() || null;
    if (!piva || !codf) {
      const amb = pivaCf(testo(r.col, COL_CLIENTE.cf_ambiguo!));
      piva = piva ?? amb.piva;
      codf = codf ?? amb.codf;
    }

    const localita = vuotoNull(testo(r.col, COL_CLIENTE.localita!));
    const indirizzo = vuotoNull(testo(r.col, COL_CLIENTE.indirizzo!));

    // match: P.IVA, poi CF, poi ragione sociale. Fra piu' candidati con la
    // stessa chiave si preferisce quello che sta nello stesso luogo.
    const candidati = [
      ...(piva ? perPiva.get(piva) ?? [] : []),
      ...(codf ? perPiva.get(codf) ?? [] : []),
      ...(perNome.get(normNome(nome)) ?? []),
    ].filter((c) => !consumati.has(c.id));
    const mio = luogo({ localita, indirizzo });
    const stessoLuogo = mio ? candidati.find((c) => luogo(c) === mio) : undefined;
    const trovato = stessoLuogo ?? candidati[0] ?? null;

    const nuovo = !trovato;
    const cliente: Cliente = trovato ? { ...trovato } : { ...clienteVuoto(), ragione_sociale: nome };
    if (trovato) consumati.add(trovato.id);

    // MERGE NON DISTRUTTIVO: si riempiono solo i campi vuoti.
    const campiTocc: string[] = [];
    const campi = cliente as unknown as Record<string, unknown>;
    const set = (k: keyof Cliente, v: string | number | null) => {
      if (v == null || v === '') return;
      if (S(campi[k]) !== '') return;
      campi[k] = v;
      if (!nuovo) campiTocc.push(k);
    };
    set('partita_iva', piva);
    set('codice_fiscale', codf);
    set('indirizzo', indirizzo);
    set('cap', vuotoNull(testo(r.col, COL_CLIENTE.cap!)));
    set('localita', localita);
    set('provincia', vuotoNull(testo(r.col, COL_CLIENTE.provincia!).toUpperCase().slice(0, 2)));
    set('email', vuotoNull(testo(r.col, COL_CLIENTE.email!)));
    set('telefono', vuotoNull(testo(r.col, COL_CLIENTE.telefono!)));
    set('referente', vuotoNull(testo(r.col, COL_CLIENTE.referente!)));
    set('numero_lavoratori', numeroIntero(valore(r.col, COL_CLIENTE.numero_lavoratori!)));

    // ATECO -> livello di rischio. Non e' una deduzione: e' l'Allegato IV ASR
    // 17/04/2025, la stessa tabella che l'anagrafica applica a mano. Come nel
    // form, si memorizza la DIVISIONE a due cifre, non il codice completo.
    const atecoTesto = testo(r.col, COL_CLIENTE.codice_ateco!);
    const ateco = risolviAteco(atecoTesto);
    let atecoNonRisolto: string | null = null;
    if (ateco) {
      set('codice_ateco', ateco.divisione);
      if (cliente.livello_rischio == null) {
        cliente.livello_rischio = ateco.livello;
        if (!nuovo) campiTocc.push('livello_rischio');
      }
    } else if (atecoTesto) {
      atecoNonRisolto = atecoTesto;
    }

    // Cosa resta scoperto. Sono i dati che cambiano l'esito e che il file non
    // ha: si chiedono, non si inducono.
    const mancanti: string[] = [];
    if (!cliente.codice_ateco) mancanti.push('ATECO');
    if (!cliente.livello_rischio) mancanti.push('livello di rischio');
    if (!cliente.livello_antincendio) mancanti.push('livello antincendio');
    if (!cliente.gruppo_primo_soccorso) mancanti.push('gruppo primo soccorso');
    if (cliente.numero_lavoratori == null) mancanti.push('numero lavoratori');

    // Omonimie dentro il file: due righe con la stessa P.IVA sono due unita', e
    // restano due clienti. Va detto, perche' in tendina si assomiglieranno.
    let nota: string | null = null;
    const chiaveFile = piva ?? codf ?? normNome(nome);
    const prima = vistiInFile.get(chiaveFile);
    if (prima != null) {
      nota = `stessa P.IVA/denominazione della riga ${prima}: resta un cliente distinto (un cliente = un organigramma)`;
    } else {
      vistiInFile.set(chiaveFile, r.n);
    }

    voci.push({
      riga: r.n, cliente, nuovo, campiTocc, ateco, atecoNonRisolto, mancanti, nota,
      scelto: nuovo || campiTocc.length > 0,
    });
  }

  return {
    voci,
    nuovi: voci.filter((v) => v.nuovo).length,
    aggiornati: voci.filter((v) => !v.nuovo && v.campiTocc.length > 0).length,
    invariati: voci.filter((v) => !v.nuovo && v.campiTocc.length === 0).length,
    scartate,
  };
}

// Scrive i clienti scelti. `salvaCliente` fa da se' il write-through alla sede
// legale (mig. 054), quindi qui non si tocca la tabella `sede`.
export async function applicaClienti(voci: VoceCliente[]): Promise<number> {
  let n = 0;
  for (const v of voci) {
    if (!v.scelto) continue;
    await salvaCliente(v.cliente);
    n++;
  }
  return n;
}

// ============================ [3] PERSONE ============================

export interface VocePersona {
  riga: number;
  persona: Persona;
  nuova: boolean;
  cfNonValido: boolean;
}

// Un gruppo del file = tutte le righe che dichiarano lo stesso cliente. E'
// l'unita' di conferma: l'abbinamento gruppo -> cliente lo decide l'operatore,
// come nell'import formazione, perche' la P.IVA da sola non identifica il
// cliente (piu' unita' locali possono condividerla).
export interface GruppoPersone {
  chiave: string;
  etichetta: string;            // come si chiama nel file
  partita_iva: string | null;
  sede: string | null;
  righe: RigaFoglio[];          // le righe del file che compongono il gruppo
  cliente_id: string | null;    // proposto dall'app, modificabile
  motivoAbbinamento: string;
  // Un altro gruppo del file punta allo STESSO cliente. Non e' vietato - puo'
  // essere lo stesso stabilimento scritto in due modi - ma se non lo e', due
  // unita' finiscono in un organigramma solo, con squadre di emergenza contate
  // insieme e nessun modo di accorgersene dopo. Percio' si dice, forte.
  collisione: string | null;
  candidati: { id: string; etichetta: string; motivo: string }[];
  voci: VocePersona[];
  nuove: number;
  aggiornate: number;
  cfNonValidi: number;
  senzaCf: number;
}

export interface PianoPersone {
  gruppi: GruppoPersone[];
  righeLette: number;
  scartate: { riga: number; motivo: string }[];
}

// [3a+3b] Raggruppa le righe per unita' e propone il cliente. Nessuna lettura
// dal database, quindi e' verificabile a tavolino: e' la parte che decide DOVE
// finiscono le persone, ed e' quella che non deve sbagliare in silenzio.
// `abbinamenti` (scelte fatte a mano) ha la precedenza sulla proposta.
export function raggruppaPersone(
  f: Foglio, clienti: ClienteScelta[], abbinamenti: Record<string, string | null> = {},
): { gruppi: GruppoPersone[]; scartate: { riga: number; motivo: string }[] } {
  const perPiva = new Map<string, ClienteScelta[]>();
  const perNome = new Map<string, ClienteScelta[]>();
  for (const c of clienti) {
    if (c.partita_iva) {
      const k = S(c.partita_iva).toUpperCase();
      const l = perPiva.get(k); if (l) l.push(c); else perPiva.set(k, [c]);
    }
    const k = normNome(c.ragione_sociale);
    const l = perNome.get(k); if (l) l.push(c); else perNome.set(k, [c]);
  }

  // [3a] raggruppa le righe per cliente dichiarato
  const grezzi = new Map<string, { piva: string | null; nome: string; sede: string | null; righe: RigaFoglio[] }>();
  const scartate: { riga: number; motivo: string }[] = [];

  for (const r of f.righe) {
    const nome = testo(r.col, COL_PERSONA.nome!);
    const cognome = testo(r.col, COL_PERSONA.cognome!);
    if (!nome && !cognome) { scartate.push({ riga: r.n, motivo: "senza nome ne' cognome" }); continue; }

    const piva = testo(r.col, COL_PERSONA.cliente_piva!).replace(/\s/g, '').toUpperCase() || null;
    const soc = testo(r.col, COL_PERSONA.cliente_nome!);
    const sede = vuotoNull(testo(r.col, COL_PERSONA.cliente_sede!));
    // Chiave = (P.IVA o denominazione) + sede: e' l'UNITA', non la societa'.
    const chiave = `${piva ?? normNome(soc)}|${normNome(sede ?? '')}`;
    const g = grezzi.get(chiave);
    if (g) g.righe.push(r);
    else grezzi.set(chiave, { piva, nome: soc, sede, righe: [r] });
  }

  // [3b] abbina ogni gruppo a un cliente
  const proposte = new Map<string, { cliente: ClienteScelta | null; motivo: string; pool: ClienteScelta[] }>();
  for (const [chiave, g] of grezzi) {
    const daPiva = g.piva ? perPiva.get(g.piva) ?? [] : [];
    const daNome = (perNome.get(normNome(g.nome)) ?? []).filter((c) => !daPiva.includes(c));
    const pool = [...daPiva, ...daNome];

    let proposto: ClienteScelta | null = null;
    let motivo = '';
    if (g.sede) {
      // Con la sede dichiarata si preferisce il cliente che la nomina. Si
      // guarda PRIMA la sede operativa: la legale e' identica su tutti i
      // clienti della stessa azienda, quindi non separa niente (e' il caso
      // Ecodent, due unita' sotto la stessa P.IVA).
      const s = normNome(g.sede);
      proposto = pool.find((c) => normNome(c.operativa?.localita ?? '') === s)
        ?? pool.find((c) => normNome(c.localita ?? '') === s)
        ?? pool.find((c) => normNome(c.ragione_sociale).includes(s))
        ?? null;
      if (proposto) motivo = `sede "${g.sede}" riconosciuta`;
    }
    if (!proposto && pool.length === 1) {
      proposto = pool[0]!;
      motivo = daPiva.length === 1 ? 'P.IVA corrispondente' : 'ragione sociale corrispondente';
    }
    if (!proposto && pool.length > 1) {
      // Ambiguo: NON si sceglie d'ufficio. Le persone finirebbero
      // sull'organigramma sbagliato, con requisiti ed emergenze sbagliati.
      motivo = `${pool.length} clienti possibili: scegli tu`;
    }
    if (!proposto && pool.length === 0) {
      motivo = 'nessun cliente corrispondente: crealo prima, oppure salta il gruppo';
    }
    proposte.set(chiave, { cliente: proposto, motivo, pool });
  }

  // Stessa cautela di `proponiAbbinamenti`: se due gruppi finiscono sullo
  // stesso cliente, la proposta cade per tutti e due. Sono due unita' diverse e
  // versarle in un solo organigramma e' l'errore che non si vede piu' dopo.
  const quanti = new Map<string, number>();
  for (const p of proposte.values()) if (p.cliente) quanti.set(p.cliente.id, (quanti.get(p.cliente.id) ?? 0) + 1);

  const gruppi: GruppoPersone[] = [];
  for (const [chiave, g] of grezzi) {
    const p = proposte.get(chiave)!;
    let proposto = p.cliente;
    let motivo = p.motivo;
    if (proposto && (quanti.get(proposto.id) ?? 0) > 1) {
      motivo = 'più gruppi del file puntano allo stesso cliente: scegli tu';
      proposto = null;
    }

    const forzato = abbinamenti[chiave];
    const clienteId = forzato !== undefined ? forzato : proposto?.id ?? null;
    if (forzato !== undefined) motivo = forzato ? 'abbinamento scelto a mano' : 'gruppo escluso';

    gruppi.push({
      chiave,
      etichetta: [g.nome || g.piva || '(senza nome)', g.sede].filter(Boolean).join(' · '),
      partita_iva: g.piva,
      sede: g.sede,
      cliente_id: clienteId,
      motivoAbbinamento: motivo,
      candidati: p.pool.map((c) => ({
        id: c.id,
        etichetta: etichettaCliente(c),
        motivo: g.piva && S(c.partita_iva).toUpperCase() === g.piva ? 'stessa P.IVA' : 'stessa ragione sociale',
      })),
      righe: g.righe,
      collisione: null,
      voci: [], nuove: 0, aggiornate: 0, cfNonValidi: 0, senzaCf: 0,
    });
  }

  // Collisioni sull'esito FINALE, scelte a mano comprese: la cautela sopra vale
  // solo per le proposte automatiche, e l'operatore puo' scavalcarla senza
  // volerlo (due tendine, due card lontane sullo schermo).
  const usato = new Map<string, string[]>();
  for (const g of gruppi) {
    if (!g.cliente_id) continue;
    const l = usato.get(g.cliente_id); if (l) l.push(g.etichetta); else usato.set(g.cliente_id, [g.etichetta]);
  }
  for (const g of gruppi) {
    if (!g.cliente_id) continue;
    const altri = (usato.get(g.cliente_id) ?? []).filter((e) => e !== g.etichetta);
    if (altri.length > 0) {
      g.collisione = `stesso cliente di: ${altri.join(', ')}. Se non sono lo stesso luogo di lavoro, le persone finiscono in un organigramma solo.`;
    }
  }

  return { gruppi, scartate };
}

// [3c] Confronta i gruppi abbinati con le persone gia' in app: chi c'e' gia'
// (per CF) si aggiorna, gli altri nascono. Qui si legge dal database, e non
// c'e' altro: la riconciliazione non cambia gli abbinamenti.
export async function riconciliaPersone(gruppi: GruppoPersone[]): Promise<GruppoPersone[]> {
  const ids = [...new Set(gruppi.map((g) => g.cliente_id).filter((x): x is string => !!x))];
  const perCliente = new Map<string, Persona[]>();
  if (ids.length > 0) {
    const { data, error } = await supabase.from('persona').select('*').in('cliente_id', ids);
    if (error) throw error;
    for (const p of (data ?? []) as Persona[]) {
      const l = perCliente.get(p.cliente_id); if (l) l.push(p); else perCliente.set(p.cliente_id, [p]);
    }
  }

  for (const gr of gruppi) {
    if (!gr.cliente_id) continue;
    const esistenti = perCliente.get(gr.cliente_id) ?? [];
    const perCf = new Map<string, Persona>();
    for (const p of esistenti) if (p.codice_fiscale) perCf.set(cfPulisci(p.codice_fiscale), p);

    // Dentro il gruppo il CF e' la chiave: due righe con lo stesso CF sono la
    // stessa persona e si fondono, non diventano due schede.
    const perRiga = new Map<string, VocePersona>();
    let senzaCf = 0;
    for (const r of gr.righe) {
      const campi = leggiCampiPersona(r.col);
      if (!campi) continue;
      const esist = campi.cf ? perCf.get(campi.cf) : undefined;
      const chiaveRiga = campi.cf || `riga:${senzaCf++}`;
      const gia = perRiga.get(chiaveRiga);
      const base: Persona = gia
        ? gia.persona
        : (esist ? { ...esist } : { ...personaVuota(gr.cliente_id), id: newId() });
      perRiga.set(chiaveRiga, {
        riga: r.n,
        persona: fondiPersona(campi, base),
        nuova: !esist,
        cfNonValido: !!campi.cf && !cfValido(campi.cf),
      });
    }
    gr.voci = [...perRiga.values()];
    gr.nuove = gr.voci.filter((v) => v.nuova).length;
    gr.aggiornate = gr.voci.length - gr.nuove;
    gr.cfNonValidi = gr.voci.filter((v) => v.cfNonValido).length;
    gr.senzaCf = senzaCf;
  }
  return gruppi;
}

// Quello che usa la schermata: raggruppa, abbina, riconcilia. Si richiama tale
// e quale ogni volta che l'operatore cambia un abbinamento, perche' i conteggi
// "nuove / aggiornate" dipendono da chi c'e' gia' su QUEL cliente.
export async function pianificaPersone(
  f: Foglio, clienti: ClienteScelta[], abbinamenti: Record<string, string | null> = {},
): Promise<PianoPersone> {
  const { gruppi, scartate } = raggruppaPersone(f, clienti, abbinamenti);
  return { gruppi: await riconciliaPersone(gruppi), righeLette: f.righe.length, scartate };
}

export async function applicaPersone(gruppi: GruppoPersone[]): Promise<number> {
  let n = 0;
  for (const g of gruppi) {
    if (!g.cliente_id) continue;
    for (const v of g.voci) { await salvaPersona(v.persona); n++; }
  }
  return n;
}

// ============ campi persona: vocabolario unico, usato anche da RisorseUmane ============

export interface CampiPersona {
  nome: string;
  cognome: string;
  cf: string;
  mansione: string | null;
  reparto: string | null;
  data_assunzione: string | null;
  data_cessazione: string | null;
}

export function personaVuota(clienteId: string): Persona {
  return {
    id: '', cliente_id: clienteId, nome: '', cognome: null, codice_fiscale: null,
    mansione: null, reparto: null, data_assunzione: null, data_cessazione: null,
    livello_rischio: null, attivo: true, note: null, formazione_pregressa: false,
  };
}

// Legge i campi persona da una riga gia' normalizzata. `null` = riga senza nome,
// da scartare. Mansione e reparto salgono in MAIUSCOLO qui, un punto solo:
// e' il vocabolario che poi popola le tendine, e due grafie fanno due voci.
export function leggiCampiPersona(col: Record<string, unknown>): CampiPersona | null {
  const cognome = testo(col, COL_PERSONA.cognome!);
  const nome = testo(col, COL_PERSONA.nome!);
  if (!nome && !cognome) return null;
  const cfRaw = testo(col, COL_PERSONA.codice_fiscale!);
  return {
    nome, cognome,
    cf: cfRaw ? cfPulisci(cfRaw) : '',
    mansione: vuotoNull(testo(col, COL_PERSONA.mansione!))?.toUpperCase() ?? null,
    reparto: vuotoNull(testo(col, COL_PERSONA.reparto!))?.toUpperCase() ?? null,
    data_assunzione: isoData(valore(col, COL_PERSONA.data_assunzione!)),
    data_cessazione: isoData(valore(col, COL_PERSONA.data_cessazione!)),
  };
}

// Fonde i campi letti su una persona (nuova o gia' esistente). Il file non
// cancella: cio' che non dice resta com'era.
export function fondiPersona(c: CampiPersona, base: Persona): Persona {
  const fuso: Persona = {
    ...base,
    nome: (c.nome || base.nome).toUpperCase(),
    cognome: c.cognome ? c.cognome.toUpperCase() : base.cognome,
    codice_fiscale: c.cf || base.codice_fiscale,
    mansione: c.mansione ?? base.mansione,
    reparto: c.reparto ?? base.reparto,
    data_assunzione: c.data_assunzione ?? base.data_assunzione,
    data_cessazione: c.data_cessazione ?? base.data_cessazione,
  };
  // `attivo: true` secco riportava in forza chi era cessato: comparire in un
  // elenco di personale non e' la prova che il rapporto sia ripreso. La regola
  // di `attivoDopoCessazione` decide, e un cessato resta cessato.
  fuso.attivo = attivoDopoCessazione({ ...fuso, attivo: true }, base);
  return fuso;
}

// I due piani vogliono due viste diverse degli stessi clienti: quello dei
// CLIENTI ha bisogno del record intero (ci si fonde sopra), quello delle
// PERSONE solo di cio' che serve a riconoscerli in tendina.
export async function caricaClientiPerImport(): Promise<Cliente[]> {
  return (await caricaClienti()).map((r) => r.cliente);
}
export { caricaClientiScelta, etichettaCliente, type ClienteScelta };
