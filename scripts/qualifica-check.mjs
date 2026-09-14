// BANCO DI PROVA DELLA QUALIFICA COME FONTE DISTINTA (import delle nomine).
//
// Perche' esiste. Il 14 settembre 2026 si e' visto che il foglio "Ruoli SSL" ha due
// colonne di testo libero, Qualifica (X) e Mansione (Y), e che l'import leggeva la
// mansione dalla prima non vuota fra mansione, ruolo e qualifica. La Qualifica
// entrava solo con la Mansione vuota, travestita da mansione: 6 nomine scritte
// quel giorno portano origine = 'mansione' e vengono dalla Qualifica, e 38 righe
// con un ruolo scritto in Qualifica accanto a una Mansione piena non venivano
// lette. Francesco ha deciso: la Qualifica e' una fonte sua, con la sua origine.
//
// Cosa fa. Compila `pianificaNomine` e `riepiloga` VERI e li fa girare su righe
// costruite apposta, con un client Supabase finto: il dizionario e' il seme della
// 068 piu' quello della 070, letti dai file delle migrazioni. NESSUNA RETE,
// NESSUN DATABASE.
//
// Il controllo negativo fa parte della prova:
//   NOMINE_MODULO=<file .ts> node scripts/qualifica-check.mjs
// compila un'altra versione di nomineImport.ts (per esempio quella di main prima
// della modifica, copiata accanto all'originale) e deve fallire.
//
// Uso:  node scripts/qualifica-check.mjs      (oppure: npm run qualifica:check)
// Esce 1 se un caso non torna.

import { build } from 'esbuild';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulo = process.env.NOMINE_MODULO ?? './src/lib/admin/nomineImport';
const fuori = join('node_modules', '.qualifica-check-' + process.pid + '.mjs');
await build({
  stdin: {
    contents: [
      `export { pianificaNomine, riepiloga } from '${modulo}';`,
      "export { supabase } from './src/lib/supabase';",
    ].join('\n'),
    resolveDir: '.', sourcefile: 'qualifica-entry.ts', loader: 'ts',
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

// ---------------------------------------------------------------------------
// Il dizionario: 068 + 070, dai file, con lo stesso parsing di ruoli-testo-check.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// L'archivio del caso e il client finto
// ---------------------------------------------------------------------------
const CLI = 'CL1';
const PERSONE = [
  ['P2', 'ROSSI', 'MARIO'], ['P3', 'BIANCHI', 'ANNA'], ['P4', 'VERDI', 'LUCA'], ['P5', 'NERI', 'PAOLA'],
  ['P6', 'GIALLI', 'RITA'], ['P7', 'BLU', 'MARCO'], ['P8', 'VIOLA', 'SARA'],
].map(([id, cognome, nome]) => ({ id, cliente_id: CLI, cognome, nome, codice_fiscale: null }));
const NOMINE = [{ persona_id: 'P7', figura_codice: 'rls' }];   // BLU e' gia' RLS
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

// Il foglio: le intestazioni vere del "Ruoli SSL" che servono al caso.
const riga = (n, cognome, nome, col) => ({ n, col: { societa: 'ACME SRL', sede: '', cognome, nome, ...col } });
const foglio = {
  nomeFile: 'prova.xlsx', rigaHeader: 2, tipo: 'persone', motivoTipo: '', riconosciute: [], ignorate: [],
  intestazioni: ['Società', 'Sede', 'Cognome', 'Nome', 'Qualifica', 'Mansione', 'Preposto', 'RLS'],
  righe: [
    riga(2, 'Rossi', 'Mario', { qualifica: 'RSPP/titolare', mansione: '' }),               // solo Qualifica, nel dizionario 068
    riga(3, 'Bianchi', 'Anna', { qualifica: 'RLS', mansione: 'OPERAIO' }),                 // Qualifica accanto a Mansione piena, forma 070
    riga(4, 'Verdi', 'Luca', { qualifica: 'RSPP/titolare', mansione: 'RSPP/TITOLARE' }),   // lo stesso testo due volte
    riga(5, 'Neri', 'Paola', { qualifica: 'Lavoratore e preposto', mansione: 'IMPIEGATA', preposto: '2020-01-01' }),
    riga(6, 'Gialli', 'Rita', { qualifica: 'Legale Rappresentante/RSPP', mansione: 'IMPIEGATA' }), // conosciuta, non mappabile
    riga(7, 'Blu', 'Marco', { qualifica: 'RLS - LAVORATORE', mansione: 'AUTISTA' }),       // gia' in organigramma
    riga(8, 'Viola', 'Sara', { qualifica: 'CAPO SQUADRA', mansione: 'OPERAIO' }),          // nessuna parola di ruolo
  ],
};
const clienti = [{ id: CLI, ragione_sociale: 'ACME SRL', partita_iva: null, localita: null, cap: null, operativa: null }];

// ---------------------------------------------------------------------------
// I casi
// ---------------------------------------------------------------------------
const p = await pianificaNomine(foglio, clienti, {});
const r = riepiloga(p);
const di = (n) => p.proposte.filter((x) => x.riga === n);
const casi = [
  ['Q1 · solo Qualifica (Mansione vuota): la nomina porta origine = qualifica', () => {
    const x = di(2);
    if (x.length !== 1) return `${x.length} proposte, attesa 1`;
    if (x[0].figura_codice !== 'dl_rspp' || x[0].origine !== 'qualifica' || x[0].origine_testo !== 'RSPP/TITOLARE')
      return JSON.stringify(x[0]);
  }],
  ['Q2 · Qualifica accanto a una Mansione piena: si legge, forma della 070', () => {
    const x = di(3);
    if (x.length !== 1 || x[0].figura_codice !== 'rls' || x[0].origine !== 'qualifica') return JSON.stringify(x);
  }],
  ['Q3 · stesso testo in Mansione e Qualifica: una proposta sola, dalla mansione', () => {
    const x = di(4);
    if (x.length !== 1 || x[0].origine !== 'mansione') return JSON.stringify(x);
    if (p.daDecidere.some((d) => d.riga === 4)) return 'la riga 4 finisce anche fra i da decidere';
  }],
  ['Q4 · colonna Preposto e «Lavoratore e preposto»: nel riepilogo resta la colonna', () => {
    const nuove = p.proposte.filter((x) => x.riga === 5);
    if (nuove.length !== 2) return `${nuove.length} proposte grezze, attese 2 (colonna e qualifica)`;
    if (r.perFigura.find((f) => f.figura === 'preposto')?.n !== 1) return JSON.stringify(r.perFigura);
  }],
  ['Q5 · forma conosciuta e non mappabile: da decidere, con fonte = qualifica', () => {
    const d = p.daDecidere.filter((x) => x.riga === 6);
    if (d.length !== 1 || d[0].fonte !== 'qualifica' || d[0].testo !== 'LEGALE RAPPRESENTANTE/RSPP') return JSON.stringify(d);
  }],
  ['Q6 · RLS - LAVORATORE su chi e\' gia\' RLS: gia\' in organigramma', () => {
    const x = di(7);
    if (x.length !== 1 || !x[0].gia || x[0].figura_codice !== 'rls') return JSON.stringify(x);
  }],
  ['Q7 · il riepilogo conta per fonte, senza doppioni', () => {
    const atteso = { daCreare: 4, giaPresenti: 1, daDecidere: 1, colonna: 1, mansione: 1, qualifica: 2 };
    const visto = { daCreare: r.daCreare, giaPresenti: r.giaPresenti, daDecidere: r.daDecidere, ...r.perOrigine };
    for (const k of Object.keys(atteso)) if (visto[k] !== atteso[k]) return `visto ${JSON.stringify(visto)}`;
  }],
  ['Q8 · le qualifiche che il dizionario non conosce si elencano', () => {
    const q = p.qualificheNuove ?? [];
    if (!q.some((x) => x.testo === 'CAPO SQUADRA')) return JSON.stringify(q);
    if (q.some((x) => x.testo === 'RLS')) return 'RLS e\' nella 070 e non dovrebbe essere nuova';
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
