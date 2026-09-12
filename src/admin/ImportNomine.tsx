// Anteprima e scrittura dell'IMPORT DELLE NOMINE (l'organigramma).
//
// PERCHE' E' UNA SCHERMATA A SE' e non un terzo caso di ImportAnagrafiche.
// Quello riconosce il tipo di file dalle intestazioni e apre il PRIMO foglio.
// Qui nessuna delle due cose va bene: `ExportExcel (4).xlsx` ha quattro fogli,
// e i primi due (`Fattori di Rischio`, `Formazione`) hanno le stesse colonne
// anagrafiche del quarto - il riconoscimento automatico direbbe «elenco persone»
// con ottime ragioni e leggerebbe il foglio sbagliato. Quale foglio serve lo
// sappiamo noi, quindi si chiede per nome invece di indovinarlo.
//
// E LA REGOLA DELLA PAGINA, che e' quella del progetto: l'anteprima non puo'
// dirsi completa. Il numero delle nomine non si mostra MAI da solo - accanto c'e'
// sempre quante righe sono rimaste da decidere, anche quando sono zero.

import { useEffect, useMemo, useState } from 'react';
import {
  type Foglio, caricaClientiScelta, etichettaCliente, type ClienteScelta,
} from '../lib/admin/anagraficheImport';
import {
  FOGLIO_RUOLI, COLONNE_RUOLO, leggiFoglioRuoli, pianificaNomine, applicaNomine,
  riepiloga, type PianoNomine,
} from '../lib/admin/nomineImport';

export default function ImportNomine() {
  const [scelta, setScelta] = useState<ClienteScelta[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [foglio, setFoglio] = useState<Foglio | null>(null);
  const [piano, setPiano] = useState<PianoNomine | null>(null);
  const [abbinamenti, setAbbinamenti] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<'' | 'avvio' | 'lettura' | 'applica'>('avvio');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void avvio(); }, []);
  async function avvio() {
    setBusy('avvio'); setErr(null);
    try { setScelta(await caricaClientiScelta()); }
    catch (e: any) { setErr(e?.message ?? 'Non riesco a caricare i clienti.'); }
    finally { setBusy(''); }
  }

  async function leggi(f: File | null) {
    setFile(f); setFoglio(null); setPiano(null); setMsg(null); setErr(null);
    setAbbinamenti({});
    if (!f) return;
    setBusy('lettura');
    try {
      const fg = await leggiFoglioRuoli(f);
      setFoglio(fg);
      setPiano(await pianificaNomine(fg, scelta, {}));
    } catch (e: any) { setErr(e?.message ?? 'Lettura non riuscita.'); }
    finally { setBusy(''); }
  }

  async function cambiaAbbinamento(chiave: string, clienteId: string) {
    if (!foglio) return;
    const agg = { ...abbinamenti, [chiave]: clienteId || null };
    setAbbinamenti(agg);
    setBusy('lettura');
    try { setPiano(await pianificaNomine(foglio, scelta, agg)); }
    catch (e: any) { setErr(e?.message ?? 'Non riesco a rifare il piano.'); }
    finally { setBusy(''); }
  }

  async function applica() {
    if (!piano || !foglio) return;
    setBusy('applica'); setErr(null); setMsg(null);
    try {
      const n = await applicaNomine(piano);
      // Si rilegge subito: la seconda anteprima deve dire «0 da creare», ed e'
      // la prova che ripassare lo stesso file non aggiunge niente.
      const rifatto = await pianificaNomine(foglio, scelta, abbinamenti);
      setPiano(rifatto);
      const r = riepiloga(rifatto);
      setMsg(`${n} nomine scritte. Rilettura: ${r.daCreare} da creare, ${r.daDecidere} da decidere.`);
    } catch (e: any) { setErr(e?.message ?? 'Scrittura non riuscita.'); }
    finally { setBusy(''); }
  }

  const r = useMemo(() => (piano ? riepiloga(piano) : null), [piano]);
  const senzaCliente = useMemo(
    () => piano?.gruppi.filter((g) => !g.cliente_id) ?? [], [piano]);

  return (
    <div>
      <h2 className="bo-h">Import nomine (organigramma)</h2>
      <p className="bo-sub">
        Legge il foglio <b>{FOGLIO_RUOLI}</b> dell'export del gestionale — quello con le
        colonne dei ruoli e la mansione. Le nomine arrivano da <b>due sorgenti che non hanno
        lo stesso peso</b>: le colonne di ruolo, che portano la data dell'incarico e sono una
        dichiarazione, e il testo della mansione, che è un'interpretazione fatta da un
        dizionario. Quale delle due resta scritto sulla riga, per sempre.
        <b> L'anteprima non scrive niente.</b>
      </p>

      <div className="bo-card">
        <label className="bo-field">
          <span>Export del gestionale (.xlsx)</span>
          <input type="file" accept=".xlsx,.xls" disabled={busy !== ''}
            onChange={(e) => void leggi(e.target.files?.[0] ?? null)} />
        </label>
        {busy === 'avvio' && <p className="bo-sub">Carico i clienti…</p>}
        {busy === 'lettura' && <p className="bo-sub">Lettura in corso…</p>}
        {err && <div className="bo-err" style={{ marginTop: 10 }}>{err}</div>}
        {msg && <p className="bo-sub" style={{ color: 'var(--ok)', marginTop: 10 }}>{msg}</p>}

        {foglio && (
          <div className="bo-note" style={{ marginTop: 12, marginBottom: 0 }}>
            <div><b>{file?.name}</b> · foglio «{FOGLIO_RUOLI}» · intestazioni alla riga{' '}
              {foglio.rigaHeader} · {foglio.righe.length} righe di dati</div>
          </div>
        )}
      </div>

      {/* =================== IL RIEPILOGO, MAI UN NUMERO SOLO =================== */}
      {r && (
        <div className="bo-card" style={{ marginTop: 12 }}>
          <h3 className="bo-h3">Cosa sta per entrare</h3>
          <div className="bo-bar" style={{ gap: 18, flexWrap: 'wrap' }}>
            <Conto n={r.daCreare} etichetta="nomine da creare" forte />
            {/* Mai zero implicito: se e' zero lo dice, perche' "161 nomine" da solo
                e' un riepilogo che mente per omissione. */}
            <Conto n={r.daDecidere} etichetta="da decidere" allarme={r.daDecidere > 0} />
            <Conto n={r.personeNonTrovate} etichetta="persone non trovate"
              allarme={r.personeNonTrovate > 0} />
            <Conto n={r.giaPresenti} etichetta="già in organigramma" />
          </div>
          <p className="bo-sub" style={{ marginTop: 10 }}>
            Delle {r.daCreare} da creare, <b>{r.perOrigine.colonna}</b> vengono da una colonna
            (dichiarate, con la data) e <b>{r.perOrigine.mansione}</b> dalla mansione (dedotte,
            senza data).
          </p>
          {r.perFigura.length > 0 && (
            <table className="bo-table" style={{ marginTop: 8 }}>
              <thead><tr><th>figura</th><th style={{ textAlign: 'right' }}>nomine</th></tr></thead>
              <tbody>
                {r.perFigura.map((f) => (
                  <tr key={f.figura}><td><code>{f.figura}</code></td>
                    <td style={{ textAlign: 'right' }}>{f.n}</td></tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="bo-bar" style={{ marginTop: 14 }}>
            <button className="bo-btn" disabled={busy !== '' || r.daCreare === 0}
              onClick={() => void applica()}>
              {busy === 'applica' ? 'Scrivo…' : `Scrivi ${r.daCreare} nomine`}
            </button>
          </div>
        </div>
      )}

      {/* =================== GRUPPI SENZA CLIENTE =================== */}
      {senzaCliente.length > 0 && (
        <div className="bo-card" style={{ marginTop: 12 }}>
          <h3 className="bo-h3">{senzaCliente.length} unità del file non sono abbinate</h3>
          <p className="bo-sub">
            Le loro righe non entrano finché qualcuno non dice a quale cliente appartengono.
            Non vengono indovinate.
          </p>
          <table className="bo-table">
            <thead><tr><th>nel file</th><th>righe</th><th>cliente</th></tr></thead>
            <tbody>
              {senzaCliente.map((g) => (
                <tr key={g.chiave}>
                  <td>{g.etichetta}</td>
                  <td>{g.righe.length}</td>
                  <td>
                    <select className="bo-input" disabled={busy !== ''}
                      value={abbinamenti[g.chiave] ?? ''}
                      onChange={(e) => void cambiaAbbinamento(g.chiave, e.target.value)}>
                      <option value="">— scegli —</option>
                      {scelta.map((c) => (
                        <option key={c.id} value={c.id}>{etichettaCliente(c)}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =================== DA DECIDERE =================== */}
      {piano && piano.daDecidere.length > 0 && (
        <div className="bo-card" style={{ marginTop: 12 }}>
          <h3 className="bo-h3">{piano.daDecidere.length} righe riconosciute e non mappabili</h3>
          <p className="bo-sub">
            Il sistema ha capito che qui c'è un ruolo di sicurezza e <b>non ha una regola per
            tradurlo</b> — in quasi tutti i casi perché l'assenza della regola è voluta: essere
            socio non stabilisce di essere il datore, e «RSPP» secco non dice se sia interno o
            esterno. Non diventano nomine, e non spariscono.
          </p>
          <table className="bo-table">
            <thead><tr><th>riga</th><th>chi</th><th>dove</th><th>testo</th><th>perché</th></tr></thead>
            <tbody>
              {piano.daDecidere.map((d, i) => (
                <tr key={i}>
                  <td>{d.riga}</td>
                  <td>{d.persona}<br /><small className="bo-sub">{d.cliente}</small></td>
                  <td>{d.fonte === 'mansione' ? 'mansione' : 'colonna'}</td>
                  <td><code>{d.testo}</code></td>
                  <td><small>{d.motivo}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =================== PERSONE NON TROVATE =================== */}
      {piano && piano.personeNonTrovate.length > 0 && (
        <div className="bo-card" style={{ marginTop: 12 }}>
          <h3 className="bo-h3">{piano.personeNonTrovate.length} righe nominano una persona che non è in archivio</h3>
          <p className="bo-sub">
            Non è una decisione da prendere: è un presupposto che manca. Le nomine si appendono
            alle persone, quindi va importata prima l'anagrafica.
          </p>
          <table className="bo-table">
            <thead><tr><th>riga</th><th>chi</th><th>cliente</th><th>motivo</th></tr></thead>
            <tbody>
              {piano.personeNonTrovate.map((p, i) => (
                <tr key={i}><td>{p.riga}</td><td>{p.chi}</td><td>{p.cliente}</td>
                  <td><small>{p.motivo}</small></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =================== LE COLONNE CHE NON ENTRANO =================== */}
      <div className="bo-card" style={{ marginTop: 12 }}>
        <h3 className="bo-h3">Le nove colonne di ruolo, e le tre che non entrano</h3>
        <p className="bo-sub">
          Elencate tutte, comprese quelle escluse: una colonna esclusa e non nominata è
          indistinguibile da una colonna dimenticata.
        </p>
        <table className="bo-table">
          <thead><tr><th>colonna</th><th>figura</th><th>perché no</th></tr></thead>
          <tbody>
            {COLONNE_RUOLO.map((c) => (
              <tr key={c.chiave}>
                <td>{c.intestazione}</td>
                <td>{c.figura ? <code>{c.figura}</code> : <b style={{ color: 'var(--no)' }}>non entra</b>}</td>
                <td><small>{c.perche ?? '—'}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* =================== MANSIONI NUOVE =================== */}
      {piano && piano.mansioniNuove.length > 0 && (
        <div className="bo-card" style={{ marginTop: 12 }}>
          <h3 className="bo-h3">{piano.mansioniNuove.length} mansioni che il dizionario non conosce</h3>
          <p className="bo-sub">
            Quasi tutte non sono ruoli e va benissimo così. Servono per l'unico caso che nessuna
            regola può prendere: un ruolo scritto senza nessuna parola nota
            (<i>resp. serv. prev. e prot.</i>, <i>capo squadra emergenze</i>). Un occhio umano
            su venti stringhe nuove lo trova; nessun <code>if</code> lo troverebbe.
          </p>
          <table className="bo-table">
            <thead><tr><th>mansione</th><th style={{ textAlign: 'right' }}>righe</th></tr></thead>
            <tbody>
              {piano.mansioniNuove.slice(0, 60).map((m) => (
                <tr key={m.testo}><td><code>{m.testo}</code></td>
                  <td style={{ textAlign: 'right' }}>{m.righe}</td></tr>
              ))}
            </tbody>
          </table>
          {piano.mansioniNuove.length > 60 && (
            <p className="bo-sub">…e altre {piano.mansioniNuove.length - 60}.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Conto({ n, etichetta, forte, allarme }:
  { n: number; etichetta: string; forte?: boolean; allarme?: boolean }) {
  return (
    <div>
      <div style={{
        fontSize: forte ? 28 : 22, fontWeight: 700,
        color: allarme ? 'var(--no)' : undefined,
      }}>{n}</div>
      <div className="bo-sub" style={{ marginTop: 0 }}>{etichetta}</div>
    </div>
  );
}
