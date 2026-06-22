// Editor di un CAPITOLO (box del catalogo). Gestisce: meta (nome, descrizione),
// le SEZIONI (con flag ripetibile + etichetta del "+") e, per ogni sezione, le
// VOCI con le stesse capacita' dei template (tipo, opzioni, scadenza, sotto-
// domande): riusa la scheda voce dell'editor template (VoceCard).
//
// Solo capitoli 'generico' e NON ancora usati in un sopralluogo. Un capitolo gia'
// usato va duplicato (dalla lista) per poterlo modificare.

import { useEffect, useMemo, useState } from 'react';
import {
  caricaCapitoloCompleto, creaCapitolo, salvaCapitoloInPlace, type DatiCapitolo,
} from '../lib/admin/capitoli';
import {
  newId, type BoxSezione, type OpzioneVoce, type VoceConfig, type VoceTemplate, type VoceTipo,
} from '../lib/types';
import { VoceCard, haOpzioni, configDefault } from './TemplateEditor';

export type AperturaCapitolo =
  | { modo: 'nuovo' }
  | { modo: 'modifica'; boxId: string };

function nuovaVoce(sezioneId: string, parentId: string | null, ordine: number,
  mostraSe: string | null = null): VoceTemplate {
  return {
    id: newId(), template_id: null, sezione_id: sezioneId, codice: null, sezione: null,
    ordine, testo_requisito: '', descrizione: null, tipo: 'scelta', obbligatoria: false,
    parent_voce_id: parentId, mostra_se_chiave: mostraSe, calendarizzabile: false,
    config: configDefault('scelta'),
  };
}
function nuovaSezione(ordine: number): BoxSezione {
  return {
    id: newId(), box_id: '', codice: 'SEZ_' + newId().slice(0, 6).toUpperCase(),
    nome: '', ordine, ripetibile: false, etichetta_componente: null,
  };
}

function reindex(sezioni: BoxSezione[], voci: VoceTemplate[]): { sezioni: BoxSezione[]; voci: VoceTemplate[] } {
  const s2 = sezioni.map((s) => ({ ...s })).sort((a, b) => a.ordine - b.ordine)
    .map((s, i) => ({ ...s, ordine: i }));
  const v2 = voci.map((v) => ({ ...v }));
  // top-level per sezione: 10,20,...
  for (const s of s2) {
    v2.filter((v) => !v.parent_voce_id && v.sezione_id === s.id)
      .sort((a, b) => a.ordine - b.ordine).forEach((v, i) => { v.ordine = (i + 1) * 10; });
  }
  // figli: 1,2,...
  const perParent = new Map<string, VoceTemplate[]>();
  for (const v of v2) if (v.parent_voce_id) {
    const a = perParent.get(v.parent_voce_id) ?? []; a.push(v); perParent.set(v.parent_voce_id, a);
  }
  for (const a of perParent.values()) a.sort((x, y) => x.ordine - y.ordine).forEach((v, i) => { v.ordine = i + 1; });
  return { sezioni: s2, voci: v2 };
}

export default function CapitoloEditor({
  apertura, onChiudi,
}: { apertura: AperturaCapitolo; onChiudi: (salvato: boolean) => void }) {
  const [boxId, setBoxId] = useState<string | null>(null);
  const [usato, setUsato] = useState(false);
  const [nome, setNome] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [sezioni, setSezioni] = useState<BoxSezione[]>([]);
  const [voci, setVoci] = useState<VoceTemplate[]>([]);
  const [sezOrigId, setSezOrigId] = useState<string[]>([]);
  const [vociOrigId, setVociOrigId] = useState<string[]>([]);

  const [fase, setFase] = useState<'carico' | 'pronto' | 'errore'>('carico');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    if (apertura.modo === 'nuovo') {
      const s = nuovaSezione(0);
      setSezioni([s]); setVoci([]); setFase('pronto');
      return;
    }
    caricaCapitoloCompleto(apertura.boxId)
      .then((c) => {
        if (!vivo) return;
        setBoxId(c.box.id); setUsato(c.usato);
        setNome(c.box.nome); setDescrizione(c.box.descrizione ?? '');
        setSezioni(c.sezioni); setVoci(c.voci);
        setSezOrigId(c.sezioni.map((s) => s.id));
        setVociOrigId(c.voci.map((v) => v.id));
        setFase('pronto');
      })
      .catch(() => vivo && setFase('errore'));
    return () => { vivo = false; };
  }, [apertura]);

  // ---- mutazioni voci (stesse semantiche dell'editor template) ----
  const patchVoce = (id: string, patch: Partial<VoceTemplate>) =>
    setVoci((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const patchConfig = (id: string, patch: Partial<VoceConfig>) =>
    setVoci((vs) => vs.map((v) => (v.id === id ? { ...v, config: { ...v.config, ...patch } } : v)));
  function cambiaTipo(id: string, tipo: VoceTipo) {
    setVoci((vs) => {
      const lascia = !haOpzioni(tipo);
      return vs.filter((v) => !(lascia && v.parent_voce_id === id))
        .map((v) => (v.id === id ? { ...v, tipo, config: configDefault(tipo) } : v));
    });
  }
  function aggiungiVoce(sezioneId: string) {
    const top = voci.filter((v) => !v.parent_voce_id && v.sezione_id === sezioneId);
    const maxOrd = top.reduce((m, v) => Math.max(m, v.ordine), 0);
    setVoci((vs) => [...vs, nuovaVoce(sezioneId, null, maxOrd + 10)]);
  }
  function aggiungiFiglio(parentId: string, chiave: string) {
    const parent = voci.find((v) => v.id === parentId);
    const sezId = parent?.sezione_id ?? sezioni[0]?.id ?? '';
    const figli = voci.filter((v) => v.parent_voce_id === parentId);
    const maxOrd = figli.reduce((m, v) => Math.max(m, v.ordine), 0);
    setVoci((vs) => [...vs, nuovaVoce(sezId, parentId, maxOrd + 1, chiave)]);
  }
  function elimina(id: string) {
    setVoci((vs) => vs.filter((v) => v.id !== id && v.parent_voce_id !== id));
  }
  function sposta(id: string, dir: -1 | 1) {
    setVoci((vs) => {
      const v = vs.find((x) => x.id === id);
      if (!v) return vs;
      const fratelli = vs.filter((x) =>
        x.parent_voce_id === v.parent_voce_id
        && (v.parent_voce_id ? true : x.sezione_id === v.sezione_id))
        .sort((a, b) => a.ordine - b.ordine);
      const i = fratelli.findIndex((x) => x.id === id);
      const j = i + dir;
      if (j < 0 || j >= fratelli.length) return vs;
      const o1 = fratelli[i].ordine, o2 = fratelli[j].ordine;
      return vs.map((x) =>
        x.id === fratelli[i].id ? { ...x, ordine: o2 }
          : x.id === fratelli[j].id ? { ...x, ordine: o1 } : x);
    });
  }
  // sposta una voce di primo livello (con le sue sotto-domande) in un'altra sezione
  function spostaVoceInSezione(voceId: string, nuovaSez: string) {
    setVoci((vs) => {
      const v = vs.find((x) => x.id === voceId);
      if (!v || v.sezione_id === nuovaSez) return vs;
      const maxOrd = vs.filter((x) => !x.parent_voce_id && x.sezione_id === nuovaSez)
        .reduce((m, x) => Math.max(m, x.ordine), 0);
      return vs.map((x) => {
        if (x.id === voceId) return { ...x, sezione_id: nuovaSez, ordine: maxOrd + 10 };
        if (x.parent_voce_id === voceId) return { ...x, sezione_id: nuovaSez };
        return x;
      });
    });
  }
  // copia una voce di primo livello (con le sue sotto-domande) in una sezione,
  // rigenerando gli id (config clonato in profondita': nessuna condivisione).
  function copiaVoceInSezione(voceId: string, sezId: string) {
    setVoci((vs) => {
      const v = vs.find((x) => x.id === voceId);
      if (!v) return vs;
      const figli = vs.filter((x) => x.parent_voce_id === voceId).sort((a, b) => a.ordine - b.ordine);
      const maxOrd = vs.filter((x) => !x.parent_voce_id && x.sezione_id === sezId)
        .reduce((m, x) => Math.max(m, x.ordine), 0);
      const clone = (c: VoceConfig): VoceConfig => JSON.parse(JSON.stringify(c ?? {}));
      const newTopId = newId();
      const copiaTop: VoceTemplate = {
        ...v, id: newTopId, sezione_id: sezId, parent_voce_id: null,
        ordine: maxOrd + 10, codice: null, config: clone(v.config),
      };
      const copieFigli: VoceTemplate[] = figli.map((f, i) => ({
        ...f, id: newId(), parent_voce_id: newTopId, sezione_id: sezId,
        ordine: i + 1, codice: null, config: clone(f.config),
      }));
      return [...vs, copiaTop, ...copieFigli];
    });
  }
  const opzioniDi = (v: VoceTemplate) => v.config.opzioni ?? [];
  const setOpzioni = (id: string, opz: OpzioneVoce[]) => patchConfig(id, { opzioni: opz });
  const aggiungiOpzione = (v: VoceTemplate) =>
    setOpzioni(v.id, [...opzioniDi(v), { chiave: `opz${opzioniDi(v).length + 1}`, etichetta: '' }]);
  const patchOpzione = (v: VoceTemplate, i: number, patch: Partial<OpzioneVoce>) =>
    setOpzioni(v.id, opzioniDi(v).map((o, k) => (k === i ? { ...o, ...patch } : o)));
  const eliminaOpzione = (v: VoceTemplate, i: number) =>
    setOpzioni(v.id, opzioniDi(v).filter((_, k) => k !== i));

  // ---- mutazioni sezioni ----
  const patchSezione = (id: string, patch: Partial<BoxSezione>) =>
    setSezioni((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  function aggiungiSezione() {
    const maxOrd = sezioni.reduce((m, s) => Math.max(m, s.ordine), -1);
    setSezioni((ss) => [...ss, nuovaSezione(maxOrd + 1)]);
  }
  function eliminaSezione(id: string) {
    setSezioni((ss) => ss.filter((s) => s.id !== id));
    setVoci((vs) => vs.filter((v) => v.sezione_id !== id));
  }
  function spostaSezione(id: string, dir: -1 | 1) {
    setSezioni((ss) => {
      const ord = [...ss].sort((a, b) => a.ordine - b.ordine);
      const i = ord.findIndex((s) => s.id === id);
      const j = i + dir;
      if (j < 0 || j >= ord.length) return ss;
      const o1 = ord[i].ordine, o2 = ord[j].ordine;
      return ss.map((s) => s.id === ord[i].id ? { ...s, ordine: o2 }
        : s.id === ord[j].id ? { ...s, ordine: o1 } : s);
    });
  }

  const sezOrdinate = useMemo(() => [...sezioni].sort((a, b) => a.ordine - b.ordine), [sezioni]);
  const topDiSezione = (sezId: string) =>
    voci.filter((v) => !v.parent_voce_id && v.sezione_id === sezId).sort((a, b) => a.ordine - b.ordine);
  const figliDi = (id: string) =>
    voci.filter((v) => v.parent_voce_id === id).sort((a, b) => a.ordine - b.ordine);

  async function salva() {
    setErrore(null);
    if (usato) return setErrore('Capitolo gia\u2019 usato in un sopralluogo: duplicalo per modificarlo.');
    if (!nome.trim()) return setErrore('Indica il nome del capitolo.');
    if (sezioni.length === 0) return setErrore('Aggiungi almeno una sezione.');
    for (const s of sezioni) if (!s.nome.trim()) return setErrore('Ogni sezione deve avere un nome.');
    for (const v of voci) {
      if (!v.testo_requisito.trim()) return setErrore('Ogni voce deve avere un testo.');
      if (haOpzioni(v.tipo) && opzioniDi(v).filter((o) => o.chiave.trim()).length === 0) {
        return setErrore(`La voce "${v.testo_requisito || '—'}" e\u2019 a scelta ma non ha opzioni.`);
      }
    }
    const fin = reindex(sezioni, voci);
    const dati: DatiCapitolo = {
      nome: nome.trim(), descrizione: descrizione.trim() || null,
      sezioni: fin.sezioni, voci: fin.voci,
    };
    setSalvando(true);
    try {
      if (boxId) await salvaCapitoloInPlace(boxId, dati, sezOrigId, vociOrigId);
      else await creaCapitolo(dati);
      onChiudi(true);
    } catch (e) {
      setErrore((e as Error)?.message ? `Salvataggio non riuscito: ${(e as Error).message}` : 'Salvataggio non riuscito.');
      setSalvando(false);
    }
  }

  if (fase === 'carico') return <div className="bo-empty">Carico il capitolo…</div>;
  if (fase === 'errore') {
    return (
      <div>
        <div className="bo-err">Impossibile caricare il capitolo.</div>
        <button className="bo-btn ghost" onClick={() => onChiudi(false)}>Torna all'elenco</button>
      </div>
    );
  }

  const titolo = boxId ? `Modifica capitolo: ${nome}` : 'Nuovo capitolo';

  return (
    <div>
      <div className="bo-row" style={{ marginBottom: 14 }}>
        <div className="grow"><h2 className="bo-h">{titolo}</h2></div>
        <button className="bo-btn ghost" onClick={() => onChiudi(false)} disabled={salvando}>Annulla</button>
        <button className="bo-btn" onClick={() => void salva()} disabled={salvando}>
          {salvando ? 'Salvo…' : 'Salva'}
        </button>
      </div>

      {errore && <div className="bo-err">{errore}</div>}

      <div className="bo-card">
        <label className="bo-field">
          <span>Nome del capitolo</span>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
            placeholder="Es. Impianti" />
        </label>
        <label className="bo-field" style={{ marginBottom: 0 }}>
          <span>Descrizione (opzionale)</span>
          <textarea value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        </label>
      </div>

      {sezOrdinate.map((s) => (
        <div key={s.id} className="bo-card" style={{ marginTop: 14 }}>
          <div className="bo-voce-top" style={{ marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div className="bo-meta" style={{ marginBottom: 6 }}>Sezione</div>
              <input type="text" value={s.nome}
                onChange={(e) => patchSezione(s.id, { nome: e.target.value })}
                placeholder="Nome sezione (es. Messa a terra)" />
            </div>
            <button className="bo-iconbtn" title="Su" onClick={() => spostaSezione(s.id, -1)}>↑</button>
            <button className="bo-iconbtn" title="Giù" onClick={() => spostaSezione(s.id, 1)}>↓</button>
            <button className="bo-iconbtn" title="Elimina sezione" onClick={() => eliminaSezione(s.id)}>✕</button>
          </div>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
            <label className="chk">
              <input type="checkbox" checked={s.ripetibile}
                onChange={(e) => patchSezione(s.id, {
                  ripetibile: e.target.checked,
                  etichetta_componente: e.target.checked ? (s.etichetta_componente ?? 'Aggiungi') : null,
                })} />
              Ripetibile (un blocco per componente di sede)
            </label>
            {s.ripetibile && (
              <label className="bo-field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
                <span>Etichetta bottone "+"</span>
                <input type="text" value={s.etichetta_componente ?? ''}
                  onChange={(e) => patchSezione(s.id, { etichetta_componente: e.target.value || null })}
                  placeholder="Es. Aggiungi quadro" />
              </label>
            )}
          </div>

          {topDiSezione(s.id).map((v) => (
            <div key={v.id}>
              <div className="bo-meta" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0 -2px' }}>
                {sezOrdinate.length > 1 && (
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    Sposta in:
                    <select value={s.id} onChange={(e) => spostaVoceInSezione(v.id, e.target.value)}>
                      {sezOrdinate.map((ss) => (
                        <option key={ss.id} value={ss.id}>{ss.nome || '(senza nome)'}</option>
                      ))}
                    </select>
                  </span>
                )}
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  Copia in:
                  <select value="" onChange={(e) => { if (e.target.value) copiaVoceInSezione(v.id, e.target.value); }}>
                    <option value="">— scegli sezione —</option>
                    {sezOrdinate.map((ss) => (
                      <option key={ss.id} value={ss.id}>{ss.nome || '(senza nome)'}</option>
                    ))}
                  </select>
                </span>
              </div>
              <VoceCard
                v={v} child={false} parentOpzioni={[]} nascondiSezione
                figli={figliDi(v.id)}
                {...{ patchVoce, patchConfig, cambiaTipo, elimina, sposta, aggiungiFiglio,
                  opzioniDi, aggiungiOpzione, patchOpzione, eliminaOpzione }}
              />
            </div>
          ))}

          <button className="bo-btn ghost sm" onClick={() => aggiungiVoce(s.id)} style={{ marginTop: 4 }}>
            + Aggiungi voce
          </button>
        </div>
      ))}

      <button className="bo-btn ghost" onClick={aggiungiSezione} style={{ marginTop: 14 }}>
        + Aggiungi sezione
      </button>

      <div className="bo-bar">
        <button className="bo-btn ghost" onClick={() => onChiudi(false)} disabled={salvando}>Annulla</button>
        <button className="bo-btn" onClick={() => void salva()} disabled={salvando}>
          {salvando ? 'Salvo…' : 'Salva'}
        </button>
      </div>
    </div>
  );
}
