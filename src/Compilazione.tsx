import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { liveQuery } from 'dexie';
import { db } from './lib/db';
import { salvaEsito, aggiungiFoto, rimuoviFoto, rimuoviEsito, runSync } from './lib/sync';
import {
  apriCompilazione, generaAzione, completaSopralluogo,
  nuovoEsito, opzioneDi, statoEsito, figliDi, isRipetibile,
} from './lib/compilazione';
import { toBaseSopralluogo, type SopralluogoConContesto } from './lib/sopralluoghi';
import {
  caricaGiroPrecedente, verificaAzione, caricaAreeInterne, caricaTecniciAssegnabili,
  type AzioneConContesto, type TecnicoAssegnabile,
} from './lib/azioni';
import NotaVocale from './NotaVocale';
import { newId, nomeCompleto } from './lib/types';
import type { EsitoVoce, Foto, Azione, VoceTemplate, AreaInterna } from './lib/types';

// ---------- helpers ----------
const isoPiuMesi = (mesi: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + mesi);
  return d.toISOString().slice(0, 10);
};
const isoPiuGiorni = (n: number) => {
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
interface Bozza { id: string; descrizione: string; responsabile: Resp; tecnicoTargetId: string | null; areaId: string | null; scadenza: string; priorita: 'bassa' | 'media' | 'alta'; }
interface BozzaScad { responsabile: Resp; tecnicoTargetId: string | null; areaId: string | null; mesi: number; data: string; }
const nuovaBozza = (): Bozza => ({ id: newId(), descrizione: '', responsabile: 'cliente', tecnicoTargetId: null, areaId: null, scadenza: isoPiuGiorni(30), priorita: 'media' });

const PERIODICITA = [
  { l: 'Mensile', m: 1 }, { l: 'Trimestrale', m: 3 }, { l: 'Semestrale', m: 6 },
  { l: 'Annuale', m: 12 }, { l: 'Biennale', m: 24 }, { l: 'Quinquennale', m: 60 },
];

// ---------- icone ----------
const I = {
  cam: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M3 8a2 2 0 0 1 2-2h2l1.4-2h7.2L19 6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="12.5" r="3.4" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  done: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>,
};

// ---------- striscia foto (liveQuery su Dexie) ----------
function FotoStrip({ esitoId }: { esitoId: string }) {
  const [foto, setFoto] = useState<Foto[]>([]);
  const [url, setUrl] = useState<Record<string, string>>({});

  useEffect(() => {
    const sub = liveQuery(() => db.foto.where('esito_voce_id').equals(esitoId).sortBy('ordine')).subscribe({ next: setFoto });
    return () => sub.unsubscribe();
  }, [esitoId]);

  useEffect(() => {
    const revoke: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const f of foto) {
        const fb = await db.fotoBlob.get(f.id);
        if (fb) { const u = URL.createObjectURL(fb.blob); next[f.id] = u; revoke.push(u); }
      }
      setUrl(next);
    })();
    return () => revoke.forEach(URL.revokeObjectURL);
  }, [foto]);

  async function add(files: FileList | null) {
    if (!files) return;
    const geo = await posizione();
    for (let i = 0; i < files.length && foto.length + i < 10; i++) await aggiungiFoto(esitoId, files[i], geo);
  }

  return (
    <div className="photos">
      {foto.map((f) => (
        <div key={f.id} className="ph" style={url[f.id] ? { backgroundImage: `url(${url[f.id]})` } : undefined}>
          {!url[f.id] && <span className="ph-ph">{I.cam}</span>}
          <button className="x" onClick={() => void rimuoviFoto(f.id)}>{I.x}</button>
        </div>
      ))}
      {foto.length < 10 && (
        <label className="ph-add">
          {I.cam}Foto
          <input type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={(e) => void add(e.target.files)} />
        </label>
      )}
    </div>
  );
}

// ---------- segmenti generici ----------
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
    let vivo = true; setStato('loading');
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

  const azioni = useMemo(() => base.map((b) => (locali[b.id] ? { ...b, stato: locali[b.id].stato } : b)), [base, locali]);
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
  const [compilataId, setCompilataId] = useState<string>('');
  const [voci, setVoci] = useState<VoceTemplate[]>([]);
  const [esiti, setEsiti] = useState<EsitoVoce[]>([]);
  const [bozze, setBozze] = useState<Record<string, Bozza[]>>({});
  const [scad, setScad] = useState<Record<string, BozzaScad>>({});
  const [aree, setAree] = useState<AreaInterna[]>([]);
  const [tecnici, setTecnici] = useState<TecnicoAssegnabile[]>([]);
  const [inCoda, setInCoda] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [salvataggio, setSalvataggio] = useState<'idle' | 'corso' | 'fatto' | 'errore'>('idle');
  const [sheet, setSheet] = useState<null | 'prev'>(null);

  const { azioni: prev, stato: statoPrev } = useGiroPrecedente(sopralluogo.incarico_id, sopralluogo.id);
  const prevAperte = prev.filter((a) => a.stato !== 'conclusa').length;

  // apertura
  useEffect(() => {
    let vivo = true; setFase('loading');
    apriCompilazione(sopralluogo)
      .then((d) => { if (vivo) { setCompilataId(d.compilataId); setVoci(d.voci); setEsiti(d.esiti); setFase('ok'); } })
      .catch((e) => { if (vivo) { setErroreMsg(String(e?.message ?? e)); setFase('errore'); } });
    return () => { vivo = false; };
  }, [sopralluogo.id]);

  // rete + coda
  useEffect(() => {
    const su = () => setOnline(true); const giu = () => setOnline(false);
    window.addEventListener('online', su); window.addEventListener('offline', giu);
    const sub = liveQuery(() => db.outbox.count()).subscribe({ next: setInCoda });
    return () => { window.removeEventListener('online', su); window.removeEventListener('offline', giu); sub.unsubscribe(); };
  }, []);

  // aree interne (per assegnare le cose da fare a una funzione: Formazione,
  // Preventivi…). Best-effort: se offline o vuoto, resta solo "tecnico".
  useEffect(() => {
    let vivo = true;
    caricaAreeInterne().then((a) => vivo && setAree(a)).catch(() => { /* offline */ });
    return () => { vivo = false; };
  }, []);

  // tecnici attivi (per assegnare una cosa da fare a un collega: tecnico A -> B).
  // Best-effort come le aree: offline resta disponibile solo "Me".
  useEffect(() => {
    let vivo = true;
    caricaTecniciAssegnabili().then((t) => vivo && setTecnici(t)).catch(() => { /* offline */ });
    return () => { vivo = false; };
  }, []);

  // ---- indici ----
  const voceById = useMemo(() => {
    const m = new Map<string, VoceTemplate>();
    for (const v of voci) m.set(v.id, v);
    return m;
  }, [voci]);

  const esitoTop = useMemo(() => {
    const m = new Map<string, EsitoVoce>(); // voceId -> esito (parent null, non rilievo)
    for (const e of esiti) if (e.parent_esito_id === null && e.voce_template_id) m.set(e.voce_template_id, e);
    return m;
  }, [esiti]);

  const esitoFiglio = useMemo(() => {
    const m = new Map<string, EsitoVoce>(); // `${voceId}:${parentEsitoId}` -> esito
    for (const e of esiti) if (e.parent_esito_id && e.voce_template_id) m.set(`${e.voce_template_id}:${e.parent_esito_id}`, e);
    return m;
  }, [esiti]);

  const rilieviByVoce = useMemo(() => {
    const m = new Map<string, EsitoVoce[]>();
    for (const e of esiti) {
      if (e.voce_tipo === 'rilievo' && e.voce_template_id) {
        const arr = m.get(e.voce_template_id) ?? []; arr.push(e); m.set(e.voce_template_id, arr);
      }
    }
    return m;
  }, [esiti]);

  // ---- mutazioni esiti ----
  const upsertEsiti = (next: EsitoVoce[]) => setEsiti(next);
  const sostituisci = (e: EsitoVoce) => setEsiti((arr) => arr.map((x) => (x.id === e.id ? e : x)));

  async function ensureFigli(voce: VoceTemplate, parentEsito: EsitoVoce, chiave: string) {
    const figli = figliDi(voci, voce.id).filter((f) => f.mostra_se_chiave === chiave && !isRipetibile(f));
    const nuovi: EsitoVoce[] = [];
    for (const f of figli) {
      if (!esitoFiglio.has(`${f.id}:${parentEsito.id}`)) {
        const e = nuovoEsito(compilataId, f, parentEsito.id);
        nuovi.push(e);
      }
    }
    if (nuovi.length) {
      upsertEsiti([...esiti, ...nuovi]);
      for (const e of nuovi) await salvaEsito(e);
    }
  }

  async function setScelta(esito: EsitoVoce, voce: VoceTemplate, chiave: string) {
    const corrente = esito.valore === chiave ? null : chiave;
    const opt = opzioneDi(voce, corrente);
    const agg: EsitoVoce = {
      ...esito,
      valore: corrente,
      stato: statoEsito(voce, corrente),
      genera_azione: !!opt?.genera_azione,
    };
    sostituisci(agg);
    await salvaEsito(agg);

    // bozza azione (lista per esito: si parte da una, se ne possono aggiungere)
    setBozze((b) => {
      const n = { ...b };
      if (opt?.genera_azione && !(n[esito.id]?.length)) n[esito.id] = [nuovaBozza()];
      if (!opt?.genera_azione) delete n[esito.id];
      return n;
    });
    // bozza scadenza (solo opzione positiva + scadenza abilitata)
    setScad((s) => {
      const n = { ...s };
      const pos = opt?.stato === 'positivo' && voce.config?.scadenza?.abilitata;
      if (!pos) delete n[esito.id];
      return n;
    });
    // rivela figli
    if (corrente) await ensureFigli(voce, agg, corrente);
  }

  async function setMulti(esito: EsitoVoce, voce: VoceTemplate, chiave: string) {
    const arr = Array.isArray(esito.valore) ? [...(esito.valore as string[])] : [];
    const i = arr.indexOf(chiave);
    if (i >= 0) arr.splice(i, 1); else arr.push(chiave);
    const agg = { ...esito, valore: arr.length ? arr : null };
    sostituisci(agg); await salvaEsito(agg);
    void voce;
  }

  async function setValoreSemplice(esito: EsitoVoce, valore: unknown) {
    const agg = { ...esito, valore: valore === '' ? null : valore };
    sostituisci(agg); await salvaEsito(agg);
  }
  async function setNota(esito: EsitoVoce, note: string) {
    sostituisci({ ...esito, note });
  }
  async function salvaNota(esito: EsitoVoce) { await salvaEsito(esito); }

  // cose da fare come LISTA per esito: aggiungi / rimuovi / modifica una bozza.
  const aggiungiBozza = (esitoId: string) =>
    setBozze((b) => ({ ...b, [esitoId]: [...(b[esitoId] ?? []), nuovaBozza()] }));
  const rimuoviBozza = (esitoId: string, bozzaId: string) =>
    setBozze((b) => ({ ...b, [esitoId]: (b[esitoId] ?? []).filter((x) => x.id !== bozzaId) }));
  const setBozza = (esitoId: string, bozzaId: string, patch: Partial<Bozza>) =>
    setBozze((b) => ({
      ...b,
      [esitoId]: (b[esitoId] ?? []).map((x) => (x.id === bozzaId ? { ...x, ...patch } : x)),
    }));
  const toggleScad = (id: string, mesiDefault?: number) =>
    setScad((s) => {
      const n = { ...s };
      if (n[id]) delete n[id];
      else { const m = mesiDefault ?? 12; n[id] = { responsabile: 'cliente', tecnicoTargetId: null, areaId: null, mesi: m, data: isoPiuMesi(m) }; }
      return n;
    });
  const setScadPatch = (id: string, patch: Partial<BozzaScad>) =>
    setScad((s) => {
      const cur = s[id]; if (!cur) return s;
      const merged = { ...cur, ...patch };
      if (patch.mesi != null) merged.data = isoPiuMesi(patch.mesi);
      return { ...s, [id]: merged };
    });

  // ---- rilievi ----
  async function aggiungiRilievo(voce: VoceTemplate) {
    const e = nuovoEsito(compilataId, voce);
    e.valore = '';
    upsertEsiti([...esiti, e]);
    await salvaEsito(e);
  }
  async function rimuoviRilievo(esito: EsitoVoce) {
    if (!confirm('Eliminare questo rilievo? Verranno rimosse anche le sue foto e l’eventuale cosa da fare collegata.')) return;
    await rimuoviEsito(esito.id);
    setEsiti((arr) => arr.filter((x) => x.id !== esito.id));
    setBozze((b) => { const n = { ...b }; delete n[esito.id]; return n; });
    setScad((s) => { const n = { ...s }; delete n[esito.id]; return n; });
  }
  async function setRilievoTesto(esito: EsitoVoce, testo: string) {
    sostituisci({ ...esito, valore: testo });
  }
  async function salvaRilievo(esito: EsitoVoce) { await salvaEsito(esito); }
  async function toggleRilievoAzione(esito: EsitoVoce) {
    const g = !esito.genera_azione;
    const agg = { ...esito, genera_azione: g };
    sostituisci(agg); await salvaEsito(agg);
    setBozze((b) => { const n = { ...b }; if (g && !(n[esito.id]?.length)) n[esito.id] = [nuovaBozza()]; if (!g) delete n[esito.id]; return n; });
  }

  // ---- sintesi ----
  const topVoci = useMemo(() => voci.filter((v) => v.parent_voce_id === null), [voci]);
  const totale = topVoci.filter((v) => !isRipetibile(v)).length;
  const fatte = topVoci.filter((v) => !isRipetibile(v) && (esitoTop.get(v.id)?.valore != null)).length;
  const nAzioni = Object.values(bozze).reduce((acc, l) => acc + l.length, 0) + Object.keys(scad).length;

  const sezioni = useMemo(() => {
    const out: Array<{ sez: string | null; voci: VoceTemplate[] }> = [];
    for (const v of [...topVoci].sort((a, b) => a.ordine - b.ordine)) {
      let g = out[out.length - 1];
      if (!g || g.sez !== v.sezione) { g = { sez: v.sezione, voci: [] }; out.push(g); }
      g.voci.push(v);
    }
    return out;
  }, [topVoci]);

  // ---- completa ----
  async function completa() {
    setSalvataggio('corso');
    try {
      // Cose da fare: una azione per ogni bozza della lista dell'esito (più
      // cose da fare possibili sullo stesso rilievo). azioneId = id della bozza,
      // così la creazione è idempotente e non duplica al re-salvataggio.
      for (const [esitoId, lista] of Object.entries(bozze)) {
        const e = esiti.find((x) => x.id === esitoId);
        if (!e) continue;
        for (const b of lista) {
          const desc = b.descrizione.trim()
            || (e.voce_tipo === 'rilievo' ? String(e.valore ?? '').trim() : '')
            || `Da definire — ${e.voce_testo}`;
          const interno = b.responsabile === 'interno';
          await generaAzione({
            azioneId: b.id,
            esitoId: e.id, sopralluogoId: sopralluogo.id, tipo: 'azione_correttiva',
            descrizione: desc, responsabileTipo: interno ? 'risorsa_interna' : 'cliente',
            dataScadenza: b.scadenza || null, priorita: b.priorita,
            clienteId: sopralluogo.cliente_id,
            tecnicoId: interno ? (b.tecnicoTargetId ?? tecnicoId) : tecnicoId,
            areaId: interno ? b.areaId : null,
          });
        }
      }
      for (const [esitoId, s] of Object.entries(scad)) {
        const e = esiti.find((x) => x.id === esitoId);
        const interno = s.responsabile === 'interno';
        await generaAzione({
          esitoId, sopralluogoId: sopralluogo.id, tipo: 'scadenza_ricorrente',
          descrizione: `Scadenza ricorrente: ${e?.voce_testo ?? ''}`.trim(),
          responsabileTipo: interno ? 'risorsa_interna' : 'cliente',
          dataScadenza: s.data || null, priorita: 'media',
          clienteId: sopralluogo.cliente_id,
          tecnicoId: interno ? (s.tecnicoTargetId ?? tecnicoId) : tecnicoId,
          periodicitaMesi: s.mesi,
          areaId: interno ? s.areaId : null,
        });
      }
      await completaSopralluogo(toBaseSopralluogo(sopralluogo));
      void runSync();
      // La notifica email ai destinatari interni parte LATO SERVER quando la
      // cosa-da-fare arriva sul database (Database Webhook -> notifica-azione):
      // così funziona anche se il sopralluogo è stato chiuso offline e la coda
      // si sincronizza più tardi. Niente invio dall'app, niente dipendenza dalla
      // connessione del telefono al momento della chiusura.
      setSalvataggio('fatto');
      setTimeout(onChiudi, 1400);
    } catch {
      setSalvataggio('errore');
    }
  }

  if (fase === 'loading') return <Cornice><p className="muted">Apro la checklist…</p></Cornice>;
  if (fase === 'errore') {
    return (
      <Cornice>
        <p className="muted">{erroreMsg ?? 'Errore.'}</p>
        <button className="cta" onClick={onChiudi}>Torna ai sopralluoghi</button>
      </Cornice>
    );
  }

  const ctaLabel = salvataggio === 'fatto' ? (online ? 'Sincronizzato' : 'Salvato · sincronizzo dopo')
    : salvataggio === 'corso' ? 'Salvo…' : 'Completa e sincronizza';

  // ---- render di una voce (ricorsivo per le sotto-domande) ----
  function renderVoce(voce: VoceTemplate, parentEsitoId: string | null): ReactNode {
    if (voce.tipo === 'rilievo') return renderRilievo(voce);

    const esito = parentEsitoId
      ? esitoFiglio.get(`${voce.id}:${parentEsitoId}`)
      : esitoTop.get(voce.id);
    if (!esito) return null;

    const valore = esito.valore;
    const opt = opzioneDi(voce, valore);
    const figli = figliDi(voci, voce.id);
    const childKey = typeof valore === 'string' ? valore : null;

    let corpo: ReactNode = null;
    switch (voce.tipo) {
      case 'scelta':
        corpo = (
          <>
            <div className="opts">
              {(voce.config.opzioni ?? []).map((o) => {
                const on = valore === o.chiave;
                const cls = on ? (o.stato === 'positivo' ? 'on-ok' : o.stato === 'da_fare' ? 'on-no' : o.stato === 'non_applicabile' ? 'on-na' : 'on-neu') : '';
                return <button key={o.chiave} className={'opt ' + cls} onClick={() => void setScelta(esito, voce, o.chiave)}>{o.etichetta}</button>;
              })}
            </div>
            {valore != null && (
              <>
                <NotaVocale className="note" placeholder="Note…" ariaLabel="Note"
                  value={esito.note ?? ''}
                  onChange={(t) => void setNota(esito, t)}
                  onCommit={() => void salvaNota(esito)} />
                <FotoStrip esitoId={esito.id} />
                {opt?.genera_azione && renderBozzeAzione(esito)}
                {opt?.stato === 'positivo' && voce.config.scadenza?.abilitata && renderScadenza(esito, voce)}
              </>
            )}
          </>
        );
        break;
      case 'multiscelta': {
        const arr = Array.isArray(valore) ? (valore as string[]) : [];
        corpo = (
          <div className="checks">
            {(voce.config.opzioni ?? []).map((o) => (
              <label key={o.chiave} className={'chk' + (arr.includes(o.chiave) ? ' on' : '')}>
                <input type="checkbox" checked={arr.includes(o.chiave)} onChange={() => void setMulti(esito, voce, o.chiave)} />
                {o.etichetta}
              </label>
            ))}
          </div>
        );
        break;
      }
      case 'testo':
        corpo = <NotaVocale className="fld" rows={2} placeholder="Scrivi…" ariaLabel="Testo"
          defaultValue={(valore as string) ?? ''}
          onCommit={(t) => void setValoreSemplice(esito, t)} />;
        break;
      case 'data':
        corpo = <input className="fld" type="date" value={(valore as string) ?? ''} onChange={(e) => void setValoreSemplice(esito, e.target.value)} />;
        break;
      case 'numero':
        corpo = <input className="fld" type="number" inputMode="numeric" placeholder="0" defaultValue={(valore as number | null) ?? ''}
          onBlur={(e) => void setValoreSemplice(esito, e.target.value === '' ? null : Number(e.target.value))} />;
        break;
      case 'slider': {
        const min = voce.config.min ?? 1; const max = voce.config.max ?? 5;
        const val = (valore as number) ?? min;
        corpo = (
          <div className="slider">
            <input type="range" min={min} max={max} value={val} onChange={(e) => void setValoreSemplice(esito, Number(e.target.value))} />
            <span className="slider-val">{val}</span>
          </div>
        );
        break;
      }
      case 'foto':
        corpo = <FotoStrip esitoId={esito.id} />;
        break;
    }

    return (
      <div key={voce.id} className={'voce' + (esito.stato ? ' s-' + esito.stato : '')}>
        <div className="voce-head">
          <div className="voce-req">{voce.testo_requisito}</div>
          {voce.descrizione && <div className="voce-hint">{voce.descrizione}</div>}
          <div className="voce-body">{corpo}</div>
        </div>
        {childKey && figli.some((f) => f.mostra_se_chiave === childKey) && (
          <div className="sub">
            {figli.filter((f) => f.mostra_se_chiave === childKey).map((f) => renderVoce(f, esito.id))}
          </div>
        )}
      </div>
    );
  }

  function renderRilievo(voce: VoceTemplate): ReactNode {
    const istanze = (rilieviByVoce.get(voce.id) ?? []).sort((a, b) => a.id.localeCompare(b.id));
    return (
      <div key={voce.id} className="voce">
        <div className="voce-head">
          <div className="voce-req">{voce.testo_requisito}</div>
          {voce.descrizione && <div className="voce-hint">{voce.descrizione}</div>}
          {istanze.map((e, idx) => (
            <div key={e.id} className="rilievo">
              <div className="ril-h">
                <span className="ril-n">Rilievo {idx + 1}</span>
                <button className="ril-del" title="Elimina questo rilievo"
                  onClick={() => void rimuoviRilievo(e)}>{I.x}</button>
              </div>
              <NotaVocale className="fld" rows={2} placeholder="Descrivi il rilievo…" ariaLabel="Rilievo"
                defaultValue={(e.valore as string) ?? ''}
                onCommit={(t) => { void setRilievoTesto(e, t).then(() => salvaRilievo({ ...e, valore: t })); }} />
              <FotoStrip esitoId={e.id} />
              <label className={'ril-az' + (e.genera_azione ? ' on' : '')}>
                <input type="checkbox" checked={e.genera_azione} onChange={() => void toggleRilievoAzione(e)} />
                Genera una "cosa da fare"
              </label>
              {e.genera_azione && renderBozzeAzione(e)}
            </div>
          ))}
          <button className="add-ril" onClick={() => void aggiungiRilievo(voce)}>{I.plus} Aggiungi rilievo</button>
        </div>
      </div>
    );
  }

  // Select del destinatario interno: Me / altri tecnici (A->B) / aree. Il valore
  // è codificato ('me' | 'tec:<id>' | 'area:<id>') e tradotto in tecnicoTargetId/areaId.
  const valoreDest = (tecnicoTargetId: string | null, areaId: string | null): string =>
    areaId ? `area:${areaId}` : tecnicoTargetId ? `tec:${tecnicoTargetId}` : 'me';
  const campiDest = (v: string): { tecnicoTargetId: string | null; areaId: string | null } =>
    v.startsWith('tec:') ? { tecnicoTargetId: v.slice(4), areaId: null }
      : v.startsWith('area:') ? { tecnicoTargetId: null, areaId: v.slice(5) }
        : { tecnicoTargetId: null, areaId: null };

  function SelectDestinatario({ value, onPick }: { value: string; onPick: (v: string) => void }): ReactNode {
    const altri = tecnici.filter((t) => t.id !== tecnicoId);
    return (
      <div className="field"><label>Destinatario interno</label>
        <select value={value} onChange={(e) => onPick(e.target.value)}>
          <option value="me">Me (tecnico del sopralluogo)</option>
          {altri.length > 0 && (
            <optgroup label="Altri tecnici">
              {altri.map((t) => <option key={t.id} value={`tec:${t.id}`}>{nomeCompleto(t)}</option>)}
            </optgroup>
          )}
          {aree.length > 0 && (
            <optgroup label="Aree / funzioni">
              {aree.map((a) => <option key={a.id} value={`area:${a.id}`}>{a.nome}</option>)}
            </optgroup>
          )}
        </select>
      </div>
    );
  }

  // Una o PIÙ cose da fare per lo stesso esito/rilievo (lista di bozze).
  function renderBozzeAzione(esito: EsitoVoce): ReactNode {
    const lista = bozze[esito.id] ?? [];
    return (
      <>
        {lista.map((b, idx) => (
          <div className="gen azione" key={b.id}>
            <div className="gen-h">
              <span>Cosa da fare{lista.length > 1 ? ` ${idx + 1}` : ''}</span>
              <button className="gen-x" title="Rimuovi questa cosa da fare"
                onClick={() => rimuoviBozza(esito.id, b.id)}>{I.x}</button>
            </div>
            <div className="field"><label>Descrizione</label>
              <NotaVocale className="" rows={2} placeholder="Cosa va fatto…" ariaLabel="Descrizione cosa da fare"
                value={b.descrizione}
                onChange={(t) => setBozza(esito.id, b.id, { descrizione: t })} /></div>
            <div className="field"><label>Responsabile</label>
              <Seg value={b.responsabile}
                onChange={(x) => setBozza(esito.id, b.id, { responsabile: x, tecnicoTargetId: null, areaId: null })}
                options={[{ v: 'cliente', l: 'Cliente' }, { v: 'interno', l: 'Interno' }]} /></div>
            {b.responsabile === 'interno' && (
              <SelectDestinatario value={valoreDest(b.tecnicoTargetId, b.areaId)}
                onPick={(v) => setBozza(esito.id, b.id, campiDest(v))} />
            )}
            <div className="row2">
              <div className="field"><label>Scadenza</label>
                <input type="date" value={b.scadenza} onChange={(e) => setBozza(esito.id, b.id, { scadenza: e.target.value })} /></div>
              <div className="field"><label>Priorità</label>
                <Seg value={b.priorita} onChange={(x) => setBozza(esito.id, b.id, { priorita: x })} options={[{ v: 'bassa', l: 'Bassa' }, { v: 'media', l: 'Media' }, { v: 'alta', l: 'Alta' }]} /></div>
            </div>
          </div>
        ))}
        <button className="add-cdf" onClick={() => aggiungiBozza(esito.id)}>{I.plus} Aggiungi cosa da fare</button>
      </>
    );
  }

  function renderScadenza(esito: EsitoVoce, voce: VoceTemplate): ReactNode {
    const s = scad[esito.id];
    const def = voce.config.scadenza?.periodicita_default_mesi;
    return (
      <div className="gen scad">
        <label className={'ril-az' + (s ? ' on' : '')}>
          <input type="checkbox" checked={!!s} onChange={() => toggleScad(esito.id, def)} />
          Crea scadenza ricorrente
        </label>
        {s && (
          <>
            <div className="field"><label>Periodicità</label>
              <div className="seg wrap">
                {PERIODICITA.map((p) => (
                  <button key={p.m} className={s.mesi === p.m ? 'on' : ''} onClick={() => setScadPatch(esito.id, { mesi: p.m })}>{p.l}</button>
                ))}
              </div>
            </div>
            <div className="row2">
              <div className="field"><label>Prossima scadenza</label>
                <input type="date" value={s.data} onChange={(e) => setScadPatch(esito.id, { data: e.target.value })} /></div>
              <div className="field"><label>Responsabile</label>
                <Seg value={s.responsabile} onChange={(x) => setScadPatch(esito.id, { responsabile: x, tecnicoTargetId: null, areaId: null })} options={[{ v: 'cliente', l: 'Cliente' }, { v: 'interno', l: 'Interno' }]} /></div>
            </div>
            {s.responsabile === 'interno' && (
              <SelectDestinatario value={valoreDest(s.tecnicoTargetId, s.areaId)}
                onPick={(v) => setScadPatch(esito.id, campiDest(v))} />
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="compila">
      <style>{CSS}</style>
      <div className="phone">
        <header>
          <div className="h-top">
            <button className="hb" onClick={onChiudi}>{I.back}</button>
            <div className="h-mid">
              <div className="h-client">{sopralluogo.cliente_nome ?? 'Cliente —'}</div>
              <div className="h-sub">{[sopralluogo.tipo_attivita, sopralluogo.progressivo].filter(Boolean).join(' · ') || 'Sopralluogo'}</div>
            </div>
            <div className={'sync ' + (online ? 'online' : 'offline')}>
              <span className="dot" />{online ? (inCoda ? `${inCoda} in coda` : 'Online') : `Offline · ${inCoda}`}
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
              {s.voci.map((v) => renderVoce(v, null))}
            </div>
          ))}
        </main>

        <footer><div className="foot-inner">
          <div className="chips">
            <div className="chip az"><span className="n">{nAzioni}</span><span>Cose da fare<small>generate ora</small></span></div>
            <div className="chip prev" onClick={() => setSheet('prev')}>
              <span className="n">{statoPrev === 'ok' ? String(prevAperte) : '·'}</span>
              <span>Giro precedente<small>azioni aperte</small></span>
            </div>
          </div>
          <button className={'cta' + (salvataggio === 'fatto' ? ' done' : '')} disabled={salvataggio === 'corso' || salvataggio === 'fatto'} onClick={() => void completa()}>
            {salvataggio === 'fatto' && I.done}{ctaLabel}
          </button>
        </div></footer>

        {sheet && <div className="scrim show" onClick={() => setSheet(null)} />}

        {sheet === 'prev' && (
          <div className="sheet show">
            <div className="sheet-grab" />
            <div className="sheet-h"><h3>Giro precedente · azioni aperte</h3><button onClick={() => setSheet(null)}>×</button></div>
            <div className="sheet-body">
              {statoPrev === 'loading' && <p className="muted">Carico le azioni del giro precedente…</p>}
              {statoPrev === 'errore' && <div className="empty">Serve la connessione per caricare il giro precedente.</div>}
              {statoPrev === 'ok' && prev.length === 0 && <div className="empty">Nessuna azione aperta dal giro precedente.</div>}
              {prev.map((a) => {
                const conclusa = a.stato === 'conclusa';
                return (
                  <div key={a.id} className={'task' + (conclusa ? ' done' : '')}>
                    <div className="task-top">
                      <div className="task-desc">{a.descrizione}</div>
                      <span className={'pill ' + (conclusa ? 'corso' : 'aperta')}>{conclusa ? 'Conclusa' : 'Aperta'}</span>
                    </div>
                    <div className="task-meta">
                      {a.sopralluogo_label && <span>Da <b>{a.sopralluogo_label}</b></span>}
                      <span>Resp. <b>{a.responsabile_tipo === 'cliente' ? 'Cliente' : 'Interno'}</b></span>
                      {a.data_scadenza && <span>Scad. <b>{fmt(a.data_scadenza)}</b></span>}
                    </div>
                    {!conclusa && (
                      <button className="verifica" onClick={() => void verificaAzione(a, sopralluogo.id, { autoreId: tecnicoId })}>{I.done} Verifica e chiudi</button>
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

// ---------- stile ----------
const CSS = `
.compila{
  --disp:-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",sans-serif;
  --ink:#16181c; --ink-soft:#5b5f66; --line:#e3ddd2; --paper:#f5f2ec; --card:#fff;
  --hi:#f4a012; --hi-dark:#9a6206; --ok:#1f9d57; --ok-bg:#e7f5ec; --no:#d8442f; --no-bg:#fbeae6; --na:#8a8f97; --na-bg:#eceae5;
  --shadow:0 1px 0 rgba(0,0,0,.04),0 8px 24px -16px rgba(0,0,0,.25);
  font-family:var(--disp); color:var(--ink); background:#d9d4ca; display:flex; justify-content:center; min-height:100vh;
}
.compila *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
.compila .phone{width:100%; max-width:440px; background:var(--paper); min-height:100vh; position:relative; display:flex; flex-direction:column; box-shadow:0 0 60px -20px rgba(0,0,0,.5);}
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
.compila .sync.offline .dot{background:var(--hi);} .compila .sync.online .dot{background:#39d98a;}
.compila .progress-wrap{margin-top:11px;}
.compila .progress-meta{display:flex; justify-content:space-between; font-size:11px; color:#c7cad0; margin-bottom:5px; font-weight:500;}
.compila .progress-meta b{color:#fff; font-weight:700;}
.compila .bar{height:6px; background:rgba(255,255,255,.14); border-radius:999px; overflow:hidden;}
.compila .bar > i{display:block; height:100%; background:var(--hi); border-radius:999px; transition:width .35s;}

.compila main{flex:1; padding:14px 14px 150px;}
.compila .section-h{font-weight:700; font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-soft); margin:18px 4px 9px; display:flex; align-items:center; gap:8px;}
.compila .section-h::after{content:""; flex:1; height:1px; background:var(--line);}

.compila .voce{background:var(--card); border:1px solid var(--line); border-radius:14px; margin-bottom:10px; overflow:hidden; box-shadow:var(--shadow); border-left:4px solid transparent;}
.compila .voce.s-conforme{border-left-color:var(--ok);} .compila .voce.s-non_conforme{border-left-color:var(--no);} .compila .voce.s-non_applicabile{border-left-color:var(--na);}
.compila .voce-head{padding:13px 14px;}
.compila .voce-req{font-size:15px; font-weight:500; line-height:1.35;}
.compila .voce-hint{font-size:12px; color:var(--ink-soft); margin-top:4px; line-height:1.4;}
.compila .voce-body{margin-top:11px;}

.compila .opts{display:flex; flex-wrap:wrap; gap:7px;}
.compila .opt{flex:1 1 auto; min-width:90px; border:1.5px solid var(--line); background:#fbfaf7; color:var(--ink-soft); font-family:var(--disp); font-weight:600; font-size:12.5px; padding:10px 8px; border-radius:10px; cursor:pointer;}
.compila .opt:active{transform:scale(.97);}
.compila .opt.on-ok{background:var(--ok-bg); border-color:var(--ok); color:var(--ok);}
.compila .opt.on-no{background:var(--no-bg); border-color:var(--no); color:var(--no);}
.compila .opt.on-na{background:var(--na-bg); border-color:var(--na); color:#555;}
.compila .opt.on-neu{background:#eef1f4; border-color:#9aa3ad; color:#2b3a4a;}

.compila .checks{display:flex; flex-direction:column; gap:7px;}
.compila .chk,.compila .ril-az{display:flex; align-items:center; gap:9px; font-size:13.5px; font-weight:500; border:1px solid var(--line); background:#fbfaf7; border-radius:10px; padding:10px 12px; cursor:pointer;}
.compila .chk.on{background:#eef1f4; border-color:#9aa3ad;}
.compila .chk input,.compila .ril-az input{width:17px;height:17px; accent-color:var(--hi);}
.compila .ril-az{margin-top:9px;} .compila .ril-az.on{background:var(--no-bg); border-color:#f1c4b9; color:var(--no); font-weight:600;}

.compila .fld{width:100%; appearance:none; border:1px solid var(--line); border-radius:10px; background:#fbfaf7; padding:11px 12px; font-family:inherit; font-size:14px; color:var(--ink);}
.compila .fld:focus{outline:none; border-color:var(--hi); background:#fff;}
.compila textarea.fld{resize:none;}
.compila .slider{display:flex; align-items:center; gap:12px;} .compila .slider input{flex:1;} .compila .slider-val{font-weight:800; font-size:16px; min-width:24px; text-align:center;}

.compila .note{width:100%; border:1px solid var(--line); border-radius:10px; background:#fbfaf7; padding:10px 11px; font-family:inherit; font-size:14px; color:var(--ink); resize:none; min-height:42px; margin:10px 0;}
.compila .note:focus{outline:none; border-color:var(--hi); background:#fff;}
.compila .nv-wrap{position:relative;}
.compila .nv-wrap textarea{padding-right:46px;}
.compila .nv-mic{position:absolute; top:8px; right:8px; width:30px; height:30px; border-radius:50%;
  border:1px solid var(--line); background:#fff; color:var(--ink); font-size:14px; line-height:1;
  display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0;
  box-shadow:0 1px 0 rgba(0,0,0,.04);}
.compila .nv-mic:active{transform:scale(.95);}
.compila .nv-mic.on{width:auto; padding:0 11px; border-radius:15px; background:var(--no); color:#fff;
  border-color:var(--no); font-weight:800; font-size:11.5px; letter-spacing:.02em;
  animation:nv-pulse 1.1s ease-in-out infinite;}
@keyframes nv-pulse{0%,100%{box-shadow:0 0 0 0 rgba(216,68,47,.45);}50%{box-shadow:0 0 0 6px rgba(216,68,47,0);}}
.compila .nv-err{font-size:11.5px; color:var(--no); margin:-4px 0 8px;}
.compila .field .nv-wrap textarea{margin:0; width:100%; appearance:none; border:1px solid rgba(0,0,0,.12);
  border-radius:8px; padding:9px 46px 9px 10px; font-family:inherit; font-size:13.5px; background:#fff; color:var(--ink); resize:none;}
.compila .field .nv-wrap textarea:focus{outline:none; border-color:var(--ink);}

.compila .photos{display:flex; gap:8px; flex-wrap:wrap; align-items:center;}
.compila .ph-add,.compila .ph{width:58px; height:58px; border-radius:10px; flex-shrink:0; position:relative;}
.compila .ph-add{border:1.5px dashed #c9c2b4; background:#fbfaf7; color:var(--ink-soft); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; font-size:9.5px; font-weight:600; cursor:pointer;}
.compila .ph-add svg{width:18px;height:18px;}
.compila .ph{background-size:cover; background-position:center; box-shadow:inset 0 0 0 1px rgba(0,0,0,.08); background-color:#eceae4; display:flex; align-items:center; justify-content:center;}
.compila .ph-ph{color:var(--na);} .compila .ph-ph svg{width:20px;height:20px;}
.compila .ph .x{position:absolute; top:-6px; right:-6px; width:20px;height:20px; border-radius:50%; background:var(--ink); color:#fff; border:2px solid var(--paper); display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0;}
.compila .ph .x svg{width:10px;height:10px;}

.compila .sub{margin:0 0 0 14px; padding:2px 0 12px 12px; border-left:2px solid var(--line);}
.compila .sub .voce{box-shadow:none; border-radius:10px;}

.compila .rilievo{border:1px solid var(--line); border-radius:12px; padding:11px; margin-top:10px; background:#fbfaf7;}
.compila .ril-h{display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;}
.compila .ril-n{font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--ink-soft);}
.compila .ril-del{background:none; border:none; color:var(--na); cursor:pointer; padding:0; width:26px; height:26px; border-radius:7px; display:flex; align-items:center; justify-content:center; flex-shrink:0;}
.compila .ril-del svg{width:14px; height:14px;}
.compila .ril-del:active{background:var(--no-bg); color:var(--no);}

.compila .gen{margin-top:12px; border-radius:12px; padding:12px; border:1px solid;}
.compila .gen.azione{background:var(--no-bg); border-color:#f1c4b9;} .compila .gen.scad{background:#fbeccb; border-color:#f0d28a;}
.compila .gen-h{font-weight:700; font-size:12px; letter-spacing:.04em; text-transform:uppercase; margin-bottom:10px; color:var(--no); display:flex; align-items:center; justify-content:space-between; gap:8px;}
.compila .gen-x{background:none; border:none; color:var(--no); cursor:pointer; padding:0; width:22px; height:22px; border-radius:6px; display:flex; align-items:center; justify-content:center; flex-shrink:0;}
.compila .gen-x svg{width:13px; height:13px;}
.compila .gen-x:active{background:rgba(216,68,47,.14);}
.compila .add-cdf{margin-top:2px; width:100%; border:1.5px dashed #f1c4b9; background:var(--no-bg); color:var(--no); font-family:var(--disp); font-weight:700; font-size:12.5px; padding:10px; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px;}
.compila .add-cdf svg{width:15px; height:15px;}
.compila .field select{width:100%; appearance:none; -webkit-appearance:none; border:1px solid rgba(0,0,0,.12); border-radius:8px; padding:9px 32px 9px 10px; font-family:inherit; font-size:13.5px; background-color:#fff; color:var(--ink); background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235b5f66' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 9px center; background-size:16px;}
.compila .field select:focus{outline:none; border-color:var(--ink);}
.compila .field{margin-bottom:9px;} .compila .field label{display:block; font-size:11px; font-weight:600; color:var(--ink-soft); margin-bottom:4px;}
.compila .field input,.compila .field textarea{width:100%; appearance:none; border:1px solid rgba(0,0,0,.12); border-radius:8px; padding:9px 10px; font-family:inherit; font-size:13.5px; background:#fff; color:var(--ink); resize:none;}
.compila .field input:focus,.compila .field textarea:focus{outline:none; border-color:var(--ink);}
.compila .seg{display:flex; gap:6px;} .compila .seg.wrap{flex-wrap:wrap;}
.compila .seg button{flex:1 1 auto; border:1px solid rgba(0,0,0,.14); background:#fff; color:var(--ink-soft); font-family:inherit; font-weight:600; font-size:12px; padding:8px 6px; border-radius:8px; cursor:pointer;}
.compila .seg button.on{background:var(--ink); color:#fff; border-color:var(--ink);}
.compila .row2{display:grid; grid-template-columns:1fr 1fr; gap:8px;}

.compila .add-ril{margin-top:10px; width:100%; border:1.5px dashed #c9c2b4; background:#fbfaf7; color:var(--ink-soft); font-family:var(--disp); font-weight:700; font-size:13px; padding:11px; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px;}
.compila .add-ril svg{width:16px;height:16px;}

.compila footer{position:fixed; bottom:0; left:0; right:0; z-index:20; display:flex; justify-content:center; pointer-events:none;}
.compila .foot-inner{width:100%; max-width:440px; background:rgba(245,242,236,.97); backdrop-filter:blur(10px); border-top:1px solid var(--line); padding:10px 14px calc(10px + env(safe-area-inset-bottom)); pointer-events:auto;}
.compila .chips{display:flex; gap:8px; margin-bottom:9px;}
.compila .chip{flex:1; background:#fff; border:1px solid var(--line); border-radius:11px; padding:8px 10px; display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; font-weight:600;}
.compila .chip .n{font-weight:800; font-size:15px; min-width:22px; height:22px; border-radius:7px; display:flex; align-items:center; justify-content:center; color:#fff;}
.compila .chip.az .n{background:var(--no);} .compila .chip.prev .n{background:var(--ink);}
.compila .chip small{color:var(--ink-soft); font-weight:500; font-size:11px; display:block; line-height:1.2;}
.compila .cta{width:100%; border:none; border-radius:12px; padding:14px; cursor:pointer; font-family:var(--disp); font-weight:800; font-size:15px; background:var(--hi); color:#1a1205; display:flex; align-items:center; justify-content:center; gap:9px; transition:.18s;}
.compila .cta:disabled{opacity:.85;} .compila .cta.done{background:var(--ok); color:#fff;} .compila .cta svg{width:18px;height:18px;}

.compila .scrim{position:fixed; inset:0; background:rgba(20,22,26,.45); z-index:30; opacity:0; pointer-events:none; transition:.2s;}
.compila .scrim.show{opacity:1; pointer-events:auto;}
.compila .sheet{position:fixed; left:0; right:0; bottom:0; z-index:31; margin:0 auto; max-width:440px; background:var(--paper); border-radius:20px 20px 0 0; max-height:78vh; display:flex; flex-direction:column;}
.compila .sheet-grab{width:38px;height:4px;border-radius:999px;background:#c9c2b4;margin:10px auto 4px;}
.compila .sheet-h{padding:6px 18px 12px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line);}
.compila .sheet-h h3{font-weight:800; font-size:16px; margin:0;} .compila .sheet-h button{background:none;border:none;font-size:22px;color:var(--ink-soft);cursor:pointer;line-height:1;}
.compila .sheet-body{padding:12px 14px 22px; overflow-y:auto;}
.compila .task{background:#fff; border:1px solid var(--line); border-radius:12px; padding:12px; margin-bottom:9px;} .compila .task.done{opacity:.6;}
.compila .task-top{display:flex; justify-content:space-between; gap:8px; align-items:flex-start;}
.compila .task-desc{font-size:14px; font-weight:500; line-height:1.35;}
.compila .pill{font-size:10px; font-weight:700; padding:3px 8px; border-radius:7px; white-space:nowrap;}
.compila .pill.aperta{background:var(--no-bg); color:var(--no);} .compila .pill.corso{background:#fbeccb; color:var(--hi-dark);}
.compila .task-meta{font-size:11.5px; color:var(--ink-soft); margin-top:7px; display:flex; gap:14px; flex-wrap:wrap;} .compila .task-meta b{color:var(--ink); font-weight:600;}
.compila .verifica{margin-top:10px; width:100%; border:1px solid var(--ok); background:var(--ok-bg); color:var(--ok); font-family:var(--disp); font-weight:700; font-size:13px; padding:10px; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px;} .compila .verifica svg{width:16px;height:16px;}
.compila .empty{text-align:center; color:var(--ink-soft); font-size:13px; padding:30px 10px; line-height:1.5;}
`;
