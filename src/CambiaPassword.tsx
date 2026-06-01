// Overlay "Cambia password" per l'utente già autenticato (caso 6 del flusso
// auth). A differenza di ImpostaPassword (che gestisce invito/recovery), qui
// l'utente è dentro l'app: cambia la password e l'overlay si chiude.

import { useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';

export default function CambiaPassword({ onChiudi }: { onChiudi: () => void }) {
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState(false);

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
      setFatto(true);
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      setErrore(
        /should be different|same as the old/i.test(msg)
          ? 'La nuova password deve essere diversa da quella attuale.'
          : 'Cambio non riuscito. Riprova.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="cpw-back" onClick={onChiudi}>
      <style>{CSS}</style>
      <form className="cpw-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="cpw-h">
          <div className="cpw-title">Cambia password</div>
          <button type="button" className="cpw-x" onClick={onChiudi} aria-label="Chiudi">×</button>
        </div>

        {fatto ? (
          <>
            <p className="cpw-ok">Password aggiornata. Userai la nuova al prossimo accesso.</p>
            <button type="button" className="cpw-cta" onClick={onChiudi}>Chiudi</button>
          </>
        ) : (
          <>
            <label className="cpw-field">
              <span>Nuova password</span>
              <input type="password" autoComplete="new-password" value={pwd}
                onChange={(e) => setPwd(e.target.value)} required minLength={8} disabled={busy} />
            </label>
            <label className="cpw-field">
              <span>Ripeti la password</span>
              <input type="password" autoComplete="new-password" value={pwd2}
                onChange={(e) => setPwd2(e.target.value)} required minLength={8} disabled={busy} />
            </label>
            <p className="cpw-hint">Almeno 8 caratteri.</p>
            {errore && <div className="cpw-err">{errore}</div>}
            <button className="cpw-cta" type="submit" disabled={busy}>
              {busy ? 'Salvo…' : 'Salva nuova password'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

const CSS = `
.cpw-back{position:fixed;inset:0;z-index:10000;background:rgba(20,22,26,.55);
  display:flex;align-items:center;justify-content:center;padding:20px;
  font-family:-apple-system,system-ui,sans-serif;}
.cpw-card{width:100%;max-width:340px;background:#fffdf9;border:1px solid #c9c2b4;
  border-radius:16px;padding:18px;box-shadow:0 24px 60px -24px rgba(0,0,0,.6);}
.cpw-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.cpw-title{font-weight:800;font-size:16px;color:#16181c;}
.cpw-x{border:none;background:none;font-size:24px;line-height:1;color:#8a8f97;cursor:pointer;padding:0 2px;}
.cpw-field{display:block;margin-bottom:11px;}
.cpw-field span{display:block;font-size:11.5px;font-weight:700;color:#5b5f66;margin-bottom:5px;}
.cpw-field input{width:100%;box-sizing:border-box;border:1px solid #c9c2b4;border-radius:10px;
  padding:10px 12px;font-size:15px;background:#fbf9f4;outline:none;}
.cpw-field input:focus{border-color:#e8a33d;background:#fff;}
.cpw-hint{font-size:11.5px;color:#7c8088;margin:0 0 12px;}
.cpw-err{background:#fdecec;border:1px solid #f3b4b4;color:#a12626;border-radius:10px;
  padding:9px 12px;font-size:12.5px;margin-bottom:12px;}
.cpw-ok{background:#e7f3ea;border:1px solid #b6dcc1;color:#256b3a;border-radius:10px;
  padding:10px 12px;font-size:13px;margin:0 0 14px;line-height:1.45;}
.cpw-cta{width:100%;border:none;border-radius:10px;padding:12px;font-weight:800;font-size:15px;
  background:#e8a33d;color:#1b1205;cursor:pointer;}
.cpw-cta:disabled{opacity:.6;cursor:default;}
`;
