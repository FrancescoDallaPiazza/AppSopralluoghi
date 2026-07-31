# Roadmap AppSopralluoghi

Cose da fare, organizzate per priorità. Aggiornata mentre si lavora, sopravvive
tra le conversazioni. Per il **contesto** (perché esiste l'app, com'è fatta,
modello dati, workflow di rilascio) vedi `PROGETTO.md`.

Convenzione: una riga = una cosa da fare. Si fa, si barra (`- [x]`), e si
sposta in fondo nella sezione "Fatti di recente".

---

## A · Da fare subito (deploy delle ultime feature)

Per attivare il **libretto formativo per persona** (scritto 2026-07-31):

- [ ] Deployare la Edge Function **`libretto-pdf`** dal Dashboard Supabase
  (self-contained, CORS inline, nessun import da `_shared`). Usa la stessa
  `PDFBOLT_API_KEY` di report e organigramma: se manca, ripiega su HTML invece
  di fallire. Senza deploy la schermata funziona lo stesso — è solo l'*Esporta
  PDF* che risponde "Function not found".
- [ ] Push dei sorgenti su `main` (Canale 1). Nuovi: `lib/admin/libretto.ts`,
  `formazione/Libretto.tsx`; toccati `formazione/RisorseUmane.tsx` (bottone
  *Libretto* per riga), `admin/Anagrafiche.tsx` (passa la ragione sociale),
  `lib/admin/formazione.ts` (`addMesi` esportata).
- [ ] Verifica: *Anagrafiche → cliente → Risorse Umane → Libretto* su una
  persona con attestati importati. Attesi: i ruoli con data di nomina, TUTTA la
  formazione svolta in ordine cronologico (compresi gli attestati che non
  servono a nessun requisito dei suoi ruoli — è l'unico punto dell'app dove si
  vedono) e la situazione rispetto ai ruoli. Poi *Esporta PDF*.


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
- [ ] Push dei sorgenti su `main` (Canale 1, Vercel auto-deploy).
  Tocca: `lib/admin/aliasCorsi.ts` (nuovo), `admin/AliasCorsi.tsx` (nuovo),
  `admin/BackOffice.tsx`, `lib/admin/catalogoImport.ts` (esporta `periodicitaMesi`).
  Aggiunta 2026-07-30: `RigaCatalogoGestionale.categoria` (colonna E) letta dal
  parser e mostrata come pill in anteprima e in lista — è il segnale che
  distingue il catalogo ufficiale ASR 2025 dal bucket legacy "Generica", e un
  modulo B del 2016 dal suo omonimo 2025. **`tsc -b` + `vite build` DA
  VERIFICARE**: node non è installato sulla macchina di sviluppo attuale.
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
  **`tsc -b` + `vite build` DA VERIFICARE** (node assente sulla macchina).
- [ ] **Aggancio in C1b**: l'import deve copiare `corso_alias.parziale` su
  `formazione.parziale`. Senza, gli spezzoni entrano come attestati interi e la
  somma non serve a niente. `select('*')` ovunque, quindi la colonna arriva da
  sola sia in back-office sia nella cache Dexie del campo: non c'è nessuna lista
  di colonne da aggiornare.
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

- [ ] **Verifica in back-office → Anagrafiche → Import formazione** con
  `ExportExcel.xlsx`. Atteso: 2 unità — `VILLAFRANCA DI VERONA` (60 righe, 11
  persone) e `TREVENZUOLO` (67 righe, 9 persone) — ognuna da abbinare al suo
  cliente. Poi *Importa*; rilanciando lo stesso file: 0 nuove, tutte "già
  importate".
- [ ] **`tsc -b` + `vite build` DA VERIFICARE** (node assente sulla macchina).
- [ ] **Prerequisito in anagrafica per le aziende multi-stabilimento**: i clienti
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
- [ ] Push dei sorgenti su `main` (Canale 1, Vercel auto-deploy) + refresh PWA.
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
  **`tsc -b` + `vite build` DA VERIFICARE** (node assente sulla macchina).
- [ ] Fase 4 - scadenzario: opzionale etichetta della sede sulle voci (roll-up
  multi-sede non serve piu': una sola sede-organigramma per cliente).
- [ ] Fase 5 - offline: il riepilogo in campo segue la sede-organigramma del cliente
  del sopralluogo (sola lettura, offline).

Note: colonne org su `sede`, write-through in `salvaCliente`, flag `da_confermare` e
badge in OrganigrammaView restano ma sono ridondanti/dormienti (nessuna copia tra
sedi li accende; gli attributi si leggono dal cliente).

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

- [ ] **Werp · sincronizzazione**. Campi `incarico.werp_id`,
  `azione.werp_attivita_id`, `cliente.werp_id` già predisposti, nessuna
  sincronizzazione attiva. Da chiarire col fornitore il canale (API REST /
  accesso DB / import-export file). Vedi PROGETTO.md §8.

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
