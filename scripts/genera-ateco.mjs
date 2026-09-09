// Rigenera `src/formazione/atecoDati.ts` dalla LIBRERIA NORMATIVA, che sotto la
// decisione 7 (AppOverall/docs/decisioni/7-base-normativa.md) e' il generatore
// unico della tabella ATECO -> rischio formativo.
//
// PERCHE' QUESTO SCRIPT ESISTE. Il file dei dati dichiarava da sempre «generati
// dalla libreria, nessuna trascrizione manuale», ma il modo di generarli non era
// scritto da nessuna parte: la rigenerazione era un gesto a memoria, e un gesto
// a memoria e' indistinguibile da una trascrizione a mano. Adesso e' un comando.
//
//   node scripts/genera-ateco.mjs [percorso-della-libreria]
//   node scripts/genera-ateco.mjs --check [percorso-della-libreria]
//
// Senza percorso cerca `../formazione-81-utils-src`. La libreria non e' una
// dipendenza npm: e' un repo a parte, e va clonato accanto a questo
//   gh repo clone FrancescoDallaPiazza/formazione-81-utils-src
//
// `--check` non scrive: dice solo se il file in repo e' indietro rispetto alla
// libreria, ed esce 1 se lo e'. Serve prima di dare per buono un livello di
// rischio letto dall'app.

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const DESTINAZIONE = path.join(QUI, '..', 'src', 'formazione', 'atecoDati.ts');

const argomenti = process.argv.slice(2);
const soloVerifica = argomenti.includes('--check');
const percorsoLibreria = path.resolve(
  argomenti.find((a) => !a.startsWith('--')) ?? path.join(QUI, '..', '..', 'formazione-81-utils-src'),
);

const sorgente = path.join(percorsoLibreria, 'allegato_iv_asr2025.js');
if (!fs.existsSync(sorgente)) {
  console.error(`libreria non trovata: ${sorgente}
clonala accanto al repo, oppure passa il percorso:
  gh repo clone FrancescoDallaPiazza/formazione-81-utils-src
  node scripts/genera-ateco.mjs ../formazione-81-utils-src`);
  process.exit(2);
}

const { ALLEGATO_IV, classificaAteco2007 } = createRequire(import.meta.url)(sorgente);

// La versione della libreria finisce nella testata del file generato: senza,
// «rigenerato» non dice da quale stato della fonte.
let versione = 'sconosciuta';
try {
  versione = execFileSync('git', ['-C', percorsoLibreria, 'log', '-1', '--format=%h %ad', '--date=short'],
    { encoding: 'utf8' }).trim();
} catch { /* la libreria puo' essere una copia senza .git: non e' un errore */ }

// Si legge dall'API pubblica (`classificaAteco2007`), non dalla tabella grezza:
// e' quella che decide come il valore e la sua provenienza escono verso chi
// consuma, ed e' quella che il repo unico erediterà.
const voci = Object.keys(ALLEGATO_IV).sort().map((div) => {
  const r = classificaAteco2007(div);
  if (!r) throw new Error(`la libreria non classifica la divisione ${div}`);
  return {
    divisione: r.divisione,
    sezione: r.sezione,
    livello: String(r.livello).toLowerCase(),
    descrizione: r.descrizione,
    fonte: r.fonte,
    dedotto: r.dedotto === true,
  };
});

const LIVELLI = new Set(['basso', 'medio', 'alto']);
for (const v of voci) {
  if (!LIVELLI.has(v.livello)) throw new Error(`livello inatteso su ${v.divisione}: ${v.livello}`);
}

// Le fonti si emettono come costanti, non ripetute su 88 righe. Quella vigente
// e' la fonte delle voci NON dedotte; le altre restano visibili una per una.
const fonteVigente = voci.find((v) => !v.dedotto)?.fonte ?? '';
const fontiDedotte = [...new Set(voci.filter((v) => v.dedotto).map((v) => v.fonte))];
const nomeFonte = new Map([[fonteVigente, 'FONTE_VIGENTE']]);
fontiDedotte.forEach((f, i) => {
  nomeFonte.set(f, fontiDedotte.length === 1 ? 'FONTE_DEDOTTA' : `FONTE_DEDOTTA_${i + 1}`);
});

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const riga = (v) => '  { ' + [
  `divisione: ${q(v.divisione)}`,
  `sezione: ${q(v.sezione)}`,
  `livello: ${q(v.livello)}`,
  `descrizione: ${q(v.descrizione)}`,
  `fonte: ${nomeFonte.get(v.fonte)}`,
  ...(v.dedotto ? ['dedotto: true'] : []),
].join(', ') + ' },';

const dedotte = voci.filter((v) => v.dedotto).map((v) => v.divisione);

const testo = `// GENERATO DA scripts/genera-ateco.mjs — NON MODIFICARE A MANO.
// Fonte: FrancescoDallaPiazza/formazione-81-utils-src (allegato_iv_asr2025.js),
// versione ${versione}. Per aggiornarlo: \`node scripts/genera-ateco.mjs\`.
//
// Tabella ATECO -> livello di rischio formativo (Allegato IV ASR 17/04/2025,
// Rep. Atti 59/CSR), ancorata ad ATECO 2007 agg. 2022. Il rischio e' determinato
// dalla DIVISIONE (prime 2 cifre del codice). Livelli in minuscolo per combaciare
// con il vincolo di cliente.livello_rischio ('basso'|'medio'|'alto').
//
// IL VALORE E LA SUA PROVENIENZA SONO DUE CAMPI DIVERSI, e restano tali fin dove
// il dato arriva: \`fonte\` dice da dove viene il livello, \`dedotto\` dice che una
// parte del ragionamento non e' della norma ma nostra. Su ${dedotte.length === 1 ? 'una divisione' : `${dedotte.length} divisioni`} (${dedotte.join(', ')})
// il testo vigente non si legge — l'ultima pagina della tabella e' rotta di
// stampa — e il livello viene dalla fonte primaria del 2011 piu' la deduzione
// che il vigente non abbia inteso declassarle. Chi mostra un livello di rischio
// su queste divisioni deve poter dire da dove viene: in ispezione «l'ha messo il
// programma» non regge. Decisione del 9 settembre 2026, scheda 5 di AppOverall.

export type RischioAteco = 'basso' | 'medio' | 'alto';

export interface AtecoDivisione {
  divisione: string;    // due cifre, es. '56'
  sezione: string;      // lettera ATECO, es. 'I'
  livello: RischioAteco;
  descrizione: string;
  fonte: string;        // da dove viene il livello
  dedotto?: true;       // presente solo dove una parte del ragionamento e' nostra
}

const FONTE_VIGENTE =
  ${q(fonteVigente)};
${fontiDedotte.map((f) => `const ${nomeFonte.get(f)} =\n  ${q(f)};`).join('\n')}

// Ordinata per divisione.
export const ATECO_DIVISIONI: AtecoDivisione[] = [
${voci.map(riga).join('\n')}
];
`;

const precedente = fs.existsSync(DESTINAZIONE) ? fs.readFileSync(DESTINAZIONE, 'utf8') : null;
// La testata porta la versione della libreria: fuori dal confronto, altrimenti
// `--check` fallirebbe a ogni commit della libreria anche a dati identici.
const senzaTestata = (s) => (s ?? '').split('\n').slice(3).join('\n');

if (soloVerifica) {
  if (senzaTestata(precedente) === senzaTestata(testo)) {
    console.log(`atecoDati.ts e' allineato alla libreria (${voci.length} divisioni, ${dedotte.length} dedotte)`);
    process.exit(0);
  }
  console.error('atecoDati.ts NON e\' allineato alla libreria: esegui `node scripts/genera-ateco.mjs`');
  process.exit(1);
}

fs.writeFileSync(DESTINAZIONE, testo, 'utf8');
console.log(`scritto ${path.relative(path.join(QUI, '..'), DESTINAZIONE)}: ${voci.length} divisioni, ${dedotte.length} dedotte (${dedotte.join(', ')})`);
if (senzaTestata(precedente) === senzaTestata(testo)) console.log('dati invariati rispetto a prima');
