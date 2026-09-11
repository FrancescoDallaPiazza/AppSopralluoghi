# I due export delle visite non sono ridondanti, e uno dei due mi smentisce

Riconciliazione dell'11 settembre 2026 fra il foglio `Visite` di
`ExportExcel (4).xlsx` e `ExportExcelVisiteScadenze.xlsx`. **Sola lettura.**

## 1. I nomi dei tipi: nessuna mappatura da fare

Tutti e nove gli accertamenti hanno **lo stesso testo, carattere per carattere**,
maiuscole comprese — `Visita Medica annuale`, `Visita medica quinquennale`,
`Esame Audiometrico`… I due export usano lo stesso vocabolario. **Per l'import
non serve una tabella di corrispondenza.**

## 2. Le coppie (codice fiscale, tipo)

| | |
|---|---:|
| in entrambi | **769** |
| solo nel foglio | **31** |
| solo nello scadenzario | **35** |

Nessun duplicato da nessuna delle due parti: **808 accertamenti − 8 senza codice
fiscale = 800 coppie** nel foglio; **812 righe − 8 senza = 804** nello
scadenzario. Nessuna riga si è persa in un accorpamento silenzioso — verificato
ricontando le coppie ripetute, che sono **zero da entrambe le parti**, perché una
chiave che collassa è il modo in cui si perde un dato senza accorgersene.

> **Ricontato l'11 settembre, sera — quattro numeri erano sbagliati e le coppie
> in entrambi sono 769, non 770.** Qui c'era scritto «808 − 7 = 801» e «814
> righe − 9 = 805». Due cause, tutte e due già viste oggi:
> le righe dello scadenzario sono **812** e non 814 — le altre due sono il piè
> di pagina dell'export, l'URL del gestionale e la data; e i codici fiscali non
> utilizzabili sono **8** per parte e non 7 e 9 — è lo stesso otto-contro-sei che
> avevo sbagliato stamattina sulla stessa colonna, e che da lì si è propagato qui.
> **I numeri che contano non cambiano: 31 e 35 reggono al ricalcolo**, ed è su
> quelli che il documento ragiona.

**Società:** una sola sta nel foglio e non nello scadenzario — `CRAZY STUDIO DI
BALTIERI PIERLUCA`, un accertamento (`Visita Medica annuale`, eseguita il
12.11.2025). Nello scadenzario non c'è **nessuna** società che il foglio non abbia:
le 62 sono un sottoinsieme stretto delle 63.

## 3. E qui la cosa che conta: le nove date che non tornano

Dove la stessa coppia sta in entrambi e ha entrambe le date:

| | |
|---|---:|
| scadenza del foglio **uguale** alla data dello scadenzario | **759** |
| **diverse** | **9** |
| una delle due manca | 1 |

759 + 9 + 1 = 769, e i conti chiudono: nessuna coppia in entrambi resta fuori
dal confronto. (Prima qui c'era 760, coerente con il 770 corretto sopra.)

Le nove non sono cicli precedenti: ho verificato se la data dello scadenzario
fosse la scadenza di un'esecuzione più vecchia, fino a otto cicli indietro.
**Nessuna lo è.**

E hanno una direzione: **tutte e nove sono più VICINE, nessuna è più lontana.**

| società | tipo | esecuzione | scadenza calcolata | scadenzario |
|---|---|---|---|---|
| RITTAL RCS | annuale | 31.08.2026 | 31.08.2027 | **21.11.2026** |
| RITTAL RCS | annuale | 27.07.2026 | 27.07.2027 | **14.10.2026** |
| RITTAL RCS | annuale | 26.08.2026 | 26.08.2027 | **11.11.2026** |
| RITTAL RCS | annuale | 31.08.2026 | 31.08.2027 | **12.05.2027** |
| FOOD & SWEET | annuale | 25.08.2026 | 25.08.2027 | **03.06.2027** |
| FOOD & SWEET | trimestrale | 25.08.2026 | 25.11.2026 | **03.09.2026** |
| FOOD & SWEET | annuale | 25.08.2026 | 25.08.2027 | 26.09.2024 |
| FOOD & SWEET | biennale | 25.08.2026 | 25.08.2028 | 26.10.2025 |
| BP CHIMICA | annuale | 26.06.2026 | 26.06.2027 | **25.07.2026** |

Nove su nove in anticipo, zero in ritardo. **Una differenza casuale andrebbe nei
due sensi.** Questa no, e ha un nome nel mestiere: il medico competente può fissare
un **richiamo anticipato** per una persona che va rivista prima della periodicità
ordinaria. È il caso clinicamente più importante che esista in sorveglianza
sanitaria — ed è esattamente quello che una scadenza calcolata cancella.

## 4. La verifica di ieri non era indipendente, ed era mia

Ieri ho scritto: «796 coppie su 796, zero deviazioni, **la scadenza si deriva**».
Il numero è giusto e la conclusione era troppo larga, **per un difetto del
ragionamento e non della misura**.

La colonna «Prossima Scadenza» del foglio è **calcolata dal gestionale** a partire
dall'esecuzione e dall'intervallo del tipo. Verificare che sia uguale a
esecuzione + intervallo **verifica una formula contro se stessa**: non poteva che
tornare, e un risultato che non poteva non tornare non è una verifica. Avevo
scritto che era «la terza fonte indipendente». Non lo era: era la stessa fonte
guardata due volte.

**Lo scadenzario è la prima fonte davvero esterna su quel campo, e in 9 casi su
769 dice una cosa diversa.**

Il modo per accorgersene c'era, ed è quello che ho usato per i ruoli: non
confrontare un dato con la regola che lo ha prodotto, ma con **un'altra
rilevazione**. Per i nove ruoli avevo la colonna 32; per l'RSPP il foglio degli
attestati; qui avevo lo scadenzario a un metro di distanza e non l'ho aperto,
perché la misura interna tornava.

## 5. Raccomandazione, con le confidenze separate

**I due export sono complementari, non ridondanti. L'import deve leggerli
entrambi.** Confidenza **alta**, e le tre ragioni sono indipendenti fra loro:

1. il foglio ha **una società e 31 coppie** che lo scadenzario non ha;
2. lo scadenzario ha **35 coppie** che il foglio non ha;
3. e soprattutto **contiene un'informazione che dal foglio non si può derivare**:
   i nove richiami anticipati.

**Quale sia la fonte primaria:** il **foglio**, confidenza **alta**. Porta
l'esecuzione, che è il fatto accaduto; lo scadenzario porta una conseguenza. E il
foglio copre il perimetro più largo.

**Cosa cambia nello schema della `0005`,** e qui la confidenza è **media** perché
è una decisione e non una misura: la scadenza **non può essere solo calcolata**.
La forma che regge i dati che ci sono è *derivata per default, sovrascrivibile
quando una fonte la dichiara* — una colonna `scadenza_dichiarata` nullable accanto
al calcolo, valorizzata solo dove lo scadenzario dissente. Su 769 casi sarebbe
nulla 759 volte, **e le 9 volte che non lo è sono le persone da rivedere prima.**
Derivare e basta le perde tutte e nove in silenzio.

Non decido io: la scheda 10 è vostra. Ma la misura di ieri, da sola, portava a una
scelta che questa misura non sostiene più.

## 6. Le due misure sono su due fotografie a cinque settimane di distanza

Aggiunto l'11 settembre 2026, sera. **Non è un errore di questa riconciliazione:
è una condizione che nessuno aveva guardato**, e che cambia come si legge il 31.

I due file non sono dello stesso momento, e la differenza non sta in quando sono
stati scaricati — sta nella riga in fondo, che dichiara **la data dei dati**:

| file | data dichiarata in fondo |
|---|---|
| foglio `Visite` di `ExportExcel (4).xlsx` | `Report aggiornato al` **09/09/2026** |
| `ExportExcelVisiteScadenze.xlsx` | `Dati aggiornati al` **06/08/2026 07:56** |

**Cinque settimane, e il foglio è il più fresco.** Che quella data sia dei dati e
non dell'estrazione è dimostrato: i quattro file dentro
`ExportExcelCorsiScadenze.zip` hanno timestamp interno **03/09/2026 13:11** e
dichiarano in fondo `06/08/2026` — un file non può essere stato prodotto prima di
esistere. Quindi per **quei tre file** riscaricare non avrebbe allineato niente:
avrebbe allineato l'estrazione, non i dati. *Che non valga per tutti i report e'
spiegato sotto — il controesempio e' arrivato lo stesso pomeriggio.*

### Quanto del 31 è tempo e non divergenza: dodici su trentuno

Misurato, invece di dichiarare genericamente un dubbio:

| delle 31 coppie «solo nel foglio» | |
|---|---:|
| con **esecuzione posteriore al 06/08/2026** — lo scadenzario non poteva saperle | **12** |
| con esecuzione precedente — **la data non le spiega** | **19** |

Le dodici hanno tre date sole — 07/08, 25/08, 26/08 — e due sole società:
**Rittal RCS** (6) e **FOOD & SWEET** (6). Sono due campagne di visite di fine
agosto, fatte dopo la fotografia dello scadenzario. Le stesse due società che
compaiono nelle nove date che non tornano del punto 3.

Le altre diciannove restano una divergenza vera, e la loro distribuzione lo
conferma: nove del 2019, una del 2020, una del 2021, una del 2025 e sette del
2026 anteriori ad agosto. Un'esecuzione del 2019 assente dallo scadenzario di
agosto 2026 non è un problema di fotografie.

### Riverificabile o no: dipende dal report, e l'avevo scritto troppo largo

> **Corretto due ore dopo averlo scritto, l'11 settembre sera.** Qui c'era:
> «rifare il confronto su due file della stessa data **non è possibile** […]
> nessuno può allinearli scaricandoli insieme». **Era troppo forte, e un
> controesempio è arrivato lo stesso giorno.**
>
> Alle 15:23 Francesco ha scaricato due export nuovi, e in fondo dichiarano
> `Dati aggiornati al` **11/09/2026 15:23** — cioè l'istante dello scaricamento.
> Per *quei* report la data dichiarata coincide con l'estrazione, e riscaricare
> allinea eccome.
>
> Lo zip resta valido come prova **per i tre file del 3 settembre** — prodotti il
> 03/09 e dichiarati 06/08, e un file non può nascere prima di esistere — ma non
> è una legge del gestionale: **dipende dal report**. Due ipotesi, e da qui non
> se ne può scegliere una: report diversi leggono sorgenti diverse (una viva, una
> un datamart fermo al 06/08), oppure quei tre venivano da un export schedulato
> in zip e questi sono a richiesta.

**E ciò che cade è la frase, non la colonna — anzi la rende più necessaria.** Se
la freschezza dipende dal *report* e non dal *momento*, non esiste nessuna regola
che permetta di dedurla: l'unico modo di saperla è **leggerla da ogni file e
conservarla**. Una regola che non esiste è il caso in cui un dato va letto sempre.

Per l'import la conseguenza è più larga del 31: **tre file letti insieme con tre
date diverse producono uno stato che non è mai esistito in nessun momento.**
L'import deve registrare la data dichiarata di ogni file da cui legge — la
fotografia accanto al dato che ne viene, come `ateco_origine` accanto a
`codice_ateco`. E il formato non è uno solo: `Dati aggiornati al 11/09/2026
15:23` ha l'ora, `Report aggiornato al 09/09/2026` no. Stesso gestionale, stesso
giorno, due forme.

### E il 31 è superato da un file che non sapevamo esistesse

Lo stesso pomeriggio è saltato fuori che l'export delle **visite fatte** esiste
(`ExportExcel (6).xlsx`, 1.383 visite dal 2016 al 2026). Rispetto al foglio è un
**superinsieme stretto**: 800 coppie in comune, **zero** solo nel foglio, **250**
solo nel nuovo — e 167 persone hanno più di una visita dello stesso tipo, fino a
otto annuali consecutive.

Quindi questa riconciliazione **resta valida su ciò che confrontava**, ma non è
più la base su cui si scrive l'import: il foglio `Visite` comprimeva la storia in
una sola «Ultima Esecuzione», e il file nuovo la porta per intero. Il 31 andrà
riguardato lì, con due file che si possono riscaricare lo stesso giorno — e per
questi due, adesso lo sappiamo, riscaricare serve.

E serve anche nel verso opposto, che è la metà più utile: due export scaricati a
un mese di distanza **possono portare la stessa data dichiarata**, e allora sono
lo stesso istante e si possono confrontare. Senza quella colonna, quell'informazione
si perde e qualcuno si astiene da un paragone che era legittimo.
