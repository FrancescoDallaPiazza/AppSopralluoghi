# I cinque ATECO che non sono arrivati: sono cinque descrizioni senza codice

Riga per riga sull'export `ElencoSedi.xlsx`, 11 settembre 2026, su richiesta di
AppOverall. **Sola lettura, nessuna scrittura.** Chiude l'unico numero che non
tornava in [`ateco-cosa-abbiamo.md`](ateco-cosa-abbiamo.md): 267 sull'export,
262 nel database.

## La risposta in una riga

**Manca solo il codice, non il cliente.** Tutti e cinque sono clienti attivi,
entrati regolarmente con tutto il resto; la cella ATECO del file contiene una
**descrizione in italiano senza nessun codice**, e `risolviAteco` non ha cifre da
cui ricavare una divisione.

## I cinque

| riga | cliente | cosa c'e' scritto nella cella ATECO |
|---:|---|---|
| 7 | A.I.D.I. SRL AUTOMAZIONI INDUSTRIALI DERIVATI IDRAULICI | `AUTOMAZIONI INDUSTRIALI DERIVATI IDRAULICI` |
| 464 | JOLANDA PARRUCCHIERA S.N.C. | `SERVIZI DEI SALONI DI ACCONCIATORE` |
| 570 | MY FOOD DI AMIGASSI LEONARDO | `COMMERCIO ALL'INGROSSO DI PASTI E PIATTI PRONTI` |
| 763 | TARANA RICCARDO | `LABORATORIO ARTIGIANALE PER LA PRODUZIONE DI PRODOTTI DI GASTRONOMIA PRONTA E PRODOTTI DA FORNO` |
| 844 | ZETA MOTO DI ANDREA ZENONI | `Riparazioni di motocicli e ciclomotori, riparazione meccanica e motoristica, gommista.` |

**Nessuna delle cinque celle contiene una sola cifra.** Non e' un formato strano
che il parser non capisce: e' che il codice li' dentro non c'e' proprio.

Ognuno dei cinque e' una riga sola: ragione sociale unica fra le 619 attive,
P.IVA unica dove c'e'. **Nessun'altra riga poteva portargli il codice.**

## Perche' si perde: la colonna ATECO del gestionale e' testo libero

La forma normale nella colonna e' `(C.25.62) Lavori di meccanica generale;` —
sezione, codice e descrizione in una stringa sola. Il codice sta li' dentro, e
`risolviAteco` lo trova prendendo il primo gruppo di 1-2 cifre. Su 267 celle
piene:

| forma | quante |
|---|---:|
| codice presente (in qualunque posizione della stringa) | **262** |
| **sola descrizione, zero cifre** | **5** |

Il campo non e' vincolato nel gestionale: chi compilava ha scritto a mano cosa
fa l'azienda invece di sceglierne la voce. **Non c'e' niente da riparare
nell'import** — il dato d'origine non contiene l'informazione.

E l'import lo dice gia': `anagraficheImport.ts:414` mette il testo in
`atecoNonRisolto`, e l'anteprima lo stampa per esteso (`ImportAnagrafiche.tsx:230`,
«ATECO "..." non riconosciuto»). Queste cinque righe sono comparse a schermo il 9
settembre. **La perdita e' dichiarata, non silenziosa** — quello che mancava era
il conto.

## Controprova: il file riproduce il database esatto

Applicando `risolviAteco` alle 619 righe attive del file si riottengono **tutti**
i numeri misurati ieri sul database, non solo il totale:

| | dal file | dal database |
|---|---:|---:|
| clienti attivi | 619 | 619 |
| con codice ATECO | **262** | **262** |
| divisioni distinte | **46** | **46** |
| clienti sulla divisione 86 | **6** | **6** |
| clienti sulle divisioni 30 e 87 | **0** | **0** |

Cinque numeri indipendenti che coincidono: la ricostruzione dal file **e'** quel
database, e i cinque nomi qui sopra sono i cinque nomi giusti.

## Guardandole tutte, ne e' saltata fuori una sesta: SHAMS SERVICE

Cercare *come* si perde una riga ha fatto vedere il caso opposto — una riga che
**non** si perde e che sarebbe stato meglio perdere.

| | |
|---|---|
| cliente | SHAMS SERVICE SRLS (riga 711) |
| cella ATECO | `37054` ⏎⏎ `(F.41.2) COSTRUZIONE DI EDIFICI RESIDENZIALI E NON RESIDENZIALI;` |
| divisione salvata | **37** — *Gestione delle reti fognarie* |
| divisione vera | **41** — *Costruzione di edifici* |

`37054` e' il **CAP di Nogara (VR)**, finito nella cella sopra il codice vero.
`risolviAteco` prende il primo gruppo di cifre che incontra, e il primo gruppo e'
il CAP. Un'impresa edile sta in archivio come gestione reti fognarie.

**Cosa non cambia:** il livello di rischio. Divisione 37 e divisione 41 sono
**entrambe `alto`** nell'Allegato IV, quindi `livello_rischio` e' giusto lo
stesso. Per caso, non per costruzione.

**Cosa cambia davvero:** il **modulo di settore**. `oreModuloSettore`
(`ateco.ts:43`) da' 16 ore alle divisioni 41-42-43 e **niente** alla 37; e
`formazione.ts:863` su `null` fa `continue`, cioe' **salta il requisito senza
segnalarlo** («niente falso mancante»). Se domani qualcuno di SHAMS viene nominato
datore di lavoro-RSPP o RSPP, le **16 ore di modulo settore costruzioni non
verranno mai chieste**, e lo scadenzario non avra' un buco da mostrare: avra' una
riga in meno. Finche' nessuno e' nominato in quei ruoli, non morde.

Delle 262 celle risolte, **due sole non cominciano con il codice**. L'altra e'
innocua: riga 139, BP CHIMICA SRL, comincia con `;` e un a capo, e poi elenca
**due** codici (`G.46.75.02` e `G.46.73.4`) — stessa divisione 46, quindi qualunque
dei due si prenda il risultato non cambia. **Su 262, una sola cella prende la
divisione sbagliata.**

## Cosa questo dice sui 262

Il documento di ieri ha dimostrato che il livello **e' derivato** dal codice, e
quella dimostrazione regge intatta: SHAMS ha il livello coerente con il codice che
ha in archivio. Ma aggiunge una riga di cautela per chi quei codici li
riceve:

> la qualita' dei 262 e' la qualita' del raccordo **piu'** la qualita' della cella
> di partenza, e la cella di partenza e' testo libero. Su 262, **una** e' sbagliata
> per una ragione che si vede solo aprendo il file.

Su 262 fa lo 0,4%, e su questo campione e' l'unica. Non e' un motivo per non
spostare il dato: e' un motivo per non spostarlo come se fosse stato validato.

## Quello che NON si fa qui

La campagna di riempimento dell'ATECO (i 357 clienti senza codice) e' **rinviata
da Francesco l'11 settembre** — «verra' fatta a posteriori». Questo documento non
la riapre e non la ripropone: **nessuna di queste sei righe e' stata scritta**.
Quattro dei cinque testi si leggerebbero a occhio (acconciatore, ingrosso
alimentare, laboratorio di gastronomia, riparazione motocicli) e A.I.D.I. no —
ma leggerli non e' compito di questo passo.

Se e quando quella campagna partira', **queste sei righe sono la sua prima
pagina**: cinque celle da compilare e una da correggere.

## Come rileggerlo sul database

Il conto qui sopra e' fatto sul file e sul codice dell'import, e combacia con il
database su cinque misure indipendenti. Per vederlo anche dall'altra parte
bastano due `select` in sola lettura:

```sql
-- i cinque: il cliente c'e', il codice no
select ragione_sociale, codice_ateco, livello_rischio
from cliente
where ragione_sociale ilike any (array[
  'A.I.D.I.%', 'JOLANDA PARRUCCHIERA%', 'MY FOOD%', 'TARANA RICCARDO%', 'ZETA MOTO%'
])
order by ragione_sociale;
-- atteso: 5 righe, codice_ateco null, livello_rischio null

-- il sesto: il codice c'e' ed e' quello sbagliato
select ragione_sociale, codice_ateco, livello_rischio
from cliente where ragione_sociale ilike 'SHAMS SERVICE%';
-- atteso: codice_ateco = '37' (dovrebbe essere '41'), livello_rischio = 'alto'
```
