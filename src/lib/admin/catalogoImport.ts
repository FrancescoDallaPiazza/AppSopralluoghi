// Import catalogo corsi ASR - stadio di PULIZIA (anteprima, non distruttivo).
//
// Legge l'xlsx grezzo ASR26-TabellaCorsi e ne normalizza le righe:
//  * riporta a cascata la Figura quando la cella e' vuota (righe che ereditano
//    la figura della riga precedente, es. i BLSD sotto "Addetto primo soccorso");
//  * estrae le ore dalla durata ("5\n(1T + 4P)", "12 (8T+4P)", "4 (P)" -> 5/12/4);
//  * converte la periodicita' in MESI (anni x12; "24 mesi" gia' in mesi);
//  * marca gli aggiornamenti/retraining;
//  * scarta le righe senza nome corso.
//
// NON scrive su corso_catalogo. Motivo: la tabella grezza e' per NOME corso,
// mentre corso_catalogo dell'app e' curato per CODICI (LAV_GEN, DATORE_LAVORO,
// RSPP_MOD_A...) a cui il motore si aggancia. La mappatura nome->codice e' una
// curatela, non un import meccanico: il seeding resta un passo SQL rivisto
// (Canale 3). Questo modulo fornisce la pulizia riusabile + l'anteprima.

import * as XLSX from 'xlsx';

export interface RigaCatalogo {
  figura: string;
  corso: string;
  ore: number | null;
  periodicita_mesi: number | null;
  is_aggiornamento: boolean;
  propedeutico: string;
  esoneri: string;
}

const S = (v: unknown): string => (v == null ? '' : String(v)).trim();

const oreDaDurata = (dur: string): number | null => {
  const m = dur.match(/\d+/);
  return m ? Number(m[0]) : null;
};

// Esportata: la stessa conversione serve al catalogo del gestionale (aliasCorsi),
// che parla lo stesso vocabolario ("5 Anni", "24 mesi").
export const periodicitaMesi = (per: string): number | null => {
  const m = per.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return /mes/i.test(per) ? n : n * 12; // "24 mesi" gia' mesi; altrimenti anni
};

function campo(row: Record<string, unknown>, ...chiavi: string[]): string {
  const keys = Object.keys(row);
  for (const c of chiavi) {
    const k = keys.find((h) => h.toLowerCase().replace(/\s+/g, ' ').includes(c));
    if (k != null && S(row[k]) !== '') return S(row[k]);
  }
  return '';
}

export async function leggiCatalogoXlsx(file: File): Promise<RigaCatalogo[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]!];
  if (!ws) return [];
  const grezze = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  const out: RigaCatalogo[] = [];
  let figuraCorrente = '';
  for (const r of grezze) {
    const figura = campo(r, 'figura');
    if (figura) figuraCorrente = figura;
    // il nome corso e' nella colonna senza intestazione (3a): la becco per posizione
    const corso = campo(r, 'none', 'corso') || S(Object.values(r)[3]);
    if (!corso) continue; // scarta righe senza nome corso
    out.push({
      figura: figuraCorrente,
      corso,
      ore: oreDaDurata(campo(r, 'durata')),
      periodicita_mesi: periodicitaMesi(campo(r, 'periodicit')),
      is_aggiornamento: /aggiornament|retraining/i.test(corso),
      propedeutico: campo(r, 'propedeutico'),
      esoneri: campo(r, 'esoneri', 'pregressa'),
    });
  }
  return out;
}
