// LE ATTESE DELL'IMPORT NOMINE, calcolate sulla produzione. Sola lettura.
//
// Perche' esiste. Le attese di un import si scrivono PRIMA dell'anteprima, e
// l'anteprima delle nomine dipende da tre cose che il file non contiene: quali
// persone ci sono, quali nomine sono gia' scritte, e il dizionario dei ruoli di
// produzione. Contate solo sul file, «da creare» e «gia' in organigramma» sono
// stime. Questo script fa girare le STESSE funzioni della pagina
// (`caricaClientiScelta`, `leggiFoglioRuoli`, `pianificaNomine`, `riepiloga`)
// sul database vero, e stampa solo numeri: nessun nome, nessun codice fiscale.
//
// NON SCRIVE. Il client passa da una guardia che fa fallire insert, upsert,
// update, delete e rpc, e che rifiuta le tabelle che la pagina non legge. La
// guardia si prova da sola prima della prima lettura: se non scatta, lo script
// si ferma.
//
// LA CHIAVE. Serve la `service_role`, perche' le RLS non lasciano leggere niente
// alla anon. La chiave NON sta in nessun file: si passa come variabile
// d'ambiente per un'esecuzione sola, da un PowerShell di Francesco fuori da
// Claude, e poi si toglie. Una chiave sbagliata, o la anon, non deve dare «0 da
// creare»: una lettura vuota qui e' un errore, e lo script si ferma.
//
// Uso (PowerShell, dalla cartella del repo):
//   $s = Read-Host 'service_role' -AsSecureString
//   $env:SUPABASE_SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
//   npm run attese:nomine
//   Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
//
// Senza argomenti legge `~/Downloads/ExportExcel (4).xlsx` e pretende la sua
// dimensione, 7.228.718 byte: le attese scritte in STATO.md sono di quel file.
// Un altro file si passa come argomento, e allora il controllo non si fa.

import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Ci si ferma con un'eccezione e `process.exitCode`, non con `process.exit`: su
// Windows, uscire mentre una connessione HTTP si sta chiudendo fa scattare
// un'asserzione di libuv, e il codice d'uscita diventa 127 invece di quello vero.
class Fermo extends Error {
  constructor(testo, codice) { super(testo); this.codice = codice; }
}
const ferma = (testo, codice = 1) => { throw new Fermo(testo, codice); };

const URL_PRODUZIONE = 'https://pvbwcfrgatkqashstxjc.supabase.co';
const BYTE_ATTESI = 7228718;
const LETTE = new Set(['cliente', 'sede', 'persona', 'nomina', 'ruolo_testo', 'ruolo_testo_figura']);
const VIETATE = new Set(['insert', 'upsert', 'update', 'delete']);

async function main() {
  const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chiave) ferma('Manca SUPABASE_SERVICE_ROLE_KEY nell\'ambiente. Vedi l\'uso in testa al file.', 2);

  const percorso = process.argv[2] ?? join(homedir(), 'Downloads', 'ExportExcel (4).xlsx');
  let byte;
  try { byte = statSync(percorso).size; } catch { ferma(`Il file non c'e': ${percorso}`, 2); }
  if (!process.argv[2] && byte !== BYTE_ATTESI) {
    ferma(`${percorso} pesa ${byte} byte, non ${BYTE_ATTESI}: non e' il file delle attese.`, 2);
  }

  // ---------- la guardia: si legge e basta ----------
  const db = createClient(URL_PRODUZIONE, chiave, { auth: { persistSession: false, autoRefreshToken: false } });
  const soloLettura = (tabella) => {
    if (!LETTE.has(tabella)) throw new Error(`lettura inattesa su «${tabella}»: la pagina non la legge`);
    const q = db.from(tabella);
    return new Proxy(q, {
      get(o, k) {
        if (VIETATE.has(k)) throw new Error(`SCRITTURA su «${tabella}» (${String(k)}): vietata`);
        const v = o[k];
        return typeof v === 'function' ? v.bind(o) : v;
      },
    });
  };
  let guardiaScatta = false;
  try { soloLettura('nomina').insert({}); } catch { guardiaScatta = true; }
  if (!guardiaScatta) ferma('La guardia di scrittura non scatta: lo script non legge niente.');

  // ---------- il codice della pagina, compilato com'e' ----------
  // Il bundle sta dentro node_modules e `xlsx` resta esterno, come in
  // nomine-dryrun.mjs: la libreria fa un require dinamico che un bundle ESM non
  // regge. Le variabili di Vite restano undefined: il client del bundle non viene
  // mai chiamato, perche' il suo `from` e' sostituito dalla guardia.
  const fuori = join('node_modules', '.attese-nomine-' + process.pid + '.mjs');
  await build({
    stdin: {
      contents: [
        "export { caricaClientiScelta } from './src/lib/admin/formazioneImport';",
        "export { leggiFoglioRuoli, pianificaNomine, riepiloga } from './src/lib/admin/nomineImport';",
        "export { raggruppaPersone } from './src/lib/admin/anagraficheImport';",
        "export { supabase } from './src/lib/supabase';",
      ].join('\n'),
      resolveDir: '.', sourcefile: 'attese-nomine-entry.ts', loader: 'ts',
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
  m.supabase.from = soloLettura;
  m.supabase.rpc = () => { throw new Error('rpc: vietata'); };

  // ---------- la lettura non deve essere vuota ----------
  const conta = async (tabella) => {
    const { count, error, status } = await soloLettura(tabella).select('id', { count: 'exact', head: true });
    if (error) {
      ferma(`Lettura fallita su ${tabella}: HTTP ${status}${error.message ? ', ' + error.message : ''}.`
        + '\nChiave sbagliata? Non si stampa nessuna attesa.');
    }
    return count ?? 0;
  };
  const nPersone = await conta('persona');
  const nNomine = await conta('nomina');
  const scelta = await m.caricaClientiScelta();
  if (nPersone === 0 || scelta.length === 0) {
    ferma(`Lette ${nPersone} persone e ${scelta.length} clienti attivi: una lettura vuota non e' un risultato.`
      + '\nCon la anon le RLS tornano zero righe. Non si stampa nessuna attesa.');
  }

  const nomeFile = percorso.split(/[\\/]/).pop();
  const f = await m.leggiFoglioRuoli(new File([readFileSync(percorso)], nomeFile));

  console.log(`\nProduzione: ${nPersone} persone, ${nNomine} nomine, ${scelta.length} clienti attivi.`);
  console.log(`File: ${nomeFile} (${byte} byte) · foglio «Ruoli SSL», ${f.righe.length} righe di dati.`);

  // ---------- le scelte a mano, trovate e non indovinate ----------
  const base = m.raggruppaPersone(f, scelta, {}).gruppi;
  const igea = base.filter((g) => /IGEA\s+SRL/i.test(g.etichetta));
  const maison = base.filter((g) => /MAISON\s*22/i.test(g.etichetta));
  const idIgea = scelta.find((c) => c.id.startsWith('3f485f16'))?.id;
  if (!idIgea || !scelta.some((c) => c.id.startsWith('def8645c'))) {
    ferma('Fra i clienti attivi non ci sono le due IGEA (3f485f16 e def8645c): le scelte non si possono rifare.');
  }
  const breve = (id) => (id ? id.slice(0, 8) : 'nessuno');
  console.log('\nLe unita\' su cui si sceglie a mano, come la pagina le propone da sola:');
  for (const g of [...igea, ...maison]) {
    console.log(`  ${g.etichetta} · ${g.righe.length} righe · proposto: ${breve(g.cliente_id)}`
      + ` · candidati: ${g.candidati.map((c) => breve(c.id)).join(', ') || 'nessuno'}`);
  }

  const conScelte = (maisonEsclusa) => {
    const ab = {};
    for (const g of igea) ab[g.chiave] = idIgea;
    if (maisonEsclusa) for (const g of maison) ab[g.chiave] = null;
    return ab;
  };
  const SCENARI = [
    { nome: 'A · la pagina appena aperta, nessuna scelta', ab: {} },
    { nome: 'B · IGEA sulla prima (3f485f16), MAISON 22 escluso', ab: conScelte(true) },
    { nome: 'C · IGEA sulla prima (3f485f16), MAISON 22 come proposto', ab: conScelte(false) },
  ];

  for (const s of SCENARI) {
    const p = await m.pianificaNomine(f, scelta, s.ab);
    const r = m.riepiloga(p);
    const senzaCliente = p.gruppi.filter((g) => !g.cliente_id);
    const perFonte = {};
    for (const d of p.daDecidere) perFonte[d.fonte] = (perFonte[d.fonte] ?? 0) + 1;

    console.log(`\n== ${s.nome} ${'='.repeat(Math.max(0, 66 - s.nome.length))}`);
    console.log(`  pulsante ........................ «Scrivi ${r.daCreare} nomine»`);
    console.log(`  nomine da creare ................ ${r.daCreare}`
      + `  (colonna ${r.perOrigine.colonna}, mansione ${r.perOrigine.mansione}, qualifica ${r.perOrigine.qualifica})`);
    console.log(`  da decidere ..................... ${r.daDecidere}`
      + `  (${Object.entries(perFonte).map(([k, n]) => `${k} ${n}`).join(', ') || 'nessuna'})`);
    console.log(`  persone non trovate ............. ${r.personeNonTrovate}`
      + (p.personeNonTrovate.length ? `  (righe ${p.personeNonTrovate.map((x) => x.riga).join(', ')})` : ''));
    console.log(`  gia' in organigramma ............ ${r.giaPresenti}`);
    console.log(`  unita' del file non abbinate .... ${senzaCliente.length}`);
    for (const g of senzaCliente) console.log(`      ${g.etichetta} (${g.righe.length} righe)`);
    if (r.perFigura.length) {
      console.log('  da creare, per figura:');
      for (const x of r.perFigura) console.log(`      ${x.figura.padEnd(28)} ${String(x.n).padStart(4)}`);
    }
  }

  console.log('\nSola lettura: nessuna scrittura tentata, e la guardia le avrebbe fermate.\n');
}

try {
  await main();
} catch (e) {
  if (!(e instanceof Fermo)) throw e;
  console.error('\n' + e.message + '\n');
  process.exitCode = e.codice;
}
