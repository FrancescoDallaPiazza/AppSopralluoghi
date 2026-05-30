// Edge Function `genera-report`.
// Body JSON: { sopralluogo_id, variante?: 'cliente'|'interna', formato?: 'html'|'pdf',
//              invia_email?: boolean, email_destinatario?: string }
// Restituisce { url } (URL firmato all'artefatto nel bucket privato 'report').
//
// PDF: le Edge Function girano su Deno e non hanno Chromium, quindi la
// conversione HTML->PDF usa un servizio esterno compatibile "browserless"
// (env PDF_SERVICE_URL + PDF_SERVICE_TOKEN). Se non configurato, ripiega su
// HTML stampabile (stessa resa A4 via "Stampa -> Salva come PDF").
// Email opzionale via Resend (env RESEND_API_KEY + REPORT_FROM_EMAIL).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { assemblaReport, type Variante } from './report-data.ts';
import { renderReport } from './report-html.ts';

const BUCKET = 'report';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function htmlToPdf(html: string): Promise<Uint8Array | null> {
  const url = Deno.env.get('PDF_SERVICE_URL');
  if (!url) return null;
  const token = Deno.env.get('PDF_SERVICE_TOKEN');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    // contratto browserless /pdf
    body: JSON.stringify({ html, options: { printBackground: true, format: 'A4', preferCSSPageSize: true } }),
  });
  if (!res.ok) throw new Error(`PDF service ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function inviaEmail(to: string, link: string, oggetto: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('REPORT_FROM_EMAIL');
  if (!key || !from) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from, to, subject: oggetto,
      html: `<p>In allegato (link) il report del sopralluogo.</p><p><a href="${link}">Apri il report</a></p>`,
    }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const sopralluogoId: string | undefined = body.sopralluogo_id;
    const variante: Variante = body.variante === 'interna' ? 'interna' : 'cliente';
    const formato: 'html' | 'pdf' = body.formato === 'pdf' ? 'pdf' : 'html';
    if (!sopralluogoId) return json({ error: 'sopralluogo_id mancante' }, 400);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const dati = await assemblaReport(sb, sopralluogoId, variante);
    const html = renderReport(dati);

    // artefatto: PDF se richiesto e servizio disponibile, altrimenti HTML
    let bytes: Uint8Array;
    let ext: string;
    let contentType: string;
    if (formato === 'pdf') {
      const pdf = await htmlToPdf(html);
      if (pdf) { bytes = pdf; ext = 'pdf'; contentType = 'application/pdf'; }
      else { bytes = new TextEncoder().encode(html); ext = 'html'; contentType = 'text/html'; }
    } else {
      bytes = new TextEncoder().encode(html); ext = 'html'; contentType = 'text/html';
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const path = `${sopralluogoId}/${variante}-${stamp}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
    if (up.error) throw up.error;

    const signed = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60); // 1h
    if (signed.error) throw signed.error;
    const url = signed.data.signedUrl;

    let emailed = false;
    if (body.invia_email && body.email_destinatario) {
      emailed = await inviaEmail(
        String(body.email_destinatario), url,
        `Report sopralluogo · ${dati.cliente.ragione_sociale}`,
      );
    }

    return json({ url, formato: ext, variante, emailed });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
