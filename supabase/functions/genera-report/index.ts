// Edge Function `genera-report`.
// Body JSON: { sopralluogo_id, variante?: 'cliente'|'interna', formato?: 'html'|'pdf',
//              invia_email?: boolean, email_destinatario?: string }
// Restituisce { url, formato, variante, emailed, email_to?, email_reason? }.
//
// PDF: le Edge Function girano su Deno e non hanno Chromium, quindi la
// conversione HTML->PDF usa il servizio esterno PDFBolt (Chromium-based, UE/GDPR,
// 100 PDF/mese gratis). Segreto: PDFBOLT_API_KEY. Se non configurato, ripiega
// su HTML (allegato apribile dopo download).
//
// Email: invio via SMTP (stesso canale di `notifica-azione`, es. SupportHost).
// Segreti: SMTP_HOST, SMTP_PORT (465 SSL o 587 STARTTLS), SMTP_USER, SMTP_PASS,
// MAIL_FROM. Se invia_email è true e non si passa email_destinatario, l'email
// viene presa da cliente.email (anagrafica). Se i segreti SMTP mancano o il
// cliente non ha email, l'URL viene comunque restituito e emailed = false.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { assemblaReport, type Variante } from './report-data.ts';
import { renderReport } from './report-html.ts';

const BUCKET = 'report';

// --- CORS inline (self-contained: niente import da ../_shared) -------------
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

// Base64 di un Uint8Array (a blocchi, per non sforare lo stack su file grandi).
function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Converte l'HTML in PDF tramite PDFBolt. PDFBolt vuole l'HTML codificato in
// Base64 nel campo `html`. Ritorna null se la chiave non è configurata (così si
// ripiega sull'HTML); rilancia in caso di errore vero.
async function htmlToPdf(html: string): Promise<Uint8Array | null> {
  const key = Deno.env.get('PDFBOLT_API_KEY');
  if (!key) return null;

  // Base64 dei byte UTF-8 (btoa da solo non gestisce gli accenti).
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
  return new Uint8Array(await res.arrayBuffer());
}

interface Allegato { filename: string; content: Uint8Array; contentType: string; }

// Invio via SMTP (denomailer), identico a notifica-azione. Ritorna false se i
// segreti non sono configurati; rilancia in caso di errore SMTP vero.
async function inviaEmailSMTP(
  to: string, oggetto: string, html: string, allegato?: Allegato,
): Promise<boolean> {
  const host = Deno.env.get('SMTP_HOST');
  const portStr = Deno.env.get('SMTP_PORT');
  const user = Deno.env.get('SMTP_USER');
  const pass = Deno.env.get('SMTP_PASS');
  const from = Deno.env.get('MAIL_FROM') ?? user;
  if (!host || !portStr || !user || !pass || !from) return false;

  const port = Number(portStr);
  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls: port === 465, // 465 = TLS implicito; 587 = STARTTLS
      auth: { username: user, password: pass },
    },
  });
  try {
    await client.send({
      from, to, subject: oggetto, html, content: 'auto',
      attachments: allegato
        ? [{
            filename: allegato.filename,
            contentType: allegato.contentType,
            encoding: 'base64',
            content: toBase64(allegato.content),
          }]
        : undefined,
    });
    return true;
  } finally {
    try { await client.close(); } catch { /* ignora */ }
  }
}

function corpoEmailCliente(clienteNome: string, link: string, allegato: boolean): string {
  const intro = allegato
    ? `<p>è disponibile il report del sopralluogo effettuato, che trova <b>in allegato</b> a questa email.</p>`
    : `<p>è disponibile il report del sopralluogo effettuato. Può consultarlo al link seguente:</p>`;
  return `
    <p>Spett.le ${clienteNome},</p>
    ${intro}
    <p>In alternativa può aprirlo da questo link: <a href="${link}">apri il report</a>.</p>
    <p style="color:#666;font-size:12px">Il link è valido per un tempo limitato. In caso di necessità, ci contatti pure per una nuova copia.</p>`;
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
      else { bytes = new TextEncoder().encode(html); ext = 'html'; contentType = 'text/html; charset=utf-8'; }
    } else {
      bytes = new TextEncoder().encode(html); ext = 'html'; contentType = 'text/html; charset=utf-8';
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const path = `${sopralluogoId}/${variante}-${stamp}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
    if (up.error) throw up.error;

    const signed = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7); // 7 giorni
    if (signed.error) throw signed.error;
    const url = signed.data.signedUrl;

    // invio email (opzionale)
    let emailed = false;
    let emailTo: string | null = null;
    let emailReason: string | null = null;

    if (body.invia_email) {
      // destinatario: esplicito, altrimenti l'email del cliente dall'anagrafica
      emailTo = body.email_destinatario ? String(body.email_destinatario) : null;
      if (!emailTo) {
        const { data: ctx } = await sb
          .from('sopralluogo')
          .select('incarico:incarico!incarico_id ( cliente:cliente!cliente_id ( email ) )')
          .eq('id', sopralluogoId)
          .maybeSingle();
        const inc = Array.isArray((ctx as any)?.incarico) ? (ctx as any).incarico[0] : (ctx as any)?.incarico;
        const cli = Array.isArray(inc?.cliente) ? inc.cliente[0] : inc?.cliente;
        emailTo = cli?.email ?? null;
      }

      if (!emailTo) {
        emailReason = 'Il cliente non ha un indirizzo email in anagrafica.';
      } else {
        try {
          const allegato: Allegato = {
            filename: `Report-sopralluogo.${ext}`,
            content: bytes,
            contentType: ext === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8',
          };
          const inviato = await inviaEmailSMTP(
            emailTo,
            `Report sopralluogo · ${dati.cliente.ragione_sociale}`,
            corpoEmailCliente(dati.cliente.ragione_sociale, url, true),
            allegato,
          );
          emailed = inviato;
          if (!inviato) emailReason = 'Invio email non configurato (segreti SMTP mancanti).';
        } catch (e) {
          emailReason = `Errore invio email: ${String((e as Error)?.message ?? e)}`;
        }
      }
    }

    return json({ url, formato: ext, variante, emailed, email_to: emailTo, email_reason: emailReason });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
