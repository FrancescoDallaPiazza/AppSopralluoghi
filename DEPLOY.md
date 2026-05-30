# Deploy su Vercel

L'app è una PWA statica (Vite + React). Vercel la builda a ogni push su `main`
e la serve a un URL pubblico, installabile su telefono.

## Prima pubblicazione (una volta sola)
1. Vai su https://vercel.com e accedi **con GitHub** (Continue with GitHub).
2. **Add New… → Project** → trova **AppSopralluoghi** nella lista dei repo → **Import**.
3. Vercel riconosce da solo il preset **Vite** (build `npm run build`, output `dist`,
   già fissati anche in `vercel.json`): non toccare nulla.
4. Apri **Environment Variables** e aggiungi le due chiavi di Supabase
   (Supabase → Settings → API):
   ```
   VITE_SUPABASE_URL       = https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY  = eyJ...   (anon public)
   ```
   Lasciale per tutti gli ambienti (Production / Preview / Development).
5. **Deploy**. Dopo ~1 minuto ottieni un URL tipo
   `https://appsopralluoghi.vercel.app`: è l'app, lì fai login.

## Aggiornamenti
A ogni `git push origin main` Vercel ribuilda e pubblica da solo. Il service
worker è `autoUpdate`: alla riapertura l'app prende l'ultima versione (gli header
in `vercel.json` evitano che `sw.js`/manifest restino in cache).

## Note
- Le variabili `VITE_*` finiscono nel bundle client: va bene **solo** la chiave
  *anon* di Supabase (mai la service role), protetta dalle policy RLS.
- Supabase Auth funziona da subito su domini https come quello di Vercel. Se più
  avanti userai un dominio tuo, aggiungilo in Supabase → Authentication → URL
  Configuration (Site URL / Redirect URLs).
- Installazione su telefono: apri l'URL in Safari/Chrome → "Aggiungi a schermata
  Home"; parte a tutto schermo come app.
