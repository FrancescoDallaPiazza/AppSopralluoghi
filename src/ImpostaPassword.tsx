// Schermata "Imposta la tua password". Compare quando l'utente arriva da un
// link d'invito o di recupero password: a quel punto ha una sessione valida ma
// nessuna password scelta. Qui la imposta e poi entra nell'app.

import { useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';

export default function ImpostaPassword({ onFatto }: { onFatto: () => void }) {
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErrore(null);

    if (pwd.trim().length < 8) {
      setErrore('La password deve avere almeno 8 caratteri.');
      return;
    }
    if (pwd !== pwd2) {
      setErrore('Le due password non coincidono.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd.trim() });
      if (error) throw error;
      // password impostata: l'AuthProvider proseguirà col flusso normale
      onFatto();
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      setErrore(
        /should be different|same as the old/i.test(msg)
          ? 'La nuova password deve essere diversa da quella attuale.'
          : /session|jwt|expired|token/i.test(msg)
            ? 'Il link è scaduto. Richiedi un nuovo invito o usa “Password dimenticata”.'
            : 'Impostazione non riuscita. Riprova.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="setpwd">
      <style>{CSS}</style>
      <form className="card" onSubmit={submit}>
        <div className="brand">Sopralluoghi</div>
        <div className="accent" />
        <p className="sub">Imposta la password che userai per accedere all’app.</p>

        <label className="field">
          <span>Nuova password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            required
            disabled={busy}
            minLength={8}
          />
        </label>

        <label className="field">
          <span>Ripeti la password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            required
            disabled={busy}
            minLength={8}
          />
        </label>

        <p className="hint">Almeno 8 caratteri. Tienila riservata.</p>

        {errore && <div className="err">{errore}</div>}

        <button className="cta" type="submit" disabled={busy}>
          {busy ? 'Salvo…' : 'Imposta password ed entra'}
        </button>
      </form>
    </div>
  );
}

const CSS = `
.setpwd{min-height:100vh;display:flex;align-items:center;justify-content:center;
  padding:24px;background:#d9d4ca;font-family:-apple-system,system-ui,sans-serif;color:#16181c}
.setpwd .card{width:100%;max-width:360px;background:#fffdf9;border:1px solid #c9c2b4;
  border-radius:16px;padding:24px;box-shadow:0 18px 40px -24px rgba(0,0,0,.5)}
.setpwd .brand{font-weight:800;font-size:20px;letter-spacing:.2px}
.setpwd .accent{height:3px;width:44px;background:#e8a33d;border-radius:3px;margin:8px 0 14px}
.setpwd .sub{font-size:13.5px;color:#5b5f66;margin:0 0 16px;line-height:1.5}
.setpwd .field{display:block;margin-bottom:12px}
.setpwd .field span{display:block;font-size:12px;font-weight:700;color:#5b5f66;margin-bottom:5px}
.setpwd .field input{width:100%;box-sizing:border-box;border:1px solid #c9c2b4;border-radius:10px;
  padding:10px 12px;font-size:15px;background:#fbf9f4;outline:none}
.setpwd .field input:focus{border-color:#e8a33d;background:#fff}
.setpwd .hint{font-size:11.5px;color:#7c8088;margin:2px 0 14px}
.setpwd .err{background:#fdecec;border:1px solid #f3b4b4;color:#a12626;border-radius:10px;
  padding:9px 12px;font-size:12.5px;margin-bottom:12px}
.setpwd .cta{width:100%;border:none;border-radius:10px;padding:12px;font-weight:800;font-size:15px;
  background:#e8a33d;color:#1b1205;cursor:pointer}
.setpwd .cta:disabled{opacity:.6;cursor:default}
`;
