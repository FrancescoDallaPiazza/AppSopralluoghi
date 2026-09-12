// Il dizionario dei ruoli scritti dentro la MANSIONE, e come si applica.
//
// PERCHE' ESISTE UN FILE A PARTE. Meta' dell'organigramma del gestionale non sta
// nelle colonne dei ruoli: sta in un campo di testo libero pensato per altro.
// Misurato l'11 settembre 2026 sul foglio "Ruoli SSL"
// (docs/c1a/ruoli-fuori-dalla-colonna.md):
//
//     righe con un ruolo nelle COLONNE ........ 153
//     righe con un ruolo nella MANSIONE ....... 160
//     in entrambi .............................. 12
//     unione .................................. 301   -> le colonne ne dichiarano il 51%
//
// Questo modulo non tocca il database e non importa niente: e' la sola REGOLA,
// tenuta separata perche' sia verificabile a tavolino - `npm run ruoli:check` la
// fa girare contro gli otto esiti documentati nella migrazione 068, senza il
// file vero e senza credenziali. E' lo stesso motivo per cui `ateco.ts` sta da
// solo: una regola che si puo' provare senza il mondo intorno si prova.

// ---------------------------------------------------------------------------
// I TRE ESITI, E PERCHE' NON SONO DUE
// ---------------------------------------------------------------------------
//
// `risolta` / `non risolta` sarebbe il null a due significati da capo - lo
// stesso difetto che l'ATECO ha appena finito di pagare con la migrazione 065.
// «Non ho una regola per QUESTO» e «qui non c'e' nessun ruolo» sono due fatti
// diversi, e solo il primo e' un lavoro per qualcuno.
export type EsitoRuolo =
  | 'risolta'          // parola di ruolo nota + posizione nota, e la regola c'e'
  | 'non_mappabile'    // parola di ruolo nota, ma la combinazione non ha regola
  | 'non_riconosciuta'; // nessuna parola di ruolo nota: quasi sempre va bene

export interface VoceDizionario {
  chiave: string;
  varianti: string[];
  posizione: string;            // titolare_socio | socio | non_titolare | esterno | non_dichiarato
  note: string | null;
  // (ruolo asserito -> figura). `figura` null = RICONOSCIUTO E NON MAPPABILE:
  // la regola manca ed e' VOLUTO che manchi.
  asserzioni: { ruolo_asserito: string; figura_codice: string | null }[];
}

export interface Dizionario {
  perChiave: Map<string, VoceDizionario>;
}

export interface AsserzioneRisolta {
  ruolo_asserito: string;
  figura_codice: string | null;
  esito: EsitoRuolo;
}

export interface EsitoMansione {
  testo: string;                 // il verbatim, com'era nella cella
  chiave: string;                // la forma normalizzata con cui si e' cercato
  trovata: boolean;
  posizione: string | null;
  asserzioni: AsserzioneRisolta[];
}

// ---------------------------------------------------------------------------
// LA NORMALIZZAZIONE, E PERCHE' E' POVERA APPOSTA
// ---------------------------------------------------------------------------
//
// Spazi collassati, trim, maiuscolo. Nient'altro: non toglie accenti, non
// normalizza la punteggiatura, non riordina le parole.
//
// E' la stessa forma con cui le chiavi sono scritte nel seme della 068, e le due
// devono restare identiche: se questa funzione diventasse piu' generosa della
// migrazione, troverebbe righe che il conteggio della migrazione non prevede - e
// il numero che qualcuno userebbe per accorgersene (gli otto esiti) smetterebbe
// di tornare senza che nessuno sappia perche'. Se un giorno va allargata, si
// allarga nei due posti insieme e si rifa' `npm run ruoli:check`.
//
// Il refuso "TITOLRE/RSPP" e la negazione "RSPP- NO TITOLARE" stanno nel
// dizionario come grafie a se': si riconoscono perche' sono ELENCATE, non perche'
// una regola le indovini. E' la differenza fra leggere e interpretare.
export const chiaveTesto = (s: string | null | undefined): string =>
  (s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

// Le parole che fanno dire «qui dentro c'e' un ruolo», usate SOLO per
// distinguere il secondo esito dal terzo.
//
// ATTENZIONE A COSA SONO E A COSA NON SONO. Non servono a dedurre un ruolo -
// quello lo fa il dizionario, e solo per le grafie che conosce. Servono a
// separare «testo che parla di sicurezza e non ho la regola» da «testo che non
// c'entra niente», cioe' a decidere se una riga merita di finire addosso a
// qualcuno.
//
// E IL LIMITE VA DETTO, perche' e' la meta' onesta di questa scelta: un ruolo
// scritto senza nessuna di queste parole - `resp. serv. prev. e prot.`, `capo
// squadra emergenze` - NON e' rilevabile, e nessuna regola potrebbe renderlo
// tale. Per quel caso l'unico contrappeso e' a monte del parser, ed e' l'elenco
// delle mansioni distinte nuove che l'import stampa (`mansioniNuove`).
const PAROLE_RUOLO = [
  'RSPP', 'ASPP', 'PREPOSTO', 'DIRIGENTE', 'ANTINCENDIO', 'DATORE DI LAVORO',
  'DATORI DI LAVORO', 'RLS', 'PRIMO SOCCORSO', 'EMERGENZE',
];

export const contieneParolaDiRuolo = (chiave: string): boolean =>
  PAROLE_RUOLO.some((p) => chiave.includes(p));

// ---------------------------------------------------------------------------
// L'APPLICAZIONE DELLA REGOLA A UNA CELLA
// ---------------------------------------------------------------------------
//
// Una frase puo' asserire DUE ruoli: "RSPP - Datori di Lavoro" dice che quella
// persona e' il datore E che fa l'RSPP. Sono due fatti, e una frase che ne
// asserisce due produce due righe - per questo il ritorno e' una lista.
export function risolviMansione(testo: string | null | undefined, diz: Dizionario): EsitoMansione {
  const chiave = chiaveTesto(testo);
  const voce = diz.perChiave.get(chiave);
  if (!voce) {
    // Non trovata. Il terzo esito, tranne quando il testo nomina un ruolo: in
    // quel caso e' una FORMA NUOVA di una cosa che sappiamo essere un ruolo, ed
    // e' precisamente cio' che non deve sparire in silenzio.
    const nota = chiave !== '' && contieneParolaDiRuolo(chiave);
    return {
      testo: testo ?? '', chiave, trovata: false, posizione: null,
      asserzioni: nota
        ? [{ ruolo_asserito: '(forma non a dizionario)', figura_codice: null, esito: 'non_mappabile' }]
        : [],
    };
  }
  return {
    testo: testo ?? '', chiave, trovata: true, posizione: voce.posizione,
    asserzioni: voce.asserzioni.map((a) => ({
      ruolo_asserito: a.ruolo_asserito,
      figura_codice: a.figura_codice,
      // figura null su una voce TROVATA non e' un buco del dizionario: e'
      // l'assenza voluta della regola. Essere socio non stabilisce di essere il
      // datore, e "RSPP" secco non dice se sia interno o esterno.
      esito: a.figura_codice ? 'risolta' : 'non_mappabile',
    })),
  };
}

// Costruisce l'indice a partire dalle righe lette dal database (o dal seme, nel
// banco di prova). Una sola chiave puo' avere piu' grafie: RSPP/TITOLARE ne ha
// tre, che differiscono solo per le maiuscole.
export function indicizza(voci: VoceDizionario[]): Dizionario {
  const perChiave = new Map<string, VoceDizionario>();
  for (const v of voci) perChiave.set(chiaveTesto(v.chiave), v);
  return { perChiave };
}

// ---------------------------------------------------------------------------
// IL CONTO DEGLI ESITI, che e' anche il modo in cui si verifica il dizionario
// ---------------------------------------------------------------------------
//
// Gli otto numeri che la 068 dichiara di riprodurre dalla 0007 di AppOverall:
//
//     dl_rspp 81, addetto_antincendio 47, datore_lavoro 22, NON RISOLTE 7,
//     preposto 6, rspp 3, aspp 1, dirigente 1            (168 coppie)
//
// Se un giorno i due dizionari divergono, e' questo il conto che lo dice: si
// rifa' e si guarda quale degli otto e' cambiato.
export interface ContoEsiti {
  perFigura: Map<string, number>;
  nonMappabili: number;
  nonRiconosciute: number;
  asserzioniTotali: number;
  righeConRuolo: number;
}

export function contaEsiti(esiti: EsitoMansione[]): ContoEsiti {
  const perFigura = new Map<string, number>();
  let nonMappabili = 0, nonRiconosciute = 0, asserzioniTotali = 0, righeConRuolo = 0;
  for (const e of esiti) {
    if (e.asserzioni.length === 0) { nonRiconosciute++; continue; }
    righeConRuolo++;
    for (const a of e.asserzioni) {
      asserzioniTotali++;
      if (a.figura_codice) perFigura.set(a.figura_codice, (perFigura.get(a.figura_codice) ?? 0) + 1);
      else nonMappabili++;
    }
  }
  return { perFigura, nonMappabili, nonRiconosciute, asserzioniTotali, righeConRuolo };
}
