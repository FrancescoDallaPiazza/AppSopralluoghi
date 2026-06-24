-- =====================================================================
-- 043 - Scadenza del credito/esonero.
--   Un esonero da credito pregresso che corrisponde a un corso (es. attestato
--   RSPP usato come credito per il modulo base DL-RSPP) ha una sua scadenza:
--   va monitorata come una formazione. Si aggiunge esonero.scadenza e una
--   azione di scadenzario COLLEGATA (azione.origine_esonero_id, id azione = id
--   esonero, upsert idempotente; FK on delete cascade). L'azione e' indirizzata
--   all'area Formazione interna (vedi codice). Nessun backfill: non esistono
--   ancora esoneri con scadenza.
-- Idempotente. Commenti solo ASCII.
-- =====================================================================

alter table esonero add column if not exists scadenza date;

alter table azione add column if not exists origine_esonero_id uuid;

alter table azione drop constraint if exists azione_origine_esonero_fk;
alter table azione add constraint azione_origine_esonero_fk
  foreign key (origine_esonero_id) references esonero(id) on delete cascade;

create index if not exists idx_azione_origine_esonero on azione(origine_esonero_id);
