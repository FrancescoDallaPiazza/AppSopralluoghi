// Back-office - tab "Formazione / Organigramma sicurezza".
// Per cliente: organigramma atteso (figure coperte/da assegnare), persone +
// figure, stato formativo con semafori e promemoria di esonero per il campo,
// registrazione esoneri, generazione cose da fare per i gap, editor dei
// promemoria. Stile allineato al back-office (classi .bo-* di ui.ts) + un
// piccolo foglio supplementare per semafori/metriche/modali (scoping .bo).

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  type Catalogo, type RiepilogoCliente, type PersonaValutata, type RequisitoValutato,
  type Persona,
  type EsoneroAmmesso, type AreaInterna, type LivelloRischio, type TipoEsonero,
  type CosaDaFareProposta, type FiguraSicurezza,
  caricaCatalogo, caricaAreeInterne, valutaCliente,
  salvaPersona, eliminaPersona, salvaNomina,
  salvaFormazione, salvaEsonero, eliminaEsonero,
  salvaEsoneroAmmesso, eliminaEsoneroAmmesso,
  proponiCoseDaFare, generaCoseDaFare,
  nomePersona,
} from '../lib/admin/formazione';

interface ClienteLite { id: string; ragione_sociale: string; livello_rischio: LivelloRischio | null; }

const TIPI_ESONERO: TipoEsonero[] = [
  'titolo_studio', 'abilitazione', 'ruolo_equipollente', 'credito_pregresso', 'altro',
];

// foglio supplementare: semafori, metriche, chip, righe requisito, modali.
const LABEL_OBBLIGO: Record<string, string> = {
  sempre: 'sempre', condizionale: 'se ricorre', eventuale: 'eventuale',
};

const LABEL_STATO: Record<string, string> = {
  conforme: 'Conforme', in_scadenza: 'In scadenza', critico: 'Critico', esonerato: 'Esonerato',
};

function periodoLabel(mesi: number | null): string {
  if (!mesi) return '';
  if (mesi % 12 === 0) { const a = mesi / 12; return a === 1 ? 'ogni anno' : `ogni ${a} anni`; }
  return `ogni ${mesi} mesi`;
}

// Specifiche ragionate di un ruolo, ricavate dal catalogo (corsi richiesti,
// periodicita di aggiornamento, esoneri ammessi). Restano sincronizzate con
// cio' che si edita nel catalogo, niente testo duplicato.
function calcolaSpec(figura: FiguraSicurezza, catalogo: Catalogo) {
  const reqs = catalogo.requisiti.filter((r) => r.figura_codice === figura.codice);
  const corsi = reqs
    .map((r) => catalogo.corsi.find((c) => c.codice === r.corso_codice))
    .filter((c): c is (typeof catalogo.corsi)[number] => !!c);

  const formazione = corsi.map((c) => ({
    nome: c.nome,
    base: c.ore != null ? `${c.ore}h` : 'ore secondo attrezzatura/settore',
    agg: c.aggiornamento_mesi
      ? `aggiornamento ${c.ore_aggiornamento ?? '?'}h ${periodoLabel(c.aggiornamento_mesi)}`
      : 'nessun aggiornamento periodico',
    note: c.note,
  }));

  const periodi = Array.from(new Set(
    corsi.filter((c) => c.aggiornamento_mesi).map((c) => periodoLabel(c.aggiornamento_mesi)),
  ));
  const scadenza = periodi.length
    ? `Aggiornamento ${periodi.join(' / ')}; la scadenza decorre dalla data dell'attestato.`
    : 'Nessuna scadenza periodica (formazione permanente).';

  const codici = new Set(corsi.map((c) => c.codice));
  const rilevanti = catalogo.esoneriAmmessi.filter(
    (e) => e.attivo && (e.figura_codice === figura.codice || (e.corso_codice != null && codici.has(e.corso_codice))),
  );
  const haEsoneri = rilevanti.some((e) => e.tipo !== 'altro');
  const haModuli = rilevanti.some((e) => e.tipo === 'altro');

  return { formazione, scadenza, haEsoneri, haModuli };
}

const CSS_FZ = `
.fz-metrics{display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:14px;}
.fz-metric{background:#fff; border:1px solid var(--line); border-radius:14px; padding:13px 15px;}
.fz-metric .k{font-size:12px; color:var(--ink-soft);}
.fz-metric .v{font-size:23px; font-weight:800; margin-top:2px;}
.fz-sem{font-size:10.5px; font-weight:800; letter-spacing:.04em; padding:3px 8px; border-radius:6px; text-transform:uppercase; white-space:nowrap;}
.fz-sem.conforme{background:var(--ok-bg); color:var(--ok);}
.fz-sem.in_scadenza{background:#fbf0d6; color:var(--hi-dark);}
.fz-sem.critico{background:var(--no-bg); color:var(--no);}
.fz-sem.esonerato{background:#e7eefb; color:#27508f;}
.fz-chip{font-size:11.5px; padding:3px 9px; border-radius:999px; border:1px solid var(--line); color:var(--ink-soft);}
.fz-req{display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:9px 0; border-top:1px solid var(--line);}
.fz-req .d{font-size:12px; color:var(--ink-soft); margin-top:2px;}
.fz-hint{display:flex; gap:7px; font-size:12px; color:#27508f; background:#eef3fc; border:1px solid #d7e3f7; padding:6px 9px; border-radius:9px; margin-top:6px; line-height:1.4;}
.fz-cover{display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 0; border-top:1px solid var(--line); font-size:13.5px;}
.fz-cover:first-child{border-top:none;}
.fz-grp{margin-top:14px;}
.fz-grp:first-of-type{margin-top:2px;}
.fz-grp-h{font-size:11px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-soft); margin-bottom:2px;}
.fz-fig{padding:9px 0; border-top:1px solid var(--line);}
.fz-fig-top{display:flex; align-items:center; justify-content:space-between; gap:10px;}
.fz-fig-nome{font-size:13.5px; font-weight:600; display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.fz-badge{font-size:9.5px; font-weight:800; padding:2px 7px; border-radius:999px; text-transform:uppercase; letter-spacing:.04em;}
.fz-badge.sempre{background:var(--ok-bg); color:var(--ok);}
.fz-badge.condizionale{background:#fbf0d6; color:var(--hi-dark);}
.fz-badge.eventuale{background:#eef1f4; color:var(--ink-soft);}
.fz-guida{font-size:12px; color:var(--ink-soft); margin-top:7px; line-height:1.45; max-width:66ch; font-style:italic;}
.fz-assignee{margin-top:7px; padding:7px 11px; border-radius:9px; font-size:12.5px;}
.fz-assignee.filled{background:#eaf4ee; border:1px solid #cfe6d8; color:#1f5b38;}
.fz-assignee.empty{background:#f6f2ea; border:1px dashed var(--line); color:var(--ink-soft);}
.fz-assignee-lab{font-weight:800; text-transform:uppercase; font-size:10px; letter-spacing:.04em; margin-right:7px;}
.fz-fig-body{display:flex; gap:16px; align-items:flex-start; margin-top:7px; flex-wrap:wrap;}
.fz-fig-main{flex:3 1 360px; min-width:0;}
.fz-fig-people{flex:1 1 240px; min-width:0; max-width:340px; display:flex; flex-direction:column; gap:8px;}
.fz-person-box{background:#eaf4ee; border:1px solid #cfe6d8; border-radius:9px; padding:8px 10px; font-size:12.5px; color:#1f5b38;}
.fz-person-head{display:flex; align-items:center; justify-content:space-between; gap:8px;}
.fz-person-box .nm{font-weight:700;}
.fz-person-act{display:flex; gap:10px; align-items:center; flex:0 0 auto;}
.fz-person-ev{display:flex; flex-direction:column; gap:5px; margin-top:6px;}
.fz-ev-row{display:flex; align-items:flex-start; justify-content:space-between; gap:6px;}
.fz-ev-corso{font-size:11px; line-height:1.25;}
.fz-ev-det{font-size:10.5px; color:#3d6b4f; margin-top:1px;}
.fz-st{font-size:9px; font-weight:800; padding:2px 6px; border-radius:999px; text-transform:uppercase; letter-spacing:.03em; white-space:nowrap; flex:0 0 auto;}
.st-conforme{background:#e7f3ea; color:#1f7a3d;}
.st-in_scadenza{background:#fbf0d6; color:#9a6206;}
.st-critico{background:#fbe3e0; color:#a33227;}
.st-esonerato{background:#eef1f4; color:#5b5f66;}
.fz-person-empty{background:#f6f2ea; border:1px dashed var(--line); border-radius:9px; padding:8px 10px; font-size:12.5px; color:var(--ink-soft);}
.fz-specs{margin-top:9px; display:grid; gap:9px;}
.fz-spec-t{font-size:10.5px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:var(--ink-soft); margin-bottom:2px;}
.fz-spec-v{font-size:12px; color:var(--ink); line-height:1.45; max-width:72ch;}
.fz-spec-note{color:var(--ink-soft);}
.fz-assignee-list{display:flex; flex-wrap:wrap; gap:6px 14px; align-items:center;}
.fz-assignee-chip{display:inline-flex; align-items:center;}
.ev-link{background:none; border:none; color:#2563aa; font-size:11px; cursor:pointer; padding:0 0 0 6px; text-decoration:underline;}
.ev-card{border:1px solid var(--line); border-radius:12px; padding:12px; margin-bottom:10px; background:var(--card,#fff);}
.ev-head{display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px; font-size:14px;}
.ev-ore{color:var(--ink-soft); font-weight:400;}
.ev-step{font-size:10.5px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:var(--ink-soft); margin:8px 0 4px;}
.ev-choice{display:flex; gap:8px; flex-wrap:wrap; margin:6px 0;}
.bo-btn.on{background:var(--ink); color:#fff;}
.ev-box{border-top:1px solid var(--line); margin-top:8px; padding-top:8px;}
.ev-eson-ok{background:#eaf4ee; border:1px solid #cfe6d8; color:#1f5b38; border-radius:9px; padding:9px 11px; font-size:12.5px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;}
.ev-note{font-size:12px; color:var(--ink-soft); margin-top:4px;}
.ev-mod{padding-top:4px;}
.ev-mod + .ev-mod{border-top:1px solid var(--line); margin-top:8px; padding-top:8px;}
.fz-av{width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12.5px; flex:0 0 auto;}
.fz-modal-bg{position:fixed; inset:0; background:rgba(20,16,12,.42); display:flex; align-items:center; justify-content:center; z-index:50; padding:16px;}
.fz-modal{background:#fff; border:1px solid var(--line); border-radius:14px; padding:18px; width:min(560px,100%); max-height:90vh; overflow:auto;}
`;

export default function Formazione() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [clienti, setClienti] = useState<ClienteLite[]>([]);
  const [aree, setAree] = useState<AreaInterna[]>([]);
  const [clienteId, setClienteId] = useState<string>('');
  const [riep, setRiep] = useState<RiepilogoCliente | null>(null);
  const [caricando, setCaricando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [editPersona, setEditPersona] = useState<Persona | null>(null);
  const [assegnaFigura, setAssegnaFigura] = useState<FiguraSicurezza | null>(null);
  const [evidenzeFor, setEvidenzeFor] = useState<{ personaId: string; figuraCodice: string } | null>(null);
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

  // copertura delle figure (organigramma atteso)
  const copertura = useMemo(() => {
    if (!catalogo || !riep) return [];
    return catalogo.figure
      .filter((f) => f.attiva)
      .map((f) => ({
        figura: f,
        persone: riep.persone.filter((p) => p.figure.some((x) => x.codice === f.codice)).map((p) => nomePersona(p.persona)),
      }));
  }, [catalogo, riep]);

  // raggruppamento per blocco logico (checklist ragionata)
  const gruppiCopertura = useMemo(() => {
    const out: { nome: string; righe: typeof copertura }[] = [];
    for (const row of copertura) {
      const g = row.figura.gruppo || 'Altre figure';
      let grp = out.find((x) => x.nome === g);
      if (!grp) { grp = { nome: g, righe: [] }; out.push(grp); }
      grp.righe.push(row);
    }
    return out;
  }, [copertura]);

  return (
    <>
      <style>{CSS_FZ}</style>

      <div className="bo-row" style={{ marginBottom: 14, gap: 14, flexWrap: 'wrap' }}>
        <div className="grow">
          <h2 className="bo-h">Formazione e organigramma</h2>
          <p className="bo-sub" style={{ margin: 0 }}>Stato formativo del personale per cliente.</p>
        </div>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={{ minWidth: 240, width: 'auto' }}>
          <option value="">— scegli cliente —</option>
          {clienti.map((c) => <option key={c.id} value={c.id}>{c.ragione_sociale}</option>)}
        </select>
        {cliente && (
          <select value={cliente.livello_rischio ?? ''} style={{ width: 'auto' }}
            onChange={(e) => setRischio((e.target.value || null) as LivelloRischio | null)} title="Livello di rischio">
            <option value="">rischio: n.d.</option>
            <option value="basso">rischio basso</option>
            <option value="medio">rischio medio</option>
            <option value="alto">rischio alto</option>
          </select>
        )}
      </div>

      {errore && <div className="bo-err">{errore}</div>}
      {!clienteId && <div className="bo-empty">Scegli un cliente per vederne l'organigramma e lo stato formativo.</div>}
      {caricando && <div className="bo-empty">Carico…</div>}

      {riep && cliente && (
        <>
          <div className="fz-metrics">
            <div className="fz-metric"><div className="k">Persone</div><div className="v">{riep.persone.length}</div></div>
            <div className="fz-metric"><div className="k">Conformi</div><div className="v" style={{ color: 'var(--ok)' }}>{riep.conteggi.conforme}</div></div>
            <div className="fz-metric"><div className="k">In scadenza</div><div className="v" style={{ color: 'var(--hi-dark)' }}>{riep.conteggi.in_scadenza}</div></div>
            <div className="fz-metric"><div className="k">Critici</div><div className="v" style={{ color: 'var(--no)' }}>{riep.conteggi.critico}</div></div>
          </div>

          <div className="bo-bar" style={{ marginTop: 0, marginBottom: 14 }}>
            <button className="bo-btn" onClick={() => setEditPersona(nuovaPersona(clienteId))}>+ Aggiungi persona</button>
            <button className="bo-btn ghost" onClick={() => setGenOpen((v) => !v)} disabled={!riep.persone.length}>Genera cose da fare per i gap</button>
          </div>

          {!cliente.livello_rischio && (
            <div className="bo-note">Livello di rischio non impostato: le ore della formazione specifica lavoratori non possono essere calcolate.</div>
          )}

          {/* organigramma atteso */}
          <div className="bo-card">
            <div className="bo-title" style={{ marginBottom: 4 }}>Organigramma atteso</div>
            <p className="bo-sub" style={{ marginTop: 0, marginBottom: 10 }}>
              Checklist ragionata: figure per blocco, con quando scattano e cosa serve (fonte: quadro obblighi ASR 17/04/2025).
            </p>
            {copertura.length === 0 && <div className="bo-sub" style={{ margin: 0 }}>Nessuna figura a catalogo (verifica il seed di figura_sicurezza).</div>}
            {gruppiCopertura.map((g) => (
              <div key={g.nome} className="fz-grp">
                <div className="fz-grp-h">{g.nome}</div>
                {g.righe.map(({ figura, persone }) => {
                  const spec = catalogo ? calcolaSpec(figura, catalogo) : null;
                  const assegnate = riep?.persone.filter((pv) => pv.figure.some((f) => f.codice === figura.codice)) ?? [];
                  const reqCodici = new Set(catalogo?.requisiti.filter((r) => r.figura_codice === figura.codice).map((r) => r.corso_codice) ?? []);
                  return (
                  <div key={figura.codice} className="fz-fig">
                    <div className="fz-fig-top">
                      <span className="fz-fig-nome">
                        {figura.nome}
                        {figura.obbligo && <span className={'fz-badge ' + figura.obbligo}>{LABEL_OBBLIGO[figura.obbligo] ?? figura.obbligo}</span>}
                      </span>
                      <button className="bo-btn ghost sm" onClick={() => setAssegnaFigura(figura)}>
                        {persone.length > 0 ? 'modifica' : 'assegna'}
                      </button>
                    </div>

                    <div className="fz-fig-body">
                      <div className="fz-fig-main">
                        {figura.guida && <div className="fz-guida">{figura.guida}</div>}
                        {spec && (
                          <div className="fz-specs">
                            <div className="fz-spec">
                              <div className="fz-spec-t">Formazione richiesta (base + aggiornamento)</div>
                              {spec.formazione.length === 0
                                ? <div className="fz-spec-v">Nessun corso a catalogo per questa figura.</div>
                                : spec.formazione.map((f, i) => (
                                    <div key={i} className="fz-spec-v">
                                      <b>{f.nome}</b> &mdash; {f.base}; {f.agg}
                                      {f.note ? <span className="fz-spec-note"> &middot; {f.note}</span> : null}
                                    </div>
                                  ))}
                            </div>
                            <div className="fz-spec">
                              <div className="fz-spec-t">Eventuale scadenza</div>
                              <div className="fz-spec-v">{spec.scadenza}</div>
                            </div>
                            {(spec.haEsoneri || spec.haModuli) && (
                              <div className="fz-spec">
                                <div className="fz-spec-t">Esoneri / crediti previsti</div>
                                <div className="fz-spec-v">
                                  {spec.haModuli ? 'Esoneri/crediti ed eventuale modulo aggiuntivo' : 'Esoneri/crediti'} si valutano per persona dal link evidenze.
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="fz-fig-people">
                        <div className="fz-spec-t">Incaricati</div>
                        {assegnate.length > 0
                          ? assegnate.map((pv) => (
                              <div key={pv.persona.id} className="fz-person-box">
                                <div className="fz-person-head">
                                  <span className="nm">{nomePersona(pv.persona)}</span>
                                  <span className="fz-person-act">
                                    <button className="ev-link" onClick={() => setEditPersona(pv.persona)}>modifica</button>
                                    <button className="ev-link" onClick={() => setEvidenzeFor({ personaId: pv.persona.id, figuraCodice: figura.codice })}>evidenze</button>
                                  </span>
                                </div>
                                <div className="fz-person-ev">
                                  {pv.requisiti.filter((r) => reqCodici.has(r.corso_codice)).map((r) => (
                                    <div key={r.corso_codice} className="fz-ev-item">
                                      <div className="fz-ev-row">
                                        <span className="fz-ev-corso">{r.corso_nome}</span>
                                        <span className={'fz-st st-' + r.stato}>{LABEL_STATO[r.stato] ?? r.stato}</span>
                                      </div>
                                      {r.dettaglio && <div className="fz-ev-det">{r.dettaglio}</div>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          : <div className="fz-person-empty">Nessuna persona assegnata</div>}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            ))}
          </div>

          {genOpen && (
            <PannelloGenerazione
              riep={riep} aree={aree} clienteId={clienteId}
              onChiudi={() => setGenOpen(false)}
              onFatto={(n) => { setGenOpen(false); setErrore(null); alert(n + ' cose da fare create nello scadenzario.'); }}
            />
          )}

          {riep.persone.length === 0 && <div className="bo-empty">Nessuna persona in organigramma. Aggiungine una per iniziare.</div>}

          <div style={{ marginTop: 18 }}>
            <button className="bo-btn ghost sm" onClick={() => setCatalogoOpen((v) => !v)}>
              {catalogoOpen ? 'Nascondi' : 'Mostra'} catalogo esoneri ammessi (promemoria in campo)
            </button>
            {catalogoOpen && catalogo && (
              <EditorEsoneriAmmessi catalogo={catalogo} onCambia={(ea) => setCatalogo({ ...catalogo, esoneriAmmessi: ea })} />
            )}
          </div>
        </>
      )}

      {editPersona && (
        <FormPersona
          persona={editPersona}
          onAnnulla={() => setEditPersona(null)}
          onSalva={async (p) => { await salvaPersona(p); setEditPersona(null); ricarica(); }}
          onElimina={editPersona.id ? async () => { if (confirm('Eliminare la persona e tutti i suoi dati formativi?')) { await eliminaPersona(editPersona.id); setEditPersona(null); ricarica(); } } : undefined}
        />
      )}
      {assegnaFigura && riep && (
        <FormAssegnaFigura
          figura={assegnaFigura}
          persone={riep.persone}
          clienteId={clienteId}
          onChiudi={() => { setAssegnaFigura(null); ricarica(); }}
        />
      )}
      {evidenzeFor && riep && catalogo && (() => {
        const pv = riep.persone.find((p) => p.persona.id === evidenzeFor.personaId);
        const figura = catalogo.figure.find((f) => f.codice === evidenzeFor.figuraCodice);
        if (!pv || !figura) return null;
        return (
          <EvidenzeRuolo
            pv={pv}
            figura={figura}
            catalogo={catalogo}
            onCambia={ricarica}
            onChiudi={() => setEvidenzeFor(null)}
          />
        );
      })()}
    </>
  );
}

// ============================ SOTTO-COMPONENTI ============================

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
    <div className="bo-card" style={{ borderLeft: '3px solid var(--hi)' }}>
      <div className="bo-row">
        <div className="bo-title grow">{proposte.length} cose da fare proposte</div>
        <button className="bo-btn ghost sm" onClick={onChiudi}>chiudi</button>
      </div>
      <div className="bo-bar" style={{ marginTop: 10, flexWrap: 'wrap', gap: 14 }}>
        <label className="chk"><input type="checkbox" checked={includiInScadenza} onChange={(e) => setIncludi(e.target.checked)} /> includi anche le scadenze imminenti</label>
        <label className="chk"><input type="radio" checked={versoArea} onChange={() => setVersoArea(true)} /> verso area interna</label>
        {versoArea && (
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)} style={{ width: 'auto' }}>
            {aree.length === 0 && <option value="">— nessuna area —</option>}
            {aree.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        )}
        <label className="chk"><input type="radio" checked={!versoArea} onChange={() => setVersoArea(false)} /> verso il cliente</label>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', margin: '10px 0' }}>
        {proposte.map((p, i) => (
          <div key={i} className="fz-req" style={{ fontSize: 12.5 }}>
            <span><span style={{ color: 'var(--ink-soft)' }}>{p.priorita}</span> — {p.descrizione}</span>
          </div>
        ))}
        {proposte.length === 0 && <div className="bo-sub" style={{ margin: 0 }}>Nessun gap: tutto conforme o esonerato.</div>}
      </div>
      <button
        className="bo-btn"
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
        {salvando ? 'Creazione…' : 'Crea nello scadenzario'}
      </button>
    </div>
  );
}

// ---------- modali / form ----------

function Modale({ titolo, children }: { titolo: string; children: any }) {
  return (
    <div className="fz-modal-bg">
      <div className="fz-modal">
        <div className="bo-title" style={{ fontSize: 16, marginBottom: 12 }}>{titolo}</div>
        {children}
      </div>
    </div>
  );
}

function FormPersona({ persona, onSalva, onAnnulla, onElimina }: {
  persona: Persona; onSalva: (p: Persona) => void; onAnnulla: () => void; onElimina?: () => void;
}) {
  const [p, setP] = useState<Persona>(persona);
  return (
    <Modale titolo={persona.id ? 'Modifica persona' : 'Nuova persona'}>
      <div className="bo-grid">
        <label className="bo-field"><span>Nome *</span><input type="text" value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} /></label>
        <label className="bo-field"><span>Cognome</span><input type="text" value={p.cognome ?? ''} onChange={(e) => setP({ ...p, cognome: e.target.value })} /></label>
        <label className="bo-field"><span>Codice fiscale</span><input type="text" value={p.codice_fiscale ?? ''} onChange={(e) => setP({ ...p, codice_fiscale: e.target.value })} /></label>
        <label className="bo-field"><span>Mansione</span><input type="text" value={p.mansione ?? ''} onChange={(e) => setP({ ...p, mansione: e.target.value })} /></label>
        <label className="bo-field"><span>Reparto</span><input type="text" value={p.reparto ?? ''} onChange={(e) => setP({ ...p, reparto: e.target.value })} /></label>
        <label className="bo-field"><span>Rischio (override del cliente)</span>
          <select value={p.livello_rischio ?? ''} onChange={(e) => setP({ ...p, livello_rischio: (e.target.value || null) as LivelloRischio | null })}>
            <option value="">eredita dal cliente</option>
            <option value="basso">basso</option><option value="medio">medio</option><option value="alto">alto</option>
          </select>
        </label>
      </div>
      <div className="bo-bar">
        <button className="bo-btn" disabled={!p.nome.trim()} onClick={() => onSalva(p)}>Salva</button>
        <button className="bo-btn ghost" onClick={onAnnulla}>Annulla</button>
        <span className="bo-sp" />
        {onElimina && <button className="bo-btn danger sm" onClick={onElimina}>Elimina</button>}
      </div>
    </Modale>
  );
}

function EvidenzeRuolo({ pv, figura, catalogo, onCambia, onChiudi }: {
  pv: PersonaValutata; figura: FiguraSicurezza; catalogo: Catalogo; onCambia: () => void; onChiudi: () => void;
}) {
  const codici = new Set(catalogo.requisiti.filter((r) => r.figura_codice === figura.codice).map((r) => r.corso_codice));
  const reqs = pv.requisiti.filter((r) => codici.has(r.corso_codice));
  const moduli = catalogo.esoneriAmmessi
    .filter((a) => a.attivo && a.tipo === 'altro' && a.figura_codice === figura.codice)
    .map((a) => ({ ammesso: a, corso: catalogo.corsi.find((c) => c.codice === a.corso_codice) }));
  return (
    <Modale titolo={'Evidenze: ' + figura.nome + ' \u2014 ' + nomePersona(pv.persona)}>
      {reqs.length === 0 && <div className="bo-sub" style={{ marginTop: 0 }}>Nessun corso richiesto per questo ruolo.</div>}
      {reqs.map((r) => (
        <EvidenzaRequisito key={r.corso_codice} r={r} persona={pv.persona} figura={figura} onCambia={onCambia} />
      ))}
      {moduli.length > 0 && (
        <div className="ev-card">
          <div className="ev-head"><span><b>Modulo aggiuntivo</b></span></div>
          {moduli.map((m) => (
            <ModuloAggiuntivo key={m.ammesso.id} m={m} persona={pv.persona} onCambia={onCambia} />
          ))}
        </div>
      )}
      <div className="bo-bar"><button className="bo-btn ghost" onClick={onChiudi}>Chiudi</button></div>
    </Modale>
  );
}

function EvidenzaRequisito({ r, persona, figura, onCambia }: {
  r: RequisitoValutato; persona: Persona; figura: FiguraSicurezza; onCambia: () => void;
}) {
  const [scelta, setScelta] = useState<'attesa' | 'esonero' | 'formazione'>('attesa');
  const [esonTipo, setEsonTipo] = useState<TipoEsonero>('titolo_studio');
  const [esonMot, setEsonMot] = useState('');
  const [esonRif, setEsonRif] = useState(r.promemoria[0]?.riferimento_norm ?? '');
  const [data, setData] = useState('');
  const [ore, setOre] = useState(r.ore != null ? String(r.ore) : '');
  const [ente, setEnte] = useState('');
  const [allegato, setAllegato] = useState('');
  const [agg, setAgg] = useState(false);
  const [busy, setBusy] = useState(false);

  async function registraEsonero() {
    if (!esonMot.trim()) return;
    setBusy(true);
    try {
      await salvaEsonero({
        id: '', persona_id: persona.id, corso_codice: r.corso_codice, figura_codice: figura.codice,
        tipo: esonTipo, motivazione: esonMot.trim(), riferimento_norm: esonRif.trim() || null,
        documento_url: null, data_riconoscimento: null, attivo: true, note: null,
      });
      onCambia();
    } finally { setBusy(false); }
  }
  async function rimuoviEson() {
    if (!r.esonero_id) return;
    setBusy(true);
    try { await eliminaEsonero(r.esonero_id); onCambia(); } finally { setBusy(false); }
  }
  async function registraAttestato() {
    if (!data) return;
    setBusy(true);
    try {
      await salvaFormazione({
        id: '', persona_id: persona.id, corso_codice: r.corso_codice, corso_nome: r.corso_nome, categoria: r.categoria,
        data_completamento: data, ore: ore === '' ? null : Number(ore), ente_formatore: ente.trim() || null,
        is_aggiornamento: agg, scadenza: null, allegato_url: allegato.trim() || null, note: null,
      });
      onCambia();
    } finally { setBusy(false); }
  }

  return (
    <div className="ev-card">
      <div className="ev-head">
        <span><b>{r.corso_nome}</b>{r.ore != null && <span className="ev-ore"> &middot; {r.ore}h</span>}</span>
        <span className={'fz-badge ' + (r.stato === 'esonerato' ? 'eventuale' : r.stato === 'conforme' ? 'sempre' : 'condizionale')}>{r.stato}</span>
      </div>

      {r.esonero_id ? (
        <div className="ev-eson-ok">
          Esonero / credito registrato per questo requisito: l'attestato non e' richiesto.
          <button className="bo-btn ghost sm" disabled={busy} onClick={rimuoviEson}>rimuovi esonero</button>
        </div>
      ) : (
        <>
          <div className="ev-step">1 &middot; Esonero / credito previsto?</div>
          {r.promemoria.filter((a) => a.tipo !== 'altro').map((a) => (
            <div key={a.id} className="fz-hint"><span aria-hidden="true">i</span><span>{a.descrizione}{a.riferimento_norm ? ' \u2014 ' + a.riferimento_norm : ''}</span></div>
          ))}
          <div className="ev-choice">
            <button className={'bo-btn ghost sm' + (scelta === 'esonero' ? ' on' : '')} onClick={() => setScelta('esonero')}>Si, c'e' un esonero/credito</button>
            <button className={'bo-btn ghost sm' + (scelta === 'formazione' ? ' on' : '')} onClick={() => setScelta('formazione')}>No, registro la formazione</button>
          </div>

          {scelta === 'esonero' && (
            <div className="ev-box">
              <div className="bo-grid">
                <label className="bo-field"><span>Tipo</span>
                  <select value={esonTipo} onChange={(e) => setEsonTipo(e.target.value as TipoEsonero)}>{TIPI_ESONERO.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                </label>
                <label className="bo-field"><span>Riferimento normativo</span><input type="text" value={esonRif} onChange={(e) => setEsonRif(e.target.value)} /></label>
              </div>
              <label className="bo-field"><span>Motivazione *</span><textarea value={esonMot} onChange={(e) => setEsonMot(e.target.value)} /></label>
              <button className="bo-btn sm" disabled={busy || !esonMot.trim()} onClick={registraEsonero}>Registra esonero / credito</button>
            </div>
          )}

          {scelta === 'formazione' && (
            <div className="ev-box">
              <div className="ev-step">2 &middot; Formazione richiesta (base + aggiornamento)</div>
              {r.formazione_id && <div className="ev-note">Attestato gia' presente: aggiungine un altro solo per l'aggiornamento o una correzione.</div>}
              <div className="bo-grid">
                <label className="bo-field"><span>Data completamento *</span><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
                <label className="bo-field"><span>Ore</span><input type="number" value={ore} onChange={(e) => setOre(e.target.value)} /></label>
                <label className="bo-field"><span>Ente formatore</span><input type="text" value={ente} onChange={(e) => setEnte(e.target.value)} /></label>
                <label className="bo-field"><span>Allegato (link al documento)</span><input type="text" value={allegato} onChange={(e) => setAllegato(e.target.value)} placeholder="URL del PDF/foto attestato" /></label>
              </div>
              <label className="chk" style={{ marginBottom: 10 }}><input type="checkbox" checked={agg} onChange={(e) => setAgg(e.target.checked)} /> e' un aggiornamento</label>
              <button className="bo-btn sm" disabled={busy || !data} onClick={registraAttestato}>Registra attestato</button>
              <div className="ev-step" style={{ marginTop: 12 }}>3 &middot; Scadenza</div>
              <div className="ev-note">{r.scadenza ? 'Scadenza attuale: ' + r.scadenza : 'Nessuna scadenza attiva: verra\' calcolata dalla data dell\'attestato.'}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Modulo formativo aggiuntivo e condizionato (es. modulo cantieri per impresa
// affidataria): una spunta rende evidente se l'azienda ci ricade; se si', si
// registra l'attestato del modulo come una normale formazione.
function ModuloAggiuntivo({ m, persona, onCambia }: {
  m: { ammesso: EsoneroAmmesso; corso: Catalogo['corsi'][number] | undefined };
  persona: Persona; onCambia: () => void;
}) {
  const [applicabile, setApplicabile] = useState(false);
  const [data, setData] = useState('');
  const [ore, setOre] = useState(m.corso?.ore != null ? String(m.corso.ore) : '');
  const [ente, setEnte] = useState('');
  const [allegato, setAllegato] = useState('');
  const [busy, setBusy] = useState(false);

  async function registra() {
    if (!data || !m.corso) return;
    setBusy(true);
    try {
      await salvaFormazione({
        id: '', persona_id: persona.id, corso_codice: m.corso.codice, corso_nome: m.corso.nome, categoria: m.corso.categoria,
        data_completamento: data, ore: ore === '' ? null : Number(ore), ente_formatore: ente.trim() || null,
        is_aggiornamento: false, scadenza: null, allegato_url: allegato.trim() || null, note: null,
      });
      onCambia();
    } finally { setBusy(false); }
  }

  return (
    <div className="ev-mod">
      <div className="fz-hint"><span aria-hidden="true">i</span><span>{m.ammesso.descrizione}{m.ammesso.riferimento_norm ? ' \u2014 ' + m.ammesso.riferimento_norm : ''}</span></div>
      <label className="chk"><input type="checkbox" checked={applicabile} onChange={(e) => setApplicabile(e.target.checked)} /> L'azienda ricade nell'obbligo di questo modulo aggiuntivo</label>
      {applicabile && m.corso && (
        <div className="ev-box">
          <div className="bo-grid">
            <label className="bo-field"><span>Data completamento *</span><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
            <label className="bo-field"><span>Ore</span><input type="number" value={ore} onChange={(e) => setOre(e.target.value)} /></label>
            <label className="bo-field"><span>Ente formatore</span><input type="text" value={ente} onChange={(e) => setEnte(e.target.value)} /></label>
            <label className="bo-field"><span>Allegato (link al documento)</span><input type="text" value={allegato} onChange={(e) => setAllegato(e.target.value)} placeholder="URL del PDF/foto attestato" /></label>
          </div>
          <button className="bo-btn sm" disabled={busy || !data} onClick={registra}>Registra modulo aggiuntivo</button>
        </div>
      )}
      {applicabile && !m.corso && <div className="ev-note">Corso del modulo non trovato a catalogo.</div>}
    </div>
  );
}

function FormAssegnaFigura({ figura, persone, clienteId, onChiudi }: {
  figura: FiguraSicurezza; persone: PersonaValutata[]; clienteId: string; onChiudi: () => void;
}) {
  const titolari = persone.filter((p) => p.figure.some((f) => f.codice === figura.codice)).map((p) => p.persona.id);
  const [sel, setSel] = useState<Set<string>>(new Set(titolari));
  const [nuovoNome, setNuovoNome] = useState('');
  const [nuovoCognome, setNuovoCognome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function salva() {
    setSalvando(true);
    try {
      const dopo = new Set(sel);
      if (nuovoNome.trim()) {
        const creata = await salvaPersona({ ...nuovaPersona(clienteId), nome: nuovoNome.trim(), cognome: nuovoCognome.trim() || null });
        dopo.add(creata.id);
      }
      // aggiunte: chi e' selezionato ma non era titolare
      for (const id of dopo) {
        if (!titolari.includes(id)) {
          await salvaNomina({ id: '', persona_id: id, figura_codice: figura.codice, data_nomina: null, attiva: true, note: null });
        }
      }
      // rimozioni: chi era titolare ma non e' piu' selezionato
      for (const id of titolari) {
        if (!dopo.has(id)) {
          await supabase.from('nomina').delete().eq('persona_id', id).eq('figura_codice', figura.codice);
        }
      }
      onChiudi();
    } finally { setSalvando(false); }
  }

  return (
    <Modale titolo={'Assegna: ' + figura.nome}>
      {persone.length > 0 ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {persone.map((p) => (
            <label key={p.persona.id} className="chk" style={{ padding: '5px 0' }}>
              <input type="checkbox" checked={sel.has(p.persona.id)} onChange={() => toggle(p.persona.id)} /> {nomePersona(p.persona)}
            </label>
          ))}
        </div>
      ) : (
        <div className="bo-sub" style={{ marginTop: 0 }}>Nessuna persona ancora in organigramma: creane una qui sotto.</div>
      )}

      <div className="bo-card flat" style={{ marginTop: 10 }}>
        <div className="bo-title" style={{ fontSize: 13.5, marginBottom: 8 }}>Crea e assegna una nuova persona</div>
        <div className="bo-grid">
          <label className="bo-field"><span>Nome</span><input type="text" value={nuovoNome} onChange={(e) => setNuovoNome(e.target.value)} /></label>
          <label className="bo-field"><span>Cognome</span><input type="text" value={nuovoCognome} onChange={(e) => setNuovoCognome(e.target.value)} /></label>
        </div>
      </div>

      <div className="bo-bar">
        <button className="bo-btn" disabled={salvando} onClick={salva}>{salvando ? 'Salvo…' : 'Salva'}</button>
        <button className="bo-btn ghost" onClick={onChiudi}>Annulla</button>
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
    <div className="bo-card flat" style={{ marginTop: 10 }}>
      <button className="bo-btn ghost sm" style={{ marginBottom: 8 }}
        onClick={() => setEdit({ id: '', corso_codice: null, figura_codice: null, tipo: 'titolo_studio', descrizione: '', riferimento_norm: null, ordine: ((lista.length ? lista[lista.length - 1].ordine : 0) + 10), attivo: true })}>
        + Nuovo promemoria
      </button>
      {lista.map((a) => (
        <div key={a.id} className="fz-cover">
          <span style={{ fontSize: 12.5 }}>
            <b>{a.corso_codice ?? a.figura_codice ?? '—'}</b> — {a.descrizione}
            {a.riferimento_norm ? ' (' + a.riferimento_norm + ')' : ''}
            {!a.attivo && <span className="bo-pill warn" style={{ marginLeft: 6 }}>disattivo</span>}
          </span>
          <span style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
            <button className="bo-btn ghost sm" onClick={() => setEdit(a)}>modifica</button>
            <button className="bo-btn danger sm" onClick={() => elimina(a.id)}>elimina</button>
          </span>
        </div>
      ))}
      {edit && (
        <Modale titolo="Promemoria di esonero ammesso">
          <div className="bo-grid">
            <label className="bo-field"><span>Corso (vuoto = per figura)</span>
              <select value={edit.corso_codice ?? ''} onChange={(ev) => setEdit({ ...edit, corso_codice: ev.target.value || null })}>
                <option value="">—</option>
                {catalogo.corsi.map((c) => <option key={c.codice} value={c.codice}>{c.nome}</option>)}
              </select>
            </label>
            <label className="bo-field"><span>Figura (opzionale)</span>
              <select value={edit.figura_codice ?? ''} onChange={(ev) => setEdit({ ...edit, figura_codice: ev.target.value || null })}>
                <option value="">—</option>
                {catalogo.figure.map((f) => <option key={f.codice} value={f.codice}>{f.nome}</option>)}
              </select>
            </label>
          </div>
          <label className="bo-field"><span>Descrizione (testo mostrato in campo)</span><textarea value={edit.descrizione} onChange={(ev) => setEdit({ ...edit, descrizione: ev.target.value })} /></label>
          <label className="bo-field"><span>Riferimento normativo</span><input type="text" value={edit.riferimento_norm ?? ''} onChange={(ev) => setEdit({ ...edit, riferimento_norm: ev.target.value })} /></label>
          <label className="chk" style={{ marginBottom: 12 }}><input type="checkbox" checked={edit.attivo} onChange={(ev) => setEdit({ ...edit, attivo: ev.target.checked })} /> attivo</label>
          <div className="bo-bar">
            <button className="bo-btn" disabled={!edit.descrizione.trim() || (!edit.corso_codice && !edit.figura_codice)} onClick={() => salva(edit)}>Salva</button>
            <button className="bo-btn ghost" onClick={() => setEdit(null)}>Annulla</button>
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
