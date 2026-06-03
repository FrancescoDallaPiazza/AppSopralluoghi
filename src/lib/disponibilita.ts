// Strato dati + helper per la VISTA DISPONIBILITÀ TECNICI.
//
// Mostra a colpo d'occhio quanto è "pieno" ogni tecnico, settimana per
// settimana, rispetto alla sua capienza oraria (capienza_ore_settimana).
// Non duplica logica: riusa il motore della pianificazione assistita e i
// loader già esistenti —
//   * caricaTecnici()        -> risorse attive assegnabili (esclude 'interno')
//   * caricaCaricoGlobale()  -> sedute pianificate di TUTTI gli incarichi
//   * calcolaCarico()        -> tecnico_id -> settimana ISO -> minuti pianificati
//   * minutiSettimana()      -> lettura del carico per (tecnico, settimana)
//
// Qui sopra ci aggiunge solo funzioni PURE (niente I/O): finestra di settimane
// e calcolo dell'occupazione percentuale. Facili da testare e da riusare.

import {
  settimanaISO, minutiSettimana, calcolaCarico, type CaricoPerTecnico,
} from './assistita';
import { caricaTecnici, caricaCaricoGlobale } from './pianificazione';
import type { Tecnico } from '../types';

// Facade: la vista importa tutto da questo modulo.
export { calcolaCarico, caricaTecnici, caricaCaricoGlobale };
export type { CaricoPerTecnico };

// Data di OGGI come 'YYYY-MM-DD' nel fuso locale (no shift UTC di toISOString).
export function oggiISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const mese = (i: number): string => MESI[i] ?? '';

// Lunedì (in UTC, coerente con settimanaISO) della settimana che contiene la
// data indicata.
function lunediDi(dataISO: string): Date {
  const [y, m, d] = dataISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const giorno = (dt.getUTCDay() + 6) % 7; // lun=0 … dom=6
  dt.setUTCDate(dt.getUTCDate() - giorno);
  return dt;
}

function isoDi(dt: Date): string {
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

export interface Settimana {
  key: string;        // chiave settimana ISO 'YYYY-Www'
  numero: number;     // numero di settimana ISO (per l'etichetta breve)
  lunedi: string;     // 'YYYY-MM-DD' del lunedì
  etichetta: string;  // es. '16–22 giu' (gestisce anche il cavallo di mese)
  corrente: boolean;  // true se è la settimana di oggi
}

// n settimane consecutive a partire dalla settimana che contiene dataInizioISO.
export function finestraSettimane(dataInizioISO: string, n: number): Settimana[] {
  const settCorrente = settimanaISO(oggiISO());
  const lun = lunediDi(dataInizioISO);
  const out: Settimana[] = [];
  for (let i = 0; i < n; i++) {
    const ini = new Date(lun.getTime() + i * 7 * 86_400_000);
    const fin = new Date(ini.getTime() + 6 * 86_400_000);
    const etichetta = ini.getUTCMonth() === fin.getUTCMonth()
      ? `${ini.getUTCDate()}–${fin.getUTCDate()} ${mese(fin.getUTCMonth())}`
      : `${ini.getUTCDate()} ${mese(ini.getUTCMonth())} – ${fin.getUTCDate()} ${mese(fin.getUTCMonth())}`;
    const key = settimanaISO(isoDi(ini));
    out.push({
      key,
      numero: Number(key.split('W')[1] ?? 0),
      lunedi: isoDi(ini),
      etichetta,
      corrente: key === settCorrente,
    });
  }
  return out;
}

// Sposta una data (un lunedì) di ±settimane, restituendo l'ISO del nuovo lunedì.
export function spostaSettimane(dataISO: string, deltaSettimane: number): string {
  const lun = lunediDi(dataISO);
  return isoDi(new Date(lun.getTime() + deltaSettimane * 7 * 86_400_000));
}

export interface Occupazione {
  ore: number;             // ore già pianificate quella settimana
  capienza: number | null; // capienza_ore_settimana del tecnico
  perc: number | null;     // % di riempimento (null se capienza non impostata)
}

export function occupazione(
  carico: CaricoPerTecnico, tecnico: Tecnico, settimanaKey: string,
): Occupazione {
  const ore = Math.round((minutiSettimana(carico, tecnico.id, settimanaKey) / 60) * 10) / 10;
  const capienza = tecnico.capienza_ore_settimana;
  const perc = capienza && capienza > 0 ? Math.round((ore / capienza) * 100) : null;
  return { ore, capienza, perc };
}
