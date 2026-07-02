-- =====================================================================
-- 051 - Motivazione del gruppo di primo soccorso.
--   primo_soccorso_definito_mediante: nota valorizzata dal wizard basato sul
--   flusso DM 388/2003 (parallela ad antincendio_definito_mediante della 050),
--   riporta il perche' del gruppo scelto (es. "Comparto agricoltura, 8 addetti").
--   Colonna testo nullable. Additiva e idempotente. Commenti ASCII.
-- =====================================================================

alter table cliente add column if not exists primo_soccorso_definito_mediante text;
