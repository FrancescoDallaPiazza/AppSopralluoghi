// Back-office - "Import formazione" (C1b): carica l'export "Ricerca
// Visite/Formazioni" del gestionale e ne fa attestati in `formazione`.
//
// L'anteprima e' il punto del componente, non un abbellimento: l'import scrive
// la storia formativa da cui il motore deduce i semafori, e una riga sbagliata
// qui diventa un "conforme" che non lo e'. Percio' nulla va su disco prima che
// l'operatore abbia visto, per ogni unita' del file:
//   - su QUALE cliente sta per scrivere (la P.IVA non basta a deciderlo: due
//     sedi della stessa azienda sono due clienti distinti, vedi formazioneImport);
//   - quali persone non esistono ancora, e se crearle;
//   - quali corsi non sa mappare (li' l'import non inventa: lascia indietro);
//   - quali attestati hanno meno ore di quelle dovute.

import { useEffect, useMemo, useState } from 'react';
import {
  leggiExportFormazioni, raggruppaUnita, riconciliaUnita, applicaUnita,
  proponiAbbinamenti, caricaClientiScelta, chiaveImport, chiaviGiaImportate, caricaAlias,
  etichettaCliente,
  type UnitaFile, type EsitoUnita, type ClienteScelta,
} from '../lib/admin/formazioneImport';
import { caricaCatalogo, caricaPersone, type CorsoCatalogo } from '../lib/admin/formazione';
import type { CorsoAlias } from '../lib/admin/aliasCorsi';

const dataIT = (iso: string | null): string =>
  iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';

export default function ImportFormazione() {
  const [clienti, setClienti] = useState<ClienteScelta[]>([]);
  const [alias, setAlias] = useState<CorsoAlias[]>([]);
  const [corsi, setCorsi] = useState<CorsoCatalogo[]>([]);

  const [unita, setUnita] = useState<UnitaFile[]>([]);
  const [visiteScartate, setVisiteScartate] = useState(0);
  const [chiaviPresenti, setChiaviPresenti] = useState<Set<string>>(new Set());

  const [scelta, setScelta] = useState<Record<string, string>>({});
  const [creaPersone, setCreaPersone] = useState<Record<string, boolean>>({});
  const [esiti, setEsiti] = useState<Record<string, EsitoUnita>>({});

  const [busy, setBusy] = useState<'' | 'avvio' | 'lettura' | 'calcolo' | 'applica'>('avvio');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [cl, al, cat] = await Promise.all([caricaClientiScelta(), caricaAlias(), caricaCatalogo()]);
        setClienti(cl); setAlias(al); setCorsi(cat.corsi);
      } catch (e: any) { setErr(e?.message ?? 'Errore in caricamento.'); }
      finally { setBusy(''); }
    })();
  }, []);

  const damappare = useMemo(
    () => alias.filter((a) => !a.corso_codice && !a.ignorato).length, [alias]);

  // Due unita' sullo stesso cliente = due sedi fuse in un organigramma solo.
  // In app un cliente ha UN organigramma, e gli addetti alle emergenze si
  // designano per luogo di lavoro: fondere Villafranca e Trevenzuolo farebbe
  // contare una sola squadra per due stabilimenti. E' un errore silenzioso -
  // l'import riuscirebbe benissimo - quindi va fermato qui, non spiegato dopo.
  // Si tiene l'elenco delle unita' per cliente e non un semplice conteggio: a
  // chi legge l'avviso serve sapere QUALE altra card tiene quel cliente, perche'
  // la card sbagliata da correggere e' quasi sempre l'altra.
  const unitaPerCliente = useMemo(() => {
    const m = new Map<string, UnitaFile[]>();
    for (const u of unita) {
      const cid = scelta[u.chiave] ?? '';
      if (cid) m.set(cid, [...(m.get(cid) ?? []), u]);
    }
    return m;
  }, [unita, scelta]);
  // Le ALTRE unita' abbinate allo stesso cliente. Vuoto = abbinamento pulito.
  const altreSulCliente = (cid: string, u: UnitaFile): UnitaFile[] => {
    const l = unitaPerCliente.get(cid) ?? [];
    return l.length > 1 ? l.filter((x) => x.chiave !== u.chiave) : [];
  };

  async function leggi(file: File | null) {
    if (!file) return;
    setBusy('lettura'); setErr(null); setMsg(null);
    setEsiti({}); setUnita([]);
    try {
      const { righe, visiteScartate: vs } = await leggiExportFormazioni(file);
      const u = raggruppaUnita(righe);
      setVisiteScartate(vs);
      setUnita(u);
      // Le chiavi gia' presenti si chiedono UNA volta per tutto il file: e'
      // quello che distingue un secondo giro (0 nuove) da un primo.
      setChiaviPresenti(await chiaviGiaImportate(righe.map(chiaveImport)));
      setScelta(proponiAbbinamenti(u, clienti));
    } catch (e: any) { setErr(e?.message ?? 'Errore in lettura del file.'); }
    finally { setBusy(''); }
  }

  // La riconciliazione dipende dal cliente scelto (le persone sono le sue):
  // si rifa' a ogni cambio di abbinamento, non una volta sola al caricamento.
  useEffect(() => {
    if (!unita.length) return;
    void (async () => {
      setBusy('calcolo');
      try {
        const out: Record<string, EsitoUnita> = {};
        for (const u of unita) {
          const cid = scelta[u.chiave] ?? '';
          const personeCliente = cid ? await caricaPersone(cid) : [];
          out[u.chiave] = riconciliaUnita(u, cid || null, { alias, corsi, personeCliente, chiaviPresenti });
        }
        setEsiti(out);
      } catch (e: any) { setErr(e?.message ?? 'Errore in riconciliazione.'); }
      finally { setBusy(''); }
    })();
  }, [unita, scelta, alias, corsi, chiaviPresenti]);

  async function applica(u: UnitaFile) {
    const e = esiti[u.chiave];
    if (!e || !e.cliente_id) return;
    setBusy('applica'); setErr(null); setMsg(null);
    try {
      const r = await applicaUnita(e, { creaPersone: !!creaPersone[u.chiave] });
      setMsg(`${u.societa} · ${u.sede}: ${r.formazioniInserite} attestati importati`
        + (r.personeCreate ? `, ${r.personeCreate} persone create` : '')
        + (r.saltatePerPersona ? `, ${r.saltatePerPersona} righe saltate (persona assente)` : '') + '.');
      // Dopo la scrittura quelle chiavi esistono: si rileggono e si uniscono a
      // quelle gia' note, cosi' un secondo "Importa" dice 0 nuove invece di
      // riscrivere. Il cambio di stato fa ripartire la riconciliazione.
      const appena = await chiaviGiaImportate(u.righe.map(chiaveImport));
      setChiaviPresenti((prima) => new Set([...prima, ...appena]));
    } catch (ex: any) { setErr(ex?.message ?? 'Errore in importazione.'); }
    finally { setBusy(''); }
  }

  return (
    <div>
      <h2 className="bo-h">Import formazione (gestionale)</h2>
      <p className="bo-sub">Export <i>Ricerca Visite/Formazioni</i> del gestionale: una riga per
        attestato, con persona, corso, data e ore. Le righe di tipo <i>Visita</i> vengono scartate
        (non sono formazione). I nomi dei corsi si risolvono con il dizionario <b>Alias corsi</b>.</p>

      {damappare > 0 && (
        <div className="bo-card">
          <p className="bo-sub" style={{ margin: 0, color: 'var(--no)' }}>
            Ci sono <b>{damappare} alias da mappare</b>: gli attestati di quei corsi non verranno
            importati. Conviene chiudere prima <i>Regole app → Alias corsi</i>.
          </p>
        </div>
      )}

      <div className="bo-card">
        <label className="bo-field">
          <span>Export formazioni del gestionale (.xlsx)</span>
          <input type="file" accept=".xlsx" disabled={busy !== ''}
            onChange={(e) => void leggi(e.target.files?.[0] ?? null)} />
        </label>
        {busy === 'lettura' && <p className="bo-sub">Lettura in corso…</p>}
        {busy === 'calcolo' && <p className="bo-sub">Riconciliazione…</p>}
        {unita.length > 0 && (
          <p className="bo-sub" style={{ margin: '8px 0 0' }}>
            {unita.length} unità nel file (azienda + sede)
            {visiteScartate > 0 && <> · {visiteScartate} righe di visita scartate</>}
          </p>
        )}
        {err && <p className="bo-sub" style={{ color: 'var(--no)', marginTop: 10 }}>{err}</p>}
        {msg && <p className="bo-sub" style={{ color: 'var(--ok)', marginTop: 10 }}>{msg}</p>}
      </div>

      {unita.map((u) => {
        const e = esiti[u.chiave];
        const cid = scelta[u.chiave] ?? '';
        const orfane = e ? e.nuove.filter((v) => !v.persona_id).length : 0;
        const altre = cid ? altreSulCliente(cid, u) : [];
        return (
          <div key={u.chiave} className="bo-card">
            <div className="bo-meta" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <b style={{ flex: 1 }}>{u.societa} · {u.sede}</b>
              <span className="bo-pill archiviato">P.IVA {u.partita_iva || '—'}</span>
              <span className="bo-pill usato">{u.persone} persone · {u.righe.length} righe</span>
            </div>
            <p className="bo-sub" style={{ margin: '0 0 10px' }}>
              {u.indirizzo}{u.cap && ` · ${u.cap}`} {u.citta}{u.provincia && ` (${u.provincia})`}
            </p>

            <label className="bo-field" style={{ maxWidth: 460 }}>
              <span>Cliente in app su cui importare</span>
              {/* autoComplete off: al refresh della pagina Chrome ripristina da
                  se' il valore dei <select> per posizione nel DOM, e qui vuol
                  dire riproporre l'abbinamento della card ACCANTO. E' una
                  scelta che non ha fatto nessuno e che nessuno rilegge. */}
              <select value={cid} disabled={busy !== ''} autoComplete="off"
                onChange={(ev) => setScelta((s) => ({ ...s, [u.chiave]: ev.target.value }))}>
                <option value="">— scegli il cliente —</option>
                {clienti.map((c) => (
                  <option key={c.id} value={c.id}>{etichettaCliente(c)}</option>
                ))}
              </select>
            </label>

            {!cid && (
              <>
                <p className="bo-sub" style={{ color: 'var(--no)', marginBottom: 4 }}>
                  Nessun cliente abbinato: questa unità non verrà importata. Se il cliente non esiste,
                  crealo in <i>Anagrafiche</i> con i dati qui sopra — l’import non lo crea da sé perché
                  mancherebbero ATECO, livello di rischio e livelli di emergenza, che guidano il motore.
                </p>
                {/* Il caso che si incontra davvero: i clienti ci sono gia' tutti
                    e due, ma condividono la sede legale, quindi in tendina sono
                    due voci uguali e l'app non ha di che sceglierne una. Il dato
                    che li separa esiste ed e' la sede operativa: va compilata,
                    non indovinata. */}
                {clienti.filter((c) => (c.partita_iva ?? '').replace(/\s/g, '')
                  === (u.partita_iva || '').replace(/\s/g, '') && u.partita_iva).length > 1 && (
                  <p className="bo-sub" style={{ color: 'var(--no)', marginTop: 0 }}>
                    Con questa P.IVA ci sono <b>più clienti</b> e l’abbinamento si decide sul luogo:
                    apri in <i>Anagrafiche</i> quello di questo stabilimento e dagli la{' '}
                    <b>sede operativa</b> ({u.citta || u.sede}{u.cap && ` · ${u.cap}`}). Finché i clienti
                    hanno solo la sede legale — che per l’azienda è una sola — restano indistinguibili
                    qui e in tendina.
                  </p>
                )}
              </>
            )}

            {altre.length > 0 && (
              <p className="bo-sub" style={{ color: 'var(--no)' }}>
                <b>Questo cliente è già abbinato a {altre.map((x) => x.sede || '(senza sede)').join(', ')}.</b>{' '}
                Due sedi sullo stesso cliente finiscono in un unico organigramma: le squadre di
                emergenza si designano per luogo di lavoro, e fondendole l’app conterebbe una squadra
                sola per due stabilimenti, senza accorgersi se una sede resta scoperta. Sono bloccate
                entrambe le unità perché l’app non sa quale delle due sia quella giusta: rimetti su{' '}
                <i>— scegli il cliente —</i> quella da correggere, crea il cliente mancante in{' '}
                <i>Anagrafiche</i> e abbinalo qui.
              </p>
            )}

            {e && cid && (
              <>
                <div className="bo-meta" style={{ gap: 8, margin: '10px 0' }}>
                  <span className="bo-pill attivo">{e.nuove.length} da importare</span>
                  {e.gia_presenti > 0 && <span className="bo-pill usato">{e.gia_presenti} già importati</span>}
                  {e.ignorate > 0 && <span className="bo-pill archiviato">{e.ignorate} fuori perimetro</span>}
                  {orfane > 0 && <span className="bo-pill warn">{orfane} senza persona</span>}
                </div>

                {(e.senza_alias.length > 0 || e.senza_codice.length > 0) && (
                  <div style={{ marginBottom: 10 }}>
                    {e.senza_alias.length > 0 && (
                      <p className="bo-sub" style={{ color: 'var(--no)', margin: 0 }}>
                        {e.senza_alias.length} corsi non nel dizionario (righe lasciate indietro):
                        {' '}{e.senza_alias.slice(0, 4).join(' · ')}
                        {e.senza_alias.length > 4 && ' …'}
                      </p>
                    )}
                    {e.senza_codice.length > 0 && (
                      <p className="bo-sub" style={{ color: 'var(--no)', margin: 0 }}>
                        {e.senza_codice.length} corsi nel dizionario ma non ancora mappati:
                        {' '}{e.senza_codice.slice(0, 4).join(' · ')}
                        {e.senza_codice.length > 4 && ' …'}
                      </p>
                    )}
                  </div>
                )}

                {/* Niente proposta di creare persone su una card bloccata: le
                    nascerebbe sul cliente sbagliato, e offrirlo qui si legge
                    come se l'abbinamento fosse approvato. Prima si sistema il
                    cliente, poi si guarda chi manca. */}
                {e.personeMancanti.length > 0 && altre.length === 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <label className="bo-meta" style={{ gap: 6 }}>
                      <input type="checkbox" checked={!!creaPersone[u.chiave]} disabled={busy !== ''}
                        onChange={(ev) => setCreaPersone((c) => ({ ...c, [u.chiave]: ev.target.checked }))} />
                      <b>Creare le {e.personeMancanti.length} persone non trovate</b>
                    </label>
                    <p className="bo-sub" style={{ margin: '4px 0' }}>
                      Senza la spunta i loro attestati restano fuori. Le persone nascono con cognome,
                      nome, codice fiscale, mansione e data di assunzione dal file; il livello di
                      rischio resta da impostare.
                    </p>
                    <div style={{ maxHeight: 160, overflow: 'auto' }}>
                      {e.personeMancanti.map((p) => (
                        <div key={p.cf} className="bo-meta"
                          style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '4px 0' }}>
                          <span style={{ flex: 1 }}>{p.cognome} {p.nome}</span>
                          <span className="bo-pill archiviato">{p.cf}</span>
                          <span>{p.righe} attestati</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {e.oreInsufficienti.length > 0 && (
                  <details style={{ marginBottom: 10 }}>
                    <summary className="bo-sub" style={{ cursor: 'pointer', color: 'var(--warn, #b7791f)' }}>
                      {e.oreInsufficienti.length} attestati con ore inferiori a quelle dovute — da guardare
                    </summary>
                    <div style={{ maxHeight: 180, overflow: 'auto', marginTop: 6 }}>
                      {e.oreInsufficienti.map((v) => (
                        <div key={v.import_key} className="bo-meta"
                          style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '4px 0' }}>
                          <span style={{ flex: 1 }}>{v.riga.cognome} {v.riga.nome} · {v.riga.corso}</span>
                          <span>{dataIT(v.riga.data)}</span>
                          <span className="bo-pill warn">{v.riga.ore}h su {v.ore_dovute}h</span>
                        </div>
                      ))}
                    </div>
                    <p className="bo-sub" style={{ margin: '4px 0 0' }}>
                      Non blocca l’import: le pregresse hanno legittimamente monte ore diverso, e la
                      formazione erogata a spezzoni si somma (motore). È una segnalazione da leggere.
                    </p>
                  </details>
                )}

                {/* Bloccato e non solo segnalato: l'esito di un doppio abbinamento
                    non si vede sfogliando l'anteprima, si vede mesi dopo in una
                    squadra di emergenza che risulta coperta e non lo e'. */}
                <button className="bo-btn"
                  disabled={busy !== '' || e.nuove.length === 0 || altre.length > 0}
                  onClick={() => void applica(u)}>
                  {busy === 'applica' ? 'Importo…' : `Importa (${e.nuove.length})`}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
