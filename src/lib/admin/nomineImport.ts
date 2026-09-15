// ===================== L'IMPORT DELLE NOMINE =====================
//
// Legge il foglio "Ruoli SSL" dell'export del gestionale e ne ricava
// l'organigramma: chi ricopre quale figura di sicurezza, e da quando.
//
// Progetto: docs/c1a/import-nomine-progetto.md (commit 7820c90).
// Schema:   supabase/migrations/068_nomine_provenienza_e_dizionario_ruoli.sql.
// Regola:   src/lib/admin/ruoliTesto.ts, provata da `npm run ruoli:check`.
//
// ---------------------------------------------------------------------------
// LE DUE SORGENTI, CHE NON HANNO LO STESSO PESO
// ---------------------------------------------------------------------------
//
//   A. LE NOVE COLONNE DI RUOLO. Una nomina letta qui e' DICHIARATA: la cella
//      non e' una spunta, e' un seriale data di Excel, e quella data e' la data
//      dell'incarico. Non si inventa col giorno dell'import.
//
//   B. LA MANSIONE, in testo libero. Una nomina letta qui e' DEDOTTA: e'
//      un'interpretazione fatta da una regola, e non porta nessuna data.
//
// Su 301 righe che portano un ruolo, 160 vengono dal testo: non e' un caso
// marginale, e' meta' del totale. Per questo `nomina.origine` esiste e non si
// azzera mai (mig. 068) - `da_confermare` e' un COMPITO e sparisce appena
// qualcuno guarda la riga, portandosi via l'unica traccia dell'interpretazione.
//
// ---------------------------------------------------------------------------
// LA REGOLA CHE GOVERNA TUTTO IL FILE
// ---------------------------------------------------------------------------
//
// Non si indovina, e non si tace. Una riga che il sistema non sa mappare non
// diventa una nomina «migliore di niente» e non sparisce: diventa un fatto
// visibile, con dentro il testo che non e' stato capito.
//
//     STATO.md:245 - «una nomina che punta al ruolo sbagliato e' peggio di una
//     nomina mancante».

import { supabase, leggiTutte } from '../supabase';
import {
  type Foglio, leggiFoglio, normHeader, isoData,
  leggiCampiPersona, raggruppaPersone, type GruppoPersone,
} from './anagraficheImport';
import { type ClienteScelta } from './formazioneImport';
import { valido as cfValido, pulisci as cfPulisci } from '../../formazione/codiceFiscale';
import {
  type Dizionario, type VoceDizionario, type EsitoMansione,
  indicizza, risolviMansione, chiaveTesto,
} from './ruoliTesto';

const S = (v: unknown): string => (v == null ? '' : String(v)).trim();
const newId = (): string => crypto.randomUUID();

// Il foglio dei ruoli. Va chiesto PER NOME: `ExportExcel (4).xlsx` ha quattro
// fogli e i ruoli sono nel quarto - leggere il primo non da' errore, da' un
// risultato parziale in silenzio (lezione del 10 settembre 2026).
export const FOGLIO_RUOLI = 'Ruoli SSL';

// Il prefisso della chiave naturale dell'azione «questa persona ha un ruolo
// scritto e non mappabile» sta in `formazione.ts`, accanto alle altre due forme
// che vivono nella stessa colonna: e' li' che si decide cosa sopravvive alla
// riconciliazione, e una costante lontana dalla regola che la usa e' il modo in
// cui le due si disallineano.
export { CHIAVE_NOMINA_FORMA } from './formazione';
import { CHIAVE_NOMINA_FORMA } from './formazione';

// ---------------------------------------------------------------------------
// [1] LE NOVE COLONNE DI RUOLO, E QUELLA CHE NON ENTRA
// ---------------------------------------------------------------------------
//
// Enumerate tutte e nove, comprese quelle che restano fuori: una colonna esclusa
// e non nominata e' indistinguibile da una colonna dimenticata, ed e' successo
// gia' due volte su questo stesso file.
export interface ColonnaRuolo {
  intestazione: string;         // come si chiama nel foglio
  chiave: string;               // normHeader dell'intestazione
  figura: string | null;        // null = riconosciuta, NON mappabile
  perche: string | null;        // perche' non e' mappata. Null quando lo e'.
  // Quando figura e' null: il ruolo che la colonna DICHIARA. Serve a riconoscere una
  // riga gia' risolta da una nomina scritta (vedi RISOLTA_DA).
  ruolo?: string;
}

export const COLONNE_RUOLO: ColonnaRuolo[] = [
  { intestazione: 'Addetti Antincendio', chiave: normHeader('Addetti Antincendio'),
    figura: 'addetto_antincendio', perche: null },
  { intestazione: 'Addetti Primo Soccorso', chiave: normHeader('Addetti Primo Soccorso'),
    figura: 'addetto_primo_soccorso', perche: null },
  { intestazione: 'Addetti Servizio Prevenzione e Protezione',
    chiave: normHeader('Addetti Servizio Prevenzione e Protezione'),
    figura: 'aspp', perche: null },
  { intestazione: 'Dirigente', chiave: normHeader('Dirigente'), figura: 'dirigente', perche: null },
  { intestazione: 'Preposto', chiave: normHeader('Preposto'), figura: 'preposto', perche: null },
  { intestazione: 'RLS', chiave: normHeader('RLS'), figura: 'rls', perche: null },

  // --- QUELLA CHE NON ENTRA, e le due che entrano dal 14 settembre -----------

  // La colonna dice "RSPP" e il file e' COERENTE CON SE STESSO: la colonna 32
  // ripete gli stessi ruoli in chiaro e le nove mappature combaciano, zero
  // incoerenze. Il difetto sta A MONTE DEL FILE - e' il gestionale che chiama
  // "RSPP" il datore di lavoro che assume l'incarico in proprio (art. 34) - e la
  // prova non e' nel foglio: sta negli attestati, dove 26 righe su 33 sono
  // "AGGIORNAMENTO DATORE DI LAVORO CHE SVOLGE I COMPITI DI RSPP" e la
  // sovrapposizione con chi ha i moduli A/B/C professionali e' ZERO.
  // Mandare queste 31 righe a `rspp` darebbe a quelle persone il percorso del
  // professionista invece di quello del datore. Resta fuori SAPENDO PERCHE',
  // non per prudenza generica, e AppFormazione ha gia' dovuto correggerlo una
  // volta con `togli_ruoli_rspp.sql`.
  { intestazione: 'RSPP', chiave: normHeader('RSPP'), figura: null, ruolo: 'rspp',
    perche: 'Il gestionale chiama "RSPP" anche il datore che assume l’incarico in proprio '
      + '(art. 34): 26 attestati su 33 sono da datore-RSPP e la sovrapposizione con i moduli '
      + 'A/B/C professionali e’ zero. Mandarle a "rspp" darebbe il percorso sbagliato. '
      + 'Serve sapere chi compila il gestionale.' },

  // EMERGENZE ED EVACUAZIONE, E RESPONSABILE EMERGENZE: SONO ADDETTI ANTINCENDIO.
  // Decisione di Francesco del 14 settembre 2026, con queste parole:
  //     «Addetto alle emergenze ed evacuazione = Addetto antincendio»
  // e, sulla seconda colonna, «Sì, anche lui». La figura e' una sola, «Addetto
  // antincendio / gestione emergenze» (art. 46, DM 2 settembre 2021).
  //
  // Fino a quel giorno queste due colonne restavano fuori per una misura di
  // AppFormazione (11.09): 24 delle 71 righe hanno emergenze senza antincendio, e
  // delle 47 che le hanno entrambe solo 32 portano la stessa data. La misura resta
  // vera, ma dice COME il gestionale usa due colonne, non se i ruoli siano due.
  //
  // LA DATA. Quando la stessa persona ha piu' di una di queste colonne, la nomina
  // e' UNA e porta la data PIU' VECCHIA: le date successive sono gli aggiornamenti
  // della formazione, non nuovi incarichi («emergenze 2022 è l'aggiornamento
  // quinquennale di antincendio 2017», Francesco). La regola sta in senzaDoppioni.
  { intestazione: 'Addetti Emergenze ed Evacuazione',
    chiave: normHeader('Addetti Emergenze ed Evacuazione'), figura: 'addetto_antincendio', perche: null },
  { intestazione: 'Responsabile Emergenze', chiave: normHeader('Responsabile Emergenze'),
    figura: 'addetto_antincendio', perche: null },
];

// ---------------------------------------------------------------------------
// [2] IL DIZIONARIO, LETTO DAL DATABASE
// ---------------------------------------------------------------------------
//
// DUE COSE SU `posizione`, sapute il 12 settembre 2026 e scritte qui perche' e'
// il punto in cui il dizionario entra nel codice.
//
// 1. OGGI NON ENTRA NELLA RISOLUZIONE. La 068 la descrive come "il meccanismo che
//    fa risolvere RSPP/titolare in dl_rspp invece che in rspp", ed e' vero di come
//    il seme e' stato COSTRUITO - non di come viene LETTO: la destinazione e' gia'
//    incisa in `ruolo_testo_figura`, e questo modulo non guarda `posizione` per
//    decidere niente. E' documentazione della regola, non un suo ingresso. Chi un
//    giorno volesse farla decidere davvero deve saperlo prima, non scoprirlo.
//
// 2. DIVERGE DA APPOVERALL, e la traduzione perde UNA COSA SOLA. Da noi sono
//    cinque (titolare_socio, socio, non_titolare, esterno, non_dichiarato), da
//    loro sei: tengono separati `datore` - la frase lo dice con quelle parole,
//    "Datore di Lavoro", "DL" - e `titolare`, che lo dice per via del titolo. Il
//    nostro `titolare_socio` li fonde, e quella distinzione non sa tornare
//    indietro. Non si ripara qui: la nostra tabella e' caricata e la loro no.
//
//    MA IL NOME E' PESSIMO E HA GIA' INGANNATO UN LETTORE, quindi va detto qui.
//    `titolare_socio` SEMBRA fondere `titolare` con `socio`, e se lo facesse
//    sarebbe grave: da loro ('rspp','titolare') risolve e ('rspp','socio') NON
//    HA RIGA, cioe' si astiene apposta - fonderli vorrebbe dire risolvere righe
//    che l'astensione esiste per proteggere, proprio sul confine art. 34 / art.
//    32 che e' gia' costato 26 nomine sbagliate.
//
//    NON E' QUELLO CHE FA. Misurato sul seme il 12 settembre 2026, nessuna
//    combinazione (posizione, ruolo) fa tutte e due le cose:
//
//        socio          + rspp   ->  si astiene 2 su 2, risolve 0
//        non_dichiarato + rspp   ->  si astiene 2 su 2, risolve 0
//        titolare_socio + rspp   ->  risolve 14 su 14  (dl_rspp)
//        titolare_socio + datore_lavoro / aspp -> risolve 6 su 6
//
//    `socio` E' UN VALORE SUO E SI ASTIENE, esattamente come da loro; le sette
//    righe non risolte vengono da li' e da `non_dichiarato`. Quel che
//    `titolare_socio` fonde sono i loro DUE valori che risolvono allo stesso
//    modo, quindi la perdita e' di PROVENIENZA dell'asserzione - come si e'
//    saputo che e' il datore - non di esito. Il confine dell'astensione e'
//    intatto.
export async function caricaDizionarioRuoli(): Promise<Dizionario> {
  const testi = await leggiTutte<{ chiave: string; varianti: string[]; posizione: string; note: string | null }>(
    (da, a) => supabase.from('ruolo_testo').select('chiave, varianti, posizione, note').order('chiave').range(da, a));
  // UN DIZIONARIO VUOTO NON E' MAI UNO STATO LEGITTIMO: la 068 ne semina 27
  // chiavi e 32 asserzioni. Zero righe vuol dire che la lettura e' stata negata
  // - RLS senza policy, come in produzione il 13.09 subito dopo la 068 (vedi la
  // 069) - o che la 068 manca su questo ambiente. E una lettura negata dalle RLS
  // NON da' errore: torna vuota. Senza questa guardia l'anteprima proseguiva
  // dichiarando "non riconosciute" tutte le righe col ruolo nella mansione -
  // meta' dell'organigramma - invece di fermarsi.
  if (testi.length === 0) {
    throw new Error('Dizionario dei ruoli vuoto: ruolo_testo non restituisce righe. '
      + 'Mancano le policy RLS (migrazione 069) o la migrazione 068 su questo database. '
      + 'L\'anteprima si ferma qui invece di dichiarare non riconosciuti tutti i ruoli scritti nella mansione.');
  }
  const figure = await leggiTutte<{ chiave: string; ruolo_asserito: string; figura_codice: string | null }>(
    (da, a) => supabase.from('ruolo_testo_figura').select('chiave, ruolo_asserito, figura_codice')
      .order('chiave').order('ruolo_asserito').range(da, a));
  if (figure.length === 0) {
    throw new Error('Dizionario dei ruoli senza asserzioni: ruolo_testo_figura non restituisce righe. '
      + 'Mancano le policy RLS (migrazione 069) o il seme della 068 su questo database.');
  }

  const voci = new Map<string, VoceDizionario>();
  for (const t of testi) voci.set(t.chiave, { ...t, note: t.note ?? null, asserzioni: [] });
  for (const f of figure) {
    const v = voci.get(f.chiave);
    // Un'asserzione senza il suo testo non e' un caso da ignorare: il vincolo di
    // chiave esterna lo impedisce, quindi se capita il dizionario e' stato
    // toccato a mano e il conto degli esiti non varrebbe piu' niente.
    if (!v) throw new Error(`Dizionario incoerente: asserzione su una chiave assente ("${f.chiave}").`);
    v.asserzioni.push({ ruolo_asserito: f.ruolo_asserito, figura_codice: f.figura_codice });
  }
  return indicizza([...voci.values()]);
}

// ---------------------------------------------------------------------------
// [3] IL PIANO
// ---------------------------------------------------------------------------
// Le tre fonti di una nomina, e restano distinte sulla riga scritta. La QUALIFICA
// e' la colonna X del foglio, accanto alla Mansione (Y): e' testo libero come la
// mansione, ma e' un'altra colonna, e fonderle nascondeva da dove veniva una
// nomina. Decisa da Francesco il 14 settembre 2026: prima la qualifica entrava
// solo quando la mansione era vuota, travestita da mansione, e 38 righe con un
// ruolo scritto in Qualifica accanto a una Mansione piena non venivano lette.
export type FonteNomina = 'colonna' | 'mansione' | 'qualifica';

export interface NominaProposta {
  riga: number;
  persona_id: string;
  persona: string;              // come si chiama, per l'anteprima
  figura_codice: string;
  data_nomina: string | null;
  origine: FonteNomina;
  origine_testo: string | null; // il verbatim, quando origine e' 'mansione' o 'qualifica'
  gia: boolean;                 // la persona ha gia' questa figura: non si tocca
}

// Il SECONDO esito: riconosciuto e non mappabile. Non e' uno scarto - e' un
// lavoro per una persona, e porta il testo dentro perche' il testo E' il dato.
export interface DaDecidere {
  riga: number;
  persona_id: string | null;
  persona: string;
  cliente: string;
  fonte: FonteNomina;
  testo: string;                // la mansione o la qualifica verbatim, o il nome della colonna
  motivo: string;
}

// Una riga da decidere a cui una nomina GIA' SCRITTA risponde. Non chiede niente, ma
// non sparisce: resta elencata a parte, con la figura che la risolve.
export type GiaRisolta = DaDecidere & { risoltaDa: string };

export interface PianoNomine {
  gruppi: GruppoPersone[];      // l'abbinamento riga -> cliente, come per le persone
  proposte: NominaProposta[];
  daDecidere: DaDecidere[];
  // Le righe che sarebbero da decidere e a cui la persona ha gia' risposto con una
  // nomina scritta (15.09). Fuori da `daDecidere`, e contate a parte.
  giaRisolte: GiaRisolta[];
  // Righe che nominano una persona che in archivio non si trova. Non e' un
  // "da decidere": e' un presupposto mancante, e la risposta e' importare prima
  // le anagrafiche.
  personeNonTrovate: { riga: number; chi: string; cliente: string; motivo: string }[];
  scartate: { riga: number; motivo: string }[];
  // La rete a maglie larghe per i ruoli scritti in una forma che nessuna parola
  // nota intercetta. Sono le mansioni distinte che il dizionario non conosce:
  // 603 su 2.890 righe all'ultima misura, e scorrerle e' lavoro da cinque minuti.
  mansioniNuove: { testo: string; righe: number }[];
  // La stessa rete sulla colonna Qualifica, che e' un'altra fonte (14.09).
  qualificheNuove: { testo: string; righe: number }[];
  righeLette: number;
}

// Nome leggibile, per l'anteprima e per la descrizione dell'azione.
const nomeDi = (cognome: string, nome: string): string =>
  [cognome, nome].map((x) => S(x)).filter(Boolean).join(' ') || '(senza nome)';

export async function leggiFoglioRuoli(file: File): Promise<Foglio> {
  return leggiFoglio(file, FOGLIO_RUOLI);
}

// Le persone gia' in archivio per i clienti coinvolti, indicizzate come le
// indicizza l'import delle anagrafiche: prima il codice fiscale, poi il nome -
// e il nome SOLO quando non e' ambiguo.
interface IndicePersone {
  perCf: Map<string, { id: string; nome: string }>;
  perNome: Map<string, { id: string; nome: string } | null>;   // null = omonimi
}

function indicizzaPersone(
  righe: { id: string; nome: string | null; cognome: string | null; codice_fiscale: string | null }[],
): IndicePersone {
  const perCf = new Map<string, { id: string; nome: string }>();
  const perNome = new Map<string, { id: string; nome: string } | null>();
  for (const p of righe) {
    const etichetta = nomeDi(p.cognome ?? '', p.nome ?? '');
    if (p.codice_fiscale) perCf.set(cfPulisci(p.codice_fiscale), { id: p.id, nome: etichetta });
    const k = `${chiaveTesto(p.cognome ?? '')}|${chiaveTesto(p.nome ?? '')}`;
    if (k === '|') continue;
    perNome.set(k, perNome.has(k) ? null : { id: p.id, nome: etichetta });
  }
  return { perCf, perNome };
}

// ---------------------------------------------------------------------------
// IL RIPIEGO COGNOME+NOME, ACCESO DELIBERATAMENTE
// ---------------------------------------------------------------------------
//
// Dodici delle 153 righe con un ruolo in colonna non hanno il codice fiscale.
// Agganciando SOLO per CF si perderebbero 19 incarichi in silenzio, e il 100%
// dell'unica riga `Addetti Servizio Prevenzione e Protezione` dell'export -
// cioe' l'unico ASPP, che e' la figura che se manca non manca poco.
//
// Il ripiego esiste gia' nell'import delle anagrafiche e qui si accende con le
// stesse due guardie, non con una in meno: il nome vale come chiave solo se non
// e' ambiguo IN ARCHIVIO e non e' ripetuto NEL FILE. Quando una delle due cade,
// la riga non diventa una nomina su qualcuno «probabile»: diventa una persona
// non trovata, che si vede.
//
// E VA DETTO COSA IL RIPIEGO NON PUO' FARE: aggancia dentro UN cliente, perche'
// l'identita' di una persona in questo archivio e' la coppia (cliente, nome).
// Fuori da li' due omonimi non si distinguono, e il sistema si ferma invece di
// scegliere.
//
// QUANTO PESI SULLA META' DEDOTTA, misurato il 12 settembre 2026 sul foglio
// "Ruoli SSL" di ExportExcel.xlsx (24/12/2023, l'unico export di quella famiglia
// su questa macchina). Il "12 su 153" delle colonne NON si estende alla mansione,
// e non si estende in meglio:
//
//     righe con un ruolo nelle COLONNE ..... 204   senza CF:  16   (7,8%)
//     righe con un ruolo nella MANSIONE .....  74   senza CF:  47   (63,5%)
//     unione ............................... 275   senza CF:  63
//
// OTTO VOLTE PEGGIO. Agganciando solo per codice fiscale, dalla meta' DEDOTTA
// dell'organigramma si perderebbero quasi due righe su tre - cioe' il ripiego non
// e' un rammendo per pochi casi: e' cio' che regge la meta' del lavoro che questo
// import esiste per fare.
//
// DUE RISERVE, perche' il numero non venga usato per quello che non e'. E' la
// fotografia del 2023, non quella del 2026 su cui poggiano il 153 e il 160. E il
// dizionario e' stato costruito SULL'export del 2026: applicato al 2023 riconosce
// solo le forme che gia' conosce, quindi 74 e' un limite INFERIORE e le righe con
// un ruolo scritto in una forma nuova non sono contate. La proporzione vale per
// cio' che il dizionario vede.
function risolviPersona(
  cf: string, cognome: string, nome: string, idx: IndicePersone, ripetutiNelFile: Set<string>,
): { id: string; nome: string } | { errore: string } {
  if (cf) {
    const p = idx.perCf.get(cf);
    if (p) return p;
    // CF presente nel file e assente in archivio. Non si ripiega sul nome: il
    // file DICE chi e' questa persona, e se in archivio non c'e' il fatto da
    // riportare e' quello, non un aggancio a qualcuno che si chiama uguale.
    return { errore: cfValido(cf)
      ? 'codice fiscale non presente in archivio'
      : 'codice fiscale non valido e non presente in archivio' };
  }
  const k = `${chiaveTesto(cognome)}|${chiaveTesto(nome)}`;
  if (k === '|') return { errore: 'riga senza codice fiscale e senza nome' };
  if (ripetutiNelFile.has(k)) {
    return { errore: 'senza codice fiscale, e lo stesso nome compare piu’ volte nel file' };
  }
  const p = idx.perNome.get(k);
  if (p === null) return { errore: 'senza codice fiscale, e in archivio ci sono due omonimi' };
  if (!p) return { errore: 'senza codice fiscale, e il nome non si trova in archivio' };
  return p;
}

// UNA RIGA DA DECIDERE PUO' ESSERE GIA' RISOLTA. Il dizionario si astiene su «RSPP»
// secco, «SOCIO/RSPP», «LEGALE RAPPRESENTANTE/RSPP», e la colonna RSPP resta fuori:
// il testo non dice se sia il datore o un RSPP esterno. Tutte le astensioni del
// dizionario (068, 070) asseriscono `rspp`. Ma se la persona ha GIA' una nomina
// `dl_rspp` o `rspp`, qualcuno ha deciso - a mano, o con gli script sugli attestati
// del 15.09 - e la riga non chiede piu' niente. Senza questa regola l'anteprima del
// 15.09 mostrava 42 da decidere, 35 delle quali decise e scritte.
//
// Solo nomine SCRITTE: una proposta dello stesso piano non risolve niente finche'
// non e' scritta. E solo le figure elencate: un addetto antincendio non risponde a
// «RSPP». Una forma non a dizionario asserisce un ruolo che non si conosce, e resta.
const RISOLTA_DA: Record<string, string[]> = { rspp: ['dl_rspp', 'rspp'] };

export async function pianificaNomine(
  f: Foglio, clienti: ClienteScelta[], abbinamenti: Record<string, string | null> = {},
): Promise<PianoNomine> {
  const diz = await caricaDizionarioRuoli();
  const { gruppi, scartate } = raggruppaPersone(f, clienti, abbinamenti);

  const proposte: NominaProposta[] = [];
  const daDecidere: DaDecidere[] = [];
  const giaRisolte: GiaRisolta[] = [];
  const personeNonTrovate: PianoNomine['personeNonTrovate'] = [];
  const mansioniConteggio = new Map<string, number>();
  const qualificheConteggio = new Map<string, number>();

  // Le due colonne di testo libero, ciascuna per conto suo: i sinonimi di
  // COL_PERSONA.mansione (anagraficheImport) SENZA la qualifica, e la qualifica
  // da sola. In maiuscolo come il campo mansione, perche' l'`origine_testo`
  // delle nomine gia' scritte e' in maiuscolo.
  const COL_MANSIONE = ['mansione', 'ruolo', 'profilo', 'profiloprofessionale'];
  const COL_QUALIFICA = ['qualifica'];
  const testoLibero = (col: Record<string, unknown>, chiavi: string[]): string => {
    for (const k of chiavi) {
      const v = S(col[k]);
      if (v) return v.toUpperCase();
    }
    return '';
  };

  // Le colonne che il foglio ha davvero. Una colonna attesa e assente si dice:
  // il file potrebbe essere un export diverso.
  const chiaviFoglio = new Set(f.intestazioni.map(normHeader).filter(Boolean));

  for (const gr of gruppi) {
    if (!gr.cliente_id) continue;   // gruppo non abbinato: lo decide l'operatore

    const esistenti = await leggiTutte<{ id: string; nome: string | null; cognome: string | null; codice_fiscale: string | null }>(
      (da, a) => supabase.from('persona').select('id, nome, cognome, codice_fiscale')
        .eq('cliente_id', gr.cliente_id).order('id').range(da, a));
    const idx = indicizzaPersone(esistenti);

    // LA GUARDIA SULL'INSIEME VUOTO NON E' DIFENSIVA, E' NECESSARIA. `.in(col, [])`
    // diventa `col=in.()`, che PostgREST rifiuta come filtro malformato: non torna
    // zero righe, torna un ERRORE, e `leggiTutte` lo rilancia.
    //
    // E il caso non e' teorico: un cliente abbinato le cui persone non sono mai
    // state importate ha `esistenti` vuoto. Cioe' l'import morirebbe proprio sul
    // cliente su cui ha piu' da dire - quello dove ogni riga finirebbe fra le
    // "persone non trovate", che e' il rapporto che questa schermata esiste per
    // produrre. E' l'idioma di `caricaPerPersone` (formazione.ts:1164), che
    // questo file avrebbe dovuto seguire dall'inizio.
    const idsEsistenti = esistenti.map((p) => p.id);
    const nomineGia = idsEsistenti.length
      ? await leggiTutte<{ persona_id: string; figura_codice: string }>(
        (da, a) => supabase.from('nomina').select('persona_id, figura_codice')
          .in('persona_id', idsEsistenti).order('persona_id').range(da, a))
      : [];
    const gia = new Set(nomineGia.map((n) => `${n.persona_id}|${n.figura_codice}`));
    const risoltaDa = (personaId: string, ruolo: string | null | undefined): string | null =>
      (ruolo ? RISOLTA_DA[ruolo]?.find((fig) => gia.has(`${personaId}|${fig}`)) : undefined) ?? null;

    // I nomi senza CF ripetuti DENTRO il file: stessa guardia dell'import
    // anagrafiche, e va calcolata sul gruppo perche' l'identita' e' per cliente.
    const contaNomi = new Map<string, number>();
    for (const r of gr.righe) {
      const c = leggiCampiPersona(r.col);
      if (!c || c.cf) continue;
      const k = `${chiaveTesto(c.cognome)}|${chiaveTesto(c.nome)}`;
      if (k !== '|') contaNomi.set(k, (contaNomi.get(k) ?? 0) + 1);
    }
    const ripetuti = new Set([...contaNomi.entries()].filter(([, n]) => n > 1).map(([k]) => k));

    for (const r of gr.righe) {
      const campi = leggiCampiPersona(r.col);
      if (!campi) continue;
      const etichetta = nomeDi(campi.cognome, campi.nome);

      // Cosa questa riga asserisce, dalle tre sorgenti.
      const dalleColonne = COLONNE_RUOLO
        .filter((c) => chiaviFoglio.has(c.chiave) && S(r.col[c.chiave]) !== '')
        .map((c) => ({ col: c, data: isoData(r.col[c.chiave]) }));
      // La mansione e la qualifica si leggono CIASCUNA DALLA SUA COLONNA. Il campo
      // `mansione` di leggiCampiPersona prende la prima non vuota fra mansione,
      // ruolo e qualifica: per le anagrafiche va bene, qui fonderebbe due fonti.
      const mans = testoLibero(r.col, COL_MANSIONE);
      const qual = testoLibero(r.col, COL_QUALIFICA);
      const esitoMans: EsitoMansione | null = mans ? risolviMansione(mans, diz) : null;
      // Una qualifica che dice parola per parola la stessa cosa della mansione non
      // e' una seconda fonte: e' lo stesso testo scritto due volte (sull'export del
      // 09/09/2026, «RSPP/TITOLARE» alle righe 409 e 476). Contarla raddoppierebbe
      // i «da decidere» senza aggiungere niente.
      const esitoQual: EsitoMansione | null =
        qual && chiaveTesto(qual) !== chiaveTesto(mans) ? risolviMansione(qual, diz) : null;
      if (mans) mansioniConteggio.set(mans, (mansioniConteggio.get(mans) ?? 0) + 1);
      if (qual) qualificheConteggio.set(qual, (qualificheConteggio.get(qual) ?? 0) + 1);

      const asserisceQualcosa = dalleColonne.length > 0
        || (esitoMans?.asserzioni.length ?? 0) > 0 || (esitoQual?.asserzioni.length ?? 0) > 0;
      if (!asserisceQualcosa) continue;   // terzo esito: niente, e va bene

      // La persona serve solo se la riga asserisce qualcosa: risolverla per
      // tutte e 3.501 le righe costerebbe senza servire.
      const chi = risolviPersona(campi.cf, campi.cognome, campi.nome, idx, ripetuti);
      if ('errore' in chi) {
        personeNonTrovate.push({ riga: r.n, chi: etichetta, cliente: gr.etichetta, motivo: chi.errore });
        continue;
      }

      // --- A. le colonne ---
      for (const { col, data } of dalleColonne) {
        if (!col.figura) {
          const voce: DaDecidere = {
            riga: r.n, persona_id: chi.id, persona: chi.nome, cliente: gr.etichetta,
            fonte: 'colonna', testo: col.intestazione, motivo: col.perche ?? 'colonna non mappata',
          };
          const risolta = risoltaDa(chi.id, col.ruolo);
          if (risolta) giaRisolte.push({ ...voce, risoltaDa: risolta });
          else daDecidere.push(voce);
          continue;
        }
        proposte.push({
          riga: r.n, persona_id: chi.id, persona: chi.nome, figura_codice: col.figura,
          // La data dell'incarico c'e' nella cella e non si sostituisce con
          // oggi. Se la cella non e' una data leggibile resta null: una data
          // inventata non si distingue piu' da una vera.
          data_nomina: data,
          origine: 'colonna', origine_testo: null,
          gia: gia.has(`${chi.id}|${col.figura}`),
        });
      }

      // --- B. la mansione, e C. la qualifica: due testi, la stessa regola ---
      // Ciascuna nomina porta scritto da quale dei due testi viene.
      const persona = chi;
      const deduci = (fonte: 'mansione' | 'qualifica', testo: string, esito: EsitoMansione | null) => {
        for (const a of esito?.asserzioni ?? []) {
          if (!a.figura_codice) {
            const voce: DaDecidere = {
              riga: r.n, persona_id: persona.id, persona: persona.nome, cliente: gr.etichetta,
              fonte, testo,
              motivo: esito!.trovata
                ? `il dizionario conosce questa forma e NON ha una regola per "${a.ruolo_asserito}": `
                  + 'l’assenza e’ voluta, il ruolo esatto non si deduce'
                : 'forma non a dizionario, ma il testo nomina un ruolo di sicurezza',
            };
            const risolta = risoltaDa(persona.id, a.ruolo_asserito);
            if (risolta) giaRisolte.push({ ...voce, risoltaDa: risolta });
            else daDecidere.push(voce);
            continue;
          }
          proposte.push({
            riga: r.n, persona_id: persona.id, persona: persona.nome, figura_codice: a.figura_codice,
            data_nomina: null,          // dedotta da un testo: nessuna data, e non se ne inventa una
            origine: fonte, origine_testo: testo,
            gia: gia.has(`${persona.id}|${a.figura_codice}`),
          });
        }
      };
      deduci('mansione', mans, esitoMans);
      deduci('qualifica', qual, esitoQual);
    }
  }

  // Le mansioni e le qualifiche che il dizionario non conosce, in ordine di
  // frequenza: e' la sola rete possibile per un ruolo scritto senza nessuna
  // parola nota.
  const nonADizionario = (conteggio: Map<string, number>) => [...conteggio.entries()]
    .filter(([t]) => !diz.perChiave.has(chiaveTesto(t)))
    .map(([testo, righe]) => ({ testo, righe }))
    .sort((a, b) => b.righe - a.righe || a.testo.localeCompare(b.testo));
  const mansioniNuove = nonADizionario(mansioniConteggio);
  const qualificheNuove = nonADizionario(qualificheConteggio);

  return {
    gruppi, proposte, daDecidere, giaRisolte, personeNonTrovate, scartate, mansioniNuove, qualificheNuove,
    righeLette: f.righe.length,
  };
}

// ---------------------------------------------------------------------------
// [4] IL RIEPILOGO, che non puo' dire solo il primo numero
// ---------------------------------------------------------------------------
//
// «161 nomine» e' un riepilogo che mente per omissione. Il secondo conteggio non
// va MAI mostrato come zero implicito: se ci sono sette righe riconosciute e non
// mappabili, il riepilogo dice «161 nomine, 7 da decidere».
export interface RiepilogoNomine {
  daCreare: number;
  giaPresenti: number;
  daDecidere: number;
  giaRisolte: number;
  personeNonTrovate: number;
  mansioniNuove: number;
  perFigura: { figura: string; n: number }[];
  perOrigine: Record<FonteNomina, number>;
}

// Una persona puo' ricevere la stessa figura da due proposte: la colonna e la
// mansione dicono la stessa cosa. Il doppione si toglie in UN posto solo, e lo
// usano sia il riepilogo sia la scrittura. Prima lo toglieva solo la scrittura, e
// l'anteprima del 14.09 diceva «Scrivi 364 nomine» per scriverne 363: la riga
// 2782 dava `dirigente` dalla colonna e dalla mansione.
//
// Vince la COLONNA, perche' porta la data dell'incarico. Fra i due testi vince la
// MANSIONE sulla qualifica: e' la fonte che l'import leggeva gia', e a parita' di
// figura una nomina non deve cambiare provenienza solo perche' da oggi si legge
// anche l'altra colonna.
//
// E fra due proposte della STESSA fonte - due colonne che danno la stessa figura,
// come Antincendio ed Emergenze - vince la DATA PIU' VECCHIA: e' l'incarico, le
// successive sono aggiornamenti della formazione (decisione di Francesco del
// 14.09). Una data vale piu' di nessuna data.
const PESO_FONTE: Record<FonteNomina, number> = { colonna: 0, mansione: 1, qualifica: 2 };
const piuVecchia = (a: string | null, b: string | null): boolean => a !== null && (b === null || a < b);
function senzaDoppioni(proposte: NominaProposta[]): NominaProposta[] {
  const perChiave = new Map<string, NominaProposta>();
  for (const n of proposte) {
    const k = `${n.persona_id}|${n.figura_codice}`;
    const prima = perChiave.get(k);
    const pesoN = PESO_FONTE[n.origine];
    const pesoPrima = prima ? PESO_FONTE[prima.origine] : Infinity;
    if (!prima || pesoN < pesoPrima || (pesoN === pesoPrima && piuVecchia(n.data_nomina, prima.data_nomina))) {
      perChiave.set(k, n);
    }
  }
  return [...perChiave.values()];
}

export function riepiloga(p: PianoNomine): RiepilogoNomine {
  const nuove = senzaDoppioni(p.proposte.filter((x) => !x.gia));
  const gia = senzaDoppioni(p.proposte.filter((x) => x.gia));
  const perFigura = new Map<string, number>();
  for (const n of nuove) perFigura.set(n.figura_codice, (perFigura.get(n.figura_codice) ?? 0) + 1);
  return {
    daCreare: nuove.length,
    giaPresenti: gia.length,
    daDecidere: p.daDecidere.length,
    giaRisolte: p.giaRisolte.length,
    personeNonTrovate: p.personeNonTrovate.length,
    mansioniNuove: p.mansioniNuove.length,
    perFigura: [...perFigura.entries()].map(([figura, n]) => ({ figura, n }))
      .sort((a, b) => b.n - a.n || a.figura.localeCompare(b.figura)),
    perOrigine: {
      colonna: nuove.filter((x) => x.origine === 'colonna').length,
      mansione: nuove.filter((x) => x.origine === 'mansione').length,
      qualifica: nuove.filter((x) => x.origine === 'qualifica').length,
    },
  };
}

// ---------------------------------------------------------------------------
// [5] LA SCRITTURA
// ---------------------------------------------------------------------------
//
// Idempotente per costruzione: `nomina` ha `unique (persona_id, figura_codice)`
// dalla migrazione 015, quindi `on conflict do nothing` fa il resto e ripassare
// lo stesso file non crea niente.
//
// E `do nothing` NON e' una scorciatoia rispetto a `do update`: una nomina che
// c'e' gia' e' stata messa da qualcuno - a mano, o da un import precedente - e
// quella e' la sua origine. Riscriverla significherebbe sovrascrivere una
// dichiarazione con un'interpretazione, che e' il verso sbagliato.
export async function applicaNomine(p: PianoNomine): Promise<number> {
  // Il doppione si toglie QUI, non lasciando che sia il database a scartare la
  // seconda proposta, e con la stessa funzione del riepilogo: il numero che
  // l'anteprima mostra e' quello che viene scritto.
  const nuove = senzaDoppioni(p.proposte.filter((x) => !x.gia));
  if (nuove.length === 0) return 0;

  const righe = nuove.map((n) => ({
    id: newId(),
    persona_id: n.persona_id,
    figura_codice: n.figura_codice,
    data_nomina: n.data_nomina,
    attiva: true,
    note: null,
    origine: n.origine,
    origine_testo: n.origine_testo,
  }));

  const { error } = await supabase.from('nomina')
    .upsert(righe, { onConflict: 'persona_id,figura_codice', ignoreDuplicates: true });
  if (error) throw error;
  return righe.length;
}

// ---------------------------------------------------------------------------
// [6] DOVE FINISCE UNA RIGA CHE NESSUNO HA CAPITO
// ---------------------------------------------------------------------------
//
// Il riepilogo dell'anteprima risponde a «cosa sta per entrare»; questo risponde
// a «chi se ne occupa», che e' una domanda diversa e sopravvive alla chiusura
// della finestra. La descrizione porta il TESTO VERBATIM, perche' e' il dato:
//
//   «CORDIOLI KARL risulta RSPP nella mansione "SOCIO/ RSPP": essere socio non
//    stabilisce di essere il datore, e il ruolo esatto non si deduce.»
//
// E' limitata per costruzione, come quella dell'ATECO: nasce solo dove il testo
// contiene una parola di ruolo nota. Oggi sarebbero sette righe, non 2.890.
export function azioniDaDecidere(
  p: PianoNomine, clienteId: string, areaId: string | null,
): { key: string; az: Record<string, unknown> }[] {
  // Una persona, una riga: se due testi diversi la riguardano, la descrizione li
  // porta entrambi invece di produrre due azioni che si chiudono insieme.
  const perPersona = new Map<string, DaDecidere[]>();
  for (const d of p.daDecidere) {
    if (!d.persona_id) continue;
    const l = perPersona.get(d.persona_id);
    if (l) l.push(d); else perPersona.set(d.persona_id, [d]);
  }

  return [...perPersona.entries()].map(([personaId, righe]) => {
    const key = CHIAVE_NOMINA_FORMA + personaId;
    const chi = righe[0]!.persona;
    const dettaglio = righe
      .map((r) => r.fonte === 'mansione'
        ? `nella mansione "${r.testo}"`
        : `nella colonna "${r.testo}"`)
      .join(', ');
    return {
      key,
      az: {
        tipo: 'azione_correttiva', origine_esito_id: null, sopralluogo_origine_id: null,
        origine_formazione_id: null, origine_esonero_id: null, origine_requisito_key: key,
        responsabile_cliente_id: clienteId,
        // Nessuna data: non c'e' un termine di legge per capire una frase. La
        // vista non la promuove a "SUBITO" - non e' un lavoro in ritardo, e' un
        // ruolo che non si e' potuto leggere.
        data_scadenza: null,
        descrizione: `Ruolo di sicurezza da chiarire - ${chi}: risulta un ruolo ${dettaglio}, `
          + 'e la regola per tradurlo non c’e’ apposta. Il ruolo esatto non si deduce: '
          + 'va deciso e messo a mano, oppure aggiunto al dizionario dei ruoli.',
        ...(areaId
          ? { responsabile_tipo: 'risorsa_interna', responsabile_area_id: areaId }
          : { responsabile_tipo: 'cliente' }),
      },
    };
  });
}
