# App sopralluoghi

PWA installabile per i sopralluoghi sul campo. **React + Vite + TypeScript** su
**Supabase** (Postgres + Auth + Storage). Offline-first: ogni modifica vive prima
in locale (IndexedDB via Dexie) e in una coda di sincronizzazione; al ritorno
della rete la coda si svuota in ordine con upsert per uuid (niente conflitti).

## Cosa c'è (funzionante)
- **Auth** email/password + collegamento utente↔tecnico (`tecnico.user_id`), con
  cache offline del tecnico e gate per gli stati limite (account non collegato,
  disattivato, offline al primo accesso). Ruolo `tecnico` / `admin`.
- **I miei sopralluoghi** — lista del tecnico (da fare / completati), overlay locale.
- **Compilazione** (schermata di campo) — checklist per voce con Conforme /
  Non conforme / N.A., note, foto (ridimensionate + geo), generazione di azioni
  correttive e scadenze ricorrenti, **giro precedente** (verifica/chiusura delle
  azioni aperte dei sopralluoghi precedenti dello stesso incarico).
- **Le mie cose da fare** — azioni assegnate al tecnico, con transizioni di stato.
- **Report** (cliente / interno) via Edge Function `genera-report`.
- **Back-office** (solo admin):
  - **Anagrafiche** — clienti (ragione sociale, referente, telefono, email, località, indirizzo, geo, ID Werp)
    e relativi incarichi (tipo attività, n. sopralluoghi, periodo, durata, stato).
    L'incarico si può definire **per cadenza** (1 ogni X giorni/settimane/mesi, con
    il numero di sopralluoghi calcolato in automatico) o a **numero fisso**.
    È il blocco a monte della pianificazione: il tipo attività dell'incarico si
    aggancia a un template attivo. Disattivazione/chiusura con guardie sulle FK
    (niente eliminazione se ci sono incarichi/sedute collegati).
  - **Template** — editor del modello "form configurabile": voci di primo livello
    e sotto-domande, tipi (scelta / multiscelta / testo / data / numero / slider /
    foto / rilievo), opzioni con stato logico e generazione azione, scadenza
    ricorrente, foto richieste, min/max, ripetibilità. Versionamento sicuro: un
    template già usato non si modifica a ritroso (si crea una nuova versione e si
    archivia la precedente); duplica e archivia/riattiva.
  - **Pianificazione** — elenco incarichi con avanzamento; genera le sedute fino a
    `n_sopralluoghi` con **date proposte** distribuite uniformemente nel periodo
    (evitando sabati, domeniche e festività nazionali; date modificabili), e
    assegna tecnico / data / durata / località per ciascuna.
- **Sync offline** — coda outbox, drain in ordine, upload foto su Storage.

## Struttura
```
app-sopralluoghi/
├─ index.html
├─ package.json
├─ vite.config.ts          # PWA (vite-plugin-pwa)
├─ tsconfig.json
├─ .env.local.example      # copia in .env.local
├─ supabase/
│  ├─ migrations/          # 001 schema+RLS+foto · 002 form model · 003-004 seed
│  │                       # 005 bucket report · 006 ruolo · 007 cadenza incarico · 008 contatti cliente
│  └─ functions/genera-report/   # Edge Function report (HTML/PDF + email)
├─ mockups/                # riferimenti HTML (campo / report)
└─ src/
   ├─ main.tsx
   ├─ App.tsx              # AuthProvider + gate; admin -> back-office, tecnico -> campo
   ├─ AuthProvider.tsx
   ├─ Login.tsx
   ├─ MieiSopralluoghi.tsx
   ├─ MieCoseDaFare.tsx
   ├─ Compilazione.tsx
   ├─ admin/              # back-office (solo admin)
   │  ├─ BackOffice.tsx    # shell + tab Anagrafiche / Template / Pianificazione
   │  ├─ Anagrafiche.tsx   # clienti + incarichi (scheda + editor)
   │  ├─ TemplateList.tsx  # elenco + nuovo / duplica / archivia
   │  ├─ TemplateEditor.tsx# editor albero voci + config + versionamento
   │  ├─ Pianificazione.tsx# incarichi + genera/assegna sedute
   │  └─ ui.ts             # stile condiviso del back-office
   └─ lib/
      ├─ types.ts
      ├─ supabase.ts
      ├─ db.ts             # Dexie + outbox
      ├─ sync.ts           # resize foto, coda, drain -> server
      ├─ auth.ts           # signIn/out + risolviTecnico (con ruolo)
      ├─ sopralluoghi.ts
      ├─ azioni.ts         # cose da fare + giro precedente
      ├─ report.ts         # client della Edge Function report
      ├─ compilazione.ts   # apertura checklist + azioni + stato sopralluogo
      └─ admin/            # strato dati del back-office (online-first)
         ├─ anagrafiche.ts  # CRUD clienti + incarichi (con guardie FK)
         ├─ templates.ts    # CRUD template + versionamento
         └─ pianificazione.ts # incarichi, sedute, tecnici
```

## Avvio
1. Crea un progetto Supabase e applica le migration in ordine (`supabase db push`,
   oppure incolla i file di `supabase/migrations/` nello SQL editor: 001 → 008).
2. `cp .env.local.example .env.local` e compila:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
3. `npm install`
4. `npm run dev`

Per pubblicarla online (PWA installabile, anche da telefono) vedi **`DEPLOY.md`**
(deploy su Vercel con build automatica a ogni push).

> Le versioni in `package.json` sono indicative: `npm install` le risolve; puoi
> aggiornarle con `npm outdated`. Se `tsc` segnala qualche tipo da rifinire,
> sono ritocchi locali, non problemi di logica.

## Collegamento utente↔tecnico e ruoli
L'app non crea account: l'amministratore crea l'utente in Supabase (Auth → Add
user) e scrive il suo UUID in `tecnico.user_id`
(`update tecnico set user_id = '<auth-uid>' where id = '<tecnico-id>';`).
Finché il legame non c'è, il gate mostra "Account non collegato".

Per dare accesso al back-office, imposta il ruolo:
`update tecnico set ruolo = 'admin' where id = '<tecnico-id>';`
(default `tecnico`). In Fase 1 le policy RLS restano "staff_full": il gate del
ruolo vive nell'app; con il portale cliente (Fase 3) si stringeranno lato DB.

## Cosa manca (prossimi blocchi)
- **Prefetch offline** dei sopralluoghi/template pianificati (per il campo senza rete).
- **Pianificazione assistita** — distribuzione automatica delle date nel periodo
  ✓ (con esclusione di weekend/festività); resta da fare: scelta del tecnico in
  base a `capienza_ore_settimana` e distanza dalla base, viste calendario/carico,
  ed eventuale esclusione dei santi patroni locali.
- **Integrazione Werp** (campi `werp_id` / `werp_attivita_id` già predisposti) — da
  chiarire col fornitore: API REST / accesso DB / import-export file.
- Scadenze ricorrenti: rigenerazione del ciclo successivo alla verifica.
