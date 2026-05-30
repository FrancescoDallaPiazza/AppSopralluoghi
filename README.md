# App sopralluoghi

PWA installabile per i sopralluoghi sul campo. **React + Vite + TypeScript** su
**Supabase** (Postgres + Auth + Storage). Offline-first: ogni modifica vive prima
in locale (IndexedDB via Dexie) e in una coda di sincronizzazione; al ritorno
della rete la coda si svuota in ordine con upsert per uuid (niente conflitti).

## Cosa c'è (funzionante)
- **Auth** email/password + collegamento utente↔tecnico (`tecnico.user_id`), con
  cache offline del tecnico e gate per gli stati limite (account non collegato,
  disattivato, offline al primo accesso).
- **I miei sopralluoghi** — lista del tecnico (da fare / completati), overlay locale.
- **Compilazione** (schermata di campo) — checklist per voce con Conforme /
  Non conforme / N.A., note, foto (ridimensionate + geo), generazione di azioni
  correttive e scadenze ricorrenti, **giro precedente** (verifica/chiusura delle
  azioni aperte dei sopralluoghi precedenti dello stesso incarico).
- **Le mie cose da fare** — azioni assegnate al tecnico, con transizioni di stato.
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
│  └─ migrations/001_init.sql   # schema + RLS + bucket foto
├─ mockups/                # riferimenti HTML (campo / report)
└─ src/
   ├─ main.tsx
   ├─ App.tsx              # AuthProvider + gate + shell 2 schede
   ├─ AuthProvider.tsx
   ├─ Login.tsx
   ├─ MieiSopralluoghi.tsx
   ├─ MieCoseDaFare.tsx
   ├─ Compilazione.tsx
   └─ lib/
      ├─ types.ts
      ├─ supabase.ts
      ├─ db.ts             # Dexie + outbox
      ├─ sync.ts           # resize foto, coda, drain -> server
      ├─ auth.ts           # signIn/out + risolviTecnico
      ├─ sopralluoghi.ts
      ├─ azioni.ts         # cose da fare + giro precedente
      └─ compilazione.ts   # apertura checklist + azioni + stato sopralluogo
```

## Avvio
1. Crea un progetto Supabase e applica la migration: `supabase db push`
   (oppure incolla `supabase/migrations/001_init.sql` nello SQL editor).
2. `cp .env.local.example .env.local` e compila:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
3. `npm install`
4. `npm run dev`

> Le versioni in `package.json` sono indicative: `npm install` le risolve; puoi
> aggiornarle con `npm outdated`. Se `tsc` segnala qualche tipo da rifinire,
> sono ritocchi locali, non problemi di logica.

## Collegamento utente↔tecnico
L'app non crea account: l'amministratore crea l'utente in Supabase (Auth → Add
user) e scrive il suo UUID in `tecnico.user_id`
(`update tecnico set user_id = '<auth-uid>' where id = '<tecnico-id>';`).
Finché il legame non c'è, il gate mostra "Account non collegato".

## Cosa manca (prossimi blocchi)
- **Report PDF** dai template in `mockups/` (versione cliente / interna):
  Edge Function con Playwright + invio email (Resend/Postmark). È una lettura
  che assembla `sopralluogo + checklist_compilata + esito_voce + foto + azione`.
- **Back-office**: creazione template checklist e pianificazione sopralluoghi.
- **Prefetch offline** dei sopralluoghi/template pianificati (per il campo senza rete).
- **Integrazione Werp** (campo `werp_attivita_id` già predisposto) — da chiarire
  col fornitore: API REST / accesso DB / import-export file.
- Scadenze ricorrenti: rigenerazione del ciclo successivo alla verifica.
