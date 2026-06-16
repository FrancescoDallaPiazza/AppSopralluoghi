// Back-office - tab "Formazione / Organigramma sicurezza".
// Per cliente: organigramma (persone + figure), stato formativo con semafori e
// promemoria di esonero per il campo, registrazione esoneri, e generazione
// delle cose da fare per i gap verso lo scadenzario. In fondo, editor dei
// promemoria di esonero ammessi (per rifinire senza aprire il dashboard).
//
// File nuovo, autoconsistente: i tipi e la logica vivono in
// src/lib/admin/formazione.ts. L'aggancio al menu sta in BackOffice.tsx.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  type Catalogo, type RiepilogoCliente, type PersonaValutata, type RequisitoValutato,
  type StatoRequisito, type Persona, type Nomina, type Formazione, type Esonero,
  type EsoneroAmmesso, type AreaInterna, type LivelloRischio, type TipoEsonero,
  type CosaDaFareProposta,
  caricaCatalogo, caricaAreeInterne, valutaCliente,
  salvaPersona, eliminaPersona, salvaNomina, eliminaNomina,
  salvaFormazione, salvaEsonero,
  salvaEsoneroAmmesso, eliminaEsoneroAmmesso,
  proponiCoseDaFare, generaCoseDaFare,
  nomePersona,
} from '../lib/admin/formazione';

interface ClienteLite { id: string; ragione_sociale: string; livello_rischio: LivelloRischio | null; }

const COLORI: Record<StatoRequisito, { fg: string; bg: string; testo: string }> = {
  conforme:    { fg: '#15803d', bg: '#e9f6ee', testo: 'Conforme' },
  in_scadenza: { fg: '#b45309', bg: '#fdf3e3', testo: 'In scadenza' },
  critico:     { fg: '#b91c1c', bg: '#fbecec', testo: 'Critico' },
  esonerato:   { fg: '#1d4ed8', bg: '#e8eefc', testo: 'Esonerato' },
};

const TIPI_ESONERO: TipoEsonero[] = [
  'titolo_studio', 'abilitazione', 'ruolo_equipollente', 'credito_pregresso', 'altro',
];

function Pillola({ stato }: { stato: StatoRequisito }) {
  const c = COLORI[stato];
  return (
    <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 9px', borderRadius: 8, color: c.fg, background: c.bg, whiteSpace: 'nowrap' }}>
      {c.testo}
    </span>
  );
}

export default function Formazione() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [clienti, setClienti] = useState<ClienteLite[]>([]);
  const [aree, setAree] = useState<AreaInterna[]>([]);
  const [clienteId, setClienteId] = useState<string>('');
  const [riep, setRiep] = useState<RiepilogoCliente | null>(null);
  const [caricando, setCaricando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // editor / pannelli
  const [editPersona, setEditPersona] = useState<Persona | null>(null);
  const [editFormazione, setEditFormazione] = useState<Formazione | null>(null);
  const [editEsonero, setEditEsonero] = useState<Esonero | null>(null);
  const [editNominePersonaId, setEditNominePersonaId] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [catalogoOpen, setCatalogoOpen] = useState(false);

  const cliente = useMemo(() => clienti.find((c) => c.id === clienteId) ?? null, [clienti, clienteId]);

  useEffect(() => {
    (async () => {
      try {
        const [cat, ar, cli] = await Promise.all([
          caricaCatalogo(),
          caricaAreeInterne(),
          supabase.from('cliente').select('id, ragione_sociale, livello_rischio')
            .eq('attivo', true).order('ragione_sociale'),
        ]);
        if (cli.error) throw cli.error;
        setCatalogo(cat);
        setAree(ar);
        setClienti((cli.data ?? []) as ClienteLite[]);
      } catch (e: any) {
        setErrore(e?.message ?? String(e));
      }
    })();
  }, []);

  async function ricarica() {
    if (!clienteId || !catalogo) { setRiep(null); return; }
    setCaricando(true); setErrore(null);
    try {
      setRiep(await valutaCliente(clienteId, catalogo));
    } catch (e: any) {
      setErrore(e?.message ?? String(e));
    } finally {
      setCaricando(false);
    }
  }
  useEffect(() => { ricarica(); /* eslint-disable-next-line */ }, [clienteId, catalogo]);

  async function setRischio(v: LivelloRischio | null) {
    if (!clienteId) return;
    const { error } = await supabase.from('cliente').update({ livello_rischio: v }).eq('id', clienteId);
    if (error) { setErrore(error.message); return; }
    setClienti((arr) => arr.map((c) => (c.id === clienteId ? { ...c, livello_rischio: v } : c)));
    ricarica();
  }

  // ---------- intestazione ----------
  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '8px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Formazione e organigramma</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={{ minWidth: 240, padding: 6 }}>
            <option value="">- scegli cliente -</option>
            {clienti.map((c) => <option key={c.id} value={c.id}>{c.ragione_sociale}</option>)}
          </select>
          {cliente && (
            <select value={cliente.livello_rischio ?? ''} onChange={(e) => setRischio((e.target.value || null) as LivelloRischio | null)} style={{ padding: 6 }} title="Livello di rischio del cliente">
              <option value="">rischio: n.d.</option>
              <option value="basso">rischio basso</option>
              <option value="medio">rischio medio</option>
              <option value="alto">rischio alto</option>
            </select>
          )}
        </div>
      </div>

      {errore && <div style={{ background: '#fbecec', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{errore}</div>}

      {!clienteId && <p style={{ color: '#666', fontSize: 14 }}>Scegli un cliente per vederne l'organigramma e lo stato formativo.</p>}
      {caricando && <p style={{ color: '#666', fontSize: 14 }}>Caricamento...</p>}

      {riep && cliente && (
        <>
          {/* contatori */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
            <Metrica etichetta="Persone" valore={riep.persone.length} />
            <Metrica etichetta="Conformi" valore={riep.conteggi.conforme} colore={COLORI.conforme.fg} />
            <Metrica etichetta="In scadenza" valore={riep.conteggi.in_scadenza} colore={COLORI.in_scadenza.fg} />
            <Metrica etichetta="Critici" valore={riep.conteggi.critico} colore={COLORI.critico.fg} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <button onClick={() => setEditPersona(nuovaPersona(clienteId))}>+ Aggiungi persona</button>
            <button onClick={() => setGenOpen((v) => !v)} disabled={!riep.persone.length}>Genera cose da fare per i gap</button>
          </div>

          {!cliente.livello_rischio && (
            <div style={{ background: '#fdf3e3', color: '#b45309', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
              Livello di rischio non impostato: le ore della formazione specifica lavoratori non possono essere calcolate.
            </div>
          )}

          {genOpen && (
            <PannelloGenerazione
              riep={riep} aree={aree} clienteId={clienteId}
              onChiudi={() => setGenOpen(false)}
              onFatto={(n) => { setGenOpen(false); setErrore(null); alert(n + ' cose da fare create nello scadenzario.'); }}
            />
          )}

          {/* organigramma + stato per persona */}
          {riep.persone.length === 0 && <p style={{ color: '#666', fontSize: 14 }}>Nessuna persona in organigramma. Aggiungine una per iniziare.</p>}
          {riep.persone.map((pv) => (
            <SchedaPersona
              key={pv.persona.id} pv={pv} catalogo={catalogo!}
              onModificaPersona={() => setEditPersona(pv.persona)}
              onModificaNomine={() => setEditNominePersonaId(pv.persona.id)}
              onAggiungiAttestato={() => setEditFormazione(nuovaFormazione(pv.persona.id))}
              onRegistraEsonero={(r) => setEditEsonero(nuovoEsonero(pv.persona.id, r))}
            />
          ))}

          {/* editor catalogo esoneri ammessi */}
          <div style={{ marginTop: 24, borderTop: '1px solid #e5e5e5', paddingTop: 12 }}>
            <button onClick={() => setCatalogoOpen((v) => !v)} style={{ fontSize: 13 }}>
              {catalogoOpen ? 'Nascondi' : 'Mostra'} catalogo esoneri ammessi (promemoria in campo)
            </button>
            {catalogoOpen && catalogo && (
              <EditorEsoneriAmmessi catalogo={catalogo} onCambia={(ea) => setCatalogo({ ...catalogo, esoneriAmmessi: ea })} />
            )}
          </div>
        </>
      )}

      {/* form modali */}
      {editPersona && catalogo && (
        <FormPersona
          persona={editPersona}
          onAnnulla={() => setEditPersona(null)}
          onSalva={async (p) => { await salvaPersona(p); setEditPersona(null); ricarica(); }}
          onElimina={editPersona.id ? async () => { if (confirm('Eliminare la persona e tutti i suoi dati formativi?')) { await eliminaPersona(editPersona.id); setEditPersona(null); ricarica(); } } : undefined}
        />
      )}
      {editNominePersonaId && catalogo && riep && (
        <FormNomine
          catalogo={catalogo}
          persona={riep.persone.find((p) => p.persona.id === editNominePersonaId)!.persona}
          figureAttuali={riep.persone.find((p) => p.persona.id === editNominePersonaId)!.figure.map((f) => f.codice)}
          onChiudi={() => { setEditNominePersonaId(null); ricarica(); }}
        />
      )}
      {editFormazione && catalogo && (
        <FormFormazione
          catalogo={catalogo} formazione={editFormazione}
          onAnnulla={() => setEditFormazione(null)}
          onSalva={async (f) => { await salvaFormazione(f); setEditFormazione(null); ricarica(); }}
        />
      )}
      {editEsonero && catalogo && (
        <FormEsonero
          catalogo={catalogo} esonero={editEsonero}
          onAnnulla={() => setEditEsonero(null)}
          onSalva={async (e) => { await salvaEsonero(e); setEditEsonero(null); ricarica(); }}
        />
      )}
    </div>
  );
}

// ============================ SOTTO-COMPONENTI ============================

function Metrica({ etichetta, valore, colore }: { etichetta: string; valore: number; colore?: string }) {
  return (
    <div style={{ background: '#f5f5f3', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 13, color: '#666' }}>{etichetta}</div>
      <div style={{ fontSize: 24, fontWeight: 500, color: colore ?? '#222' }}>{valore}</div>
    </div>
  );
}

function SchedaPersona({
  pv, catalogo, onModificaPersona, onModificaNomine, onAggiungiAttestato, onRegistraEsonero,
}: {
  pv: PersonaValutata; catalogo: Catalogo;
  onModificaPersona: () => void; onModificaNomine: () => void;
  onAggiungiAttestato: () => void; onRegistraEsonero: (r: RequisitoValutato) => void;
}) {
  const [aperta, setAperta] = useState(true);
  const c = COLORI[pv.stato];
  const iniziali = nomePersona(pv.persona).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ border: '1px solid #e5e5e5', borderRadius: 12, padding: '12px 14px', marginBottom: 12, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, fontSize: 13 }}>{iniziali}</div>
          <div>
            <div style={{ fontWeight: 500 }}>{nomePersona(pv.persona)}</div>
            <div style={{ marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {pv.figure.length === 0 && <span style={{ fontSize: 12, color: '#999' }}>nessuna figura</span>}
              {pv.figure.map((f) => <span key={f.codice} style={{ fontSize: 12, padding: '2px 9px', borderRadius: 999, border: '1px solid #ddd', color: '#555' }}>{f.nome}</span>)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Pillola stato={pv.stato} />
          <button onClick={() => setAperta((v) => !v)} style={{ fontSize: 12 }}>{aperta ? 'comprimi' : 'espandi'}</button>
        </div>
      </div>

      {aperta && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, margin: '6px 0 4px', flexWrap: 'wrap' }}>
            <button style={{ fontSize: 12 }} onClick={onModificaPersona}>Dati persona</button>
            <button style={{ fontSize: 12 }} onClick={onModificaNomine}>Figure / nomine</button>
            <button style={{ fontSize: 12 }} onClick={onAggiungiAttestato}>+ Attestato</button>
          </div>

          {pv.requisiti.length === 0 && <div style={{ fontSize: 13, color: '#999', padding: '6px 0' }}>Nessun requisito: assegna almeno una figura.</div>}

          {pv.requisiti.map((r) => (
            <div key={r.corso_codice} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid #f0f0f0', fontSize: 13 }}>
              <div style={{ flex: 1 }}>
                <div>
                  {r.corso_nome}
                  {r.ore != null && <span style={{ color: '#888' }}> - {r.ore}h</span>}
                  {!r.obbligatorio && <span style={{ color: '#999' }}> (facoltativo)</span>}
                </div>
                <div style={{ color: '#777', fontSize: 12, marginTop: 2 }}>{r.dettaglio}</div>
                {r.promemoria.map((a) => (
                  <div key={a.id} style={{ display: 'flex', gap: 6, fontSize: 12, color: '#1d4ed8', background: '#e8eefc', padding: '5px 8px', borderRadius: 8, marginTop: 5, lineHeight: 1.4 }}>
                    <span>i</span>
                    <span>{a.descrizione}{a.riferimento_norm ? ' - ' + a.riferimento_norm : ''}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <Pillola stato={r.stato} />
                {r.stato !== 'esonerato' && r.promemoria.length > 0 && (
                  <button style={{ fontSize: 11 }} onClick={() => onRegistraEsonero(r)}>registra esonero</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PannelloGenerazione({
  riep, aree, clienteId, onChiudi, onFatto,
}: {
  riep: RiepilogoCliente; aree: AreaInterna[]; clienteId: string;
  onChiudi: () => void; onFatto: (n: number) => void;
}) {
  const [includiInScadenza, setIncludi] = useState(true);
  const [versoArea, setVersoArea] = useState(true);
  const areaFormazione = aree.find((a) => /formazione/i.test(a.nome));
  const [areaId, setAreaId] = useState<string>(areaFormazione?.id ?? aree[0]?.id ?? '');
  const proposte = useMemo<CosaDaFareProposta[]>(() => proponiCoseDaFare(riep, includiInScadenza), [riep, includiInScadenza]);
  const [salvando, setSalvando] = useState(false);

  return (
    <div style={{ border: '1px solid #e5e5e5', borderRadius: 12, padding: '12px 14px', marginBottom: 14, background: '#fafafa' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>{proposte.length} cose da fare proposte</strong>
        <button style={{ fontSize: 12 }} onClick={onChiudi}>chiudi</button>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '8px 0', fontSize: 13 }}>
        <label><input type="checkbox" checked={includiInScadenza} onChange={(e) => setIncludi(e.target.checked)} /> includi anche le scadenze imminenti</label>
        <label><input type="radio" checked={versoArea} onChange={() => setVersoArea(true)} /> verso area interna</label>
        {versoArea && (
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            {aree.length === 0 && <option value="">- nessuna area -</option>}
            {aree.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        )}
        <label><input type="radio" checked={!versoArea} onChange={() => setVersoArea(false)} /> verso il cliente</label>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', margin: '6px 0' }}>
        {proposte.map((p, i) => (
          <div key={i} style={{ fontSize: 12, padding: '4px 0', borderTop: '1px solid #eee' }}>
            <span style={{ color: '#888' }}>{p.priorita}</span> - {p.descrizione}
          </div>
        ))}
        {proposte.length === 0 && <div style={{ fontSize: 13, color: '#666' }}>Nessun gap: tutto conforme o esonerato.</div>}
      </div>
      <button
        disabled={salvando || proposte.length === 0 || (versoArea && !areaId)}
        onClick={async () => {
          setSalvando(true);
          try {
            const n = await generaCoseDaFare(proposte, { includiInScadenza, versoArea, areaId: versoArea ? areaId : null, clienteId: versoArea ? null : clienteId });
            onFatto(n);
          } catch (e: any) {
            alert('Errore: ' + (e?.message ?? String(e)));
          } finally { setSalvando(false); }
        }}
      >
        {salvando ? 'Creazione...' : 'Crea nello scadenzario'}
      </button>
    </div>
  );
}

// ---------- form ----------

function Modale({ titolo, children }: { titolo: string; children: any }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 500 }}>{titolo}</h3>
        {children}
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: any }) {
  return (
    <label style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>
      <span style={{ display: 'block', color: '#555', marginBottom: 3 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = { width: '100%', padding: 7, boxSizing: 'border-box' as const, fontSize: 14 };

function FormPersona({ persona, onSalva, onAnnulla, onElimina }: {
  persona: Persona; onSalva: (p: Persona) => void; onAnnulla: () => void; onElimina?: () => void;
}) {
  const [p, setP] = useState<Persona>(persona);
  return (
    <Modale titolo={persona.id ? 'Modifica persona' : 'Nuova persona'}>
      <Campo label="Nome"><input style={inputStyle} value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} /></Campo>
      <Campo label="Cognome"><input style={inputStyle} value={p.cognome ?? ''} onChange={(e) => setP({ ...p, cognome: e.target.value })} /></Campo>
      <Campo label="Codice fiscale"><input style={inputStyle} value={p.codice_fiscale ?? ''} onChange={(e) => setP({ ...p, codice_fiscale: e.target.value })} /></Campo>
      <Campo label="Mansione"><input style={inputStyle} value={p.mansione ?? ''} onChange={(e) => setP({ ...p, mansione: e.target.value })} /></Campo>
      <Campo label="Reparto"><input style={inputStyle} value={p.reparto ?? ''} onChange={(e) => setP({ ...p, reparto: e.target.value })} /></Campo>
      <Campo label="Rischio (override del cliente)">
        <select style={inputStyle} value={p.livello_rischio ?? ''} onChange={(e) => setP({ ...p, livello_rischio: (e.target.value || null) as LivelloRischio | null })}>
          <option value="">eredita dal cliente</option>
          <option value="basso">basso</option><option value="medio">medio</option><option value="alto">alto</option>
        </select>
      </Campo>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <div>{onElimina && <button style={{ color: '#b91c1c' }} onClick={onElimina}>Elimina</button>}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onAnnulla}>Annulla</button>
          <button disabled={!p.nome.trim()} onClick={() => onSalva(p)}>Salva</button>
        </div>
      </div>
    </Modale>
  );
}

function FormNomine({ catalogo, persona, figureAttuali, onChiudi }: {
  catalogo: Catalogo; persona: Persona; figureAttuali: string[]; onChiudi: () => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(figureAttuali));
  const [salvando, setSalvando] = useState(false);
  const toggle = (cod: string) => setSel((s) => { const n = new Set(s); n.has(cod) ? n.delete(cod) : n.add(cod); return n; });

  async function salva() {
    setSalvando(true);
    try {
      // carica nomine attuali per sapere cosa aggiungere/togliere
      const { data } = await supabase.from('nomina').select('*').eq('persona_id', persona.id);
      const attuali = (data ?? []) as Nomina[];
      const attualiCod = new Set(attuali.map((n) => n.figura_codice));
      // aggiungi le nuove
      for (const cod of sel) {
        if (!attualiCod.has(cod)) {
          await salvaNomina({ id: '', persona_id: persona.id, figura_codice: cod, data_nomina: null, attiva: true, note: null });
        }
      }
      // elimina quelle deselezionate
      for (const n of attuali) {
        if (!sel.has(n.figura_codice)) await eliminaNomina(n.id);
      }
      onChiudi();
    } finally { setSalvando(false); }
  }

  return (
    <Modale titolo={'Figure di ' + nomePersona(persona)}>
      <div style={{ fontSize: 13 }}>
        {catalogo.figure.filter((f) => f.attiva).map((f) => (
          <label key={f.codice} style={{ display: 'block', padding: '4px 0' }}>
            <input type="checkbox" checked={sel.has(f.codice)} onChange={() => toggle(f.codice)} /> {f.nome}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button onClick={onChiudi}>Annulla</button>
        <button disabled={salvando} onClick={salva}>{salvando ? 'Salvataggio...' : 'Salva'}</button>
      </div>
    </Modale>
  );
}

function FormFormazione({ catalogo, formazione, onSalva, onAnnulla }: {
  catalogo: Catalogo; formazione: Formazione; onSalva: (f: Formazione) => void; onAnnulla: () => void;
}) {
  const [f, setF] = useState<Formazione>(formazione);
  function scegliCorso(codice: string) {
    const c = catalogo.corsi.find((x) => x.codice === codice);
    setF({ ...f, corso_codice: codice || null, corso_nome: c?.nome ?? f.corso_nome, categoria: c?.categoria ?? f.categoria });
  }
  return (
    <Modale titolo="Attestato / corso svolto">
      <Campo label="Corso (dal catalogo)">
        <select style={inputStyle} value={f.corso_codice ?? ''} onChange={(e) => scegliCorso(e.target.value)}>
          <option value="">- libero / fuori catalogo -</option>
          {catalogo.corsi.filter((c) => c.attivo).map((c) => <option key={c.codice} value={c.codice}>{c.nome}</option>)}
        </select>
      </Campo>
      <Campo label="Nome corso"><input style={inputStyle} value={f.corso_nome} onChange={(e) => setF({ ...f, corso_nome: e.target.value })} /></Campo>
      <Campo label="Data completamento"><input type="date" style={inputStyle} value={f.data_completamento ?? ''} onChange={(e) => setF({ ...f, data_completamento: e.target.value })} /></Campo>
      <Campo label="Ore"><input type="number" style={inputStyle} value={f.ore ?? ''} onChange={(e) => setF({ ...f, ore: e.target.value === '' ? null : Number(e.target.value) })} /></Campo>
      <Campo label="Ente formatore"><input style={inputStyle} value={f.ente_formatore ?? ''} onChange={(e) => setF({ ...f, ente_formatore: e.target.value })} /></Campo>
      <Campo label="Scadenza (lascia vuoto = calcolata dal catalogo)"><input type="date" style={inputStyle} value={f.scadenza ?? ''} onChange={(e) => setF({ ...f, scadenza: e.target.value })} /></Campo>
      <label style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
        <input type="checkbox" checked={f.is_aggiornamento} onChange={(e) => setF({ ...f, is_aggiornamento: e.target.checked })} /> e' un aggiornamento
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onAnnulla}>Annulla</button>
        <button disabled={!f.corso_nome.trim()} onClick={() => onSalva(f)}>Salva</button>
      </div>
    </Modale>
  );
}

function FormEsonero({ catalogo, esonero, onSalva, onAnnulla }: {
  catalogo: Catalogo; esonero: Esonero; onSalva: (e: Esonero) => void; onAnnulla: () => void;
}) {
  const [e, setE] = useState<Esonero>(esonero);
  return (
    <Modale titolo="Registra esonero / credito">
      <Campo label="Corso (vuoto = intera figura)">
        <select style={inputStyle} value={e.corso_codice ?? ''} onChange={(ev) => setE({ ...e, corso_codice: ev.target.value || null })}>
          <option value="">- intera figura -</option>
          {catalogo.corsi.filter((c) => c.attivo).map((c) => <option key={c.codice} value={c.codice}>{c.nome}</option>)}
        </select>
      </Campo>
      <Campo label="Figura (opzionale)">
        <select style={inputStyle} value={e.figura_codice ?? ''} onChange={(ev) => setE({ ...e, figura_codice: ev.target.value || null })}>
          <option value="">- qualunque -</option>
          {catalogo.figure.map((f) => <option key={f.codice} value={f.codice}>{f.nome}</option>)}
        </select>
      </Campo>
      <Campo label="Tipo">
        <select style={inputStyle} value={e.tipo} onChange={(ev) => setE({ ...e, tipo: ev.target.value as TipoEsonero })}>
          {TIPI_ESONERO.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Campo>
      <Campo label="Motivazione"><textarea style={{ ...inputStyle, minHeight: 60 }} value={e.motivazione} onChange={(ev) => setE({ ...e, motivazione: ev.target.value })} /></Campo>
      <Campo label="Riferimento normativo"><input style={inputStyle} value={e.riferimento_norm ?? ''} onChange={(ev) => setE({ ...e, riferimento_norm: ev.target.value })} /></Campo>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onAnnulla}>Annulla</button>
        <button disabled={!e.motivazione.trim() || (!e.corso_codice && !e.figura_codice)} onClick={() => onSalva(e)}>Salva</button>
      </div>
    </Modale>
  );
}

function EditorEsoneriAmmessi({ catalogo, onCambia }: { catalogo: Catalogo; onCambia: (ea: EsoneroAmmesso[]) => void; }) {
  const [lista, setLista] = useState<EsoneroAmmesso[]>(catalogo.esoneriAmmessi);
  const [edit, setEdit] = useState<EsoneroAmmesso | null>(null);

  async function salva(a: EsoneroAmmesso) {
    const salvato = await salvaEsoneroAmmesso(a);
    const nuova = lista.some((x) => x.id === salvato.id) ? lista.map((x) => (x.id === salvato.id ? salvato : x)) : [...lista, salvato];
    setLista(nuova); onCambia(nuova); setEdit(null);
  }
  async function elimina(id: string) {
    if (!confirm('Eliminare questo promemoria?')) return;
    await eliminaEsoneroAmmesso(id);
    const nuova = lista.filter((x) => x.id !== id);
    setLista(nuova); onCambia(nuova);
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button style={{ fontSize: 12, marginBottom: 8 }} onClick={() => setEdit({ id: '', corso_codice: null, figura_codice: null, tipo: 'titolo_studio', descrizione: '', riferimento_norm: null, ordine: ((lista.length ? lista[lista.length - 1].ordine : 0) + 10), attivo: true })}>+ Nuovo promemoria</button>
      {lista.map((a) => (
        <div key={a.id} style={{ fontSize: 12, padding: '6px 0', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <span style={{ color: '#888' }}>{a.corso_codice ?? a.figura_codice ?? '-'}</span> - {a.descrizione}
            {a.riferimento_norm ? ' (' + a.riferimento_norm + ')' : ''}{!a.attivo && <span style={{ color: '#b91c1c' }}> [disattivo]</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ fontSize: 11 }} onClick={() => setEdit(a)}>modifica</button>
            <button style={{ fontSize: 11, color: '#b91c1c' }} onClick={() => elimina(a.id)}>elimina</button>
          </div>
        </div>
      ))}
      {edit && (
        <Modale titolo="Promemoria di esonero ammesso">
          <Campo label="Corso (vuoto = per figura)">
            <select style={inputStyle} value={edit.corso_codice ?? ''} onChange={(ev) => setEdit({ ...edit, corso_codice: ev.target.value || null })}>
              <option value="">-</option>
              {catalogo.corsi.map((c) => <option key={c.codice} value={c.codice}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Figura (opzionale)">
            <select style={inputStyle} value={edit.figura_codice ?? ''} onChange={(ev) => setEdit({ ...edit, figura_codice: ev.target.value || null })}>
              <option value="">-</option>
              {catalogo.figure.map((f) => <option key={f.codice} value={f.codice}>{f.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Descrizione (testo mostrato in campo)"><textarea style={{ ...inputStyle, minHeight: 60 }} value={edit.descrizione} onChange={(ev) => setEdit({ ...edit, descrizione: ev.target.value })} /></Campo>
          <Campo label="Riferimento normativo"><input style={inputStyle} value={edit.riferimento_norm ?? ''} onChange={(ev) => setEdit({ ...edit, riferimento_norm: ev.target.value })} /></Campo>
          <label style={{ fontSize: 13, display: 'block', marginBottom: 10 }}><input type="checkbox" checked={edit.attivo} onChange={(ev) => setEdit({ ...edit, attivo: ev.target.checked })} /> attivo</label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setEdit(null)}>Annulla</button>
            <button disabled={!edit.descrizione.trim() || (!edit.corso_codice && !edit.figura_codice)} onClick={() => salva(edit)}>Salva</button>
          </div>
        </Modale>
      )}
    </div>
  );
}

// ---------- factory ----------

function nuovaPersona(clienteId: string): Persona {
  return { id: '', cliente_id: clienteId, nome: '', cognome: null, codice_fiscale: null, mansione: null, reparto: null, data_assunzione: null, livello_rischio: null, attivo: true, note: null };
}
function nuovaFormazione(personaId: string): Formazione {
  return { id: '', persona_id: personaId, corso_codice: null, corso_nome: '', categoria: null, data_completamento: null, ore: null, ente_formatore: null, is_aggiornamento: false, scadenza: null, allegato_url: null, note: null };
}
function nuovoEsonero(personaId: string, r?: RequisitoValutato): Esonero {
  return { id: '', persona_id: personaId, corso_codice: r?.corso_codice ?? null, figura_codice: null, tipo: 'titolo_studio', motivazione: '', riferimento_norm: r?.promemoria[0]?.riferimento_norm ?? null, documento_url: null, data_riconoscimento: null, attivo: true, note: null };
}
