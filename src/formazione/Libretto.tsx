// Libretto formativo di una persona (back-office): pannello inline aperto dalla
// riga in "Risorse Umane". Taglio per PERSONA, complementare all'organigramma
// che taglia per figura.
//
// Due blocchi, e l'ordine e' voluto: prima COSA HA SVOLTO (i fatti: corso, data,
// ore, ente, scadenza), poi COME STA messo rispetto ai ruoli che ricopre (la
// valutazione del motore). Il primo blocco e' l'unico posto dell'app dove
// compaiono anche gli attestati che non servono a nessun requisito dei suoi
// ruoli - il corso antincendio di chi in organigramma e' solo lavoratore -
// altrove invisibili per costruzione.

import { useEffect, useState } from 'react';
import { componiLibretto, esportaPdfLibretto, type Libretto } from '../lib/admin/libretto';
import { dataIT, type StatoRequisito } from '../lib/admin/formazione';

const TXT: Record<StatoRequisito, string> = {
  conforme: 'Conforme', in_scadenza: 'In scadenza', critico: 'Critico',
  esonerato: 'Esonerato', facoltativo: 'Facoltativo', da_verificare: 'Da verificare',
};

const COLORE: Record<StatoRequisito, string> = {
  conforme: '#2f855a', in_scadenza: '#b7791f', critico: '#c53030',
  esonerato: '#4a5568', facoltativo: '#8a8f98', da_verificare: '#b7791f',
};

export function LibrettoPersona({ clienteId, personaId, clienteNome, onChiudi }: {
  clienteId: string;
  personaId: string;
  clienteNome: string;
  onChiudi: () => void;
}) {
  const [lib, setLib] = useState<Libretto | null>(null);
  const [fase, setFase] = useState<'carico' | 'pronto' | 'errore'>('carico');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let vivo = true;
    setFase('carico');
    componiLibretto(clienteId, personaId, clienteNome)
      .then((l) => { if (vivo) { setLib(l); setFase('pronto'); } })
      .catch((e) => { if (vivo) { setMsg((e as Error)?.message ?? 'Caricamento non riuscito.'); setFase('errore'); } });
    return () => { vivo = false; };
  }, [clienteId, personaId, clienteNome]);

  async function esporta() {
    if (!lib) return;
    setBusy(true); setMsg(null);
    try {
      const url = await esportaPdfLibretto(lib);
      // Stessa uscita dell'export organigramma: si apre l'artefatto firmato.
      window.open(url, '_blank', 'noopener');
    } catch (e) { setMsg((e as Error)?.message ?? 'Esportazione non riuscita.'); }
    finally { setBusy(false); }
  }

  if (fase === 'carico') return <div className="bo-empty">Compongo il libretto…</div>;
  if (fase === 'errore' || !lib) {
    return (
      <div>
        <div className="bo-err">{msg ?? 'Libretto non disponibile.'}</div>
        <button className="bo-btn ghost sm" onClick={onChiudi}>Chiudi</button>
      </div>
    );
  }

  const p = lib.persona;
  return (
    <div className="bo-card" style={{ marginTop: 8 }}>
      <div className="bo-meta" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <b style={{ flex: 1 }}>Libretto formativo · {p.nome}</b>
        <button className="bo-btn sm" disabled={busy} onClick={() => void esporta()}>
          {busy ? 'Genero…' : 'Esporta PDF'}
        </button>
        <button className="bo-btn ghost sm" onClick={onChiudi}>Chiudi</button>
      </div>
      {msg && <div className="bo-err">{msg}</div>}

      <p className="bo-sub" style={{ margin: '0 0 10px' }}>
        {p.codice_fiscale ?? 'CF non indicato'}
        {p.mansione && ` · ${p.mansione}`}
        {p.reparto && ` · ${p.reparto}`}
        {p.data_assunzione && ` · assunto il ${dataIT(p.data_assunzione)}`}
        {p.livello_rischio && ` · rischio ${p.livello_rischio}`}
        {!p.attivo && ' · NON ATTIVO'}
      </p>

      {/* ---- ruoli ---- */}
      <div className="bo-subsez-tit">Ruoli ricoperti</div>
      {lib.ruoli.length === 0 ? (
        <div className="bo-empty" style={{ marginBottom: 10 }}>
          Nessun ruolo in organigramma: senza almeno il ruolo di lavoratore la formazione qui sotto
          non genera requisiti né scadenze.
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          {lib.ruoli.map((r) => (
            <div key={r.codice} className="bo-meta"
              style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '4px 0' }}>
              <span style={{ flex: 1 }}>{r.nome}</span>
              <span className="bo-sub">{r.data_nomina ? 'nomina del ' + dataIT(r.data_nomina) : 'data di nomina non indicata'}</span>
              {r.evidenza_mancante && <span className="bo-pill warn">evidenza da ottenere</span>}
            </div>
          ))}
        </div>
      )}

      {/* ---- formazione svolta: i FATTI ---- */}
      <div className="bo-subsez-tit">Formazione svolta ({lib.svolti.length})</div>
      {lib.svolti.length === 0 ? (
        <div className="bo-empty" style={{ marginBottom: 10 }}>Nessun attestato registrato.</div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          {lib.svolti.map((v) => (
            <div key={v.id} style={{ borderBottom: '1px solid var(--line)', padding: '5px 0' }}>
              <div className="bo-meta" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span style={{ flex: 1 }}>
                  <b>{v.corso_nome}</b>
                  {v.is_aggiornamento && <span className="bo-pill usato" style={{ marginLeft: 6 }}>aggiornamento</span>}
                  {/* Lo spezzone va detto: sono ore erogate davvero, ma da solo
                      non assolve nulla e senza etichetta si legge come un corso. */}
                  {v.parziale && <span className="bo-pill warn" style={{ marginLeft: 6 }}>spezzone</span>}
                </span>
                <span className="bo-sub">
                  {v.data_completamento ? dataIT(v.data_completamento) : 'data n.d.'}
                  {v.ore != null && ` · ${v.ore}h`}
                </span>
              </div>
              <div className="bo-sub">
                {v.ente_formatore ?? 'ente non indicato'}
                {v.scadenza && ` · scade il ${dataIT(v.scadenza)}`}
                {v.note && ` · ${v.note}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- situazione: la VALUTAZIONE ---- */}
      <div className="bo-subsez-tit">Situazione rispetto ai ruoli</div>
      {lib.requisiti.length === 0 ? (
        <div className="bo-empty">Nessun requisito: dipende dai ruoli ricoperti.</div>
      ) : (
        <div>
          {lib.requisiti.map((r, i) => (
            <div key={i} className="bo-meta"
              style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '4px 0', gap: 8 }}>
              <span style={{ flex: 1 }}>
                {r.corso_nome}{r.ore != null && ` · ${r.ore}h`}
                <span className="bo-sub" style={{ display: 'block' }}>
                  {r.dettaglio}
                  {r.data_completamento && ` · svolto il ${dataIT(r.data_completamento)}`}
                  {r.scadenza && ` · scadenza ${dataIT(r.scadenza)}`}
                </span>
              </span>
              <span style={{ color: COLORE[r.stato], fontWeight: 700, fontSize: 12 }}>{TXT[r.stato]}</span>
            </div>
          ))}
        </div>
      )}

      <p className="bo-sub" style={{ margin: '10px 0 0' }}>
        Documento interno di sicurezza (D.Lgs. 81/08): riporta ruoli, formazione e scadenze.
        Non è il libretto formativo del cittadino (D.Lgs. 276/2003), che comprende anche titoli
        di studio ed esperienze lavorative.
      </p>
    </div>
  );
}
