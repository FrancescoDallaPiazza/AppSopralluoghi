// Stile condiviso del back-office. Stessa palette del resto dell'app
// (vedi Login.tsx / mockup report). Tutto scoping sotto `.bo`.

export const CSS_BACKOFFICE = `
.bo{
  --ink:#16181c; --ink-soft:#5b5f66; --faint:#8a8d93; --line:#e3ddd2; --paper:#f5f2ec;
  --hi:#f4a012; --hi-dark:#9a6a07; --no:#d8442f; --no-bg:#fbeae6; --ok:#2f8f4e; --ok-bg:#e7f3ea;
  font-family:-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",sans-serif;
  background:#d9d4ca; color:var(--ink); min-height:100vh;
}
.bo *{box-sizing:border-box;}

/* header */
.bo-top{position:sticky; top:0; z-index:20; background:#fffdf9; border-bottom:1px solid var(--line);}
.bo-top-in{max-width:1040px; margin:0 auto; padding:12px 18px; display:flex; align-items:center; gap:14px;}
.bo-brand{font-weight:800; font-size:18px; letter-spacing:-.3px;}
.bo-brand small{display:block; font-weight:600; font-size:11.5px; color:var(--ink-soft); letter-spacing:0;}
.bo-sp{flex:1;}
.bo-tabs{max-width:1040px; margin:0 auto; padding:0 18px; display:flex; gap:4px;}
.bo-tab{border:none; background:none; font-family:inherit; font-size:13.5px; font-weight:700; color:var(--ink-soft);
  padding:11px 14px 12px; cursor:pointer; border-bottom:2.5px solid transparent;}
.bo-tab.on{color:var(--ink); border-bottom-color:var(--hi);}

/* livello 2: sotto-tab del gruppo attivo */
.bo-subtabs{max-width:1040px; margin:0 auto; padding:6px 18px 0; display:flex; gap:6px; flex-wrap:wrap;
  border-top:1px solid var(--line); background:#fdfbf7;}
.bo-subtab{border:1px solid transparent; background:none; font-family:inherit; font-size:12.5px; font-weight:700;
  color:var(--ink-soft); padding:5px 11px; margin-bottom:6px; border-radius:999px; cursor:pointer;}
.bo-subtab:hover{border-color:var(--line);}
.bo-subtab.on{color:#1a1205; background:var(--hi); border-color:var(--hi);}

/* layout */
.bo-main{max-width:1040px; margin:0 auto; padding:20px 18px 60px;}
.bo-h{font-size:16px; font-weight:800; margin:0 0 2px;}
.bo-sub{font-size:12.5px; color:var(--ink-soft); margin:0 0 16px;}

/* card */
.bo-card{background:#fff; border:1px solid var(--line); border-radius:14px; padding:16px 16px; margin-bottom:12px;
  box-shadow:0 14px 40px -32px rgba(0,0,0,.5);}
.bo-card.flat{box-shadow:none;}
.bo-card.dim{opacity:.62;}

/* accordion (sezioni apri/chiudi della scheda cliente) */
.bo-acc{background:#fff; border:1px solid var(--line); border-radius:14px; margin-bottom:12px;
  box-shadow:0 14px 40px -32px rgba(0,0,0,.5); overflow:hidden;}
.bo-acc-head{display:flex; align-items:center; gap:11px; width:100%; text-align:left;
  border:none; background:none; font-family:inherit; cursor:pointer; padding:14px 16px;}
.bo-acc-head:hover{background:var(--paper);}
.bo-acc-chev{font-size:11px; color:var(--faint); transition:transform .15s; flex:none;}
.bo-acc.open .bo-acc-chev{transform:rotate(90deg);}
.bo-acc-tit{font-weight:800; font-size:15px; color:var(--ink);}
.bo-acc-sum{font-size:12.5px; color:var(--ink-soft);}
.bo-acc-body{padding:2px 16px 16px;}

/* list row */
.bo-row{display:flex; align-items:center; gap:12px;}
.bo-row .grow{flex:1; min-width:0;}
.bo-title{font-weight:700; font-size:14.5px; line-height:1.3;}
.bo-meta{font-size:12px; color:var(--ink-soft); margin-top:3px; display:flex; gap:12px; flex-wrap:wrap;}
.bo-meta b{color:var(--ink); font-weight:600;}

/* fields */
.bo-field{display:block; margin-bottom:12px;}
.bo-field>span{display:block; font-size:11.5px; font-weight:700; color:var(--ink-soft); margin-bottom:5px; letter-spacing:.02em;}
.bo-grid{display:grid; grid-template-columns:1fr 1fr; gap:12px;}
.bo input:not([type=checkbox]):not([type=radio]):not([type=file]), .bo select, .bo textarea{
  width:100%; -webkit-appearance:none; appearance:none; border:1px solid var(--line);
  border-radius:10px; padding:10px 11px; font-family:inherit; font-size:14px; background:#fbfaf7; color:var(--ink);}
.bo textarea{resize:vertical; min-height:54px;}
.bo input:focus, .bo select:focus, .bo textarea:focus{outline:none; border-color:var(--hi); background:#fff;}
.bo label.chk{display:inline-flex; align-items:center; gap:7px; font-size:13px; color:var(--ink); cursor:pointer;}
.bo label.chk input{width:16px; height:16px; accent-color:var(--hi);}

/* buttons */
.bo-btn{border:1px solid var(--hi); background:var(--hi); color:#1a1205; border-radius:10px; padding:9px 14px;
  font-family:inherit; font-weight:800; font-size:13.5px; cursor:pointer; transition:.12s; white-space:nowrap;}
.bo-btn:active{transform:scale(.99);}
.bo-btn:disabled{opacity:.55; cursor:default;}
.bo-btn.ghost{background:#fff; border-color:var(--line); color:var(--ink);}
.bo-btn.ghost:hover{border-color:var(--hi);}
.bo-btn.danger{background:#fff; border-color:#e9c3ba; color:var(--no);}
.bo-btn.sm{padding:6px 10px; font-size:12.5px; border-radius:8px;}
.bo-iconbtn{border:1px solid var(--line); background:#fff; border-radius:8px; width:30px; height:30px; cursor:pointer;
  font-size:15px; line-height:1; color:var(--ink-soft);}
.bo-iconbtn:hover{border-color:var(--hi); color:var(--ink);}
.bo-iconbtn:disabled{opacity:.4; cursor:default;}

/* pills */
.bo-pill{font-size:10.5px; font-weight:800; letter-spacing:.04em; padding:3px 8px; border-radius:6px; text-transform:uppercase;}
.bo-pill.attivo{background:var(--ok-bg); color:var(--ok);}
.bo-pill.archiviato{background:#ece8df; color:var(--faint);}
.bo-pill.usato{background:#fbeccb; color:var(--hi-dark);}
.bo-pill.warn{background:var(--no-bg); color:var(--no);}

/* voce editor */
.bo-voce{border:1px solid var(--line); border-left:3px solid var(--hi); border-radius:12px; padding:14px; margin-bottom:10px; background:#fffdf9;}
.bo-voce.child{border-left-color:#c9c2b4; margin:8px 0 8px 18px; background:#fbfaf7;}
.bo-voce-top{display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;}
.bo-opz{display:flex; gap:8px; align-items:center; margin-bottom:7px;}
.bo-opz input[type=text]{flex:1;}
.bo-opz select{width:130px;}

.bo-empty{text-align:center; color:var(--ink-soft); font-size:13px; padding:26px 10px;}
.bo-err{background:var(--no-bg); color:var(--no); border:1px solid #f1c4b9; border-radius:10px; padding:9px 11px; font-size:12.5px; margin-bottom:12px;}
.bo-note{background:#fbf6ea; border:1px solid #f0e2c2; color:var(--hi-dark); border-radius:10px; padding:9px 11px; font-size:12.5px; margin-bottom:12px;}
.bo-bar{display:flex; gap:10px; align-items:center; margin-top:16px;}

@media(max-width:620px){
  .bo-grid{grid-template-columns:1fr;}
  .bo-tabs{overflow-x:auto;}
}
`;
