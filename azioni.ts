// Motore di sincronizzazione offline -> Supabase.
// Principio: ogni modifica vive prima in locale e in coda (outbox); alla
// riconnessione la coda viene svuotata in ordine, con upsert per uuid
// (gli id sono generati lato client, quindi niente conflitti di chiave).

import { supabase, FOTO_BUCKET } from './supabase';
import { db, enqueueRow } from './db';
import { newId, type EsitoVoce, type Foto, type Azione } from './types';

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
  // TODO (slice 2): se già sincronizzata, accodare delete su storage + riga foto.
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

// ---------- Drain della coda ----------
let inFlight = false;

export async function runSync(): Promise<void> {
  if (inFlight || !navigator.onLine) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  inFlight = true;
  try {
    // Svuota in ordine di inserimento (seq crescente).
    let ops = await db.outbox.orderBy('seq').toArray();
    for (const op of ops) {
      if (op.kind === 'photo' && op.fotoId) {
        const fb = await db.fotoBlob.get(op.fotoId);
        const foto = await db.foto.get(op.fotoId);
        if (fb && foto) {
          const up = await supabase.storage.from(FOTO_BUCKET)
            .upload(foto.url, fb.blob, { upsert: true, contentType: 'image/jpeg' });
          if (up.error) throw up.error;
          const row = await supabase.from('foto').upsert(foto);
          if (row.error) throw row.error;
          await db.fotoBlob.delete(op.fotoId); // blob salito: libera spazio locale
        }
      } else if (op.kind === 'row' && op.table && op.payload) {
        const row = await supabase.from(op.table).upsert(op.payload);
        if (row.error) throw row.error;
      }
      await db.outbox.delete(op.seq!);
    }
  } catch (err) {
    // Errore (rete persa, 5xx): si lascia la coda intatta e si riprova dopo.
    console.warn('sync interrotta, riprovo più tardi:', err);
  } finally {
    inFlight = false;
  }
}

// Riprende automaticamente al ritorno della connettività.
export function avviaSyncAuto() {
  window.addEventListener('online', () => void runSync());
  void runSync();
}
