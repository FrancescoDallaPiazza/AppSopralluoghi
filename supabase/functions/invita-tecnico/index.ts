// Edge Function `invita-tecnico` (self-contained, deploy "Via Editor").
//
// Scopo: chiudere il buco dell'onboarding. Oggi l'admin crea l'utente a mano in
// Supabase (Auth -> Add user) e poi scrive l'UUID in `tecnico.user_id`. Questa
// funzione fa tutto in un colpo, con la service role:
//   1) verifica che il chiamante sia uno staff autenticato (fase 1: tutti gli
//      autenticati sono staff fidato);
//   2) trova o crea la riga `tecnico`;
//   3) crea l'account di login (invito via email, oppure link da inoltrare);
//   4) collega `tecnico.user_id` all'utente creato (idempotente).
//
// Body JSON:
//   {
//     tecnico_id?: string,        // collega un tecnico ESISTENTE
//     nome?: string,              // ...oppure crea un tecnico nuovo (serve nome)
//     email: string,              // obbligatoria: indirizzo del login
//     base_localita?: string,
//     capienza_ore_settimana?: number,
//     modalita?: 'invito' | 'link', // default 'invito' (manda l'email da solo)
//     redirect_to?: string        // dove atterra l'utente dopo aver scelto la password
//   }
//
// Risposta:
//   { tecnico_id, user_id, email, modalita, action_link?, gia_esistente, collegato }
//
// Env (forniti in automatico alle Edge Function): SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// --- CORS inline (self-contained: niente import da ../_shared) -------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Cerca un utente auth per email scorrendo le pagine (team piccoli: poche pagine).
async function trovaUtentePerEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<{ id: string; email: string | null } | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = (data?.users ?? []).find(
      (x) => (x.email ?? '').toLowerCase() === target,
    );
    if (u) return { id: u.id, email: u.email ?? null };
    if (!data || data.users.length < 200) break; // ultima pagina
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey) return json({ error: 'Configurazione server mancante.' }, 500);

  // 1) il chiamante deve essere autenticato (staff). Verifico il bearer token.
  const authHeader = req.headers.get('Authorization') ?? '';
  const callerJwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!callerJwt) return json({ error: 'Autenticazione richiesta.' }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const { data: caller, error: callerErr } = await admin.auth.getUser(callerJwt);
    if (callerErr || !caller?.user) {
      return json({ error: 'Sessione non valida.' }, 401);
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const email = String(body.email ?? '').trim();
    const tecnicoIdIn = body.tecnico_id ? String(body.tecnico_id) : null;
    const nome = body.nome ? String(body.nome).trim() : null;
    const modalita = body.modalita === 'link' ? 'link' : 'invito';
    const redirectTo = body.redirect_to ? String(body.redirect_to) : undefined;

    if (!email || !email.includes('@')) {
      return json({ error: 'Email del login mancante o non valida.' }, 400);
    }
    if (!tecnicoIdIn && !nome) {
      return json({ error: 'Indica `tecnico_id` (esistente) oppure `nome` (nuovo).' }, 400);
    }

    // 2) trova o crea il tecnico
    let tecnicoId: string;
    if (tecnicoIdIn) {
      const { data: tec, error } = await admin
        .from('tecnico')
        .select('id, user_id, attivo')
        .eq('id', tecnicoIdIn)
        .maybeSingle();
      if (error) throw error;
      if (!tec) return json({ error: 'Tecnico non trovato.' }, 404);
      if (tec.user_id) {
        return json({
          error: 'Questo tecnico ha già un account collegato.',
          tecnico_id: tec.id,
          user_id: tec.user_id,
        }, 409);
      }
      tecnicoId = tec.id;
    } else {
      const insert: Record<string, unknown> = { nome, attivo: true };
      if (body.base_localita) insert.base_localita = String(body.base_localita);
      if (typeof body.capienza_ore_settimana === 'number') {
        insert.capienza_ore_settimana = body.capienza_ore_settimana;
      }
      const { data: nuovo, error } = await admin
        .from('tecnico')
        .insert(insert)
        .select('id')
        .single();
      if (error) throw error;
      tecnicoId = nuovo.id;
    }

    // 3) crea l'account di login
    let userId: string | null = null;
    let actionLink: string | undefined;
    let giaEsistente = false;

    if (modalita === 'link') {
      // crea l'utente e restituisce il link d'invito da inoltrare a mano
      const { data, error } = await admin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (error) {
        // utente già presente: recuperalo e collega comunque
        const ex = await trovaUtentePerEmail(admin, email);
        if (!ex) throw error;
        userId = ex.id;
        giaEsistente = true;
      } else {
        userId = data.user?.id ?? null;
        actionLink = data.properties?.action_link;
      }
    } else {
      // invito standard: Supabase manda l'email (richiede SMTP Auth configurato)
      const { data, error } = await admin.auth.admin.inviteUserByEmail(
        email,
        redirectTo ? { redirectTo } : undefined,
      );
      if (error) {
        const ex = await trovaUtentePerEmail(admin, email);
        if (!ex) throw error;
        userId = ex.id;
        giaEsistente = true;
      } else {
        userId = data.user?.id ?? null;
      }
    }

    if (!userId) return json({ error: 'Account non creato.' }, 500);

    // se l'utente esisteva già ed è collegato ad ALTRO tecnico, fermati
    const { data: collisione } = await admin
      .from('tecnico')
      .select('id')
      .eq('user_id', userId)
      .neq('id', tecnicoId)
      .maybeSingle();
    if (collisione) {
      return json({
        error: 'Questo account di login è già collegato a un altro tecnico.',
        user_id: userId,
        tecnico_collegato: collisione.id,
      }, 409);
    }

    // 4) collega user_id al tecnico (idempotente)
    const { error: linkErr } = await admin
      .from('tecnico')
      .update({ user_id: userId })
      .eq('id', tecnicoId);
    if (linkErr) throw linkErr;

    return json({
      tecnico_id: tecnicoId,
      user_id: userId,
      email,
      modalita,
      action_link: actionLink ?? null,
      gia_esistente: giaEsistente,
      collegato: true,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
