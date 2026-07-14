// Schermata "I miei sopralluoghi" (tecnico) — prima scheda, accanto a
// "Le mie cose da fare". Stesso accesso, nessun login separato.
//
// Dati: legge dal server i sopralluoghi assegnati (con cliente/tipo attività)
// e sovrappone le modifiche locali via Dexie liveQuery (offline-safe).

import { useEffect, useMemo, useState } from 'react';
import { liveQuery } from 'dexie';
import { db, type ContestoSopralluogo } from './lib/db';
import {
  caricaMieiSopralluoghi,
  type SopralluogoConContesto,
} from './lib/sopralluoghi';
import {
  prefetchOffline, leggiPrefetchMeta, cacheLista, type PrefetchMeta,
} from './lib/prefetch';
import type { Sopralluogo, SopralluogoStato } from './lib/types';
import { generaReport, type VarianteReport } from './lib/report';
import { apriRevisione } from './lib/revisioni';
import { supabase } from './lib/supabase';
import BottoneInviaCliente from './BottoneInviaCliente';

// ---------- helpers ----------
const oggiISO = () => new Date().toISOString().slice(0, 10);
const fmt = (d: string | null) => {
  if (!d) return '—';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y}`;
};
const fmtOra = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
  const [contesti, setContesti] = useState<Record<string, ContestoSopralluogo>>({});
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');

  // 1) contesto dal server (e, se va, prepara la cache offline)
  useEffect(() => {
    let vivo = true;
    setStato('loading');
    caricaMieiSopralluoghi(tecnicoId)
      .then((s) => {
        if (!vivo) return;
        setBase(s);
        setStato('ok');
        void cacheLista(s); // il solo aprire la lista online prepara l'offline
      })
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

  // 3) contesto in cache (per le voci offline / local-only)
  useEffect(() => {
    const sub = liveQuery(() => db.contesto.toArray()).subscribe({
      next: (rows) => {
        const map: Record<string, ContestoSopralluogo> = {};
        for (const r of rows) map[r.id] = r;
        setContesti(map);
      },
    });
    return () => sub.unsubscribe();
  }, []);

  const sopralluoghi = useMemo<SopralluogoConContesto[]>(() => {
    const visti = new Set(base.map((b) => b.id));
    const out = base.map((b) => (locali[b.id] ? { ...b, ...locali[b.id] } : b));
    for (const id in locali) {
      if (!visti.has(id)) {
        const c = contesti[id];
        out.push({
          ...locali[id],
          cliente_nome: c?.cliente_nome ?? null,
          cliente_id: c?.cliente_id ?? null,
          tipo_attivita: c?.tipo_attivita ?? null,
        });
      }
    }
    return out;
  }, [base, locali, contesti]);

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
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
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
  // sopralluogo completato aperto in sola lettura (riepilogo prima della modifica)
  const [riepilogo, setRiepilogo] = useState<SopralluogoConContesto | null>(null);

  // prefetch offline: scarica lista + checklist + giro precedente
  const [pf, setPf] = useState<{ busy: boolean; msg: string | null; meta: PrefetchMeta | null }>(
    () => ({ busy: false, msg: null, meta: leggiPrefetchMeta() }),
  );
  async function scaricaOffline() {
    if (pf.busy) return;
    setPf((p) => ({ ...p, busy: true, msg: null }));
    try {
      const r = await prefetchOffline(tecnicoId);
      const extra = r.tipiMancanti.length
        ? ` · ${r.tipiMancanti.length} tipo/i senza checklist`
        : '';
      setPf({
        busy: false, meta: leggiPrefetchMeta(),
        msg: `Pronti per offline: ${r.sopralluoghi} sopralluoghi, ${r.checklist} checklist${extra}.`,
      });
    } catch (e) {
      setPf((p) => ({ ...p, busy: false, msg: String((e as Error)?.message ?? e) }));
    }
  }
  // aggiornamento silenzioso all'apertura, se c'è rete
  useEffect(() => {
    let vivo = true;
    if (!navigator.onLine) return;
    prefetchOffline(tecnicoId)
      .then(() => vivo && setPf((p) => ({ ...p, meta: leggiPrefetchMeta() })))
      .catch(() => { /* silenzioso: il pulsante resta per riprovare */ });
    return () => { vivo = false; };
  }, [tecnicoId]);

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

  // generazione report (apre l'URL firmato in una nuova scheda)
  const [reportBusy, setReportBusy] = useState<string | null>(null); // `${id}:${variante}`
  const [reportErr, setReportErr] = useState<string | null>(null);
  async function apriReport(s: SopralluogoConContesto, variante: VarianteReport) {
    const key = `${s.id}:${variante}`;
    if (reportBusy) return;
    setReportErr(null);
    setReportBusy(key);
    const win = window.open('', '_blank'); // apro subito per non incappare nel blocco popup
    try {
      const url = await generaReport(s.id, variante);
      if (win) win.location.href = url; else window.open(url, '_blank');
    } catch (e) {
      if (win) win.close();
      setReportErr(`Report non generato: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setReportBusy(null);
    }
  }

  // Modifica di un sopralluogo completato: prima si archivia la versione
  // attuale (apriRevisione), poi si apre la compilazione, ora modificabile.
  async function eseguiModifica(s: SopralluogoConContesto) {
    const agg = await apriRevisione(s, { autoreId: tecnicoId });
    setRiepilogo(null);
    onApriSopralluogo?.({ ...s, ...agg });
  }

  // Schermata di riepilogo in sola lettura (gate prima della modifica).
  if (riepilogo) {
    return (
      <RiepilogoView
        s={riepilogo}
        reportBusy={reportBusy}
        onReport={(v) => void apriReport(riepilogo, v)}
        onIndietro={() => setRiepilogo(null)}
        onModifica={() => eseguiModifica(riepilogo)}
      />
    );
  }

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
          <div className="pf-bar">
            <button className="pf-btn" disabled={pf.busy} onClick={() => void scaricaOffline()}>
              {pf.busy ? 'Scarico…' : '⤓ Scarica per offline'}
            </button>
            <span className="pf-stato">
              {pf.msg
                ?? (pf.meta
                  ? `Pronto offline · ${pf.meta.sopralluoghi} sopralluoghi · agg. ${fmtOra(pf.meta.quando)}`
                  : 'Non ancora scaricato per l’uso offline')}
            </span>
          </div>

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

          {reportErr && <p className="muted" style={{ color: 'var(--no)' }}>{reportErr}</p>}
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

          <div className="list">
          {lista.map((s) => {
            const late = inRitardo(s);
            const fonte = [s.tipo_attivita, s.progressivo].filter(Boolean).join(' · ');
            const completato = s.stato === 'completato' || s.stato === 'sincronizzato';
            return (
              <div key={s.id} className="it-wrap">
              <button
                className={'it s-' + s.stato + (late ? ' late' : '')}
                onClick={() => (completato ? setRiepilogo(s) : onApriSopralluogo?.(s))}
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
              {completato && (
                <div className="report-bar">
                  <span className="rb-lab">Report</span>
                  <button className="rb-btn" disabled={!!reportBusy} onClick={() => void apriReport(s, 'cliente')}>
                    {reportBusy === s.id + ':cliente' ? '…' : 'Cliente'}
                  </button>
                  <button className="rb-btn" disabled={!!reportBusy} onClick={() => void apriReport(s, 'interna')}>
                    {reportBusy === s.id + ':interna' ? '…' : 'Interno'}
                  </button>
                  <BottoneInviaCliente sopralluogoId={s.id} />
                </div>
              )}
              </div>
            );
          })}
          </div>
        </main>
      </div>
    </div>
  );
}

// ---------- riepilogo (sola lettura) di un sopralluogo completato ----------
interface AzioneRiepilogo {
  id: string; tipo: string; descrizione: string;
  destinatario: string; scadenza: string | null; priorita: string;
}

function RiepilogoView({
  s, reportBusy, onReport, onIndietro, onModifica,
}: {
  s: SopralluogoConContesto;
  reportBusy: string | null;
  onReport: (v: VarianteReport) => void;
  onIndietro: () => void;
  onModifica: () => Promise<void>;
}) {
  const [azioni, setAzioni] = useState<AzioneRiepilogo[]>([]);
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rev = s.revisione_corrente ?? 1;
  const fonte = [s.tipo_attivita, s.progressivo].filter(Boolean).join(' · ');

  useEffect(() => {
    let vivo = true; setStato('loading');
    const uno = (v: any) => (Array.isArray(v) ? v[0] : v);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('azione')
          .select(`id, tipo, descrizione, responsabile_tipo, data_scadenza, priorita,
            area:area_interna!responsabile_area_id ( nome ),
            tecnico:tecnico!responsabile_interno_id ( nome )`)
          .eq('sopralluogo_origine_id', s.id);
        if (error) throw error;
        const out: AzioneRiepilogo[] = (data ?? []).map((a: any) => {
          const area = uno(a.area); const tec = uno(a.tecnico);
          const destinatario = a.responsabile_tipo === 'cliente' ? 'Cliente'
            : area?.nome ? `Interno · ${area.nome}`
              : tec?.nome ? `Interno · ${tec.nome}` : 'Interno';
          return {
            id: a.id, tipo: a.tipo, descrizione: a.descrizione ?? '—',
            destinatario, scadenza: a.data_scadenza ?? null, priorita: a.priorita ?? 'media',
          };
        });
        if (vivo) { setAzioni(out); setStato('ok'); }
      } catch {
        // fallback offline: cache locale (senza i nomi dei destinatari)
        try {
          const loc = (await db.azioni.toArray()).filter((a) => a.sopralluogo_origine_id === s.id);
          const out: AzioneRiepilogo[] = loc.map((a) => ({
            id: a.id, tipo: a.tipo, descrizione: a.descrizione ?? '—',
            destinatario: a.responsabile_tipo === 'cliente' ? 'Cliente' : 'Interno',
            scadenza: a.data_scadenza ?? null, priorita: a.priorita ?? 'media',
          }));
          if (vivo) { setAzioni(out); setStato('ok'); }
        } catch { if (vivo) setStato('errore'); }
      }
    })();
    return () => { vivo = false; };
  }, [s.id]);

  async function fai() {
    if (busy) return;
    const ok = window.confirm(
      `Questo sopralluogo è completato (revisione ${rev}).\n\n`
      + `Proseguendo, la versione attuale viene archiviata come revisione ${rev} `
      + `e il sopralluogo torna modificabile. Continuare?`,
    );
    if (!ok) return;
    setBusy(true); setErr(null);
    try { await onModifica(); }
    catch (e) { setErr(String((e as Error)?.message ?? e)); setBusy(false); }
  }

  const tipoLabel = (t: string) => (t === 'scadenza_ricorrente' ? 'Scadenza' : 'Azione');

  return (
    <div className="misopr">
      <style>{CSS}</style>
      <div className="phone narrow">
        <header>
          <div className="h-pad">
            <div className="rp-head">
              <button className="rp-back" onClick={onIndietro} aria-label="Indietro">{Icon.back}</button>
              <div className="rp-titles">
                <div className="h-title">{s.cliente_nome ?? 'Cliente —'}</div>
                <div className="rp-sub">{fonte || 'Sopralluogo'}</div>
              </div>
              <span className="rp-rev">Rev. {rev}</span>
            </div>
          </div>
        </header>

        <main>
          <div className="rp-meta">
            <span className="m">{Icon.cal}{fmt(s.data_effettiva ?? s.data_pianificata)}</span>
            {s.localita && <span className="m">{Icon.pin}{s.localita}</span>}
            <span className={'badge ' + s.stato}>{LABEL_STATO[s.stato]}</span>
          </div>

          <div className="rp-sech">Cose da fare decise</div>
          {stato === 'loading' && <p className="muted">Carico…</p>}
          {stato === 'errore' && <p className="muted">Non riesco a caricare le cose da fare.</p>}
          {stato === 'ok' && azioni.length === 0 && (
            <p className="empty">Nessuna cosa da fare registrata in questo sopralluogo.</p>
          )}
          {azioni.map((a) => (
            <div key={a.id} className="rp-card">
              <div className="rp-desc">{a.descrizione}</div>
              <div className="rp-row">
                <span className="rp-tag">{tipoLabel(a.tipo)}</span>
                <span className="rp-dest">{a.destinatario}</span>
                <span className={'rp-pri p-' + a.priorita}>{a.priorita}</span>
                {a.scadenza && <span className="rp-scad">{Icon.cal}{fmt(a.scadenza)}</span>}
              </div>
            </div>
          ))}

          <div className="rp-sech">Report</div>
          <div className="report-bar rp-rep">
            <button className="rb-btn" disabled={!!reportBusy} onClick={() => onReport('cliente')}>
              {reportBusy === s.id + ':cliente' ? '…' : 'Cliente'}
            </button>
            <button className="rb-btn" disabled={!!reportBusy} onClick={() => onReport('interna')}>
              {reportBusy === s.id + ':interna' ? '…' : 'Interno'}
            </button>
            <BottoneInviaCliente sopralluogoId={s.id} />
          </div>

          {err && <p className="muted" style={{ color: 'var(--no)' }}>{err}</p>}
          <button className="rp-edit" disabled={busy} onClick={() => void fai()}>
            {busy ? 'Apro la modifica…' : '✎ Modifica sopralluogo'}
          </button>
          <p className="rp-note">
            Modificando, la versione attuale (revisione {rev}) viene archiviata e resta
            consultabile; le modifiche diventano la revisione {rev + 1}.
          </p>
        </main>
      </div>
    </div>
  );
}

// ---------- stile (stessa palette dei mockup) ----------
const CSS = `
.misopr{
  --disp:"Hanken Grotesk Variable",-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",sans-serif;
  --serif:"Fraunces Variable","Hanken Grotesk Variable",Georgia,serif;
  --ink:#1b1c1f; --ink-soft:#5c5f66; --faint:#8b8e94; --line:#e7e1d6;
  --paper:#f6f3ec; --card:#fff;
  --hi:#e8920c; --hi-dark:#8f5a06;
  --ok:#2e8b4c; --ok-bg:#e7f3ea;
  --no:#d24028; --no-bg:#fbeae6;
  --na-bg:#eceae5;
  --shadow:0 1px 0 rgba(0,0,0,.04),0 8px 24px -16px rgba(0,0,0,.25);
  font-family:var(--disp); color:var(--ink);
  background:#d5cec1; display:flex; justify-content:center; min-height:100vh;
}
.misopr *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
.misopr .phone{width:100%; max-width:440px; background:var(--paper); min-height:100vh;
  display:flex; flex-direction:column; box-shadow:0 0 60px -20px rgba(0,0,0,.5);}

.misopr header{position:sticky; top:0; z-index:20; background:var(--ink); color:#fff; border-bottom:3px solid var(--hi);}
.misopr .h-pad{padding:13px 16px 0;}
.misopr .h-row{display:flex; align-items:center; justify-content:space-between; gap:10px;}
.misopr .h-title{font-family:var(--serif); font-weight:600; font-size:19px; letter-spacing:-.01em;}
.misopr .h-user{display:flex; align-items:center; gap:8px; font-size:12.5px; color:#c7cad0; font-weight:600;}
.misopr .ava{width:28px;height:28px;border-radius:50%;background:var(--hi);color:#1a1205;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;}
.misopr .tabs{display:flex; gap:22px; margin-top:12px;}
.misopr .tab{background:none; border:none; color:#9aa0a8; font-family:var(--disp); font-weight:700; font-size:13.5px;
  padding:0 0 11px; cursor:pointer; position:relative;}
.misopr .tab.on{color:#fff;}
.misopr .tab.on::after{content:""; position:absolute; left:0; right:0; bottom:0; height:3px; background:var(--hi); border-radius:3px 3px 0 0;}

.misopr main{flex:1; padding:14px 14px 40px;}
.misopr .pf-bar{display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px;
  background:#fff; border:1px solid var(--line); border-radius:12px; padding:9px 11px; box-shadow:var(--shadow);}
.misopr .pf-btn{border:1px solid var(--hi); background:var(--hi); color:#1a1205; font-family:var(--disp);
  font-weight:800; font-size:12.5px; padding:7px 12px; border-radius:9px; cursor:pointer; white-space:nowrap;}
.misopr .pf-btn:active{transform:scale(.98);}
.misopr .pf-btn:disabled{opacity:.55; cursor:default;}
.misopr .pf-stato{font-size:11.5px; color:var(--ink-soft); font-weight:600; line-height:1.4; flex:1; min-width:0;}
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
.misopr .list{display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap:10px; align-items:start;}
.misopr .it-wrap{margin-bottom:0;}
.misopr .it-wrap .it{margin-bottom:0;}
.misopr .report-bar{display:flex; align-items:center; gap:7px; padding:7px 6px 2px; flex-wrap:wrap;}
.misopr .rb-lab{font-size:10.5px; font-weight:700; color:var(--faint); letter-spacing:.06em; text-transform:uppercase; margin-right:auto;}
.misopr .rb-btn{border:1px solid var(--line); background:#fff; color:var(--ink); font-family:var(--disp); font-weight:700; font-size:12px; padding:6px 13px; border-radius:8px; cursor:pointer;}
.misopr .rb-btn:active{transform:scale(.97);}
.misopr .rb-btn:disabled{opacity:.5;}

/* riepilogo sola lettura */
.misopr .rp-head{display:flex; align-items:center; gap:10px; padding-bottom:13px;}
.misopr .rp-back{flex-shrink:0; width:34px; height:34px; border-radius:9px; border:none;
  background:rgba(255,255,255,.12); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;}
.misopr .rp-back svg{width:20px;height:20px;}
.misopr .rp-titles{flex:1; min-width:0;}
.misopr .rp-sub{font-size:11.5px; color:#c7cad0; font-weight:600; margin-top:2px;}
.misopr .rp-rev{flex-shrink:0; font-size:11px; font-weight:800; color:#1a1205; background:var(--hi);
  padding:4px 9px; border-radius:8px; white-space:nowrap;}
.misopr .rp-meta{display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:18px;}
.misopr .rp-sech{font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase;
  color:var(--faint); margin:18px 2px 9px;}
.misopr .rp-card{background:var(--card); border:1px solid var(--line); border-left:4px solid var(--hi);
  border-radius:12px; padding:11px 13px; margin-bottom:9px; box-shadow:var(--shadow);}
.misopr .rp-desc{font-size:13.5px; font-weight:600; line-height:1.4; color:var(--ink);}
.misopr .rp-row{display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin-top:8px;}
.misopr .rp-tag{font-size:10.5px; font-weight:700; color:var(--ink-soft); background:var(--na-bg);
  padding:3px 8px; border-radius:6px;}
.misopr .rp-dest{font-size:12px; font-weight:600; color:var(--ink-soft);}
.misopr .rp-pri{font-size:10.5px; font-weight:700; padding:3px 8px; border-radius:6px; text-transform:capitalize;}
.misopr .rp-pri.p-alta{background:var(--no-bg); color:var(--no);}
.misopr .rp-pri.p-media{background:#fbeccb; color:var(--hi-dark);}
.misopr .rp-pri.p-bassa{background:var(--ok-bg); color:var(--ok);}
.misopr .rp-scad{display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600; color:var(--ink-soft);}
.misopr .rp-scad svg{width:14px;height:14px;}
.misopr .rp-rep{padding:0 0 2px;}
.misopr .rp-edit{width:100%; margin-top:22px; border:none; border-radius:12px; cursor:pointer;
  background:var(--ink); color:#fff; font-family:var(--disp); font-weight:800; font-size:14.5px; padding:14px;
  box-shadow:var(--shadow);}
.misopr .rp-edit:active{transform:scale(.99);}
.misopr .rp-edit:disabled{opacity:.6; cursor:default;}
.misopr .rp-note{font-size:11.5px; color:var(--ink-soft); line-height:1.5; margin:10px 2px 0;}

/* tablet/desktop: il pannello si allarga e la lista diventa griglia di card.
   La griglia (auto-fill minmax) sceglie da sé il numero di colonne in base
   alla larghezza disponibile, quindi qui basta sbloccare la larghezza. */
@media(min-width:760px){
  .misopr .phone{max-width:760px;}
  .misopr main{padding:18px 20px 48px;}
  .misopr .h-pad{padding:15px 20px 0;}
}
@media(min-width:1140px){
  .misopr .phone{max-width:1100px;}
  .misopr main{padding:22px 26px 56px;}
  .misopr .h-pad{padding:16px 26px 0;}
}
/* il riepilogo è una colonna di lettura: resta stretto anche su schermi grandi */
.misopr .phone.narrow{max-width:680px;}
`;
