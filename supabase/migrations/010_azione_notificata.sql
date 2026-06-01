-- =====================================================================
-- 010 · Timestamp di notifica della "cosa da fare". ADDITIVO, nullable.
--
-- Serve all'idempotenza della Edge Function `notifica-azione`: una volta
-- inviata l'email al destinatario interno, si segna qui il momento, così non
-- viene rispedita ai tentativi successivi (es. salvataggi multipli).
-- =====================================================================

alter table azione
  add column if not exists notificata_il timestamptz;
