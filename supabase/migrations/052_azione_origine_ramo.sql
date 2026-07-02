-- =====================================================================
-- 052 - Ramo d'origine delle azioni (scadenzario unico).
--   origine_ramo: marca il ramo che ha prodotto l'azione. Serve alle "cose da
--   fare per i gap" formativi generate dall'organigramma: non hanno una riga
--   `formazione` di origine, quindi senza questa marca cadrebbero nella
--   categoria generica. Con origine_ramo = 'formazione' si classificano sotto
--   "Formazione" nel feed unico, come le scadenze formative automatiche.
--   Nullable: le azioni esistenti restano classificate come prima (via
--   origine_formazione_id / origine_esonero_id). Additiva e idempotente.
-- =====================================================================

alter table azione add column if not exists origine_ramo text;

alter table azione drop constraint if exists azione_origine_ramo_chk;
alter table azione add constraint azione_origine_ramo_chk
  check (origine_ramo is null or origine_ramo in ('formazione', 'sopralluogo'));
