# Sorveglianza sanitaria: le scadenze si derivano, non si memorizzano

Misura del 10 settembre 2026 sul foglio `Visite` di `ExportExcel (4).xlsx`.
Serve a decidere una cosa sola dello schema della scheda 10, e la decide.
**Sola lettura, nessun dato personale.**

## Prima: una correzione al numero che avevo dato

Avevo detto **818 accertamenti**. Sono **808**, e mancava un fatto:
il foglio ha **due righe di intestazione**, non una.

| riga | contenuto |
|---:|---|
| 0 | il nome dell'accertamento — `Visita Medica annuale` |
| **1** | **`Ultima Esecuzione`** e **`Prossima Scadenza (1 anno)`** |
| 2+ | i dati |

Avevo letto i dati dalla riga 1, quindi **ogni conteggio era gonfiato di
esattamente uno** — dieci colonne, dieci di troppo. Me ne sono accorto da un
indizio che sembrava rumore: «esattamente una cella non numerica per colonna» è
troppo regolare per essere un caso.

E la riga 1 non era solo rumore da scartare: **dichiara la periodicità**, ed è
una seconda fonte indipendente dal titolo della colonna.

## I dieci accertamenti

| idx | accertamento | scad. | sotto-intestazione | righe | mediana/min/max (giorni) |
|---:|---|---:|---|---:|---|
| 38 | `Esame Audiometrico` | 39 | Prossima Scadenza (1 anno) | 2 | 365 / 365 / 365 |
| 40 | `Esame Elettrocardiografico` | 41 | Prossima Scadenza (2 anni) | 1 | 730 / 730 / 730 |
| 42 | `Esame Spirometrico` | 43 | Prossima Scadenza (1 anno) | 1 | 365 / 365 / 365 |
| 44 | `Visita Medica Biennale` | 45 | Prossima Scadenza (2 anni) | **106** | 731 / 730 / 731 |
| 46 | `Visita Medica annuale` | 47 | Prossima Scadenza (1 anno) | **670** | 365 / 365 / 366 |
| 48 | `Visita Oculistica biennale` | 49 | Prossima Scadenza (2 anni) | 1 | 731 / 731 / 731 |
| 50 | `Visita Trimestrale` | 51 | Prossima Scadenza (3 mesi) | 2 | 92 / 92 / 92 |
| 52 | `Visita medica quadriennale` | 53 | Prossima Scadenza (4 anni) | 2 | 1461 / 1461 / 1461 |
| 54 | `Visita medica quinquennale` | 55 | Prossima Scadenza (5 anni) | **23** | 1826 / 1826 / 1827 |
| 56 | `Visita oculistica quinquennale` | 57 | Prossima Scadenza (5 anni) | **0** | — |

**`Visita oculistica quinquennale` non ha nessun dato.** La colonna esiste, la
sotto-intestazione esiste, le righe sono zero. Gli accertamenti con dati sono
**nove**, non dieci — e quello che avevo contato come «1» era la riga di
intestazione.

I tre `Esame …` sono i più interessanti dei nove: **il loro titolo non dichiara
nessuna periodicità**, ma la sotto-intestazione sì, e le date la confermano. Senza
la riga 1 sarebbero stati tre accertamenti «senza regola nota».

## La riga che decide lo schema

| | |
|---|---:|
| accertamenti totali | **808** |
| righe con la data e **senza** la scadenza | **12** |
| righe con la scadenza e **senza** la data | **0** |

Le 12 sono 10 nella `Visita Medica Biennale`, 1 nell'annuale, 1 nella
quinquennale.

E poi la verifica che chiude la questione — **la scadenza è sempre esattamente
la data più l'intervallo dichiarato?**

| | |
|---|---:|
| scadenze che coincidono **esattamente** con `data + intervallo` | **796** |
| scadenze che **deviano**, anche di un giorno | **0** |

Zero su 796. Le variazioni che si vedono nella tabella sopra — 365 contro 366,
730 contro 731, 1826 contro 1827 — **non sono deviazioni**: sono gli anni
bisestili. Calcolando sul calendario invece che in giorni, tutte e 796 tornano.

## La risposta: derivare

**La scadenza si deriva, non si memorizza.** Non è mai stata scritta a mano:
nessuna riga la corregge, e nessuna riga la porta senza avere la data — il che
esclude anche il caso «scadenza imposta dal medico su una visita non registrata».

Le 12 righe senza scadenza non sono un controesempio: **non contengono
un'informazione diversa, contengono un'informazione in meno.** Derivandola si
ottiene esattamente ciò che il gestionale avrebbe scritto, e quelle 12 smettono
di essere un buco.

Quel che **va** memorizzato è l'**intervallo per tipo di accertamento** — 1 anno,
2 anni, 3 mesi, 4 anni, 5 anni — perché quello è un dato di regola, non di fatto,
e nel file sta in un posto fragile: fra parentesi in una sotto-intestazione.

## A9: qui il riscontro esterno c'è, e sono tre fonti

Diversamente da `Fattori di Rischio`, la periodicità qui **non** è stata dedotta
dal titolo. Tre fonti indipendenti concordano su tutti e nove gli accertamenti
con dati:

1. il **titolo** della colonna, dove c'è (`annuale`, `Biennale`, `quinquennale`…);
2. la **sotto-intestazione**, che la dichiara per tutti e dieci, compresi i tre
   `Esame …` che nel titolo non ce l'hanno;
3. le **date vere**, 796 coppie, zero deviazioni.

Dove il titolo taceva hanno parlato le altre due. Se avessi letto solo i titoli —
che è ciò che stavo per fare — tre accertamenti su nove sarebbero entrati nello
schema senza periodicità.
