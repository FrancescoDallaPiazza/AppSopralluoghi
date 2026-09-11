# `corso_alias.testo_gestionale` non è verbatim, e non lo è su 211 righe su 268

Risposta all'11 settembre 2026 alla richiesta di AppOverall («le nove righe
verbatim dei titoli con lo spazio doppio»). **Sola lettura.**

I nove titoli ci sono, in fondo. Ma la premessa della richiesta va corretta in due
punti, e il secondo cambia dove va la riparazione.

## Correzione 1 — non sono nove, e non sono tutti spazi doppi

I titoli del catalogo la cui **spaziatura** differisce da quella che teniamo noi
sono **quindici**, e sono di tre tipi:

| tipo | quanti |
|---|---:|
| **spazio doppio** dentro al titolo | **8** |
| **a capo** (`\n`) dentro al titolo | **1** |
| **spazio in coda** | **6** |

I nove che avevo contato ieri erano gli otto con lo spazio doppio **più quello con
l'a capo** — cioè gli anomali *interni*. I sei con lo spazio in coda non erano
comparsi perché il mio confronto faceva `strip()` prima di confrontare, e li
toglieva di mezzo da solo. **Il numero giusto delle anomalie interne è nove, quello
di tutte le divergenze di spaziatura è quindici**, e uno dei nove non è uno spazio
doppio ma un a capo — il che conta, perché una sostituzione `'  ' → ' '` non lo
prende.

## Correzione 2 — la divergenza non è di quindici righe, è di duecentoundici

E questa è quella che conta.

| confronto fra il titolo dell'origine e `corso_alias.testo_gestionale` | righe |
|---|---:|
| identici **carattere per carattere** | **57** |
| differiscono **solo per maiuscole/minuscole** | **196** |
| differiscono **anche per gli spazi** | **15** |
| | **268** |

**Su 268 righe, 211 non sono verbatim.** Il catalogo del gestionale emette
`Aggiornamento Addetto alla conduzione di terne `; noi teniamo
`AGGIORNAMENTO ADDETTO ALLA CONDUZIONE DI TERNE`. Gli spazi doppi sono la punta
visibile di una cosa molto più grande: **teniamo la chiave, non il testo.**

## Ma l'import non si rompe, e questo va detto subito

Il timore di AppOverall — «al primo import vero quei nove titoli non si
troverebbero» — **non vale per il nostro lato**. `testo_gestionale` è una chiave
normalizzata *per costruzione*, e la stessa funzione normalizza tutt'e due i lati
del confronto:

```ts
// src/lib/admin/aliasCorsi.ts:99-100
export const normalizzaTestoGestionale = (s: string): string =>
  s.replace(/\s+/g, ' ').trim().toUpperCase();
```

Applicata a ogni riga del file appena letta (`:120`), e il confronto con il
dizionario (`:161-165`) avviene fra due insiemi già normalizzati. Il commento al
codice lo dichiara da sempre (`:38`): «NORMALIZZAZIONE: maiuscolo + spazi
collassati + trim, nient'altro».

**Quindi i nove titoli con lo spazio doppio si trovano**, oggi come al primo
import: `\s+ → ' '` collassa anche l'a capo, e il `toUpperCase()` toglie di mezzo i
196 casi di sole maiuscole. Non c'è nessun import da riparare.

## Il difetto vero è un commento, ed è nostro

Quello che ha fuorviato è **una riga della nostra migrazione**:

```sql
-- supabase/migrations/055_adempimento_corso_alias_import.sql:67
testo_gestionale text not null unique,  -- la stringa esatta esportata
```

**«La stringa esatta esportata» è falso.** È la stringa esportata *maiuscola, con
gli spazi collassati e senza quelli in coda*. Chi legge lo schema — e AppOverall ha
letto lo schema — conclude ragionevolmente che lì dentro ci sia il verbatim, e da
lì discende sia il timore sull'import sia l'idea che la riparazione stia da questa
parte.

La correzione è al commento, non ai dati. `055` è caricata e non si tocca: va fatta
con un `comment on column` in una migrazione nuova, con il testo che dice cosa c'è
davvero. **Non l'ho scritta**: è una scrittura e non era assegnata.

## Quello che si perde davvero, ed è la stessa lezione di sempre

Non l'import: **la forma originale**. Nessuno la conserva. Se domani serve sapere
se il gestionale scrive «Costruzioni  per Datore» con due spazi, l'unica fonte è
riaprire l'export — esattamente come per la cella ATECO di SHAMS e per
`RSPP- NO TITOLARE` nelle mansioni. Terza volta, stessa forma:

> il dato derivato non porta con sé l'unica cosa che permetterebbe di rivederlo.

Il disegno di `ruolo_testo` nella 0007 — `testo` verbatim **e** `chiave` generata,
due colonne — è la risposta giusta, e questi numeri la confermano dal basso: qui la
colonna era una sola, ha dovuto fare il lavoro della chiave, e il testo è andato.

---

## I quindici titoli, verbatim dal gestionale

`⎵⎵` = spazio doppio · `⏎` = a capo · `⎵$` = spazio in coda.
A sinistra ciò che emette l'origine, a destra ciò che teniamo noi.

### Gli otto con lo spazio doppio

| # | riga | origine (verbatim) | noi |
|---:|---:|---|---|
| 1 | 119 | `CORSO DI AGGIORNAMENTO DIRIGENTE⎵⎵con modulo aggiuntivo cantieri` | `CORSO DI AGGIORNAMENTO DIRIGENTE CON MODULO AGGIUNTIVO CANTIERI` |
| 2 | 180 | `CORSO PER ADDETTI⎵⎵AI LAVORI IN SPAZI CONFINATI E SOSPETTI DI INQUINAMENTO` | `CORSO PER ADDETTI AI LAVORI IN SPAZI CONFINATI E SOSPETTI DI INQUINAMENTO` |
| 3 | 181 | `CORSO PER ADDETTI⎵⎵AI LAVORI IN SPAZI CONFINATI E SOSPETTI DI INQUINAMENTO- ASR 2025` | `CORSO PER ADDETTI AI LAVORI IN SPAZI CONFINATI E SOSPETTI DI INQUINAMENTO- ASR 2025` |
| 4 | 205 | `Formazione lavoratori Rischio Alto -⎵⎵Specifica` | `FORMAZIONE LAVORATORI RISCHIO ALTO - SPECIFICA` |
| 5 | 207 | `Formazione lavoratori Rischio Basso -⎵⎵Specifica` | `FORMAZIONE LAVORATORI RISCHIO BASSO - SPECIFICA` |
| 6 | 209 | `Formazione lavoratori Rischio Medio -⎵⎵Specifica` | `FORMAZIONE LAVORATORI RISCHIO MEDIO - SPECIFICA` |
| 7 | 243 | `Modulo integrativo 3: Costruzioni⎵⎵per Datore di Lavoro che svolge i compiti di RSPP` | `MODULO INTEGRATIVO 3: COSTRUZIONI PER DATORE DI LAVORO CHE SVOLGE I COMPITI DI RSPP` |
| 8 | 260 | `R.S.P.P. / A.S.P.P.⎵⎵modulo B COMUNE` | `R.S.P.P. / A.S.P.P. MODULO B COMUNE` |

### Il nono, che non è uno spazio doppio ma un a capo

| # | riga | origine (verbatim) | noi |
|---:|---:|---|---|
| 9 | 228 | `Lavoratori e Preposti addetti al montaggio,⏎smontaggio e trasformazione di ponteggi, uso DPI anticaduta` | `LAVORATORI E PREPOSTI ADDETTI AL MONTAGGIO, SMONTAGGIO E TRASFORMAZIONE DI PONTEGGI, USO DPI ANTICADUTA` |

In Python è esattamente:
`'Lavoratori e Preposti addetti al montaggio,\nsmontaggio e trasformazione di ponteggi, uso DPI anticaduta'`
— l'a capo è alla posizione 43, subito dopo la virgola. **Un titolo di corso che
contiene un ritorno a capo**: se da qualche parte finisce in una chiave primaria
confrontata alla lettera, non è lo spazio doppio il caso da temere, è questo.

### I sei con uno spazio in coda

| # | riga | origine (verbatim) | noi |
|---:|---:|---|---|
| 10 | 49 | `Aggiornamento Addetto alla conduzione di escavatori a fune⎵$` | `…ESCAVATORI A FUNE` |
| 11 | 51 | `Aggiornamento Addetto alla conduzione di escavatori idraulici, caricatori frontali e terne⎵$` | `…FRONTALI E TERNE` |
| 12 | 57 | `Aggiornamento Addetto alla conduzione di pale caricatrici frontali⎵$` | `…PALE CARICATRICI FRONTALI` |
| 13 | 62 | `Aggiornamento Addetto alla conduzione di terne⎵$` | `…DI TERNE` |
| 14 | 266 | `R.S.P.P. DATORE DI LAVORO RISCHIO ALTO⎵$` | `R.S.P.P. DATORE DI LAVORO RISCHIO ALTO` |
| 15 | 268 | `R.S.P.P. DATORE DI LAVORO RISCHIO MEDIO⎵$` | `R.S.P.P. DATORE DI LAVORO RISCHIO MEDIO` |

*Le righe si riferiscono al foglio «Anagrafica Formazione» di
`elencoAnagraficaFormazioni.xlsx` (dati dalla riga 3). I due valori di piè di
pagina — `Dati aggiornati al 30/07/2026 17:04` e `https://overall.sgslweb.com/` —
non sono corsi e restano fuori dai 268.*
