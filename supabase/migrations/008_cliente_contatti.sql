-- =====================================================================
-- 008 · Contatti del cliente. Tutto ADDITIVO, nullable.
--
-- Aggiunge i dati di contatto all'anagrafica cliente: persona di riferimento,
-- telefono ed email. Nessun vincolo di unicità (più clienti possono condividere
-- un centralino/email generica) e nessun formato imposto lato DB: la validazione
-- leggera vive nel form del back-office.
-- =====================================================================

alter table cliente
  add column if not exists referente text,
  add column if not exists telefono  text,
  add column if not exists email     text;
