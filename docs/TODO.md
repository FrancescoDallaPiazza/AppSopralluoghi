# Roadmap AppSopralluoghi

Cose da fare, organizzate per priorità. Aggiornata mentre si lavora, sopravvive
tra le conversazioni. Per il **contesto** (perché esiste l'app, com'è fatta,
modello dati, workflow di rilascio) vedi `PROGETTO.md`.

Convenzione: una riga = una cosa da fare. Si fa, si barra (`- [x]`), e si
sposta in fondo nella sezione "Fatti di recente".

---

## 0 · Direzione (deciso 2026-08-26)

**L'app sostituisce il gestionale sullo scadenzario.** Perimetro deciso: **solo lo
scadenzario**. NON entrano l'erogazione dei corsi (edizioni, iscrizioni, registro
presenze, emissione attestati), la sorveglianza sanitaria come *processo*
(protocollo, convocazioni, giudizi di idoneità) né il lato commerciale (preventivi,
contratti, fatturazione): quelli restano dove sono.

**Transizione: doppio binario a tempo.** L'app diventa la fonte di verità, il
gestionale resta acceso in sola lettura come archivio storico per un periodo
definito. Nessun doppio inserimento: si scrive in app.

**Conseguenza sul codice esistente.** Cambia la *direzione del flusso*. Finora il
gestionale era la fonte e l'app importava; da qui in avanti `formazioneImport`,
`anagraficheImport`, `werpImport` e il dizionario `corso_alias` degradano da
**sincronizzazione permanente** a **utensili di migrazione una tantum**. Restano nel
codice, ma smettono di essere un impegno da tenere allineato al gestionale.

**Stato di partenza, verificato il 2026-08-26.** Dei quattro blocchi dello
scadenzario ne vive **uno solo**:

- **Formazione** — alimentato dalle righe `azione` del Ramo A, che il motore
  materializza da sé. Funziona.
- **Documenti / Autorizzazioni / Sorveglianza sanitaria** — tre viste su un insieme
  **vuoto**. La tabella `adempimento` esiste dalla `055` con la forma giusta, ma
  nessuno la scrive: `lib/admin/scadenzario.ts` non ha una sola funzione di
  scrittura, `admin/Scadenzario.tsx` non modifica adempimenti ("un CPI non si
  conclude"), e `formazioneImport.ts` la cita solo in un commento per dire dove
  *andrebbero* le visite mediche. Il modello dati regge già: manca l'ingresso.

Il lavoro sta in quattro filoni, aperti in **B** come `S1`–`S4` e da fare in
quest'ordine. `S3` può correre in parallelo a `S2`: è quello che dice **quando** si
spegne il gestionale.

**Prima di `S2`** vanno chiuse le verifiche arretrate della sezione **A** e l'aggancio
delle formazioni frazionate a C1b: lo storico di tutti i clienti si carica una volta
sola, e conviene caricarlo su un motore già verificato.

---

## A · Da fare subito (deploy delle ultime feature)

### DATABASE AZZERATO il 2026-08-05 — stato e ripresa

Eseguito `supabase/scripts/azzera_anagrafiche.sql` (PARTE 2) su richiesta:
**tabula rasa** di clienti, persone e storico rilievi. Verificato: tutte le
tabelle a 0. Cancellati: 7 clienti, 181 persone (186 nomine, 384 formazioni,
4 esoneri), 12 sedi, 65 revisioni organigramma, 1 incarico, 4 sopralluoghi
(4 checklist, 24 esiti, **0 foto**), 264 azioni, 268 alias.
La configurazione è intatta e va ricontrollata identica: tecnico 3,
checklist_template 5, box_catalogo 16, corso_catalogo 40, figura_sicurezza 13.

Ripristino del dizionario alias, sequenza in 3 passi:
- [x] `ripristina_alias_gestionale.sql` — **fatto**. Reimmette i 268 testi
  esatti senza bisogno dell'export Excel (che **non c'è più**): sono conservati
  dentro `mappatura_alias_gestionale.sql`, che li elenca uno per uno, e da lì
  sono copiati carattere per carattere. Verificato: 268 identici uno a uno.
- [x] `mappatura_alias_gestionale.sql` — **fatto**, esito confermato:
  `damappare 0, mappati 237, ignorati 31, totale 268`.
- [x] `integrazione_preposti_pregressa.sql` — **fatto 2026-08-06**, esito
  verificato: *INTEGRAZIONE FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI* →
  `PREPOSTO`, `pregressa true`, `parziale false`, `evidenza_incompleta true`.
  Le altre 9 righe `INTEGRAZIONE ...` (PLE, specifica lavoratori, moduli 3-4
  del datore RSPP) restano intatte come previsto: non sono lo stesso caso.

**Dizionario alias completo e allineato allo stato del 2026-07-30.** Nessun
altro passo di ripristino da fare: l'import formazione può girare.

Da fare prima di rimettere dentro dati veri:
- [ ] **Chiudere e riaprire la PWA** su ogni dispositivo, back-office compreso:
  la cache locale (Dexie/IndexedDB) ha ancora i 7 clienti e le 181 persone
  cancellate, e la outbox può tentare di scrivere verso righe che non esistono.
- [ ] **NON svuotare gli Storage bucket**: i PDF degli attestati sono rimasti e
  sono l'unica copia superstite delle 384 formazioni cancellate. Decidere con
  calma, separatamente.
- [ ] Ricreare i clienti. Dal 2026-08-26 c'è **Anagrafiche → Import anagrafiche**
  (vedi "Fatti di recente"): un Excel/CSV con una riga per cliente li rifà tutti
  in un colpo, e un secondo file rifà le persone di più clienti insieme. A mano
  resta *Anagrafiche → + Nuovo cliente*. In ogni caso il **rischio** si propone
  da solo dall'ATECO (tabella Allegato IV ASR 2025); restano da compilare
  **livelli antincendio/primo soccorso**, che nessun file può dare, e l'import
  li elenca riga per riga come mancanti.
- [ ] **OVERALL GROUP si ricrea con uno script, non a mano** (scoperto
  2026-08-06): `supabase/migrations/046_import_organigramma_overall_standalone.sql`
  ricrea il cliente interno (P.IVA 04534450236) con persone, nomine, formazioni
  ed esoneri — PRADELLA TAZIO su `dl_rspp`, STELLUTI ERIKA e VEDOVA MARTINA coi
  loro ruoli — e `047_overall_datore_lavoro_nomina.sql` aggiunge la nomina a
  datore. Entrambi **idempotenti**, dedup su P.IVA e codice fiscale, quindi
  rieseguibili senza duplicare. L'azzeramento di ieri ha cancellato quelle
  righe: rilanciarli le riporta indietro complete.

**File di origine** — correzione del 2026-08-26: `elencoAnagraficaFormazioni.xlsx`
**non è perduto**, sta in `docs/c1a/` (272 righe, il catalogo corsi del
gestionale). Resta vero che non serve più: il ripristino alias non lo usa.
Perduto è `ExportExcel.xlsx` (registro attestati), e quello sì che pesa: senza,
le 384 formazioni importate non sono ricostruibili da nessuna parte se non
ri-esportandolo dal gestionale.

### Verifiche in app arretrate (scritto 2026-08-05)

Tutto quanto segue è **già su `main`** e non richiede migration né deploy di
Edge Function: è solo Canale 1, con `tsc --noEmit` + `vite build` verdi. Manca
la prova sull'app vera. Raggruppate qui perché sono lavoro di una sessione sola
davanti al cliente giusto, non tre cose diverse.

**Import anagrafiche** (2026-08-26) — il codice è su `main`, `tsc` + `vite build`
verdi, e la logica di raggruppamento/abbinamento è provata a tavolino su file
costruiti apposta. Manca la prova sull'app vera, che è anche l'occasione per
rifare i clienti azzerati:

- [ ] *Anagrafiche → Import anagrafiche → **Scarica modello clienti***,
  compilarlo con i clienti veri e ricaricarlo: l'anteprima deve dire **nuovi**,
  l'ATECO riconosciuto col rischio che ne discende, e i **mancanti** riga per
  riga. Poi *Applica*, e **riapplicare lo stesso file**: la seconda volta deve
  dire *già a posto* e non scrivere niente.
- [ ] Ricaricare il file dopo aver **corretto a mano** un campo in anagrafica:
  quel campo **non** deve tornare al valore del file.
- [ ] **Modello persone** con almeno due clienti diversi nello stesso file:
  ogni gruppo deve proporre il suo cliente, e i conteggi *nuove/aggiornate*
  devono cambiare quando si sposta l'abbinamento in tendina.
- [ ] Mandare **a mano** due gruppi sullo stesso cliente → deve comparire
  l'avviso rosso di collisione su **entrambe** le card.
- [ ] Caricare un file di **persone** quando il loro cliente non esiste ancora:
  il gruppo deve restare senza cliente e l'import non deve crearlo.
- [ ] Caricare il file **sbagliato** (persone dove ci vogliono clienti): deve
  essere letto come persone e non come clienti, senza scrivere nulla.
- [ ] Verificare che l'import dentro *Risorse Umane* (rifattorizzato sullo
  stesso vocabolario) legga ancora i file di prima: è l'unica regressione
  possibile di questo lavoro.

**Mansione e reparto** (`fbfe2a3`, `6b7ee0b`, `9262bcb` — 2026-08-05):

- [ ] *Risorse Umane → + Aggiungi*: digitare **mansione** e **reparto** in
  minuscolo → si scrivono in maiuscolo mentre si digita. Stessa cosa aprendo in
  *Modifica* una persona già esistente.
- [ ] Su un cliente con **almeno due mansioni diverse** già in anagrafica: il
  campo *Mansione* apre la tendina delle mansioni già usate; sceglierne una la
  compila. Idem per *Reparto* con la sua tendina, che deve essere **separata**
  (le mansioni non devono comparire fra i reparti e viceversa).
- [ ] **Scrivere una mansione nuova**, non in elenco → si inserisce lo stesso.
  È un `<datalist>` e non una `<select>`: se non si riesce a digitare un valore
  nuovo, il campo è stato chiuso per errore ed è un difetto.
- [ ] La tendina deve proporre anche le mansioni di persone **cessate** e di
  quelle escluse dalla ricerca in corso: filtrare l'elenco a schermo non deve
  togliere voci al vocabolario. Prova: cercare qualcosa che nasconda quasi
  tutti, poi aprire il form e controllare che le proposte siano ancora tutte.
- [ ] *Organigramma → apri un ruolo → Assegna → **+ Persona non in elenco***:
  stessa tendina di mansioni della scheda Risorse Umane. È il caso che il
  lavoro doveva risolvere — chi crea la persona al volo è chi inventava
  diciture nuove.
- [ ] **In campo** (`FormazioneRiepilogo`): la stessa tendina deve comparire,
  offline compresa. `OrganigrammaView` è condivisa, quindi se manca lì è un
  problema di dati passati, non di UI.
- [ ] *Risorse Umane → Importa da Excel* con mansioni/reparti in minuscolo nel
  file → entrano in **maiuscolo**.
- [ ] **La data di cessazione disattiva da sola** (nuovo, 2026-08-05): aprire una
  persona **in forza**, scrivere una data di cessazione **passata** → sotto il
  campo compare l'avviso "Salvando, esce dall'organigramma…"; dopo *Salva* la
  persona sparisce dall'elenco (filtro *In forza*), non compare più
  nell'organigramma e **i suoi requisiti e le sue scadenze spariscono dal
  riepilogo del cliente e dallo scadenzario**. Riaprirla con *Tutti*, togliere
  la data, *Salva* → torna in forza con i suoi requisiti.
- [ ] **Data futura = errore probabile**: scrivere una cessazione **dell'anno
  prossimo** → avviso **rosso** sotto il campo ("Data nel futuro (…, fra N
  giorni): la persona resta in forza…"). Dopo *Salva* la persona **resta** in
  elenco e in organigramma — voluto — ma la riga porta la pill rossa **data da
  verificare** accanto al cognome, con il dettaglio nel tooltip. Correggendo
  l'anno a una data passata, la pill sparisce e la persona esce.
- [ ] **Disattiva non butta più le modifiche**: in modifica, scrivere una data di
  cessazione (o cambiare la mansione) e premere **Disattiva** *senza* aver
  premuto Salva → la data digitata e le altre modifiche vengono conservate.
  Prima `toggle()` leggeva lo stato salvato e sostituiva la data con oggi.
- [ ] **Import da Excel non riattiva i cessati**: reimportare un file che
  contiene una persona già cessata → deve **restare** cessata (prima
  `attivo: true` secco la riportava in forza tenendole però la data, cioè
  proprio lo stato incoerente che questo lavoro elimina).
- [ ] **Filtro cessati** (nuovo, 2026-08-05): in testa a *Risorse Umane*, accanto
  a ricerca e ruoli, la tendina **In forza / Solo cessati / Tutti** con i
  conteggi; compare **solo** se qualcuno è cessato. La vecchia spunta *Mostra
  anche i disattivati* in fondo alla tabella non c'è più. Con *Tutti* o *Solo
  cessati*, la riga porta l'etichetta **cessato gg/mm/aaaa** accanto al
  **cognome** (prima era nella colonna Mansione). Filtrando fino a zero righe il
  messaggio dice "Nessuna persona con i filtri attivi" e **non** "Aggiungine
  una".
- [ ] **Grafie doppie già a DB**: controllare che una mansione scritta in
  passato in due modi (`Saldatore` / `SALDATORE`) compaia **una sola volta** in
  tendina. Il dedup è case-insensitive, ma le varianti *diverse* nel testo
  (`SALDATORE` / `ADDETTO SALDATURA`) restano tutte: sono da accorpare a mano
  se e quando lo si decide. Vedi la voce in coda.

**Organigramma e scadenzario** (`7315b7d`, `d750f54`, `57c8bc6` — 2026-08-04):

- [ ] *Organigramma attuale* → clic su una **riga-persona** di un ruolo
  affollato (i Lavoratori dopo un import): si apre la **sua sola** scheda, con
  in testa la barra "Scheda di … · il ruolo ha N incaricati" e il bottone
  *Vedi tutti gli incaricati (N)*. Dalla riga-testata del ruolo, invece, si
  deve continuare ad aprire il ruolo **intero**.
- [ ] **Ricerca per persona** sopra *Organigramma attuale*: da 2 caratteri
  sostituisce la tabella; "rossi mario" e "mario rossi" trovano la stessa
  persona; cerca anche per mansione, reparto e codice fiscale; *Apri il ruolo*
  pulisce la ricerca e porta alla scheda.
- [ ] **Scadenzario**: una persona con un corso **Mai svolto** produce una riga
  con pill rossa **SUBITO**, in cima a qualunque data, contata fra le
  *Scadute* e presente nei filtri *Scadute* e *Prossime*. Ricordare che il tab
  Scadenzario generale non sincronizza: passare **prima** sulla scheda del
  cliente.
- [ ] **Doppioni pregressi**: se su quel cliente era già stato premuto *Genera
  cose da fare*, gli stessi gap possono comparire **due volte** come SUBITO
  (una riga `origine_ramo='formazione'` senza data + una nuova da backfill).
  Guardare e decidere: non le ho cancellate d'ufficio.

Per attivare il **numero di lavoratori** e le ore RLS che ne dipendono
(scritto 2026-08-03):

- [x] Eseguire `supabase/migrations/062_cliente_numero_lavoratori.sql` nell'**SQL
  Editor** (Canale 3): `cliente.numero_lavoratori` (integer, nullable).
  Idempotente, ASCII-only, `pglast` OK. **Eseguita 2026-08-03.**
- [x] Push dei sorgenti su `main` (Canale 1) — **fatto 2026-08-03** (`caf33bf`).
  Tocca: `types.ts`,
  `lib/admin/anagrafiche.ts` (colonne + upsert + `clienteVuoto`),
  `admin/Anagrafiche.tsx` (campo *Numero di lavoratori* sotto l'ATECO),
  `lib/admin/cosedafare.ts` (`ore_nota` + regola RLS), `lib/admin/scadenzario.ts`,
  `admin/Scadenzario.tsx`. `tsc -b` + `vite build` verdi 2026-08-03.
- [ ] Verifica: *Anagrafiche → cliente → Dati anagrafici*, campo **Numero di
  lavoratori** vuoto → nello **Scadenzario** la riga dell'aggiornamento RLS
  mostra "4h o 8h — indicare il numero di lavoratori in anagrafica" al posto
  delle ore; compilando 40 → 4h, compilando 60 → 8h.

Il dato **non si deduce**: art. 37 c. 11 D.Lgs 81/08 lega le ore
dell'aggiornamento RLS alla dimensione (4h fino a 50 lavoratori, 8h oltre) e il
catalogo (015) teneva fisso il minimo, sbagliato per difetto sopra i 50 senza
che nulla lo segnalasse. Un default plausibile non si distingue da un dato
verificato, quindi l'app lo chiede e dichiara l'incertezza finche' manca.

**Da decidere** (non implementato): sotto i 15 lavoratori l'aggiornamento
periodico dell'RLS non e' previsto dalla norma. Oggi l'app lo pretende comunque
— toglierlo significa cambiare la valutazione di conformita', non un'etichetta.

Per attivare la **data di cessazione della persona** (scritto 2026-08-02):

- [x] Eseguire `supabase/migrations/061_persona_data_cessazione.sql` nell'**SQL
  Editor** (Canale 3): `persona.data_cessazione` (date, nullable). Idempotente,
  ASCII-only. **Eseguita 2026-08-03.**
- [x] Push dei sorgenti su `main` (Canale 1) — **fatto 2026-08-02** (`1112a10`).
  Tocca: `lib/admin/formazione.ts`
  (tipo `Persona` + upsert), `formazione/RisorseUmane.tsx` (campo *Data
  cessazione*, il bottone *Disattiva* la valorizza a oggi / *Riattiva* la azzera,
  badge riga "cessato gg/mm/aaaa"), `formazione/OrganigrammaView.tsx` e
  `lib/admin/formazioneImport.ts` (literal `Persona` allineati). La colonna e'
  puramente anagrafica: **non** incide sulla valutazione, che resta su `attivo`.
  `tsc -b` + `vite build` verdi 2026-08-02.
- [ ] Verifica in *Anagrafiche → cliente → Risorse Umane*: aprire una persona,
  vedere il campo *Data cessazione*; *Disattiva* mette la data a oggi e la riga
  mostra "cessato gg/mm/aaaa"; *Riattiva* la toglie; la data resta correggibile
  a mano.

- [x] Eseguire `supabase/migrations/060_evidenza_incompleta.sql` nell'**SQL
  Editor** (Canale 3). **Eseguita 2026-07-31.** `corso_alias.evidenza_incompleta` +
  `formazione.evidenza_incompleta`. Marca gli attestati che documentano solo una
  PARTE del percorso svolto (la sola aula di un corso iniziato in e-learning).
  Non tocca la conformità — il requisito resta assolto — ma apre una pendenza
  **documentale**: avviso nel libretto e voce in *Cose da fare*, come già per le
  evidenze di nomina. Serve un flag e non la nota libera: un buco che non genera
  lavoro non viene chiuso. Idempotente, ASCII-only, `pglast` OK.
- [x] Eseguire `supabase/scripts/integrazione_preposti_pregressa.sql`
  nell'**SQL Editor** (**eseguito 2026-07-31**) (non è una migration: agisce sul dizionario `corso_alias`,
  popolato dai dati). `INTEGRAZIONE FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI`
  (3h) è la parte in aula di un corso preposti 8h ante ASR 2025 (prime 5h in
  e-learning, che il gestionale non esporta). **Deciso 2026-07-31: il corso è
  concluso prima dell'ASR 17/04/2025, quindi il requisito è assolto** → la riga
  si marca `pregressa`, non spezzone. Trattarla da spezzone l'avrebbe lasciata
  aperta per sempre: le ore dovute a catalogo sono 12 (ASR 2025) e 3+5 non ci
  arrivano — il percorso vecchio non si giudica col monte ore del nuovo. La
  scadenza è corretta senza recuperare nulla: l'aula è l'ultima parte, quindi
  l'08/07/2022 è la conclusione. Resta dovuto l'aggiornamento biennale. Lo
  script allinea anche le righe già importate. `pglast` OK, ASCII-only.
  In coda l'elenco delle altre `INTEGRAZIONE ...` che **non** sono lo stesso
  caso e non vanno toccate.

Per attivare il **libretto formativo per persona** (scritto 2026-07-31):

- [x] Deployare la Edge Function **`libretto-pdf`** dal Dashboard Supabase
  (**fatto 2026-07-31**)
  (self-contained, CORS inline, nessun import da `_shared`). Usa la stessa
  `PDFBOLT_API_KEY` di report e organigramma: se manca, ripiega su HTML invece
  di fallire. Senza deploy la schermata funziona lo stesso — è solo l'*Esporta
  PDF* che risponde "Function not found".
- [x] Push dei sorgenti su `main` (Canale 1) — **fatto 2026-07-31** (`a6837d5`,
  build Vercel verde). Nuovi: `lib/admin/libretto.ts`,
  `formazione/Libretto.tsx`; toccati `formazione/RisorseUmane.tsx` (bottone
  *Libretto* per riga), `admin/Anagrafiche.tsx` (passa la ragione sociale),
  `lib/admin/formazione.ts` (`addMesi` esportata).
- [x] Verifica: *Anagrafiche → cliente → Risorse Umane → Libretto* su una
  persona con attestati importati. Attesi: i ruoli con data di nomina, TUTTA la
  formazione svolta in ordine cronologico (compresi gli attestati che non
  servono a nessun requisito dei suoi ruoli — è l'unico punto dell'app dove si
  vedono) e la situazione rispetto ai ruoli. Poi *Esporta PDF*.
  **Provato in app 2026-08-02: OK.**


Per attivare **C1a — alias corsi del gestionale**, nell'ordine:

> **Correzione 2026-07-30 — l'export da caricare è un altro, e i numeri di
> accettazione qui sotto erano sbagliati.** Il gestionale offre due export che
> si somigliano. Quello usato finora (`ExportExcel`, 74 righe) è **la sola
> categoria "Generica"**: verificato che le sue 74 righe sono esattamente le
> 74 righe con `Categoria='Generica'` del file completo. L'export giusto è
> **`elencoAnagraficaFormazioni.xlsx`** (foglio "Anagrafica Formazione"):
> **268 corsi**, 268 chiavi distinte, 0 collisioni di normalizzazione, 2 righe
> di coda scartate. Caricando il vecchio si mapperebbe il 28% del catalogo
> credendo di aver finito. Il parser regge sul file nuovo senza modifiche (la
> colonna `E = Categoria`, che il vecchio non ha, veniva semplicemente
> ignorata).

- [x] Eseguire `supabase/migrations/057_corso_alias_ignorato_pregressa.sql`
  nell'**SQL Editor** di Supabase (Canale 3): `corso_alias.ignorato` +
  `corso_alias.pregressa`. Idempotente, ASCII-only, `pglast` OK.
  **Eseguita** (verificato 2026-07-29: DB è alla 057).
- [x] Eseguire `supabase/migrations/058_catalogo_attrezzature_mancanti.sql`
  nell'**SQL Editor** (Canale 3): 6 codici che mancavano al catalogo e che
  l'export completo ha fatto emergere — `ATTR_AUTORIBALTABILI`, `ATTR_CMM`,
  `ATTR_CRF`, `ATTR_POMPE_CLS`, `ATTR_TRATT_RUOTE_CINGOLI` (attrezzature
  art. 73) e `PONTEGGI` (Allegato XXI, 28h / aggiornamento 4h ogni 4 anni).
  Senza, quelle righe resterebbero "da mappare" per sempre e il contatore non
  arriverebbe mai a 0. Idempotente, ASCII-only, `pglast` OK.
  **Eseguita 2026-07-30.**
- [x] Push dei sorgenti su `main` (Canale 1, Vercel auto-deploy) — **fatto**
  (verificato 2026-08-04: `aliasCorsi.ts` / `AliasCorsi.tsx` in albero da
  `be89272`, working tree clean).
  Tocca: `lib/admin/aliasCorsi.ts` (nuovo), `admin/AliasCorsi.tsx` (nuovo),
  `admin/BackOffice.tsx`, `lib/admin/catalogoImport.ts` (esporta `periodicitaMesi`).
  Aggiunta 2026-07-30: `RigaCatalogoGestionale.categoria` (colonna E) letta dal
  parser e mostrata come pill in anteprima e in lista — è il segnale che
  distingue il catalogo ufficiale ASR 2025 dal bucket legacy "Generica", e un
  modulo B del 2016 dal suo omonimo 2025. **`tsc -b` + `vite build` verificati
  2026-08-02** (node reinstallato: la nota "node non è installato" è superata).
- [x] Verifica in back-office → **Regole app → Alias corsi**: caricato
  `elencoAnagraficaFormazioni.xlsx`, anteprima **268 corsi nel file / 194
  nuovi** → *Applica*. I nuovi sono 194 e non 268 perché 74 alias erano già in
  tabella da un caricamento precedente del vecchio `ExportExcel` (268 − 74 =
  194: i conti tornano esatti, non è un'anomalia). **Fatto 2026-07-30.**
- [x] Mappare gli alias fino a **0 da mappare** — è ciò che sblocca C1b.
  **Fatto 2026-07-30**, non a mano: il lavoro si divideva in **193 righe**
  dalle categorie ufficiali (Accordo Stato Regioni 2025, Attrezzature,
  Aggiornamenti, Lavoratore, Datoriale, Dirigenti, RSPP 2016, Coordinatore) —
  nomenclatura pulita, mappatura quasi meccanica — e **75 righe** della
  categoria `Generica`, il bucket legacy con quasi-duplicati, spezzoni e righe
  ECM/ANSF. Decisioni di merito prese: vedi sotto.
- [x] Eseguire `supabase/migrations/059_formazione_parziale.sql` nell'**SQL
  Editor** (Canale 3): `corso_alias.parziale` + `formazione.parziale`, per la
  formazione frazionata (vedi sotto). Idempotente, ASCII-only, `pglast` OK.
  **Eseguita 2026-07-30.**
- [x] Applicare la mappatura di massa con
  `supabase/scripts/mappatura_alias_gestionale.sql` (**non è una migration**:
  si esegue nell'SQL Editor DOPO l'upload, perché prima gli alias non
  esistono). Generato dall'export con un motore di regole, non trascritto a
  mano: **237 mappati** (98 aggiornamenti, 7 spezzoni, 1 evidenza pregressa —
  la riga `PRE ASR_2015_…` su `ATTR_CARRELLO`), **31 ignorati**, **0 da
  mappare**. Idempotente; `pglast` OK (79 statement). NON è ASCII-only, e non
  può esserlo: il testo deve combaciare carattere per carattere con quello
  caricato dal parser (apostrofi tipografici `’`, accentate `À`). Il `select`
  finale in coda allo script verifica che i conteggi tornino.
  **Eseguito 2026-07-30: `damappare = 0`, totale 268.**
- [x] Risolvere le divergenze con `supabase/scripts/divergenze_fix.sql`
  (**Fatto 2026-07-30**). Gli update della mappatura di massa sono volutamente
  non distruttivi (`where corso_codice is null and not ignorato`): non
  sovrascrivono mai una decisione presa a mano, stesso principio di
  `applicaAlias()`. `supabase/scripts/divergenze_alias.sql` — sola lettura —
  elenca i casi in cui la decisione già presente diverge dalla proposta. Ne
  sono emersi **2**, entrambi decisioni giuste quando furono prese e superate
  dopo, quindi forzate a mano:
  - *transpallet*, mappato su `ATTR_CARRELLO` → **ignorato**. L'Allegato A
    riguarda i carrelli elevatori semoventi con conducente a bordo, non i
    transpallet a timone: tenerlo lì avrebbe fatto risultare abilitata al
    muletto una persona con 2h di transpallet.
  - *ponteggi* (`LAVORATORI E PREPOSTI ADDETTI AL MONTAGGIO…`), ignorato →
    **`PONTEGGI`**. Era escluso perché il codice non esisteva; la 058 lo ha
    aggiunto. Senza la correzione sarebbe finito in uno stato diverso dalla sua
    riga gemella della categoria Attrezzature.

Decisioni di merito prese il 2026-07-30 sulle righe dubbie:
  - *trattori a ruote **e** cingoli* (4 righe): **terzo codice**
    `ATTR_TRATT_RUOTE_CINGOLI` (migration 058). L'Allegato A prevede il
    percorso congiunto come corso a sé (13h, non 8+8): forzarlo su uno dei due
    codici separati dichiarerebbe abilitata una sola tipologia di trattore.
  - *transpallet* (1 riga, 2h): **ignorato**, non richiede abilitazione art. 73.
  - *righe "parziale"* (7): **mappate sul corso di cui sono spezzone e marcate
    `parziale = true`**. Vedi il blocco qui sotto: è la parte che manca.

### Somma delle formazioni frazionate — motore FATTO, resta l'aggancio a C1b

- [x] **Motore** (2026-07-30, `lib/admin/formazione.ts`). `scegliFormazione`
  esclude gli spezzoni: uno spezzone non può mai vincere come attestato.
  `componiSpezzoni` li raggruppa per `corso_codice` + `is_aggiornamento` e,
  quando la somma delle ore raggiunge la soglia, immette nella stessa gara un
  attestato **virtuale** datato allo spezzone più recente del gruppo — è lì che
  l'obbligo si è chiuso, ed è da lì che decorre la scadenza. Sotto soglia non
  produce nulla e il dettaglio del requisito dice a che punto è
  ("Formazione frazionata in corso: 4h su 6h"). Vale per back-office e campo
  insieme: passano entrambi da `valutaCliente`.
  Aggiunta `ORE_AGG_DL_RSPP` (6/10/14 per rischio): `corso_catalogo.ore_aggiornamento`
  ne tiene una sola (6), che va bene per mostrare un numero ma non come soglia —
  con 6 al posto di 14 tre spezzoni da 2h chiuderebbero un obbligo che ne vuole
  sette. Non cambia nulla di preesistente: la soglia serve solo alla somma.
  **`tsc -b` + `vite build` VERIFICATI 2026-08-02 — verdi.**
- [x] **Aggancio in C1b** — **fatto**: l'import copia `corso_alias.parziale` su
  `formazione.parziale` (`formazioneImport.ts`, `parziale: a.parziale` in lettura
  del dizionario e `parziale: v.parziale` nell'insert degli attestati). Senza,
  gli spezzoni entrerebbero come attestati interi e la somma non servirebbe a
  niente. `select('*')` ovunque, quindi la colonna arriva da sola sia in
  back-office sia nella cache Dexie del campo: nessuna lista di colonne da
  aggiornare.
- [ ] **Limite noto da tenere d'occhio**: la somma non ha finestra temporale.
  6h nel 2018 + 6h nel 2024 senza mai chiudere il corso risultano un obbligo
  assolto nel 2024. Nei dati veri gli spezzoni sono erogati in sequenza
  ravvicinata (1\2 e 2/2 dello stesso corso), quindi è teorico; una finestra
  andrebbe legata al ciclo di aggiornamento e introdurrebbe errori suoi. Da
  affrontare **se** emerge nei dati dopo il primo import.

Il problema che tutto questo risolve: `scegliFormazione` prende l'attestato
**più recente** per `corso_codice` e ne calcola la scadenza, quindi senza il
flag uno spezzone da 2h risulterebbe un requisito **assolto**. Le 7 righe
interessate:

| spezzone | ore | requisito | soglia |
|---|---|---|---|
| Formazione specifica rischio alto parziale 6H 1\2 e 2/2 | 6 + 6 | `LAV_SPEC` iniziale | 12h (rischio alto) |
| Aggiornamento parziale per lavoratori (×2, una "aperitivo") | 2 | `LAV_SPEC` aggiornamento | 6h |
| Aggiornamento parziale per R.L.S. / per RLS | 2 | `RLS` aggiornamento | 4h (8h se >50 lav.) |
| Aggiornamento parziale per RSPP datore di lavoro rischio alto | 2 | `DL_RSPP_BASE` aggiornamento | 14h (rischio alto) |

Quello che **serve già e non va costruito**: `formazione.ore` (colonna dalla
015) tiene le ore dello spezzone; le ore *richieste* sono già risolte dal
motore (`ORE_SPECIFICA[rischio]` per LAV_SPEC, `oreModuloSettore` per i moduli
di settore, `corso.ore` / `corso.ore_aggiornamento` altrove);
`formazione.is_aggiornamento` distingue già gli spezzoni dell'iniziale da
quelli del rinnovo.

### C1b — import della formazione dal gestionale (scritto 2026-07-31)

Nuovi: `lib/admin/formazioneImport.ts` + `admin/ImportFormazione.tsx`, agganciato
in `BackOffice.tsx` sotto **Anagrafiche → Import formazione** (sta lì e non fra
le Regole app: scrive dati dei clienti, non regole).

**Sorgente**: l'export **"Ricerca Visite/Formazioni"** del gestionale
(`ExportExcel.xlsx`), che è il registro dei fatti — una riga per attestato con
persona, corso, data e ore. **Non** `scadenzarioSedi.xlsx`, che è un derivato:
elenca le scadenze già calcolate, senza data del corso né ore, e importarlo
significherebbe dedurre gli attestati invece di leggerli.

Verificato sul file vero (Ecodent, 127 righe): header a **riga 3** (riga 1
titolo, riga 2 vuota — diverso dagli altri due export del gestionale, che hanno
l'header a riga 1, per questo lo si cerca invece di darlo per scontato); 127
righe con data, ore e codice fiscale su tutte; **28 testi-corso distinti, 28 su
28 risolti dal dizionario alias**; 127 chiavi di import distinte su 127 righe.

- [x] **Verifica in back-office → Anagrafiche → Import formazione** con
  `ExportExcel.xlsx`. Atteso: 2 unità — `VILLAFRANCA DI VERONA` (60 righe, 11
  persone) e `TREVENZUOLO` (67 righe, 9 persone) — ognuna da abbinare al suo
  cliente. Poi *Importa*; rilanciando lo stesso file: 0 nuove, tutte "già
  importate". **Provato in app 2026-08-02: OK — 2 unità abbinate, re-import 0 nuove.**
- [x] **`tsc -b` + `vite build`** — **verdi 2026-08-02** (node reinstallato,
  `npm install` per ripristinare `node_modules`; build pulita, solo warning
  cosmetico chunk >500kB preesistente).
- [x] **Prerequisito in anagrafica per le aziende multi-stabilimento**: i clienti
  che condividono la P.IVA condividono anche la **sede legale**, quindi
  l'anagrafica da sola non li distingue — in tendina compaiono come due voci
  identiche e nessuna proposta è possibile. Il dato che li separa è la **sede
  operativa**: va compilata sul cliente di ogni stabilimento diverso dalla sede
  legale (Ecodent: al cliente di Trevenzuolo la sede operativa VIA DEL LAVORO
  6/8, 37060 TREVENZUOLO). Verificato il 2026-07-31 sull'app in produzione.

Correzioni all'abbinamento fatte il 2026-07-31 dopo la prima prova sul campo:
  - `proponiCliente` guarda **prima la sede operativa** e solo dopo la legale, e
    nel ripiego sulla legale **scarta i clienti che hanno una sede operativa**
    (se ce l'hanno, è lì che si lavora). Senza, un'azienda con due stabilimenti
    e una sola sede legale resta ambigua per sempre.
  - Nuova `proponiAbbinamenti`: la proposta si calcola per **tutto il file** e si
    **ritira** se lo stesso cliente risulta proposto a più di una unità. Il
    controllo per singola unità non poteva accorgersene: il passo sul luogo ci
    arrivava per due strade diverse (una unità per località, l'altra per CAP,
    quando il cliente tiene la località di una sede e il CAP dell'altra).
  - Il **CAP da solo** aggancia solo se la località in app non contraddice
    quella del file (riscontro sulla prima parola, che le abbreviazioni
    conservano: "Villafranca V.se" resta compatibile, "Trevenzuolo" no).
    Emerso da un refuso vero — CAP di Trevenzuolo sul cliente di Villafranca:
    con l'OR secco fra località e CAP un CAP digitato male aggancia lo
    stabilimento sbagliato in silenzio. `incoerenzeLuogo` mostra inoltre in
    anteprima le divergenze CAP/località fra cliente scelto e file (segnala,
    non blocca: il gestionale non è la fonte di verità dell'anagrafica).
  - La tendina mostra il luogo che distingue (`etichettaCliente`) e non la sola
    località dell'anagrafica; `autoComplete="off"` sul select, perché al refresh
    Chrome ripristina da sé il valore e l'abbinamento sembra comparso da solo.
  - Niente spunta "crea le N persone" su una card bloccata: nascerebbero sul
    cliente sbagliato e la proposta si legge come un'approvazione.

Aggancio all'organigramma (2026-07-31, dopo il primo import vero): le persone
create dall'import ricevono la figura **`lavoratore`** (`nomina`, data = data di
assunzione dal file). Senza, la persona non ha figure → nessun requisito → e la
formazione l'app la mostra solo appesa a un requisito: gli attestati importati
restavano righe scritte e invisibili, scadenzario compreso. Per i Lavoratori non
è dovuto un atto di nomina (`evidenzaMancante` li esclude), quindi non si dà per
fatto un adempimento che non c'è. Spunta togliibile, accesa di default.
Nel pannello di assegnazione di un ruolo (`OrganigrammaView`) ci sono ora
**Seleziona tutte / Deseleziona tutte** e, al passo della formazione pregressa,
**Tutte pregresse / Tutte ASR 2025**: con 100 lavoratori la tendina uno-alla-
volta non è un lavoro, è un ostacolo. Serve anche per le persone già importate
prima di questa modifica, che nomine non ne hanno.

Emerso dal primo import vero (2026-07-31), corretto:
  - Il requisito mostrava **solo la scadenza**, non la data dell'attestato da cui
    è calcolata: `RequisitoValutato.data_completamento` (nuovo campo, popolato in
    `valutaPersona` e in `statoAggiornamentoDopoEsonero`) e "svolto il gg/mm/aaaa"
    nelle tre viste dei requisiti. Una scadenza senza data di svolgimento non è
    verificabile su un attestato.
  - Nel pannello di assegnazione di un ruolo si sceglieva da **tutta** l'azienda
    in ordine alfabetico. Ora `PersonaValutata.corsiSvolti` (attestati registrati,
    a prescindere dai ruoli — i requisiti raccontano solo le figure che la persona
    ha già) alimenta il filtro *"solo chi ha già il corso attinente"*, con il corso
    dovuto preso da `corsoEmergenzaRichiesto` per antincendio/primo soccorso (là
    dipende dai livelli aziendali, non dal catalogo della figura). Acceso di
    default **solo** per gli addetti alle emergenze: sui Lavoratori nasconderebbe
    proprio chi va assegnato. Chi è già selezionato resta sempre visibile.

Decisioni prese scrivendolo:
  - **Un'unità = (P.IVA, Sede)**, e ogni unità va su un cliente distinto.
    Ecodent ha due sedi operative con la **stessa P.IVA** e squadre di emergenza
    separate (Trevenzuolo 6 antincendio + 5 primo soccorso, Villafranca 4 + 3):
    fonderle in un organigramma unico farebbe contare 10 addetti e dire
    "coperto" senza accorgersi che una sede può restare scoperta. Gli addetti si
    designano per **luogo di lavoro**. Nessun vincolo di unicità su
    `cliente.partita_iva`, quindi due clienti possono condividerla.
  - Conseguenza: **la P.IVA non identifica il cliente**. L'abbinamento
    unità → cliente lo conferma l'operatore; `proponiCliente` propone solo
    quando è certo (P.IVA unica, o P.IVA + località/CAP), altrimenti tace.
  - **L'import non crea i clienti.** Un cliente nato dal file sarebbe privo di
    ATECO, livello di rischio e livelli di emergenza — che il file non ha e che
    guidano il motore: con `livello_rischio` nullo non si sa nemmeno quante ore
    di specifica siano dovute. L'anteprima segnala l'unità orfana e mostra i
    dati per crearlo a mano, completo.
  - **Le persone sì, ma dopo conferma** (spunta nell'anteprima), agganciate per
    **codice fiscale** e non per nome.
  - Le righe `Genere = Visita` si scartano: sono sorveglianza sanitaria, il loro
    posto è `adempimento`, non `formazione`.
  - `import_key = gest:CF:corso-normalizzato:data`. Identifica la **riga di
    origine**, non il record che ne nasce: se un alias viene rimappato su un
    altro codice, lo stesso attestato reale resta una riga sola.
  - `insert` e non `upsert`: l'indice di idempotenza della 055 è **parziale**
    (`where import_key is not null`) e `ON CONFLICT` non aggancia gli indici
    parziali — PostgREST non permette di passarne il predicato. L'idempotenza la
    dà il filtro a monte su `chiaviGiaImportate`.
  - `scadenza` lasciata **null**: la calcola il motore da data +
    `aggiornamento_mesi`. Scriverla la congelerebbe.
  - Le ore inferiori alle dovute si **segnalano** e non bloccano (come previsto
    da `PROGETTO.md`): le pregresse hanno legittimamente monte ore diverso e gli
    spezzoni si sommano.

Per attivare la **revisione scheda organigramma** (due macro-blocchi
obbligatorie/eventuali, figura *Datore delegato ex art. 16* con estremi procura,
*evidenze della nomina* con visura/atto-procura per il datore), nell'ordine:

- [x] Eseguire `supabase/migrations/053_organigramma_deleghe_evidenze_nomina.sql`
  nell'**SQL Editor** di Supabase (Canale 3): colonne `figura_sicurezza.macro`,
  `nomina.estremi_procura` e `azione.origine_nomina_id`, figura
  `datore_lavoro_art16`, tabella `nomina_evidenza` + RLS. Idempotente, ASCII-only,
  `pglast` OK. **Eseguita** (verificato 2026-07-29: DB è alla 057; oggetti presenti).
- [x] Push dei sorgenti su `main` (Canale 1, Vercel auto-deploy) + refresh PWA —
  **fatto** (verificato 2026-08-04: `estremi_procura` presente in
  `OrganigrammaView.tsx` e `lib/admin/formazione.ts` su `main`, working tree clean).
  Tocca: `OrganigrammaView.tsx`, `Formazione.tsx`, `lib/admin/formazione.ts`.
  `tsc -b` + `vite build` verdi.
- [ ] Verifica in back-office -> Formazione -> cliente: i due blocchi
  *Figure obbligatorie* / *Figure eventuali*; Preposto e RLS non piu' segnalati
  come scoperti; sotto ogni figura (tranne Lavoratori) la scheda a due passi
  *1 Nomina* (data + evidenze; procura per il delegato art. 16) e *2 Formazione*.
  Se la nomina e' identificata ma manca l'atto ufficiale: avviso ambra "Evidenza
  da ottenere", il **semaforo** della figura va a giallo (da verificare) e in
  **Cose da fare** compare la voce correttiva "Evidenza di nomina da ottenere -
  ...". Caricando l'evidenza e ri-sincronizzando (apertura cliente o bottone
  *Sincronizza*) l'avviso e la voce spariscono.

Per attivare in produzione lo **snapshot versionato dell'organigramma + PDF**
(Parte 3, vedi `PROGETTO.md` §7-bis), nell'ordine:

- [x] Eseguire `supabase/migrations/027_organigramma_revisioni.sql` nell'**SQL
  Editor** di Supabase (tabella `organigramma_revisione` + trigger di
  numerazione + RLS).
- [x] Eseguire `supabase/migrations/028_cliente_rls_territoriale.sql` nell'**SQL
  Editor** (colonna `cliente.rls_territoriale` per la spunta RLST).
- [x] Deployare la Edge Function **`organigramma-pdf`** dal Dashboard Supabase
  (CORS inline; nessun import condiviso). Verificare che `PDFBOLT_API_KEY` sia
  già tra i secrets (lo è per i report).
- [x] Push dei sorgenti su `main` (Vercel auto-deploy) + refresh forzato PWA.
- [x] Verifica: in back-office → Formazione → cliente, fare una modifica e
  controllare che *Storico organigramma* mostri la nuova revisione; provare
  *Esporta PDF organigramma* e il *PDF* di una revisione dallo storico.
- [x] Deploy completato e verificato in produzione il **2026-06-19**.

Per attivare in produzione il **feed iCal sottoscrivibile** e la
**ricalibrazione date** (commit `f776edf`):

- [x] Eseguire `supabase/migrations/014_calendario_token.sql` nell'**SQL Editor**
  di Supabase (aggiunge `tecnico.calendario_token` con default
  `gen_random_uuid()` + backfill).
- [x] Deployare la Edge Function **`calendario-ics`** dal Dashboard Supabase
  (versione in produzione verificata = quella del repo, commit `f776edf`).
- [ ] Verifica end-to-end: in back-office → Tecnici → scheda di un tecnico,
  copiare l'URL del feed iCal, incollarlo in Google Calendar ("Altri calendari
  → Da URL") e controllare che i sopralluoghi compaiano.
- [ ] Refresh forzato della PWA su tutti i dispositivi installati
  (Ctrl+F5 / riapertura) per far prendere il nuovo bundle.

---

## B · Aperti (sviluppi pianificati)

L'ordine è quello di §0: prima i quattro filoni dello scadenzario (`S1`–`S4`),
poi ciò che li tocca da vicino, poi il resto.

### S1 · Adempimenti: dare voce ai tre blocchi muti

Senza questo il resto non ha senso: oggi Documenti / Autorizzazioni / Sorveglianza
sono vetrine su una tabella disabitata (vedi §0). Il modello c'è dalla `055`, manca
solo il modo di scriverci.

- [ ] **Scritture in `lib/admin/scadenzario.ts`**: `salvaAdempimento` /
  `eliminaAdempimento`. Il file è di sola lettura per scelta esplicita, ma quella
  scelta valeva finché la sorgente era l'import.
- [ ] **UI nella scheda cliente**, accanto all'organigramma — **non** nello
  scadenzario globale. L'adempimento pende da cliente/sede/persona: lo scadenzario
  resta una *vista*, e il fatto si registra dove vive. Per la categoria
  `sorveglianza` il vincolo `adempimento_sorveglianza_chk` impone la persona.
- [ ] **Rinnovo come per gli attestati**: si registra il fatto nuovo e la scadenza si
  ricalcola da `periodicita_mesi`. Nessuna data scritta a mano — è la regola che
  tiene in piedi tutto lo scadenzario, e vale anche ora che l'app diventa la fonte.
- [ ] **Allegato** su bucket privato, sullo schema di `attestati` (migration `021`):
  `adempimento.allegato_path` è già previsto.
- [ ] **Catalogo dei tipi di adempimento** (nuova tabella + migration), con
  periodicità di default. Oggi `adempimento.tipo` è testo libero (`'CPI'`,
  `'TERRA'`…): in sei mesi d'uso quotidiano "CPI" e "C.P.I." diventano due scadenze
  diverse e nessun filtro le riunisce. È lo stesso servizio che `corso_catalogo`
  rende ai corsi.
- [ ] **Import una tantum degli adempimenti esistenti** dal gestionale. `import_key`
  è già sulla tabella con l'unique parziale: l'idempotenza non va inventata.

### S2 · Migrazione dello storico su tutti i clienti

Codice già scritto e provato: qui è **esecuzione**, non sviluppo. L'import formazione
è stato verificato in app il 2026-08-02 su **un cliente solo** (Ecodent: 2 unità,
127 righe, re-import 0 nuove).

- [ ] Passare **cliente per cliente** con l'anteprima dry-run, nell'ordine
  anagrafiche → formazione → adempimenti (questi ultimi dopo `S1`). L'ordine non è
  decorativo: il cliente deve esistere prima delle persone, le persone prima degli
  attestati.
- [ ] **Prerequisito per le aziende multi-stabilimento**: compilare la **sede
  operativa** sui clienti che condividono P.IVA e sede legale. Senza, in tendina
  compaiono come due voci identiche e nessuna proposta è possibile — già imparato su
  Ecodent il 2026-07-31.
- [ ] Tenere il **conto di cosa è entrato**: quanti clienti, quante persone, quanti
  attestati, quante righe scartate e perché. Serve a `S3`, che senza un punto di
  partenza non può distinguere un buco di migrazione da una divergenza di modello.

### S3 · Riscontro col gestionale (è ciò che chiude il doppio binario)

`scadenzarioSedi.xlsx` era stato scartato come **sorgente**, e giustamente: è un
derivato — elenca scadenze già calcolate, senza data del corso né ore, e importarlo
significherebbe *dedurre* gli attestati invece di leggerli. Ma come **pietra di
paragone** è esattamente ciò che serve, ed è l'unico uso per cui vada caricato.

- [ ] Caricarlo e **confrontarlo riga per riga** con lo scadenzario dell'app. Tre
  esiti, tutti informativi: righe che il gestionale ha e l'app no (buco di migrazione
  o di modello); righe che l'app ha e il gestionale no (di norma un miglioramento —
  il Ramo A vede i **requisiti scoperti**, non solo gli attestati scaduti); date
  divergenti sulla stessa riga.
- [ ] L'esito è un **elenco di divergenze motivate**, non un numero. Ogni riga o si
  spiega o si corregge.
- [ ] **Criterio di spegnimento**: il gestionale si spegne quando quell'elenco è vuoto
  o interamente spiegato — non a scadenza di calendario. Senza questo passo, "doppio
  binario a tempo" è solo un rinvio con una data sopra.

### S4 · Scadenzario usabile ogni giorno

Quello che il gestionale fa e l'app no. Serve perché venga **aperto**, non perché sia
completo.

- [ ] **Avvisi in anticipo via email** sulle scadenze in avvicinamento (Edge Function
  + cron, sullo schema di `notifica-sopralluogo`, con l'idempotenza già vista lì).
  Oggi le notifiche esistono **solo** per le cose-da-fare dei sopralluoghi. Uno
  scadenzario che non avvisa è un elenco da andare a guardare, e nessuno lo guarda.
  Da decidere prima di scrivere: soglie (30/60/90 gg?), destinatario (l'area interna
  Formazione? il referente del cliente?), un'email cumulativa o una per scadenza.
- [ ] **Export / stampa per cliente.** Il gestionale ce l'ha — è letteralmente
  `scadenzarioSedi.xlsx` — ed è metà del motivo per cui lo si apre. Vale anche come
  consegna al cliente.
- [ ] **Back-office su tablet e telefono** — vedi *UX trasversale*, dove è già
  segnato come debole. Da qui in avanti smette di essere una rifinitura: un
  gestionale usato tutti i giorni non può essere solo da PC.
- [ ] **RLS a livello DB** quando entra l'ufficio formazione (oggi `staff_full
  using(true)`, gating solo in-app). È in §C fra le decisioni aperte e ora ha un
  termine: **prima** che l'app diventi fonte di verità per qualcuno che non sia
  l'amministratore.

### Anagrafiche aziendali: import isolato + nuovo cliente da visura camerale

**Concordato 2026-08-05, da fare. Nessuna riga di codice ancora scritta.**

Il problema: oggi l'unico modo di far nascere un cliente da una sorgente esterna
è l'**Import Werp**, che però è una pipeline a 7 stadi (contratti + documenti +
attività + anagrafiche → clienti + incarichi + sopralluoghi pianificati). Per
creare *solo* l'anagrafica aziendale serve un altro ingresso, staccato da quello.

**Decisioni prese** (scelte da Francesco fra le alternative proposte):
- **Sorgente: PDF caricato.** Si carica la visura come si caricano gli Excel.
  Serve estrarre il testo nel browser → nuova dipendenza **`pdfjs-dist`**
  (~350kB). Limite accettato: sulle visure **scansionate** non c'è testo da
  leggere e non si ricava nulla — va detto in chiaro, non fatto fallire in
  silenzio. (L'alternativa "incolla il testo", a zero dipendenze, è stata
  scartata: un passaggio manuale in più per visura.)
- **Portata: anagrafica + sedi + datore di lavoro.** Non solo i campi cliente:
  le **unità locali** diventano sedi operative proposte e il **legale
  rappresentante** diventa una persona con la nomina a *Datore di lavoro*.
  Quindi una parte dell'organigramma nasce dalla visura — ma sono proposte su
  dati che hanno effetti normativi, quindi **tutte da confermare esplicitamente**,
  mai salvate d'ufficio.

**Mappatura visura → campi app** (già verificata sul modello):

| Visura | Campo | Note |
|---|---|---|
| Denominazione | `ragione_sociale` | |
| Codice fiscale / P.IVA | `codice_fiscale`, `partita_iva` | |
| Sede legale | `indirizzo`, `cap`, `localita`, `provincia` | |
| ATECO attività prevalente | `codice_ateco` | guida `oreModuloSettore` (RSPP / DL-RSPP) |
| PEC | `email` | |
| Unità locali | `sede` operativa | risponde alla domanda "legale = operativa?" |
| Legale rappresentante | `persona` + `nomina` datore | nome, CF, carica |
| Numero addetti (visura ordinaria) | `numero_lavoratori` | dato **dichiarato**, non dedotto: legittimo, ma da confermare |

**CORREZIONE 2026-08-06 — il `livello_rischio` SI deriva dall'ATECO, e lo fa
già.** Ieri avevo scritto il contrario guardando solo il motore: è vero che
`assemblaRiepilogo` legge `cliente.livello_rischio` come campo memorizzato e non
lo ricalcola, ma **l'anagrafica lo propone da sempre**. `src/formazione/ateco.ts`
è la tabella **ATECO → livello di rischio dell'Allegato IV ASR 17/04/2025**
(generata dalla libreria normativa, non trascritta), e `Anagrafiche.tsx:873`
scegliendo una divisione scrive **sia** `codice_ateco` **sia** `livello_rischio`.
Non è una deduzione arbitraria: è una tabella di legge. Quindi la visura, dando
l'ATECO, dà anche il rischio proposto — ed è giusto che lo faccia.

Nota di modello: `codice_ateco` conserva la **divisione a 2 cifre** (`'74'`),
non il codice completo.

**Quello che la visura NON dà e resta da compilare a mano**: `livello_antincendio`
e `gruppo_primo_soccorso`. Non discendono dall'ATECO — si scelgono, e l'app
registra pure il perché (`antincendio_definito_mediante`,
`primo_soccorso_definito_mediante`). Su questi vale
[[dati-mancanti-si-chiedono]]: si chiedono, non si inducono.
**Il cliente da visura nasce comunque incompleto, e la scheda deve dirlo.**

**Visura con più unità locali — impostazione decisa 2026-08-06.** Non c'era una
visura multi-sede su cui provare (quella campione ne ha **0**), ma il modello
dell'app detta già la risposta, ed è controintuitiva: **N unità locali non
diventano N sedi di un cliente, diventano N clienti distinti.** Perché:
- una sola sede operativa per cliente (`Anagrafiche.tsx:280`, `find` singolare;
  il bottone di aggiunta sparisce se ce n'è già una) → **un cliente = un
  organigramma**;
- decisione già presa per l'import formazione: *"Un'unità = (P.IVA, Sede), e
  ogni unità va su un cliente distinto"*. Ecodent: due stabilimenti, stessa
  P.IVA, squadre di emergenza separate (6+5 e 4+3). Fonderli avrebbe fatto
  contare 10 addetti e dire "coperto" con una sede scoperta;
- `cliente.partita_iva` **non ha vincolo di unicità** (`040`): condividerla fra
  clienti è previsto.

Il dato che rende la cosa fattibile è una sezione della visura che vale la pena
non perdere: oltre alle unità locali, il documento riporta da **fonte INPS** i
blocchi `Addetti nel comune di <COMUNE> (<PR>)` con dipendenti/indipendenti per
trimestre e valore medio. Dice **dove stanno le persone e quante**: è
`numero_lavoratori` per luogo, cioè il campo che decide le 4h o 8h di
aggiornamento RLS.

Incrocio unità locali × addetti, tre esiti e nessuno silenzioso:
| caso | proposta |
|---|---|
| unità locale **con** addetti | cliente proprio, `numero_lavoratori` precompilato, spunta accesa |
| unità locale **senza** addetti | proposta **spenta** di default, col motivo scritto |
| addetti in un comune **senza** unità locale | segnalata, non ignorata |

Il secondo caso è il punto delicato: la visura dice che l'unità locale *esiste*,
non che ci lavori qualcuno. Un deposito vuoto promosso a cliente si porterebbe
dietro organigramma, obblighi di squadra di emergenza e scadenze inventate.

Su ogni cliente creato si copiano: ragione sociale col comune in coda per
distinguerli in tendina (problema noto, c'è già `etichettaCliente`), P.IVA, CF,
ATECO + rischio proposto, PEC; sede legale in anagrafica; **sede operativa =
indirizzo dell'unità locale**; `numero_lavoratori` dal blocco addetti di quel
comune. Il **legale rappresentante si replica su tutti** (stesso datore per
tutte le unità); le **squadre di emergenza no**, sono per luogo di lavoro.

**Limite da dichiarare subito**: due unità locali nello stesso comune
condividono un solo blocco addetti e il numero non è divisibile. Proporre il
totale su una sola e lasciare l'altra vuota con avviso, invece di spartire a
metà un dato che nessuno ha misurato così.

**Da decidere alla ripresa**:
- [x] **Import massivo da Excel/CSV, staccato da Werp** — *fatto 2026-08-26*.
  Era la terza opzione, non scelta ma nemmeno esclusa: è diventata la prima a
  esistere, perché il database azzerato la rendeva urgente e non dipende da una
  visura vera su cui tarare un parser. Vedi "Fatti di recente".
- [x] **Dove sta l'ingresso** — *deciso 2026-08-26*: voce di back-office a sé,
  gruppo *Anagrafiche*, fra *Anagrafiche* e *Import formazione*, nell'ordine in
  cui si usano. Non accanto a "+ Nuovo cliente": è un import massivo e sta con
  gli altri import. Vale anche per la visura, quando si farà.
- [x] **Come si presentano i campi proposti** — *deciso 2026-08-26*: **anteprima
  dry-run** in stile `ImportFormazione`, non badge per campo. Il badge dice "non
  fidarti" DOPO aver scritto; l'anteprima lo dice prima, ed è l'unico momento in
  cui costa poco cambiare idea. Sui campi che il file non ha (antincendio,
  primo soccorso) l'anteprima elenca i mancanti riga per riga.
  Da rivedere per la visura: lì i dati sono *estratti da un PDF*, non digitati
  da qualcuno, e il badge `da_confermare` potrebbe servire **in più**.
- [ ] Robustezza del parser: le etichette (`Denominazione:`, `Codice fiscale:`,
  `Attività prevalente:`) sono stabili fra emittenti diversi, l'impaginazione
  no. Serve una visura vera su cui tarare — **procurarne una** prima di
  scrivere il parser.

### Organigramma / formazione

- [ ] **Modello di nomina per figura** (step successivo della revisione scheda
  organigramma, deciso 2026-07-08). Generare un `.docx` precompilato con dati
  cliente + persona per ogni figura (atto di nomina), sullo stile dell'export
  organigramma PDF (Edge Function / PDFBolt o skill docx). Deve valere per tutte
  le figure con nomina (tutte tranne i Lavoratori); per Datore e Datore delegato
  ex art. 16 richiamare gli allegati attesi (visura camerale, atto/procura). La
  parte dati (figura `datore_lavoro_art16` con `nomina.estremi_procura`,
  evidenze in `nomina_evidenza`) e' gia' pronta lato DB/UI: qui manca solo la
  generazione documentale.

### Sede: modello semplificato (deciso 2026-07-08, rivisto)

Un solo organigramma per cliente. La sede legale sta nell'anagrafica; si aggiunge
UNA sola sede operativa solo se la legale non e' nella disponibilita' dell'azienda
(es. commercialista). L'organigramma vive sulla sede operativa se presente,
altrimenti sulla legale; gli attributi che lo guidano (rischio/ATECO/PS/antincendio/
RLS) sono aziendali e si leggono dal CLIENTE. Stato:

- [x] Schema sede di prima classe (`054`): sede con campi topografici + org +
  `principale` + `da_confermare`; `persona.sede_id`; sede legale per cliente.
- [x] Motore (`formazione.ts`): `valutaSede`; `valutaCliente` risolve la
  sede-organigramma (`sedeOrganigrammaId` = operativa attiva altrimenti legale);
  gli attributi si leggono dal cliente; `salvaPersona` aggancia alla sede-organigramma.
- [x] UI: una sola sede operativa (bottone nascosto se gia' presente); testo
  aggiornato (commercialista); `allineaPersoneOrganigramma` sposta le persone sulla
  sede-organigramma quando si aggiunge/archivia l'operativa. Selettore multi-sede e
  copia tra sedi RIMOSSI (non servono con un solo organigramma).
- [x] La sede operativa si **chiede**, non si deduce (2026-07-31). Nello spazio
  *Sedi* dell'anagrafica: "La sede legale corrisponde con la sede operativa?" —
  **Sì** crea la sede operativa copiando i dati della legale, **No** apre il box
  di inserimento. Prima "nessuna sede operativa" voleva dire due cose diverse
  (coincidono / non ci ha pensato nessuno) e niente le distingueva: è il motivo
  per cui due clienti della stessa azienda risultavano identici all'import del
  gestionale. Rispondendo, il luogo di lavoro è sempre scritto.
  **`tsc -b` + `vite build` VERIFICATI 2026-08-02 — verdi.**
- [ ] Fase 4 - scadenzario: opzionale etichetta della sede sulle voci (roll-up
  multi-sede non serve piu': una sola sede-organigramma per cliente).
- [ ] Fase 5 - offline: il riepilogo in campo segue la sede-organigramma del cliente
  del sopralluogo (sola lettura, offline).

Note: colonne org su `sede`, write-through in `salvaCliente`, flag `da_confermare` e
badge in OrganigrammaView restano ma sono ridondanti/dormienti (nessuna copia tra
sedi li accende; gli attributi si leggono dal cliente).

### UX trasversale

- [ ] **Evidenze pregresse anche in campo (offline)**. Oggi il pannello batch
  "Evidenze pregresse" (auto-apertura alla scelta "Si, pregressa" + bottone in
  scheda incaricato) e' **back-office only**: `EvidenzePregresse` /
  `SezioneRuoloPregresso` caricano l'attestato con `supabase.storage...upload` e
  scrivono con `salvaFormazione` in diretta (online). Per la parita' campo =
  back-office serve una versione offline: upload via `attestatoBlob` + outbox
  ('attestato') e scrittura formazione via adapter, poi passare
  `onEvidenzePregresse` a `OrganigrammaView` anche da `FormazioneRiepilogo`.
  In campo, per ora, la pregressa si carica con il "Registra" per-riga
  (gia' offline-safe via adapter/outbox).

- [ ] **App unica responsive (PC / tablet / phone)**. Approccio scelto:
  hardening incrementale (non unificazione del guscio), app da campo prima.
  - [x] **App da campo su schermi grandi** (fatto 2026-06-10). Le tre schermate
    del tecnico non sono più la strisciolina fissa a 440px:
    - *I miei sopralluoghi* e *Le mie cose da fare*: il pannello si allarga
      (760px @≥760, 1100px @≥1140) e le card vanno in griglia 2/3 colonne
      (`auto-fill minmax(min(100%,300px),1fr)`); riepilogo resta colonna 680px.
    - *Compilazione*: colonna form comoda 720px @≥760 (footer + sheet allineati);
      flusso inline invariato (scelta "solo colonna più larga").
  - [ ] **Back-office su phone/tablet** (prossimo step). Tabella Disponibilità
    sfora in orizzontale già su tablet; unica media query a 620px troppo debole;
    max-width 1040px; touch target. Toccare `admin/ui.ts` e le griglie/tabelle.

### Integrazione gestionale

- [ ] **Werp · sincronizzazione — superata dalla decisione di §0.** I campi
  `incarico.werp_id`, `azione.werp_attivita_id`, `cliente.werp_id` restano come
  tracciabilità della **provenienza** dei dati migrati; nessuna sincronizzazione
  bidirezionale va più costruita, e non c'è più un canale da chiarire col fornitore
  (API / DB / file). Se un giorno il lato commerciale (contratti, attività)
  rientrasse nel perimetro, la voce si riapre — oggi è fuori.

### Disponibilità tecnici (tab "Disponibilità")

- [ ] Includere ferie/indisponibilità del tecnico (oggi il carico viene solo
  dalle sedute pianificate; non esiste un calendario di assenze).
- [ ] Distinguere consuntivo vs previsionale: contare anche le sedute
  `in_corso`/`completato` separatamente, o filtrarle.
- [ ] Link diretto dalla cella della settimana al tab Pianificazione filtrato.

### Pianificazione

- [ ] Esclusione santi patroni locali (oggi `calendario.ts` esclude solo
  festività nazionali italiane). Servirebbe lookup per città del cliente.

### Checklist / Compilazione

- [ ] **Rivisitazione dei template di checklist** verso una modalità di rilievo
  unica. Le 3 checklist importate (1. *check-up iniziale azienda nuova*,
  2. *simulazione di visita ispettiva*, 3. *ordine di lavoro*) sono solo
  esempi: i contenuti possono essere stravolti. A prescindere dagli elementi
  verificati, ogni voce deve usare **la stessa modalità di acquisizione del
  rilievo**, che prevede:
  - indicazione o meno dell'elemento da verificare (per check-up iniziale /
    visita ispettiva si potrà riportare una serie di elementi da verificare);
  - acquisizione di evidenze sull'elemento tramite **scrittura, nota vocale
    e/o foto**;
  - in uscita, indicazione di eventuali **SCADENZE DA MONITORARE**;
  - in uscita, indicazione di eventuali **COSE DA FARE** con destinatario
    **esterno (cliente)** o **interno (azienda)**.

  **NB — è lavoro di template + UX, NON di modello dati.** Lo schema copre già
  tutto (verificato 2026-06-11):
  - elemento da verificare → `esito_voce.voce_testo` / `voce_sezione`;
  - evidenze: scrittura → `esito_voce.note`; nota vocale → `NotaVocale.tsx`
    (Web Speech API, **trascritta in testo** in `note`, on-device — l'audio NON
    è salvato come file); foto → tabella `foto` + bucket `foto-sopralluoghi`;
  - scadenze → `azione.tipo='scadenza_ricorrente'` (+ `data_scadenza`,
    `periodicita_mesi`);
  - cose da fare con destinatario → `azione.responsabile_tipo`
    cliente / risorsa_interna / area (`responsabile_*_id`, CHECK di coerenza).

  Quindi l'intervento è: (a) **uniformare la UX di compilazione** così che ogni
  voce esponga sempre questa modalità — **FATTO** (Fasi A+B, commit `a35cf45`:
  evidenze, cose da fare, scadenza ricorrente ed esito esplicito su ogni voce,
  a prescindere dal tipo); (a-bis) **riallineare l'editor di template** togliendo
  i knob ormai inerti (stato/`genera_azione` sulle opzioni, `richiedi_foto_se`,
  `azione_opzionale`, gate scadenza) ed esponendo `etichetta_aggiunta` — **FATTO**
  (Fase C); (b) **ridisegnare/sostituire i contenuti** delle 3 checklist
  d'esempio — **ANCORA DA FARE** (lavoro di soli contenuti, nessun codice).
  Unica eccezione potenzialmente "nuovo schema": se si vuole **conservare anche
  il file audio** originale (oltre alla trascrizione) servirebbe una tabella
  `audio`/`allegato` gemella di `foto`.
- [ ] **Modello "box-argomento" (composizione modulare del sopralluogo)** —
  evoluzione concordata della rivisitazione qui sopra: il sopralluogo si compone da
  un catalogo di box riusabili (Impianti, Antincendio, …), con box generici a voci,
  box *smart* (Organigramma → incapsula il subapp Formazione) e box *fissi* (Cose da
  fare pregresse). Schema dati concordato in **`docs/MODELLO_BOX.md`** (decisioni
  D1A/D2/D3/D4 recepite). Footprint, migration da **029**:
  - nuove tabelle: `sede`, `box_catalogo`, `box_sezione`, `checklist_template_box`,
    `sopralluogo_box`, `componente_sito` (registro componenti persistente per sede);
  - colonne: `voce_template.sezione_id`, `esito_voce.componente_id`,
    `azione.componente_id`, `incarico.sede_id`, `sopralluogo.sede_id`;
  - `mostra_se` generalizzato a cascata (un solo motore condizionale: copre
    condizionali piatti e alberi); sezioni **ripetibili** con N componenti
    (etichetta + matricola/ubicazione opzionali);
  - scadenze RENTRI come config `fascia→data` localizzata (niente motore nuovo).
  Riusa il motore voci esistente, nessun fork.
  - [x] Migrations **029-032** eseguite (SQL Editor): `sede`, `box_catalogo` +
    `box_sezione` (ripetibili), `checklist_template_box` + `sopralluogo_box`,
    `componente_sito` + `*.componente_id`. Prossima libera: **033**.
  - [x] Fondamenta codice (Canale 1, pushate): `types.ts` (tipi box, estensioni
    opzionali), `db.ts` (Dexie v5 + cache catalogo + outbox), `lib/box.ts`
    (prefetch + `assicuraComposizione`/`caricaBoxComposti`/`aggiungiComponente`),
    `prefetch.ts` (step 5 box).
  - [x] **1a** — motore voce estratto in `src/vociRender.tsx` (single source:
    `renderVoce`/`renderRilievo`/`renderEvidenze`/`renderEsito`/`renderBozzeAzione`/
    `renderScadenza` su `ContestoVoci`). Build verde.
  - [x] **1b** — `src/Compilazione.tsx` usa il motore estratto (zero duplicazione,
    1154→817 righe); `ctx: ContestoVoci` costruito prima del `return`; `vociRender`
    esporta `Resp/Bozza/BozzaScad/I`. Verificato con `tsc -b` + `vite build`.
  - [x] **Loader + widening** (Canale 1): in `lib/box.ts` aggiunti `caricaBoxComposti`
    (composizione → `BoxComposto[]`: box→sezioni→voci, e per le ripetibili i
    `componente_sito` filtrati per sede+box+sezione) e `aggiungiComponente` (il "+"
    del registro di sede, offline+outbox); tipi `BoxComposto`/`SezioneComposta`.
    `VoceTemplate.template_id` allargato a `string | null` (le voci-box hanno NULL).
    Verificato `tsc -b`.
  - [x] **Motore condiviso (approccio A) + `BoxGenerico.tsx`** (Canale 1): il motore
    esiti+cose-da-fare+scadenze, prima dentro `Compilazione`, è estratto nell'hook
    **`src/lib/useCompilazioneVoci.ts`**: possiede lo stato GLOBALE del giro
    (`esiti`/`bozze`/`scad`) ed espone `buildCtx({ voci, componenteId, … })` (un
    `ContestoVoci` con mappe filtrate per componente e handler che marcano i nuovi
    esiti con lo stesso `componente_id`) e `assicuraEsiti` (semina idempotente delle
    voci-box, presenza letta da Dexie). `Compilazione.tsx` riscritto per usarlo
    (817→664 righe), comportamento del flusso piatto invariato; `completa()` legge
    lo stato dell'hook, quindi le cose-da-fare dei box vi confluiscono. Nuovo
    **`src/BoxGenerico.tsx`**: monta `renderVoce` per i box generici (sezioni singole
    = componente null; ripetibili = una scheda per componente + "+", con
    `aggiungiComponente`), saltando smart/fisso. Fix: `componente_id` aggiunto a
    `COLONNE_ESITO` (la ripresa da server non perde il legame col componente).
    Verificato `tsc -b` + `vite build`. `BoxGenerico` non ancora montato (come fu
    `vociRender` all'1a): pronto per l'aggancio.
  - [x] **Aggancio + seed prototipo** (Canale 1 + 3): `<BoxGenerico>` montato in
    `Compilazione` dopo le sezioni piatte (riceve `motore` + `compilataId`/`sedeId`/
    `aree`/`tecnici`/`tecnicoId`); `assicuraComposizione(sopralluogoId, templateId)`
    chiamata all'apertura in entrambi i path (threading del `templateId` aggiunto a
    `DatiCompilazione`/`apriCompilazione`). Migration **033** semina il box prototipo
    GENERICO "Impianti" (Cap. 4): sezione singola *Generale* (con una figlia
    condizionata su "no") + sezione ripetibile *Quadri elettrici* ("+ Aggiungi
    quadro"), agganciato a tutti i template attivi via `checklist_template_box`
    (restringibile cancellando le righe). Catena: seed → `prefetchCatalogoBox`
    (gia' in `prefetch.ts`) → `assicuraComposizione` → `BoxGenerico`. Verificato
    `tsc -b` + `vite build`; SQL validato con pglast (ASCII-only, idempotente).
  - [x] **Box smart e fisso** (Canale 1 + 3): `BoxGenerico` ora instrada per tipo.
    Smart `ref_smart='organigramma'` → `FormazioneRiepilogo` inline (riceve
    `clienteId`/`tecnicoNome`; il sheet "Formazione" resta come accesso rapido).
    Fisso → vista read-only delle azioni ancora aperte dei giri precedenti
    (`pregresse`/`statoPregresse` passati da `Compilazione`, che le carica gia' con
    `useGiroPrecedente`: nessun fetch nuovo). Migration **034**: box smart
    `ORGANIGRAMMA` (agganciato ai template attivi) + box fisso `PREGRESSE`
    (auto-iniettato in ogni sopralluogo da `assicuraComposizione`). Verificato
    `tsc -b` + `vite build`; SQL pglast/ASCII/idempotente.
  - [x] **`componente_id` fino all'azione** (Canale 1): `InputAzione.componenteId`
    + `generaAzione` ora impostano `azione.componente_id`; `completa()` lo passa
    dall'esito in entrambi i cicli (correttive e scadenze) — vale per le voci
    piatte (null) e per i box ripetibili (id del componente). `componente_id`
    aggiunto a `COLONNE_AZIONE` (select + `toBaseAzione` lo preservano alla
    rilettura/upsert). Verificato `tsc -b` + `vite build`. Nessuna migration
    (colonna gia' da 032).
  - [x] **Pregresse a inizio giro** (Canale 1): `BoxGenerico` ora prende un prop
    `filtro` ('fissi' | 'altri') e `Compilazione` lo monta due volte: i box FISSO
    (cose da fare pregresse) in testa, prima della checklist; generici + smart dopo.
    Una sola `assicuraComposizione`; semina solo l'istanza 'altri'. La collocazione
    e' data dalla posizione di mount, non dall'`ordine` congelato (assicuraComposizione
    invariata). Verificato `tsc -b` + `vite build`.
  - [x] **Capitoli reali come box + compositore di template** (Canale 1 + 3,
    migration **035**): seminati gli 11 capitoli dell'Audit Iniziale (134 voci, dal
    foglio `Riordino_Checklist_AuditIniziale.xlsx`) come box generici + box
    `RILIEVI_LIBERI` (foglio bianco). Nuovo compositore back-office
    (`composizione.ts` + `ComponiTemplate.tsx`, azione "Componi da capitoli" nella
    lista template): nome + tipo attivita + scelta capitoli; ORGANIGRAMMA e COSE DA
    FARE sempre proposti e disattivabili. `assicuraComposizione` non auto-inietta
    piu' i fissi (vengono dalla composizione). Chiude le lacune "comporre i veri
    capitoli" e "editor back-office della composizione".
    - [x] **DEPLOY**: eseguire `supabase/migrations/035_box_seed_capitoli.sql`
      nell'**SQL Editor** (Canale 3), poi push del codice su `main` + refresh PWA.
      **Fatto** (verificato 2026-07-29: DB alla 057; 11 capitoli CAP0..CAP10 +
      RILIEVI_LIBERI presenti, box prototipo IMPIANTI disattivato; compositore
      `composizione.ts`/`ComponiTemplate.tsx` committati e clean).
- [ ] Avviso se la checklist scelta ha `tipo_attivita` ≠ quello dell'incarico
  (oggi è ammesso senza segnalazioni).
- [ ] Consentire il cambio di checklist su un sopralluogo già avviato ma senza
  esiti compilati (oggi, creata la `checklist_compilata`, il template è
  congelato).

### Revisioni

- [ ] Visualizzatore della storia delle revisioni del **sopralluogo**
  (`caricaRevisioni` è già pronto): leggere gli snapshot archiviati dall'app.
  Nota: lo storico dell'**organigramma** per cliente è già fatto (vedi Fatti).

### Notifiche

- [ ] Notifiche push / badge in-app delle cose-da-fare aperte.

---

## C · Decisioni da prendere

- [ ] **Contenuto email `notifica-sopralluogo`**: solo elenco testuale (oggi) o
  anche link/allegato del report interno?
- [ ] **Isolamento RLS a livello DB per ruoli**: oggi il gating è solo
  in-app (`staff_full using(true)`). Quando estendiamo al portale cliente
  (Fase 3) va stretto. Decidere quando affrontarlo.

---

## ✅ Fatti di recente

- [x] **2026-08-26** **Import anagrafiche: clienti e risorse umane in blocco**
  (`lib/admin/anagraficheImport.ts`, `admin/ImportAnagrafiche.tsx`,
  `BackOffice.tsx`, `RisorseUmane.tsx`, `docs/USO.md`).
  Mancava l'ingresso per rifare **più clienti** da una lista già pronta: Werp li
  crea ma dentro una pipeline a 7 stadi (contratti + incarichi + sopralluoghi),
  l'import formazione per scelta non li crea, e le persone si importavano **un
  cliente alla volta** dalla scheda. Col database azzerato il 05/08 quella
  strada valeva sette ripartenze.
  - **Un file per volta e il tipo lo riconosce l'app**, dalle intestazioni:
    *Cognome / Mansione / Data assunzione* → persone, *Ragione sociale / ATECO /
    Numero lavoratori* → aziende. Dice anche quali colonne ha ignorato. Chi
    carica il file sbagliato lo scopre subito, non dopo aver scritto.
  - **Dry-run**, come gli altri import: `pianifica*` non tocca niente, `applica*`
    scrive per upsert su id. Riapplicare lo stesso file non duplica (provato:
    seconda passata → 0 nuovi, 0 aggiornati, 4 invariati).
  - **Merge non distruttivo** sui clienti che esistono già (filosofia C di
    `werpImport`): si riempiono **solo i campi vuoti**. Un file non sa cosa è
    stato corretto a mano dopo.
  - **ATECO → livello di rischio** dalla tabella dell'Allegato IV
    (`formazione/ateco.ts`), la stessa dell'anagrafica: non è una deduzione, è
    una tabella di legge. Quello che il file **non** può dare — livello
    antincendio e gruppo primo soccorso — resta elencato **riga per riga** come
    mancante: vale [[dati-mancanti-si-chiedono]], e un cliente nato da un import
    è incompleto per definizione.
  - **Persone raggruppate per unità** (P.IVA + Sede) e ogni gruppo è abbinato a
    un cliente **da confermare**. Tre cautele, tutte verificate a tavolino
    (`raggruppaPersone` è puro apposta, separato dalla riconciliazione che legge
    dal DB — stessa struttura di `raggruppaUnita`/`riconciliaUnita`):
    la sede si confronta **prima** con la sede *operativa* (la legale è identica
    su tutti i clienti della stessa azienda: non separa niente); se due gruppi
    puntano allo stesso cliente la proposta **cade per entrambi**; e se è
    l'operatore a farlo a mano, compare un **avviso rosso** — può essere
    legittimo, ma se non lo è due unità finiscono in un organigramma solo.
  - **Un gruppo senza cliente viene saltato**, non crea l'azienda: nascerebbe
    senza ATECO né livelli di emergenza. Stessa scelta già fatta per C1b.
  - **Numeri di riga veri**: il foglio si legge con `blankrows: true` e le righe
    vuote si saltano dopo. Contandole prima, "riga 6 scartata" mandava a
    guardare la riga sbagliata di Excel.
  - **Un solo vocabolario di intestazioni**: `RisorseUmane` non ha più il suo
    elenco di sinonimi né la sua mappatura riga→persona, usa
    `leggiCampiPersona`/`fondiPersona`. Due elenchi che divergono fanno un file
    che entra da una porta e viene scartato dall'altra.
  - Guida aggiornata nello stesso commit (§1, §3 — ora **sei** ingressi —, §3.3
    nuovo, §4, §12, §13), come vuole la convenzione di `USO.md`.

- [x] **2026-08-24** **Guida d'uso riscritta e resa manutenibile**
  (`docs/USO.md`, `scripts/guida-check.mjs`, `package.json`).
  `USO.md` era fermo al **23/06**: descriveva una navigazione a tab piatti che
  non esiste piu' (oggi e' a due livelli per gruppi), non nominava *Risorse
  Umane*, il libretto, lo scadenzario separato dalle cose da fare, ne' UNO dei
  cinque ingressi dei dati, e diceva di impostare il livello di rischio a mano
  quando l'ATECO lo propone da solo. Un manuale sbagliato e' peggio di nessun
  manuale: chi lo segue cerca bottoni che non ci sono.
  - Riscritto sull'app di oggi, 13 capitoli. Il nuovo **§3 "Portare dentro i
    dati: i cinque ingressi"** e' la risposta a "come importo aziende e
    persone": tabella di cosa crea ciascun ingresso, l'ordine giusto partendo
    da zero (alias → clienti → persone → formazione), e i due punti che si
    pagano dopo (il cliente nato da Werp non ha `livello_rischio`; l'import
    formazione non crea clienti, di proposito).
  - **`npm run guida:check`**: il §13 mappa capitolo → file sorgente; lo script
    confronta l'ultimo commit che ha toccato `USO.md` con i commit successivi
    su quei file e dice **quali capitoli sono arretrati e per colpa di quali
    commit**. Segnala anche le schermate `.tsx` che nessun capitolo dichiara,
    perche' una schermata nuova non mappata invecchierebbe senza che il
    controllo possa accorgersene. `--strict` esce con codice 1 (per la CI).
  - Il **§12 "Novita'"** e' il registro di cio' che l'utente **vede**; le
    motivazioni tecniche restano nella `Cronologia` di `PROGETTO.md` e non si
    duplicano.
  - **Convenzione**: una modifica che cambia cio' che l'utente vede o fa si
    chiude aggiornando il capitolo e il §12, **nello stesso commit**. La misura
    e' la distanza dall'ultimo commit della guida, quindi toccarla a vuoto
    azzera l'allarme senza aver letto niente: e' un attrezzo per chi lavora in
    buona fede, non una guardia.
  - **Da fare al primo commit**: finche' `USO.md` non e' committato, il
    baseline resta il commit del 23/06 e `guida:check` elenca tutti i 9
    capitoli. Committandolo, riparte pulito.

- [x] **2026-08-05** Persona: **la data di cessazione disattiva da sola**
  (`lib/admin/formazione.ts`, `RisorseUmane.tsx`, `OrganigrammaView.tsx`).
  Erano due dati che dicevano la stessa cosa e solo uno aveva effetto:
  `attivo` decide chi entra nell'organigramma (`assemblaRiepilogo` filtra su
  quello) e quindi requisiti, scadenzario e cose da fare; `data_cessazione` si
  limitava a stamparsi. Chi compilava **solo la data** vedeva la persona
  restare in elenco e continuare a generare scadenze — e non compariva nemmeno
  l'etichetta *cessato*, condizionata a `!attivo`. Silenzio totale.
  - Nuova `attivoDopoCessazione(p, precedente)`, regola in un punto solo:
    data non futura → fuori forza; data **tolta** → rientro; data **futura** →
    `attivo` invariato (una cessazione programmata non licenzia nessuno oggi);
    nessuna data né prima né ora → invariato, così aprire e salvare la scheda
    di un disattivato-senza-data (righe pre-migration 061) non lo rimette in
    organigramma di nascosto.
  - Avviso **sotto il campo, prima del Salva**: "esce dall'organigramma…" per
    le date passate, "resta in forza fino al …" per le programmate. Un anno
    digitato male si vede mentre lo si scrive, non tre schermate dopo.
  - **Baco corretto**: `toggle()` (bottone *Disattiva*) leggeva `persona`, lo
    stato **salvato**, e non `p`. Scrivere la data e premere Disattiva senza
    Salva buttava via la data appena digitata sostituendola con oggi — e i due
    comandi stanno nella stessa scheda a una riga di distanza.
  - **Import**: `attivo: true` secco riportava in forza chi era cessato,
    tenendogli però la data. Il file non ha una colonna di cessazione, quindi
    non dice nulla sul punto: ora la regola decide e il cessato resta cessato.
  - `PersonaForm` (organigramma) non hardcoda più `attivo: true`: quel form non
    governa la cessazione e non deve riaffermarne lo stato.
  - **Deciso di proposito, contro il default della casa**: qui un dato *deduce*
    un esito invece di chiederlo. La scelta è consapevole (vedi
    [[dati-mancanti-si-chiedono]]) e mitigata dall'avviso preventivo.
  - **Data futura** (deciso 2026-08-05): le cessazioni **programmate** non sono
    un caso reale e non si gestiscono. Una data avanti nel tempo è quasi sempre
    l'anno digitato male, e disattivare su quella base farebbe uscire
    dall'organigramma una persona che lavora — quindi `attivo` resta com'è, e
    l'errore lo dichiara la UI: avviso **rosso** sotto il campo (coi giorni di
    distanza, per rendere evidente il "2027 al posto di 2026") e pill **data da
    verificare** accanto al cognome. Serviva perché l'errore era altrimenti
    **muto**: persona in forza, riga non sbiadita, nessun badge *cessato*.
    Di conseguenza **non serve** il job che scandisce le date: non c'è niente
    da far scattare.
  Nessuna migration (`persona.data_cessazione` è già dalla 061).
  `tsc --noEmit` + `vite build` verdi. **Da provare in app — checklist in §A.**

- [x] **2026-08-05** Risorse Umane: **chi è cessato si vede e si filtra**
  (`RisorseUmane.tsx`). Emersa dalla domanda "nelle risorse vengono proposte
  tutte, attive e cessate?". Risposta: l'elenco mostrava di default i **soli
  attivi** — ma il comando che lo decideva era una spunta *Mostra anche i
  disattivati* **in fondo alla tabella**, sotto le righe che governa e staccata
  dagli altri due filtri, che stanno in testa. Chi non scorreva fino in fondo
  non sapeva di star guardando un elenco parziale.
  - Ora è una tendina accanto a ricerca e ruoli: **In forza (N) / Solo cessati
    (N) / Tutti (N)**, visibile solo se qualcuno è cessato davvero (stesso
    criterio della tendina dei ruoli: un filtro che offre "Cessati (0)" fa
    cercare a vuoto una categoria che non esiste).
  - Il **terzo stato** non c'era e serve: "chi se n'è andato" è una domanda che
    si fa (consegne, attestati da archiviare), e con la spunta i cessati si
    potevano solo **aggiungere** agli attivi, mai isolare.
  - L'etichetta *cessato gg/mm/aaaa* esisteva già, ma nella colonna **Mansione**,
    dove si legge come un attributo del lavoro svolto. Spostata sul **cognome**,
    che è l'identità della riga. Colonne riequilibrate (`ru-cog` 17→22%,
    `ru-man` 17→12%).
  - Il vuoto per filtro non dice più *"Aggiungine una o importa da Excel"*:
    suggerire di rifare l'anagrafica a chi ha solo ristretto l'elenco è un
    consiglio sbagliato. Ora distingue elenco vuoto da filtro vuoto.
  Nessuna migration. `tsc --noEmit` + `vite build` verdi. **Da provare in app —
  checklist in §A.**

- [x] **2026-08-05** Risorse Umane: **stesso trattamento al reparto**
  (`lib/admin/formazione.ts`, `RisorseUmane.tsx`). Stampatello in inserimento +
  tendina dei reparti già usati, come per la mansione qui sotto — stesso
  problema (vocabolario aziendale scritto da persone diverse in momenti
  diversi), stessa soluzione. Anche nel pannello *Import* della schermata.
  - L'helper è diventato `valoriUsati(valori)` (privato) con due facciate
    esportate, `mansioniUsate` e `repartiUsati`: sono due vocabolari
    **separati** e non vanno mescolati. "MANUTENZIONE" può essere
    legittimamente sia un reparto sia una mansione, ma proporre le mansioni fra
    i reparti riempirebbe ogni tendina di voci che in quel campo non ci sono
    mai state.
  - Il reparto sta **solo in Risorse Umane**: `PersonaForm` (organigramma) non
    ha quel campo — crea la persona con cognome, nome, mansione e CF, e il
    reparto lo porta avanti invariato da `persona?.reparto`. Quindi nessuna
    modifica lì, e nessuna parità da recuperare in campo.
  `tsc --noEmit` + `vite build` verdi. **Da provare in app — checklist in §A.**

- [x] **2026-08-05** Anagrafica persona: **le mansioni già usate si ripropongono**
  (`lib/admin/formazione.ts`, `RisorseUmane.tsx`, `OrganigrammaView.tsx`).
  Seguito dello stampatello qui sotto: il maiuscolo toglie una delle grafie
  divergenti, non la sostanza. "SALDATORE", "ADDETTO SALDATURA" e "SALDATORE
  CARPENTERIA" restavano tre voci per la stessa cosa, e nascevano così perché
  chi inseriva la seconda persona non aveva modo di sapere come era stata
  scritta la prima. Una mansione è **vocabolario aziendale**, non catalogo: non
  si può normalizzare a monte, si può solo far vedere quello che già esiste.
  - Nuova `mansioniUsate(persone)` in `lib/admin/formazione.ts` (accanto a
    `confrontaPersone`, stessa famiglia): mansioni distinte, ordinate,
    dedup su chiave **case-insensitive** — le righe vecchie e quelle arrivate
    dagli import sono scritte come capita, e proporre "Saldatore" e "SALDATORE"
    come due voci rimetterebbe in campo l'ambiguità che l'elenco toglie.
  - Serve un **`<datalist>`, non una `<select>`**: l'elenco chiuso avrebbe
    impedito di inserire la prima persona di ogni mansione nuova, cioè proprio
    il caso in cui la si sta creando. Si scrive liberamente, la tendina propone.
  - Vale in **entrambe le vie** per creare una persona — la scheda di *Risorse
    Umane* e il *+ Persona non in elenco* del pannello di assegnazione ruolo
    (`PersonaForm`, prop `mansioni`) — altrimenti chi crea "al volo" durante
    un'assegnazione ricomincia a inventare diciture. Essendo in
    `OrganigrammaView`, la proposta arriva **anche in campo**.
  - L'elenco si legge da **tutte** le persone del cliente, non dalle sole
    visibili: filtro di ricerca e cessati non tolgono una mansione dal
    vocabolario dell'azienda.
  - `useId()` per l'id del `<datalist>`: in Risorse Umane le righe in modifica
    possono essere più d'una insieme, e un id duplicato nel DOM aggancerebbe
    tutte le input alla prima lista incontrata. Uno solo per tabella, montato
    fuori dal `<tbody>` (dentro sarebbe markup non valido).
  Nessuna migration, nessuna normalizzazione retroattiva delle mansioni già
  scritte. `tsc --noEmit` + `vite build` verdi. **Da provare in app — checklist
  in §A.**

- [x] **2026-08-05** Risorse Umane: **la mansione si scrive in stampatello**
  (`RisorseUmane.tsx`). Cognome, nome e codice fiscale erano già forzati a
  maiuscolo in inserimento; mansione e reparto no, quindi la stessa mansione
  entrava scritta in tre modi diversi a seconda di chi compilava, e la colonna
  *Mansione* dell'elenco si leggeva a macchia. Ora `toUpperCase()` sul campo
  della scheda, **come già faceva `PersonaForm` in `OrganigrammaView.tsx:423`**:
  le due vie per creare una persona (Risorse Umane e il pannello di assegnazione
  di un ruolo) scrivevano lo stesso campo con due regole diverse.
  Uppercase anche sulla mansione letta dal **pannello Import** della stessa
  schermata (riga incollata/Excel), che già normalizzava nome e cognome ma non
  questa: forzarla solo a mano avrebbe rimesso il minuscolo a ogni import.
  Il **reparto** è lasciato com'è — non è stato chiesto e non è lo stesso dato.
  Nessuna migration, nessuna normalizzazione retroattiva delle righe già in
  tabella. `tsc --noEmit` + `vite build` verdi. **Da provare in app — checklist
  in §A.**

- [x] **2026-08-04** Scadenzario: **la formazione mai svolta è "SUBITO"**, ed è la
  prima riga (`57c8bc6`). Una persona con *Formazione generale
  lavoratori — Mai svolto* risultava **critica** nell'organigramma e
  **assente** dallo scadenzario: la mancanza più grave era l'unica che non
  generava lavoro. Causa: `backfillAzioniEsoneri` apriva con
  `if (!r.scadenza) continue` — solo scadenze monitorabili — e un corso mai
  svolto una scadenza non ce l'ha, perché non c'è né un attestato da cui
  calcolarla né (fuori dal datore ASR 2025) un termine di legge. Le proponeva
  solo `proponiCoseDaFare`, cioè il pannello **manuale** "Genera cose da fare".
  Ora:
  - nuovo predicato `gapSenzaData(r)` = critico, senza attestato né esonero,
    senza scadenza. Il backfill materializza anche queste, con
    `data_scadenza` **NULL**: una data non c'è e **non si inventa** (oggi, o
    oggi+30, sarebbe un dato dedotto indistinguibile da uno vero). Descrizione
    *"Formazione da erogare — CORSO (COGNOME Nome · Mai svolto)"*, col dettaglio
    dentro la parentesi perché la vista ricava il nome del corso togliendo
    prefisso e ultima parentesi.
  - `RigaScadenzario.subito`: riga di formazione senza data e non conclusa. Sugli
    **adempimenti** resta sempre `false` — lì "senza data" vuol dire che manca il
    dato, non che il lavoro è in ritardo.
  - `Scadenzario.tsx`: pill rossa **SUBITO** al posto del trattino (che si
    leggeva "non scade"); ordinamento con chiave `''`, quindi **prima di
    qualunque data** (prima finiva dietro anche alle scadenze del 2030);
    contata fra le **scadute** (altrimenti "0 scadute" con lavoratori senza
    alcuna formazione); inclusa nei filtri *Scadute* e *Prossime*, i due che si
    usano per lavorare.
  - `proponiCoseDaFare` **non** ripropone più i gap ora automatici: sarebbe la
    stessa mancanza due volte, una automatica e una a mano, e chiuderne una
    lascerebbe l'altra aperta. Resta la formazione frazionata quando il
    requisito **non** è critico (ore erogate che scadono comunque).
  Nessuna migration (`azione.data_scadenza` è già nullable). `tsc --noEmit` +
  `vite build` verdi. **Da provare in app — checklist in §A.**
  - [ ] **Doppioni pregressi da controllare**: se in passato si è premuto
    "Genera cose da fare", esistono righe `origine_ramo='formazione'` senza data
    per gli stessi gap che ora il backfill crea con `origine_requisito_key`.
    Compaiono entrambe come SUBITO. Non le cancello d'ufficio (sono righe create
    di proposito): da guardare sul cliente vero e decidere.
  - [ ] **Limite noto**: il tab Scadenzario di back-office (tutti i clienti) non
    sincronizza — lo fa solo la scheda del singolo cliente, per non valutare
    l'organigramma di ogni cliente a ogni apertura. Le righe SUBITO compaiono lì
    dopo essere passati sulla scheda del cliente. Comportamento preesistente.

- [x] **2026-08-04** Organigramma: **il clic su una persona apre la sua sola
  scheda** (`OrganigrammaView.tsx`, `d750f54`). Nella fisarmonica
  *Organigramma attuale* il clic su una riga-persona apriva la scheda del RUOLO
  con dentro **tutti** gli incaricati: sui Lavoratori dopo un import del
  gestionale sono decine, e la persona appena cliccata andava ritrovata a mano
  in un secondo elenco piu' lungo del primo. Ora `apriFigura(codice, personaId?)`
  porta con se' chi si e' cliccato (`focusPersona`) e la scheda mostra quella
  sola persona, con in testa una barra che dice cosa non si sta vedendo
  ("Scheda di Rossi Mario · il ruolo ha 12 incaricati") e il bottone **Vedi
  tutti gli incaricati (N)**: un filtro silenzioso su un ruolo affollato si
  legge come "ne ha uno". Il filtro segue anche in *Modifica* (renderFigCard,
  4o parametro `soloPersonaId`), ma **solo per le schede mostrate**: `titolari`
  — cio' che `AssegnaFiguraPanel` considera gia' assegnato — resta sull'elenco
  completo, altrimenti il salvataggio cancellerebbe gli altri incaricati. Le
  altre vie restano sul ruolo intero perche' e' quello che chiedono: riga-testata
  del ruolo, riga "Nessun incaricato", *Apri il ruolo* dalla ricerca, nodo dello
  schema, e `apriAssegna` (assegnare e' un'operazione sul ruolo: filtrare
  nasconderebbe proprio chi c'e' gia'). Se la persona sparisce dagli incaricati
  mentre la scheda e' aperta (rimossa dal ruolo) si ricade sull'elenco intero.
  Solo Canale 1, nessuna migration. `tsc --noEmit` + `vite build` verdi.
  **Da provare in app — checklist in §A.**

- [x] **2026-08-04** Organigramma: **ricerca per persona** (`OrganigrammaView.tsx`,
  `7315b7d`). L'organigramma e' ordinato per RUOLO, ma la domanda che
  arriva a voce e' sull'individuo — "Rossi e' a posto?" — e per rispondere si
  aprivano i ruoli a uno a uno leggendo gli elenchi. Campo di ricerca sopra
  *Organigramma attuale*: da 2 caratteri in su **sostituisce la tabella** (non le
  si affianca: due viste degli stessi dati una sopra l'altra sono il doppione
  appena tolto altrove) con la scheda di ogni persona trovata — semaforo e stato
  complessivo, attestati che coprono solo una parte del percorso, poi un blocco
  per ruolo con data di nomina, "atto ufficiale mancante" dove manca, requisiti e
  moduli con esito e dettaglio, piu' *Apri il ruolo* che pulisce la ricerca e
  porta alla scheda. `normalizza()` (minuscole + accenti via NFD) e
  `corrispondePersona()`: tutti i termini digitati devono comparire, in qualunque
  ordine e campo, cosi' "rossi mario", "mario rossi" e "rossi saldatore" trovano
  la stessa persona; guarda cognome, nome, mansione, reparto e codice fiscale.
  Essendo in `OrganigrammaView` vale **anche in campo**. Solo Canale 1, nessuna
  migration. `tsc --noEmit` + `vite build` verdi. **Da provare in app —
  checklist in §A.**

- [x] **2026-08-04** Organigramma: **niente doppioni fra pannello e scheda**
  (`OrganigrammaView.tsx`, `3979c67`). Correzione di `ad9e476`,
  provata in app e sbagliata su due punti.
  - Il passo 2 del pannello (data di nomina + evidenze per le assegnazioni
    appena create) **ripeteva** il passo 1 della scheda dell'incaricato, che
    compare due centimetri sotto con gli stessi identici campi: stessa nomina
    stampata due volte, una sopra l'altra. Il pannello ora risponde alla sola
    domanda "chi ricopre il ruolo" e alla conferma si chiude; data e documenti
    restano dove erano gia', nel passo 1 della scheda.
  - I due bottoni delle prescrizioni erano in testa al ruolo, cioe' prima della
    nomina: ma il passo 1 e' la nomina e il passo 2 e' la formazione, quindi ora
    stanno **nella testata del passo 2 di ogni incaricato** (*Corsi e
    aggiornamenti* / *Esonero e crediti*), aperti per singola scheda.
  - I promemoria degli esoneri ammessi sotto ogni requisito dicevano parola per
    parola cio' che dice il bottone *Esonero e crediti*: ora compaiono **solo con
    l'editor aperto**, dove servono a scegliere fra attestato ed esonero.
  - Un ruolo **senza incaricati** non ha un passo 2, quindi resterebbe senza
    prescrizioni: nuovo `GuidaInfo`, la **"i" accanto al nome del ruolo** che a
    passaggio del mouse (o da tastiera, `:focus-within`) apre le due sezioni
    *Corsi e aggiornamenti* / *Esonero e crediti*. Riusa il popup gia' in uso
    nella scheda singola, con variante `.fzr-pop.sx` ancorata a sinistra (la "i"
    sta a inizio riga: verso destra uscirebbe dalla scheda). Presente sia nella
    scheda-editor sia nella scheda singola aperta dalla fisarmonica, cosi' la
    domanda "che formazione comporta questo ruolo?" non richiede piu' di
    nominarci prima qualcuno.
  Solo Canale 1, nessuna migration. `tsc --noEmit` + `vite build` verdi.

- [x] **2026-08-04** Organigramma: **prima la persona, poi il percorso formativo**
  (`OrganigrammaView.tsx`, `ad9e476`). Tre cose, un solo filo:
  l'ordine in cui si compila un ruolo.
  - **Guida condensata in due bottoni**. `figura_sicurezza.guida` e' un testo
    unico che mescola percorso formativo (corso base, moduli ATECO/rischio,
    aggiornamento) e crediti/esoneri Allegato III: srotolato erano 5-8 righe
    sopra ogni ruolo. Nuovo `dividiGuida()` che separa per riga (dalla prima
    riga con "esoner/credito" in poi e' blocco esoneri; le sotto-righe "- "
    seguono la riga madre) + due bottoni **Percorso formativo** / **Esonero e
    crediti**, chiusi di default, uno aperto per volta. Nessuna migration: il
    testo a catalogo non cambia, cambia come si legge.
  - **Via la domanda pregressa dall'assegnazione**. Il passo "azienda gia'
    operante prima dell'ASR 2025? Si'/No" dopo il Salva, e l'apertura automatica
    di *Evidenze pregresse*, chiedevano evidenze di credito a chi stava solo
    nominando qualcuno. Tolti dal flusso di assegnazione; il flag
    `formazione_pregressa` **resta nell'anagrafica persona** (e con esso la
    valutazione "da verificare" invece di "critico") e il credito si dichiara
    dopo la nomina, come esonero sul singolo requisito.
  - **Pannello di assegnazione in due passi**. Passo 1 *Chi ricopre il ruolo*:
    tendina delle risorse umane **+ "Persona non in elenco"**, che crea
    l'anagrafica senza uscire dal pannello (prima si finiva in Risorse Umane
    perdendo ruolo e selezione) — `PersonaForm` guadagna `mostraPregressa` e
    `onCreata`. Passo 2 *Evidenza della nomina*: `NominaInline` (data, a oggi ma
    correggibile) + `EvidenzeNomina` (atto, visura, procura) per le sole
    assegnazioni appena create, dove l'adapter le fornisce (back-office; in
    campo resta la sola data). `salvaNomina` ora si usa il valore di ritorno,
    che serve per l'id delle evidenze.
  - Nella scheda incaricato il passo 2 si chiama **Percorso formativo** e il
    bottone di un requisito ancora vuoto dice **Formazione o esonero** (resta
    "Registra" per antincendio/primo soccorso, che non hanno crediti).
  Solo Canale 1, nessuna migration. `tsc --noEmit` + `vite build` verdi.
  **Provata in app: da qui le due correzioni di `3979c67`.**

- [x] **2026-08-04** Organigramma: **assegnare/nominare dalla fisarmonica**
  (`OrganigrammaView.tsx`, `c7d5464`). Aprendo un ruolo scoperto la
  riga diceva solo "Nessun incaricato" e finiva li': l'assegnazione esisteva ma
  stava tre clic sotto (riga → scheda singola → *Modifica* → *Assegna*), quindi
  la fisarmonica sembrava di sola lettura. Ora:
  - riga vuota → bottone **Assegna…** (**Adibisci…** sui Lavoratori) che porta
    dritto al pannello `AssegnaFiguraPanel`, gia' aperto sulla tendina delle
    risorse umane;
  - ruolo gia' coperto → riga in coda con **Modifica incaricati…** (aggiungere
    una persona a un ruolo non vuoto e' la stessa operazione);
  - scheda singola a ruolo vuoto: il bottone non dice piu' "Modifica" (non c'e'
    nulla da modificare) ma **Assegna**/**Adibisci** e apre subito il pannello.
  Nuovo helper `apriAssegna()`: chiude *Aggiorna organigramma*, apre la figura in
  editor con il pannello espanso e ci scrolla sopra. Il pannello e' quello
  esistente, quindi restano invariati filtro "solo chi ha gia' il corso
  attinente", selezione di massa e passo *formazione pregressa*. Nessuna
  migration (solo Canale 1). `tsc --noEmit` verde. **Da provare in app.**

- [x] **2026-08-03** Elenchi di persone **per cognome** (`ad53a53`, `20dca5c`).
  `nomePersonaCognome` ("Cognome Nome", la forma da elenco — `nomePersona` resta
  la forma discorsiva per frasi e documenti) e `confrontaPersone` (localeCompare
  `it`, sensitivity base: dal gestionale i cognomi arrivano in maiuscolo e con
  accenti, dall'inserimento a mano no) in `lib/admin/formazione.ts`. Applicati in
  `OrganigrammaView.tsx` a: tendina candidati del pannello di assegnazione, chip
  degli assegnatari, passo *formazione pregressa*, righe incaricati, tabella di
  copertura e testo "N persone hanno gia' il corso". Dopo un import del
  gestionale i Lavoratori sono decine: una tendina in ordine di arrivo (che il
  motore raggruppa per valutazione) si scorre due volte per trovare un cognome.
  I due commit sono edit da web GitHub; **`tsc -b` + `vite build` verificati in
  locale 2026-08-03 — verdi.**

- [x] **2026-08-03** Figure dell'organigramma **richiudibili e chiuse all'apertura**.
  In due tempi, perche' il primo giro ha coperto la sezione sbagliata:
  - `20dca5c`: chip richiudibili (+ **Espandi tutte** / **Chiudi tutte**) e
    rimozione di `initAperte`, il ref che apriva tutte le figure al caricamento.
    Vale pero' solo **dentro il box "Aggiorna organigramma"** (`aggiornaOpen`),
    che all'apertura e' chiuso: la vista che si vede arrivando sul cliente e'
    un'altra.
  - Vista principale *Organigramma attuale* (`renderTabella`): era una tabella
    piatta ruolo→persona→evidenze, srotolata tutta, senza alcun toggle. Ora e' una
    **fisarmonica**: il ruolo non e' piu' una colonna ma la riga-testata del suo
    blocco (semaforo, nome, "N incaricati" oppure "scoperto (obbligatorio)" in
    rosso), chiusa di default; il clic apre/chiude solo quel ruolo. Stesso stato
    `aperte` dei chip — una figura aperta e' aperta ovunque — e stessi **Espandi
    tutte / Chiudi tutte** sopra la tabella. Il clic su una riga-persona continua
    ad aprire la scheda singola. `tsc -b` + `vite build` verdi. Da provare in app.

- [x] **2026-07-01** Fase 3 · **scadenzario unico** (read-model). Il back-office
  "Cose da fare" fonde in un unico elenco ordinato per data: scadenze formative +
  azioni correttive (gia' `azione`) + **sopralluoghi pianificati** (righe
  `sopralluogo` in stato pianificato/in_corso, lette in SOLA LETTURA senza
  duplicarle in `azione` -- il ciclo del sopralluogo resta in Pianificazione/campo).
  Nuovo filtro "Tipo" (Formazione/Correttive/Sopralluoghi); scadute evidenziate.
  `cosedafare.ts` (`CosaDaFareAdmin` diventa union discriminata su `kind`;
  `caricaCoseDaFare` unisce le due sorgenti) + `CoseDaFare.tsx`. **Nessuna
  migration** (solo Canale 1). `tsc -b` + `vite build` verdi.
- [x] **2026-07-01** Fase 3 · **standalone dismettibile**. Parita' funzionale
  raggiunta (CF/Belfiore, crediti Allegato III, import catalogo -- Fase 1) e dati
  migrati one-shot (046/047, la standalone conteneva solo OVERALL GROUP). Verificato
  che NON esiste alcuna dipendenza viva app -> standalone nel repo (nessun link,
  nessuna UI d'import: la migrazione fu solo SQL). Lo spegnimento e' quindi
  un'azione operativa ESTERNA (eliminare il deploy della standalone), non un
  intervento su questo repo.
- [x] **2026-07-01** Allineamento doc (nessun codice): chiusa la nota §D. Verificato
  che `PROGETTO.md §8` NON elenca piu' "rigenerazione scadenze ricorrenti -> DA FARE"
  (l'unico DA FARE di §8 resta il collegamento Werp, corretto); la tabella di
  copertura dice gia' "Coperto ... via trigger, migration 013" e §9 e' allineata
  (correzione applicata in una sessione precedente). La sezione §D e' stata rimossa
  perche' vuota.

- [x] **2026-06-23** Monitoraggio automatico scadenze formazione (scelta A).
  Migration 042 (`azione.origine_formazione_id` FK cascade + backfill). Una
  formazione con scadenza crea/aggiorna un'azione di scadenzario collegata
  (id azione = id formazione), online e offline (outbox); al rinnovo si aggiorna,
  all'eliminazione/rimozione scadenza sparisce. `proponiCoseDaFare` salta i
  requisiti gia' auto-monitorati per non duplicare. **042 in SQL Editor prima del
  push.** `tsc -b` + `vite build` verdi; SQL OK.
- [x] **2026-06-23** Fix perdita dati: rimozione persona per-ruolo. Nella card
  incaricato "Rimuovi dal ruolo" (solo quella nomina); il "Rimuovi persona (da
  tutti i ruoli)" globale e' nascosto nelle card di ruolo. Evita di cancellare la
  persona da tutti i ruoli quando si voleva toglierla da uno solo.

- [x] **2026-06-23** Parità organigramma campo = back-office + PDF emergenze.
  Prefetch cacha i meta cliente in Dexie (tabella `clienteMeta`, schema **v6**:
  rischio, rls territoriale, livelli emergenza); `caricaOrganigrammaLocale` li
  espone e `FormazioneRiepilogo` li passa ad `assemblaRiepilogo` → campo valuta
  identico al back-office (prima girava senza opts). Snapshot + Edge Function
  `organigramma-pdf` ora riportano il corso da erogare per addetti emergenza
  scoperti (`corso_emergenza`). `tsc -b` + `vite build` verdi. **PDF va
  ridistribuito (canale 2)**; il corso compare sui nuovi snapshot.

- [x] **2026-06-23** Organigramma: rifiniture IA + emergenze. (1) Il rischio
  proposto dall'ATECO si propaga subito all'organigramma (`OrganigrammaCliente`
  `refreshToken`). (4) Le schede ruolo si aprono inline nel proprio gruppo
  (`renderFigCard`). (5) Colori dei bottoni-figura coerenti con lo stato reale
  + legenda (`statoFigura`). (6) Se DL = RSPP sparisce l'intera area SPP
  (RSPP + ASPP) in motore e view. (7) Emergenze definite a monte: migration 041
  (`cliente.livello_antincendio` 1/2/3, `gruppo_primo_soccorso` A/BC), selettori
  in anagrafica, indicazione del corso da erogare per addetti scoperti in scheda
  e in `proponiCoseDaFare` (`corsoEmergenzaRichiesto`). `tsc -b` + `vite build`
  verdi; SQL parse OK + ASCII-only. Rilascio: **041 in SQL Editor PRIMA** del push.

- [x] **2026-06-23** Anagrafica fiscale cliente + **codice ATECO guidato**.
  Migration 040 (`cliente.partita_iva`/`codice_fiscale`/`codice_ateco`); nuovo
  `src/lib/ateco.ts` (tabella Allegato IV ASR 2025 generata dalla libreria
  `formazione-81-utils-src`, 88 divisioni) con `risolviAteco`/`cercaAteco`; campo
  ATECO typeahead nel blocco Ragione sociale che propone/applica
  `cliente.livello_rischio`. `types.ts` + `lib/admin/anagrafiche.ts`
  (colonne/upsert/`clienteVuoto`) + `admin/Anagrafiche.tsx`. `tsc -b` +
  `vite build` verdi; SQL parse OK + ASCII-only. Rilascio: **040 in SQL Editor
  PRIMA** del push. Chiude il punto 1 di "Aperto / da decidere".

- [x] **2026-06-21** Modello box, passi **1a+1b**: estratto il motore di render
  delle voci in `src/vociRender.tsx` (single source su `ContestoVoci`) e fatto
  usare a `src/Compilazione.tsx` senza duplicazione (1154→817 righe). `vociRender`
  ora esporta anche `Resp/Bozza/BozzaScad/I`; `Compilazione` costruisce `ctx` prima
  del `return` e chiama `renderVoce(ctx, v, null)`. Nessuna modifica a stato,
  handler o `completaSopralluogo`. Verificato con `tsc -b` + `vite build` (verdi).
  Canale 1 (2 file). Nessuna migration.

- [x] **2026-06-19** Antincendio / primo soccorso: rimosso il cancello
  esonero/credito (back-office + campo) per le categorie fuori dal regime
  ASR 2025; si registra direttamente la formazione. Canale 1.

- [x] **2026-06-19** Assegnazione ruolo: alla prima assegnazione di una persona a
  una figura, passo *Formazione pregressa? SI/NO* — SI apre le evidenze pregresse
  (e imposta il flag persona), NO prosegue con la formazione ASR 2025. Solo
  `src/admin/Formazione.tsx`, nessuna migration.

- [x] **2026-06-19** Organigramma back-office: box criticita' ruolo scoperto
  ridotto a "Criticita': ruolo obbligatorio senza incaricato"; box RLS con spunta
  **RLS territoriale (RLST)** (`cliente.rls_territoriale`, **migration 028** da
  eseguire): se attiva l'RLS non e' piu' un ruolo scoperto. Motore, snapshot e
  firma aggiornati. Build pulita.

- [x] **2026-06-19** Back-office formazione: pulsante *rimuovi attestato* per
  requisito; pannello dedicato *Evidenze pregresse* (si apre attivando la spunta
  formazione pregressa, o dal bottone nella scheda persona) per registrare gli
  attestati pregressi con data + scadenza manuale, oppure creare una cosa da fare
  per recuperarli. Solo `src/admin/Formazione.tsx`, nessuna migration. Build pulita.

- [x] **2026-06-19** Snapshot versionato dell'organigramma sicurezza + PDF a
  richiesta (Parte 3). Migration 027 (`organigramma_revisione` + trigger di
  numerazione per cliente), Edge Function `organigramma-pdf` (PDFBolt, bucket
  `report`), nuovo modulo `src/lib/admin/organigramma-revisioni.ts`. Back-office:
  snapshot automatico dopo ogni modifica con dedup per firma lato server,
  pulsanti *Esporta PDF organigramma* e *Storico organigramma* (lista + vista
  sola lettura + PDF della singola revisione). Campo: snapshot alla conferma,
  costruito dallo stato locale, accodato via outbox, dedup locale (localStorage).
  Build `tsc -b` + `vite build` puliti. **Da deployare** (vedi sezione A).

- [x] **2026-06-11** Editor template riallineato alla modalità di rilievo unica
  (Fase C). Rimossi i knob senza più effetto a runtime: `stato`/`genera_azione`
  sulle opzioni (l'esito è esplicito), `richiedi_foto_se` e `azione_opzionale`
  (foto/cose-da-fare ormai universali), il gate "Abilita scadenza ricorrente"
  (la scadenza è proponibile sempre; resta solo la periodicità di default,
  ora editabile su ogni voce). Aggiunto il campo `etichetta_aggiunta` per le
  voci *Rilievo*. Pulito il modello (`types.ts`) e il codice morto in
  `compilazione.ts` (`statoEsito`/`opzioneDi`). Build verde, nessuna migrazione.
- [x] **2026-06-11** Compilazione: modalità di rilievo unica (Fasi A+B, commit
  `a35cf45`). Ogni voce, a prescindere dal tipo, offre evidenze (nota+foto),
  cose da fare, scadenza ricorrente ed esito esplicito conforme/NC/NA.
- [x] **2026-06-05** "Cose da fare" sempre proponibili su qualunque voce della
  checklist. Bottone "+ Aggiungi cosa da fare" universale in compilazione, a
  prescindere dal tipo di voce e dalla configurazione del template. Mantenuti i
  comportamenti automatici esistenti (auto-seed bozza su opzione con
  `genera_azione`, scadenze ricorrenti, rilievi). Rimossa la cancellazione
  automatica delle bozze quando l'utente cambia opzione su una `scelta`.
- [x] **2026-06-05** Feed iCal sottoscrivibile per tecnico (migration 014 +
  Edge Function `calendario-ics` + UI in scheda tecnico). Commit `1a1d595`,
  rename a 014 in `f776edf`.
- [x] **2026-06-05** Ricalibrazione date successive in pianificazione (dialogo
  uniformi/shift/no, helper in `calendario.ts`). Commit `1a1d595`.
- [x] **2026-06-05** Pulizia repo nidificato: eliminata la cartella
  `AppSopralluoghi/` interna duplicata, ora un solo repo allineato con
  `origin/main`.
