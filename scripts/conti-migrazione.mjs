// I DUE CONTI CHE LA MIGRAZIONE DATI CHIEDE. Sola lettura, nessuna scrittura.
//
// ---------------------------------------------------------------------------
// PERCHE' ESISTONO, ED E' LA PARTE CHE NON VA SALTATA
// ---------------------------------------------------------------------------
//
// Le due tabelle `persona` non sono la stessa tabella, e la migrazione verso il
// repo unico non e' una copia: e' un CAMBIO DI GRANA.
//
//   qui        `persona` e' PER CLIENTE. La stessa persona su due organigrammi
//              sono due righe, ed e' legittimo: per questo il cliente sta dentro
//              `import_key` (anag:<cliente>:<cf>).
//   AppOverall `persona.codice_fiscale` e' unique GLOBALE. Una persona, una
//              riga; il legame col cliente vive in `rapporto_lavoro`.
//
// Quindi passando il confine le nostre righe si FONDONO, e questi due conti
// misurano le due fusioni - che sbagliano in VERSI OPPOSTI. E' la ragione per
// cui sono due e non uno:
//
//   CONTO 1  fonde righe che VANNO fuse.      Stesso CF valido su piu' clienti:
//            e' la stessa persona con due rapporti di lavoro, e di la' deve
//            diventare una riga sola. Sapere quante sono dice quanto il totale
//            si restringe.
//
//   CONTO 2  fonde righe che NON vanno fuse.  Le persone senza codice fiscale
//            di la' non hanno nessuna identita' propria - senza CF non c'e'
//            vincolo - e l'unica cosa che le tiene separate e' la import_key del
//            rapporto. Due omonimi nello stesso cliente, che QUI si arrendono a
//            `riga:N` e restano sempre nuovi, LI' diventerebbero una persona
//            sola e nessuno lo vedrebbe.
//
// Un import che non li distingue fa la cosa giusta e quella sbagliata con lo
// stesso codice.
//
// ---------------------------------------------------------------------------
// PERCHE' UNO SCRIPT E NON DUE QUERY SQL
// ---------------------------------------------------------------------------
//
// Perche' il conto 1 chiede i codici fiscali VALIDI, e la validita' di un codice
// fiscale non si calcola in SQL: serve il carattere di controllo sui primi
// quindici caratteri. Una query puo' filtrare per FORMA (sedici caratteri, la
// regex giusta) e chiamarlo "valido", ed e' esattamente lo scivolamento che
// questo repo ha gia' pagato altrove - `cfPulisci` ripulisce, `valido` verifica,
// e sono due mestieri diversi sulla stessa cella.
//
// Qui la validita' la calcola la funzione DI PRODUZIONE
// (src/formazione/codiceFiscale.ts), compilata al volo. Lo script stampa anche
// il conto fatto sulla sola forma, cosi' la differenza fra i due si vede invece
// di dover essere creduta.
//
// ---------------------------------------------------------------------------
// USO
// ---------------------------------------------------------------------------
//
//   node scripts/conti-migrazione.mjs
//
// Legge le credenziali da .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
// o dall'ambiente. Fa SOLO select. Non scrive, non cancella, non crea.

import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// --------------------------------------------------------------------------
// Credenziali
// --------------------------------------------------------------------------
const env = { ...process.env };
if (existsSync('.env.local')) {
  for (const riga of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
}
const url = env.VITE_SUPABASE_URL, anon = env.VITE_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('\nServono VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY, in .env.local o'
    + ' nell\'ambiente.\nSenza, questo script non inventa niente: si ferma.\n');
  process.exit(2);
}
const db = createClient(url, anon, { auth: { persistSession: false } });

// --------------------------------------------------------------------------
// La validita' vera, dal codice di produzione
// --------------------------------------------------------------------------
const fuori = join(tmpdir(), 'conti-mig-' + process.pid + '.mjs');
await build({
  entryPoints: ['src/formazione/codiceFiscale.ts'],
  bundle: true, platform: 'node', format: 'esm', outfile: fuori, logLevel: 'warning',
});
const { valido, pulisci } = await import(pathToFileURL(fuori).href);
rmSync(fuori, { force: true });

// --------------------------------------------------------------------------
// La lettura. Paginata, perche' PostgREST tronca a 1000 e una lettura troncata
// NON si annuncia: torna un array piu' corto che si presenta come completo.
// Su 3.419 persone il difetto sarebbe silenzioso e i conti sarebbero plausibili.
// Ordinata per id, perche' senza un ordine stabile fra una pagina e l'altra la
// stessa riga compare due volte e un'altra in nessuna.
// --------------------------------------------------------------------------
const PAGINA = 1000;
async function tutte(tabella, colonne) {
  const out = [];
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await db.from(tabella).select(colonne)
      .order('id').range(da, da + PAGINA - 1);
    if (error) { console.error('Lettura fallita su ' + tabella + ': ' + error.message); process.exit(1); }
    out.push(...data);
    if (data.length < PAGINA) break;
  }
  return out;
}

const persone = await tutte('persona', 'id, cliente_id, nome, cognome, codice_fiscale, import_key');
const clienti = await tutte('cliente', 'id, ragione_sociale');
const nomeCliente = new Map(clienti.map((c) => [c.id, c.ragione_sociale]));

console.log(`\nLette ${persone.length} persone su ${clienti.length} clienti.`);
console.log('Sola lettura: questo script non ha scritto niente.\n');

// --------------------------------------------------------------------------
// CONTO 1 - stesso codice fiscale VALIDO su piu' clienti
// --------------------------------------------------------------------------
const perCf = new Map();
let cfPresenti = 0, cfValidi = 0, cfForma = 0;
for (const p of persone) {
  if (!p.codice_fiscale) continue;
  cfPresenti++;
  const c = pulisci(p.codice_fiscale);
  if (/^[A-Z0-9]{16}$/.test(c)) cfForma++;
  if (!valido(c)) continue;
  cfValidi++;
  const l = perCf.get(c); if (l) l.push(p); else perCf.set(c, [p]);
}

const multi = [...perCf.entries()]
  .map(([cf, righe]) => ({ cf, righe, clienti: new Set(righe.map((r) => r.cliente_id)).size }))
  .filter((x) => x.clienti > 1)
  .sort((a, b) => b.clienti - a.clienti || b.righe.length - a.righe.length);

const righeCoinvolte = multi.reduce((s, x) => s + x.righe.length, 0);

console.log('== CONTO 1 - lo stesso CF valido su piu\' clienti =======================');
console.log(`  persone con un CF scritto ................. ${cfPresenti}`);
console.log(`  ...di FORMA valida (16 caratteri) ......... ${cfForma}`);
console.log(`  ...VALIDI (carattere di controllo) ........ ${cfValidi}`);
if (cfForma !== cfValidi) {
  console.log(`  >> ${cfForma - cfValidi} passerebbero un controllo di sola forma e NON sono validi.`);
}
console.log(`  codici fiscali distinti ................... ${perCf.size}`);
console.log(`  ...presenti su PIU' di un cliente ......... ${multi.length}`);
console.log(`  righe coinvolte ........................... ${righeCoinvolte}`);
console.log(`  >> di la' diventerebbero ${multi.length} persone con ${righeCoinvolte} rapporti:`
  + ` ${righeCoinvolte - multi.length} righe in meno.\n`);

if (multi.length) {
  console.log('  I primi dieci, per numero di clienti:');
  for (const x of multi.slice(0, 10)) {
    const dove = [...new Set(x.righe.map((r) => nomeCliente.get(r.cliente_id) ?? r.cliente_id))];
    // Il codice fiscale e' un dato personale: si stampano le ultime quattro
    // cifre, che bastano a ritrovare la riga e non sono l'identita'.
    console.log(`    …${x.cf.slice(-4)}  ${x.clienti} clienti, ${x.righe.length} righe  —  ${dove.join(' · ')}`);
  }
  console.log('');
}

// --------------------------------------------------------------------------
// CONTO 2 - senza codice fiscale, e omonimi dentro lo stesso cliente
// --------------------------------------------------------------------------
const chiave = (s) => (s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
const senzaCf = persone.filter((p) => !p.codice_fiscale);

const perClienteNome = new Map();
let senzaNome = 0;
for (const p of senzaCf) {
  const k = `${chiave(p.cognome)}|${chiave(p.nome)}`;
  if (k === '|') { senzaNome++; continue; }
  const kk = p.cliente_id + ' ' + k;
  const l = perClienteNome.get(kk); if (l) l.push(p); else perClienteNome.set(kk, [p]);
}
const omonimi = [...perClienteNome.entries()]
  .map(([kk, righe]) => ({ kk, righe }))
  .filter((x) => x.righe.length > 1)
  .sort((a, b) => b.righe.length - a.righe.length);
const righeOmonime = omonimi.reduce((s, x) => s + x.righe.length, 0);

// E l'altra meta', che e' il caso opposto: lo stesso nome senza CF su clienti
// DIVERSI. Qui sono due schede e devono restarlo; di la', senza CF e senza
// vincolo, e' la import_key del rapporto l'unica cosa che le separa.
const perSoloNome = new Map();
for (const p of senzaCf) {
  const k = `${chiave(p.cognome)}|${chiave(p.nome)}`;
  if (k === '|') continue;
  const l = perSoloNome.get(k); if (l) l.push(p); else perSoloNome.set(k, [p]);
}
const nomiSuPiuClienti = [...perSoloNome.values()]
  .filter((righe) => new Set(righe.map((r) => r.cliente_id)).size > 1);

console.log('== CONTO 2 - senza codice fiscale ======================================');
console.log(`  persone senza CF .......................... ${senzaCf.length}`);
console.log(`  ...senza nemmeno cognome e nome ........... ${senzaNome}`);
console.log(`  nomi distinti (dentro il loro cliente) .... ${perClienteNome.size}`);
console.log(`  ...OMONIMI nello stesso cliente ........... ${omonimi.length}`);
console.log(`  righe omonime ............................. ${righeOmonime}`);
console.log(`  >> sono le righe che di la' rischiano di diventare UNA persona sola.`);
console.log(`  stesso nome su clienti DIVERSI ............ ${nomiSuPiuClienti.length}`);
console.log('     (qui due schede, e devono restarlo: le separa solo la import_key)\n');

if (omonimi.length) {
  console.log('  Gli omonimi, tutti (sono pochi apposta: se fossero tanti, il conto e\' un altro):');
  for (const x of omonimi) {
    const [cliId, nome] = x.kk.split(' ');
    console.log(`    ${nome.replace('|', ' ')}  ×${x.righe.length}  —  ${nomeCliente.get(cliId) ?? cliId}`);
  }
  console.log('');
}

// --------------------------------------------------------------------------
// E il numero che la migrazione vuole davvero
// --------------------------------------------------------------------------
const N = persone.length - (righeCoinvolte - multi.length);
console.log('== IL NUMERO DELLA MIGRAZIONE =========================================');
console.log(`  righe di \`persona\` di qui ................ ${persone.length}`);
console.log(`  meno le fusioni per CF valido ............. -${righeCoinvolte - multi.length}`);
console.log(`  N (persone attese di la\') ................. ${N}`);
console.log('\n  ATTENZIONE: N vale SOLO se le righe del conto 2 NON vengono fuse.');
console.log('  Se di la\' gli omonimi senza CF collassassero, N scenderebbe ancora di'
  + ` ${righeOmonime - omonimi.length} - e sarebbe una perdita, non una fusione.\n`);
