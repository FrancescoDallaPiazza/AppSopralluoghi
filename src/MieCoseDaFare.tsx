// Schermata "Le mie cose da fare" (utente interno).
// È solo un'altra vista della stessa app: stesso accesso del tecnico, seconda
// scheda accanto a "I miei sopralluoghi". Niente login separato.
//
// Dati: legge dal server le azioni assegnate (con cliente/sopralluogo/voce),
// e sovrappone le modifiche locali via Dexie liveQuery, così i cambi di stato
// compaiono subito e funzionano anche offline (vedi lib/azioni.ts).
//
// Auth: il `tecnicoId` arriva come prop. La risoluzione utente↔tecnico è il
// blocco successivo (login); qui lo riceviamo già risolto.

import { useEffect, useMemo, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from './lib/db';
import {
  caricaMieAzioni,
  cambiaStatoAzione,
  type AzioneConContesto,
} from './lib/azioni';
import type { Azione, AzioneStato } from './lib/types';

// ---------- helpers ----------
const oggiISO = () => new Date().toISOString().slice(0, 10);
const fmt = (d: string | null) => {
  if (!d) return '—';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y}`;
};
const inRitardo = (a: AzioneConContesto) =>
  a.stato !== 'conclusa' && a.data_scadenza != null && a.data_scadenza < oggiISO();

const PESO_PRI: Record<string, number> = { alta: 0, media: 1, bassa: 2 };
const LABEL_STATO: Record<AzioneStato, string> = {
  aperta: 'Aperta',
  in_corso: 'In corso',
  conclusa: 'Conclusa',
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- hook dati: server + overlay locale ----------
function useMieAzioni(tecnicoId: string) {
  const [base, setBase] = useState<AzioneConContesto[]>([]);
  const [locali, setLocali] = useState<Record<string, Azione>>({});
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');

  // 1) carico dal server il contesto (cliente / sopralluogo / voce d'origine)
  useEffect(() => {
    let vivo = true;
    setStato('loading');
    caricaMieAzioni(tecnicoId)
      .then((a) => vivo && (setBase(a), setStato('ok')))
      .catch(() => vivo && setStato('errore'));
    return () => {
      vivo = false;
    };
  }, [tecnicoId]);

  // 2) sovrappongo le modifiche locali (ottimistiche / offline)
  useEffect(() => {
    const sub = liveQuery(() =>
      db.azioni.where('responsabile_interno_id').equals(tecnicoId).toArray(),
    ).subscribe({
      next: (rows) => {
        const map: Record<string, Azione> = {};
        for (const r of rows) map[r.id] = r;
        setLocali(map);
      },
    });
    return () => sub.unsubscribe();
  }, [tecnicoId]);

  const azioni = useMemo<AzioneConContesto[]>(() => {
    const visti = new Set(base.map((b) => b.id));
    const out = base.map((b) =>
      locali[b.id] ? { ...b, stato: locali[b.id].stato } : b,
    );
    // azioni create offline su questo device e non ancora sul server
    for (const id in locali) {
      if (!visti.has(id)) {
        const l = locali[id];
        out.push({
          ...l,
          cliente_nome: null,
          sopralluogo_label: null,
          origine_voce: l.descrizione,
          area_nome: null,
        });
      }
    }
    return out;
  }, [base, locali]);

  return { azioni, stato };
}

// ---------- icone ----------
const Icon = {
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M7 5l11 7-11 7z" strokeLinejoin="round" />
    </svg>
  ),
  undo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 7L4 12l5 5M4 12h10a6 6 0 0 1 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9h17M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  ),
};

// ---------- transizioni di stato ----------
type Btn = { to: AzioneStato; label: string; kind: 'primary' | 'ok' | 'ghost' };
function bottoni(stato: AzioneStato): Btn[] {
  if (stato === 'aperta')
    return [
      { to: 'in_corso', label: 'Prendi in carico', kind: 'primary' },
      { to: 'conclusa', label: 'Risolvi', kind: 'ok' },
    ];
  if (stato === 'in_corso')
    return [
      { to: 'conclusa', label: 'Risolvi', kind: 'ok' },
      { to: 'aperta', label: 'Rimetti in attesa', kind: 'ghost' },
    ];
  return [{ to: 'aperta', label: 'Riapri', kind: 'ghost' }];
}

// ---------- componente ----------
interface Props {
  tecnicoId: string;
  tecnicoNome?: string;
  onApriSopralluoghi?: () => void;
}

export default function MieCoseDaFare({ tecnicoId, tecnicoNome, onApriSopralluoghi }: Props) {
  const { azioni, stato } = useMieAzioni(tecnicoId);
  const [filtro, setFiltro] = useState<'attive' | 'concluse'>('attive');
  const [aperta, setAperta] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const attive = azioni.filter((a) => a.stato !== 'conclusa');
  const ritardo = attive.filter(inRitardo).length;

  const lista = useMemo(() => {
    const sel = filtro === 'attive' ? attive : azioni.filter((a) => a.stato === 'conclusa');
    return [...sel].sort((a, b) => {
      if (filtro === 'attive') {
        const ra = inRitardo(a) ? 0 : 1;
        const rb = inRitardo(b) ? 0 : 1;
        if (ra !== rb) return ra - rb;
        const sa = a.data_scadenza ?? '9999';
        const sb = b.data_scadenza ?? '9999';
        if (sa !== sb) return sa < sb ? -1 : 1;
        return (PESO_PRI[a.priorita] ?? 1) - (PESO_PRI[b.priorita] ?? 1);
      }
      const sa = a.data_scadenza ?? '';
      const sb = b.data_scadenza ?? '';
      return sa < sb ? 1 : -1;
    });
  }, [azioni, attive, filtro]);

  async function transizione(a: AzioneConContesto, to: AzioneStato) {
    setAperta(null);
    await cambiaStatoAzione(a, to, { nota: note[a.id], autoreId: tecnicoId });
    setNote((n) => ({ ...n, [a.id]: '' }));
  }

  return (
    <div className="mcdf">
      <style>{CSS}</style>
      <div className="phone">
        <header>
          <div className="h-pad">
            <div className="h-row">
              <div className="h-title">Le mie cose da fare</div>
              <div className="h-user">
                <span>{tecnicoNome ?? 'Io'}</span>
                <span className="ava">
                  {(tecnicoNome ?? 'IO').slice(0, 2).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="tabs">
              <button className="tab" onClick={onApriSopralluoghi}>
                I miei sopralluoghi
              </button>
              <button className="tab on">Le mie cose da fare</button>
            </div>
          </div>
        </header>

        <main>
          <div className="bar-row">
            <div className="seg-filter">
              <button
                className={filtro === 'attive' ? 'on' : ''}
                onClick={() => setFiltro('attive')}
              >
                Attive · {attive.length}
              </button>
              <button
                className={filtro === 'concluse' ? 'on' : ''}
                onClick={() => setFiltro('concluse')}
              >
                Concluse
              </button>
            </div>
            {filtro === 'attive' && ritardo > 0 && (
              <div className="late-note">{ritardo} in ritardo</div>
            )}
          </div>

          {stato === 'loading' && <p className="muted">Carico le tue attività…</p>}
          {stato === 'errore' && (
            <p className="muted">
              Non riesco a contattare il server. Le modifiche che fai restano
              comunque salvate e si sincronizzano al ritorno della rete.
            </p>
          )}
          {stato !== 'loading' && lista.length === 0 && (
            <p className="empty">
              {filtro === 'attive'
                ? 'Nessuna attività aperta. Tutto in pari.'
                : 'Nessuna attività conclusa.'}
            </p>
          )}

          {lista.map((a) => {
            const late = inRitardo(a);
            const isOpen = aperta === a.id;
            const fonte = [a.cliente_nome, a.sopralluogo_label].filter(Boolean).join(' · ');
            return (
              <div
                key={a.id}
                className={
                  'it' +
                  (a.tipo === 'scadenza_ricorrente' ? ' scad' : '') +
                  (a.stato === 'conclusa' ? ' done' : '') +
                  (isOpen ? ' open' : '')
                }
              >
                <div
                  className="it-head"
                  onClick={() => setAperta(isOpen ? null : a.id)}
                >
                  <div className="it-top">
                    <div className="it-desc">{a.descrizione}</div>
                    {a.tipo !== 'scadenza_ricorrente' && (
                      <span className={'pri ' + a.priorita}>{cap(a.priorita)}</span>
                    )}
                  </div>
                  {fonte && <div className="it-src">{fonte}</div>}
                  <div className="it-meta">
                    <span className={'due' + (late ? ' late' : '')}>
                      {Icon.cal}
                      {late ? 'In ritardo · ' : 'Scad. '}
                      {fmt(a.data_scadenza)}
                    </span>
                    <span className={'badge ' + a.stato}>{LABEL_STATO[a.stato]}</span>
                  </div>
                </div>

                <div className="it-body">
                  <textarea
                    className="note"
                    placeholder="Aggiungi una nota all'aggiornamento…"
                    value={note[a.id] ?? ''}
                    onChange={(e) =>
                      setNote((n) => ({ ...n, [a.id]: e.target.value }))
                    }
                  />
                  <div className="acts">
                    {bottoni(a.stato).map((b) => (
                      <button
                        key={b.to}
                        className={'btn ' + b.kind}
                        onClick={(e) => {
                          e.stopPropagation();
                          void transizione(a, b.to);
                        }}
                      >
                        {b.kind === 'ghost' ? Icon.undo : b.kind === 'ok' ? Icon.check : Icon.play}
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </main>
      </div>
    </div>
  );
}

// ---------- stile (stessa palette dei mockup) ----------
const CSS = `
.mcdf{
  --disp:-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",sans-serif;
  --ink:#16181c; --ink-soft:#5b5f66; --faint:#8a8f97; --line:#e3ddd2;
  --paper:#f5f2ec; --card:#fff;
  --hi:#f4a012; --hi-dark:#9a6206;
  --ok:#1f9d57; --ok-bg:#e7f5ec;
  --no:#d8442f; --no-bg:#fbeae6;
  --na:#8a8f97; --na-bg:#eceae5;
  --shadow:0 1px 0 rgba(0,0,0,.04),0 8px 24px -16px rgba(0,0,0,.25);
  font-family:var(--disp); color:var(--ink);
  background:#d9d4ca; display:flex; justify-content:center; min-height:100vh;
}
.mcdf *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
.mcdf .phone{width:100%; max-width:440px; background:var(--paper); min-height:100vh;
  display:flex; flex-direction:column; box-shadow:0 0 60px -20px rgba(0,0,0,.5);}

.mcdf header{position:sticky; top:0; z-index:20; background:var(--ink); color:#fff; border-bottom:3px solid var(--hi);}
.mcdf .h-pad{padding:13px 16px 0;}
.mcdf .h-row{display:flex; align-items:center; justify-content:space-between; gap:10px;}
.mcdf .h-title{font-weight:800; font-size:18px; letter-spacing:-.2px;}
.mcdf .h-user{display:flex; align-items:center; gap:8px; font-size:12.5px; color:#c7cad0; font-weight:600;}
.mcdf .ava{width:28px;height:28px;border-radius:50%;background:var(--hi);color:#1a1205;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;}
.mcdf .tabs{display:flex; gap:22px; margin-top:12px;}
.mcdf .tab{background:none; border:none; color:#9aa0a8; font-family:var(--disp); font-weight:700; font-size:13.5px;
  padding:0 0 11px; cursor:pointer; position:relative;}
.mcdf .tab.on{color:#fff;}
.mcdf .tab.on::after{content:""; position:absolute; left:0; right:0; bottom:0; height:3px; background:var(--hi); border-radius:3px 3px 0 0;}

.mcdf main{flex:1; padding:14px 14px 40px;}
.mcdf .bar-row{display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px;}
.mcdf .seg-filter{display:flex; gap:6px; background:#ece7dd; padding:4px; border-radius:11px;}
.mcdf .seg-filter button{border:none; background:transparent; color:var(--ink-soft); font-family:var(--disp);
  font-weight:700; font-size:12.5px; padding:7px 13px; border-radius:8px; cursor:pointer;}
.mcdf .seg-filter button.on{background:#fff; color:var(--ink); box-shadow:var(--shadow);}
.mcdf .late-note{font-size:11.5px; font-weight:700; color:var(--no); background:var(--no-bg);
  padding:6px 10px; border-radius:8px;}

.mcdf .muted{color:var(--ink-soft); font-size:13px; padding:10px 4px; line-height:1.5;}
.mcdf .empty{text-align:center; color:var(--ink-soft); font-size:13px; padding:36px 12px;}

.mcdf .it{background:var(--card); border:1px solid var(--line); border-left:4px solid var(--no);
  border-radius:14px; margin-bottom:10px; overflow:hidden; box-shadow:var(--shadow); transition:border-color .2s;}
.mcdf .it.scad{border-left-color:var(--hi);}
.mcdf .it.done{border-left-color:var(--ok); opacity:.72;}
.mcdf .it-head{padding:13px 14px; cursor:pointer;}
.mcdf .it-top{display:flex; align-items:flex-start; justify-content:space-between; gap:10px;}
.mcdf .it-desc{font-size:14.5px; font-weight:600; line-height:1.35;}
.mcdf .it-src{font-size:11.5px; color:var(--faint); margin-top:4px;}
.mcdf .it-meta{display:flex; align-items:center; gap:10px; margin-top:10px; flex-wrap:wrap;}
.mcdf .due{display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600; color:var(--ink-soft);}
.mcdf .due svg{width:14px;height:14px;}
.mcdf .due.late{color:var(--no);}
.mcdf .pri{font-size:10.5px; font-weight:700; letter-spacing:.03em; padding:3px 9px; border-radius:7px; white-space:nowrap;}
.mcdf .pri.alta{background:var(--no-bg); color:var(--no);}
.mcdf .pri.media{background:#fbeccb; color:var(--hi-dark);}
.mcdf .pri.bassa{background:var(--ok-bg); color:var(--ok);}
.mcdf .badge{font-size:10.5px; font-weight:700; letter-spacing:.03em; padding:3px 9px; border-radius:7px; white-space:nowrap; margin-left:auto;}
.mcdf .badge.aperta{background:var(--no-bg); color:var(--no);}
.mcdf .badge.in_corso{background:#fbeccb; color:var(--hi-dark);}
.mcdf .badge.conclusa{background:var(--ok-bg); color:var(--ok);}

.mcdf .it-body{display:none; padding:0 14px 14px; animation:mcdf-slide .2s ease;}
.mcdf .it.open .it-body{display:block;}
@keyframes mcdf-slide{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:none;}}
.mcdf .note{width:100%; border:1px solid var(--line); border-radius:10px; background:#fbfaf7;
  padding:10px 11px; font-family:inherit; font-size:13.5px; color:var(--ink); resize:none; min-height:44px; margin-bottom:10px;}
.mcdf .note:focus{outline:none; border-color:var(--hi); background:#fff;}
.mcdf .acts{display:flex; gap:8px; flex-wrap:wrap;}
.mcdf .btn{flex:1; min-width:120px; border:1px solid var(--line); background:#fff; color:var(--ink);
  font-family:var(--disp); font-weight:700; font-size:13px; padding:11px 8px; border-radius:10px; cursor:pointer;
  display:flex; align-items:center; justify-content:center; gap:7px;}
.mcdf .btn svg{width:16px;height:16px;}
.mcdf .btn:active{transform:scale(.98);}
.mcdf .btn.primary{background:var(--ink); color:#fff; border-color:var(--ink);}
.mcdf .btn.ok{background:var(--ok); color:#fff; border-color:var(--ok);}
.mcdf .btn.ghost{background:#fbfaf7; color:var(--ink-soft);}
`;
