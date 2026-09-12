# Le durate come controllo: cosa dice l'export sui 40 codici

Misura dell'11 settembre 2026. ~~Terza gamba del riscontro sul catalogo: il sito
dice cosa l'accordo **prevede**, il catalogo cosa ci **aspettiamo**, l'export cosa
è **stato erogato**.~~ **Sola lettura.**

**Quella riga è falsa, e il blocco qui sotto dice perché.** Questo documento
confronta **il catalogo del gestionale con il nostro**: l'export non dice cosa è
stato erogato, dice sotto quale **voce** una riga è stata registrata.

> # ⚠ LA TERZA GAMBA NON ESISTE — 12 settembre 2026
>
> *Questo blocco sostituisce una prima avvertenza scritta un'ora prima, che diceva
> «la terza gamba non regge come formulata» e attribuiva la cosa a una riscrittura
> del gestionale. Era **troppo generosa**: la riscrittura non ha distrutto una
> prova, ha fatto vedere che **non c'era**.*
>
> ## Il fatto
>
> **La colonna `ore` dell'export riproduce la durata della voce di catalogo sotto
> cui la riga è registrata.** Non misura le ore erogate. Dentro un titolo la
> varianza è **zero**.
>
> Segnalato da AppFormazione via AppOverall, e **verificato qui** su `righe.json`
> (le 268 voci del gestionale, che questo repo ha). Le sette voci del preposto:
>
>     r210  8   FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI
>     r211 12   FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI - BIENNALE
>     r212  8   FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI_BIENNALE
>     r151 12   CORSO DI FORMAZIONE PER PREPOSTI
>     r143  6   CORSO DI AGGIORNAMENTO PER PREPOSTI
>     r91   6   AGGIORNAMENTO LAVORATORI PREPOSTI
>     r220  3   INTEGRAZIONE FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI
>
> ## La controprova, su un codice che nessuno aveva citato
>
> Il preposto lo avevano già guardato loro. Ho rifatto la verifica su
> **`DL_RSPP_BASE`**, dove questo documento riporta la distribuzione più ricca —
> e ogni valore corrisponde a **un titolo distinto del catalogo del gestionale**:
>
> | «reale» qui sotto | titolo di catalogo | durata |
> |---|---|---:|
> | agg **6** × 76 | `AGGIORNAMENTO R.S.P.P. DATORE DI LAVORO RISCHIO BASSO` | 6 |
> | agg **10** × 23 | `… RISCHIO MEDIO` | 10 |
> | agg **14** × 36 | `… RISCHIO ALTO` | 14 |
> | agg **8** × 26 | `AGGIORNAMENTO DATORE DI LAVORO CHE SVOLGE I COMPITI DI RSPP` | 8 |
> | iniz **16** × 103 | `R.S.P.P. DATORE DI LAVORO RISCHIO BASSO` | 16 |
> | iniz **32** × 23 | `… RISCHIO MEDIO` | 32 |
> | iniz **48** × 33 | `… RISCHIO ALTO` | 48 |
> | iniz **8** × 4 | `CORSO PER DATORE DI LAVORO … MODULO C` | 8 |
> | iniz **24** × 3 | `INTEGRAZIONE … MODULO 3 E 4 - RISCHIO ALTO` | 24 |
>
> **Nove su nove, zero non spiegati.** Non era una distribuzione di ore erogate:
> era una distribuzione di **titoli**.
>
> ## Cosa questo documento misura davvero
>
> **Catalogo contro catalogo**: le 268 voci del gestionale contro i nostri 40
> codici. Le 13.348 righe non danno 13.348 osservazioni — ne danno **al massimo
> 268**, replicate.
>
> | esito | cosa vale |
> |---|---|
> | **conformità** (export = catalogo) | **niente.** Non è fragile: è **vuota**. Le due curatele hanno lo stesso numero, e questo lo dice due volte |
> | **divergenza** (export ≠ catalogo) | **vale**, ma dice un'altra cosa da quella che credevo: non «qualcuno ha erogato una durata diversa», ma **«i due cataloghi non concordano su quel corso»** |
>
> È l'uso che di fatto ne è stato fatto bene: il carrello combinato a 16 ore è
> **una voce che il gestionale ha e noi no**. Non era un'osservazione sull'erogato.
>
> ## Le tre conseguenze
>
> **1. La riga «100% conforme» della tabella finale non dice niente.** Ci stanno
> `PONTEGGI`, `PREPOSTO` agg, `LAV_GEN`, antincendio, primo soccorso e nove codici
> attrezzature.
>
> **Ma i ponteggi restano in piedi su una gamba nuova**, e non passa da qui: le
> voci del gestionale che li nominano sono **tre e senza varianti** — 28 ore
> (`r5`, `r228`), 4 di aggiornamento (`r41`), tutte a 4 anni — quindi tre curatele
> indipendenti danno 28 e 4. E l'Allegato XXI non è toccato dall'ASR 2025: non
> c'era nessuna ora nuova con cui riscriverli. *Verificato anche questo su
> `righe.json`.*
>
> **2. La mia lettura del `PREPOSTO` è falsificata.** Scrivevo «le 8 ore sono il
> regime precedente all'ASR, le 12 quello nuovo: due regimi separati nel tempo».
> Sono **due voci di catalogo diverse**, e Francesco conferma che quelle aule erano
> da 8. Cade con lei la riga «due regimi nel tempo» della tabella finale.
>
> **3. `DL_RSPP_BASE` e `RLS` «catalogo sotto-specificato» restano veri**, con il
> significato corretto: il gestionale ha più titoli dove noi abbiamo un codice
> solo. Era già ciò che il testo diceva — ma lo diceva per la ragione sbagliata.
>
> ## Il confine dell'evidenza, scritto una volta per tutte
>
> **Nessuna fonte nei tre repo può dire se un corso da 28 ore sia stato erogato in
> 28 ore.** L'export dice **sotto quale voce** è stato registrato; solo l'attestato
> dice cosa è stato fatto. Se un giorno serve saperlo, la strada non è una query —
> è un **campione di attestati**.
>
> *Questo non è un errore di misura: i numeri qui sotto sono giusti e verificati in
> tre posti. È un errore su **cosa quei numeri misurino**, su una colonna che
> nessuno aveva pensato di sospettare — e un'assunzione non dichiarata è
> indistinguibile da un fatto misurato, per chiunque la legga dopo.*

## Le quattro righe segnalate: tutte e quattro hanno risposta

### 1. RLS — il catalogo è sotto-specificato, confermato

| | attesa | reale |
|---|---:|---|
| iniziale | 32 | **32h × 59** — perfetto |
| aggiornamento | 4 | **4h × 128, 8h × 31** |

**I due valori del sito ci sono entrambi, mescolati sotto un codice solo.** Il
catalogo ha `ore_aggiornamento = 4` e non può esprimere una durata che dipende
dalla dimensione dell'azienda. Oggi le 31 righe a 8 ore risulterebbero divergenti,
e domani — quando il motore calcolerà l'aggiornamento RLS — sarebbero valutate
contro 4 ore invece che 8.

> **Corretto l'11 settembre 2026, sera.** Qui c'era scritto che le 31 righe a 8 ore
> «non sono un errore del gestionale, sono le aziende oltre i 50 lavoratori».
> La prima metà è vera e verificabile — il gestionale ha **due titoli distinti**,
> `Aggiornamento R.L.S. 4 ore` e `Aggiornamento R.L.S. 8 ore`, quindi chi ha
> registrato ha scelto. **La seconda metà era una lettura, non una misura**, ed è
> stata citata altrove come se fosse un conteggio. Misurata la sera dell'11 settembre
> ([`dimensione-e-le-31-righe.md`](dimensione-e-le-31-righe.md)): le 31 righe
> vengono da **quattro aziende**, tre delle quali sopra i 50 — **25 righe su 31**.
> Le altre 6 sono di KOSME SPA, che in anagrafica ne ha 11. Il controllo regge
> nell'altro verso: delle 128 righe a 4 ore, solo 4 vengono da aziende sopra i 50.

### 2. Primo soccorso — nessun difetto, e la periodicità è giusta

| | attesa | reale | `agg_mesi` |
|---|---:|---|---:|
| `PS_GRA` iniziale | 16 | 16h × 269 | — |
| `PS_GRA` aggiornamento | 6 | 6h × 290 | **36** |
| `PS_GRBC` iniziale | 12 | 12h × 390 | — |
| `PS_GRBC` aggiornamento | 4 | 4h × 525 | **36** |

**Quattro righe su quattro al 100%**, e `aggiornamento_mesi` è **36** per entrambi.
Il timore era fondato in astratto e infondato nei fatti: la triennalità c'è.

### 3. Antincendio — pulito, e conferma la scheda 11

`AI_LIV1` 4h × 105 e 2h × 80; `AI_LIV2` 8h × 630 e 5h × 508; `AI_LIV3` 16h × 12 e
8h × 6. **Sei righe su sei al 100%**, con `agg_mesi = 60`. Combacia col DM
02/09/2021 punti 3.2.5 e 3.2.6 letti ieri.

### 4. Carrello — il corso combinato esiste, e il catalogo non ha il codice

| | attesa | reale |
|---|---:|---|
| `ATTR_CARRELLO` iniziale | 12 | **12h × 298, 16h × 30**, 4h × 3 |

**Le 30 righe a 16 ore sono il corso combinato** semoventi + braccio telescopico,
esattamente come dice il sito. Non è un errore: è un codice che manca. Stessa
forma su `ATTR_ESCAVATORI` (16h × 32 contro 10h × 13 — il combinato con pale e
terne, che la nota del catalogo già cita) e su `ATTR_GRU_TORRE` (14h × 22 contro
12h × 12).

## E tre cose più grosse, che non erano nella lista

### `DL_RSPP_BASE` raccoglie quattro regimi diversi — su un codice deprecato

| | attesa | reale |
|---|---:|---|
| aggiornamento | 6 | **6h × 76, 14h × 36, 8h × 26, 10h × 23** |
| iniziale | 16 | **16h × 103, 48h × 33, 32h × 23**, 8h × 4, 24h × 3 |

Gli aggiornamenti dell'art. 34 seguono il rischio — 6 basso, 10 medio, 14 alto —
e finiscono tutti su un codice che ne aspetta 6. È lo stesso difetto dell'RLS,
moltiplicato per quattro. **E quel codice è `attivo = false`**: 161 aggiornamenti e
166 iniziali mappano su un corso deprecato dalla `049`.

### `DIRIGENTE` — zero righe su dodici corrispondono

Attesa **12 ore**, reale **16h × 12**. Nessuna eccezione, nessuna dispersione:
tutte e dodici a 16. Non è rumore — o il catalogo ha il numero sbagliato, o il
codice raccoglie un corso diverso da quello che il nome dice.

### `PREPOSTO` — due regimi sotto un codice, separati nel tempo

Attesa 12, reale **8h × 276, 12h × 38**, 3h × 32. Le 8 ore sono il regime
precedente all'ASR 17/04/2025, le 12 quello nuovo. Il codice li tiene insieme, e
il confronto con una sola attesa non può che fallire su uno dei due.

## Il quadro, in una tabella

| esito | codici |
|---|---|
| **100% conforme** | antincendio (6 righe), primo soccorso (4), `LAV_GEN`, `LAV_SPEC` agg, `PREPOSTO` agg, `PONTEGGI`, `RSPP_MOD_A/B agg/C`, `PS_GRA/GRBC`, e 9 codici attrezzature |
| **una seconda durata legittima** (codice mancante, non errore) | `ATTR_CARRELLO`, `ATTR_ESCAVATORI`, `ATTR_GRU_TORRE`, `ATTR_CARROPONTE`, `ATTR_LAV_ELETTRICI`, `ATTR_PLE` |
| **catalogo sotto-specificato** (la durata dipende da un fattore che il codice non porta) | `RLS`, `DL_RSPP_BASE` |
| **attesa probabilmente sbagliata** | `DIRIGENTE` (0/12), `PS_BLSD_SANITARIO` (0/20) |
| **due regimi nel tempo** | `PREPOSTO`, e in parte `DL_RSPP_BASE` |
| **attesa assente per costruzione** | `LAV_SPEC` iniziale (ore dal rischio: 4/8/12 × 3.195 righe, più 39 a 16h non spiegate), `RSPP_MOD_B_SETTORE` |

**Non ho corretto niente:** il catalogo è di AppOverall e queste sono
distribuzioni, non verdetti. La distinzione che conta, e che il conteggio secco
avrebbe nascosto, è fra *una seconda durata legittima* e *un'attesa sbagliata* —
la prima chiede un codice in più, la seconda chiede di cambiare un numero.
