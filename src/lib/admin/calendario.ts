// Calendario · distribuzione delle date dei sopralluoghi nel periodo
// dell'incarico, evitando i giorni non lavorativi.
//
// "Non lavorativo" = sabato, domenica e le festività NAZIONALI italiane
// (incluse Pasqua e Lunedì dell'Angelo, mobili, calcolate per anno con il
// Computus gregoriano). NON sono inclusi i santi patroni, che sono locali e
// dipendono dalla città del cliente: se serviranno, si aggiungeranno in base
// alla località. Per consentire i sabati basta mettere INCLUDI_SABATO = false.
//
// Tutte le date sono trattate a mezzanotte UTC per evitare slittamenti di
// fuso quando si formatta in 'YYYY-MM-DD'.

const MS = 86_400_000;
const INCLUDI_SABATO = true; // i sopralluoghi non si fanno di sabato (modificabile)

const parseISO = (s: string): number => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
};
const fmtISO = (ms: number): string => {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const g = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${g}`;
};

// Domenica di Pasqua (Computus gregoriano · algoritmo "anonimo").
function pasquaUTC(anno: number): number {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = aprile
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(anno, mese - 1, giorno);
}

const cacheFestivita = new Map<number, Set<string>>();

function festivitaAnno(anno: number): Set<string> {
  const cached = cacheFestivita.get(anno);
  if (cached) return cached;
  const s = new Set<string>();
  // festività a data fissa
  for (const md of ['01-01', '01-06', '04-25', '05-01', '06-02',
                     '08-15', '11-01', '12-08', '12-25', '12-26']) {
    s.add(`${anno}-${md}`);
  }
  // mobili: Pasqua (domenica) e Lunedì dell'Angelo
  const pasqua = pasquaUTC(anno);
  s.add(fmtISO(pasqua));
  s.add(fmtISO(pasqua + MS));
  cacheFestivita.set(anno, s);
  return s;
}

export function eNonLavorativo(ms: number): boolean {
  const giorno = new Date(ms).getUTCDay(); // 0 dom … 6 sab
  if (giorno === 0) return true;
  if (INCLUDI_SABATO && giorno === 6) return true;
  return festivitaAnno(new Date(ms).getUTCFullYear()).has(fmtISO(ms));
}

// Sposta una data su un giorno lavorativo: prima in avanti (entro maxMs),
// altrimenti all'indietro (entro minMs). Se nel range non c'è nulla, ritorna
// la data originale.
function suGiornoLavorativo(ms: number, minMs: number, maxMs: number): number {
  for (let f = ms; f <= maxMs; f += MS) if (!eNonLavorativo(f)) return f;
  for (let b = ms; b >= minMs; b -= MS) if (!eNonLavorativo(b)) return b;
  return ms;
}

// Distribuisce `n` date uniformemente nel periodo [inizio, fine], centrando
// ciascuna nel proprio segmento (così non si addensano agli estremi: con 4
// sopralluoghi su un anno escono ~ a cadenza trimestrale), e spostando ogni
// data su un giorno lavorativo. Mantiene l'ordine crescente e, dove il periodo
// lo consente, evita i doppioni.
export function distribuisciDate(inizioISO: string, fineISO: string, n: number): string[] {
  if (n <= 0 || !inizioISO || !fineISO) return [];
  const start = parseISO(inizioISO);
  const end = Math.max(parseISO(fineISO), start);
  const spanGiorni = Math.round((end - start) / MS);

  const date: string[] = [];
  let ultimo = start - MS;
  for (let k = 1; k <= n; k++) {
    const off = Math.round(((k - 0.5) * spanGiorni) / n);
    let ms = Math.min(Math.max(start + off * MS, start), end);
    ms = suGiornoLavorativo(ms, start, end);

    // mantieni strettamente crescente, se il periodo lo permette
    if (ms <= ultimo) {
      let c = ultimo + MS;
      while (c <= end && eNonLavorativo(c)) c += MS;
      if (c <= end) ms = c;
    }
    ultimo = ms;
    date.push(fmtISO(ms));
  }
  return date;
}
