// BANCO DI PROVA DEL CAMPO ATECO A MANO: scegliere un suggerimento non tocca il
// livello di rischio.
//
// Perche' esiste. Fino al 15 settembre 2026, nella scheda cliente, scegliere una
// divisione dal menu dei suggerimenti scriveva nella stessa patch il codice E il
// livello di rischio (Anagrafiche.tsx, `scegli`). Un livello messo a mano, o
// deciso diversamente, veniva sostituito senza conferma, e al primo «Salva»
// finiva nell'archivio. Il bottone RISCHIO sapeva gia' applicare il livello
// proposto come gesto separato. Ordine di AppOverall (PROGRAMMA.md sezione 8),
// ultima condizione aperta prima della campagna ATECO.
//
// Adesso la regola sta in due funzioni pure di src/formazione/ateco.ts:
// `patchSceltaAteco` (cosa scrive la scelta) e `statoRischio` (cosa propone il
// bottone). Il componente le usa, e questa prova le verifica.
//
// NESSUNA RETE, NESSUN DATABASE.
//
// Il controllo negativo fa parte della prova:
//   ATECO_MODULO=<file .ts> node scripts/ateco-scelta-check.mjs
// compila un'altra versione di ateco.ts e deve fallire. Su main la regola non
// era una funzione ma una riga del componente: la versione negativa e' ateco.ts
// con `patchSceltaAteco` che restituisce, trascritta alla lettera, la patch della
// riga 882 di main, `{ codice_ateco: d.divisione, livello_rischio: d.livello }`.
//
// Uso:  node scripts/ateco-scelta-check.mjs     (oppure: npm run ateco-scelta:check)
// Esce 1 se un caso non torna.

import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulo = resolve(process.env.ATECO_MODULO ?? 'src/formazione/ateco.ts');
const fuori = join(tmpdir(), 'ateco-scelta-check-' + process.pid + '.mjs');
await build({
  entryPoints: [modulo],
  bundle: true, platform: 'node', format: 'esm', outfile: fuori, logLevel: 'warning',
});
const { patchSceltaAteco, statoRischio, cercaAteco, risolviAteco } = await import(pathToFileURL(fuori).href);
rmSync(fuori, { force: true });

// Una divisione che propone 'basso' e una che propone 'alto', prese dal catalogo
// vero e non scritte a mano: la prova non dipende da quali siano.
const tutte = cercaAteco('');
const bassa = tutte.find((d) => d.livello === 'basso');
const alta = tutte.find((d) => d.livello === 'alto');
if (!bassa || !alta) {
  console.error('Nel catalogo ATECO manca una divisione a rischio basso o alto: la prova non ha su cosa girare.');
  process.exit(2);
}

// Il cliente come lo tiene la scheda: la patch si fonde come fa `patch` in
// Anagrafiche.tsx, `setCliente((c) => ({ ...c, ...p }))`.
const applica = (cliente, p) => ({ ...cliente, ...p });

const casi = [
  ['A1 · livello ALTO messo a mano, scelgo una divisione che propone BASSO: il livello resta ALTO', () => {
    const prima = { codice_ateco: null, ateco_origine: null, livello_rischio: 'alto' };
    const dopo = applica(prima, patchSceltaAteco(bassa));
    if (dopo.codice_ateco !== bassa.divisione) return `codice ${dopo.codice_ateco}, atteso ${bassa.divisione}`;
    if (dopo.livello_rischio !== 'alto') return `livello ${dopo.livello_rischio}, atteso alto`;
  }],
  ['A2 · ...e il bottone propone BASSO, premibile, mentre mostra ancora ALTO', () => {
    const dopo = applica({ codice_ateco: null, livello_rischio: 'alto' }, patchSceltaAteco(bassa));
    const s = statoRischio(dopo.codice_ateco, dopo.livello_rischio);
    if (s.proposto !== 'basso' || !s.puoApplicare || s.effettivo !== 'alto') return JSON.stringify(s);
  }],
  ['A3 · premuto il bottone, il livello diventa BASSO e il bottone non ha piu\' niente da proporre', () => {
    let c = applica({ codice_ateco: null, livello_rischio: 'alto' }, patchSceltaAteco(bassa));
    const s = statoRischio(c.codice_ateco, c.livello_rischio);
    c = applica(c, { livello_rischio: s.proposto });       // il gesto del bottone
    const s2 = statoRischio(c.codice_ateco, c.livello_rischio);
    if (c.livello_rischio !== 'basso' || s2.puoApplicare) return JSON.stringify({ c, s2 });
  }],
  ['A4 · cliente senza livello: la scelta non lo imposta, il bottone lo propone', () => {
    const dopo = applica({ codice_ateco: null, livello_rischio: null }, patchSceltaAteco(alta));
    if (dopo.livello_rischio !== null) return `livello ${dopo.livello_rischio}, atteso null`;
    const s = statoRischio(dopo.codice_ateco, dopo.livello_rischio);
    if (s.proposto !== 'alto' || !s.puoApplicare) return JSON.stringify(s);
  }],
  ['A5 · la scelta scrive SOLO il codice: ne\' il livello ne\' la cella d\'origine', () => {
    const chiavi = Object.keys(patchSceltaAteco(bassa)).sort();
    if (chiavi.join(',') !== 'codice_ateco') return `chiavi della patch: ${chiavi.join(',')}`;
  }],
  ['A6 · il bottone propone lo stesso livello di risolviAteco, e niente su un codice ignoto', () => {
    const s = statoRischio(alta.divisione, null);
    if (s.proposto !== risolviAteco(alta.divisione).livello) return JSON.stringify(s);
    // Un testo senza cifre: risolviAteco prende le prime due cifre, e un numero
    // qualunque potrebbe essere una divisione vera.
    const ignoto = statoRischio('nessun codice', 'medio');
    if (ignoto.proposto !== null || ignoto.puoApplicare || ignoto.effettivo !== 'medio') return JSON.stringify(ignoto);
  }],
  // Aggiunto il 15.09.2026 sera: nella verifica a vista un cliente senza livello
  // mostrava la proposta come un livello salvato. Negativo: ATECO_MODULO con
  // l'ateco.ts di main 7949c92, dove `soloProposta` non esiste.
  ['A7 · senza livello salvato il bottone sa che mostra solo la proposta; con un livello salvato no', () => {
    const vuoto = statoRischio(alta.divisione, null);
    if (vuoto.soloProposta !== true || vuoto.effettivo !== 'alto') return `senza livello: ${JSON.stringify(vuoto)}`;
    const salvato = statoRischio(alta.divisione, 'basso');
    if (salvato.soloProposta !== false || salvato.effettivo !== 'basso') return `con livello: ${JSON.stringify(salvato)}`;
    const uguale = statoRischio(alta.divisione, 'alto');
    if (uguale.soloProposta !== false) return `livello uguale alla proposta: ${JSON.stringify(uguale)}`;
    const niente = statoRischio('nessun codice', null);
    if (niente.soloProposta !== false || niente.effettivo !== null) return `niente: ${JSON.stringify(niente)}`;
  }],
];

let falliti = 0;
console.log(`\nModulo: ${modulo}\n(divisione a rischio basso: ${bassa.divisione}; alto: ${alta.divisione})\n`);
for (const [nome, fn] of casi) {
  let esito;
  try { esito = fn(); } catch (e) { esito = 'eccezione: ' + (e?.message ?? e); }
  console.log(`  ${esito ? 'FALLITO' : 'ok     '}  ${nome}${esito ? `\n           ${esito}` : ''}`);
  if (esito) falliti++;
}
console.log(falliti ? `\n${falliti} casi su ${casi.length} falliti.\n` : `\nTutti i ${casi.length} casi tornano.\n`);
process.exit(falliti ? 1 : 0);
