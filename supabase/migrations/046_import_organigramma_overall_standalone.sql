-- 046_import_organigramma_overall_standalone.sql
-- Import one-shot dell'organigramma della app standalone
-- ("organigramma-sicurezza-81" v2.10) per OVERALL GROUP (lo studio), gestito
-- come cliente interno cosi' le sue scadenze formative confluiscono nel motore
-- ASR come per i clienti.
--
-- Canale 3 (SQL Editor). Idempotente: rieseguibile senza duplicare. Dedup su
-- chiavi naturali (P.IVA per il cliente, CF per le persone, unique
-- persona_id+figura_codice per le nomine, NOT EXISTS per formazioni/esoneri).
-- Gli id sono uuid (gen_random_uuid): non si riusano gli id base36 standalone.
--
-- Mappatura standalone -> app:
--   PRADELLA TAZIO  -> dl_rspp (datore che svolge RSPP); DL_RSPP_BASE/COMUNE
--                      esonerati perche' possiede la qualifica RSPP completa.
--   STELLUTI ERIKA  -> lavoratore + addetto_primo_soccorso + addetto_antincendio.
--   VEDOVA MARTINA  -> lavoratore + addetto_antincendio; RSPP Mod. C (ASR 2016)
--                      come evidenza formativa pregressa. Esonero ruolo
--                      lavoratore importato dal flag standalone (nota vuota).
-- Livello antincendio azienda = 1 (ufficio), gruppo primo soccorso = BC.

do $$
declare
  v_cli uuid;
  v_tazio uuid;
  v_stelluti uuid;
  v_vedova uuid;
begin
  ------------------------------------------------------------------ cliente
  select id into v_cli
  from cliente
  where partita_iva = '04534450236'
  limit 1;

  if v_cli is null then
    insert into cliente
      (ragione_sociale, partita_iva, codice_fiscale, codice_ateco,
       livello_rischio, livello_antincendio, gruppo_primo_soccorso, attivo)
    values
      ('OVERALL GROUP', '04534450236', '04534450236', '74',
       'basso', '1', 'BC', true)
    returning id into v_cli;
  end if;

  ------------------------------------------------------------------ persone
  select id into v_tazio from persona
    where cliente_id = v_cli and codice_fiscale = 'PRDTZA85H24E897O' limit 1;
  if v_tazio is null then
    insert into persona (cliente_id, nome, cognome, codice_fiscale, attivo, formazione_pregressa)
    values (v_cli, 'TAZIO', 'PRADELLA', 'PRDTZA85H24E897O', true, false)
    returning id into v_tazio;
  end if;

  select id into v_stelluti from persona
    where cliente_id = v_cli and codice_fiscale = 'STLRKE92R41E885H' limit 1;
  if v_stelluti is null then
    insert into persona (cliente_id, nome, cognome, codice_fiscale, attivo, formazione_pregressa)
    values (v_cli, 'ERIKA', 'STELLUTI', 'STLRKE92R41E885H', true, false)
    returning id into v_stelluti;
  end if;

  select id into v_vedova from persona
    where cliente_id = v_cli and codice_fiscale = 'VDVMTN98P51D530P' limit 1;
  if v_vedova is null then
    insert into persona (cliente_id, nome, cognome, codice_fiscale, attivo, formazione_pregressa)
    values (v_cli, 'MARTINA', 'VEDOVA', 'VDVMTN98P51D530P', true, false)
    returning id into v_vedova;
  end if;

  ------------------------------------------------------------------ nomine
  -- unique (persona_id, figura_codice) -> on conflict do nothing = idempotente.
  insert into nomina (persona_id, figura_codice, data_nomina, attiva) values
    (v_tazio,    'dl_rspp',                 date '2025-01-01', true),
    (v_stelluti, 'lavoratore',              null,             true),
    (v_stelluti, 'addetto_primo_soccorso',  date '2023-06-27', true),
    (v_stelluti, 'addetto_antincendio',     date '2023-09-21', true),
    (v_vedova,   'lavoratore',              null,             true),
    (v_vedova,   'addetto_antincendio',     date '2023-07-03', true)
  on conflict (persona_id, figura_codice) do nothing;

  ------------------------------------------------------------------ formazioni
  -- STELLUTI
  insert into formazione (persona_id, corso_codice, corso_nome, categoria, data_completamento, is_aggiornamento)
  select v_stelluti, 'LAV_GEN', 'Formazione generale lavoratori', 'lavoratore', date '2021-12-31', false
  where not exists (select 1 from formazione where persona_id = v_stelluti and corso_codice = 'LAV_GEN' and data_completamento = date '2021-12-31');

  insert into formazione (persona_id, corso_codice, corso_nome, categoria, data_completamento, is_aggiornamento)
  select v_stelluti, 'LAV_SPEC', 'Formazione specifica lavoratori - rischio basso', 'lavoratore', date '2023-06-23', false
  where not exists (select 1 from formazione where persona_id = v_stelluti and corso_codice = 'LAV_SPEC' and data_completamento = date '2023-06-23');

  insert into formazione (persona_id, corso_codice, corso_nome, categoria, data_completamento, is_aggiornamento)
  select v_stelluti, 'PS_GRBC', 'Addetto primo soccorso gruppi B e C', 'primo_soccorso', date '2023-06-27', false
  where not exists (select 1 from formazione where persona_id = v_stelluti and corso_codice = 'PS_GRBC' and data_completamento = date '2023-06-27');

  insert into formazione (persona_id, corso_codice, corso_nome, categoria, data_completamento, is_aggiornamento)
  select v_stelluti, 'PS_GRBC', 'Aggiornamento addetto primo soccorso gruppi B e C', 'primo_soccorso', date '2026-06-17', true
  where not exists (select 1 from formazione where persona_id = v_stelluti and corso_codice = 'PS_GRBC' and data_completamento = date '2026-06-17');

  insert into formazione (persona_id, corso_codice, corso_nome, categoria, data_completamento, is_aggiornamento)
  select v_stelluti, 'AI_LIV1', 'Addetto antincendio livello 1', 'antincendio', date '2023-09-21', false
  where not exists (select 1 from formazione where persona_id = v_stelluti and corso_codice = 'AI_LIV1' and data_completamento = date '2023-09-21');

  -- VEDOVA
  insert into formazione (persona_id, corso_codice, corso_nome, categoria, data_completamento, is_aggiornamento)
  select v_vedova, 'LAV_GEN', 'Formazione generale lavoratori', 'lavoratore', date '2019-10-15', false
  where not exists (select 1 from formazione where persona_id = v_vedova and corso_codice = 'LAV_GEN' and data_completamento = date '2019-10-15');

  insert into formazione (persona_id, corso_codice, corso_nome, categoria, data_completamento, is_aggiornamento)
  select v_vedova, 'AI_LIV3', 'Addetto antincendio livello 3', 'antincendio', date '2023-07-03', false
  where not exists (select 1 from formazione where persona_id = v_vedova and corso_codice = 'AI_LIV3' and data_completamento = date '2023-07-03');

  -- VEDOVA: RSPP Mod. C pregresso (ASR 2016), evidenza informativa (nessuna nomina RSPP).
  insert into formazione (persona_id, corso_codice, corso_nome, categoria, data_completamento, is_aggiornamento, note)
  select v_vedova, 'RSPP_MOD_C', 'R.S.P.P. - Modulo C - A.S.R. 2016', 'rspp_aspp', date '2022-05-13', false,
         'Importato da organigramma standalone (evidenza pregressa)'
  where not exists (select 1 from formazione where persona_id = v_vedova and corso_codice = 'RSPP_MOD_C' and data_completamento = date '2022-05-13');

  ------------------------------------------------------------------ esoneri
  -- TAZIO: datore-RSPP con qualifica RSPP completa -> DL_RSPP_BASE/COMUNE esonerati.
  insert into esonero (persona_id, corso_codice, tipo, motivazione, data_riconoscimento, attivo)
  select v_tazio, 'DL_RSPP_BASE', 'ruolo_equipollente',
         'Datore-RSPP: possesso qualifica RSPP completa (Mod. A+B+C)', date '2025-01-01', true
  where not exists (select 1 from esonero where persona_id = v_tazio and corso_codice = 'DL_RSPP_BASE');

  insert into esonero (persona_id, corso_codice, tipo, motivazione, data_riconoscimento, attivo)
  select v_tazio, 'DL_RSPP_COMUNE', 'ruolo_equipollente',
         'Datore-RSPP: possesso qualifica RSPP completa (Mod. A+B+C)', date '2025-01-01', true
  where not exists (select 1 from esonero where persona_id = v_tazio and corso_codice = 'DL_RSPP_COMUNE');

  -- VEDOVA: esonero ruolo lavoratore importato dal flag standalone (nota vuota).
  -- Da verificare con Francesco: motivazione non specificata nell'export.
  insert into esonero (persona_id, figura_codice, tipo, motivazione, attivo)
  select v_vedova, 'lavoratore', 'altro',
         'Esonero ruolo lavoratore importato da organigramma standalone (v2.10) - motivazione da confermare', true
  where not exists (select 1 from esonero where persona_id = v_vedova and figura_codice = 'lavoratore' and corso_codice is null);

end $$;
