// Banco di prova dei TRE STATI dell'ATECO (migration 065).
//
// Perche' esiste. `cliente.codice_ateco` e' un dato DERIVATO da una cella di
// testo libero, e fino all'11 settembre 2026 aveva due stati soli - una
// divisione, o null - con `null` che portava due significati diversi sulla
// stessa variabile: «per questa divisione non c'e' niente da fare» e «la
// divisione non la so». A valle nessuno poteva distinguerli, e il motore li
// saltava entrambi in silenzio.
//
// Gli stati veri sono tre, e il terzo - «ho una divisione e potrebbe essere
// quella sbagliata» - si vede SOLO confrontando il derivato con la cella da cui
// viene. Questo script verifica che quel confronto dia le risposte giuste sui
// casi veri, che sono nominati e documentati in docs/c1a/.
//
// Non e' una prova sintetica: gira sul codice di produzione
// (src/formazione/ateco.ts), compilato al volo con esbuild.
//
// Uso:  node scripts/ateco-tre-stati.mjs
// Esce 1 se un caso non si comporta come descritto.

import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const fuori = join(tmpdir(), 'ateco-tre-stati-' + process.pid + '.mjs');
await build({
  entryPoints: ['src/formazione/ateco.ts'],
  bundle: true, platform: 'node', format: 'esm', outfile: fuori, logLevel: 'warning',
});
const { classificaAteco, moduloSettore } = await import(pathToFileURL(fuori).href);
rmSync(fuori, { force: true });

// ---------------------------------------------------------------------------
// I CASI. Le celle sono VERBATIM dall'export ElencoSedi.xlsx del 9 settembre
// 2026: non sono inventate, e la loro forma E' il dato (un CAP davanti, un a
// capo, due codici nella stessa cella).
// ---------------------------------------------------------------------------
const CASI = [
  {
    nome: 'SHAMS SERVICE SRLS - un CAP letto come divisione',
    codice: '37',
    cella: '37054\n\n(F.41.2) COSTRUZIONE DI EDIFICI RESIDENZIALI E NON RESIDENZIALI;',
    stato: 'incerto', alternative: ['41'],
    // 37 non da' modulo, 41 ne da' 16: la risposta dipende da quale sia il vero.
    modulo: { dl_rspp: 'non_calcolabile', rspp: 'non_calcolabile' },
  },
  {
    nome: 'MIGLIORINI MATTEO - due codici, due divisioni, due livelli',
    codice: '46',
    cella: "46.49.9 - Commercio all'ingrosso di detergenti/sanitizzanti (settore zootecnia)\n \n33.12.70 - Riparazione e manutenzione di altre macchine per l'agricoltura",
    stato: 'incerto', alternative: ['33'],
    // Ne' la 46 ne' la 33 sono settori speciali: sul MODULO la risposta e'
    // determinata anche senza sapere quale sia il vero codice, e dire "non lo
    // so" sarebbe un falso allarme. (Sul LIVELLO invece diverge: basso/alto.)
    modulo: { dl_rspp: 'non_dovuto', rspp: 'non_dovuto' },
  },
  {
    nome: 'BP CHIMICA SRL - due codici ma stessa divisione',
    codice: '46',
    cella: ";\n(G.46.75.02) Commercio all'ingrosso di prodotti chimici per l'industria;\n(G.46.73.4) Commercio all'ingrosso di carta da parati, colori e vernici;",
    stato: 'incerto', alternative: [],
    modulo: { dl_rspp: 'non_dovuto', rspp: 'non_dovuto' },
  },
  {
    nome: 'ACQUE VERONESI - la divisione 37 VERA non va segnalata',
    codice: '37',
    cella: '(E.37.00) Gestione delle reti fognarie;',
    stato: 'noto', riscontro: 'confermato',
    modulo: { dl_rspp: 'non_dovuto', rspp: 'non_dovuto' },
  },
  {
    nome: 'IMPRESA EDILE COMERLATI - settore speciale, modulo dovuto',
    codice: '41',
    cella: '(F.41.20.00) Costruzione di edifici residenziali e non residenziali;',
    stato: 'noto', riscontro: 'confermato',
    modulo: { dl_rspp: 'dovuto', rspp: 'dovuto' }, ore: 16,
  },
  {
    nome: 'A.I.D.I. SRL - descrizione a parole, nessuna cifra',
    codice: null,
    cella: 'AUTOMAZIONI INDUSTRIALI DERIVATI IDRAULICI',
    stato: 'ignoto', motivo: 'cella_senza_codice',
    modulo: { dl_rspp: 'non_calcolabile', rspp: 'non_calcolabile' },
  },
  {
    nome: 'cliente senza ATECO - il caso dei 352',
    codice: null, cella: null,
    stato: 'ignoto', motivo: 'nessuna_cella',
    modulo: { dl_rspp: 'non_calcolabile', rspp: 'non_calcolabile' },
  },
  {
    nome: 'riga anteriore alla 065 - divisione buona, cella non conservata',
    codice: '43', cella: null,
    stato: 'noto', riscontro: 'non_verificabile',
    // Senza cella non c'e' incertezza RILEVATA: il modulo si calcola.
    modulo: { dl_rspp: 'dovuto', rspp: 'dovuto' }, ore: 16,
  },
  {
    nome: 'sanita 86 - dovuto per RSPP/ASPP, non per il datore-RSPP',
    codice: '86',
    cella: '(Q.86.90.29) Altre attivita di assistenza sanitaria;',
    stato: 'noto', riscontro: 'confermato',
    modulo: { dl_rspp: 'non_dovuto', rspp: 'dovuto' },
  },
];

let falliti = 0;
const dice = (ok, testo) => {
  if (!ok) falliti++;
  console.log('  ' + (ok ? 'ok  ' : 'NO  ') + testo);
};

for (const c of CASI) {
  console.log('\n' + c.nome);
  const e = classificaAteco(c.codice, c.cella);
  dice(e.stato === c.stato, 'stato = ' + e.stato + (e.stato === c.stato ? '' : ' (atteso ' + c.stato + ')'));
  if (c.riscontro) dice(e.riscontro === c.riscontro, 'riscontro = ' + e.riscontro);
  if (c.motivo) dice(e.motivo === c.motivo, 'motivo = ' + e.motivo);
  if (c.alternative) {
    const alt = (e.alternative ?? []).map((d) => d.divisione);
    dice(alt.join(',') === c.alternative.join(','),
      'alternative = [' + alt.join(',') + '] (attese [' + c.alternative.join(',') + '])');
  }
  for (const tipo of ['dl_rspp', 'rspp']) {
    const m = moduloSettore(e, tipo);
    const atteso = c.modulo[tipo];
    let ok = m.esito === atteso;
    if (ok && atteso === 'dovuto' && c.ore != null) ok = m.ore === c.ore;
    dice(ok, 'modulo ' + tipo + ' = ' + m.esito + ('ore' in m ? ' ' + m.ore + 'h' : '')
      + (ok ? '' : ' (atteso ' + atteso + ')'));
    if (m.esito === 'non_calcolabile') console.log('        perche: ' + m.perche);
  }
}

// La regola che tiene insieme tutto: "non dovuto" e "non lo so" NON devono mai
// essere lo stesso esito. Se un giorno qualcuno li riunisce, questo fallisce.
console.log('\nla distinzione regge');
const senza = moduloSettore(classificaAteco(null, null), 'dl_rspp');
const nonDov = moduloSettore(classificaAteco('56', '(I.56.10.11) Ristorazione;'), 'dl_rspp');
dice(senza.esito !== nonDov.esito,
  '«non lo so» (' + senza.esito + ') e «non dovuto» (' + nonDov.esito + ') sono esiti diversi');

// L'invariante dell'azione di livello cliente: la ragione per cui nasce deve
// SPARIRE da sola quando l'ATECO arriva. Non e' una chiusura manuale - la riga
// e' derivata - e questo controllo tiene ferma quella promessa.
console.log('\nl\u2019azione di livello cliente si chiude da sola');
const prima = moduloSettore(classificaAteco(null, null), 'dl_rspp');
const dopo = moduloSettore(classificaAteco('41', '(F.41.20.00) Costruzione di edifici;'), 'dl_rspp');
dice(prima.esito === 'non_calcolabile', 'senza ATECO la ragione c\u2019e\u2019 (' + prima.esito + ')');
dice(dopo.esito !== 'non_calcolabile', 'con l\u2019ATECO la ragione non c\u2019e\u2019 piu\u2019 (' + dopo.esito + ')');
// E il caso opposto, che e' cio' che impedisce alla riga di diventare una
// campagna: un cliente il cui ATECO e' noto e non speciale NON la produce. La
// riga non nasce dal campo vuoto - nasce da un calcolo che si e' fermato.
const nonSpeciale = moduloSettore(classificaAteco('56', '(I.56.10.11) Ristorazione;'), 'dl_rspp');
dice(nonSpeciale.esito === 'non_dovuto', 'un ATECO noto e non speciale non produce nessuna ragione (' + nonSpeciale.esito + ')');

console.log('\n' + (falliti ? falliti + ' controlli falliti' : 'tutti i controlli passati'));
process.exit(falliti ? 1 : 0);
