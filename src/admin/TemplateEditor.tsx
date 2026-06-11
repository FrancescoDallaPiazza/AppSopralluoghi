// Editor di un template di checklist (il modello "form configurabile" della
// migration 002). Albero di voci di primo livello con eventuali sotto-domande;
// per ogni voce il tipo (scelta/testo/data/numero/slider/foto/rilievo) e la sua
// configurazione (opzioni, scadenza, foto richieste, min/max, ripetibilità).
//
// Salvataggio: se il template non è mai stato usato si modifica in place;
// se è già usato si crea una NUOVA VERSIONE e si archivia quella di partenza
// (le checklist compilate congelano la versione e non vanno mai toccate).

import { useEffect, useMemo, useState } from 'react';
import {
  caricaTemplateCompleto, salvaComeNuovo, salvaComeNuovaVersione, salvaInPlace,
} from '../lib/admin/templates';
import {
  newId, type ChecklistTemplate, type OpzioneVoce,
  type VoceConfig, type VoceTemplate, type VoceTipo,
} from '../lib/types';

export type AperturaEditor =
  | { modo: 'nuovo'; duplicaDaId?: string }
  | { modo: 'modifica'; templateId: string };

const TIPI: { v: VoceTipo; label: string }[] = [
  { v: 'scelta', label: 'Scelta' },
  { v: 'multiscelta', label: 'Scelta multipla' },
  { v: 'testo', label: 'Testo' },
  { v: 'data', label: 'Data' },
  { v: 'numero', label: 'Numero' },
  { v: 'slider', label: 'Slider' },
  { v: 'foto', label: 'Foto' },
  { v: 'rilievo', label: 'Rilievo' },
];
const haOpzioni = (t: VoceTipo) => t === 'scelta' || t === 'multiscelta';

function configDefault(tipo: VoceTipo): VoceConfig {
  switch (tipo) {
    case 'scelta':
    case 'multiscelta':
      return {
        opzioni: [
          { chiave: 'ok', etichetta: 'OK' },
          { chiave: 'da_fare', etichetta: 'Da programmare' },
          { chiave: 'na', etichetta: 'N/A' },
        ],
      };
    case 'slider': return { min: 1, max: 5 };
    case 'foto': return { ripetibile: true };
    case 'rilievo': return { ripetibile: true };
    default: return {};
  }
}

function nuovaVoce(parentId: string | null, ordine: number, mostraSe: string | null = null): VoceTemplate {
  return {
    id: newId(), template_id: '', codice: null, sezione: null, ordine,
    testo_requisito: '', descrizione: null, tipo: 'scelta', obbligatoria: false,
    parent_voce_id: parentId, mostra_se_chiave: mostraSe, calendarizzabile: false,
    config: configDefault('scelta'),
  };
}

// Riassegna ordini coerenti prima del salvataggio (top-level 10,20,…; figli 1,2,…).
function reindex(voci: VoceTemplate[]): VoceTemplate[] {
  const out = voci.map((v) => ({ ...v }));
  out.filter((v) => !v.parent_voce_id).sort((a, b) => a.ordine - b.ordine)
    .forEach((v, i) => { v.ordine = (i + 1) * 10; });
  const perParent = new Map<string, VoceTemplate[]>();
  for (const v of out) if (v.parent_voce_id) {
    const a = perParent.get(v.parent_voce_id) ?? []; a.push(v); perParent.set(v.parent_voce_id, a);
  }
  for (const a of perParent.values()) {
    a.sort((x, y) => x.ordine - y.ordine).forEach((v, i) => { v.ordine = i + 1; });
  }
  return out;
}

export default function TemplateEditor({
  apertura, onChiudi,
}: { apertura: AperturaEditor; onChiudi: (salvato: boolean) => void }) {
  const [tmpl, setTmpl] = useState<ChecklistTemplate | null>(null); // solo in modifica
  const [usato, setUsato] = useState(false);
  const [sorgenteId, setSorgenteId] = useState<string | null>(null);
  const [vociOriginariId, setVociOriginariId] = useState<string[]>([]);

  const [nome, setNome] = useState('');
  const [tipoAttivita, setTipoAttivita] = useState('');
  const [note, setNote] = useState('');
  const [voci, setVoci] = useState<VoceTemplate[]>([]);

  const [fase, setFase] = useState<'carico' | 'pronto' | 'errore'>('carico');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // ---- caricamento iniziale ----
  useEffect(() => {
    let vivo = true;
    const idDaCaricare = apertura.modo === 'modifica' ? apertura.templateId
      : apertura.duplicaDaId ?? null;

    if (!idDaCaricare) { setFase('pronto'); return; }

    caricaTemplateCompleto(idDaCaricare)
      .then((c) => {
        if (!vivo) return;
        if (apertura.modo === 'modifica') {
          setTmpl(c.template);
          setUsato(c.usato);
          setSorgenteId(c.template.id);
          setVociOriginariId(c.voci.map((v) => v.id));
          setNome(c.template.nome);
          setTipoAttivita(c.template.tipo_attivita);
          setNote(c.template.note ?? '');
          setVoci(c.voci);
        } else {
          // duplica: nuovo template a partire dalle voci esistenti
          setNome(`Copia di ${c.template.nome}`);
          setTipoAttivita(c.template.tipo_attivita);
          setNote(c.template.note ?? '');
          setVoci(c.voci.map((v) => ({ ...v })));
        }
        setFase('pronto');
      })
      .catch(() => vivo && setFase('errore'));
    return () => { vivo = false; };
  }, [apertura]);

  // ---- mutazioni voci ----
  const patchVoce = (id: string, patch: Partial<VoceTemplate>) =>
    setVoci((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const patchConfig = (id: string, patch: Partial<VoceConfig>) =>
    setVoci((vs) => vs.map((v) => (v.id === id ? { ...v, config: { ...v.config, ...patch } } : v)));

  function cambiaTipo(id: string, tipo: VoceTipo) {
    setVoci((vs) => {
      const lasciaOpzioni = !haOpzioni(tipo);
      return vs
        .filter((v) => !(lasciaOpzioni && v.parent_voce_id === id)) // niente figli senza opzioni
        .map((v) => (v.id === id ? { ...v, tipo, config: configDefault(tipo) } : v));
    });
  }

  function aggiungiVoce() {
    const top = voci.filter((v) => !v.parent_voce_id);
    const maxOrd = top.reduce((m, v) => Math.max(m, v.ordine), 0);
    setVoci((vs) => [...vs, nuovaVoce(null, maxOrd + 10)]);
  }
  function aggiungiFiglio(parentId: string, chiave: string) {
    const figli = voci.filter((v) => v.parent_voce_id === parentId);
    const maxOrd = figli.reduce((m, v) => Math.max(m, v.ordine), 0);
    setVoci((vs) => [...vs, nuovaVoce(parentId, maxOrd + 1, chiave)]);
  }
  function elimina(id: string) {
    setVoci((vs) => vs.filter((v) => v.id !== id && v.parent_voce_id !== id));
  }
  function sposta(id: string, dir: -1 | 1) {
    setVoci((vs) => {
      const v = vs.find((x) => x.id === id);
      if (!v) return vs;
      const fratelli = vs.filter((x) => x.parent_voce_id === v.parent_voce_id)
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

  // opzioni di una voce a scelta
  const opzioniDi = (v: VoceTemplate) => v.config.opzioni ?? [];
  function setOpzioni(id: string, opz: OpzioneVoce[]) { patchConfig(id, { opzioni: opz }); }
  function aggiungiOpzione(v: VoceTemplate) {
    setOpzioni(v.id, [...opzioniDi(v), { chiave: `opz${opzioniDi(v).length + 1}`, etichetta: '' }]);
  }
  function patchOpzione(v: VoceTemplate, i: number, patch: Partial<OpzioneVoce>) {
    setOpzioni(v.id, opzioniDi(v).map((o, k) => (k === i ? { ...o, ...patch } : o)));
  }
  function eliminaOpzione(v: VoceTemplate, i: number) {
    setOpzioni(v.id, opzioniDi(v).filter((_, k) => k !== i));
  }

  const topLevel = useMemo(
    () => voci.filter((v) => !v.parent_voce_id).sort((a, b) => a.ordine - b.ordine),
    [voci],
  );
  const figliDi = (id: string) =>
    voci.filter((v) => v.parent_voce_id === id).sort((a, b) => a.ordine - b.ordine);

  // ---- salvataggio ----
  async function salva() {
    setErrore(null);
    if (!nome.trim()) return setErrore('Indica il nome del template.');
    if (!tipoAttivita.trim()) return setErrore('Indica il tipo di attività.');
    if (voci.length === 0) return setErrore('Aggiungi almeno una voce.');
    for (const v of voci) {
      if (!v.testo_requisito.trim()) return setErrore('Ogni voce deve avere un testo.');
      if (haOpzioni(v.tipo) && opzioniDi(v).filter((o) => o.chiave.trim()).length === 0) {
        return setErrore(`La voce "${v.testo_requisito || '—'}" è a scelta ma non ha opzioni.`);
      }
    }

    const meta = { nome: nome.trim(), tipo_attivita: tipoAttivita.trim(), note: note.trim() || null };
    const finali = reindex(voci);
    setSalvando(true);
    try {
      if (apertura.modo === 'nuovo') {
        await salvaComeNuovo(meta, finali);
      } else if (!usato) {
        await salvaInPlace({ ...(tmpl as ChecklistTemplate), ...meta }, finali, vociOriginariId);
      } else {
        await salvaComeNuovaVersione(meta, finali, sorgenteId!);
      }
      onChiudi(true);
    } catch (e: any) {
      setErrore(e?.message ? `Salvataggio non riuscito: ${e.message}` : 'Salvataggio non riuscito.');
      setSalvando(false);
    }
  }

  if (fase === 'carico') return <div className="bo-empty">Carico il template…</div>;
  if (fase === 'errore') {
    return (
      <div>
        <div className="bo-err">Impossibile caricare il template.</div>
        <button className="bo-btn ghost" onClick={() => onChiudi(false)}>Torna all'elenco</button>
      </div>
    );
  }

  const titolo = apertura.modo === 'nuovo'
    ? (apertura.duplicaDaId ? 'Duplica template' : 'Nuovo template')
    : `Modifica: ${tmpl?.nome ?? ''} v${tmpl?.versione ?? ''}`;

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
      {apertura.modo === 'modifica' && usato && (
        <div className="bo-note">
          Questo template è già stato usato in uno o più sopralluoghi: il salvataggio
          creerà una <b>nuova versione</b> e archivierà la v{tmpl?.versione}, lasciando
          intatte le compilazioni esistenti.
        </div>
      )}

      <div className="bo-card">
        <div className="bo-grid">
          <label className="bo-field">
            <span>Nome</span>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder="Es. Audit conformità sicurezza" />
          </label>
          <label className="bo-field">
            <span>Tipo attività (collega l'incarico al template)</span>
            <input type="text" value={tipoAttivita} onChange={(e) => setTipoAttivita(e.target.value)}
              placeholder="Es. RSPP/Audit periodico" />
          </label>
        </div>
        <label className="bo-field" style={{ marginBottom: 0 }}>
          <span>Note (interne)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      <h3 className="bo-h" style={{ fontSize: 14, margin: '18px 0 8px' }}>
        Voci ({topLevel.length})
      </h3>

      {topLevel.map((v) => (
        <VoceCard
          key={v.id} v={v} child={false} parentOpzioni={[]}
          figli={figliDi(v.id)}
          {...{ patchVoce, patchConfig, cambiaTipo, elimina, sposta, aggiungiFiglio,
            opzioniDi, aggiungiOpzione, patchOpzione, eliminaOpzione }}
        />
      ))}

      <button className="bo-btn ghost" onClick={aggiungiVoce} style={{ marginTop: 4 }}>
        + Aggiungi voce
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

// ============ scheda di una voce (riusata per le sotto-domande) ============
interface VoceCardProps {
  v: VoceTemplate;
  child: boolean;
  parentOpzioni: OpzioneVoce[];
  figli: VoceTemplate[];
  patchVoce: (id: string, patch: Partial<VoceTemplate>) => void;
  patchConfig: (id: string, patch: Partial<VoceConfig>) => void;
  cambiaTipo: (id: string, tipo: VoceTipo) => void;
  elimina: (id: string) => void;
  sposta: (id: string, dir: -1 | 1) => void;
  aggiungiFiglio: (parentId: string, chiave: string) => void;
  opzioniDi: (v: VoceTemplate) => OpzioneVoce[];
  aggiungiOpzione: (v: VoceTemplate) => void;
  patchOpzione: (v: VoceTemplate, i: number, patch: Partial<OpzioneVoce>) => void;
  eliminaOpzione: (v: VoceTemplate, i: number) => void;
}

function VoceCard(p: VoceCardProps) {
  const { v, child } = p;
  const opz = p.opzioniDi(v);

  return (
    <div className={`bo-voce ${child ? 'child' : ''}`}>
      <div className="bo-voce-top">
        <div style={{ flex: 1 }}>
          {child && (
            <div className="bo-meta" style={{ marginBottom: 6 }}>
              Sotto-domanda · mostrata se l'opzione è <b>{v.mostra_se_chiave}</b>
            </div>
          )}
          <input type="text" value={v.testo_requisito}
            onChange={(e) => p.patchVoce(v.id, { testo_requisito: e.target.value })}
            placeholder="Testo della voce / requisito" />
        </div>
        <button className="bo-iconbtn" title="Su" onClick={() => p.sposta(v.id, -1)}>↑</button>
        <button className="bo-iconbtn" title="Giù" onClick={() => p.sposta(v.id, 1)}>↓</button>
        <button className="bo-iconbtn" title="Elimina" onClick={() => p.elimina(v.id)}>✕</button>
      </div>

      <div className="bo-grid">
        <label className="bo-field">
          <span>Tipo</span>
          <select value={v.tipo} onChange={(e) => p.cambiaTipo(v.id, e.target.value as VoceTipo)}>
            {TIPI.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </label>
        <label className="bo-field">
          <span>Sezione</span>
          <input type="text" value={v.sezione ?? ''}
            onChange={(e) => p.patchVoce(v.id, { sezione: e.target.value || null })}
            placeholder="Es. E. Prevenzione incendi" />
        </label>
      </div>

      <div className="bo-grid" style={{ marginBottom: 8 }}>
        <label className="bo-field" style={{ marginBottom: 0 }}>
          <span>Codice (stabile, opzionale)</span>
          <input type="text" value={v.codice ?? ''}
            onChange={(e) => p.patchVoce(v.id, { codice: e.target.value || null })}
            placeholder="Es. vdr_incendio" />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
          <label className="chk">
            <input type="checkbox" checked={v.obbligatoria}
              onChange={(e) => p.patchVoce(v.id, { obbligatoria: e.target.checked })} />
            Obbligatoria
          </label>
          <label className="chk">
            <input type="checkbox" checked={v.calendarizzabile}
              onChange={(e) => p.patchVoce(v.id, { calendarizzabile: e.target.checked })} />
            Calendarizzabile
          </label>
        </div>
      </div>

      <label className="bo-field">
        <span>Descrizione / aiuto (opzionale)</span>
        <textarea value={v.descrizione ?? ''}
          onChange={(e) => p.patchVoce(v.id, { descrizione: e.target.value || null })} />
      </label>

      {/* Scadenza ricorrente: in compilazione è proponibile su OGNI voce; qui si
          imposta solo la periodicità di default suggerita (vuoto = 12 mesi). */}
      <label className="bo-field">
        <span>Periodicità scadenza ricorrente (mesi, default)</span>
        <input type="number" min={1} placeholder="12"
          value={v.config.scadenza?.periodicita_default_mesi ?? ''}
          onChange={(e) => p.patchConfig(v.id, {
            scadenza: e.target.value === ''
              ? undefined
              : { periodicita_default_mesi: Number(e.target.value) },
          })} />
      </label>

      {/* ---- config per tipo ---- */}
      {haOpzioni(v.tipo) && (
        <div className="bo-card flat" style={{ background: '#fff', marginBottom: 8 }}>
          <div className="bo-field"><span>Opzioni (risposte selezionabili)</span></div>
          {opz.map((o, i) => (
            <div className="bo-opz" key={i}>
              <input type="text" value={o.chiave} style={{ maxWidth: 110 }}
                onChange={(e) => p.patchOpzione(v, i, { chiave: e.target.value })} placeholder="chiave" />
              <input type="text" value={o.etichetta}
                onChange={(e) => p.patchOpzione(v, i, { etichetta: e.target.value })} placeholder="etichetta visibile" />
              <button className="bo-iconbtn" onClick={() => p.eliminaOpzione(v, i)}>✕</button>
            </div>
          ))}
          <button className="bo-btn ghost sm" onClick={() => p.aggiungiOpzione(v)}>+ Opzione</button>
          <div className="bo-meta" style={{ marginTop: 8 }}>
            L'opzione è solo la risposta descrittiva. In compilazione, su ogni voce,
            il tecnico indica a parte l'esito (conforme / non conforme / N.A.), le
            evidenze (note + foto) e le eventuali cose da fare.
          </div>
        </div>
      )}

      {v.tipo === 'slider' && (
        <div className="bo-grid">
          <label className="bo-field">
            <span>Minimo</span>
            <input type="number" value={v.config.min ?? 1}
              onChange={(e) => p.patchConfig(v.id, { min: Number(e.target.value) })} />
          </label>
          <label className="bo-field">
            <span>Massimo</span>
            <input type="number" value={v.config.max ?? 5}
              onChange={(e) => p.patchConfig(v.id, { max: Number(e.target.value) })} />
          </label>
        </div>
      )}

      {(v.tipo === 'foto' || v.tipo === 'rilievo') && (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="chk">
            <input type="checkbox" checked={!!v.config.ripetibile}
              onChange={(e) => p.patchConfig(v.id, { ripetibile: e.target.checked })} />
            Ripetibile
          </label>
          {v.tipo === 'rilievo' && (
            <label className="bo-field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
              <span>Etichetta bottone aggiunta</span>
              <input type="text" value={v.config.etichetta_aggiunta ?? ''}
                onChange={(e) => p.patchConfig(v.id, { etichetta_aggiunta: e.target.value || undefined })}
                placeholder="Aggiungi rilievo" />
            </label>
          )}
        </div>
      )}

      {/* ---- sotto-domande (solo voci a scelta, non annidiamo oltre un livello) ---- */}
      {!child && haOpzioni(v.tipo) && (
        <div style={{ marginTop: 10 }}>
          {p.figli.map((f) => (
            <VoceCard key={f.id} {...p} v={f} child parentOpzioni={opz} figli={[]} />
          ))}
          {opz.filter((o) => o.chiave.trim()).length > 0 && (
            <button className="bo-btn ghost sm"
              onClick={() => p.aggiungiFiglio(v.id, opz.find((o) => o.chiave.trim())!.chiave)}
              style={{ marginTop: 4 }}>
              + Sotto-domanda
            </button>
          )}
        </div>
      )}

      {child && (
        <label className="bo-field" style={{ marginTop: 4, marginBottom: 0 }}>
          <span>Mostra quando l'opzione del genitore è</span>
          <select value={v.mostra_se_chiave ?? ''}
            onChange={(e) => p.patchVoce(v.id, { mostra_se_chiave: e.target.value || null })}>
            {p.parentOpzioni.filter((o) => o.chiave.trim()).map((o) => (
              <option key={o.chiave} value={o.chiave}>{o.etichetta || o.chiave}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
