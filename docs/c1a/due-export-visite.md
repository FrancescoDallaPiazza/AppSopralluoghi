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

> **QUESTA SEZIONE E' STATA SMENTITA IN PARTE — leggere il punto 7.** La
> conclusione qui sotto («tutte e nove sono richiami anticipati del medico
> competente») regge per **due** casi su nove: gli altri sette sono aritmetica
> su una fotografia piu' vecchia, e si vedono solo aprendo lo storico delle
> visite, che quel giorno non sapevo di avere. Il conteggio resta giusto; la
> spiegazione no.

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

> **Rivisto al punto 7.** Il paragrafo qui sotto poggia sui nove richiami
> anticipati, che sono due. La scadenza **è derivabile nel 99,7%** dei casi; la
> colonna serve ancora, ma per due righe ambigue e per i casi in cui derivare e'
> **impossibile** (11 coppie senza esecuzione, 10 righe `PIANIFICATA`) — non per
> nove atti clinici.

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

## 7. Le nove non erano richiami anticipati: sette erano la fotografia vecchia

Rifatto l'11 settembre 2026, sera, contro `ExportExcel (6).xlsx` — l'export delle
visite **fatte**, che il punto 6 racconta come è saltato fuori. **Sola lettura.**

> **Il punto 3 di questo documento è sbagliato**, e va letto con questa sezione
> accanto. Avevo scritto: «tutte e nove sono richiami anticipati del medico
> competente, il caso clinicamente più importante che esista in sorveglianza
> sanitaria». **Sette non lo sono.**

### Il conto, rifatto con lo storico invece che con l'ultima esecuzione

Il foglio `Visite` portava **una sola** data per persona e tipo. Il `(6)` porta
tutte. Su 793 coppie dello scadenzario che hanno almeno un'esecuzione:

| | |
|---|---:|
| scadenza dichiarata = **ultima** esecuzione + periodicità | **784** |
| divergenti | **9** |

Le nove sono le stesse di prima. Ma con lo storico si vede **perché**: in sette
casi la dichiarata è esattamente **penultima + periodicità**, e l'esecuzione più
recente è **posteriore al 06/08/2026** — cioè alla data dei dati dello
scadenzario, che quella visita non poteva conoscere.

Rifatto il conto usando «l'ultima esecuzione **nota al 06/08/2026**»:

| | |
|---|---:|
| spiegate dalla fotografia vecchia | **7** |
| non spiegate | **2** |

| persona | società | storico | dichiarata |
|---|---|---|---|
| Narsello Michele | Rittal RCS | 21.11.2025 · **31.08.2026** | 21.11.2026 = 21.11.2025 + 12m |
| Tempesta Isabel | Rittal RCS | 11.11.2025 · **26.08.2026** | 11.11.2026 = +12m sulla prima |
| D'Alessandro Gianluca | Rittal RCS | 21.10.2025 · 12.05.2026 · **31.08.2026** | 12.05.2027 = +12m sulla seconda |
| Apanzaritei Ovidiu | FOOD & SWEET | 26.09.2023 · **25.08.2026** | 26.09.2024 = +12m sulla prima |
| Bassotto Simone | FOOD & SWEET | 26.10.2023 · **25.08.2026** | 26.10.2025 = +24m sulla prima |
| Bhouri Khalifa (annuale) | FOOD & SWEET | 03.06.2026 · **25.08.2026** | 03.06.2027 = +12m sulla prima |
| Bhouri Khalifa (trimestrale) | FOOD & SWEET | 03.06.2026 · **25.08.2026** | 03.09.2026 = +3m sulla prima |

In grassetto le esecuzioni che lo scadenzario non poteva vedere.

### E anche la direzione si spiega da sé

Avevo trovato molto convincente che **tutte e nove fossero più vicine e nessuna
più lontana**, e avevo scritto che «una differenza casuale andrebbe nei due
sensi». È vero, e infatti non era casuale — ma la causa non era clinica:

> una scadenza calcolata su un'esecuzione **più vecchia** cade **prima**. Non è
> una scelta del medico competente, è una sottrazione.

La direzione unanime, che sembrava la prova della tesi, era la firma di un'altra
causa. Un dato che va tutto nello stesso verso ha *una* spiegazione sistematica —
e la prima che viene in mente non è necessariamente quella giusta.

### Le due che restano, e restano ambigue

| persona | società | storico | dichiarata |
|---|---|---|---|
| MANARA DAVIDE | BP CHIMICA | 23.02.2022 · 25.07.2025 · 26.06.2026 | 25.07.2026 |
| PORRINI SERENA | Rittal RCS | 14.10.2025 · 27.07.2026 | 14.10.2026 |

In tutte e due la dichiarata è calcolata sulla **penultima** anche al netto del
taglio: l'esecuzione più recente era già avvenuta il 6 agosto, e la scadenza non
ne teneva conto. Due letture, e i dati non le separano:

- **ritardo di registrazione** — il `(6)` porta la data in cui la visita è stata
  *fatta*, non quella in cui è stata *inserita*; se l'inserimento è avvenuto dopo
  il 6 agosto, lo scadenzario è coerente;
- **richiamo anticipato vero** — quello che credevo fossero tutte e nove.

**Restano ambigue, e due è il numero giusto da portarsi dietro.**

### Lo stesso errore, due volte sullo stesso dato

Il punto 4 di questo documento racconta che avevo verificato la scadenza contro
la formula che la produce, e che «un risultato che non poteva non tornare non è
una verifica». La correzione era giusta e **non è bastata**: subito dopo ho
concluso sui nove **senza aprire lo storico**, che era l'altra rilevazione, a un
metro di distanza, e che quel giorno non sapevo di avere.

La prima volta la fonte indipendente c'era e non l'ho aperta. La seconda non
sapevo che esistesse — ma non l'ho nemmeno cercata, e la domanda «esiste un
export delle visite fatte?» costava dieci secondi di menu a qualcuno che poteva
guardarlo.

### Cosa cambia per lo schema

Il punto 5 diceva: «la scadenza **non può essere solo calcolata**, e le 9 volte
che non lo è sono le persone da rivedere prima». Va riscritto così:

- la scadenza **è derivabile** nel **99,7%** dei casi — 784 su 793 con l'ultima
  esecuzione, **791 su 793** usando l'ultima nota alla data del file;
- una colonna `scadenza_dichiarata` **serve ancora, ma per due righe**, non per
  nove, e come registrazione di un'ambiguità e non di un atto clinico;
- e serve **davvero** dove derivare è **impossibile**, non solo impreciso: le
  **11** coppie dello scadenzario senza nessuna esecuzione, e le **10** righe
  marcate `PIANIFICATA` — che sono lo stesso fenomeno visto dall'altra parte, e
  che il punto 8 racconta.

## 8. `PIANIFICATA` sono le persone senza storico

Dieci righe nel vecchio scadenzario, otto nel `(7)`, **tutte e dieci della stessa
società** (Rittal RCS). Nove con data **31.12.2025** — una data tonda di fine
anno, non il risultato di un calcolo — e una 08.04.2026.

**Nessuna delle dieci ha una sola esecuzione nel `(6)`.** Zero storico.

Quindi `PIANIFICATA` non marca un appuntamento fissato, e il `(7)` non è
un'agenda: marca **le righe che non derivano da un'esecuzione**. Sono le scadenze
delle persone mai visitate, con una data messa a mano o dedotta dall'assunzione.

È l'unico posto dello scadenzario dove una scadenza esiste **senza un fatto
dietro** — cioè il caso in cui una scadenza calcolata non è diversa: è
impossibile.

## 9. E il `(7)` è il vecchio scadenzario filtrato sullo scaduto

Non è un sottoinsieme arbitrario e non è un file nuovo: **stesse 35 colonne nello
stesso ordine**, Stato compreso. È lo stesso report a due date, con un filtro.

| | |
|---|---:|
| coppie rimaste nel `(7)` con data **passata** | **315 su 315** |
| coppie rimaste con data futura | **0** |
| coppie uscite con data **futura** | **477 su 489** |
| data massima nel vecchio · nel `(7)` | 13.07.2031 · 10.09.2026 |

Il `(7)` è «le scadenze già maturate e non ancora evase»; il vecchio è lo
scadenzario intero, futuro compreso. **Sono complementari nel tempo, non
alternativi** — e per riempire una scadenza dichiarata serve il vecchio, perché è
l'unico che copra anche ciò che deve ancora scadere.

*Il residuo che non si spiega:* delle 12 uscite con data passata, 2 hanno la
visita rifatta dopo la scadenza (giustamente uscite) e 2 sono `PIANIFICATA`
rimosse. **Le altre 8 non le spiega nessuna delle ipotesi guardate** — scadenza
passata, persona cessata, società fuori perimetro. Otto su 489, dichiarate non
spiegate invece di attribuite a una quarta ipotesi inventata per chiudere il
conto.
