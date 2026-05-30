-- =====================================================================
-- 005 · Bucket privato per gli artefatti del report (PDF/HTML).
-- La Edge Function `genera-report` ci scrive con la service role e restituisce
-- un URL firmato; l'app apre quell'URL. Privato: niente accesso pubblico.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('report', 'report', false)
on conflict (id) do nothing;

-- lettura/gestione consentita agli utenti autenticati (oltre alla service role)
create policy "report_staff_read"  on storage.objects for select to authenticated
  using (bucket_id = 'report');
create policy "report_staff_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'report');
