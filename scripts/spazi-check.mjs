// BANCO DI PROVA DEGLI SPAZI RIPETUTI nei campi persona (`leggiCampiPersona`,
// src/lib/admin/anagraficheImport.ts).
//
// Perche' esiste. Il 14 settembre 2026, rifacendo l'anteprima delle anagrafiche
// sull'export del 09/09 e sull'archivio di produzione, 24 schede risultavano
// "aggiornate" senza cambiare niente: il file scrive «GIULIANA  FRANCA» con due
// spazi dove l'archivio ha «GIULIANA FRANCA». I campi erano mansione 14,
// cognome 5, nome 3, reparto 3 (una scheda ne ha due). Francesco ha deciso:
// si ripulisce. Da allora nei quattro campi gli spazi ripetuti diventano uno.
//
// Le tre condizioni poste da AppOverall, e i casi che le provano:
//   - la chiave di provenienza delle persone SENZA codice fiscale
//     (anag:<cliente>:n:COGNOME|NOME) non cambia, perche' una chiave diversa di
//     uno spazio farebbe ricreare la persona al primo import, senza errore: S2;
//   - il collasso tocca solo quei quattro campi: S1 e S4;
//   - le schede che differivano solo per gli spazi non cambiano piu': S3.
// Sul dizionario dei ruoli: legge la mansione DALLA COLONNA DEL FILE
// (`testoLibero` in nomineImport.ts) e la confronta con `chiaveTesto`, che
// collassava gia' gli spazi; `persona.mansione` non ci passa mai.
//
// Il controllo negativo fa parte della prova:
//   ANAG_MODULO=./src/lib/admin/<copia>.ts node scripts/spazi-check.mjs
// compila un'altra versione di anagraficheImport.ts (quella di prima, copiata
// accanto all'originale): S1 e S3 devono fallire, S2 e S4 devono passare,
// perche' sono proprio le cose che NON devono cambiare.
//
// Uso:  node scripts/spazi-check.mjs      (oppure: npm run spazi:check)
// Esce 1 se un caso non torna.

import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulo = process.env.ANAG_MODULO ?? './src/lib/admin/anagraficheImport';
const fuori = join('node_modules', '.spazi-check-' + process.pid + '.mjs');
await build({
  stdin: {
    contents: [
      `export { leggiCampiPersona, riconciliaPersone } from '${modulo}';`,
      "export { supabase } from './src/lib/supabase';",
    ].join('\n'),
    resolveDir: '.', sourcefile: 'spazi-entry.ts', loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: fuori, logLevel: 'error',
  external: ['xlsx'],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': 'undefined',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined',
  },
});
const { leggiCampiPersona, riconciliaPersone, supabase } = await import(pathToFileURL(fuori).href);
rmSync(fuori, { force: true });

const CLI = 'cli-1';
let ARCHIVIO = [];
supabase.from = (tabella) => {
  if (tabella !== 'persona') throw new Error('lettura inattesa su ' + tabella);
  let ids = null;
  const b = {
    select: () => b,
    in: (_col, v) => { ids = v; return b; },
    order: () => b,
    range: async () => ({ data: ARCHIVIO.filter((p) => !ids || ids.includes(p.cliente_id)), error: null }),
  };
  return b;
};

const scheda = (id, extra) => ({
  id, cliente_id: CLI, nome: '', cognome: null, codice_fiscale: null, mansione: null, reparto: null,
  data_assunzione: null, data_cessazione: null, livello_rischio: null, attivo: true, note: 'NOTA  CON  SPAZI',
  formazione_pregressa: false, import_key: null, ...extra,
});
const gruppo = (righe) => ({
  chiave: 'g', etichetta: 'G', partita_iva: null, sede: null, righe, cliente_id: CLI,
  motivoAbbinamento: '', collisione: null, candidati: [], voci: [], nuove: 0, aggiornate: 0,
  cfNonValidi: 0, senzaCf: 0, daAbbinare: [],
});
const CF = 'RSSGLN80A41L781X';
const CAMPI = ['nome', 'cognome', 'codice_fiscale', 'mansione', 'reparto', 'data_assunzione', 'data_cessazione', 'attivo', 'import_key', 'cliente_id', 'note'];

const casi = [
  ['S1 · i quattro campi di testo escono con uno spazio solo', async () => {
    const c = leggiCampiPersona({
      cognome: 'DE  ROSSI', nome: 'GIULIANA  FRANCA', codicefiscale: CF,
      mansione: 'Addetto   magazzino', reparto: 'HOTEL  - HI TRENTO',
    });
    const atteso = { cognome: 'DE ROSSI', nome: 'GIULIANA FRANCA', mansione: 'ADDETTO MAGAZZINO', reparto: 'HOTEL - HI TRENTO' };
    const diversi = Object.keys(atteso).filter((k) => c[k] !== atteso[k]);
    if (diversi.length) return diversi.map((k) => `${k} ${JSON.stringify(c[k])}`).join('; ');
  }],

  ['S2 · senza CF: la chiave per nome resta quella di prima, e la scheda si ritrova', async () => {
    // Una scheda gia' scritta da un import, con la chiave che il codice di
    // prima calcolava (normNome collassava gia'), e una persona nuova.
    ARCHIVIO = [scheda('P1', { cognome: 'DE ROSSI', nome: 'MARIO LUIGI', import_key: `anag:${CLI}:n:DE ROSSI|MARIO LUIGI` })];
    const [g] = await riconciliaPersone([gruppo([
      { n: 3, col: { cognome: 'De  Rossi', nome: 'Mario  Luigi' } },
      { n: 4, col: { cognome: 'VERDI', nome: 'ANNA   MARIA' } },
    ])]);
    const voce = (n) => g.voci.find((v) => v.riga === n);
    const errori = [];
    if (g.voci.length !== 2 || g.daAbbinare.length) errori.push(`${g.voci.length} voci, ${g.daAbbinare.length} da abbinare`);
    if (!voce(3) || voce(3).nuova || voce(3).persona.id !== 'P1') errori.push(`riga 3 non ritrova P1: ${JSON.stringify(voce(3)?.persona)}`);
    if (voce(3)?.persona.import_key !== `anag:${CLI}:n:DE ROSSI|MARIO LUIGI`) errori.push(`riga 3 chiave ${voce(3)?.persona.import_key}`);
    if (voce(4)?.persona.import_key !== `anag:${CLI}:n:VERDI|ANNA MARIA`) errori.push(`riga 4 chiave ${voce(4)?.persona.import_key}`);
    if (errori.length) return errori.join(' · ');
  }],

  ['S3 · con CF: la scheda che differiva solo per gli spazi non cambia piu\'', async () => {
    const prima = scheda('P2', {
      cognome: 'DE ROSSI', nome: 'GIULIANA FRANCA', codice_fiscale: CF,
      mansione: 'ADDETTO MAGAZZINO', reparto: 'HOTEL - HI TRENTO', import_key: `anag:${CLI}:${CF}`,
    });
    ARCHIVIO = [prima];
    const [g] = await riconciliaPersone([gruppo([
      { n: 5, col: { cognome: 'DE  ROSSI', nome: 'GIULIANA  FRANCA', codicefiscale: CF, mansione: 'ADDETTO  MAGAZZINO', reparto: 'HOTEL  - HI TRENTO' } },
    ])]);
    const v = g.voci[0];
    if (!v || v.nuova) return 'la scheda non e\' stata ritrovata';
    const diversi = CAMPI.filter((k) => String(prima[k] ?? null) !== String(v.persona[k] ?? null));
    if (diversi.length) return diversi.map((k) => `${k} ${JSON.stringify(prima[k])} -> ${JSON.stringify(v.persona[k])}`).join('; ');
  }],

  ['S4 · il resto non si tocca: CF, date, un testo gia\' pulito, le note', async () => {
    const c = leggiCampiPersona({
      cognome: 'ROSSI', nome: 'ANNA', codicefiscale: ' rssnna80a41l781x ', mansione: 'Operaio - Linea 2',
      reparto: '', dataassunzione: '2020-03-01',
    });
    const errori = [];
    if (c.cf !== 'RSSNNA80A41L781X') errori.push(`cf ${c.cf}`);
    if (c.mansione !== 'OPERAIO - LINEA 2') errori.push(`mansione ${c.mansione}`);
    if (c.reparto !== null) errori.push(`reparto ${c.reparto}`);
    if (c.data_assunzione !== '2020-03-01') errori.push(`data ${c.data_assunzione}`);
    // Le note non vengono dal file: la scheda le tiene com'erano, spazi compresi.
    ARCHIVIO = [scheda('P3', { cognome: 'ROSSI', nome: 'ANNA', codice_fiscale: 'RSSNNA80A41L781X' })];
    const [g] = await riconciliaPersone([gruppo([{ n: 6, col: { cognome: 'ROSSI', nome: 'ANNA', codicefiscale: 'RSSNNA80A41L781X' } }])]);
    if (g.voci[0]?.persona.note !== 'NOTA  CON  SPAZI') errori.push(`note ${JSON.stringify(g.voci[0]?.persona.note)}`);
    if (errori.length) return errori.join(' · ');
  }],
];

let falliti = 0;
console.log(`modulo: ${modulo}`);
for (const [nome, prova] of casi) {
  let esito;
  try { esito = await prova(); } catch (e) { esito = 'eccezione: ' + (e?.message ?? e); }
  if (esito) { falliti++; console.log(`NO  ${nome}\n    ${esito}`); } else console.log(`ok  ${nome}`);
}
console.log(falliti ? `\n${falliti} casi su ${casi.length} non tornano.` : `\nTutti i ${casi.length} casi tornano.`);
process.exit(falliti ? 1 : 0);
