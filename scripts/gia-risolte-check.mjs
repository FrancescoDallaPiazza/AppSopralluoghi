// BANCO DI PROVA DELLE RIGHE "DA DECIDERE" GIA' RISOLTE (import delle nomine).
//
// Perche' esiste. Il 15 settembre 2026 l'anteprima delle nomine mostrava 42 righe
// da decidere, e 35 erano gia' decise e scritte: la colonna RSPP e i testi «RSPP»,
// «SOCIO/RSPP», risolti con gli script sugli attestati. La pagina non guardava le
// nomine esistenti. Adesso una riga che asserisce `rspp` su una persona che ha gia'
// `dl_rspp` o `rspp` va fra le «gia' risolte», a parte (RISOLTA_DA, nomineImport.ts).
//
// Cosa fa. Compila `pianificaNomine` e `riepiloga` VERI e li fa girare su righe
// costruite apposta, con un client Supabase finto: il dizionario e' il seme della
// 068 piu' quello della 070, letti dai file delle migrazioni. NESSUNA RETE,
// NESSUN DATABASE.
//
// Il controllo negativo fa parte della prova:
//   NOMINE_MODULO=<file .ts> node scripts/gia-risolte-check.mjs
// compila un'altra versione di nomineImport.ts (per esempio quella di main prima
// della modifica, copiata accanto all'originale) e deve fallire.
//
// Uso:  node scripts/gia-risolte-check.mjs      (oppure: npm run risolte:check)
// Esce 1 se un caso non torna.

import { build } from 'esbuild';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulo = process.env.NOMINE_MODULO ?? './src/lib/admin/nomineImport';
const fuori = join('node_modules', '.gia-risolte-check-' + process.pid + '.mjs');
await build({
  stdin: {
    contents: [
      `export { pianificaNomine, riepiloga } from '${modulo}';`,
      "export { supabase } from './src/lib/supabase';",
    ].join('\n'),
    resolveDir: '.', sourcefile: 'gia-risolte-entry.ts', loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: fuori, logLevel: 'error',
  external: ['xlsx'],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': 'undefined',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined',
  },
});
const { pianificaNomine, riepiloga, supabase } = await import(pathToFileURL(fuori).href);
rmSync(fuori, { force: true });

// ---------- il dizionario, dal seme delle migrazioni ----------
const dcap = (s) => s.replace(/''/g, "'");
const TESTI = [], FIGURE = [];
for (const file of [
  'supabase/migrations/068_nomine_provenienza_e_dizionario_ruoli.sql',
  'supabase/migrations/070_qualifica_fonte_distinta.sql',
]) {
  const sql = readFileSync(file, 'utf8');
  const blocco = (dopo) => {
    const i = sql.indexOf(dopo);
    if (i < 0) throw new Error(`${file}: non trovo "${dopo}"`);
    const resto = sql.slice(i + dopo.length);
    return resto.slice(0, resto.indexOf('on conflict'));
  };
  for (const m of blocco('insert into ruolo_testo (chiave, varianti, posizione, note) values').matchAll(
    /\(\s*'((?:[^']|'')*)'\s*,\s*array\[([^\]]*)\]\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*\)/g)) {
    TESTI.push({ chiave: dcap(m[1]), varianti: [...m[2].matchAll(/'((?:[^']|'')*)'/g)].map((v) => dcap(v[1])), posizione: m[3], note: dcap(m[4]) });
  }
  for (const m of blocco('insert into ruolo_testo_figura (chiave, ruolo_asserito, figura_codice) values').matchAll(
    /\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*(null|'(?:[^']|'')*')\s*\)/g)) {
    FIGURE.push({ chiave: dcap(m[1]), ruolo_asserito: dcap(m[2]), figura_codice: m[3] === 'null' ? null : dcap(m[3].slice(1, -1)) });
  }
}

// ---------- l'archivio finto: persone e nomine gia' scritte ----------
const CLI = 'CL1';
const PERSONE = [
  ['P1', 'ROSSI', 'MARIO'], ['P2', 'BIANCHI', 'ANNA'], ['P3', 'VERDI', 'LUCA'], ['P4', 'NERI', 'PAOLA'],
  ['P5', 'GIALLI', 'RITA'], ['P6', 'BLU', 'MARCO'], ['P7', 'VIOLA', 'SARA'],
].map(([id, cognome, nome]) => ({ id, cliente_id: CLI, cognome, nome, codice_fiscale: null }));
const NOMINE = [
  { persona_id: 'P1', figura_codice: 'dl_rspp' },               // ROSSI: datore RSPP, gia' scritta
  { persona_id: 'P3', figura_codice: 'rspp' },                  // VERDI: RSPP esterno, gia' scritto
  { persona_id: 'P5', figura_codice: 'addetto_antincendio' },   // GIALLI: un'altra figura
  { persona_id: 'P7', figura_codice: 'addetto_antincendio' },   // VIOLA: un'altra figura
];
const TABELLE = { ruolo_testo: TESTI, ruolo_testo_figura: FIGURE, persona: PERSONE, nomina: NOMINE };

supabase.from = (tabella) => {
  if (!(tabella in TABELLE)) throw new Error('lettura inattesa su ' + tabella);
  let righe = [...TABELLE[tabella]];
  const b = {
    select: () => b,
    eq: (c, v) => { righe = righe.filter((r) => r[c] === v); return b; },
    in: (c, vs) => { righe = righe.filter((r) => vs.includes(r[c])); return b; },
    order: () => b,
    range: async (da, a) => ({ data: righe.slice(da, a + 1), error: null }),
  };
  return b;
};

// ---------- il foglio ----------
const riga = (n, cognome, nome, col) => ({ n, col: { societa: 'ACME SRL', sede: '', cognome, nome, ...col } });
const foglio = {
  nomeFile: 'prova.xlsx', rigaHeader: 2, tipo: 'persone', motivoTipo: '', riconosciute: [], ignorate: [],
  intestazioni: ['Società', 'Sede', 'Cognome', 'Nome', 'Qualifica', 'Mansione', 'RSPP'],
  righe: [
    riga(1, 'Rossi', 'Mario', { mansione: 'OPERAIO', rspp: '2020-01-01' }),                    // colonna, dl_rspp scritta
    riga(2, 'Bianchi', 'Anna', { mansione: 'OPERAIO', rspp: '2020-01-01' }),                   // colonna, niente scritto
    riga(3, 'Verdi', 'Luca', { mansione: 'SOCIO/RSPP' }),                                      // testo, rspp scritto
    riga(4, 'Neri', 'Paola', { mansione: 'IMPIEGATA', qualifica: 'Legale Rappresentante/RSPP' }), // testo, niente scritto
    riga(5, 'Gialli', 'Rita', { mansione: 'RSPP' }),                                           // testo, solo antincendio
    riga(6, 'Blu', 'Marco', { mansione: 'RSPP/TITOLARE', rspp: '2020-01-01' }),                // dl_rspp PROPOSTA, non scritta
    riga(7, 'Viola', 'Sara', { mansione: 'MANUTENTORE IMPIANTI ANTINCENDIO' }),                // forma non a dizionario
  ],
};
const clienti = [{ id: CLI, ragione_sociale: 'ACME SRL', partita_iva: null, localita: null, cap: null, operativa: null }];

const p = await pianificaNomine(foglio, clienti, {});
const r = riepiloga(p);
const dd = (n) => p.daDecidere.filter((x) => x.riga === n);
const gr = (n) => (p.giaRisolte ?? []).filter((x) => x.riga === n);

const casi = [
  ['R1 · colonna RSPP su chi ha gia\' dl_rspp: gia\' risolta, fuori dai da decidere', () => {
    if (dd(1).length) return 'la riga 1 e\' ancora fra i da decidere';
    const g = gr(1);
    if (g.length !== 1 || g[0].fonte !== 'colonna' || g[0].risoltaDa !== 'dl_rspp') return JSON.stringify(g);
  }],
  ['R2 · colonna RSPP senza nomine: resta da decidere', () => {
    if (dd(2).length !== 1 || gr(2).length) return JSON.stringify({ dd: dd(2), gr: gr(2) });
  }],
  ['R3 · «SOCIO/RSPP» su chi e\' gia\' rspp: gia\' risolta da rspp', () => {
    if (dd(3).length) return 'la riga 3 e\' ancora fra i da decidere';
    const g = gr(3);
    if (g.length !== 1 || g[0].fonte !== 'mansione' || g[0].risoltaDa !== 'rspp') return JSON.stringify(g);
  }],
  ['R4 · «LEGALE RAPPRESENTANTE/RSPP» senza nomine: resta, con fonte = qualifica', () => {
    const d = dd(4);
    if (d.length !== 1 || d[0].fonte !== 'qualifica' || gr(4).length) return JSON.stringify(d);
  }],
  ['R5 · «RSPP» su chi e\' solo addetto antincendio: un\'altra figura non risolve', () => {
    if (dd(5).length !== 1 || gr(5).length) return JSON.stringify({ dd: dd(5), gr: gr(5) });
  }],
  ['R6 · dl_rspp proposta nello stesso piano ma non scritta: la colonna resta da decidere', () => {
    if (!p.proposte.some((x) => x.riga === 6 && x.figura_codice === 'dl_rspp' && !x.gia)) return 'manca la proposta dl_rspp della riga 6';
    if (dd(6).length !== 1 || gr(6).length) return JSON.stringify({ dd: dd(6), gr: gr(6) });
  }],
  ['R7 · forma non a dizionario su chi ha una nomina: resta da decidere', () => {
    if (dd(7).length !== 1 || gr(7).length) return JSON.stringify({ dd: dd(7), gr: gr(7) });
  }],
  ['R8 · il riepilogo conta a parte: 5 da decidere, 2 gia\' risolte', () => {
    if (r.daDecidere !== 5 || r.giaRisolte !== 2) return `da decidere ${r.daDecidere}, gia' risolte ${r.giaRisolte}`;
  }],
];

let falliti = 0;
console.log(`\nModulo: ${modulo}\n`);
for (const [nome, fn] of casi) {
  let esito;
  try { esito = fn(); } catch (e) { esito = 'eccezione: ' + (e?.message ?? e); }
  console.log(`  ${esito ? 'FALLITO' : 'ok     '}  ${nome}${esito ? `\n           ${esito}` : ''}`);
  if (esito) falliti++;
}
console.log(falliti ? `\n${falliti} casi su ${casi.length} falliti.\n` : `\nTutti i ${casi.length} casi tornano.\n`);
process.exit(falliti ? 1 : 0);
