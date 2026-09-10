# Le colonne del foglio «Ruoli SSL», enumerate

**Preparazione all'import dei ruoli sicurezza. Non è l'import: nessuna riga è
stata scritta da nessuna parte.** Misurato il 10 settembre 2026 su
`ExportExcel (4).xlsx` (in `~/Downloads`), leggendo il file, non ricordandolo.

## Primo fatto: i fogli sono quattro, e nessun import apre questo file

| indice | foglio | righe |
|---:|---|---:|
| 0 | `Fattori di Rischio` | 3.503 |
| 1 | `Formazione` | 3.503 |
| 2 | `Visite` | 3.503 |
| 3 | **`Ruoli SSL`** | 3.503 |

**CORREZIONE al 10 settembre 2026, sera.** Qui era scritto che
`formazioneImport.ts:190` legge `SheetNames[0]` e quindi «legge solo Fattori di
Rischio». **Falso, e per la ragione peggiore: avevo confrontato il codice con il
file sbagliato.** Sono tre export diversi del gestionale, e questo non è quello
che l'import apre — vedi la tabella «quale import legge quale file» in
`docs/STATO.md`. La verità è più semplice e più grave: **`ExportExcel (4).xlsx`
non lo legge nessun import.** Non tre fogli su quattro: tutti e quattro.

## Le 47 colonne di «Ruoli SSL»

Intestazione alla **riga 2** del foglio (indice 1), 3.501 righe di dati.
Enumerate tutte — è la regola che questo repo ha già pagato due volte per
imparare, e la tabella qui sotto è **generata dal file**, non ricopiata.

| idx | colonna | valorizzate | |
|---:|---|---:|---|
| 0 | `Società` | 3501 | |
| 1 | `Sede` | 3500 | |
| 2 | `Cognome` | 3500 | |
| 3 | `Nome` | 3500 | |
| 4 | `C.F.` | 3269 | |
| 5 | `Sesso` | 3008 | |
| 6 | `nazionalità` | 209 | |
| 7 | `data di Nascita` | 2878 | |
| 8 | `città di nascita` | 2842 | |
| 9 | `CAP città di nascita` | 2056 | |
| 10 | `prov di nascita` | 2164 | |
| 11 | `indirizzo domicilio` | 315 | |
| 12 | `città` | 314 | |
| 13 | `CAP` | 314 | |
| 14 | `Telefono` | 2 | |
| 15 | `Fax` | 0 | |
| 16 | `Cellulare` | 4 | |
| 17 | `E-mail` | 62 | |
| 18 | `Matricola` | 21 | |
| 19 | `Tipologia` | 3191 | |
| 20 | `Part-Time` | 3375 | |
| 21 | `Tipologia di Contratto` | 239 | |
| 22 | `data Scadenza Contratto` | 2 | |
| 23 | `Qualifica` | 377 | |
| 24 | `Mansione` | 2890 | |
| 25 | `Area di Lavoro` | 364 | |
| 26 | `Struttura` | 24 | |
| 27 | `Medico Curante` | 4 | |
| 28 | `indirizzo del Medico` | 0 | |
| 29 | `telefono del Medico` | 0 | |
| 30 | `Note` | 52 | |
| 31 | `Data di Assunzione` | 769 | |
| 32 | `Ruoli SSL` | 153 | *elenco testuale* |
| 33 | `Mansione Safety` | 160 | |
| 34 | `Responsabile` | 8 | |
| 35 | `Percentuale Retributiva` | 0 | |
| 36 | `Livello` | 0 | |
| 37 | `Data Prima Assunzione` | 2 | |
| 38 | `Addetti Antincendio` | 79 | **ruolo** |
| 39 | `Addetti Emergenze ed Evacuazione` | 71 | **ruolo** |
| 40 | `Addetti Primo Soccorso` | 85 | **ruolo** |
| 41 | `Addetti Servizio Prevenzione e Protezione` | 1 | **ruolo** |
| 42 | `Dirigente` | 2 | **ruolo** |
| 43 | `Preposto` | 25 | **ruolo** |
| 44 | `RLS` | 10 | **ruolo** |
| 45 | `RSPP` | 31 | **ruolo** |
| 46 | `Responsabile Emergenze` | 35 | **ruolo** |

## Secondo fatto: non sono spunte, sono date

Le nove colonne di ruolo (38-46) contengono **seriali data di Excel**. Per la
colonna `RSPP` vanno dal **7 marzo 2006** al **1° marzo 2022**. È la data
dell'incarico: se un giorno entreranno come nomine, `data_nomina` c'è già e non
va inventata col giorno dell'import.

## Terzo fatto, ed è quello che capovolge la diagnosi

La colonna **32 `Ruoli SSL`** è un **elenco testuale** dei ruoli della persona, separati da virgola
(«Addetti Primo Soccorso, Addetti Antincendio»). Vale su 153 righe, esattamente
il numero di righe con almeno un ruolo.

*Correzione: avevo scritto che nessun documento l'aveva mai citata. Falso —
`AppFormazione/docs/07-…` la elenca, come «due colonne di testo che riassumono».
Nuovo è averla usata come **riscontro**, non averla trovata.*

Serve come riscontro indipendente sulla mappatura delle nove colonne. Eseguito:

| col | ruolo | con data | citato in col. 32 | incoerenti |
|---:|---|---:|---:|---:|
| 38 | Addetti Antincendio | 79 | 79 | **0** |
| 39 | Addetti Emergenze ed Evacuazione | 71 | 71 | **0** |
| 40 | Addetti Primo Soccorso | 85 | 85 | **0** |
| 41 | Addetti Servizio Prevenzione e Protezione | 1 | 1 | **0** |
| 42 | Dirigente | 2 | 2 | **0** |
| 43 | Preposto | 25 | 25 | **0** |
| 44 | RLS | 10 | 10 | **0** |
| 45 | RSPP | 31 | 31 | **0** |
| 46 | Responsabile Emergenze | 35 | 35 | **0** |

**Zero incoerenze su tutte e nove.** E questa è una brutta notizia, non una
buona.

Significa che la colonna `RSPP` **non è mappata male nel senso di letta male**:
il file è coerente con se stesso, la intitola RSPP e la ripete RSPP nell'elenco
testuale. Il difetto che AppFormazione ha dovuto correggere con
`togli_ruoli_rspp.sql` sta **a monte del file** — è il gestionale che chiama
«RSPP» il datore di lavoro che assume l'incarico in proprio (art. 34), e la
prova non è nel foglio: sta negli attestati, dove 26 righe su 33 sono
«AGGIORNAMENTO DATORE DI LAVORO CHE SVOLGE I COMPITI DI RSPP» e la
sovrapposizione con chi ha i moduli A/B/C professionali è **zero**.

**La conseguenza operativa, per chi scriverà il lettore.** Enumerare le colonne
è necessario e **non è sufficiente**. Nessuna lettura attenta di questo foglio
può accorgersi del problema, perché il foglio non si contraddice: la verifica
che lo scopre è **esterna**, ed è il confronto con gli attestati. La colonna 45
resta fuori dall'import finché non è chiarito chi compila il gestionale — e va
lasciata fuori *sapendo perché*, non per prudenza generica.

## Quello che resta vero delle trappole già note

- **12 righe senza codice fiscale** su 153 con almeno un ruolo (colonna 4, `C.F.`,
  valorizzata su 3.269 delle 3.501): agganciando solo per CF si perdono 19
  incarichi in silenzio, e il **100%** dell'unica riga
  `Addetti Servizio Prevenzione e Protezione`. Il ripiego cognome+nome esiste già
  nell'import per le 227 persone senza CF: va acceso anche qui, deliberatamente.
- **`Dirigente`** (2 righe) è una figura del D.Lgs 81/08 con un obbligo formativo
  suo. Non cambia il conto dei persi, ma sarebbe entrata nel dimenticatoio senza
  che nessuno la cercasse.

## Stato

**Preparazione, non implementazione.** L'import dei ruoli è **in pausa per
decisione di Francesco**, e la pausa non è tecnica: con le 141 nomine dentro, le
scadenze diventano vive per chi usa l'app, e molte nascono già arretrate perché
le date d'incarico partono dal 2001.
