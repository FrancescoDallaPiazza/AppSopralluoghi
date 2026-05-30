// Schermata "I miei sopralluoghi" (tecnico) — prima scheda, accanto a
// "Le mie cose da fare". Stesso accesso, nessun login separato.
//
// Dati: legge dal server i sopralluoghi assegnati (con cliente/tipo attività)
// e sovrappone le modifiche locali via Dexie liveQuery (offline-safe).

import { useEffect, useMemo, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from './lib/db';
import {
  caricaMieiSopralluoghi,
  type SopralluogoConContesto,
} from './lib/sopralluoghi';
import type { Sopralluogo, SopralluogoStato } from './lib/types';

// ---------- helpers ----------
const oggiISO = () => new Date().toISOString().slice(0, 10);
const fmt = (d: string | null) => {
  if (!d) return '—';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y}`;
};
const inRitardo = (s: SopralluogoConContesto) =>
  s.stato === 'pianificato' &&
  s.data_pianificata != null &&
  s.data_pianificata < oggiISO();

const DA_FARE: SopralluogoStato[] = ['pianificato', 'in_corso'];
const isDaFare = (s: SopralluogoConContesto) => DA_FARE.includes(s.stato);

const LABEL_STATO: Record<SopralluogoStato, string> = {
  pianificato: 'Pianificato',
  in_corso: 'In corso',
  completato: 'Completato',
  sincronizzato: 'Sincronizzato',
};

// ---------- hook dati: server + overlay locale ----------
function useMieiSopralluoghi(tecnicoId: string) {
  const [base, setBase] = useState<SopralluogoConContesto[]>([]);
  const [locali, setLocali] = useState<Record<string, Sopralluogo>>({});
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');

  // 1) contesto dal server
  useEffect(() => {
    let vivo = true;
    setStato('loading');
    caricaMieiSopralluoghi(tecnicoId)
      .then((s) => vivo && (setBase(s), setStato('ok')))
      .catch(() => vivo && setStato('errore'));
    return () => {
      vivo = false;
    };
  }, [tecnicoId]);

  // 2) overlay locale. NB: tecnico_id non è indicizzato in Dexie -> filtro in
  // memoria (il DB locale contiene comunque solo i dati di questo device).
  useEffect(() => {
    const sub = liveQuery(() => db.sopralluoghi.toArray()).subscribe({
      next: (rows) => {
        const map: Record<string, Sopralluogo> = {};
        for (const r of rows) if (r.tecnico_id === tecnicoId) map[r.id] = r;
        setLocali(map);
      },
    });
    return () => sub.unsubscribe();
  }, [tecnicoId]);

  const sopralluoghi = useMemo<SopralluogoConContesto[]>(() => {
    const visti = new Set(base.map((b) => b.id));
    const out = base.map((b) => (locali[b.id] ? { ...b, ...locali[b.id] } : b));
    for (const id in locali) {
      if (!visti.has(id)) {
        out.push({ ...locali[id], cliente_nome: null, cliente_id: null, tipo_attivita: null });
      }
    }
    return out;
  }, [base, locali]);

  return { sopralluoghi, stato };
}

// ---------- icone ----------
const Icon = {
  cal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9h17M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ---------- componente ----------
interface Props {
  tecnicoId: string;
  tecnicoNome?: string;
  onApriCoseDaFare?: () => void;
  onApriSopralluogo?: (s: SopralluogoConContesto) => void;
}

export default function MieiSopralluoghi({
  tecnicoId,
  tecnicoNome,
  onApriCoseDaFare,
  onApriSopralluogo,
}: Props) {
  const { sopralluoghi, stato } = useMieiSopralluoghi(tecnicoId);
  const [filtro, setFiltro] = useState<'da_fare' | 'completati'>('da_fare');

  const daFare = sopralluoghi.filter(isDaFare);
  const ritardo = daFare.filter(inRitardo).length;

  const lista = useMemo(() => {
    const sel =
      filtro === 'da_fare' ? daFare : sopralluoghi.filter((s) => !isDaFare(s));
    return [...sel].sort((a, b) => {
      if (filtro === 'da_fare') {
        const ra = inRitardo(a) ? 0 : 1;
        const rb = inRitardo(b) ? 0 : 1;
        if (ra !== rb) return ra - rb;
        const da = a.data_pianificata ?? '9999';
        const db_ = b.data_pianificata ?? '9999';
        return da < db_ ? -1 : da > db_ ? 1 : 0;
      }
      const da = a.data_effettiva ?? a.data_pianificata ?? '';
      const db_ = b.data_effettiva ?? b.data_pianificata ?? '';
      return da < db_ ? 1 : -1; // più recenti in alto
    });
  }, [sopralluoghi, daFare, filtro]);

  return (
    <div className="misopr">
      <style>{CSS}</style>
      <div className="phone">
        <header>
          <div className="h-pad">
            <div className="h-row">
              <div className="h-title">I miei sopralluoghi</div>
              <div className="h-user">
                <span>{tecnicoNome ?? 'Io'}</span>
                <span className="ava">
                  {(tecnicoNome ?? 'IO').slice(0, 2).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="tabs">
              <button className="tab on">I miei sopralluoghi</button>
              <button className="tab" onClick={onApriCoseDaFare}>
                Le mie cose da fare
              </button>
            </div>
          </div>
        </header>

        <main>
          <div className="bar-row">
            <div className="seg-filter">
              <button
                className={filtro === 'da_fare' ? 'on' : ''}
                onClick={() => setFiltro('da_fare')}
              >
                Da fare · {daFare.length}
              </button>
              <button
                className={filtro === 'completati' ? 'on' : ''}
                onClick={() => setFiltro('completati')}
              >
                Completati
              </button>
            </div>
            {filtro === 'da_fare' && ritardo > 0 && (
              <div className="late-note">{ritardo} in ritardo</div>
            )}
          </div>

          {stato === 'loading' && <p className="muted">Carico i sopralluoghi…</p>}
          {stato === 'errore' && (
            <p className="muted">
              Non riesco a contattare il server. Eventuali modifiche fatte sul
              dispositivo restano salvate e si sincronizzano al ritorno della rete.
            </p>
          )}
          {stato !== 'loading' && lista.length === 0 && (
            <p className="empty">
              {filtro === 'da_fare'
                ? 'Nessun sopralluogo da fare.'
                : 'Nessun sopralluogo completato.'}
            </p>
          )}

          {lista.map((s) => {
            const late = inRitardo(s);
            const fonte = [s.tipo_attivita, s.progressivo].filter(Boolean).join(' · ');
            return (
              <button
                key={s.id}
                className={'it s-' + s.stato + (late ? ' late' : '')}
                onClick={() => onApriSopralluogo?.(s)}
              >
                <div className="it-body">
                  <div className="it-top">
                    <div className="it-cliente">{s.cliente_nome ?? 'Cliente —'}</div>
                    <span className={'badge ' + s.stato}>{LABEL_STATO[s.stato]}</span>
                  </div>
                  {fonte && <div className="it-src">{fonte}</div>}
                  <div className="it-meta">
                    <span className={'m' + (late ? ' late' : '')}>
                      {Icon.cal}
                      {late ? 'In ritardo · ' : ''}
                      {fmt(s.data_pianificata)}
                    </span>
                    {s.localita && (
                      <span className="m">
                        {Icon.pin}
                        {s.localita}
                      </span>
                    )}
                  </div>
                </div>
                <span className="it-go">{Icon.chevron}</span>
              </button>
            );
          })}
        </main>
      </div>
    </div>
  );
}

// ---------- stile (stessa palette dei mockup) ----------
const CSS = `
.misopr{
  --disp:-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",sans-serif;
  --ink:#16181c; --ink-soft:#5b5f66; --faint:#8a8f97; --line:#e3ddd2;
  --paper:#f5f2ec; --card:#fff;
  --hi:#f4a012; --hi-dark:#9a6206;
  --ok:#1f9d57; --ok-bg:#e7f5ec;
  --no:#d8442f; --no-bg:#fbeae6;
  --na-bg:#eceae5;
  --shadow:0 1px 0 rgba(0,0,0,.04),0 8px 24px -16px rgba(0,0,0,.25);
  font-family:var(--disp); color:var(--ink);
  background:#d9d4ca; display:flex; justify-content:center; min-height:100vh;
}
.misopr *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
.misopr .phone{width:100%; max-width:440px; background:var(--paper); min-height:100vh;
  display:flex; flex-direction:column; box-shadow:0 0 60px -20px rgba(0,0,0,.5);}

.misopr header{position:sticky; top:0; z-index:20; background:var(--ink); color:#fff; border-bottom:3px solid var(--hi);}
.misopr .h-pad{padding:13px 16px 0;}
.misopr .h-row{display:flex; align-items:center; justify-content:space-between; gap:10px;}
.misopr .h-title{font-weight:800; font-size:18px; letter-spacing:-.2px;}
.misopr .h-user{display:flex; align-items:center; gap:8px; font-size:12.5px; color:#c7cad0; font-weight:600;}
.misopr .ava{width:28px;height:28px;border-radius:50%;background:var(--hi);color:#1a1205;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;}
.misopr .tabs{display:flex; gap:22px; margin-top:12px;}
.misopr .tab{background:none; border:none; color:#9aa0a8; font-family:var(--disp); font-weight:700; font-size:13.5px;
  padding:0 0 11px; cursor:pointer; position:relative;}
.misopr .tab.on{color:#fff;}
.misopr .tab.on::after{content:""; position:absolute; left:0; right:0; bottom:0; height:3px; background:var(--hi); border-radius:3px 3px 0 0;}

.misopr main{flex:1; padding:14px 14px 40px;}
.misopr .bar-row{display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px;}
.misopr .seg-filter{display:flex; gap:6px; background:#ece7dd; padding:4px; border-radius:11px;}
.misopr .seg-filter button{border:none; background:transparent; color:var(--ink-soft); font-family:var(--disp);
  font-weight:700; font-size:12.5px; padding:7px 13px; border-radius:8px; cursor:pointer;}
.misopr .seg-filter button.on{background:#fff; color:var(--ink); box-shadow:var(--shadow);}
.misopr .late-note{font-size:11.5px; font-weight:700; color:var(--no); background:var(--no-bg);
  padding:6px 10px; border-radius:8px;}

.misopr .muted{color:var(--ink-soft); font-size:13px; padding:10px 4px; line-height:1.5;}
.misopr .empty{text-align:center; color:var(--ink-soft); font-size:13px; padding:36px 12px;}

.misopr .it{width:100%; text-align:left; display:flex; align-items:center; gap:6px;
  background:var(--card); border:1px solid var(--line); border-left:4px solid var(--faint);
  border-radius:14px; margin-bottom:10px; padding:13px 12px 13px 14px; cursor:pointer;
  box-shadow:var(--shadow); font-family:var(--disp); transition:border-color .2s;}
.misopr .it:active{transform:scale(.995);}
.misopr .it.s-in_corso{border-left-color:var(--hi);}
.misopr .it.s-completato,.misopr .it.s-sincronizzato{border-left-color:var(--ok); opacity:.82;}
.misopr .it.late{border-left-color:var(--no);}
.misopr .it-body{flex:1; min-width:0;}
.misopr .it-top{display:flex; align-items:flex-start; justify-content:space-between; gap:10px;}
.misopr .it-cliente{font-size:14.5px; font-weight:700; line-height:1.3;}
.misopr .it-src{font-size:11.5px; color:var(--faint); margin-top:3px;}
.misopr .it-meta{display:flex; align-items:center; gap:14px; margin-top:9px; flex-wrap:wrap;}
.misopr .m{display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600; color:var(--ink-soft);}
.misopr .m svg{width:14px;height:14px;}
.misopr .m.late{color:var(--no);}
.misopr .it-go{color:var(--faint); flex-shrink:0;}
.misopr .it-go svg{width:18px;height:18px; display:block;}
.misopr .badge{font-size:10.5px; font-weight:700; letter-spacing:.03em; padding:3px 9px; border-radius:7px; white-space:nowrap;}
.misopr .badge.pianificato{background:var(--na-bg); color:#555;}
.misopr .badge.in_corso{background:#fbeccb; color:var(--hi-dark);}
.misopr .badge.completato,.misopr .badge.sincronizzato{background:var(--ok-bg); color:var(--ok);}
`;
