-- nomine_dl_rspp_da_testo_e_attestati.sql - NON e' una migration.
--
-- ============================================================================
--  COME SI LANCIA: incollare TUTTO il file nell'SQL Editor e premere Run una
--  volta sola. Non selezionarne una parte. Poi guardare il risultato della
--  query di verifica in fondo: e' quella, non il messaggio, a dire se e' fatto.
-- ============================================================================
--
-- COSA FA. Scrive 7 nomine `dl_rspp` (datore di lavoro che svolge i compiti di
-- RSPP, art. 34) per 7 righe del foglio "Ruoli SSL" di ExportExcel (4).xlsx che
-- l'import delle nomine lascia "da decidere": il ruolo RSPP e' scritto nella
-- mansione o nella qualifica, e il dizionario non ha una regola perche' "RSPP"
-- secco, o "SOCIO/RSPP", non dice se la persona sia il datore o un RSPP esterno.
--
-- PERCHE'. La risposta sta negli attestati, come per la colonna RSPP
-- (nomine_dl_rspp_da_attestati.sql). Tutte e 7 hanno, per codice fiscale, in
-- ExportExcelCorsiFatti.xlsx, un attestato da datore di lavoro RSPP
-- ("R.S.P.P. DATORE DI LAVORO RISCHIO ..." o i suoi aggiornamenti), e nessuna
-- i moduli del professionista. Proposta del 15.09 accettata da Francesco:
--   riga  350  SOC. AGRICOLA BIASI       qualifica "RSPP"
--   riga  748  NEW METROPOL              qualifica "RSPP"
--   riga  855  MARCIOR SRL               mansione  "SOCIO/ RSPP"
--   riga 1206  PLANET-O SRL              mansione  "SOCIO/ RSPP"
--   riga 2103  VERONA MOTORI SNC         mansione  "SOCIO/RSPP"
--   riga 2537  SAN BIAGIO SOCCORSO       mansione  "RSPP"
--   riga 2578  P.D.M. FALEGNAMERIA       mansione  "RSPP"
-- Nelle 1206, 2103 e 2537 il campo "Datore di lavoro" del corso nomina un'altra
-- persona: il corso da datore RSPP pero' lo frequenta solo chi e' datore.
--
-- COME SCRIVE. Come la pagina scrive una nomina dedotta da un testo: origine
-- 'mansione' o 'qualifica' (dove sta scritto il ruolo), origine_testo il testo
-- in maiuscolo come lo legge l'import, nessuna data (il testo non ne porta), e
-- in `note` che la regola l'ha data l'attestato. Nella 2103 mansione e qualifica
-- dicono la stessa cosa: vale la mansione, come in `riepiloga`.
--
-- LE PERSONE si riconoscono dall'md5 del codice fiscale ripulito (maiuscolo,
-- solo A-Z0-9): nel file non c'e' nessun codice fiscale.
--
-- IL CONTROLLO ANNULLA. Un blocco solo, e non scrive niente se:
--   - un md5 non trova esattamente una persona;
--   - una delle 7 ha gia' `dl_rspp` (anche: lo script e' gia' stato lanciato);
--   - l'insert non scrive esattamente 7 righe.
--
-- ASCII-only.

do $$
declare
  v constant jsonb := '[
    {"riga": 350, "fonte": "qualifica", "testo": "RSPP",
     "md5": "3ef8b1a663cc9cd7268d1802f03af3fe"},
    {"riga": 748, "fonte": "qualifica", "testo": "RSPP",
     "md5": "67c920d64f69b7fc260b90adf8645e28"},
    {"riga": 855, "fonte": "mansione", "testo": "SOCIO/ RSPP",
     "md5": "d5ba1babceef3d7183d988c09cd544ce"},
    {"riga": 1206, "fonte": "mansione", "testo": "SOCIO/ RSPP",
     "md5": "9dcfcea882d3e8ffcc425e1dd9f2555a"},
    {"riga": 2103, "fonte": "mansione", "testo": "SOCIO/RSPP",
     "md5": "06a8a3e999c4f03b742163e93dedfff8"},
    {"riga": 2537, "fonte": "mansione", "testo": "RSPP",
     "md5": "940172165686c94ef5e92f0ec9d584c3"},
    {"riga": 2578, "fonte": "mansione", "testo": "RSPP",
     "md5": "6dfa033219166b2048e09ff00273401e"}
  ]';
  n bigint;
begin
  if jsonb_array_length(v) <> 7 then
    raise exception 'Le voci dovevano essere 7, sono %. Niente e'' stato scritto.',
      jsonb_array_length(v);
  end if;

  -- 1. Ogni md5 trova esattamente una persona.
  select count(*) into n
    from jsonb_to_recordset(v) as a(riga int, fonte text, testo text, md5 text)
   where (select count(*) from public.persona p
           where md5(upper(regexp_replace(coalesce(p.codice_fiscale, ''),
                 '[^A-Za-z0-9]', '', 'g'))) = a.md5) <> 1;
  if n <> 0 then
    raise exception '% voci su 7 non trovano esattamente una persona. Niente e'' stato scritto.', n;
  end if;

  -- 2. Nessuna delle 7 ha gia' dl_rspp.
  select count(*) into n
    from jsonb_to_recordset(v) as a(riga int, fonte text, testo text, md5 text)
    join public.persona p
      on md5(upper(regexp_replace(coalesce(p.codice_fiscale, ''),
         '[^A-Za-z0-9]', '', 'g'))) = a.md5
    join public.nomina x
      on x.persona_id = p.id and x.figura_codice = 'dl_rspp';
  if n <> 0 then
    raise exception '% voci su 7 hanno gia'' dl_rspp. Se lo script e'' gia'' stato lanciato, e'' questo. Niente e'' stato scritto.', n;
  end if;

  -- 3. Le 7.
  insert into public.nomina
    (persona_id, figura_codice, data_nomina, attiva, note, origine, origine_testo)
  select p.id, 'dl_rspp', null, true,
         'RSPP scritto nella ' || a.fonte || ', letto come datore di lavoro RSPP '
           || '(art. 34): la persona ha un attestato da datore di lavoro RSPP. '
           || 'Decisione di Francesco, 15.09.2026.',
         a.fonte, a.testo
    from jsonb_to_recordset(v) as a(riga int, fonte text, testo text, md5 text)
    join public.persona p
      on md5(upper(regexp_replace(coalesce(p.codice_fiscale, ''),
         '[^A-Za-z0-9]', '', 'g'))) = a.md5
  on conflict (persona_id, figura_codice) do nothing;
  get diagnostics n = row_count;
  if n <> 7 then
    raise exception 'L''insert doveva scrivere 7 nomine, ne ha scritte %. Annullato: niente e'' stato scritto.', n;
  end if;

  raise notice 'Controllo superato: 7 nomine dl_rspp scritte.';
end $$;

-- ============================================================================
--  VERIFICA, in sola lettura. Deve dire ok su tutte e 5 le righe.
-- ============================================================================
with a(riga, fonte, testo, md5) as (values
  ( 350, 'qualifica', 'RSPP',        '3ef8b1a663cc9cd7268d1802f03af3fe'),
  ( 748, 'qualifica', 'RSPP',        '67c920d64f69b7fc260b90adf8645e28'),
  ( 855, 'mansione',  'SOCIO/ RSPP', 'd5ba1babceef3d7183d988c09cd544ce'),
  (1206, 'mansione',  'SOCIO/ RSPP', '9dcfcea882d3e8ffcc425e1dd9f2555a'),
  (2103, 'mansione',  'SOCIO/RSPP',  '06a8a3e999c4f03b742163e93dedfff8'),
  (2537, 'mansione',  'RSPP',        '940172165686c94ef5e92f0ec9d584c3'),
  (2578, 'mansione',  'RSPP',        '6dfa033219166b2048e09ff00273401e')
),
d as (
  select a.*, n.id as nomina_id, n.origine, n.origine_testo, n.data_nomina
    from a
    join public.persona p
      on md5(upper(regexp_replace(coalesce(p.codice_fiscale, ''),
         '[^A-Za-z0-9]', '', 'g'))) = a.md5
    left join public.nomina n
      on n.persona_id = p.id and n.figura_codice = 'dl_rspp'
),
r(ordine, controllo, trovato, atteso) as (
  select 1, 'le 7: persone trovate',
    (select count(distinct riga) from d), 7
  union all
  select 2, 'le 7: con dl_rspp',
    (select count(*) from d where nomina_id is not null), 7
  union all
  select 3, 'le 7: origine e testo giusti',
    (select count(*) from d
      where origine = fonte and origine_testo = testo), 7
  union all
  select 4, 'le 7: senza data',
    (select count(*) from d
      where nomina_id is not null and data_nomina is null), 7
  union all
  select 5, 'nomine in tutto',
    (select count(*) from public.nomina), 454
)
select ordine, controllo, trovato, atteso,
  case when trovato = atteso then 'ok' else 'NO' end as esito
  from r
 order by ordine;
