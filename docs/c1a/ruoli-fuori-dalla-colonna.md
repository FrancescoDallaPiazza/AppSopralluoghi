# Metà dell'organigramma è scritta nella mansione: 148 righe, 94 società, 29 forme

Misura dell'11 settembre 2026, su assegnazione di AppOverall dopo
[`multi-codice-il-livello.md`](multi-codice-il-livello.md).
**Sola lettura, nessuna scrittura.**

Nel passo precedente avevamo visto di sfuggita che la mansione del titolare di
MIGLIORINI dice «TITOLARE- RSPP» mentre le sue colonne di ruolo sono vuote. Qui
quella riga e' contata su tutto il foglio «Ruoli SSL» di `ExportExcel (4).xlsx`.

**Nota di perimetro:** l'assegnazione diceva «su tutte e 65 le societa' del
foglio», ma la domanda 3 — societa' con ruoli nelle mansioni e **nessuna** colonna —
sta per definizione *fuori* da quelle 65. La misura e' quindi su **tutte le 3.501
righe persona e tutte le 480 societa'** del foglio.

## Il numero, prima di tutto

| | righe |
|---|---:|
| righe con un ruolo nelle **colonne** (l'organigramma dichiarato) | **153** |
| righe con un ruolo scritto nella **mansione** | **160** |
| righe che hanno **entrambe le cose** | 12 |
| **righe che portano un ruolo, in un posto o nell'altro** | **301** |
| — **di cui le colonne ne dichiarano** | **51%** |

**Un import che legge solo le colonne trova meta' dell'organigramma.** Le altre
**148 righe** hanno il ruolo scritto soltanto in un campo di testo libero pensato
per dire che mestiere fa la persona.

## 1. Quante righe, e con quante forme di scrittura

160 righe su 3.501 (**4,6%**), su **108 societa'**, hanno nella mansione un ruolo
di sicurezza riconoscibile. Scritto in **29 forme diverse**:

| ruolo | righe | forme distinte | la colonna che gli corrisponde |
|---|---:|---:|---|
| RSPP | **91** | **22** | `RSPP` |
| addetto antincendio | **47** | 1 | `Addetti Antincendio` |
| datore di lavoro | **22** | 5 | **non esiste** |
| preposto | 6 | 4 | `Preposto` |
| ASPP | 1 | 1 | `Addetti Servizio Prevenzione e Protezione` |
| dirigente | 1 | 1 | `Dirigente` |
| RLS · primo soccorso · emergenze | 0 | — | — |

Le ventidue forme dell'RSPP, verbatim, con il numero di righe:

```
37x  RSPP/titolare          2x  TITOLARE/RSPP          1x  SOCIO - TITOLARE - RSPP
14x  RSPP- titolare         2x  SOCIO/ RSPP            1x  RSPP/TITOLARE
11x  RSPP/Titolare          2x  SOCIO/RSPP             1x  TITOLARE ASPP e RSPP
 3x  RSPP - Datori di Lavoro  2x  TITOLARE- RSPP       1x  TITOLRE/RSPP
 2x  RSPP - Datore di Lavoro  2x  RSPP- DL             1x  DIRETTORE TECNICO, RSPP E COMMERCIALE
 2x  RSPP ESTERNO             2x  RSPP                 1x  RSPP- NO TITOLARE
                                                       1x  DATORE DI LAVORO- RSPP
                                                       1x  RSPP/ Titolare
                                                       1x  TITOLARE - RSPP
                                                       1x  AMMINISTRATORE/DATORE DI LAVORO/RSPP
```

Tutte le varianti che ci si aspetta e una che non ci si aspetta: separatore
`/` o `-` o ` - `, maiuscole e minuscole miste, l'ordine invertito
(`TITOLARE/RSPP` contro `RSPP/titolare`), lo spazio dopo la barra, l'abbreviazione
`DL`, il refuso `TITOLRE`, e una negazione — **`RSPP- NO TITOLARE`**, che non e'
rumore ma un'informazione precisa scritta a mano.

**Un falso positivo, escluso e dichiarato.** Nove righe di DER ERSTE s.r.l. dicono
`INSTALLATORE/MANUTENTORE IMPIANTI ANTINCENDIO E ANTIFURTO`: contiene la parola
«antincendio» ma e' il **mestiere**, non un incarico di squadra. Sono escluse dal
conto. E' la stessa trappola dell'ATECO in miniatura: cercare una parola in un
campo libero trova anche chi quella parola la usa per un'altra cosa.

*E un dettaglio che vale il suo spazio:* le 47 righe «addetto antincendio» sono
**una sola societa'** (CROCE VERDE) con **una sola forma** (`ADD. ANTINCENDIO`).
Non e' una convenzione diffusa: e' l'abitudine di chi ha compilato quella scheda.

## 2. Quante hanno anche la colonna: otto

Incrociando riga per riga **lo stesso ruolo** nella mansione e nella sua colonna:

| coppie *(riga, ruolo)* — sono 168 in tutto, su 160 righe | |
|---|---:|
| con **anche** la colonna valorizzata | **8** |
| con il ruolo **solo** nella mansione | **160** |

Le otto che stanno in tutti e due i posti:

| società | persona | mansione |
|---|---|---|
| NEWEPA SRL | BIANCHI EMANUELE | `RSPP/TITOLARE` |
| IMPRESA EDILE COMERLATI STEFANO | COMERLATI STEFANO | `RSPP/Titolare` |
| COLONIAS SOCIETA' COOPERATIVA | CUCCHETTO GIANMARCO | `SOCIO/RSPP` |
| CARROZZERIE VERONELLO SRLS | RESIDORI FABRIZIO | `TITOLARE- RSPP` |
| RONCARI MATTEO | RONCARI MATTEO | `RSPP- titolare` |
| COSTRUZIONI RUFFO Srl | RUFFO RICCARDO | `DIRIGENTE` |
| Stireria JENNY di Valbusa Manuel | VALBUSA MANUEL | `RSPP/titolare` |
| PLASTIMETAL S.R.L. | ZAMBURLIN VALENTINA | `AMMINISTRATORE/DATORE DI LAVORO/RSPP` |

**Otto su centosessanta.** La mansione non e' una copia ridondante della colonna:
nel 95% dei casi e' **l'unico posto** in cui quel ruolo e' scritto.

E per il **datore di lavoro** non c'e' nemmeno la possibilita': **nell'export non
esiste una colonna** per quel ruolo. Le 22 righe che lo dichiarano nella mansione
sono l'unica traccia che il gestionale ne porti.

## 3. Novantaquattro società che dopo l'import sembrerebbero senza organigramma

| | |
|---|---:|
| societa' con almeno una **colonna** di ruolo | 65 |
| societa' con almeno un ruolo nella **mansione** | 108 |
| societa' con **entrambe** | 14 |
| **societa' con ruoli SOLO nelle mansioni** | **94** |
| — quante di quelle 94 sono fra i **619 clienti attivi** | **94 su 94** |
| — persone che ci lavorano | **703** |

**Tutte e 94 sono clienti veri**, non residui di anagrafica. Dopo un import che
legge solo le colonne, 94 clienti su 619 avrebbero l'organigramma vuoto avendone
uno scritto: **il 15% del portafoglio**.

Le piu' grandi:

| società | persone | righe con un ruolo in mansione |
|---|---:|---:|
| VELOX SERVIZI SRL | 190 | 4 |
| CROCE VERDE | 76 | 47 |
| CAFFINI SPA | 53 | 1 |
| SOC. COOP. SOCIALE SAN BIAGIO | 26 | 1 |
| CHEESE BREAK SRL | 18 | 1 |
| IUDICE GIUSEPPE WORK | 16 | 1 |
| ACME SRL | 16 | 1 |
| BO.CO. FISH S.R.L. | 15 | 1 |

VELOX SERVIZI e' il caso limite: **190 persone, quattro ruoli scritti a mano
(un RSPP esterno, un RSPP «no titolare», due preposti) e zero colonne.** E'
la stessa azienda su cui nell'agosto scorso si era diagnosticato che gli attestati
RLS restavano muti per mancanza di nomina. **Quel buco li' resta**: l'RLS non e'
fra i quattro, e nessuno lo scrive da nessuna parte. Il fatto nuovo e' che
quattro *altre* nomine esistono per iscritto, e un import che legge le colonne le
perderebbe tutte e quattro — su un cliente da 190 persone.

## 4. Il testo libero dice più della colonna, non meno

Questa non era fra le tre domande, ma esce dai dati e riguarda la domanda
**semantica** gia' aperta per Francesco («cosa raccoglie di fatto la colonna
RSPP?»). Delle 91 righe che dicono RSPP nella mansione:

| | righe | % |
|---|---:|---:|
| dicono che l'RSPP e' **anche titolare / socio / datore** → art. 34 | **85** | **93%** |
| dicono esplicitamente che **non** lo e' (`RSPP ESTERNO`, `RSPP- NO TITOLARE`) | 3 | 3% |
| non lo dicono | 3 | 3% |

**Il campo libero risolve l'ambiguita' che la colonna non puo' esprimere.** La
colonna `RSPP` porta una data e basta: che quella persona sia il datore che ha
assunto l'incarico in proprio (art. 34 → `datore_lavoro_rspp`, con il suo percorso
formativo e il modulo di settore) oppure un professionista esterno (`rspp`), la
colonna non lo dice. La mansione lo dice in 88 casi su 91.

Non e' una risposta alla domanda semantica — quella riguarda **cosa il gestionale
intendesse** con quella colonna, ed e' di Francesco. E' pero' un fatto che la
pesa: se la colonna significasse «professionista», 85 righe la smentirebbero per
iscritto.

## Cosa ne segue per l'import delle nomine, che non è ancora scritto

Non e' una riparazione: e' un vincolo di progetto, e arriva prima del codice.

1. **Leggere solo le colonne perde meta' delle righe e il 15% dei clienti**, e le
   perde *in silenzio* — il cliente risulta senza organigramma, che e' uno stato
   legittimo e indistinguibile dal dato mancante. E' lo stesso difetto del `null`
   di `oreModuloSettore`, su un'altra tabella.
2. **Il campo libero non si legge con una regola sola.** 29 forme su 160 righe:
   una riga su cinque e' scritta in modo nuovo. Qualunque cosa si faccia deve
   ammettere di non aver capito, invece di ignorare in silenzio quello che non
   combacia.
3. **«RSPP» nella mansione non vuol dire `rspp`.** Nel 93% dei casi vuol dire
   `datore_lavoro_rspp`, e mandarlo su `rspp` darebbe a 85 persone il percorso di
   un professionista invece di quello del datore. La nota di `STATO.md:245` —
   «una nomina che punta al ruolo sbagliato e' peggio di una nomina mancante» —
   qui ha il suo secondo esempio.
4. **Il testo va conservato comunque**, come per l'ATECO. `RSPP- NO TITOLARE`,
   `RSPP ESTERNO`, `DIRETTORE TECNICO, RSPP E COMMERCIALE` portano ciascuno
   un'informazione che nessun codice di ruolo trattiene. Buttata al momento
   dell'import, non torna piu'.

## Come rileggerlo, quando ci saranno le nomine

```sql
-- oggi e' vuota: e' il punto di partenza
select count(*) from nomina;                                     -- atteso: 0

-- dopo un eventuale import: quanti clienti restano senza organigramma
select count(*) from cliente c
 where not exists (select 1 from persona p
                     join nomina n on n.persona_id = p.id
                    where p.cliente_id = c.id);
-- se il numero e' vicino a 554 (619 - 65) invece che a 460 (619 - 159),
-- l'import ha letto solo le colonne
```
