// Banco di prova del RIPIEGO SUL NOME per le persone senza codice fiscale
// (`riconciliaPersone`, src/lib/admin/anagraficheImport.ts).
//
// Perche' esiste. Il 13 settembre 2026 AppOverall ha letto nel codice, e qui e'
// stato verificato riga per riga, che la chiave di provenienza per nome
// (`anag:<cliente>:n:<cognome|nome>`) veniva calcolata anche quando il nome era
// AMBIGUO, e cercata PRIMA del controllo di ambiguita'. Al secondo import due
// omonimi senza CF finivano sulla STESSA scheda - l'upsert per id faceva vincere
// l'ultima riga - e al primo la seconda scheda nasceva senza provenienza, orfana.
// Esattamente la fusione silenziosa che il commento del ripiego dichiara di
// evitare: «meglio un doppione che si vede di due persone fuse per sbaglio».
//
// Si prova la funzione VERA, non una copia: il modulo e' compilato al volo e il
// client Supabase riceve una `from()` finta che restituisce l'archivio del caso.
// Nessuna rete, nessuna credenziale, nessuna scrittura.
//
// Il controllo negativo fa parte della prova: sul codice precedente alla
// riparazione (f25664e) i casi A1, A2 e A3 FALLISCONO. Un test che passa anche
// sul difetto non prova niente.
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
  cfNonValidi: 0, senzaCf: 0,
});
async function voci(archivio, righe) {
  ARCHIVIO = archivio;
  const [g] = await riconciliaPersone([gruppo(righe)]);
  return g.voci;
}

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

caso('A1 · secondo import, due omonimi senza CF: due schede, nessuna sovrascritta', async () => {
  const v = await voci(
    [scheda('P1', 'ROSSI', 'MARIO', { import_key: `anag:${CLI}:n:ROSSI|MARIO` })],
    [riga(2, 'Rossi', 'Mario', { mansione: 'A' }), riga(3, 'Rossi', 'Mario', { mansione: 'B' })],
  );
  const ids = v.map((x) => x.persona.id);
  if (v.length !== 2) return `voci ${v.length}, attese 2`;
  if (new Set(ids).size !== 2) return `le due righe sono finite sulla stessa scheda (${ids.join(', ')})`;
  if (ids.includes('P1')) return 'la scheda esistente P1 viene sovrascritta da una riga ambigua';
});

caso('A2 · primo import, due omonimi senza CF: nessuna delle due prende la chiave per nome', async () => {
  const v = await voci([], [riga(2, 'Rossi', 'Mario'), riga(3, 'Rossi', 'Mario')]);
  const chiavi = v.map((x) => x.persona.import_key);
  if (new Set(v.map((x) => x.persona.id)).size !== 2) return 'le due righe sono finite sulla stessa scheda';
  if (chiavi.some((k) => k && k.includes(':n:'))) {
    return `una riga ambigua ha preso la chiave per nome (${chiavi.map(String).join(', ')}): al prossimo import la ritrova l'altra`;
  }
});

caso('A3 · nome ambiguo NELL\'ARCHIVIO, univoco nel file: non si aggancia a nessuna delle due', async () => {
  const v = await voci(
    [scheda('P1', 'VERDI', 'ANNA', { import_key: `anag:${CLI}:n:VERDI|ANNA` }), scheda('P2', 'VERDI', 'ANNA')],
    [riga(2, 'Verdi', 'Anna')],
  );
  if (v.length !== 1) return `voci ${v.length}, attesa 1`;
  if (['P1', 'P2'].includes(v[0].persona.id)) return `agganciata a ${v[0].persona.id}: fra due omonime non si sceglie`;
});

caso('B1 · nome univoco senza CF: aggancia la scheda esistente, come prima', async () => {
  const v = await voci(
    [scheda('P1', 'BIANCHI', 'LUCA', { import_key: `anag:${CLI}:n:BIANCHI|LUCA` })],
    [riga(2, 'Bianchi', 'Luca', { mansione: 'NUOVA' })],
  );
  if (v.length !== 1 || v[0].persona.id !== 'P1') return `non aggancia P1 (${v.map((x) => x.persona.id)})`;
  if (v[0].nuova) return 'risulta nuova';
  if (v[0].persona.import_key !== `anag:${CLI}:n:BIANCHI|LUCA`) return 'la provenienza e\' cambiata';
});

caso('B2 · nome univoco senza CF, scheda senza provenienza: aggancia per nome e la marca', async () => {
  const v = await voci([scheda('P1', 'NERI', 'PAOLA')], [riga(2, 'Neri', 'Paola')]);
  if (v.length !== 1 || v[0].persona.id !== 'P1') return `non aggancia P1 (${v.map((x) => x.persona.id)})`;
  if (v[0].persona.import_key !== `anag:${CLI}:n:NERI|PAOLA`) return `provenienza ${v[0].persona.import_key}`;
});

caso('B3 · primo import, nome univoco senza CF: scheda nuova con la chiave per nome', async () => {
  const v = await voci([], [riga(2, 'Gialli', 'Ugo')]);
  if (v.length !== 1 || !v[0].nuova) return 'non e\' nuova';
  if (v[0].persona.import_key !== `anag:${CLI}:n:GIALLI|UGO`) return `provenienza ${v[0].persona.import_key}`;
});

caso('C1 · con CF: la provenienza e il CF agganciano come prima, omonimi o no', async () => {
  const cf = 'RSSMRA80A01H501U';
  const v = await voci(
    [scheda('P1', 'ROSSI', 'MARIO', { codice_fiscale: cf, import_key: `anag:${CLI}:${cf}` }), scheda('P2', 'ROSSI', 'MARIO')],
    [riga(2, 'Rossi', 'Mario', { codicefiscale: cf })],
  );
  if (v.length !== 1 || v[0].persona.id !== 'P1') return `non aggancia P1 (${v.map((x) => x.persona.id)})`;
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
