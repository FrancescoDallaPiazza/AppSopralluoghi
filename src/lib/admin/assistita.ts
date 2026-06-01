// Pianificazione assistita · motore di calcolo (puro, senza I/O).
//
// Combina i dati già presenti nello schema per proporre un tecnico a ciascuna
// seduta:
//   * CARICO settimanale: somma delle durate (min) delle sedute già assegnate a
//     un tecnico nella settimana ISO, confrontata con capienza_ore_settimana.
//   * DISTANZA: dalla base del tecnico (base_lat/lng) al cliente (lat/lng),
//     in km (formula dell'emisenoverso / haversine).
//
// Il suggerimento preferisce, in quest'ordine: chi resta entro capienza quella
// settimana; poi chi è più vicino; a parità, chi ha meno ore già pianificate.
// È un AIUTO: l'assegnazione finale resta una scelta dell'operatore.

import type { Sopralluogo, Tecnico } from '../types';

// ---- settimana ISO (lun–dom) come chiave 'YYYY-Www' ----
export function settimanaISO(dataISO: string): string {
  const [y, m, d] = dataISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  // ISO: giovedì decide l'anno della settimana
  const giorno = (dt.getUTCDay() + 6) % 7; // lun=0 … dom=6
  dt.setUTCDate(dt.getUTCDate() - giorno + 3);
  const primoGiovedi = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const pgGiorno = (primoGiovedi.getUTCDay() + 6) % 7;
  primoGiovedi.setUTCDate(primoGiovedi.getUTCDate() - pgGiorno + 3);
  const settimana = 1 + Math.round((dt.getTime() - primoGiovedi.getTime()) / (7 * 86_400_000));
  return `${dt.getUTCFullYear()}-W${String(settimana).padStart(2, '0')}`;
}

// ---- distanza in km tra due punti (haversine) ----
export function distanzaKm(
  aLat: number | null, aLng: number | null,
  bLat: number | null, bLng: number | null,
): number | null {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return null;
  const R = 6371;
  const toRad = (g: number) => (g * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

// ---- carico settimanale di un tecnico ----
// Mappa tecnico_id -> settimana -> minuti già pianificati.
export type CaricoPerTecnico = Map<string, Map<string, number>>;

export function calcolaCarico(sopralluoghi: Sopralluogo[]): CaricoPerTecnico {
  const carico: CaricoPerTecnico = new Map();
  for (const s of sopralluoghi) {
    if (!s.tecnico_id || !s.data_pianificata) continue;
    const wk = settimanaISO(s.data_pianificata);
    const perT = carico.get(s.tecnico_id) ?? new Map<string, number>();
    perT.set(wk, (perT.get(wk) ?? 0) + (s.durata_stimata_min ?? 0));
    carico.set(s.tecnico_id, perT);
  }
  return carico;
}

export function minutiSettimana(
  carico: CaricoPerTecnico, tecnicoId: string, settimana: string,
): number {
  return carico.get(tecnicoId)?.get(settimana) ?? 0;
}

// ---- valutazione di un tecnico per una specifica seduta ----
export interface ValutazioneTecnico {
  tecnico: Tecnico;
  oreSettimana: number;        // ore già pianificate quella settimana (incl. questa)
  capienza: number | null;     // capienza_ore_settimana
  entroCapienza: boolean;      // false se sfora (o capienza non impostata = sempre ok)
  distanzaKm: number | null;   // base tecnico -> cliente
}

export function valutaTecnici(
  tecnici: Tecnico[],
  carico: CaricoPerTecnico,
  dataISO: string | null,
  durataMin: number | null,
  clienteLat: number | null,
  clienteLng: number | null,
): ValutazioneTecnico[] {
  const wk = dataISO ? settimanaISO(dataISO) : null;
  const dur = durataMin ?? 0;
  return tecnici.map((t): ValutazioneTecnico => {
    const giaMin = wk ? minutiSettimana(carico, t.id, wk) : 0;
    const oreSettimana = Math.round(((giaMin + dur) / 60) * 10) / 10;
    const capienza = t.capienza_ore_settimana;
    const entroCapienza = capienza == null || oreSettimana <= capienza;
    return {
      tecnico: t,
      oreSettimana,
      capienza,
      entroCapienza,
      distanzaKm: distanzaKm(t.base_lat, t.base_lng, clienteLat, clienteLng),
    };
  });
}

// Ordina le valutazioni dalla migliore alla peggiore e restituisce il
// suggerito (o undefined se non ci sono tecnici).
export function ordinaSuggeriti(v: ValutazioneTecnico[]): ValutazioneTecnico[] {
  return [...v].sort((a, b) => {
    // 1) chi resta entro capienza prima di chi sfora
    if (a.entroCapienza !== b.entroCapienza) return a.entroCapienza ? -1 : 1;
    // 2) chi è più vicino (distanza nota batte distanza ignota)
    const da = a.distanzaKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanzaKm ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    // 3) a parità, chi ha meno ore già pianificate
    return a.oreSettimana - b.oreSettimana;
  });
}

export function tecnicoSuggerito(v: ValutazioneTecnico[]): ValutazioneTecnico | undefined {
  return ordinaSuggeriti(v)[0];
}
