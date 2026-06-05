// Edge Function `calendario-ics`.
// Feed iCal pubblico (RFC 5545) del calendario del tecnico, sottoscrivibile da
// Google Calendar / Outlook / Apple Calendar. Aggiornamenti deciso dal client
// del calendario (tipicamente ogni 6-24 ore).
//
// URL: https://<project>.functions.supabase.co/calendario-ics
//        ?tecnico=<uuid>&token=<uuid-calendario_token>
//
// Risposta: text/calendar; charset=utf-8 — gli eventi sono i sopralluoghi
// assegnati al tecnico, con DTSTART alle 09:00 locale (Europe/Rome) e durata
// presa da `durata_stimata_min` (default 240 min). Lo stato è TENTATIVE per i
// sopralluoghi non ancora completati, CONFIRMED per completati/sincronizzati.
//
// NB: la funzione è PUBBLICA (chi ha l'URL completo accede). La sicurezza è
// data dal token random che si può rigenerare dal back-office (cambiare il
// token invalida l'URL precedente).
//
// CORS inline (self-contained: niente import da ../_shared) per compatibilità
// con il deploy dal Dashboard editor.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (s: string | null | undefined): s is string =>
  typeof s === 'string' && UUID_RX.test(s);

function txt(body: string, status = 200, contentType = 'text/plain; charset=utf-8'): Response {
  return new Response(body, { status, headers: { ...CORS, 'Content-Type': contentType } });
}

// VTIMEZONE Europe/Rome (regole DST stabili dal 1996). Inserito nel calendario
// così Google/Outlook interpretano correttamente DTSTART;TZID=Europe/Rome.
const VTIMEZONE_ROMA = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Rome',
  'BEGIN:STANDARD',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
].join('\r\n');

const pad = (n: number) => String(n).padStart(2, '0');

// "2026-06-15" + (h,m) -> "20260615T090000" (formato data-ora locale per TZID).
function fmtLocalDT(ymd: string, h: number, m: number): string {
  return `${ymd.replace(/-/g, '')}T${pad(h)}${pad(m)}00`;
}

// Aggiunge `minutes` a (ymd, h:m) restituendo lo stesso formato locale.
function fmtLocalDTplus(ymd: string, h: number, m: number, addMinutes: number): string {
  const [y, mo, d] = ymd.split('-').map(Number);
  // Calcoliamo in UTC per evitare il TZ runtime di Deno; il valore numerico va
  // bene perché lo riemettiamo come "ora locale" (TZID lo aggiunge il consumer).
  const t = Date.UTC(y, mo - 1, d, h, m + addMinutes, 0);
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T` +
    `${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00`;
}

// Timestamp UTC (DTSTAMP) — Date.now per uniformità di tutta la risposta.
function fmtUTCNow(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// RFC 5545: max 75 ottetti per riga (CRLF + spazio per il fold).
function fold(line: string): string {
  const MAX = 73; // 73 char + CRLF + 1 spazio = 75 ottetti
  if (line.length <= MAX + 2) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    out.push((i === 0 ? '' : ' ') + line.substring(i, Math.min(i + MAX, line.length)));
    i += MAX;
  }
  return out.join('\r\n');
}

// Escape per testi iCal: backslash, virgola, punto e virgola e newline.
function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const uno = <T,>(v: T | T[] | null | undefined): T | undefined =>
  Array.isArray(v) ? v[0] : (v ?? undefined);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return txt('Method Not Allowed', 405);

  try {
    const url = new URL(req.url);
    const tecnicoId = url.searchParams.get('tecnico');
    const token = url.searchParams.get('token');
    if (!isUUID(tecnicoId) || !isUUID(token)) {
      return txt('Parametri mancanti o non validi: serve ?tecnico=<uuid>&token=<uuid>.', 400);
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // Verifica tecnico + token (timing safe non serve: niente login, niente
    // password, e il token è un UUID random già ad alta entropia).
    const { data: tec, error: e1 } = await sb
      .from('tecnico')
      .select('id, nome, cognome, calendario_token, attivo')
      .eq('id', tecnicoId)
      .maybeSingle();
    if (e1) throw e1;
    if (!tec) return txt('Tecnico non trovato.', 404);
    if (tec.calendario_token !== token) return txt('Token non valido.', 403);

    // Sopralluoghi assegnati con data pianificata.
    const { data: sopr, error: e2 } = await sb
      .from('sopralluogo')
      .select(`
        id, progressivo, data_pianificata, durata_stimata_min, localita, stato,
        incarico:incarico!incarico_id (
          tipo_attivita,
          cliente:cliente!cliente_id ( ragione_sociale, indirizzo, localita )
        )
      `)
      .eq('tecnico_id', tecnicoId)
      .not('data_pianificata', 'is', null)
      .order('data_pianificata', { ascending: true });
    if (e2) throw e2;

    const nomeCal = [tec.nome, tec.cognome].filter(Boolean).join(' ').trim() || 'Tecnico';
    const dtstamp = fmtUTCNow();

    const linee: string[] = [];
    linee.push('BEGIN:VCALENDAR');
    linee.push('VERSION:2.0');
    linee.push('PRODID:-//AppSopralluoghi//Calendario tecnico//IT');
    linee.push('CALSCALE:GREGORIAN');
    linee.push('METHOD:PUBLISH');
    linee.push(fold(`X-WR-CALNAME:Sopralluoghi · ${esc(nomeCal)}`));
    linee.push('X-WR-TIMEZONE:Europe/Rome');
    linee.push('X-PUBLISHED-TTL:PT6H');
    linee.push('REFRESH-INTERVAL;VALUE=DURATION:PT6H');
    linee.push(VTIMEZONE_ROMA);

    for (const s of (sopr ?? []) as any[]) {
      const data = s.data_pianificata as string;
      const inc = uno<any>(s.incarico);
      const cli = uno<any>(inc?.cliente);
      const cliente = cli?.ragione_sociale ?? 'Cliente';
      const indirizzo = [cli?.indirizzo, cli?.localita, s.localita]
        .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');

      const durMin = Math.max(15, Number(s.durata_stimata_min) || 240);
      const start = fmtLocalDT(data, 9, 0);
      const end = fmtLocalDTplus(data, 9, 0, durMin);

      const summary = `Sopralluogo · ${cliente}`;
      const descrizione = [
        inc?.tipo_attivita ? `Tipo: ${inc.tipo_attivita}` : null,
        s.progressivo ? `Progressivo: ${s.progressivo}` : null,
        `Stato: ${s.stato ?? 'pianificato'}`,
      ].filter(Boolean).join('\n');

      const confermato = s.stato === 'completato' || s.stato === 'sincronizzato';

      linee.push('BEGIN:VEVENT');
      linee.push(`UID:${s.id}@appsopralluoghi`);
      linee.push(`DTSTAMP:${dtstamp}`);
      linee.push(`DTSTART;TZID=Europe/Rome:${start}`);
      linee.push(`DTEND;TZID=Europe/Rome:${end}`);
      linee.push(fold(`SUMMARY:${esc(summary)}`));
      if (indirizzo) linee.push(fold(`LOCATION:${esc(indirizzo)}`));
      if (descrizione) linee.push(fold(`DESCRIPTION:${esc(descrizione)}`));
      linee.push(confermato ? 'STATUS:CONFIRMED' : 'STATUS:TENTATIVE');
      linee.push('END:VEVENT');
    }
    linee.push('END:VCALENDAR');

    return new Response(linee.join('\r\n') + '\r\n', {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'text/calendar; charset=utf-8',
        // Google/Outlook ricaricano comunque al loro ritmo; questo header riduce
        // solo il carico in caso di doppi fetch ravvicinati.
        'Cache-Control': 'public, max-age=900',
      },
    });
  } catch (e) {
    return txt(`Errore: ${String((e as Error)?.message ?? e)}`, 500);
  }
});
