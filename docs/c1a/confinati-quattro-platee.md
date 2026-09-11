# Spazi confinati: gli aggiornamenti erogati sono zero, e il catalogo dice due durate

Conteggio (d) dell'11 settembre 2026, su assegnazione di AppOverall.
**Sola lettura, nessuna scrittura.** Ultimo pezzo della scheda 12.

## La risposta

**Non è una durata, sono due — e si separano esattamente per platea.**
`spazi_confinati` **non è il terzo obbligo pronto**: ha la stessa forma dell'RLS, e
il catalogo `ore_aggiornamento = 4` è giusto solo per i lavoratori.

## Perché la domanda non si poteva chiudere sull'export

**Tutti e cinque gli alias di aggiornamento hanno ZERO righe erogate.** Nessuno di
quei corsi è mai stato fatto:

| alias di aggiornamento | righe erogate |
|---|---:|
| `AGGIORNAMENTO PER LAVORATORI, DATORI DI LAVORO E LAVORATORI AUTONOMI…` | **0** |
| `LAVORI IN AMBIENTI CONFINATI (AGGIORNAMENTO LAVORATORI)` | **0** |
| `LAVORI IN AMBIENTI CONFINATI (AGGIORNAMENTO PREPOSTO)` | **0** |
| `LAVORI IN AMBIENTI CONFINATI (AGGIORNAMENTO R.S.P.P. DATORE DI LAVORO)` | **0** |
| `LAVORI IN AMBIENTI CONFINATI (AGGIORNAMENTO R.S.P.P. MODULO B)` | **0** |

L'export dei corsi fatti, da solo, dice «non lo so». Se ci fossimo fermati lì la
risposta sarebbe stata *nessuna evidenza*, che è vera e inutile.

## La seconda fonte, e perché ci si può contare

Il catalogo del gestionale (`elencoAnagraficaFormazioni.xlsx`) dichiara una
**durata per titolo**. Non è una fonte qualunque: sui cinque alias **iniziali**,
che di righe erogate ne hanno, la durata dichiarata coincide con la durata
effettiva **cinque volte su cinque, su 32 righe**.

| alias iniziale | catalogo | erogato | esito |
|---|---:|---|---|
| `ADDETTO A LAVORI IN SPAZI CONFINATI…` | 4 h | 4h × 4 | ✔ |
| `ADDETTO AI LAVORI IN SPAZI CONFINATI…` | 8 h | 8h × 19 | ✔ |
| `CORSO PER ADDETTI AI LAVORI…` | 16 h | 16h × 4 | ✔ |
| `CORSO PER ADDETTI AI LAVORI… - ASR 2025` | 12 h | 12h × 4 | ✔ |
| `CORSO PER LAVORATORI, DATORI DI LAVORO E LAVORATORI AUTONOMI…` | 12 h | 12h × 1 | ✔ |

**Zero divergenze.** La colonna `Durata (h)` del catalogo *è* il numero operativo,
e questo autorizza a usarla dove le righe erogate mancano.

## Le durate dichiarate dei cinque aggiornamenti

| alias | platea | catalogo | categoria |
|---|---|---:|---|
| `AGGIORNAMENTO PER LAVORATORI, DATORI DI LAVORO E LAVORATORI AUTONOMI…` | lavoratori + DL + autonomi | **4 h** | Accordo Stato Regioni 2025 |
| `LAVORI IN AMBIENTI CONFINATI (AGGIORNAMENTO LAVORATORI)` | lavoratori | **4 h** | Aggiornamenti |
| `LAVORI IN AMBIENTI CONFINATI (AGGIORNAMENTO PREPOSTO)` | preposto | **12 h** | Aggiornamenti |
| `LAVORI IN AMBIENTI CONFINATI (AGGIORNAMENTO R.S.P.P. DATORE DI LAVORO)` | DL-RSPP | **12 h** | Aggiornamenti |
| `LAVORI IN AMBIENTI CONFINATI (AGGIORNAMENTO R.S.P.P. MODULO B)` | RSPP mod. B | **12 h** | Aggiornamenti |

Periodicità **5 anni** su tutti e dieci gli alias, iniziali compresi — e su questo
`aggiornamento_mesi = 60` del catalogo è giusto.

> **4 ore ai lavoratori, 12 ore a preposto, DL-RSPP e RSPP modulo B.**
> Non quattro durate diverse: **due**, ma separate per platea, e la platea è
> proprio ciò che il codice `ATTR_AMB_CONFINATI` non porta.

## Cosa ne segue

È **la forma dell'RLS**, non quella del carrello elevatore:

- il *carrello* ha una seconda durata perché esiste un **corso combinato**: manca
  un codice per una cosa diversa;
- l'*RLS* ha due durate perché la stessa cosa dura diversamente **a seconda di un
  attributo che il codice non porta** (lì la dimensione dell'azienda, qui la
  figura di chi lo fa).

Quindi **cambiare `ore_aggiornamento` da 4 a 12 sarebbe sbagliato quanto lasciarlo
a 4**: renderebbe giusti tre alias su cinque invece di due. Quello che serve è che
le ore dell'aggiornamento dipendano dalla **figura**, come già succede per
`LAV_SPEC` (ore dal rischio) e per `DL_RSPP_SETTORE` / `RSPP_MOD_B_SETTORE` (ore
dall'ATECO). Il meccanismo nel motore c'è già; è il catalogo che qui non ha dove
scrivere il dato.

**E non morde oggi:** zero aggiornamenti erogati, e — con `nomina` a zero righe —
nessuno è ancora nominato in nessuna delle tre figure a 12 ore. Anche questa, come
il modulo di settore, è una decisione di progetto e non una riparazione urgente.

*Un dato di contesto per la scheda 12:* le 32 righe iniziali vengono da **9
aziende** e si dividono nel tempo — le 19 a 8 ore vanno dal 2014 al 2026, mentre
16 h e 12 h compaiono solo nel 2025‑2026. Il regime nuovo si vede entrare.

## Due dettagli di metodo, perché costano tempo a chi ripete la misura

1. **Il catalogo ha 270 righe, non 268.** Le due in più non sono corsi: sono il
   piè di pagina dell'export — `DATI AGGIORNATI AL 30/07/2026 17:04` e
   `HTTPS://OVERALL.SGSLWEB.COM/`. Il dizionario a 268 è giusto.
2. **Nove titoli del catalogo hanno uno spazio doppio** dove il dizionario ne ha
   uno solo (`CORSO PER ADDETTI  AI LAVORI…`). Due dei dieci alias di questa
   misura sono fra quei nove: cercandoli letterali risultano *assenti dal
   catalogo*, e la risposta a (d) sarebbe stata «due titoli non esistono». Il
   confronto va fatto normalizzando gli spazi. Lo dico perché è la terza volta in
   due giorni che la forma di una stringa cambia un conteggio.
