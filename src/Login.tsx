import { useState, type FormEvent } from 'react';
import { signIn } from './lib/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErrore(null);
    setBusy(true);
    try {
      await signIn(email, password);
      // al successo AuthProvider intercetta il login e prosegue da solo
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      setErrore(
        /invalid login credentials/i.test(msg)
          ? 'Email o password non corretti.'
          : /email not confirmed/i.test(msg)
            ? 'Email non ancora confermata.'
            : 'Accesso non riuscito. Riprova.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <style>{CSS}</style>
      <form className="card" onSubmit={submit}>
        <div className="brand">Sopralluoghi</div>
        <div className="accent" />
        <p className="sub">Accedi con le credenziali del tuo account.</p>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
          />
        </label>

        {errore && <div className="err">{errore}</div>}

        <button className="cta" type="submit" disabled={busy}>
          {busy ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
    </div>
  );
}

const CSS = `
.login{
  --ink:#16181c; --ink-soft:#5b5f66; --line:#e3ddd2; --paper:#f5f2ec;
  --hi:#f4a012; --no:#d8442f; --no-bg:#fbeae6;
  font-family:-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",sans-serif;
  background:#d9d4ca; color:var(--ink);
  min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px;
}
.login *{box-sizing:border-box;}
.login .card{
  width:100%; max-width:380px; background:#fff; border:1px solid var(--line);
  border-radius:16px; padding:26px 24px 24px; box-shadow:0 18px 50px -28px rgba(0,0,0,.55);
}
.login .brand{font-weight:800; font-size:22px; letter-spacing:-.3px;}
.login .accent{height:3px; width:46px; background:var(--hi); border-radius:3px; margin:10px 0 14px;}
.login .sub{font-size:13px; color:var(--ink-soft); margin:0 0 18px; line-height:1.45;}
.login .field{display:block; margin-bottom:13px;}
.login .field span{display:block; font-size:11.5px; font-weight:600; color:var(--ink-soft); margin-bottom:5px; letter-spacing:.02em;}
.login .field input{
  width:100%; -webkit-appearance:none; appearance:none; border:1px solid var(--line);
  border-radius:10px; padding:12px 12px; font-family:inherit; font-size:15px; background:#fbfaf7; color:var(--ink);
}
.login .field input:focus{outline:none; border-color:var(--hi); background:#fff;}
.login .field input:disabled{opacity:.6;}
.login .err{
  background:var(--no-bg); color:var(--no); border:1px solid #f1c4b9; border-radius:10px;
  padding:9px 11px; font-size:12.5px; font-weight:500; margin:2px 0 14px;
}
.login .cta{
  width:100%; border:none; border-radius:12px; padding:14px; cursor:pointer; margin-top:6px;
  font-family:inherit; font-weight:800; font-size:15px; background:var(--hi); color:#1a1205; transition:.15s;
}
.login .cta:active{transform:scale(.99);}
.login .cta:disabled{opacity:.6; cursor:default;}
`;
