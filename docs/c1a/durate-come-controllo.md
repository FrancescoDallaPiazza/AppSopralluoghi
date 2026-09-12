# Le durate come controllo: cosa dice l'export sui 40 codici

Misura dell'11 settembre 2026. Terza gamba del riscontro sul catalogo: il sito
dice cosa l'accordo **prevede**, il catalogo cosa ci **aspettiamo**, l'export cosa
è **stato erogato**. **Sola lettura.**

> # ⚠ LA TERZA GAMBA NON REGGE COME FORMULATA — 12 settembre 2026
>
> **Il gestionale ha riscritto le ore dello storico.** Parole di Francesco,
> guardando le due aule del preposto del 2024: *«erano tutte formazioni da 8 ore
> per completo e 6 per agg. È scritto 12 perché il gestionale ha aggiornato
> d'imperio tutte le formazioni fatte con le nuove ore dell'ASR25»*.
>
> Quindi **la colonna ore dell'export non dice cosa è stato erogato**: per una
> parte delle righe dice cosa il catalogo assegna **oggi**, scritto all'indietro
> sullo storico. La premessa in testa a questo documento era un'assunzione che
> nessuno aveva dichiarato — né qui, né negli altri due repo.
>
> ## Cosa questo fa alle conclusioni qui sotto: le INVERTE
>
> Il metodo di questo documento è *confrontare le ore dell'export con quelle del
> catalogo*. Se una parte dello storico è stata riscritta **con le ore del
> catalogo**, allora:
>
> | esito | vale ancora? |
> |---|---|
> | **divergenza** (l'export dice un numero ≠ catalogo) | **SÌ.** Una riga che porta un valore del regime vecchio **non può** essere stata riscritta a quello nuovo: è genuina |
> | **conformità** (l'export dice = catalogo) | **NO.** È esattamente ciò che la riscrittura fabbrica, e dalle ore non si distingue da una conformità vera |
>
> **Quindi questo documento va letto al contrario di come è scritto:** le sue
> *anomalie* sono il risultato solido, le sue *conferme* non sono più prove.
>
> ## Le tre conseguenze che vanno nominate, non lasciate dedurre
>
> **1. La riga «100% conforme» della tabella finale è quella da non usare.** Ci
> stanno dentro `PONTEGGI`, `PREPOSTO` agg, `LAV_GEN`, gli antincendio, i primo
> soccorso e nove codici attrezzature. Nessuno di quei «conforme» è più una prova.
>
> **E una decisione ci poggia sopra, in un altro repo:** AppFormazione ha esteso
> `ponteggi_art136` avendo letto `PONTEGGI` in quella riga («verde, e l'estensione
> costa una riga»). Quel verde non è più un verde — non è diventato rosso, è
> diventato **muto**. Va rivisto da chi l'ha preso, e non da qui.
>
> **2. La mia lettura del `PREPOSTO` qui sotto è sbagliata.** Scrivevo *«le 8 ore
> sono il regime precedente all'ASR, le 12 quello nuovo: due regimi sotto un
> codice, separati nel tempo»*. Francesco dice che le 12 **erano 8**. Non erano due
> regimi: era un regime solo e una riscrittura. La riga della tabella finale «due
> regimi nel tempo» cade con lei.
>
> **3. Quello che sopravvive, e non per fortuna.** Le anomalie che portano valori
> che **il catalogo non ha** non possono venire da una riscrittura verso il
> catalogo: `DIRIGENTE` 16 contro 12, `RLS` agg 8 contro 4, `DL_RSPP_BASE` agg 10
> e 14 contro 6, le seconde durate delle attrezzature (`CARRELLO` 16,
> `ESCAVATORI` 16, `GRU TORRE` 14), `LAV_SPEC` iniziale. Restano genuine.
>
> E resta il **controllo negativo sull'RLS**, perché confrontava *proporzioni nel
> tempo* e non *valori* — un controllo costruito per non dipendere dal numero
> sopravvive a un numero riscritto.
>
> ## Cosa NON fare adesso
>
> **Non rifare misure sulle ore dell'export** finché non si sa quali righe sono
> state toccate. Non è una lettura da rifare meglio: è una **domanda al
> gestionale** — quando è stato fatto quell'aggiornamento, su quali corsi, se resta
> traccia del valore precedente. Va nella stessa lista della colonna `Data`, e
> **prima** di quella: la `Data` rende incerta una finestra, le ore rendono incerta
> **ogni misura di durata fatta finora**.
>
> *Perché questa è peggio della colonna `Data`: di quella era scritto da giorni che
> non si sapeva cosa contenesse. Delle ore nessuno aveva mai scritto che fosse
> un'assunzione — e un'assunzione non dichiarata è indistinguibile da un fatto
> misurato, per chiunque la legga dopo.*

## Metodo, e il suo limite dichiarato

13.348 righe di `ExportExcelCorsiFatti.xlsx`, agganciate ai 40 codici tramite il
dizionario `corso_alias`, poi raggruppate per *(codice, iniziale/aggiornamento)* e
confrontate con `ore` o `ore_aggiornamento` del catalogo.

- gli **aggiornamenti** sono distinti dagli iniziali con `is_aggiornamento`, non
  dal titolo, come richiesto;
- i **7 parziali** sono esclusi: hanno meno ore per definizione e non sono
  divergenze;
- **461 righe** hanno un alias senza codice (i 31 alias non mappati) e restano
  fuori;
- **0 titoli dell'export sono fuori dal dizionario.** Il dizionario copre l'export
  per intero — ed è un risultato che vale la pena dire.

**Il limite è stato tolto l'11 settembre, sera.** Qui c'era scritto che il
dizionario era *simulato dai file del repo* e non letto dal database, con la
riserva A10 «i file dicono». La riserva **non serve più**, e la catena si chiude
in due passaggi verificati:

1. **la mia simulazione = il seed di AppOverall.** Confronto riga per riga fra
   `ripristina_alias_gestionale.sql` + `mappatura_alias_gestionale.sql` (questo
   repo) e `supabase/seed/corso_alias.sql` (AppOverall): **268 righe da entrambe
   le parti, 0 solo di qua, 0 solo di là, 0 diverse**, e somma delle impronte
   identica (`579750125159`);
2. **il seed = il database vivo.** Verificato da AppOverall (`f94ff83`) su undici
   valori indipendenti — 268 righe, somma impronte, 31 ignorati, 98 aggiornamenti,
   7 parziali, 2 pregresse, 1 evidenza incompleta, 1 con note, 39 codici distinti,
   e le due somme delle lunghezze.

Quindi il dizionario usato qui **è** quello in produzione. L'analisi che segue è
verificata, non simulata.

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
