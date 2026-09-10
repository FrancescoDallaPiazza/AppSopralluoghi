// Motore di sincronizzazione offline -> Supabase.
// Principio: ogni modifica vive prima in locale e in coda (outbox); alla
// riconnessione la coda viene svuotata in ordine, con upsert per uuid
// (gli id sono generati lato client, quindi niente conflitti di chiave).

import { supabase, FOTO_BUCKET, ATTESTATI_BUCKET, estensioneAttestato, contentTypeAttestato, pathAttestato } from './supabase';
import { db, enqueueRow, enqueueDelete, mettiInQuarantena, annullaQuarantenaPer, type OutboxOp, type OrganigrammaConferma, type ClienteMeta } from './db';
import { newId, type EsitoVoce, type Foto, type Azione } from './types';
import type {
  Persona, Nomina, Formazione, Esonero,
  CorsoCatalogo, FiguraSicurezza, FiguraRequisito, EsoneroAmmesso,
  LivelloRischio, LivelloAntincendio, GruppoPrimoSoccorso,
} from './admin/formazione';
import { nomePersona, azioneScadenzaFormazione, azioneScadenzaEsonero } from './admin/formazione';

// ---------- Foto: ridimensiona allo scatto, poi accoda ----------
// Riduce a ~1600px sul lato lungo, JPEG ~0.8 -> ~200-400 KB invece dei MB del file pieno.
async function resizeImage(file: Blob, maxEdge = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  return new Promise((res) =>
    canvas.toBlob((b) => res(b!), 'image/jpeg', quality),
  );
}

// Cattura una foto su una specifica evidenza (esito), in locale + coda.
export async function aggiungiFoto(
  esitoVoceId: string,
  file: Blob,
  geo?: { lat: number; lng: number },
): Promise<Foto> {
  const id = newId();
  const blob = await resizeImage(file);
  const path = `${esitoVoceId}/${id}.jpg`;
  const count = await db.foto.where('esito_voce_id').equals(esitoVoceId).count();
  const foto: Foto = {
    id, esito_voce_id: esitoVoceId, url: path, thumb_url: null,
    scattata_il: new Date().toISOString(),
    geo_lat: geo?.lat ?? null, geo_lng: geo?.lng ?? null, ordine: count,
  };
  await db.fotoBlob.put({ id, blob });
  await db.foto.put(foto);
  await db.outbox.add({ kind: 'photo', fotoId: id });
  void runSync();
  return foto;
}

// Rimuove una foto non ancora sincronizzata (locale + voce in coda).
export async function rimuoviFoto(fotoId: string) {
  await db.foto.delete(fotoId);
  await db.fotoBlob.delete(fotoId);
  const ops = await db.outbox.where('kind').equals('photo').toArray();
  for (const o of ops) if (o.fotoId === fotoId && o.seq != null) await db.outbox.delete(o.seq);
  await annullaQuarantenaPer({ fotoId });   // anche la copia respinta, se c'e'
  // TODO (slice 2): se già sincronizzata, accodare delete su storage + riga foto.
}

// Rimuove un esito (es. un rilievo aggiunto per sbaglio): pulizia locale +
// cancellazione lato server tramite la coda, così non riappare al ricaricamento.
//  * cancella le foto collegate (locale + eventuale upload ancora in coda);
//  * elimina l'esito in locale;
//  * ANNULLA gli upsert ancora pendenti dello stesso esito, così il delete in
//    coda non viene "ricreato" da un upsert successivo;
//  * accoda il delete della riga esito_voce: il vincolo FK fa cascata sulle
//    righe foto e azzera origine_esito_id sulle eventuali azioni collegate.
// Nota: gli oggetti già caricati nello storage restano (orfani) — stessa
// limitazione documentata in rimuoviFoto; non incidono sulla correttezza.
export async function rimuoviEsito(esitoId: string) {
  const foto = await db.foto.where('esito_voce_id').equals(esitoId).toArray();
  for (const f of foto) await rimuoviFoto(f.id);

  await db.esiti.delete(esitoId);

  const ops = await db.outbox.where('kind').equals('row').toArray();
  for (const o of ops) {
    if (o.table === 'esito_voce' && (o.payload as { id?: string } | undefined)?.id === esitoId && o.seq != null) {
      await db.outbox.delete(o.seq);
    }
  }
  await annullaQuarantenaPer({ table: 'esito_voce', id: esitoId });

  await enqueueDelete('esito_voce', esitoId);
  void runSync();
}

// ---------- Esiti e azioni: salva locale + accoda ----------
export async function salvaEsito(e: EsitoVoce) {
  await db.esiti.put(e);
  await enqueueRow('esito_voce', e as unknown as Record<string, unknown>);
  void runSync();
}

export async function salvaAzione(a: Azione) {
  await db.azioni.put(a);
  await enqueueRow('azione', a as unknown as Record<string, unknown>);
  void runSync();
}

// Rimuove una cosa-da-fare (azione): pulizia locale + annullamento di eventuali
// upsert ancora in coda per la stessa riga + cancellazione lato server. Usata
// dalla riconciliazione al completamento, quando una cosa da fare viene tolta.
export async function rimuoviAzione(azioneId: string) {
  await db.azioni.delete(azioneId);
  const ops = await db.outbox.where('kind').equals('row').toArray();
  for (const o of ops) {
    if (o.table === 'azione' && (o.payload as { id?: string } | undefined)?.id === azioneId && o.seq != null) {
      await db.outbox.delete(o.seq);
    }
  }
  await annullaQuarantenaPer({ table: 'azione', id: azioneId });
  await enqueueDelete('azione', azioneId);
}

// ---------- Organigramma & formazione: salva/elimina locale + accoda ----------
// Stesso principio degli esiti: scrittura locale immediata + upsert per id in
// coda. In campo l'id viene generato lato client (offline-first), quindi le
// figure/persone create senza rete si sincronizzano senza conflitti.

function conId<T extends { id: string }>(x: T): T {
  return x.id ? x : { ...x, id: newId() };
}

export async function salvaPersona(p: Persona): Promise<Persona> {
  const r = conId(p);
  await db.persone.put(r);
  await enqueueRow('persona', r as unknown as Record<string, unknown>);
  void runSync();
  return r;
}

export async function salvaNomina(n: Nomina): Promise<Nomina> {
  const r = conId(n);
  await db.nomine.put(r);
  await enqueueRow('nomina', r as unknown as Record<string, unknown>);
  void runSync();
  return r;
}

// Mantiene (offline) l'azione di scadenzario collegata a una formazione: la
// accoda dopo la riga formazione (ordine seq -> la formazione e' creata prima
// lato server, FK soddisfatta). Se non c'e' scadenza, accoda la cancellazione.
async function mantieniAzioneScadenza(r: Formazione): Promise<void> {
  const per = await db.persone.get(r.persona_id);
  const clienteId = per?.cliente_id ?? null;
  if (!clienteId) return;
  let areaId: string | null = null;
  try { areaId = localStorage.getItem('area:formazione:id') || null; } catch { areaId = null; }
  const corso = r.corso_codice ? await db.corsi.get(r.corso_codice) : undefined;
  const az = azioneScadenzaFormazione(r, clienteId, areaId, per ? nomePersona(per) : undefined, corso?.aggiornamento_mesi ?? null);
  if (az) await enqueueRow('azione', az);
  else await enqueueDelete('azione', r.id);
}

export async function salvaFormazione(f: Formazione): Promise<Formazione> {
  const r = conId(f);
  await db.formazioni.put(r);
  await enqueueRow('formazione', r as unknown as Record<string, unknown>);
  await mantieniAzioneScadenza(r);
  void runSync();
  return r;
}

// Salva una formazione con un FILE allegato (PDF/immagine), offline-first:
//  - il file viene salvato come blob locale e accodato come 'attestato';
//  - la riga formazione porta subito allegato_url = path (cosi' l'UI lo riflette
//    anche offline) e viene accodata come una riga normale;
//  - al drain runSync carica il blob nel bucket attestati e poi lo elimina.
// Gemello della pipeline foto, ma senza ridimensionare: un attestato e' un
// documento legale, si conserva l'originale.
export async function salvaFormazioneConAllegato(
  f: Formazione,
  file: Blob & { name?: string; type?: string },
): Promise<Formazione> {
  const base = conId(f);
  const fileId = newId();
  const ext = estensioneAttestato(file);
  const path = pathAttestato(base.id, fileId, ext);
  const contentType = contentTypeAttestato(file);

  await db.attestatoBlob.put({ id: fileId, formazione_id: base.id, blob: file, path, contentType });

  const r: Formazione = { ...base, allegato_url: path };
  await db.formazioni.put(r);
  await enqueueRow('formazione', r as unknown as Record<string, unknown>);
  await db.outbox.add({ kind: 'attestato', attestatoId: fileId });
  await mantieniAzioneScadenza(r);
  void runSync();
  return r;
}

export async function salvaEsonero(e: Esonero): Promise<Esonero> {
  const r = conId(e);
  await db.esoneri.put(r);
  await enqueueRow('esonero', r as unknown as Record<string, unknown>);
  await mantieniAzioneEsonero(r);
  void runSync();
  return r;
}

// Azione di scadenzario collegata a un esonero/credito con scadenza (offline).
async function mantieniAzioneEsonero(r: Esonero): Promise<void> {
  const per = await db.persone.get(r.persona_id);
  const clienteId = per?.cliente_id ?? null;
  if (!clienteId) return;
  let areaId: string | null = null;
  try { areaId = localStorage.getItem('area:formazione:id') || null; } catch { areaId = null; }
  const corso = r.corso_codice ? await db.corsi.get(r.corso_codice) : undefined;
  let dataNomina: string | null = null;
  if (r.figura_codice) {
    const noms = await db.nomine.where('persona_id').equals(r.persona_id).toArray();
    dataNomina = noms.find((n) => n.attiva && n.figura_codice === r.figura_codice)?.data_nomina ?? null;
  }
  const az = azioneScadenzaEsonero(r, clienteId, areaId, per ? nomePersona(per) : undefined, corso?.nome, corso?.aggiornamento_mesi ?? null, dataNomina);
  if (az) await enqueueRow('azione', az);
  else await enqueueDelete('azione', r.id);
}

export async function salvaConfermaOrganigramma(c: OrganigrammaConferma): Promise<OrganigrammaConferma> {
  const r = conId(c);
  await db.conferme.put(r);
  await enqueueRow('organigramma_conferma', r as unknown as Record<string, unknown>);
  void runSync();
  return r;
}

// Accoda uno snapshot di revisione dell'organigramma (Parte 3), offline-first.
// La riga e' costruita dal chiamante (gia' valutato lo stato locale + firma): qui
// si limita ad accodarla. Il progressivo `numero` NON va incluso nel payload:
// lo assegna il trigger lato DB all'upsert (cosi' l'update di un eventuale
// re-invio non lo azzera). L'ordine di coda fa salire prima le righe modificate.
export async function accodaRevisioneOrganigramma(riga: Record<string, unknown>): Promise<void> {
  await enqueueRow('organigramma_revisione', riga);
  void runSync();
}

// Rimozione: pulizia locale + annullo degli upsert pendenti + delete in coda.
async function rimuoviRiga(
  table: NonNullable<OutboxOp['table']>,
  dexieDelete: () => Promise<void>,
  id: string,
) {
  await dexieDelete();
  const ops = await db.outbox.where('kind').equals('row').toArray();
  for (const o of ops) {
    if (o.table === table && (o.payload as { id?: string } | undefined)?.id === id && o.seq != null) {
      await db.outbox.delete(o.seq);
    }
  }
  await annullaQuarantenaPer({ table, id });
  await enqueueDelete(table, id);
  void runSync();
}

export async function eliminaNomina(id: string) { await rimuoviRiga('nomina', () => db.nomine.delete(id), id); }
export async function eliminaFormazione(id: string) {
  // Annulla gli upload allegato ancora in coda per questa formazione e libera i
  // blob locali. Gli oggetti gia' caricati su Storage restano (orfani), stessa
  // limitazione documentata per le foto: non incide sulla correttezza.
  const blobs = await db.attestatoBlob.where('formazione_id').equals(id).toArray();
  if (blobs.length) {
    const ops = await db.outbox.where('kind').equals('attestato').toArray();
    for (const b of blobs) {
      for (const o of ops) if (o.attestatoId === b.id && o.seq != null) await db.outbox.delete(o.seq);
      await annullaQuarantenaPer({ attestatoId: b.id });
      await db.attestatoBlob.delete(b.id);
    }
  }
  await rimuoviRiga('formazione', () => db.formazioni.delete(id), id);
  // Azione di scadenzario collegata (id azione = id formazione): annulla eventuali
  // upsert pendenti e accoda la cancellazione. Lato server la FK on delete cascade
  // la toglierebbe comunque, ma cosi' si evita un upsert orfano nel caso la
  // formazione non fosse ancora stata sincronizzata.
  await rimuoviRiga('azione', () => db.azioni.delete(id), id);
}
export async function eliminaEsonero(id: string) {
  await rimuoviRiga('esonero', () => db.esoneri.delete(id), id);
  // Azione di scadenzario collegata (id azione = id esonero): annulla upsert
  // pendenti e accoda la cancellazione (lato server la FK cascade la rimuove).
  await rimuoviRiga('azione', () => db.azioni.delete(id), id);
}

export async function eliminaPersona(id: string) {
  const ns = await db.nomine.where('persona_id').equals(id).toArray();
  for (const n of ns) await eliminaNomina(n.id);
  const fs = await db.formazioni.where('persona_id').equals(id).toArray();
  for (const f of fs) await eliminaFormazione(f.id);
  const es = await db.esoneri.where('persona_id').equals(id).toArray();
  for (const e of es) await eliminaEsonero(e.id);
  await rimuoviRiga('persona', () => db.persone.delete(id), id);
}

// Cache locale dell'organigramma di un cliente (chiamata online; poi leggibile
// offline). I cataloghi sono globali, le entita sono filtrate per cliente.
export async function prefetchOrganigramma(clienteId: string): Promise<void> {
  if (!navigator.onLine) return;
  const [c, f, r, ea] = await Promise.all([
    supabase.from('corso_catalogo').select('*'),
    supabase.from('figura_sicurezza').select('*'),
    supabase.from('figura_requisito').select('*'),
    supabase.from('esonero_ammesso').select('*'),
  ]);
  if (!c.error && c.data) await db.corsi.bulkPut(c.data as CorsoCatalogo[]);
  if (!f.error && f.data) await db.figure.bulkPut(f.data as FiguraSicurezza[]);
  if (!r.error && r.data) await db.requisiti.bulkPut(r.data as FiguraRequisito[]);
  if (!ea.error && ea.data) await db.esoneriAmmessi.bulkPut(ea.data as EsoneroAmmesso[]);

  // Meta del cliente per l'organigramma (parita' di valutazione con il back-office).
  const cli = await supabase.from('cliente')
    .select('id, livello_rischio, rls_territoriale, livello_antincendio, gruppo_primo_soccorso, codice_ateco')
    .eq('id', clienteId).single();
  if (!cli.error && cli.data) {
    await db.clienteMeta.put({
      id: clienteId,
      livello_rischio: (cli.data.livello_rischio ?? null) as string | null,
      rls_territoriale: (cli.data.rls_territoriale ?? false) as boolean,
      livello_antincendio: (cli.data.livello_antincendio ?? null) as string | null,
      gruppo_primo_soccorso: (cli.data.gruppo_primo_soccorso ?? null) as string | null,
      codice_ateco: (cli.data.codice_ateco ?? null) as string | null,
    });
  }

  // Id area interna "Formazione" (globale): serve a indirizzare le azioni di
  // scadenza create offline. Stashato in localStorage (best-effort).
  try {
    const ar = await supabase.from('area_interna').select('id, nome, attiva').eq('attiva', true);
    if (!ar.error && ar.data) {
      const a = ar.data.find((x: { nome?: string | null }) => /formazione/i.test(x.nome ?? ''));
      localStorage.setItem('area:formazione:id', (a?.id ?? '') as string);
    }
  } catch { /* best-effort */ }

  const pe = await supabase.from('persona').select('*').eq('cliente_id', clienteId);
  if (pe.error || !pe.data) return;
  const persone = pe.data as Persona[];
  await db.persone.bulkPut(persone);
  const ids = persone.map((p) => p.id);
  if (ids.length) {
    const [no, fo, es] = await Promise.all([
      supabase.from('nomina').select('*').in('persona_id', ids),
      supabase.from('formazione').select('*').in('persona_id', ids),
      supabase.from('esonero').select('*').in('persona_id', ids),
    ]);
    if (!no.error && no.data) await db.nomine.bulkPut(no.data as Nomina[]);
    if (!fo.error && fo.data) await db.formazioni.bulkPut(fo.data as Formazione[]);
    if (!es.error && es.data) await db.esoneri.bulkPut(es.data as Esonero[]);
  }
}

export interface OrganigrammaLocale {
  corsi: CorsoCatalogo[]; figure: FiguraSicurezza[]; requisiti: FiguraRequisito[]; esoneriAmmessi: EsoneroAmmesso[];
  persone: Persona[]; nomine: Nomina[]; formazioni: Formazione[]; esoneri: Esonero[];
  // Meta del cliente (cache di prefetch): valutazione di campo = back-office.
  livello_rischio: LivelloRischio | null;
  rls_territoriale: boolean;
  livello_antincendio: LivelloAntincendio | null;
  gruppo_primo_soccorso: GruppoPrimoSoccorso | null;
  codice_ateco: string | null;
}

export async function caricaOrganigrammaLocale(clienteId: string): Promise<OrganigrammaLocale> {
  const persone = await db.persone.where('cliente_id').equals(clienteId).toArray();
  const ids = new Set(persone.map((p) => p.id));
  const [corsi, figure, requisiti, esoneriAmmessi, nomineAll, formAll, esonAll, meta] = await Promise.all([
    db.corsi.toArray(), db.figure.toArray(), db.requisiti.toArray(), db.esoneriAmmessi.toArray(),
    db.nomine.toArray(), db.formazioni.toArray(), db.esoneri.toArray(),
    db.clienteMeta.get(clienteId) as Promise<ClienteMeta | undefined>,
  ]);
  return {
    corsi, figure, requisiti, esoneriAmmessi, persone,
    nomine: nomineAll.filter((n) => ids.has(n.persona_id)),
    formazioni: formAll.filter((f) => ids.has(f.persona_id)),
    esoneri: esonAll.filter((e) => ids.has(e.persona_id)),
    livello_rischio: (meta?.livello_rischio ?? null) as LivelloRischio | null,
    rls_territoriale: meta?.rls_territoriale ?? false,
    livello_antincendio: (meta?.livello_antincendio ?? null) as LivelloAntincendio | null,
    gruppo_primo_soccorso: (meta?.gruppo_primo_soccorso ?? null) as GruppoPrimoSoccorso | null,
    codice_ateco: (meta?.codice_ateco ?? null) as string | null,
  };
}

// ---------- Drain della coda ----------

// Un rifiuto che non ha senso ritentare, sollevato da noi (non dal server):
// per esempio il file di una foto che in locale non c'e' piu'.
class RifiutoDefinitivo extends Error {
  codice?: string;
  constructor(motivo: string, codice?: string) { super(motivo); this.codice = codice; }
}

// Rete persa o 5xx si ritentano: la stessa operazione, piu' tardi, riesce.
// Un rifiuto di merito - vincolo violato, colonna che non esiste, permesso
// negato - no: si ripresenta identico a ogni giro. Distinguere i due casi e'
// tutta la differenza fra "riprovo dopo" e "coda ferma per sempre".
type Diagnosi = { definitivo: boolean; motivo: string; codice?: string };

// Classi SQLSTATE che valgono "riprova": connessione, serializzazione,
// risorse esaurite, intervento dell'operatore. Tutto il resto (22 dati,
// 23 vincoli, 42 sintassi/permessi...) e' di merito.
const SQLSTATE_RITENTABILI = ['08', '40', '53', '57', '58'];

function diagnostica(err: unknown): Diagnosi {
  if (err instanceof RifiutoDefinitivo) {
    return { definitivo: true, motivo: err.message, codice: err.codice };
  }
  const e = err as { code?: string; message?: string; status?: number; statusCode?: number | string };
  const motivo = (e?.message || String(err)).slice(0, 300);
  const grezzo = e?.code ?? e?.statusCode ?? e?.status;
  const codice = grezzo == null ? undefined : String(grezzo);

  // Nessun codice: quasi sempre "Failed to fetch", cioe' rete. Si ritenta.
  if (!codice) return { definitivo: false, motivo };

  // SQLSTATE Postgres, che PostgREST riporta tale e quale.
  if (/^[0-9A-Z]{5}$/.test(codice)) {
    return { definitivo: !SQLSTATE_RITENTABILI.includes(codice.slice(0, 2)), motivo, codice };
  }
  // Codici PostgREST. PGRST301 = JWT scaduto: dopo il refresh riesce.
  if (codice.startsWith('PGRST')) return { definitivo: codice !== 'PGRST301', motivo, codice };

  // HTTP (Storage): 5xx, 408, 429 e 401 si ritentano; gli altri 4xx no.
  const n = Number(codice);
  if (Number.isFinite(n)) {
    const ritentabile = n >= 500 || n === 408 || n === 429 || n === 401;
    return { definitivo: !ritentabile, motivo, codice };
  }
  return { definitivo: false, motivo, codice };
}

// Esegue UNA operazione. Ritorna l'eventuale pulizia locale da fare DOPO che
// l'operazione e' uscita dalla coda: se si cancellasse il blob prima, una
// interruzione nel mezzo lascerebbe in coda un'operazione senza il suo file,
// indistinguibile da un file andato perso davvero.
async function eseguiOp(op: OutboxOp): Promise<(() => Promise<void>) | null> {
  if (op.kind === 'photo' && op.fotoId) {
    const fb = await db.fotoBlob.get(op.fotoId);
    const foto = await db.foto.get(op.fotoId);
    if (!foto) throw new RifiutoDefinitivo('Scatto assente in locale: non caricato.', 'LOCALE_MANCANTE');
    if (!fb) throw new RifiutoDefinitivo("File dello scatto non più disponibile in locale: non caricato.", 'LOCALE_MANCANTE');
    const up = await supabase.storage.from(FOTO_BUCKET)
      .upload(foto.url, fb.blob, { upsert: true, contentType: 'image/jpeg' });
    if (up.error) throw up.error;
    const row = await supabase.from('foto').upsert(foto);
    if (row.error) throw row.error;
    return () => db.fotoBlob.delete(op.fotoId!);   // blob salito: libera spazio
  }
  if (op.kind === 'attestato' && op.attestatoId) {
    const ab = await db.attestatoBlob.get(op.attestatoId);
    if (!ab) throw new RifiutoDefinitivo("File dell'attestato non più disponibile in locale: non caricato.", 'LOCALE_MANCANTE');
    const up = await supabase.storage.from(ATTESTATI_BUCKET)
      .upload(ab.path, ab.blob, { upsert: true, contentType: ab.contentType });
    if (up.error) throw up.error;
    return () => db.attestatoBlob.delete(op.attestatoId!);
  }
  if (op.kind === 'row' && op.table && op.payload) {
    const row = await supabase.from(op.table).upsert(op.payload);
    if (row.error) throw row.error;
    return null;
  }
  if (op.kind === 'delete' && op.table && op.id) {
    const row = await supabase.from(op.table).delete().eq('id', op.id);
    if (row.error) throw row.error;
    return null;
  }
  return null;
}

let inFlight = false;
// Il drenaggio e' richiamato a ogni salvataggio: senza questa pausa, con la
// rete assente si tenta una volta per ogni tocco sullo schermo.
const PAUSA_MS = 30_000;
let prossimoTentativo = 0;

export async function runSync(): Promise<void> {
  if (inFlight || !navigator.onLine) return;
  if (Date.now() < prossimoTentativo) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  inFlight = true;
  try {
    // Svuota in ordine di inserimento (seq crescente).
    const ops = await db.outbox.orderBy('seq').toArray();
    for (const op of ops) {
      let pulizia: (() => Promise<void>) | null = null;
      try {
        pulizia = await eseguiOp(op);
      } catch (err) {
        const d = diagnostica(err);
        if (!d.definitivo) {
          // Ritentabile: ci si ferma QUI, in ordine, e si riprende dopo.
          console.warn('sync interrotta, riprovo più tardi:', err);
          prossimoTentativo = Date.now() + PAUSA_MS;
          return;
        }
        // Definitivo: fuori dalla coda, ma non perso. Prima bastava una riga
        // cosi' per congelare in silenzio tutto quello che le stava dietro -
        // gli esiti e le foto di un'intera giornata.
        console.warn('operazione respinta, messa in quarantena:', d.codice ?? '-', d.motivo);
        await mettiInQuarantena(op, d.motivo, d.codice);
        continue;
      }
      await db.outbox.delete(op.seq!);
      if (pulizia) await pulizia();
    }
    prossimoTentativo = 0;
  } finally {
    inFlight = false;
  }
}

// Quante operazioni sono ferme in quarantena: e' il numero che spiega perche'
// qualcosa non e' arrivato in ufficio.
export function contaQuarantena(): Promise<number> {
  return db.quarantena.count();
}

// Riprende automaticamente al ritorno della connettività.
export function avviaSyncAuto() {
  window.addEventListener('online', () => void runSync());
  void runSync();
}
