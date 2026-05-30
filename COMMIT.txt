// Rende il report di sopralluogo in HTML autoconsistente (CSS inline, foto in
// base64), stampabile A4. Due varianti: 'cliente' e 'interna'. Porta lo stile
// del mockup mockup-report-sopralluogo.html.

import type { ReportData, EsitoDisplay, AzioneDisplay } from './report-data.ts';

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmtData = (iso: string | null): string => {
  if (!iso) return '—';
  const d = iso.slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
};
const durata = (min: number | null): string => {
  if (!min) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};
const priCls = (p: string) => (p === 'alta' ? 'alta' : p === 'bassa' ? 'bassa' : 'media');
const periodLabel = (m: number | null): string => {
  if (!m) return 'ricorrente';
  const map: Record<number, string> = { 1: 'mensile', 3: 'trimestrale', 6: 'semestrale', 12: 'annuale', 24: 'biennale', 60: 'quinquennale' };
  return map[m] ?? `ogni ${m} mesi`;
};

function azioneCard(a: AzioneDisplay): string {
  const scad = a.tipo === 'scadenza_ricorrente'
    ? `<span>Periodicità <b>${esc(periodLabel(a.periodicita_mesi))}</b></span><span>Prossima <b>${esc(fmtData(a.data_scadenza))}</b></span>`
    : `<span>Scadenza <b>${esc(fmtData(a.data_scadenza))}</b></span>`;
  const pill = a.tipo === 'scadenza_ricorrente'
    ? `<span class="pri scad">Scadenza</span>`
    : `<span class="pri ${priCls(a.priorita)}">${esc(a.priorita)}</span>`;
  return `<div class="act ${a.tipo === 'scadenza_ricorrente' ? 'scad' : ''}">
    <div class="act-top"><div>
      <div class="act-desc">${esc(a.descrizione)}</div>
      ${a.origine_voce ? `<div class="act-src">Da: "${esc(a.origine_voce)}"</div>` : ''}
    </div>${pill}</div>
    <div class="act-meta"><span>Responsabile <b>${esc(a.responsabile_nome)}</b></span>${scad}</div>
  </div>`;
}

function esitoRow(e: EsitoDisplay, livello = 0): string {
  const badge = e.stato === 'conforme' ? '<span class="badge ok">Conforme</span>'
    : e.stato === 'non_conforme' ? '<span class="badge no">Non conforme</span>'
      : e.stato === 'non_applicabile' ? '<span class="badge na">Non applicabile</span>'
        : (e.valore ? `<span class="badge val">${esc(e.valore)}</span>` : '');
  const fotos = e.foto.length
    ? `<div class="rfotos">${e.foto.map((u) => `<img class="rfoto" src="${u}" />`).join('')}</div>` : '';
  const valore = (e.stato == null && e.valore && e.tipo !== 'scelta' && e.tipo !== 'multiscelta')
    ? `<div class="voce-val">${esc(e.valore)}</div>` : '';
  const note = e.note ? `<div class="voce-note">${esc(e.note)}</div>` : '';
  const figli = e.figli.map((f) => esitoRow(f, livello + 1)).join('');
  return `<div class="voce ${livello ? 'sub' : ''}">
    ${livello === 0 && e.sezione ? `<div class="voce-sez">${esc(e.sezione)}</div>` : ''}
    <div class="voce-line"><div class="voce-req">${esc(e.testo)}</div>${badge}</div>
    ${valore}${note}${fotos}${figli}
  </div>`;
}

function sintesi(d: ReportData): string {
  const c = d.conteggi;
  const tot = c.conformi + c.non_conformi + c.non_applicabili || 1;
  const pct = (n: number) => `${(n / tot) * 100}%`;
  return `<h2 class="sec">Sintesi</h2>
  <div class="summary">
    <div class="stat ok"><div class="num">${c.conformi}</div><div class="lab">Conformi</div></div>
    <div class="stat no"><div class="num">${c.non_conformi}</div><div class="lab">Da programmare</div></div>
    <div class="stat na"><div class="num">${c.non_applicabili}</div><div class="lab">Non appl.</div></div>
  </div>
  <div class="compbar">
    <i style="width:${pct(c.conformi)};background:var(--ok)"></i>
    <i style="width:${pct(c.non_conformi)};background:var(--no)"></i>
    <i style="width:${pct(c.non_applicabili)};background:var(--na)"></i>
  </div>`;
}

function continuita(d: ReportData): string {
  const { chiuseQui, ancoraAperte } = d.continuita;
  if (!chiuseQui.length && !ancoraAperte.length) return '';
  const row = (a: AzioneDisplay, chiusa: boolean) => `<div class="cont-row ${chiusa ? 'ok' : 'open'}">
    <span class="dot"></span>
    <div><div class="cont-desc">${esc(a.descrizione)}</div>
    <div class="cont-meta">${chiusa ? 'Verificata e chiusa in questa visita' : `Ancora aperta · resp. ${esc(a.responsabile_nome)}${a.data_scadenza ? ' · scad. ' + esc(fmtData(a.data_scadenza)) : ''}`}</div></div>
  </div>`;
  return `<h2 class="sec">Stato delle azioni del giro precedente</h2>
  ${chiuseQui.map((a) => row(a, true)).join('')}
  ${ancoraAperte.map((a) => row(a, false)).join('')}`;
}

export function renderReport(d: ReportData): string {
  const cli = d.variante === 'cliente';
  const azCliente = d.azioni.filter((a) => a.responsabile_tipo === 'cliente');
  const azInterne = d.azioni.filter((a) => a.responsabile_tipo === 'risorsa_interna');
  const incLabel = [d.incarico.tipo_attivita, d.sopralluogo.progressivo].filter(Boolean).join(' · ') || '—';
  const sede = d.cliente.localita || d.sopralluogo.localita || d.cliente.indirizzo || '—';

  const meta = `<div class="meta">
    <div><span>Cliente</span><b>${esc(d.cliente.ragione_sociale)}</b></div>
    <div><span>Sede</span><b>${esc(sede)}</b></div>
    <div><span>Data sopralluogo</span><b>${esc(fmtData(d.sopralluogo.data))}</b></div>
    <div><span>Incarico</span><b>${esc(incLabel)}</b></div>
    <div><span>Tecnico</span><b>${esc(d.tecnico.nome ?? '—')}</b></div>
    <div><span>${cli ? 'Esito generale' : 'Durata'}</span><b>${cli ? esc(d.conteggi.non_conformi ? d.conteggi.non_conformi + ' da programmare' : 'Nessuna criticità') : esc(durata(d.sopralluogo.durata_min))}</b></div>
  </div>`;

  const coseDaFare = cli
    ? (azCliente.length ? `<h2 class="sec">Cose da fare — a cura del cliente</h2>${azCliente.map(azioneCard).join('')}` : '')
    : (
      (azInterne.length ? `<h2 class="sec">Attività interne da svolgere</h2>${azInterne.map(azioneCard).join('')}` : '') +
      (azCliente.length ? `<h2 class="sec">Comunicato al cliente</h2>${azCliente.map(azioneCard).join('')}` : '')
    );

  const dettaglio = d.esiti.length
    ? `<h2 class="sec">${cli ? 'Dettaglio degli esiti' : 'Esiti completi'}</h2>${d.esiti.map((e) => esitoRow(e)).join('')}`
    : '';

  const piE = d.sopralluogo.progressivo ? ` · Sopralluogo ${esc(d.sopralluogo.progressivo)}` : '';

  return `<!doctype html><html lang="it"><head><meta charset="UTF-8"/>
<title>Report sopralluogo${cli ? ' (cliente)' : ' (interno)'}</title>
<style>
:root{--ink:#1a1c20;--soft:#5b5f66;--faint:#8a8f97;--line:#e4ded3;--hi:#f4a012;--hi-dark:#9a6206;
--ok:#1f9d57;--ok-bg:#e7f5ec;--no:#d8442f;--no-bg:#fbeae6;--na:#8a8f97;--na-bg:#edeae4;
--serif:Georgia,"Times New Roman",serif;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;}
*{box-sizing:border-box;} html,body{margin:0;padding:0;}
body{font-family:var(--sans);color:var(--ink);background:#d9d4ca;line-height:1.5;}
.report{max-width:760px;margin:0 auto;background:#fff;padding:40px 46px 36px;box-shadow:0 10px 40px -20px rgba(0,0,0,.5);}
.doc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:16px;border-bottom:2px solid var(--ink);}
.logo{border:1.5px dashed #c9c2b4;color:var(--faint);font-size:11px;font-weight:600;padding:14px 18px;border-radius:6px;letter-spacing:.04em;white-space:nowrap;}
.studio-sub{font-size:11.5px;color:var(--soft);margin-top:6px;}
.doc-title{text-align:right;} .doc-title h1{font-family:var(--serif);font-weight:700;font-size:23px;margin:0;}
.doc-title .kind{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-top:5px;}
.kind.cli{color:var(--hi-dark);} .kind.int{color:var(--no);}
.accent{height:3px;background:var(--hi);margin:0 0 20px;}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 28px;font-size:13px;margin-bottom:22px;}
.meta div{display:flex;justify-content:space-between;border-bottom:1px dotted var(--line);padding:5px 0;}
.meta span{color:var(--soft);} .meta b{font-weight:600;}
h2.sec{font-family:var(--sans);font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);margin:26px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line);}
.summary{display:flex;gap:10px;} .stat{flex:1;border:1px solid var(--line);border-radius:10px;padding:12px 14px;text-align:center;}
.stat .num{font-family:var(--serif);font-size:26px;font-weight:700;line-height:1;} .stat .lab{font-size:11px;color:var(--soft);margin-top:6px;font-weight:600;}
.stat.ok .num{color:var(--ok);} .stat.no .num{color:var(--no);} .stat.na .num{color:var(--na);}
.compbar{height:8px;border-radius:999px;overflow:hidden;display:flex;margin-top:14px;border:1px solid var(--line);} .compbar i{display:block;height:100%;}
.act{border:1px solid var(--line);border-left:4px solid var(--no);border-radius:10px;padding:13px 15px;margin-bottom:10px;}
.act.scad{border-left-color:var(--hi);}
.act-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;}
.act-desc{font-size:14.5px;font-weight:600;line-height:1.35;} .act-src{font-size:11.5px;color:var(--faint);margin-top:3px;}
.act-meta{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;color:var(--soft);margin-top:9px;} .act-meta b{color:var(--ink);font-weight:600;}
.pri{font-size:10.5px;font-weight:700;letter-spacing:.04em;padding:3px 9px;border-radius:6px;white-space:nowrap;text-transform:capitalize;}
.pri.alta{background:var(--no-bg);color:var(--no);} .pri.media{background:#fbeccb;color:var(--hi-dark);} .pri.bassa{background:var(--ok-bg);color:var(--ok);} .pri.scad{background:#fbeccb;color:var(--hi-dark);}
.cont-row{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line);}
.cont-row .dot{width:9px;height:9px;border-radius:50%;margin-top:5px;flex-shrink:0;} .cont-row.ok .dot{background:var(--ok);} .cont-row.open .dot{background:var(--no);}
.cont-desc{font-size:13.5px;font-weight:500;} .cont-meta{font-size:11.5px;color:var(--soft);margin-top:2px;}
.voce{border-bottom:1px solid var(--line);padding:13px 0;} .voce:last-child{border-bottom:none;}
.voce.sub{border-bottom:none;padding:6px 0 0 16px;margin-left:6px;border-left:2px solid var(--line);}
.voce-sez{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-bottom:4px;}
.voce-line{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;} .voce-req{font-size:14px;line-height:1.4;}
.badge{font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:7px;white-space:nowrap;}
.badge.ok{background:var(--ok-bg);color:var(--ok);} .badge.no{background:var(--no-bg);color:var(--no);} .badge.na{background:var(--na-bg);color:#555;} .badge.val{background:#eef1f4;color:#2b3a4a;}
.voce-val{font-size:12.5px;color:var(--ink);margin-top:5px;font-weight:600;} .voce-note{font-size:12.5px;color:var(--soft);margin-top:7px;}
.rfotos{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap;} .rfoto{width:84px;height:84px;border-radius:6px;object-fit:cover;border:1px solid var(--line);}
.doc-foot{margin-top:30px;padding-top:14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:11px;color:var(--faint);}
@page{size:A4;margin:14mm;}
@media print{body{background:#fff;} .report{box-shadow:none;margin:0;max-width:none;padding:0;}}
</style></head>
<body><div class="report">
  <div class="doc-head">
    <div><div class="logo">[ OVERALL GROUP SRL ]</div>
      <div class="studio-sub">${cli ? 'Servizio di consulenza · Sicurezza sul lavoro' : 'Documento operativo · uso interno'}</div></div>
    <div class="doc-title"><h1>Report di sopralluogo</h1>
      <div class="kind ${cli ? 'cli' : 'int'}">${cli ? 'Copia per il cliente' : 'Uso interno'}</div></div>
  </div>
  <div class="accent"></div>
  ${meta}
  ${d.hasChecklist ? sintesi(d) : ''}
  ${coseDaFare}
  ${continuita(d)}
  ${dettaglio}
  <div class="doc-foot"><span>${cli ? '' : 'USO INTERNO · '}${esc(d.cliente.ragione_sociale)}${piE} · ${esc(fmtData(d.sopralluogo.data))}</span><span>Overall Group Srl</span></div>
</div></body></html>`;
}
