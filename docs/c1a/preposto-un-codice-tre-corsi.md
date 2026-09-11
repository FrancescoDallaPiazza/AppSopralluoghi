# `PREPOSTO`: non due regimi nel tempo, tre corsi diversi sotto un codice

Esempi chiesti da AppOverall dopo che Francesco ha domandato «sei sicuro? fammi
esempi». **La risposta è no**, e i titoli lo dicono in modo netto.
Anonimo: nessun nome, nessun codice fiscale, solo date e titoli verbatim.

## La domanda che veniva prima di tutte: cos'è quella data

**Una sola colonna, e si chiama `Data`.** Le altre tre che contengono «data» sono
`Data di nascita`, `Data di Assunzione`, `Data di Licenziamento`: nessuna riguarda
il corso. **L'export non dichiara cosa contenga** — se sia la data dell'aula, del
rilascio dell'attestato o della registrazione — e non c'è una seconda data con cui
incrociarla.

Il nostro `formazioneImport.ts:230` la mappa su `data_completamento`, cioè
**assume** che sia la data del corso. È un'assunzione nostra, non un fatto
dichiarato dalla fonte, e resta non verificabile da qui.

**Ma per questa domanda non serve risolverla**, perché la separazione che conta
non è nelle date: è nei titoli.

## Le 30 righe da 12 ore prima dell'ASR: un titolo solo

Tutte e trenta, senza eccezioni:

> **`FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI - BIENNALE`**
> `is_aggiornamento = false`
> date: **5 il 20.05.2024, 25 il 05.09.2024**

**Due sole date.** Non è una popolazione diffusa nel tempo: sono **due aule**.

## Le 28 righe da 8 ore dopo l'ASR: un altro titolo

27 su 28:

> **`FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI`** — senza suffisso
> `is_aggiornamento = false`
> date sparse: 18.04.2025, 27.05, 09.06, 15.09, 18.10, 07.11, 28.11, 06.12,
> 18.03.2026, 30.04, 12.05, 15.05, **19.05.2026**

La 28ª è `FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI_BIENNALE` (con
**underscore**), 10.06.2025.

## Il quadro intero: sette titoli sotto un codice

| n | ore | agg | titolo verbatim | dalle date |
|---:|---:|:-:|---|---|
| 274 | 8 | no | `FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI` | **2011-03-15 → 2026-05-19** |
| 138 | 6 | sì | `AGGIORNAMENTO LAVORATORI PREPOSTI` | 2011 → 2026 |
| 84 | 6 | sì | `CORSO DI AGGIORNAMENTO PER PREPOSTI` | 2023 → 2026 |
| 32 | 3 | no | `INTEGRAZIONE FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI` | 2021 → 2026 |
| 31 | 12 | no | `FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI **- BIENNALE**` | 2024-05 → 2025-12 |
| 7 | 12 | no | **`CORSO DI FORMAZIONE PER PREPOSTI`** | **2026-02-19 → 2026-07-23** |
| 2 | 8 | no | `FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI**_BIENNALE**` | 2025-03 → 2025-06 |

## Cosa dicono questi dati, e cosa no

**«Prima erano 8 ore, adesso 12» è falso, e il dato che lo uccide è uno solo:** il
corso da 8 ore senza suffisso va dal **marzo 2011 al maggio 2026**, ininterrotto.
Non si è fermato all'Accordo, e tredici mesi dopo veniva ancora erogato. Nessuna
finestra transitoria copre tredici mesi di erogazione continua.

**Nemmeno le 12 ore sono «il regime nuovo arrivato in anticipo»:** il `- BIENNALE`
comincia a maggio 2024 e finisce a dicembre 2025, cioè scavalca l'Accordo in
entrambi i versi. È un prodotto suo.

**Quello che somiglia al regime nuovo è un titolo diverso ancora:**
`CORSO DI FORMAZIONE PER PREPOSTI`, 12 ore, e tutte e sette le righe sono **dal 19
febbraio 2026** — dieci mesi dopo l'ASR. Confidenza **media**: la forma è quella
giusta, ma sette righe sono poche e nessuna fonte nei repo lo dichiara.

**Quindi `PREPOSTO` è la quarta causa, non la prima:** un codice che raccoglie
**tre corsi iniziali distinti** (8h, 12h «- BIENNALE», 12h «CORSO DI FORMAZIONE»),
due titoli di aggiornamento e una integrazione. Non due regimi separati nel tempo.
Per la scheda 12 non è un aggiustamento: è un caso che la scheda non ha.

## E una trappola nella trappola

`... PREPOSTI **- BIENNALE**` (trattino) vale **12 ore**.
`... PREPOSTI**_BIENNALE**` (underscore) vale **8 ore**.

Stesse parole, punteggiatura diversa, durata diversa. **Il titolo non è una chiave
perfetta**: il dizionario alias li tiene separati perché sono due testi distinti,
ma chi li leggesse «a occhio» li unirebbe. È lo stesso rischio del `RSPP` che non
è RSPP — un'etichetta che sembra dire e non dice.

## Cosa non decido

Se le 31 righe «- BIENNALE» siano in realtà **aggiornamenti** marcati come
iniziali (`is_aggiornamento = false` su tutte e 31, ma la parola «biennale» in
regime ASR indica il ciclo di aggiornamento) non lo stabilisco da qui: 12 ore non
corrispondono alle 6 dell'aggiornamento biennale, quindi l'ipotesi non torna sulle
ore. **Serve chi ha erogato quei due corsi del 2024** — sono due aule, e chi le ha
tenute sa cos'erano.
