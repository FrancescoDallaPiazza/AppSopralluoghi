// Elenco dei CAPITOLI (box del catalogo). Da qui: nuovo capitolo, modifica,
// duplica, archivia/riattiva. I moduli speciali (ORGANIGRAMMA 'smart', PREGRESSE
// 'fisso') si vedono ma non si editano. Un capitolo gia' usato in un sopralluogo
// si modifica solo via "Duplica".

import { useEffect, useState } from 'react';
import {
  caricaCapitoli, impostaStatoCapitolo, duplicaCapitolo, type CapitoloRiga,
} from '../lib/admin/capitoli';
import CapitoloEditor, { type AperturaCapitolo } from './CapitoloEditor';

const TIPO_LABEL: Record<string, string> = {
  generico: 'capitolo', smart: 'modulo speciale', fisso: 'sempre in testa',
};

export default function CapitoliList() {
  const [righe, setRighe] = useState<CapitoloRiga[]>([]);
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [editor, setEditor] = useState<AperturaCapitolo | null>(null);
  const [mostraArchiviati, setMostraArchiviati] = useState(false);
  const [azione, setAzione] = useState(false);

  function ricarica() {
    setStato('loading');
    caricaCapitoli()
      .then((r) => { setRighe(r); setStato('ok'); })
      .catch(() => setStato('errore'));
  }
  useEffect(ricarica, []);

  if (editor) {
    return (
      <CapitoloEditor
        apertura={editor}
        onChiudi={(salvato) => { setEditor(null); if (salvato) ricarica(); }}
      />
    );
  }

  async function duplica(boxId: string) {
    if (azione) return;
    setAzione(true);
    try {
      const nuovo = await duplicaCapitolo(boxId);
      setEditor({ modo: 'modifica', boxId: nuovo });
    } catch { alert('Duplica non riuscita.'); }
    finally { setAzione(false); }
  }

  const visibili = righe.filter((r) => mostraArchiviati || r.box.attivo);

  return (
    <>
      <div className="bo-row" style={{ marginBottom: 14 }}>
        <div className="grow">
          <h2 className="bo-h">Capitoli</h2>
          <p className="bo-sub" style={{ margin: 0 }}>
            Blocchi riusabili (sezioni + voci) da cui comporre i template. I moduli
            speciali (Organigramma, Cose da fare) si gestiscono nei rispettivi moduli.
          </p>
        </div>
        <button className="bo-btn" onClick={() => setEditor({ modo: 'nuovo' })}>+ Nuovo capitolo</button>
      </div>

      <label className="chk" style={{ marginBottom: 14 }}>
        <input type="checkbox" checked={mostraArchiviati}
          onChange={(e) => setMostraArchiviati(e.target.checked)} />
        Mostra anche gli archiviati
      </label>

      {stato === 'loading' && <div className="bo-empty">Carico…</div>}
      {stato === 'errore' && <div className="bo-err">Errore nel caricamento dei capitoli.</div>}
      {stato === 'ok' && visibili.length === 0 && (
        <div className="bo-empty">Nessun capitolo. Creane uno con “Nuovo capitolo”.</div>
      )}

      {visibili.map((r) => {
        const speciale = r.box.tipo !== 'generico';
        return (
          <div key={r.box.id} className={`bo-card ${r.box.attivo ? '' : 'dim'}`}>
            <div className="bo-row">
              <div className="grow">
                <div className="bo-title">{r.box.nome}</div>
                <div className="bo-meta">
                  <span className="bo-pill">{TIPO_LABEL[r.box.tipo] ?? r.box.tipo}</span>
                  {!speciale && <span>{r.n_sezioni} sezioni · {r.n_voci} voci</span>}
                  {!r.box.attivo && <span className="bo-pill archiviato">archiviato</span>}
                  {r.usato && <span className="bo-pill usato">in uso</span>}
                </div>
                {r.box.descrizione && (
                  <div className="bo-sub" style={{ margin: '4px 0 0' }}>{r.box.descrizione}</div>
                )}
              </div>

              {speciale ? (
                <span className="bo-meta" style={{ alignSelf: 'center' }}>non modificabile</span>
              ) : r.usato ? (
                <button className="bo-btn ghost sm" disabled={azione} onClick={() => void duplica(r.box.id)}>
                  Duplica per modificare
                </button>
              ) : (
                <>
                  <button className="bo-btn ghost sm"
                    onClick={() => setEditor({ modo: 'modifica', boxId: r.box.id })}>Modifica</button>
                  <button className="bo-btn ghost sm" disabled={azione}
                    onClick={() => void duplica(r.box.id)}>Duplica</button>
                </>
              )}

              {!speciale && (
                <button className="bo-btn ghost sm"
                  onClick={() => {
                    impostaStatoCapitolo(r.box.id, !r.box.attivo)
                      .then(ricarica).catch(() => alert('Operazione non riuscita.'));
                  }}>
                  {r.box.attivo ? 'Archivia' : 'Riattiva'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
