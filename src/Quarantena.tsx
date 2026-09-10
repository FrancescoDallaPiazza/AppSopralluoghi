// Le operazioni che non sono arrivate in ufficio, e cosa farne.
//
// La quarantena (db.ts, schema v7) raccoglie le operazioni che il server ha
// respinto in modo definitivo: prima una sola di queste fermava il drenaggio
// per sempre e in silenzio, trascinandosi dietro gli esiti e le foto di
// un'intera giornata. Ora esce dalla coda - il resto riparte - ma il lavoro
// resta fermo su QUESTO dispositivo, perche' la quarantena e' in IndexedDB: il
// back-office non la vede e non la vedra'. Chi la guarda e' il tecnico, in
// campo, spesso senza rete. Quindi qui si puo' anche agire:
//
//  * Ritenta rimette l'operazione in coda COM'ERA. Se la causa del rifiuto e'
//    ancora lato server, l'operazione torna qui identica: il bottone lo dice,
//    perche' un ritentativo che finge di riparare e' peggio di nessun bottone.
//    Serve quando la causa e' stata rimossa in ufficio (una riga doppia
//    cancellata, una migrazione applicata, un permesso dato).
//  * Scarta la toglie per sempre, e chiede conferma in due tocchi. Serve per i
//    casi morti, dove nessun ritentativo potra' mai riuscire: il file di una
//    foto o di un attestato che in locale non c'e' piu'. In quel caso Ritenta
//    non compare nemmeno.

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import type { OpBloccata, OutboxOp } from './lib/db';
import { elencoQuarantena, rimettiInCoda, scartaDaQuarantena } from './lib/db';
import { runSync } from './lib/sync';

// Le tabelle col nome che hanno nel database non si mostrano a chi e' in campo.
const NOMI: Record<NonNullable<OutboxOp['table']>, string> = {
  sopralluogo: 'Sopralluogo',
  checklist_compilata: 'Checklist',
  esito_voce: 'Rilievo',
  foto: 'Foto',
  azione: 'Cosa da fare',
  aggiornamento_azione: 'Aggiornamento di una cosa da fare',
  sopralluogo_revisione: 'Revisione del sopralluogo',
  persona: 'Persona',
  nomina: 'Nomina',
  formazione: 'Attestato',
  esonero: 'Esonero',
  organigramma_conferma: 'Conferma organigramma',
  organigramma_revisione: 'Revisione organigramma',
  sopralluogo_box: 'Box del sopralluogo',
  componente_sito: 'Componente',
};

function descrivi(op: OutboxOp): string {
  const cosa = op.table ? NOMI[op.table] : 'Operazione';
  switch (op.kind) {
    case 'photo': return 'Foto · caricamento';
    case 'attestato': return 'Allegato attestato · caricamento';
    case 'delete': return `${cosa} · cancellazione`;
    default: return `${cosa} · salvataggio`;
  }
}

const QUANDO = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

function quando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : QUANDO.format(d);
}

// Un rifiuto che viene da noi e non dal server: il blob non c'e' piu' in
// locale, quindi non esiste ritentativo che possa riuscire.
const IRRECUPERABILI = ['LOCALE_MANCANTE'];

export default function Quarantena({ onChiudi }: { onChiudi: () => void }) {
  const [righe, setRighe] = useState<OpBloccata[] | null>(null);
  const [daConfermare, setDaConfermare] = useState<number | null>(null);

  useEffect(() => {
    const sub = liveQuery(() => elencoQuarantena()).subscribe({
      next: setRighe,
      error: (e) => { console.warn('quarantena non leggibile:', e); setRighe([]); },
    });
    return () => sub.unsubscribe();
  }, []);

  async function ritenta(qid: number) {
    await rimettiInCoda(qid);
    void runSync();
  }

  async function scarta(qid: number) {
    await scartaDaQuarantena(qid);
    setDaConfermare(null);
  }

  return (
    <div className="qr-back" onClick={onChiudi}>
      <style>{CSS}</style>
      <div className="qr-card" onClick={(e) => e.stopPropagation()}>
        <div className="qr-h">
          <div className="qr-title">Non arrivate in ufficio</div>
          <button type="button" className="qr-x" onClick={onChiudi} aria-label="Chiudi">&times;</button>
        </div>

        {righe === null ? (
          <p className="qr-vuoto">Leggo&hellip;</p>
        ) : righe.length === 0 ? (
          <p className="qr-vuoto">
            Niente di bloccato: tutto quello che hai salvato &egrave; arrivato o &egrave; ancora in coda.
          </p>
        ) : (
          <>
            <p className="qr-intro">
              {righe.length === 1
                ? 'Un’operazione è stata respinta e non salirà da sola.'
                : `${righe.length} operazioni sono state respinte e non saliranno da sole.`}
              {' '}Il resto della coda non &egrave; bloccato.
            </p>

            <ul className="qr-lista">
              {righe.map((q) => {
                const qid = q.qid!;
                const recuperabile = !q.codice || !IRRECUPERABILI.includes(q.codice);
                return (
                  <li key={qid} className="qr-riga">
                    <div className="qr-capo">
                      <span className="qr-cosa">{descrivi(q.op)}</span>
                      <span className="qr-quando">{quando(q.quando)}</span>
                    </div>
                    <div className="qr-motivo">{q.motivo}</div>
                    {q.codice && <div className="qr-codice">codice {q.codice}</div>}

                    {daConfermare === qid ? (
                      <div className="qr-conferma">
                        <span>Scartarla la cancella per sempre.</span>
                        <div className="qr-azioni">
                          <button type="button" className="qr-b ghost"
                            onClick={() => setDaConfermare(null)}>Annulla</button>
                          <button type="button" className="qr-b rosso"
                            onClick={() => void scarta(qid)}>Scarta</button>
                        </div>
                      </div>
                    ) : (
                      <div className="qr-azioni">
                        {recuperabile && (
                          <button type="button" className="qr-b"
                            onClick={() => void ritenta(qid)}>Ritenta</button>
                        )}
                        <button type="button" className="qr-b ghost"
                          onClick={() => setDaConfermare(qid)}>Scarta</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="qr-nota">
              <b>Ritenta</b> rimette l&rsquo;operazione in coda senza modificarla: se il server
              la rifiutava per un motivo ancora presente, la rifiuter&agrave; di nuovo. Se non sai
              perch&eacute; &egrave; stata respinta, segnalala all&rsquo;ufficio prima di scartarla.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.qr-back{position:fixed;inset:0;z-index:10000;background:rgba(20,22,26,.55);
  display:flex;align-items:center;justify-content:center;padding:16px;
  font-family:"Hanken Grotesk Variable",-apple-system,system-ui,sans-serif;}
.qr-card{width:100%;max-width:380px;max-height:calc(100vh - 32px);overflow-y:auto;
  background:#fffdf9;border:1px solid #c9c2b4;border-radius:16px;padding:18px;
  box-shadow:0 24px 60px -24px rgba(0,0,0,.6);color:#1b1c1f;}
.qr-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.qr-title{font-weight:800;font-size:16px;}
.qr-x{border:none;background:none;font-size:24px;line-height:1;color:#8b8e94;cursor:pointer;padding:0 2px;}
.qr-intro{font-size:12.5px;color:#5c5f66;line-height:1.5;margin:0 0 14px;}
.qr-vuoto{font-size:13px;color:#5c5f66;line-height:1.5;margin:6px 0 2px;}
.qr-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;}
.qr-riga{border:1px solid #e4ded2;border-radius:12px;padding:11px 12px;background:#fbf9f4;}
.qr-capo{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
.qr-cosa{font-weight:800;font-size:13px;}
.qr-quando{font-size:11px;color:#8b8e94;white-space:nowrap;}
.qr-motivo{font-size:12.5px;color:#a12626;line-height:1.45;margin-top:5px;
  overflow-wrap:anywhere;}
.qr-codice{font-size:11px;color:#8b8e94;margin-top:3px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
.qr-azioni{display:flex;justify-content:flex-end;gap:8px;margin-top:9px;}
.qr-b{border:1px solid #c9c2b4;background:#fff;border-radius:9px;padding:7px 13px;
  font-weight:800;font-size:12.5px;color:#1b1c1f;cursor:pointer;font-family:inherit;}
.qr-b.ghost{background:none;color:#5c5f66;font-weight:700;}
.qr-b.rosso{background:#b23b2a;border-color:#b23b2a;color:#fff;}
.qr-conferma{margin-top:9px;font-size:11.5px;color:#5c5f66;}
.qr-nota{font-size:11.5px;color:#7c8088;line-height:1.5;margin:14px 0 0;
  border-top:1px solid #ece7dd;padding-top:11px;}
`;
