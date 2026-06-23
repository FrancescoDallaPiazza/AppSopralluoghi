// Edge Function `organigramma-pdf`.
// Rende in PDF il riassunto dell'organigramma sicurezza di un cliente (figure +
// incaricati + stato formativo + ruoli scoperti + data). Tre modi di indicare i
// dati nel body JSON:
//   { riepilogo }      -> snapshot gia' valutato lato client (export corrente)
//   { revisione_id }   -> legge lo snapshot archiviato (export di una revisione)
//   { cliente_id }     -> usa l'ultima revisione archiviata del cliente
// Restituisce { url, formato }. PDF via PDFBolt (Chromium esterno: le Edge
// Function girano su Deno e non hanno un browser); se PDFBOLT_API_KEY non e'
// configurata ripiega su HTML, come `genera-report`.
//
// Self-contained: CORS inline, nessun import da ../_shared (cosi' e' deployabile
// anche dall'editor del Dashboard).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const BUCKET = 'report';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// --- tipi dello snapshot (allineati a src/lib/admin/organigramma-revisioni.ts) ---
interface SnapPersona {
  nome: string; mansione: string | null; reparto: string | null; stato: string;
  figure: { codice: string; nome: string }[];
  requisiti: { corso_nome: string; stato: string; dettaglio: string; scadenza: string | null }[];
  moduli: { corso_nome: string; stato: string; dettaglio: string }[];
}
interface Snap {
  cliente_id: string; cliente_nome: string; livello_rischio: string | null;
  generato_il: string; conteggi: Record<string, number>;
  figure_scoperte: { codice: string; nome: string; obbligo: string | null; corso_emergenza?: string | null }[];
  persone: SnapPersona[];
}

// --- helper PDF (gemelli di genera-report) ---
function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function htmlToPdf(html: string): Promise<Uint8Array | null> {
  const key = Deno.env.get('PDFBOLT_API_KEY');
  if (!key) return null;
  const htmlB64 = toBase64(new TextEncoder().encode(html));
  const res = await fetch('https://api.pdfbolt.com/v1/direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'API-KEY': key },
    body: JSON.stringify({
      html: htmlB64,
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`PDFBolt ${res.status} ${txt}`.slice(0, 300));
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder().decode(buf.subarray(0, 5));
  if (head !== '%PDF-') {
    const msg = new TextDecoder().decode(buf).slice(0, 300);
    throw new Error(`PDFBolt: risposta non-PDF (${buf.length} byte): ${msg}`);
  }
  return buf;
}

// --- rendering HTML ---
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const LABEL: Record<string, string> = {
  conforme: 'Conforme', in_scadenza: 'In scadenza', critico: 'Critico',
  esonerato: 'Esonerato', facoltativo: 'Facoltativo', da_verificare: 'Da verificare',
};
const COL: Record<string, string> = {
  conforme: '#1f7a3d', in_scadenza: '#9a6206', critico: '#a33227',
  esonerato: '#5b5f66', facoltativo: '#5b5f66', da_verificare: '#51607a',
};
const BG: Record<string, string> = {
  conforme: '#e7f3ea', in_scadenza: '#fbf0d6', critico: '#fbe3e0',
  esonerato: '#eef1f4', facoltativo: '#eef1f4', da_verificare: '#e8ebf0',
};

function chip(stato: string): string {
  const l = LABEL[stato] ?? stato;
  return `<span class="chip" style="color:${COL[stato] ?? '#333'};background:${BG[stato] ?? '#eee'}">${esc(l)}</span>`;
}

function dataIT(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return esc(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

function renderSnapshot(s: Snap, numero: number | null): string {
  const c = s.conteggi ?? {};
  const metrica = (k: string, v: number, col?: string) =>
    `<div class="m"><div class="mk">${esc(k)}</div><div class="mv" style="${col ? 'color:' + col : ''}">${v ?? 0}</div></div>`;

  const scoperti = (s.figure_scoperte ?? []).length
    ? `<div class="crit"><b>Ruoli obbligatori senza incaricato:</b> ${s.figure_scoperte.map((f) => esc(f.nome) + (f.corso_emergenza ? ' <i>(corso: ' + esc(f.corso_emergenza) + ')</i>' : '')).join(', ')}</div>`
    : '';

  const persone = (s.persone ?? []).map((p) => {
    const figure = p.figure?.length ? `<div class="fig">${p.figure.map((f) => esc(f.nome)).join(' &middot; ')}</div>` : '';
    const reqs = (p.requisiti ?? []).map((r) =>
      `<div class="row"><span class="corso">${esc(r.corso_nome)}${r.dettaglio ? ' &mdash; ' + esc(r.dettaglio) : ''}</span>${chip(r.stato)}</div>`).join('');
    const mods = (p.moduli ?? []).map((m) =>
      `<div class="row"><span class="corso">${esc(m.corso_nome)} <span class="tag">modulo</span>${m.dettaglio ? ' &mdash; ' + esc(m.dettaglio) : ''}</span>${chip(m.stato)}</div>`).join('');
    return `
      <div class="p">
        <div class="ptop"><span class="pn">${esc(p.nome)}${p.mansione ? ' &mdash; ' + esc(p.mansione) : ''}</span>${chip(p.stato)}</div>
        ${figure}
        ${reqs}${mods}
      </div>`;
  }).join('');

  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#23262b;font-size:12px;margin:0}
    h1{font-size:19px;margin:0 0 2px} .sub{color:#5b5f66;font-size:12px;margin:0 0 14px}
    .metrics{display:flex;gap:10px;margin:0 0 14px} .m{flex:1;border:1px solid #e3ddd2;border-radius:10px;padding:8px 10px}
    .mk{font-size:10px;color:#5b5f66} .mv{font-size:20px;font-weight:800;margin-top:1px}
    .crit{background:#fbe3e0;border:1px solid #e7b3ab;color:#a33227;border-radius:9px;padding:8px 10px;margin:0 0 12px;font-size:12px}
    .p{border:1px solid #e3ddd2;border-radius:10px;padding:9px 11px;margin:0 0 8px;page-break-inside:avoid}
    .ptop{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .pn{font-weight:700} .fig{color:#5b5f66;font-size:11px;margin:2px 0 4px}
    .row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:4px 0;border-top:1px solid #f0ece4}
    .corso{font-size:11.5px} .tag{font-size:9px;font-weight:800;text-transform:uppercase;color:#5b5f66;background:#eef1f4;border-radius:5px;padding:1px 5px}
    .chip{font-size:10px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;padding:2px 8px;border-radius:999px;white-space:nowrap;flex:0 0 auto}
    .foot{margin-top:16px;color:#9a958c;font-size:10px;border-top:1px solid #e3ddd2;padding-top:8px}
  </style></head><body>
    <h1>Organigramma sicurezza &mdash; ${esc(s.cliente_nome)}</h1>
    <p class="sub">Generato il ${dataIT(s.generato_il)}${numero != null ? ' &middot; revisione ' + numero : ''}${s.livello_rischio ? ' &middot; rischio ' + esc(s.livello_rischio) : ''}</p>
    <div class="metrics">
      ${metrica('Persone', s.persone?.length ?? 0)}
      ${metrica('Conformi', c.conforme ?? 0, '#1f7a3d')}
      ${metrica('In scadenza', c.in_scadenza ?? 0, '#9a6206')}
      ${metrica('Critici', c.critico ?? 0, '#a33227')}
    </div>
    ${scoperti}
    ${persone || '<p class="sub">Nessuna persona in organigramma.</p>'}
    <div class="foot">Documento generato automaticamente da AppSopralluoghi. Lo stato formativo e' fotografato alla data di generazione.</div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);

  try {
    const body = await req.json().catch(() => ({}));

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // Reperimento snapshot: dal body, da una revisione, o dall'ultima del cliente.
    let snap: Snap | null = null;
    let numero: number | null = null;

    if (body.riepilogo) {
      snap = body.riepilogo as Snap;
    } else if (body.revisione_id) {
      const { data, error } = await sb
        .from('organigramma_revisione')
        .select('numero, snapshot').eq('id', body.revisione_id).single();
      if (error) throw error;
      snap = (data as any)?.snapshot ?? null;
      numero = (data as any)?.numero ?? null;
    } else if (body.cliente_id) {
      const { data, error } = await sb
        .from('organigramma_revisione')
        .select('numero, snapshot').eq('cliente_id', body.cliente_id)
        .order('numero', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      snap = (data as any)?.snapshot ?? null;
      numero = (data as any)?.numero ?? null;
    }

    if (!snap) return json({ error: 'Nessuno snapshot da rendere (passa riepilogo, revisione_id o cliente_id).' }, 400);
    if (typeof body.revisione_numero === 'number') numero = body.revisione_numero;

    const html = renderSnapshot(snap, numero);

    let bytes: Uint8Array; let ext: string; let contentType: string; let pdfError: string | null = null;
    try {
      const pdf = await htmlToPdf(html);
      if (pdf) { bytes = pdf; ext = 'pdf'; contentType = 'application/pdf'; }
      else { bytes = new TextEncoder().encode(html); ext = 'html'; contentType = 'text/html; charset=utf-8'; }
    } catch (e) {
      pdfError = String((e as Error)?.message ?? e);
      console.error('Generazione PDF organigramma fallita:', pdfError);
      bytes = new TextEncoder().encode(html); ext = 'html'; contentType = 'text/html; charset=utf-8';
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const path = `organigramma/${snap.cliente_id}/${stamp}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
    if (up.error) throw up.error;

    const signed = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signed.error) throw signed.error;

    return json({ url: signed.data.signedUrl, formato: ext, pdf_error: pdfError });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
