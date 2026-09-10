# «Fattori di Rischio», guardato invece che descritto

Serve a una cosa sola: **mettere Francesco in condizione di riconoscere il dato
guardandolo**, perché è lui che sa se in azienda quella griglia la riempie chi
fa il DVR o chi fa l'anagrafica. La domanda «cos'è questo foglio» non si risponde
con 79 nomi di colonna e dei conteggi — con quelli non si distingue un rischio
valutato da un'annotazione libera.

Foglio `Fattori di Rischio` di `ExportExcel (4).xlsx`, 10 settembre 2026.
**Nessun dato personale**: nome, cognome, codice fiscale e data di nascita non
sono stati letti. Le righe hanno un progressivo mio, le aziende una lettera.

## Come è marcata la cella: solo `X`

In tutte e 79 le colonne di fattore, su tutte le 3.501 righe, esiste **un unico
valore distinto**: la lettera `X`, 2.447 volte. Nessuna data, nessun livello,
nessuna classe, nessun testo libero. È una **marcatura di presenza** e nient'altro.

**Non esiste una colonna che somigli a un livello o a una classe.** Le colonne
0-37 sono il blocco anagrafico comune agli altri fogli (`Società`, `Sede`,
`Mansione`, `Qualifica`, `Area di Lavoro`, `Mansione Safety`…): nessuna porta un
grado, una fascia o un punteggio.

## Quanto è pieno: poco, e a chiazze

| | |
|---|---:|
| righe con almeno un fattore | **162** su 3.501 |
| società con almeno una riga marcata | **39** su 480 |
| righe con **zero** fattori | 3.339 |

E una stranezza che vale la pena notare: **nessuna riga ha 1 o 2 fattori.** Il
minimo è 3. Chi compila non aggiunge un rischio alla volta — o non mette niente,
o mette un blocco.

## Il fatto che risponde alla domanda

L'insieme dei fattori **si ripete identico fra persone diverse**, e si ripete per
azienda, non per mansione.

| | |
|---|---:|
| righe con almeno un fattore | 162 |
| insiemi di fattori **distinti** | **76** |
| righe che condividono l'insieme con almeno un'altra | **122** |
| …di cui tutte nella **stessa società** | **112** |
| …di cui tutte con la **stessa mansione** | **45** |

I cinque insiemi più condivisi stanno **tutti dentro una sola società**, ma
coprono **2, 1, 2, 4 e 3 mansioni diverse**. Se fosse la valutazione del rischio
*della mansione*, mansioni diverse dovrebbero avere insiemi diversi. Qui non
succede.

## Il campione, dieci righe scelte per essere diverse

| # | azienda | mansione | fattori | perché è nel campione |
|---:|---|---|---:|---|
| 1 | azienda A | CAPO CANTIERE | 40 | il massimo di fattori |
| 2 | azienda B | IMPIEGATA | 3 | il minimo (nessuna riga ne ha 1 o 2) |
| 3 | azienda A | OPERAIO EDILE GENERICO | 34 | contiene Amianto (12 in tutto il file) |
| 4 | azienda C | IMPIEGATO ADDETTO AL MAGAZZINO | 33 | contiene Radiazioni ionizzanti (4 in tutto) |
| 5 | azienda D | ADDETTO CANTIERE - INSTALLATORE | 15 | stesso insieme della riga sotto, MANSIONE DIVERSA |
| 6 | azienda D | ADDETTO  ALLA  PROGRAMMAZIONE  e   | 15 | stesso insieme della riga sopra, MANSIONE DIVERSA |
| 7 | azienda E | IMPIEGATA | 6 | 6 fattori, caso intermedio |
| 8 | azienda F | OPERATORE SOCIO SANITARIO (OSS) | 11 | 11 fattori, caso intermedio |
| 9 | azienda G | Operaio qualificato | 19 | 19 fattori, caso intermedio |
| 10 | azienda H | Operaio | 0 | nessun fattore (il caso di 3.339 righe su 3.501) |

| fattore | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Agenti biologici | **X** |   | **X** | **X** |   |   |   |   |   |   |
| Agenti cancerogeni/mutageni | **X** |   | **X** | **X** |   |   |   |   | **X** |   |
| Agenti chimici | **X** |   | **X** | **X** | **X** | **X** |   | **X** | **X** |   |
| Amianto | **X** |   | **X** |   |   |   |   |   |   |   |
| Asfissia | **X** |   |   |   |   |   |   |   |   |   |
| Atmosfere esplosive | **X** |   | **X** | **X** |   |   |   |   |   |   |
| Avviamento macchine accidentale | **X** |   |   | **X** |   |   |   |   |   |   |
| Caduta dall’alto | **X** |   |   |   | **X** | **X** |   |   |   |   |
| Caduta di materiale dall'alto | **X** |   | **X** |   |   |   |   |   |   |   |
| Caduta di oggetti dall'alto |   |   |   | **X** | **X** | **X** |   |   |   |   |
| Caduta entro scavi aperti | **X** |   | **X** |   |   |   |   |   |   |   |
| Calore, fiamme, esplosione | **X** |   | **X** |   |   |   |   |   |   |   |
| Campi elettromagnetici |   |   |   | **X** |   |   |   | **X** | **X** |   |
| Dermatite professionale atopica, irritativa, allergica | **X** |   | **X** | **X** |   |   |   |   |   |   |
| Illuminazione | **X** |   |   | **X** |   |   |   |   |   |   |
| Impigliamento, trascinamento, cesoiamento, schiacciamento | **X** |   | **X** |   |   |   |   |   |   |   |
| In Itinere | **X** |   | **X** | **X** |   |   | **X** | **X** |   |   |
| Inalazione polveri, fibre, gas, vapori | **X** |   | **X** | **X** | **X** | **X** |   |   |   |   |
| Incendio | **X** |   | **X** | **X** |   |   |   | **X** | **X** |   |
| Interferenza lavorazioni | **X** |   | **X** |   |   |   |   |   |   |   |
| Investimento |   |   | **X** | **X** | **X** | **X** |   |   |   |   |
| Investimento (causato da attività interne) | **X** |   | **X** | **X** |   |   |   |   |   |   |
| Investimento e/o incidenti per interazione in cantieri o con traffico stradale | **X** |   | **X** |   |   |   |   |   |   |   |
| Irritazione degli occhi e dell'apparato respiratorio | **X** |   | **X** | **X** |   |   |   |   |   |   |
| Mezzi trasporto persone | **X** |   | **X** | **X** | **X** | **X** |   | **X** | **X** |   |
| Microclima | **X** |   | **X** | **X** |   |   |   |   |   |   |
| Movimentazione manuale dei carichi | **X** |   | **X** | **X** | **X** | **X** |   |   | **X** |   |
| Pericolo elettrocuzione | **X** |   | **X** | **X** |   |   |   | **X** | **X** |   |
| Posture Incongrue | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** |   |
| Presenza di lavoratrici gestanti, puerpere o in periodo di allattamento |   |   |   |   |   |   |   | **X** |   |   |
| Proiezione di schegge | **X** |   | **X** |   |   |   |   |   |   |   |
| Radiazioni ionizzanti |   |   |   | **X** |   |   |   |   |   |   |
| Radiazioni ottiche incoerenti | **X** |   |   |   |   |   |   |   | **X** |   |
| Ribaltamento di mezzi | **X** |   |   | **X** | **X** | **X** |   |   | **X** |   |
| Rischi causati da impianti e macchine | **X** |   |   | **X** | **X** | **X** |   |   | **X** |   |
| Rischi meccanici | **X** |   |   | **X** |   |   |   |   |   |   |
| Rischio Stress L.C. | **X** |   | **X** | **X** |   |   |   | **X** | **X** |   |
| Rumore | **X** |   | **X** | **X** | **X** | **X** |   |   | **X** |   |
| Scale portatili | **X** |   | **X** | **X** | **X** | **X** | **X** |   |   |   |
| Scivolamenti | **X** |   | **X** | **X** |   |   | **X** | **X** | **X** |   |
| Smottamento delle pareti dello scavo | **X** |   | **X** |   |   |   |   |   |   |   |
| Sovraccarico biomeccanico arti superiori |   |   |   |   |   |   |   |   | **X** |   |
| Tagli/Abrasioni | **X** |   | **X** | **X** | **X** | **X** |   | **X** | **X** |   |
| Tagli/Abrasioni - uffici |   | **X** |   |   |   |   | **X** |   |   |   |
| Urti con ostacoli fissi e/o mobili |   |   | **X** | **X** |   |   |   |   |   |   |
| Urti, colpi, compressioni | **X** |   | **X** |   |   |   |   |   |   |   |
| Ustioni |   |   | **X** |   |   |   |   |   | **X** |   |
| Vibrazioni HAV | **X** |   | **X** | **X** | **X** | **X** |   |   | **X** |   |
| Vibrazioni WBV | **X** |   |   | **X** | **X** | **X** |   |   | **X** |   |
| Videoterminali |   | **X** |   | **X** |   |   | **X** |   |   |   |

## La mia lettura, e la confidenza

**Mi sembra una griglia di azienda o di reparto, non una valutazione per
persona.** Confidenza **medio-alta** sul fatto negativo (non è una valutazione
per mansione) e **bassa** sul fatto positivo (cosa sia esattamente).

Il fatto negativo è quasi dimostrato dalle righe **5 e 6**: stessa azienda,
stesso identico insieme di quindici fattori, e le mansioni sono
«ADDETTO CANTIERE - INSTALLATORE» e «ADDETTO ALLA PROGRAMMAZIONE». Un installatore
di cantiere e un programmatore non hanno gli stessi rischi. Quell'insieme non
descrive il lavoro di quelle due persone: descrive l'azienda in cui lavorano — o
è stato copiato su tutti.

Il fatto positivo resta aperto perché le letture compatibili sono almeno tre, e i
dati non le distinguono: potrebbe essere l'elenco dei rischi **presenti in
azienda** (dal DVR) attribuito a tutti; oppure una griglia **iniziata e non
finita**, visto che copre 39 aziende su 480; oppure il rischio di **reparto**, e
in quel caso le due mansioni della riga 5-6 starebbero nello stesso reparto — cosa
che dal file non si vede, perché `Area di Lavoro` è valorizzata su 364 righe su
3.501 e non copre queste.

## Per questo foglio non esiste riscontro esterno, e resta scritto

Per i ruoli c'era la colonna 32 che li ripete in testo, e per l'`RSPP` c'era il
foglio `Formazione` con gli attestati: due verifiche **esterne al dato
verificato**. Qui non c'è niente di simile. Nessun altro foglio del workbook
incrocia queste 79 colonne, e nel file non esiste un campo che dica chi ha
compilato o quando.

Quindi tutto ciò che sta qui sopra descrive **la forma** del dato, non il suo
significato. Il significato lo sa solo chi riempie quella griglia, e questa
pagina serve a fargli riconoscere la propria abitudine guardandola.
