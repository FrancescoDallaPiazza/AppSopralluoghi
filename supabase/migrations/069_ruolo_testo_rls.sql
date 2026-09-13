-- 069_ruolo_testo_rls.sql
--
-- LE DUE TABELLE DELLA 068 SENZA LE RLS DEL RESTO DELLO SCHEMA.
--
-- La 068 crea `ruolo_testo` e `ruolo_testo_figura` e non scrive ne' `enable row
-- level security` ne' una policy. E' l'UNICA migrazione del repo che crea tabelle
-- cosi': tutte le altre seguono la forma della 055 (e prima della 015/053) -
-- RLS attive e `staff_full` permissiva per `authenticated`.
--
-- COSA SI E' VISTO, il 13 settembre 2026, subito dopo aver applicato la 064-068
-- dall'SQL Editor. I controlli di AppOverall contano 27 chiavi e 32 asserzioni;
-- la chiave anon, sulle stesse due tabelle, legge 0 righe SENZA errore. Quindi
-- in produzione le RLS risultano attive - accese da qualcosa che non e' la
-- migrazione - e nessuna policy le apre alla anon. Se nessuna le apre nemmeno ad
-- `authenticated`, il back-office legge 0 righe anche lui.
--
-- PERCHE' E' GRAVE E NON RUMOROSO. `caricaDizionarioRuoli` (nomineImport.ts)
-- non va in errore su 0 righe: restituisce un dizionario VUOTO, e l'anteprima
-- delle nomine prosegue dichiarando "non riconosciute" tutte le righe con il
-- ruolo scritto nella mansione - meta' dell'organigramma. Prima della 068 si
-- fermava con un errore; con la 068 e senza policy continuerebbe sbagliando.
--
-- PERCHE' SERVE IN TUTTI E DUE I CASI. Se le RLS fossero invece spente, le due
-- tabelle sarebbero leggibili E SCRIVIBILI dalla chiave anon, che sta nel bundle
-- pubblico. Questa migrazione porta le due tabelle alla forma di tutte le altre,
-- qualunque sia lo stato di partenza.
--
-- Si verifica, prima e dopo, in sola lettura:
--   select c.relname, c.relrowsecurity,
--          (select count(*) from pg_policies p
--            where p.schemaname = 'public' and p.tablename = c.relname) as policy
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
--    where c.relname in ('ruolo_testo', 'ruolo_testo_figura', 'corso_alias');
-- Dopo: true e 1 su tutte e tre (corso_alias e' il confronto).
--
-- Idempotente, ASCII-only. Non tocca righe.

alter table ruolo_testo enable row level security;
drop policy if exists staff_full on ruolo_testo;
create policy staff_full on ruolo_testo
  for all to authenticated using (true) with check (true);

alter table ruolo_testo_figura enable row level security;
drop policy if exists staff_full on ruolo_testo_figura;
create policy staff_full on ruolo_testo_figura
  for all to authenticated using (true) with check (true);
