// Controllo di allineamento della guida d'uso (docs/USO.md).
//
// Un manuale invecchia in silenzio: il codice cambia, la guida no, e nessuno se
// ne accorge finche' qualcuno non segue un'istruzione che non esiste piu'.
// Questo script rende rumoroso quel silenzio.
//
// Come funziona:
//   1. legge la tabella "capitolo -> sorgenti" dentro USO.md, fra i marcatori
//      <!-- MAPPA:inizio --> e <!-- MAPPA:fine -->;
//   2. trova l'ultimo commit che ha toccato USO.md (= quando la guida e' stata
//      allineata l'ultima volta);
//   3. per ogni capitolo elenca i commit successivi a quello sui file mappati.
//
// Non corregge nulla e non sa se il capitolo sia davvero da riscrivere: dice
// dove guardare. La misura e' la DISTANZA dall'ultimo commit della guida, per
// cui un aggiornamento fittizio azzera l'allarme senza aver letto niente -
// e' un attrezzo per chi lavora in buona fede, non una guardia.
//
// Uso:  node scripts/guida-check.mjs [--strict] [--verbose]
//       --strict   esce con codice 1 se c'e' scostamento (per la CI)
//       --verbose  elenca anche i capitoli allineati e i file coperti

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GUIDA = 'docs/USO.md';

const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const VERBOSE = args.has('--verbose');

const git = (...a) =>
  execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 }).trimEnd();

// ---------------------------------------------------------------- mappa

// Righe di tabella markdown fra i due marcatori. Si scartano l'intestazione e
// la riga di separazione: restano le coppie (capitolo, sorgenti).
function leggiMappa(testo) {
  const dentro = testo.split('<!-- MAPPA:inizio -->')[1]?.split('<!-- MAPPA:fine -->')[0];
  if (dentro == null) {
    throw new Error(`Marcatori <!-- MAPPA:inizio --> / <!-- MAPPA:fine --> non trovati in ${GUIDA}.`);
  }
  const righe = [];
  for (const riga of dentro.split('\n')) {
    const t = riga.trim();
    if (!t.startsWith('|')) continue;
    if (/^\|[\s:|-]+\|$/.test(t)) continue;              // riga di separazione
    const celle = t.split('|').slice(1, -1).map((c) => c.trim());
    if (celle.length < 2) continue;
    if (/^capitolo$/i.test(celle[0])) continue;          // intestazione
    const sorgenti = [...celle[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (sorgenti.length) righe.push({ capitolo: celle[0], sorgenti });
  }
  if (!righe.length) throw new Error(`Mappa vuota in ${GUIDA}: nessuna riga leggibile fra i marcatori.`);
  return righe;
}

// ---------------------------------------------------------------- git

function ultimoCommitGuida() {
  const sha = git('log', '-1', '--format=%H', '--', GUIDA);
  return sha || null;
}

// Commit su `paths` piu' recenti di `da` (escluso). Percorsi inesistenti
// verrebbero rifiutati da git: si filtrano prima, e si segnalano a parte.
function commitDopo(da, paths) {
  const out = git('log', `${da}..HEAD`, '--format=%h\t%ad\t%s', '--date=short', '--', ...paths);
  return out ? out.split('\n').map((r) => {
    const [sha, data, ...resto] = r.split('\t');
    return { sha, data, msg: resto.join('\t') };
  }) : [];
}

// Modifiche non ancora committate: sfuggirebbero al confronto fra commit.
function nonCommittati(paths) {
  const out = git('status', '--porcelain', '--', ...paths);
  return out ? out.split('\n').map((r) => r.trim()) : [];
}

const esiste = (p) => {
  try { git('cat-file', '-e', `HEAD:${p}`); return true; } catch { return false; }
};

// ---------------------------------------------------------------- copertura

// File sorgente che nessun capitolo dichiara. Non e' un errore - non tutto il
// codice ha una schermata - ma una schermata nuova non mappata invecchia senza
// che questo controllo possa accorgersene, ed e' il caso che vale la pena dire.
function nonMappati(mappa) {
  const coperti = new Set(mappa.flatMap((m) => m.sorgenti));
  const tutti = git('ls-files', 'src/*.tsx', 'src/**/*.tsx').split('\n').filter(Boolean);
  return tutti.filter((f) => {
    if (coperti.has(f)) return false;
    // coperto anche se un capitolo dichiara la cartella che lo contiene
    for (const c of coperti) if (!c.includes('.') && f.startsWith(c.replace(/\/?$/, '/'))) return false;
    return true;
  });
}

// ---------------------------------------------------------------- esecuzione

let uscita = 0;
try {
  const testo = readFileSync(resolve(ROOT, GUIDA), 'utf8');
  const mappa = leggiMappa(testo);
  const da = ultimoCommitGuida();

  if (!da) {
    console.log(`${GUIDA} non risulta in nessun commit: nulla con cui confrontare.`);
    process.exit(0);
  }

  const info = git('log', '-1', '--format=%h %ad %s', '--date=short', '--', GUIDA);
  console.log(`Guida allineata al commit: ${info}\n`);

  const arretrati = [];
  const mancanti = [];

  for (const { capitolo, sorgenti } of mappa) {
    const validi = sorgenti.filter(esiste);
    for (const s of sorgenti) if (!validi.includes(s)) mancanti.push({ capitolo, s });
    if (!validi.length) continue;

    const commit = commitDopo(da, validi);
    const sporchi = nonCommittati(validi);
    if (commit.length || sporchi.length) arretrati.push({ capitolo, commit, sporchi, validi });
    else if (VERBOSE) console.log(`  OK  ${capitolo}`);
  }

  if (VERBOSE && arretrati.length) console.log('');

  if (!arretrati.length) {
    console.log('Nessun capitolo arretrato: la guida copre il codice di oggi.');
  } else {
    console.log(`${arretrati.length} capitol${arretrati.length === 1 ? 'o' : 'i'} da rileggere:\n`);
    for (const a of arretrati) {
      console.log(`  ${a.capitolo}`);
      for (const c of a.commit) console.log(`      ${c.sha}  ${c.data}  ${c.msg}`);
      for (const s of a.sporchi) console.log(`      (non committato) ${s}`);
      if (VERBOSE) console.log(`      file: ${a.validi.join(' ')}`);
      console.log('');
    }
    console.log('Rileggi i capitoli elencati, aggiorna il §12 "Novita\'" se cambia');
    console.log(`cio' che l'utente vede, e committa ${GUIDA} insieme al resto.`);
    uscita = STRICT ? 1 : 0;
  }

  if (mancanti.length) {
    console.log('\nSorgenti dichiarate in mappa ma non presenti (riga da correggere):');
    for (const m of mancanti) console.log(`  ${m.capitolo}: ${m.s}`);
    uscita = STRICT ? 1 : uscita;
  }

  const scoperti = nonMappati(mappa);
  if (scoperti.length) {
    console.log(`\n${scoperti.length} schermat${scoperti.length === 1 ? 'a' : 'e'} non mappat${scoperti.length === 1 ? 'a' : 'e'} in ${GUIDA} §13:`);
    for (const f of scoperti) console.log(`  ${f}`);
    console.log("(se hanno una schermata, aggiungile a un capitolo: altrimenti quella parte di guida invecchia in silenzio)");
  }
} catch (e) {
  console.error(`guida-check: ${e.message}`);
  process.exit(1);
}

process.exit(uscita);
