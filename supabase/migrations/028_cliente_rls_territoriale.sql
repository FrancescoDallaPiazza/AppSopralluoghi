-- 028 . Flag per cliente: RLS coperto dal rappresentante territoriale (RLST).
--
-- Quando true, l'azienda non ha un RLS interno ma e' coperta dal Rappresentante
-- dei Lavoratori per la Sicurezza Territoriale: il ruolo RLS non va quindi
-- segnalato come "ruolo obbligatorio senza incaricato" nell'organigramma.
-- Default false = si attende un RLS interno (criticita' finche' non nominato).

alter table cliente
  add column if not exists rls_territoriale boolean not null default false;
