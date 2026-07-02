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
  // Wizard "gruppo primo soccorso" (flusso DM 388/2003).
  const [wizardPS, setWizardPS] = useState(false);

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
          <div>
            <div style={{ color: 'var(--no)', fontWeight: 800, fontSize: 15, marginBottom: 6 }}>
              Livello rischio incendio
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select style={{ flex: '1 1 150px' }} value={cliente.livello_antincendio ?? ''}
                onChange={(e) => patch({ livello_antincendio: (e.target.value || null) as Cliente['livello_antincendio'] })}>
                <option value="">— non definito —</option>
                <option value="1">Livello 1 — corso 4h</option>
                <option value="2">Livello 2 — corso 8h</option>
                <option value="3">Livello 3 — corso 16h</option>
              </select>
              <label className="bo-field" style={{ flex: '1 1 150px', margin: 0 }}>
                <span>Definito mediante</span>
                <input type="text" value={cliente.antincendio_definito_mediante ?? ''}
                  onChange={(e) => patch({ antincendio_definito_mediante: e.target.value || null })} />
              </label>
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--no)', fontWeight: 800, fontSize: 15, marginBottom: 6 }}>
              Gruppo primo soccorso
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select style={{ flex: '1 1 150px' }} value={cliente.gruppo_primo_soccorso ?? ''}
                onChange={(e) => patch({ gruppo_primo_soccorso: (e.target.value || null) as Cliente['gruppo_primo_soccorso'] })}>
                <option value="">— non definito —</option>
                <option value="A">Gruppo A — corso 16h</option>
                <option value="B">Gruppo B — corso 12h</option>
                <option value="C">Gruppo C — corso 12h</option>
                {cliente.gruppo_primo_soccorso === 'BC' && <option value="BC">Gruppi B/C — corso 12h</option>}
              </select>
              <button type="button" className="bo-btn ghost sm" onClick={() => setWizardPS(true)}>
                Determina col flusso
              </button>
            </div>
          </div>
        </div>
        {wizardPS && (
          <WizardPrimoSoccorso
            addettiIniziali={nPersone}
            onScegli={(g) => { patch({ gruppo_primo_soccorso: g }); setWizardPS(false); }}
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

      {/* --- organigramma sicurezza / formazione del cliente --- */}
      {persistito && (
        <Sezione titolo="Organigramma sicurezza" sommario="figure, nomine e stato formazione"
          aperta={aperte.has('organigramma')} onToggle={() => toggle('organigramma')}>
          <OrganigrammaCliente clienteId={cliente.id} refreshToken={orgRefresh} />
        </Sezione>
      )}

      {/* --- incarichi del cliente: sola lettura; si creano/pianificano nel tab Incarichi --- */}
      {persistito && (
        <Sezione titolo="Incarichi"
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
        <Sezione titolo="Scadenzario" sommario="formazione, documenti, autorizzazioni e attività"
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

// --- Wizard "gruppo di primo soccorso" (DM 388/2003), replica il flusso SOLVE ---
// A: Seveso/estrattiva/mineraria/sotterraneo/esplosivi; oppure (agricoltura o
//    codici tariffa INAIL con indice inab. perm. > 4) con oltre 5 addetti.
// B: quei comparti con 3-5 addetti; oppure gli altri con 3+ addetti.
// C: meno di 3 addetti (fuori dai casi A).
function calcolaGruppoPS(x: { seveso: boolean; agricoltura: boolean; inailAlto: boolean; addetti: number }): 'A' | 'B' | 'C' {
  if (x.seveso) return 'A';
  const altoRischio = x.agricoltura || x.inailAlto;
  if (altoRischio) {
    if (x.addetti > 5) return 'A';
    if (x.addetti >= 3) return 'B';
    return 'C';
  }
  if (x.addetti >= 3) return 'B';
  return 'C';
}

// Codici di tariffa INAIL con Indice di Frequenza Inabilita' Permanente > 4
// (tabella allegata al flusso SOLVE, Rev 22.08.2024).
const CODICI_INAIL_ALTI: [string, string, string][] = [
  ['0400', 'Pulizie e nettezza urbana', '5,57'],
  ['1100', 'Lavorazioni meccanico-agricole', '10,84'],
  ['1200', 'Mattazione e macellazione - Pesca', '6,41'],
  ['3100', 'Costruzioni edili', '8,60'],
  ['3200', 'Costruzioni idrauliche', '9,12'],
  ['3300', 'Strade e ferrovie', '7,55'],
  ['3400', 'Linee e condotte urbane', '9,67'],
  ['3500', 'Fondazioni speciali', '12,39'],
  ['3600', 'Impianti', '5,43'],
  ['4400', 'Impianti acqua e vapore', '4,11'],
  ['5100', 'Prima lavorazione legname', '7,95'],
  ['5200', 'Falegnameria e restauro', '7,18'],
  ['5300', 'Materiali affini al legno', '5,02'],
  ['6100', 'Metallurgia', '5,74'],
  ['6200', 'Metalmeccanica', '4,48'],
  ['7100', 'Geologia e mineraria', '8,40'],
  ['7200', 'Lavorazione delle rocce', '6,55'],
  ['7300', 'Lavorazione del vetro', '4,65'],
  ['9100', 'Trasporti', '4,93'],
  ['9200', 'Facchinaggio', '15,99'],
];

const COLORE_GRUPPO: Record<'A' | 'B' | 'C', string> = {
  A: 'var(--no)', B: 'var(--hi-dark)', C: 'var(--ok)',
};

function WizardPrimoSoccorso({ addettiIniziali, onScegli, onChiudi }: {
  addettiIniziali: number | null;
  onScegli: (g: 'A' | 'B' | 'C') => void;
  onChiudi: () => void;
}) {
  const [seveso, setSeveso] = useState(false);
  const [agricoltura, setAgricoltura] = useState(false);
  const [inailAlto, setInailAlto] = useState(false);
  const [addetti, setAddetti] = useState<string>(addettiIniziali != null ? String(addettiIniziali) : '');
  const [tabella, setTabella] = useState(false);

  const n = Number(addetti) || 0;
  const gruppo = calcolaGruppoPS({ seveso, agricoltura, inailAlto, addetti: n });

  return (
    <div className="bo-card" style={{ marginTop: 12, borderColor: 'var(--hi)' }}>
      <div className="bo-row" style={{ marginBottom: 8 }}>
        <div className="grow"><div className="bo-title">Determina il gruppo di primo soccorso</div></div>
        <button className="bo-btn ghost sm" onClick={onChiudi}>Chiudi</button>
      </div>
      <p className="bo-sub" style={{ marginTop: 0 }}>
        Rispondi alle domande: il gruppo (DM 388/2003) si calcola secondo il flusso.
      </p>

      <label className="chk" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
        <input type="checkbox" checked={seveso} onChange={(e) => setSeveso(e.target.checked)} />
        <span>Azienda soggetta a Direttiva Seveso, oppure estrattiva/mineraria, o con lavori
          in sotterraneo, o che fabbrica esplosivi.</span>
      </label>
      <label className="chk" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
        <input type="checkbox" checked={agricoltura} onChange={(e) => setAgricoltura(e.target.checked)} />
        <span>Appartiene al comparto <b>agricoltura</b>.</span>
      </label>
      <label className="chk" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 4 }}>
        <input type="checkbox" checked={inailAlto} onChange={(e) => setInailAlto(e.target.checked)} />
        <span>Ci sono addetti con codici di tariffa INAIL a indice di inabilità permanente &gt; 4.</span>
      </label>
      <button type="button" className="bo-btn ghost sm" style={{ margin: '0 0 10px 28px' }}
        onClick={() => setTabella((v) => !v)}>
        {tabella ? 'Nascondi' : 'Mostra'} i codici a indice &gt; 4
      </button>
      {tabella && (
        <div style={{
          margin: '0 0 12px', maxHeight: 190, overflowY: 'auto', border: '1px solid var(--line)',
          borderRadius: 10, background: '#fff', fontSize: 12.5,
        }}>
          {CODICI_INAIL_ALTI.map(([c, d, v]) => (
            <div key={c} style={{ display: 'flex', gap: 10, padding: '5px 10px', borderBottom: '1px solid var(--line)' }}>
              <b style={{ minWidth: 38 }}>{c}</b>
              <span style={{ flex: 1 }}>{d}</span>
              <span style={{ color: 'var(--ink-soft)' }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <label className="bo-field" style={{ maxWidth: 220 }}>
        <span>Numero addetti</span>
        <input type="number" min={0} inputMode="numeric" value={addetti}
          onChange={(e) => setAddetti(e.target.value.replace(/\D/g, ''))} />
      </label>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        marginTop: 6, padding: '12px 14px', borderRadius: 12,
        background: '#fff', border: `1px solid ${COLORE_GRUPPO[gruppo]}`,
      }}>
        <div style={{
          background: COLORE_GRUPPO[gruppo], color: '#fff', fontWeight: 800, fontSize: 20,
          borderRadius: 10, padding: '8px 18px', minWidth: 64, textAlign: 'center',
        }}>{gruppo}</div>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>
          Gruppo <b>{gruppo}</b> — corso addetto primo soccorso {gruppo === 'A' ? '16h' : '12h'}.
        </div>
        <button className="bo-btn" onClick={() => onScegli(gruppo)}>Usa gruppo {gruppo}</button>
      </div>
    </div>
  );
}
