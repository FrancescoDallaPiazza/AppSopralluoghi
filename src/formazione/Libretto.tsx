// Libretto formativo di una persona (back-office): pannello inline aperto dalla
// riga in "Risorse Umane". Taglio per PERSONA, complementare all'organigramma
// che taglia per figura.
//
// Solo FATTI: chi e', che ruoli ricopre, quali corsi ha svolto e quando scadono.
// Niente valutazione dei requisiti (conforme/critico/...) - quella dipende dai
// ruoli e dal catalogo di oggi, e su un documento che si consegna e si ritrova
// mesi dopo diventa un'affermazione sbagliata su una persona; si guarda in
// organigramma, dove e' viva. E' invece l'unico posto dell'app dove compaiono
// anche gli attestati che non servono a nessun requisito dei suoi ruoli - il
// corso antincendio di chi in organigramma e' solo lavoratore - altrove
// invisibili per costruzione.

import { useEffect, useState } from 'react';
import { componiLibretto, esportaPdfLibretto, type Libretto } from '../lib/admin/libretto';
import { dataIT } from '../lib/admin/formazione';

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

      {/* ---- formazione svolta: i FATTI, per tipologia ---- */}
      <div className="bo-subsez-tit">
        Formazione svolta ({lib.gruppi.reduce((n, g) => n + g.voci.length, 0)} attestati
        {lib.gruppi.length ? ` · ${lib.gruppi.length} tipologie` : ''})
      </div>
      {lib.gruppi.length === 0 ? (
        <div className="bo-empty" style={{ marginBottom: 10 }}>Nessun attestato registrato.</div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          {lib.gruppi.map((g) => (
            /* Bordo spesso in testa a ogni tipologia: dentro un blocco le righe
               sono divise da filetti sottili, quindi senza uno stacco netto la
               fine di un corso e l'inizio del successivo si somigliano e la
               storia di due obblighi si legge come una sola. */
            <div key={g.chiave} style={{
              marginTop: 12, paddingTop: 8, borderTop: '2px solid var(--ink-soft, #8a8f98)',
            }}>
              <div className="bo-meta" style={{ justifyContent: 'space-between', gap: 8 }}>
                <b style={{ flex: 1 }}>
                  {g.titolo}
                  {g.categoria && <span className="bo-pill archiviato" style={{ marginLeft: 6 }}>{g.categoria}</span>}
                </b>
                <span className="bo-sub">
                  {g.ore_totali != null && `${g.ore_totali}h totali`}
                  {g.scadenza && ` · scadenza ${dataIT(g.scadenza)}`}
                </span>
              </div>
              {/* Dal piu' vecchio al piu' recente: e' la storia di quell'obbligo,
                  base e aggiornamenti in fila. */}
              {g.voci.map((v) => (
                <div key={v.id} className="bo-meta"
                  style={{ justifyContent: 'space-between', gap: 8, padding: '3px 0 3px 12px',
                    borderBottom: '1px solid var(--line)' }}>
                  <span style={{ flex: 1 }}>
                    <span className="bo-sub">
                      {v.data_completamento ? dataIT(v.data_completamento) : 'data n.d.'}
                      {v.ore != null && ` · ${v.ore}h`}
                      {v.ente_formatore && ` · ${v.ente_formatore}`}
                    </span>
                    {/* Il nome della riga si mostra solo se diverso dal titolo del
                        gruppo: sulle evidenze pregresse e' la dicitura originale
                        dell'attestato, ed e' quella che si ritrova sul cartaceo. */}
                    {v.corso_nome !== g.titolo && (
                      <span className="bo-sub" style={{ display: 'block' }}>{v.corso_nome}</span>
                    )}
                    {/* Cosa manca, per esteso: senza questa riga il libretto
                        mostra 3h e tace sulle altre 5, che e' l'informazione
                        per cui qualcuno lo sta leggendo. */}
                    {v.evidenza_incompleta && (
                      <span className="bo-sub" style={{ display: 'block', color: 'var(--warn, #b7791f)' }}>
                        Documentazione incompleta{v.note ? ` — ${v.note}` : ''}. La parte mancante va
                        recuperata e registrata (vedi <i>Cose da fare</i>).
                      </span>
                    )}
                  </span>
                  {v.is_aggiornamento && <span className="bo-pill usato">aggiornamento</span>}
                  {v.evidenza_incompleta && <span className="bo-pill warn">evidenza incompleta</span>}
                  {/* Lo spezzone va detto: sono ore erogate davvero, ma da solo
                      non assolve nulla e senza etichetta si legge come un corso. */}
                  {v.parziale && <span className="bo-pill warn">spezzone</span>}
                </div>
              ))}
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
