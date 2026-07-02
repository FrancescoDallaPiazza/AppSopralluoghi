import { createClient } from '@supabase/supabase-js';

// Variabili in .env.local (vedi README) e nelle Environment Variables di Vercel.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// True solo se la build ha davvero le variabili. Se sono assenti (tipico: env
// non impostate su Vercel per quel deploy), NON facciamo esplodere l'import con
// "supabaseUrl is required" — che lascia la pagina bianca e muta. main.tsx legge
// questo flag e mostra una schermata leggibile invece di montare l'app.
export const SUPABASE_CONFIGURATO = Boolean(url && anon);

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anon || 'placeholder-anon-key',
  {
    auth: { persistSession: true, autoRefreshToken: true },
  },
);

export const FOTO_BUCKET = 'foto-sopralluoghi';

// Bucket PRIVATO degli attestati di formazione (PDF/immagini), migration 021.
// Privato: niente URL pubblici, la lettura passa da signed URL temporanei
// (urlFirmatoAttestato). L'upload offline-first vive in sync.ts (gemello foto).
export const ATTESTATI_BUCKET = 'attestati';

// Limite consigliato lato UI, coerente con file_size_limit del bucket (20 MB).
export const MAX_ATTESTATO_BYTES = 20 * 1024 * 1024;

// Estensioni ammesse per gli attestati e relativo content-type.
const CONTENT_PER_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

// Estensione "pulita" (minuscola) di un file scelto: prima dal nome, poi dal
// content-type, con fallback prudente. 'jpeg' viene normalizzato a 'jpg'.
export function estensioneAttestato(file: { name?: string; type?: string }): string {
  const dalNome = ((file.name ?? '').split('.').pop() ?? '').toLowerCase();
  if (dalNome && CONTENT_PER_EXT[dalNome]) return dalNome === 'jpeg' ? 'jpg' : dalNome;
  const t = (file.type ?? '').toLowerCase();
  if (t === 'application/pdf') return 'pdf';
  if (t === 'image/png') return 'png';
  if (t === 'image/webp') return 'webp';
  if (t === 'image/heic') return 'heic';
  if (t.startsWith('image/')) return 'jpg';
  return 'bin';
}

export function contentTypeAttestato(file: { name?: string; type?: string }): string {
  if (file.type) return file.type;
  return CONTENT_PER_EXT[estensioneAttestato(file)] ?? 'application/octet-stream';
}

// Path nel bucket: <formazioneId>/<fileId>.<ext>. Un fileId nuovo a ogni upload
// evita collisioni e problemi di cache se si sostituisce l'allegato.
export function pathAttestato(formazioneId: string, fileId: string, ext: string): string {
  return formazioneId + '/' + fileId + '.' + ext;
}

// URL firmato temporaneo per visualizzare un allegato del bucket privato.
// Ritorna null se il path manca o la firma fallisce (offline o permessi).
export async function urlFirmatoAttestato(
  path: string | null,
  secondi = 3600,
): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage
      .from(ATTESTATI_BUCKET)
      .createSignedUrl(path, secondi);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
