-- =====================================================================
-- 040 - Anagrafica fiscale del cliente: partita IVA, codice fiscale,
--   codice ATECO. Vengono mostrati nel blocco "Ragione sociale" della
--   scheda cliente. Il livello di rischio (cliente.livello_rischio) esiste
--   gia' dalla 015: la UI di anagrafica lo PROPONE in automatico dal codice
--   ATECO secondo l'Allegato IV ASR 17/04/2025 (Rep. Atti 59/CSR), poi resta
--   sovrascrivibile dall'organigramma. Solo colonne testo, tutte nullable.
-- Idempotente: add column if not exists. Commenti solo ASCII.
-- =====================================================================

alter table cliente add column if not exists partita_iva   text;
alter table cliente add column if not exists codice_fiscale text;
alter table cliente add column if not exists codice_ateco   text;
