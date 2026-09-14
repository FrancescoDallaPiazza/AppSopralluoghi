// BANCO DI PROVA DI D2: IL REPORT CHE NON CONOSCEVA I COMPONENTI.
//
// Perche' esiste. `genera-report` caricava le voci con `.eq('template_id', ...)`:
// le voci dei box hanno `template_id` NULL e `sezione_id` valorizzato (030), quindi
// per un giro compilato nei box `vociById` restava senza le loro voci. Le risposte
// a scelta uscivano con la CHIAVE GREZZA invece dell'etichetta, e le risposte
// ripetute per componente uscivano appiattite, senza dire di quale estintore
// fossero. Documento consegnato al cliente.
//
// Cosa fa. Compila `report-data.ts` e `report-html.ts` con esbuild e li fa girare
// contro un client Supabase finto, in memoria: un giro con una voce del template
// piatto e una voce di box ripetibile risposta su due componenti. NESSUNA RETE,
// NESSUN DATABASE.
//
// Uso:  node scripts/report-componenti-check.mjs            (oppure: npm run report:check)
//       REPORT_DIR=<cartella> node scripts/report-componenti-check.mjs
// La seconda forma serve a far girare la stessa prova su un'altra versione dei
// due file, per esempio quella prima della correzione, e vederla fallire.
// Esce 1 se un controllo non torna.

import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = resolve(process.env.REPORT_DIR ?? 'supabase/functions/genera-report');
const fuori = join('node_modules', '.report-check-' + process.pid + '.mjs');
await build({
  stdin: {
    contents: "export { assemblaReport } from './report-data.ts'; export { renderReport } from './report-html.ts';",
    resolveDir: dir, sourcefile: 'entry.ts', loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: fuori, logLevel: 'error',
});
const { assemblaReport, renderReport } = await import(pathToFileURL(resolve(fuori)).href);
rmSync(fuori, { force: true });

// ---------------------------------------------------------------------------
// Il giro di prova
// ---------------------------------------------------------------------------
const tabelle = {
  sopralluogo: [{
    id: 'S1', incarico_id: 'I1', progressivo: '1', data_effettiva: '2026-09-14', data_pianificata: null,
    durata_effettiva_min: 60, localita: 'Verona', revisione_corrente: 1,
    tecnico: { nome: 'Tecnico di prova' },
    incarico: { tipo_attivita: 'Sopralluogo', n_sopralluoghi: 1,
      cliente: { ragione_sociale: 'Cliente di prova', localita: 'Verona', indirizzo: null } },
  }],
  checklist_compilata: [{ id: 'C1', template_id: 'T1', sopralluogo_id: 'S1' }],
  voce_template: [
    { id: 'VF', template_id: 'T1', sezione_id: null, tipo: 'scelta', ordine: 1,
      config: { opzioni: [{ chiave: 'si', etichetta: 'Presente' }] } },
    { id: 'VB', template_id: null, sezione_id: 'SEZ1', tipo: 'scelta', ordine: 1,
      config: { opzioni: [{ chiave: 'eff', etichetta: 'Efficiente' }, { chiave: 'scad', etichetta: 'Revisione scaduta' }] } },
  ],
  box_sezione: [{ id: 'SEZ1', box_id: 'B1', nome: 'Estintori', ordine: 1, ripetibile: true }],
  box_catalogo: [{ id: 'B1', nome: 'Presidi antincendio' }],
  sopralluogo_box: [{ sopralluogo_id: 'S1', box_id: 'B1', ordine: 0 }],
  // In ordine sbagliato apposta: il campo li mostra per etichetta.
  componente_sito: [
    { id: 'K2', etichetta: 'Estintore 2', matricola: 'M-002', ubicazione: 'Magazzino' },
    { id: 'K1', etichetta: 'Estintore 1', matricola: null, ubicazione: 'Ingresso' },
  ],
  esito_voce: [
    { id: 'E1', checklist_compilata_id: 'C1', voce_template_id: 'VF', voce_tipo: 'scelta', voce_testo: 'Cartellonistica di emergenza',
      voce_sezione: null, ordine: 1, parent_esito_id: null, stato: null, valore: 'si', note: null, componente_id: null },
    { id: 'E2', checklist_compilata_id: 'C1', voce_template_id: 'VB', voce_tipo: 'scelta', voce_testo: 'Stato del presidio',
      voce_sezione: null, ordine: 1, parent_esito_id: null, stato: null, valore: 'scad', note: null, componente_id: 'K2' },
    { id: 'E3', checklist_compilata_id: 'C1', voce_template_id: 'VB', voce_tipo: 'scelta', voce_testo: 'Stato del presidio',
      voce_sezione: null, ordine: 1, parent_esito_id: null, stato: null, valore: 'eff', note: null, componente_id: 'K1' },
  ],
  foto: [], azione: [], sopralluogo_revisione: [],
};

// Un client finto che capisce solo quello che `report-data.ts` usa. I select
// annidati (tecnico:..., incarico:...) sono gia' dentro le righe del giro.
function clienteFinto(db) {
  return {
    from(tabella) {
      let righe = [...(db[tabella] ?? [])];
      let una = false;
      const q = {
        select: () => q,
        eq: (c, v) => { righe = righe.filter((r) => r[c] === v); return q; },
        in: (c, vs) => { righe = righe.filter((r) => vs.includes(r[c])); return q; },
        not: () => q,
        limit: () => q,
        order: (c, o) => {
          const verso = o?.ascending === false ? -1 : 1;
          righe.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * verso);
          return q;
        },
        maybeSingle: () => { una = true; return q; },
        then: (ok, ko) => Promise.resolve({ data: una ? (righe[0] ?? null) : righe, error: null }).then(ok, ko),
      };
      return q;
    },
    storage: { from: () => ({ download: async () => ({ data: null, error: new Error('nessuna foto') }) }) },
  };
}

// ---------------------------------------------------------------------------
// I controlli
// ---------------------------------------------------------------------------
let falliti = 0;
const controlla = (ok, cosa, visto) => {
  console.log(`  ${ok ? 'ok     ' : 'FALLITO'}  ${cosa}${ok ? '' : `  (visto: ${visto})`}`);
  if (!ok) falliti++;
};

const d = await assemblaReport(clienteFinto(tabelle), 'S1', 'cliente');
const html = renderReport(d);
const e = d.esiti;
const g = (i) => e[i]?.gruppo ?? null;

console.log(`\nReport compilato da: ${dir}\n`);
console.log('I dati:');
controlla(e.length === 3, 'tre risposte: una del template piatto e una per componente', e.length);
controlla(e[0]?.valore === 'Presente' && g(0) === null, 'la voce del template piatto viene per prima, senza gruppo', JSON.stringify(e[0]?.valore));
controlla(e[1]?.valore === 'Efficiente', "la risposta di un box ha l'etichetta, non la chiave", JSON.stringify(e[1]?.valore));
controlla(e[2]?.valore === 'Revisione scaduta', "anche quella del secondo componente", JSON.stringify(e[2]?.valore));
controlla(g(1)?.componente === 'Estintore 1 · Ingresso', 'il primo componente e\' Estintore 1, per etichetta come in campo', JSON.stringify(g(1)));
controlla(g(2)?.componente === 'Estintore 2 · M-002 · Magazzino', 'il secondo porta matricola e ubicazione', JSON.stringify(g(2)));
controlla(g(1)?.box === 'Presidi antincendio' && g(1)?.sezione === 'Estintori', 'box e sezione sono quelli del catalogo', JSON.stringify(g(1)));

console.log("\nL'HTML:");
const pos = (s) => html.indexOf(s);
controlla(html.split('Presidi antincendio · Estintori').length === 2, 'il titolo del box e della sezione compare una volta', html.split('Presidi antincendio · Estintori').length - 1);
controlla(pos('Estintore 1 · Ingresso') > 0 && pos('Estintore 1 · Ingresso') < pos('Efficiente'), "l'intestazione di Estintore 1 viene prima della sua risposta", `${pos('Estintore 1 · Ingresso')} / ${pos('Efficiente')}`);
controlla(pos('Efficiente') < pos('Estintore 2 · M-002') && pos('Estintore 2 · M-002') < pos('Revisione scaduta'), "Estintore 2 viene dopo, e prima della sua risposta", `${pos('Estintore 2 · M-002')} / ${pos('Revisione scaduta')}`);
controlla(!/>\s*(scad|eff)\s*</.test(html), 'nessuna chiave grezza nel documento', 'trovata');

console.log(falliti ? `\n${falliti} controlli falliti.\n` : '\nTutti i controlli tornano.\n');
process.exit(falliti ? 1 : 0);
