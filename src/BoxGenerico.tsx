// Renderer dei BOX del modello box-argomento. Instrada per tipo:
//  - generico: monta il motore voci condiviso (vociRender) per ogni sezione del
//    box (sezioni singole = un contesto a componente null; ripetibili = un
//    contesto per componente del registro di sede, piu' il "+" per aggiungerne).
//    Usa lo stesso MotoreVoci di Compilazione, quindi gli esiti e le cose-da-fare
//    dei box vivono nello stesso store letto da completaSopralluogo;
//  - smart (ref_smart='organigramma'): monta FormazioneRiepilogo inline;
//  - fisso: vista read-only delle "cose da fare pregresse" (azioni aperte dei
//    giri precedenti), ricevute gia' caricate da Compilazione (nessun fetch qui).

import { useEffect, useState } from 'react';
import { caricaBoxComposti, aggiungiComponente, type BoxComposto } from './lib/box';
import { renderVoce, I } from './vociRender';
import FormazioneRiepilogo from './FormazioneRiepilogo';
import type { MotoreVoci } from './lib/useCompilazioneVoci';
import type { AreaInterna } from './lib/types';
import type { TecnicoAssegnabile, AzioneConContesto } from './lib/azioni';

const fmtData = (d: string | null) => {
  if (!d) return '—';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y}`;
};

interface Props {
  sopralluogoId: string;
  compilataId: string;
  sedeId: string | null;
  clienteId: string | null;
  motore: MotoreVoci;
  aree: AreaInterna[];
  tecnici: TecnicoAssegnabile[];
  tecnicoId: string;
  tecnicoNome: string | null;
  pregresse: AzioneConContesto[];
  statoPregresse: 'idle' | 'loading' | 'ok' | 'errore';
  // 'fissi' = solo i box fisso (es. pregresse), da mostrare a inizio giro;
  // 'altri' = generici + smart, dopo la checklist. Permette di collocare i due
  // gruppi in punti diversi della pagina con un solo componente.
  filtro: 'fissi' | 'altri';
}

export default function BoxGenerico({
  sopralluogoId, compilataId, sedeId, clienteId, motore, aree, tecnici, tecnicoId,
  tecnicoNome, pregresse, statoPregresse, filtro,
}: Props) {
  const [boxes, setBoxes] = useState<BoxComposto[]>([]);
  const [pronto, setPronto] = useState(false);

  async function ricarica() {
    const bx = await caricaBoxComposti(sopralluogoId, sedeId);
    setBoxes(bx);
    // Semina gli esiti mancanti per ogni (sezione, componente). Idempotente.
    // Solo l'istanza 'altri' semina (i fissi non hanno voci): niente doppio lavoro.
    if (filtro === 'altri') {
      for (const b of bx) {
        if (b.box.tipo !== 'generico') continue;
        for (const s of b.sezioni) {
          if (s.sezione.ripetibile) {
            for (const c of s.componenti) await motore.assicuraEsiti(compilataId, s.vociTop, c.id);
          } else {
            await motore.assicuraEsiti(compilataId, s.vociTop, null);
          }
        }
      }
    }
    setPronto(true);
  }

  useEffect(() => {
    let vivo = true;
    void (async () => { await ricarica(); if (!vivo) setPronto(false); })();
    return () => { vivo = false; };
    // ricarica dipende solo dagli identificativi del giro/sede
  }, [sopralluogoId, compilataId, sedeId]);

  async function aggiungi(box: BoxComposto, sezioneCodice: string) {
    if (!sedeId) return;
    const etichetta = (prompt('Nome del componente (es. matricola o ubicazione):') ?? '').trim();
    if (!etichetta) return;
    await aggiungiComponente(sedeId, box.box.id, sezioneCodice, etichetta);
    await ricarica();
  }

  const visibili = boxes.filter((b) => (filtro === 'fissi' ? b.box.tipo === 'fisso' : b.box.tipo !== 'fisso'));
  if (!visibili.length) return null;

  function renderSmart(b: BoxComposto) {
    if (b.box.ref_smart !== 'organigramma') return null;
    return (
      <section className="box" key={b.riga.id}>
        <header className="box-h">
          <span className="box-nome">{b.box.nome}</span>
          {b.box.descrizione && <span className="box-desc">{b.box.descrizione}</span>}
        </header>
        <FormazioneRiepilogo
          clienteId={clienteId}
          sopralluogoId={sopralluogoId}
          tecnicoId={tecnicoId}
          tecnicoNome={tecnicoNome}
        />
      </section>
    );
  }

  function renderFisso(b: BoxComposto) {
    const aperte = pregresse.filter((a) => a.stato !== 'conclusa');
    return (
      <section className="box" key={b.riga.id}>
        <header className="box-h">
          <span className="box-nome">{b.box.nome}</span>
          {b.box.descrizione && <span className="box-desc">{b.box.descrizione}</span>}
        </header>
        {statoPregresse === 'loading' && <p className="box-vuoto">Carico le cose da fare dei giri precedenti{'\u2026'}</p>}
        {statoPregresse === 'errore' && <p className="box-vuoto">Serve la connessione per le cose da fare pregresse.</p>}
        {statoPregresse === 'ok' && aperte.length === 0 && <p className="box-vuoto">Nessuna cosa da fare in sospeso dai giri precedenti.</p>}
        {statoPregresse === 'ok' && aperte.map((a) => (
          <div className="box-preg" key={a.id}>
            <div className="box-preg-desc">{a.descrizione || a.origine_voce || 'Cosa da fare'}</div>
            <div className="box-preg-meta">
              <span>{a.responsabile_tipo === 'cliente' ? 'Cliente' : (a.area_nome ?? 'Interno')}</span>
              {a.data_scadenza && <span>Scad. {fmtData(a.data_scadenza)}</span>}
              {a.sopralluogo_label && <span className="box-preg-src">{a.sopralluogo_label}</span>}
            </div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <div className="boxgen">
      <style>{CSS}</style>
      {visibili.map((b) => {
        if (b.box.tipo === 'smart') return renderSmart(b);
        if (b.box.tipo === 'fisso') return renderFisso(b);
        return (
        <section className="box" key={b.riga.id}>
          <header className="box-h">
            <span className="box-nome">{b.box.nome}</span>
            {b.box.descrizione && <span className="box-desc">{b.box.descrizione}</span>}
          </header>

          {b.sezioni.map((s) => {
            const ripet = s.sezione.ripetibile;
            return (
              <div className="box-sez" key={s.sezione.id}>
                {s.sezione.nome && <div className="box-sez-h">{s.sezione.nome}</div>}

                {!ripet && (() => {
                  const ctx = motore.buildCtx({ compilataId, voci: b.voci, componenteId: null, aree, tecnici, tecnicoId });
                  return <>{s.vociTop.map((v) => renderVoce(ctx, v, null))}</>;
                })()}

                {ripet && (
                  <>
                    {s.componenti.map((c) => {
                      const ctx = motore.buildCtx({ compilataId, voci: b.voci, componenteId: c.id, aree, tecnici, tecnicoId });
                      return (
                        <div className="box-comp" key={c.id}>
                          <div className="box-comp-h">
                            {c.etichetta}
                            {c.matricola && <span className="box-comp-mat"> · {c.matricola}</span>}
                            {c.ubicazione && <span className="box-comp-ub"> · {c.ubicazione}</span>}
                          </div>
                          {s.vociTop.map((v) => renderVoce(ctx, v, null))}
                        </div>
                      );
                    })}
                    {s.componenti.length === 0 && (
                      <p className="box-vuoto">
                        {sedeId ? 'Nessun componente: aggiungine uno per iniziare.'
                          : 'Seleziona la sede del sopralluogo per gestire i componenti.'}
                      </p>
                    )}
                    {sedeId && (
                      <button className="box-add" onClick={() => void aggiungi(b, s.sezione.codice)}>
                        {I.plus} {s.sezione.etichetta_componente?.trim() || 'Aggiungi componente'}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </section>
        );
      })}
      {filtro === 'altri' && !pronto && <p className="box-vuoto">Preparo i box…</p>}
    </div>
  );
}

const CSS = `
.boxgen .box{margin:0 0 18px;}
.boxgen .box-h{display:flex; flex-direction:column; gap:2px; padding:10px 2px 8px; border-bottom:2px solid var(--line,#e6e2da);}
.boxgen .box-nome{font-weight:700; font-size:1.05rem;}
.boxgen .box-desc{font-size:.82rem; color:var(--muted,#8a8a8a);}
.boxgen .box-sez{margin:12px 0;}
.boxgen .box-sez-h{font-weight:600; margin:6px 2px; opacity:.85;}
.boxgen .box-comp{border:1px solid var(--line,#e6e2da); border-radius:12px; padding:8px; margin:8px 0; background:rgba(0,0,0,.015);}
.boxgen .box-comp-h{font-weight:600; margin:2px 2px 8px;}
.boxgen .box-comp-mat,.boxgen .box-comp-ub{font-weight:400; opacity:.7;}
.boxgen .box-vuoto{color:var(--muted,#888); font-size:.85rem; margin:6px 2px;}
.boxgen .box-add{display:inline-flex; align-items:center; gap:6px; margin:6px 0; padding:8px 12px; border:1px dashed var(--line,#cfc9bd); border-radius:10px; background:none; cursor:pointer;}
.boxgen .box-add svg{width:18px; height:18px;}
.boxgen .box-preg{border:1px solid var(--line,#e6e2da); border-radius:10px; padding:8px 10px; margin:8px 0;}
.boxgen .box-preg-desc{font-weight:600;}
.boxgen .box-preg-meta{display:flex; flex-wrap:wrap; gap:10px; margin-top:4px; font-size:.8rem; color:var(--muted,#888);}
.boxgen .box-preg-src{opacity:.8;}
`;
