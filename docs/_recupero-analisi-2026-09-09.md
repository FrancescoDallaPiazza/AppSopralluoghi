# Recupero - analisi di verifica del 9 settembre 2026

Sessione interrotta dallo spegnimento del PC (9/9, 08:35) subito prima di scrivere
il report da condividere. Nessun contenuto e andato perso: qui sotto ci sono, in ordine,
il punto di partenza, i mandati dati ai tre agenti di verifica, i loro referti integrali
e le sintesi. Da qui si puo ricostruire l artifact senza rifare l analisi.


---

Ieri sera (8 settembre, ~19:20) l'unica cosa toccata è stato `docs/TODO.md`: nessun codice modificato, working tree pulito, e l'ultimo lavoro sul codice resta quello del 26 agosto (migrazione da Sicurweb).

Il commit `24bd3da` aggiunge al TODO una nuova sezione **"0-bis · Scorporo dei sopralluoghi (studio 2026-09-08)"** — la formalizzazione dello studio sullo scorporo verso AppFormazione, con il link all'artifact. In sintesi:

**Il perché, misurato:** al commit `f398cf4` la formazione è 8.876 righe (36%) contro 9.410 di sopralluogo puro (38%). Il percorso da campo è fermo dal 14 luglio, mentre `admin/` e `formazione/` hanno commit fino al 26 agosto.

**Deciso:** in campo l'organigramma diventa di sola lettura — il tecnico segnala le carenze ma non crea più persone, nomine, attestati ed esoneri offline. È la decisione che sblocca la separazione dei database (altrimenti due code da riconciliare nella stessa `outbox`).

**Raccomandato ma ancora da confermare:** potatura del repo attuale invece di un repo nuovo; due database con anagrafe replicata verso AppFormazione; le dodici colonne di `cliente`/`sede` divise fra fatti (restano) e verdetti (`livello_rischio`, `livello_antincendio`, `gruppo_primo_soccorso` → AppFormazione); e l'emendamento alla Direzione che divide lo scadenzario, con `S2`/`S3` da sospendere sulla parte formativa.

**Da chiudere prima del taglio** — la lista è cresciuta a sei voci (la mia nota diceva quattro): cache voci rotta sui template composti, report che ignora `componente_id`, drain `runSync` fail-fast, colonna `tecnico.cognome` inesistente, doppia verità cliente/sede della migrazione 054, e `updated_at` per riga.

**Prerequisiti dei link fra app:** router con URL, chiave cliente condivisa (480 per ragione sociale contro 618/449 per P.IVA + sede — l'unica cosa che se sbagliata adesso non si ripara dopo), SSO.

Il punto di ripresa naturale è quindi o confermare le quattro raccomandazioni aperte, o attaccare i difetti dell'app da campo. Da cosa vuoi partire?



---

Il TODO fa una quindicina di affermazioni verificabili contro il codice: conteggi di righe, date, quattro difetti puntuali con file e funzioni, e tre prerequisiti. Le faccio verificare in modo avversariale da tre agenti indipendenti, in sola lettura, uno per dimensione.



---

### Mandato all-agente: Verifica i quattro difetti di codice

Sei un revisore INDIPENDENTE e AVVERSARIALE. Repo: C:\Users\Francesco\Documents\GitHub\AppSopralluoghi (Next.js/TypeScript + Supabase, app per sopralluoghi di sicurezza sul lavoro, con modalità offline).

Qualcun altro ha scritto un'analisi che elenca quattro difetti nel percorso "app da campo". Il tuo compito NON è confermarli: è verificare ciascuno contro il codice reale e dire se regge, se è impreciso, o se è falso. Diffida del testo: è stato scritto da un altro modello e potrebbe aver frainteso o inventato nomi di file e funzioni.

AFFERMAZIONI DA VERIFICARE (una per una):

1. "Cache voci rotta sui template composti. `caricaVoci()` scrive la chiave di cache `voci:<templateId>` solo `if (voci.length)`, ma nei box le voci hanno `template_id NULL`: la cache non si scrive mai, nemmeno dal prefetch. Aprire OFFLINE per la prima volta un sopralluogo con template composto fallisce."

2. "Il report non conosce i componenti. `genera-report/report-data.ts` filtra `voce_template` per `template_id` e ignora `esito_voce.componente_id`: le risposte ripetute per componente escono appiattite."

3. "Drain `runSync` fail-fast. Un errore su una riga interrompe l'intero ciclo e si ritenta identico: una riga storta blocca per sempre la coda. Manca dead-letter per operazione, backoff, e una schermata che dica cosa si è rotto."

4. "Colonna `tecnico.cognome` inesistente. `lib/auth.ts` e `lib/admin/tecnici.ts` la leggono e la scrivono, ma nessuna migrazione la crea."

METODO:
- Trova i file veri (i percorsi nell'analisi potrebbero essere approssimativi) e leggi il codice effettivo, non solo i nomi.
- Per il punto 1: verifica davvero come è costruita la chiave di cache, quando viene scritta, cosa succede col prefetch, e se le voci dei template composti/box hanno davvero template_id NULL (guarda le migrazioni SQL e le query).
- Per il punto 4: cerca in TUTTE le migrazioni SQL (supabase/migrations o simile) se `cognome` esiste sulla tabella tecnico; controlla anche eventuali colonne generate, viste, o un `nome` che contiene tutto. Se la colonna non esiste, verifica se il codice fallirebbe davvero a runtime o se è in un ramo morto.
- Cita SEMPRE file:riga come prova. Nessuna affermazione senza prova.

OUTPUT (in italiano, conciso):
Per ciascuno dei 4 punti: verdetto CONFERMATO / IMPRECISO / SMENTITO, 2-4 righe di spiegazione, prove file:riga, e la gravità reale (blocca un tecnico in campo? o è teorico?).
In coda: "COSA HO TROVATO CHE L'ANALISI NON DICE" — al massimo 5 punti, solo se sono difetti veri e provati nello stesso percorso da campo/offline/report.
Non modificare alcun file.



---

### Mandato all-agente: Verifica il modello dati e la doppia verità

Sei un revisore INDIPENDENTE e AVVERSARIALE del modello dati. Repo: C:\Users\Francesco\Documents\GitHub\AppSopralluoghi (Next.js/TypeScript + Supabase; app per sopralluoghi di sicurezza sul lavoro). Le migrazioni SQL sono in supabase/migrations o percorso simile: trovale.

Un'analisi propone di scorporare la parte "formazione" verso un'altra app (AppFormazione) e fa affermazioni precise sul modello dati. Il tuo compito NON è confermarle ma verificarle contro lo schema reale. Diffida del testo: potrebbe aver sbagliato nomi di colonne o numeri di migrazione.

AFFERMAZIONI DA VERIFICARE:

1. "Doppia verità cliente/sede (migrazione 054): livello_rischio, livello_antincendio, gruppo_primo_soccorso e codice_ateco sono duplicati SIA su `cliente` SIA su `sede`. Il fatto appartiene alla sede; sul cliente dovrebbe restare solo il derivato della sede principale."
   → Trova la migrazione (il numero 054 potrebbe essere sbagliato), elenca le colonne realmente duplicate, e verifica nel codice applicativo QUALE delle due copie viene letta e scritta, e se possono divergere.

2. "Manca `updated_at` per riga, quindi l'ultimo che sincronizza sovrascrive in silenzio le modifiche dell'ufficio."
   → Verifica su quali tabelle esiste/non esiste updated_at, se ci sono trigger che lo mantengono, e se la sincronizzazione offline fa davvero last-write-wins senza confronto. Distingui le tabelle del percorso da campo dalle altre.

3. "Le dodici colonne aggiunte a cliente/sede si dividono per natura: sono FATTI (`codice_ateco`, `numero_lavoratori`, `rls_territoriale`, e i due campi `*_definito_mediante`) contro VERDETTI derivati dalla norma (`livello_rischio`, `livello_antincendio`, `gruppo_primo_soccorso`)."
   → Sono davvero dodici? Elencale tutte con la migrazione che le crea. La divisione fatti/verdetti regge guardando come sono calcolate e usate nel codice? Chi le scrive: l'utente a mano, un import, o un motore di calcolo?

4. "A `codice_ateco` manca l'annata (ATECO 2007 vs ATECO 2025) e va aggiunta."
   → Verifica se esiste già una colonna o convenzione per l'annata, e dove il codice ATECO viene interpretato (tabelle di lookup, mapping rischio) in modo che l'annata cambierebbe l'esito.

METODO: cita SEMPRE file:riga (migrazione o codice) come prova. Distingui ciò che è nello schema da ciò che è solo nel codice TypeScript.

OUTPUT (italiano, conciso): per ciascun punto verdetto CONFERMATO / IMPRECISO / SMENTITO con prove e, dove l'affermazione è imprecisa, la versione corretta. In coda, max 5 rischi del modello dati che l'analisi NON menziona e che complicherebbero lo scorporo (chiavi esterne che attraversano il confine formazione/sopralluogo, RLS policy, viste, trigger).
Non modificare alcun file.



---

### Mandato all-agente: Verifica numeri, date e prerequisiti

Sei un revisore INDIPENDENTE e AVVERSARIALE. Repo: C:\Users\Francesco\Documents\GitHub\AppSopralluoghi (Next.js/TypeScript + Supabase). Hai accesso a git e alla shell: usali per RICALCOLARE i numeri, non fidarti di quelli che ti do.

Un'analisi giustifica lo scorporo della parte "formazione" verso un'altra app con questi dati quantitativi e questi prerequisiti. Verificali.

NUMERI DA RICALCOLARE (misurati al commit f398cf4):
- "formazione 8.876 righe (36%), sopralluogo puro 9.410 (38%), back-office 4.409, piattaforma 1.881"
  → Ricalcola tu la ripartizione delle righe di codice per area (escludendo node_modules, build, lock file, e dichiarando se conti o no SQL/test/generated). Dichiara ESPLICITAMENTE il criterio con cui assegni ogni cartella a un'area, perché è lì che si nascondono gli errori. I totali tornano? Le percentuali tornano? La conclusione "la formazione è un terzo dell'app" regge con un criterio ragionevole, o dipende da come si assegnano le cartelle ambigue?
- "Il percorso da campo non si tocca dal 14 luglio, mentre admin/ e formazione/ hanno commit fino al 26 agosto: due terzi dello sforzo recente è finito fuori dai sopralluoghi."
  → Verifica con git log per cartella. Qual è la data reale dell'ultima modifica sostanziale al percorso da campo (ignorando refactor di massa, rinomine, formattazione)? "Due terzi dello sforzo recente" regge se misuri i commit degli ultimi 2-3 mesi?

PREREQUISITI DA VERIFICARE NEL CODICE:
1. "Router con URL: oggi la navigazione è stato React annidato, un deep link non ha una controparte a cui arrivare né un posto da cui tornare."
   → È vero? Il progetto usa Next.js: verifica se ci sono route reali (app/ o pages/) o se davvero tutto è dentro uno stato React in una pagina sola. Quanto è profonda la cosa: una schermata o tutta l'app?
2. "Chiave cliente condivisa: le due app importano lo stesso export Sicurweb con chiavi diverse (480 clienti per ragione sociale normalizzata contro 618/449 per P.IVA + sede)."
   → Di AppFormazione NON hai il codice: limitati a verificare QUALE chiave usa QUESTA app nell'import (cerca la logica di import/migrazione Sicurweb, la normalizzazione, e i vincoli UNIQUE nelle migrazioni). Il numero 480 è riproducibile o non verificabile da qui? Dillo chiaramente.
3. "SSO: due Auth Supabase distinte e due tabelle di ruoli indipendenti; senza SSO ogni link fra le app è un login."
   → Verifica come funziona l'auth qui (Supabase Auth? tabella ruoli custom? tecnico/admin?) e se l'affermazione sul lato di QUESTA app è corretta.

OUTPUT (italiano, conciso): per ogni numero il valore che hai ricalcolato tu accanto a quello dichiarato, con il comando/criterio usato; per ogni prerequisito verdetto CONFERMATO / IMPRECISO / SMENTITO con prove file:riga. Chiudi con una riga secca: la giustificazione quantitativa dello scorporo regge, regge in parte, o è gonfiata?
Non modificare alcun file. Non fare commit.



---

Tre agenti indipendenti stanno lavorando in parallelo, ciascuno in sola lettura e con l'istruzione esplicita di smentire, non di confermare:

1. **I quattro difetti di codice** — cache voci sui template composti, report che ignora `componente_id`, drain `runSync` fail-fast, colonna `tecnico.cognome`. Deve trovare i file veri e portare prove `file:riga`, più la gravità reale (blocca un tecnico in campo o è teorico?).
2. **Il modello dati** — la doppia verità cliente/sede della migrazione 054, `updated_at`, la divisione fatti/verdetti delle dodici colonne, l'annata ATECO. Più le chiavi esterne che attraversano il confine formazione/sopralluogo, che sono la cosa che davvero complica lo scorporo.
3. **Numeri e prerequisiti** — ricalcola da zero la ripartizione delle righe (8.876 / 9.410 / 4.409 / 1.881) dichiarando il criterio con cui assegna le cartelle ambigue, ricontrolla le date per cartella, e verifica router, chiave cliente e SSO nel codice.

Un avvertimento sul terzo: di AppFormazione non abbiamo il codice qui, quindi il confronto 480 contro 618/449 sulla chiave cliente non è verificabile da questo repo — ho chiesto all'agente di dirlo apertamente invece di inventare una conferma. Quella resta da controllare nell'altro repo.

Ti avviso appena rientrano; poi ti do il quadro unito, segnalando in particolare dove i tre si contraddicono a vicenda.



---

<task-notification>
<task-id>a61b1f519f1025beb</task-id>
<tool-use-id>toolu_01GkJ54JQJEo8EkCRhcT6hik</tool-use-id>
<output-file>C:\Users\FRANCE~1\AppData\Local\Temp\claude\C--Users-Francesco-Documents-GitHub-AppSopralluoghi\cbaa2161-ec64-4a00-8cd6-cfbea5e522a1\tasks\a61b1f519f1025beb.output</output-file>
<status>completed</status>
<summary>Agent "Verifica i quattro difetti di codice" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Ho verificato tutto contro il codice. Ecco i verdetti.

---

## 1. Cache voci rotta sui template composti — **CONFERMATO (con causa da correggere)**

L'effetto è reale e blocca il tecnico, ma il meccanismo descritto è impreciso.

- La chiave è davvero `voci:&lt;templateId&gt;` e la scrittura è davvero condizionata: `C:\Users\Francesco\Documents\GitHub\AppSopralluoghi\src\lib\compilazione.ts:86` e `:121` (`if (voci.length) scriviCacheVoci(...)`).
- Le voci dei box hanno davvero `template_id NULL`: `supabase/migrations/030_box_catalogo.sql:41-49` rende `template_id` nullable, aggiunge `sezione_id` e impone il vincolo XOR `voce_template_owner_chk`; il seed dei capitoli inserisce tutte le voci con `template_id = null` (`supabase/migrations/035_box_seed_capitoli.sql:29-36`).
- Quindi per un template *composto* (nessuna voce piatta, vedi il modello `composto` in `src/lib/admin/templates.ts:46-54` e `src/admin/TemplateList.tsx:79`) `caricaVoci()` torna `[]` online, non scrive la chiave, e offline cade in `throw new Error('Voci del template non disponibili offline.')` (`src/lib/compilazione.ts:123-127`).
- Il prefetch non salva: `prefetchTemplatesAttivi` chiama lo stesso `caricaVoci` (`src/lib/compilazione.ts:199-205`), anche se gira in automatico all'apertura della lista (`src/MieiSopralluoghi.tsx:185-192`).
- L'eccezione risale fino alla schermata: `apriCompilazione` → `creaCompilazione` → `caricaVoci` (`src/lib/compilazione.ts:246`, `:303`, `:313`), e in UI diventa `fase = 'errore'` (`src/Compilazione.tsx:217`, render a `:373`).

**Correzione alla causa**: non è vero che "le voci dei box non sono in cache". Lo sono, ma in IndexedDB (`db.vociBox`), non in localStorage: `src/lib/box.ts:38-43` (`prefetchCatalogoBox` scarica `voce_template` con `sezione_id not null`), e `caricaBoxComposti` legge da lì (`src/lib/box.ts:233`). Il difetto è solo la guardia `if (voci.length)` su un insieme legittimamente vuoto.

**Gravità: alta, blocca in campo.** Prima apertura offline di un giro con template composto = schermata di errore, niente ripiego, anche se tutto il resto (catalogo box, composizione, componenti) è già in cache.

---

## 2. Il report non conosce i componenti — **CONFERMATO (e peggiore di come è scritto)**

- Il filtro c'è ed è quello: `supabase/functions/genera-report/report-data.ts:126-127` (`.eq('template_id', comp.template_id)`).
- Conseguenza non citata dall'analisi: per un template composto `vociById` resta **vuota**, quindi `etichettaValore(undefined, valore)` cade nel ramo finale e stampa la **chiave grezza** invece dell'etichetta dell'opzione (`report-data.ts:63-73`, usato a `:165`). Non è solo "appiattito": è illeggibile per scelta/multiscelta.
- `componente_id` è davvero ignorato: la select degli esiti non lo include (`report-data.ts:131-134`), la colonna esiste (`supabase/migrations/032_box_componenti.sql:27`) ed è valorizzata in campo (`src/lib/useCompilazioneVoci.ts:85`, `:119`, `:192`). Nessuna occorrenza di `componente` in `supabase/functions/genera-report/report-html.ts`.

**Gravità: alta.** Non blocca il tecnico ma produce un documento consegnato al cliente in cui N estintori/quadri diventano N righe identiche senza etichetta, con i valori in codice.

---

## 3. Drain `runSync` fail-fast — **CONFERMATO, con una precisazione sui retry**

- Il ciclo è `for` su tutta la coda e ogni errore fa `throw` che esce dal loop lasciando la coda intatta: `src/lib/sync.ts:392-427` (`if (up.error) throw up.error` a `:400`, `:410`; `if (row.error) throw row.error` a `:402`, `:415`, `:418`; catch a `:422-424` che fa solo `console.warn`).
- Nessun contatore tentativi/dead-letter: la riga di coda è `{ kind, table, payload }` senza campi di stato (`src/lib/db.ts:176-181`, schema `outbox: '++seq, kind'` a `:124`).
- Nessuna schermata: l'unica spia è il conteggio `"N in coda"` (`src/Compilazione.tsx:248`, `:432`) — un numero che non cala e non dice perché.
- **Precisazione**: "si ritenta identico" sì, ma non c'è nemmeno un timer di backoff — i retry avvengono solo su evento `online` (`src/lib/sync.ts:431-434`), all'avvio (`src/App.tsx:163`) e a ogni `salvaEsito`/`salvaAzione` (`src/lib/sync.ts:93`, `:99`). Quindi in pratica si ritenta a raffica a ogni tocco, sempre dalla testa della coda.

**Gravità: alta.** Una singola riga rifiutata (RLS, FK, colonna sconosciuta) congela per sempre tutto ciò che le sta dietro — foto e esiti di un'intera giornata — in silenzio.

---

## 4. Colonna `tecnico.cognome` inesistente — **CONFERMATO nel repo, ma il ramo NON è morto**

- `create table tecnico` non ha `cognome`: `supabase/migrations/001_init.sql:40-51`. Le uniche `alter table tecnico` sono `ruolo` (`006_ruolo_backoffice.sql:16-17`), il check ruolo (`011_ruolo_interno.sql:13-14`) e `calendario_token` (`014_calendario_token.sql:6`). Un `grep cognome` su tutte le migrazioni dà solo `persona` (`015_formazione_organigramma.sql:99`, `042:29`, `046:48+`) — nessuna vista, nessuna colonna generata.
- Il commento nel codice cita una migrazione che non fa quello: `src/lib/admin/tecnici.ts:12` dice "cognome è nullable nel DB (migration 010)", ma `010_azione_notificata.sql` aggiunge `azione.notificata_il`. Il commit `e29107c "feat(tecnici): nome e cognome separati (migration 010)"` **non contiene alcun file di migrazione** (`git show --stat e29107c`: solo 5 file `src/`).
- Non è codice morto: `src/lib/auth.ts:14` mette `cognome` nella select di `risolviTecnico`, che sta sul percorso di login (`src/AuthProvider.tsx:97`). Con la colonna assente PostgREST restituisce errore → `throw` → catch → ripiego su cache, e senza cache l'utente finisce in fase `'offline'` (`src/lib/auth.ts:79-84`, `src/AuthProvider.tsx:107`) — cioè "sei offline" mentre è online. Anche `src/lib/admin/tecnici.ts:22`, `:39` (order by `cognome`), `:70` (insert/update) e l'Edge Function `supabase/functions/calendario-ics/index.ts:131` la usano.

**Gravità: alta ma differita.** Che l'app funzioni oggi implica che la colonna sia stata aggiunta a mano in produzione. Il difetto provato è la **non riproducibilità**: su un ambiente ricreato dalle migrazioni il login è rotto per tutti, con un messaggio fuorviante.

---

## COSA HO TROVATO CHE L'ANALISI NON DICE

1. **La coda non si compatta.** `enqueueRow` fa sempre `db.outbox.add` (`src/lib/db.ts:176-181`): ogni tocco su un esito accoda un nuovo upsert della stessa riga (`src/lib/useCompilazioneVoci.ts:133`, `:141`, `:152`, `:158` → `sync.ts:90-94`). Combinato col punto 3, la coda bloccata cresce senza limite e il "N in coda" diventa un numero senza significato.
2. **Perdita silenziosa di foto.** In `runSync` il ramo foto è dentro `if (fb &amp;&amp; foto)` (`src/lib/sync.ts:397-404`): se il blob non c'è più, l'operazione viene comunque cancellata a `:420` senza upload e senza `foto` row. La foto sparisce dal report senza alcun errore.
3. **`etichettaValore` senza voce → chiave grezza.** Vale anche fuori dal caso composto: qualunque esito il cui `voce_template_id` non sia tra le voci caricate stampa il valore non tradotto (`supabase/functions/genera-report/report-data.ts:63-73`). Un rilievo la cui voce sia stata cancellata dal back-office (`src/lib/admin/templates.ts:184`, delete reale) produce lo stesso sintomo su report già consegnati.
4. **`riallineaComposizione` cancella lato server senza salvaguardie.** `src/lib/box.ts:154-177` fa `enqueueDelete('sopralluogo_box', ...)` su tutte le righe attuali e le ricrea con id nuovi. Se il drain si blocca a metà (punto 3), i delete e gli insert possono restare in coda dietro una riga rotta, lasciando la composizione del giro divergente tra locale e server.
5. **Il conteggio `hasChecklist` ignora i box.** `report-data.ts:232` calcola `hasChecklist` da `totale`/`esitiTop`, entrambi derivati dagli esiti letti senza contesto box; sommato al punto 2, un giro interamente compilato su capitoli può generare un report che conta e mostra molto meno di quanto il tecnico ha effettivamente risposto.

Nessun file è stato modificato.</result>
<usage><subagent_tokens>86264</subagent_tokens><tool_uses>42</tool_uses><duration_ms>321365</duration_ms></usage>
</task-notification>



---

<task-notification>
<task-id>ad3402725da58c728</task-id>
<tool-use-id>toolu_01LEFc2F1qzY1xB2Lc4yiPd7</tool-use-id>
<output-file>C:\Users\FRANCE~1\AppData\Local\Temp\claude\C--Users-Francesco-Documents-GitHub-AppSopralluoghi\cbaa2161-ec64-4a00-8cd6-cfbea5e522a1\tasks\ad3402725da58c728.output</output-file>
<status>completed</status>
<summary>Agent "Verifica il modello dati e la doppia verità" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>## Punto 1 — Doppia verità cliente/sede — **CONFERMATO nello schema, ma SMENTITO nella diagnosi d'uso**

Migrazione corretta: `supabase/migrations/054_sede_prima_classe_fase1.sql` (numero giusto).

Colonne realmente duplicate su `sede` (054:26-34) rispetto a `cliente`:

| colonna | su `cliente` | su `sede` |
|---|---|---|
| `codice_ateco` | `040_cliente_anagrafica_fiscale.sql:13` | `054:29` |
| `livello_rischio` | `015_formazione_organigramma.sql:36` | `054:30` |
| `livello_antincendio` | `041_cliente_emergenze.sql:11` | `054:31` |
| `gruppo_primo_soccorso` | `041_cliente_emergenze.sql:12` | `054:32` |
| `rls_territoriale` | `028_cliente_rls_territoriale.sql:9` | `054:33` |
| `antincendio_definito_mediante` | `050_cliente_anagrafica_estesa.sql:22` | `054:34` |
| `indirizzo`/`localita`/`cap`/`provincia` | 001 + `050:20-21` | `029` + `054:26-28` |

L'analisi ne cita 4; sono **6** (dimentica `rls_territoriale` e `antincendio_definito_mediante`), più 4 campi topografici. **NON** sono duplicati: `numero_lavoratori` (`062:16`, solo cliente) e `primo_soccorso_definito_mediante` (`051:9`, solo cliente).

Chi legge / chi scrive:
- **Scrive**: solo `cliente` è sorgente. `src/lib/admin/anagrafiche.ts:102-131` fa upsert sul cliente, poi **rilegge il cliente e riversa 10 campi sulla sede principale** (`anagrafiche.ts:139-151`, write-through). L'editor sedi (`src/lib/admin/sedi.ts:9,31-39`) scrive solo nome/indirizzo/località/cap/provincia: **le 6 colonne di governance non sono editabili per-sede da nessuna UI**.
- **Legge**: il motore legge **sempre `cliente`, mai `sede`**, anche nel percorso "per sede". Prova diretta in `src/lib/admin/formazione.ts:1298-1312`, con commento esplicito: *"Gli attributi che guidano l'organigramma (rischio/ATECO/PS/antincendio/RLS) sono AZIENDALI: si leggono dal cliente (anagrafica), non dalla sede."* Idem `formazione.ts:1257-1265` e il prefetch offline `src/lib/sync.ts:308-319`.

**Correzione all'affermazione**: le copie su `sede` non sono una "doppia verità" attiva, sono **colonne morte in sola scrittura**. E il codice ha già deciso il contrario di quanto l'analisi propone: la 054 dichiarava il fatto della sede, il codice (formazione.ts:1301-1303) lo ha riportato al cliente. La proposta "il fatto appartiene alla sede" non è una constatazione ma un cambio di direzione, da riconciliare con quel commento.

**Divergenza già possibile oggi**: `src/formazione/Formazione.tsx:258` scrive `cliente.rls_territoriale` con un `update` diretto **senza write-through**; la copia `sede.rls_territoriale` resta stantìa. Innocuo finché nessuno la legge — diventa un bug latente il giorno in cui AppFormazione leggesse la sede.

## Punto 2 — "Manca updated_at per riga" — **SMENTITO come schema, CONFERMATO come comportamento**

`updated_at` **esiste** con trigger `set_updated_at()` (`001_init.sql:20-21`) su tutte le tabelle del percorso da campo:
- sopralluogo `001:110,112`; `esito_voce` `001:135-138`; `azione` `001:172,178`; `cliente` `001:35,37`
- `persona`, `nomina`, `formazione`, `esonero`, `esonero_ammesso`, `corso_catalogo`, `figura_sicurezza`: `015:227-259`
- `organigramma_conferma` `019:23,34-40`; `sede` `029:16,19`; `componente_sito` `032:19,22`; `nomina_evidenza` `053:127,156`; `adempimento`/`corso_alias` `055:102,106`

Ne sono **prive**: `foto` (`001:140-149` — solo `scattata_il`), `sopralluogo_revisione` (`012:12`), `organigramma_revisione` (`027:16`), `checklist_template_box`/`sopralluogo_box` (`031:11,23`), `voce_template`, `aggiornamento_azione` (append-only, per natura).

Ma la **conseguenza descritta è reale, e per una causa diversa**: `src/lib/sync.ts:414` fa
```ts
const row = await supabase.from(op.table).upsert(op.payload);
```
upsert cieco della riga intera, **senza alcun confronto** di versione, e il payload è l'oggetto Dexie completo (`sync.ts:90-100`, `125-163`). Peggio: i tipi TypeScript **non contengono affatto** `updated_at` (`src/lib/types.ts:185-201` `EsitoVoce`; `src/lib/admin/formazione.ts:66-85` `Persona`), quindi il client non ha nemmeno il timestamp da confrontare. Il trigger `BEFORE UPDATE` riscrive `updated_at = now()` **dopo** che la sovrascrittura è avvenuta: registra il danno, non lo previene.

**Versione corretta**: "`updated_at` c'è quasi ovunque e i trigger lo mantengono; manca la *lettura* — il drain fa last-write-wins cieco (`sync.ts:414`) e il client non porta il timestamp (`types.ts:185`)". Serve optimistic concurrency (`.eq('updated_at', visto)` + gestione conflitto), non una colonna nuova.

## Punto 3 — "Dodici colonne, fatti contro verdetti" — **IMPRECISO su entrambi i lati**

**Il numero non torna.** Nomi distinti citati: 8 (`codice_ateco`, `numero_lavoratori`, `rls_territoriale`, i due `*_definito_mediante`, `livello_rischio`, `livello_antincendio`, `gruppo_primo_soccorso`). Istanze reali di colonna: 8 su `cliente` + 6 su `sede` = **14**. La 054 aggiunge 11 colonne a `sede`. Nessun conteggio dà 12.

Elenco con migrazione d'origine: `livello_rischio` `015:36` | `rls_territoriale` `028:9` | `codice_ateco` `040:13` | `livello_antincendio` + `gruppo_primo_soccorso` `041:11-12` | `antincendio_definito_mediante` `050:22` | `primo_soccorso_definito_mediante` `051:9` | `numero_lavoratori` `062:16` | duplicati su sede `054:29-34`.

**La divisione fatti/verdetti non regge per i due `*_definito_mediante`**: non sono fatti, sono la **motivazione del verdetto**, generata insieme al verdetto. `src/admin/Anagrafiche.tsx:543-547`: il wizard DM 388/2003 restituisce `(gruppo, motivazione)` e i due campi si scrivono **nella stessa patch**; la motivazione è una stringa composta dal wizard (`Anagrafiche.tsx:1060-1070`, es. *"Codice tariffa INAIL … a indice &gt; 4, N addetti"*). Separarli manderebbe il verdetto in AppFormazione e la sua giustificazione in anagrafe: la UI segnala già l'incoerenza quando manca (`Anagrafiche.tsx:536`). Seguono il verdetto.

**Chi scrive cosa** (l'analisi non lo dice, ed è dirimente):
- `livello_rischio`: **proposto** da un motore di calcolo (`src/formazione/ateco.ts:122-128` divisione ATECO → rischio), ma **accettato a mano** (`Anagrafiche.tsx:940`) o scritto dall'**import solo se null** (`src/lib/admin/anagraficheImport.ts:357-359`). È un verdetto derivabile ma già oggi sovrascrivibile a mano: non è un puro derivato.
- `livello_antincendio`: **puro input manuale**, `&lt;select&gt;` senza alcun motore (`Anagrafiche.tsx:494-495`). Chiamarlo "verdetto derivato dalla norma" descrive il *dovrebbe*, non il codice.
- `gruppo_primo_soccorso`: wizard (verdetto) **oppure** select manuale — la UI ammette esplicitamente il caso "definito manualmente" (`Anagrafiche.tsx:536`).
- `numero_lavoratori`: fatto, manuale (`Anagrafiche.tsx:387-396`) o import (`anagraficheImport.ts:347`); consumato dallo scadenzario **sopralluoghi** (`src/lib/admin/cosedafare.ts:151-154`) oltre che dalla regola RLS 4h/8h (`062:18-19`).
- `codice_ateco`: fatto, ma vedi punto 4.

## Punto 4 — "A codice_ateco manca l'annata" — **CONFERMATO (e sottostimato)**

Nessuna colonna né convenzione per l'annata: `grep` su `supabase/migrations` e `src` per `annata|ateco_2|versione_ateco|2007|2025` non trova nulla nello schema. `codice_ateco` è `text` nudo (`040:13`, `054:29`), senza check.

Punti dove l'annata cambierebbe l'esito:
- `src/formazione/ateco.ts:1-2` — la tabella è **ancorata ad "ATECO 2007 agg. 2022"** solo da un commento; è la lookup divisione → `basso|medio|alto` (Allegato IV ASR 17/04/2025).
- `src/formazione/ateco.ts:122-128` `risolviAteco()` — prende le **prime 2 cifre** e cerca in `PER_DIVISIONE`. Con un codice ATECO 2025 la stessa divisione punta a un'attività diversa → **livello di rischio sbagliato senza alcun segnale**.
- `src/formazione/ateco.ts:138-151` `oreModuloSettore()` — divisioni hard-coded (01-02, 03, 41-43, 19-20, 86-87) che determinano le **ore del modulo di settore DL-RSPP/RSPP**; consumate in `src/lib/admin/formazione.ts:857`. Le stesse soglie sono ripetute come testo nelle migrazioni `049:79,102` e nelle guide `022:7,9`, `025:8,10` — quattro copie da riallineare.

**Problema più grave che l'analisi non vede**: la colonna non contiene il codice ATECO, contiene **la divisione a 2 cifre** quando passa dal typeahead — `src/admin/Anagrafiche.tsx:873` `onPatch({ codice_ateco: d.divisione, ... })` e `src/lib/admin/anagraficheImport.ts:356` `set('codice_ateco', ateco.divisione)`. Ma è anche **testo libero** quando digitato (`Anagrafiche.tsx:893`) o importato da WERP (`src/lib/admin/werpImport.ts:357`, codice pieno). Il campo è quindi già eterogeneo (`56` vs `56.10.20`) prima ancora di aggiungere l'annata: serve normalizzare formato **e** annata insieme.

---

## Cinque rischi non menzionati che complicano lo scorporo

1. **`azione` è la tabella-cerniera: quattro FK attraversano il confine, tutte `on delete cascade`.** `azione.origine_formazione_id → formazione` (`042:15-17`), `origine_esonero_id → esonero` (`043:15-19`), `origine_nomina_id → nomina` (`053:144`), più la chiave testuale `origine_requisito_key = persona_id||':'||corso_codice` (`056`). `azione` è lo scadenzario **unico** dei sopralluoghi: spostando `formazione`/`esonero`/`nomina` in un altro database quelle FK non sono replicabili e il cascade che oggi ripulisce le azioni orfane sparisce. Il discriminante `origine_ramo` (`052:12-16`) è già lì e ammette che i due rami convivono nella stessa tabella.

2. **`organigramma_conferma.sopralluogo_id → sopralluogo on delete cascade` (`019:15`).** La conferma dell'organigramma è **fisicamente figlia di un sopralluogo**: è formazione prodotta durante un sopralluogo. Non sta da nessuna delle due parti. Stesso problema per `organigramma_revisione.cliente_id → cliente on delete cascade` (`027:18`).

3. **`persona.sede_id → sede(id) ON DELETE CASCADE` (`054:64`).** Cancellare una sede cancella le persone e a cascata nomine/formazioni/esoneri/attestati. Oggi `src/lib/admin/sedi.ts:57-63` sposta le persone prima di cancellare — **una salvaguardia solo applicativa**. Se le sedi restano in AppSopralluoghi e le persone vanno in AppFormazione, quella salvaguardia diventa impossibile e la cascata è comunque persa: serve `on delete restrict` prima del taglio.

4. **Le RLS non isolano nulla: sono tutte `for all to authenticated using (true) with check (true)`** (`001:203-212` per cliente/sopralluogo/azione/foto…, `015:264-279` per persona/nomina/formazione/esonero, `053:151-152`, `055:91-98`). L'analisi dà per buono che "le policy di AppFormazione non cambiano di una riga": qui non c'è nessuna policy da replicare, il gating è tutto lato app. Replicare l'anagrafe verso una seconda app significa **scrivere da zero** l'isolamento che oggi non esiste.

5. **`adempimento` (`055:33-37`) referenzia contemporaneamente `cliente`, `sede` e `persona`** con tre `on delete cascade`, ed è la tabella dell'import formativo dal gestionale — un oggetto a cavallo esatto del confine. Nessuna vista lo maschera: **nel repo non esiste una sola `create view`** (grep su tutte le 62 migrazioni), quindi non c'è nessuno strato di indirezione dietro cui spostare tabelle senza rompere il client. Ogni query è `supabase.from('&lt;tabella&gt;')` diretta.</result>
<usage><subagent_tokens>91677</subagent_tokens><tool_uses>33</tool_uses><duration_ms>306736</duration_ms></usage>
</task-notification>



---

Verifica a campione superata: la guardia `if (voci.length)` è esattamente a `src/lib/compilazione.ts:121`, `cognome` non compare in nessuna migrazione di `tecnico` (solo su `persona`), e il commit `e29107c` — che nel messaggio dice "migration 010" — tocca cinque file `src/` e **zero** migrazioni. L'agente cita il vero.

È rientrato anche il secondo. Il terzo (numeri e prerequisiti) sta ancora girando.

## I quattro difetti reggono tutti — ma tre descrizioni vanno corrette

**Cache voci**: l'effetto è reale e blocca in campo, la causa scritta nel TODO no. Non è vero che "le voci dei box non sono in cache": ci sono, in IndexedDB (`src/lib/box.ts:38-43`). Il difetto è solo la guardia su un insieme legittimamente vuoto. È una riga da cambiare, non un pezzo di cache da costruire.

**Report**: peggio del previsto. Per un template composto `vociById` resta vuota, quindi `etichettaValore` stampa la **chiave grezza** invece dell'etichetta (`report-data.ts:63-73`). Non "appiattito": illeggibile, su un documento che va al cliente.

**`runSync`**: confermato, e non c'è nemmeno un backoff — si ritenta a ogni tocco, sempre dalla testa della coda. Aggravante trovata: `enqueueRow` non compatta mai, quindi la coda bloccata cresce senza limite. E il ramo foto cancella l'operazione anche quando il blob non c'è più: **la foto sparisce dal report senza errore**.

**`tecnico.cognome`**: che l'app funzioni implica che la colonna sia stata aggiunta a mano in produzione. Il difetto provato è la non riproducibilità: su un ambiente ricreato dalle migrazioni il login è rotto per tutti, e con un messaggio che dice "sei offline" mentre sei online.

## Due affermazioni del TODO sono sbagliate, e una cambia il piano

**`updated_at` c'è già**, con trigger, su quasi tutto il percorso da campo (`001_init.sql:20-21`). Il TODO diceva che manca. Il comportamento denunciato però è reale, per un'altra causa: `sync.ts:414` fa un upsert cieco della riga intera e i tipi TypeScript non contengono nemmeno `updated_at`, quindi il client non ha il timestamp da confrontare. Il trigger registra il danno invece di prevenirlo. Serve concorrenza ottimistica, non una colonna nuova.

**La "doppia verità" non è attiva.** Le colonne duplicate su `sede` sono **morte, in sola scrittura**: nessuna UI le rende editabili per-sede, e il motore legge sempre `cliente`, anche nel percorso "per sede" — con un commento esplicito in `src/lib/admin/formazione.ts:1298-1312` che dice che quegli attributi *sono aziendali*. Quindi la riga del TODO "il fatto appartiene alla sede" non è una constatazione: è un **cambio di direzione** rispetto a una decisione già presa nel codice. Va deciso, non dato per assodato. (Le colonne duplicate sono poi 6, non 4: mancano `rls_territoriale` e `antincendio_definito_mediante`.)

Anche "dodici colonne" non torna con nessun conteggio: 8 nomi distinti, 14 istanze. E la divisione fatti/verdetti non regge per i due `*_definito_mediante`, che sono la *motivazione* del verdetto, scritta nella stessa patch dal wizard DM 388: separarli manderebbe il verdetto di là e la sua giustificazione di qua. Da notare anche che `livello_antincendio` è **puro input manuale**, senza alcun motore: chiamarlo "derivato dalla norma" descrive il dovrebbe, non il codice.

## Il rischio serio che l'analisi non aveva visto

Non è nelle colonne, è nelle chiavi esterne. **`azione` è la tabella-cerniera**: quattro FK con `on delete cascade` attraversano il confine (`origine_formazione_id`, `origine_esonero_id`, `origine_nomina_id`, più una chiave testuale). `azione` è lo scadenzario unico dei sopralluoghi: spostando formazione in un altro database quelle FK non sono replicabili e il cascade sparisce.

Peggio: **`persona.sede_id` è `on delete cascade`** (`054:64`), e l'unica salvaguardia è applicativa (`sedi.ts:57-63` sposta le persone prima). Se le sedi restano qui e le persone vanno di là, quella salvaguardia diventa impossibile.

E il presupposto "le policy di AppFormazione non cambiano di una riga" è fragile da questo lato: **le RLS qui sono tutte `using (true) with check (true)`**. Non c'è isolamento da replicare — andrebbe scritto da zero. Non esiste inoltre una sola `create view` in 62 migrazioni: nessuno strato dietro cui spostare tabelle senza rompere il client.

Aspetto il terzo e poi ti do la sintesi con le contraddizioni fra i tre. Nel frattempo: vuoi che aggiorni il TODO con le correzioni già provate, o preferisci leggere tutto prima di toccarlo?



---

❯ ricapitoliamo. Ora abbiamo 2 gestionali: 1 gestisce le funzioni di preventivazione, gestione ordini spot e continuativi, assegnazione incarichi, fatturazione; 2 gestisce la parte di scadenzario ambiente e sicurezza e gestione corsi in aula e non. Ognuno ha una propria gestione delle anagrafiche perchè non si parlano. Tieni conto che per questioni normative la gestione dei corsi è ora fatta anche con un software cloud della ns associazione di riferimento ASSIDAL. Questo è il panorama attuale che vorrei razionalizzare, uniformare ma collegare per il tramite di 1 o + app. Quando ti parlavo di import scadenze era per poter travasare da 2 le info che già abbiamo dei clienti e loro risorse. in questo marasma avevo cominciato a sviluppare questa app a cui avevo aggiunto C:\Users\Francesco\Documents\GitHub\AppFormazione



---

Questo cambia la domanda. Fermo un attimo lo scorporo e guardo il panorama vero — e intanto passo al terzo agente il percorso di AppFormazione, che finora gli mancava per verificare la chiave cliente.



---

<task-notification>
<task-id>a119419e05080e557</task-id>
<tool-use-id>toolu_01SHCj5gzQ7PtovqFd6YA5eU</tool-use-id>
<output-file>C:\Users\FRANCE~1\AppData\Local\Temp\claude\C--Users-Francesco-Documents-GitHub-AppSopralluoghi\cbaa2161-ec64-4a00-8cd6-cfbea5e522a1\tasks\a119419e05080e557.output</output-file>
<status>completed</status>
<summary>Agent "Verifica numeri, date e prerequisiti" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>## NUMERI RICALCOLATI (commit `f398cf4`, 2026-08-26)

**Nota preliminare:** il brief dice Next.js. Non è vero: è **Vite + React 18 SPA** (`package.json`, `vite.config.ts`, `index.html`). Nessun `app/`, nessun `pages/`.

### Ripartizione righe

Denominatore ricalcolato: `git ls-tree -r --name-only f398cf4 | grep '^src/'` + `wc -l` = **24.576 righe**. I quattro numeri dichiarati (8.876 + 9.410 + 4.409 + 1.881) fanno **esattamente 24.576**: il conteggio è su `src/` soltanto — niente SQL, niente Edge Functions, niente `docs/`/`mockups/`/`scripts/`, e ovviamente né `node_modules` né `dist` (assente da git) né lock file.

| voce | dichiarato | ricalcolato | esito |
|---|---|---|---|
| formazione | 8.876 (36%) | **8.876 (36,1%)** | riprodotto esattamente |
| piattaforma | 1.881 | **1.881 (7,7%)** | riprodotto esattamente |
| "sopralluogo puro" | 9.410 (38%) | **4.741 (19,3%)** | gonfiato ~2× |
| back-office | 4.409 | **7.113 (28,9%)** | sottostimato |

**Criterio esplicito, file per file.** Formazione = `src/formazione/*` (4.873) + `src/lib/admin/formazione.ts` (2.008) + `formazioneImport.ts` (664) + `src/admin/ImportFormazione.tsx` (412) + `src/admin/AliasCorsi.tsx` (323) + `src/lib/admin/aliasCorsi.ts` (181) + `src/lib/admin/libretto.ts` (283) + `src/admin/ImportCatalogo.tsx` (53) + `src/lib/admin/catalogoImport.ts` (79) = 8.876. Ho ricostruito lo stesso criterio dell'analisi (torna alla riga), quindi **8.876 è verificato e non contestabile**.

Piattaforma = App/Login/AuthProvider/ImpostaPassword/CambiaPassword/main/vite-env + `lib/{supabase,auth,authFlow,db,types,prefetch,onboarding,notifiche}.ts` + `admin/ui.ts` = 1.881. Anche questo torna alla riga.

**Qui si rompe.** Il percorso da campo vero (`Compilazione`, `MieiSopralluoghi`, `MieCoseDaFare`, `vociRender`, `BoxGenerico`, `NotaVocale`, `BottoneInviaCliente` + `lib/{sync,compilazione,azioni,box,useCompilazioneVoci,revisioni,sopralluoghi,report}`) è **4.741 righe**. Aggiungendo l'authoring template/capitoli lato admin (`TemplateEditor`, `CapitoloEditor`, `ComponiTemplate`, `TemplateList`, `CapitoliList` + `lib/admin/{templates,capitoli,composizione}`, 1.965) si arriva a **6.706 = 27,3%**. Per fare 9.410 bisogna far rientrare sotto "sopralluogo" ~2.700 righe di back-office puro (Pianificazione, Scadenzario, CoseDaFare, Disponibilità, EditorIncarico, calendario, aree/sedi). È esattamente la cartella ambigua che sposta la conclusione.

Ripartizione mia (somma 24.576):
```
FORMAZIONE           8.876  36,1%
BACK-OFFICE          7.113  28,9%
CAMPO (percorso)     4.741  19,3%
AUTHORING TEMPLATE   1.965   8,0%
PIATTAFORMA          1.881   7,7%
```

**Verdetto:** "la formazione è un terzo dell'app" **REGGE** ed è anzi conservativo. Escludendo SQL/Edge Functions/script (7.683 righe scartate) si è tolto materiale **per metà formativo** (3.879 righe su 7.683 = 50,5%, per nome file: organigramma, corso, alias, attestati, libretto, allegato III, dl_rspp…): includendoli la formazione andrebbe a **12.755/32.259 = 39,5%**. Non conta poi `src/formazione/belfiore.json`, 241 KB su una riga sola.
**Ma "sopralluogo puro 38%" è gonfiato:** la formazione non è alla pari col sopralluogo, è **quasi il doppio del percorso da campo** (8.876 vs 4.741).

### Date e sforzo recente

- **Ultimo commit su file del percorso da campo: 7a2b350, 14.07.2026** — la data dichiarata è giusta ma il commit **non è sostanziale**: è il refactor di tema (`mockups/mockup-tema-carta-ambra.html` +347, 21 file toccati, `Compilazione.tsx` +7/-6, `MieiSopralluoghi.tsx` +17/-17). L'ultima modifica **sostanziale** al campo è del **22-24 giugno 2026** (`c5f3941`, `eb0690b`; su `lib/sync.ts` il 07.07 con `da02222`). La stasi è quindi **più lunga** di quella dichiarata.
- **"Due terzi dello sforzo recente fuori dai sopralluoghi": SOTTOSTIMATO.**

| finestra | commit totali | campo | formazione |
|---|---|---|---|
| ultimi 3 mesi (dal 27.05) | 290 | 53 (18%) | 104 (36%) |
| ultimi 2 mesi (dal 27.06) | 133 | **4 (3%)** | 82 (62%) |
| ultimo mese (dal 27.07) | 64 | **0** | 37 (58%) |

Churn (righe add+del su `src/`): dal 01.06 → formazione 14.828, admin-altro 14.312, campo+piattaforma 10.937 (72% fuori dai sopralluoghi). **Dal 15.07 → formazione 4.343, admin 2.855, campo+piattaforma 58** — e quei 58 sono `+5` su `lib/types.ts` più commit di formazione/anagrafiche. Sulle ultime sei settimane non è due terzi: è **il 100%**.

---

## PREREQUISITI

### 1. Router con URL — **CONFERMATO** (e più grave del dichiarato)

Nessuna dipendenza di routing in `package.json` (né `react-router`, né `next`, né `wouter`, né `@tanstack/router`). `window.location`/`history` compaiono **solo** per l'hash di auth: `src/lib/authFlow.ts:15-17,32-36` e `src/Login.tsx:47` (`redirectTo`). Zero `pushState`.

Non è una schermata: è **tutta l'app, 5 livelli di stato annidato**.
- `src/App.tsx:139` `Pronto` → `useState&lt;'auto'|'campo'&gt;` → `src/App.tsx:87` `Home` → `tab` + `aperto` → `src/Compilazione.tsx:112,125` `fase` + `sheet`
- `src/App.tsx:143` → `src/admin/BackOffice.tsx:92-93` `gruppoKey` + `sezione` (15 sezioni, riga 33-37) → `src/admin/Anagrafiche.tsx:26` `apri` → `src/admin/Anagrafiche.tsx:205` `sezioneAttiva`, `:201` `wizardPS`

Il tasto "indietro" del browser esce dall'app da qualunque punto.

### 2. Chiave cliente condivisa — **IMPRECISO** (sostanza sì, numeri no)

**Sostanza CONFERMATA, lato questa app.** La chiave è P.IVA + sede:
- `src/lib/admin/formazioneImport.ts:67` — `chiave: string; // partita_iva + '|' + sede`
- `src/lib/admin/formazioneImport.ts:242` — `const k = r.partita_iva + '|' + r.sede;`
- `src/lib/admin/anagraficheImport.ts:483` — `` const chiave = `${piva ?? normNome(soc)}|${normNome(sede ?? '')}`; ``

La ragione sociale normalizzata (`normNome`, `anagraficheImport.ts:61-63`) è solo **fallback** quando manca la P.IVA. Il modello è dichiarato a `anagraficheImport.ts:30-33`: *"UNA RIGA = UN CLIENTE, anche a parità di P.IVA … `cliente.partita_iva` non ha vincolo di unicità apposta."* Verificato: **nessun UNIQUE su `cliente.partita_iva`** in nessuna migrazione (l'unico correlato è `uq_sede_principale`, `054_sede_prima_classe_fase1.sql:51`).

**Numeri: ricalcolati sui file veri**, che sono in `~/Downloads` (dry-run read-only con `xlsx` e la stessa `normNome` del codice):

| affermazione | ricalcolo | esito |
|---|---|---|
| 618 | `ElencoSedi (5).xlsx`: 847 righe, **618 con ATTIVA='Sì'** | riprodotto — **ma non è una chiave**: P.IVA\|Sede distinte sulle attive = **584**, P.IVA distinte = **562** |
| 449 | `ExportExcelDipendenti.xlsx`: 3.418 righe, **449 unità (P.IVA\|Sede) distinte** | riprodotto esattamente |
| 480 "per ragione sociale normalizzata" | ragione sociale normalizzata distinta: **607** (attive), **819** (tutte), **477** (dipendenti). Nessuna fa 480 | **SMENTITO** |

Il 480 esiste, ma con un significato **diverso**, in `docs/TODO.md:219`: *"n° dipendenti 100% (480 con &gt;0, 138 a zero)"*. Ho ricontato: attive con `N° DIPENDENTI &gt; 0` = **480**, a zero = **138**, somma 618. Il "480" del prerequisito (`docs/TODO.md:120`) è preso dalla riga sbagliata dello stesso documento.

In più, **618 e 449 vengono da due file diversi**, non dallo "stesso export importato con chiavi diverse". Lato AppFormazione: **non verificabile da qui** (codice assente; nel repo "Sicurweb" compare solo in `docs/TODO.md`, mai nel codice).

### 3. SSO — **CONFERMATO** per la parte verificabile, con una precisazione

- Supabase Auth email/password: `src/lib/auth.ts:33` `signInWithPassword`; `src/lib/supabase.ts:13-19` `createClient(..., { auth: { persistSession: true } })` → sessione in localStorage, **per origine**.
- Tabella ruoli custom **indipendente da `auth.users`**: tabella `tecnico`, ponte `tecnico.user_id` (`src/lib/auth.ts:25-27,68-72`, "user_id è UNIQUE"). Ruolo in `tecnico.ruolo`, `check (ruolo in ('tecnico','admin','interno'))` — `supabase/migrations/006_ruolo_backoffice.sql:17-21`, `011_ruolo_interno.sql:14-16`. Gate applicativo a `src/App.tsx:93` (interno) e `:141` (admin); RLS è una sola policy `staff_full` per autenticati, gating **solo lato app** (`011:8-10`, `015_formazione_organigramma.sql:10`).
- **Precisazione:** "due Auth Supabase distinte" non è verificabile da qui (dipende da `VITE_SUPABASE_URL` dell'altra app, che è un env var). E comunque, **anche col medesimo progetto Supabase**, due app su origini diverse hanno localStorage separati → il secondo login ci sarebbe lo stesso. La conclusione operativa regge; la motivazione data ne cattura solo metà.

---

**La giustificazione quantitativa dello scorporo regge in parte: la tesi centrale ("la formazione è un terzo dell'app", 36,1%, riproducibile alla riga, e anzi ~39,5% includendo l'SQL) è solida, ma il confronto che la incornicia è gonfiato — il "sopralluogo puro 38%" è in realtà il 19,3%, quindi la formazione è il doppio del percorso da campo, non alla pari — mentre il "480" è un numero sbagliato preso da un'altra riga del TODO e i "due terzi dello sforzo recente" sono, se mai, prudenti (100% negli ultimi due mesi).**</result>
<usage><subagent_tokens>78837</subagent_tokens><tool_uses>33</tool_uses><duration_ms>675994</duration_ms></usage>
</task-notification>



---

Terzo agente rientrato, e l'ho rimesso al lavoro sulla chiave cliente ora che ha il codice di AppFormazione. Intanto ecco il quadro, riletto alla luce di quello che mi hai appena detto.

## I numeri: la tesi regge, la cornice no

`8.876` righe di formazione sono **riprodotte alla riga** (36,1% di `src/`, e ~39,5% includendo l'SQL). Ma il confronto che le incornicia era sbagliato: "sopralluogo puro 38%" in realtà è **19,3%** — per arrivare a 9.410 bisognava contare come sopralluogo ~2.700 righe di back-office puro (pianificazione, scadenzario, disponibilità, fatturazione incarichi). Quindi la formazione non è *alla pari* col percorso da campo: è **il doppio**.

Sulle date, se mai il TODO era prudente: negli ultimi due mesi i commit sul campo sono **4 su 133**; nell'ultimo mese **zero**. Dal 15 luglio il churn sul percorso da campo è 58 righe contro 4.343 di formazione. Non due terzi: il 100%.

Una correzione secca: il "480" del prerequisito è un numero preso dalla riga sbagliata dello stesso TODO — là dove diceva "480 clienti con dipendenti > 0, 138 a zero". Nessun conteggio per ragione sociale dà 480. E 618 e 449 vengono da **due file diversi**, non dallo stesso export letto con due chiavi.

## Il panorama, come risulta dal codice

Ho cercato i tre sistemi esterni nei due repo:

| | dov'è | stato |
|---|---|---|
| **WERP** (gestionale 1) | `werpImport.ts`, pipeline a 7 stadi, dry-run | import funzionante; campi `incarico.werp_id`, `azione.werp_attivita_id` predisposti ma **nessuna sincronizzazione attiva** |
| **Sicurweb** (gestionale 2) | import anagrafiche + formazione da Excel | funzionante, provato sui file veri |
| **ASSIDAL** | **mai citato**, in nessuno dei due repo | zero codice, zero schema, zero documentazione |

E qui c'è la cosa che sposta il ragionamento: **AppSopralluoghi è già oggi l'unico punto in cui i due gestionali convergono.** Nessuno dei due importa dall'altro; questa app importa da entrambi. Il ruolo di anagrafe unica non è una cosa da costruire, è una cosa che è già successa per caso e non è mai stata dichiarata.

## AppFormazione non è ancora una destinazione

Contenuto reale: **8.325 righe di SQL** (53 migrazioni), **23.856 di markdown** (di cui un corpus normativo serio: ASR 2025, allegato IV, allegato XXI, raccordo ATECO), e **597 righe di TSX**. Il README dice ancora *"Fase di progettazione. Nessun codice applicativo ancora."*

Quindi "spostare la formazione in AppFormazione" non è uno scorporo: è **riscrivere 8.876 righe funzionanti** dentro uno schema che di applicazione non ne ha. Va detto chiaro prima di deciderlo.

Però il rovescio è altrettanto vero, ed è la scoperta più utile della serata: **AppFormazione ha già risolto il problema che qui è aperto**. Il TODO di AppSopralluoghi elenca "manca l'annata ATECO" tra le cose da fare; AppFormazione ha `0047_raccordo_ateco_2025.sql` e `0049_la_scheda_chiede_l_annata.sql`. Qui `src/formazione/ateco.ts` è ATECO 2007 inchiodato in un commento, che con un codice 2025 dà **il livello di rischio sbagliato senza alcun segnale**. Il modello normativo giusto sta di là; il codice che funziona sta di qua.

## Le tre domande che cambiano il lavoro

Prima di rimettere mano al TODO mi servono risposte che dal codice non si ricavano — e la prima soprattutto, perché ASSIDAL non esiste da nessuna parte nei repo ma per te è già in produzione per obbligo normativo.



---

<task-notification>
<task-id>a119419e05080e557</task-id>
<tool-use-id>toolu_01GDVTUZtskP4JQX4mnkMWZR</tool-use-id>
<output-file>C:\Users\FRANCE~1\AppData\Local\Temp\claude\C--Users-Francesco-Documents-GitHub-AppSopralluoghi\cbaa2161-ec64-4a00-8cd6-cfbea5e522a1\tasks\a119419e05080e557.output</output-file>
<status>completed</status>
<summary>Agent "Verifica numeri, date e prerequisiti" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Ho ricalcolato tutto con il codice della seconda app. **Devo correggere il mio verdetto sul punto 2: il 480 è riproducibile, e l'avevo dichiarato smentito a torto.** Ecco il rapporto aggiornato.

## CORREZIONE AL PUNTO 2 — Chiave cliente

### Il 480 è riproducibile. Esattamente.

Il mio errore precedente era doppio: avevo usato la normalizzazione di *AppSopralluoghi* e un solo file. La normalizzazione di AppFormazione è diversa e il perimetro è più largo.

`supabase/migrations/0011_rifiniture_sicurezza.sql:71-76`, riscritta in `0020_norm_senza_spazi_ai_bordi.sql:21-26`:
```sql
create or replace function staging.norm(t text) returns text ... as $$
  select nullif(btrim(upper(regexp_replace(regexp_replace(coalesce(t,''),'[^a-zA-Z0-9]',' ','g'),'\s+',' ','g'))),'');
$$;
```
Sostituisce **ogni** non-alfanumerico con spazio (AppSopralluoghi collassa solo gli spazi e toglie i punti finali — `anagraficheImport.ts:61-63`). E `scripts/promuovi.sql:29-38` legge `staging.righe_import` **senza filtrare `entita`**: l'unione di tutti e 7 gli export caricabili (`scripts/carica_staging.py:40-48`).

Rieseguito con quella semantica esatta sui file veri in `~/Downloads`:

| file | righe | `Società` norm. distinte |
|---|---|---|
| ExportExcelDipendenti | 3.418 | 477 |
| ExportExcelCorsiFatti | 13.350 | 438 |
| ExportExcelCorsiScadenze | 4.899 | 421 |
| ExportExcelVisiteFatte | 1.341 | 65 |
| ExportExcelVisiteScadenze | 814 | 62 |
| ExportExcelFormFrazCompletata | 515 | 18 |
| ExportExcelFormFrazInCorso | 409 | 53 |
| **UNIONE (= `promuovi.sql` passo 1)** | | **480 normalizzate, 480 grezze** |

Combacia alla lettera col commento in `supabase/migrations/0009_mappa_clienti.sql:4-8`: *"480 valori grezzi, 480 normalizzati, nessuna variante di scrittura"*. Ho verificato anche l'altra metà di quel commento: `Codice Società` distinti non vuoti = **32** ("32-33 valori distinti"). Stesso file, stesso conto.

La coincidenza col "480 con &gt;0 dipendenti" di `TODO.md:219` che avevo segnalato come errore **non è un errore**: è strutturale. AppFormazione crea clienti solo da export che elencano *persone e corsi*, quindi un cliente senza dipendenti non compare mai. Le due liste sono quasi la stessa (intersezione 477 su 478), ma non identiche — due numeri diversi che si somigliano per un motivo reale.

### Le chiavi divergono davvero, e non di poco

| | AppSopralluoghi | AppFormazione |
|---|---|---|
| chiave cliente | **P.IVA + sede** | **ragione sociale normalizzata** |
| prova | `src/lib/admin/formazioneImport.ts:67` `// partita_iva + '|' + sede`, `:242`; `src/lib/admin/anagraficheImport.ts:483` | `supabase/migrations/0009_mappa_clienti.sql:14` `chiave text primary key, -- ragione sociale normalizzata`; `scripts/promuovi.sql:31` `staging.norm(dati-&gt;&gt;'Società') as chiave` |
| grana | **una riga = un cliente, anche a parità di P.IVA** — `anagraficheImport.ts:30-33` | una ragione sociale = un cliente |
| P.IVA | letta, `UNIQUE` **assente** (dichiarato: `anagraficheImport.ts:33`; verificato: nessun unique su `cliente.partita_iva` nelle 62 migrazioni) | letta e salvata (`promuovi.sql:33,47`), ma `UNIQUE` **assente** (`0001_init.sql:28-40`) e mai usata come chiave |
| sede | prima classe (`054_sede_prima_classe_fase1.sql:51` `uq_sede_principale`) | tabella `sedi` esiste (`0001_init.sql:42-49`) ma **`promuovi.sql` non la popola mai** — grep `sed[ei]` su promuovi.sql: zero risultati. `rapporti_lavoro` viene inserito **senza `sede_id`** (`promuovi.sql:111-120`) |
| file sorgente clienti | `ElencoSedi (5).xlsx` (618 attive) | **rifiuta `ElencoSedi`**: non è in `ENTITA` (`carica_staging.py:40-48`) → `SystemExit "file non riconosciuto"` (`:115-118`) |

Quindi la frase *"le due app importano lo stesso export Sicurweb con chiavi diverse"* è **imprecisa nella premessa**: si sovrappongono solo su `ExportExcelDipendenti`; l'universo clienti di AppSopralluoghi viene da un file che AppFormazione **rigetta per costruzione**. E l'accostamento "618/449" mette insieme due numeri di due file diversi (618 = righe attive di ElencoSedi; 449 = unità P.IVA|Sede in ExportExcelDipendenti), non due letture della stessa chiave.

### Quanto costa davvero riconciliare (il dato che mancava)

Ho misurato la collisione reale, non quella teorica:

- **Universi:** i 480 di AppFormazione sono un **sottoinsieme stretto** dei clienti attivi di ElencoSedi — intersezione 480 su 480, **zero orfani**. In compenso **127 clienti attivi** (607 ragioni sociali normalizzate distinte su 618 righe) AppFormazione non li conosce affatto.
- **Collisione di grana:** delle 449 unità (P.IVA|Sede) del file dipendenti, quelle che AppFormazione fonde in un solo cliente sono **1 sola** — `ECODENT S R L`, 2 unità. Nel senso opposto, 2 unità risultano legate a più ragioni sociali.

È esattamente il caso citato in `anagraficheImport.ts:30-33` ("deciso 2026-07-31 sul caso Ecodent"). La divergenza è **strutturale e reale**, ma sui dati di oggi il danno è **1 cliente**, non decine. L'affermazione *"è l'unica cosa che, sbagliata adesso, non si ripara dopo"* è quindi **sovradimensionata**: il disallineamento pesante è il gap 480↔607, che è additivo e recuperabile, non un merge distruttivo.

**Verdetto punto 2: CONFERMATO nella sostanza e nei numeri** (480, 618, 449 tutti riprodotti), **IMPRECISO nella formulazione** ("stesso export" è falso; 618/449 non sono la stessa chiave letta due volte) **e sovradimensionato nella gravità** (1 collisione reale).

### Bonus sul punto 3, ora verificabile — **CONFERMATO su entrambi i lati**

Due tabelle di ruoli davvero indipendenti, con vocabolari **disgiunti**:
- AppSopralluoghi: `tecnico.ruolo`, `check (ruolo in ('tecnico','admin','interno'))` — `006_ruolo_backoffice.sql:17-21`, `011_ruolo_interno.sql:14-16`. Gate **solo lato app** (`App.tsx:93,141`), RLS = policy unica `staff_full` (`011:8-10`).
- AppFormazione: `create type ruolo_operatore as enum ('formazione','amministrazione','lettore')`, tabella `operatori` — `0010_operatori_e_policy.sql:10-18`. Gate **in RLS**, con `e_operatore_scrittura()` nelle policy (`:40,48,80-82`).

Entrambe leggono il proprio `VITE_SUPABASE_URL` (`src/lib/supabase.ts:4` / `app/src/supabase.ts:3`). Aggiungo una cosa che il prerequisito non dice: **l'SSO da solo non basterebbe**, perché i due modelli di autorizzazione sono diversi (gate applicativo contro gate RLS) e i ruoli non hanno un solo valore in comune.

---

## Il resto del compito, invariato

**Righe (`src/` a `f398cf4` = 24.576; i 4 numeri dichiarati sommano esattamente a questo):**

| voce | dichiarato | ricalcolato | esito |
|---|---|---|---|
| formazione | 8.876 (36%) | **8.876 (36,1%)** | riprodotto alla riga |
| piattaforma | 1.881 | **1.881 (7,7%)** | riprodotto alla riga |
| "sopralluogo puro" | 9.410 (38%) | **4.741 (19,3%)** | **gonfiato ~2×** |
| back-office | 4.409 | **7.113 (28,9%)** | sottostimato |

La formazione è **quasi il doppio** del percorso da campo, non alla pari. Escludere l'SQL è stato conservativo: delle 7.683 righe scartate, il 50,5% è formazione → includendole si va a **39,5%**.

**Date:** ultimo commit sul campo `7a2b350` del 14.07, ma è il refactor di tema (21 file, `Compilazione.tsx` +7/-6). L'ultima modifica **sostanziale** è del **22-24 giugno**. "Due terzi dello sforzo recente" è **sottostimato**: dal 27.06 il campo è 4 commit su 133; dal 27.07 è **0 su 64**; churn dal 15.07 → formazione 4.343, admin 2.855, campo 58.

**Router — CONFERMATO** (e non è Next.js: è Vite+React, nessun `react-router`/`next`/`wouter` in `package.json`). 5 livelli di stato annidato, zero URL: `App.tsx:139` → `App.tsx:87` → `Compilazione.tsx:112,125`, e `App.tsx:143` → `BackOffice.tsx:92-93` → `Anagrafiche.tsx:26` → `Anagrafiche.tsx:205`. `window.location` solo per l'hash di auth (`lib/authFlow.ts:15-36`).

---

**La giustificazione quantitativa dello scorporo regge in parte, e regge meglio di quanto pensassi un'ora fa: la tesi centrale (formazione = 36,1%, riproducibile alla riga; ~39,5% con l'SQL) è solida, i tre numeri della chiave cliente — 480, 618, 449 — sono ora tutti riprodotti dai file veri, e i "due terzi dello sforzo recente" sono semmai prudenti (100% negli ultimi due mesi). Resta gonfiato un numero solo, ma è quello che incornicia la tesi: il "sopralluogo puro 38%" è in realtà il 19,3%; e resta sovradimensionata la gravità della chiave cliente, che sui dati di oggi vale 1 collisione reale (Ecodent) più un gap additivo di 127 clienti, non una riconciliazione irreversibile.**</result>
<usage><subagent_tokens>109100</subagent_tokens><tool_uses>18</tool_uses><duration_ms>263979</duration_ms></usage>
</task-notification>



---

Il terzo agente si è corretto da solo, e la correzione conta: **il 480 è riproducibile**. Aveva usato la normalizzazione sbagliata. Con quella vera di AppFormazione (`staging.norm`, che sostituisce ogni non-alfanumerico) applicata all'unione dei 7 export Sicurweb, vengono esattamente 480 ragioni sociali distinte — combacia con il commento in `0009_mappa_clienti.sql`. Quindi 480, 618 e 449 sono ora tutti e tre riprodotti dai file veri.

Ma il quadro che ne esce è **diverso** da come lo raccontava il TODO, e più utile.

## Le due app non litigano sulla stessa chiave: guardano due mondi diversi

| | AppSopralluoghi | AppFormazione |
|---|---|---|
| chiave cliente | **P.IVA + sede** | **ragione sociale normalizzata** |
| file sorgente | `ElencoSedi` (618 attive) | **rifiuta `ElencoSedi`** per costruzione — non è tra le entità riconosciute |
| sedi | prima classe | tabella `sedi` esiste ma **non viene mai popolata**; `rapporti_lavoro` inserito senza `sede_id` |
| clienti conosciuti | 607 | 480 — sottoinsieme stretto, **zero orfani** |

La collisione vera, sui dati di oggi, è **un cliente solo** (Ecodent). Quindi "l'unica cosa che se sbagliata adesso non si ripara dopo" era sovradimensionata: il vero divario è il gap 480↔607, che è **additivo e recuperabile**.

Il punto serio è un altro: AppFormazione **non sa cosa sia una sede**. Da P.IVA+sede a ragione sociale ci si va; al contrario no. La direzione della riconciliazione è quindi obbligata, e non è simmetrica.

## Cosa cambiano le tue tre risposte

**ASSIDAL è un tetto, non un modulo.** Se gli attestati ASR validi li emette assidok, allora nessuna nostra app può essere la fonte di verità degli attestati per quei corsi. AppFormazione può pianificare, calcolare scadenze e tenere il libretto — ma il libretto di una persona diventa il **montaggio di tre fonti**: storico Sicurweb, ASSIDAL per gli ASR, e nostro per il resto. Questo va nel modello dati adesso, non dopo: serve sapere per ogni riga formativa da dove viene e chi la certifica. Oggi quella colonna non esiste in nessuno dei due repo — e ASSIDAL non è citato nemmeno una volta.

**Solo Excel, ovunque.** Niente API su nessuno dei tre sistemi. Questo chiude una porta e ne apre un'altra: "collegare le app ai gestionali" non è integrazione, è **import periodico con riconciliazione**, per sempre. Il che significa che il disallineamento non si elimina, si governa — e che gli import devono essere ripetibili e dry-run, come già è `werpImport` a 7 stadi. È il pattern giusto, ed è già in casa.

**Sicurweb muore per primo.** È la risposta che rende urgente tutto il resto: le sue due funzioni devono atterrare da qualche parte prima che si spenga. Lo scadenzario ambiente/sicurezza atterra qui, dove `azione` esiste già. I corsi atterrano in AppFormazione, che però **applicazione non ne ha** (597 righe di TSX, README: *"Fase di progettazione"*), mentre le 8.876 righe di formazione funzionanti stanno qui.

## La conseguenza, che ribalta l'ordine del TODO

Lo scorporo, come era scritto, metteva prima il taglio del codice. Con Sicurweb che se ne va e solo Excel a disposizione, l'ordine giusto è l'inverso:

**Prima l'anagrafe unica, e sta qui.** Non per affetto: perché è l'unica delle due che legge il file dei clienti e delle sedi, l'unica che ha `sede` come entità, e l'unica in cui i due gestionali già convergono (`werpImport` + import Sicurweb). AppFormazione va riportata su quella chiave prima di riceverne una riga.

**Poi il modello normativo, e sta di là.** Qui `src/formazione/ateco.ts` è ATECO 2007 fissato in un commento, e con un codice 2025 restituisce **il livello di rischio sbagliato senza segnale**. AppFormazione ha già `0047_raccordo_ateco_2025` e `0049_la_scheda_chiede_l_annata`. Il codice che funziona è qui, il modello giusto è là: è questo lo scambio da fare, non un travaso in blocco.

E una cosa che nessuno dei due prerequisiti diceva: **l'SSO da solo non basterebbe.** I due vocabolari di ruoli sono disgiunti — qui `tecnico/admin/interno` con gate applicativo, là `formazione/amministrazione/lettore` con gate in RLS. Non hanno un valore in comune.

Metto in memoria le due cose che dal codice non si ricavano — il ruolo di ASSIDAL e il fatto che l'integrazione è solo Excel.



---

Memoria aggiornata con le tre cose che dal codice non si ricavano: ASSIDAL, l'integrazione solo-Excel, e la direzione obbligata dell'anagrafe.

## Dove siamo, in una riga

La verifica ha retto sulla sostanza — la formazione è davvero un terzo dell'app, i quattro difetti del campo esistono tutti — ma il TODO di ieri sera va corretto in quattro punti provati: `updated_at` **c'è già** (il problema è l'upsert cieco in `sync.ts:414`), la doppia verità cliente/sede sono **colonne morte** e non un conflitto attivo, "sopralluogo puro 38%" è **19,3%**, e la gravità della chiave cliente è **un cliente**, non una riconciliazione irreversibile.

E soprattutto: il tuo panorama ribalta l'ordine. Il TODO metteva prima il taglio del codice; con Sicurweb che deve sparire e solo Excel in mano, prima viene **l'anagrafe unica**, e sta qui.

## Cosa proporrei di fare adesso

Riscrivere la sezione `0-bis` del TODO con quanto è stato provato: le correzioni qui sopra, l'ordine invertito (anagrafe → modello normativo → taglio), il vincolo ASSIDAL sul libretto a tre fonti, e le cinque cose che l'analisi non aveva visto — su tutte le quattro FK `on delete cascade` che attraversano il confine su `azione`, e `persona.sede_id` la cui unica salvaguardia oggi è applicativa.

Due cose però le lascio a te, perché sono decisioni tue e non conclusioni tecniche:

1. **"Il fatto appartiene alla sede"** non è una constatazione: il codice ha già deciso il contrario, con un commento esplicito in `formazione.ts:1301` che dice che rischio/ATECO/antincendio sono *aziendali*. Confermi il cambio di direzione o si tiene quella scelta?
2. **AppFormazione riscritta o modello importato?** Là ci sono 53 migrazioni e un corpus normativo serio ma quasi zero applicazione; qui 8.876 righe che funzionano. Spostarle non è uno scorporo, è una riscrittura.

Dimmi se procedo con il TODO, o se preferisci che parta invece dai quattro difetti del campo — che restano l'unica cosa che oggi blocca un tecnico in mezzo a un capannone.



---

Progetto: dossier di verifica, non brochure. Ink blu-nerissimo su carta grigio-calda, accento verderame per gli strumenti di misura, e tre colori-segnale che portano informazione vera (confermato / impreciso / smentito). Newsreader per i titoli, IBM Plex Sans per il testo e IBM Plex Mono per le citazioni `file:riga`, che sono la texture ricorrente del documento. Colonna di lettura stretta, tabelle in breakout.

