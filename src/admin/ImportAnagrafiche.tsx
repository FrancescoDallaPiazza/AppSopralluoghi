// Back-office - "Import anagrafiche": ricostruisce in blocco i CLIENTI e le
// RISORSE UMANE da un Excel/CSV.
//
// Un file per volta, e il tipo lo riconosce l'app dalle intestazioni invece di
// farlo dichiarare: chi carica il file sbagliato lo scopre subito, non dopo aver
// scritto. Quello che il file NON dice non viene inventato - per i clienti resta
// scritto in chiaro, riga per riga, cosa manca ancora (livello antincendio,
// gruppo di primo soccorso, numero lavoratori): il cliente nato da un import e'
// incompleto, e la scheda deve dirlo.
//
// L'anteprima non e' un abbellimento. Come per l'import formazione, qui si
// scrive la base da cui il motore deduce requisiti e scadenze: un abbinamento
// sbagliato mette le persone sull'organigramma di un'altra azienda, e nessuno
// se ne accorge piu'. Percio' nulla va su disco prima che si veda, per ogni
// gruppo, su QUALE cliente sta per scrivere.

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  leggiFoglio, pianificaClienti, applicaClienti,
  pianificaPersone, applicaPersone,
  caricaClientiPerImport, caricaClientiScelta, etichettaCliente,
  type Foglio, type PianoClienti, type PianoPersone, type ClienteScelta,
} from '../lib/admin/anagraficheImport';
import { ETICHETTA_RISCHIO } from '../formazione/ateco';
import type { Cliente } from '../lib/types';

const dataIT = (iso: string | null): string =>
  iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';

export default function ImportAnagrafiche() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [scelta, setScelta] = useState<ClienteScelta[]>([]);

  const [foglio, setFoglio] = useState<Foglio | null>(null);
  const [pianoC, setPianoC] = useState<PianoClienti | null>(null);
  const [pianoP, setPianoP] = useState<PianoPersone | null>(null);
  // Abbinamenti forzati a mano, per chiave di gruppo. '' = gruppo escluso.
  const [abbinamenti, setAbbinamenti] = useState<Record<string, string | null>>({});
  const [aperto, setAperto] = useState<Record<string, boolean>>({});

  const [busy, setBusy] = useState<'' | 'avvio' | 'lettura' | 'applica'>('avvio');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function ricaricaClienti() {
    const [full, sc] = await Promise.all([caricaClientiPerImport(), caricaClientiScelta()]);
    setClienti(full); setScelta(sc);
    return { full, sc };
  }

  useEffect(() => {
    void (async () => {
      try { await ricaricaClienti(); }
      catch (e: any) { setErr(e?.message ?? 'Errore in caricamento.'); }
      finally { setBusy(''); }
    })();
  }, []);

  function azzera() {
    setFoglio(null); setPianoC(null); setPianoP(null);
    setAbbinamenti({}); setAperto({});
  }

  async function leggi(file: File | null) {
    if (!file) return;
    setBusy('lettura'); setErr(null); setMsg(null); azzera();
    try {
      const f = await leggiFoglio(file);
      setFoglio(f);
      if (f.tipo === 'clienti') setPianoC(pianificaClienti(f, clienti));
      else if (f.tipo === 'persone') setPianoP(await pianificaPersone(f, scelta));
    } catch (e: any) { setErr(e?.message ?? 'File non leggibile.'); }
    finally { setBusy(''); }
  }

  // Ricalcola il piano persone quando cambia un abbinamento: i conteggi
  // "nuove / aggiornate" dipendono da CHI c'e' gia' su quel cliente, quindi non
  // sono spostabili da una card all'altra senza rifare il conto.
  async function cambiaAbbinamento(chiave: string, clienteId: string) {
    if (!foglio) return;
    const agg = { ...abbinamenti, [chiave]: clienteId || null };
    setAbbinamenti(agg);
    setBusy('lettura'); setErr(null);
    try { setPianoP(await pianificaPersone(foglio, scelta, agg)); }
    catch (e: any) { setErr(e?.message ?? 'Errore nel ricalcolo.'); }
    finally { setBusy(''); }
  }

  function spuntaCliente(riga: number, scelto: boolean) {
    setPianoC((p) => p && ({
      ...p, voci: p.voci.map((v) => (v.riga === riga ? { ...v, scelto } : v)),
    }));
  }

  async function applica() {
    setBusy('applica'); setErr(null); setMsg(null);
    try {
      if (pianoC) {
        const n = await applicaClienti(pianoC.voci);
        const dati = await ricaricaClienti();
        setMsg(`${n} clienti scritti. Restano da completare a mano i livelli di emergenza dove segnalati.`);
        // Il piano si ricalcola sui clienti appena scritti: rilanciarlo non
        // deve proporre di riscrivere quello che c'e' gia'.
        if (foglio) setPianoC(pianificaClienti(foglio, dati.full));
      } else if (pianoP && foglio) {
        const n = await applicaPersone(pianoP.gruppi);
        setMsg(`${n} persone scritte.`);
        setPianoP(await pianificaPersone(foglio, scelta, abbinamenti));
      }
    } catch (e: any) { setErr(e?.message ?? 'Import non riuscito.'); }
    finally { setBusy(''); }
  }

  const daScrivereC = useMemo(() => pianoC?.voci.filter((v) => v.scelto).length ?? 0, [pianoC]);
  const daScrivereP = useMemo(
    () => pianoP?.gruppi.reduce((s, g) => s + (g.cliente_id ? g.voci.length : 0), 0) ?? 0, [pianoP]);
  const gruppiSenzaCliente = useMemo(
    () => pianoP?.gruppi.filter((g) => !g.cliente_id).length ?? 0, [pianoP]);

  return (
    <div>
      <h2 className="bo-h">Import anagrafiche</h2>
      <p className="bo-sub">
        Un file per volta: un elenco di <b>clienti</b> oppure un elenco di <b>persone</b>.
        Il tipo lo riconosce l'app dalle intestazioni. Le colonne si cercano per nome, in
        qualsiasi ordine, e i sinonimi più comuni sono accettati (<i>P.IVA</i>, <i>Ragione
        sociale</i>, <i>Denominazione</i>…). L'anteprima non scrive niente.
      </p>

      <div className="bo-card">
        <label className="bo-field">
          <span>File anagrafiche (.xlsx / .csv)</span>
          <input type="file" accept=".xlsx,.xls,.csv" disabled={busy !== ''}
            onChange={(e) => void leggi(e.target.files?.[0] ?? null)} />
        </label>
        <div className="bo-bar" style={{ marginTop: 10 }}>
          <button className="bo-btn ghost sm" disabled={busy !== ''}
            onClick={modelloClienti}>Scarica modello clienti</button>
          <button className="bo-btn ghost sm" disabled={busy !== ''}
            onClick={modelloPersone}>Scarica modello persone</button>
        </div>

        {busy === 'avvio' && <p className="bo-sub">Carico i clienti…</p>}
        {busy === 'lettura' && <p className="bo-sub">Lettura in corso…</p>}
        {err && <div className="bo-err" style={{ marginTop: 10 }}>{err}</div>}
        {msg && <p className="bo-sub" style={{ color: 'var(--ok)', marginTop: 10 }}>{msg}</p>}

        {foglio && (
          <div className="bo-note" style={{ marginTop: 12, marginBottom: 0 }}>
            <div><b>{foglio.nomeFile}</b> · intestazioni alla riga {foglio.rigaHeader} ·{' '}
              {foglio.righe.length} righe di dati</div>
            <div style={{ marginTop: 4 }}>
              Letto come <b>{foglio.tipo === 'clienti' ? 'elenco clienti'
                : foglio.tipo === 'persone' ? 'elenco persone' : 'non riconosciuto'}</b>
              {' '}({foglio.motivoTipo}).
            </div>
            {foglio.ignorate.length > 0 && (
              <div style={{ marginTop: 4 }}>
                Colonne presenti ma non usate: {foglio.ignorate.join(', ')}.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================ CLIENTI ============================ */}
      {pianoC && (
        <>
          <div className="bo-card">
            <div className="bo-row">
              <div className="grow">
                <div className="bo-title">Clienti nel file</div>
                <div className="bo-meta">
                  <span><b>{pianoC.nuovi}</b> nuovi</span>
                  <span><b>{pianoC.aggiornati}</b> da completare</span>
                  <span><b>{pianoC.invariati}</b> già a posto</span>
                  {pianoC.scartate.length > 0 && <span><b>{pianoC.scartate.length}</b> righe scartate</span>}
                </div>
              </div>
              <button className="bo-btn" disabled={busy !== '' || daScrivereC === 0}
                onClick={() => void applica()}>
                {busy === 'applica' ? 'Scrivo…' : `Applica (${daScrivereC})`}
              </button>
            </div>
            {pianoC.scartate.length > 0 && (
              <p className="bo-sub" style={{ marginBottom: 0 }}>
                Scartate: {pianoC.scartate.map((s) => `riga ${s.riga} (${s.motivo})`).join(', ')}.
              </p>
            )}
            <p className="bo-sub" style={{ marginBottom: 0 }}>
              Su un cliente che esiste già si riempiono <b>solo i campi vuoti</b>: quello che hai
              corretto a mano non viene sovrascritto.
            </p>
          </div>

          {pianoC.voci.map((v) => (
            <div key={v.riga} className="bo-card" style={{ opacity: v.scelto ? 1 : .55 }}>
              <div className="bo-row">
                <input type="checkbox" checked={v.scelto} disabled={busy !== ''}
                  onChange={(e) => spuntaCliente(v.riga, e.target.checked)} />
                <div className="grow">
                  <div className="bo-title">{v.cliente.ragione_sociale}</div>
                  <div className="bo-meta">
                    <span>riga {v.riga}</span>
                    {v.cliente.partita_iva && <span>P.IVA <b>{v.cliente.partita_iva}</b></span>}
                    {v.cliente.localita && <span>{v.cliente.localita}{v.cliente.provincia && ` (${v.cliente.provincia})`}</span>}
                    {v.cliente.numero_lavoratori != null && <span><b>{v.cliente.numero_lavoratori}</b> lavoratori</span>}
                  </div>
                </div>
                <span className={`bo-pill ${v.nuovo ? 'attivo' : v.campiTocc.length ? 'usato' : 'archiviato'}`}>
                  {v.nuovo ? 'nuovo' : v.campiTocc.length ? 'da completare' : 'già a posto'}
                </span>
              </div>

              {v.ateco && (
                <p className="bo-sub" style={{ margin: '8px 0 0' }}>
                  ATECO <b>{v.ateco.divisione}</b> · {v.ateco.descrizione} → rischio{' '}
                  <b>{ETICHETTA_RISCHIO[v.ateco.livello]}</b> (Allegato IV ASR 17/04/2025).
                </p>
              )}
              {v.atecoNonRisolto && (
                <p className="bo-sub" style={{ margin: '8px 0 0', color: 'var(--no)' }}>
                  ATECO «{v.atecoNonRisolto}» non riconosciuto: né il codice né il livello di
                  rischio vengono scritti. Da scegliere in anagrafica.
                </p>
              )}
              {!v.nuovo && v.campiTocc.length > 0 && (
                <p className="bo-sub" style={{ margin: '6px 0 0' }}>
                  Campi che verranno riempiti: <b>{v.campiTocc.join(', ')}</b>.
                </p>
              )}
              {v.mancanti.length > 0 && (
                <p className="bo-sub" style={{ margin: '6px 0 0', color: 'var(--hi-dark)' }}>
                  Resta da compilare a mano: <b>{v.mancanti.join(', ')}</b>. Il file non lo dice e
                  l'app non lo deduce.
                </p>
              )}
              {v.nota && (
                <p className="bo-sub" style={{ margin: '6px 0 0' }}>⚠ {v.nota}</p>
              )}
            </div>
          ))}
        </>
      )}

      {/* ============================ PERSONE ============================ */}
      {pianoP && (
        <>
          <div className="bo-card">
            <div className="bo-row">
              <div className="grow">
                <div className="bo-title">Persone nel file</div>
                <div className="bo-meta">
                  <span><b>{pianoP.gruppi.length}</b> gruppi (azienda + sede)</span>
                  <span><b>{daScrivereP}</b> persone da scrivere</span>
                  {gruppiSenzaCliente > 0 && (
                    <span style={{ color: 'var(--no)' }}><b>{gruppiSenzaCliente}</b> gruppi senza cliente</span>
                  )}
                  {pianoP.scartate.length > 0 && <span><b>{pianoP.scartate.length}</b> righe scartate</span>}
                </div>
              </div>
              <button className="bo-btn" disabled={busy !== '' || daScrivereP === 0}
                onClick={() => void applica()}>
                {busy === 'applica' ? 'Scrivo…' : `Applica (${daScrivereP})`}
              </button>
            </div>
            {gruppiSenzaCliente > 0 && (
              <p className="bo-sub" style={{ marginBottom: 0 }}>
                I gruppi senza cliente <b>vengono saltati</b>: non si crea un'azienda per contenerle,
                perché nascerebbe senza ATECO né livelli di emergenza. Crea prima il cliente
                (anche con l'import clienti qui sopra), poi ricarica il file.
              </p>
            )}
          </div>

          {pianoP.gruppi.map((g) => (
            <div key={g.chiave} className="bo-card">
              <div className="bo-row">
                <div className="grow">
                  <div className="bo-title">{g.etichetta}</div>
                  <div className="bo-meta">
                    <span>P.IVA <b>{g.partita_iva ?? '—'}</b></span>
                    <span><b>{g.voci.length}</b> persone nel file</span>
                    {g.cliente_id && <span><b>{g.nuove}</b> nuove · <b>{g.aggiornate}</b> aggiornate</span>}
                  </div>
                </div>
                {g.voci.length > 0 && (
                  <button className="bo-btn ghost sm"
                    onClick={() => setAperto((a) => ({ ...a, [g.chiave]: !a[g.chiave] }))}>
                    {aperto[g.chiave] ? 'Nascondi' : 'Vedi le persone'}
                  </button>
                )}
              </div>

              <label className="bo-field" style={{ maxWidth: 460, marginTop: 10 }}>
                <span>Cliente in app su cui scrivere</span>
                {/* autoComplete off: al refresh Chrome ripristina i <select> per
                    posizione nel DOM, cioè rimetterebbe qui l'abbinamento della
                    card accanto. Stessa cura di ImportFormazione. */}
                <select value={g.cliente_id ?? ''} disabled={busy !== ''} autoComplete="off"
                  onChange={(e) => void cambiaAbbinamento(g.chiave, e.target.value)}>
                  <option value="">— non importare questo gruppo —</option>
                  {scelta.map((c) => (
                    <option key={c.id} value={c.id}>{etichettaCliente(c)}</option>
                  ))}
                </select>
              </label>
              <p className="bo-sub" style={{ margin: '4px 0 0', color: g.cliente_id ? undefined : 'var(--no)' }}>
                {g.motivoAbbinamento}
                {g.candidati.length > 1 && ` · candidati: ${g.candidati.map((c) => `${c.etichetta} (${c.motivo})`).join(' · ')}`}
              </p>
              {g.collisione && (
                <div className="bo-err" style={{ margin: '8px 0 0' }}>⚠ {g.collisione}</div>
              )}

              {g.cliente_id && (g.cfNonValidi > 0 || g.senzaCf > 0) && (
                <p className="bo-sub" style={{ margin: '6px 0 0' }}>
                  {g.cfNonValidi > 0 && <>{g.cfNonValidi} con <b>codice fiscale non valido</b> (importate comunque, da correggere). </>}
                  {g.senzaCf > 0 && <>{g.senzaCf} <b>senza codice fiscale</b>: nascono sempre come persone nuove, perché non c'è modo di riconoscerle.</>}
                </p>
              )}

              {aperto[g.chiave] && (
                <ul className="bo-sub" style={{ margin: '10px 0 0', paddingLeft: 18 }}>
                  {g.voci.map((v) => (
                    <li key={v.riga}>
                      <b>{v.persona.cognome} {v.persona.nome}</b>
                      {v.persona.codice_fiscale && ` · ${v.persona.codice_fiscale}`}
                      {v.cfNonValido && <span style={{ color: 'var(--no)' }}> (CF non valido)</span>}
                      {v.persona.mansione && ` · ${v.persona.mansione}`}
                      {v.persona.reparto && ` · ${v.persona.reparto}`}
                      {v.persona.data_assunzione && ` · assunto ${dataIT(v.persona.data_assunzione)}`}
                      {v.persona.data_cessazione && (
                        <span style={{ color: 'var(--faint)' }}> · cessato {dataIT(v.persona.data_cessazione)}</span>
                      )}
                      {' '}<span className={`bo-pill ${v.nuova ? 'attivo' : 'usato'}`}>{v.nuova ? 'nuova' : 'aggiornata'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}

      {foglio && foglio.tipo === 'incerto' && (
        <div className="bo-card">
          <div className="bo-err" style={{ marginBottom: 0 }}>
            Non riconosco il contenuto del file. Per i <b>clienti</b> serve almeno una colonna
            <i> Ragione sociale</i> (o <i>Denominazione</i>); per le <b>persone</b> almeno
            <i> Cognome</i>, <i>Mansione</i> o <i>Data assunzione</i>. Scarica un modello qui sopra
            per vedere le intestazioni attese.
          </div>
        </div>
      )}
    </div>
  );
}

// ============================ modelli ============================

// I modelli non sono documentazione: sono il contratto del formato. Chi li
// scarica e li ricompila non puo' sbagliare le intestazioni.
function modelloClienti() {
  const esempio = [
    {
      'Ragione sociale': 'ROSSI COSTRUZIONI SRL', 'Partita IVA': '01234567890',
      'Codice fiscale': '01234567890', ATECO: '43', Indirizzo: 'Via Roma 1',
      CAP: '37100', 'Località': 'Verona', Provincia: 'VR',
      Email: 'info@rossicostruzioni.it', Telefono: '045 1234567',
      Referente: 'Mario Rossi', 'Numero lavoratori': 24,
    },
  ];
  const header = ['Ragione sociale', 'Partita IVA', 'Codice fiscale', 'ATECO', 'Indirizzo',
    'CAP', 'Località', 'Provincia', 'Email', 'Telefono', 'Referente', 'Numero lavoratori'];
  scarica(esempio, header, 'Clienti', 'modello_clienti.xlsx',
    [28, 14, 18, 8, 24, 8, 16, 10, 26, 16, 18, 16]);
}

function modelloPersone() {
  const esempio = [
    {
      'Partita IVA': '01234567890', 'Ragione sociale': 'ROSSI COSTRUZIONI SRL', Sede: 'Verona',
      Cognome: 'ROSSI', Nome: 'MARIO', 'Codice fiscale': 'RSSMRA80A01H501U',
      Mansione: 'Operaio', Reparto: 'Produzione',
      'Data assunzione': '01/03/2020', 'Data cessazione': '',
    },
    {
      'Partita IVA': '01234567890', 'Ragione sociale': 'ROSSI COSTRUZIONI SRL', Sede: 'Trevenzuolo',
      Cognome: 'BIANCHI', Nome: 'LUCIA', 'Codice fiscale': 'BNCLCU85M41F205X',
      Mansione: 'Impiegata', Reparto: 'Uffici',
      'Data assunzione': '15/09/2019', 'Data cessazione': '',
    },
  ];
  const header = ['Partita IVA', 'Ragione sociale', 'Sede', 'Cognome', 'Nome', 'Codice fiscale',
    'Mansione', 'Reparto', 'Data assunzione', 'Data cessazione'];
  scarica(esempio, header, 'Personale', 'modello_persone.xlsx',
    [14, 28, 16, 16, 14, 20, 18, 16, 16, 16]);
}

function scarica(
  righe: Record<string, unknown>[], header: string[], foglio: string, nome: string, larghezze: number[],
) {
  const ws = XLSX.utils.json_to_sheet(righe, { header });
  ws['!cols'] = larghezze.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, foglio);
  XLSX.writeFile(wb, nome);
}
