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
3. Sopralluogo sul campo con check-list: per ogni evidenza si registra lo stato
   (conforme / non conforme / N.A.), note, foto, ed eventuali "cose da fare"
   (azioni correttive) o scadenze ricorrenti, con responsabile (cliente, tecnico
   o area interna), scadenza e priorità.
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
  Compilazione.tsx        # schermata di campo (check-list + cose da fare)
  NotaVocale.tsx          # dettatura vocale note
  admin/                  # back-office (solo admin)
    BackOffice.tsx, Anagrafiche.tsx, Tecnici.tsx, Aree.tsx,
    CoseDaFare.tsx, TemplateList.tsx, TemplateEditor.tsx, Pianificazione.tsx
  lib/
    types.ts, supabase.ts, db.ts (Dexie+outbox), sync.ts (coda, foto, drain),
    auth.ts, sopralluoghi.ts, azioni.ts, report.ts, prefetch.ts,
    compilazione.ts, onboarding.ts
    admin/ (anagrafiche, tecnici, aree, templates, assistita, cosedafare,
            pianificazione)
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
  stato, il valore, le note; `genera_azione` sul rilievo.
- `foto` — immagini per esito (url Storage, thumb, geo).
- `azione` — "cosa da fare" (azione correttiva o scadenza ricorrente): descrizione,
  `responsabile_tipo` (`cliente` / `risorsa_interna`), `responsabile_cliente_id` /
  `responsabile_interno_id` (tecnico) / `responsabile_area_id` (area),
  `data_scadenza`, `priorita`, `stato`, `origine_esito_id`, `sopralluogo_origine_id`,
  `sopralluogo_verifica_id`, `periodicita_mesi`, `notificata_il`.
- `area_interna` — funzioni del team (Formazione, Preventivi…) con email, come
  destinatario alternativo al tecnico.
- `tecnico` — anagrafica risorse (nome, cognome, base+coordinate, capienza
  ore/settimana, ruolo, attivo, user_id).

Migrazioni presenti: 001 schema+RLS+foto · 002 form model · 003–004 template/seed ·
005 bucket report · 006 ruolo back-office · 007 cadenza · 008 contatti · 009 aree
interne · 010 (notificata_il / periodicità / responsabile_area) · 011 ruolo
`interno`. **Prossima libera: 012.**

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
  scadenzario "Cose da fare", pianificazione.
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

**In corso / prossimo step — Revisioni con snapshot (vedi §7).**

---

## 7. Prossimo step: revisioni di un sopralluogo completato (snapshot completo)

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

Pezzi da realizzare: migration 012; strato dati per creare lo snapshot e gestire
il contatore (offline via outbox); schermata di **Riepilogo** + gate *Modifica*;
riga "Rev. N" sul report.

---

## 8. Decisioni aperte

- Contenuto email di `notifica-sopralluogo`: attualmente **elenco testuale** delle
  cose da fare. Da decidere se aggiungere link/allegato del report interno.
- Isolamento RLS a livello DB per i ruoli (oggi gating solo in-app).

---

## Cronologia
- Punti 2/3/4 della roadmap completati; poi punto 1 (email digest per sopralluogo)
  realizzato e verificato end-to-end (deploy Edge Functions dal Dashboard con CORS
  inline + webhook su `sopralluogo`).
- Aggiunta robustezza ri-apertura/ri-completamento (ripopolamento bozze +
  conservazione `notificata_il`).
- Concordato e specificato il sistema di revisioni con snapshot completo
  (prossimo sviluppo).
