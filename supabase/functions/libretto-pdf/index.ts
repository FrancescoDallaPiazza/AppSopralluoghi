// Edge Function `libretto-pdf`.
// Rende in PDF il LIBRETTO FORMATIVO di una persona: anagrafica, ruoli in
// organigramma con data di nomina e formazione svolta raggruppata per tipologia
// (corso base e suoi aggiornamenti insieme, dal piu' vecchio al piu' recente).
// E' un dossier di sicurezza (D.Lgs. 81/08), non il libretto formativo del
// cittadino (D.Lgs. 276/2003), che comprenderebbe titoli di studio ed esperienze
// lavorative: dati che l'app non tiene.
//
// Solo FATTI: nessuna valutazione dei requisiti. Un "critico" stampato dipende
// dai ruoli e dal catalogo del giorno in cui il PDF e' stato generato, e su un
// foglio ritrovato mesi dopo diventa un'affermazione sbagliata su una persona.
//
// Body JSON: { libretto } - gia' composto lato client da lib/admin/libretto.ts.
// La funzione non ricalcola e non riordina nulla: altrimenti il documento che si
// consegna a un terzo potrebbe raccontare una storia diversa dalla schermata.
// Restituisce { url, formato }: PDF via PDFBolt (le Edge Function girano su Deno
// e non hanno un browser); senza PDFBOLT_API_KEY ripiega su HTML, come
// `genera-report` e `organigramma-pdf`.
//
// Self-contained: CORS inline, nessun import da ../_shared (deployabile anche
// dall'editor del Dashboard).

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

// --- tipi (allineati a src/lib/admin/libretto.ts) ---
interface Voce {
  corso_nome: string; corso_codice: string | null; categoria: string | null;
  data_completamento: string | null; ore: number | null; ente_formatore: string | null;
  is_aggiornamento: boolean; parziale: boolean; evidenza_incompleta?: boolean;
  scadenza: string | null; note: string | null;
}
interface Gruppo {
  chiave: string; titolo: string; categoria: string | null;
  voci: Voce[];                 // dal piu' VECCHIO al piu' recente
  ore_totali: number | null; scadenza: string | null;
}
interface Ruolo { codice: string; nome: string; data_nomina: string | null; evidenza_mancante: boolean }
interface Libretto {
  generato_il: string; cliente_nome: string;
  persona: {
    nome: string; codice_fiscale: string | null; mansione: string | null; reparto: string | null;
    data_assunzione: string | null; livello_rischio: string | null; attivo: boolean;
  };
  ruoli: Ruolo[]; gruppi: Gruppo[];
}

// --- helper PDF (gemelli di organigramma-pdf) ---
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
  const footer = '<div style="width:100%;font-size:8px;color:#9a958c;text-align:right;padding:0 14mm;">'
    + 'Pag. <span class="pageNumber"></span> di <span class="totalPages"></span></div>';
  const b64 = (s: string) => toBase64(new TextEncoder().encode(s));
  const res = await fetch('https://api.pdfbolt.com/v1/direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'API-KEY': key },
    body: JSON.stringify({
      html: htmlB64,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: b64('<span></span>'),
      footerTemplate: b64(footer),
      margin: { top: '14mm', right: '14mm', bottom: '18mm', left: '14mm' },
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

function dataBreve(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : esc(iso);
}

function render(l: Libretto): string {
  const p = l.persona;
  const anag = [
    p.codice_fiscale ? 'CF ' + esc(p.codice_fiscale) : null,
    p.mansione ? esc(p.mansione) : null,
    p.reparto ? esc(p.reparto) : null,
    p.data_assunzione ? 'assunto il ' + dataBreve(p.data_assunzione) : null,
    p.livello_rischio ? 'rischio ' + esc(p.livello_rischio) : null,
    p.attivo ? null : '<b>NON ATTIVO</b>',
  ].filter(Boolean).join(' &middot; ');

  const ruoli = l.ruoli.map((r) => `<tr>
      <td>${esc(r.nome)}</td>
      <td>${r.data_nomina ? dataBreve(r.data_nomina) : '<span class="vuoto">non indicata</span>'}</td>
      <td>${r.evidenza_mancante ? '<span class="warn">evidenza di nomina da ottenere</span>' : ''}</td>
    </tr>`).join('');

  // Una riga di intestazione per TIPOLOGIA, poi le sue voci dalla piu' vecchia
  // alla piu' recente: base e aggiornamenti in fila, che e' come si legge la
  // storia di un obbligo. L'ordine dentro il gruppo arriva gia' composto dal
  // client (lib/admin/libretto.ts): qui non si riordina niente, altrimenti PDF e
  // schermata potrebbero raccontare due storie diverse.
  const gruppi = (l.gruppi ?? []).map((g) => {
    const testa = `<tr class="grp">
      <td colspan="3"><b>${esc(g.titolo)}</b>${g.categoria ? ` <span class="tag">${esc(g.categoria)}</span>` : ''}</td>
      <td class="num">${g.ore_totali != null ? esc(g.ore_totali) + 'h' : ''}</td>
      <td>${g.scadenza ? 'scad. ' + dataBreve(g.scadenza) : ''}</td>
    </tr>`;
    const righe = g.voci.map((v) => {
      const tag = [
        v.is_aggiornamento ? '<span class="tag">aggiornamento</span>' : '',
        v.parziale ? '<span class="tag warn">spezzone</span>' : '',
        v.evidenza_incompleta ? '<span class="tag warn">evidenza incompleta</span>' : '',
      ].join('');
      // Cosa manca, per esteso: senza, il documento stampa "3h" e tace sulle
      // altre 5, che e' proprio il buco che deve far vedere.
      const manca = v.evidenza_incompleta
        ? `<div class="sub warn">Documentazione incompleta: la parte mancante va recuperata e registrata.</div>`
        : '';
      // Il nome della voce si stampa solo se diverso dal titolo del gruppo: sulle
      // evidenze pregresse e' la dicitura originale dell'attestato, quella che si
      // ritrova sul cartaceo.
      const nome = v.corso_nome === g.titolo ? '' : `<div class="sub">${esc(v.corso_nome)}</div>`;
      return `<tr>
        <td class="ind">${v.data_completamento ? dataBreve(v.data_completamento) : '<span class="vuoto">data n.d.</span>'}${tag}${nome}${v.note ? `<div class="sub">${esc(v.note)}</div>` : ''}${manca}</td>
        <td>${esc(v.ente_formatore ?? '')}</td>
        <td></td>
        <td class="num">${v.ore != null ? esc(v.ore) + 'h' : ''}</td>
        <td>${v.scadenza ? dataBreve(v.scadenza) : ''}</td>
      </tr>`;
    }).join('');
    return testa + righe;
  }).join('');

  return `<!doctype html><html lang="it"><head><meta charset="utf-8">
  <title>Libretto formativo - ${esc(p.nome)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#23262b;font-size:11px;margin:0}
    h1{font-size:19px;margin:0 0 2px}
    h2{font-size:12.5px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.04em;color:#4a5568}
    .sotto{color:#6b7078;font-size:11px;margin:0 0 2px}
    .anag{color:#4a5568;font-size:11px;margin:6px 0 0}
    table{width:100%;border-collapse:collapse;margin-top:4px}
    th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:#6b7078;
       border-bottom:1px solid #d9d5cd;padding:4px 6px}
    td{padding:5px 6px;border-bottom:1px solid #ece8e1;vertical-align:top}
    td.num{text-align:right;white-space:nowrap}
    /* Stacco netto fra una tipologia e la successiva: dentro il blocco le
       voci sono divise da filetti sottili, e senza un bordo piu' spesso la
       fine di un corso e l'inizio del prossimo si somigliano. */
    tr.grp td{background:#f6f4f0;border-top:2px solid #8c8578;border-bottom:1px solid #d9d5cd;padding-top:7px}
    tr.grp:first-child td{border-top:none}
    td.ind{padding-left:16px}
    .sub{color:#6b7078;font-size:10px;margin-top:1px}
    .sub.warn{color:#9a6206}
    .vuoto{color:#9a958c}
    .warn{color:#9a6206}
    .tag{display:inline-block;margin-left:5px;padding:1px 5px;border-radius:9px;background:#eef1f4;
         color:#5b5f66;font-size:9px;vertical-align:middle}
    .tag.warn{background:#fbf0d6;color:#9a6206}
    .foot{margin-top:22px;padding-top:8px;border-top:1px solid #ece8e1;color:#9a958c;font-size:9px}
  </style></head><body>
    <h1>Libretto formativo</h1>
    <div class="sotto">${esc(p.nome)} &middot; ${esc(l.cliente_nome)}</div>
    <div class="anag">${anag}</div>
    <h2>Ruoli in organigramma</h2>
    <table>
      <thead><tr><th>Ruolo</th><th>Data nomina</th><th></th></tr></thead>
      <tbody>${ruoli || '<tr><td class="vuoto" colspan="3">Nessun ruolo assegnato.</td></tr>'}</tbody>
    </table>

    <h2>Formazione svolta, per tipologia</h2>
    <table>
      <thead><tr><th>Corso / svolgimento</th><th>Ente</th><th></th><th class="num">Ore</th><th>Scade il</th></tr></thead>
      <tbody>${gruppi || '<tr><td class="vuoto" colspan="5">Nessun attestato registrato.</td></tr>'}</tbody>
    </table>

    <div class="foot">
      Generato da AppSopralluoghi il ${dataBreve(l.generato_il)}. Documento interno di sicurezza
      (D.Lgs. 81/08): riporta ruoli, formazione svolta e scadenze; non
      riporta la valutazione dei requisiti, che dipende dai ruoli e dal catalogo
      del momento e si consulta in organigramma. Non e' il libretto formativo del
      cittadino (D.Lgs. 276/2003). Lo stato e' fotografato alla data di generazione.
    </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const lib = body.libretto as Libretto | undefined;
    if (!lib?.persona?.nome) return json({ error: 'Nessun libretto da rendere (manca `libretto`).' }, 400);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const html = render(lib);

    let bytes: Uint8Array; let ext: string; let contentType: string; let pdfError: string | null = null;
    try {
      const pdf = await htmlToPdf(html);
      if (pdf) { bytes = pdf; ext = 'pdf'; contentType = 'application/pdf'; }
      else { bytes = new TextEncoder().encode(html); ext = 'html'; contentType = 'text/html; charset=utf-8'; }
    } catch (e) {
      pdfError = String((e as Error)?.message ?? e);
      console.error('Generazione PDF libretto fallita:', pdfError);
      bytes = new TextEncoder().encode(html); ext = 'html'; contentType = 'text/html; charset=utf-8';
    }

    // Nome file leggibile: il documento si consegna, e "libretto/uuid/2026-...pdf"
    // in una cartella di download non dice a chi appartiene.
    const slug = lib.persona.nome.toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const path = `libretto/${slug || 'persona'}/${stamp}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
    if (up.error) throw up.error;

    const signed = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signed.error) throw signed.error;

    return json({ url: signed.data.signedUrl, formato: ext, pdf_error: pdfError });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
