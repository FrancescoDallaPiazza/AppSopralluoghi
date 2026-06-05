-- 013 · Token pubblico per il feed iCal del tecnico (calendario sottoscrivibile).
-- L'URL del feed include questo token: senza, o con token errato, la Edge
-- Function `calendario-ics` risponde 403. Il bottone "Rigenera token" in
-- back-office cambia il valore e invalida l'URL precedente.

alter table tecnico
  add column if not exists calendario_token uuid not null default gen_random_uuid();

-- Backfill di sicurezza: per le righe storiche con default non applicato
-- (es. restore da dump più vecchio) garantisce un token valido.
update tecnico set calendario_token = gen_random_uuid() where calendario_token is null;
