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
const { patchSceltaAteco, statoRischio, cercaAteco, risolviAteco, patchTogliLivello, patchApplicaLivello, righeDefinitoMediante, patchScegliLivello, livelliPiuAlti } = await import(pathToFileURL(fuori).href);
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
  // Aggiunti il 16.09.2026: nella verifica a vista un livello applicato per prova
  // non si poteva togliere. Il gesto opposto ora esiste, chiede una motivazione
  // (decisione di Francesco dello stesso giorno) e scrive accanto al livello come
  // e' stato deciso (mig. 072). Negativo: con l'ateco.ts di main b52913e le due
  // funzioni non esistono e i due casi falliscono con un'eccezione.
  ['A8 · togliere il livello lo porta a null, il codice ATECO resta, e il bottone torna a proporre', () => {
    let c = applica({ codice_ateco: null, ateco_origine: 'cella del gestionale', livello_rischio: null }, patchSceltaAteco(alta));
    c = applica(c, patchApplicaLivello(statoRischio(c.codice_ateco, c.livello_rischio).proposto, 'Mario Rossi', null, new Date(2026, 8, 16)));
    if (c.livello_rischio !== 'alto') return `preparazione: livello ${c.livello_rischio}, atteso alto`;

    const p = patchTogliLivello('ATECO sbagliato, corretto in visura', 'Mario Rossi', null, new Date(2026, 8, 16));
    const chiavi = Object.keys(p).sort();
    if (chiavi.join(',') !== 'livello_rischio,livello_rischio_definito_mediante') return `chiavi della patch: ${chiavi.join(',')}`;

    const dopo = applica(c, p);
    if (dopo.livello_rischio !== null) return `livello ${dopo.livello_rischio}, atteso null`;
    if (dopo.codice_ateco !== alta.divisione) return `il codice e' cambiato: ${dopo.codice_ateco}`;
    if (dopo.ateco_origine !== 'cella del gestionale') return `la cella d'origine e' cambiata: ${dopo.ateco_origine}`;

    // E si torna esattamente dove si era prima di premere: proposta, non salvata.
    const st = statoRischio(dopo.codice_ateco, dopo.livello_rischio);
    if (st.soloProposta !== true || st.proposto !== 'alto' || !st.puoApplicare) return JSON.stringify(st);
  }],
  ['A9 · senza motivazione non si toglie, e con la motivazione restano la ragione e la data', () => {
    for (const vuota of ['', '   ', String.fromCharCode(9, 10, 32)]) {
      if (patchTogliLivello(vuota) !== null) return `motivazione ${JSON.stringify(vuota)}: doveva essere null`;
    }
    const p = patchTogliLivello('  ATECO sbagliato, corretto in visura  ', 'Mario Rossi', null, new Date(2026, 8, 16));
    const m = p.livello_rischio_definito_mediante;
    if (!m.includes('ATECO sbagliato, corretto in visura')) return `la motivazione non c'e': ${m}`;
    if (m.includes('  ATECO')) return `la motivazione non e' stata ripulita: ${m}`;
    if (!m.includes('16/09/2026')) return `la data non c'e': ${m}`;
    // E il gesto del bottone dice da dove viene il livello che applica.
    const a = patchApplicaLivello('alto', 'Mario Rossi', null, new Date(2026, 8, 16));
    if (a.livello_rischio !== 'alto') return JSON.stringify(a);
    if (!a.livello_rischio_definito_mediante.startsWith('tabella_ateco')) return a.livello_rischio_definito_mediante;
  }],
  // Aggiunto il 16.09.2026, subito dopo: la data da sola non dice chi ha premuto,
  // e il tecnico collegato questo repo lo conosce gia' (organigramma-revisioni).
  ['A10 · la riga porta chi ha premuto, e senza di lui resta leggibile lo stesso', () => {
    const conChi = patchTogliLivello('motivo', 'Mario Rossi', null, new Date(2026, 8, 16));
    if (conChi.livello_rischio_definito_mediante !== 'livello tolto il 16/09/2026 da Mario Rossi: motivo') {
      return conChi.livello_rischio_definito_mediante;
    }
    const applicato = patchApplicaLivello('alto', 'Mario Rossi', null, new Date(2026, 8, 16));
    if (applicato.livello_rischio_definito_mediante !== 'tabella_ateco, applicato il 16/09/2026 da Mario Rossi') {
      return applicato.livello_rischio_definito_mediante;
    }
    // Sessione che non sa dire chi: niente «da», e nessun «da null» o «da undefined».
    for (const senza of [null, '', '   ']) {
      const p = patchTogliLivello('motivo', senza, null, new Date(2026, 8, 16));
      if (p.livello_rischio_definito_mediante !== 'livello tolto il 16/09/2026: motivo') {
        return `senza chi (${JSON.stringify(senza)}): ${p.livello_rischio_definito_mediante}`;
      }
      const a2 = patchApplicaLivello('alto', senza, null, new Date(2026, 8, 16));
      if (a2.livello_rischio_definito_mediante !== 'tabella_ateco, applicato il 16/09/2026') {
        return `senza chi (${JSON.stringify(senza)}): ${a2.livello_rischio_definito_mediante}`;
      }
    }
  }],
  // Aggiunto il 16.09.2026, dal rilievo di Francesco sull'anteprima: riapplicando
  // il livello spariva il motivo per cui era stato tolto. Ora il testo si accumula.
  ['A11 · le decisioni si accumulano: la nuova va in testa, le precedenti restano', () => {
    const tolto = patchTogliLivello('ATECO sbagliato', 'Mario Rossi', null, new Date(2026, 8, 16));
    const riapplicato = patchApplicaLivello('alto', 'Mario Rossi', tolto.livello_rischio_definito_mediante, new Date(2026, 8, 17));
    const righe = righeDefinitoMediante(riapplicato.livello_rischio_definito_mediante);
    if (righe.length !== 2) return `righe: ${JSON.stringify(righe)}`;
    if (righe[0] !== 'tabella_ateco, applicato il 17/09/2026 da Mario Rossi') return righe[0];
    if (righe[1] !== 'livello tolto il 16/09/2026 da Mario Rossi: ATECO sbagliato') return righe[1];

    // Un terzo giro non perde nessuno dei due precedenti, e l'ordine resta.
    const ditolto = patchTogliLivello('di nuovo', 'Mario Rossi', riapplicato.livello_rischio_definito_mediante, new Date(2026, 8, 18));
    const tre = righeDefinitoMediante(ditolto.livello_rischio_definito_mediante);
    if (tre.length !== 3 || !tre[0].startsWith('livello tolto il 18/09/2026')) return JSON.stringify(tre);

    // Una colonna vuota, o con soli spazi, non produce righe finte.
    if (righeDefinitoMediante(null).length !== 0) return 'null produce righe';
    if (righeDefinitoMediante('   ').length !== 0) return 'spazi producono righe';
    const primo = patchTogliLivello('primo', null, '   ', new Date(2026, 8, 16));
    if (righeDefinitoMediante(primo.livello_rischio_definito_mediante).length !== 1) return 'la prima riga non e sola';
  }],
  // Aggiunto il 16.09.2026, dal rilievo di Francesco: senza ATECO il bottone non ha
  // niente da proporre, e il livello non si poteva mettere in nessun altro modo.
  // Il terzo gesto esiste, e va SOLO verso l'alto: sua decisione, stesso giorno.
  ['A12 · a mano si scelgono solo i livelli piu alti di quello che si vede', () => {
    const atteso = { basso: ['medio', 'alto'], medio: ['alto'], alto: [] };
    for (const [corrente, sopra] of Object.entries(atteso)) {
      const dati = livelliPiuAlti(corrente).join(',');
      if (dati !== sopra.join(',')) return `sopra ${corrente}: ${dati}, atteso ${sopra.join(',')}`;
    }
    // Niente livello e niente proposta: non c'e' un basso da alzare, si sceglie tutto.
    if (livelliPiuAlti(null).join(',') !== 'basso,medio,alto') return livelliPiuAlti(null).join(',');

    // E la regola sta nella funzione, non solo nel menu: un livello non piu alto
    // non passa nemmeno chiamandola a mano.
    if (patchScegliLivello('basso', 'motivo', 'medio') !== null) return 'un livello piu basso e passato';
    if (patchScegliLivello('alto', 'motivo', 'alto') !== null) return 'lo stesso livello e passato';
    if (patchScegliLivello('alto', '   ', 'medio') !== null) return 'senza motivazione e passato';
  }],
  ['A13 · il livello scelto a mano si distingue nell archivio da quello della tabella', () => {
    const p = patchScegliLivello('alto', 'DVR rev. 3, saldatura in ambiente confinato', 'medio', 'Mario Rossi', null, new Date(2026, 8, 16));
    if (p.livello_rischio !== 'alto') return JSON.stringify(p);
    if (p.livello_rischio_definito_mediante !== 'livello ALTO scelto a mano il 16/09/2026 da Mario Rossi: DVR rev. 3, saldatura in ambiente confinato') {
      return p.livello_rischio_definito_mediante;
    }
    // E si accumula come gli altri due gesti.
    const dopo = patchApplicaLivello('alto', 'Mario Rossi', p.livello_rischio_definito_mediante, new Date(2026, 8, 17));
    const righe = righeDefinitoMediante(dopo.livello_rischio_definito_mediante);
    if (righe.length !== 2 || !righe[1].includes('scelto a mano')) return JSON.stringify(righe);
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
