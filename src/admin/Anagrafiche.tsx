// Anagrafiche del back-office: clienti e relativi incarichi. È il blocco a
// monte della Pianificazione — finché non ci sono clienti/incarichi, la scheda
// Pianificazione resta vuota. Online-first (scrivania).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  caricaClienti, salvaCliente, impostaStatoCliente, eliminaCliente, clienteVuoto, duplicaCliente,
  caricaIncarichiCliente,
  type ClienteRiga, type IncaricoRiga,
} from '../lib/admin/anagrafiche';
import {
  caricaSedi, salvaSede, impostaStatoSede, sedeVuota, eliminaSede,
} from '../lib/admin/sedi';
import type { Cliente, Sede } from '../lib/types';
import {
  risolviAteco, cercaAteco, ETICHETTA_RISCHIO,
  type AtecoDivisione, type RischioAteco,
} from '../formazione';
import { OrganigrammaCliente, RisorseUmane } from '../formazione';
import { allineaPersoneOrganigramma } from '../lib/admin/formazione';
import CoseDaFare from './CoseDaFare';

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
  const [copiaId, setCopiaId] = useState<string | null>(null);

  function ricarica() {
    caricaClienti()
      .then((r) => { setRighe(r); setStato('ok'); })
      .catch(() => setStato('errore'));
  }
  useEffect(() => { ricarica(); }, []);

  async function copia(id: string) {
    setCopiaId(id);
    try {
      const nuovoId = await duplicaCliente(id);
      ricarica();
      onApri(nuovoId);
    } catch (e) {
      window.alert('Copia non riuscita: ' + ((e as Error)?.message ?? String(e)));
    } finally {
      setCopiaId(null);
    }
  }

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
      <style>{`
        .cl-card{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:6px 14px 8px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
        .cl-tbl{width:100%;border-collapse:collapse;font-size:13px}
        .cl-tbl thead th{text-align:left;font-size:12.5px;text-transform:uppercase;letter-spacing:.03em;color:var(--no,#d8442f);font-weight:800;padding:10px 8px;border-bottom:2px solid var(--no,#d8442f)}
        .cl-tr td{padding:12px 8px;border-bottom:1px solid rgba(0,0,0,.07);vertical-align:middle}
        .cl-tr:last-child td{border-bottom:none}
        .cl-tr:nth-child(even) td{background:#faf8f4}
        .cl-tr:hover td{background:#f2ede3}
        .cl-tr.dim{opacity:.5}
        .cl-rs{width:36%;font-weight:800;font-size:14px;color:#1c1e22}
        .cl-sede{width:24%;color:#3a3d43}
        .cl-sede-line{display:flex;align-items:center;gap:6px;line-height:1.5;font-size:12.5px}
        .cl-sede-line + .cl-sede-line{margin-top:2px}
        .cl-tag{font-size:9px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;padding:1px 5px;border-radius:5px;flex:0 0 auto}
        .cl-tag.legale{background:#eef1f4;color:#5b5f66}
        .cl-tag.oper{background:var(--ok-bg,#e6f4ea);color:var(--ok-dark,#1f6b3a)}
        .cl-piva{width:16%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;color:#3a3d43}
        .cl-inc{width:12%;white-space:nowrap}
        .cl-act{width:14%;text-align:right;white-space:nowrap}
        .cl-act .bo-btn{margin-left:6px}
      `}</style>
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

      {stato === 'ok' && visibili.length > 0 && (
        <div className="cl-card">
        <table className="cl-tbl">
          <thead>
            <tr>
              <th>Anagrafica</th>
              <th>Sede</th>
              <th>P.IVA</th>
              <th>Incarichi</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibili.map((r) => (
              <tr key={r.cliente.id} className={'cl-tr' + (r.cliente.attivo ? '' : ' dim')}>
                <td className="cl-rs">
                  {r.cliente.ragione_sociale}
                  {!r.cliente.attivo && <span className="bo-pill archiviato" style={{ marginLeft: 8 }}>disattivato</span>}
                </td>
                <td className="cl-sede">
                  <div className="cl-sede-line"><span className="cl-tag legale">Legale</span>{r.cliente.localita ?? '—'}</div>
                  {r.sede_operativa && (
                    <div className="cl-sede-line"><span className="cl-tag oper">Operativa</span>{r.sede_operativa.localita || r.sede_operativa.nome}</div>
                  )}
                </td>
                <td className="cl-piva">{r.cliente.partita_iva ?? '—'}</td>
                <td className="cl-inc">
                  <span className={`bo-pill ${r.n_incarichi_attivi > 0 ? 'attivo' : 'archiviato'}`}>
                    {r.n_incarichi} {r.n_incarichi === 1 ? 'incarico' : 'incarichi'}
                  </span>
                </td>
                <td className="cl-act">
                  <button className="bo-btn ghost sm" disabled={copiaId === r.cliente.id}
                    title="Duplica l'anagrafica in un nuovo cliente (COPIA) da modificare"
                    onClick={() => void copia(r.cliente.id)}>
                    {copiaId === r.cliente.id ? 'Copio…' : 'Copia'}
                  </button>
                  <button className="bo-btn ghost sm" onClick={() => onApri(r.cliente.id)}>Apri</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
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
  // Wizard "gruppo primo soccorso" (flusso DM 388/2003).
  const [wizardPS, setWizardPS] = useState(false);

  // Sezioni apri/chiudi indipendenti: piu' d'una puo' restare aperta insieme
  // (visione panoramica). L'organigramma, pesante, si monta solo da aperto.
  const [aperte, setAperte] = useState<Set<string>>(() => new Set());
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
      <style>{`
        .bo-acc{border-left:4px solid var(--acc,#c9c2b4)}
        .bo-acc .bo-acc-tit{color:var(--acc-ink,#23262b)}
        .bo-acc .bo-acc-chev{color:var(--acc,#b7b0a2)}
        .bo-acc.open{background:var(--acc-bg,#fff)}
        .acc-anagrafica{--acc:#2b6cb0;--acc-ink:#1e4e82;--acc-bg:#f2f7fc}
        .acc-risorse{--acc:#2f855a;--acc-ink:#276749;--acc-bg:#f1f9f4}
        .acc-organigramma{--acc:#805ad5;--acc-ink:#5f3dc4;--acc-bg:#f6f3fc}
        .acc-incarichi{--acc:#b7791f;--acc-ink:#8a5d10;--acc-bg:#fbf6ec}
        .acc-scadenzario{--acc:#c53030;--acc-ink:#9b2020;--acc-bg:#fcf2f2}
        .bo-subsez{margin-top:16px;padding-top:14px;border-top:1px dashed rgba(0,0,0,.12)}
        .bo-subsez-tit{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#2b6cb0;margin-bottom:10px}
      `}</style>
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
      <Sezione titolo="Dati anagrafici" tema="anagrafica" sommario={cliente.localita ?? undefined}
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
        {/* contatti operativi: referente, telefono, mail */}
        <div className="bo-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 12 }}>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>Referente</span>
            <input type="text" value={cliente.referente ?? ''}
              onChange={(e) => patch({ referente: e.target.value.toUpperCase() || null })} />
          </label>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>Telefono</span>
            <input type="tel" value={cliente.telefono ?? ''}
              onChange={(e) => patch({ telefono: e.target.value || null })} />
          </label>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>Email</span>
            <input type="email" value={cliente.email ?? ''}
              onChange={(e) => patch({ email: e.target.value || null })} />
          </label>
        </div>

        {/* referente amministrativo, telefono, mail */}
        <div className="bo-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 10 }}>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>Referente amm.</span>
            <input type="text" value={cliente.referente_amm ?? ''}
              onChange={(e) => patch({ referente_amm: e.target.value.toUpperCase() || null })} />
          </label>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>Telefono amm.</span>
            <input type="tel" value={cliente.telefono_amm ?? ''}
              onChange={(e) => patch({ telefono_amm: e.target.value || null })} />
          </label>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>Email amm.</span>
            <input type="email" value={cliente.email_amm ?? ''}
              onChange={(e) => patch({ email_amm: e.target.value || null })} />
          </label>
        </div>

        {/* referente / canale commerciale */}
        <div className="bo-grid" style={{ marginTop: 10 }}>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>Referente commerciale</span>
            <input type="text" value={cliente.referente_commerciale ?? ''}
              onChange={(e) => patch({ referente_commerciale: e.target.value.toUpperCase() || null })} />
          </label>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>Canale commerciale</span>
            <input type="text" value={cliente.canale_commerciale ?? ''}
              onChange={(e) => patch({ canale_commerciale: e.target.value || null })} />
          </label>
        </div>

        {/* sede legale */}
        <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--ink)', margin: '18px 0 8px' }}>
          Sede legale
        </div>
        <div className="bo-grid" style={{ gridTemplateColumns: '2.2fr .8fr 1.4fr .7fr' }}>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>Indirizzo</span>
            <input type="text" value={cliente.indirizzo ?? ''}
              onChange={(e) => patch({ indirizzo: e.target.value.toUpperCase() || null })} />
          </label>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>CAP</span>
            <input type="text" inputMode="numeric" maxLength={5} value={cliente.cap ?? ''}
              onChange={(e) => patch({ cap: e.target.value.replace(/\D/g, '').slice(0, 5) || null })} />
          </label>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>Località</span>
            <input type="text" value={cliente.localita ?? ''}
              onChange={(e) => patch({ localita: e.target.value.toUpperCase() || null })} />
          </label>
          <label className="bo-field" style={{ marginBottom: 0 }}>
            <span>Prov.</span>
            <input type="text" maxLength={2} placeholder="VR" value={cliente.provincia ?? ''}
              onChange={(e) => patch({ provincia: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || null })} />
          </label>
        </div>

        {/* gestione emergenze */}
        <div style={{ color: 'var(--no)', fontWeight: 800, fontSize: 17, margin: '22px 0 2px' }}>
          Gestione emergenze
        </div>
        <p className="bo-sub" style={{ margin: '0 0 12px' }}>
          Da definire a monte. Se nell'organigramma manca l'addetto, il report indica il
          corso da erogare in base a questi valori.
        </p>
        <div className="bo-grid" style={{ alignItems: 'start' }}>
          {/* incendio */}
          <div>
            <div style={{ color: 'var(--no)', fontWeight: 800, fontSize: 15, marginBottom: 6 }}>
              Livello rischio incendio
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
              <select style={{ flex: '1 1 150px', height: 40, boxSizing: 'border-box' }}
                value={cliente.livello_antincendio ?? ''}
                onChange={(e) => patch({ livello_antincendio: (e.target.value || null) as Cliente['livello_antincendio'] })}>
                <option value="">— non definito —</option>
                <option value="1">Livello 1 — corso 4h</option>
                <option value="2">Livello 2 — corso 8h</option>
                <option value="3">Livello 3 — corso 16h</option>
              </select>
              <input type="text" placeholder="Definito mediante"
                style={{ flex: '1 1 150px', height: 40, boxSizing: 'border-box' }}
                value={cliente.antincendio_definito_mediante ?? ''}
                onChange={(e) => patch({ antincendio_definito_mediante: e.target.value || null })} />
            </div>
          </div>
          {/* primo soccorso */}
          <div>
            <div style={{ color: 'var(--no)', fontWeight: 800, fontSize: 15, marginBottom: 6 }}>
              Gruppo primo soccorso
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
              <button type="button" className="bo-btn ghost"
                style={{ height: 40, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center' }}
                onClick={() => setWizardPS(true)}>
                Determina col flusso
              </button>
              <div style={{
                flex: '1 1 150px', height: 40, boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 10, fontSize: 14,
                ...(cliente.gruppo_primo_soccorso
                  ? { background: gruppoColore(cliente.gruppo_primo_soccorso), color: '#fff', fontWeight: 800 }
                  : { background: 'var(--paper)', color: 'var(--faint)', border: '1px solid var(--line)', fontWeight: 600 }),
              }}>
                {cliente.gruppo_primo_soccorso
                  ? `${cliente.gruppo_primo_soccorso === 'BC' ? 'Gruppi B/C' : 'Gruppo ' + cliente.gruppo_primo_soccorso} · ${cliente.gruppo_primo_soccorso === 'A' ? '16h' : '12h'}`
                  : '— non definito —'}
              </div>
            </div>
            {cliente.gruppo_primo_soccorso && (
              <div style={{ fontSize: 12, marginTop: 6 }}>
                {cliente.primo_soccorso_definito_mediante
                  ? <span style={{ color: 'var(--ink-soft)' }}>Definito mediante: {cliente.primo_soccorso_definito_mediante}</span>
                  : <span style={{ color: 'var(--hi-dark)' }}>
                      Definito manualmente (nessuna motivazione registrata) — usa «Determina col flusso» per registrarla.
                    </span>}
              </div>
            )}
          </div>
        </div>
        {wizardPS && (
          <WizardPrimoSoccorso
            addettiIniziali={nPersone}
            onScegli={(g, motivazione) => {
              patch({ gruppo_primo_soccorso: g, primo_soccorso_definito_mediante: motivazione });
              setWizardPS(false);
            }}
            onChiudi={() => setWizardPS(false)}
          />
        )}

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

        {/* Sedi: fanno parte dell'anagrafica del cliente */}
        {persistito && (
          <div className="bo-subsez">
            <div className="bo-subsez-tit">Sedi{(() => { const n = sedi.filter((s) => !s.principale).length; return n ? ` · ${n} operativ${n === 1 ? 'a' : 'e'}` : ''; })()}</div>
            <SediCliente clienteId={cliente.id} sedi={sedi} onCambia={ricaricaSedi} />
          </div>
        )}
      </Sezione>

      {/* --- risorse umane: personale del cliente (superset dell'organigramma) --- */}
      {persistito && (
        <Sezione titolo="Risorse Umane" tema="risorse"
          sommario={nPersone == null ? undefined : nPersone === 0 ? 'nessuna persona' : `${nPersone} ${nPersone === 1 ? 'persona' : 'persone'}`}
          aperta={aperte.has('risorse')} onToggle={() => toggle('risorse')}>
          <RisorseUmane clienteId={cliente.id}
            onCambia={() => setOrgRefresh((n) => n + 1)}
            onConteggio={setNPersone} />
        </Sezione>
      )}

      {/* --- organigramma sicurezza / formazione del cliente --- */}
      {persistito && (
        <Sezione titolo="Organigramma sicurezza" tema="organigramma" sommario="figure, nomine e stato formazione"
          aperta={aperte.has('organigramma')} onToggle={() => toggle('organigramma')}>
          <OrganigrammaCliente clienteId={cliente.id} refreshToken={orgRefresh} />
        </Sezione>
      )}

      {/* --- incarichi del cliente: sola lettura; si creano/pianificano nel tab Incarichi --- */}
      {persistito && (
        <Sezione titolo="Incarichi" tema="incarichi"
          sommario={`${incarichi.length} ${incarichi.length === 1 ? 'incarico' : 'incarichi'}` +
            (incarichi.length ? ` · ${incarichi.filter((r) => r.incarico.stato === 'attivo').length} attivi` : '')}
          aperta={aperte.has('incarichi')} onToggle={() => toggle('incarichi')}>
          {incarichi.length === 0 ? (
            <div className="bo-note">
              Nessun incarico per questo cliente. Gli incarichi si creano e si pianificano nel tab Incarichi.
            </div>
          ) : (
            <>
              {incarichi.map(({ incarico: i, creati }) => (
                <div key={i.id} className={`bo-card flat ${i.stato === 'attivo' ? '' : 'dim'}`} style={{ marginBottom: 8 }}>
                  <div className="bo-row">
                    <div className="grow">
                      <div className="bo-title">{i.tipo_attivita || 'Incarico'}</div>
                      <div className="bo-meta">
                        <span>{descriviCadenza(i)}</span>
                        <span>{i.periodo_inizio ? fmtData(i.periodo_inizio) : '—'} → {i.periodo_fine ? fmtData(i.periodo_fine) : '—'}</span>
                        {i.durata_seduta_stimata_min != null && <span>{i.durata_seduta_stimata_min} min/seduta</span>}
                        {i.sede_id && <span>{sedi.find((s) => s.id === i.sede_id)?.nome ?? 'sede'}</span>}
                        <span>{creati}/{i.n_sopralluoghi} pianificati</span>
                      </div>
                    </div>
                    <span className={`bo-pill ${i.stato === 'attivo' ? 'attivo' : 'archiviato'}`}>{i.stato}</span>
                  </div>
                </div>
              ))}
              <p className="bo-sub" style={{ margin: '4px 0 0' }}>
                In sola lettura: gli incarichi si creano e si pianificano nel tab Incarichi.
              </p>
            </>
          )}
        </Sezione>
      )}

      {/* --- scadenzario del cliente: copia di "Cose da fare" filtrata su questo cliente --- */}
      {persistito && (
        <Sezione titolo="Scadenzario" tema="scadenzario" sommario="formazione, documenti, autorizzazioni e attività"
          aperta={aperte.has('scadenzario')} onToggle={() => toggle('scadenzario')}>
          <CoseDaFare clienteId={cliente.id} />
        </Sezione>
      )}

    </div>
  );
}

// Descrizione compatta della cadenza di un incarico: cadenza esplicita se
// presente, altrimenti numero fisso di sopralluoghi.
function descriviCadenza(i: { cadenza_valore: number | null; cadenza_unita: string | null; n_sopralluoghi: number }): string {
  if (i.cadenza_valore != null && i.cadenza_unita) {
    const v = i.cadenza_valore;
    return `ogni ${v} ${i.cadenza_unita}`;
  }
  return `${i.n_sopralluoghi} ${i.n_sopralluoghi === 1 ? 'sopralluogo' : 'sopralluoghi'} (numero fisso)`;
}

// Data ISO (yyyy-mm-dd) -> gg/mm/aaaa.
function fmtData(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// Sezione apri/chiudi (accordion) della scheda cliente. Indipendente: piu'
// sezioni possono restare aperte insieme. Il corpo si monta solo da aperto.
function Sezione({ titolo, sommario, aperta, onToggle, children, tema }: {
  titolo: string; sommario?: string; aperta: boolean;
  onToggle: () => void; children: ReactNode; tema?: string;
}) {
  return (
    <div className={`bo-acc acc-${tema ?? 'neutro'} ${aperta ? 'open' : ''}`}>
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
    try {
      await salvaSede(s);
      // L'unico organigramma del cliente segue la sede operativa: riallinea le persone.
      await allineaPersoneOrganigramma(s.cliente_id);
      onCambia(); if (nuova) setS(sedeVuota(sede.cliente_id));
    }
    catch (e) { setMsg((e as Error)?.message ?? 'Salvataggio non riuscito.'); }
    finally { setBusy(false); }
  }
  async function toggle() {
    setBusy(true); setMsg(null);
    try {
      await impostaStatoSede(sede.id, !sede.attivo);
      await allineaPersoneOrganigramma(sede.cliente_id);
      onCambia();
    }
    catch { setMsg('Operazione non riuscita.'); }
    finally { setBusy(false); }
  }
  async function elimina() {
    if (!window.confirm('Eliminare definitivamente la sede operativa \u00ab' + (sede.nome || '') + '\u00bb? Le persone eventualmente collegate tornano alla sede legale.')) return;
    setBusy(true); setMsg(null);
    try {
      await eliminaSede(sede.id);
      await allineaPersoneOrganigramma(sede.cliente_id);
      onCambia();
    }
    catch (e) { setMsg((e as Error)?.message ?? 'Eliminazione non riuscita.'); setBusy(false); }
  }

  return (
    <div className={`bo-card ${s.attivo ? '' : 'dim'}`} style={{ marginBottom: 8 }}>
      {msg && <div className="bo-err">{msg}</div>}
      <div className="bo-grid">
        <label className="bo-field">
          <span>Nome sede</span>
          <input type="text" value={s.nome}
            onChange={(e) => setS({ ...s, nome: e.target.value.toUpperCase() })}
            placeholder="es. STABILIMENTO 1, MAGAZZINO" />
        </label>
        <label className="bo-field" style={{ marginBottom: 0 }}>
          <span>Indirizzo</span>
          <input type="text" value={s.indirizzo ?? ''}
            onChange={(e) => setS({ ...s, indirizzo: e.target.value.toUpperCase() || null })} />
        </label>
      </div>
      <div className="bo-grid" style={{ gridTemplateColumns: '1fr 2fr 0.7fr' }}>
        <label className="bo-field" style={{ marginBottom: 0 }}>
          <span>CAP</span>
          <input type="text" value={s.cap ?? ''} inputMode="numeric" maxLength={5}
            onChange={(e) => setS({ ...s, cap: e.target.value.replace(/\D/g, '').slice(0, 5) || null })} />
        </label>
        <label className="bo-field" style={{ marginBottom: 0 }}>
          <span>Localita</span>
          <input type="text" value={s.localita ?? ''}
            onChange={(e) => setS({ ...s, localita: e.target.value.toUpperCase() || null })} />
        </label>
        <label className="bo-field" style={{ marginBottom: 0 }}>
          <span>Prov.</span>
          <input type="text" value={s.provincia ?? ''} maxLength={2}
            onChange={(e) => setS({ ...s, provincia: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || null })} />
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
        {!nuova && (
          <button className="bo-btn danger sm" onClick={() => void elimina()} disabled={busy}>
            Elimina
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
  // Al massimo UNA sede operativa per cliente, aggiunta solo quando la legale non e'
  // nella disponibilita' dell'azienda. La legale si gestisce dall'anagrafica.
  const operative = sedi.filter((s) => !s.principale);
  const haOperativaAttiva = operative.some((s) => s.attivo);
  return (
    <>
      <div className="bo-row" style={{ margin: '0 0 6px' }}>
        <span className="grow" />
        {!agg && !haOperativaAttiva && <button className="bo-btn sm" onClick={() => setAgg(true)}>+ Aggiungi sede operativa</button>}
      </div>
      <p className="bo-sub" style={{ margin: '0 0 10px' }}>
        Aggiungi una sede operativa solo se la sede legale non e' nella disponibilita' dell'azienda (es. sede del commercialista). L'organigramma del cliente e' uno solo e vive su questa sede.
      </p>
      {haOperativaAttiva && (
        <p className="bo-sub" style={{ margin: '-4px 0 10px', color: 'var(--ink-soft,#8a8f98)' }}>
          Serve un'altra sede operativa? Crea una nuova anagrafica (bottone <strong>Copia</strong> nella lista clienti): ogni sede operativa in piu' e' un'anagrafica a se'.
        </p>
      )}

      {agg && (
        <RigaSede sede={sedeVuota(clienteId)}
          onCambia={() => { onCambia(); setAgg(false); }} />
      )}
      {operative.length === 0 && !agg && (
        <div className="bo-empty">Nessuna sede operativa: la sede legale coincide con l'operativa.</div>
      )}
      {operative.map((s) => <RigaSede key={s.id} sede={s} onCambia={onCambia} />)}
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

  const proposto = ris?.livello ?? null;          // rischio proposto dall'ATECO
  const effettivo = livello ?? proposto;           // cosa mostra il bottone
  const puoApplicare = proposto != null && proposto !== livello;

  return (
    <div style={{ marginTop: 12 }}>
      {/* stessa riga: codice ATECO · testo descrittivo · bottone grande RISCHIO */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="bo-field" style={{ position: 'relative', flex: '1 1 240px', marginBottom: 0 }}>
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
        </div>

        {/* testo descrittivo, ora sulla stessa riga del codice */}
        <div style={{ flex: '2 1 260px', fontSize: 12.5, color: 'var(--ink-soft)', paddingBottom: 4 }}>
          {ris ? (
            <>Div. {ris.divisione} (sez. {ris.sezione}) · {ris.descrizione}</>
          ) : testo.trim() ? (
            <span style={{ color: 'var(--faint)' }}>Divisione non classificata nell'Allegato IV — verifica il codice.</span>
          ) : (
            <span style={{ color: 'var(--faint)' }}>Nessun codice: seleziona un'attività per proporre il rischio.</span>
          )}
        </div>

        {/* bottone grande con indicazione del RISCHIO */}
        <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
          <button
            type="button"
            disabled={!puoApplicare}
            onClick={() => proposto && onPatch({ livello_rischio: proposto })}
            title={puoApplicare ? 'Applica il rischio proposto dall\u2019ATECO' : 'Livello di rischio del cliente'}
            style={{
              background: effettivo ? coloreRischio(effettivo) : 'var(--faint)',
              color: '#fff', border: 'none', borderRadius: 12, cursor: puoApplicare ? 'pointer' : 'default',
              fontFamily: 'inherit', fontWeight: 800, fontSize: 15, letterSpacing: '.03em',
              padding: '12px 20px', minWidth: 140, opacity: effettivo ? 1 : .7,
            }}>
            RISCHIO<br />{effettivo ? ETICHETTA_RISCHIO[effettivo] : '—'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--ink-soft)' }}>
        Livello di rischio impostato:{' '}
        {livello
          ? <b style={{ color: coloreRischio(livello) }}>{ETICHETTA_RISCHIO[livello]}</b>
          : <span style={{ color: 'var(--faint)' }}>non impostato</span>}
        {puoApplicare && <> · proposto <b style={{ color: coloreRischio(proposto!) }}>{ETICHETTA_RISCHIO[proposto!]}</b> dall'ATECO (usa il bottone)</>}
        {' '}· modificabile anche dall'organigramma del cliente.
      </div>
    </div>
  );
}

// Colore identificativo del gruppo di primo soccorso (A alto, C basso).
function gruppoColore(g: 'A' | 'B' | 'C' | 'BC'): string {
  return g === 'A' ? 'var(--no)' : g === 'C' ? 'var(--ok)' : 'var(--hi-dark)';
}

// Tabella completa dei codici di tariffa INAIL con l'Indice di Frequenza
// Inabilita' Permanente (allegata al flusso SOLVE, Rev 22.08.2024). Serve al
// passo INAIL del wizard: si sceglie il codice dell'azienda e l'app determina
// da se' se l'indice supera 4.
const INAIL_TARIFFE: { codice: string; desc: string; indice: number }[] = [
  { codice: '0100', desc: 'Attività commerciali', indice: 2.36 },
  { codice: '0200', desc: 'Turismo e ristorazione', indice: 2.54 },
  { codice: '0300', desc: 'Sanità e servizi sociali', indice: 1.28 },
  { codice: '0400', desc: 'Pulizie e nettezza urbana', indice: 5.57 },
  { codice: '0500', desc: 'Cinema e spettacoli', indice: 2.94 },
  { codice: '0600', desc: 'Istruzione e ricerca', indice: 1.11 },
  { codice: '0700', desc: 'Uffici e altre attività', indice: 0.72 },
  { codice: '1100', desc: 'Lavorazioni meccanico-agricole', indice: 10.84 },
  { codice: '1200', desc: 'Mattazione e macellazione - Pesca', indice: 6.41 },
  { codice: '1400', desc: 'Produzione di alimenti', indice: 3.57 },
  { codice: '2100', desc: 'Chimica, plastica e gomma', indice: 2.76 },
  { codice: '2200', desc: 'Carta e poligrafia', indice: 2.73 },
  { codice: '2300', desc: 'Pelli e cuoi', indice: 2.97 },
  { codice: '3100', desc: 'Costruzioni edili', indice: 8.6 },
  { codice: '3200', desc: 'Costruzioni idrauliche', indice: 9.12 },
  { codice: '3300', desc: 'Strade e ferrovie', indice: 7.55 },
  { codice: '3400', desc: 'Linee e condotte urbane', indice: 9.67 },
  { codice: '3500', desc: 'Fondazioni speciali', indice: 12.39 },
  { codice: '3600', desc: 'Impianti', indice: 5.43 },
  { codice: '4100', desc: 'Energia elettrica', indice: 2.2 },
  { codice: '4200', desc: 'Comunicazioni', indice: 2.07 },
  { codice: '4300', desc: 'Gasdotti e oleodotti', indice: 2.16 },
  { codice: '4400', desc: 'Impianti acqua e vapore', indice: 4.11 },
  { codice: '5100', desc: 'Prima lavorazione legname', indice: 7.95 },
  { codice: '5200', desc: 'Falegnameria e restauro', indice: 7.18 },
  { codice: '5300', desc: 'Materiali affini al legno', indice: 5.02 },
  { codice: '6100', desc: 'Metallurgia', indice: 5.74 },
  { codice: '6200', desc: 'Metalmeccanica', indice: 4.48 },
  { codice: '6300', desc: 'Macchine', indice: 3.32 },
  { codice: '6400', desc: 'Mezzi di trasporto', indice: 3.91 },
  { codice: '6500', desc: 'Strumenti e apparecchi', indice: 1.57 },
  { codice: '7100', desc: 'Geologia e mineraria', indice: 8.4 },
  { codice: '7200', desc: 'Lavorazione delle rocce', indice: 6.55 },
  { codice: '7300', desc: 'Lavorazione del vetro', indice: 4.65 },
  { codice: '8100', desc: 'Lavorazioni tessili', indice: 2.4 },
  { codice: '8200', desc: 'Confezioni', indice: 1.4 },
  { codice: '9100', desc: 'Trasporti', indice: 4.93 },
  { codice: '9200', desc: 'Facchinaggio', indice: 15.99 },
  { codice: '9300', desc: 'Magazzini', indice: 3.32 },
];

// Coppia Sì / No.
function SiNo({ val, onVal }: { val: boolean | null; onVal: (b: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button type="button" className={`bo-btn sm ${val === true ? '' : 'ghost'}`} onClick={() => onVal(true)}>Sì</button>
      <button type="button" className={`bo-btn sm ${val === false ? '' : 'ghost'}`} onClick={() => onVal(false)}>No</button>
    </div>
  );
}

// --- Wizard "gruppo di primo soccorso" (DM 388/2003) — flusso guidato SOLVE ---
// Una domanda alla volta, nell'ordine del flowchart. Nessun gruppo proposto di
// default: l'esito compare solo quando le risposte bastano.
//   Q1 Seveso/estrattiva/sotterraneo/esplosivi?  Sì -> A.
//   No -> Q2 Agricoltura?  Sì -> chiede addetti (>5 A, 3-5 B, <3 C).
//   No -> Q3 codici tariffa INAIL dell'azienda; se un indice > 4 -> chiede
//        addetti (>5 A, 3-5 B, <3 C); altrimenti addetti (>=3 B, <3 C).
function WizardPrimoSoccorso({ addettiIniziali, onScegli, onChiudi }: {
  addettiIniziali: number | null;
  onScegli: (g: 'A' | 'B' | 'C', motivazione: string) => void;
  onChiudi: () => void;
}) {
  const addettiDefault = () => (addettiIniziali != null ? String(addettiIniziali) : '');
  const [seveso, setSeveso] = useState<boolean | null>(null);
  const [agricoltura, setAgricoltura] = useState<boolean | null>(null);
  const [codici, setCodici] = useState<string[]>([]);
  const [inailConfermato, setInailConfermato] = useState(false);
  const [addetti, setAddetti] = useState<string>(addettiDefault);

  function ricomincia() {
    setSeveso(null); setAgricoltura(null); setCodici([]);
    setInailConfermato(false); setAddetti(addettiDefault());
  }

  const n = addetti.trim() === '' ? null : Number(addetti);
  const addettiTxt = (k: number) => `${k} addett${k === 1 ? 'o' : 'i'}`;
  const tariffeSel = codici
    .map((c) => INAIL_TARIFFE.find((t) => t.codice === c))
    .filter((t): t is typeof INAIL_TARIFFE[number] => !!t);
  const primoAlto = tariffeSel.find((t) => t.indice > 4) ?? null;

  // esito calcolato solo quando le risposte sono sufficienti
  let esito: { gruppo: 'A' | 'B' | 'C'; motivazione: string } | null = null;
  if (seveso === true) {
    esito = { gruppo: 'A', motivazione: 'Azienda soggetta a Direttiva Seveso, estrattiva/mineraria, lavori in sotterraneo o fabbricazione esplosivi' };
  } else if (seveso === false && agricoltura === true && n != null) {
    const g = n > 5 ? 'A' : n >= 3 ? 'B' : 'C';
    esito = { gruppo: g, motivazione: `Comparto agricoltura, ${addettiTxt(n)}` };
  } else if (seveso === false && agricoltura === false && inailConfermato && n != null) {
    if (primoAlto) {
      const g = n > 5 ? 'A' : n >= 3 ? 'B' : 'C';
      esito = { gruppo: g, motivazione: `Codice tariffa INAIL ${primoAlto.codice} (${primoAlto.desc}) a indice ${primoAlto.indice.toFixed(2)} > 4, ${addettiTxt(n)}` };
    } else {
      const g = n >= 3 ? 'B' : 'C';
      esito = { gruppo: g, motivazione: `Nessun codice tariffa INAIL a indice > 4, ${addettiTxt(n)}` };
    }
  }

  const labelDomanda: React.CSSProperties = { fontWeight: 700, fontSize: 13.5, marginBottom: 6 };
  const chiedeAddetti =
    (seveso === false && agricoltura === true) ||
    (seveso === false && agricoltura === false && inailConfermato);

  return (
    <div className="bo-card" style={{ marginTop: 12, borderColor: 'var(--hi)' }}>
      <div className="bo-row" style={{ marginBottom: 8 }}>
        <div className="grow"><div className="bo-title">Determina il gruppo di primo soccorso</div></div>
        <button className="bo-btn ghost sm" onClick={ricomincia}>Ricomincia</button>
        <button className="bo-btn ghost sm" onClick={onChiudi}>Chiudi</button>
      </div>
      <p className="bo-sub" style={{ marginTop: 0 }}>
        Rispondi seguendo il flusso (DM 388/2003): il gruppo si determina passo dopo passo.
      </p>

      {/* Q1 - Seveso & simili */}
      <div style={{ marginBottom: 14 }}>
        <div style={labelDomanda}>
          1. Azienda soggetta a Direttiva Seveso, oppure estrattiva/mineraria, con lavori
          in sotterraneo o che fabbrica esplosivi?
        </div>
        <SiNo val={seveso} onVal={setSeveso} />
      </div>

      {/* Q2 - Agricoltura */}
      {seveso === false && (
        <div style={{ marginBottom: 14 }}>
          <div style={labelDomanda}>2. L'azienda appartiene al comparto agricoltura?</div>
          <SiNo val={agricoltura} onVal={(b) => { setAgricoltura(b); setInailConfermato(false); }} />
        </div>
      )}

      {/* Q3 - codici tariffa INAIL (solo se non agricoltura) */}
      {seveso === false && agricoltura === false && (
        <div style={{ marginBottom: 14 }}>
          <div style={labelDomanda}>3. Codici di tariffa INAIL dell'azienda</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <select value="" style={{ flex: '1 1 260px' }}
              onChange={(e) => {
                const c = e.target.value;
                if (c && !codici.includes(c)) setCodici([...codici, c]);
              }}>
              <option value="">+ aggiungi un codice…</option>
              {INAIL_TARIFFE.filter((t) => !codici.includes(t.codice)).map((t) => (
                <option key={t.codice} value={t.codice}>
                  {t.codice} — {t.desc} (indice {t.indice.toFixed(2)})
                </option>
              ))}
            </select>
          </div>
          {codici.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {tariffeSel.map((t) => {
                const alto = t.indice > 4;
                return (
                  <span key={t.codice} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5,
                    background: alto ? 'var(--no-bg)' : 'var(--paper)',
                    border: `1px solid ${alto ? 'var(--no)' : 'var(--line)'}`,
                    color: alto ? 'var(--no)' : 'var(--ink)',
                    borderRadius: 999, padding: '3px 10px',
                  }}>
                    {t.codice} · {t.indice.toFixed(2)}{alto ? ' > 4' : ''}
                    <button type="button" onClick={() => setCodici(codici.filter((c) => c !== t.codice))}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 800 }}>×</button>
                  </span>
                );
              })}
            </div>
          )}
          {!inailConfermato && (
            <button type="button" className="bo-btn sm" onClick={() => setInailConfermato(true)}>
              Conferma codici
            </button>
          )}
          {inailConfermato && (
            <div className="bo-note" style={{ marginTop: 0 }}>
              {primoAlto
                ? `Presente un codice a indice > 4 (${primoAlto.codice}).`
                : 'Nessun codice a indice > 4.'}
            </div>
          )}
        </div>
      )}

      {/* addetti */}
      {chiedeAddetti && (
        <label className="bo-field" style={{ maxWidth: 220, marginBottom: 14 }}>
          <span>Numero addetti</span>
          <input type="number" min={0} inputMode="numeric" value={addetti}
            onChange={(e) => setAddetti(e.target.value.replace(/\D/g, ''))} />
        </label>
      )}

      {/* esito */}
      {esito && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          padding: '12px 14px', borderRadius: 12,
          background: '#fff', border: `1px solid ${gruppoColore(esito.gruppo)}`,
        }}>
          <div style={{
            background: gruppoColore(esito.gruppo), color: '#fff', fontWeight: 800, fontSize: 20,
            borderRadius: 10, padding: '8px 18px', minWidth: 60, textAlign: 'center',
          }}>{esito.gruppo}</div>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>
            <b>Gruppo {esito.gruppo}</b> — corso addetto primo soccorso {esito.gruppo === 'A' ? '16h' : '12h'}.<br />
            <span style={{ color: 'var(--ink-soft)' }}>{esito.motivazione}</span>
          </div>
          <button className="bo-btn" onClick={() => onScegli(esito!.gruppo, esito!.motivazione)}>
            Usa gruppo {esito.gruppo}
          </button>
        </div>
      )}
    </div>
  );
}
