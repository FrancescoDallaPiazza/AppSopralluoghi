// Riepilogo formativo del cliente in SOLA LETTURA, per la consultazione durante
// il sopralluogo (sheet della Compilazione). Carica online lo stato calcolato
// dal modulo Formazione; offline mostra un avviso (come il "giro precedente").
// Eredita la palette del campo (var --ok/--no/--hi su .compila) con fallback.

import { useEffect, useState } from 'react';
import {
  type RiepilogoCliente, type StatoRequisito,
  valutaCliente, nomePersona,
} from './lib/admin/formazione';

const TXT: Record<StatoRequisito, string> = {
  conforme: 'Conforme', in_scadenza: 'In scadenza', critico: 'Critico', esonerato: 'Esonerato',
};

const CSS = `
.fzr{font-size:13px;}
.fzr-tot{display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;}
.fzr-sem{font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; white-space:nowrap;}
.fzr-sem.conforme{background:var(--ok-bg,#e7f5ec); color:var(--ok,#1f9d57);}
.fzr-sem.in_scadenza{background:#fbf0d6; color:var(--hi-dark,#9a6206);}
.fzr-sem.critico{background:var(--no-bg,#fbeae6); color:var(--no,#d8442f);}
.fzr-sem.esonerato{background:#e8eefc; color:#27508f;}
.fzr-p{border:1px solid var(--line,#e3ddd2); border-radius:12px; padding:12px; margin-bottom:10px; background:var(--card,#fff);}
.fzr-p-top{display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:6px;}
.fzr-fig{color:var(--ink-soft,#5b5f66); font-size:11.5px; margin-top:2px;}
.fzr-r{padding:7px 0; border-top:1px solid var(--line,#e3ddd2);}
.fzr-r-main{display:flex; align-items:center; justify-content:space-between; gap:10px;}
.fzr-dot{width:10px; height:10px; border-radius:50%; flex:0 0 auto;}
.fzr-dot.conforme{background:var(--ok,#1f9d57);}
.fzr-dot.in_scadenza{background:var(--hi,#f4a012);}
.fzr-dot.critico{background:var(--no,#d8442f);}
.fzr-dot.esonerato{background:#3b6fd0;}
.fzr-d{color:var(--ink-soft,#5b5f66); font-size:11.5px; margin-top:2px;}
.fzr-hint{font-size:11.5px; color:#27508f; background:#eef3fc; border-radius:8px; padding:5px 8px; margin-top:5px; line-height:1.4;}
`;

export default function FormazioneRiepilogo({ clienteId }: { clienteId: string | null }) {
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [riep, setRiep] = useState<RiepilogoCliente | null>(null);

  useEffect(() => {
    if (!clienteId) { setStato('errore'); return; }
    let vivo = true;
    setStato('loading');
    valutaCliente(clienteId)
      .then((r) => { if (vivo) { setRiep(r); setStato('ok'); } })
      .catch(() => { if (vivo) setStato('errore'); });
    return () => { vivo = false; };
  }, [clienteId]);

  if (!clienteId) return <div className="empty">Cliente non collegato a questo sopralluogo.</div>;
  if (stato === 'loading') return <p className="muted">Carico lo stato formativo…</p>;
  if (stato === 'errore' || !riep) {
    return <div className="empty">Serve la connessione per consultare la formazione del cliente.</div>;
  }
  if (riep.persone.length === 0) {
    return <div className="empty">Nessuna persona in organigramma per questo cliente.</div>;
  }

  return (
    <div className="fzr">
      <style>{CSS}</style>
      <div className="fzr-tot">
        <span className="fzr-sem conforme">{riep.conteggi.conforme} conformi</span>
        <span className="fzr-sem in_scadenza">{riep.conteggi.in_scadenza} in scadenza</span>
        <span className="fzr-sem critico">{riep.conteggi.critico} critici</span>
      </div>

      {riep.persone.map((pv) => (
        <div key={pv.persona.id} className="fzr-p">
          <div className="fzr-p-top">
            <div>
              <b>{nomePersona(pv.persona)}</b>
              <div className="fzr-fig">{pv.figure.map((f) => f.nome).join(' · ') || 'nessuna figura'}</div>
            </div>
            <span className={'fzr-sem ' + pv.stato}>{TXT[pv.stato]}</span>
          </div>
          {pv.requisiti.map((r) => (
            <div key={r.corso_codice} className="fzr-r">
              <div className="fzr-r-main">
                <span>{r.corso_nome}{r.ore != null ? ' · ' + r.ore + 'h' : ''}</span>
                <span className={'fzr-dot ' + r.stato} title={TXT[r.stato]} />
              </div>
              <div className="fzr-d">{r.dettaglio}</div>
              {r.promemoria.map((a) => (
                <div key={a.id} className="fzr-hint">
                  {a.descrizione}{a.riferimento_norm ? ' — ' + a.riferimento_norm : ''}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
