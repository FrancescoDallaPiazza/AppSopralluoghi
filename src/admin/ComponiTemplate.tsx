// Compositore di template da "capitoli" (box del catalogo).
//
// Il template viene assemblato scegliendo i capitoli: i moduli speciali
// (ORGANIGRAMMA 'smart' e COSE DA FARE pregresse 'fisso') sono SEMPRE proposti
// in cima, gia' spuntati, ma disattivabili. Salvando, il template diventa
// attivo e compare nella lista di scelta per seduta. Nessuna voce piatta: tutto
// il contenuto arriva dai box.

import { useEffect, useState } from 'react';
import {
  caricaBoxDisponibili, creaTemplateDaBox, type BoxDisponibile,
} from '../lib/admin/composizione';

export default function ComponiTemplate({
  onChiudi,
}: { onChiudi: (salvato: boolean) => void }) {
  const [fase, setFase] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [disp, setDisp] = useState<BoxDisponibile[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [nome, setNome] = useState('');
  const [tipoAttivita, setTipoAttivita] = useState('');
  const [note, setNote] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    caricaBoxDisponibili()
      .then((d) => {
        setDisp(d);
        // i moduli speciali (smart/fisso) sono proposti gia' confermati
        setSel(new Set(d.filter((x) => x.sempre).map((x) => x.box.id)));
        setFase('ok');
      })
      .catch(() => setFase('errore'));
  }, []);

  function toggle(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function crea() {
    if (salvando) return;
    setErrore(null);
    // ordine = ordine_default del catalogo, tra i soli selezionati
    const boxIds = disp
      .filter((d) => sel.has(d.box.id))
      .sort((a, b) => a.box.ordine_default - b.box.ordine_default)
      .map((d) => d.box.id);
    try {
      setSalvando(true);
      await creaTemplateDaBox({
        nome, tipo_attivita: tipoAttivita, note: note.trim() || null, boxIds,
      });
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
  const nSel = sel.size;

  function riga(d: BoxDisponibile) {
    return (
      <label key={d.box.id} className="bo-card" style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 8,
      }}>
        <input type="checkbox" checked={sel.has(d.box.id)} onChange={() => toggle(d.box.id)}
          style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--hi)' }} />
        <div className="grow">
          <div className="bo-title">{d.box.nome}</div>
          {d.box.descrizione && (
            <div className="bo-sub" style={{ margin: '2px 0 0' }}>{d.box.descrizione}</div>
          )}
          <div className="bo-meta" style={{ marginTop: 4 }}>
            {d.box.tipo === 'generico'
              ? <span>{d.n_sezioni} sezioni · {d.n_voci} voci</span>
              : <span className="bo-pill">{d.box.tipo === 'smart' ? 'modulo speciale' : 'sempre in testa'}</span>}
          </div>
        </div>
      </label>
    );
  }

  return (
    <>
      <div className="bo-row" style={{ marginBottom: 14 }}>
        <div className="grow">
          <h2 className="bo-h">Componi un template dai capitoli</h2>
          <p className="bo-sub" style={{ margin: 0 }}>
            Scegli i capitoli, dai un nome: il template diventa attivo e compare nella scelta per seduta.
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

      <div className="bo-bar">
        <span className="bo-sub" style={{ margin: 0 }}>{nSel} capitoli selezionati</span>
        <span className="grow" />
        <button className="bo-btn ghost" onClick={() => onChiudi(false)} disabled={salvando}>Annulla</button>
        <button className="bo-btn" onClick={() => void crea()} disabled={salvando}>
          {salvando ? 'Creo…' : 'Crea template'}
        </button>
      </div>
    </>
  );
}
