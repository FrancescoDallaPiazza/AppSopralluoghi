# Roadmap AppSopralluoghi

Cose da fare, organizzate per priorità. Aggiornata mentre si lavora, sopravvive
tra le conversazioni. Per il **contesto** (perché esiste l'app, com'è fatta,
modello dati, workflow di rilascio) vedi `PROGETTO.md`.

Convenzione: una riga = una cosa da fare. Si fa, si barra (`- [x]`), e si
sposta in fondo nella sezione "Fatti di recente".

---

## A · Da fare subito (deploy delle ultime feature)

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

### UX trasversale

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
    - [ ] **DEPLOY**: eseguire `supabase/migrations/035_box_seed_capitoli.sql`
      nell'**SQL Editor** (Canale 3), poi push del codice su `main` + refresh PWA.
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

## D · Allineamento documentazione

- [ ] **PROGETTO.md §8** elenca ancora "Rigenerazione automatica scadenze
  ricorrenti → DA FARE", ma la migration `013_scadenze_ricorrenti.sql` (commit
  `d1669c0`) implementa il trigger `azione_rigenera_scadenza_ricorrente` che
  copre il caso. Aggiornare PROGETTO.md spostando il punto in "Fatti".

---

## ✅ Fatti di recente

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
