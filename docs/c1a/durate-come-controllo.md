# Le durate come controllo: cosa dice l'export sui 40 codici

Misura dell'11 settembre 2026. Terza gamba del riscontro sul catalogo: il sito
dice cosa l'accordo **prevede**, il catalogo cosa ci **aspettiamo**, l'export cosa
è **stato erogato**. **Sola lettura.**

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

**Il limite, dichiarato perché A10 lo impone.** Il dizionario qui è **simulato dai
file del repo** (`ripristina_alias_gestionale.sql` + `mappatura_alias_gestionale.sql`),
non letto dal database: l'editor SQL ha smesso di accettare input a metà lavoro.
La simulazione riproduce **tre aggregati indipendenti** che AppOverall ha letto dal
database — **237 mappati, 98 aggiornamenti, 7 parziali** — e su quei tre coincide.
Non è una verifica riga per riga.

## Le quattro righe segnalate: tutte e quattro hanno risposta

### 1. RLS — il catalogo è sotto-specificato, confermato

| | attesa | reale |
|---|---:|---|
| iniziale | 32 | **32h × 59** — perfetto |
| aggiornamento | 4 | **4h × 128, 8h × 31** |

**I due valori del sito ci sono entrambi, mescolati sotto un codice solo.** Il
catalogo ha `ore_aggiornamento = 4` e non può esprimere una durata che dipende
dalla dimensione dell'azienda: le 31 righe a 8 ore **non sono un errore del
gestionale**, sono le aziende oltre i 50 lavoratori. Oggi risulterebbero
divergenti, e domani — quando il motore calcolerà l'aggiornamento RLS — sarebbero
valutate contro 4 ore invece che 8.

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
