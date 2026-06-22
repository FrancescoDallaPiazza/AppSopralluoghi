// Compositore di template da "capitoli" (box del catalogo).
//
// Si scelgono i capitoli (con anteprima delle domande), se ne decide l'ORDINE
// nel sopralluogo (frecce su/giu') e si da' un nome: il template diventa attivo
// e compare nella scelta per seduta. I moduli speciali (ORGANIGRAMMA 'smart' e
// COSE DA FARE pregresse 'fisso') sono SEMPRE proposti, gia' selezionati, ma
// disattivabili. La sorgente di verita' della selezione e' la lista ORDINATA
// `ordine` (l'appartenenza = include).

import { useEffect, useState } from 'react';
import {
  caricaBoxDisponibili, creaTemplateDaBox, type BoxDisponibile,
} from '../lib/admin/composizione';
import { caricaAnteprimaCapitolo, type AnteprimaCapitolo } from '../lib/admin/capitoli';
import type { VoceTemplate } from '../lib/types';

const TIPO_BREVE: Record<string, string> = {
  scelta: 'scelta', multiscelta: 'scelta multipla', testo: 'testo', data: 'data',
  numero: 'numero', slider: 'slider', foto: 'foto', rilievo: 'rilievo',
};

export default function ComponiTemplate({
  onChiudi,
}: { onChiudi: (salvato: boolean) => void }) {
  const [fase, setFase] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [disp, setDisp] = useState<BoxDisponibile[]>([]);
  const [ordine, setOrdine] = useState<string[]>([]); // selezione + ordine
  const [aperti, setAperti] = useState<Set<string>>(new Set());
  const [prev, setPrev] = useState<Map<string, AnteprimaCapitolo>>(new Map());
  const [caricandoPrev, setCaricandoPrev] = useState<Set<string>>(new Set());
  const [nome, setNome] = useState('');
  const [tipoAttivita, setTipoAttivita] = useState('');
  const [note, setNote] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    caricaBoxDisponibili()
      .then((d) => {
        setDisp(d);
        // i moduli speciali sono proposti gia' confermati, in ordine di catalogo
        setOrdine(d.filter((x) => x.sempre)
          .sort((a, b) => a.box.ordine_default - b.box.ordine_default)
          .map((x) => x.box.id));
        setFase('ok');
      })
      .catch(() => setFase('errore'));
  }, []);

  const boxById = (id: string) => disp.find((d) => d.box.id === id);
  const selezionato = (id: string) => ordine.includes(id);

  function toggle(id: string) {
    setOrdine((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  }
  function muoviOrdine(id: string, dir: -1 | 1) {
    setOrdine((o) => {
      const i = o.indexOf(id); const j = i + dir;
      if (i < 0 || j < 0 || j >= o.length) return o;
      const n = [...o]; [n[i], n[j]] = [n[j], n[i]]; return n;
    });
  }

  async function toggleAnteprima(boxId: string) {
    setAperti((prev2) => {
      const next = new Set(prev2);
      if (next.has(boxId)) next.delete(boxId); else next.add(boxId);
      return next;
    });
    if (!prev.has(boxId)) {
      setCaricandoPrev((s) => new Set(s).add(boxId));
      try {
        const a = await caricaAnteprimaCapitolo(boxId);
        setPrev((m) => new Map(m).set(boxId, a));
      } catch { /* messaggio sotto */ }
      finally {
        setCaricandoPrev((s) => { const n = new Set(s); n.delete(boxId); return n; });
      }
    }
  }

  async function crea() {
    if (salvando) return;
    setErrore(null);
    const boxIds = ordine.filter((id) => boxById(id)); // ordine scelto dall'utente
    try {
      setSalvando(true);
      await creaTemplateDaBox({ nome, tipo_attivita: tipoAttivita, note: note.trim() || null, boxIds });
      onChiudi(true);
    } catch (e) {
      setErrore((e as Error)?.message ?? 'Creazione non riuscita.');
      setSalvando(false);
    }
  }

  if (fase === 'loading') return <div className="bo-empty">Carico i capitoli…</div>;
  if (fase === 'errore') {
    return (
      <>
        <div className="bo-err">Impossibile caricare il catalogo dei capitoli.</div>
        <button className="bo-btn ghost" onClick={() => onChiudi(false)}>Torna all'elenco</button>
      </>
    );
  }

  const speciali = disp.filter((d) => d.sempre);
  const capitoli = disp.filter((d) => !d.sempre);

  function anteprima(boxId: string) {
    if (caricandoPrev.has(boxId)) return <div className="bo-meta" style={{ padding: '8px 0' }}>Carico le domande…</div>;
    const a = prev.get(boxId);
    if (!a) return <div className="bo-meta" style={{ padding: '8px 0' }}>Anteprima non disponibile.</div>;
    if (a.voci.length === 0) return <div className="bo-meta" style={{ padding: '8px 0' }}>Nessuna domanda (modulo speciale).</div>;
    const figli = (id: string) => a.voci.filter((v) => v.parent_voce_id === id).sort((x, y) => x.ordine - y.ordine);
    const top = (sezId: string) => a.voci.filter((v) => !v.parent_voce_id && v.sezione_id === sezId).sort((x, y) => x.ordine - y.ordine);
    const meta = (v: VoceTemplate) => {
      const bits = [TIPO_BREVE[v.tipo] ?? v.tipo];
      if (v.calendarizzabile) bits.push('scadenza');
      return bits.join(' · ');
    };
    return (
      <div style={{ borderTop: '1px solid var(--line,#e7e0cf)', marginTop: 8, paddingTop: 8 }}>
        {a.sezioni.sort((x, y) => x.ordine - y.ordine).map((s) => (
          <div key={s.id} style={{ marginBottom: 8 }}>
            <div className="bo-meta" style={{ fontWeight: 700, marginBottom: 2 }}>
              {s.nome}{s.ripetibile ? ' (ripetibile)' : ''}
            </div>
            <ul style={{ margin: '2px 0 0', paddingLeft: 18 }}>
              {top(s.id).map((v) => (
                <li key={v.id} style={{ fontSize: 12.5, marginBottom: 2 }}>
                  {v.testo_requisito} <span style={{ color: 'var(--ink-soft,#8a8170)' }}>({meta(v)})</span>
                  {figli(v.id).length > 0 && (
                    <ul style={{ margin: '2px 0 0', paddingLeft: 16 }}>
                      {figli(v.id).map((f) => (
                        <li key={f.id} style={{ fontSize: 12, color: 'var(--ink-soft,#8a8170)' }}>
                          ↳ {f.testo_requisito} {f.mostra_se_chiave ? `(se: ${f.mostra_se_chiave})` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  function riga(d: BoxDisponibile) {
    const generico = d.box.tipo === 'generico';
    const espanso = aperti.has(d.box.id);
    return (
      <div key={d.box.id} className="bo-card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <input type="checkbox" checked={selezionato(d.box.id)} onChange={() => toggle(d.box.id)}
            style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--hi)' }} />
          <div className="grow">
            <div className="bo-title">{d.box.nome}</div>
            {d.box.descrizione && (
              <div className="bo-sub" style={{ margin: '2px 0 0' }}>{d.box.descrizione}</div>
            )}
            <div className="bo-meta" style={{ marginTop: 4 }}>
              {generico
                ? <span>{d.n_sezioni} sezioni · {d.n_voci} voci</span>
                : <span className="bo-pill">{d.box.tipo === 'smart' ? 'modulo speciale' : 'sempre in testa'}</span>}
            </div>
          </div>
          {generico && (
            <button className="bo-btn ghost sm" onClick={() => void toggleAnteprima(d.box.id)}>
              {espanso ? 'Nascondi domande' : 'Vedi domande'}
            </button>
          )}
        </div>
        {generico && espanso && anteprima(d.box.id)}
      </div>
    );
  }

  return (
    <>
      <div className="bo-row" style={{ marginBottom: 14 }}>
        <div className="grow">
          <h2 className="bo-h">Componi un template dai capitoli</h2>
          <p className="bo-sub" style={{ margin: 0 }}>
            Scegli i capitoli (espandi per vedere le domande), ordinali, dai un nome:
            il template diventa attivo e compare nella scelta per seduta.
          </p>
        </div>
        <button className="bo-btn ghost" onClick={() => onChiudi(false)} disabled={salvando}>Annulla</button>
        <button className="bo-btn" onClick={() => void crea()} disabled={salvando}>
          {salvando ? 'Creo…' : 'Crea template'}
        </button>
      </div>

      {errore && <div className="bo-err">{errore}</div>}

      <div className="bo-card">
        <div className="bo-grid">
          <label className="bo-field">
            <span>Nome del template</span>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder="es. Audit iniziale - completo" />
          </label>
          <label className="bo-field">
            <span>Tipo attivita (aggancio incarico)</span>
            <input type="text" value={tipoAttivita} onChange={(e) => setTipoAttivita(e.target.value)}
              placeholder="es. RSPP/Audit periodico" />
          </label>
        </div>
        <label className="bo-field" style={{ marginBottom: 0 }}>
          <span>Note (facoltative)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      <h3 className="bo-h" style={{ fontSize: 14, margin: '18px 0 8px' }}>
        Moduli speciali <span className="bo-sub" style={{ fontWeight: 400 }}>(sempre proposti, conferma o togli)</span>
      </h3>
      {speciali.length === 0
        ? <div className="bo-empty">Nessun modulo speciale nel catalogo.</div>
        : speciali.map(riga)}

      <h3 className="bo-h" style={{ fontSize: 14, margin: '18px 0 8px' }}>Capitoli</h3>
      {capitoli.length === 0
        ? <div className="bo-empty">Nessun capitolo nel catalogo. Esegui prima il seed (migration 035).</div>
        : capitoli.map(riga)}

      <h3 className="bo-h" style={{ fontSize: 14, margin: '18px 0 8px' }}>
        Ordine nel sopralluogo <span className="bo-sub" style={{ fontWeight: 400 }}>({ordine.length} selezionati)</span>
      </h3>
      {ordine.length === 0
        ? <div className="bo-empty">Seleziona almeno un capitolo qui sopra.</div>
        : ordine.map((id, i) => {
          const d = boxById(id);
          if (!d) return null;
          return (
            <div key={id} className="bo-card" style={{ marginBottom: 6 }}>
              <div className="bo-row">
                <span className="bo-meta" style={{ minWidth: 22 }}>{i + 1}.</span>
                <div className="grow">
                  <div className="bo-title" style={{ fontSize: 14 }}>{d.box.nome}</div>
                  {d.box.tipo === 'fisso' && (
                    <div className="bo-meta">mostrato comunque in testa al sopralluogo</div>
                  )}
                </div>
                <button className="bo-iconbtn" title="Su" onClick={() => muoviOrdine(id, -1)}>↑</button>
                <button className="bo-iconbtn" title="Giù" onClick={() => muoviOrdine(id, 1)}>↓</button>
                <button className="bo-iconbtn" title="Togli" onClick={() => toggle(id)}>✕</button>
              </div>
            </div>
          );
        })}

      <div className="bo-bar">
        <span className="grow" />
        <button className="bo-btn ghost" onClick={() => onChiudi(false)} disabled={salvando}>Annulla</button>
        <button className="bo-btn" onClick={() => void crea()} disabled={salvando}>
          {salvando ? 'Creo…' : 'Crea template'}
        </button>
      </div>
    </>
  );
}
