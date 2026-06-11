# Roadmap AppSopralluoghi

Cose da fare, organizzate per priorità. Aggiornata mentre si lavora, sopravvive
tra le conversazioni. Per il **contesto** (perché esiste l'app, com'è fatta,
modello dati, workflow di rilascio) vedi `PROGETTO.md`.

Convenzione: una riga = una cosa da fare. Si fa, si barra (`- [x]`), e si
sposta in fondo nella sezione "Fatti di recente".

---

## A · Da fare subito (deploy delle ultime feature)

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
  voce esponga sempre questa modalità (oggi dipende dalla config del template:
  tipo voce, `genera_azione`, ecc.); (b) **ridisegnare/sostituire i contenuti**
  delle 3 checklist d'esempio. Unica eccezione potenzialmente "nuovo schema":
  se si vuole **conservare anche il file audio** originale (oltre alla
  trascrizione) servirebbe una tabella `audio`/`allegato` gemella di `foto`.
- [ ] Avviso se la checklist scelta ha `tipo_attivita` ≠ quello dell'incarico
  (oggi è ammesso senza segnalazioni).
- [ ] Consentire il cambio di checklist su un sopralluogo già avviato ma senza
  esiti compilati (oggi, creata la `checklist_compilata`, il template è
  congelato).

### Revisioni

- [ ] Visualizzatore della storia delle revisioni (`caricaRevisioni` è già
  pronto): leggere gli snapshot archiviati direttamente dall'app.

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
