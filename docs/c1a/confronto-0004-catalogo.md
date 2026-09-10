# I 40 codici della `0004` contro il database: una divergenza su 360 campi

Confronto del 10 settembre 2026 fra il blocco `insert into corso` della `0004`
di AppOverall (letta da `origin`, non dal clone locale) e `corso_catalogo` del
database vero. **Sola lettura.**

## Metodo, e un falso allarme evitato

Nove campi × 40 righe = 360 confronti: troppi da guardare a occhio, e guardarli
a occhio è il modo di non vedere quello che conta. Quindi **un md5 per riga** su
una stringa canonica dei nove campi, calcolato **dalle due parti** e confrontato.

Al primo giro **nessun hash coincideva**. Non era una divergenza: era la mia
normalizzazione. Confrontando la stringa grezza invece dell'hash:

```
database:   AI_LIV1|…|antincendio|4.0|60|2.0||t|DM 02/09/2021…
mio canone: AI_LIV1|…|antincendio|4  |60|2  ||true|DM 02/09/2021…
```

`ore` è una colonna **numeric** e Postgres la stampa `4.0`; il booleano in
`concat` diventa `t` e non `true`. Due differenze di rappresentazione, zero
differenze di dato. Allineate le due parti su una forma neutra (`trim_scale()`
per i numerici, `attivo::int` per il booleano), gli hash hanno cominciato a
coincidere.

**Vale la pena scriverlo perché la conclusione sbagliata era pronta e comoda:**
«40 righe su 40 divergono» sarebbe stata una notizia grossa, falsa, e mi sarebbe
costato dieci minuti darla. La differenza fra darla e non darla è stata guardare
la stringa invece dell'hash — cioè scendere di un livello prima di parlare.

## Il risultato

| | |
|---|---:|
| codici nella `0004` | **40** |
| codici in `corso_catalogo` | **40** |
| solo nella migrazione | **0** |
| **solo nel database** | **0** |
| righe identiche in tutti e nove i campi | **39** |
| **righe che divergono** | **1** |

Nessun codice scritto dall'interfaccia: la domanda «qualcuno ha aggiunto corsi a
mano?» ha risposta **no**, verificata sui codici e non sul conteggio.

## L'unica divergenza: `DL_RSPP_BASE`, campo `note`

Otto campi su nove identici — `nome`, `categoria`, `ore` 16, `aggiornamento_mesi`
60, `ore_aggiornamento` 6, `prerequisito_codice` vuoto, **`attivo` false**. Cambia
un carattere dentro la nota:

| | |
|---|---|
| `0004` (migrazione) | `DEPRECATO dalla **049**. Le 16h base del DL-RSPP…` |
| database | `DEPRECATO dalla **050**. Le 16h base del DL-RSPP…` |

**Cade esattamente su uno dei quattro update che AppOverall ha applicato a mano**
nella simulazione. Ma non è lì che sta l'errore.

## Perché, ricostruito dalla cronologia git

```
git log -S "DEPRECATO dalla 050" --oneline -- supabase/migrations/
  48599e6 Delete 050_dl_rspp_prerequisito_e_moduli_settore.sql
  38d8f42 02.07
```

La migrazione **è nata come `050`**, e la sua nota citava il proprio numero:
«DEPRECATO dalla 050». **È stata applicata al database in quella forma** — ed è
per questo che il database dice 050. Poi il file è stato **rinumerato a `049`**,
il testo della nota aggiornato di conseguenza, e il `050_` cancellato
(`48599e6`). Il database non è mai stato rieseguito.

Quindi **nessuna delle due parti ha sbagliato la ricostruzione**: il database
registra ciò che è stato davvero applicato, il file registra una modifica
successiva che non è mai arrivata al database.

## Cosa cambia nella conclusione di stamattina

Su `figura_requisito` avevo scritto «le migrazioni descrivono il database». Resta
vero lì, e va **qualificato** qui: le migrazioni descrivono il database **tranne
dove un file è stato modificato dopo essere stato applicato**, e in questo repo
è successo almeno una volta.

La differenza pratica è piccola — una nota che cita il proprio numero — ma il
meccanismo non lo è: **un file di migrazione è stato riscritto dopo l'esecuzione
e nessuno se n'è accorto per due mesi.** Se la modifica avesse riguardato le ore
di un corso invece del testo di una nota, la ricostruzione dalle migrazioni
avrebbe prodotto un valore che nel database non c'è mai stato — e sarebbe stata
coerente con se stessa, che è A9.

## La decisione, che non è mia

Quale delle due note deve stare nel catalogo nuovo:

- **`049`**, cioè il numero che il file ha oggi: la nota resta verificabile da chi
  legge il repo;
- **`050`**, cioè ciò che il database contiene davvero: la nota resta fedele a
  quando la deprecazione è stata applicata.

Non riconcilio e non scelgo: chi ha ragione fra un file e un database è una
decisione, non un merge. Segnalata ad AppOverall.
