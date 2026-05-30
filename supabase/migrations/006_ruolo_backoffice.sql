-- =====================================================================
-- 006 · Ruolo del tecnico (gate del back-office). Tutto ADDITIVO.
--
-- Il back-office (creazione/modifica template + pianificazione) è riservato
-- agli amministratori. In Fase 1 il modello di fiducia resta invariato:
-- le policy RLS "staff_full" lasciano agli utenti autenticati l'accesso pieno
-- e il gate del ruolo vive nell'app (App.tsx mostra il back-office solo se
-- tecnico.ruolo = 'admin'). Quando arriverà il portale cliente (Fase 3) si
-- stringeranno le policy lato DB; questa colonna è già il punto d'aggancio.
--
-- Le tabelle del modello "form configurabile" (checklist_template,
-- voce_template — migration 002) e di pianificazione (incarico, sopralluogo —
-- migration 001) sono già complete: il back-office non richiede nuove tabelle.
-- =====================================================================

alter table tecnico
  add column if not exists ruolo text not null default 'tecnico';

alter table tecnico drop constraint if exists tecnico_ruolo_chk;
alter table tecnico add constraint tecnico_ruolo_chk
  check (ruolo in ('tecnico', 'admin'));

-- Per nominare un amministratore (dopo aver collegato l'utente come da README):
--   update tecnico set ruolo = 'admin' where id = '<tecnico-id>';
