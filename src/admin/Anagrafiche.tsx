// Anagrafiche del back-office: clienti e relativi incarichi. È il blocco a
// monte della Pianificazione — finché non ci sono clienti/incarichi, la scheda
// Pianificazione resta vuota. Online-first (scrivania).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  caricaClienti, salvaCliente, impostaStatoCliente, eliminaCliente, clienteVuoto,
  caricaIncarichiCliente,
  type ClienteRiga, type IncaricoRiga,
} from '../lib/admin/anagrafiche';
import {
  caricaSedi, salvaSede, impostaStatoSede, sedeVuota,
} from '../lib/admin/sedi';
import type { Cliente, Sede } from '../lib/types';
import {
  risolviAteco, cercaAteco, ETICHETTA_RISCHIO,
  type AtecoDivisione, type RischioAteco,
} from '../formazione';
import { OrganigrammaCliente, RisorseUmane } from '../formazione';

export default function Anagrafiche() {
  // null = elenco; { id } = scheda esistente; { nuovo:true } = scheda nuova
  const [apri, setApri] = useState<{ id?: string; nuovo?: boolean } | null>(null);

  if (apri) {
    return (
      <SchedaCliente
        clienteId={apri.id ?? null}
        onIndietro={() => setApri(null)}
      />
    );
  }
  return <ElencoClienti onApri={(id) => setApri({ id })} onNuovo={() => setApri({ nuovo: true })} />;
}

// ----------------------------- elenco clienti -----------------------------
function ElencoClienti({
  onApri, onNuovo,
}: { onApri: (id: string) => void; onNuovo: () => void }) {
  const [righe, setRighe] = useState<ClienteRiga[]>([]);
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [q, setQ] = useState('');
  const [mostraInattivi, setMostraInattivi] = useState(false);

  useEffect(() => {
    caricaClienti()
      .then((r) => { setRighe(r); setStato('ok'); })
      .catch(() => setStato('errore'));
  }, []);

  const visibili = useMemo(() => {
    const ago = q.trim().toLowerCase();
    return righe.filter((r) => {
      if (!mostraInattivi && !r.cliente.attivo) return false;
      if (!ago) return true;
      return (
        r.cliente.ragione_sociale.toLowerCase().includes(ago) ||
        (r.cliente.localita ?? '').toLowerCase().includes(ago)
      );
    });
  }, [righe, q, mostraInattivi]);

  return (
    <>
      <div className="bo-row" style={{ marginBottom: 14 }}>
        <div className="grow">
          <h2 className="bo-h">Clienti</h2>
          <p className="bo-sub" style={{ margin: 0 }}>
            Anagrafica clienti e incarichi: la base della pianificazione.
          </p>
        </div>
        <button className="bo-btn" onClick={onNuovo}>+ Nuovo cliente</button>
      </div>

      <div className="bo-row" style={{ marginBottom: 14, gap: 14 }}>
        <input type="text" placeholder="Cerca per ragione sociale o località…"
          value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360 }} />
        <label className="chk">
          <input type="checkbox" checked={mostraInattivi}
            onChange={(e) => setMostraInattivi(e.target.checked)} />
          Mostra anche i disattivati
        </label>
      </div>

      {stato === 'loading' && <div className="bo-empty">Carico…</div>}
      {stato === 'errore' && <div className="bo-err">Errore nel caricamento dei clienti.</div>}
      {stato === 'ok' && visibili.length === 0 && (
        <div className="bo-empty">
          {righe.length === 0
            ? 'Nessun cliente. Creane uno con “Nuovo cliente”.'
            : 'Nessun cliente corrisponde ai filtri.'}
        </div>
      )}

      {visibili.map((r) => (
        <div key={r.cliente.id} className={`bo-card ${r.cliente.attivo ? '' : 'dim'}`}>
          <div className="bo-row">
            <div className="grow">
              <div className="bo-title">{r.cliente.ragione_sociale}</div>
              <div className="bo-meta">
                {r.cliente.localita && <span>{r.cliente.localita}</span>}
                {r.cliente.referente && <span>{r.cliente.referente}</span>}
                {r.cliente.telefono && <span>{r.cliente.telefono}</span>}
                {r.cliente.email && <span>{r.cliente.email}</span>}
                <span className={`bo-pill ${r.n_incarichi_attivi > 0 ? 'attivo' : 'archiviato'}`}>
                  {r.n_incarichi} {r.n_incarichi === 1 ? 'incarico' : 'incarichi'}
                </span>
                {!r.cliente.attivo && <span className="bo-pill archiviato">disattivato</span>}
              </div>
            </div>
            <button className="bo-btn ghost sm" onClick={() => onApri(r.cliente.id)}>Apri</button>
          </div>
        </div>
      ))}
    </>
  );
}

// ----------------------------- scheda cliente -----------------------------
function SchedaCliente({
  clienteId, onIndietro,
}: { clienteId: string | null; onIndietro: () => void }) {
  const nuovo = clienteId === null;
  const [cliente, setCliente] = useState<Cliente>(() => clienteVuoto());
  const [persistito, setPersistito] = useState(!nuovo); // esiste sul DB?
  const [incarichi, setIncarichi] = useState<IncaricoRiga[]>([]);
  const [sedi, setSedi] = useState<Sede[]>([]);
  const [fase, setFase] = useState<'carico' | 'pronto' | 'errore'>(nuovo ? 'pronto' : 'carico');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bump dopo il salvataggio: forza il ricalcolo dell'organigramma innestato
  // (es. nuovo livello di rischio proposto dall'ATECO, livelli emergenza).
  const [orgRefresh, setOrgRefresh] = useState(0);
  // Numero risorse umane attive (per il sommario della sezione).
  const [nPersone, setNPersone] = useState<number | null>(null);

  // Sezioni apri/chiudi indipendenti: piu' d'una puo' restare aperta insieme
  // (visione panoramica). L'organigramma, pesante, si monta solo da aperto.
  const [aperte, setAperte] = useState<Set<string>>(() => new Set(['dati']));
  const toggle = (k: string) => setAperte((s) => {
    const n = new Set(s);
    n.has(k) ? n.delete(k) : n.add(k);
    return n;
  });

  function caricaTutto() {
    if (nuovo) return;
    setFase('carico');
    Promise.all([caricaClienti(), caricaIncarichiCliente(clienteId!)])
      .then(([cls, inc]) => {
        const c = cls.find((x) => x.cliente.id === clienteId);
        if (!c) { setFase('errore'); return; }
        setCliente(c.cliente);
        setIncarichi(inc);
        setFase('pronto');
      })
      .catch(() => setFase('errore'));
    caricaSedi(clienteId!).then(setSedi).catch(() => setSedi([]));
  }
  useEffect(caricaTutto, [clienteId]);

  const patch = (p: Partial<Cliente>) => setCliente((c) => ({ ...c, ...p }));

  async function salva() {
    if (!cliente.ragione_sociale.trim()) { setMsg('La ragione sociale è obbligatoria.'); return; }
    setBusy(true); setMsg(null);
    try {
      await salvaCliente(cliente);
      setPersistito(true);
      setOrgRefresh((n) => n + 1);
      setMsg('Cliente salvato.');
    } catch (e: any) {
      setMsg(e?.message ?? 'Salvataggio non riuscito.');
    } finally { setBusy(false); }
  }

  async function toggleAttivo() {
    setBusy(true); setMsg(null);
    try {
      await impostaStatoCliente(cliente.id, !cliente.attivo);
      patch({ attivo: !cliente.attivo });
    } catch (e: any) {
      setMsg(e?.message ?? 'Operazione non riuscita.');
    } finally { setBusy(false); }
  }

  async function elimina() {
    if (!confirm('Eliminare definitivamente questo cliente?')) return;
    setBusy(true); setMsg(null);
    try {
      await eliminaCliente(cliente.id);
      onIndietro();
    } catch (e: any) {
      setMsg(e?.message ?? 'Eliminazione non riuscita.');
      setBusy(false);
    }
  }

  function ricaricaSedi() {
    caricaSedi(cliente.id).then(setSedi).catch(() => {});
  }

  if (fase === 'carico') return <div className="bo-empty">Carico la scheda…</div>;
  if (fase === 'errore') {
    return (
      <div>
        <div className="bo-err">Impossibile caricare il cliente.</div>
        <button className="bo-btn ghost" onClick={onIndietro}>Indietro</button>
      </div>
    );
  }

  return (
    <div>
      <div className="bo-row" style={{ marginBottom: 8 }}>
        <button className="bo-iconbtn" onClick={onIndietro} title="Indietro">←</button>
        <div className="grow">
          <h2 className="bo-h" style={{ margin: 0 }}>
            {nuovo && !persistito ? 'Nuovo cliente' : cliente.ragione_sociale || 'Cliente'}
          </h2>
        </div>
        {persistito && (
          <span className={`bo-pill ${cliente.attivo ? 'attivo' : 'archiviato'}`}>
            {cliente.attivo ? 'attivo' : 'disattivato'}
          </span>
        )}
      </div>

      {msg && <div className="bo-note">{msg}</div>}

      {/* --- dati anagrafici --- */}
      <Sezione titolo="Dati anagrafici" sommario={cliente.localita ?? undefined}
        aperta={aperte.has('dati')} onToggle={() => toggle('dati')}>
        <label className="bo-field">
          <span>Ragione sociale *</span>
          <input type="text" value={cliente.ragione_sociale}
            onChange={(e) => patch({ ragione_sociale: e.target.value.toUpperCase() })} />
        </label>
        <div className="bo-grid">
          <label className="bo-field">
            <span>Partita IVA</span>
            <input type="text" inputMode="numeric" value={cliente.partita_iva ?? ''}
              onChange={(e) => patch({ partita_iva: e.target.value.toUpperCase() || null })} />
          </label>
          <label className="bo-field">
            <span>Codice fiscale</span>
            <input type="text" value={cliente.codice_fiscale ?? ''}
              onChange={(e) => patch({ codice_fiscale: e.target.value.toUpperCase() || null })} />
          </label>
        </div>
        <CampoAteco
          codice={cliente.codice_ateco}
          livello={cliente.livello_rischio}
          onPatch={patch}
        />
        <div className="bo-grid" style={{ marginTop: 12 }}>
          <label className="bo-field">
            <span>Referente</span>
            <input type="text" value={cliente.referente ?? ''}
              onChange={(e) => patch({ referente: e.target.value.toUpperCase() || null })} />
          </label>
          <label className="bo-field">
            <span>Telefono</span>
            <input type="tel" value={cliente.telefono ?? ''}
              onChange={(e) => patch({ telefono: e.target.value || null })} />
          </label>
          <label className="bo-field">
            <span>Email</span>
            <input type="email" value={cliente.email ?? ''}
              onChange={(e) => patch({ email: e.target.value || null })} />
          </label>
          <label className="bo-field">
            <span>Località</span>
            <input type="text" value={cliente.localita ?? ''}
              onChange={(e) => patch({ localita: e.target.value.toUpperCase() || null })} />
          </label>
          <label className="bo-field">
            <span>Indirizzo</span>
            <input type="text" value={cliente.indirizzo ?? ''}
              onChange={(e) => patch({ indirizzo: e.target.value.toUpperCase() || null })} />
          </label>
          <label className="bo-field">
            <span>Latitudine</span>
            <input type="number" step="any" value={cliente.lat ?? ''}
              onChange={(e) => patch({ lat: e.target.value ? Number(e.target.value) : null })} />
          </label>
          <label className="bo-field">
            <span>Longitudine</span>
            <input type="number" step="any" value={cliente.lng ?? ''}
              onChange={(e) => patch({ lng: e.target.value ? Number(e.target.value) : null })} />
          </label>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>ID Werp (opzionale)</span>
            <input type="text" value={cliente.werp_id ?? ''}
              onChange={(e) => patch({ werp_id: e.target.value || null })} />
          </label>
        </div>

        <div className="bo-field" style={{ margin: '14px 0 0' }}>
          <span>Gestione emergenze (definire a monte)</span>
        </div>
        <div className="bo-grid">
          <label className="bo-field">
            <span>Livello rischio incendio</span>
            <select value={cliente.livello_antincendio ?? ''}
              onChange={(e) => patch({ livello_antincendio: (e.target.value || null) as Cliente['livello_antincendio'] })}>
              <option value="">— non definito —</option>
              <option value="1">Livello 1 — corso 4h</option>
              <option value="2">Livello 2 — corso 8h</option>
              <option value="3">Livello 3 — corso 16h</option>
            </select>
          </label>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>Gruppo primo soccorso</span>
            <select value={cliente.gruppo_primo_soccorso ?? ''}
              onChange={(e) => patch({ gruppo_primo_soccorso: (e.target.value || null) as Cliente['gruppo_primo_soccorso'] })}>
              <option value="">— non definito —</option>
              <option value="A">Gruppo A — corso 16h</option>
              <option value="BC">Gruppi B / C — corso 12h</option>
            </select>
          </label>
        </div>
        <p className="bo-sub" style={{ margin: '6px 0 0' }}>
          Determinano il corso degli addetti. Se nell'organigramma non c'è un addetto,
          il report indica il corso da erogare in base a questi valori.
        </p>

        <div className="bo-bar">
          <button className="bo-btn" onClick={() => void salva()} disabled={busy}>
            {busy ? 'Salvo…' : 'Salva cliente'}
          </button>
          {persistito && (
            <button className="bo-btn ghost" onClick={() => void toggleAttivo()} disabled={busy}>
              {cliente.attivo ? 'Disattiva' : 'Riattiva'}
            </button>
          )}
          <span className="bo-sp" />
          {persistito && incarichi.length === 0 && (
            <button className="bo-btn danger sm" onClick={() => void elimina()} disabled={busy}>
              Elimina
            </button>
          )}
        </div>
      </Sezione>

      {/* --- sedi --- */}
      {persistito && (
        <Sezione titolo="Sedi" sommario={sedi.length ? `${sedi.length} ${sedi.length === 1 ? 'sede' : 'sedi'}` : 'nessuna'}
          aperta={aperte.has('sedi')} onToggle={() => toggle('sedi')}>
          <SediCliente clienteId={cliente.id} sedi={sedi} onCambia={ricaricaSedi} />
        </Sezione>
      )}

      {/* --- risorse umane: personale del cliente (superset dell'organigramma) --- */}
      {persistito && (
        <Sezione titolo="Risorse Umane"
          sommario={nPersone == null ? undefined : nPersone === 0 ? 'nessuna persona' : `${nPersone} ${nPersone === 1 ? 'persona' : 'persone'}`}
          aperta={aperte.has('risorse')} onToggle={() => toggle('risorse')}>
          <RisorseUmane clienteId={cliente.id}
            onCambia={() => setOrgRefresh((n) => n + 1)}
            onConteggio={setNPersone} />
        </Sezione>
      )}

      {/* --- incarichi: si creano e si pianificano nel tab Pianificazione --- */}
      {persistito && (
        <Sezione titolo="Incarichi"
          sommario={`${incarichi.length} ${incarichi.length === 1 ? 'incarico' : 'incarichi'}` +
            (incarichi.length ? ` · ${incarichi.filter((r) => r.incarico.stato === 'attivo').length} attivi` : '')}
          aperta={aperte.has('incarichi')} onToggle={() => toggle('incarichi')}>
          <div className="bo-note">
            {incarichi.length === 0
              ? 'Nessun incarico per questo cliente. Gli incarichi si creano e si pianificano nel tab Incarichi.'
              : 'Gli incarichi si creano e si pianificano nel tab Incarichi.'}
          </div>
        </Sezione>
      )}

      {/* --- organigramma sicurezza / formazione del cliente --- */}
      {persistito && (
        <Sezione titolo="Organigramma sicurezza" sommario="figure, nomine e stato formazione"
          aperta={aperte.has('organigramma')} onToggle={() => toggle('organigramma')}>
          <OrganigrammaCliente clienteId={cliente.id} refreshToken={orgRefresh} />
        </Sezione>
      )}

    </div>
  );
}

// Sezione apri/chiudi (accordion) della scheda cliente. Indipendente: piu'
// sezioni possono restare aperte insieme. Il corpo si monta solo da aperto.
function Sezione({ titolo, sommario, aperta, onToggle, children }: {
  titolo: string; sommario?: string; aperta: boolean;
  onToggle: () => void; children: ReactNode;
}) {
  return (
    <div className={`bo-acc ${aperta ? 'open' : ''}`}>
      <button type="button" className="bo-acc-head" onClick={onToggle}>
        <span className="bo-acc-chev">▶</span>
        <span className="grow">
          <span className="bo-acc-tit">{titolo}</span>
          {sommario && <span className="bo-acc-sum"> · {sommario}</span>}
        </span>
      </button>
      {aperta && <div className="bo-acc-body">{children}</div>}
    </div>
  );
}

// --------------------------- sedi di un cliente ---------------------------
function RigaSede({ sede, onCambia }: { sede: Sede; onCambia: () => void }) {
  const [s, setS] = useState<Sede>(sede);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const nuova = !sede.nome;

  async function salva() {
    setBusy(true); setMsg(null);
    try { await salvaSede(s); onCambia(); if (nuova) setS(sedeVuota(sede.cliente_id)); }
    catch (e) { setMsg((e as Error)?.message ?? 'Salvataggio non riuscito.'); }
    finally { setBusy(false); }
  }
  async function toggle() {
    setBusy(true); setMsg(null);
    try { await impostaStatoSede(sede.id, !sede.attivo); onCambia(); }
    catch { setMsg('Operazione non riuscita.'); }
    finally { setBusy(false); }
  }

  return (
    <div className={`bo-card ${s.attivo ? '' : 'dim'}`} style={{ marginBottom: 8 }}>
      {msg && <div className="bo-err">{msg}</div>}
      <div className="bo-grid">
        <label className="bo-field">
          <span>Nome sede</span>
          <input type="text" value={s.nome}
            onChange={(e) => setS({ ...s, nome: e.target.value.toUpperCase() })}
            placeholder="es. SEDE LEGALE, STABILIMENTO 1" />
        </label>
        <label className="bo-field" style={{ marginBottom: 0 }}>
          <span>Indirizzo</span>
          <input type="text" value={s.indirizzo ?? ''}
            onChange={(e) => setS({ ...s, indirizzo: e.target.value.toUpperCase() || null })} />
        </label>
      </div>
      <div className="bo-bar">
        <button className="bo-btn sm" onClick={() => void salva()} disabled={busy}>
          {busy ? 'Salvo…' : nuova ? 'Aggiungi sede' : 'Salva'}
        </button>
        {!nuova && (
          <button className="bo-btn ghost sm" onClick={() => void toggle()} disabled={busy}>
            {sede.attivo ? 'Archivia' : 'Riattiva'}
          </button>
        )}
      </div>
    </div>
  );
}

function SediCliente({ clienteId, sedi, onCambia }: {
  clienteId: string; sedi: Sede[]; onCambia: () => void;
}) {
  const [agg, setAgg] = useState(false);
  return (
    <>
      <div className="bo-row" style={{ margin: '0 0 6px' }}>
        <span className="grow" />
        {!agg && <button className="bo-btn sm" onClick={() => setAgg(true)}>+ Aggiungi sede</button>}
      </div>
      <p className="bo-sub" style={{ margin: '0 0 10px' }}>
        Una societa puo avere piu sedi. L'incarico ne sceglie una e il sopralluogo la eredita
        (modificabile in testata). Senza sedi, vale l'indirizzo del cliente.
      </p>

      {agg && (
        <RigaSede sede={sedeVuota(clienteId)}
          onCambia={() => { onCambia(); setAgg(false); }} />
      )}
      {sedi.length === 0 && !agg && (
        <div className="bo-empty">Nessuna sede registrata.</div>
      )}
      {sedi.map((s) => <RigaSede key={s.id} sede={s} onCambia={onCambia} />)}
    </>
  );
}

// ===================== Campo ATECO guidato =====================
// Typeahead sull'Allegato IV ASR 2025: si cerca per codice o per attivita,
// si sceglie la divisione e si imposta automaticamente il livello di rischio
// dell'organigramma. Digitando un codice a mano, il livello viene proposto
// (bottone "Applica") senza sovrascrivere un valore gia' scelto.
function CampoAteco({
  codice, livello, onPatch,
}: {
  codice: string | null;
  livello: RischioAteco | null;
  onPatch: (p: Partial<Cliente>) => void;
}) {
  const [aperto, setAperto] = useState(false);
  const testo = codice ?? '';
  const ris = risolviAteco(testo);
  const suggerimenti = useMemo(() => cercaAteco(testo), [testo]);

  const coloreRischio = (l: RischioAteco) =>
    l === 'basso' ? 'var(--ok)' : l === 'alto' ? 'var(--no)' : 'var(--hi-dark)';

  const scegli = (d: AtecoDivisione) => {
    onPatch({ codice_ateco: d.divisione, livello_rischio: d.livello });
    setAperto(false);
  };

  return (
    <div className="bo-field" style={{ position: 'relative', marginBottom: 0 }}>
      <span>Codice ATECO</span>
      <input
        type="text"
        autoComplete="off"
        value={testo}
        placeholder="Cerca per codice o attività (es. 56 o 'ristorazione')"
        onFocus={() => setAperto(true)}
        onChange={(e) => { onPatch({ codice_ateco: e.target.value || null }); setAperto(true); }}
        onBlur={() => window.setTimeout(() => setAperto(false), 150)}
      />

      {aperto && suggerimenti.length > 0 && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 30,
          marginTop: 4, background: '#fff', border: '1px solid var(--line)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          maxHeight: 290, overflowY: 'auto',
        }}>
          {suggerimenti.map((d) => (
            <button key={d.divisione} type="button"
              onMouseDown={(e) => { e.preventDefault(); scegli(d); }}
              style={{
                display: 'flex', gap: 10, alignItems: 'baseline', width: '100%',
                textAlign: 'left', border: 'none', background: 'none',
                padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit',
                borderBottom: '1px solid var(--line)',
              }}>
              <b style={{ fontVariantNumeric: 'tabular-nums', minWidth: 20 }}>{d.divisione}</b>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>{d.descrizione}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
                color: coloreRischio(d.livello),
              }}>{ETICHETTA_RISCHIO[d.livello]}</span>
            </button>
          ))}
        </div>
      )}

      {ris ? (
        <div style={{
          marginTop: 6, fontSize: 12, color: 'var(--ink-soft)',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <span>
            Div. {ris.divisione} (sez. {ris.sezione}) · {ris.descrizione} ·{' '}
            <b style={{ color: coloreRischio(ris.livello) }}>rischio {ETICHETTA_RISCHIO[ris.livello]}</b>
          </span>
          {livello !== ris.livello && (
            <button type="button" className="bo-btn ghost"
              style={{ padding: '3px 9px', fontSize: 11.5 }}
              onClick={() => onPatch({ livello_rischio: ris.livello })}>
              Applica rischio: {ETICHETTA_RISCHIO[ris.livello]}
            </button>
          )}
        </div>
      ) : testo.trim() ? (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--faint)' }}>
          Divisione non classificata nell'Allegato IV — verifica il codice.
        </div>
      ) : null}

      <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--ink-soft)' }}>
        Livello di rischio impostato:{' '}
        {livello
          ? <b style={{ color: coloreRischio(livello) }}>{ETICHETTA_RISCHIO[livello]}</b>
          : <span style={{ color: 'var(--faint)' }}>non impostato</span>}
        {' '}· modificabile anche dall'organigramma del cliente.
      </div>
    </div>
  );
}
