# Stato della Fase 0 — questa corsia

**Come si legge.** Il piano dei lavori sta in un posto solo:
**`AppOverall/docs/PROGRAMMA.md`** dal 9 settembre — in `AppFormazione` ne resta un
puntatore, non una copia — reso su
https://claude.ai/code/artifact/8116d53d-6944-4ce0-a9c0-29a1e072d763. Quello dice
**cosa** va fatto. Questo file dice **a che punto è** ciò che tocca a questo repo,
e lo dice qui perché è qui che si lavora — le caselle le riempie chi le chiude.

L'altra corsia legge questo file, non deve chiederlo. Aggiornato quando qualcosa
si chiude, con l'hash del commit accanto: se manca l'hash, non è chiuso.

Ultimo aggiornamento: **12 settembre 2026**, sera.

**Una cosa sul come, prima delle caselle, perché è il motivo per cui questo
aggiornamento è tardivo.** Il lavoro dell'11 settembre è stato fatto su
un'altra macchina ed è arrivato qui solo il **12 alle 16:56**, con un `pull`. Il
file era fermo all'11 alle 08:19 (`7d0b322`) e dopo di quello c'erano **19
commit** — la `064`, la `065`, la `066`, la `067`, la `068`, il progetto
dell'import delle nomine, i due export delle visite. Chi l'ha aperto il 12
leggeva «10 settembre».

Il costo non è teorico ed è stato pagato da qualcun altro: per sapere a che
punto fosse questa corsia, AppOverall ha dovuto ricostruirla da 19 messaggi di
commit e dai file in `c1a/`, mentre il file che esiste apposta diceva altro. La
regola resta quella scritta in testa — si aggiorna **a chiusura di ogni task**,
non a fine giornata — e nemmeno «a fine giornata» sarebbe bastato qui, perché la
giornata è finita su una macchina e il file si legge su un'altra.

**E il 10 e l'11 non hanno un diario, apposta.** Erano stati scritti, e sono stati
**ritirati** lo stesso giorno: un diario è il resoconto di quello che una sessione
ha *visto*, e quelle due giornate questa postazione non le ha viste — qui sono
arrivate col `pull`. Ricostruirle dai commit e metterle in mezzo a testimonianze
dirette le avrebbe fatte **cambiare di grado senza cambiare d'aspetto**. Il loro
contenuto sta qui sotto, dove una ricostruzione è il modo normale di scrivere; la
regola e l'elenco delle giornate senza diario stanno in
[`diario/README.md`](diario/README.md). *Stessa scelta, per la stessa giornata,
nella corsia `AppFormazione`.*

---

| voce della Fase 0 | stato | commit |
|---|---|---|
| **D1** · cache voci sui template composti | chiuso | `af0aefb`, `bcc3a31` |
| **D4** · `tecnico.cognome`, la migrazione mai scritta | chiuso | `af0aefb` |
| **D3** · quarantena della coda offline | chiuso | `33e5838` |
| **I sette buchi dell'import** | chiuso | `0d0c8a0` |
| Provenienza: `import_key` sulle persone | chiuso | `98082cd` |
| La schermata della quarantena | chiuso | `69767fa` |
| **D2** · il report non conosce i componenti | aperto | — |
| Ricreare i clienti: le 619 anagrafiche attive | **già fatto** (misurato in app) | — |
| Importare le persone | **fatto 9.09**: l'import ne riporta **3.420**, il `count(*)` del 10.09 ne conta **3.419** — per la migrazione fa fede il **3.419** | `af8d945` |
| Paginazione delle letture (PostgREST tronca a 1000) | **chiuso** su `persona`, `cliente`, `incarico`, `sede` | `af8d945`, `e82169d` |
| L'ATECO mancante sul 57% delle attive | aperto, **non aspetta più**: il raccordo è a monte | `0237eaf` (nella libreria) |
| Le divisioni 30, 86, 87 | decisa in Fase 2 (`b555d67`), **rigenerata qui**: nessun livello cambia, cambia la provenienza | `3a68c13` |
| `ateco.ts` rigenerabile con un comando | **chiuso**: `node scripts/genera-ateco.mjs`, con `--check` | `3a68c13` |
| I 268 alias del gestionale, identici in tre posti | chiuso | `7d0b322` |
| `corso_alias.testo_gestionale`: il commento diceva «verbatim», e non lo è | chiuso (**064**, solo commenti), 268 testi d'origine conservati | `ede5112` |
| ATECO: **tre** stati (`noto` · `ignoto` · `incerto`), con la cella d'origine accanto al derivato | chiuso (**065**) | `3c8b84e` |
| L'ATECO mancante diventa un'azione che si chiude da sola | chiuso (**066**), chiave `cliente-ateco:<cliente_id>` | `81f6903` |
| Delega dell'art. 16: la citazione, e che quella riga parla della delega **piena** | chiuso (**067**, solo testo) | `f9f7f80` |
| Provenienza della nomina, e il dizionario dei ruoli scritti nella mansione | chiuso (**068**, schema) — l'import **resta fermo** | `8702e8a` |
| Sorveglianza sanitaria: i due export delle visite, riconciliati | chiuso | `348b6da` |
| **Consegna dell'anagrafe alla migrazione dati** di AppOverall | **consegnata** (sola lettura) | `docs/c1a/anagrafe-consegna-identita.md` |
| **Import delle nomine** · la pausa è tolta, il codice è scritto | **scritto, mai eseguito**: manca la parola di Francesco per farlo girare sui dati veri | `f296477` |
| Il dizionario dei ruoli: gli otto esiti della `0007`, rifatti qui | **chiuso**: `npm run ruoli:check` | `f296477` |
| I due conti per la migrazione dati (sola lettura) | **strumento pronto**, non eseguito: servono le credenziali | `npm run conti:migrazione` |

## Il dizionario del gestionale: verificato, e la lezione sta nella query

**11 settembre 2026.** I 268 alias del gestionale — giudizi presi a mano, uno per
uno — sono **identici in tre posti**: gli script di questo repo, il seed di
AppOverall, e il database in produzione.

| confronto | esito |
|---|---|
| simulazione dai file di questo repo ↔ seed di AppOverall | **268 = 268**, 0 solo di qua, 0 solo di là, **0 diverse** |
| seed di AppOverall ↔ database vivo | **11 valori su 11 identici** (`f94ff83`) |

Era l'ultima riserva della `0004`: il seed diceva di sé «resta da confermare
contro il database vivo, gli script ricostruiscono ciò che è stato eseguito, non
ciò che qualcuno può aver deciso dall'interfaccia dopo». Adesso è confermato.

### E la lezione, che è mia e vale più del risultato

La query che avevo scritto per il confronto era **sbagliata**, e avrebbe prodotto
un allarme falso. Era:

```sql
md5(string_agg(... , chr(10) order by testo_gestionale))
```

**Un digest su un'aggregazione ordinata non confronta due sistemi.** L'`order by`
di PostgreSQL segue la *collation* del database; il mio ordinamento in Python segue
i codepoint. Sulle stesse identiche 268 righe i due ordini differiscono in **71
posizioni**, e la stessa tabella produce **tre hash diversi** a seconda di chi la
ordina. Il primo esito è stato «hash diverso» — cioè, letto di corsa, *«qualcuno ha
ritoccato a mano 268 giudizi»*.

La forma giusta è **un'impronta per riga sommata** — la somma è commutativa,
quindi l'ordine non entra — **accompagnata da conteggi per campo**, che dicono
*dove* sta la differenza invece di dire solo che c'è.

*La mia query non era sbagliata in assoluto:* per confrontare il database **con se
stesso nel tempo** va benissimo, perché l'ordinamento è lo stesso. Era sbagliata
per confrontarlo con **un'altra implementazione**. È una distinzione che non avevo
fatto.

**Ed è la seconda volta nella stessa giornata** che un'accusa di deriva poggiava su
un confronto mai verificato: la prima erano i 40 codici del catalogo, dove «40 hash
su 40 divergono» era `4.0` contro `4`. Stesso schema, due volte, in due direzioni
diverse — e in entrambi i casi la notizia falsa era **più interessante** di quella
vera, che è il motivo per cui conviene diffidarne.

## I quattro fogli, e quale import legge quale file

Enumerazione del 10 settembre 2026, aprendo i file. **Nessuna scrittura da
nessuna parte**: l'import dei ruoli è in pausa per decisione di Francesco.

### Prima una correzione, perché l'errore era mio e istruttivo

Avevo scritto che «l'import legge `SheetNames[0]`, quindi legge solo *Fattori di
Rischio*». **Falso**, e non per una svista di lettura: avevo confrontato il
**codice** con il **file sbagliato**. Sono tre export distinti del gestionale, e
`SheetNames[0]` è corretto per ciascuno dei due che gli import aprono davvero,
perché **quei due hanno un foglio solo**.

| chi legge | file | fogli | foglio letto |
|---|---|---:|---|
| `formazioneImport.ts:190` | `ExportExcel.xlsx` — «Elenco Visite/Formazioni» | **1** | `Sheet0` |
| `anagraficheImport.ts:246` | `ExportExcel (5).xlsx` — «Risultato Ricerca Dipendenti» | **1** | `Sheet0` |
| **nessuno** | **`ExportExcel (4).xlsx`** | **4** | — |

La verità è più semplice e più grave di quella che avevo scritto: **`ExportExcel
(4).xlsx` non lo apre nessun import.** Non tre fogli su quattro — tutti e quattro.
È il file che contiene i ruoli sicurezza, i fattori di rischio e le visite mediche.

### I quattro fogli

Tutti hanno **3.501-3.502 righe** e condividono le **colonne 0-37**, cioè lo
stesso blocco anagrafico (`Società`, `Sede`, `Cognome`, `Nome`, `C.F.`, …
`Ruoli SSL`, `Mansione Safety`). Cambia solo ciò che viene dopo.

| idx | foglio | colonne | proprie | cosa contiene | entra oggi? |
|---:|---|---:|---:|---|---|
| 0 | `Fattori di Rischio` | 117 | 79 | il rischio per persona: `Agenti chimici` 121, `Posture Incongrue` 144, `Rumore` 94, `Movimentazione manuale dei carichi` 99, `Amianto` 12 | **no** |
| 1 | `Formazione` | 387 | ~349 | matrice attestati, una colonna per corso | **no** (gli attestati entrano da un altro file) |
| 2 | `Visite` | 58 | 10 | **sorveglianza sanitaria** — vedi sotto | **no** |
| 3 | `Ruoli SSL` | 47 | 9 | i ruoli con la data dell'incarico | **no** (in pausa) |

### `Visite` è sorveglianza sanitaria, e il piano non nomina questo dominio

| | | | |
|---|---:|---|---:|
| Visita Medica annuale | **670** | Visita medica quinquennale | 23 |
| Visita Medica Biennale | **106** | Visita Trimestrale | 2 |
| Esame Audiometrico | 2 | Visita medica quadriennale | 2 |
| Esame Elettrocardiografico | 1 | Visita Oculistica biennale | 1 |
| Esame Spirometrico | 1 | Visita oculistica quinquennale | **0** |

Ogni voce è una **coppia**: colonna col nome = data della visita, colonna senza
nome accanto = **scadenza**. Verificato sui valori (21.11.2025 → 21.11.2026 per
l'annuale), non dedotto dal nome.

**CORREZIONE del 10 settembre, sera: sono 808, non 818.** Il foglio ha **due**
righe di intestazione — la riga 1 porta `Ultima Esecuzione` e `Prossima Scadenza
(1 anno)` — e leggendo i dati dalla riga 1 ogni conteggio era gonfiato di
esattamente uno, dieci colonne e dieci di troppo. `Visita oculistica
quinquennale` ha **zero** righe: gli accertamenti con dati sono nove, non dieci.
Misura completa in
[`c1a/sorveglianza-sanitaria-scadenze.md`](c1a/sorveglianza-sanitaria-scadenze.md),
dove c'è anche la risposta che serviva allo schema: **la scadenza si deriva** —
796 coppie su 796 coincidono esattamente con `data + intervallo`, zero
deviazioni, e nessuna riga porta una scadenza senza la data.

Sono **808 accertamenti con scadenza** che oggi non entrano da nessuna parte. Il codice
il dominio lo conosce già — `formazioneImport.ts:13` scarta le visite dicendo che
«il loro posto è `adempimento` categoria sorveglianza» — ma quel posto non è mai
stato riempito, e la sorveglianza sanitaria (art. 41 D.Lgs 81/08) ha scadenze
proprie esattamente come la formazione.

`Fattori di Rischio` **non** è una coppia data/scadenza: la colonna porta un
testo e quella accanto è vuota. È una marcatura di presenza, non un evento datato.

### Il riscontro sull'RSPP, fatto qui e non preso per buono

`AppFormazione` aveva concluso che la colonna `RSPP` contiene in realtà il datore
di lavoro che assume l'incarico in proprio (art. 34). **Verificato su questo
workbook**, incrociando `Ruoli SSL` con `Formazione`:

| | |
|---|---:|
| marcati `RSPP` nel foglio ruoli | 31 → **28** con codice fiscale + 3 senza |
| di quei 28, quanti hanno un corso **da datore** (art. 34) | **26** |
| di quei 28, quanti hanno un **modulo professionale** A/B/C (art. 32) | **0** |
| persone nel file con i moduli professionali | 12 |
| di quelle 12, quante sono marcate `RSPP` nel foglio ruoli | **0** |

**Disgiunzione perfetta, nei due versi.** Non è un caso e non è un errore di
lettura: il gestionale usa l'etichetta «RSPP» per l'art. 34. La colonna 45 resta
fuori dall'import, e adesso con la prova invece che col sospetto.

### A9 applicata a me stesso: cosa è verificato e cosa no

- **Verificato con riscontro esterno al foglio:** la mappatura dei nove ruoli
  (contro la colonna 32) e la natura dell'`RSPP` (contro il foglio `Formazione`).
- **Verificato sui valori:** le coppie data/scadenza di `Visite`.
- **NON verificabile da qui, e va detto così:** cosa intenda chi compila il
  gestionale quando riempie `Fattori di Rischio` — se sia il rischio *valutato*
  della mansione o un'annotazione libera. Nel file non c'è nulla che lo
  distingua e nessun altro foglio lo incrocia. Non scrivo «coerente»: scrivo che
  non lo so.

  **Aggiornamento del 10 settembre, sera** — reso guardabile invece che descritto,
  in [`c1a/fattori-di-rischio-campione.md`](c1a/fattori-di-rischio-campione.md):
  dieci righe anonime scelte per essere diverse, senza nome, cognome, codice
  fiscale né data di nascita. Le celle contengono **solo `X`** (un unico valore
  distinto in tutto il foglio), nessuna colonna somiglia a un livello, e la
  copertura è di **162 righe su 3.501** in **39 società su 480**. Il fatto che
  decide: 122 righe condividono l'insieme dei fattori con un'altra, e **112 di
  quelle stanno nella stessa società ma solo 45 hanno la stessa mansione** — due
  righe della stessa azienda hanno gli stessi quindici fattori essendo una
  «ADDETTO CANTIERE - INSTALLATORE» e l'altra «ADDETTO ALLA PROGRAMMAZIONE».
  Sembra una griglia di azienda o reparto, **non** una valutazione per mansione.
  Il riscontro esterno continua a non esistere: resta scritto.

### Le domande per Francesco, che sono tre e non una

1. `Visite`: la sorveglianza sanitaria entra nel perimetro o resta fuori
   deliberatamente? Sono 818 scadenze reali già raccolte.
2. `Fattori di Rischio`: quelle 79 colonne sono il rischio valutato per persona?
   Se sì, è il dato che oggi manca per sapere quante ore di formazione specifica
   siano dovute — `livello_rischio` nullo è citato in `formazioneImport.ts:31`
   come ciò che blocca il motore.
3. `RSPP`: chi compila il gestionale sa che quella colonna raccoglie l'art. 34?
   La domanda non è se noi la leggiamo bene — quello è dimostrato — ma se il
   gestionale debba continuare a chiamarla così.

## Il database, guardato: non c'è niente da azzerare

Misurato il **10 settembre 2026** nell'SQL Editor, progetto Supabase
`AppSopralluoghi` (ref `pvbwcfrgatkqashstxjc`, `main` PRODUCTION), con soli
`count(*)`:

| | | | |
|---|---:|---|---:|
| `cliente` | **619** | `nomina` | **0** |
| `sede` | **619** | `formazione` | **0** |
| `persona` | **3.419** | `esonero` | **0** |
| — di cui marcate `anag:` | **3.419** | `adempimento` | **0** |
| — senza marcatura | **0** | `azione` | **0** |
| `corso_alias` | 268 | `incarico` · `sopralluogo` · `esito_voce` · `foto` | **0** |

Config intatta: `tecnico` 3, `corso_catalogo` 40, `figura_sicurezza` 13.

**Tutte le tabelle che `azzera_anagrafiche.sql` prende di mira sono già a zero.**
Il database è già nello stato che l'azzeramento doveva produrre — perché
l'azzeramento **è stato eseguito il 5 agosto** (`TODO.md:157`), e la nota che lo
dava per ancora da fare era la *decisione* del 3 agosto, presa due giorni prima
che venisse eseguita.

Quindi lanciarlo oggi non pulirebbe dati di prova: **cancellerebbe le anagrafiche
buone** — i 619 clienti con i 361 indirizzi e l'ATECO su 267, le 619 sedi, le
3.419 persone. Il piano Supabase è **free**, quindi nessun backup automatico:
sarebbe definitivo.

*La regola che ne esce, e che questo file già enunciava in altra forma:* uno
script distruttivo non si lancia perché il suo nome descrive l'intenzione, si
lancia dopo aver contato le righe che colpisce. La PARTE 1 di quello script esiste
apposta ed è sola lettura. Qui ha impedito un danno, non ha confermato un piano.

*E la variante nuova, che è la mia:* una nota che dice «verrà fatto» va confrontata
con la data in cui è stata fatta. Avevo consigliato «azzera prima di importare le
nomine» leggendo come impegno futuro una decisione già eseguita cinque settimane
prima. Non è stato un errore di misura — è stato non misurare affatto.

**Conseguenza sull'import dei ruoli sicurezza:** l'ostacolo dell'azzeramento non
esiste. Resta la trappola vera, che è un'altra e sta a monte — vedi
`AppFormazione/docs/07-i-ruoli-sicurezza-erano-in-un-export.md`: una colonna su
sette è mappata male, la «RSPP» contiene in realtà `datore_lavoro_rspp` (art. 34,
il datore che assume l'incarico in proprio), e la sovrapposizione fra chi ha il
corso professionale (14) e chi risultava nominato (28) era **zero**. Una nomina
che punta al ruolo sbagliato è peggio di una nomina mancante.

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

**Verificato in browser, e ha trovato un sesto punto.** Il 10 settembre, con un
ponteggio temporaneo (una pagina Vite che monta la sola `Quarantena` fuori
dall'autenticazione, con righe finte in Dexie e accanto il contenuto vero di
`outbox` e `quarantena`): nessuna credenziale, nessun dato reale, il client
Supabase non viene mai chiamato. Il ponteggio è stato tolto subito dopo, non è
in nessun commit.

Cosa si è visto davvero, non dedotto:

| prova | esito |
|---|---|
| l'elenco con tre righe di tipo diverso (upsert, allegato, cancellazione) | rende, con i nomi in italiano — «Rilievo», «Allegato attestato», «Nomina» |
| `LOCALE_MANCANTE` | **Ritenta non compare**: resta il solo Scarta |
| `Ritenta` su un upsert respinto | quarantena 6→5, e in coda compare `seq 1 · row esito_voce`: l'operazione si **sposta**, non si duplica |
| `Scarta` | chiede conferma in due tocchi, poi toglie la riga senza accodare nulla |

E la prova che conta, quella sull'annullamento: seminata in quarantena una copia
respinta di `esito_voce/X`, chiamato `rimuoviEsito('X')` — cioè il percorso vero,
non una simulazione — la copia **sparisce** e il delete resta accodato. Senza la
correzione sarebbe rimasta lì, pronta a farsi ritentare e a ricreare la riga.

**Il sesto punto, che leggendo non avevo visto.** La correzione era stata
applicata a cinque funzioni, trovate cercandole. Provandole una per una in
browser, `rimuoviAzione` (`sync.ts:107`) è risultata **ancora scoperta**: stessa
identica forma delle altre — scandisce la coda, non la quarantena — e la mia
ricerca l'aveva mancata. Ora sono sei, e l'elenco non è più frutto di una
ricerca ma di `grep -rn "db.outbox.delete\|outbox.where('kind')"`, che li
enumera tutti: cinque annullamenti in `sync.ts` (`rimuoviFoto`, `rimuoviEsito`,
`rimuoviAzione`, `rimuoviRiga`, `eliminaFormazione`), uno in `revisioni.ts`
(`annullaUpsertInCoda`), più il drenaggio stesso, che non è un annullamento.
Tutti e cinque quelli di `sync.ts` sono stati riprovati dopo la correzione:
prima 1, dopo 0.

*È la terza volta che questo repo scrive la stessa nota.* Le colonne di un
export si enumerano invece di indovinarle; le letture non paginate erano cinque
e non una; i punti che annullano un'operazione sono sei e ne avevo letti cinque.
La differenza, stavolta, è che a trovarlo non è stata una rilettura: è stato
farlo girare.

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

## L'11 settembre, in 19 commit: cinque migrazioni e due domande chiuse

Tutto in **sola lettura sui dati**: le migrazioni di quel giorno aggiungono una
colonna e per il resto scrivono *commenti*. Nessuna riga di produzione toccata.

### L'ATECO: da «manca sul 57%» a tre stati distinti

| | |
|---|---|
| **Cosa abbiamo** (`5595601`) | **262 divisioni** nell'export, **tutte** risolvono contro la libreria, e il livello di rischio è **derivato** — non trascritto |
| **I cinque mancanti** (`154cbcf`) | non sono cinque codici persi: sono **cinque descrizioni senza codice**, e il sesto caso è un **CAP** finito nella colonna sbagliata |
| **Le celle multi-codice** (`56ae424`) | quando la cella porta più di un codice, la scelta decide anche il **livello**: due clienti, **trenta lavoratori** |
| **I tre stati** (`3c8b84e`, mig. **065**) | `noto` · `ignoto` · **`incerto`** |

Il terzo stato è il punto, ed è una cosa che questo repo non sapeva dire. La
derivazione (`risolviAteco` prende il primo gruppo di 1-2 cifre) è giusta **261
volte su 262**, e la cella d'origine non veniva conservata: della 262esima non
restava niente con cui accorgersene. In archivio un `37` derivato male sta scritto
**identico** a ogni divisione giusta — lo distingue solo il confronto con la cella.

Quindi `cliente.ateco_origine` non è un campo di comodo: **è ciò che rende
esistente lo stato `incerto`**. Senza, il difetto non si ripara — si sposta.

E l'ATECO che manca adesso **si chiede da solo** (`81f6903`, mig. **066**): diventa
un'azione con chiave `cliente-ateco:<cliente_id>`, nella stessa colonna
`azione.origine_requisito_key` già riconciliata, **perché deve chiudersi da
sola** quando la cella arriva — senza che nessuno la spunti. Il prefisso serve a
distinguerla dall'altra forma senza doverci provare: davanti ai due punti c'è un
uuid di *persona* nella prima, un id di *cliente* nella seconda.

### Il dizionario: il commento diceva «verbatim», e non lo era

`corso_alias.testo_gestionale` era documentato dalla `055` come «la stringa esatta
esportata». **Falso su 211 righe su 268** (`a997859`): ciò che ci finisce dentro
passa da `normalizzaTestoGestionale` — maiuscolo, spazi collassati, niente spazi
ai bordi. E' una **chiave normalizzata per costruzione**.

La `064` (`ede5112`) corregge il commento e **non tocca una riga di dati**, e i 268
testi d'origine sono conservati in `docs/c1a/alias-testi-origine.json`. La ragione
per cui vale un commit: quel commento aveva già fatto sbagliare qualcuno, e una
descrizione di schema falsa costa più di una colonna mancante — perché chi la
legge non ha modo di sospettarla.

### Le nomine: progettate, e ferme

Il progetto dell'import (`7820c90`) parte da un requisito che non è tecnico: **il
sistema deve poter dire di non aver capito**. E la misura che lo giustifica
(`8dab00a`) è la più scomoda della giornata:

| | |
|---|---:|
| righe con un ruolo nelle **colonne** | 153 |
| righe con un ruolo nella **mansione**, in testo libero | 160 |
| in entrambi | 12 |
| **unione** | **301** |

**Le colonne dichiarano il 51% dell'organigramma.** Le altre **148 righe** hanno
il ruolo scritto dentro un campo libero, in **29 forme diverse** su 108 società.
Una nomina letta dalla colonna è *dichiarata* e porta una data d'incarico; una
letta dalla mansione è *dedotta* e non ne ha nessuna — e la `068` (`8702e8a`)
scrive la provenienza accanto al dato **perché senza di essa la seconda non è
più rivedibile**.

Sulla `067` (`f9f7f80`) c'è anche una correzione mia: avevo scritto il contrario
del vero sull'art. 16 (`2b51eef`). L'articolo **non nomina mai la formazione** —
l'obbligo del delegato non nasce li', e la `053` ci arrivava per convergenza, non
perché la delega lo prevedesse. La riga parla della delega **piena**.

### Le visite: le due misure erano a cinque settimane di distanza

E' la sequenza in cui mi sono smentito due volte, ed è bene che si legga in
quest'ordine (`bfdbb6b` → `f2b4353` → `be703ec` → `348b6da`):

1. le nove date che non tornavano **non sono richiami anticipati del medico**.
   Sette sono aritmetica su una **fotografia più vecchia** — lo scadenzario
   dichiara i dati al 06/08, il foglio al 09/09;
2. la fonte che lo dimostra è l'export delle visite **fatte**, che esisteva e che
   non avevo cercato. Con lo storico invece dell'ultima esecuzione, la scadenza è
   derivabile **791 volte su 793**;
3. quindi «riscaricare non allinea» era **troppo forte**, e i due file nuovi hanno
   un nome: `ExportExcelVisiteFatte.xlsx` e `ExportExcelVisiteScadute.xlsx`.

`PIANIFICATA` non marca un appuntamento: marca le **dieci** righe che non derivano
da nessuna esecuzione — persone mai visitate, tutte della stessa società. E'
l'unico posto dove una scadenza esiste **senza un fatto dietro**.

### E due misure che dicono «oggi non morde»

- **Il modulo di settore** (`f1184f6`): oggi non morde su **nessuno**, ma mordera'
  al primo import su **quattro**.
- **Spazi confinati** (`b0f630c`): **zero** aggiornamenti erogati, e il catalogo ne
  dichiara **due** durate. Quattro aggiornamenti per quattro platee sotto un codice
  solo — è la forma di «manca la separazione dei corsi», non quella di un obbligo
  pronto.
- **Le 31 righe** (`40ca5bc`) sono **quattro aziende**, otto clienti stanno sopra i
  50 dipendenti, e i due titoli sono a zero.

## La consegna dell'anagrafe alla migrazione dati (12 settembre)

Chiesta da AppOverall, **sola lettura**, in
`docs/c1a/anagrafe-consegna-identita.md`. Blocca il loro passo, perché
`sorveglianza.persona_id` deve puntare a persone che nel repo unico non esistono
ancora, e una migrazione dati **non può inventarsi una chiave** dove la fonte non
ce l'ha.

**Cosa attraversa:** 619 clienti, 619 sedi, 3.419 persone — queste ultime tutte
marcate `anag:`.

**La regola, in una riga:** l'identità di una persona è la coppia **(cliente,
codice fiscale)**; senza codice fiscale è **(cliente, cognome+nome)**, e solo
finché quel nome è univoco **sia nell'archivio sia nel file**; senza nemmeno il
nome la chiave non esiste e la riga resta `riga:N`, cioè nuova ogni volta.

**E il fatto che conta più della regola:** `import_key` contiene
`cliente.id`, che è un **uuid generato da questo database**. Se di la' i 619
clienti rinascono con uuid nuovi, tutte e 3.419 le chiavi puntano a un id che non
esiste — e **non danno errore**: restano stringhe valide che non agganciano
niente, e il secondo import ricrea tutto. O attraversano gli uuid, o attraversa
una tabella di corrispondenza.

Altre tre cose consegnate come **avvertenze**, non come dati:

- **il CF dentro la chiave non è validato.** `cfPulisci` ripulisce e basta;
  `valido()` esiste, è importata, e serve solo all'avviso a schermo. Corretto per
  l'idempotenza, **non** una garanzia di qualità — e le visite sono indicizzate
  **per CF**, quindi una chiave con dentro una stringa che CF non è aggancia la
  persona e non agganciera' mai la sua visita;
- **i clienti attraversano senza chiave.** `import_key` sta su `persona`,
  `formazione` e `adempimento`, **non** su `cliente`: dei 619 non resta scritto da
  dove vengono. Va deciso **prima** che attraversino, perché dopo l'id sarà già
  cambiato;
- **le 619 sedi sono un riflesso, non un secondo insieme**: la `054` ne crea una
  per cliente copiando la sede legale, e `persona.sede_id` oggi vuol dire «il
  cliente» detto in un altro modo. Il sito produttivo non è mai stato importato.

**E due numeri che ho lasciato non tornanti invece di aggiustarli** — 235 contro
233 righe senza CF (227 + 6 = 233, e le 2 di differenza *sembrano* le righe
scartate senza nome, ma il file non c'è più per confermarlo), e 3.420 scritte
contro **3.419** contate il giorno dopo. Per la migrazione fa fede il 3.419, che
è una misura sul database.

**Due cose da misurare prima di migrare, e non le ho potute fare io**: quante
delle 3.419 chiavi portano un CF non valido (serve il database, qui non c'è
`.env.local`), e quante delle 160 righe col ruolo nella mansione hanno il CF
(serve il file, che su questa macchina non c'è). Le query stanno nel documento.

## L'import delle nomine: scritto, e non eseguito su niente (12 settembre, sera)

La pausa l'ha tolta Francesco. Il codice c'è (`f296477`); **non è mai girato su
dati veri**, e il permesso di farlo girare non è stato chiesto a un relay — un
ordine si relaia, il permesso di scrivere su un database senza backup no.

**Come è fatto.** La regola sta da sola in `src/lib/admin/ruoliTesto.ts`, senza
database e senza React, perché così si può provare: `npm run ruoli:check` rifà gli
**otto esiti** che la `068` dichiara di aver riprodotto dalla `0007` di AppOverall
— `dl_rspp` 81, `addetto_antincendio` 47, `datore_lavoro` 22, non risolte 7,
`preposto` 6, `rspp` 3, `aspp` 1, `dirigente` 1 — più i due totali, 168 asserzioni
su 160 righe. **Passa.** Il corpus non è inventato: è ricostruito dalle grafie
verbatim e dai conteggi che il seme porta in `note`, **letti dal file della
migrazione** invece che ricopiati.

### Tre cose trovate scrivendolo, che valgono più del codice

**1. Il seme della `068` dichiarava 34 asserzioni, e sono 32.** La coppia
`('RSPP/TITOLARE','rspp')` compariva **tre volte**: 34 erano le righe letterali
dell'`insert`, non le asserzioni. Le due in più non scrivevano niente
(`on conflict do nothing`), quindi **il database era già giusto** e la correzione
non cambia un dato — cambia il numero che qualcuno conterebbe per accorgersi che
i due dizionari sono divergenti. *Una tabella che esiste per essere contata non
può dichiarare un totale che non è il suo.*

**2. L'azione «ruolo da chiarire» sarebbe sparita al primo ricalcolo.** La
spazzata degli orfani in `backfillAzioniEsoneri` cancella **ogni** azione del
cliente la cui `origine_requisito_key` non sia fra le attese. La chiave
`nomina-forma:` non c'era: le righe «il sistema non ha capito questo ruolo»
sarebbero state scritte dall'import e **cancellate in silenzio** dal primo
`sincronizzaScadenzarioCliente` — cioè esattamente il difetto che quelle righe
esistono per non fare. Ora passano dalle attese, **protette e non riscritte**, e
la condizione di sopravvivenza è quella del progetto: finché quella persona non
ha nessuna nomina. Appena ce l'ha, la spazzata la chiude **da sola**.

**3. `leggiFoglio` leggeva sempre `SheetNames[0]`.** Ora accetta un nome di
foglio. `ExportExcel (4).xlsx` ha quattro fogli e i primi due hanno le **stesse**
colonne anagrafiche del quarto: il riconoscimento automatico avrebbe detto
«elenco persone» con ottime ragioni, leggendo il foglio sbagliato. È la lezione
del 10 settembre applicata **prima** invece che dopo.

### Le decisioni conservative, dette perché si possano ribaltare con una riga

Delle nove colonne di ruolo ne entrano **sei**. Restano fuori:

| colonna | righe | perché |
|---|---:|---|
| `RSPP` | 31 | il gestionale ci mette anche il datore dell'art. 34 — mandarle a `rspp` darebbe il percorso del professionista invece di quello del datore |
| `Addetti Emergenze ed Evacuazione` | 71 | **non è `addetto_antincendio`, ed è misurato**: 24 delle 71 hanno emergenze *senza* antincendio, e delle 47 che hanno entrambe solo 32 portano la stessa data. Collassarle sarebbe falso su 24 righe e imporrebbe di scegliere una data sulle altre |
| `Responsabile Emergenze` | 35 | un responsabile non è un addetto, e nessuna delle tredici figure corrisponde |

Sono **elencate nell'anteprima con il loro perché**: una colonna esclusa e non
nominata è indistinguibile da una dimenticata, ed è già successo due volte su
questo stesso file.

**E le tre non stanno fuori per la stessa ragione — la distinzione è di
AppOverall e la tengo, perché cambia cosa succederà a queste righe.**

- `RSPP` è fuori per un **fatto dimostrato**: quella colonna contiene anche il
  datore dell'art. 34, e la prova sta negli attestati. Non c'è una domanda aperta,
  c'è una domanda a monte — *chi compila il gestionale*.
- `Addetti Emergenze ed Evacuazione` è fuori per una **deduzione smentita dai
  dati**, misurati da AppFormazione l'11 settembre e verificati qui il 12 leggendo
  il loro file (`AppFormazione/docs/07-…`), non il riassunto. Non è «non ho voluto
  dedurre»: è «la deduzione è falsa su 24 righe». *Una riga che dice questo non si
  riapre fra un mese.*
- `Responsabile Emergenze` è fuori per un **argomento**, non per una misura: un
  responsabile non è un addetto, e nessuna delle tredici figure corrisponde. È
  l'unica delle tre che regge da sola senza dati dietro.

Le prime due **non** sono una domanda per l'Area Formazione: sono chiuse. Quel
che resta aperto è semmai se serva una **figura nuova** per le emergenze, che è
un'altra domanda.

**Decisione di Francesco, 12 settembre sera:** le tre restano fuori, e l'import
**lo esegue lui** dal back-office. Questa sessione non lo fa girare.

E il ripiego cognome+nome è **acceso**, con le due guardie dell'import anagrafiche
e non una in meno. Senza, si perdevano 19 incarichi e il **100%** dell'unico ASPP.

### Due cose sul dizionario, sapute confrontandolo con il loro

**Il 34 contro 32 non era una divergenza, e per poco non diventava un allarme.**
Le due tabelle contano **grane diverse**: la loro `ruolo_testo` ha per chiave il
*testo verbatim* (34 asserzioni su 29 grafie), la nostra la *chiave normalizzata*
con le grafie dentro `varianti[]` (32 su 27). Collassando le loro per chiave
vengono 32 — **dicono la stessa cosa**. Quindi la correzione qui sopra è giusta
per la nostra tabella e il loro 34 è giusto per la loro, e la regola che ne esce è
scritta in testa a `ruoli-testo-check.mjs`: **il confronto fra i due dizionari si
fa sugli esiti e sulle chiavi, mai sui totali di riga.**

**Una divergenza vera c'è, ed è `posizione`: cinque da noi, sei da loro.** Loro
tengono separati `datore` — la frase lo dice con quelle parole — e `titolare`, che
lo dice per via del titolo; il nostro `titolare_socio` li **fonde**, e quella
distinzione non sa tornare indietro. Non si ripara qui: la nostra tabella è
caricata e la loro no, e il posto dove si decide è la loro `0010`.

**E qui il nome ha fatto danno, quindi va scritto prima della prossima persona che
lo legge.** `titolare_socio` *sembra* fondere `titolare` con `socio`, e AppOverall
l'ha letto così — concludendo che fonde un valore che **risolve** con uno che **si
astiene apposta**, cioè che sarebbe ambiguo esattamente sul confine art. 34 /
art. 32.

*Ritirata la sera stessa, e non è mai arrivata in un file:* viveva in un messaggio,
è stata fermata in un'ora, e la loro `0010` non si è mossa — le sei posizioni
erano già caricate per un'altra ragione, che la misura qui sotto **conferma**.
Resta scritta perché il nome che l'ha prodotta è ancora quello, e la prossima
persona lo leggerà allo stesso modo.

**Misurato sul seme, non è così.** Nessuna combinazione `(posizione, ruolo)` fa
tutte e due le cose:

| posizione | ruolo | esito |
|---|---|---|
| `socio` | `rspp` | **si astiene 2 su 2** |
| `non_dichiarato` | `rspp` | **si astiene 2 su 2** |
| `titolare_socio` | `rspp` | risolve **14 su 14** → `dl_rspp` |
| `titolare_socio` | `datore_lavoro` · `aspp` | risolve **6 su 6** |

`socio` **è un valore suo e si astiene**, come da loro; le sette righe non risolte
vengono da lì e da `non_dichiarato`. Quel che `titolare_socio` fonde sono i loro
**due valori che risolvono allo stesso modo** — quindi si perde la *provenienza*
dell'asserzione (come si è saputo che è il datore), non l'*esito*. **Il confine
dell'astensione è intatto.**

> Terza volta in una giornata che un numero o un nome fa vedere una divergenza che
> non c'è. Le prime due erano totali; questa è **un'etichetta**, e il rimedio non è
> lo stesso — un totale si confronta meglio, un nome va cambiato o spiegato. Qui è
> spiegato, perché la tabella è caricata.

*E una cosa su `posizione` che riguarda solo noi:* la `068` la descrive come «il
meccanismo che fa risolvere `RSPP/titolare` in `dl_rspp`», ed è vero di come il
seme è stato **costruito**, non di come viene **letto** — la destinazione è già
incisa in `ruolo_testo_figura`, e l'import non guarda `posizione` per decidere
niente. Oggi è documentazione della regola, non un suo ingresso.

### Cosa è verificato, e cosa no

`ExportExcel (4).xlsx` non è su questa macchina. Ma `ExportExcel.xlsx` **sì** — è
lo stesso export, del **24/12/2023**, e ha lo stesso foglio `Ruoli SSL`. Ci gira
sopra `npm run nomine:dryrun <file>`, sola lettura e senza database:

| | |
|---|---|
| foglio `Ruoli SSL` trovato **per nome** | sì |
| intestazioni | riga **2** — la stessa dell'export 2026 |
| righe di dati | 2.462 |
| **colonne di ruolo che agganciano** | **9 su 9** |
| righe con una mansione | 1.811 |

**Quindi il plumbing regge su un foglio vero**: il foglio si apre, l'intestazione
si riconosce, e tutte e nove le colonne si trovano per nome — comprese le tre che
restano fuori, che vengono contate e dichiarate invece che ignorate.

**Cosa resta non verificato, e sono due cose diverse.** I *numeri* del 2026: quel
file ha un'altra data e altri dati, quindi non dice niente sulle 153 righe né sulle
160. E il *dizionario applicato ai dati veri*, che ha bisogno del database.

> Le due prove coprono metà ciascuna e falliscono in modi diversi:
> `ruoli:check` prova la **regola** su un corpus dichiarato, `nomine:dryrun` prova
> il **foglio** su un file vero. Una regola giusta su un foglio che non si apre non
> importa niente; un foglio che si apre con una regola sbagliata importa il dato
> sbagliato.

## I due conti per la migrazione dati: strumento pronto, non eseguito

Chiesti da AppOverall dopo la decisione sull'uuid (loro `0013`), e nascono da un
fatto che **nessuno dei due documenti diceva**: le due tabelle `persona` non sono
la stessa tabella. Qui è **per cliente**; di là `codice_fiscale` è unique
**globale** e il legame col cliente vive in `rapporto_lavoro`. Quindi la
migrazione non è una copia, è un **cambio di grana** — e `anag:<cliente>:<cf>` non
è l'identità di una persona: è l'identità di **una persona presso un cliente**,
che di là ha già un nome.

I due conti misurano due fusioni che sbagliano in **versi opposti**:

1. **stesso CF valido su più clienti** — righe che *vanno* fuse;
2. **senza CF, omonimi nello stesso cliente** — righe che *non* vanno fuse: qui si
   arrendono a `riga:N` e restano separate, di là diventerebbero una persona sola
   e nessuno lo vedrebbe.

`npm run conti:migrazione` li fa tutti e due, **in sola lettura**. È uno script e
non due query perché **la validità di un codice fiscale non si calcola in SQL**:
serve il carattere di controllo, e una query che filtra per *forma* e la chiama
«valido» è lo stesso scivolamento di `cfPulisci` contro `valido`. Lo script usa la
funzione di produzione e stampa **tutti e due** i conti, così la differenza si vede
invece di doverla credere.

**Non è stato eseguito**: su questa macchina non c'è `.env.local`. Senza
credenziali si ferma e lo dice, invece di stampare uno zero.

## Il confronto sulle ore non ha una finestra temporale (12 settembre, sera)

Segnalato da AppOverall con una fonte, e **verificato qui nel codice** invece che
accettato: c'è un punto in cui un attestato del 2011 viene confrontato con
un'attesa del 2025, ed è `formazioneImport.ts:527`.

```ts
else if (dovute != null && r.ore != null && r.ore < dovute) out.oreInsufficienti.push(v);
```

`dovute` viene da `corso_catalogo`, che porta **l'attesa di oggi**. Nessuna
finestra temporale, nessun confronto con la data dell'attestato.

**La norma dice che quel confronto non va fatto.** ASR 2025, Parte VII pag. 112:
*«per i preposti sono fatti salvi i percorsi formativi effettuati in vigenza
dell'accordo del 21 dicembre 2011, per i quali è riconosciuto **credito formativo
totale**»*. Sono **276 righe da 8 ore** — contro un'attesa di 12 — e la stessa
clausola vale due sezioni sopra per **lavoratori e dirigenti**.

**Ma la portata è più piccola di come suonava, e va detto.** Non è il motore che
dichiara scoperto un requisito: è **l'anteprima dell'import** che mette la riga in
un elenco «da guardare». L'attestato entra comunque. L'unico altro confronto sulle
ore (`componiSpezzoni`, `:660`) tocca solo gli **spezzoni** — righe `parziale` —
e lì la soglia è il senso stesso del meccanismo.

Quindi **oggi non produce un dato falso: produce rumore**. E 276 voci false in una
lista «da guardare» insegnano a non guardarla, che è il modo in cui un avviso
diventa peggio del proprio silenzio.

**Non è riparato, e non per prudenza:** il dato per farlo non c'è. Servirebbe la
**validità temporale sul catalogo** (scheda 12), che qui non abbiamo. È annotato
alla riga, con la citazione e con la regola: *quando la validità temporale arriva,
è quella riga a doverla consumare* — confronto contro l'attesa in vigore **alla
data dell'attestato**, e nessun confronto dove la norma riconosce credito totale.

## Le 30 righe «PREPOSTI - BIENNALE»: la risposta c'era, e il mio documento non torna con sé

AppOverall ha chiesto come sia valorizzato `is_aggiornamento` su quelle righe.
**La misura esiste dall'11 settembre** (`c15feab`,
`docs/c1a/preposto-un-codice-tre-corsi.md`) e la risposta è
**`is_aggiornamento = false`** — sono marcate **iniziali**.

Ma rileggendolo per rispondere, **quel documento si contraddice su due punti**, e
nessuno dei due è cosmetico:

| dove | dice |
|---|---|
| sezione di dettaglio | «**Tutte e trenta**», e due date sole: 5 il 20.05.2024, 25 il 05.09.2024 |
| tabella riassuntiva | «**31**» righe, con intervallo **2024-05 → 2025-12** |
| «cosa non decido» | «`is_aggiornamento = false` su tutte e **31**» |

**30 contro 31, e due date contro un intervallo che arriva a dicembre 2025.** Non
è un dettaglio: la frase che regge tutto il ragionamento è *«non è una popolazione
diffusa nel tempo: sono due aule»*. Se la 31ª riga è a dicembre 2025, **non sono
due aule**, e l'argomento cambia.

Non lo posso risolvere: l'export non è su questa macchina. Va ricontato da chi ce
l'ha, **prima** che «due aule» entri in un ragionamento come premessa.

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
- **Cosa dobbiamo all'altra corsia:** niente di **aperto**. La consegna
  dell'anagrafe, che era l'unica cosa che bloccava il loro passo, è stata fatta
  il 12 settembre — `docs/c1a/anagrafe-consegna-identita.md`. Quel che resta di la'
  è una **decisione**, non un lavoro di qui: se i 619 clienti attraversano il
  confine con gli **stessi uuid** o con una **tabella di corrispondenza**. Le
  chiavi delle 3.419 persone valgono nel primo caso alla lettera, nel secondo solo
  se vengono riscritte in migrazione.

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

**E una riga aggiunta il 12 settembre, pagata.** «Sullo stesso disco» non vuol
dire «aggiornati»: il 12 questa macchina aveva tre repo indietro di due giorni, e
il comando qui sopra avrebbe risposto con sicurezza **il falso** — non un errore,
un elenco di commit vero e incompleto. Prima di leggere lo stato di una corsia si
guarda **quando quella copia è arrivata**:

```
git reflog -3 --date=iso                      # quando ho fatto l'ultimo pull
git log --oneline origin/main..HEAD           # cosa ho e loro no
git fetch && git log --oneline HEAD..origin/main   # cosa c'è e io non ho
```

La forma dell'errore è quella di sempre in questo repo: **una risposta plausibile
è peggio di una mancante.**
