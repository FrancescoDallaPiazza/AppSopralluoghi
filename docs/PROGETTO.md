# AppSopralluoghi — documento di progetto

Documento di stato dell'applicazione: a cosa serve, com'è fatta, come si
rilascia, cosa è già pronto e cosa resta da fare. Pensato per riprendere il
lavoro senza ricostruire ogni volta il contesto.

Ultimo aggiornamento: vedi cronologia in fondo.

---

## 1. Scopo

PWA di ausilio ai sopralluoghi dei tecnici presso i siti dei clienti, per la
consulenza continuativa sulla sicurezza sul lavoro (D.Lgs. 81/08). Committente:
Overall Group / Ing. Francesco Dalla Piazza.

Flusso di riferimento:
1. Ordine di consulenza continuativa (incarico) con N sopralluoghi in un periodo.
2. Pianificazione delle sedute e assegnazione ai tecnici (con suggerimento per
   carico settimanale e vicinanza alla base).
3. Sopralluogo sul campo con check-list (scelta alla prima apertura, default =
   quella dell'incarico): per ogni evidenza si registra lo stato (conforme / non
   conforme / N.A.), note, foto, ed eventuali "cose da fare" (azioni correttive)
   o scadenze ricorrenti, con responsabile (cliente, tecnico o area interna),
   scadenza e priorità.
4. Esiti: report al cliente (cose a suo carico), comunicazione interna (cose a
   carico del team), scadenzario.
5. Continuità: il sopralluogo successivo riparte dallo stato aggiornato delle
   cose da fare del giro precedente.

---

## 2. Stack e architettura

- **Front-end**: React + Vite + TypeScript, PWA installabile (vite-plugin-pwa).
- **Back-end**: Supabase — Postgres + Auth + Storage + Edge Functions (Deno).
- **Offline-first**: ogni modifica vive prima in locale (IndexedDB via Dexie) e
  in una **coda di sincronizzazione** (outbox). Al ritorno della rete la coda si
  svuota in ordine con upsert per uuid (niente conflitti). Le foto vengono
  ridimensionate e caricate su Storage.
- **Auth**: email/password Supabase; l'utente è collegato a una riga `tecnico`
  tramite `tecnico.user_id`. Ruoli: `tecnico`, `admin`, `interno`.

### Struttura sorgenti (sintesi)
```
src/
  App.tsx                 # gate auth; admin -> back-office, tecnico -> campo,
                          #   interno -> solo "Le mie cose da fare"
  Login.tsx, AuthProvider.tsx
  MieiSopralluoghi.tsx    # lista del tecnico (Da fare / Completati) + report
  MieCoseDaFare.tsx       # azioni assegnate al singolo
  Compilazione.tsx        # schermata di campo (scelta checklist + check-list + cose da fare)
  NotaVocale.tsx          # dettatura vocale note
  admin/                  # back-office (solo admin)
    BackOffice.tsx, Anagrafiche.tsx, Tecnici.tsx, Aree.tsx,
    CoseDaFare.tsx, TemplateList.tsx, TemplateEditor.tsx, Pianificazione.tsx,
    Disponibilita.tsx
  lib/
    types.ts, supabase.ts, db.ts (Dexie+outbox), sync.ts (coda, foto, drain),
    auth.ts, sopralluoghi.ts, azioni.ts, report.ts, prefetch.ts,
    compilazione.ts, onboarding.ts
    admin/ (anagrafiche, tecnici, aree, templates, assistita, cosedafare,
            pianificazione, disponibilita)
supabase/
  migrations/             # schema + seed (vedi §5)
  functions/              # Edge Functions (vedi §4)
```

---

## 3. Workflow di rilascio (IMPORTANTE)

Le modifiche **non** sono tutte uguali: viaggiano per tre canali diversi.

1. **Codice dell'app** (`src/...`, `index.html`, config): si rilascia con il
   **push su GitHub** (GitHub Desktop → Commit → Push). Vercel ricompila in
   automatico. Sul dispositivo serve un **refresh forzato** (Ctrl+F5 / riapertura
   PWA) per aggiornare il service worker, che altrimenti tiene il bundle vecchio
   in cache.
2. **Edge Functions** (`supabase/functions/...`): **non** viaggiano col push. Si
   pubblicano a parte, dal Dashboard Supabase (Edge Functions → Deploy/Editor) o
   da CLI (`npx supabase functions deploy <nome> --use-api`). Nota: nell'editor
   del Dashboard una funzione non vede `../_shared/cors.ts`, quindi le funzioni
   pensate per quel canale tengono le intestazioni CORS scritte al loro interno.
3. **Migrazioni DB** (`supabase/migrations/...`): si eseguono a mano nell'**SQL
   Editor** di Supabase. Non partono col push.

Convenzione file: i sorgenti del repo usano **CRLF**. I file consegnati vengono
normalizzati a CRLF prima della consegna.

---

## 4. Supabase

- **Project ref**: `pvbwcfrgatkqashstxjc`.
- **Dominio email**: `overallgroup.info` (mittente noreply@overallgroup.info).
- **Edge Functions**:
  - `genera-report` — report HTML/PDF (varianti cliente / interno) + invio.
  - `notifica-azione` — **solo re-invio manuale** dal back-office (riceve un
    `azione_id` esplicito). Le chiamate del vecchio webhook su `azione` vengono
    ignorate, per non generare email doppie.
  - `notifica-sopralluogo` — **una sola email per destinatario interno** al
    completamento del sopralluogo, con tutte le sue cose da fare. Idempotente per
    (sopralluogo + destinatario) via `azione.notificata_il`.
  - `invita-tecnico` — onboarding: crea/invita l'account e collega `user_id`.
  - `calendario-ics` — feed iCal pubblico (RFC 5545) dei sopralluoghi del
    tecnico, sottoscrivibile da Google/Outlook/Apple. URL pubblica con token,
    autenticata dal `tecnico.calendario_token` (rigenerabile dal back-office).
    CORS inline, idoneo al deploy dal Dashboard.
  - `_shared/cors.ts` — intestazioni CORS condivise (usate via CLI).
- **Database Webhook**: su tabella `sopralluogo`, evento **Update**, →
  `notifica-sopralluogo` (header `Authorization: Bearer <service_role_key>`). Il
  vecchio webhook su `azione` → `notifica-azione` è da considerarsi dismesso
  (resta innocuo perché la funzione lo ignora).
- **Secrets** (condivisi tra le funzioni): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
  `SMTP_PASS`, `MAIL_FROM`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## 5. Modello dati (tabelle principali)

- `cliente` — ragione sociale, referente, contatti, località, indirizzo, geo, ID Werp.
- `incarico` — tipo attività, n. sopralluoghi, periodo, durata, stato; per cadenza
  o a numero fisso. Si aggancia a un template attivo per `tipo_attivita`.
- `sopralluogo` — seduta: progressivo, tecnico, date pianificata/effettiva, durata,
  località, stato (`pianificato` / `in_corso` / `completato` / `sincronizzato`).
- `checklist_template` + `voce_template` — modello form configurabile (voci e
  sotto-domande, tipi: scelta/multiscelta/testo/data/numero/slider/foto/rilievo;
  opzioni con stato logico e generazione azione; scadenza ricorrente; ripetibilità).
  Versionamento: un template già usato non si modifica a ritroso.
- `checklist_compilata` + `esito_voce` — compilazione effettiva: per ogni voce lo
  stato, il valore, le note; `genera_azione` sul rilievo. Il template (`template_id`
  + `template_versione`) si sceglie alla prima apertura del sopralluogo (default =
  quello dell'incarico) e resta CONGELATO sulla compilazione.
- `foto` — immagini per esito (url Storage, thumb, geo).
- `azione` — "cosa da fare" (azione correttiva o scadenza ricorrente): descrizione,
  `responsabile_tipo` (`cliente` / `risorsa_interna`), `responsabile_cliente_id` /
  `responsabile_interno_id` (tecnico) / `responsabile_area_id` (area),
  `data_scadenza`, `priorita`, `stato`, `origine_esito_id`, `sopralluogo_origine_id`,
  `sopralluogo_verifica_id`, `periodicita_mesi`, `notificata_il`. Le azioni sono
  agganciate all'**incarico** (via `sopralluogo_origine_id`), non al template: il
  "giro precedente" filtra per incarico, quindi cambiare checklist tra una seduta
  e l'altra non spezza la continuità delle cose da fare.
- `area_interna` — funzioni del team (Formazione, Preventivi…) con email, come
  destinatario alternativo al tecnico.
- `tecnico` — anagrafica risorse (nome, cognome, base+coordinate, capienza
  ore/settimana, ruolo, attivo, user_id, `calendario_token` per il feed iCal).
- `sopralluogo_revisione` — versioni congelate di un sopralluogo (numero, data,
  autore, motivo, `snapshot` jsonb con esiti+azioni). Il sopralluogo ha il
  contatore `revisione_corrente` (1 = primo completamento). [migration 012]

Migrazioni presenti: 001 schema+RLS+foto · 002 form model · 003–004 template/seed ·
005 bucket report · 006 ruolo back-office · 007 cadenza · 008 contatti · 009 aree
interne · 010 (notificata_il / periodicità / responsabile_area) · 011 ruolo
`interno` · 012 revisioni (sopralluogo_revisione + revisione_corrente) · 013
trigger rigenerazione scadenze ricorrenti (vedi §8) · 014 `calendario_token` su
`tecnico` (feed iCal pubblico).
**Prossima libera: 015.**

Nota RLS: attualmente permissiva (`staff_full using(true)`); il gating per ruolo è
applicato in-app. L'isolamento a livello DB è rinviato come step separato.

---

## 6. Stato funzionalità

**Pronte e verificate**
- Auth + collegamento utente↔tecnico, gestione stati limite, ruoli.
- Pianificazione (date proposte, assegnazione, assistita per carico/vicinanza).
- Compilazione di campo: check-list, note con dettatura, foto, generazione cose
  da fare e scadenze, giro precedente.
- Report cliente / interno + invio al cliente.
- Back-office: anagrafiche, tecnici, aree, template (con versionamento),
  scadenzario "Cose da fare", pianificazione, disponibilità tecnici.
- Prefetch offline.
- **Roadmap a 4 punti chiusa**:
  1. Unica comunicazione per sopralluogo: una email per destinatario interno al
     completamento (Edge Function `notifica-sopralluogo`), con anti-doppione per
     (sopralluogo + destinatario). Verificata end-to-end.
  2. Destinatario interno con accesso limitato (ruolo `interno` → vede solo "Le
     mie cose da fare").
  3. Assegnazione cosa da fare da tecnico A a tecnico B (oltre che alle aree).
  4. Più cose da fare per singolo rilievo.
- Robustezza ri-completamento: riaprendo un sopralluogo si ricaricano le cose da
  fare reali; ricompletare fa upsert (niente duplicati) e conserva `notificata_il`
  (niente email rispedite).
- **Revisioni con snapshot** (vedi §7): un sopralluogo completato si apre in
  riepilogo sola lettura; *Modifica* archivia la versione attuale e la rende
  modificabile; "Rev. N" sul report. Implementato — da verificare in produzione.

**Implementate, da verificare in produzione**
- **Ricalibrazione date successive in pianificazione**: quando in
  `admin/Pianificazione.tsx` si modifica la `data_pianificata` di un sopralluogo,
  se ci sono sedute successive `pianificato` con data valorizzata appare un
  dialogo con tre scelte: (a) ridistribuisci le successive **uniformi** tra la
  nuova data e `periodo_fine` (evitando weekend e festività, riusa
  `distribuisciDate`); (b) **shift** dello stesso scarto di giorni (mantiene la
  cadenza originale, snappa su giorni lavorativi); (c) non toccare le altre.
  Le date che cadono fuori dal periodo restano `null` e il messaggio lo segnala.
  Front-end puro, niente migrazioni: rilascio sul solo canale 1.
  File: `src/lib/admin/calendario.ts` (`ricalibraUniformi`, `ricalibraShift`),
  `src/admin/Pianificazione.tsx` (`cambiaData`, `applicaRicalibrazione`,
  componente `DialogoRicalibra`).
- **Calendario sottoscrivibile per tecnico (feed iCal)**: ogni tecnico ha un
  `calendario_token` (migration 014) e la Edge Function `calendario-ics`
  pubblica un feed RFC 5545 (text/calendar) con i suoi sopralluoghi
  pianificati/completati. Google/Outlook/Apple si abbonano una volta all'URL e
  si aggiornano da soli (ogni 6-24 ore secondo il client). DTSTART alle 09:00
  Europe/Rome con durata `durata_stimata_min` (default 240 min); STATUS
  TENTATIVE per `pianificato`/`in_corso`, CONFIRMED per
  `completato`/`sincronizzato`. In `admin/Tecnici.tsx` la scheda mostra l'URL,
  il bottone "Copia link", "Rigenera token" (invalida l'URL precedente) e una
  guida sintetica alla sottoscrizione. Ordine di deploy: migration 014 →
  Edge Function `calendario-ics` (dal Dashboard, CORS inline) → push del
  front-end.
  File: `supabase/migrations/013_calendario_token.sql`,
  `supabase/functions/calendario-ics/index.ts`,
  `src/lib/types.ts` (campo `calendario_token` su `Tecnico`),
  `src/lib/admin/tecnici.ts` (`leggiCalendarioToken`,
  `rigeneraCalendarioToken`, `urlFeedCalendario`),
  `src/lib/auth.ts` (colonna inclusa), `src/admin/Tecnici.tsx`
  (componente `CalendarioSottoscrivibile`).
- **Vista disponibilità tecnici (carico % settimanale)**: nuovo tab back-office
  "Disponibilità" — per ogni tecnico, settimana per settimana, il carico
  pianificato in percentuale rispetto alla capienza oraria (campo
  `capienza_ore_settimana`), con finestra navigabile 4/8/12 settimane, evidenza
  della settimana corrente e badge "oltre capienza". Sola lettura, front-end
  puro: riusa il motore della pianificazione assistita (`assistita.ts` +
  `caricaCaricoGlobale`), nessuna nuova tabella né Edge Function. Chiude la
  lacuna 2-bis delle istruzioni iniziali ("colonna riempita % rispetto al 100%").
  File: `src/admin/Disponibilita.tsx`, `src/lib/admin/disponibilita.ts`.
- **Scelta della checklist per seduta**: alla prima apertura di un sopralluogo
  non ancora avviato si sceglie la checklist. È preselezionata quella
  dell'incarico (template attivo per `tipo_attivita`, marcata "Consigliata"), ma
  si può scegliere fra tutti i template attivi. Confermata la scelta, la
  `checklist_compilata` congela il template scelto e parte la compilazione.
  Sopralluoghi già avviati / completati / in revisione usano il template
  congelato (nessun selettore). Le cose da fare restano agganciate all'incarico,
  quindi il "giro precedente" non si spezza cambiando checklist. Offline: dopo il
  prefetch (che ora scarica anche l'elenco dei template attivi + voci) il
  selettore funziona; se offline e mai prefetchato, ripiego automatico sul
  template dell'incarico (comportamento storico). Front-end puro, nessuna
  migrazione né Edge Function: rilascio sul solo canale 1.
  File: `src/lib/compilazione.ts` (`apriCompilazione` ritorna `scelta`/`pronto`,
  nuove `iniziaCompilazione` / `caricaTemplatesAttivi` / `prefetchTemplatesAttivi`),
  `src/Compilazione.tsx` (fase "scelta" + selettore), `src/lib/prefetch.ts`
  (step 2-bis: prefetch dei template attivi).

---

## 7. Revisioni di un sopralluogo completato (snapshot completo) — implementato

Obiettivo: un sopralluogo completato non deve essere modificabile "al volo".
Riaprendolo si vede un **riepilogo in sola lettura**; la modifica è un'azione
esplicita e ogni modifica **conserva la versione precedente per intero**.

Disegno concordato:
- Aprendo un sopralluogo `completato`/`sincronizzato` → **schermata di riepilogo**
  in sola lettura: esiti/rilievi con stato, cose da fare (destinatario, scadenza,
  priorità), scadenze ricorrenti, intestazione (cliente, data, tecnico) e numero
  di revisione. Pulsanti: *Report* (già esistente) e *Modifica*.
- *Modifica* (con conferma): salva uno **snapshot completo** della versione
  attuale come revisione precedente, riporta il sopralluogo in stato modificabile
  e apre la compilazione (già ripopolata correttamente).
- Al ri-completamento: la revisione corrente passa alla nuova; lo snapshot
  precedente resta archiviato e rileggibile. Sul report comparirà "Rev. N del
  gg/mm/aaaa".
- Email coerenti: le cose da fare già notificate non vengono rispedite; quelle
  aggiunte nella revisione partono normalmente.

Schema previsto (migration **012**):
- `sopralluogo_revisione (id uuid pk, sopralluogo_id fk, numero int, creata_il
  timestamptz, autore_tecnico_id fk null, motivo text null, snapshot jsonb)` —
  lo `snapshot` contiene esiti + azioni della versione congelata.
- `sopralluogo.revisione_corrente int default 1` (o equivalente) per il contatore.

Realizzato:
- migration `012_revisioni.sql` (tabella `sopralluogo_revisione` + contatore);
- `src/lib/revisioni.ts` (`apriRevisione` con snapshot server-first e ripiego
  locale, `caricaRevisioni`), `src/lib/db.ts` (tabella in outbox),
  `src/lib/types.ts` (campo `revisione_corrente`);
- `src/lib/sopralluoghi.ts` (carica `revisione_corrente`) e
  `src/MieiSopralluoghi.tsx` (schermata di riepilogo in sola lettura + gate
  *Modifica* con conferma);
- `src/Compilazione.tsx` + `revisioni.ts` (`annullaRevisione`): durante la
  modifica di una revisione c'è un **"Annulla modifica"** che ripristina lo stato
  dallo snapshot, elimina la revisione e riporta a `completato` senza lasciare
  revisioni a vuoto;
- `supabase/functions/genera-report/report-data.ts` e `report-html.ts` (riga
  "Rev. N · dal gg/mm/aaaa" nel report).

Ordine di deploy: migration 012 sull'SQL Editor PRIMA del push (i sorgenti
caricano la colonna `revisione_corrente`); i file `src/...` col push; la Edge
Function `genera-report` si ridistribuisce a parte (CLI consigliata, così include
`_shared/cors.ts`).

Possibile estensione futura: un visualizzatore della storia delle revisioni
(`caricaRevisioni` è già pronto) per rileggere gli snapshot archiviati.

---

## 8. Lavori aperti e lacune

Richieste/auspici delle istruzioni iniziali non ancora realizzati:

- **Collegamento a gestionale/altra app (Werp)** (punto 2, "magari collegata ad
  altra funzione/app"): campi predisposti (`incarico.werp_id`,
  `azione.werp_attivita_id`, ID Werp cliente) ma nessuna sincronizzazione attiva.
  Da chiarire col fornitore il canale (API REST / accesso DB / import-export).
  → DA FARE / DA DEFINIRE.
- **Rigenerazione automatica delle scadenze ricorrenti**: alla verifica di una
  scadenza ricorrente non si crea ancora in automatico il ciclo successivo.
  → DA FARE (minore).

Possibili affinamenti della vista disponibilità (non bloccanti):
- includere le ferie/indisponibilità del tecnico (oggi il carico è solo dalle
  sedute pianificate; non esiste un calendario di assenze);
- contare anche le sedute `in_corso`/`completato` non ancora archiviate se serve
  un quadro a consuntivo, non solo previsionale (oggi conta tutte le sedute con
  tecnico + data, qualunque stato);
- link diretto dalla cella alla pianificazione della settimana.

Possibili affinamenti della scelta checklist (non bloccanti):
- mostrare un'avvertenza se si sceglie una checklist di `tipo_attivita` diverso
  da quello dell'incarico (oggi è ammesso senza segnalazioni);
- consentire il cambio di checklist su un sopralluogo già avviato ma ancora senza
  esiti compilati (oggi, creata la compilazione, il template è congelato).

Decisioni da prendere:
- Contenuto email di `notifica-sopralluogo`: elenco testuale (attuale) o anche
  link/allegato del report interno.
- Isolamento RLS a livello DB per i ruoli (oggi gating solo in-app).

Migliorie non richieste nelle istruzioni iniziali (a discrezione): notifiche
push/badge in-app; esclusione festività/patroni locali in pianificazione.

---

## 9. Confronto con le istruzioni iniziali

| Istruzione iniziale | Stato |
| --- | --- |
| 1. Ordine continuativo con N sopralluoghi nel periodo (incarico) | Coperto |
| 2. Pianificazione temporale + assegnazione tecnici | Coperto |
| 2-bis. Disponibilità tecnici in % (colonna 0–100%) | Coperto (tab "Disponibilità") |
| 2-ter. Collegamento ad altra app/gestionale (Werp) | **Mancante** (campi predisposti) |
| 3. Check-list di riferimento scelta | Coperto |
| 3. Conforme + note + foto + scadenzario se calendarizzabile | Coperto |
| 3. Conforme + note + foto | Coperto |
| 3. Non conforme + note + foto + COSE DA FARE (cliente/interno) | Coperto |
| 3. Invio esiti al cliente (con COSE DA FARE) | Coperto |
| 3. Invio esiti alla risorsa interna (cose dirette) | Coperto |
| 3. Scadenzario | Coperto (rigenerazione ciclo successivo: da fare) |
| 3. COSE DA FARE aggiornabili nel tempo | Coperto |
| 4. Sopralluogo successivo: input = stato COSE DA FARE aggiornato (giro prec.) | Coperto (con "Verifica e chiudi") |
| 4. Check-list scelta + stesso workflow | Coperto (selettore per seduta, default = incarico) |

Aggiunte concordate dopo le istruzioni iniziali (non lacune): ruolo `interno`,
assegnazione A→B, più cose da fare per rilievo, email digest unica, revisioni con
snapshot (vedi §7), scelta della checklist per seduta (default = incarico).

---

## Cronologia
- Punti 2/3/4 della roadmap completati; poi punto 1 (email digest per sopralluogo)
  realizzato e verificato end-to-end (deploy Edge Functions dal Dashboard con CORS
  inline + webhook su `sopralluogo`).
- Aggiunta robustezza ri-apertura/ri-completamento (ripopolamento bozze +
  conservazione `notificata_il`).
- Concordato e specificato il sistema di revisioni con snapshot completo
  (prossimo sviluppo).
- Confronto con le istruzioni iniziali (§9): emergono come lacune la vista
  disponibilità tecnici in %, il collegamento al gestionale Werp e la
  rigenerazione delle scadenze ricorrenti.
- Revisioni con snapshot completo realizzate (migration 012 + strato dati +
  schermata di riepilogo con gate *Modifica* + riga "Rev. N" sul report).
- Realizzata la **vista disponibilità tecnici** (carico % settimanale per
  tecnico): nuovo tab back-office "Disponibilità" + `src/admin/Disponibilita.tsx`
  e helper puri `src/lib/admin/disponibilita.ts` (finestra settimane +
  occupazione %), sopra il motore esistente (`assistita.ts` +
  `caricaCaricoGlobale`). Front-end puro, nessuna migrazione né Edge Function:
  rilascio con un solo push (canale 1). Chiude la lacuna 2-bis delle istruzioni
  iniziali.
- Realizzata la **scelta della checklist per singola seduta**: default = quella
  dell'incarico, modificabile tra i template attivi alla prima apertura; il
  template scelto si congela sulla compilazione. Le cose da fare restano legate
  all'incarico (giro precedente invariato). Prefetch esteso ai template attivi
  per il funzionamento offline del selettore. Front-end puro, rilascio solo
  canale 1. File: `src/lib/compilazione.ts`, `src/Compilazione.tsx`,
  `src/lib/prefetch.ts`.
- Realizzata la **ricalibrazione delle date successive in pianificazione**:
  spostando manualmente una `data_pianificata`, un dialogo offre di
  ridistribuire le successive uniformi entro il periodo, fare lo shift dello
  stesso scarto, o lasciare invariate. Front-end puro, canale 1.
- Realizzato il **feed iCal sottoscrivibile per tecnico**: migration 014 che
  aggiunge `tecnico.calendario_token`, Edge Function pubblica `calendario-ics`
  che genera il feed RFC 5545, e in back-office (scheda tecnico) URL con copia,
  rigenera token, e guida alla sottoscrizione su Google/Outlook/Apple. Ordine
  di deploy: migration 014 → Edge Function dal Dashboard (CORS inline) → push.
