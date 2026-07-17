// Back-office - "Alias corsi" (C1a): carica il catalogo corsi del GESTIONALE e
// mappa ogni suo nome su un codice del catalogo ASR.
//
// Due gesti distinti:
//   1. carico dell'export (anteprima -> conferma): porta dentro i nomi nuovi
//      come "da mappare". Non tocca mai le righe gia' mappate.
//   2. mappatura: e' il lavoro vero, e vive qui anche senza file. Ogni riga
//      finisce in uno di tre stati: mappata su un corso, ignorata (non e' un
//      corso ASR: ANSF, ECM, PRIVACY, AMBIENTE, SALDATURA), o ancora da fare.
//
// Il contatore "da mappare" e' in cima perche' e' cio' che blocca l'import
// della formazione (C1b): con alias non mappati il motore valuterebbe su una
// storia formativa incompleta, cioe' rossi falsi.

import { useEffect, useMemo, useState } from 'react';
import {
  leggiCatalogoGestionale, caricaAlias, riconciliaAlias, applicaAlias, aggiornaAlias,
  daMappare, tipologiaLeggibile,
  type CorsoAlias, type EsitoAlias, type RigaCatalogoGestionale,
} from '../lib/admin/aliasCorsi';
import { caricaCatalogo, type CorsoCatalogo } from '../lib/admin/formazione';

type Filtro = 'damappare' | 'mappati' | 'ignorati' | 'tutti';
const FILTRI: { k: Filtro; label: string }[] = [
  { k: 'damappare', label: 'Da mappare' },
  { k: 'mappati', label: 'Mappati' },
  { k: 'ignorati', label: 'Ignorati' },
  { k: 'tutti', label: 'Tutti' },
];

export default function AliasCorsi() {
  const [alias, setAlias] = useState<CorsoAlias[]>([]);
  const [corsi, setCorsi] = useState<CorsoCatalogo[]>([]);
  const [righe, setRighe] = useState<RigaCatalogoGestionale[] | null>(null);
  const [esito, setEsito] = useState<EsitoAlias | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('damappare');
  const [busy, setBusy] = useState<'' | 'carico' | 'analizza' | 'applica'>('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function ricarica() {
    setBusy('carico'); setErr(null);
    try {
      const [a, cat] = await Promise.all([caricaAlias(), caricaCatalogo()]);
      setAlias(a);
      setCorsi(cat.corsi.filter((c) => c.attivo).sort((x, y) => x.nome.localeCompare(y.nome)));
    } catch (e: any) { setErr(e?.message ?? 'Errore in caricamento.'); }
    finally { setBusy(''); }
  }
  useEffect(() => { void ricarica(); }, []);

  // Ore e tipologia del gestionale non stanno in `corso_alias`: servono a
  // decidere la mappatura (i quasi-duplicati si distinguono per le ore) e sono
  // sempre a un upload di distanza, quindi si mostrano quando il file c'e'.
  const dalFile = useMemo(() => {
    const m = new Map<string, RigaCatalogoGestionale>();
    for (const r of righe ?? []) m.set(r.testo, r);
    return m;
  }, [righe]);

  async function analizza(file: File | null) {
    if (!file) return;
    setBusy('analizza'); setErr(null); setMsg(null); setEsito(null);
    try {
      const r = await leggiCatalogoGestionale(file);
      setRighe(r);
      setEsito(riconciliaAlias(r, alias));
    } catch (e: any) { setErr(e?.message ?? 'Errore in lettura.'); }
    finally { setBusy(''); }
  }

  async function applica() {
    if (!esito) return;
    setBusy('applica'); setErr(null); setMsg(null);
    try {
      const n = await applicaAlias(esito);
      setMsg(`${n} alias nuovi da mappare.`);
      setEsito(null);
      await ricarica();
      setFiltro('damappare');
    } catch (e: any) { setErr(e?.message ?? 'Errore in applicazione.'); }
    finally { setBusy(''); }
  }

  type Patch = Partial<Pick<CorsoAlias, 'corso_codice' | 'ignorato' | 'pregressa'>>;
  async function patch(a: CorsoAlias, p: Patch) {
    const prima = alias;
    setAlias((l) => l.map((x) => (x.id === a.id ? { ...x, ...p } : x)));
    try { await aggiornaAlias(a.id, p); }
    catch (e: any) { setAlias(prima); setErr(e?.message ?? 'Errore in salvataggio.'); }
  }

  // I tre stati sono disgiunti: una riga ignorata non e' "mappata" nemmeno se
  // conserva un codice sotto -- l'import la salta comunque.
  const mappato = (a: CorsoAlias): boolean => !!a.corso_codice && !a.ignorato;
  const conta = {
    damappare: alias.filter(daMappare).length,
    mappati: alias.filter(mappato).length,
    ignorati: alias.filter((a) => a.ignorato).length,
    tutti: alias.length,
  };

  const lista = alias.filter((a) =>
    filtro === 'damappare' ? daMappare(a)
      : filtro === 'mappati' ? mappato(a)
        : filtro === 'ignorati' ? a.ignorato
          : true);

  return (
    <div>
      <h2 className="bo-h">Alias corsi (gestionale)</h2>
      <p className="bo-sub">Dizionario permanente <i>nome del gestionale &rarr; corso a catalogo ASR</i>.
        L&rsquo;export &ldquo;Formazione&rdquo; e&rsquo; l&rsquo;universo completo degli alias: si carica una volta e si
        mappa. Ogni import successivo risolve da solo i nomi gia&rsquo; noti.</p>

      <div className="bo-card">
        <div className="bo-meta" style={{ gap: 8, marginBottom: 10 }}>
          <span className={`bo-pill ${conta.damappare > 0 ? 'warn' : 'attivo'}`}>
            {conta.damappare} da mappare
          </span>
          <span className="bo-pill usato">{conta.mappati} mappati</span>
          <span className="bo-pill archiviato">{conta.ignorati} ignorati</span>
        </div>
        <p className="bo-sub" style={{ margin: 0 }}>
          {conta.damappare > 0
            ? 'Finche\u2019 restano alias da mappare l\u2019import della formazione resta bloccato: valuterebbe su una storia formativa incompleta.'
            : 'Nessun alias da mappare: l\u2019import della formazione puo\u2019 girare.'}
        </p>
      </div>

      <div className="bo-card">
        <label className="bo-field">
          <span>Export catalogo corsi del gestionale (.xlsx)</span>
          <input type="file" accept=".xlsx" disabled={busy !== ''}
            onChange={(e) => void analizza(e.target.files?.[0] ?? null)} />
        </label>
        {busy === 'analizza' && <p className="bo-sub">Lettura in corso&hellip;</p>}
        {esito && (
          <>
            <p className="bo-sub" style={{ margin: '0 0 10px' }}>
              {esito.righe} corsi nel file &middot; <b>{esito.nuovi.length} nuovi</b> &middot;{' '}
              {esito.presenti} gia&rsquo; nel dizionario
              {esito.assenti.length > 0 && <> &middot; {esito.assenti.length} in app ma non nel file (restano)</>}
            </p>
            {esito.nuovi.length > 0 && (
              <div style={{ maxHeight: 220, overflow: 'auto', marginBottom: 10 }}>
                {esito.nuovi.map((r) => (
                  <div key={r.testo} className="bo-meta"
                    style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '5px 0' }}>
                    <span style={{ flex: 1 }}>{r.originale}</span>
                    <span>{r.ore != null ? `${r.ore}h` : '\u2014'}</span>
                    <span>{r.periodicita_mesi != null ? `${r.periodicita_mesi} mesi` : '\u2014'}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="bo-btn" disabled={busy !== '' || esito.nuovi.length === 0}
              onClick={() => void applica()}>
              {busy === 'applica' ? 'Applico\u2026' : `Applica (${esito.nuovi.length})`}
            </button>
          </>
        )}
        {err && <p className="bo-sub" style={{ color: 'var(--no)', marginTop: 10 }}>{err}</p>}
        {msg && <p className="bo-sub" style={{ color: 'var(--ok)', marginTop: 10 }}>{msg}</p>}
      </div>

      <div className="bo-card">
        <label className="bo-field" style={{ maxWidth: 240 }}>
          <span>Mostra</span>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
            {FILTRI.map((f) => (
              <option key={f.k} value={f.k}>{f.label} ({conta[f.k]})</option>
            ))}
          </select>
        </label>

        {lista.length === 0 && (
          <p className="bo-empty">{busy === 'carico' ? 'Caricamento\u2026' : 'Nessun alias in questo stato.'}</p>
        )}

        {lista.map((a) => {
          const f = dalFile.get(a.testo_gestionale);
          return (
            <div key={a.id} style={{ borderBottom: '1px solid var(--line)', padding: '9px 0' }}>
              <div className="bo-meta" style={{ justifyContent: 'space-between' }}>
                <b style={{ flex: 1 }}>{a.testo_gestionale}</b>
                {f && <span>{f.ore != null ? `${f.ore}h` : '\u2014'}</span>}
                {f && f.tipologia && <span className="bo-pill archiviato">{tipologiaLeggibile(f.tipologia)}</span>}
              </div>
              <div className="bo-meta" style={{ gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                <select style={{ flex: 1, minWidth: 260 }} value={a.corso_codice ?? ''}
                  disabled={a.ignorato}
                  onChange={(e) => void patch(a, { corso_codice: e.target.value || null })}>
                  <option value="">&mdash; da mappare &mdash;</option>
                  {corsi.map((c) => (
                    <option key={c.codice} value={c.codice}>{c.nome} ({c.codice})</option>
                  ))}
                </select>
                <label className="bo-meta" style={{ gap: 5 }}>
                  {/* Ignorato non azzera il codice: all'import basta il flag per
                      saltare la riga, e un misclick che cancella la mappatura
                      fatta a mano costa piu' dell'ordine che metterebbe. Il menu
                      resta disabilitato: la riga e' parcheggiata, non svuotata. */}
                  <input type="checkbox" checked={a.ignorato}
                    onChange={(e) => void patch(a, { ignorato: e.target.checked })} />
                  <span>Ignorato</span>
                </label>
                <label className="bo-meta" style={{ gap: 5 }}>
                  <input type="checkbox" checked={a.pregressa} disabled={a.ignorato || !a.corso_codice}
                    onChange={(e) => void patch(a, { pregressa: e.target.checked })} />
                  <span>Evidenza pregressa</span>
                  {/* Una spunta grigia e muta fa perdere tempo: dice cosa manca. */}
                  {!a.ignorato && !a.corso_codice && (
                    <i style={{ color: 'var(--faint)' }}>prima scegli il corso</i>
                  )}
                </label>
              </div>
              {a.pregressa && (
                <p className="bo-sub" style={{ margin: '4px 0 0' }}>
                  Attestato di vecchio regime: copre il requisito mappato, l&rsquo;import conserva il nome originale.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
