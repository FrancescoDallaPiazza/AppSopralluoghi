# La dimensione delle aziende, le 31 righe a 8 ore, e i due titoli del datore

Tre conteggi dell'11 settembre 2026, su assegnazione di AppOverall.
**Sola lettura, nessuna scrittura** — fuorché la correzione di una nostra frase in
[`durate-come-controllo.md`](durate-come-controllo.md), che è il motivo per cui
il conteggio (b) è stato chiesto.

---

## (a) Quanto sono grandi i 619 clienti: otto superano i 50

La colonna `N° DIPENDENTI` di `ElencoSedi.xlsx`, sulle 619 righe attive:

| | clienti | |
|---|---:|---|
| con la colonna **valorizzata** | **619** | 100% |
| — di cui scritta **`0`** | 138 | 22,3% |
| — con un numero **maggiore di zero** | **481** | 77,7% |
| vuota o non numerica | **0** | — |

Distribuzione dei 481:

| lavoratori | clienti | % dei 481 |
|---|---:|---:|
| 1–5 | **361** | 75,1% |
| 6–9 | 49 | 10,2% |
| 10–14 | 22 | 4,6% |
| 15–19 | 20 | 4,2% |
| 20–49 | 21 | 4,4% |
| **50–99** | **4** | 0,8% |
| **100 e oltre** | **4** | 0,8% |

**Sotto i 15 lavoratori: 432 su 481, il 90%.** La scheda 12 di AppOverall è
confermata, e con un margine largo.

**Oltre i 50 sono otto clienti in tutto**, e si contano a mano:

| cliente | lavoratori |
|---|---:|
| Rittal RCS Cooling Solutions S.r.l. | 408 |
| VELOX HOTELLERIE SRL | 227 |
| VELOX SERVIZI SRL | 190 |
| FRESENIUS KABI ITALIA SRL | 113 |
| CROCE VERDE | 76 |
| ZUCCHELLI FORNI SPA | 66 |
| CAFFINI SPA | 53 |
| SERVIZI SICUREZZA ITALIA SRL | 52 |

### La riserva che va detta prima che il dato traslochi

`N° DIPENDENTI` **non è una dichiarazione indipendente della forza lavoro: è il
numero di persone che abbiamo in anagrafica per quel cliente.** Misurato: su 619
clienti attivi il valore **coincide con il conteggio delle persone in 601 casi**.
I 18 che divergono sono quasi tutti clienti con la colonna a `0` e delle persone
caricate lo stesso.

Quindi il campo risponde a «quante persone gestiamo per loro», non a «quanti
lavoratori ha l'azienda». Per un artigiano con tre dipendenti le due domande hanno
la stessa risposta; per una società di cui seguiamo un reparto, no. Il caso
concreto lo si incontra fra due paragrafi: **KOSME SPA risulta a 11**.

**Se questo dato va a riempire `clienti.dipendenti` di AppFormazione, va
trasferito con quella etichetta e non con un'altra** — soprattutto se poi qualcuno
lo usa per decidere la soglia dei 50 dell'RLS, che è esattamente l'uso per cui è
stato chiesto.

### E il pattern, che ormai non è una coincidenza

È la **terza volta** che il dato che manca a una corsia esiste già nell'altra:

| | dove manca | dove c'è |
|---|---|---|
| ATECO | `clienti.ateco` vuota su 480 | 262 divisioni da noi |
| ruoli sicurezza | nessun organigramma | 153 righe nelle colonne + 160 nelle mansioni |
| numero lavoratori | `clienti.dipendenti` la riempie solo la scheda a mano | **619 su 619** da noi |

La forma è sempre la stessa: **lo stesso export del gestionale ha colonne che una
corsia legge e l'altra no.** Non è che i dati manchino — è che ogni import ha letto
le colonne che gli servivano quel giorno. Vale la pena dirlo come regola: prima di
dichiarare mancante un dato anagrafico, si guarda se l'altra corsia lo sta già
leggendo dallo stesso file.

---

## (b) Le 31 righe a 8 ore: quattro aziende, tre sopra i 50

**La nostra frase era una lettura e non regge come era scritta.** Ecco cosa dicono
i dati.

Primo fatto, e conferma la metà buona della frase: **il gestionale ha due titoli
distinti**, `Aggiornamento R.L.S. 4 ore` e `Aggiornamento R.L.S. 8 ore`. Non è una
durata digitata storta: chi ha registrato ha **scelto** fra due voci. Su questo
«non è un errore del gestionale» sta in piedi.

Secondo fatto, ed è quello che mancava: **le 31 righe non sono 31 aziende, sono
quattro.**

| azienda | righe a 8h | lavoratori in anagrafica |
|---|---:|---:|
| Rittal RCS Cooling Solutions S.r.l. | 17 | 408 |
| ZUCCHELLI FORNI SPA | 6 | 66 |
| CAFFINI SPA | 2 | 53 |
| **KOSME SPA** | **6** | **11** |

**25 righe su 31 (81%) vengono da aziende sopra i 50.** Tre delle quattro sono
proprio nell'elenco degli otto del punto (a). La quarta no.

**Il controllo nell'altro verso**, che è quello che rende il conto credibile:
le **128 righe a 4 ore** vengono da **42 aziende**, di cui **due sole** sopra i 50,
per **4 righe su 128 (3%)**.

| | righe | aziende | sopra i 50 | righe da aziende sopra i 50 |
|---|---:|---:|---:|---|
| `Aggiornamento R.L.S. 8 ore` | 31 | 4 | 3 su 4 | **25 (81%)** |
| `Aggiornamento R.L.S. 4 ore` | 128 | 42 | 2 su 42 | **4 (3%)** |

81% contro 3%: la separazione fra le due durate **segue la dimensione
dell'azienda**, e non per caso.

### KOSME SPA, l'eccezione, e cosa insegna

Sei righe a 8 ore da un'azienda che in anagrafica ha 11 persone. Delle due l'una,
e i dati non scelgono: o quelle sei righe sono registrate sul titolo sbagliato,
**oppure** — più probabile, ed è il punto (a) che torna — KOSME SPA è una società
di cui seguiamo una parte del personale, e gli 11 sono i nostri, non i suoi.

Non lo decidiamo noi: **è una domanda da fare al cliente o da leggere in visura**,
e va nella lista di ciò che aspetta una persona, sotto MIGLIORINI e ANTICHI
SAPORI. Nel frattempo il documento dice il numero, non la spiegazione.

### La frase, riscritta

> ~~Le 31 righe a 8 ore non sono un errore del gestionale, sono le aziende oltre i
> 50 lavoratori.~~
>
> **Le 31 righe a 8 ore vengono da quattro aziende, e il gestionale offre due
> titoli distinti: non è una durata sbagliata, è una scelta. Tre delle quattro
> hanno più di 50 lavoratori e valgono 25 righe su 31; la quarta (KOSME SPA, 6
> righe) in anagrafica ne ha 11, e non sappiamo se sia un errore di registrazione
> o un'anagrafica parziale. Controprova: delle 128 righe a 4 ore solo 4 vengono da
> aziende sopra i 50.**

Correzione applicata a `durate-come-controllo.md`. **La responsabilità è nostra**:
una lettura scritta in un documento di analisi senza marcarla come lettura è una
misura in attesa di essere citata, e questa è stata citata.

---

## (c) I due titoli del datore: zero eventi erogati, dodici scadenze future

| titolo | in `ExportExcelCorsiFatti` (erogati) | in `ExportExcelCorsiScadenze` |
|---|---:|---:|
| `Aggiornamento Datore di Lavoro` | **0** | **10** |
| `Aggiornamento Datore di Lavoro con Modulo aggiuntivo «Cantieri»` | **0** | **2** |

**Nessun evento è mai stato erogato con quei due titoli.** Compaiono solo nello
scadenzario, come obblighi **futuri**, tutti fra gennaio 2030 e luglio 2031.

E hanno un'origine precisa: ogni scadenza è generata da un corso **iniziale**
effettivamente erogato, e i conti tornano uno a uno.

| titolo iniziale erogato | eventi | ore | quando |
|---|---:|---:|---|
| `Datore di Lavoro` | **10** | 16 | 1 nel 2025, 9 nel 2026 |
| `Datore di Lavoro con Modulo aggiuntivo «Cantieri»` | **2** | 22 | 2026 |

Dieci iniziali → dieci scadenze di aggiornamento; due → due. Le persone sono le
stesse (PRIMON ALESSANDRO compare due volte perché ha fatto entrambi i corsi).

### La risposta alla domanda di AppFormazione

**La correzione di quelle due righe è gratis sullo storico: non c'è nessun evento
da rimappare, perché non ce ne sono.** `promuovi.sql` al prossimo import non
troverebbe niente di già registrato sotto quei titoli.

Quello che la correzione tocca sono **dodici scadenze future e i dodici corsi
iniziali che le generano** — non storico da riscrivere, ma obblighi da calcolare
bene la prima volta. Il che, sul tema della decadenza a 120 mesi, è la posizione
migliore possibile: **non c'è niente da sistemare a ritroso, c'è da non sbagliare
in avanti.** E i dodici iniziali sono tutti del 2025–2026, cioè già sotto l'ASR
17/04/2025: nessuno di loro porta il problema del vecchio regime.

*Una cosa vista e non risolta, perché non è nostra:* lo scadenzario del gestionale
mette quegli aggiornamenti a **cinque anni** dall'iniziale (2026 → 2031). La
decadenza dell'art. 34 di cui parla AppFormazione è a **120 mesi**. Sono due
orologi diversi sullo stesso attestato, e qui ci limitiamo a segnalarlo.

---

## Come rileggerli sul database

I tre conteggi sono sui file d'origine. Il primo si rilegge anche in tabella:

```sql
-- (a) la dimensione come l'abbiamo importata
select count(*) filter (where numero_lavoratori is not null)        as valorizzati,
       count(*) filter (where numero_lavoratori > 50)               as oltre_50,
       count(*) filter (where numero_lavoratori between 1 and 14)   as sotto_15,
       count(*)                                                     as totale
from cliente;
-- atteso: 481 valorizzati (i 138 a zero l'import li lascia "non dichiarato"),
--         8 oltre i 50, 432 sotto i 15, 619 in tutto

-- (b) e (c) non si rileggono qui: formazione e' a zero righe.
```
