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
    Disponibilita.tsx, Formazione.tsx
  lib/
    types.ts, supabase.ts, db.ts (Dexie+outbox), sync.ts (coda, foto, drain),
    auth.ts, sopralluoghi.ts, azioni.ts, report.ts, prefetch.ts,
    compilazione.ts, onboarding.ts
    admin/ (anagrafiche, tecnici, aree, templates, assistita, cosedafare,
            pianificazione, disponibilita, formazione)
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
  - `organigramma-pdf` — riassunto PDF dell'organigramma sicurezza di un cliente
    (figure + incaricati + stato + ruoli scoperti + data). Accetta `riepilogo`
    (snapshot corrente dal client), `revisione_id` (una revisione archiviata) o
    `cliente_id` (ultima revisione). PDF via PDFBolt, bucket `report`, signed URL
    7 giorni; ripiega su HTML se `PDFBOLT_API_KEY` manca. CORS inline. [migration 027]
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
  sotto-domande, tipi: scelta/multiscelta/testo/data/numero/slider/foto/rilievo).
  Dalla **modalità di rilievo unica** (commit `a35cf45`) l'opzione di una scelta
  è solo la risposta descrittiva (chiave + etichetta): non deriva l'esito né
  genera azioni, perché in compilazione evidenze, cose da fare, scadenza
  ricorrente ed esito esplicito sono offerti su OGNI voce. La config voce
  conserva: periodicità di default della scadenza, ripetibilità (foto/rilievo),
  etichetta del bottone "aggiungi" (rilievo).
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
- **Modulo Formazione/Organigramma** [migration 015]:
  - `corso_catalogo` — catalogo dei corsi (codice, ore, `aggiornamento_mesi`,
    `ore_aggiornamento`, prerequisito): e' il "percorso previsto" editabile.
  - `figura_sicurezza` + `figura_requisito` — le figure dell'organigramma e i
    corsi richiesti da ciascuna (`per_categoria` = soddisfatto da un qualunque
    corso della categoria, tipico di antincendio/primo soccorso). Dalla 018 ogni
    figura porta anche `gruppo`/`gruppo_ordine`/`guida`/`obbligo` (metadati della
    "checklist ragionata"); aggiunta la figura `operatore_attrezzatura` (art. 73).
  - `persona` — personale del cliente (mansione, reparto, CF, override rischio).
  - `nomina` — quali figure ricopre una persona (l'organigramma).
  - `formazione` — gli attestati svolti (lo "stato attuale").
  - `esonero` — esoneri/crediti decisi per una persona (motivazione + norma).
  - `esonero_ammesso` — promemoria informativi mostrati in campo (seed dai casi
    dell'Allegato III ASR 17/04/2025), editabili.
  - `cliente.livello_rischio` (basso/medio/alto) per espandere le ore della
    formazione specifica lavoratori.
  - `organigramma_conferma` — conferma tracciata dell'organigramma per singolo
    sopralluogo (tecnico, data, `tipo` compilato/confermato/variato). [migration 019]
  - `organigramma_revisione` — storia versionata dell'organigramma per cliente:
    snapshot completo (figure + incaricati + stato + ruoli scoperti) congelato a
    ogni modifica, con `numero` progressivo per cliente (assegnato da trigger,
    cosi' funziona anche offline), `firma` dei fatti per dedup, `origine`
    (back-office / campo) e `autore`. Alimenta storico e PDF. [migration 027]

Migrazioni presenti: 001 schema+RLS+foto · 002 form model · 003–004 template/seed ·
005 bucket report · 006 ruolo back-office · 007 cadenza · 008 contatti · 009 aree
interne · 010 (notificata_il / periodicità / responsabile_area) · 011 ruolo
`interno` · 012 revisioni (sopralluogo_revisione + revisione_corrente) · 013
trigger rigenerazione scadenze ricorrenti (vedi §8) · 014 `calendario_token` su
`tecnico` (feed iCal pubblico) · 015 organigramma sicurezza + formazione
(catalogo/figure/requisiti/persone/nomine/attestati/esoneri + esoneri ammessi) ·
016 corso `DATORE_LAVORO` 16h + requisito + esonero-credito · 017 allineamento
catalogo al quadro obblighi (Dirigente 16→12h, corso `CANTIERI` 6h, esoneri
ammessi) · 018 organigramma come checklist ragionata (`gruppo`/`gruppo_ordine`/
`guida`/`obbligo` su figura + figura `operatore_attrezzatura`) · 019
`organigramma_conferma` (conferma per sopralluogo) · 020 modulo cantieri
condizionato (le righe cantieri da esonero a modulo della figura) · 021 bucket
Storage privato `attestati` (allegati attestato, PDF/immagini) + policy · 022
descrizioni (`guida`) delle figure in formato elenco puntato (quadro ASR 2025) ·
023 flag persona `formazione_pregressa` (regime transitorio ante ASR 2025).
024 figura Medico competente (sorveglianza sanitaria, senza corso) · 025
descrizioni `guida` figure riscritte verbatim dall'allegato (supera 022) · 026
Preposto a obbligo 'sempre' (ruolo scoperto se vuoto) · 027 `organigramma_revisione`
(snapshot versionato dell'organigramma per cliente + trigger di numerazione) ·
028 `cliente.rls_territoriale` (RLS coperto dal rappresentante territoriale).
**Prossima libera: 029.**

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
- **Modulo Formazione / Organigramma sicurezza** (migration 015-020): tab
  back-office "Formazione". Per cliente, l'organigramma "atteso" è una
  **checklist ragionata**: le figure sono raggruppate per blocco logico (Vertice
  e deleghe, SPP, Vigilanza, Rappresentanza, Emergenze, Lavoratori, Abilitazioni
  attrezzature) con etichetta d'obbligo (sempre / se ricorre / eventuale) e testo
  guida (migration 018). Ogni figura ha un layout a due colonne: a sinistra le
  specifiche del ruolo derivate dal catalogo (formazione richiesta base +
  aggiornamento, eventuale scadenza, puntatore agli esoneri/crediti previsti); a
  destra la colonna "Incaricati", un box per persona con link *modifica*
  (anagrafica) ed *evidenze*, e sotto le righe di stato per ogni corso richiesto
  (semaforo conforme / in scadenza ≤6 mesi / critico / esonerato).
  La modale **evidenze** per (persona, ruolo) segue un **workflow a cancello**:
  1) esonero/credito previsto? (con i promemoria del catalogo) — se sì si registra
  l'esonero e basta; 2) altrimenti la formazione richiesta (attestato: data →
  scadenza, ore, ente, allegato come URL); 3) la scadenza. In fondo, il **modulo
  aggiuntivo cantieri** (non un esonero) con spunta di applicabilità: se l'azienda
  ricade nell'obbligo si registra l'attestato del corso `CANTIERI` (migration
  017/020). Catalogo allineato al quadro obblighi: Datore di lavoro 16h
  (migration 016), Dirigente 12h.
  Il motore `valutaPersona` (in `formazione.ts`) è **puro**; un requisito senza
  attestato e senza esonero risulta `critico` a prescindere da `obbligatorio` —
  per questo il modulo cantieri NON è modellato come requisito (darebbe falsi
  gap), ma come modulo condizionato gestito in UI. Il pulsante "Genera cose da
  fare per i gap" crea righe nella stessa tabella `azione` dello scadenzario,
  instradabili a risorsa interna o cliente (nessuna email automatica).
  File: `src/lib/admin/formazione.ts` (tipi + motore puro + dati, figure ordinate
  per `gruppo_ordine`), `src/admin/Formazione.tsx`, voce di menu in
  `src/admin/BackOffice.tsx`.
  Limiti: i crediti dell'Allegato III restano promemoria informativi (matrice
  deterministica = fase 2). L'allegato attestato è un **file reale** caricato su
  Storage (bucket privato `attestati`, migration 021), visualizzabile via signed
  URL ("vedi allegato"). Il **modulo cantieri** ha ora un **semaforo** (stato
  neutro `facoltativo` se non registrato, altrimenti conforme/in scadenza/critico).

- **Organigramma compilabile offline in campo** (migration 019): durante il
  sopralluogo lo sheet "Formazione" (`FormazioneRiepilogo.tsx`) permette di
  consultare E compilare l'organigramma anche da zero, offline. Legge dalla cache
  locale (`caricaOrganigrammaLocale`) e valuta con la pura `assemblaRiepilogo`
  (stessi semafori del back-office); con rete fa `prefetchOrganigramma` e mette in
  cache il livello di rischio del cliente. Il tecnico puo' aggiungere/modificare/
  rimuovere persone, assegnare/togliere figure (nomine), e per ogni requisito
  registrare/aggiornare l'attestato o registrare/rimuovere un esonero: tutte
  scritture offline via `sync.ts` con rivalutazione immediata dei semafori. A fine
  consultazione una **conferma tracciata** (tecnico + data + tipo compilato/
  confermato/variato) finisce su `organigramma_conferma`. Lo "Scarica per offline"
  (`prefetch.ts`) precarica anche catalogo + persone dei clienti coinvolti.
  File: `src/FormazioneRiepilogo.tsx`, innesto in `src/Compilazione.tsx` (sheet +
  props tecnico/sopralluogo), `src/lib/prefetch.ts`; fondamenta `src/lib/db.ts` v3
  + `src/lib/sync.ts` (invariati) + migration 019.

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
  File: `supabase/migrations/014_calendario_token.sql`,
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

## 7-bis. Snapshot versionato dell'organigramma + PDF — implementato

Storia versionata dell'organigramma sicurezza per cliente, con esportazione PDF
a richiesta. Distinto dalle revisioni del sopralluogo (§7): qui l'oggetto
versionato è l'**organigramma di un cliente**, non un singolo sopralluogo.

- **Snapshot automatico a ogni modifica.** Ogni mutazione dell'organigramma
  congela uno snapshot completo (figure + incaricati + stato formativo + ruoli
  scoperti) in `organigramma_revisione`. Lo snapshot è "pronto da rendere": lo
  storico e il PDF lo leggono senza ricalcolare.
- **Dedup per firma dei fatti.** Lo snapshot porta una `firma` deterministica
  dei soli fatti che lo definiscono (persone, nomine, attestati, esoneri,
  rischio). Una nuova revisione nasce solo se la firma differisce dall'ultima:
  aprire la scheda o ri-salvare senza variazioni non crea revisioni a vuoto. La
  firma **non** include lo stato calcolato (che dipende dalla data odierna),
  così lo scorrere del tempo da solo non genera revisioni.
- **Numerazione lato DB.** Il progressivo `numero` per cliente è assegnato da un
  trigger BEFORE INSERT (`organigramma_revisione_numera`): online (back-office)
  e offline (campo, dove il numero arriva null dalla coda) condividono lo stesso
  meccanismo. Il payload outbox **non** include `numero` (l'update di un
  re-invio non deve azzerarlo).
- **Back-office (online).** Dopo ogni mutazione, `dopoModifica()` chiama
  `registraSnapshotOrganigramma` (ricarica i dati, assembla con la pura
  `assemblaRiepilogo`, dedup lato server, insert) e poi ricarica l'UI. Pulsanti
  *Esporta PDF organigramma* (snapshot corrente) e *Storico organigramma* (lista
  revisioni + apertura sola lettura + PDF della singola revisione).
- **Campo (offline).** Alla conferma organigramma, lo snapshot è costruito dallo
  stato LOCALE già valutato e accodato via outbox (`accodaRevisioneOrganigramma`);
  dedup locale per firma in `localStorage` (`organigramma:firma:<clienteId>`).
  Non si rilegge il server: le modifiche offline potrebbero non essere ancora
  sincronizzate.
- **PDF.** Edge Function `organigramma-pdf` (gemella di `genera-report`):
  PDFBolt, bucket `report`, signed URL 7 giorni, fallback HTML. Accetta
  `riepilogo` (export corrente dal client), `revisione_id` o `cliente_id`.

File: migration `027_organigramma_revisioni.sql`; Edge Function
`supabase/functions/organigramma-pdf/index.ts`; `src/lib/admin/organigramma-revisioni.ts`
(snapshot puri, firma, data-access, helper PDF); `src/lib/admin/formazione.ts`
(`caricaDatiOrganigramma` estratto); `src/lib/db.ts` (tabella in outbox);
`src/lib/sync.ts` (`accodaRevisioneOrganigramma`); `src/admin/Formazione.tsx`
(snapshot automatico, PDF, storico); `src/FormazioneRiepilogo.tsx` (snapshot alla
conferma di campo).

Ordine di deploy: **migration 027** sull'SQL Editor → Edge Function
`organigramma-pdf` dal Dashboard (CORS inline) → push dei sorgenti su `main`.
Verificare che `PDFBOLT_API_KEY` sia già presente tra i secrets (lo è per i
report).

---

## 8. Lavori aperti e lacune

Richieste/auspici delle istruzioni iniziali non ancora realizzati:

- **Collegamento a gestionale/altra app (Werp)** (punto 2, "magari collegata ad
  altra funzione/app"): campi predisposti (`incarico.werp_id`,
  `azione.werp_attivita_id`, ID Werp cliente) ma nessuna sincronizzazione attiva.
  Da chiarire col fornitore il canale (API REST / accesso DB / import-export).
  → DA FARE / DA DEFINIRE.

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

Lavori aperti del modulo Formazione/Organigramma (il 6.A — organigramma
compilabile offline in campo —, l'upload reale degli attestati e il semaforo del
modulo cantieri sono stati realizzati, vedi §6 e Cronologia):
- **Interruttore di attivazione per-sopralluogo** (opzionale): oggi lo sheet
  Formazione è sempre disponibile via chip e la conferma fa da segnale
  per-sopralluogo; se servisse renderlo opt-in è un'aggiunta a parte.

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
| 3. Scadenzario | Coperto (rigenerazione ciclo successivo via trigger, migration 013) |
| 3. COSE DA FARE aggiornabili nel tempo | Coperto |
| 4. Sopralluogo successivo: input = stato COSE DA FARE aggiornato (giro prec.) | Coperto (con "Verifica e chiudi") |
| 4. Check-list scelta + stesso workflow | Coperto (selettore per seduta, default = incarico) |

Aggiunte concordate dopo le istruzioni iniziali (non lacune): ruolo `interno`,
assegnazione A→B, più cose da fare per rilievo, email digest unica, revisioni con
snapshot (vedi §7), scelta della checklist per seduta (default = incarico).

---

## Cronologia
- **Antincendio / primo soccorso: niente cancello esonero**
  (`src/admin/Formazione.tsx`, `src/FormazioneRiepilogo.tsx`): per le categorie
  `CATEGORIE_NO_PREGRESSA` (antincendio DM 02/09/2021, primo soccorso DM
  388/2003) il modale evidenze non mostra piu' il passo "1 - Esonero/credito
  previsto?" (back-office) ne' il tab "Esonero" (campo): essendo fuori dal
  regime ASR 2025 non hanno crediti/esoneri dell'Allegato III. Si va diretti
  alla registrazione della formazione, con gli step rinumerati (1 Formazione /
  2 Scadenza / 3 Moduli). Front-end puro: canale 1, nessuna migration.
- **Deploy in produzione (2026-06-19)**: andati live i due bundle che erano in
  sospeso lato deploy.
  1. *Sessione Formazione / Organigramma* — migration 023
     (`persona.formazione_pregressa`) e 024 (figura Medico competente)
     verificate/applicate nell'SQL Editor; push su `main` di
     `src/lib/admin/formazione.ts`, `src/admin/Formazione.tsx`,
     `src/FormazioneRiepilogo.tsx` + refresh forzato PWA.
  2. *Snapshot versionato dell'organigramma* (§7-bis) — migration 027
     (`organigramma_revisione` + trigger numerazione) e 028
     (`cliente.rls_territoriale`) eseguite; Edge Function `organigramma-pdf`
     deployata dal Dashboard (CORS inline, `PDFBOLT_API_KEY` gia' nei secrets);
     sorgenti pushati. Storico organigramma + esportazione PDF verificati in
     back-office.
  Voci di deploy in `TODO.md` §A (snapshot) chiuse. Prossima migration libera: 029.
- **Antincendio e primo soccorso fuori dal regime "formazione pregressa"**
  (`src/lib/admin/formazione.ts`, `src/admin/Formazione.tsx`): la formazione
  pregressa e' il regime transitorio dell'ASR 17/04/2025; antincendio (DM
  02/09/2021) e primo soccorso (DM 388/2003) hanno regimi propri e ne sono
  esclusi. Nuova costante `CATEGORIE_NO_PREGRESSA = {antincendio, primo_soccorso}`.
  Effetti: nel motore un attestato mancante per queste categorie resta "critico"
  (mai "da verificare") anche se la persona ha `formazione_pregressa`; il pannello
  "Evidenze pregresse" non li elenca; in assegnazione il passo "Formazione
  pregressa? SI/NO" compare solo se la figura ha almeno un requisito soggetto
  (nuova prop `chiediPregressa`, che sostituisce `haFormazione` e copre anche le
  figure senza corsi). Front-end + motore puro, nessuna migration. Build `tsc -b`
  + `vite build` puliti.
- **Ruoli a percorsi multipli: corso scelto per persona/attestato** (`src/lib/admin/formazione.ts`,
  `src/admin/Formazione.tsx`, `src/FormazioneRiepilogo.tsx`): per i ruoli con piu'
  percorsi alternativi nella stessa categoria (Addetto antincendio liv. 1/2/3,
  Addetto primo soccorso gruppo A / B-C) l'app non assume piu' un livello. Nel
  motore, un requisito `per_categoria` con piu' corsi a catalogo e' "multiPath":
  senza attestato la riga mostra "&lt;ruolo&gt; (corso da scegliere)" (niente piu'
  "livello 2" arbitrario del seed); con attestato mostra il corso EFFETTIVO
  registrato (livello/gruppo svolto), non il segnaposto del requisito. In fase di
  registrazione attestato (back-office `EvidenzaRequisito` e campo
  `EditorRequisito`) compare un selettore "Corso svolto (livello/gruppo)" con le
  alternative di categoria; la scelta determina `corso_codice`/`corso_nome`/ore
  della formazione e il salvataggio e' bloccato finche' non si sceglie. Il
  lavoratore specifico resta fuori (un solo corso, ore derivate dal rischio).
  Front-end + motore puro, nessuna migration. Build `tsc -b` + `vite build` puliti.
- **Assegnazione figure senza formazione: niente passo "pregressa"** (`src/admin/Formazione.tsx`):
  la procedura di assegnazione mostrava sempre il passo "Formazione pregressa? SI/NO"
  anche per le figure prive di percorso formativo (es. Medico competente, dove si
  registra solo la nomina). Ora il passo compare solo se la figura ha almeno un
  `figura_requisito` (nuova prop `haFormazione`); per le altre, assegnata la nomina,
  si chiude. Front-end puro, nessuna migration. Build `tsc -b` + `vite build` puliti.
- **RLS: toggle Interno / RLS territoriale + data di nomina nei box** (`src/admin/Formazione.tsx`,
  `src/lib/admin/formazione.ts`): accanto all'etichetta della figura **RLS** un
  selettore segmentato **Interno / RLS territoriale** (sostituisce la vecchia
  spunta nel box vuoto) pilota `cliente.rls_territoriale` (migration 028); il box
  di assegnazione standard ("assegna"/Incaricati) vale per entrambe le scelte —
  in modalita' territoriale il ruolo non e' "scoperto" (coperto dal rappresentante
  territoriale) ma si puo' comunque registrare un nominativo. Inoltre **ogni box
  incaricato dell'organigramma** ora mostra la **data di nomina** editabile inline:
  `PersonaValutata.figure` espone `nomina_id` + `data_nomina` (dal motore puro),
  nuovo helper `aggiornaDataNomina(id, data)` che aggiorna solo quel campo della
  nomina esistente, e componente `NominaDataInline`. Vale per tutte le figure.
  Front-end + motore puro, nessuna migration ne' Edge Function (canale 1). Build
  `tsc -b` + `vite build` puliti.
- **Evidenze pregresse a campi liberi, raggruppate per ruolo** (`src/admin/Formazione.tsx`):
  per una persona con `formazione_pregressa` il pannello *Evidenze pregresse* NON
  propone piu' i corsi modulari dell'ASR 2025 (che non corrispondono ai percorsi
  degli accordi precedenti). I requisiti "da verificare"/"critico" sono ora
  raggruppati per **ruolo** (figura) e per ciascun ruolo si inseriscono gli
  attestati in forma libera: *tipo corso* (testo), *ore*, *data effettuazione*,
  *scadenza* e allegato facoltativo, con un **"+ Aggiungi attestato"** per nuove
  righe. Al salvataggio ogni riga diventa una `formazione` agganciata ai
  `corso_codice` dei requisiti del ruolo (una riga sola copre tutti i requisiti
  del ruolo; piu' righe vengono distribuite e quelle in eccesso comunque salvate),
  cosi' i semafori passano da "da verificare" a conforme/in scadenza in base alla
  scadenza inserita o calcolata. Se per un ruolo non si inserisce nulla, il
  pulsante **"Nessun attestato: crea cosa da fare"** genera UNA cosa da fare
  "Attestati per il ruolo &lt;ruolo&gt; da recuperare (&lt;persona&gt;)" verso il
  cliente, gestita come tutte le altre dello scadenzario. Rimossa la vecchia
  `RigaPregressa` per-corso. **Relabel organigramma**: nel motore puro
  (`src/lib/admin/formazione.ts`), quando un requisito risulta coperto da
  un'evidenza pregressa (nota con prefisso `MARCA_PREGRESSA`), la riga
  dell'organigramma mostra la **dicitura libera** scritta dal consulente al posto
  del nome modulare ASR 2025 a catalogo, con nel dettaglio "pregresso, copre:
  &lt;modulo ASR 2025&gt;". Vale sia in back-office sia in campo (stesso motore).
  Front-end + motore puro, nessuna migration ne' Edge Function (canale 1). Build
  `tsc -b` + `vite build` puliti.
- Assegnazione ruolo (back-office): assegnando una persona **per la prima volta**
  a una figura, dopo il salvataggio compare il passo **"Formazione pregressa? SI/NO"**.
  SI -> imposta `formazione_pregressa` sulla persona e apre il pannello *Evidenze
  pregresse* (carica attestati con data+scadenza o crea cose da fare); NO -> si
  prosegue con i corsi previsti dall'ASR 2025 (requisiti gia' a carico). Solo
  `src/admin/Formazione.tsx` (riusa la spunta `formazione_pregressa` e il pannello
  evidenze pregresse), nessuna migration.
- Organigramma back-office: (1) il box di criticita' per ruolo obbligatorio scoperto
  ora riporta solo "Criticita': ruolo obbligatorio senza incaricato."; (2) il box
  dell'RLS ha una spunta **"RLS territoriale (RLST)"** (`cliente.rls_territoriale`,
  migration 028): se attiva, l'RLS non e' piu' segnalato come ruolo scoperto
  (coperto dal rappresentante territoriale). `assemblaRiepilogo` riceve un flag
  opzionale `rlsTerritoriale` (retrocompatibile) che esclude l'RLS dai ruoli
  scoperti; propagato a `valutaCliente`, allo snapshot e alla firma.
- Back-office formazione: (1) pulsante **"rimuovi attestato"** per requisito (elimina
  la formazione errata via `eliminaFormazione`); (2) **pannello "Evidenze pregresse"**
  dedicato che si apre quando si attiva la spunta `formazione_pregressa` su una persona
  (o dal bottone nella scheda persona): elenca i corsi richiesti non coperti e per
  ciascuno consente di registrare l'attestato pregresso con **data + scadenza manuale**
  (il motore usa `f.scadenza` se valorizzata), oppure di creare una **cosa da fare**
  ("Recuperare e registrare attestato pregresso") verso il cliente. Solo
  `src/admin/Formazione.tsx`; nessuna migration.
- Snapshot versionato dell'organigramma sicurezza + PDF a richiesta (§7-bis):
  migration 027 (`organigramma_revisione` + trigger numerazione), Edge Function
  `organigramma-pdf`, nuovo modulo `organigramma-revisioni.ts`, snapshot
  automatico in back-office (dedup per firma lato server) e in campo (alla
  conferma, dedup locale via localStorage), storico + esportazione PDF nel
  back-office. Build `tsc -b` + `vite build` puliti. Prossima migration: 028.
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
- Realizzato il **modulo Formazione / Organigramma sicurezza** (subapp): migration
  015 (catalogo corsi, figure, requisiti, persone, nomine, attestati, esoneri e
  catalogo "esoneri ammessi" + `cliente.livello_rischio`), strato dati e motore
  in `src/lib/admin/formazione.ts` (semafori, crediti automatici, scadenze,
  promemoria, generazione cose da fare), nuovo tab `src/admin/Formazione.tsx`,
  voce di menu in `BackOffice.tsx`. I crediti dell'Allegato III ASR 17/04/2025
  sono modellati come promemoria informativi in campo (Caso 3); la matrice
  deterministica e' la fase 2. Nota numerazione: la migration nasce numerata 015
  perche' la 014 era gia' occupata dal feed iCal. Ordine di deploy: migration 015
  (SQL Editor, gia' applicata) → push dei file front-end (canale 1) → refresh PWA.
- Evoluzione del **modulo Formazione**: catalogo allineato al quadro obblighi
  formativi (migration 016 Datore di lavoro 16h; 017 Dirigente 16→12h, corso
  `CANTIERI`, esoneri ammessi). L'organigramma atteso è diventato una **checklist
  ragionata** (migration 018: blocchi logici, obbligo e guida per figura; figura
  `operatore_attrezzatura`), con layout a due colonne e **modale evidenze a
  cancello** (esonero → formazione → scadenza) più modulo cantieri condizionato
  (migration 020). Rimosse le schede persona in coda e i vecchi modali
  per-persona; la modifica anagrafica è ora sul link "modifica" del box
  incaricato. Posate inoltre le **fondamenta per l'organigramma offline in
  campo** (migration 019 `organigramma_conferma` + `db.ts` v3 + `sync.ts`),
  ancora inerti finché non c'è l'editor di campo (§8, 6.A). Migration 016-020
  applicate. File: `src/admin/Formazione.tsx`, `src/lib/admin/formazione.ts`,
  `src/lib/db.ts`, `src/lib/sync.ts`.
- **Organigramma compilabile offline in campo** (realizza il 6.A): lo sheet
  "Formazione" del sopralluogo è passato da sola-lettura/online a **offline-first
  ed editabile**, fino alla compilazione da zero. Estratta da `valutaCliente` la
  funzione pura `assemblaRiepilogo` (riusata online e offline). In campo si
  possono aggiungere/modificare/rimuovere persone, assegnare/togliere figure, e
  registrare attestati/esoneri (scritture offline via `sync.ts`), con conferma
  tracciata su `organigramma_conferma`. Lo "Scarica per offline" precarica anche
  catalogo + persone. `db.ts`/`sync.ts` invariati; nessuna nuova migration
  (la 019 era già applicata) — rilascio solo canale 1. File:
  `src/FormazioneRiepilogo.tsx`, `src/Compilazione.tsx`, `src/lib/prefetch.ts`,
  `src/lib/admin/formazione.ts`.
- **Allineamento documentazione** (nessun codice): verificato in produzione che il
  trigger `azione_rigenera_scadenza_ricorrente` (migration 013) è installato →
  rigenerazione automatica delle scadenze ricorrenti tolta dai lavori aperti (§8)
  e §9 aggiornata. Corretto il path stale del feed iCal in §6 (`014_calendario_token.sql`,
  non 013). Migration 020 confermata applicata; prossima libera 021.
- **Upload reale degli attestati (offline-first)**: l'allegato dell'attestato è
  passato da campo URL a **file vero** (PDF/immagine) caricato su Storage. Nuovo
  bucket privato `attestati` (migration 021, max 20 MB, signed URL per la
  lettura). In campo l'upload è **offline-first**, gemello della pipeline foto: il
  file vive come blob in Dexie (`attestatoBlob`) + coda outbox `kind:'attestato'`,
  e al ritorno della rete `runSync` lo carica e scrive il path su
  `formazione.allegato_url`; eliminando una formazione si annullano gli upload
  pendenti. In back-office l'upload è online diretto (id generato lato client →
  upload → `salvaFormazione`). File: `supabase/migrations/021_attestati_storage.sql`,
  `src/lib/supabase.ts` (bucket + helper path/content-type + `urlFirmatoAttestato`),
  `src/lib/db.ts` (Dexie v4 + `attestatoBlob`), `src/lib/sync.ts`
  (`salvaFormazioneConAllegato` + drain), `src/FormazioneRiepilogo.tsx` (campo),
  `src/admin/Formazione.tsx` (back-office). Ordine di rilascio: migration 021 →
  push dei 5 file → refresh PWA.
- **Semaforo modulo cantieri + visualizzazione allegato** (solo codice, canale 1):
  nuovo stato neutro `facoltativo` in `StatoRequisito` (peso 0, non peggiora la
  persona). I moduli condizionati (cantieri = `esonero_ammesso` tipo 'altro' con
  corso+figura) sono ora valutati a parte (`ModuloValutato` + `PersonaValutata.moduli`
  via la nuova `valutaModuli`): se non registrati restano `facoltativo` (neutro,
  niente falso gap), altrimenti seguono la scadenza reale. Non entrano nei
  `conteggi` né nello stato peggiore della persona. Estratto il helper puro
  `statoDaScadenza` (riuso tra requisiti e moduli). Esposto `allegato_url` su
  `RequisitoValutato`/`ModuloValutato`: in back-office (`EvidenzaRequisito` e
  `ModuloAggiuntivo`) compaiono il semaforo del modulo e il link "vedi allegato"
  (signed URL via `urlFirmatoAttestato`). File: `src/lib/admin/formazione.ts`,
  `src/admin/Formazione.tsx`, `src/FormazioneRiepilogo.tsx` (chiave `facoltativo`
  aggiunta al Record esaustivo `TXT`). Nessuna migration.
- **Rifiniture UI organigramma atteso** (solo `src/admin/Formazione.tsx`): nome
  figura dentro una pill rossa con testo bianco; selettore "livello di rischio"
  del cliente evidenziato in giallo quando non impostato e avviso che indica dove
  impostarlo (il menu rischio in alto, gia' esistente). Descrizione figura ridotta
  alla sola guida sintetica (`figura.guida`), resa piu' grande/leggibile; rimossi i
  "capitoli" ridondanti (Formazione richiesta / Eventuale scadenza / Esoneri) che
  ripetevano le stesse informazioni, e con essi le funzioni ormai inutili
  `calcolaSpec`/`periodoLabel`.
- **Pannello Figure di campo: salvataggio in stadio** (solo `src/FormazioneRiepilogo.tsx`):
  prima ogni spunta di figura salvava subito (`salvaNomina`/`eliminaNomina` al
  toggle) e chiudere non annullava; ora la selezione e' in stadio (spuntare non
  salva) e si conferma con "Salva" o si scarta con "Annulla", coerente con
  l'assegnazione del back-office. Risolve il caso "spunto una figura sbagliata e
  chiudendo resta salvata".
- **Moduli aggiuntivi nella card formazione del requisito** (`src/lib/admin/formazione.ts`
  + `src/admin/Formazione.tsx`): i moduli condizionati (es. cantieri) non sono piu' in una
  card separata; sono innestati nella card della formazione del requisito (passo 4) e
  compaiono solo nel ramo "No, registro la formazione" (servono solo se non si e'
  esonerati). `valutaModuli` considera ora gli esoneri: un modulo coperto da
  esonero/credito attivo risulta `esonerato` e viene nascosto. Nell'organigramma il box
  incaricato mostra comunque lo stato del modulo (semaforo + tag "modulo").
- **Medico competente + descrizioni verbatim + ruoli scoperti** (migrazioni 024/025/026,
  `src/lib/admin/formazione.ts`, `src/admin/Formazione.tsx`, `src/FormazioneRiepilogo.tsx`):
  (1) nuova figura `medico_competente` (gruppo Sorveglianza sanitaria, obbligo
  condizionale, senza corso: si registra la nomina); (2) la `guida` di ogni figura
  riscritta ESATTAMENTE come nell'allegato cliente (UTF-8, sotto-voci con "- ",
  supera la 022); (3) criticita' di organigramma: `assemblaRiepilogo` calcola
  `figureScoperte` = figure obbligatorie (obbligo 'sempre') senza incaricato, con
  RSPP escluso se il datore svolge l'RSPP (`dl_rspp` coperto); il back-office
  nasconde il box RSPP in quel caso, mostra un banner rosso "ruolo obbligatorio
  senza incaricato" e una metrica "Ruoli scoperti"; Preposto reso obbligatorio
  (026). RSPP esterno / RLS territoriale si gestiscono aggiungendoli come persona.
  (4) bugfix: nelle spunte "formazione pregressa" gli escape `\u...` erano in testo
  JSX grezzo (mostrati alla lettera) -> sostituiti con caratteri reali. (`supabase/migrations/023_persona_formazione_pregressa.sql`,
  `src/lib/admin/formazione.ts`, `src/admin/Formazione.tsx`, `src/FormazioneRiepilogo.tsx`):
  flag per persona `formazione_pregressa` (azienda gia' operante prima dell'ASR 2025).
  Nuovo stato requisito `da_verificare` (semaforo neutro). Logica motore nel ramo
  "senza attestato/esonero": (a) corso datore `DATORE_LAVORO` = obbligo nuovo, prima
  applicazione entro 19/05/2027 -> "in scadenza" fino a quella data poi "critico"
  (costanti `CORSO_DATORE_BASE`/`SCAD_PRIMA_DATORE`); (b) altri requisiti, se la persona
  ha `formazione_pregressa` -> "da verificare" invece di "critico"; (c) altrimenti
  "critico". `ConteggiStato`/`peso` estesi; spunta nel form persona (back-office e
  campo); metrica/chip "da verificare"; etichette e stili. Rilascio: eseguire 023 in
  SQL Editor PRIMA del push.
- **Descrizioni figure a elenco puntato** (`supabase/migrations/022_organigramma_guida_bullets.sql`
  + `src/admin/Formazione.tsx`): la `guida` di ogni figura passa da prosa a bullet
  (quadro obblighi ASR 17/04/2025, allegato cliente), con sotto-voci (varianti ATECO,
  ore per rischio, aggiornamenti per dimensione/gruppo) prefissate da "- ". Il
  rendering nell'organigramma diventa `<ul>` con voci e sotto-voci. ASPP non e' nel
  quadro allegato: la sua guida resta invariata. Rilascio: eseguire 022 in SQL Editor,
  poi push di `Formazione.tsx` + refresh.
- **Moduli aggiuntivi nel box incaricato** (`src/admin/Formazione.tsx`): nell'organigramma
  atteso, il box di ogni incaricato ora mostra i moduli aggiuntivi della figura
  (accanto ai requisiti) con il loro semaforo e un tag "modulo"; gli esonerati sono
  nascosti. Cosi' lo stato del modulo (es. cantieri) e' visibile a colpo d'occhio per
  persona, oltre che gestibile dal link "evidenze".
