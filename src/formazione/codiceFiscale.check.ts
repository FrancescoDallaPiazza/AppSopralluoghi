// Self-check del motore Codice Fiscale (nessun framework).
// Esegui: `npx tsx src/formazione/codiceFiscale.check.ts`
// Copre: carattere di controllo, estraiBase (data/sesso belfiore-free),
// crossCheck, e l'invariante del fallback offline -> analizzaCF restituisce
// SEMPRE data/sesso anche quando il comune non e' risolto (luogoNoto=false).
import assert from 'node:assert';
import { valido, carControllo, estraiBase, crossCheck, analizzaCF } from './codiceFiscale';

// CF costruito: RSSMRA85M01H501 + carattere di controllo calcolato (niente costanti magiche).
const cf15 = 'RSSMRA85M01H501';
const cf = cf15 + carControllo(cf15);
assert.ok(valido(cf), 'CF con carattere di controllo calcolato deve essere valido');

const base = estraiBase(cf)!;
assert.equal(base.dataISO, '1985-08-01', 'data di nascita');
assert.equal(base.sesso, 'M', 'sesso');
assert.equal(base.codiceLuogo, 'H501', 'codice catastale');

const x = crossCheck('Rossi', 'Mario', cf);
assert.equal(x.cognomeOk, true, 'cross-check cognome');
assert.equal(x.nomeOk, true, 'cross-check nome');

// Femminile: giorno +40.
const cfF15 = 'RSSMRA85M41H501';
const baseF = estraiBase(cfF15 + carControllo(cfF15))!;
assert.equal(baseF.sesso, 'F', 'sesso femminile');
assert.equal(baseF.dataISO, '1985-08-01', 'data femminile (giorno -40)');

// Invariante fallback: i campi belfiore-free di analizzaCF combaciano con estraiBase,
// quindi in campo offline (comune non risolto) data/sesso restano leggibili.
const full = await analizzaCF(cf);
assert.ok(full, 'analizzaCF non nullo su CF valido');
assert.equal(full!.dataISO, base.dataISO, 'analizzaCF preserva la data di estraiBase');
assert.equal(full!.sesso, base.sesso, 'analizzaCF preserva il sesso di estraiBase');
assert.equal(full!.comune, 'Roma', 'comune risolto quando la tabella Belfiore e presente');

console.log('OK codiceFiscale: 12 asserzioni passate');
