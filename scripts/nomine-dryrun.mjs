// PROVA A VUOTO DEL LETTORE DELLE NOMINE, su un export vero. Sola lettura.
//
// Perche' esiste. L'import delle nomine e' stato scritto il 12 settembre 2026 e
// non ha mai visto una riga vera: `ExportExcel (4).xlsx` non era su quella
// macchina. `npm run ruoli:check` prova la REGOLA del dizionario; questo prova
// l'altra meta', cioe' il PLUMBING - che il foglio si trovi per nome, che
// l'intestazione si riconosca, che le nove colonne aggancino davvero.
//
// Sono due cose diverse e falliscono in modi diversi: una regola giusta su un
// foglio che non si apre non importa niente, e un foglio che si apre con una
// regola sbagliata importa il dato sbagliato.
//
// NON TOCCA IL DATABASE e non scrive niente. Non risolve le persone (per quello
// servono le anagrafiche) e non applica il dizionario (per quello serve
// `ruolo_testo`): dice solo cosa il lettore VEDE nel file.
//
// Uso:  node scripts/nomine-dryrun.mjs "percorso/ExportExcel (4).xlsx"
//
// Esce 1 se il foglio non c'e' o se nessuna colonna di ruolo aggancia - cioe'
// nei due casi in cui l'import girerebbe senza dire niente e senza fare niente.

import { build } from 'esbuild';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const percorso = process.argv[2];
if (!percorso) {
  console.error('\nUso: node scripts/nomine-dryrun.mjs "percorso/del/file.xlsx"\n');
  process.exit(2);
}

// Le variabili d'ambiente di Vite non esistono qui: si definiscono a undefined
// perche' il bundle non provi a leggerle. Il client Supabase viene costruito con
// i segnaposto e NON viene mai chiamato - nessuna rete, nessuna credenziale.
// Il bundle si scrive DENTRO il repo, non in tmp, e `xlsx` resta esterno: quella
// libreria fa un require dinamico di `stream` che un bundle ESM non regge, quindi
// va lasciata risolvere a Node - e Node la trova solo se il file che la importa
// sta dove c'e' node_modules.
const fuori = join('node_modules', '.nomine-dryrun-' + process.pid + '.mjs');
// Punto d'ingresso composto: servono sia il lettore delle nomine sia due cose di
// `anagraficheImport` (la normalizzazione delle intestazioni e la lettura dei
// campi persona). Si compone qui invece di ri-esportarle da nomineImport, perche'
// quel modulo non deve crescere per comodita' di uno script.
await build({
  stdin: {
    contents: [
      "export * from './src/lib/admin/nomineImport';",
      "export { normHeader, leggiCampiPersona } from './src/lib/admin/anagraficheImport';",
    ].join('\n'),
    resolveDir: '.', sourcefile: 'dryrun-entry.ts', loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: fuori, logLevel: 'error',
  external: ['xlsx'],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': 'undefined',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined',
  },
});
const m = await import(pathToFileURL(fuori).href);
rmSync(fuori, { force: true });

const buf = readFileSync(percorso);
const file = new File([buf], percorso.split(/[\\/]/).pop());

let f;
try {
  f = await m.leggiFoglioRuoli(file);
} catch (e) {
  console.error('\n' + (e?.message ?? e) + '\n');
  process.exit(1);
}

console.log(`\nFile: ${file.name}`);
console.log(`Foglio "${m.FOGLIO_RUOLI}": trovato.`);
console.log(`  intestazioni alla riga ${f.rigaHeader} · ${f.righe.length} righe di dati`);
console.log(`  riconosciuto come: ${f.tipo} (${f.motivoTipo})`);

const chiavi = new Set(f.intestazioni.map(m.normHeader).filter(Boolean));
const S = (v) => String(v ?? '').trim();

console.log('\nLe nove colonne di ruolo, cercate nel foglio vero:');
let trovate = 0, entrano = 0, fuoriN = 0;
for (const c of m.COLONNE_RUOLO) {
  const ok = chiavi.has(c.chiave);
  if (ok) trovate++;
  const n = ok ? f.righe.filter((r) => S(r.col[c.chiave]) !== '').length : 0;
  if (ok && c.figura) entrano += n; else if (ok) fuoriN += n;
  console.log(`  ${ok ? 'trovata' : 'ASSENTE'}  ${c.intestazione.padEnd(43)}`
    + ` ${(c.figura ?? '(fuori)').padEnd(22)} valorizzate ${String(n).padStart(4)}`);
}

// La mansione: quante righe la portano. Il dizionario non si applica qui - serve
// il database - ma sapere quante celle ci sono dice se vale la pena guardarle.
const mans = f.righe.filter((r) => {
  const c = m.leggiCampiPersona(r.col);
  return c ? S(c.mansione) !== '' : false;
}).length;

console.log(`\n  ${trovate} colonne su ${m.COLONNE_RUOLO.length} agganciano per nome.`);
console.log(`  celle valorizzate nelle colonne che ENTRANO ...... ${entrano}`);
console.log(`  celle valorizzate nelle colonne che restano FUORI . ${fuoriN}`);
if (mans) console.log(`  righe con una mansione ........................... ${mans}`);

console.log('\nQuesta prova NON dice che i numeri siano quelli giusti: dice che il');
console.log('lettore vede il foglio e le colonne. Il resto lo dice l\'anteprima,');
console.log('che ha bisogno del database.\n');

if (trovate === 0) {
  console.error('NESSUNA colonna di ruolo aggancia: o non e\' questo export, o le');
  console.error('intestazioni sono cambiate. L\'import girerebbe senza fare niente.\n');
  process.exit(1);
}
