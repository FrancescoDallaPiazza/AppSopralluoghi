<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Report sopralluogo</title>
<style>
  :root{
    --ink:#1a1c20; --soft:#5b5f66; --faint:#8a8f97; --line:#e4ded3;
    --hi:#f4a012; --hi-dark:#9a6206;
    --ok:#1f9d57; --ok-bg:#e7f5ec;
    --no:#d8442f; --no-bg:#fbeae6;
    --na:#8a8f97; --na-bg:#edeae4;
    --serif:Georgia,"Times New Roman",serif;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{font-family:var(--sans); color:var(--ink); background:#d9d4ca; line-height:1.5;}

  /* toolbar (solo schermo) */
  .toolbar{
    position:sticky; top:0; z-index:10; background:#16181c; color:#fff;
    display:flex; align-items:center; gap:8px; padding:10px 14px; flex-wrap:wrap;
  }
  .tabs{display:flex; gap:6px; background:rgba(255,255,255,.08); padding:4px; border-radius:10px;}
  .tab{
    border:none; background:transparent; color:#c7cad0; font-family:var(--sans);
    font-weight:600; font-size:13px; padding:8px 14px; border-radius:7px; cursor:pointer;
  }
  .tab.on{background:var(--hi); color:#1a1205;}
  .toolbar .sp{flex:1;}
  .print{
    border:1px solid rgba(255,255,255,.25); background:transparent; color:#fff;
    font-family:var(--sans); font-weight:600; font-size:13px; padding:8px 14px; border-radius:8px; cursor:pointer;
    display:inline-flex; align-items:center; gap:7px;
  }
  .print svg{width:15px;height:15px;}

  .stage{padding:22px 14px 60px;}
  .report{
    max-width:760px; margin:0 auto; background:#fff; padding:40px 46px 36px;
    box-shadow:0 10px 40px -20px rgba(0,0,0,.5); display:none;
  }
  .report.active{display:block;}

  /* intestazione documento */
  .doc-head{display:flex; justify-content:space-between; align-items:flex-start; gap:20px; padding-bottom:16px; border-bottom:2px solid var(--ink);}
  .logo{
    border:1.5px dashed #c9c2b4; color:var(--faint); font-size:11px; font-weight:600;
    padding:14px 18px; border-radius:6px; letter-spacing:.04em; white-space:nowrap;
  }
  .studio-sub{font-size:11.5px; color:var(--soft); margin-top:6px;}
  .doc-title{text-align:right;}
  .doc-title h1{font-family:var(--serif); font-weight:700; font-size:23px; margin:0; letter-spacing:-.01em;}
  .doc-title .kind{font-size:12px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; margin-top:5px;}
  .kind.cli{color:var(--hi-dark);}
  .kind.int{color:var(--no);}
  .accent{height:3px; background:var(--hi); margin:0 0 20px;}

  /* meta */
  .meta{display:grid; grid-template-columns:1fr 1fr; gap:6px 28px; font-size:13px; margin-bottom:22px;}
  .meta div{display:flex; justify-content:space-between; border-bottom:1px dotted var(--line); padding:5px 0;}
  .meta span{color:var(--soft);}
  .meta b{font-weight:600;}

  h2.sec{
    font-family:var(--sans); font-size:12px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
    color:var(--soft); margin:26px 0 12px; padding-bottom:6px; border-bottom:1px solid var(--line);
  }

  /* sintesi */
  .summary{display:flex; gap:10px; margin-bottom:6px;}
  .stat{flex:1; border:1px solid var(--line); border-radius:10px; padding:12px 14px; text-align:center;}
  .stat .num{font-family:var(--serif); font-size:26px; font-weight:700; line-height:1;}
  .stat .lab{font-size:11px; color:var(--soft); margin-top:6px; font-weight:600; letter-spacing:.03em;}
  .stat.ok .num{color:var(--ok);} .stat.no .num{color:var(--no);} .stat.na .num{color:var(--na);}
  .compbar{height:8px; border-radius:999px; overflow:hidden; display:flex; margin-top:14px; border:1px solid var(--line);}
  .compbar i{display:block; height:100%;}

  /* azioni */
  .act{border:1px solid var(--line); border-left:4px solid var(--no); border-radius:10px; padding:13px 15px; margin-bottom:10px;}
  .act.int{border-left-color:var(--no);}
  .act.scad{border-left-color:var(--hi);}
  .act-top{display:flex; justify-content:space-between; gap:12px; align-items:flex-start;}
  .act-desc{font-size:14.5px; font-weight:600; line-height:1.35;}
  .act-src{font-size:11.5px; color:var(--faint); margin-top:3px;}
  .act-meta{display:flex; gap:18px; flex-wrap:wrap; font-size:12px; color:var(--soft); margin-top:9px;}
  .act-meta b{color:var(--ink); font-weight:600;}
  .pri{font-family:var(--sans); font-size:10.5px; font-weight:700; letter-spacing:.04em; padding:3px 9px; border-radius:6px; white-space:nowrap;}
  .pri.alta{background:var(--no-bg); color:var(--no);}
  .pri.media{background:#fbeccb; color:var(--hi-dark);}
  .pri.bassa{background:var(--ok-bg); color:var(--ok);}
  .pri.scad{background:#fbeccb; color:var(--hi-dark);}

  /* esiti */
  .voce{border-bottom:1px solid var(--line); padding:13px 0;}
  .voce:last-child{border-bottom:none;}
  .voce-sez{font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--faint); margin-bottom:4px;}
  .voce-line{display:flex; justify-content:space-between; gap:14px; align-items:flex-start;}
  .voce-req{font-size:14px; line-height:1.4;}
  .badge{font-family:var(--sans); font-size:10.5px; font-weight:700; letter-spacing:.03em; padding:4px 10px; border-radius:7px; white-space:nowrap;}
  .badge.ok{background:var(--ok-bg); color:var(--ok);}
  .badge.no{background:var(--no-bg); color:var(--no);}
  .badge.na{background:var(--na-bg); color:#555;}
  .voce-note{font-size:12.5px; color:var(--soft); margin-top:7px;}
  .rfotos{display:flex; gap:6px; margin-top:9px;}
  .rfoto{width:46px; height:46px; border-radius:6px; background:#eceae4; border:1px solid var(--line); display:flex; align-items:center; justify-content:center; color:var(--faint);}
  .rfoto svg{width:18px;height:18px;}

  .callout{background:#faf7f0; border:1px solid var(--line); border-radius:10px; padding:13px 15px; font-size:12.5px; color:var(--soft); margin-top:6px;}
  .callout b{color:var(--ink);}

  .doc-foot{margin-top:30px; padding-top:14px; border-top:1px solid var(--line); display:flex; justify-content:space-between; font-size:11px; color:var(--faint);}

  @media print{
    .toolbar{display:none;}
    body{background:#fff;}
    .stage{padding:0;}
    .report{box-shadow:none; margin:0; max-width:none; padding:0 6mm;}
    .report:not(.active){display:none;}
  }
  @media(max-width:560px){
    .report{padding:26px 20px;}
    .meta{grid-template-columns:1fr;}
    .doc-head{flex-direction:column;}
    .doc-title{text-align:left;}
  }
</style>
</head>
<body>

<div class="toolbar">
  <div class="tabs">
    <button class="tab on" data-t="repCliente">Versione cliente</button>
    <button class="tab" data-t="repInterno">Versione interna</button>
  </div>
  <span class="sp"></span>
  <button class="print" id="print">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v6H8z" stroke-linejoin="round"/></svg>
    Stampa / PDF
  </button>
</div>

<div class="stage">

  <!-- ============ CLIENTE ============ -->
  <section class="report active" id="repCliente">
    <div class="doc-head">
      <div>
        <div class="logo">[ LOGO STUDIO ]</div>
        <div class="studio-sub">Servizio RSPP esterno · Sicurezza sul lavoro</div>
      </div>
      <div class="doc-title">
        <h1>Report di sopralluogo</h1>
        <div class="kind cli">Copia per il cliente</div>
      </div>
    </div>
    <div class="accent"></div>

    <div class="meta">
      <div><span>Cliente</span><b>MAISON 22 S.R.L.</b></div>
      <div><span>Sede</span><b>Villafranca (VR)</b></div>
      <div><span>Data sopralluogo</span><b>29/05/2026</b></div>
      <div><span>Incarico</span><b>RSPP · Sopralluogo 3/4</b></div>
      <div><span>Tecnico</span><b>T. Pradella</b></div>
      <div><span>Esito generale</span><b>2 non conformità</b></div>
    </div>

    <h2 class="sec">Sintesi</h2>
    <div class="summary">
      <div class="stat ok"><div class="num">5</div><div class="lab">Conformi</div></div>
      <div class="stat no"><div class="num">2</div><div class="lab">Non conformi</div></div>
      <div class="stat na"><div class="num">1</div><div class="lab">Non appl.</div></div>
    </div>
    <div class="compbar">
      <i style="width:62.5%;background:var(--ok)"></i>
      <i style="width:25%;background:var(--no)"></i>
      <i style="width:12.5%;background:var(--na)"></i>
    </div>

    <h2 class="sec">Cose da fare — a cura del cliente</h2>
    <div class="act">
      <div class="act-top">
        <div>
          <div class="act-desc">Rimuovere il materiale che ostruisce la via di esodo lato nord e ripristinare la segnaletica mancante</div>
          <div class="act-src">Da: “Vie di esodo sgombre e segnalate” · Antincendio</div>
        </div>
        <span class="pri alta">Alta</span>
      </div>
      <div class="act-meta"><span>Responsabile <b>Cliente</b></span><span>Scadenza <b>30/06/2026</b></span></div>
    </div>
    <div class="act scad">
      <div class="act-top">
        <div>
          <div class="act-desc">Prossimo controllo periodico del registro antincendio</div>
          <div class="act-src">Scadenza ricorrente da: “Registro controlli antincendio aggiornato”</div>
        </div>
        <span class="pri scad">Scadenza</span>
      </div>
      <div class="act-meta"><span>Responsabile <b>Cliente</b></span><span>Prossima <b>31/12/2026</b></span></div>
    </div>

    <h2 class="sec">Dettaglio degli esiti</h2>
    <div class="voce">
      <div class="voce-sez">Antincendio</div>
      <div class="voce-line"><div class="voce-req">Estintori presenti, accessibili e con revisione periodica valida</div><span class="badge ok">Conforme</span></div>
      <div class="rfotos"><div class="rfoto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8a2 2 0 0 1 2-2h2l1.4-2h7.2L19 6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.4"/></svg></div></div>
    </div>
    <div class="voce">
      <div class="voce-sez">Antincendio</div>
      <div class="voce-line"><div class="voce-req">Vie di esodo sgombre e correttamente segnalate</div><span class="badge no">Non conforme</span></div>
      <div class="voce-note">Materiale di magazzino accatastato lungo il corridoio nord; segnaletica di uscita parzialmente assente.</div>
      <div class="rfotos"><div class="rfoto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8a2 2 0 0 1 2-2h2l1.4-2h7.2L19 6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.4"/></svg></div><div class="rfoto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8a2 2 0 0 1 2-2h2l1.4-2h7.2L19 6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.4"/></svg></div></div>
    </div>
    <div class="voce">
      <div class="voce-sez">Antincendio</div>
      <div class="voce-line"><div class="voce-req">Registro dei controlli antincendio compilato e aggiornato</div><span class="badge ok">Conforme</span></div>
    </div>
    <div class="voce">
      <div class="voce-sez">Impianti</div>
      <div class="voce-line"><div class="voce-req">Quadri elettrici accessibili, chiusi e segnalati</div><span class="badge ok">Conforme</span></div>
    </div>
    <div class="voce">
      <div class="voce-sez">Impianti</div>
      <div class="voce-line"><div class="voce-req">Verifica periodica impianto di terra entro scadenza</div><span class="badge no">Non conforme</span></div>
      <div class="voce-note">Verifica biennale scaduta. In gestione tramite lo studio (vedi nota sotto).</div>
    </div>
    <div class="voce">
      <div class="voce-sez">Organizzazione e DPI</div>
      <div class="voce-line"><div class="voce-req">Cassetta di primo soccorso completa e in posizione nota</div><span class="badge ok">Conforme</span></div>
    </div>
    <div class="voce">
      <div class="voce-sez">Organizzazione e DPI</div>
      <div class="voce-line"><div class="voce-req">DPI previsti presenti, idonei e in buono stato</div><span class="badge ok">Conforme</span></div>
    </div>
    <div class="voce">
      <div class="voce-sez">Organizzazione e DPI</div>
      <div class="voce-line"><div class="voce-req">Segnaletica di sicurezza presente e leggibile</div><span class="badge na">Non applicabile</span></div>
    </div>

    <div class="callout" style="margin-top:16px;">La verifica dell'impianto di terra è in carico allo studio, che provvederà a calendarizzarne l'esecuzione. Non è richiesta azione da parte vostra.</div>

    <div class="doc-foot"><span>MAISON 22 S.R.L. · Sopralluogo 3/4 · 29/05/2026</span><span>Pag. 1</span></div>
  </section>

  <!-- ============ INTERNO ============ -->
  <section class="report" id="repInterno">
    <div class="doc-head">
      <div>
        <div class="logo">[ LOGO STUDIO ]</div>
        <div class="studio-sub">Documento operativo · uso interno</div>
      </div>
      <div class="doc-title">
        <h1>Report di sopralluogo</h1>
        <div class="kind int">Uso interno</div>
      </div>
    </div>
    <div class="accent"></div>

    <div class="meta">
      <div><span>Cliente</span><b>MAISON 22 S.R.L.</b></div>
      <div><span>Sede</span><b>Villafranca (VR)</b></div>
      <div><span>Data sopralluogo</span><b>29/05/2026</b></div>
      <div><span>Incarico</span><b>RSPP · Sopralluogo 3/4</b></div>
      <div><span>Tecnico</span><b>T. Pradella</b></div>
      <div><span>Durata</span><b>2h 45m</b></div>
    </div>

    <h2 class="sec">Sintesi</h2>
    <div class="summary">
      <div class="stat ok"><div class="num">5</div><div class="lab">Conformi</div></div>
      <div class="stat no"><div class="num">2</div><div class="lab">Non conformi</div></div>
      <div class="stat na"><div class="num">1</div><div class="lab">Non appl.</div></div>
    </div>

    <h2 class="sec">Attività interne da svolgere</h2>
    <div class="act int">
      <div class="act-top">
        <div>
          <div class="act-desc">Predisporre la richiesta di verifica periodica dell'impianto di terra all'organismo abilitato e calendarizzare l'intervento</div>
          <div class="act-src">Da: “Verifica periodica impianto di terra” · Impianti</div>
        </div>
        <span class="pri media">Media</span>
      </div>
      <div class="act-meta"><span>Assegnata a <b>M. Vedova</b></span><span>Scadenza <b>20/06/2026</b></span></div>
    </div>

    <h2 class="sec">Comunicato al cliente</h2>
    <div class="act">
      <div class="act-top">
        <div>
          <div class="act-desc">Rimuovere materiale che ostruisce la via di esodo e ripristinare segnaletica</div>
          <div class="act-src">Responsabile: Cliente · scadenza 30/06/2026 · priorità Alta</div>
        </div>
        <span class="pri alta">Alta</span>
      </div>
    </div>
    <div class="callout">Scadenza ricorrente inviata al cliente: controllo registro antincendio entro 31/12/2026.</div>

    <h2 class="sec">Esiti completi</h2>
    <div class="voce"><div class="voce-sez">Antincendio</div><div class="voce-line"><div class="voce-req">Estintori presenti, accessibili e con revisione valida</div><span class="badge ok">Conforme</span></div></div>
    <div class="voce"><div class="voce-sez">Antincendio</div><div class="voce-line"><div class="voce-req">Vie di esodo sgombre e segnalate</div><span class="badge no">Non conforme</span></div><div class="voce-note">→ azione cliente generata (Alta, 30/06).</div></div>
    <div class="voce"><div class="voce-sez">Antincendio</div><div class="voce-line"><div class="voce-req">Registro controlli antincendio aggiornato</div><span class="badge ok">Conforme</span></div><div class="voce-note">→ scadenza ricorrente cliente (31/12).</div></div>
    <div class="voce"><div class="voce-sez">Impianti</div><div class="voce-line"><div class="voce-req">Quadri elettrici accessibili, chiusi e segnalati</div><span class="badge ok">Conforme</span></div></div>
    <div class="voce"><div class="voce-sez">Impianti</div><div class="voce-line"><div class="voce-req">Verifica periodica impianto di terra entro scadenza</div><span class="badge no">Non conforme</span></div><div class="voce-note">→ attività interna assegnata a M. Vedova (Media, 20/06).</div></div>
    <div class="voce"><div class="voce-sez">Organizzazione e DPI</div><div class="voce-line"><div class="voce-req">Cassetta di primo soccorso completa</div><span class="badge ok">Conforme</span></div></div>
    <div class="voce"><div class="voce-sez">Organizzazione e DPI</div><div class="voce-line"><div class="voce-req">DPI presenti, idonei e in buono stato</div><span class="badge ok">Conforme</span></div></div>
    <div class="voce"><div class="voce-sez">Organizzazione e DPI</div><div class="voce-line"><div class="voce-req">Segnaletica di sicurezza presente e leggibile</div><span class="badge na">Non applicabile</span></div></div>

    <div class="doc-foot"><span>USO INTERNO · MAISON 22 S.R.L. · Sopralluogo 3/4</span><span>Pag. 1</span></div>
  </section>

</div>

<script>
var tabs=document.querySelectorAll('.tab');
tabs.forEach(function(t){
  t.addEventListener('click', function(){
    tabs.forEach(function(x){ x.classList.remove('on'); });
    t.classList.add('on');
    document.querySelectorAll('.report').forEach(function(r){ r.classList.remove('active'); });
    document.getElementById(t.dataset.t).classList.add('active');
  });
});
document.getElementById('print').addEventListener('click', function(){ window.print(); });
</script>
</body>
</html>
