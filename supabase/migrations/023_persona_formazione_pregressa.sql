-- 023_persona_formazione_pregressa.sql
-- Flag per persona: formazione pregressa (azienda gia' operante prima dell'ASR
-- 2025). Quando true, i requisiti senza attestato/esonero risultano "da
-- verificare" invece di "critico". Il corso datore di lavoro fa storia a se'
-- (prima applicazione entro il 19/05/2027). Default false = azienda/persona nuova.

alter table persona
  add column if not exists formazione_pregressa boolean not null default false;
