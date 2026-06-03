-- =====================================================================
-- 011 · Ruolo "interno" (destinatario di cose da fare, senza sopralluoghi).
--
-- Additivo, sulla scia della 006. Aggiunge il valore 'interno' ai ruoli
-- ammessi del tecnico. Un utente 'interno' ha il login ma NON fa sopralluoghi:
-- in app vede solo "Le mie cose da fare" (gate in App.tsx, come per 'admin').
--
-- Il modello di fiducia RLS resta invariato (policy "staff_full"): il gate del
-- ruolo vive nell'app. L'eventuale isolamento a livello di DB per i ruoli si
-- tratta come passo separato e deliberato.
-- =====================================================================

alter table tecnico drop constraint if exists tecnico_ruolo_chk;
alter table tecnico add constraint tecnico_ruolo_chk
  check (ruolo in ('tecnico', 'admin', 'interno'));

-- Per nominare una persona interna (dopo averla creata/invitata dal back-office):
--   update tecnico set ruolo = 'interno' where id = '<tecnico-id>';
