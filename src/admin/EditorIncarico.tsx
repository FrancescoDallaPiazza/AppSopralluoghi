// Editor di un incarico (creazione/modifica). Vive nel tab Pianificazione:
// l'incarico e' un oggetto OPERATIVO (genera le sedute), non anagrafico. In
// creazione si sceglie il cliente (le sedi si caricano di conseguenza); in
// modifica il cliente e' fissato.

import { useEffect, useMemo, useState } from 'react';
import { dateDaCadenza } from '../lib/admin/calendario';
import { caricaSedi } from '../lib/admin/sedi';
import type { ClienteRiga } from '../lib/admin/anagrafiche';
import type { Incarico, Sede, CadenzaUnita, IncaricoStato } from '../lib/types';

const STATO_INC: { v: IncaricoStato; l: string }[] = [
  { v: 'attivo', l: 'Attivo' }, { v: 'sospeso', l: 'Sospeso' }, { v: 'chiuso', l: 'Chiuso' },
];
const UNITA: { v: CadenzaUnita; l: string }[] = [
  { v: 'giorni', l: 'giorni' }, { v: 'settimane', l: 'settimane' }, { v: 'mesi', l: 'mesi' },
];
const fmtData = (d: string | null) => {
  if (!d) return '\u2014';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y}`;
};

export function EditorIncarico({
  incarico, nuovo, clienti, tipi, busy, onSalva, onAnnulla,
}: {
  incarico: Incarico;
  nuovo: boolean;
  clienti: ClienteRiga[];
  tipi: string[];
  busy: boolean;
  onSalva: (i: Incarico) => void;
  onAnnulla: () => void;
}) {
  const [i, setI] = useState<Incarico>(incarico);
  const [modo, setModo] = useState<'cadenza' | 'numero'>(
    incarico.cadenza_valore != null ? 'cadenza' : 'numero',
  );
  const [sedi, setSedi] = useState<Sede[]>([]);
  const patch = (p: Partial<Incarico>) => setI((x) => ({ ...x, ...p }));
  const listId = 'tipi-attivita';

  // Le sedi dipendono dal cliente scelto: si ricaricano al cambio cliente.
  useEffect(() => {
    if (!i.cliente_id) { setSedi([]); return; }
    let vivo = true;
    caricaSedi(i.cliente_id).then((s) => { if (vivo) setSedi(s); }).catch(() => { if (vivo) setSedi([]); });
    return () => { vivo = false; };
  }, [i.cliente_id]);

  const clienteNome = clienti.find((c) => c.cliente.id === i.cliente_id)?.cliente.ragione_sociale ?? '\u2014';

  const tipoNonCoperto =
    i.tipo_attivita.trim() !== '' && tipi.length > 0 &&
    !tipi.some((t) => t.toLowerCase() === i.tipo_attivita.trim().toLowerCase());

  function cambiaModo(m: 'cadenza' | 'numero') {
    setModo(m);
    if (m === 'numero') {
      patch({ cadenza_valore: null, cadenza_unita: null });
    } else {
      patch({ cadenza_valore: i.cadenza_valore ?? 3, cadenza_unita: i.cadenza_unita ?? 'mesi' });
    }
  }

  const anteprima = useMemo(() => {
    if (modo !== 'cadenza' || !i.cadenza_valore || !i.cadenza_unita) return [];
    return dateDaCadenza(i.periodo_inizio, i.periodo_fine, i.cadenza_valore, i.cadenza_unita);
  }, [modo, i.cadenza_valore, i.cadenza_unita, i.periodo_inizio, i.periodo_fine]);

  function salva() {
    if (!i.cliente_id) { window.alert('Scegli il cliente.'); return; }
    if (modo === 'cadenza') {
      onSalva({ ...i, n_sopralluoghi: Math.max(1, anteprima.length) });
    } else {
      onSalva({ ...i, cadenza_valore: null, cadenza_unita: null });
    }
  }

  return (
    <div className="bo-card" style={{ borderLeft: '3px solid var(--hi)' }}>
      <div className="bo-title" style={{ marginBottom: 12 }}>
        {nuovo ? 'Nuovo incarico' : 'Modifica incarico'}
      </div>

      <label className="bo-field">
        <span>Cliente *</span>
        {nuovo ? (
          <select value={i.cliente_id} onChange={(e) => patch({ cliente_id: e.target.value })}>
            <option value="">— scegli cliente —</option>
            {clienti.map((c) => (
              <option key={c.cliente.id} value={c.cliente.id}>{c.cliente.ragione_sociale}</option>
            ))}
          </select>
        ) : (
          <input type="text" value={clienteNome} disabled />
        )}
      </label>

      <label className="bo-field">
        <span>Tipo di attività *</span>
        <input type="text" list={listId} value={i.tipo_attivita}
          placeholder="es. DVR, RSPP/Audit periodico…"
          onChange={(e) => patch({ tipo_attivita: e.target.value })} />
        <datalist id={listId}>
          {tipi.map((t) => <option key={t} value={t} />)}
        </datalist>
      </label>
      {tipoNonCoperto && (
        <div className="bo-note" style={{ marginTop: -4 }}>
          Etichetta libera dell'incarico. La checklist non dipende da qui: si sceglie per
          singola seduta in pianificazione.
        </div>
      )}

      <label className="bo-field">
        <span>Come definire i sopralluoghi</span>
        <select value={modo} onChange={(e) => cambiaModo(e.target.value as 'cadenza' | 'numero')}>
          <option value="cadenza">Per cadenza (1 ogni …)</option>
          <option value="numero">Numero fisso nel periodo</option>
        </select>
      </label>

      {modo === 'cadenza' ? (
        <>
          <div className="bo-grid">
            <label className="bo-field">
              <span>1 sopralluogo ogni</span>
              <input type="number" min={1} value={i.cadenza_valore ?? ''}
                onChange={(e) => patch({ cadenza_valore: e.target.value ? Number(e.target.value) : null })} />
            </label>
            <label className="bo-field">
              <span>Unità</span>
              <select value={i.cadenza_unita ?? 'mesi'}
                onChange={(e) => patch({ cadenza_unita: e.target.value as CadenzaUnita })}>
                {UNITA.map((u) => <option key={u.v} value={u.v}>{u.l}</option>)}
              </select>
            </label>
          </div>
          <div className="bo-note" style={{ marginTop: -2 }}>
            {anteprima.length > 0
              ? `≈ ${anteprima.length} ${anteprima.length === 1 ? 'seduta' : 'sedute'} nel periodo `
                + `(prima ${fmtData(anteprima[0])}, ultima ${fmtData(anteprima[anteprima.length - 1])}). `
                + 'Il numero viene calcolato in automatico.'
              : 'Imposta cadenza e periodo per calcolare il numero di sedute.'}
          </div>
        </>
      ) : (
        <div className="bo-grid">
          <label className="bo-field">
            <span>N. sopralluoghi *</span>
            <input type="number" min={1} value={i.n_sopralluoghi}
              onChange={(e) => patch({ n_sopralluoghi: Number(e.target.value) || 0 })} />
          </label>
          <span />
        </div>
      )}

      <div className="bo-grid">
        <label className="bo-field">
          <span>Durata seduta (min)</span>
          <input type="number" min={0} value={i.durata_seduta_stimata_min ?? ''}
            onChange={(e) => patch({ durata_seduta_stimata_min: e.target.value ? Number(e.target.value) : null })} />
        </label>
        <label className="bo-field">
          <span>Sede</span>
          <select value={i.sede_id ?? ''}
            onChange={(e) => patch({ sede_id: e.target.value || null })}>
            <option value="">— nessuna (sede unica) —</option>
            {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </label>
        <label className="bo-field">
          <span>Stato</span>
          <select value={i.stato} onChange={(e) => patch({ stato: e.target.value as IncaricoStato })}>
            {STATO_INC.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </label>
        <label className="bo-field">
          <span>Inizio periodo *</span>
          <input type="date" value={i.periodo_inizio}
            onChange={(e) => patch({ periodo_inizio: e.target.value })} />
        </label>
        <label className="bo-field">
          <span>Fine periodo *</span>
          <input type="date" value={i.periodo_fine}
            onChange={(e) => patch({ periodo_fine: e.target.value })} />
        </label>
        <label className="bo-field" style={{ marginBottom: 0 }}>
          <span>ID Werp (opzionale)</span>
          <input type="text" value={i.werp_id ?? ''}
            onChange={(e) => patch({ werp_id: e.target.value || null })} />
        </label>
      </div>

      <div className="bo-bar">
        <button className="bo-btn" onClick={salva} disabled={busy}>
          {busy ? 'Salvo…' : 'Salva incarico'}
        </button>
        <button className="bo-btn ghost" onClick={onAnnulla} disabled={busy}>Annulla</button>
      </div>
    </div>
  );
}
