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

// Modulo di settore (ore aggiuntive al modulo comune) del percorso DL-RSPP e
// RSPP/ASPP secondo l'ASR 17/04/2025. Le ore dipendono dalla DIVISIONE ATECO
// 2007 e riguardano solo alcuni settori "speciali": per tutti gli altri NON c'e'
// modulo di settore (ritorna null -> il motore non emette il requisito).
//   DL-RSPP:  A 01-02 16h, A 03 12h, F 16h, C 19-20 16h
//   RSPP/ASPP: come sopra, piu' Q 86-87 (sanita' e assistenza sociale) 12h
export type TipoModuloSettore = 'dl_rspp' | 'rspp';

export function oreModuloSettore(
  codice: string | null | undefined,
  tipo: TipoModuloSettore,
): number | null {
  const v = risolviAteco(codice);
  if (!v) return null;
  const div = v.divisione;
  if (div === '01' || div === '02') return 16; // A 01-02 agricoltura/silvicoltura/zootecnia
  if (div === '03') return 12;                 // A 03 pesca
  if (div === '41' || div === '42' || div === '43') return 16; // F costruzioni
  if (div === '19' || div === '20') return 16; // C 19-20 coke / prodotti chimici
  if (tipo === 'rspp' && (div === '86' || div === '87')) return 12; // Q 86.1 e 87 sanita'
  return null;
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
