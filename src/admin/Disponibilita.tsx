// Vista "Disponibilità tecnici" (back-office, solo admin).
//
// Cruscotto panoramico: per ogni tecnico, settimana per settimana, il carico
// pianificato espresso in PERCENTUALE rispetto alla sua capienza oraria
// (campo capienza_ore_settimana). È la "colonna riempita % rispetto al 100%"
// auspicata nelle istruzioni iniziali. Sola lettura: aiuta a vedere chi è
// libero e chi è oltre capienza prima di assegnare nuove sedute in
// Pianificazione.
//
// Poggia interamente su quanto già esiste (lib/admin/disponibilita.ts ->
// motore assistita + caricaCaricoGlobale): nessuna nuova tabella, nessuna
// Edge Function.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { nomeCompleto, type Tecnico, type Sopralluogo } from '../lib/types';
import {
  caricaTecnici, caricaCaricoGlobale, calcolaCarico,
  finestraSettimane, spostaSettimane, occupazione, oggiISO,
  type CaricoPerTecnico, type Settimana, type Occupazione,
} from '../lib/admin/disponibilita';

const FINESTRE = [4, 8, 12] as const;

// Colori della cella in base all'occupazione (palette del back-office).
function coloreOcc(o: Occupazione): { bg: string; fg: string; barra: string } {
  if (o.perc == null) return { bg: '#f3efe7', fg: '#8b8e94', barra: '#cfc8bb' };
  if (o.perc > 100) return { bg: 'var(--no-bg)', fg: 'var(--no)', barra: 'var(--no)' };
  if (o.perc > 70) return { bg: '#fbf3df', fg: 'var(--hi-dark)', barra: 'var(--hi)' };
  return { bg: 'var(--ok-bg)', fg: 'var(--ok)', barra: 'var(--ok)' };
}

export default function Disponibilita() {
  const [tecnici, setTecnici] = useState<Tecnico[]>([]);
  const [globale, setGlobale] = useState<Sopralluogo[]>([]);
  const [fase, setFase] = useState<'carico' | 'pronto' | 'errore'>('carico');
  const [inizio, setInizio] = useState<string>(() => oggiISO());
  const [nSett, setNSett] = useState<number>(8);

  useEffect(() => {
    setFase('carico');
    Promise.all([caricaTecnici(), caricaCaricoGlobale()])
      .then(([t, g]) => { setTecnici(t); setGlobale(g); setFase('pronto'); })
      .catch(() => setFase('errore'));
  }, []);

  const carico = useMemo<CaricoPerTecnico>(() => calcolaCarico(globale), [globale]);
  const settimane = useMemo<Settimana[]>(() => finestraSettimane(inizio, nSett), [inizio, nSett]);

  const senzaCapienza = tecnici.filter((t) => !t.capienza_ore_settimana).length;

  if (fase === 'carico') return <div className="bo-empty">Carico la disponibilità…</div>;
  if (fase === 'errore') {
    return <div className="bo-err">Impossibile caricare la disponibilità dei tecnici.</div>;
  }

  return (
    <>
      <div className="bo-row" style={{ marginBottom: 6 }}>
        <div className="grow">
          <h2 className="bo-h">Disponibilità tecnici</h2>
          <p className="bo-sub" style={{ margin: 0 }}>
            Carico settimanale di ogni tecnico in percentuale sulla sua capienza
            oraria, dalle sedute già pianificate. Aiuta a scegliere chi assegnare
            in Pianificazione.
          </p>
        </div>
      </div>

      {/* controlli: navigazione finestra + ampiezza */}
      <div className="bo-row" style={{ gap: 10, flexWrap: 'wrap', margin: '12px 0 14px' }}>
        <button className="bo-btn ghost sm"
          onClick={() => setInizio((d) => spostaSettimane(d, -nSett))}>‹ Indietro</button>
        <button className="bo-btn ghost sm"
          onClick={() => setInizio(oggiISO())}>Questa settimana</button>
        <button className="bo-btn ghost sm"
          onClick={() => setInizio((d) => spostaSettimane(d, nSett))}>Avanti ›</button>
        <span className="bo-sp" />
        <label className="bo-field" style={{ margin: 0, minWidth: 140 }}>
          <span>Finestra</span>
          <select value={nSett} onChange={(e) => setNSett(Number(e.target.value))}>
            {FINESTRE.map((n) => <option key={n} value={n}>{n} settimane</option>)}
          </select>
        </label>
      </div>

      {tecnici.length === 0 && (
        <div className="bo-empty">
          Nessun tecnico attivo. Aggiungi risorse nella sezione “Tecnici”.
        </div>
      )}

      {tecnici.length > 0 && (
        <div className="bo-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 210 + nSett * 92 }}>
            <thead>
              <tr>
                <th style={thLeft}>Tecnico</th>
                {settimane.map((s) => (
                  <th key={s.key} style={{ ...thWeek, ...(s.corrente ? thWeekNow : null) }}>
                    <div style={{ fontWeight: 800 }}>{s.etichetta}</div>
                    <div style={{ fontWeight: 600, fontSize: 10, color: 'var(--faint)' }}>
                      sett. {s.numero}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tecnici.map((t) => {
                const occs = settimane.map((s) => occupazione(carico, t, s.key));
                const oltre = occs.filter((o) => o.perc != null && o.perc > 100).length;
                return (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={tdLeft}>
                      <div style={{ fontWeight: 800, fontSize: 13.5 }}>{nomeCompleto(t)}</div>
                      <div style={{
                        fontSize: 11.5, color: 'var(--ink-soft)', display: 'flex',
                        gap: 8, flexWrap: 'wrap', marginTop: 2,
                      }}>
                        {t.base_localita && <span>{t.base_localita}</span>}
                        <span>
                          {t.capienza_ore_settimana != null
                            ? `${t.capienza_ore_settimana} h/sett.`
                            : 'capienza n.d.'}
                        </span>
                      </div>
                      {oltre > 0 && (
                        <span className="bo-pill warn"
                          style={{ marginTop: 5, display: 'inline-block' }}>
                          {oltre} {oltre === 1 ? 'sett. oltre' : 'sett. oltre'}
                        </span>
                      )}
                    </td>
                    {occs.map((o, i) => {
                      const c = coloreOcc(o);
                      const larg = o.perc == null ? 0 : Math.min(o.perc, 100);
                      const titolo = `${o.ore} h pianificate`
                        + (o.capienza != null ? ` su ${o.capienza} h` : ' (capienza non impostata)');
                      return (
                        <td key={settimane[i]!.key} style={tdCell} title={titolo}>
                          <div style={{ background: c.bg, borderRadius: 8, padding: '7px 6px 6px' }}>
                            <div style={{
                              fontWeight: 800, fontSize: 13, color: c.fg, textAlign: 'center',
                            }}>
                              {o.perc == null ? '—' : `${o.perc}%`}
                            </div>
                            <div style={{
                              fontSize: 10.5, color: 'var(--faint)', textAlign: 'center', marginTop: 1,
                            }}>
                              {o.ore} h
                            </div>
                            <div style={{
                              height: 5, borderRadius: 3, background: '#0000000f',
                              marginTop: 5, overflow: 'hidden',
                            }}>
                              <div style={{ width: `${larg}%`, height: '100%', background: c.barra }} />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* legenda */}
      <div className="bo-row" style={{
        gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 12, color: 'var(--ink-soft)',
      }}>
        <Legenda colore="var(--ok)" testo="fino al 70%" />
        <Legenda colore="var(--hi)" testo="71–100% (quasi pieno)" />
        <Legenda colore="var(--no)" testo="oltre capienza" />
        <Legenda colore="#cfc8bb" testo="capienza non impostata" />
      </div>

      {senzaCapienza > 0 && (
        <div className="bo-note" style={{ marginTop: 10 }}>
          {senzaCapienza === 1 ? '1 tecnico non ha' : `${senzaCapienza} tecnici non hanno`} la
          capienza oraria impostata: per loro la percentuale non è calcolabile.
          La imposti nella scheda del tecnico, campo “Capienza (ore/settimana)”.
        </div>
      )}
    </>
  );
}

function Legenda({ colore, testo }: { colore: string; testo: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 12, height: 12, borderRadius: 3, background: colore, display: 'inline-block',
      }} />
      {testo}
    </span>
  );
}

const thLeft: CSSProperties = {
  position: 'sticky', left: 0, zIndex: 2, background: '#fff', textAlign: 'left',
  padding: '10px 12px', fontSize: 11.5, fontWeight: 800, color: 'var(--ink-soft)',
  borderBottom: '1px solid var(--line)', minWidth: 200,
};
const thWeek: CSSProperties = {
  padding: '8px 6px', fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)',
  borderBottom: '1px solid var(--line)', borderLeft: '1px solid var(--line)',
  textAlign: 'center', minWidth: 86, lineHeight: 1.25,
};
const thWeekNow: CSSProperties = { background: '#fbf6ea', color: 'var(--hi-dark)' };
const tdLeft: CSSProperties = {
  position: 'sticky', left: 0, zIndex: 1, background: '#fff', padding: '8px 12px',
  borderRight: '1px solid var(--line)', verticalAlign: 'top',
};
const tdCell: CSSProperties = {
  padding: 5, borderLeft: '1px solid var(--line)', verticalAlign: 'top',
};
