import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { liveQuery } from 'dexie';
import { db } from './lib/db';
import { rimuoviAzione, runSync } from './lib/sync';
import {
  apriCompilazione, iniziaCompilazione, generaAzione, completaSopralluogo,
  isRipetibile, aggiornaTestataSopralluogo,
  type TemplateScelta,
} from './lib/compilazione';
import { toBaseSopralluogo, type SopralluogoConContesto } from './lib/sopralluoghi';
import {
  caricaGiroPrecedente, verificaAzione, caricaAreeInterne, caricaTecniciAssegnabili,
  type AzioneConContesto, type TecnicoAssegnabile,
} from './lib/azioni';
import FormazioneRiepilogo from './FormazioneRiepilogo';
import BoxGenerico from './BoxGenerico';
import { assicuraComposizione } from './lib/box';
import { nomeCompleto } from './lib/types';
import type { Azione, VoceTemplate, AreaInterna, Sede } from './lib/types';
import { renderVoce, I, type ContestoVoci, type Resp, type Bozza, type BozzaScad } from './vociRender';
import { useCompilazioneVoci } from './lib/useCompilazioneVoci';
import { annullaRevisione } from './lib/revisioni';

// ---------- helpers ----------
const isoPiuMesi = (mesi: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + mesi);
  return d.toISOString().slice(0, 10);
};
const fmt = (d: string) => {
  if (!d) return '—';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y}`;
};

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

// ---------- ricostruzione bozze/scadenze dalle azioni già salvate ----------
// Riaprendo (o appena creato) un sopralluogo, le cose da fare GIÀ presenti per
// quel sopralluogo si riportano nelle bozze, così si rivedono quelle reali
// (descrizione, destinatario, scadenza). Bozza.id = id dell'azione, quindi il
// ri-completamento fa upsert e non duplica. Pura: nessun accesso allo stato.
function bozzeDaAzioni(azioni: Azione[], sopralluogoId: string, tecnicoId: string) {
  const bz: Record<string, Bozza[]> = {};
  const sc: Record<string, BozzaScad> = {};
  for (const a of azioni) {
    if (a.sopralluogo_origine_id !== sopralluogoId || !a.origine_esito_id) continue;
    const interno = a.responsabile_tipo === 'risorsa_interna';
    const versoArea = interno && !!a.responsabile_area_id;
    const versoAltroTec = interno && !versoArea
      && !!a.responsabile_interno_id && a.responsabile_interno_id !== tecnicoId;
    const resp: Resp = interno ? 'interno' : 'cliente';
    const tecnicoTargetId = versoAltroTec ? a.responsabile_interno_id : null;
    const areaId = versoArea ? a.responsabile_area_id : null;
    if (a.tipo === 'scadenza_ricorrente') {
      const mesi = a.periodicita_mesi ?? 12;
      sc[a.origine_esito_id] = {
        responsabile: resp, tecnicoTargetId, areaId,
        mesi, data: a.data_scadenza ?? isoPiuMesi(mesi),
      };
    } else {
      (bz[a.origine_esito_id] ??= []).push({
        id: a.id,
        descrizione: a.descrizione ?? '',
        responsabile: resp, tecnicoTargetId, areaId,
        scadenza: a.data_scadenza ?? '',
        priorita: a.priorita ?? 'media',
      });
    }
  }
  return { bz, sc };
}

// ---------- componente ----------
interface Props {
  sopralluogo: SopralluogoConContesto;
  tecnicoId: string;
  onChiudi: () => void;
}

export default function Compilazione({ sopralluogo, tecnicoId, onChiudi }: Props) {
  const [fase, setFase] = useState<'loading' | 'ok' | 'errore' | 'scelta'>('loading');
  const [erroreMsg, setErroreMsg] = useState<string | null>(null);
  const [compilataId, setCompilataId] = useState<string>('');
  const [voci, setVoci] = useState<VoceTemplate[]>([]);
  const motore = useCompilazioneVoci();
  const { esiti, bozze, scad } = motore;
  const [aree, setAree] = useState<AreaInterna[]>([]);
  const [tecnici, setTecnici] = useState<TecnicoAssegnabile[]>([]);
  const [inCoda, setInCoda] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [salvataggio, setSalvataggio] = useState<'idle' | 'corso' | 'fatto' | 'errore'>('idle');
  const [sheet, setSheet] = useState<null | 'prev' | 'form'>(null);
  const [annullando, setAnnullando] = useState(false);
  // scelta della checklist alla prima apertura (default = quella dell'incarico)
  const [tmplScelta, setTmplScelta] = useState<TemplateScelta[]>([]);
  const [tmplSel, setTmplSel] = useState<string | null>(null);
  const [tmplDefault, setTmplDefault] = useState<string | null>(null);
  const [avviando, setAvviando] = useState(false);

  // --- testata: sede ispezionata + data effettiva (editabili) ---
  const [sedeId, setSedeId] = useState<string | null>(sopralluogo.sede_id ?? null);
  const [dataEff, setDataEff] = useState<string>(
    (sopralluogo.data_effettiva ?? new Date().toISOString()).slice(0, 10),
  );
  const [sediCli, setSediCli] = useState<Sede[]>([]);
  useEffect(() => {
    const cid = sopralluogo.cliente_id;
    if (!cid) { setSediCli([]); return; }
    let vivo = true;
    db.sediLocali.where('cliente_id').equals(cid).toArray()
      .then((rows) => { if (vivo) setSediCli(rows.filter((s) => s.attivo)); })
      .catch(() => { /* offline senza cache: nessuna tendina */ });
    return () => { vivo = false; };
  }, [sopralluogo.cliente_id]);
  function persistiTestata(patch: { sede_id?: string | null; data_effettiva?: string | null }) {
    void aggiornaTestataSopralluogo(
      { ...sopralluogo, sede_id: sedeId, data_effettiva: dataEff || null } as SopralluogoConContesto,
      patch,
    );
  }
  // true quando si sta modificando un sopralluogo già completato (una revisione)
  const inRevisione = (sopralluogo.revisione_corrente ?? 1) > 1;

  async function annulla() {
    if (annullando) return;
    const ok = window.confirm(
      'Annullare la modifica?\n\nLe eventuali modifiche fatte verranno scartate e il '
      + 'sopralluogo tornerà alla versione precedente, senza creare una nuova revisione.',
    );
    if (!ok) return;
    setAnnullando(true);
    try { await annullaRevisione(sopralluogo); onChiudi(); }
    catch (e) {
      window.alert('Annullamento non riuscito: ' + String((e as Error)?.message ?? e));
      setAnnullando(false);
    }
  }

  const { azioni: prev, stato: statoPrev } = useGiroPrecedente(sopralluogo.incarico_id, sopralluogo.id);
  const prevAperte = prev.filter((a) => a.stato !== 'conclusa').length;

  // apertura
  useEffect(() => {
    let vivo = true; setFase('loading');
    apriCompilazione(sopralluogo)
      .then(async (r) => {
        if (!vivo) return;
        // serve scegliere la checklist (prima apertura): default = incarico
        if (r.modo === 'scelta') {
          setTmplScelta(r.templates);
          setTmplDefault(r.defaultTemplateId ?? null);
          setTmplSel(r.defaultTemplateId ?? r.templates[0]?.id ?? null);
          setFase('scelta');
          return;
        }
        // pronto: ripresa o ripiego offline sul template dell'incarico
        setCompilataId(r.compilataId); setVoci(r.voci); motore.setEsiti(r.esiti);
        // Composizione box del giro (dal template + box fissi): idempotente,
        // no-op finche' il catalogo box e' vuoto. I box si montano sotto.
        try { await assicuraComposizione(sopralluogo.id, r.templateId); } catch { /* offline: dal locale */ }
        try {
          const tutte = await db.azioni.toArray();
          const { bz, sc } = bozzeDaAzioni(tutte, sopralluogo.id, tecnicoId);
          if (vivo) { motore.setBozze(bz); motore.setScad(sc); }
        } catch { /* offline o nessuna azione locale: si parte da vuoto */ }
        if (vivo) setFase('ok');
      })
      .catch((e) => { if (vivo) { setErroreMsg(String(e?.message ?? e)); setFase('errore'); } });
    return () => { vivo = false; };
  }, [sopralluogo.id]);

  // conferma della scelta della checklist: crea la compilazione e apre il form
  async function confermaScelta() {
    if (avviando) return;
    const sel = tmplSel ? tmplScelta.find((t) => t.id === tmplSel) : null;
    if (!sel) return;
    setAvviando(true); setFase('loading');
    try {
      const d = await iniziaCompilazione(sopralluogo, { id: sel.id, versione: sel.versione });
      setCompilataId(d.compilataId); setVoci(d.voci); motore.setEsiti(d.esiti);
      try { await assicuraComposizione(sopralluogo.id, d.templateId); } catch { /* offline: dal locale */ }
      try {
        const tutte = await db.azioni.toArray();
        const { bz, sc } = bozzeDaAzioni(tutte, sopralluogo.id, tecnicoId);
        motore.setBozze(bz); motore.setScad(sc);
      } catch { /* nessuna azione locale */ }
      setFase('ok');
    } catch (e) {
      setErroreMsg(String((e as Error)?.message ?? e)); setFase('errore');
    } finally {
      setAvviando(false);
    }
  }

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

  // nome del tecnico corrente (per la conferma organigramma); best-effort dalla
  // lista assegnabili, altrimenti null (la conferma traccia comunque il tecnico_id).
  const tecnicoNomeConferma = useMemo(() => {
    const t = tecnici.find((x) => x.id === tecnicoId);
    return t ? nomeCompleto(t) : null;
  }, [tecnici, tecnicoId]);

  // Contesto della checklist piatta: componente null. Il motore esiti/cose-da-fare/
  // scadenze e' condiviso (useCompilazioneVoci); i box generici useranno lo stesso
  // motore con buildCtx per (box, componente), confluendo nello stesso store letto
  // da completa().
  const ctx: ContestoVoci = motore.buildCtx({ compilataId, voci, componenteId: null, aree, tecnici, tecnicoId });

  // ---- sintesi ----
  const topVoci = useMemo(() => voci.filter((v) => v.parent_voce_id === null), [voci]);
  const totale = topVoci.filter((v) => !isRipetibile(v)).length;
  const fatte = topVoci.filter((v) => {
    if (isRipetibile(v)) return false;
    const e = ctx.esitoTop.get(v.id);
    return e != null && (e.stato != null || e.valore != null);
  }).length;
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
            componenteId: e.componente_id ?? null,
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
          componenteId: e?.componente_id ?? null,
        });
      }
      // Riconcilia le CANCELLAZIONI: elimina le azioni di questo sopralluogo
      // non più presenti tra bozze/scadenze correnti (cose da fare rimosse,
      // rilievi tolti). Senza, le azioni già salvate resterebbero nel report.
      const validiCorrettiva = new Set<string>();
      for (const lista of Object.values(bozze)) for (const b of lista) validiCorrettiva.add(b.id);
      const validiScadEsiti = new Set(Object.keys(scad));
      const azioniSopr = (await db.azioni.toArray()).filter((a) => a.sopralluogo_origine_id === sopralluogo.id);
      for (const a of azioniSopr) {
        const tieni = a.tipo === 'scadenza_ricorrente'
          ? (a.origine_esito_id != null && validiScadEsiti.has(a.origine_esito_id))
          : validiCorrettiva.has(a.id);
        if (!tieni) await rimuoviAzione(a.id);
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
  if (fase === 'scelta') {
    return (
      <Cornice>
        <div className="pick-client">{sopralluogo.cliente_nome ?? 'Cliente —'}</div>
        <div className="pick-sub">{[sopralluogo.tipo_attivita, sopralluogo.progressivo].filter(Boolean).join(' · ') || 'Sopralluogo'}</div>
        <p className="muted" style={{ margin: '12px 2px 16px' }}>
          Scegli la checklist per questo sopralluogo. È preselezionata quella dell'incarico,
          ma puoi cambiarla. Una volta aperta resta fissata per questa seduta; le cose da fare
          del giro precedente restano comunque collegate.
        </p>
        <div className="pick-list">
          {tmplScelta.map((t) => {
            const on = t.id === tmplSel;
            const def = t.id === tmplDefault;
            return (
              <button key={t.id} type="button" className={'pick-item' + (on ? ' on' : '')} onClick={() => setTmplSel(t.id)}>
                <span className="pick-radio" />
                <span className="pick-body">
                  <span className="pick-nome">{t.nome}{def && <span className="pick-badge">Consigliata</span>}</span>
                  <span className="pick-tipo">{t.tipo_attivita} · v{t.versione}</span>
                </span>
              </button>
            );
          })}
          {tmplScelta.length === 0 && <p className="muted">Nessuna checklist attiva disponibile.</p>}
        </div>
        <div className="pick-actions">
          <button className="pick-ghost" type="button" onClick={onChiudi} disabled={avviando}>Annulla</button>
          <button className="cta" type="button" onClick={() => void confermaScelta()} disabled={!tmplSel || avviando}>
            {avviando ? 'Apro…' : 'Apri la checklist'}
          </button>
        </div>
      </Cornice>
    );
  }

  const ctaLabel = salvataggio === 'fatto' ? (online ? 'Sincronizzato' : 'Salvato · sincronizzo dopo')
    : salvataggio === 'corso' ? 'Salvo…' : 'Completa e sincronizza';

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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '8px 0 2px', fontSize: 12, color: '#dfe7e4' }}>
            {sediCli.length > 0 && (
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                Sede
                <select value={sedeId ?? ''} style={{ fontSize: 12, padding: '3px 6px', borderRadius: 8, border: 'none' }}
                  onChange={(e) => { const v = e.target.value || null; setSedeId(v); persistiTestata({ sede_id: v }); }}>
                  <option value="">— sede unica —</option>
                  {sediCli.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </label>
            )}
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              Data
              <input type="date" value={dataEff} style={{ fontSize: 12, padding: '3px 6px', borderRadius: 8, border: 'none' }}
                onChange={(e) => { setDataEff(e.target.value); persistiTestata({ data_effettiva: e.target.value || null }); }} />
            </label>
          </div>
        </header>

        <main>
          {inRevisione && (
            <div className="rev-ban">
              <div className="rev-txt">
                Stai modificando un sopralluogo già <b>completato</b> (revisione {sopralluogo.revisione_corrente}).
                Completando confermi questa revisione; in alternativa puoi annullare e tornare com'era.
              </div>
              <button className="rev-ann" disabled={annullando} onClick={() => void annulla()}>
                {annullando ? 'Annullo…' : 'Annulla modifica'}
              </button>
            </div>
          )}

          {/* Inizio giro: box FISSO "cose da fare pregresse" in testa, da rivedere
              prima della checklist. Stesso componente, filtrato per posizione. */}
          <BoxGenerico
            sopralluogoId={sopralluogo.id}
            compilataId={compilataId}
            sedeId={sopralluogo.sede_id ?? null}
            clienteId={sopralluogo.cliente_id}
            motore={motore}
            aree={aree}
            tecnici={tecnici}
            tecnicoId={tecnicoId}
            tecnicoNome={tecnicoNomeConferma}
            pregresse={prev}
            statoPregresse={statoPrev}
            filtro="fissi"
          />

          {sezioni.map((s) => (
            <div key={s.sez ?? '—'}>
              {s.sez && <div className="section-h">{s.sez}</div>}
              {s.voci.map((v) => renderVoce(ctx, v, null))}
            </div>
          ))}

          {/* Dopo la checklist: box generici (sullo stesso motore: le loro
              cose-da-fare confluiscono in completa()) e smart (organigramma). */}
          <BoxGenerico
            sopralluogoId={sopralluogo.id}
            compilataId={compilataId}
            sedeId={sopralluogo.sede_id ?? null}
            clienteId={sopralluogo.cliente_id}
            motore={motore}
            aree={aree}
            tecnici={tecnici}
            tecnicoId={tecnicoId}
            tecnicoNome={tecnicoNomeConferma}
            pregresse={prev}
            statoPregresse={statoPrev}
            filtro="altri"
          />
        </main>

        <footer><div className="foot-inner">
          <div className="chips">
            <div className="chip az"><span className="n">{nAzioni}</span><span>Cose da fare<small>generate ora</small></span></div>
            <div className="chip prev" onClick={() => setSheet('prev')}>
              <span className="n">{statoPrev === 'ok' ? String(prevAperte) : '·'}</span>
              <span>Giro precedente<small>azioni aperte</small></span>
            </div>
            <div className="chip form" onClick={() => setSheet('form')}>
              <span className="n">i</span>
              <span>Formazione<small>stato cliente</small></span>
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

        {sheet === 'form' && (
          <div className="sheet show">
            <div className="sheet-grab" />
            <div className="sheet-h"><h3>Formazione · stato del cliente</h3><button onClick={() => setSheet(null)}>×</button></div>
            <div className="sheet-body">
              <FormazioneRiepilogo
                clienteId={sopralluogo.cliente_id}
                sopralluogoId={sopralluogo.id}
                tecnicoId={tecnicoId}
                tecnicoNome={tecnicoNomeConferma}
              />
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
.compila .opt.on-neu,.compila .opt.on-sel{background:#eef1f4; border-color:#9aa3ad; color:#2b3a4a;}

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

.compila .esito-box{margin-top:12px; padding-top:11px; border-top:1px dashed var(--line);}
.compila .esito-lab{font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-soft); margin-bottom:7px;}
.compila .seg.esito button.on.ok{background:var(--ok); color:#fff; border-color:var(--ok);}
.compila .seg.esito button.on.no{background:var(--no); color:#fff; border-color:var(--no);}
.compila .seg.esito button.on.na{background:var(--na); color:#fff; border-color:var(--na);}

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
.compila .rev-ban{display:flex; align-items:center; gap:12px; flex-wrap:wrap; background:#fbeccb; border:1px solid #f0d79a; border-radius:12px; padding:11px 13px; margin-bottom:14px;}
.compila .rev-txt{flex:1; min-width:170px; font-size:12.5px; line-height:1.45; color:var(--hi-dark);}
.compila .rev-ann{flex-shrink:0; border:1px solid var(--no); background:#fff; color:var(--no); font-family:var(--disp); font-weight:700; font-size:12.5px; padding:8px 13px; border-radius:9px; cursor:pointer;}
.compila .rev-ann:active{transform:scale(.97);} .compila .rev-ann:disabled{opacity:.6;}

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

/* selettore checklist (prima apertura) */
.compila .pick-client{font-weight:800; font-size:18px; letter-spacing:-.2px; line-height:1.15;}
.compila .pick-sub{font-size:12px; color:var(--ink-soft); margin-top:3px; font-weight:600;}
.compila .pick-list{display:flex; flex-direction:column; gap:9px;}
.compila .pick-item{display:flex; align-items:flex-start; gap:11px; width:100%; text-align:left; background:var(--card); border:1.5px solid var(--line); border-radius:13px; padding:13px; cursor:pointer; font-family:inherit; box-shadow:var(--shadow);}
.compila .pick-item.on{border-color:var(--hi); box-shadow:0 0 0 3px rgba(244,160,18,.16);}
.compila .pick-radio{flex-shrink:0; width:19px; height:19px; border-radius:50%; border:2px solid var(--line); margin-top:1px; position:relative;}
.compila .pick-item.on .pick-radio{border-color:var(--hi);}
.compila .pick-item.on .pick-radio::after{content:""; position:absolute; inset:3px; border-radius:50%; background:var(--hi);}
.compila .pick-body{display:flex; flex-direction:column; gap:3px; min-width:0;}
.compila .pick-nome{font-weight:700; font-size:14.5px; color:var(--ink); display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.compila .pick-tipo{font-size:11.5px; color:var(--ink-soft); font-weight:500;}
.compila .pick-badge{font-size:10px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:var(--hi-dark); background:#fbeccb; border-radius:999px; padding:2px 7px;}
.compila .pick-actions{display:flex; gap:10px; margin-top:18px;}
.compila .pick-ghost{flex-shrink:0; background:none; border:1.5px solid var(--line); color:var(--ink-soft); border-radius:12px; padding:0 16px; font-weight:700; font-size:14px; cursor:pointer; font-family:var(--disp);}
.compila .pick-actions .cta{flex:1;}

/* tablet/desktop: form in colonna comoda invece della strisciolina a 440px.
   footer (.foot-inner) e bottom-sheet seguono la stessa larghezza, restando
   centrati come il pannello. */
@media(min-width:760px){
  .compila .phone{max-width:720px;}
  .compila .foot-inner{max-width:720px;}
  .compila .sheet{max-width:720px;}
  .compila main{padding:18px 22px 150px;}
}
`;
