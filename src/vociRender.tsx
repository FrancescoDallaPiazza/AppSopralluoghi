// Motore di rendering di una voce, estratto da Compilazione.tsx per essere
// riusato dal renderer dei box generici senza duplicare la logica (single source).
// Le funzioni di render sono presentazionali: ricevono un ContestoVoci tipizzato
// (stato + callback) che il chiamante assembla dal proprio stato. Lo stato e gli
// handler restano di proprieta' del chiamante (Compilazione mantiene completa()).

import { useEffect, useState, type ReactNode } from 'react';
import { liveQuery } from 'dexie';
import { db } from './lib/db';
import { aggiungiFoto, rimuoviFoto } from './lib/sync';
import { figliDi } from './lib/compilazione';
import NotaVocale from './NotaVocale';
import { nomeCompleto } from './lib/types';
import type { EsitoVoce, EsitoStato, Foto, VoceTemplate, AreaInterna } from './lib/types';
import type { TecnicoAssegnabile } from './lib/azioni';

// tipi delle cose-da-fare in bozza, condivisi con Compilazione (importati da qui).
type Resp = 'cliente' | 'interno';
interface Bozza { id: string; descrizione: string; responsabile: Resp; tecnicoTargetId: string | null; areaId: string | null; scadenza: string; priorita: 'bassa' | 'media' | 'alta'; }
interface BozzaScad { responsabile: Resp; tecnicoTargetId: string | null; areaId: string | null; mesi: number; data: string; }

const PERIODICITA = [
  { l: 'Mensile', m: 1 }, { l: 'Trimestrale', m: 3 }, { l: 'Semestrale', m: 6 },
  { l: 'Annuale', m: 12 }, { l: 'Biennale', m: 24 }, { l: 'Quinquennale', m: 60 },
];


const I = {
  cam: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M3 8a2 2 0 0 1 2-2h2l1.4-2h7.2L19 6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="12.5" r="3.4" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  done: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>,
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


// Contesto passato alle funzioni di render: indici sugli esiti, stato delle
// cose-da-fare/scadenze, anagrafiche per i destinatari, e i callback di mutazione
// (mantenuti dal chiamante). Gli handler async sono tipati come "=> void" perche'
// invocati con "void f(...)"; setRilievoTesto e' atteso come Promise per il .then.
export interface ContestoVoci {
  esitoTop: Map<string, EsitoVoce>;
  esitoFiglio: Map<string, EsitoVoce>;
  rilieviByVoce: Map<string, EsitoVoce[]>;
  voci: VoceTemplate[];
  bozze: Record<string, Bozza[]>;
  scad: Record<string, BozzaScad>;
  aree: AreaInterna[];
  tecnici: TecnicoAssegnabile[];
  tecnicoId: string;
  setScelta: (esito: EsitoVoce, voce: VoceTemplate, chiave: string) => void;
  setMulti: (esito: EsitoVoce, voce: VoceTemplate, chiave: string) => void;
  setValoreSemplice: (esito: EsitoVoce, valore: unknown) => void;
  setNota: (esito: EsitoVoce, note: string) => void;
  salvaNota: (esito: EsitoVoce) => void;
  setEsito: (esito: EsitoVoce, stato: EsitoStato) => void;
  aggiungiRilievo: (voce: VoceTemplate) => void;
  rimuoviRilievo: (esito: EsitoVoce) => void;
  setRilievoTesto: (esito: EsitoVoce, testo: string) => Promise<void>;
  salvaRilievo: (esito: EsitoVoce) => void;
  aggiungiBozza: (esitoId: string) => void;
  rimuoviBozza: (esitoId: string, bozzaId: string) => void;
  setBozza: (esitoId: string, bozzaId: string, patch: Partial<Bozza>) => void;
  toggleScad: (id: string, mesiDefault?: number) => void;
  setScadPatch: (id: string, patch: Partial<BozzaScad>) => void;
}

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


  const valoreDest = (tecnicoTargetId: string | null, areaId: string | null): string =>
    areaId ? `area:${areaId}` : tecnicoTargetId ? `tec:${tecnicoTargetId}` : 'me';
  const campiDest = (v: string): { tecnicoTargetId: string | null; areaId: string | null } =>
    v.startsWith('tec:') ? { tecnicoTargetId: v.slice(4), areaId: null }
      : v.startsWith('area:') ? { tecnicoTargetId: null, areaId: v.slice(5) }
        : { tecnicoTargetId: null, areaId: null };


function SelectDestinatario({ ctx, value, onPick }: { ctx: ContestoVoci; value: string; onPick: (v: string) => void }): ReactNode {
  const { tecnici, tecnicoId, aree } = ctx;
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

  // Evidenze universali: nota (testo+dettatura vocale) e foto su QUALSIASI voce.
  // Saltiamo la nota sulle voci 'testo' (il loro input è già una nota) e le foto
  // sulle voci 'foto' (il loro input è già la striscia foto), per non duplicare.

export function renderVoce(ctx: ContestoVoci, voce: VoceTemplate, parentEsitoId: string | null): ReactNode {
  const { esitoTop, esitoFiglio, voci, setScelta, setMulti, setValoreSemplice } = ctx;
    if (voce.tipo === 'rilievo') return renderRilievo(ctx, voce);

    const esito = parentEsitoId
      ? esitoFiglio.get(`${voce.id}:${parentEsitoId}`)
      : esitoTop.get(voce.id);
    if (!esito) return null;

    const valore = esito.valore;
    const figli = figliDi(voci, voce.id);
    const childKey = typeof valore === 'string' ? valore : null;

    let corpo: ReactNode = null;
    switch (voce.tipo) {
      case 'scelta':
        corpo = (
          <div className="opts">
            {(voce.config.opzioni ?? []).map((o) => (
              <button key={o.chiave} className={'opt' + (valore === o.chiave ? ' on-sel' : '')}
                onClick={() => void setScelta(esito, voce, o.chiave)}>{o.etichetta}</button>
            ))}
          </div>
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
          <div className="voce-body">
            {corpo}
            {/* Modalità di rilievo UNICA: a prescindere dal tipo di voce, dopo
                l'input vengono SEMPRE offerti evidenze (nota testo+voce, foto),
                output opzionali (cose da fare, scadenza ricorrente) e l'esito
                esplicito in coda. I `rilievo` hanno il loro flusso per-istanza
                in renderRilievo. */}
            {renderEvidenze(ctx, esito, voce)}
            {renderBozzeAzione(ctx, esito)}
            {renderScadenza(ctx, esito, voce)}
            {renderEsito(ctx, esito)}
          </div>
        </div>
        {childKey && figli.some((f) => f.mostra_se_chiave === childKey) && (
          <div className="sub">
            {figli.filter((f) => f.mostra_se_chiave === childKey).map((f) => renderVoce(ctx, f, esito.id))}
          </div>
        )}
      </div>
    );
  }


export function renderRilievo(ctx: ContestoVoci, voce: VoceTemplate): ReactNode {
  const { rilieviByVoce, rimuoviRilievo, setRilievoTesto, salvaRilievo, aggiungiRilievo } = ctx;
    const istanze = (rilieviByVoce.get(voce.id) ?? []).sort((a, b) => (a.ordine - b.ordine) || a.id.localeCompare(b.id));
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
              {/* Card di rilievo = stessa modalità unica delle voci predefinite:
                  descrizione (testo+voce), foto, cose da fare, scadenza, esito. */}
              <NotaVocale className="fld" rows={2} placeholder="Descrivi il rilievo…" ariaLabel="Rilievo"
                defaultValue={(e.valore as string) ?? ''}
                onCommit={(t) => { void setRilievoTesto(e, t).then(() => salvaRilievo({ ...e, valore: t })); }} />
              <FotoStrip esitoId={e.id} />
              {renderBozzeAzione(ctx, e)}
              {renderScadenza(ctx, e, voce)}
              {renderEsito(ctx, e)}
            </div>
          ))}
          <button className="add-ril" onClick={() => void aggiungiRilievo(voce)}>{I.plus} {voce.config.etichetta_aggiunta?.trim() || 'Aggiungi rilievo'}</button>
        </div>
      </div>
    );
  }

  // Select del destinatario interno: Me / altri tecnici (A->B) / aree. Il valore

export function renderEvidenze(ctx: ContestoVoci, esito: EsitoVoce, voce: VoceTemplate): ReactNode {
  const { setNota, salvaNota } = ctx;
    return (
      <>
        {voce.tipo !== 'testo' && (
          <NotaVocale className="note" placeholder="Note…" ariaLabel="Note"
            value={esito.note ?? ''}
            onChange={(t) => void setNota(esito, t)}
            onCommit={() => void salvaNota(esito)} />
        )}
        {voce.tipo !== 'foto' && <FotoStrip esitoId={esito.id} />}
      </>
    );
  }

  // Esito esplicito, in coda alla card. Tre stati + ri-clic per azzerare.

export function renderEsito(ctx: ContestoVoci, esito: EsitoVoce): ReactNode {
  const { setEsito } = ctx;
    const opts: Array<{ v: EsitoStato; l: string; c: string }> = [
      { v: 'conforme', l: 'Conforme', c: 'ok' },
      { v: 'non_conforme', l: 'Non conforme', c: 'no' },
      { v: 'non_applicabile', l: 'N.A.', c: 'na' },
    ];
    return (
      <div className="esito-box">
        <div className="esito-lab">Esito</div>
        <div className="seg esito">
          {opts.map((o) => (
            <button key={o.v} className={esito.stato === o.v ? 'on ' + o.c : ''}
              onClick={() => void setEsito(esito, o.v)}>{o.l}</button>
          ))}
        </div>
      </div>
    );
  }

  // Una o PIÙ cose da fare per lo stesso esito/rilievo (lista di bozze).

export function renderBozzeAzione(ctx: ContestoVoci, esito: EsitoVoce): ReactNode {
  const { bozze, rimuoviBozza, setBozza, aggiungiBozza } = ctx;
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
              <SelectDestinatario ctx={ctx} value={valoreDest(b.tecnicoTargetId, b.areaId)}
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


export function renderScadenza(ctx: ContestoVoci, esito: EsitoVoce, voce: VoceTemplate): ReactNode {
  const { scad, toggleScad, setScadPatch } = ctx;
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
              <SelectDestinatario ctx={ctx} value={valoreDest(s.tecnicoTargetId, s.areaId)}
                onPick={(v) => setScadPatch(esito.id, campiDest(v))} />
            )}
          </>
        )}
      </div>
    );
  }

