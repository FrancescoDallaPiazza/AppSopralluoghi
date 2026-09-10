# Stato della Fase 0 — questa corsia

**Come si legge.** Il piano dei lavori sta in un posto solo
(`AppFormazione/docs/PROGRAMMA.md`, reso su
https://claude.ai/code/artifact/8116d53d-6944-4ce0-a9c0-29a1e072d763): quello dice
**cosa** va fatto. Questo file dice **a che punto è** ciò che tocca a questo repo,
e lo dice qui perché è qui che si lavora — le caselle le riempie chi le chiude.

L'altra corsia legge questo file, non deve chiederlo. Aggiornato quando qualcosa
si chiude, con l'hash del commit accanto: se manca l'hash, non è chiuso.

Ultimo aggiornamento: **10 settembre 2026**.

---

| voce della Fase 0 | stato | commit |
|---|---|---|
| **D1** · cache voci sui template composti | chiuso | `af0aefb`, `bcc3a31` |
| **D4** · `tecnico.cognome`, la migrazione mai scritta | chiuso | `af0aefb` |
| **D3** · quarantena della coda offline | chiuso | `33e5838` |
| **I sette buchi dell'import** | chiuso | `0d0c8a0` |
| Provenienza: `import_key` sulle persone | chiuso | `98082cd` |
| La schermata della quarantena | chiuso | `__HASH__` |
| **D2** · il report non conosce i componenti | aperto | — |
| Ricreare i clienti: le 619 anagrafiche attive | **già fatto** (misurato in app) | — |
| Importare le persone: 3.420 scritte | **fatto 9.09** | `af8d945` |
| Paginazione delle letture (PostgREST tronca a 1000) | **chiuso** su `persona`, `cliente`, `incarico`, `sede` | `af8d945`, `e82169d` |
| L'ATECO mancante sul 57% delle attive | aperto, **non aspetta più**: il raccordo è a monte | `0237eaf` (nella libreria) |
| Le divisioni 30, 86, 87 | decisa in Fase 2 (`b555d67`), **rigenerata qui**: nessun livello cambia, cambia la provenienza | `3a68c13` |
| `ateco.ts` rigenerabile con un comando | **chiuso**: `node scripts/genera-ateco.mjs`, con `--check` | `3a68c13` |

## La quarantena adesso si vede, e si può toccare

`D3` aveva chiuso il pezzo difficile: un'operazione respinta in modo definitivo
esce dalla coda invece di congelare per sempre tutto ciò che le sta dietro. Ma
`contaQuarantena()` non era chiamato da nessuna parte: il numero che spiega
perché qualcosa non è arrivato in ufficio esisteva e non lo leggeva nessuno.

**Chi la guarda, e perché decide il resto.** La quarantena è una tabella Dexie,
cioè IndexedDB, cioè **il dispositivo**. Il back-office non la vede e non la
vedrà: non è una vista che manca, è un posto dove non arriva. Quindi chi legge
quell'elenco è il tecnico, in campo, spesso senza rete — e una schermata di sola
lettura l'avrebbe mandato a telefonare in ufficio per ogni riga. La decisione di
Francesco: **vedere, scartare, ritentare**.

- **Ritenta** rimette l'operazione in coda **com'era**, e il testo sotto l'elenco
  lo dice: se la causa del rifiuto è ancora lato server, al prossimo giro
  l'operazione torna in quarantena identica. Serve quando la causa è stata
  rimossa in ufficio — ed è il caso vero di questo progetto: il `409` del 9
  settembre si è sistemato cancellando righe via SQL, e dopo quella correzione il
  ritentativo passa. Un bottone che promettesse di riparare sarebbe peggio di
  nessun bottone.
- **Scarta** cancella per sempre, in due tocchi. Serve per i casi morti:
  `LOCALE_MANCANTE`, il file di una foto o di un attestato che in locale non c'è
  più. Su quelli **Ritenta non compare**, perché nessun ritentativo potrà mai
  riuscire.

**Il difetto che il bottone Ritenta ha fatto emergere, e che è chiuso con lui.**
Cinque funzioni annullano un'operazione ancora pendente quando si cancella ciò a
cui si riferisce — `rimuoviFoto`, `rimuoviEsito`, `rimuoviRiga`,
`eliminaFormazione`, `annullaUpsertInCoda`. Tutte e cinque guardavano **la sola
coda**. Ma un'operazione respinta non sta più in coda: sta in quarantena, dove
nessuna delle cinque la cercava. Finché la quarantena si poteva solo leggere
quella copia dimenticata era inerte; **con Ritenta diventava in grado di
ricreare lato server una riga cancellata nel frattempo** — cancelli un rilievo,
il delete sale, poi ritenti l'upsert respinto e il rilievo torna. Ora c'è
`annullaQuarantenaPer` in `db.ts`, chiamata da tutti e cinque i punti: chi annulla
un'operazione annulla anche la sua copia in quarantena. È la stessa forma dei
difetti di agosto — **un posto in più dove la stessa regola non era applicata**.

**Dove si entra.** Due vie, entrambe solo quando c'è qualcosa da vedere: la voce
«Non arrivate in ufficio (N)» nel menu account, con un pallino rosso sul bottone
perché nessuno apre un menu per cercare un problema che non sa di avere; e il
contatore «· N bloccate» già presente nell'intestazione della compilazione, che
adesso è un bottone e apre lo stesso elenco. Quella seconda via conta: durante un
giro il menu account non c'è, e chi è dentro a un giro è esattamente chi sta
producendo le operazioni che si bloccano.

**Cosa non è verificato.** `npm run build` è verde (`tsc -b` compreso), ma
l'elenco **non è ancora stato visto con una riga dentro**: per farlo serve
provocare un rifiuto definitivo su un'app collegata, e in questo repo non c'è
attrezzatura di test — la verifica, qui, si fa sui dati veri. Il modo più breve
per esercitarlo è la console del browser sull'app collegata:
`await db.quarantena.add({op:{kind:'row',table:'esito_voce',payload:{id:'x'}},motivo:'prova',codice:'23505',quando:new Date().toISOString()})`,
poi Scarta per ripulire.

## Dettaglio di quello che è cambiato il 9 settembre

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
  valore**. L'avviso da AppFormazione è arrivato la sera stessa (`736699e` nella
  libreria) e **la rigenerazione è fatta** (`3a68c13`).

**La rigenerazione di `ateco.ts`, e cosa NON ha cambiato.** Nessun livello: le 88
divisioni vecchie e le 88 nuove combaciano su sezione, livello e descrizione. La
30, la 86 e la 87 erano già `alto` **anche prima** — quello che mancava era dire
da dove venisse. È la provenienza a essere nuova, non il valore; e i 32 codici
sbloccati sono codici **ATECO 2025** che il raccordo risolve nella libreria, non
righe di questa tabella.

Il file dichiarava da sempre «generati dalla libreria, nessuna trascrizione
manuale», ma **come** si generassero non era scritto da nessuna parte: era un
gesto a memoria, che è indistinguibile da una trascrizione a mano. Ora
`node scripts/genera-ateco.mjs [percorso-libreria]` riscrive
`src/formazione/atecoDati.ts` (generato, con scritto di non toccarlo) e `--check`
dice solo se siamo indietro. `ateco.ts` resta la logica: i consumatori non
cambiano una riga. `fonte` e `dedotto` restano **due campi**, e l'anagrafica li
mostra sulle tre divisioni — se in ispezione la risposta è «l'ha messo il
programma», la decisione non ha retto.

La libreria non è una dipendenza npm ma un repo a parte, ed è **clonata accanto a
questo** dal 9 settembre (`../formazione-81-utils-src`, portata giù da
AppFormazione per scrivere `736699e`): lo script la trova da solo, `node
scripts/genera-ateco.mjs --check` gira senza argomenti. Se un giorno non c'è, lo
script lo dice e ricorda il comando per clonarla.
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
