// Banco di prova del RIPIEGO SUL NOME per le persone senza codice fiscale
// (`riconciliaPersone`, src/lib/admin/anagraficheImport.ts).
//
// Perche' esiste. Il 13 settembre 2026 AppOverall ha letto nel codice, e qui e'
// stato verificato riga per riga, che la chiave di provenienza per nome
// (`anag:<cliente>:n:<cognome|nome>`) veniva calcolata anche quando il nome era
// AMBIGUO, e cercata PRIMA del controllo di ambiguita'. Al secondo import due
// omonimi senza CF finivano sulla STESSA scheda - l'upsert per id faceva vincere
// l'ultima riga - e al primo la seconda scheda nasceva senza provenienza, orfana.
//
// Due passi, lo stesso giorno:
//   bb141ee  il nome ambiguo non cerca e non marca piu': la riga torna "riga:N",
//            nuova. Niente fusioni - ma a ogni import dello stesso file due
//            schede in piu' (2, 4, 6...).
//   dopo     DECISIONE DI FRANCESCO, 13.09: la riga ambigua NON SI SCRIVE. Va in
//            `daAbbinare` con il motivo, fuori dalle voci e dai conteggi. Dove la
//            fonte non da' una chiave non se ne inventa una, e l'import resta
//            idempotente.
//
// Si prova la funzione VERA, non una copia: il modulo e' compilato al volo e il
// client Supabase riceve una `from()` finta che restituisce l'archivio del caso.
// Nessuna rete, nessuna credenziale, nessuna scrittura.
//
// Il controllo negativo fa parte della prova: A1-A3 falliscono su f25664e (prima
// di tutte e due le riparazioni), A1-A4 falliscono su bb141ee (che creava schede
// per gli ambigui). Un test che passa anche sul difetto non prova niente.
//
// Uso:  node scripts/omonimi-check.mjs      (oppure: npm run omonimi:check)
// Esce 1 se un caso non torna.

import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Dentro il repo e con `xlsx` esterno, per la stessa ragione di nomine-dryrun.mjs.
const fuori = join('node_modules', '.omonimi-check-' + process.pid + '.mjs');
await build({
  stdin: {
    contents: [
      "export { riconciliaPersone } from './src/lib/admin/anagraficheImport';",
      "export { supabase } from './src/lib/supabase';",
    ].join('\n'),
    resolveDir: '.', sourcefile: 'omonimi-entry.ts', loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: fuori, logLevel: 'error',
  external: ['xlsx'],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': 'undefined',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined',
  },
});
const { riconciliaPersone, supabase } = await import(pathToFileURL(fuori).href);
rmSync(fuori, { force: true });

// L'archivio del caso corrente. `riconciliaPersone` legge solo
// from('persona').select('*').in('cliente_id', ids).order(...).range(...).
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

const CLI = 'cli-1';
const scheda = (id, cognome, nome, extra = {}) => ({
  id, cliente_id: CLI, nome, cognome, codice_fiscale: null, mansione: 'VECCHIA', reparto: null,
  data_assunzione: null, data_cessazione: null, livello_rischio: null, attivo: true, note: null,
  formazione_pregressa: false, import_key: null, ...extra,
});
const riga = (n, cognome, nome, extra = {}) => ({ n, col: { cognome, nome, ...extra } });
const gruppo = (righe) => ({
  chiave: 'g', etichetta: 'G', partita_iva: null, sede: null, righe, cliente_id: CLI,
  motivoAbbinamento: '', collisione: null, candidati: [], voci: [], nuove: 0, aggiornate: 0,
  cfNonValidi: 0, senzaCf: 0, daAbbinare: [],
});
async function piano(archivio, righe) {
  ARCHIVIO = archivio;
  const [g] = await riconciliaPersone([gruppo(righe)]);
  return g;
}
// Cio' che `applicaPersone` farebbe: upsert per id di ogni voce.
function applica(g) {
  for (const v of g.voci) {
    const i = ARCHIVIO.findIndex((p) => p.id === v.persona.id);
    if (i >= 0) ARCHIVIO[i] = v.persona; else ARCHIVIO.push(v.persona);
  }
}
const abbinare = (g) => g.daAbbinare?.length ?? 0;

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

caso('A1 · secondo import, due omonimi senza CF: nessuna voce, 2 da abbinare, P1 non toccata', async () => {
  const g = await piano(
    [scheda('P1', 'ROSSI', 'MARIO', { import_key: `anag:${CLI}:n:ROSSI|MARIO` })],
    [riga(2, 'Rossi', 'Mario', { mansione: 'A' }), riga(3, 'Rossi', 'Mario', { mansione: 'B' })],
  );
  if (g.voci.some((v) => v.persona.id === 'P1')) return 'la scheda esistente P1 viene riscritta da una riga ambigua';
  if (g.voci.length !== 0) return `${g.voci.length} voci da scrivere, attese 0`;
  if (abbinare(g) !== 2) return `${abbinare(g)} da abbinare, attese 2`;
});

caso('A2 · primo import, due omonimi senza CF: nessuna scheda, 2 da abbinare, fuori dai conteggi', async () => {
  const g = await piano([], [riga(2, 'Rossi', 'Mario'), riga(3, 'Rossi', 'Mario')]);
  if (g.voci.length !== 0) return `${g.voci.length} voci da scrivere, attese 0`;
  if (g.nuove !== 0 || g.aggiornate !== 0) return `conteggi ${g.nuove} nuove · ${g.aggiornate} aggiornate, attesi 0 · 0`;
  if (abbinare(g) !== 2) return `${abbinare(g)} da abbinare, attese 2`;
  if (!g.daAbbinare.every((d) => /nel file/.test(d.motivo))) return 'il motivo non dice "omonimo nel file"';
});

caso('A3 · nome ambiguo NELL\'ARCHIVIO, univoco nel file: nessuna voce, 1 da abbinare', async () => {
  const g = await piano(
    [scheda('P1', 'VERDI', 'ANNA', { import_key: `anag:${CLI}:n:VERDI|ANNA` }), scheda('P2', 'VERDI', 'ANNA')],
    [riga(2, 'Verdi', 'Anna')],
  );
  if (g.voci.length !== 0) return `${g.voci.length} voci (${g.voci.map((v) => v.persona.id)}), attese 0`;
  if (abbinare(g) !== 1) return `${abbinare(g)} da abbinare, attesa 1`;
  if (!/archivio/.test(g.daAbbinare[0].motivo)) return 'il motivo non dice "in archivio"';
});

caso('A4 · lo stesso file con due omonimi, applicato due volte: 0 schede e 2 da abbinare a ogni passaggio', async () => {
  ARCHIVIO = [];
  const righe = [riga(2, 'Rossi', 'Mario'), riga(3, 'Rossi', 'Mario')];
  const esiti = [];
  for (let passaggio = 1; passaggio <= 2; passaggio++) {
    const prima = ARCHIVIO.length;
    const [g] = await riconciliaPersone([gruppo(righe)]);
    applica(g);
    esiti.push({ create: ARCHIVIO.length - prima, abbinare: abbinare(g), totale: ARCHIVIO.length });
  }
  const sbagliati = esiti.filter((e) => e.create !== 0 || e.abbinare !== 2);
  if (sbagliati.length) {
    return 'schede in archivio dopo ogni passaggio: ' + esiti.map((e) => e.totale).join(' poi ')
      + ' · da abbinare: ' + esiti.map((e) => e.abbinare).join(' poi ');
  }
});

caso('B1 · nome univoco senza CF: aggancia la scheda esistente, come prima', async () => {
  const g = await piano(
    [scheda('P1', 'BIANCHI', 'LUCA', { import_key: `anag:${CLI}:n:BIANCHI|LUCA` })],
    [riga(2, 'Bianchi', 'Luca', { mansione: 'NUOVA' })],
  );
  const v = g.voci;
  if (v.length !== 1 || v[0].persona.id !== 'P1') return `non aggancia P1 (${v.map((x) => x.persona.id)})`;
  if (v[0].nuova) return 'risulta nuova';
  if (v[0].persona.import_key !== `anag:${CLI}:n:BIANCHI|LUCA`) return 'la provenienza e\' cambiata';
  if (abbinare(g) !== 0) return 'un nome univoco finisce fra i da abbinare';
});

caso('B2 · nome univoco senza CF, scheda senza provenienza: aggancia per nome e la marca', async () => {
  const v = (await piano([scheda('P1', 'NERI', 'PAOLA')], [riga(2, 'Neri', 'Paola')])).voci;
  if (v.length !== 1 || v[0].persona.id !== 'P1') return `non aggancia P1 (${v.map((x) => x.persona.id)})`;
  if (v[0].persona.import_key !== `anag:${CLI}:n:NERI|PAOLA`) return `provenienza ${v[0].persona.import_key}`;
});

caso('B3 · primo import, nome univoco senza CF: scheda nuova con la chiave per nome', async () => {
  const v = (await piano([], [riga(2, 'Gialli', 'Ugo')])).voci;
  if (v.length !== 1 || !v[0].nuova) return 'non e\' nuova';
  if (v[0].persona.import_key !== `anag:${CLI}:n:GIALLI|UGO`) return `provenienza ${v[0].persona.import_key}`;
});

caso('C1 · con CF: la provenienza e il CF agganciano come prima, omonimi o no', async () => {
  const cf = 'RSSMRA80A01H501U';
  const g = await piano(
    [scheda('P1', 'ROSSI', 'MARIO', { codice_fiscale: cf, import_key: `anag:${CLI}:${cf}` }), scheda('P2', 'ROSSI', 'MARIO')],
    [riga(2, 'Rossi', 'Mario', { codicefiscale: cf })],
  );
  const v = g.voci;
  if (v.length !== 1 || v[0].persona.id !== 'P1') return `non aggancia P1 (${v.map((x) => x.persona.id)})`;
  if (abbinare(g) !== 0) return 'una riga con CF finisce fra i da abbinare';
});

let falliti = 0;
console.log('');
for (const { nome, fn } of casi) {
  let esito;
  try { esito = await fn(); } catch (e) { esito = 'eccezione: ' + (e?.message ?? e); }
  if (esito) { falliti++; console.log(`  FALLISCE  ${nome}\n            ${esito}`); }
  else console.log(`  ok        ${nome}`);
}
console.log(`\n  ${casi.length - falliti} su ${casi.length}.\n`);
process.exit(falliti ? 1 : 0);
