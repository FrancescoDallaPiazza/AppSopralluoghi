// Logica sopra la tabella ATECO -> rischio formativo. I DATI non stanno qui:
// stanno in `atecoDati.ts`, che e' GENERATO dalla libreria normativa
// (`node scripts/genera-ateco.mjs`) e non si modifica a mano — sotto la
// decisione 7 la libreria e' il generatore unico, e una correzione a valle
// sarebbe l'ennesima copia della stessa tabella.
//
// Usata in anagrafica cliente per proporre il codice ATECO e il livello di
// rischio dell'organigramma.

import { ATECO_DIVISIONI, type AtecoDivisione, type RischioAteco } from './atecoDati';

export { ATECO_DIVISIONI };
export type { AtecoDivisione, RischioAteco };

const PER_DIVISIONE: Record<string, AtecoDivisione> =
  Object.fromEntries(ATECO_DIVISIONI.map((d) => [d.divisione, d]));

// Etichetta breve per la UI.
export const ETICHETTA_RISCHIO: Record<RischioAteco, string> = {
  basso: 'BASSO', medio: 'MEDIO', alto: 'ALTO',
};

// Normalizza un input ATECO in qualunque formato ('56', '56.10', '56.10.20',
// '5610' ...) ed estrae la divisione (prime 2 cifre). Restituisce la voce
// dell'Allegato IV o null se la divisione non e' classificata.
export function risolviAteco(codice: string | null | undefined): AtecoDivisione | null {
  if (!codice) return null;
  const m = String(codice).match(/(\d{1,2})/);
  if (!m) return null;
  const div = m[1].padStart(2, '0');
  return PER_DIVISIONE[div] ?? null;
}

// ===========================================================================
// I TRE STATI DELL'ATECO DI UN CLIENTE
// ===========================================================================
//
// Fino all'11 settembre 2026 l'ATECO aveva due stati soli: una divisione, o
// `null`. E `null` portava DUE significati sulla stessa variabile — «per questa
// divisione non c'e' niente da fare» e «la divisione non la so» — che a valle
// nessuno poteva distinguere. Misurato: 358 clienti su 619 (il 57,8%) stavano
// nel secondo caso e venivano trattati come il primo.
//
// Ma gli stati sono TRE, non due, e il terzo e' quello che non si vedeva:
//
//   noto     la divisione c'e', e la cella d'origine non la smentisce;
//   ignoto   la divisione non c'e' (cella vuota, o testo senza codice dentro);
//   incerto  la divisione c'e' MA la cella d'origine dice che potrebbe essere
//            un'altra.
//
// Il terzo non lo esprime nessun tipo di ritorno: non lo distingue un `null` e
// non lo distingue un valore, perche' in archivio «37» sta scritto esattamente
// come ogni altra divisione giusta. Lo distingue SOLO il confronto con la cella
// da cui e' stato derivato — ed e' per questo che `cliente.ateco_origine` non e'
// un extra di comodo: e' cio' che rende quello stato esistente. Senza la cella,
// `incerto` non e' esprimibile e il difetto non e' riparabile, solo spostato.
//
// I due casi veri che lo hanno imposto, misurati sull'export:
//   SHAMS SERVICE SRLS   cella "37054\n(F.41.2) COSTRUZIONE DI EDIFICI":
//                        il 37054 e' il CAP di Nogara, e il primo gruppo di
//                        cifre vince. Archiviata la 37 (reti fognarie) per
//                        un'impresa edile.
//   MIGLIORINI MATTEO    cella con DUE codici su divisioni diverse (46 e 33):
//                        vince il primo del testo, che non e' un criterio ma
//                        l'ordine in cui qualcuno ha incollato le righe.
// In archivio sono due righe come tutte le altre. Aperta la cella, si vedono.

export type MotivoIgnoto =
  | 'nessuna_cella'              // il cliente non ha ATECO e non ha mai avuto una cella
  | 'cella_senza_codice'         // qualcuno ha scritto l'attivita' a parole, senza codice
  | 'divisione_non_classificata'; // ci sono cifre, ma quella divisione non e' nell'Allegato IV

export type MotivoIncerto =
  | 'codice_non_in_testa'   // la cella comincia con altro (un CAP, un ';', un a capo)
  | 'piu_divisioni'         // la cella porta piu' codici, su divisioni diverse
  | 'cella_non_concorda';   // dalla cella si ricava una divisione diversa da quella archiviata

export type EsitoAteco =
  | {
      stato: 'noto';
      divisione: AtecoDivisione;
      cella: string | null;
      // 'confermato'      la cella c'e' e porta proprio quella divisione;
      // 'non_verificabile' la cella non e' conservata (righe anteriori alla 065):
      //                    niente la smentisce, ma niente la conferma.
      riscontro: 'confermato' | 'non_verificabile';
    }
  | {
      stato: 'incerto';
      divisione: AtecoDivisione;      // quella archiviata, che resta l'unica in uso
      alternative: AtecoDivisione[];  // le altre che la cella rende plausibili
      cella: string;
      motivi: MotivoIncerto[];
    }
  | { stato: 'ignoto'; cella: string | null; motivo: MotivoIgnoto };

// Un codice ATECO dentro a un testo libero: lettera di sezione facoltativa, due
// cifre di divisione, poi fino a tre gruppi di cifre. Il `(?!\d)` finale e'
// quello che impedisce a un CAP (37054) di passare per un codice.
const CODICE_IN_TESTO = /(?:\b[A-Za-z]\s*[.\-]\s*)?(\d{2})(?:\.\d{1,2}){0,3}(?!\d)/g;

// La cella comincia con il codice? (eventuale parentesi, eventuale lettera)
const CODICE_IN_TESTA = /^\s*\(?\s*(?:[A-Za-z]\s*[.\-]\s*)?(\d{2})\b/;

// Tutte le divisioni CLASSIFICATE che si leggono in una cella, nell'ordine.
function divisioniNellaCella(cella: string): AtecoDivisione[] {
  const out: AtecoDivisione[] = [];
  const visti = new Set<string>();
  for (const m of cella.matchAll(CODICE_IN_TESTO)) {
    const d = PER_DIVISIONE[m[1]];
    if (d && !visti.has(d.divisione)) { visti.add(d.divisione); out.push(d); }
  }
  return out;
}

// Classifica l'ATECO di un cliente nei tre stati, confrontando la divisione
// ARCHIVIATA con la CELLA da cui e' stata derivata.
export function classificaAteco(
  codiceArchiviato: string | null | undefined,
  cellaOrigine: string | null | undefined,
): EsitoAteco {
  const cella = (cellaOrigine ?? '').trim() || null;
  const div = risolviAteco(codiceArchiviato);

  if (!div) {
    let motivo: MotivoIgnoto = 'nessuna_cella';
    if (cella) {
      motivo = /\d/.test(cella) ? 'divisione_non_classificata' : 'cella_senza_codice';
    }
    return { stato: 'ignoto', cella, motivo };
  }

  // La divisione c'e' ma la cella non e' conservata: non e' un'incertezza
  // rilevata, e' un'incertezza NON RILEVABILE. Va detta com'e'.
  if (!cella) return { stato: 'noto', divisione: div, cella: null, riscontro: 'non_verificabile' };

  const nella = divisioniNellaCella(cella);
  const motivi: MotivoIncerto[] = [];

  const testa = CODICE_IN_TESTA.exec(cella);
  if (!testa || testa[1] !== div.divisione) motivi.push('codice_non_in_testa');
  if (nella.length > 1) motivi.push('piu_divisioni');
  if (nella.length > 0 && !nella.some((d) => d.divisione === div.divisione)) {
    motivi.push('cella_non_concorda');
  }

  if (!motivi.length) return { stato: 'noto', divisione: div, cella, riscontro: 'confermato' };

  const alternative = nella.filter((d) => d.divisione !== div.divisione);
  return { stato: 'incerto', divisione: div, alternative, cella, motivi };
}

// Modulo di settore (ore aggiuntive al modulo comune) del percorso DL-RSPP e
// RSPP/ASPP secondo l'ASR 17/04/2025. Le ore dipendono dalla DIVISIONE ATECO
// 2007 e riguardano solo alcuni settori "speciali".
//   DL-RSPP:  A 01-02 16h, A 03 12h, F 16h, C 19-20 16h
//   RSPP/ASPP: come sopra, piu' Q 86-87 (sanita' e assistenza sociale) 12h
export type TipoModuloSettore = 'dl_rspp' | 'rspp';

function oreDiDivisione(div: string, tipo: TipoModuloSettore): number | null {
  if (div === '01' || div === '02') return 16; // A 01-02 agricoltura/silvicoltura/zootecnia
  if (div === '03') return 12;                 // A 03 pesca
  if (div === '41' || div === '42' || div === '43') return 16; // F costruzioni
  if (div === '19' || div === '20') return 16; // C 19-20 coke / prodotti chimici
  if (tipo === 'rspp' && (div === '86' || div === '87')) return 12; // Q 86.1 e 87 sanita'
  return null;
}

// L'esito ha tre casi come l'ATECO, e per la stessa ragione: «non dovuto» e
// «non lo so» non possono essere lo stesso valore, perche' a valle il primo si
// salta in silenzio (giusto) e il secondo va DETTO (oggi si salta anche quello).
export type EsitoModuloSettore =
  | { esito: 'dovuto'; ore: number }
  | { esito: 'non_dovuto' }
  | { esito: 'non_calcolabile'; perche: string };

export function moduloSettore(a: EsitoAteco, tipo: TipoModuloSettore): EsitoModuloSettore {
  if (a.stato === 'ignoto') {
    const perche = a.motivo === 'cella_senza_codice'
      ? 'l’ATECO del cliente non è un codice: in anagrafica c’è una descrizione'
      : a.motivo === 'divisione_non_classificata'
        ? 'la divisione ATECO del cliente non è nell’Allegato IV'
        : 'il cliente non ha un codice ATECO';
    return { esito: 'non_calcolabile', perche };
  }

  const ore = oreDiDivisione(a.divisione.divisione, tipo);
  if (a.stato === 'noto') return ore == null ? { esito: 'non_dovuto' } : { esito: 'dovuto', ore };

  // Incerto: l'esito e' determinato SOLO se tutte le divisioni plausibili danno
  // lo stesso numero di ore. E' il caso di BP CHIMICA, la cui cella porta due
  // codici entrambi in divisione 46: qualunque si scelga, il modulo non e'
  // dovuto, e dire «non lo so» sarebbe un falso allarme. Non e' il caso di
  // SHAMS, dove 37 non da' modulo e 41 ne da' 16: li' la risposta dipende da
  // quale codice e' quello vero, e quale sia quello vero non lo sappiamo.
  const tutte = [a.divisione, ...a.alternative].map((d) => oreDiDivisione(d.divisione, tipo));
  const concordi = tutte.every((o) => o === tutte[0]);
  if (concordi) return ore == null ? { esito: 'non_dovuto' } : { esito: 'dovuto', ore: ore };

  const elenco = [a.divisione, ...a.alternative]
    .map((d) => {
      const o = oreDiDivisione(d.divisione, tipo);
      return d.divisione + ' (' + (o == null ? 'nessun modulo' : o + 'h') + ')';
    })
    .join(' oppure ');
  return {
    esito: 'non_calcolabile',
    perche: 'l’ATECO in anagrafica non concorda con il dato di origine: ' + elenco,
  };
}

// Compatibilita': resta per i chiamanti che hanno solo il codice e nessuna cella
// (la UI dell'anagrafica). NON usarla nel motore — li' serve la distinzione fra
// «non dovuto» e «non lo so», e questa firma non puo' esprimerla.
export function oreModuloSettore(
  codice: string | null | undefined,
  tipo: TipoModuloSettore,
): number | null {
  const v = risolviAteco(codice);
  return v ? oreDiDivisione(v.divisione, tipo) : null;
}

// Toglie accenti e abbassa: per una ricerca testuale tollerante.
function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Suggerimenti per il typeahead: combacia per prefisso di codice (divisione) o
// per sottostringa nella descrizione/sezione. Le voci che combaciano sul codice
// vengono prima. Vuoto -> lista intera (per lo sfoglio iniziale). Di default
// nessun tetto: sono 88 voci e la tendina scrolla; passare `limite` per cap.
export function cercaAteco(query: string, limite = ATECO_DIVISIONI.length): AtecoDivisione[] {
  const q = (query ?? '').trim();
  if (!q) return ATECO_DIVISIONI.slice(0, limite);
  const digits = q.replace(/\D/g, '');
  const qn = norm(q);
  const perCodice: AtecoDivisione[] = [];
  const perTesto: AtecoDivisione[] = [];
  for (const d of ATECO_DIVISIONI) {
    if (digits && d.divisione.startsWith(digits.slice(0, 2))) { perCodice.push(d); continue; }
    if (norm(d.descrizione).includes(qn) || d.sezione.toLowerCase() === qn) perTesto.push(d);
  }
  return [...perCodice, ...perTesto].slice(0, limite);
}
