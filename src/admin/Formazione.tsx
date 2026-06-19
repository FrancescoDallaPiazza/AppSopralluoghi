// Back-office - tab "Formazione / Organigramma sicurezza".
// Per cliente: organigramma atteso (figure coperte/da assegnare), persone +
// figure, stato formativo con semafori e promemoria di esonero per il campo,
// registrazione esoneri, generazione cose da fare per i gap, editor dei
// promemoria. Stile allineato al back-office (classi .bo-* di ui.ts) + un
// piccolo foglio supplementare per semafori/metriche/modali (scoping .bo).

import { useEffect, useMemo, useState } from 'react';
import { supabase, ATTESTATI_BUCKET, MAX_ATTESTATO_BYTES, estensioneAttestato, contentTypeAttestato, pathAttestato, urlFirmatoAttestato } from '../lib/supabase';
import { newId } from '../lib/types';
import {
  type Catalogo, type RiepilogoCliente, type PersonaValutata, type RequisitoValutato, type ModuloValutato,
  type Persona,
  type EsoneroAmmesso, type AreaInterna, type LivelloRischio, type TipoEsonero,
  type CosaDaFareProposta, type FiguraSicurezza,
  caricaCatalogo, caricaAreeInterne, valutaCliente,
  salvaPersona, eliminaPersona, salvaNomina,
  salvaFormazione, eliminaFormazione, salvaEsonero, eliminaEsonero,
  salvaEsoneroAmmesso, eliminaEsoneroAmmesso,
  proponiCoseDaFare, generaCoseDaFare,
  nomePersona,
} from '../lib/admin/formazione';
import {
  registraSnapshotOrganigramma, caricaRevisioniOrganigramma, caricaRevisioneOrganigramma,
  costruisciSnapshot, esportaPdfOrganigramma,
  type RevisioneOrganigramma, type SnapshotOrganigramma,
} from '../lib/admin/organigramma-revisioni';

interface ClienteLite { id: string; ragione_sociale: string; livello_rischio: LivelloRischio | null; rls_territoriale: boolean; }

const TIPI_ESONERO: TipoEsonero[] = [
  'titolo_studio', 'abilitazione', 'ruolo_equipollente', 'credito_pregresso', 'altro',
];

// foglio supplementare: semafori, metriche, chip, righe requisito, modali.
const LABEL_OBBLIGO: Record<string, string> = {
  sempre: 'sempre', condizionale: 'se ricorre', eventuale: 'eventuale',
};

const LABEL_STATO: Record<string, string> = {
  conforme: 'Conforme', in_scadenza: 'In scadenza', critico: 'Critico', esonerato: 'Esonerato', facoltativo: 'Facoltativo', da_verificare: 'Da verificare',
};

// Apre un allegato del bucket privato tramite signed URL temporaneo.
async function apriAllegato(path: string): Promise<void> {
  const u = await urlFirmatoAttestato(path);
  if (u) window.open(u, '_blank', 'noopener');
  else window.alert('Allegato non disponibile (offline o permessi insufficienti).');
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
.fz-sem.facoltativo{background:#eef1f4; color:#5b5f66;}
.fz-sem.da_verificare{background:#e8ebf0; color:#51607a;}
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
.fz-fig-nome{display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.fz-fig-pill{display:inline-block; background:#c0271c; color:#fff; font-size:15px; font-weight:800; padding:4px 12px; border-radius:8px; line-height:1.3;}
.fz-badge{font-size:9.5px; font-weight:800; padding:2px 7px; border-radius:999px; text-transform:uppercase; letter-spacing:.04em;}
.fz-badge.sempre{background:var(--ok-bg); color:var(--ok);}
.fz-badge.condizionale{background:#fbf0d6; color:var(--hi-dark);}
.fz-badge.eventuale{background:#eef1f4; color:var(--ink-soft);}
.fz-guida{font-size:13.5px; color:var(--ink); margin:8px 0 0; padding-left:18px; line-height:1.5; max-width:80ch; font-weight:500;}
.fz-guida li{margin:2px 0;}
.fz-guida li.sub{list-style:none; font-weight:400; color:var(--ink-soft); position:relative; padding-left:14px;}
.fz-guida li.sub::before{content:'\\2013'; position:absolute; left:2px;}
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
.fz-mod-tag{font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.03em; color:var(--ink-soft); background:#eef1f4; border-radius:5px; padding:1px 5px; margin-left:5px;}
.fz-st{font-size:9px; font-weight:800; padding:2px 6px; border-radius:999px; text-transform:uppercase; letter-spacing:.03em; white-space:nowrap; flex:0 0 auto;}
.st-conforme{background:#e7f3ea; color:#1f7a3d;}
.st-in_scadenza{background:#fbf0d6; color:#9a6206;}
.st-critico{background:#fbe3e0; color:#a33227;}
.st-esonerato{background:#eef1f4; color:#5b5f66;}
.st-da_verificare{background:#e8ebf0; color:#51607a;}
.st-facoltativo{background:#eef1f4; color:#5b5f66;}
.fz-person-empty{background:#f6f2ea; border:1px dashed var(--line); border-radius:9px; padding:8px 10px; font-size:12.5px; color:var(--ink-soft);}
.fz-person-crit{background:#fbe3e0; border:1px solid #e7b3ab; border-radius:9px; padding:8px 10px; font-size:12.5px; color:#a33227; font-weight:600;}
.fz-spec-t{font-size:10.5px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:var(--ink-soft); margin-bottom:2px;}
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
.ev-head-r{display:flex; align-items:center; gap:8px;}
.ev-row{display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin:2px 0 8px;}
.ev-det{font-size:12px; color:var(--ink-soft);}
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
  const [storicoOpen, setStoricoOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pregressaPersonaId, setPregressaPersonaId] = useState<string | null>(null);

  const cliente = useMemo(() => clienti.find((c) => c.id === clienteId) ?? null, [clienti, clienteId]);

  useEffect(() => {
    (async () => {
      try {
        const [cat, ar, cli] = await Promise.all([
          caricaCatalogo(),
          caricaAreeInterne(),
          supabase.from('cliente').select('id, ragione_sociale, livello_rischio, rls_territoriale')
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

  // Dopo ogni MODIFICA dell'organigramma: snapshot automatico versionato (con
  // dedup lato server: niente revisione se nulla e' cambiato) e poi ricarica.
  // Le ricariche di sola lettura (cambio cliente, primo caricamento) restano su
  // `ricarica()` e non generano snapshot.
  async function dopoModifica() {
    if (clienteId && catalogo && cliente) {
      try {
        await registraSnapshotOrganigramma(clienteId, { catalogo, clienteNome: cliente.ragione_sociale });
      } catch (e) { console.warn('snapshot organigramma non riuscito', e); }
    }
    await ricarica();
  }

  // Esporta in PDF il riassunto dell'organigramma corrente (via Edge Function).
  async function esportaPdf() {
    if (!riep || !cliente) return;
    setPdfBusy(true);
    try {
      const snap = costruisciSnapshot(riep, cliente.ragione_sociale);
      const url = await esportaPdfOrganigramma({ riepilogo: snap });
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      alert('PDF non generato: ' + (e?.message ?? String(e)));
    } finally { setPdfBusy(false); }
  }

  async function setRischio(v: LivelloRischio | null) {
    if (!clienteId) return;
    const { error } = await supabase.from('cliente').update({ livello_rischio: v }).eq('id', clienteId);
    if (error) { setErrore(error.message); return; }
    setClienti((arr) => arr.map((c) => (c.id === clienteId ? { ...c, livello_rischio: v } : c)));
    dopoModifica();
  }

  // RLS coperto dal rappresentante territoriale (RLST): se attivo, l'RLS non
  // viene segnalato come ruolo scoperto. Persistito sul cliente; ricalcola.
  async function impostaRlsTerritoriale(v: boolean) {
    if (!clienteId) return;
    const { error } = await supabase.from('cliente').update({ rls_territoriale: v }).eq('id', clienteId);
    if (error) { setErrore(error.message); return; }
    setClienti((arr) => arr.map((c) => (c.id === clienteId ? { ...c, rls_territoriale: v } : c)));
    dopoModifica();
  }
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
          <select value={cliente.livello_rischio ?? ''}
            style={{ width: 'auto', ...(cliente.livello_rischio ? {} : { borderColor: 'var(--hi-dark)', background: '#fbf0d6', fontWeight: 700 }) }}
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
            {riep.conteggi.da_verificare > 0 && <div className="fz-metric"><div className="k">Da verificare</div><div className="v" style={{ color: '#51607a' }}>{riep.conteggi.da_verificare}</div></div>}
            {riep.figureScoperte.length > 0 && <div className="fz-metric"><div className="k">Ruoli scoperti</div><div className="v" style={{ color: 'var(--no)' }}>{riep.figureScoperte.length}</div></div>}
          </div>

          <div className="bo-bar" style={{ marginTop: 0, marginBottom: 14 }}>
            <button className="bo-btn" onClick={() => setEditPersona(nuovaPersona(clienteId))}>+ Aggiungi persona</button>
            <button className="bo-btn ghost" onClick={() => setGenOpen((v) => !v)} disabled={!riep.persone.length}>Genera cose da fare per i gap</button>
            <button className="bo-btn ghost" onClick={esportaPdf} disabled={pdfBusy}>{pdfBusy ? 'Genero PDF…' : 'Esporta PDF organigramma'}</button>
            <button className="bo-btn ghost" onClick={() => setStoricoOpen(true)}>Storico organigramma</button>
          </div>

          {!cliente.livello_rischio && (
            <div className="bo-note">Livello di rischio non impostato: le ore della formazione specifica lavoratori non possono essere calcolate. Impostalo dal menù a tendina "rischio" in alto, accanto al nome del cliente.</div>
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
                  const assegnate = riep?.persone.filter((pv) => pv.figure.some((f) => f.codice === figura.codice)) ?? [];
                  const reqCodici = new Set(catalogo?.requisiti.filter((r) => r.figura_codice === figura.codice).map((r) => r.corso_codice) ?? []);
                  const modCodiciFigura = new Set(catalogo?.esoneriAmmessi.filter((a) => a.attivo && a.tipo === 'altro' && a.figura_codice === figura.codice).map((a) => a.corso_codice) ?? []);
                  const dlRsppCoperto = !!riep?.persone.some((pv) => pv.figure.some((f) => f.codice === 'dl_rspp'));
                  if (figura.codice === 'rspp' && dlRsppCoperto) return null; // il datore svolge l'RSPP: box non proposto
                  const scoperta = !!riep?.figureScoperte.some((f) => f.codice === figura.codice);
                  return (
                  <div key={figura.codice} className="fz-fig">
                    <div className="fz-fig-top">
                      <span className="fz-fig-nome">
                        <span className="fz-fig-pill">{figura.nome}</span>
                        {figura.obbligo && <span className={'fz-badge ' + figura.obbligo}>{LABEL_OBBLIGO[figura.obbligo] ?? figura.obbligo}</span>}
                      </span>
                      <button className="bo-btn ghost sm" onClick={() => setAssegnaFigura(figura)}>
                        {persone.length > 0 ? 'modifica' : 'assegna'}
                      </button>
                    </div>

                    <div className="fz-fig-body">
                      <div className="fz-fig-main">
                        {figura.guida && (
                          <ul className="fz-guida">
                            {figura.guida.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => (
                              l.startsWith('- ')
                                ? <li key={i} className="sub">{l.slice(2).trim()}</li>
                                : <li key={i}>{l}</li>
                            ))}
                          </ul>
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
                                  {pv.moduli.filter((mv) => modCodiciFigura.has(mv.corso_codice) && mv.stato !== 'esonerato').map((mv) => (
                                    <div key={'mod-' + mv.corso_codice} className="fz-ev-item">
                                      <div className="fz-ev-row">
                                        <span className="fz-ev-corso">{mv.corso_nome}<span className="fz-mod-tag">modulo</span></span>
                                        <span className={'fz-st st-' + mv.stato}>{LABEL_STATO[mv.stato] ?? mv.stato}</span>
                                      </div>
                                      {mv.dettaglio && <div className="fz-ev-det">{mv.dettaglio}</div>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          : figura.codice === 'rls'
                            ? (
                              <div className={cliente?.rls_territoriale ? 'fz-person-empty' : 'fz-person-crit'}>
                                {cliente?.rls_territoriale
                                  ? 'RLS territoriale (RLST): ruolo coperto dal rappresentante territoriale.'
                                  : 'Criticità: ruolo obbligatorio senza incaricato.'}
                                <label className="chk" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8 }}>
                                  <input type="checkbox" checked={!!cliente?.rls_territoriale} onChange={(e) => impostaRlsTerritoriale(e.target.checked)} />
                                  <span>RLS territoriale (RLST): nessun RLS interno, l'azienda e' coperta dal rappresentante territoriale.</span>
                                </label>
                              </div>
                            )
                            : scoperta
                              ? <div className="fz-person-crit">Criticità: ruolo obbligatorio senza incaricato.</div>
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
          onSalva={async (p) => {
            const eraPregressa = editPersona?.formazione_pregressa ?? false;
            await salvaPersona(p);
            setEditPersona(null);
            await dopoModifica();
            // Alla prima attivazione della "formazione pregressa" apri il pannello
            // dedicato per caricare le evidenze pregresse / creare le cose da fare.
            if (p.formazione_pregressa && !eraPregressa) setPregressaPersonaId(p.id);
          }}
          onEvidenzePregresse={editPersona.id ? () => { const id = editPersona.id; setEditPersona(null); setPregressaPersonaId(id); } : undefined}
          onElimina={editPersona.id ? async () => { if (confirm('Eliminare la persona e tutti i suoi dati formativi?')) { await eliminaPersona(editPersona.id); setEditPersona(null); dopoModifica(); } } : undefined}
        />
      )}
      {assegnaFigura && riep && (
        <FormAssegnaFigura
          figura={assegnaFigura}
          persone={riep.persone}
          clienteId={clienteId}
          onChiudi={() => { setAssegnaFigura(null); dopoModifica(); }}
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
            onCambia={dopoModifica}
            onChiudi={() => setEvidenzeFor(null)}
          />
        );
      })()}

      {storicoOpen && cliente && (
        <StoricoOrganigramma
          clienteId={clienteId}
          clienteNome={cliente.ragione_sociale}
          onChiudi={() => setStoricoOpen(false)}
        />
      )}

      {pregressaPersonaId && riep && clienteId && (() => {
        const pv = riep.persone.find((p) => p.persona.id === pregressaPersonaId);
        if (!pv) return null;
        return (
          <EvidenzePregresse
            pv={pv}
            clienteId={clienteId}
            onCambia={dopoModifica}
            onChiudi={() => setPregressaPersonaId(null)}
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

function FormPersona({ persona, onSalva, onAnnulla, onElimina, onEvidenzePregresse }: {
  persona: Persona; onSalva: (p: Persona) => void; onAnnulla: () => void; onElimina?: () => void; onEvidenzePregresse?: () => void;
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
      <label className="chk" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '6px 0 2px' }}>
        <input type="checkbox" checked={p.formazione_pregressa} onChange={(e) => setP({ ...p, formazione_pregressa: e.target.checked })} />
        <span>Formazione pregressa (azienda gia' operante prima dell'ASR 2025): i requisiti senza attestato risultano "da verificare" invece di "critici". Il corso datore di lavoro fa storia a se' (prima applicazione entro 19/05/2027).</span>
      </label>
      {p.formazione_pregressa && persona.id && onEvidenzePregresse && (
        <div className="ev-note" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
          <span>Carica gli attestati pregressi (data + scadenza) o segna quelli non disponibili.</span>
          <button type="button" className="bo-btn ghost sm" onClick={onEvidenzePregresse}>Evidenze pregresse</button>
        </div>
      )}
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
  // Tutti i moduli aggiuntivi della PERSONA (di ogni suo ruolo), non solo della
  // figura corrente; nascosti quelli coperti da un esonero applicabile.
  // Moduli aggiuntivi di QUESTA figura: agganciati alla card della formazione e
  // mostrati nel ramo "No, registro la formazione". Nascosti se coperti da esonero.
  const moduliFigura = catalogo.esoneriAmmessi
    .filter((a) => a.attivo && a.tipo === 'altro' && a.figura_codice === figura.codice)
    .map((a) => ({
      ammesso: a,
      corso: catalogo.corsi.find((c) => c.codice === a.corso_codice),
      valutato: pv.moduli.find((mv) => mv.corso_codice === a.corso_codice),
    }))
    .filter((m) => !m.valutato || m.valutato.stato !== 'esonerato');
  return (
    <Modale titolo={'Evidenze: ' + figura.nome + ' \u2014 ' + nomePersona(pv.persona)}>
      {reqs.length === 0 && <div className="bo-sub" style={{ marginTop: 0 }}>Nessun corso richiesto per questo ruolo.</div>}
      {reqs.map((r, i) => (
        <EvidenzaRequisito key={r.corso_codice} r={r} persona={pv.persona} figura={figura} onCambia={onCambia} moduli={i === 0 ? moduliFigura : undefined} />
      ))}
      {reqs.length === 0 && moduliFigura.length > 0 && (
        <div className="ev-card">
          <div className="ev-head"><span><b>Moduli aggiuntivi</b></span></div>
          {moduliFigura.map((m) => (
            <ModuloAggiuntivo key={m.ammesso.id} m={{ ammesso: m.ammesso, corso: m.corso }} persona={pv.persona} valutato={m.valutato} onCambia={onCambia} />
          ))}
        </div>
      )}
      <div className="bo-bar"><button className="bo-btn ghost" onClick={onChiudi}>Chiudi</button></div>
    </Modale>
  );
}

function EvidenzaRequisito({ r, persona, figura, onCambia, moduli }: {
  r: RequisitoValutato; persona: Persona; figura: FiguraSicurezza; onCambia: () => void;
  moduli?: { ammesso: EsoneroAmmesso; corso: Catalogo['corsi'][number] | undefined; valutato: ModuloValutato | undefined }[];
}) {
  const [scelta, setScelta] = useState<'attesa' | 'esonero' | 'formazione'>('attesa');
  const [esonTipo, setEsonTipo] = useState<TipoEsonero>('titolo_studio');
  const [esonMot, setEsonMot] = useState('');
  const [esonRif, setEsonRif] = useState(r.promemoria[0]?.riferimento_norm ?? '');
  const [data, setData] = useState('');
  const [ore, setOre] = useState(r.ore != null ? String(r.ore) : '');
  const [ente, setEnte] = useState('');
  const [file, setFile] = useState<File | null>(null);
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
  async function rimuoviAttestato() {
    if (!r.formazione_id) return;
    if (!confirm('Eliminare l\u2019attestato registrato per questo requisito? L\u2019operazione non si puo\u2019 annullare.')) return;
    setBusy(true);
    try { await eliminaFormazione(r.formazione_id); onCambia(); } finally { setBusy(false); }
  }
  async function registraAttestato() {
    if (!data) return;
    if (file && file.size > MAX_ATTESTATO_BYTES) { alert('Il file supera 20 MB: scegline uno piu\u2019 piccolo.'); return; }
    setBusy(true);
    try {
      const fid = newId();
      let allegatoUrl: string | null = null;
      if (file) {
        const path = pathAttestato(fid, newId(), estensioneAttestato(file));
        const up = await supabase.storage.from(ATTESTATI_BUCKET)
          .upload(path, file, { upsert: true, contentType: contentTypeAttestato(file) });
        if (up.error) { alert('Upload allegato non riuscito: ' + up.error.message); return; }
        allegatoUrl = path;
      }
      await salvaFormazione({
        id: fid, persona_id: persona.id, corso_codice: r.corso_codice, corso_nome: r.corso_nome, categoria: r.categoria,
        data_completamento: data, ore: ore === '' ? null : Number(ore), ente_formatore: ente.trim() || null,
        is_aggiornamento: agg, scadenza: null, allegato_url: allegatoUrl, note: null,
      });
      onCambia();
    } finally { setBusy(false); }
  }

  return (
    <div className="ev-card">
      <div className="ev-head">
        <span><b>{r.corso_nome}</b>{r.ore != null && <span className="ev-ore"> &middot; {r.ore}h</span>}</span>
        <span className="ev-head-r">
          {r.allegato_url && <button type="button" className="ev-link" onClick={() => void apriAllegato(r.allegato_url!)}>vedi allegato</button>}
          <span className={'fz-badge ' + (r.stato === 'esonerato' || r.stato === 'da_verificare' ? 'eventuale' : r.stato === 'conforme' ? 'sempre' : 'condizionale')}>{LABEL_STATO[r.stato] ?? r.stato}</span>
        </span>
      </div>

      {r.esonero_id ? (
        <div className="ev-eson-ok">
          Esonero / credito registrato per questo requisito: l'attestato non e' richiesto.
          <button className="bo-btn ghost sm" disabled={busy} onClick={rimuoviEson}>rimuovi esonero</button>
        </div>
      ) : (
        <>
          {r.formazione_id && (
            <div className="ev-eson-ok" style={{ marginBottom: 8 }}>
              Attestato registrato per questo requisito{r.scadenza ? ' \u2014 scadenza ' + r.scadenza : ''}.
              <button className="bo-btn ghost sm" disabled={busy} onClick={rimuoviAttestato}>rimuovi attestato</button>
            </div>
          )}
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
                <label className="bo-field"><span>Allegato (PDF o foto)</span><input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
              </div>
              {file && <div className="ev-note">Allegato: {file.name} ({Math.round(file.size / 1024)} KB)</div>}
              <label className="chk" style={{ marginBottom: 10 }}><input type="checkbox" checked={agg} onChange={(e) => setAgg(e.target.checked)} /> e' un aggiornamento</label>
              <button className="bo-btn sm" disabled={busy || !data} onClick={registraAttestato}>Registra attestato</button>
              <div className="ev-step" style={{ marginTop: 12 }}>3 &middot; Scadenza</div>
              <div className="ev-note">{r.scadenza ? 'Scadenza attuale: ' + r.scadenza : 'Nessuna scadenza attiva: verra\' calcolata dalla data dell\'attestato.'}</div>
              {moduli && moduli.length > 0 && (
                <>
                  <div className="ev-step" style={{ marginTop: 12 }}>4 &middot; Moduli aggiuntivi</div>
                  {moduli.map((m) => (
                    <ModuloAggiuntivo key={m.ammesso.id} m={{ ammesso: m.ammesso, corso: m.corso }} persona={persona} valutato={m.valutato} onCambia={onCambia} />
                  ))}
                </>
              )}
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
function ModuloAggiuntivo({ m, persona, valutato, onCambia }: {
  m: { ammesso: EsoneroAmmesso; corso: Catalogo['corsi'][number] | undefined };
  persona: Persona; valutato?: ModuloValutato; onCambia: () => void;
}) {
  const [applicabile, setApplicabile] = useState(false);
  const [data, setData] = useState('');
  const [ore, setOre] = useState(m.corso?.ore != null ? String(m.corso.ore) : '');
  const [ente, setEnte] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const allegatoModulo = valutato?.allegato_url ?? null;

  async function registra() {
    if (!data || !m.corso) return;
    if (file && file.size > MAX_ATTESTATO_BYTES) { alert('Il file supera 20 MB: scegline uno piu\u2019 piccolo.'); return; }
    setBusy(true);
    try {
      const fid = newId();
      let allegatoUrl: string | null = null;
      if (file) {
        const path = pathAttestato(fid, newId(), estensioneAttestato(file));
        const up = await supabase.storage.from(ATTESTATI_BUCKET)
          .upload(path, file, { upsert: true, contentType: contentTypeAttestato(file) });
        if (up.error) { alert('Upload allegato non riuscito: ' + up.error.message); return; }
        allegatoUrl = path;
      }
      await salvaFormazione({
        id: fid, persona_id: persona.id, corso_codice: m.corso.codice, corso_nome: m.corso.nome, categoria: m.corso.categoria,
        data_completamento: data, ore: ore === '' ? null : Number(ore), ente_formatore: ente.trim() || null,
        is_aggiornamento: false, scadenza: null, allegato_url: allegatoUrl, note: null,
      });
      onCambia();
    } finally { setBusy(false); }
  }

  return (
    <div className="ev-mod">
      <div className="fz-hint"><span aria-hidden="true">i</span><span>{m.ammesso.descrizione}{m.ammesso.riferimento_norm ? ' \u2014 ' + m.ammesso.riferimento_norm : ''}</span></div>
      {valutato && (
        <div className="ev-row">
          <span className={'fz-st st-' + valutato.stato}>{LABEL_STATO[valutato.stato] ?? valutato.stato}</span>
          <span className="ev-det">{valutato.dettaglio}</span>
          {allegatoModulo && (
            <button type="button" className="ev-link" onClick={() => void apriAllegato(allegatoModulo)}>vedi allegato</button>
          )}
        </div>
      )}
      <label className="chk"><input type="checkbox" checked={applicabile} onChange={(e) => setApplicabile(e.target.checked)} /> L'azienda ricade nell'obbligo di questo modulo aggiuntivo</label>
      {applicabile && m.corso && (
        <div className="ev-box">
          <div className="bo-grid">
            <label className="bo-field"><span>Data completamento *</span><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
            <label className="bo-field"><span>Ore</span><input type="number" value={ore} onChange={(e) => setOre(e.target.value)} /></label>
            <label className="bo-field"><span>Ente formatore</span><input type="text" value={ente} onChange={(e) => setEnte(e.target.value)} /></label>
            <label className="bo-field"><span>Allegato (PDF o foto)</span><input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          </div>
          {file && <div className="ev-note">Allegato: {file.name} ({Math.round(file.size / 1024)} KB)</div>}
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

// ---------- storico revisioni organigramma ----------

function StoricoOrganigramma({ clienteId, clienteNome, onChiudi }: {
  clienteId: string; clienteNome: string; onChiudi: () => void;
}) {
  const [lista, setLista] = useState<RevisioneOrganigramma[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [aperta, setAperta] = useState<SnapshotOrganigramma | null>(null);
  const [apertaNum, setApertaNum] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setLista(await caricaRevisioniOrganigramma(clienteId)); }
      catch (e: any) { setErrore(e?.message ?? String(e)); }
    })();
  }, [clienteId]);

  async function apri(r: RevisioneOrganigramma) {
    setBusy('apri-' + r.id);
    try {
      const full = await caricaRevisioneOrganigramma(r.id);
      setAperta(full.snapshot); setApertaNum(full.numero ?? null);
    } catch (e: any) { setErrore(e?.message ?? String(e)); }
    finally { setBusy(null); }
  }
  async function pdf(r: RevisioneOrganigramma) {
    setBusy('pdf-' + r.id);
    try { const url = await esportaPdfOrganigramma({ revisione_id: r.id }); window.open(url, '_blank', 'noopener'); }
    catch (e: any) { alert('PDF non generato: ' + (e?.message ?? String(e))); }
    finally { setBusy(null); }
  }

  return (
    <div className="fz-modal-bg">
      <div className="fz-modal" style={{ width: 'min(720px,100%)' }}>
        <div className="bo-row" style={{ marginBottom: 10 }}>
          <div className="bo-title grow" style={{ fontSize: 16 }}>Storico organigramma &mdash; {clienteNome}</div>
          <button className="bo-btn ghost sm" onClick={onChiudi}>chiudi</button>
        </div>
        {errore && <div className="bo-err">{errore}</div>}
        {!aperta && (
          <>
            {lista === null && <div className="bo-empty">Carico&hellip;</div>}
            {lista && lista.length === 0 && <div className="bo-empty">Nessuna revisione registrata: la prima nascera' alla prossima modifica dell'organigramma.</div>}
            {lista && lista.map((r) => (
              <div key={r.id} className="fz-cover">
                <span style={{ fontSize: 12.5 }}>
                  <b>Rev. {r.numero ?? '—'}</b> &middot; {new Date(r.creata_il).toLocaleString('it-IT')}
                  {r.autore ? ' \u00b7 ' + r.autore : ''}
                  <span className="fz-mod-tag" style={{ marginLeft: 6 }}>{r.origine === 'campo' ? 'campo' : 'back-office'}</span>
                </span>
                <span style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
                  <button className="bo-btn ghost sm" disabled={busy === 'apri-' + r.id} onClick={() => apri(r)}>{busy === 'apri-' + r.id ? '…' : 'apri'}</button>
                  <button className="bo-btn ghost sm" disabled={busy === 'pdf-' + r.id} onClick={() => pdf(r)}>{busy === 'pdf-' + r.id ? '…' : 'PDF'}</button>
                </span>
              </div>
            ))}
          </>
        )}
        {aperta && (
          <VistaSnapshot snap={aperta} numero={apertaNum} onIndietro={() => { setAperta(null); setApertaNum(null); }} />
        )}
      </div>
    </div>
  );
}

function VistaSnapshot({ snap, numero, onIndietro }: { snap: SnapshotOrganigramma; numero: number | null; onIndietro: () => void; }) {
  return (
    <>
      <div className="bo-bar" style={{ marginTop: 0, marginBottom: 10 }}>
        <button className="bo-btn ghost sm" onClick={onIndietro}>&larr; elenco</button>
        <span className="bo-sp" />
        <span className="bo-sub" style={{ margin: 0 }}>
          Rev. {numero ?? '—'} &middot; {new Date(snap.generato_il).toLocaleString('it-IT')}
          {snap.livello_rischio ? ' \u00b7 rischio ' + snap.livello_rischio : ''}
        </span>
      </div>
      <div className="fz-metrics">
        <div className="fz-metric"><div className="k">Persone</div><div className="v">{snap.persone.length}</div></div>
        <div className="fz-metric"><div className="k">Conformi</div><div className="v" style={{ color: 'var(--ok)' }}>{snap.conteggi.conforme}</div></div>
        <div className="fz-metric"><div className="k">In scadenza</div><div className="v" style={{ color: 'var(--hi-dark)' }}>{snap.conteggi.in_scadenza}</div></div>
        <div className="fz-metric"><div className="k">Critici</div><div className="v" style={{ color: 'var(--no)' }}>{snap.conteggi.critico}</div></div>
      </div>
      {snap.figure_scoperte.length > 0 && (
        <div className="fz-person-crit" style={{ marginBottom: 10 }}>
          Ruoli scoperti: {snap.figure_scoperte.map((f) => f.nome).join(', ')}
        </div>
      )}
      {snap.persone.map((p, i) => (
        <div key={i} className="fz-person-box" style={{ marginBottom: 8 }}>
          <div className="fz-person-head">
            <span className="nm">{p.nome}{p.mansione ? ' \u2014 ' + p.mansione : ''}</span>
            <span className={'fz-st st-' + p.stato}>{LABEL_STATO[p.stato] ?? p.stato}</span>
          </div>
          {p.figure.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>{p.figure.map((f) => f.nome).join(' \u00b7 ')}</div>}
          <div className="fz-person-ev">
            {p.requisiti.map((r, j) => (
              <div key={j} className="fz-ev-row">
                <span className="fz-ev-corso">{r.corso_nome}{r.dettaglio ? ' \u2014 ' + r.dettaglio : ''}</span>
                <span className={'fz-st st-' + r.stato}>{LABEL_STATO[r.stato] ?? r.stato}</span>
              </div>
            ))}
            {p.moduli.map((m, j) => (
              <div key={'m' + j} className="fz-ev-row">
                <span className="fz-ev-corso">{m.corso_nome}<span className="fz-mod-tag">modulo</span></span>
                <span className={'fz-st st-' + m.stato}>{LABEL_STATO[m.stato] ?? m.stato}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

// ---------- evidenze pregresse (formazione ante ASR 2025) ----------

function EvidenzePregresse({ pv, clienteId, onCambia, onChiudi }: {
  pv: PersonaValutata; clienteId: string; onCambia: () => void; onChiudi: () => void;
}) {
  // Da recuperare = requisiti senza attestato/esonero: con la persona marcata
  // "formazione pregressa" sono "da verificare"; eventuali "critico" (es. corso
  // datore) restano comunque da gestire. Gli altri sono gia' coperti.
  const daRecuperare = pv.requisiti.filter((r) => r.stato === 'da_verificare' || r.stato === 'critico');
  const coperti = pv.requisiti.filter((r) => r.stato !== 'da_verificare' && r.stato !== 'critico');
  return (
    <Modale titolo={'Evidenze pregresse \u2014 ' + nomePersona(pv.persona)}>
      <div className="bo-sub" style={{ marginTop: 0 }}>
        Per ogni corso richiesto registra l'attestato pregresso (data di effettuazione e scadenza).
        Se l'attestato non e' disponibile, crea una cosa da fare per recuperarlo.
      </div>
      {daRecuperare.length === 0 && (
        <div className="ev-eson-ok" style={{ marginBottom: 8 }}>Nessun corso da recuperare: tutti i requisiti risultano coperti.</div>
      )}
      {daRecuperare.map((r) => (
        <RigaPregressa key={r.corso_codice} r={r} persona={pv.persona} clienteId={clienteId} onCambia={onCambia} />
      ))}
      {coperti.length > 0 && (
        <details style={{ marginTop: 6 }}>
          <summary className="bo-sub" style={{ cursor: 'pointer', margin: '6px 0' }}>Requisiti gia' coperti ({coperti.length})</summary>
          {coperti.map((r) => (
            <div key={r.corso_codice} className="ev-card" style={{ opacity: 0.85 }}>
              <div className="ev-head">
                <span><b>{r.corso_nome}</b></span>
                <span className={'fz-badge ' + (r.stato === 'esonerato' ? 'eventuale' : r.stato === 'conforme' ? 'sempre' : 'condizionale')}>{LABEL_STATO[r.stato] ?? r.stato}</span>
              </div>
            </div>
          ))}
        </details>
      )}
      <div className="bo-bar"><button className="bo-btn ghost" onClick={onChiudi}>Chiudi</button></div>
    </Modale>
  );
}

function RigaPregressa({ r, persona, clienteId, onCambia }: {
  r: RequisitoValutato; persona: Persona; clienteId: string; onCambia: () => void;
}) {
  const [modo, setModo] = useState<'attesa' | 'evidenza' | 'fatta'>('attesa');
  const [data, setData] = useState('');
  const [scad, setScad] = useState('');
  const [ore, setOre] = useState(r.ore != null ? String(r.ore) : '');
  const [ente, setEnte] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  async function registra() {
    if (!data) return;
    if (file && file.size > MAX_ATTESTATO_BYTES) { alert('Il file supera 20 MB: scegline uno piu\u2019 piccolo.'); return; }
    setBusy(true);
    try {
      const fid = newId();
      let allegatoUrl: string | null = null;
      if (file) {
        const path = pathAttestato(fid, newId(), estensioneAttestato(file));
        const up = await supabase.storage.from(ATTESTATI_BUCKET)
          .upload(path, file, { upsert: true, contentType: contentTypeAttestato(file) });
        if (up.error) { alert('Upload allegato non riuscito: ' + up.error.message); return; }
        allegatoUrl = path;
      }
      await salvaFormazione({
        id: fid, persona_id: persona.id, corso_codice: r.corso_codice, corso_nome: r.corso_nome, categoria: r.categoria,
        data_completamento: data, ore: ore === '' ? null : Number(ore), ente_formatore: ente.trim() || null,
        is_aggiornamento: false, scadenza: scad || null, allegato_url: allegatoUrl, note: 'Evidenza pregressa',
      });
      setEsito('Evidenza pregressa registrata.'); setModo('fatta'); onCambia();
    } finally { setBusy(false); }
  }

  async function nonDisponibile() {
    setBusy(true);
    try {
      await generaCoseDaFare([{
        persona_id: persona.id, persona_nome: nomePersona(persona),
        descrizione: 'Recuperare e registrare attestato pregresso - ' + nomePersona(persona) + ': ' + r.corso_nome,
        scadenza: r.scadenza, priorita: 'media',
      }], { includiInScadenza: false, versoArea: false, areaId: null, clienteId });
      setEsito('Cosa da fare creata (verso il cliente).'); setModo('fatta'); onCambia();
    } finally { setBusy(false); }
  }

  return (
    <div className="ev-card">
      <div className="ev-head">
        <span><b>{r.corso_nome}</b>{r.ore != null && <span className="ev-ore"> &middot; {r.ore}h</span>}</span>
        <span className={'fz-badge ' + (r.stato === 'da_verificare' ? 'eventuale' : 'condizionale')}>{LABEL_STATO[r.stato] ?? r.stato}</span>
      </div>
      {esito && <div className="ev-eson-ok" style={{ marginTop: 6 }}>{esito}</div>}
      {modo !== 'fatta' && (
        <div className="ev-choice">
          <button className={'bo-btn ghost sm' + (modo === 'evidenza' ? ' on' : '')} onClick={() => setModo('evidenza')}>Ho l'attestato: registra</button>
          <button className="bo-btn ghost sm" disabled={busy} onClick={nonDisponibile}>Non disponibile: crea cosa da fare</button>
        </div>
      )}
      {modo === 'evidenza' && (
        <div className="ev-box">
          <div className="bo-grid">
            <label className="bo-field"><span>Data effettuazione *</span><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
            <label className="bo-field"><span>Scadenza</span><input type="date" value={scad} onChange={(e) => setScad(e.target.value)} /></label>
            <label className="bo-field"><span>Ore</span><input type="number" value={ore} onChange={(e) => setOre(e.target.value)} /></label>
            <label className="bo-field"><span>Ente formatore</span><input type="text" value={ente} onChange={(e) => setEnte(e.target.value)} /></label>
            <label className="bo-field"><span>Allegato (PDF o foto)</span><input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          </div>
          {file && <div className="ev-note">Allegato: {file.name} ({Math.round(file.size / 1024)} KB)</div>}
          <div className="ev-note">Lascia "Scadenza" vuota per calcolarla automaticamente dalla data di effettuazione.</div>
          <button className="bo-btn sm" disabled={busy || !data} onClick={registra}>Registra evidenza pregressa</button>
        </div>
      )}
    </div>
  );
}

// ---------- factory ----------

function nuovaPersona(clienteId: string): Persona {
  return { id: '', cliente_id: clienteId, nome: '', cognome: null, codice_fiscale: null, mansione: null, reparto: null, data_assunzione: null, livello_rischio: null, attivo: true, note: null, formazione_pregressa: false };
}
