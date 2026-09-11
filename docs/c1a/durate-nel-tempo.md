# Le durate cambiano nel tempo? Le date rispondono, e non allo stesso modo

Misura dell'11 settembre 2026, sulle date di `ExportExcelCorsiFatti.xlsx`.
Spartiacque: **17 aprile 2025**, l'ASR. **Sola lettura, niente corretto.**

## Prima: avevo classificato male il `DIRIGENTE`, e la prova era già in mano mia

Avevo messo `DIRIGENTE` fra le «attese sbagliate». **Sbagliato.** La nota della sua
riga nel catalogo dice, testuale:

> «ASR 17/04/2025: 12h **(erano 16h con accordo 2011)**. Aggiornamento 6h ogni 5
> anni.»

Quella nota stava dentro il file che avevo parsato io, nel campo che avevo letto
io. Ho confrontato il numero e non ho letto la riga accanto. È la forma esatta del
difetto che questo repo insegue da due giorni — guardare il dato e non il suo
contesto — applicata da chi lo stava cercando negli altri.

## Il test, e una controprova per sapere se il test funziona

Per ogni gruppo *(codice, ore)* la distribuzione delle date rispetto al 17 aprile
2025. Ho aggiunto **`RLS` come controprova**: lì sappiamo già che la differenza 4/8
dipende dalla **dimensione dell'azienda** e non dal tempo, quindi il test **deve**
rispondere «nessuna separazione». Se rispondesse altro, sarebbe il test a essere
rotto.

## 1. `DIRIGENTE` — taglio netto, il catalogo ha ragione

| ore | righe | prima del 17.04.2025 | dopo | più vecchia | più recente |
|---:|---:|---:|---:|---|---|
| 16 | **12** | **12** | **0** | 2015-01-28 | **2025-02-05** |

**Dodici su dodici prima, zero dopo**, e la più recente cade sei settimane prima
dell'Accordo. Non è una miscela: è un regime chiuso. La divergenza sparisce, e
`DIRIGENTE` esce dalle «attese sbagliate».

## 2. `PREPOSTO` — il taglio NON c'è

| ore | righe | prima | dopo | più vecchia | più recente |
|---:|---:|---:|---:|---|---|
| 8 | 276 | 248 | **28** | 2011-03-15 | **2026-05-19** |
| 12 | 38 | **30** | 8 | **2024-05-20** | 2026-07-23 |
| 3 | 32 | 24 | 8 | 2021-03-24 | 2026-05-12 |

**La data non separa i due gruppi.** 28 corsi da 8 ore sono stati erogati **dopo**
l'ASR — l'ultimo a maggio 2026, tredici mesi dopo — e 30 corsi da 12 ore **prima**.
Le due popolazioni si sovrappongono in entrambi i versi.

La lettura «prima era 8, adesso è 12» **non regge sui dati**. Restano almeno due
spiegazioni che da qui non distinguo: una finestra transitoria dell'Accordo che
lascia concludere i percorsi già avviati, oppure corsi da 12 ore erogati
volontariamente già prima. Non scelgo: **serve chi conosce l'erogazione.**

## 3. `DL_RSPP_BASE` — separazione reale ma parziale

| ore | righe | prima | dopo | più recente |
|---:|---:|---:|---:|---|
| 6 | 76 | 73 | 3 | 2026-04-08 |
| 10 | 23 | **23** | **0** | 2024-11-06 |
| 14 | 36 | 34 | 2 | 2026-01-19 |
| **8** | 26 | **6** | **20** | 2026-07-21 |

Le tre durate per rischio (6/10/14) sono **quasi tutte prima**; l'8 generico è
**quasi tutto dopo**, 20 su 26. È coerente con un aggiornamento unificato che
sostituisce quello differenziato per rischio — ma **6 righe da 8 ore sono del
2016-2024**, quindi il taglio non è pulito come sul dirigente.

## 4. `RLS` — la controprova, e il test la supera

| ore | righe | prima | dopo |
|---:|---:|---:|---:|
| 4 | 128 | 105 | 23 |
| 8 | 31 | 25 | 6 |

**Entrambe le durate attraversano lo spartiacque**, in proporzioni quasi identiche
(82% e 81% prima). Il test risponde «nessuna separazione temporale» esattamente
dove sappiamo che la causa è la dimensione dell'azienda. **Il test discrimina**, e
questo rende affidabili i tre risultati sopra.

## Cosa se ne ricava per la domanda grossa

La domanda era: *il catalogo deve sapere che una durata è cambiata nel tempo?* La
risposta che i dati sostengono è **sì, ma non basta**:

- per `DIRIGENTE` un campo «valida fino al / dalla» risolverebbe il caso per
  intero, e in modo verificabile;
- per `DL_RSPP_BASE` risolverebbe la maggior parte, lasciando 6 righe fuori;
- per `PREPOSTO` **non risolverebbe niente**, perché i due gruppi si sovrappongono
  nel tempo in entrambi i versi;
- e per `RLS` sarebbe **la modellazione sbagliata**: lì la seconda durata non è un
  regime passato, è una dimensione d'azienda che convive con la prima **oggi**.

Cioè le durate multiple hanno **almeno tre cause diverse** — il tempo, la
dimensione dell'azienda, e il contenuto del corso (i combinati del carrello e
degli escavatori) — e un solo meccanismo non le copre. Una data di validità
applicata a `RLS` produrrebbe il difetto che il tempo non c'entra.

**Non decido io.** Se nasce una scheda, la regola da citare — «un attestato si
giudica con la norma del suo tempo» — vale per il primo caso e non per gli altri
due, e vale la pena che la scheda dica anche **quali casi non risolve**.
