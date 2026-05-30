import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { liveQuery } from 'dexie';
import { db } from './lib/db';
import { salvaEsito, aggiungiFoto, rimuoviFoto, runSync } from './lib/sync';
import {
  apriCompilazione, generaAzione, completaSopralluogo,
  type VoceCompilazione,
} from './lib/compilazione';
import { toBaseSopralluogo, type SopralluogoConContesto } from './lib/sopralluoghi';
import { caricaGiroPrecedente, verificaAzione, type AzioneConContesto } from './lib/azioni';
import type { EsitoStato, Foto, Azione } from './lib/types';

// ---------- helpers ----------
const isoTraGiorni = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmt = (d: string) => {
  if (!d) return '—';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y}`;
};
const posizione = (): Promise<{ lat: number; lng: number } | undefined> =>
  new Promise((res) => {
    if (!navigator.geolocation) return res(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(undefined),
      { enableHighAccuracy: true, timeout: 4000 },
    );
  });

type Resp = 'cliente' | 'interno';
interface Bozza {
  descrizione: string;
  responsabile: Resp;
  scadenza: string;
  priorita: 'bassa' | 'media' | 'alta';
}
const nuovaBozza = (stato: EsitoStato): Bozza => ({
  descrizione: '',
  responsabile: 'cliente',
  scadenza: stato === 'conforme' ? isoTraGiorni(365) : isoTraGiorni(30),
  priorita: 'media',
});
const generaAzioneVoce = (v: VoceCompilazione) =>
  v.stato === 'non_conforme' || (v.stato === 'conforme' && v.calendarizzabile);

// ---------- icone ----------
const I = {
  ok: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  no: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>,
  na: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M6 12h12" strokeLinecap="round" /></svg>,
  cam: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M3 8a2 2 0 0 1 2-2h2l1.4-2h7.2L19 6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="12.5" r="3.4" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  done: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

// ---------- striscia foto (liveQuery su Dexie) ----------
function FotoStrip({ esitoId }: { esitoId: string }) {
  const [foto, setFoto] = useState<Foto[]>([]);
  const [url, setUrl] = useState<Record<string, string>>({});

  useEffect(() => {
    const sub = liveQuery(() =>
      db.foto.where('esito_voce_id').equals(esitoId).sortBy('ordine'),
    ).subscribe({ next: setFoto });
    return () => sub.unsubscribe();
  }, [esitoId]);

  useEffect(() => {
    const revoke: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const f of foto) {
        const fb = await db.fotoBlob.get(f.id); // dopo il sync il blob non c'è più
        if (fb) {
          const u = URL.createObjectURL(fb.blob);
          next[f.id] = u;
          revoke.push(u);
        }
      }
      setUrl(next);
    })();
    return () => revoke.forEach(URL.revokeObjectURL);
  }, [foto]);

  async function add(files: FileList | null) {
    if (!files) return;
    const geo = await posizione();
    for (let i = 0; i < files.length && foto.length + i < 10; i++) {
      await aggiungiFoto(esitoId, files[i], geo);
    }
  }

  return (
    <div className="photos">
      {foto.map((f) => (
        <div
          key={f.id}
          className="ph"
          style={url[f.id] ? { backgroundImage: `url(${url[f.id]})` } : undefined}
        >
          {!url[f.id] && <span className="ph-ph">{I.cam}</span>}
          <button className="x" onClick={() => void rimuoviFoto(f.id)}>{I.x}</button>
        </div>
      ))}
      {foto.length < 10 && (
        <label className="ph-add">
          {I.cam}Foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => void add(e.target.files)}
          />
        </label>
      )}
      <span className="ph-count">{foto.length}/10</span>
    </div>
  );
}

// ---------- segmenti ----------
function Seg<T extends string>({ value, options, onChange }: {
  value: T; options: Array<{ v: T; l: string }>; onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.v} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

// ---------- giro precedente: server + overlay locale ----------
function useGiroPrecedente(incaricoId: string | null, sopralluogoId: string) {
  const [base, setBase] = useState<AzioneConContesto[]>([]);
  const [locali, setLocali] = useState<Record<string, Azione>>({});
  const [stato, setStato] = useState<'idle' | 'loading' | 'ok' | 'errore'>('idle');

  useEffect(() => {
    if (!incaricoId) { setStato('idle'); return; }
    let vivo = true;
    setStato('loading');
    caricaGiroPrecedente(incaricoId, sopralluogoId)
      .then((a) => vivo && (setBase(a), setStato('ok')))
      .catch(() => vivo && setStato('errore'));
    return () => { vivo = false; };
  }, [incaricoId, sopralluogoId]);

  useEffect(() => {
    const ids = new Set(base.map((b) => b.id));
    if (!ids.size) { setLocali({}); return; }
    const sub = liveQuery(() => db.azioni.toArray()).subscribe({
      next: (rows) => {
        const m: Record<string, Azione> = {};
        for (const r of rows) if (ids.has(r.id)) m[r.id] = r;
        setLocali(m);
      },
    });
    return () => sub.unsubscribe();
  }, [base]);

  const azioni = useMemo(
    () => base.map((b) => (locali[b.id] ? { ...b, stato: locali[b.id].stato } : b)),
    [base, locali],
  );
  return { azioni, stato };
}

// ---------- componente ----------
interface Props {
  sopralluogo: SopralluogoConContesto;
  tecnicoId: string;
  onChiudi: () => void;
}

export default function Compilazione({ sopralluogo, tecnicoId, onChiudi }: Props) {
  const [fase, setFase] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [erroreMsg, setErroreMsg] = useState<string | null>(null);
  const [voci, setVoci] = useState<VoceCompilazione[]>([]);
  const [bozze, setBozze] = useState<Record<string, Bozza>>({});
  const [aperte, setAperte] = useState<Set<string>>(new Set());
  const [inCoda, setInCoda] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [salvataggio, setSalvataggio] = useState<'idle' | 'corso' | 'fatto' | 'errore'>('idle');
  const [sheet, setSheet] = useState<null | 'gen' | 'prev'>(null);

  const { azioni: prev, stato: statoPrev } = useGiroPrecedente(
    sopralluogo.incarico_id,
    sopralluogo.id,
  );
  const prevAperte = prev.filter((a) => a.stato !== 'conclusa').length;
  const chipPrevN = statoPrev === 'ok' ? String(prevAperte) : '·';

  // apertura
  useEffect(() => {
    let vivo = true;
    setFase('loading');
    apriCompilazione(sopralluogo)
      .then((d) => { if (vivo) { setVoci(d.voci); setFase('ok'); } })
      .catch((e) => { if (vivo) { setErroreMsg(String(e?.message ?? e)); setFase('errore'); } });
    return () => { vivo = false; };
  }, [sopralluogo.id]);

  // stato rete + coda
  useEffect(() => {
    const su = () => setOnline(true);
    const giu = () => setOnline(false);
    window.addEventListener('online', su);
    window.addEventListener('offline', giu);
    const sub = liveQuery(() => db.outbox.count()).subscribe({ next: setInCoda });
    return () => {
      window.removeEventListener('online', su);
      window.removeEventListener('offline', giu);
      sub.unsubscribe();
    };
  }, []);

  const aggiornaVoce = (id: string, patch: Partial<VoceCompilazione>) =>
    setVoci((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  function persisti(v: VoceCompilazione) {
    const { calendarizzabile: _c, ...e } = v;
    void salvaEsito(e);
  }

  function cambiaStato(v: VoceCompilazione, k: EsitoStato) {
    const nuovo = v.stato === k ? null : k;
    const genera = nuovo === 'non_conforme' || (nuovo === 'conforme' && v.calendarizzabile);
    const agg = { ...v, stato: nuovo, genera_azione: genera };
    aggiornaVoce(v.id, { stato: nuovo, genera_azione: genera });
    persisti(agg);

    setBozze((b) => {
      const n = { ...b };
      if (genera && !n[v.id]) n[v.id] = nuovaBozza(nuovo as EsitoStato);
      if (!genera) delete n[v.id];
      return n;
    });
    setAperte((a) => {
      const n = new Set(a);
      if (nuovo) n.add(v.id); else n.delete(v.id);
      return n;
    });
  }

  function setNota(v: VoceCompilazione, note: string) {
    aggiornaVoce(v.id, { note });
  }
  function salvaNota(v: VoceCompilazione) {
    persisti(v); // su onBlur
  }
  const setBozza = (id: string, patch: Partial<Bozza>) =>
    setBozze((b) => ({ ...b, [id]: { ...(b[id] ?? nuovaBozza('non_conforme')), ...patch } }));

  const totale = voci.length;
  const fatte = voci.filter((v) => v.stato != null).length;
  const conAzione = voci.filter(generaAzioneVoce);

  const sezioni = useMemo(() => {
    const out: Array<{ sez: string | null; voci: VoceCompilazione[] }> = [];
    for (const v of voci) {
      let g = out[out.length - 1];
      if (!g || g.sez !== v.voce_sezione) { g = { sez: v.voce_sezione, voci: [] }; out.push(g); }
      g.voci.push(v);
    }
    return out;
  }, [voci]);

  async function completa() {
    setSalvataggio('corso');
    try {
      for (const v of conAzione) {
        const b = bozze[v.id] ?? nuovaBozza(v.stato as EsitoStato);
        const responsabileTipo = b.responsabile === 'interno' ? 'risorsa_interna' : 'cliente';
        if (v.stato === 'non_conforme') {
          await generaAzione({
            esitoId: v.id, sopralluogoId: sopralluogo.id, tipo: 'azione_correttiva',
            descrizione: b.descrizione.trim() || `Da definire — ${v.voce_testo}`,
            responsabileTipo, dataScadenza: b.scadenza || null, priorita: b.priorita,
            clienteId: sopralluogo.cliente_id, tecnicoId,
          });
        } else {
          await generaAzione({
            esitoId: v.id, sopralluogoId: sopralluogo.id, tipo: 'scadenza_ricorrente',
            descrizione: `Scadenza: ${v.voce_testo}`,
            responsabileTipo, dataScadenza: b.scadenza || null, priorita: 'media',
            clienteId: sopralluogo.cliente_id, tecnicoId,
          });
        }
      }
      await completaSopralluogo(toBaseSopralluogo(sopralluogo));
      void runSync();
      setSalvataggio('fatto');
      setTimeout(onChiudi, 1400);
    } catch {
      setSalvataggio('errore');
    }
  }

  if (fase === 'loading') {
    return <Cornice><p className="muted">Apro la checklist…</p></Cornice>;
  }
  if (fase === 'errore') {
    return (
      <Cornice>
        <p className="muted">{erroreMsg ?? 'Errore.'}</p>
        <button className="cta" onClick={onChiudi}>Torna ai sopralluoghi</button>
      </Cornice>
    );
  }

  const ctaLabel =
    salvataggio === 'fatto' ? (online ? 'Sincronizzato' : 'Salvato · sincronizzo dopo')
    : salvataggio === 'corso' ? 'Salvo…'
    : 'Completa e sincronizza';

  return (
    <div className="compila">
      <style>{CSS}</style>
      <div className="phone">
        <header>
          <div className="h-top">
            <button className="hb" onClick={onChiudi}>{I.back}</button>
            <div className="h-mid">
              <div className="h-client">{sopralluogo.cliente_nome ?? 'Cliente —'}</div>
              <div className="h-sub">
                {[sopralluogo.tipo_attivita, sopralluogo.progressivo].filter(Boolean).join(' · ') || 'Sopralluogo'}
              </div>
            </div>
            <div className={'sync ' + (online ? 'online' : 'offline')}>
              <span className="dot" />
              {online ? (inCoda ? `${inCoda} in coda` : 'Online') : `Offline · ${inCoda}`}
            </div>
          </div>
          <div className="progress-wrap">
            <div className="progress-meta"><span>Avanzamento</span><span><b>{fatte}</b>/{totale} voci</span></div>
            <div className="bar"><i style={{ width: totale ? `${(fatte / totale) * 100}%` : '0%' }} /></div>
          </div>
        </header>

        <main>
          {sezioni.map((s) => (
            <div key={s.sez ?? '—'}>
              {s.sez && <div className="section-h">{s.sez}</div>}
              {s.voci.map((v) => {
                const open = aperte.has(v.id);
                const b = bozze[v.id];
                return (
                  <div key={v.id} className={'voce' + (v.stato ? ' s-' + v.stato : '') + (open ? ' open' : '')}>
                    <div className="voce-head">
                      <div className="voce-req">
                        {v.voce_testo}
                        {v.calendarizzabile && <span className="cal">calendarizzabile</span>}
                      </div>
                      <div className="states">
                        <button className={'st' + (v.stato === 'conforme' ? ' on-ok' : '')} onClick={() => cambiaStato(v, 'conforme')}>{I.ok}Conforme</button>
                        <button className={'st' + (v.stato === 'non_conforme' ? ' on-no' : '')} onClick={() => cambiaStato(v, 'non_conforme')}>{I.no}Non conf.</button>
                        <button className={'st' + (v.stato === 'non_applicabile' ? ' on-na' : '')} onClick={() => cambiaStato(v, 'non_applicabile')}>{I.na}N.A.</button>
                      </div>
                    </div>

                    {open && (
                      <div className="detail">
                        <textarea className="note" placeholder="Note ed evidenze…"
                          value={v.note ?? ''} onChange={(e) => setNota(v, e.target.value)} onBlur={() => salvaNota(v)} />
                        <FotoStrip esitoId={v.id} />

                        {v.stato === 'non_conforme' && b && (
                          <div className="gen azione">
                            <div className="gen-h">Cosa da fare</div>
                            <div className="field"><label>Descrizione</label>
                              <textarea rows={2} placeholder="Es. ripristinare segnaletica via di esodo lato nord"
                                value={b.descrizione} onChange={(e) => setBozza(v.id, { descrizione: e.target.value })} /></div>
                            <div className="field"><label>Responsabile</label>
                              <Seg value={b.responsabile} onChange={(x) => setBozza(v.id, { responsabile: x })}
                                options={[{ v: 'cliente', l: 'Cliente' }, { v: 'interno', l: 'Interno' }]} /></div>
                            <div className="row2">
                              <div className="field"><label>Scadenza</label>
                                <input type="date" value={b.scadenza} onChange={(e) => setBozza(v.id, { scadenza: e.target.value })} /></div>
                              <div className="field"><label>Priorità</label>
                                <Seg value={b.priorita} onChange={(x) => setBozza(v.id, { priorita: x })}
                                  options={[{ v: 'bassa', l: 'Bassa' }, { v: 'media', l: 'Media' }, { v: 'alta', l: 'Alta' }]} /></div>
                            </div>
                          </div>
                        )}

                        {v.stato === 'conforme' && v.calendarizzabile && b && (
                          <div className="gen scad">
                            <div className="gen-h">Scadenza ricorrente</div>
                            <div className="row2">
                              <div className="field"><label>Prossima scadenza</label>
                                <input type="date" value={b.scadenza} onChange={(e) => setBozza(v.id, { scadenza: e.target.value })} /></div>
                              <div className="field"><label>Responsabile</label>
                                <Seg value={b.responsabile} onChange={(x) => setBozza(v.id, { responsabile: x })}
                                  options={[{ v: 'cliente', l: 'Cliente' }, { v: 'interno', l: 'Interno' }]} /></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </main>

        <footer><div className="foot-inner">
          <div className="chips">
            <div className="chip az" onClick={() => setSheet('gen')}>
              <span className="n">{conAzione.length}</span>
              <span>Cose da fare<small>generate ora</small></span>
            </div>
            <div className="chip prev" onClick={() => setSheet('prev')}>
              <span className="n">{chipPrevN}</span>
              <span>Giro precedente<small>azioni aperte</small></span>
            </div>
          </div>
          <button className={'cta' + (salvataggio === 'fatto' ? ' done' : '')}
            disabled={salvataggio === 'corso' || salvataggio === 'fatto'} onClick={() => void completa()}>
            {salvataggio === 'fatto' && I.done}{ctaLabel}
          </button>
        </div></footer>

        {sheet && <div className="scrim show" onClick={() => setSheet(null)} />}

        {sheet === 'gen' && (
          <div className="sheet show">
            <div className="sheet-grab" />
            <div className="sheet-h"><h3>Cose da fare · generate ora</h3><button onClick={() => setSheet(null)}>×</button></div>
            <div className="sheet-body">
              {conAzione.length === 0
                ? <div className="empty">Nessuna ancora. Segna una voce "Non conforme" per generarne una.</div>
                : conAzione.map((v) => {
                  const b = bozze[v.id];
                  const corr = v.stato === 'non_conforme';
                  return (
                    <div key={v.id} className="task">
                      <div className="task-top">
                        <div className="task-desc">{corr ? (b?.descrizione || `Da definire — ${v.voce_testo}`) : `Scadenza: ${v.voce_testo}`}</div>
                        <span className={'pill ' + (corr ? 'aperta' : 'corso')}>{corr ? 'Aperta' : 'Scadenza'}</span>
                      </div>
                      <div className="task-meta">
                        <span>Resp. <b>{b?.responsabile === 'interno' ? 'Interno' : 'Cliente'}</b></span>
                        <span>Scad. <b>{fmt(b?.scadenza ?? '')}</b></span>
                        {corr && <span>Priorità <b>{b?.priorita}</b></span>}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {sheet === 'prev' && (
          <div className="sheet show">
            <div className="sheet-grab" />
            <div className="sheet-h"><h3>Giro precedente · azioni aperte</h3><button onClick={() => setSheet(null)}>×</button></div>
            <div className="sheet-body">
              {statoPrev === 'loading' && <p className="muted">Carico le azioni del giro precedente…</p>}
              {statoPrev === 'errore' && (
                <div className="empty">Serve la connessione per caricare il giro precedente. Riprova quando sei online.</div>
              )}
              {statoPrev === 'ok' && prev.length === 0 && (
                <div className="empty">Nessuna azione aperta dal giro precedente.</div>
              )}
              {prev.map((a) => {
                const conclusa = a.stato === 'conclusa';
                return (
                  <div key={a.id} className={'task' + (conclusa ? ' done' : '')}>
                    <div className="task-top">
                      <div className="task-desc">{a.descrizione}</div>
                      <span className={'pill ' + (conclusa ? 'corso' : 'aperta')}>
                        {conclusa ? 'Conclusa' : 'Aperta'}
                      </span>
                    </div>
                    <div className="task-meta">
                      {a.sopralluogo_label && <span>Da <b>{a.sopralluogo_label}</b></span>}
                      <span>Resp. <b>{a.responsabile_tipo === 'cliente' ? 'Cliente' : 'Interno'}</b></span>
                      {a.data_scadenza && <span>Scad. <b>{fmt(a.data_scadenza)}</b></span>}
                    </div>
                    {!conclusa && (
                      <button
                        className="verifica"
                        onClick={() => void verificaAzione(a, sopralluogo.id, { autoreId: tecnicoId })}
                      >
                        {I.done} Verifica e chiudi
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Cornice({ children }: { children: ReactNode }) {
  return <div className="compila"><style>{CSS}</style><div className="phone"><main style={{ padding: 24 }}>{children}</main></div></div>;
}

// ---------- stile (porta dei mockup, palette identica) ----------
const CSS = `
.compila{
  --disp:-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",sans-serif;
  --ink:#16181c; --ink-soft:#5b5f66; --line:#e3ddd2; --paper:#f5f2ec; --card:#fff;
  --hi:#f4a012; --hi-dark:#9a6206;
  --ok:#1f9d57; --ok-bg:#e7f5ec; --no:#d8442f; --no-bg:#fbeae6; --na:#8a8f97; --na-bg:#eceae5;
  --shadow:0 1px 0 rgba(0,0,0,.04),0 8px 24px -16px rgba(0,0,0,.25);
  font-family:var(--disp); color:var(--ink); background:#d9d4ca;
  display:flex; justify-content:center; min-height:100vh;
}
.compila *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
.compila .phone{width:100%; max-width:440px; background:var(--paper); min-height:100vh; position:relative;
  display:flex; flex-direction:column; box-shadow:0 0 60px -20px rgba(0,0,0,.5);}
.compila .muted{color:var(--ink-soft); font-size:13px; line-height:1.5;}

.compila header{position:sticky; top:0; z-index:20; background:var(--ink); color:#fff; padding:12px 14px; border-bottom:3px solid var(--hi);}
.compila .h-top{display:flex; align-items:flex-start; gap:10px;}
.compila .hb{background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.18); color:#fff; border-radius:9px; width:34px; height:34px; flex-shrink:0; cursor:pointer; display:flex; align-items:center; justify-content:center;}
.compila .hb svg{width:18px;height:18px;}
.compila .h-mid{flex:1; min-width:0;}
.compila .h-client{font-weight:800; font-size:16px; letter-spacing:-.2px; line-height:1.15;}
.compila .h-sub{font-size:12px; color:#b9bcc2; margin-top:2px; font-weight:500;}
.compila .sync{flex-shrink:0; display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:600; padding:6px 9px; border-radius:999px; border:1px solid rgba(255,255,255,.18); background:rgba(255,255,255,.06); white-space:nowrap;}
.compila .sync .dot{width:7px;height:7px;border-radius:50%;}
.compila .sync.offline .dot{background:var(--hi); box-shadow:0 0 0 3px rgba(244,160,18,.25);}
.compila .sync.online .dot{background:#39d98a;}
.compila .progress-wrap{margin-top:11px;}
.compila .progress-meta{display:flex; justify-content:space-between; font-size:11px; color:#c7cad0; margin-bottom:5px; font-weight:500;}
.compila .progress-meta b{color:#fff; font-weight:700;}
.compila .bar{height:6px; background:rgba(255,255,255,.14); border-radius:999px; overflow:hidden;}
.compila .bar > i{display:block; height:100%; background:var(--hi); border-radius:999px; transition:width .35s cubic-bezier(.4,0,.2,1);}

.compila main{flex:1; padding:14px 14px 140px;}
.compila .section-h{font-weight:700; font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-soft); margin:18px 4px 9px; display:flex; align-items:center; gap:8px;}
.compila .section-h::after{content:""; flex:1; height:1px; background:var(--line);}

.compila .voce{background:var(--card); border:1px solid var(--line); border-radius:14px; margin-bottom:10px; overflow:hidden; box-shadow:var(--shadow); border-left:4px solid transparent;}
.compila .voce.s-conforme{border-left-color:var(--ok);}
.compila .voce.s-non_conforme{border-left-color:var(--no);}
.compila .voce.s-non_applicabile{border-left-color:var(--na);}
.compila .voce-head{padding:13px 14px 12px;}
.compila .voce-req{font-size:15px; font-weight:500; line-height:1.35; margin-bottom:11px;}
.compila .voce-req .cal{display:inline-block; margin-left:6px; font-size:10px; font-weight:700; color:var(--hi-dark); background:#fbeccb; border:1px solid #f3d893; padding:1px 6px; border-radius:6px;}
.compila .states{display:grid; grid-template-columns:1fr 1fr 1fr; gap:7px;}
.compila .st{appearance:none; border:1.5px solid var(--line); background:#fbfaf7; color:var(--ink-soft); font-family:var(--disp); font-weight:600; font-size:12.5px; padding:11px 4px; border-radius:10px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:5px; line-height:1;}
.compila .st svg{width:18px;height:18px;}
.compila .st:active{transform:scale(.96);}
.compila .st.on-ok{background:var(--ok-bg); border-color:var(--ok); color:var(--ok);}
.compila .st.on-no{background:var(--no-bg); border-color:var(--no); color:var(--no);}
.compila .st.on-na{background:var(--na-bg); border-color:var(--na); color:#555;}

.compila .detail{padding:0 14px 14px;}
.compila .note{width:100%; border:1px solid var(--line); border-radius:10px; background:#fbfaf7; padding:10px 11px; font-family:inherit; font-size:14px; color:var(--ink); resize:none; min-height:42px; margin-bottom:10px;}
.compila .note:focus{outline:none; border-color:var(--hi); background:#fff;}

.compila .photos{display:flex; gap:8px; flex-wrap:wrap; align-items:center;}
.compila .ph-add,.compila .ph{width:58px; height:58px; border-radius:10px; flex-shrink:0; position:relative;}
.compila .ph-add{border:1.5px dashed #c9c2b4; background:#fbfaf7; color:var(--ink-soft); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; font-size:9.5px; font-weight:600; cursor:pointer;}
.compila .ph-add svg{width:18px;height:18px;}
.compila .ph{background-size:cover; background-position:center; box-shadow:inset 0 0 0 1px rgba(0,0,0,.08); background-color:#eceae4; display:flex; align-items:center; justify-content:center;}
.compila .ph-ph{color:var(--na);} .compila .ph-ph svg{width:20px;height:20px;}
.compila .ph .x{position:absolute; top:-6px; right:-6px; width:20px;height:20px; border-radius:50%; background:var(--ink); color:#fff; border:2px solid var(--paper); display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0;}
.compila .ph .x svg{width:10px;height:10px;}
.compila .ph-count{font-size:11px; color:var(--ink-soft); font-weight:500; margin-left:2px;}

.compila .gen{margin-top:12px; border-radius:12px; padding:12px; border:1px solid;}
.compila .gen.azione{background:var(--no-bg); border-color:#f1c4b9;}
.compila .gen.scad{background:#fbeccb; border-color:#f0d28a;}
.compila .gen-h{font-weight:700; font-size:12px; letter-spacing:.04em; text-transform:uppercase; margin-bottom:10px;}
.compila .gen.azione .gen-h{color:var(--no);} .compila .gen.scad .gen-h{color:var(--hi-dark);}
.compila .field{margin-bottom:9px;}
.compila .field label{display:block; font-size:11px; font-weight:600; color:var(--ink-soft); margin-bottom:4px;}
.compila .field input,.compila .field textarea{width:100%; appearance:none; border:1px solid rgba(0,0,0,.12); border-radius:8px; padding:9px 10px; font-family:inherit; font-size:13.5px; background:#fff; color:var(--ink);}
.compila .field input:focus,.compila .field textarea:focus{outline:none; border-color:var(--ink);}
.compila .seg{display:flex; gap:6px;}
.compila .seg button{flex:1; border:1px solid rgba(0,0,0,.14); background:#fff; color:var(--ink-soft); font-family:inherit; font-weight:600; font-size:12.5px; padding:8px 4px; border-radius:8px; cursor:pointer;}
.compila .seg button.on{background:var(--ink); color:#fff; border-color:var(--ink);}
.compila .row2{display:grid; grid-template-columns:1fr 1fr; gap:8px;}

.compila footer{position:fixed; bottom:0; left:0; right:0; z-index:20; display:flex; justify-content:center; pointer-events:none;}
.compila .foot-inner{width:100%; max-width:440px; background:rgba(245,242,236,.97); backdrop-filter:blur(10px); border-top:1px solid var(--line); padding:10px 14px calc(10px + env(safe-area-inset-bottom)); pointer-events:auto;}
.compila .chips{display:flex; gap:8px; margin-bottom:9px;}
.compila .chip{flex:1; background:#fff; border:1px solid var(--line); border-radius:11px; padding:8px 10px; display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; font-weight:600;}
.compila .chip .n{font-weight:800; font-size:15px; min-width:22px; height:22px; border-radius:7px; display:flex; align-items:center; justify-content:center; color:#fff;}
.compila .chip.az .n{background:var(--no);} .compila .chip.prev .n{background:var(--ink);}
.compila .chip small{color:var(--ink-soft); font-weight:500; font-size:11px; display:block; line-height:1.2;}
.compila .cta{width:100%; border:none; border-radius:12px; padding:14px; cursor:pointer; font-family:var(--disp); font-weight:800; font-size:15px; background:var(--hi); color:#1a1205; display:flex; align-items:center; justify-content:center; gap:9px; transition:.18s;}
.compila .cta:disabled{opacity:.85;}
.compila .cta.done{background:var(--ok); color:#fff;}
.compila .cta svg{width:18px;height:18px;}

.compila .scrim{position:fixed; inset:0; background:rgba(20,22,26,.45); z-index:30; opacity:0; pointer-events:none; transition:.2s;}
.compila .scrim.show{opacity:1; pointer-events:auto;}
.compila .sheet{position:fixed; left:0; right:0; bottom:0; z-index:31; margin:0 auto; max-width:440px; background:var(--paper); border-radius:20px 20px 0 0; max-height:78vh; display:flex; flex-direction:column;}
.compila .sheet-grab{width:38px;height:4px;border-radius:999px;background:#c9c2b4;margin:10px auto 4px;}
.compila .sheet-h{padding:6px 18px 12px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line);}
.compila .sheet-h h3{font-weight:800; font-size:16px; margin:0;}
.compila .sheet-h button{background:none;border:none;font-size:22px;color:var(--ink-soft);cursor:pointer;line-height:1;}
.compila .sheet-body{padding:12px 14px 22px; overflow-y:auto;}
.compila .task{background:#fff; border:1px solid var(--line); border-radius:12px; padding:12px; margin-bottom:9px;}
.compila .task.done{opacity:.6;}
.compila .task-top{display:flex; justify-content:space-between; gap:8px; align-items:flex-start;}
.compila .task-desc{font-size:14px; font-weight:500; line-height:1.35;}
.compila .pill{font-size:10px; font-weight:700; padding:3px 8px; border-radius:7px; white-space:nowrap;}
.compila .pill.aperta{background:var(--no-bg); color:var(--no);} .compila .pill.corso{background:#fbeccb; color:var(--hi-dark);}
.compila .task-meta{font-size:11.5px; color:var(--ink-soft); margin-top:7px; display:flex; gap:14px; flex-wrap:wrap;}
.compila .task-meta b{color:var(--ink); font-weight:600;}
.compila .verifica{margin-top:10px; width:100%; border:1px solid var(--ok); background:var(--ok-bg); color:var(--ok); font-family:var(--disp); font-weight:700; font-size:13px; padding:10px; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px;}
.compila .verifica svg{width:16px;height:16px;}
.compila .empty{text-align:center; color:var(--ink-soft); font-size:13px; padding:30px 10px; line-height:1.5;}
`;
