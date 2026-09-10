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
5. **Deploy**. Dopo ~1 minuto l'app è pubblicata. L'indirizzo di produzione è

   **https://app-sopralluoghi.vercel.app** — è lì che si fa login.

   Il trattino conta: fino al 10 settembre 2026 questa riga diceva
   `appsopralluoghi.vercel.app` (senza), che risponde `DEPLOYMENT_NOT_FOUND` —
   un indirizzo scritto a memoria e mai provato.

   **Come si ritrova, se un giorno serve di nuovo.** Il dato non è sul disco:
   sta su GitHub, che registra i deploy.

   ```
   gh api repos/<owner>/<repo>/deployments --jq '.[0] | {id, sha, created_at}'
   gh api repos/<owner>/<repo>/deployments/<id>/statuses --jq '.[0].environment_url'
   ```

   Attenzione a cosa dà e a cosa non dà, perché la differenza è tutta qui:

   | il comando dà | con quanta certezza |
   |---|---|
   | `sha`: **quale commit** è in produzione | **certo**, è il dato che serve per «il push è online?» |
   | `environment_url` | **certo**, ma è l'URL di *quel singolo deploy*, con l'hash dentro (`app-sopralluoghi-m7syhik29-…`), non l'alias stabile |
   | l'alias stabile (`app-sopralluoghi.vercel.app`) | **dedotto** dal nome del progetto che si legge in quella stringa |

   L'ultima riga è una deduzione, quindi **si prova**, non si scrive e basta:
   `curl -s -o /dev/null -w "%{http_code}" -L <url>`. Qui ha dato 200 e la
   variante senza trattino 404 — cioè fidandosi del solo nome si aveva ragione
   per caso. È esattamente l'errore che questa riga aveva già fatto una volta.

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
