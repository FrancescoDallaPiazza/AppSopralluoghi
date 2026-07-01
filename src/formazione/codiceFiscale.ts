// Motore Codice Fiscale (puro) - port fedele dalla app standalone Organigramma 81.
//
// Funzioni sincrone (nessun dato esterno): pulisci, carControllo, valido,
// codCognome, codNome, crossCheck, estraiBase (data/sesso/codice luogo).
// La risoluzione del COMUNE (tabella Belfiore, ~10.000 voci, ~240 KB) e' lazy:
// analizzaCF() importa belfiore.json solo al primo uso, cosi' la tabella resta
// fuori dal bundle principale (scelta A: asset bundlato + import dinamico).
//
// Gestisce omocodia (cifre sostituite da lettere L..V nelle posizioni numeriche)
// e il carattere di controllo. Il cross-check cognome/nome e' informativo.

const MESI = ['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M', 'P', 'R', 'S', 'T']; // gen..dic
const RE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
const OMO: Record<string, string> = { L: '0', M: '1', N: '2', P: '3', Q: '4', R: '5', S: '6', T: '7', U: '8', V: '9' };
const DISPARI: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4,
  M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

export const pulisci = (s: string | null | undefined): string =>
  (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const deAccent = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const soloLettere = (s: string): string => deAccent(s).toUpperCase().replace(/[^A-Z]/g, '');
const deOmo = (ch: string): string => OMO[ch] ?? ch;

// Carattere di controllo dei primi 15 caratteri.
export function carControllo(cf15: string): string | null {
  const cf = pulisci(cf15).slice(0, 15);
  if (cf.length !== 15) return null;
  let s = 0;
  for (let i = 0; i < 15; i++) {
    const c = cf[i]!;
    if ((i + 1) % 2 === 1) s += DISPARI[c] ?? 0;
    else s += c >= '0' && c <= '9' ? c.charCodeAt(0) - 48 : c.charCodeAt(0) - 65;
  }
  return String.fromCharCode(65 + (s % 26));
}

export function valido(cf: string): boolean {
  const c = pulisci(cf);
  if (c.length !== 16 || !RE.test(c)) return false;
  return carControllo(c.slice(0, 15)) === c[15];
}

const trip = (cons: string, voc: string): string => (cons + voc + 'XXX').slice(0, 3);
export function codCognome(cognome: string): string {
  const s = soloLettere(cognome);
  return trip(s.replace(/[AEIOU]/g, ''), s.replace(/[^AEIOU]/g, ''));
}
export function codNome(nome: string): string {
  const s = soloLettere(nome);
  let cons = s.replace(/[AEIOU]/g, '');
  if (cons.length >= 4) cons = cons[0]! + cons[2]! + cons[3]!; // regola dei 4+ consonanti
  return trip(cons, s.replace(/[^AEIOU]/g, ''));
}
export function crossCheck(cognome: string, nome: string, cf: string): { cognomeOk: boolean | null; nomeOk: boolean | null } {
  const c = pulisci(cf);
  if (c.length < 6) return { cognomeOk: null, nomeOk: null };
  return {
    cognomeOk: cognome ? codCognome(cognome) === c.slice(0, 3) : null,
    nomeOk: nome ? codNome(nome) === c.slice(3, 6) : null,
  };
}

export interface DatiCF {
  dataISO: string;
  sesso: 'M' | 'F';
  codiceLuogo: string;
  estero: boolean;
  comune: string;
  prov: string;
  stato: string;
  luogoNoto: boolean;
}

// Estrae data/sesso/codice luogo SENZA risolvere il nome del comune (sync).
export function estraiBase(cf: string, oggiISO?: string): Omit<DatiCF, 'comune' | 'prov' | 'stato' | 'luogoNoto'> | null {
  const c = pulisci(cf);
  if (c.length !== 16) return null;
  const aa = deOmo(c[6]!) + deOmo(c[7]!);
  const mi = MESI.indexOf(c[8]!);
  if (mi < 0) return null;
  let gg = parseInt(deOmo(c[9]!) + deOmo(c[10]!), 10);
  const sesso: 'M' | 'F' = gg > 40 ? 'F' : 'M';
  if (sesso === 'F') gg -= 40;
  const yy = parseInt(aa, 10);
  const oggi = oggiISO ? new Date(oggiISO) : new Date();
  const soglia = oggi.getFullYear() % 100;
  const anno = yy <= soglia ? 2000 + yy : 1900 + yy;
  const d = new Date(Date.UTC(anno, mi, gg));
  const valida = d.getUTCFullYear() === anno && d.getUTCMonth() === mi && d.getUTCDate() === gg;
  const dataISO = valida ? `${anno}-${String(mi + 1).padStart(2, '0')}-${String(gg).padStart(2, '0')}` : '';
  const cod = c[11]! + deOmo(c[12]!) + deOmo(c[13]!) + deOmo(c[14]!);
  return { dataISO, sesso, codiceLuogo: cod, estero: cod[0] === 'Z' };
}

// Tabella Belfiore caricata pigramente (una sola volta).
let belfiore: Record<string, string> | null = null;
async function tabellaBelfiore(): Promise<Record<string, string>> {
  if (!belfiore) belfiore = (await import('./belfiore.json')).default as Record<string, string>;
  return belfiore;
}

// Analisi completa (async: risolve il comune dalla tabella Belfiore).
export async function analizzaCF(cf: string, oggiISO?: string): Promise<DatiCF | null> {
  const base = estraiBase(cf, oggiISO);
  if (!base) return null;
  const rec = (await tabellaBelfiore())[base.codiceLuogo] ?? '';
  const [nome = '', prov = ''] = rec.split('|');
  return {
    ...base,
    comune: base.estero ? '' : nome,
    prov: base.estero ? '' : prov,
    stato: base.estero ? nome : 'ITALIA',
    luogoNoto: !!rec,
  };
}
