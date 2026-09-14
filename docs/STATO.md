# Stato della Fase 0 — questa corsia

**Come si legge.** Il piano dei lavori sta in un posto solo:
**`AppOverall/docs/PROGRAMMA.md`** dal 9 settembre — in `AppFormazione` ne resta un
puntatore, non una copia — reso su
https://claude.ai/code/artifact/8116d53d-6944-4ce0-a9c0-29a1e072d763. Quello dice
**cosa** va fatto. Questo file dice **a che punto è** ciò che tocca a questo repo,
e lo dice qui perché è qui che si lavora — le caselle le riempie chi le chiude.

L'altra corsia legge questo file, non deve chiederlo. Aggiornato quando qualcosa
si chiude, con l'hash del commit accanto: se manca l'hash, non è chiuso.

Ultimo aggiornamento: **14 settembre 2026, pomeriggio** — **D2 è pubblicato**
(app `e33efc2`, Edge Function `genera-report` v9) e si chiude con un report vero.
**La Qualifica come fonte distinta e la `070` sono pronte sul ramo
`qualifica-fonte-distinta`** (`d849073`), insieme alla riparazione di
`pivaUsabile` (`5fb57ab`): non pubblicate, e l'ordine è scritto in
[«La Qualifica come fonte distinta»](#la-qualifica-come-fonte-distinta-e-la-piva-segnaposto-14-settembre-pomeriggio).
Prima ancora, D2 era stato preparato sul ramo `d2-report-componenti`
(`6532500`). Prima,
**le nomine sono state scritte** da
Francesco: la rilettura dà 0 da creare e 364 già in organigramma. Prima ancora
**l'anteprima era stata vista** senza scrivere: 364 da creare, 153 da
decidere, 4 persone non trovate, e il conto **torna figura per figura** rifatto dal
file e dal seme della `068`. Vedi
[«L'anteprima delle nomine»](#lanteprima-delle-nomine-vista-da-francesco-e-il-conto-torna-14-settembre).

13 settembre 2026 — misurato il livello della
produzione: **la `068` non è applicata**. Vedi
[«Il livello della produzione»](#il-livello-della-produzione-la-068-non-cè-13-settembre).
E misurati i due conti della migrazione dati: **N = 3.415**. Vedi
[«I due conti»](#i-due-conti-per-la-migrazione-dati-misurati-il-13-settembre).

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
| **D2** · il report non conosce i componenti | **pubblicato il 14.09, da chiudere con un report vero**. Voci per id, esiti raggruppati per box, sezione e componente nell'ordine del campo; `npm run report:check` 11 su 11, 9 falliti sulla versione precedente. **Online, per canale:** l'app (Vercel) è a `e33efc2`, stato GitHub `success`, bundle `index-BSYYMtW7.js` (prima `index-7vqDM7i-.js`) senza il conteggio vecchio; l'Edge Function `genera-report` è alla **v9** (10:05:57 UTC), pubblicata con la CLI dal codice di `e33efc2`, e i tre file scaricati risultano identici a `e33efc2`; la v8 era identica a `main` prima di D2, quindi non si è perso niente fatto dal Dashboard. **Si chiude** quando Francesco guarda un report vero su un sopralluogo con box e componenti | `6532500`, merge `e33efc2` |
| Ricreare i clienti: le 619 anagrafiche attive | **già fatto** (misurato in app) | — |
| Importare le persone | **fatto 9.09**: l'import ne riporta **3.420**, il `count(*)` del 10.09 ne conta **3.419** — per la migrazione fa fede il **3.419** | `af8d945` |
| Paginazione delle letture (PostgREST tronca a 1000) | **chiuso** su `persona`, `cliente`, `incarico`, `sede` | `af8d945`, `e82169d` |
| L'ATECO mancante sul 57% delle attive | aperto, **non aspetta più**: il raccordo è a monte | `0237eaf` (nella libreria) |
| Le divisioni 30, 86, 87 | decisa in Fase 2 (`b555d67`), **rigenerata qui**: nessun livello cambia, cambia la provenienza | `3a68c13` |
| `ateco.ts` rigenerabile con un comando | **chiuso**: `node scripts/genera-ateco.mjs`, con `--check` | `3a68c13` |
| I 268 alias del gestionale, identici in tre posti | chiuso | `7d0b322` |
| `corso_alias.testo_gestionale`: il commento diceva «verbatim», e non lo è | **scritta** (**064**, solo commenti), 268 testi d'origine conservati — **applicata il 13.09 da SQL Editor**, passata nella transazione 064-068: non misurabile | `ede5112` |
| ATECO: **tre** stati (`noto` · `ignoto` · `incerto`), con la cella d'origine accanto al derivato | scritta e **applicata** (**065**, già presente al 13.09; ripassata nella transazione 064-068) | `3c8b84e` |
| L'ATECO mancante diventa un'azione che si chiude da sola | **scritta** (**066**, solo un commento), chiave `cliente-ateco:<cliente_id>` — **applicata il 13.09 da SQL Editor**, passata nella transazione 064-068: non misurabile | `81f6903` |
| Delega dell'art. 16: la citazione, e che quella riga parla della delega **piena** | **scritta** (**067**, solo testo) — **era già applicata, non si sa quando**: il controllo prima del 13.09 ha trovato i due testi identici parola per parola; ripassata senza effetto | `f9f7f80` |
| Provenienza della nomina, e il dizionario dei ruoli scritti nella mansione | **applicata il 13.09 da SQL Editor**, misurata con `livello:produzione`: 27 chiavi, 32 asserzioni. **Ma le due tabelle risultano con RLS e senza policy**: la anon legge 0 righe — vedi `069` | `8702e8a` |
| **069** · RLS e `staff_full` su `ruolo_testo` e `ruolo_testo_figura`, come tutte le altre tabelle | **applicata il 13.09 da SQL Editor** (riletta da AppOverall). **Prima**: RLS attive e **0 policy** su tutte e due (`corso_alias`: 1). **Dopo**: RLS attive e `staff_full` su tutte e tre; con la anon ancora 0 righe senza errore. Lettura da back-office: da verificare | `46105df` |
| **Guardia sul dizionario vuoto** in `caricaDizionarioRuoli`: zero righe è sempre un errore, mai un dizionario vuoto | **fatta**: `npm run dizionario:check` 3 su 3; senza la guardia (`e18f8c5`) 1 su 3 | `5de8965` |
| Sorveglianza sanitaria: i due export delle visite, riconciliati | chiuso | `348b6da` |
| **Consegna dell'anagrafe alla migrazione dati** di AppOverall | **consegnata** (sola lettura) | `docs/c1a/anagrafe-consegna-identita.md` |
| **Import delle nomine** · la pausa è tolta, il codice è scritto | **anteprima vista il 14.09**, da Francesco dal back-office e **senza scrivere**, sul codice di `12b1768` (quello del deploy verificato in `033994a`). La guardia non si è fermata: **364** da creare (198 dalle colonne, 166 dalla mansione), **153** da decidere, **4** persone non trovate, **0** già in organigramma, 4 unità del file non abbinate. **Riconciliata fuori dal database figura per figura** con il file e il seme della `068`: tutti i numeri coincidono. **Scritto da Francesco il 14.09**, sullo stesso codice: il deploy di `d8a7cc7` tocca solo questo file. La rilettura dà **0** da creare, **364** già in organigramma, 153 da decidere e 4 persone non trovate. Le 364 proposte sono 363 coppie persona+figura: vedi la sezione del 14. Resta un difetto di conteggio, non di dati: `riepiloga` non toglie i doppioni | `f296477`, `12b1768` |
| Il dizionario dei ruoli: gli otto esiti della `0007`, rifatti qui | **chiuso**: `npm run ruoli:check` | `f296477` |
| I due conti per la migrazione dati (sola lettura) | **misurati 13.09** (service_role, prima dell'import nomine): **4** CF validi su due clienti → **N = 3.415**; **0** omonimi senza CF nello stesso cliente. Aperti: 31 CF non validi, 228 contro 235 | `d12196a` |
| **Ripiego sul nome**: al secondo import due omonimi senza CF finiscono sulla stessa scheda, e la seconda resta orfana (`anagraficheImport.ts:733-763`) | **riparato** (`bb141ee`), poi **(a) decisa da Francesco il 13.09**: il nome ambiguo **non si scrive**, va fra i «da abbinare a mano» e l'import resta idempotente (`npm run omonimi:check` 8 su 8; su `bb141ee` A4 dà 2 poi 4). Abbinamento guidato: **manca**. Misura 13.09: **0 orfane**, 228/228 con chiave per nome, 0 omonimi. L'import del 9.09 non si ricostruisce: 3.420/3.419 e 235/228 **non spiegati per sempre**, il file non esiste più | `bb141ee`, `e18f8c5` |
| **Livello della produzione** · a che migrazione è il database | **13.09, prima**: `068` no · **dopo l'applicazione**: `061`-`068` presenti; `064` `066` non misurabili; `067` c'era già. Misura l'**esistenza**, non la leggibilità | `d4aeefe` |

## L'anteprima delle nomine: vista da Francesco, e il conto torna (14 settembre)

**Chi, dove, su cosa.** Francesco, dal back-office, il 14 settembre: gruppo
*Anagrafiche* → *Import nomine*, file `ExportExcel (4).xlsx` del 9 settembre,
**senza premere «Scrivi»**. Il codice è quello di `12b1768`, il deploy verificato in
`033994a`: fra i due cambia solo questo file. Da quando c'è il deploy, questa
corsia non ha lanciato né l'anteprima né la scrittura.

**Cosa ha detto la schermata:**

| conto | valore |
|---|---|
| nomine da creare | **364** — 198 da una colonna (con la data), 166 dalla mansione (senza data) |
| da decidere | **153** |
| persone non trovate | **4** |
| già in organigramma | **0** |
| unità del file non abbinate a un cliente | **4** (GIARDINAGGIO ADAMI 1 riga, IGEA SRL 13, LA TORRE 6, Progetto EMERA 2) |
| mansioni che il dizionario non conosce | **593** |

La guardia sul dizionario vuoto (`5de8965`) **non si è fermata**, e 166 nomine
dalla mansione vuol dire che il dizionario arriva al back-office. Ma «arriva»
non vuol dire «arriva tutto»: se ne arrivasse metà, i numeri sarebbero più bassi
e comunque diversi da zero.

**Per questo il conto è stato rifatto fuori dal database.** Il seme della `068` è
stato letto dal file della migrazione, con lo stesso parsing di `ruoli:check`, e
applicato con `risolviMansione` alle 3.501 righe del foglio. Poi sono state tolte
le righe che l'anteprima non poteva prendere: le 4 unità non abbinate e le 4
persone non trovate. Nessuna scrittura, nessuna rete. Lo script è rimasto nella
scratchpad della sessione e non è nel repo.

| figura | colonna | mansione | totale | anteprima |
|---|---|---|---|---|
| `addetto_antincendio` | 77 | 47 | 124 | 124 |
| `addetto_primo_soccorso` | 83 | 0 | 83 | 83 |
| `dl_rspp` | 0 | 83 | 83 | 83 |
| `preposto` | 25 | 6 | 31 | 31 |
| `datore_lavoro` | 0 | 24 | 24 | 24 |
| `rls` | 10 | 0 | 10 | 10 |
| `dirigente` | 2 | 2 | 4 | 4 |
| `rspp` | 0 | 3 | 3 | 3 |
| `aspp` | 1 | 1 | 2 | 2 |
| **totale** | **198** | **166** | **364** | **364** |

Anche i **153 da decidere** tornano: 135 dalle colonne escluse, 18 dalla mansione.
Le righe escluse portavano altre 5 nomine (4 da colonna, 1 `dl_rspp` da mansione) e
3 da decidere. **Il back-office legge dal dizionario di produzione le stesse
asserzioni che il seme dichiara**, almeno per le chiavi che questo file usa.
Questa prova non verifica le 27 chiavi una per una.

Il confronto con gli otto esiti della `0007` (dl_rspp 81, antincendio 47,
datore 22…) **non si fa su questi numeri**. Quelli sono contati sul database di
AppOverall dopo il carico, questi sono righe del foglio con delle esclusioni: la
stessa trappola delle «grane diverse» scritta in `scripts/ruoli-testo-check.mjs`.
Da qui non è indagato.

**Cosa ha fatto vedere. Niente di questo blocca la scrittura:**

1. **Il pulsante dice «Scrivi 364 nomine», e ne verrebbero scritte 363.**
   `applicaNomine` toglie i doppioni persona+figura prima di scrivere
   (`src/lib/admin/nomineImport.ts:548`), e fra colonna e mansione tiene la colonna,
   che ha la data. `riepiloga` (`:507`) non li toglie. Sul file c'è **una** riga che
   dà la stessa figura dalle due sorgenti: la **2782**, RUFFO RICCARDO,
   `dirigente` dalla colonna e dalla mansione «DIRIGENTE». Il commento a `:542`
   dice «12 righe lo fanno» e che così i due conteggi «coincidono»: sono false
   tutte e due le cose. Il messaggio dopo la scrittura direbbe «363 nomine
   scritte», e la rilettura «0 da creare». Il dato scritto è giusto: il vincolo
   `unique (persona_id, figura_codice)` c'è dalla `015`. Non ho controllato se la
   stessa persona compaia su due righe dello stesso cliente, perché per saperlo
   serve l'archivio. **Da correggere:** `riepiloga` deve togliere i doppioni come
   `applicaNomine`. Serve un deploy, quindi va fatto dopo la scrittura, non prima.
2. **La (a) sugli omonimi ha lavorato su un caso vero.** «Pradella Tazio» compare
   due volte senza codice fiscale nello stesso cliente, A.S.D. EX CALCIATORI HELLAS
   VERONA (righe 2562 e 2563): non viene scritto e finisce fra le persone non
   trovate. Nell'elenco c'è solo la 2563 perché la 2562 non porta ruoli. Con il
   codice fiscale la stessa persona sta alla 2561, in Overall Group, e lì
   entra. È materia per l'abbinamento guidato, che non è assegnato.
3. **Il piè di pagina si legge come una riga e poi si scarta:** la 3503, «Report
   aggiornato al 09/09/2026», non ha campi persona. Le righe lette sono 3.501, le
   persone 3.500.
4. **Nella mansione ci sono tre forme non a dizionario fra i «da decidere».**
   - «INSTALLATORE/MANUTENTORE IMPIANTI ANTINCENDIO E ANTIFURTO»: 9 righe di DER
     ERSTE. È un mestiere, non un ruolo, ed è preso solo perché contiene
     ANTINCENDIO (`src/lib/admin/ruoliTesto.ts:94`). È rumore e non diventa nomina.
   - «RSPP-SOCIO» (2248): è «SOCIO/RSPP» rovesciata, che il dizionario conosce e
     volutamente non traduce.
   - «RLS - LAVORATORE» (3401, CAFFINI SPA): una forma nuova su cui c'è una
     decisione da prendere, e non l'ha presa nessuno.

**La scrittura, lo stesso giorno.** Francesco ha premuto «Scrivi 364 nomine» sul
codice di `12b1768`: il deploy di `d8a7cc7` tocca solo questo file, quindi il
codice è lo stesso dell'anteprima. Le 4 unità **non** sono state abbinate. La
schermata riletta dopo la scrittura dice:

| conto | prima | dopo |
|---|---|---|
| nomine da creare | 364 | **0** |
| già in organigramma | 0 | **364** |
| da decidere | 153 | 153 |
| persone non trovate | 4 | 4 |
| unità non abbinate | 4 | 4 |

Le **364 già in organigramma sono 363 coppie** persona+figura: la riga 2782
propone `dirigente` due volte e trova la stessa nomina due volte. Il messaggio
verde con il numero scritto non è stato riportato, e da qui non si legge il
database. Quindi **«363 scritte» è dedotto, non visto**. La rilettura a 0 da
creare, invece, è vista, ed è la prova dell'idempotenza sul caso vero: ripassare
lo stesso file non aggiunge niente.

**Le righe delle 4 unità non abbinate non sono entrate.** Entrano con un secondo
passaggio dello stesso file, dopo che Francesco dice a quale cliente appartengono.
È una sua decisione.

**«RLS - LAVORATORE» (riga 3401, ZAMPERLINI DEMIS, CAFFINI SPA): la lettura l'ha
data Francesco il 14.09.** Indica due ruoli, RLS e lavoratore. Conta la metà
RLS: il lavoratore non va dedotto, perché il dizionario non lo asserisce mai e
l'organigramma lo mette già dall'import della formazione. Poi Francesco ha detto
**sì anche alla `070`**.

**Correzione, misurata il 14.09 subito dopo.** Qui e nel messaggio ad
AppOverall era scritto che fosse «l'unico caso» e che stesse «nella mansione»:
**sono false tutte e due**.

Il testo `RLS - LAVORATORE` (byte per byte, ASCII) sta nella colonna **Qualifica**
(X), non in Mansione (Y), e compare su **tre** righe. Nessuna delle tre ha la
colonna RLS compilata:

| riga | persona | cliente | Mansione |
|---|---|---|---|
| 1234 | FERC ANDREEA VIORICA | FOOD & SWEET SRL | AIUTO CUCINA E GASTRONOMIA |
| 3353 | VISENTIN ROSSANO | PALLADIO SCALE SRL | OPERAIO |
| 3401 | ZAMPERLINI DEMIS | CAFFINI SPA | *(vuota)* |

L'import vede solo la 3401 perché il campo `mansione` prende la **prima colonna
non vuota** fra `mansione`, `ruolo` e `qualifica`
(`src/lib/admin/anagraficheImport.ts:174`, `valore` a `:187`). Sulla 3401
Mansione è vuota, sulle altre due no.

**E non riguarda solo l'RLS.** Delle 377 Qualifiche piene, 336 stanno accanto a
una Mansione piena e l'import non le legge. **38** di queste contengono una
parola di ruolo, quasi sempre senza nessuna colonna di ruolo compilata:

| Qualifica | righe | nel dizionario della `068` |
|---|---|---|
| LAVORATORE E PREPOSTO | 13 | **no** |
| PREPOSTO | 9 | sì → `preposto` |
| RLS | 4 | **no** |
| DIRIGENTE | 3 | sì |
| RLS - LAVORATORE | 2 | **no** |
| RSPP | 2 | sì, non mappabile |
| RSPP/TITOLARE | 2 | sì (con la stessa Mansione) |
| SOCIO/RSPP | 1 | sì, non mappabile (con la stessa Mansione) |
| LEGALE RAPPRESENTANTE/RSPP | 1 | **no** |
| DATORE DI LAVORO | 1 | sì (con la stessa Mansione) |

**Quindi la `070` è ferma su una domanda che è di Francesco**, e non la scrivo
prima della risposta. La domanda: l'import deve leggere **anche** Qualifica
quando Mansione è piena?

- **Se no**, la `070` porta solo `RLS - LAVORATORE` e produce **una** nomina, la
  3401.
- **Se sì**, prima serve una modifica al codice, e la `070` deve portare anche le
  forme che oggi il dizionario non ha. A leggerle entrerebbero decine di
  nomine, non una.

In tutti e due i casi, prima del commit la forma esatta va mandata ad AppOverall.

**Le 160 righe della misura dell'11 settembre leggevano solo la colonna Mansione
(Y), e la 3401 non è fra loro.** Lo ha chiesto AppOverall (`cf1d6df`), perché la
loro `0007` è un dizionario di forme e non dice da quale colonna vengano. È stato
misurato il 14.09, applicando il seme della `068` alle righe del foglio:

| cosa si legge | righe con un ruolo | coppie |
|---|---|---|
| solo la colonna **Mansione** (Y) | **160** | **168** |
| il campo `mansione` come lo legge l'import (Y, e se è vuota Qualifica) | 167 | 175 |

I due numeri di `8dab00a` escono **esatti** solo leggendo Y. Il testo
`RLS - LAVORATORE` non è una forma del seme, quindi la 3401 non è fra le 160.

Le **7** righe in più che l'import prende stanno tutte in Qualifica con Mansione
vuota: 11 e 3289 «DATORE DI LAVORO», 585 «Dirigente», 920, 1762 e 2531
«RSPP/titolare», 2563 «RSPP». Sono loro a spiegare perché l'anteprima del
14.09 dava `datore_lavoro` 24 contro 22, `dirigente` 2 dalla mansione contro 1, e
`dl_rspp` 83 più 1 escluso contro 81. **È la differenza di grana che la sezione
qui sopra lasciava «non indagata»: adesso è spiegata.**

**D2 e la correzione di `riepiloga`: fatte e verificate, non pubblicate.** Il
codice sta sul ramo **`d2-report-componenti`**, commit **`6532500`**, e non su
`main`: il push su `main` fa partire il deploy di Vercel, e AppOverall (`cf1d6df`)
ha chiesto che il deploy aspetti la risposta di Francesco sulla Qualifica. Se la
risposta è sì, la modifica per la Qualifica va nello stesso deploy.

- **D2, il report che non conosceva i componenti**
  (`supabase/functions/genera-report/report-data.ts` e `report-html.ts`). Le
  voci si caricavano con `.eq('template_id', …)`, e quelle dei box hanno
  `template_id` NULL (`030`). Adesso:
  - le voci si caricano **per id**;
  - l'esito porta `componente_id`;
  - il dettaglio esce raggruppato per box, sezione e componente (etichetta ·
    matricola · ubicazione), **nell'ordine del campo** (`BoxGenerico`): prima il
    template piatto, poi i box nell'ordine del giro, i componenti per etichetta.

  Un errore di lettura su queste tabelle adesso ferma il report, invece di
  produrne uno appiattito in silenzio.
  **Prova:** `npm run report:check` passa **11 controlli su 11**. Sulla versione
  di `main` ne **fallisce 9**: chiave grezza al posto dell'etichetta, nessun
  componente, nessun titolo di box. Il controllo dei tipi (tsc strict, con
  l'import da esm.sh indirizzato al pacchetto installato) è pulito. **Deno su
  questa macchina non c'è**: il controllo con Deno non è fatto.
- **`riepiloga`** toglie i doppioni persona+figura con **la stessa funzione** di
  `applicaNomine` (`senzaDoppioni`), e la colonna vince sulla mansione. Il
  commento che diceva «12 righe» e «coincidono» è ritirato. Provato su un piano
  costruito apposta (4 proposte con il doppione della 2782 → 3, poi 0 da creare
  e 3 già presenti). `npm run build` verde.

**Come si pubblica, quando si pubblica.** Sono due canali (`docs/PROGETTO.md`):
il merge su `main` pubblica l'app su Vercel, mentre l'Edge Function
`genera-report` va pubblicata a parte, dal Dashboard o con
`npx supabase functions deploy genera-report --use-api`. Tutte e due le cose sono
di Francesco o vanno fatte col suo sì.

**Pubblicato il 14.09, con il sì di Francesco dato in questa sessione.** Da oggi
i due canali possono essere a commit diversi, quindi si scrivono separati:

| canale | cosa è online | come è verificato |
|---|---|---|
| **app** (Vercel) | `e33efc2`, il merge del ramo | stato GitHub `success` alle 10:05:15 UTC; il bundle pubblico passa da `index-7vqDM7i-.js` a `index-BSYYMtW7.js`, e il segno del conteggio vecchio (`giaPresenti:e.proposte.length-t.length`) **non c'è più** |
| **Edge Function** `genera-report` | **v9** (10:05:57 UTC), dal codice di `e33efc2` | pubblicata con la CLI da `main` pulito; riscaricata, i tre file sono **identici** a `e33efc2`. Prima era la v8 del 3 giugno, identica a `main` prima di D2, quindi nessuna modifica fatta dal Dashboard è andata persa. `verify_jwt` resta `true` |

**D2 non si chiude con la prova automatica**, perché Deno qui non c'è: si chiude
quando Francesco guarda un report vero su un sopralluogo con box e componenti.

**Le nomine di stamattina, lette dal database (sola lettura, 14.09, con il sì di
Francesco).** Nella tabella `nomina`, con `created_at` del 14.09, ci sono **198**
nomine `colonna` e **165** `mansione`: **363**, tutte delle 09:07:13 UTC. Il «363
scritte» che la sezione qui sopra dava per dedotto adesso è **visto**.

Delle 7 righe prese dalla Qualifica perché Mansione era vuota, **6 hanno una
nomina, e tutte e 6 portano `origine = mansione`**, con la Qualifica in
`origine_testo`:

| persona | cliente | figura |
|---|---|---|
| VEDOVA FLAVIO | AZ. AGR. VEDOVA TARCISIO DI VEDOVA FLAVIO | `datore_lavoro` |
| ABD RABOU ESSAM MOHAMED | ERTA SERVIZI SRL | `datore_lavoro` |
| CAFFINI AMEDEO | CAFFINI SPA | `dirigente` |
| POLETTO RUGGERO | CARROZZERIA AUTOSTAR SAS | `dl_rspp` |
| CUNEGO ELENA | CUNEGO ELENA | `dl_rspp` |
| LEZZI FRANCESCO | POLIS MEDICAL CENTER S.R.L. | `dl_rspp` |

La settima, la 2563 (Pradella senza codice fiscale), non ha nomine: quelle di
PRADELLA TAZIO nel database sono le due della riga 2561 in Overall Group, dalla
colonna. **Correggere la provenienza di queste 6 è una scrittura su dati veri, ed
è di Francesco.**

C'è una cosa in più, e viene da prima delle nomine: su queste persone anche
`persona.mansione` contiene la Qualifica («DIRIGENTE», «RSPP/TITOLARE»,
«DATORE DI LAVORO»). Ce l'ha messa l'import delle anagrafiche del 9.09, con lo
stesso ripiego.

## La Qualifica come fonte distinta, e la P.IVA segnaposto (14 settembre, pomeriggio)

**Deciso da Francesco il 14.09**, riferito da AppOverall (`7270bbe`) e confermato in
questa sessione: l'import delle nomine legge la Qualifica **anche quando la
Mansione è piena**, come **fonte distinta**, con l'origine scritta sulla nomina.

**Sta sul ramo `qualifica-fonte-distinta`, non su `main`, e non è pubblicato.**
Il ramo ha due commit:

- **`d849073`, Qualifica e `070`.**
  - `nomineImport.ts` legge mansione e qualifica ciascuna dalla sua colonna, e
    scrive `origine = 'qualifica'`.
  - Una Qualifica identica alla Mansione non conta due volte.
  - Fra due proposte persona+figura uguali vince colonna, poi mansione, poi
    qualifica.
  - L'anteprima conta per fonte ed elenca le qualifiche che il dizionario non
    conosce.
  - **La `070`** (non applicata) fa accettare a `nomina.origine` il valore
    `'qualifica'` e aggiunge cinque forme viste solo in Qualifica:
    `LAVORATORE E PREPOSTO` → `preposto` (13 righe), `RLS` → `rls` (4),
    `RLS - LAVORATORE` → `rls` (3), `RSPP-SOCIO` → rspp **non mappabile** (1),
    `LEGALE RAPPRESENTANTE/RSPP` → rspp **non mappabile** (1). Le grafie sono
    copiate dal file, la migrazione è solo ASCII, e le 27 chiavi della `068` non
    si toccano.
  - **`supabase/scripts/correggi_origine_qualifica.sql`** corregge le 6 nomine
    lette sopra: per id, solo dove l'origine è ancora `mansione`, e finisce con un
    conteggio che deve dire 6.
  - **Prova:** `npm run qualifica:check` 8 casi su 8, **7 falliti** sulla
    versione di `main`. Build verde; `ruoli:check`, `dizionario:check`,
    `omonimi:check`, `report:check` e `nomine:dryrun` verdi.
  - Proposta mandata ad AppOverall **prima** del commit, come chiesto.
- **`5fb57ab`, `pivaUsabile`.** Segnalato da AppOverall (`373da54`): una P.IVA
  segnaposto come `00000000000` risultava usabile, e poteva agganciare il cliente
  sbagliato.
  - **La causa vista nel file è un'altra da quella letta a schermo**: dopo `(\d)`
    non c'era `{10}` ma il **byte di controllo 0x01**, cioè un `\1` diventato
    invisibile. La regex non corrispondeva mai.
  - Il byte è entrato con `0d0c8a0` (9 settembre), ed era l'unico carattere di
    controllo nei sorgenti del repo.
  - Corretto in `(\d)\1{10}` e provato sulla funzione vera: `00000000000`,
    `11111111111` e `99999999999` rifiutate; `12345678901` e `00000000001`
    accettate.
  - **Nessun import delle anagrafiche prima del deploy.**

**Cosa porterebbe un secondo passaggio del file**, stimato fuori dal database e
al netto delle unità non abbinate e delle persone non trovate: **30 nomine nuove
dalla Qualifica** (29 da righe con Mansione piena, fra cui 20 `preposto`, e la 3401
di ZAMPERLINI), **4 da decidere** in più, e le 6 già scritte che cambiano solo
provenienza. Quante di queste la persona abbia già lo dirà l'anteprima.

**L'ordine su produzione**, come da `PROGRAMMA.md` sezione 8 (`6a2fd08`). È
obbligato:

1. **Misura in sola lettura dei clienti con una P.IVA segnaposto**, e di quanti
   condividono la stessa. Va fatta **prima del deploy**, perché la correzione
   cambia come l'import riconosce i clienti, e misurare prima vuol dire sapere
   chi si sposta. Serve **un sì di Francesco per questa lettura**: quello dato per
   le nomine non vale qui.
2. **Francesco applica la `070`** dall'SQL Editor. Va **prima del codice**, che
   scrive `'qualifica'` e senza la `070` verrebbe rifiutato dal vincolo.
   **Fatto il 14.09**, testo preso dal ramo a `a82c6af`. Il controllo in sola
   lettura lanciato da Francesco subito dopo dà:

   | | visto | atteso |
   |---|---|---|
   | vincolo `nomina_origine_nota` | `CHECK (((origine IS NULL) OR (origine = ANY (ARRAY['colonna', 'mansione', 'qualifica', 'manuale']))))` | contiene `qualifica` |
   | `ruolo_testo` | **32** | 27 + 5 |
   | `ruolo_testo_figura` | **37** | 32 + 5 |
   | le cinque forme nuove | **5** | 5 |

   **Da qui al deploy, niente import delle nomine.** Il codice online legge ancora
   la Qualifica come mansione quando la Mansione è vuota, e con le forme nuove
   scriverebbe `RLS - LAVORATORE` (riga 3401) e `RSPP-SOCIO` con la provenienza
   sbagliata.
3. **Francesco lancia `correggi_origine_qualifica.sql`**, dopo la `070`. Dal
   commit **`a82c6af`** lo script **annulla** se il conto non dà 6: un blocco
   `do` fa `raise exception` prima del commit. Nella prima versione il conto era
   una `select` e il commit sarebbe avvenuto comunque (rilievo di AppOverall).
   **Eseguito da AppOverall** (`bf34926`), perché qui non c'è un database locale:
   il file di `a82c6af` con `psql` e `ON_ERROR_STOP`, su un cluster `initdb` usa e
   getta, poi cancellato, con i 6 id veri più due righe estranee. Quattro casi,
   tutti come previsto:
   - dopo la `070`, con le 6 presenti, passa e le due righe estranee restano
     intatte;
   - rieseguito, non cambia niente;
   - dopo la `070`, con una riga mancante, «trovate 5», e le 5 tornano a
     `mansione`;
   - prima della `070`, il vincolo lo rifiuta e non scrive niente.
   Visto da loro, non da qui.
4. **Merge del ramo su `main` e deploy**, Qualifica e `pivaUsabile` insieme, con
   lo stesso controllo fatto per D2 (stato GitHub e bundle).
5. **L'anteprima dell'import delle nomine** con lo stesso file. **Le attese,
   scritte prima di vederla**, al netto delle 4 unità non abbinate e delle 4
   persone non trovate:
   - **36** proposte dalla Qualifica;
   - di queste, **30 nuove** (29 da righe con Mansione piena, più la 3401) e
     **6 già in organigramma** (le nomine corrette dallo script);
   - **4** righe da decidere in più dalla Qualifica (350 e 748 «RSPP», 2248
     «RSPP-SOCIO», 3397 «LEGALE RAPPRESENTANTE/RSPP»).

   Il numero «da creare» può uscire **sotto 30** se qualcuna di quelle persone ha
   già la figura da un'altra fonte: in quel caso va spiegato riga per riga, non
   accettato.
6. **La scrittura**, di Francesco.

AppOverall ha scritto la gemella (`0018`). Le cinque forme sono identiche byte per
byte alle varianti della `070`, con le stesse posizioni e figure.

**Una domanda aperta per Francesco:** «Legale Rappresentante/RSPP» (riga 3397,
PLASTIMETAL) nella `070` non si traduce in nessuna figura, perché «legale
rappresentante» non è scritto «datore di lavoro». Sul file non cambia niente: la
stessa persona ha già `dl_rspp` dalla Mansione.

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

**E pesa molto più di così sulla metà dedotta — misurato il 12 settembre, sera.**
Avevo scritto che il «12 su 153» delle colonne **non si estende** alle righe col
ruolo nella mansione, e che quella misura non c'era. Ora c'è, sul foglio
`Ruoli SSL` di `ExportExcel.xlsx` (24/12/2023, l'unico export di quella famiglia
su questa macchina):

| | righe | senza CF | |
|---|---:|---:|---:|
| ruolo nelle **colonne** | 204 | 16 | 7,8% |
| ruolo nella **mansione** | 74 | **47** | **63,5%** |
| unione | 275 | 63 | |

**Otto volte peggio.** Non si estendeva, e non si estendeva *in meglio*:
agganciando solo per codice fiscale, dalla metà **dedotta** dell'organigramma si
perderebbero quasi **due righe su tre**. Il ripiego non è un rammendo per pochi
casi — è ciò che regge metà del lavoro che questo import esiste per fare.

*Due riserve, perché il numero non venga usato per quello che non è:* è la
fotografia del **2023**, non quella del 2026 su cui poggiano il 153 e il 160; e il
dizionario è stato costruito **sull'export del 2026**, quindi applicato al 2023
riconosce solo le forme che già conosce — **74 è un limite inferiore**, e la
proporzione vale per ciò che il dizionario vede.

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

## Il livello della produzione: la 068 non c'è (13 settembre)

Chiesto da AppOverall dopo aver trovato la produzione di AppFormazione **sei
migrazioni indietro** rispetto al repo, con i documenti che le davano per chiuse.
Misurato sul progetto `pvbwcfrgatkqashstxjc` con la sola chiave anon, in sola
lettura, con `npm run livello:produzione`. Il repo è alla `068`.

| migrazione | cosa si interroga | produzione |
|---|---|---|
| `061` · `062` · `063` | `persona.data_cessazione`, `cliente.numero_lavoratori`, `tecnico.cognome` | presenti |
| `064` | — solo commenti | **non misurabile** |
| `065` | `cliente.ateco_origine` | **presente** |
| `066` | — solo un commento | **non misurabile** |
| `067` | testo in `figura_sicurezza.guida`: con la anon le righe non si vedono | **non misurabile** |
| **`068`** | `nomina.origine`, `nomina.origine_testo` → `42703`; `ruolo_testo`, `ruolo_testo_figura` → `PGRST205` | **ASSENTE, tutte e quattro** |

**Quindi la produzione sta fra la `065` e la `067`, e la `068` sicuramente no.**
Dove esattamente, fra 065 e 067, da qui non si sa: le tre migrazioni in mezzo non
lasciano niente che la chiave anon possa interrogare.

**Come si legge senza vedere un dato.** Le RLS nascondono le righe, ma una colonna
che non esiste risponde `42703` e una tabella che non esiste `PGRST205`, righe o
non righe. Lo script lo **prova** prima di credergli: in testa interroga una
colonna e una tabella inventate, e se quelle non danno «assente» si ferma. Il
numero di righe non è una misura — con la anon è zero comunque.

### Cosa vuol dire per l'import delle nomine

**Oggi in produzione non parte.** `pianificaNomine` chiama per prima cosa
`caricaDizionarioRuoli` (`nomineImport.ts:344`), che legge `ruolo_testo`: la
lettura fallisce e `leggiTutte` rilancia l'errore. Si ferma **all'anteprima**,
prima di scrivere qualsiasi cosa, e con un errore a schermo — rumoroso, non
silenzioso. Anche se passasse, la scrittura porta `origine` e `origine_testo`,
che non esistono.

Quindi, prima che Francesco lo lanci dal back-office, va applicata la `068`. E
siccome della `066` e della `067` non si sa, la cosa sicura è rilanciare **dalla
`064` alla `068` in ordine**: tutte e cinque si dichiarano idempotenti in testa
(`comment on` sovrascrive, `add column if not exists`, `update` per codice,
`on conflict do nothing`). È una scrittura sullo schema di un database **senza
backup**: la fa Francesco, non questa corsia.

### E la cosa da tenere, che riguarda questo file

La riga della `068` in tabella diceva **«chiuso (068, schema)»**. Era vero di
quello che significava per chi l'ha scritta — migrazione scritta e committata — e
falso di quello che chiunque altro ci legge: che lo schema ci sia. **In questo
file «chiuso» non ha mai distinto *scritto* da *applicato***, e il secondo non
l'aveva misurato nessuno. È esattamente quello che AppOverall ha trovato in
AppFormazione lo stesso giorno: non un errore di una corsia, una parola che le due
corsie usavano nello stesso modo.

Da qui in avanti una migrazione in tabella dice **scritta** oppure **applicata**,
e la seconda solo con `npm run livello:produzione` accanto.

### Applicata la sera stessa, e una cosa che il livello non vede

Il **13 settembre, sera**, Francesco ha incollato la `064`-`068` nell'SQL Editor
**in un file solo dentro `begin`/`commit`**, preparato da AppOverall con i cinque
file invariati e in ordine. Niente CLI e niente `db push`: il registro
`supabase_migrations` di questo progetto è incompleto, perché le migrazioni sono
sempre passate a mano (`PROGETTO.md`, ogni «Rilascio»), e un push riapplicherebbe
anche le vecchie.

| controllo | prima | dopo |
|---|---|---|
| codici figura che servono a 067 e 068 | 8 su 8 | — |
| `ruolo_testo` · `ruolo_testo_figura` | assenti | **27** · **32** (attesi 27 · 32, contati dagli insert) |
| colonne `origine` su `nomina` | 0 | 2 |
| vincoli `nomina_origine_nota` · `ruolo_testo_posizione_nota` | — | 2 |
| la riga che la `067` aggiorna | presente, **testo già identico** | invariata |
| `nomina` | 0 righe | 0 righe |

*Numeri di AppOverall, girati da Francesco nell'SQL Editor* — **come `postgres`,
che scavalca le RLS**: dicono che le righe **esistono**, non che **si leggono**.
L'ha fatto notare AppOverall stesso, dopo. La verifica **indipendente**
è `npm run livello:produzione`, rilanciata qui dopo: `068` presente in tutte e
quattro le prove, e le due prove di controllo ancora «assente».

**La `067` c'era già.** La produzione prima non stava «fra la 065 e la 067»: stava
alla **067**. Quando sia stata applicata non lo dice nessuno. La `064` e la `066`
restano **non misurate**: sono passate nella stessa transazione, ma sono solo
commenti, e «è passata» non è «l'ho visto».

**E la cosa che il livello non vede.** Subito dopo, con la chiave anon,
`ruolo_testo` e `ruolo_testo_figura` danno **0 righe senza errore** — dove i
controlli ne contano 27 e 32. Le RLS sono attive e nessuna policy apre le tabelle
alla anon. Ma la `068` **non le accende e non scrive policy**: è l'unica migrazione
del repo che crea tabelle così, tutte le altre seguono la `055`. Qualcosa in
produzione le ha accese da solo, e se nessuna policy le apre ad `authenticated`,
**il back-office legge zero righe anche lui**.

Il danno non sarebbe un errore: `caricaDizionarioRuoli` su 0 righe restituisce un
dizionario **vuoto**, e l'anteprima delle nomine prosegue dichiarando «non
riconosciute» tutte le righe col ruolo nella mansione. **Prima si fermava; adesso
continuerebbe sbagliando** — che è peggio.

- **Scritta la `069`**: RLS e `staff_full` su tutte e due, nella forma della
  `055`. Serve in tutti e due i casi: se le RLS fossero spente, le tabelle
  sarebbero scrivibili con la chiave anon del bundle pubblico. **La applica
  Francesco.**
- **Chiesta una select** di sola lettura su `pg_class.relrowsecurity` e
  `pg_policies`, scritta in testa alla `069`, con `corso_alias` come confronto.
  **Misurato prima della `069`** — Francesco, SQL Editor, 13 settembre, sera:

  | tabella | RLS | policy |
  |---|---|---:|
  | `corso_alias` (confronto) | attive | 1 |
  | `ruolo_testo` | **attive** | **0** |
  | `ruolo_testo_figura` | **attive** | **0** |

  Diagnosi confermata: oggi il dizionario **non lo legge nessuno** tranne
  `postgres`, **back-office compreso**. La `069` serve così com'è: `enable row
  level security` è una no-op dove sono già attive, e `staff_full` è la parte che
  manca.
- **La `069` è applicata il 13 settembre, sera**, da Francesco nell'SQL Editor
  dentro `begin`/`commit`, riletta prima da AppOverall. **Controllo dopo**
  (AppOverall, sola lettura): su `corso_alias`, `ruolo_testo` e
  `ruolo_testo_figura` RLS attive e **una** policy, `staff_full`, `ALL` per
  `authenticated`, `using` e `with check` a `true` — tutte e tre uguali.
  **Riscontro di qui, con la anon:** le due tabelle danno ancora **0 righe senza
  errore**, come `corso_alias`; `livello:produzione` invariato.
- **Cosa questo NON prova:** che il back-office le legga. La anon a zero dice solo
  che la porta resta chiusa a chi non è entrato. La prova è l'**anteprima delle
  nomine dal back-office, senza Applica**: non deve fermarsi sulla guardia e deve
  riconoscere le righe col ruolo nella mansione. Va fatta **dopo il push e il
  deploy**, perché prima Vercel serve il codice senza la guardia.
- **Deploy verificato il 13 settembre, sera**, in due modi indipendenti: GitHub
  registra in produzione `12b1768` con stato **`success`** (verificato anche da
  AppOverall), e il bundle pubblico di `app-sopralluoghi.vercel.app` **contiene**
  sia il messaggio della guardia («Dizionario dei ruoli vuoto») sia la lista «da
  abbinare a mano». L'anteprima delle nomine dal back-office la fa Francesco il
  **14 settembre**; fino ad allora l'import delle nomine resta fermo.
- **L'import delle nomine non va lanciato** finché la `069` non è applicata o la
  select non mostra una policy.

*La lezione sta nello strumento, ed è mia:* `livello:produzione` misura che una
tabella **esista**, non che **si legga**. Una colonna che manca dà `42703`; una
tabella che c'è ma che nessuno può leggere dà zero righe, cioè lo stesso esito di
una tabella vuota. È di nuovo un'assenza che si presenta come un risultato.

## I due conti per la migrazione dati: misurati il 13 settembre

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

**Eseguito il 13 settembre con la sola chiave anon, e NON è una misura.** Stampa
«Lette **0** persone su **0** clienti» e poi zero su ogni riga dei due conti. Non
vuol dire che non ci sono doppioni: vuol dire che le RLS non fanno leggere
`persona` e `cliente` a chi non è autenticato, e il `count(*)` del 10 settembre
nell'SQL Editor ne contava 3.419 e 619. **Zero righe lette su tabelle che ne hanno
tremila è un'assenza che si presenta come un risultato**, e i numeri che ne
escono non vanno passati a nessuno.

*Una debolezza dello script, trovata eseguendolo:* davanti a 0 righe lette non si
ferma, stampa i conti. Con la anon è il caso normale, non un'eccezione.

**Cosa serve per misurare davvero:** una lettura **autenticata** — la sessione di
un utente del back-office, o la chiave `service_role`, che su questa macchina non
va messa senza che lo decida Francesco. Non sostituibile con due query nell'SQL
Editor, per la ragione scritta sopra: il conto 1 chiede il carattere di controllo.

**La definizione di «valido» che lo script usa**, letta in
`src/formazione/codiceFiscale.ts` e non ricopiata dal commento:

1. `pulisci`: maiuscolo, poi via **tutto** ciò che non è `A-Z0-9` — spazi,
   punti, trattini;
2. lunghezza **16** e la **struttura** del CF: 6 lettere, 2 posizioni numeriche,
   la lettera del mese (`ABCDEHLMPRST`), 2 numeriche, una lettera, 3 numeriche,
   una lettera — dove ogni posizione numerica ammette anche le lettere di
   **omocodia** `L-V`;
3. il **carattere di controllo** calcolato sui primi 15 uguale al sedicesimo.

Il comune e il cross-check cognome/nome **non** entrano. E la riga «di FORMA
valida» dello script è più larga del punto 2: conta **16 caratteri alfanumerici
qualsiasi**, non la struttura — quindi la differenza che stampa fra forma e
validità mescola i CF con la struttura sbagliata e quelli con il controllo
sbagliato.

### La misura vera (13 settembre, sera)

**Come è stata letta.** Stesso script (versione di `a41abc6`, non più toccato),
lanciato da Francesco in un suo PowerShell **fuori da Claude**, con la
`service_role` passata come variabile d'ambiente per quell'esecuzione sola e poi
rimossa: la chiave non è in nessun file e non è passata dalla conversazione. Qui
è arrivato l'output. **Prima di qualsiasi import delle nomine**, che non è girato
e in produzione oggi non girerebbe.

Il totale torna con il `count(*)` del 10 settembre: **3.419 persone su 619
clienti**.

| conto 1 — CF | |
|---|---:|
| persone con un CF scritto | 3.191 |
| … di 16 caratteri alfanumerici | 3.188 |
| … **validi** | **3.160** |
| codici fiscali validi distinti | 3.156 |
| **presenti su più di un cliente** | **4** |
| righe coinvolte | 8 — due per codice |

Quattro codici fiscali, ciascuno su **due** clienti: VELOX SERVIZI · VELOX
HOTELLERIE, DA UGO · BONUM, EXTENSYS · DIMEX, Aprili Graziano · Amari Umberto.
Di là diventano **4 persone con 8 rapporti**, cioè **4 righe in meno**.

**Una verifica che il conto fa da sé:** 3.160 validi − 3.156 distinti = **4**,
esattamente le righe in più di quei quattro codici. Quindi **nessun CF valido è
ripetuto dentro lo stesso cliente** — l'unica fusione è quella fra clienti.

| conto 2 — senza CF | |
|---|---:|
| persone senza CF | **228** |
| senza nemmeno cognome e nome | 0 |
| **omonimi nello stesso cliente** | **0** |
| stesso nome su clienti **diversi** | 2 |

**Il numero della migrazione: N = 3.419 − 4 = 3.415**, e vale solo se le 228 non
vengono fuse. Oggi il rischio del conto 2 — omonimi nello stesso cliente che di
là collasserebbero — è **zero**. Resta quello opposto: **due nomi** senza CF
stanno su due clienti diversi, e di là li separa soltanto la `import_key` del
rapporto. Un import che cercasse le persone senza CF per nome ne farebbe una.

### Tre cose che la misura non chiude

**1. I CF scritti e non validi sono 31, non 28.** Lo script stampa «28
passerebbero un controllo di sola forma», che è 3.188 − 3.160. Ma i CF scritti
sono 3.191: altri **3** non arrivano nemmeno a 16 caratteri, e lo script non li
nomina. `3.191 − 3.160 = 31`. **Di queste 31 righe il conto 1 non cerca i
doppioni** — conta solo i validi — e cosa diventino di là, dove
`codice_fiscale` è unique, è una decisione di AppOverall: se entrano così come
sono, un eventuale doppione fra loro non è misurato; se vengono trattate come
«senza CF», il conto 2 sale da 228 a **259**.

**2. 228 contro 235, e zero omonimi contro sei.** I documenti del 9 settembre
parlavano di **235** righe senza CF nel file: 227 con un nome univoco e **6
omonime** rimaste `riga:N`. Nel database oggi le persone senza CF sono **228** e
di omonimi nello stesso cliente **non ce n'è nessuno**. I due numeri vengono da
posti diversi — righe del file contro righe scritte — ma la differenza **non è
spiegata**, e non la spiego a occhio: le sei omonime o non sono state scritte
come tali, o non stanno nello stesso cliente, o hanno un CF. Si verifica
nell'SQL Editor, in sola lettura, contando le `import_key` che contengono
`riga:` e gli omonimi senza CF per cliente.

**3. Lo script ha due debolezze che questa misura ha messo in luce**, e non sono
riparate: davanti a **0 righe lette** stampa i conti invece di fermarsi (il giro
con la anon ha prodotto una pagina di zeri dall'aspetto di un risultato), e la
riga «di FORMA valida» conta 16 alfanumerici qualsiasi, lasciando fuori dalla
differenza i CF più corti.

**Sui 31 non validi AppOverall ha già deciso** (loro `0008`): li tratta come
**assenti**, `codice_fiscale` null e la cella originale in
`codice_fiscale_origine`. Di là le persone senza CF sono **228 + 31 = 259**, e fra
i 31 non si cercano doppioni: al più una persona in più, mai due fuse. N = 3.415
regge. Per il punto 1 qui non c'è altro da fare.

### RIPARATO — il ripiego sul nome fondeva gli omonimi al secondo import (13 settembre)

*Riparato la sera stesso, dopo la misura: vedi «La riparazione» in fondo a questa
sezione. Quel che segue è scritto com'era prima, perché è la ragione del codice.*

Trovato da AppOverall leggendo `anagraficheImport.ts`, **verificato qui riga per
riga**. Non è riparato apposta: **prima la misura**, perché il database oggi dice
il contrario di quello che il codice dovrebbe aver prodotto.

**Il meccanismo**, in `riconciliaPersone`:

- `:733` — `chiaveImportPersona` (`:78-82`) produce `anag:<cliente>:n:<cognome|nome>`
  per **ogni** persona senza CF con un nome, **anche quando il nome è ambiguo**.
  Il controllo di ambiguità (`:743-751`) decide solo `chiaveRiga`
  (`nome:` contro `riga:N`), **non** la chiave di provenienza.
- **Primo import**, due omonimi senza CF nello stesso gruppo: `riga:0` e `riga:1`,
  due persone nuove. La prima prende `import_key`; la seconda resta **null**,
  perché a `:763` quella chiave è già in `ikUsate`.
- **Import successivi**: a `:738` la ricerca per `import_key` viene **prima** del
  ripiego. Tutte e due le righe trovano **la prima** persona, e diventano due voci
  sullo **stesso id**. `salvaPersona` (`formazione.ts:1457`) fa `upsert` per id:
  l'ultima riga vince su mansione, reparto e date. La seconda persona, quella con
  `import_key` null, **non viene più toccata**.
- Il resoconto dice **«0 nuove»**, che è corretto e rassicurante — ed è
  esattamente la fusione silenziosa che il commento a `:705-711` dichiara di
  evitare («meglio un doppione che si vede di due persone fuse per sbaglio»), più
  una scheda **orfana**.

**La contraddizione.** Se il 9 settembre il codice ha fatto questo, nel database
dovrebbero esserci coppie di omonimi senza CF nello stesso cliente, una delle due
senza `import_key`. Il conto 2 ne trova **zero**, e il `count(*)` del 10 settembre
dava **0 persone senza marcatura** — che è già la prima delle select qui sotto,
fatta tre giorni fa. Quindi o gli omonimi del file non sono mai arrivati come
omonimi nello stesso cliente, o è successo qualcos'altro dopo l'import. **Non si
sceglie a occhio.**

**Le select che decidono**, sola lettura, nell'SQL Editor:

```sql
select count(*) from persona where import_key is null;
select count(*) from persona where codice_fiscale is null and import_key is null;
select count(*) from persona where codice_fiscale is null and import_key like 'anag:%:n:%';
select cliente_id,
       upper(regexp_replace(trim(cognome), '\s+', ' ', 'g')) as cognome,
       upper(regexp_replace(trim(nome),    '\s+', ' ', 'g')) as nome,
       count(*)
  from persona where codice_fiscale is null
 group by 1, 2, 3 having count(*) > 1;
```

La terza è in più rispetto alle tre di AppOverall: se le 228 senza CF portano
**tutte** una chiave `:n:` distinta, il ripiego ha lavorato solo su nomi univoci.
La quarta normalizza gli spazi come `normNome`, che un `upper()` da solo non fa.
`is null` è giusto perché `salvaPersona` scrive il CF vuoto come null
(`vuotoNull`).

**Oggi non morde, e morderà:** il difetto agisce solo al **secondo** import di un
file con omonimi senza CF, e il prossimo import delle anagrafiche lo è.

#### Le select, lanciate da Francesco il 13 settembre, sera

| select | esito |
|---|---:|
| persone senza `import_key` | **0** |
| senza CF **e** senza `import_key` | **0** |
| senza CF con chiave `anag:…:n:…` | **228** — tutte |
| omonimi senza CF nello stesso cliente (spazi normalizzati) | **nessuna riga** |

**Cosa dicono, e fin dove.**

- **Schede orfane: nessuna.** Il difetto, nel database, non ha lasciato la sua
  seconda metà. La prima select conferma lo zero del 10 settembre.
- **Le 228 senza CF sono tutte agganciate per nome, su nomi univoci** dentro il
  loro cliente. Il conto 2 e l'SQL dicono la stessa cosa per due strade diverse.
- **Una fusione avvenuta NON è esclusa.** Due righe del file finite sulla stessa
  scheda non lasciano traccia nel database: resta una persona sola, con la sua
  chiave, e l'altra riga non esiste da nessuna parte. Lo zero orfane è compatibile
  con «non è successo» **e** con «è successo quando la prima scheda c'era già» — per
  esempio da uno dei due tentativi falliti del 9 settembre. Queste select non
  sanno distinguere i due casi.
- **I 6 omonimi del 9 settembre nel database non ci sono come omonimi**, e da qui
  non si sa dove siano finiti. L'unica fonte che lo direbbe è l'export
  `ExportExcel (5).xlsx`: **cercato su questa macchina, non c'è.** Senza, la
  differenza 235 contro 228 e il 3.420 contro 3.419 restano dichiarati e non
  spiegati — non li chiudo con la spiegazione più comoda.

**Il difetto nel codice resta aperto e vero**: le select dicono che cosa ha
lasciato nel database, non che il codice sia giusto. Al prossimo import con due
omonimi senza CF nello stesso cliente, il meccanismo sopra si ripete.

#### IPOTESI, non fatto: il 3.420 contro 3.419 potrebbe essere l'impronta del difetto

Proposta da AppOverall, **verificata qui sul codice ma non sui dati**.

- **Il 3.420 conta voci, non schede.** `gr.nuove` e `gr.aggiornate` contano le
  voci (`anagraficheImport.ts:773-774`) e `applicaPersone` fa `n++` per voce
  (`:795`), non per id distinto. Sia il «3.420 scritte» sia il «0 nuove · 3.420
  aggiornate» del 9 settembre sono conteggi di voci.
- **3.420 voci su 3.419 righe** vuol dire che **un id ha ricevuto due voci** —
  oppure che una scheda è stata cancellata fra il 9 e il 10, che nessuna select
  esclude.
- **Due voci su un id nascono in due modi**: due omonimi senza CF fusi dalla
  ricerca per provenienza (`:738`), o la stessa persona in **due gruppi** dello
  stesso cliente (`perRiga` è per gruppo).
- **E in tutti e due i casi la scheda doveva esistere già quando il piano è stato
  calcolato.** Se non c'era, le due righe diventano due schede e la seconda
  nasce senza provenienza: sarebbe una orfana, e le orfane sono zero. Quindi
  l'ipotesi regge solo se quella scheda veniva da uno dei **due tentativi falliti**
  del 9 settembre — il che è possibile, e non verificabile dal database.
- **Non spiega i 6 omonimi**: tre coppie fuse darebbero +3, non +1.

**NON VERIFICABILE: il file del 9 settembre non esiste più.** Francesco non ha
più `ExportExcel (5).xlsx` (riferito da AppOverall il 13 settembre). Quindi, **a
meno che il file salti fuori, restano non spiegati per sempre**:

| numero | contro | stato |
|---|---|---|
| **3.420** voci scritte il 9.09 | **3.419** schede contate il 10.09 | non spiegato — l'ipotesi qui sopra è compatibile, non provata |
| **235** righe senza CF nel file | **228** schede senza CF oggi | non spiegato |

**Cosa li scioglierebbe, scritto perché fra un anno «non spiegato» non si
confonda con «nessuno ha guardato»:** l'**anteprima** dell'import anagrafiche
(sola lettura, niente «applica») su **quel** file, che elenca le voci per gruppo
e fa vedere se un id ne ha due. Guardato il 13 settembre: il file non c'era.

**Un export nuovo non lo sostituisce.** Direbbe se **oggi** ci sono omonimi e se
il difetto li fonderebbe — il presente, non il 9 settembre. È un buon collaudo
della riparazione, non una prova sul passato.

**Conseguenza, scritta da AppOverall e giusta:** le 3.419 sono **schede**, non
persone. Se una fusione c'è stata, una persona vera è già dentro un'altra e
nessuna migrazione la tira fuori. N = 3.415 è un numero di schede.

#### La riparazione

In `riconciliaPersone` l'ambiguità si decide **prima** di calcolare la chiave:
senza CF, `anag:<cliente>:n:<nome>` si calcola — e quindi si cerca e si scrive —
**solo se il nome è univoco sia nell'archivio sia nel file**. Se è ambiguo la
chiave è nulla: la riga non ritrova nessuna scheda e non ne marca nessuna, e
torna a essere `riga:N`, nuova. È quello che il commento del ripiego prometteva
da sempre: **un doppione che si vede invece di due persone fuse**. Con CF non
cambia niente.

**La prova**, `npm run omonimi:check`, gira sulla funzione vera, con una
`from()` finta al posto del database:

| caso | prima | dopo |
|---|---|---|
| A1 · secondo import, due omonimi senza CF | **fallisce**: `P1, P1`, stessa scheda | ok: due schede, P1 non toccata |
| A2 · primo import, due omonimi senza CF | **fallisce**: la prima prende la chiave, la seconda no | ok: nessuna delle due |
| A3 · nome ambiguo nell'archivio, univoco nel file | **fallisce**: si aggancia a P1 | ok: nessuna delle due |
| B1-B3 · nome univoco senza CF | ok | ok, come prima |
| C1 · con CF, anche fra omonimi | ok | ok, come prima |

**Il controllo negativo fa parte della prova:** lo stesso script sul codice di
prima dà 4 su 7, e i tre che falliscono sono esattamente il difetto.

**Cosa non fa.** Non ricostruisce l'import del 9 settembre e non tocca il
database: vale per il prossimo import. E **lascia fuori un caso vicino**, letto
nel codice e non provato: la stessa persona in **due gruppi** del file che
puntano allo stesso cliente, con l'archivio vuoto, diventa due schede e la
seconda nasce senza provenienza — anche con il CF, perché `perRiga` è per gruppo
e l'archivio si legge una volta sola prima del ciclo. Oggi l'anteprima lo segnala
come `collisione` fra gruppi; se vada riparato è un'altra decisione.

#### La decisione: la riga ambigua non si scrive (13 settembre, sera)

**Decisa da Francesco il 13 settembre**, proposta da AppOverall e confermata da lui
direttamente in questa sessione.

**Perché la riparazione di `bb141ee` non bastava.** Toglieva la fusione, ma una
riga ambigua tornava `riga:N`, **nuova**: ripassando lo stesso file con due ROSSI
MARIO senza CF, il primo import creava 2 schede, il secondo — ora il nome era
ambiguo anche nell'archivio — altre 2, poi 6. Per quei nomi l'import **non era più
idempotente**, cioè il difetto che il ripiego era nato per chiudere. «Meglio un
doppione che si vede» vale per **un** doppione, non per uno nuovo a ogni import.

**Cosa fa adesso** (`e18f8c5`). In `riconciliaPersone` una riga senza CF con un
nome ripetuto — nel file o già in archivio — **non diventa una voce**: va in
`gr.daAbbinare` con riga, cognome, nome e motivo. `applicaPersone` non la scrive;
nuove e aggiornate non la contano. L'anteprima dice **«K da abbinare a mano (non
scritte)»** nel riepilogo e nel gruppo, e mostra l'elenco con il motivo **sempre
aperto**, non dietro «Vedi le persone»: un'esclusione che non si vede è
indistinguibile da una riga persa. Il messaggio dopo «Applica» dice quante non sono
state scritte.

| prova (`npm run omonimi:check`) | `f25664e` | `bb141ee` | adesso |
|---|---|---|---|
| A1-A3 · omonimi nel file o in archivio | falliscono (fusione) | falliscono (schede nuove) | **ok**: nessuna voce, da abbinare |
| **A4** · lo stesso file applicato due volte | «2 poi 2» | **«2 poi 4»** | **ok**: 0 schede e 2 da abbinare a ogni passaggio |
| B1-B3, C1 · nome univoco, con CF | ok | ok | ok |

**Cosa manca, ed è il passo successivo:** l'**abbinamento guidato** — scegliere
dall'anteprima a quale scheda attaccare una riga. Oggi la lista dice chi è rimasto
fuori e perché; sistemarle si fa a mano nell'organigramma del cliente.

**Il caso vicino, proposto a Francesco e non implementato.** La stessa persona in
**due gruppi** del file che puntano allo stesso cliente oggi diventa due schede, e
la seconda nasce senza provenienza. La proposta non è la stessa lista per tutti:
- **con CF** è la stessa persona sullo stesso organigramma — un cliente è un
  organigramma — e la cosa giusta è **una scheda sola**, non un abbinamento a mano;
- **senza CF**, due ROSSI MARIO in due sedi dello stesso cliente possono essere due
  persone: lì sì, la lista «da abbinare».
Da decidere prima del prossimo import con collisioni fra gruppi.

**E una terza strada, fuori da tutto questo:** l'import per **singolo cliente** in
Risorse umane (`RisorseUmane.tsx:503`) non ha nessun ripiego sul nome. Senza CF ogni
riga è `riga:N`, nuova, a ogni import — il difetto del 9 settembre, mai chiuso su
quella porta. Scritto, non toccato.

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

Non lo posso risolvere sul file del 2026: quello non è su questa macchina.

**Ma un altro export c'è, e dice che «due aule» non regge.** `ExportExcel (3).xls`
(*Elenco Visite/Formazioni*, dati dichiarati al **28/10/2024**) porta lo stesso
titolo su **cinque date e tre società**:

| `Data` | righe | società |
|---|---:|---|
| 2023-12-27 | 4 | MAEMA SRL UNIPERSONALE |
| 2025-11-08 | 1 | Impresa Agromeccanica Aprili Graziano |
| 2026-03-29 | 9 | MAEMA SRL UNIPERSONALE |
| **2026-05-20** | 14 | **Rittal RCS Cooling Solutions S.r.l.** |
| **2026-09-05** | 26 | **Rittal RCS Cooling Solutions S.r.l.** |

**Le due aule cercate sono di Rittal RCS** — è la risposta che serviva a
Francesco. Sono le stesse del 20.05.2024 e del 05.09.2024 perché cadono **esatte a
due anni**, stesso giorno e stesso mese, su entrambe.

**E in quell'export `Data` non può essere l'erogazione:** il file dichiara i dati
al 28/10/2024 e contiene righe datate 2026. Un export non registra come svolto un
corso che si terrà diciannove mesi dopo. La lettura che torna sui numeri è la
**scadenza**, cioè erogazione + 2 anni — il ciclo che il titolo chiama «biennale».

Il che tocca `formazioneImport.ts:230`, che mappa `Data` su `data_completamento`:
il dubbio era già scritto, adesso **ha un caso dietro invece di un sospetto**. Non
ho cambiato niente — i due export hanno intestazioni diverse e non so se
condividano la semantica — ma la domanda «cosa misura la colonna `Data`», che
AppOverall ha già in cima alla lista per l'Area Formazione, adesso porta una prova.

Quattro cose che quella misura **non** dice, in
[`docs/c1a/biennale-i-clienti-e-le-date.md`](c1a/biennale-i-clienti-e-le-date.md):
non risolve il 30 contro 31 (altro file), non spiega perché i conteggi siano 14 e
26 invece di 5 e 25, e non estende la lettura di `Data` agli altri file.

**Una delle quattro riserve è caduta la sera stessa, ed era la più grossa.**
Avevo scritto che la misura «non conferma che siano le righe da 12 ore, perché
quell'export non ha una colonna di ore». Non le serve: **le 12 ore sono un
attributo del titolo**, dichiarato nel catalogo del gestionale (`righe.json`) —
`… PREPOSTI` 8h, `… PREPOSTI - BIENNALE` **12h**, `… PREPOSTI_BIENNALE` 8h,
`CORSO DI FORMAZIONE PER PREPOSTI` 12h.

Quindi «le righe da 12 ore con quel titolo» è una **tautologia**: ogni riga con
quel titolo è da 12 ore. Il filtro non seleziona niente in più del titolo, e la
differenza fra 54 e 30/31 non è di ore — è di export.

**E lo stesso catalogo dà una seconda gamba alla lettura di `Data`:** per quel
titolo dichiara periodicità **2 anni**, che è esattamente lo scarto osservato fra
le due fonti. Due vie indipendenti allo stesso due — le date osservate e la regola
a catalogo — e la lettura «`Data` = scadenza» non poggia più su una sola
coincidenza.

## Il gestionale ha riscritto le ore dello storico (12 settembre, notte)

**Detto da Francesco**, guardando le due aule del preposto del 2024: «erano tutte
formazioni da 8 ore per completo e 6 per agg. È scritto 12 perché il gestionale ha
aggiornato d'imperio tutte le formazioni fatte con le nuove ore dell'ASR25».

**La colonna ore dell'export non dice cosa è stato erogato.** Per una parte delle
righe dice cosa il catalogo assegna *oggi*, scritto all'indietro sullo storico.

### Perché è peggio della colonna `Data`

Della `Data` era scritto da giorni che non si sapeva cosa contenesse. **Delle ore
nessuno aveva mai scritto che fosse un'assunzione** — in nessuno dei tre repo — e
un'assunzione non dichiarata è indistinguibile da un fatto misurato per chiunque la
legga dopo. La `Data` rende incerta una finestra; le ore rendono incerta **ogni
misura di durata fatta finora**.

### Cosa fa a `durate-come-controllo.md`: lo inverte

Quel documento confronta le ore dell'export con quelle del catalogo. Se una parte
dello storico è stata riscritta **con le ore del catalogo**, allora:

| esito | vale ancora? |
|---|---|
| **divergenza** — l'export dice ≠ catalogo | **sì**: una riga col valore del regime vecchio non può essere stata riscritta a quello nuovo |
| **conformità** — l'export dice = catalogo | **no**: è ciò che la riscrittura fabbrica, e dalle ore non si distingue |

**Le sue anomalie sono il risultato solido; le sue conferme non sono più prove.**

**E una decisione di un'altra corsia poggia sulla riga sbagliata.** AppFormazione
ha esteso `ponteggi_art136` avendo letto `PONTEGGI` nella riga **«100% conforme»**.
Quel verde non è diventato rosso: è diventato **muto**. Va rivisto da chi l'ha
preso — l'ho segnalato, non l'ho toccato.

**E una mia lettura è falsificata.** Avevo scritto che `PREPOSTO` ha «due regimi
separati nel tempo, 8 ore prima dell'ASR e 12 dopo». Le 12 **erano 8**: un regime
solo e una riscrittura.

*Sopravvive ciò che porta valori che il catalogo non ha* — `DIRIGENTE` 16 contro
12, `RLS` agg 8 contro 4, `DL_RSPP_BASE` agg 10 e 14 contro 6, le seconde durate
delle attrezzature — e il **controllo negativo sull'RLS**, perché confrontava
*proporzioni nel tempo* e non valori. Un controllo costruito per non dipendere dal
numero sopravvive a un numero riscritto.

### E due punti del nostro codice che consumano quelle ore

**`componiSpezzoni` (`formazione.ts`) promette una cosa che ora non può
garantire.** Il suo commento dice: «l'errore possibile è un falso ROSSO, mai un
falso verde». Vale finché `f.ore` sono le ore **erogate**: su una riga riscritta
la somma conta ore che nessuno ha fatto, e uno spezzone può superare la soglia
senza che il corso sia stato completato. **Falso verde**, cioè esattamente ciò che
quella funzione dichiara di non poter produrre. Oggi non morde perché `formazione`
è a **zero righe** — non è una difesa, è una scadenza: morde al primo import.

**`formazioneImport.ts:527` ha ora due difetti di segno opposto sulla stessa
riga.** Senza finestra temporale segnala a torto 276 righe genuine; con le ore
riscritte **non** segnala quelle davvero corte, perché ormai combaciano col
catalogo. Rumore da una parte, silenzio dall'altra, sullo stesso elenco.

### Cosa non si fa

**Non si rifanno misure sulle ore dell'export** finché non si sa quali righe sono
state toccate. Non è una lettura da rifare meglio: è una **domanda al gestionale** —
quando è stato fatto quell'aggiornamento, su quali corsi, se resta traccia del
valore precedente. Prima della domanda sulla colonna `Data`.

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
