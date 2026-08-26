// Scheda cliente - sezione "Risorse Umane" (Anagrafiche.tsx).
//
// Anagrafica completa del personale del cliente: e' l'insieme SUPERIORE
// dell'organigramma sicurezza. Non tutte le persone ricoprono una figura
// (RSPP, preposto, addetto...): qui si censiscono tutti i lavoratori; nel tab
// Organigramma si assegnano le nomine solo a chi le ricopre. Le due viste
// leggono e scrivono la STESSA tabella `persona`, quindi non esistono doppioni.
//
// Import massivo: si carica un Excel/CSV (Cognome, Nome, Codice fiscale,
// Mansione, Reparto, Data assunzione), si vede l'anteprima (nuove / aggiornate
// per CF / scartate) e si applica. Il match con le persone gia' presenti e' sul
// codice fiscale; le righe senza nome vengono scartate e mostrate.
// Qui si importa il personale di QUESTO cliente. Per rifarne piu' d'uno con un
// file solo c'e' Back-office -> Anagrafiche -> Import anagrafiche, che legge lo
// stesso formato piu' le colonne che dicono a quale cliente va ogni riga.

import { useEffect, useId, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  caricaPersone, caricaRuoliPerPersona, salvaPersona, eliminaPersona,
  mansioniUsate, repartiUsati, attivoDopoCessazione, oggiISO, type Persona,
} from '../lib/admin/formazione';
import {
  normHeader, leggiCampiPersona, fondiPersona, personaVuota,
} from '../lib/admin/anagraficheImport';
import { newId } from '../lib/types';
import { valido as cfValido, pulisci as cfPulisci } from './codiceFiscale';
import { LibrettoPersona } from './Libretto';

type RischioPersona = Persona['livello_rischio'];

// ============================ componente ============================

export function RisorseUmane({ clienteId, clienteNome, onCambia, onConteggio }: {
  clienteId: string;
  clienteNome?: string;
  onCambia?: () => void;
  onConteggio?: (n: number) => void;
}) {
  const [persone, setPersone] = useState<Persona[]>([]);
  const [fase, setFase] = useState<'carico' | 'pronto' | 'errore'>('carico');
  // Chi si vede: attivi (default), soli cessati, o tutti. Era una spunta "Mostra
  // anche i disattivati" IN FONDO alla tabella - cioe' il comando che decide
  // quali righe compaiono stava sotto le righe che governa, staccato dagli altri
  // due filtri che stanno in testa. Chi non scorreva fino in fondo non sapeva di
  // star guardando un elenco parziale. Ed e' un terzo stato utile di suo: "chi
  // se n'e' andato" e' una domanda che si fa (consegne, attestati da archiviare),
  // e con la spunta si poteva solo aggiungerli agli attivi, mai isolarli.
  const [stato, setStato] = useState<'attivi' | 'cessati' | 'tutti'>('attivi');
  const [agg, setAgg] = useState(false);
  const [importa, setImporta] = useState(false);
  const [q, setQ] = useState('');
  // Ruoli dell'organigramma per persona: etichetta in riga e filtro. Caricati a
  // parte e in modo non bloccante - se la lettura fallisce, l'anagrafica si vede
  // lo stesso, senza pill.
  const [ruoli, setRuoli] = useState<Map<string, string[]>>(new Map());
  const [ruolo, setRuolo] = useState('');   // '' = tutti | '-' = senza ruolo | nome figura
  // Libretto formativo aperto (id persona). Uno per volta: e' un dossier da
  // leggere, non una colonna della tabella.
  const [libretto, setLibretto] = useState<string | null>(null);
  // Il libretto si monta DOPO la tabella: con un'anagrafica lunga (decine di
  // righe dopo un import) esce sotto il fondo pagina e il clic sembra non aver
  // fatto niente. Due rAF perche' il primo frame monta il "Carico..." e la sua
  // altezza definitiva arriva dopo.
  const librettoRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!libretto) return;
    const t = requestAnimationFrame(() => requestAnimationFrame(() =>
      librettoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })));
    return () => cancelAnimationFrame(t);
  }, [libretto]);

  function ricarica() {
    setFase('carico');
    caricaPersone(clienteId)
      .then((p) => {
        setPersone(p);
        setFase('pronto');
        onConteggio?.(p.filter((x) => x.attivo).length);
        caricaRuoliPerPersona(p.map((x) => x.id))
          .then(setRuoli)
          .catch(() => setRuoli(new Map()));
      })
      .catch(() => setFase('errore'));
  }
  useEffect(ricarica, [clienteId]);

  const cambiato = () => { ricarica(); onCambia?.(); };

  // Mansioni e reparti gia' in uso, proposti a chi inserisce la persona
  // successiva. Si leggono da TUTTE le persone e non dalle sole visibili: il
  // filtro in alto e' di chi sta guardando l'elenco adesso, mentre il
  // vocabolario aziendale comprende anche i cessati e chi la ricerca esclude.
  const mansioni = mansioniUsate(persone);
  const reparti = repartiUsati(persone);
  // Un solo <datalist> per campo e per tutta la tabella: le righe in modifica
  // possono essere piu' d'una insieme, e un id duplicato nel DOM farebbe
  // agganciare tutte le input alla prima lista incontrata. `useId` li tiene
  // distinti anche se un giorno due schede cliente convivessero nella stessa
  // pagina.
  const listaMansioni = useId();
  const listaReparti = useId();

  const ago = q.trim().toLowerCase();
  const ruoliDi = (id: string): string[] => ruoli.get(id) ?? [];
  // Tendina dei ruoli: solo quelli davvero assegnati in questo cliente, non tutto
  // il catalogo delle figure - un filtro che offre voci senza nessuno dietro fa
  // sembrare vuota l'anagrafica.
  const ruoliPresenti = [...new Set([...ruoli.values()].flat())].sort((a, b) => a.localeCompare(b, 'it'));
  const cessati = persone.filter((p) => !p.attivo).length;
  const visibili = persone.filter((p) => {
    if (stato === 'attivi' && !p.attivo) return false;
    if (stato === 'cessati' && p.attivo) return false;
    const suoi = ruoliDi(p.id);
    if (ruolo === '-' && suoi.length > 0) return false;
    if (ruolo && ruolo !== '-' && !suoi.includes(ruolo)) return false;
    if (!ago) return true;
    return [p.cognome, p.nome, p.codice_fiscale, p.mansione, p.reparto, ...suoi]
      .some((v) => (v ?? '').toLowerCase().includes(ago));
  });

  return (
    <>
      <style>{`
        .ru-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
        .ru-tbl thead th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft,#5c5f66);font-weight:800;padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08)}
        .ru-tr td{padding:8px;border-bottom:1px solid rgba(0,0,0,.06);vertical-align:middle}
        .ru-tr:last-child td{border-bottom:none}
        .ru-tr.dim{opacity:.5}
        .ru-cog{width:22%;font-weight:700}
        .ru-nom{width:15%;font-weight:600}
        .ru-cf{width:21%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#3a3d43}
        .ru-cf.bad{color:var(--no,#d24028)}
        .ru-man{width:12%}
        .ru-ruoli{width:24%}
        .ru-ruolo{display:inline-block;font-size:11px;font-weight:700;line-height:1.4;padding:1px 7px;margin:1px 4px 1px 0;border-radius:999px;background:#eef5ef;border:1px solid #cfe6d8;color:#1f5b38}
        .ru-noruolo{color:var(--ink-soft,#5c5f66)}
        .ru-act{width:6%;text-align:right;white-space:nowrap}
      `}</style>
      <div className="bo-row" style={{ margin: '0 0 10px' }}>
        <p className="bo-sub grow" style={{ margin: 0 }}>
          Tutto il personale del cliente. Le nomine (RSPP, preposto, addetti…) si assegnano
          nel tab Organigramma alle sole persone che le ricoprono.
        </p>
        {!agg && !importa && (
          <>
            <button className="bo-btn ghost sm" onClick={() => setImporta(true)}>Importa da Excel</button>
            <button className="bo-btn sm" onClick={() => setAgg(true)}>+ Aggiungi</button>
          </>
        )}
      </div>

      {importa && (
        <PannelloImport clienteId={clienteId} esistenti={persone}
          onFatto={() => { setImporta(false); cambiato(); }}
          onAnnulla={() => setImporta(false)} />
      )}

      {fase === 'carico' && <div className="bo-empty">Carico…</div>}
      {fase === 'errore' && <div className="bo-err">Errore nel caricamento del personale.</div>}

      {fase === 'pronto' && persone.length > 0 && (
        <div className="bo-row" style={{ margin: '0 0 10px', alignItems: 'center' }}>
          <input type="text" placeholder="Cerca per cognome, nome, CF, mansione, reparto o ruolo…"
            value={q} onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 380, margin: 0 }} />
          {ruoliPresenti.length > 0 && (
            <select value={ruolo} onChange={(e) => setRuolo(e.target.value)}
              style={{ maxWidth: 260, margin: 0 }}>
              <option value="">Tutti i ruoli</option>
              {ruoliPresenti.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="-">Senza ruolo assegnato</option>
            </select>
          )}
          {/* Solo se qualcuno e' cessato davvero: un filtro che offre "Cessati
              (0)" fa cercare a vuoto una categoria che in azienda non esiste.
              Stesso criterio della tendina dei ruoli qui accanto. */}
          {cessati > 0 && (
            <select value={stato} onChange={(e) => setStato(e.target.value as typeof stato)}
              style={{ maxWidth: 220, margin: 0 }}>
              <option value="attivi">In forza ({persone.length - cessati})</option>
              <option value="cessati">Solo cessati ({cessati})</option>
              <option value="tutti">Tutti ({persone.length})</option>
            </select>
          )}
        </div>
      )}

      {/* Vuoto per filtro e vuoto per davvero sono due cose diverse: proporre
          "Aggiungine una" a chi ha solo ristretto l'elenco fa credere che
          l'anagrafica sia da rifare. */}
      {fase === 'pronto' && visibili.length === 0 && !agg && (
        <div className="bo-empty">
          {persone.length === 0
            ? 'Nessuna persona. Aggiungine una o importa da Excel.'
            : 'Nessuna persona con i filtri attivi.'}
        </div>
      )}

      {(agg || visibili.length > 0) && (
        <table className="ru-tbl">
          <thead>
            <tr>
              <th>Cognome</th>
              <th>Nome</th>
              <th>CF</th>
              <th>Mansione</th>
              <th>Ruoli organigramma</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {agg && (
              <RigaPersona persona={personaVuota(clienteId)}
                listaMansioni={listaMansioni} listaReparti={listaReparti}
                onCambia={() => { setAgg(false); cambiato(); }}
                onAnnulla={() => setAgg(false)} />
            )}
            {visibili.map((p) => (
              <RigaPersona key={p.id} persona={p} onCambia={cambiato} ruoli={ruoliDi(p.id)}
                listaMansioni={listaMansioni} listaReparti={listaReparti}
                onLibretto={() => setLibretto((cur) => (cur === p.id ? null : p.id))} />
            ))}
          </tbody>
        </table>
      )}

      {/* Fuori dalla tabella: un <datalist> non rende nulla, ma dentro un <tbody>
          sarebbe markup non valido e il browser lo sposterebbe da se'. */}
      {mansioni.length > 0 && (
        <datalist id={listaMansioni}>
          {mansioni.map((m) => <option key={m} value={m} />)}
        </datalist>
      )}
      {reparti.length > 0 && (
        <datalist id={listaReparti}>
          {reparti.map((r) => <option key={r} value={r} />)}
        </datalist>
      )}

      {/* Fuori dalla tabella e non dentro una riga: e' un documento, e infilarlo
          in un <td> lo comprimerebbe nella colonna. La key sull'id lo rimonta
          quando si passa da una persona all'altra. */}
      {libretto && (
        <div ref={librettoRef}>
          <LibrettoPersona key={libretto} clienteId={clienteId} personaId={libretto}
            clienteNome={clienteNome ?? ''} onChiudi={() => setLibretto(null)} />
        </div>
      )}

      {/* La scelta di chi vedere e' salita in testa, accanto a ricerca e ruoli:
          qui in fondo restava sotto le righe che governa. */}
    </>
  );
}

// ============================ riga persona ============================

function RigaPersona({
  persona, onCambia, onAnnulla, onLibretto, ruoli = [], listaMansioni, listaReparti,
}: {
  persona: Persona; onCambia: () => void; onAnnulla?: () => void;
  onLibretto?: () => void; ruoli?: string[];
  // id dei <datalist> con le mansioni e i reparti gia' usati in azienda (sopra).
  listaMansioni?: string;
  listaReparti?: string;
}) {
  const nuova = !persona.id;
  const [modifica, setModifica] = useState(nuova);
  const [p, setP] = useState<Persona>(persona);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setP(persona); }, [persona]);
  const set = (patch: Partial<Persona>) => setP((x) => ({ ...x, ...patch }));

  async function salva() {
    if (!p.nome.trim()) { setMsg('Il nome è obbligatorio.'); return; }
    setBusy(true); setMsg(null);
    try {
      // E' la data di cessazione a decidere se la persona e' in forza: qui si
      // salva l'esito della regola, non il valore che `attivo` aveva prima.
      await salvaPersona({
        ...p, id: p.id || newId(),
        attivo: attivoDopoCessazione(p, nuova ? null : persona),
      });
      if (nuova) setP(personaVuota(persona.cliente_id));
      setModifica(false);
      onCambia();
    } catch (e: any) { setMsg(e?.message ?? 'Salvataggio non riuscito.'); }
    finally { setBusy(false); }
  }
  async function toggle() {
    setBusy(true); setMsg(null);
    // Scorciatoia dalla scheda: Disattiva mette la data a oggi se non c'e'
    // gia', Riattiva la toglie. La data resta correggibile a mano nel form
    // (retrodatare dimissioni gia' avvenute).
    //
    // Si parte da `p` e NON da `persona`: il bottone sta nella stessa scheda
    // dei campi, e leggere lo stato salvato buttava via le modifiche non ancora
    // confermate - a partire proprio dalla data appena digitata, che veniva
    // sostituita con oggi.
    const disattiva = persona.attivo;
    const data_cessazione = disattiva
      ? (p.data_cessazione ?? oggiISO())
      : null;
    try {
      const dopo = { ...p, id: p.id || persona.id, data_cessazione };
      await salvaPersona({ ...dopo, attivo: attivoDopoCessazione({ ...dopo, attivo: !persona.attivo }, persona) });
      onCambia();
    }
    catch (e: any) { setMsg(e?.message ?? 'Operazione non riuscita.'); }
    finally { setBusy(false); }
  }
  async function elimina() {
    if (!confirm('Eliminare questa persona? Verranno rimosse anche le sue nomine e formazioni.')) return;
    setBusy(true); setMsg(null);
    try { await eliminaPersona(persona.id); onCambia(); }
    catch (e: any) { setMsg(e?.message ?? 'Eliminazione non riuscita.'); setBusy(false); }
  }

  if (!modifica) {
    const cfBad = p.codice_fiscale != null && !cfValido(p.codice_fiscale);
    return (
      <tr className={'ru-tr' + (p.attivo ? '' : ' dim')}>
        {/* L'etichetta "cessato" sta sull'IDENTITA' della persona, non nella
            colonna Mansione dov'era prima: li' si leggeva come un attributo del
            lavoro svolto, e con l'elenco filtrato su "Tutti" la sola riga
            sbiadita non basta a dire perche'. */}
        <td className="ru-cog">
          {p.cognome ?? '—'}
          {!p.attivo && <span className="bo-pill archiviato" style={{ marginLeft: 6 }}>
            {p.data_cessazione ? `cessato ${p.data_cessazione.split('-').reverse().join('/')}` : 'cessato'}
          </span>}
          {/* Data di cessazione futura su una persona ANCORA IN FORZA: e' il
              caso muto. La riga non e' sbiadita e non porta il badge "cessato"
              (giustamente, la persona lavora), quindi l'anno digitato male
              resterebbe invisibile proprio a chi credeva di averla fatta
              uscire. Qui si vede senza aprire la scheda. */}
          {p.attivo && p.data_cessazione && p.data_cessazione > oggiISO() && (
            <span className="bo-pill warn" style={{ marginLeft: 6 }}
              title={'Data di cessazione ' + p.data_cessazione.split('-').reverse().join('/')
                + ': e’ nel futuro, quindi la persona risulta ancora in forza. Se la cessazione e’ gia’ avvenuta, correggi l’anno.'}>
              data da verificare
            </span>
          )}
        </td>
        <td className="ru-nom">{p.nome || '—'}</td>
        <td className={'ru-cf' + (cfBad ? ' bad' : '')}>
          {p.codice_fiscale ?? '—'}{cfBad ? ' · CF non valido' : ''}
        </td>
        <td className="ru-man">{p.mansione ?? '—'}</td>
        {/* Le nomine si assegnano nel tab Organigramma: qui sono in sola lettura,
            e il loro posto e' l'anagrafica perche' e' li' che si cerca una
            persona ("chi e' il preposto del reparto X?"). */}
        <td className="ru-ruoli">
          {ruoli.length === 0
            ? <span className="ru-noruolo">—</span>
            : ruoli.map((r) => <span key={r} className="ru-ruolo">{r}</span>)}
        </td>
        <td className="ru-act">
          {onLibretto && (
            <button className="bo-btn ghost sm" onClick={onLibretto} title="Ruoli, formazione svolta e scadenze di questa persona">Libretto</button>
          )}
          <button className="bo-btn ghost sm" onClick={() => setModifica(true)}>Modifica</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="ru-tr">
      <td colSpan={6} style={{ padding: 0 }}>
        <div className="bo-card flat" style={{ marginBottom: 8 }}>
          {msg && <div className="bo-err">{msg}</div>}
          <div className="bo-grid">
            <label className="bo-field">
              <span>Cognome</span>
              <input type="text" value={p.cognome ?? ''}
                onChange={(e) => set({ cognome: e.target.value.toUpperCase() || null })} />
            </label>
            <label className="bo-field">
              <span>Nome *</span>
              <input type="text" value={p.nome}
                onChange={(e) => set({ nome: e.target.value.toUpperCase() })} />
            </label>
            <label className="bo-field">
              <span>Codice fiscale</span>
              <input type="text" value={p.codice_fiscale ?? ''}
                onChange={(e) => set({ codice_fiscale: e.target.value.toUpperCase().trim() || null })} />
            </label>
            <label className="bo-field">
              <span>Data assunzione</span>
              <input type="date" value={p.data_assunzione ?? ''}
                onChange={(e) => set({ data_assunzione: e.target.value || null })} />
            </label>
            <label className="bo-field">
              <span>Data cessazione</span>
              <input type="date" value={p.data_cessazione ?? ''}
                onChange={(e) => set({ data_cessazione: e.target.value || null })} />
              {/* La data governa `attivo`, e uscire dall'organigramma vuol dire
                  sparire da requisiti, scadenzario e cose da fare del cliente.
                  E' un effetto grosso per un campo data: si dice PRIMA del
                  Salva, cosi' un anno digitato male si vede mentre lo si
                  scrive e non tre schermate dopo. */}
              {(() => {
                const d = p.data_cessazione;
                const oggi = oggiISO();
                if (!d) {
                  return persona.data_cessazione
                    ? <small style={{ color: 'var(--hi-dark,#8a6d00)' }}>
                        Togliendo la data, salvando la persona torna in forza.
                      </small>
                    : null;
                }
                // Una data di cessazione nel futuro non e' una cessazione
                // programmata: quelle non si gestiscono qui, e nei dati veri
                // una data avanti nel tempo e' quasi sempre l'anno digitato
                // male. Il punto e' che l'errore e' MUTO: la persona resta in
                // forza, quindi chi credeva di averla fatta uscire la ritrova
                // nell'organigramma senza che niente lo segnali. Si dice qui,
                // in rosso, con il numero degli anni per rendere evidente il
                // caso "2027 al posto di 2026".
                if (d > oggi) {
                  const gg = Math.round((Date.parse(d) - Date.parse(oggi)) / 86400000);
                  return <small style={{ color: 'var(--no,#d24028)' }}>
                    Data <strong>nel futuro</strong> ({d.split('-').reverse().join('/')}, fra {gg}{' '}
                    {gg === 1 ? 'giorno' : 'giorni'}): la persona <strong>resta in forza</strong> e
                    non esce dall&rsquo;organigramma. Se la cessazione è già avvenuta, controlla
                    l&rsquo;anno.
                  </small>;
                }
                return persona.attivo
                  ? <small style={{ color: 'var(--hi-dark,#8a6d00)' }}>
                      Salvando, esce dall&rsquo;organigramma: i suoi requisiti e le sue
                      scadenze spariscono dal riepilogo del cliente.
                    </small>
                  : null;
              })()}
            </label>
            <label className="bo-field">
              <span>Mansione</span>
              <input type="text" value={p.mansione ?? ''} list={listaMansioni}
                onChange={(e) => set({ mansione: e.target.value.toUpperCase() || null })} />
            </label>
            <label className="bo-field">
              <span>Reparto</span>
              <input type="text" value={p.reparto ?? ''} list={listaReparti}
                onChange={(e) => set({ reparto: e.target.value.toUpperCase() || null })} />
            </label>
            <label className="bo-field">
              <span>Rischio (override)</span>
              <select value={p.livello_rischio ?? ''}
                onChange={(e) => set({ livello_rischio: (e.target.value || null) as RischioPersona })}>
                <option value="">— eredita dal cliente —</option>
                <option value="basso">basso</option>
                <option value="medio">medio</option>
                <option value="alto">alto</option>
              </select>
            </label>
            <label className="bo-field" style={{ marginBottom: 0 }}>
              <span>Note</span>
              <input type="text" value={p.note ?? ''}
                onChange={(e) => set({ note: e.target.value || null })} />
            </label>
          </div>
          <div className="bo-bar">
            <button className="bo-btn sm" onClick={() => void salva()} disabled={busy}>
              {busy ? 'Salvo…' : nuova ? 'Aggiungi' : 'Salva'}
            </button>
            {nuova
              ? onAnnulla && <button className="bo-btn ghost sm" onClick={onAnnulla} disabled={busy}>Annulla</button>
              : <>
                  <button className="bo-btn ghost sm" onClick={() => { setP(persona); setModifica(false); }} disabled={busy}>Chiudi</button>
                  <button className="bo-btn ghost sm" onClick={() => void toggle()} disabled={busy}>
                    {persona.attivo ? 'Disattiva' : 'Riattiva'}
                  </button>
                  <span className="bo-sp" />
                  <button className="bo-btn danger sm" onClick={() => void elimina()} disabled={busy}>Elimina</button>
                </>}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ============================ import massivo ============================

interface PianoImport {
  persone: Persona[];   // da scrivere (nuove + aggiornate)
  nuove: number;
  aggiornate: number;
  scartate: number;     // righe senza nome
  cfNonValidi: number;
}

// Lettura del file e mappatura riga -> persona stanno in
// `lib/admin/anagraficheImport.ts`, insieme all'import massivo del back-office:
// il vocabolario delle intestazioni (quali diciture valgono "Mansione", quali
// "Data assunzione") deve essere UNO. Due elenchi di sinonimi che si separano
// fanno un file che entra da una porta e viene scartato dall'altra.
function pianifica(righe: Record<string, unknown>[], esistenti: Persona[], clienteId: string): PianoImport {
  const perCf = new Map<string, Persona>();
  for (const p of esistenti) {
    if (p.codice_fiscale) perCf.set(cfPulisci(p.codice_fiscale), p);
  }

  const out = new Map<string, Persona>(); // chiave: CF o "riga:N" per i senza-CF
  let scartate = 0, cfNonValidi = 0, senzaCf = 0;

  for (const r of righe) {
    // intestazioni normalizzate (accenti, spazi, maiuscole) come nel foglio
    const col: Record<string, unknown> = {};
    for (const k of Object.keys(r)) col[normHeader(k)] = r[k];

    const campi = leggiCampiPersona(col);
    if (!campi) { scartate++; continue; }
    if (campi.cf && !cfValido(campi.cf)) cfNonValidi++;

    const esist = campi.cf ? perCf.get(campi.cf) : undefined;
    const chiave = campi.cf || `riga:${senzaCf++}`;
    const base: Persona = out.get(chiave)
      ?? (esist ? { ...esist } : { ...personaVuota(clienteId), id: newId() });
    out.set(chiave, fondiPersona(campi, base));
  }

  const persone = [...out.values()];
  const nuove = persone.filter((p) => !esistenti.some((e) => e.id === p.id)).length;
  return { persone, nuove, aggiornate: persone.length - nuove, scartate, cfNonValidi };
}

function PannelloImport({ clienteId, esistenti, onFatto, onAnnulla }: {
  clienteId: string; esistenti: Persona[]; onFatto: () => void; onAnnulla: () => void;
}) {
  const [piano, setPiano] = useState<PianoImport | null>(null);
  const [busy, setBusy] = useState<'' | 'leggo' | 'applico'>('');
  const [err, setErr] = useState<string | null>(null);
  const [nomeFile, setNomeFile] = useState<string | null>(null);

  async function leggi(file: File) {
    setBusy('leggo'); setErr(null); setPiano(null); setNomeFile(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const righe = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      const pi = pianifica(righe, esistenti, clienteId);
      if (pi.persone.length === 0 && pi.scartate === 0) {
        setErr('Nessuna riga leggibile nel foglio. Attese colonne: Cognome, Nome, Codice fiscale, Mansione, Reparto, Data assunzione.');
      } else {
        setPiano(pi);
      }
    } catch (e: any) { setErr(e?.message ?? 'File non leggibile.'); }
    finally { setBusy(''); }
  }

  async function applica() {
    if (!piano) return;
    setBusy('applico'); setErr(null);
    try {
      for (const p of piano.persone) await salvaPersona(p);
      onFatto();
    } catch (e: any) { setErr(e?.message ?? 'Import non riuscito.'); setBusy(''); }
  }

  function scaricaModello() {
    const esempio = [
      { Cognome: 'ROSSI', Nome: 'MARIO', 'Codice fiscale': 'RSSMRA80A01H501U', Mansione: 'Operaio', Reparto: 'Produzione', 'Data assunzione': '01/03/2020' },
      { Cognome: 'BIANCHI', Nome: 'LUCIA', 'Codice fiscale': 'BNCLCU85M41F205X', Mansione: 'Impiegata', Reparto: 'Uffici', 'Data assunzione': '15/09/2019' },
    ];
    const ws = XLSX.utils.json_to_sheet(esempio, {
      header: ['Cognome', 'Nome', 'Codice fiscale', 'Mansione', 'Reparto', 'Data assunzione'],
    });
    ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personale');
    XLSX.writeFile(wb, 'modello_risorse_umane.xlsx');
  }

  return (
    <div className="bo-card" style={{ marginBottom: 10, borderColor: 'var(--hi)' }}>
      <div className="bo-row" style={{ marginBottom: 8 }}>
        <div className="grow"><div className="bo-title">Importazione massiva</div></div>
        <button className="bo-btn ghost sm" onClick={scaricaModello} disabled={busy !== ''}>Scarica modello</button>
        <button className="bo-btn ghost sm" onClick={onAnnulla} disabled={busy !== ''}>Chiudi</button>
      </div>
      <p className="bo-sub" style={{ marginTop: 0 }}>
        Excel o CSV con una riga per persona. Intestazioni riconosciute (in qualsiasi ordine):
        <b> Cognome, Nome, Codice fiscale, Mansione, Reparto, Data assunzione</b>. Le persone
        già presenti vengono aggiornate in base al codice fiscale; l'anteprima non scrive nulla.
      </p>

      <label className="bo-field" style={{ marginBottom: 8 }}>
        <span>File (.xlsx / .csv)</span>
        <input type="file" accept=".xlsx,.xls,.csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void leggi(f); }} />
      </label>

      {busy === 'leggo' && <div className="bo-note">Leggo {nomeFile}…</div>}
      {err && <div className="bo-err">{err}</div>}

      {piano && (
        <>
          <div className="bo-note">
            Da <b>{nomeFile}</b>: <b>{piano.nuove}</b> nuove, <b>{piano.aggiornate}</b> aggiornate
            {piano.scartate > 0 && <> · {piano.scartate} righe scartate (senza nome)</>}
            {piano.cfNonValidi > 0 && <> · {piano.cfNonValidi} con CF non valido (importate comunque)</>}.
          </div>
          <div className="bo-bar">
            <button className="bo-btn" onClick={() => void applica()} disabled={busy !== '' || piano.persone.length === 0}>
              {busy === 'applico' ? 'Applico…' : `Applica (${piano.persone.length})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
