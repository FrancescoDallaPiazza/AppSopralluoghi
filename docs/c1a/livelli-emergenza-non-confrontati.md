# Il livello di emergenza esiste, è noto al codice, e nessuno lo confronta

Misura dell'11 settembre 2026, su richiesta di AppOverall dopo che AppFormazione
ha trovato lo stesso difetto dal proprio lato. **Sola lettura.**

## 1. Dove sta il livello, e quanto è pieno

| tabella | colonna | migrazione | righe | valorizzate |
|---|---|---|---:|---:|
| `cliente` | `livello_antincendio` | `041`, ampliata da `050` | 619 | **0** |
| `cliente` | `gruppo_primo_soccorso` | `041` (A/BC), `050` (A/B/C/BC) | 619 | **0** |
| `sede` | `livello_antincendio` | `054` | 619 | **0** |
| `sede` | `gruppo_primo_soccorso` | `054` | 619 | **0** |

Il livello vive **in due posti** — sul cliente e sulla sede — e oggi è vuoto in
tutti e quattro. Su 1.238 righe fra clienti e sedi, **nessuna** dichiara né il
livello antincendio né il gruppo di primo soccorso.

## 2. Esiste un punto che confronta il livello richiesto con quello fatto? No

La funzione che conosce il livello **esiste** ed è
`corsoEmergenzaRichiesto(figuraCodice, livAntincendio, gruppoPS)`
(`src/lib/admin/formazione.ts:332`): dato il livello del cliente restituisce il
corso preciso — `AI_LIV1/2/3`, `PS_GRA/PS_GRBC`.

I suoi chiamanti, **enumerati e non cercati**:

| file | riga | a cosa serve |
|---|---:|---|
| `OrganigrammaView.tsx` | 1246, 1419, 1712, 1944 | **mostrare** all'operatore quale corso serve |
| `organigramma-revisioni.ts` | 79 | la stessa indicazione nella revisione |
| `formazione.ts` | 1965, in `proponiCoseDaFare` | le figure **scoperte**: nessuno assegnato, quindi non c'è nessun attestato da confrontare |

**Nessuno di questi confronta il livello con un attestato esistente.** Il motore
di valutazione — `assemblaRiepilogo` → `scegliFormazione`
(`formazione.ts:582`) — decide se un requisito è assolto così:

```
if (f.corso_codice === req.corso_codice) return true;
if (req.per_categoria && categoriaFormazione(f) === req.categoria) return true;
```

Le tre righe con `per_categoria = true` sono `addetto_antincendio → AI_LIV2`,
`addetto_primo_soccorso → PS_GRBC`, `operatore_attrezzatura → ATTR_GENERICO`.
Quindi **qualunque corso della categoria antincendio assolve il requisito**, e
`AI_LIV1` vale quanto `AI_LIV3`.

**Non è una svista: è scritto nel codice come scelta** (`formazione.ts:845`):

> *«Requisito a percorsi multipli… Per questi NON si assume un livello: senza
> attestato la riga dice "corso da scegliere" e il livello/gruppo lo sceglie il
> consulente registrando l'attestato della persona.»*

La decisione era «non inventare un livello quando non lo sappiamo», ed è giusta.
L'effetto collaterale non era nel mirino: **quando il livello lo sappiamo e
l'attestato è di livello inferiore, nessuno se ne accorge.**

## 3. Quante persone sarebbero scoperte oggi: zero, e non vuol dire niente

| | |
|---|---:|
| `nomina` | **0** |
| `formazione` | **0** |
| clienti/sedi con livello definito | **0** |

**Zero**, per tre ragioni indipendenti e tutte e tre «mancanza di dati»: non ci
sono nomine, non ci sono attestati, e non c'è nessun livello con cui confrontarli.

Questo conteggio **non dice che il difetto non c'è.** È di nuovo la forma che
questo repo ha già incontrato due volte — *un'assenza che si presenta come un
insieme completo*. Il difetto è **latente**: diventa reale al primo import che
porta dentro attestati di emergenza e nomine, e in quel momento produce
**conformità apparenti**, non errori visibili.

E c'è un ordine che conta: se si importano prima gli attestati e poi si
definiscono i livelli, nell'intervallo l'app dice «in regola» a chi non lo è.
Oggi invece, con i livelli vuoti, `corsoEmergenzaRichiesto` risponde
`{definito: false}` su **tutti** i clienti — cioè l'app chiede di definire il
livello prima. È una protezione accidentale, e sparisce appena qualcuno compila
quel campo.

## 4. Cosa NON decido

«Un livello superiore assolve l'inferiore» **sembra** ovvio — chi ha fatto il
corso antincendio di livello 3 ha fatto più ore di chi ha fatto il livello 1 — ma
è una **regola normativa**, e va **citata**, non dedotta da noi. Lo stesso vale
per i gruppi di primo soccorso, dove la relazione A / B / C non è nemmeno un
ordinamento per ore nello stesso verso.

Sono le stesse due colonne che ieri hanno prodotto il caso `RSPP`: una
classificazione che sembra chiara e che solo chi la compila sa cosa significhi.
Qui la fonte da citare è il DM 02/09/2021 per l'antincendio e il DM 388/2003 per
il primo soccorso — ma **non scrivo io quale articolo dice cosa**: serve una
scheda, come propone AppOverall, e la citazione va verificata da chi risponde
dell'adempimento.

Quel che posso dire con certezza è che **il difetto è nei due repo**, che qui è
latente e non visibile, e che il momento per deciderlo è **prima** dell'import
degli attestati di emergenza — non dopo.
