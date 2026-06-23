-- =====================================================================
-- 041 - Emergenze definite a monte sul cliente:
--   * livello_antincendio    '1' | '2' | '3'  (DM 02/09/2021: 4h / 8h / 16h)
--   * gruppo_primo_soccorso   'A' | 'BC'       (DM 388/2003: A=16h, B/C=12h)
--   Determinano il corso richiesto agli addetti antincendio / primo soccorso.
--   Se l'addetto manca, il report indica il corso da erogare derivato da questi.
--   Colonne testo nullable con vincolo di dominio. Commenti solo ASCII.
-- Idempotente: add column if not exists + drop/add constraint.
-- =====================================================================

alter table cliente add column if not exists livello_antincendio    text;
alter table cliente add column if not exists gruppo_primo_soccorso   text;

alter table cliente drop constraint if exists cliente_livello_antincendio_chk;
alter table cliente add constraint cliente_livello_antincendio_chk
  check (livello_antincendio is null or livello_antincendio in ('1', '2', '3'));

alter table cliente drop constraint if exists cliente_gruppo_primo_soccorso_chk;
alter table cliente add constraint cliente_gruppo_primo_soccorso_chk
  check (gruppo_primo_soccorso is null or gruppo_primo_soccorso in ('A', 'BC'));
