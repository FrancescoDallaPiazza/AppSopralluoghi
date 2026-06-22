// Elenco dei template di checklist. Da qui: nuovo, modifica, duplica,
// archivia/riattiva. La modifica apre l'editor a tutto schermo.

import { useEffect, useState } from 'react';
import {
  caricaTemplates, impostaStatoTemplate, type TemplateRiga,
} from '../lib/admin/templates';
import TemplateEditor, { type AperturaEditor } from './TemplateEditor';
import ComponiTemplate from './ComponiTemplate';

export default function TemplateList() {
  const [righe, setRighe] = useState<TemplateRiga[]>([]);
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [editor, setEditor] = useState<AperturaEditor | null>(null);
  const [componi, setComponi] = useState<{ templateId?: string } | null>(null);
  const [mostraArchiviati, setMostraArchiviati] = useState(false);

  function ricarica() {
    setStato('loading');
    caricaTemplates()
      .then((r) => { setRighe(r); setStato('ok'); })
      .catch(() => setStato('errore'));
  }
  useEffect(ricarica, []);

  if (componi) {
    return (
      <ComponiTemplate
        templateId={componi.templateId ?? null}
        onChiudi={(salvato) => { setComponi(null); if (salvato) ricarica(); }}
      />
    );
  }

  if (editor) {
    return (
      <TemplateEditor
        apertura={editor}
        onChiudi={(salvato) => { setEditor(null); if (salvato) ricarica(); }}
      />
    );
  }

  const visibili = righe.filter((r) => mostraArchiviati || r.template.stato === 'attivo');

  return (
    <>
      <div className="bo-row" style={{ marginBottom: 14 }}>
        <div className="grow">
          <h2 className="bo-h">Template checklist</h2>
          <p className="bo-sub" style={{ margin: 0 }}>
            Modello configurabile per voce: scelta, testo, foto, rilievo, sotto-domande.
          </p>
        </div>
        <button className="bo-btn ghost" onClick={() => setComponi({})}>+ Componi da capitoli</button>
        <button className="bo-btn" onClick={() => setEditor({ modo: 'nuovo' })}>+ Nuovo template</button>
      </div>

      <label className="chk" style={{ marginBottom: 14 }}>
        <input type="checkbox" checked={mostraArchiviati}
          onChange={(e) => setMostraArchiviati(e.target.checked)} />
        Mostra anche gli archiviati
      </label>

      {stato === 'loading' && <div className="bo-empty">Carico…</div>}
      {stato === 'errore' && <div className="bo-err">Errore nel caricamento dei template.</div>}
      {stato === 'ok' && visibili.length === 0 && (
        <div className="bo-empty">Nessun template. Creane uno con “Nuovo template”.</div>
      )}

      {visibili.map((r) => (
        <div key={r.template.id} className={`bo-card ${r.template.stato === 'archiviato' ? 'dim' : ''}`}>
          <div className="bo-row">
            <div className="grow">
              <div className="bo-title">{r.template.nome}</div>
              <div className="bo-meta">
                <span><b>{r.template.tipo_attivita}</b></span>
                <span>v{r.template.versione}</span>
                <span>{r.composto ? 'composto da capitoli' : `${r.n_voci} voci`}</span>
                <span className={`bo-pill ${r.template.stato}`}>{r.template.stato}</span>
                {r.usato && <span className="bo-pill usato">in uso</span>}
              </div>
            </div>
            <button className="bo-btn ghost sm"
              onClick={() => (r.composto
                ? setComponi({ templateId: r.template.id })
                : setEditor({ modo: 'modifica', templateId: r.template.id }))}>
              Modifica
            </button>
            <button className="bo-btn ghost sm"
              onClick={() => setEditor({ modo: 'nuovo', duplicaDaId: r.template.id })}>
              Duplica
            </button>
            <button className="bo-btn ghost sm"
              onClick={() => {
                impostaStatoTemplate(r.template.id, r.template.stato === 'attivo' ? 'archiviato' : 'attivo')
                  .then(ricarica)
                  .catch(() => alert('Operazione non riuscita.'));
              }}>
              {r.template.stato === 'attivo' ? 'Archivia' : 'Riattiva'}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
