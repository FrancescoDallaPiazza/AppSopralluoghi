# Stato della Fase 0 — questa corsia

**Come si legge.** Il piano dei lavori sta in un posto solo
(`AppFormazione/docs/PROGRAMMA.md`, reso su
https://claude.ai/code/artifact/8116d53d-6944-4ce0-a9c0-29a1e072d763): quello dice
**cosa** va fatto. Questo file dice **a che punto è** ciò che tocca a questo repo,
e lo dice qui perché è qui che si lavora — le caselle le riempie chi le chiude.

L'altra corsia legge questo file, non deve chiederlo. Aggiornato quando qualcosa
si chiude, con l'hash del commit accanto: se manca l'hash, non è chiuso.

Ultimo aggiornamento: **9 settembre 2026**.

---

| voce della Fase 0 | stato | commit |
|---|---|---|
| **D1** · cache voci sui template composti | chiuso | `af0aefb`, `bcc3a31` |
| **D4** · `tecnico.cognome`, la migrazione mai scritta | chiuso | `af0aefb` |
| **D3** · quarantena della coda offline | chiuso | `33e5838` |
| **I sette buchi dell'import** | chiuso | `0d0c8a0` |
| Provenienza: `import_key` sulle persone | chiuso | `98082cd` |
| La schermata della quarantena | aperto | — |
| **D2** · il report non conosce i componenti | aperto | — |
| Ricreare i clienti: le 619 anagrafiche attive | **già fatto** (misurato in app) | — |
| Importare le persone: 3.420 scritte | **fatto 9.09** | `af8d945` |
| Paginazione delle letture (PostgREST tronca a 1000) | **chiuso** su `persona`, `cliente`, `incarico`, `sede` | `af8d945`, `e82169d` |
| L'ATECO mancante sul 57% delle attive | aperto, **non aspetta più**: il raccordo è a monte | `0237eaf` (nella libreria) |
| Le divisioni 30, 86, 87 (32 codici senza classe) | **decisa in Fase 2**: valgono `alto`, marcato come deduzione. Entra dal generatore, non a mano | `b555d67` (in AppOverall) |

## Dettaglio di quello che è cambiato oggi

**I sette buchi dell'import** (`0d0c8a0`) sono chiusi tutti. Sei su sette sono
verificati sull'export vero: `Data di Licenziamento` e `Area di Lavoro` ora
agganciano; 95 P.IVA su 3.416 vengono scartate come chiave; delle 235 righe senza
codice fiscale, **227 hanno un nome univoco** e il ripiego cognome+nome le aggancia
invece di duplicarle, 6 restano `riga:N` perché omonime.

Le riparazioni **lato clienti** sono ora verificate anche loro, su
`ElencoSedi.xlsx` (849 righe, intestazione alla riga 1, 41 colonne). Tutte e nove
le colonne che servono agganciano, comprese le quattro che prima si perdevano:

| verifica | prima | adesso |
|---|---|---|
| `INDIRIZZO / CAP / CITTÀ / PROVINCIA LEGALE` | null su ogni voce | **361 indirizzi, 361 CAP, 362 località, 359 province** sulle attive |
| colonna `ATTIVA` (valori `Sì` / `No`) | ignorata | **230 ex clienti scartati**, restano **619 attive** |
| `N° DIPENDENTI` | mai letto | **481 letti**; 138 a zero o vuoto restano «non dichiarato» |
| guardia P.IVA | assente | **58 su 615 ignorate**: `XXXX`, `00000000000`, `0418754028` e `0472097023` a dieci cifre |
| ATECO | — | presente su **267 delle 619 attive** (43%), come il riscontro del 26 agosto |

I numeri combaciano con quel riscontro a meno di una riga (849 contro 847: è un
export rifatto). Resta la decisione aperta su `INDIRIZZO SITO PRODUTTIVO`, che il
file ha e che **non** viene letto come sede legale: è la sede operativa, e finché
non è deciso come trattarla resta fuori apposta.

**La provenienza delle persone** (`98082cd`): `persona.import_key` esisteva dalla
migrazione `055` con il suo indice unique, ma nessuno la scriveva. Ora l'import
anagrafiche la scrive come `anag:<cliente>:<cf>` — col cliente dentro, perché
l'indice è globale e la stessa persona può stare su due organigrammi. È il primo
mattone di ciò che permette a un sistema di sapere cosa ha già ricevuto da un
altro: senza API, quella cosa la sa solo se la riga se la porta scritta.

## Aperto, e appena diventato possibile: i ruoli sicurezza

L'altra corsia ha trovato che il foglio **«Ruoli SSL»** di `ExportExcel (4).xlsx`
contiene davvero i ruoli sicurezza, **con la data dell'incarico** e non una
spunta: 85 addetti primo soccorso, 79 antincendio, 71 emergenze, 35 responsabili
emergenze, 31 RSPP, 25 preposti, 10 RLS. Il ROADMAP diceva da mesi che i ruoli
non erano in nessun export: era falso.

Il foglio non ha la P.IVA, e per l'anagrafica sarebbe un problema. Per le nomine
**non lo è**: la chiave che serve non è quella del cliente, è quella della
persona.

**Ma il codice fiscale NON c'è su tutte, e questa è la cosa da non dimenticare
quando si scriverà l'import delle nomine.** Misurato:

| | |
|---|---:|
| righe con almeno un ruolo | **153** |
| con codice fiscale (tutti distinti, zero doppioni) | 141 |
| **senza codice fiscale** | **12** |

E le dodici non sono sparse: **dieci sono QUALIFT S.P.A.**, una FALEGNAMERIA MAST
S.N.C., una GRAFICHE DUEGI. QUALIFT è un cliente attivo in `ElencoSedi`, e
agganciando solo per codice fiscale **perderebbe l'organigramma della sicurezza
per intero e in silenzio**: RLS, RSPP, due preposti, quattro antincendio, quattro
primo soccorso.

In totale sparirebbero **19 incarichi**, e uno di questi è l'intero dato di un
ruolo:

| ruolo | persi | su | |
|---|---:|---:|---|
| Addetti primo soccorso | 5 | 85 | |
| Addetti antincendio | 5 | 79 | |
| RSPP | 3 | 31 | |
| Preposto | 2 | 25 | |
| RLS | 1 | 10 | |
| Addetti emergenze | 1 | 71 | |
| Responsabile emergenze | 1 | 35 | |
| **Addetti Servizio Prevenzione e Protezione** | **1** | **1** | **tutto il dato** |

L'unica riga ASPP dell'export è anche una delle dodici senza codice fiscale:
agganciando per codice fiscale non si perde «anche un ASPP», si perde il **100%**
di quel ruolo, e nessun conteggio lo segnalerebbe.

Le date di incarico vanno dal **13.05.2001 al 27.12.2022**.

*Seconda nota di metodo, peggiore della prima.* Le colonne dei ruoli le avevo
cercate con un'espressione inventata da me (`rspp|rls|preposto|antincendio|primo
soccorso|emergenz`), e ne mancavano **due su nove**: `Addetti Servizio Prevenzione
e Protezione` e `Dirigente`. Sono venute fuori solo elencando **tutte** le colonne
del foglio invece di cercarne alcune. `Dirigente` sono 2 righe e non cambia il
conto dei persi — il codice fiscale ce l'hanno — ma è una figura del D.Lgs 81/08
con un obbligo formativo suo: sarebbe entrata nell'import mancante senza che
nessuno la cercasse. **Le colonne di un export si enumerano, non si indovinano.**

*Terza nota, e chiude il paio.* Avevo scritto qui che `Dirigente` «non l'aveva
vista nessuno dei due». **Falso, e verificabile in due comandi:** il documento
dell'altra corsia (`AppFormazione/docs/07-i-ruoli-sicurezza-erano-in-un-export.md`)
elencava tutte e nove le colonne, `Dirigente` compresa, **dalla sua prima
versione** — commit `49e110d`, riga 29. La loro misura era completa; incompleta
era solo la mia. Loro avevano letto la riga di intestazione e costruito un
dizionario indice→nome; io avevo cercato i nomi che mi aspettavo.

La cosa da tenere non è la svista: è che l'avevo affermata **senza guardare**, il
giorno stesso in cui in questo file ho scritto che cosa ha fatto l'altra corsia
non si chiede e non si aspetta, si legge dal suo repo. La regola era scritta due
sezioni più sotto e non l'ho applicata a me.

**Tutte e dodici hanno cognome e nome**, quindi il ripiego che l'import già usa
per le 227 persone senza codice fiscale le recupera — ma va acceso
deliberatamente anche su questa strada, non dato per scontato.

*Nota di metodo, perché l'errore è istruttivo.* La prima misura fatta qui diceva
«141 su 141, aggancio perfetto»: contava solo le righe che il codice fiscale ce
l'avevano, quindi le altre erano sparite dal conteggio stesso. È la stessa forma
del difetto della paginazione trovato poche ore prima — **un'assenza che si
presenta come un insieme completo**. L'ha vista l'altra corsia, misurando contro.

Perché conta: oggi l'import crea nomine con la sola figura `lavoratore`, e il
motore ricava i requisiti dalle **nomine**, non dagli attestati. Un attestato RLS
o antincendio importato esiste come riga ma è **muto** finché la persona non è
nominata in quel ruolo. Queste 141 nomine accenderebbero esattamente quelle
scadenze.

Con un ridimensionamento onesto, che viene dall'altra corsia: solo **65 società
su 480** hanno almeno un ruolo registrato, e nessun incarico è successivo al
2022. Dieci RLS su 480 aziende non è la realtà: è quello che qualcuno ha scritto
nel gestionale. Non è una raccolta fatta, è un punto di partenza.

## Cosa blocca, e chi lo tiene

- **I clienti NON sono da rifare: ci sono già.** Misurato il 9 settembre
  sull'app vera, anteprima dell'import di `ElencoSedi.xlsx`: **0 nuovi, 1 da
  completare, 618 già a posto, 230 righe scartate**. I conti tornano col file
  (619 attive + 230 ex clienti = 849 righe). «Già a posto» significa che hanno
  anche indirizzo e numero dipendenti: se mancassero, il file glieli darebbe e
  risulterebbero da completare.
- **Correzione a una cosa ripetuta tutto il giorno.** Il TODO diceva «tabula
  rasa dal 5 agosto» e questo file lo ripeteva: **è falso**. Era un documento,
  non una misura, e nessuno l'aveva verificato contro il database. Da qui in
  avanti lo stato del database si dichiara solo dopo averlo guardato.
- **Le 230 righe scartate sono la prova sul campo del filtro `ATTIVA`**: in
  produzione, con i dati veri, gli ex clienti non entrano più.
**Le persone sono dentro: 3.420 scritte** il 9 settembre, dall'export
`ExportExcel (5)` (ricerca dipendenti riesportata quel giorno, 3.502 righe,
intestazioni alla riga 3, 450 gruppi, 12 senza cliente, 2 righe scartate).

Ci sono voluti tre tentativi, e i primi due hanno trovato un difetto che c'era
da sempre. `riconciliaPersone` rileggeva le persone già in archivio **senza
paginare**, e PostgREST tronca a 1000 righe: con 3.400 persone dentro, quelle
oltre la millesima risultavano assenti e l'import provava a ricrearle. Finché
nessuno scriveva la provenienza, il risultato erano **doppioni creati in
silenzio**; da quando `import_key` si scrive, la scrittura si ferma con
`duplicate key value violates unique constraint uq_persona_import`. L'errore
era il sintomo, non la malattia — ed è comparso al primo import su un database
davvero pieno.

**Verificato, e pulito.** Ricaricando lo stesso file dopo l'import riuscito:
**0 nuove · 3.420 aggiornate**. Due cose insieme: i tentativi falliti non hanno
lasciato doppioni, e l'import è **idempotente** — ripassare lo stesso file non
crea più niente. È la prova che la provenienza (`import_key`) fa il suo mestiere.

Per rendere quella verifica possibile è stato aggiunto il totale
«N nuove · M aggiornate» in cima al riepilogo (`0c431b6`): prima il dato esisteva
solo dentro ogni gruppo, e i gruppi sono 450.

**Stessa forma, e adesso chiuso** (`e82169d`): `caricaClientiPerImport` non
paginava. Oggi non rompeva perché i clienti sono 619, sotto la soglia — ma il
difetto non stava in quella funzione: delegava a `caricaClienti`, che ha **tre**
letture non paginate (`cliente`, `incarico`, `sede`), e l'altra metà del carico
dell'import — `caricaClientiScelta`, chiamata nello stesso `Promise.all` — ne
aveva altre due. Cinque query, un difetto solo, e gli incarichi passano il
migliaio prima dei clienti.

Ora c'è `leggiTutte` in `src/lib/supabase.ts`, un posto solo: prende una
funzione-costruttrice (un builder PostgREST si consuma quando lo si attende) e
sposta la finestra finché una pagina torna corta. **Ogni query paginata ordina
anche per `id`**: senza un ordine stabile, fra una pagina e l'altra la stessa
riga compare due volte e un'altra in nessuna.

Di passaggio: l'import non carica più incarichi e sedi (servivano ai conteggi
della lista, a lui no), e gli errori su `incarico` e `sede` ora si propagano
invece di essere ingoiati — erano gli unici due punti del modulo a scartare
l'errore, e il risultato era «0 incarichi» su un cliente che ne ha.
- **L'ATECO mancante non aspetta più**: il raccordo è stato consegnato a monte,
  nella libreria (`formazione-81-utils-src`, `0237eaf`). Non le 6.742 righe — le
  **eccezioni**, i 9 codici su 1.290 dove prendere le prime due cifre sbaglia, più
  21 ambigui che ora vengono *segnalati* invece che risolti in silenzio. Era
  l'unico punto in cui questa corsia aspettava quella, e la campagna di riempimento
  può partire.
  **Due condizioni, però.** `ateco.ts` va **rigenerato, non corretto a mano**: sotto
  la decisione 7 la libreria è il generatore unico e una patch a valle sarebbe la
  quinta copia. E il percorso a mano (`Anagrafiche.tsx:866` → `:873`) scrive oggi
  `codice_ateco` **e** `livello_rischio` nella stessa patch senza conferma: è lì che
  un codice 2025 diventa una classe sbagliata in anagrafica, ed è da sistemare prima
  della campagna, non dopo.
  I **32 codici** delle divisioni 30, 86 e 87 non sono più senza classe: la scheda
  5 è stata decisa la sera del 9.09 (`b555d67` in AppOverall) — valgono `alto`, con
  la citazione della Gazzetta 2011 e **la deduzione marcata separatamente dal
  valore**. Anche questo entra dal generatore: `ateco.ts` **si rigenera, non si
  corregge a mano**, e l'avviso che il generatore è pronto arriva da AppFormazione.
  Non anticipare a mano nessuna delle due cose.
- **Cosa dobbiamo all'altra corsia:** niente.

## Come sapere cosa ha fatto l'altra corsia

I due repo stanno sullo stesso disco. Non serve chiedere né aspettare un riassunto:

```
git -C ../AppFormazione log --oneline --since="2026-09-09 00:00"
cat ../AppFormazione/docs/STATO.md          # se e quando esiste
cat ../AppFormazione/docs/diario/AAAA-MM-GG.md
```

Vale nei due versi. Il giorno in cui i repo non fossero più sulla stessa macchina,
il punto d'incontro diventa il repo neutro — o, finché non esiste, la pagina
condivisibile del programma.
