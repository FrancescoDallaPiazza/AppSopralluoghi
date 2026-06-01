// Edge Function `notifica-azione`.
// Body JSON: { azione_id: string }
// Invia un'email al destinatario di una "cosa da fare" (azione):
//   * risorsa interna = AREA  -> area_interna.email
//   * risorsa interna = TECNICO -> email dell'utente collegato (auth.users via
//     tecnico.user_id; richiede la service-role key, che qui è disponibile)
//   * cliente -> NON notificato da qui (gli esiti al cliente passano dal report)
//
// Invio via SMTP (es. SupportHost: mail.tuodominio.it). Segreti richiesti:
//   SMTP_HOST, SMTP_PORT (465 SSL o 587 STARTTLS), SMTP_USER, SMTP_PASS, MAIL_FROM
// Se i segreti SMTP non ci sono, risponde { sent:false, reason } senza errore.
// Idempotenza leggera: non rispedisce se l'azione risulta già notificata
// (colonna notificata_il, vedi migration 010).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const fmtData = (d: string | null): string => {
  if (!d) return '—';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y}`;
};

// Invio via SMTP. Ritorna false se i segreti non sono configurati; rilancia in
// caso di errore vero (così il chiamante può registrarlo).
async function inviaEmail(to: string, oggetto: string, html: string): Promise<boolean> {
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
      // 465 = TLS implicito; 587 = STARTTLS (tls:false + connessione aggiornata)
      tls: port === 465,
      auth: { username: user, password: pass },
    },
  });
  try {
    await client.send({ from, to, subject: oggetto, html, content: 'auto' });
    return true;
  } finally {
    try { await client.close(); } catch { /* ignora */ }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const azioneId: string | undefined = body.azione_id;
    if (!azioneId) return json({ error: 'azione_id mancante' }, 400);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // azione + contesto (cliente d'origine, area, tecnico.user_id, voce)
    const { data: a, error } = await sb
      .from('azione')
      .select(`
        id, descrizione, tipo, priorita, data_scadenza, stato,
        responsabile_tipo, responsabile_area_id, responsabile_interno_id, notificata_il,
        area:area_interna!responsabile_area_id ( nome, email ),
        tecnico:tecnico!responsabile_interno_id ( nome, user_id ),
        sopr:sopralluogo!sopralluogo_origine_id (
          progressivo,
          incarico:incarico!incarico_id (
            tipo_attivita, cliente:cliente!cliente_id ( ragione_sociale )
          )
        )
      `)
      .eq('id', azioneId)
      .maybeSingle();
    if (error) throw error;
    if (!a) return json({ error: 'Azione non trovata' }, 404);

    if (a.responsabile_tipo !== 'risorsa_interna') {
      return json({ sent: false, reason: 'destinatario non interno (cliente)' });
    }
    if (a.notificata_il) {
      return json({ sent: false, reason: 'già notificata', notificata_il: a.notificata_il });
    }

    const uno = <T,>(v: T | T[] | null | undefined): T | undefined =>
      Array.isArray(v) ? v[0] : (v ?? undefined);
    const area = uno<any>(a.area);
    const tecnico = uno<any>(a.tecnico);
    const sopr = uno<any>(a.sopr);
    const inc = uno<any>(sopr?.incarico);
    const cli = uno<any>(inc?.cliente);

    // risolvi email + nome destinatario
    let to: string | null = null;
    let destinatario = '';
    if (a.responsabile_area_id) {
      to = area?.email ?? null;
      destinatario = area?.nome ?? 'Area';
    } else if (a.responsabile_interno_id && tecnico?.user_id) {
      const u = await sb.auth.admin.getUserById(tecnico.user_id);
      to = u.data.user?.email ?? null;
      destinatario = tecnico?.nome ?? 'Tecnico';
    }
    if (!to) {
      return json({ sent: false, reason: 'destinatario senza email' });
    }

    const cliente = cli?.ragione_sociale ?? '—';
    const tipoLabel = a.tipo === 'scadenza_ricorrente' ? 'Scadenza ricorrente' : 'Azione correttiva';
    const oggetto = `Nuova cosa da fare · ${cliente}`;
    const html = `
      <p>Ciao ${destinatario},</p>
      <p>ti è stata assegnata una <b>cosa da fare</b>:</p>
      <table cellpadding="6" style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
        <tr><td><b>Descrizione</b></td><td>${a.descrizione ?? '—'}</td></tr>
        <tr><td><b>Cliente</b></td><td>${cliente}</td></tr>
        <tr><td><b>Tipo</b></td><td>${tipoLabel}</td></tr>
        <tr><td><b>Priorità</b></td><td>${a.priorita ?? 'media'}</td></tr>
        <tr><td><b>Scadenza</b></td><td>${fmtData(a.data_scadenza)}</td></tr>
      </table>
      <p style="color:#666;font-size:12px">Sopralluogo: ${[inc?.tipo_attivita, sopr?.progressivo].filter(Boolean).join(' · ') || '—'}</p>`;

    const sent = await inviaEmail(to, oggetto, html);
    if (sent) {
      await sb.from('azione').update({ notificata_il: new Date().toISOString() }).eq('id', azioneId);
    }
    return json({ sent, reason: sent ? null : 'invio email non configurato' });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
