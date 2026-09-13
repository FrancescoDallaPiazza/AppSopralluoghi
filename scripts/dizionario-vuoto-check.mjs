// Banco di prova della GUARDIA SUL DIZIONARIO VUOTO (`caricaDizionarioRuoli`,
// src/lib/admin/nomineImport.ts).
//
// Perche' esiste. Il 13 settembre 2026, subito dopo aver applicato la 068 in
// produzione, la chiave anon leggeva 0 righe da `ruolo_testo` e
// `ruolo_testo_figura` dove ne esistevano 27 e 32: RLS attive e nessuna policy
// (la 068 non ne scrive; vedi la 069). Una lettura negata dalle RLS NON da'
// errore, torna vuota - e `caricaDizionarioRuoli` su zero righe restituiva un
// dizionario vuoto senza lamentarsi. L'anteprima delle nomine avrebbe proseguito
// dichiarando "non riconosciute" tutte le righe col ruolo nella mansione.
//
// Il dizionario ha 27 chiavi per costruzione: zero non e' mai uno stato
// legittimo. La guardia lo fa diventare un errore, e questo script lo prova nei
// due versi - vuoto -> errore; il seme vero -> prosegue - sulla funzione VERA,
// con una `from()` finta al posto del database. Il seme e' letto dal file della
// 068, non ricopiato.
//
// Controllo negativo: sul codice precedente alla guardia (e18f8c5) G1 e G2
// FALLISCONO - il vuoto passa senza errore.
//
// Uso:  node scripts/dizionario-vuoto-check.mjs   (oppure: npm run dizionario:check)
// Esce 1 se un caso non torna.

import { build } from 'esbuild';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const fuori = join('node_modules', '.dizionario-check-' + process.pid + '.mjs');
await build({
  stdin: {
    contents: [
      "export { caricaDizionarioRuoli } from './src/lib/admin/nomineImport';",
      "export { supabase } from './src/lib/supabase';",
    ].join('\n'),
    resolveDir: '.', sourcefile: 'dizionario-entry.ts', loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: fuori, logLevel: 'error',
  external: ['xlsx'],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': 'undefined',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined',
  },
});
const { caricaDizionarioRuoli, supabase } = await import(pathToFileURL(fuori).href);
rmSync(fuori, { force: true });

// Il seme della 068, con le stesse espressioni di ruoli-testo-check.mjs.
const sql = readFileSync('supabase/migrations/068_nomine_provenienza_e_dizionario_ruoli.sql', 'utf8');
const dcap = (s) => s.replace(/''/g, "'");
function blocco(dopo) {
  const i = sql.indexOf(dopo);
  if (i < 0) { console.error('Non trovo il blocco: ' + dopo); process.exit(1); }
  const resto = sql.slice(i + dopo.length);
  return resto.slice(0, resto.indexOf('on conflict'));
}
const TESTI = [...blocco('insert into ruolo_testo (chiave, varianti, posizione, note) values').matchAll(
  /\(\s*'((?:[^']|'')*)'\s*,\s*array\[([^\]]*)\]\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*\)/g)]
  .map((m) => ({
    chiave: dcap(m[1]),
    varianti: [...m[2].matchAll(/'((?:[^']|'')*)'/g)].map((v) => dcap(v[1])),
    posizione: m[3], note: dcap(m[4]),
  }));
const FIGURE = [...blocco('insert into ruolo_testo_figura (chiave, ruolo_asserito, figura_codice) values').matchAll(
  /\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*(null|'(?:[^']|'')*')\s*\)/g)]
  .map((m) => ({ chiave: dcap(m[1]), ruolo_asserito: dcap(m[2]), figura_codice: m[3] === 'null' ? null : dcap(m[3].slice(1, -1)) }));
if (TESTI.length !== 27 || FIGURE.length !== 32) {
  console.error(`Seme della 068 letto male: ${TESTI.length} chiavi e ${FIGURE.length} asserzioni, attese 27 e 32.`);
  process.exit(1);
}

// Cio' che il database restituisce nel caso corrente, per tabella.
let TABELLE = {};
supabase.from = (tabella) => {
  const b = {
    select: () => b,
    order: () => b,
    range: async (da, a) => ({ data: (TABELLE[tabella] ?? []).slice(da, a + 1), error: null }),
  };
  return b;
};

async function esito(tabelle) {
  TABELLE = tabelle;
  try { await caricaDizionarioRuoli(); return { errore: null }; }
  catch (e) { return { errore: String(e?.message ?? e) }; }
}

const casi = [
  ['G1 · ruolo_testo vuoto (RLS senza policy): errore, non un dizionario vuoto', async () => {
    const r = await esito({ ruolo_testo: [], ruolo_testo_figura: [] });
    if (!r.errore) return 'nessun errore: il dizionario vuoto passa in silenzio';
    if (!/vuoto/i.test(r.errore)) return 'errore, ma non dice che il dizionario e\' vuoto: ' + r.errore;
  }],
  ['G2 · chiavi presenti ma asserzioni vuote: errore', async () => {
    const r = await esito({ ruolo_testo: TESTI, ruolo_testo_figura: [] });
    if (!r.errore) return 'nessun errore: 27 chiavi senza nessuna figura passano in silenzio';
  }],
  ['G3 · il seme vero della 068 (27 chiavi, 32 asserzioni): prosegue', async () => {
    const r = await esito({ ruolo_testo: TESTI, ruolo_testo_figura: FIGURE });
    if (r.errore) return 'errore sul dizionario completo: ' + r.errore;
  }],
];

let falliti = 0;
console.log('');
for (const [nome, fn] of casi) {
  const e = await fn();
  if (e) { falliti++; console.log(`  FALLISCE  ${nome}\n            ${e}`); }
  else console.log(`  ok        ${nome}`);
}
console.log(`\n  ${casi.length - falliti} su ${casi.length}.\n`);
process.exit(falliti ? 1 : 0);
