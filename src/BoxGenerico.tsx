// Renderer dei BOX GENERICI del modello box-argomento. Monta il motore voci
// condiviso (vociRender) per ogni sezione del box: le sezioni singole hanno un
// solo contesto (componente null), quelle RIPETIBILI un contesto per ogni
// componente del registro di sede, piu' il "+" per aggiungerne. Usa lo stesso
// MotoreVoci di Compilazione, quindi gli esiti e le cose-da-fare dei box vivono
// nello stesso store letto da completaSopralluogo: nessuna logica duplicata.
//
// I box NON generici (smart = organigramma, fisso = pregresse) sono instradati
// altrove dall'apertura del sopralluogo: qui vengono semplicemente saltati.

import { useEffect, useState } from 'react';
import { caricaBoxComposti, aggiungiComponente, type BoxComposto } from './lib/box';
import { renderVoce, I } from './vociRender';
import type { MotoreVoci } from './lib/useCompilazioneVoci';
import type { AreaInterna } from './lib/types';
import type { TecnicoAssegnabile } from './lib/azioni';

interface Props {
  sopralluogoId: string;
  compilataId: string;
  sedeId: string | null;
  motore: MotoreVoci;
  aree: AreaInterna[];
  tecnici: TecnicoAssegnabile[];
  tecnicoId: string;
}

export default function BoxGenerico({
  sopralluogoId, compilataId, sedeId, motore, aree, tecnici, tecnicoId,
}: Props) {
  const [boxes, setBoxes] = useState<BoxComposto[]>([]);
  const [pronto, setPronto] = useState(false);

  async function ricarica() {
    const bx = await caricaBoxComposti(sopralluogoId, sedeId);
    setBoxes(bx);
    // Semina gli esiti mancanti per ogni (sezione, componente). Idempotente.
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

  const generici = boxes.filter((b) => b.box.tipo === 'generico');
  if (!generici.length) return null;

  return (
    <div className="boxgen">
      <style>{CSS}</style>
      {generici.map((b) => (
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
      ))}
      {!pronto && <p className="box-vuoto">Preparo i box…</p>}
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
`;
