-- =====================================================================
-- 050 - Anagrafica cliente estesa (scheda Anagrafiche):
--   * referente amministrativo (nome, telefono, email)
--   * referente commerciale e canale commerciale
--   * CAP e provincia (sigla) della sede legale
--   * antincendio_definito_mediante: nota libera "definito mediante"
--     accanto al livello di rischio incendio
--   Inoltre allarga il dominio di gruppo_primo_soccorso ad A/B/C (oltre al
--   legacy BC): il wizard basato sul flusso DM 388/2003 salva il gruppo
--   preciso. B e C richiedono lo stesso corso (12h): la mappa corsi lato app
--   tratta B, C e BC allo stesso modo.
--   Tutto ADDITIVO e idempotente. Solo colonne testo nullable. Commenti ASCII.
-- =====================================================================

alter table cliente add column if not exists referente_amm                 text;
alter table cliente add column if not exists telefono_amm                  text;
alter table cliente add column if not exists email_amm                     text;
alter table cliente add column if not exists referente_commerciale         text;
alter table cliente add column if not exists canale_commerciale            text;
alter table cliente add column if not exists cap                           text;
alter table cliente add column if not exists provincia                     text;
alter table cliente add column if not exists antincendio_definito_mediante text;

alter table cliente drop constraint if exists cliente_gruppo_primo_soccorso_chk;
alter table cliente add constraint cliente_gruppo_primo_soccorso_chk
  check (gruppo_primo_soccorso is null or gruppo_primo_soccorso in ('A', 'B', 'C', 'BC'));
