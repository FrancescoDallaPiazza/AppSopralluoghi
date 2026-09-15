// BANCO DI PROVA DELL'ETICHETTA DEI CLIENTI OMONIMI (tendine degli import).
//
// Perche' esiste. Il 14 settembre 2026, nell'import delle anagrafiche, i due
// clienti IGEA comparivano nella tendina con la stessa etichetta, «IGEA SRL
// UNIPERSONALE — San Bonifacio (37047)», e differivano solo per l'indirizzo. Per
// scegliere quello giusto si e' dovuto leggere l'id con Ispeziona. Adesso chi ha
// un omonimo porta l'indirizzo, e se non basta l'inizio dell'id
// (distinguiOmonimi, formazioneImport.ts).
//
// Cosa fa. Compila `caricaClientiScelta` ed `etichettaCliente` VERI e li fa
// girare con un client Supabase finto: le tabelle `cliente` e `sede` sono
// costruite apposta. NESSUNA RETE, NESSUN DATABASE.
//
// Il controllo negativo fa parte della prova:
//   CLIENTI_MODULO=<file .ts> node scripts/etichetta-omonimi-check.mjs
// compila un'altra versione di formazioneImport.ts (per esempio quella di main,
// copiata accanto all'originale) e deve fallire.
//
// Uso:  node scripts/etichetta-omonimi-check.mjs   (oppure: npm run omonimi-etichetta:check)
// Esce 1 se un caso non torna.

import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulo = process.env.CLIENTI_MODULO ?? './src/lib/admin/formazioneImport';
const fuori = join('node_modules', '.etichetta-omonimi-check-' + process.pid + '.mjs');
await build({
  stdin: {
    contents: [
      `export { caricaClientiScelta, etichettaCliente } from '${modulo}';`,
      "export { supabase } from './src/lib/supabase';",
    ].join('\n'),
    resolveDir: '.', sourcefile: 'etichetta-omonimi-entry.ts', loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: fuori, logLevel: 'error',
  external: ['xlsx'],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': 'undefined',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined',
  },
});
const { caricaClientiScelta, etichettaCliente, supabase } = await import(pathToFileURL(fuori).href);
rmSync(fuori, { force: true });

// ---------- le tabelle finte ----------
const cl = (id, ragione_sociale, localita, cap, indirizzo) =>
  ({ id, ragione_sociale, partita_iva: '04366240234', localita, cap, indirizzo, attivo: true });
const CLIENTI = [
  // E1: i due IGEA del 14.09, l'indirizzo sta sull'anagrafica
  cl('3f485f16-bdf6-4106-8caa-0361e1889a80', 'IGEA SRL UNIPERSONALE', 'San Bonifacio', '37047', 'Via Sorte 48'),
  cl('def8645c-0000-4000-8000-000000000000', 'IGEA SRL UNIPERSONALE', 'San Bonifacio', '37047', 'Via Michelangelo 7'),
  // E2: stessa anagrafica, sedi operative diverse nello stesso comune
  cl('aaaaaaaa-0000-4000-8000-000000000001', 'ECODENT S.R.L.', 'Verona', '37100', 'Via Legale 1'),
  cl('aaaaaaaa-0000-4000-8000-000000000002', 'ECODENT S.R.L.', 'Verona', '37100', 'Via Legale 1'),
  // E3: doppioni veri, stesso indirizzo
  cl('bbbbbbbb-0000-4000-8000-000000000001', 'MARANI G. SPA', 'Bovolone', '37051', "Via dell'Artigianato 51"),
  cl('cccccccc-0000-4000-8000-000000000002', 'MARANI G. SPA', 'Bovolone', '37051', "Via dell'Artigianato 51"),
  // E4: nessun omonimo
  cl('dddddddd-0000-4000-8000-000000000001', 'ACME SRL', 'Verona', '37100', 'Via Unica 3'),
];
const SEDI = [
  { id: 's1', cliente_id: 'aaaaaaaa-0000-4000-8000-000000000001', localita: 'Villafranca', cap: '37069', indirizzo: 'Via Belgio 6', attivo: true, principale: false },
  { id: 's2', cliente_id: 'aaaaaaaa-0000-4000-8000-000000000002', localita: 'Villafranca', cap: '37069', indirizzo: 'Via del Lavoro 6/8', attivo: true, principale: false },
];
const TABELLE = { cliente: CLIENTI, sede: SEDI };
supabase.from = (tabella) => {
  if (!(tabella in TABELLE)) throw new Error('lettura inattesa su ' + tabella);
  let righe = [...TABELLE[tabella]];
  const b = {
    select: () => b,
    eq: (c, v) => { righe = righe.filter((r) => r[c] === v); return b; },
    order: () => b,
    range: async (da, a) => ({ data: righe.slice(da, a + 1), error: null }),
  };
  return b;
};

const scelta = await caricaClientiScelta();
const et = (id) => etichettaCliente(scelta.find((c) => c.id === id));

const casi = [
  ['E1 · i due IGEA: etichette diverse, ognuna con il suo indirizzo', () => {
    const a = et('3f485f16-bdf6-4106-8caa-0361e1889a80'), b = et('def8645c-0000-4000-8000-000000000000');
    if (a === b) return `identiche: «${a}»`;
    if (!a.includes('Via Sorte 48') || !b.includes('Via Michelangelo 7')) return `«${a}» / «${b}»`;
  }],
  ['E2 · stessa operativa per comune e CAP: vale l\'indirizzo dell\'operativa', () => {
    const a = et('aaaaaaaa-0000-4000-8000-000000000001'), b = et('aaaaaaaa-0000-4000-8000-000000000002');
    if (a === b) return `identiche: «${a}»`;
    if (!a.includes('Via Belgio 6') || !b.includes('Via del Lavoro 6/8')) return `«${a}» / «${b}»`;
  }],
  ['E3 · doppioni con lo stesso indirizzo: si distinguono per l\'inizio dell\'id', () => {
    const a = et('bbbbbbbb-0000-4000-8000-000000000001'), b = et('cccccccc-0000-4000-8000-000000000002');
    if (a === b) return `identiche: «${a}»`;
    if (!a.includes('id bbbbbbbb') || !b.includes('id cccccccc')) return `«${a}» / «${b}»`;
  }],
  ['E4 · chi non ha omonimi resta com\'era', () => {
    const a = et('dddddddd-0000-4000-8000-000000000001');
    if (a !== 'ACME SRL — Verona (37100)') return `«${a}»`;
  }],
  ['E5 · nella tendina nessuna etichetta e\' ripetuta', () => {
    const tutte = scelta.map((c) => etichettaCliente(c));
    const doppie = tutte.filter((t, i) => tutte.indexOf(t) !== i);
    if (doppie.length) return `ripetute: ${[...new Set(doppie)].join(' | ')}`;
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
