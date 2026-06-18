-- =====================================================================
-- 021 - Bucket Storage privato "attestati" per gli allegati degli
-- attestati di formazione (PDF e immagini). E' il gemello del bucket
-- foto, ma PRIVATO: niente URL pubblici, la lettura passa da signed URL
-- generati lato app alla bisogna.
--
-- Perche' lato migration: la creazione del bucket e le policy su
-- storage.objects sono operazioni DB idempotenti (on conflict / drop
-- create). Si eseguono nello SQL Editor come le altre migration.
--
-- Limiti: file fino a 20 MB; tipi ammessi PDF e immagini comuni. La RLS
-- e' coerente con quella permissiva attuale (gating per ruolo in-app);
-- si stringera' con il portale cliente (Fase 3).
-- =====================================================================

-- Bucket privato (public = false) con limite dimensione e tipi ammessi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attestati',
  'attestati',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Lettura: staff autenticato sugli oggetti del bucket attestati.
drop policy if exists "attestati staff read" on storage.objects;
create policy "attestati staff read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'attestati');

-- Inserimento.
drop policy if exists "attestati staff insert" on storage.objects;
create policy "attestati staff insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'attestati');

-- Aggiornamento (upsert dello stesso path).
drop policy if exists "attestati staff update" on storage.objects;
create policy "attestati staff update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'attestati')
  with check (bucket_id = 'attestati');

-- Cancellazione.
drop policy if exists "attestati staff delete" on storage.objects;
create policy "attestati staff delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'attestati');
