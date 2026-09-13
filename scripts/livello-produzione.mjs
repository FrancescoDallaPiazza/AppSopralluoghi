// A CHE MIGRAZIONE E' ARRIVATO IL DATABASE. Sola lettura: solo `select ... limit 1`.
//
// Perche' esiste. Il 13 settembre 2026 AppOverall ha trovato la produzione di
// AppFormazione sei migrazioni indietro rispetto al repo, mentre i documenti le
// davano per chiuse. "Chiuso" in STATO.md vuol dire SCRITTO E COMMITTATO, non
// APPLICATO: sono due fatti, e solo il secondo si misura sul database.
//
// Come misura. Con la sola chiave anon la radice /rest/v1/ risponde 401 e le RLS
// nascondono le righe, ma una colonna che non esiste da' comunque 42703 e una
// tabella che non esiste PGRST205: l'esistenza dello schema si legge anche senza
// vedere un dato. Le due prove di CONTROLLO in testa servono a dimostrare che quei
// codici escono davvero - senza, un "ok" potrebbe voler dire solo "nessun errore
// riportato".
//
// Cosa NON misura, e lo stampa: le migrazioni che scrivono solo commenti (064,
// 066) non lasciano niente di interrogabile, e la 067 aggiorna testo in
// `figura_sicurezza`, che con la anon non si legge. Il conteggio delle righe NON
// e' una misura: con le RLS e' zero comunque.
//
// Uso: npm run livello:produzione   (credenziali da .env.local o dall'ambiente)
//
// Quando si aggiunge una migrazione che crea una colonna o una tabella, si
// aggiunge qui la sua riga.

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

const env = { ...process.env };
if (existsSync('.env.local')) {
  for (const riga of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
}
const url = env.VITE_SUPABASE_URL, anon = env.VITE_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('\nServono VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY, in .env.local o nell\'ambiente.\n');
  process.exit(2);
}
const db = createClient(url, anon, { auth: { persistSession: false } });

// [migrazione, tabella, colonna]. `null` come migrazione = prova di controllo.
const PROVE = [
  [null, 'cliente', 'colonna_che_non_esiste_xyz'],
  [null, 'tabella_che_non_esiste_xyz', 'id'],
  ['061', 'persona', 'data_cessazione'],
  ['062', 'cliente', 'numero_lavoratori'],
  ['063', 'tecnico', 'cognome'],
  ['065', 'cliente', 'ateco_origine'],
  ['068', 'nomina', 'origine'],
  ['068', 'nomina', 'origine_testo'],
  ['068', 'ruolo_testo', 'chiave'],
  ['068', 'ruolo_testo_figura', 'chiave'],
];
const NON_MISURABILI = {
  '064': 'solo commenti',
  '066': 'solo commenti',
  '067': 'aggiorna testo in figura_sicurezza, illeggibile con la anon',
};
const ASSENTE = new Set(['42703', 'PGRST204', 'PGRST205', '42P01']);

console.log(`\nProgetto ${new URL(url).hostname.split('.')[0]} - sola lettura.\n`);

let controlliOk = true;
const perMig = new Map();
for (const [mig, tab, col] of PROVE) {
  const { error } = await db.from(tab).select(col).limit(1);
  const stato = !error ? 'presente' : ASSENTE.has(error.code) ? 'ASSENTE' : `errore ${error.code}`;
  console.log(`  ${(mig ?? 'controllo').padEnd(9)} ${`${tab}.${col}`.padEnd(40)} ${stato}`
    + (error ? `  (${error.code})` : ''));
  if (mig === null) { if (stato !== 'ASSENTE') controlliOk = false; continue; }
  const l = perMig.get(mig) ?? []; l.push(stato); perMig.set(mig, l);
}

if (!controlliOk) {
  console.log('\n  >> Le prove di controllo NON hanno dato "assente": gli "ok" qui sopra non valgono niente.\n');
  process.exit(1);
}

console.log('');
for (const [mig, stati] of perMig) {
  const esito = stati.every((s) => s === 'presente') ? 'applicata'
    : stati.every((s) => s === 'ASSENTE') ? 'NON applicata' : 'PARZIALE o errore: ' + stati.join(', ');
  console.log(`  ${mig}  ${esito}`);
}
for (const [mig, perche] of Object.entries(NON_MISURABILI)) console.log(`  ${mig}  non misurabile (${perche})`);
console.log('');
