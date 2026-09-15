-- nomine_dl_rspp_da_attestati.sql - NON e' una migration.
--
-- ============================================================================
--  COME SI LANCIA: incollare TUTTO il file nell'SQL Editor e premere Run una
--  volta sola. Non selezionarne una parte. Poi guardare il risultato della
--  query di verifica in fondo: e' quella, non il messaggio, a dire se e' fatto.
-- ============================================================================
--
-- COSA FA. Scrive 20 nomine `dl_rspp` (datore di lavoro che svolge i compiti di
-- RSPP, art. 34) per persone che nel foglio "Ruoli SSL" di ExportExcel (4).xlsx
-- hanno la colonna RSPP con una data.
--
-- PERCHE'. La colonna RSPP resta fuori dall'import delle nomine: il gestionale
-- chiama "RSPP" anche il datore che assume l'incarico in proprio, e dal foglio
-- non si distingue il professionista. La prova sta negli attestati. Decisione di
-- Francesco del 15 settembre 2026: "fai gia' te abbinamento prendendo i 26
-- attestati". Delle 31 righe con la colonna RSPP, misurate su
-- ExportExcelCorsiFatti.xlsx:
--   - 26 hanno, per codice fiscale, un attestato da datore di lavoro RSPP
--     ("R.S.P.P. DATORE DI LAVORO RISCHIO ..." o i suoi aggiornamenti), e
--     nessuna ha i moduli A/B/C del professionista. Sono queste 26;
--   - la 1097 ha un attestato da datore trovato solo per cognome e nome, senza
--     codice fiscale: FUORI, l'aggancio e' troppo debole per una nomina;
--   - la 1503, la 2146, la 2326 e la 3451 non hanno attestati RSPP: FUORI,
--     restano "da decidere".
--
-- LE 6 GIA' PRESENTI NON SI TOCCANO. Le righe 347, 821, 2651, 2729, 3260 e 3397
-- hanno gia' `dl_rspp` dalla mansione (import del 14.09), senza data. Letto il
-- 15.09 in sola lettura. Una nomina che c'e' ha la sua origine, e non si
-- riscrive: e' la regola di `applicaNomine`. Quindi 26 - 6 = 20.
--
-- COME SCRIVE. Come la pagina: origine 'colonna' (la nomina e' dichiarata in una
-- colonna di ruolo, con la data dell'incarico), origine_testo null, attiva, e la
-- data della colonna RSPP. In `note` il perche'.
--
-- LE PERSONE. Si riconoscono dall'md5 del codice fiscale ripulito (maiuscolo,
-- solo A-Z0-9), cosi' nel file non c'e' nessun codice fiscale. Le date sono i
-- seriali di Excel convertiti come `isoData`, riscontrati 26 su 26.
--
-- IL CONTROLLO ANNULLA. Un blocco solo, e non scrive niente se:
--   - un md5 non trova esattamente una persona;
--   - le persone che hanno gia' `dl_rspp` non sono esattamente le 6 attese
--     (se sono 26, lo script e' gia' stato lanciato);
--   - l'insert non scrive esattamente 20 righe.
-- Nessuna tabella temporanea: i dati stanno in una costante del blocco.
--
-- ASCII-only.

do $$
declare
  v constant jsonb := '[
    {"riga": 162, "gia": false, "data": "2020-09-10",
     "md5": "c9cb523fb3e277b6b5c8c0a5420374e2"},
    {"riga": 347, "gia": true, "data": "2021-11-09",
     "md5": "57ed076154bcad848fb14c21a2b26979"},
    {"riga": 435, "gia": false, "data": "2019-10-24",
     "md5": "c26bf13209923a599c382d8b9590c524"},
    {"riga": 714, "gia": false, "data": "2006-03-07",
     "md5": "d0ab1481e5501890dc9edc8d7e37998c"},
    {"riga": 821, "gia": true, "data": "2016-12-19",
     "md5": "6add21132097d618ae82abba205c2da8"},
    {"riga": 916, "gia": false, "data": "2020-07-22",
     "md5": "44fc74cd73aff2aea57df6e089de45b2"},
    {"riga": 971, "gia": false, "data": "2013-05-27",
     "md5": "19671e1658e50f056a8004a7d34f9509"},
    {"riga": 1388, "gia": false, "data": "2020-10-02",
     "md5": "23a09ffdcba2d87d9f0df43ee4b20ce6"},
    {"riga": 1476, "gia": false, "data": "2018-01-09",
     "md5": "1069fed6b1c79fdcac999f6c8e635275"},
    {"riga": 1846, "gia": false, "data": "2020-03-17",
     "md5": "89172f7de9a4dca48b546565e306a2b5"},
    {"riga": 2037, "gia": false, "data": "2020-10-02",
     "md5": "999fbff4be63aa259ca92b2b34cf97d0"},
    {"riga": 2297, "gia": false, "data": "2020-10-12",
     "md5": "25307fdb90901a132e6f64ed9cfd9d72"},
    {"riga": 2324, "gia": false, "data": "2020-11-12",
     "md5": "9d005930fac645e05c23794f7b38e436"},
    {"riga": 2651, "gia": true, "data": "2020-10-01",
     "md5": "b7ea7f498d247aa4489c8132718e79bf"},
    {"riga": 2729, "gia": true, "data": "2019-05-10",
     "md5": "0c750cfe9afbebd29ac9a774018ff5e1"},
    {"riga": 2784, "gia": false, "data": "2021-08-24",
     "md5": "c1b1b829126cb4a58397770edb6cd13b"},
    {"riga": 2812, "gia": false, "data": "2019-10-23",
     "md5": "02a688022fbd89b687d867bbc7c901ac"},
    {"riga": 2905, "gia": false, "data": "2015-06-22",
     "md5": "2dd2a64721fd0a873642f1db785eecdf"},
    {"riga": 3102, "gia": false, "data": "2020-06-30",
     "md5": "e66a50052f5dd61f3cca22b2a58ecfd7"},
    {"riga": 3122, "gia": false, "data": "2016-12-12",
     "md5": "7905536c7860c4260958c407e991ff9e"},
    {"riga": 3185, "gia": false, "data": "2020-01-17",
     "md5": "0e80cd191a0ebd607116c1e961494285"},
    {"riga": 3203, "gia": false, "data": "2021-04-28",
     "md5": "d9ce58bf65f0e5ddb966895c5488f152"},
    {"riga": 3260, "gia": true, "data": "2018-04-05",
     "md5": "e66ffed3e4fb7e631e9bb083ae142414"},
    {"riga": 3266, "gia": false, "data": "2021-09-21",
     "md5": "6e54c1a720a1591f37d13a5e2b94869c"},
    {"riga": 3311, "gia": false, "data": "2017-12-19",
     "md5": "d6fbe48575a72820af0033a2dcd619e0"},
    {"riga": 3397, "gia": true, "data": "2010-06-25",
     "md5": "52dd9b0b4b1338354e5fddb2bb936b33"}
  ]';
  n bigint;
begin
  if jsonb_array_length(v) <> 26 then
    raise exception 'Le voci dovevano essere 26, sono %. Niente e'' stato scritto.',
      jsonb_array_length(v);
  end if;

  -- 1. Ogni md5 trova esattamente una persona.
  select count(*) into n
    from jsonb_to_recordset(v) as a(riga int, gia boolean, data date, md5 text)
   where (select count(*) from public.persona p
           where md5(upper(regexp_replace(coalesce(p.codice_fiscale, ''),
                 '[^A-Za-z0-9]', '', 'g'))) = a.md5) <> 1;
  if n <> 0 then
    raise exception '% voci su 26 non trovano esattamente una persona. Niente e'' stato scritto.', n;
  end if;

  -- 2. Chi ha gia' dl_rspp e' esattamente chi e' segnato "gia".
  select count(*) into n
    from jsonb_to_recordset(v) as a(riga int, gia boolean, data date, md5 text)
    join public.persona p
      on md5(upper(regexp_replace(coalesce(p.codice_fiscale, ''),
         '[^A-Za-z0-9]', '', 'g'))) = a.md5
   where a.gia <> exists (select 1 from public.nomina x
                           where x.persona_id = p.id
                             and x.figura_codice = 'dl_rspp');
  if n <> 0 then
    raise exception '% voci su 26 hanno gia'' dl_rspp diversamente dall''atteso (6). Se lo script e'' gia'' stato lanciato, e'' questo. Niente e'' stato scritto.', n;
  end if;

  -- 3. Le 20 che mancano.
  insert into public.nomina
    (persona_id, figura_codice, data_nomina, attiva, note, origine, origine_testo)
  select p.id, 'dl_rspp', a.data, true,
         'Colonna RSPP del gestionale letta come datore di lavoro RSPP (art. 34): '
           || 'la persona ha un attestato da datore di lavoro RSPP. '
           || 'Decisione di Francesco, 15.09.2026.',
         'colonna', null
    from jsonb_to_recordset(v) as a(riga int, gia boolean, data date, md5 text)
    join public.persona p
      on md5(upper(regexp_replace(coalesce(p.codice_fiscale, ''),
         '[^A-Za-z0-9]', '', 'g'))) = a.md5
   where not a.gia
  on conflict (persona_id, figura_codice) do nothing;
  get diagnostics n = row_count;
  if n <> 20 then
    raise exception 'L''insert doveva scrivere 20 nomine, ne ha scritte %. Annullato: niente e'' stato scritto.', n;
  end if;

  raise notice 'Controllo superato: 20 nomine dl_rspp scritte, le 6 gia'' presenti intatte.';
end $$;

-- ============================================================================
--  VERIFICA, in sola lettura. Deve dire ok su tutte e 6 le righe.
-- ============================================================================
with a(riga, gia, data, md5) as (values
  ( 162, false, date '2020-09-10', 'c9cb523fb3e277b6b5c8c0a5420374e2'),
  ( 347, true,  date '2021-11-09', '57ed076154bcad848fb14c21a2b26979'),
  ( 435, false, date '2019-10-24', 'c26bf13209923a599c382d8b9590c524'),
  ( 714, false, date '2006-03-07', 'd0ab1481e5501890dc9edc8d7e37998c'),
  ( 821, true,  date '2016-12-19', '6add21132097d618ae82abba205c2da8'),
  ( 916, false, date '2020-07-22', '44fc74cd73aff2aea57df6e089de45b2'),
  ( 971, false, date '2013-05-27', '19671e1658e50f056a8004a7d34f9509'),
  (1388, false, date '2020-10-02', '23a09ffdcba2d87d9f0df43ee4b20ce6'),
  (1476, false, date '2018-01-09', '1069fed6b1c79fdcac999f6c8e635275'),
  (1846, false, date '2020-03-17', '89172f7de9a4dca48b546565e306a2b5'),
  (2037, false, date '2020-10-02', '999fbff4be63aa259ca92b2b34cf97d0'),
  (2297, false, date '2020-10-12', '25307fdb90901a132e6f64ed9cfd9d72'),
  (2324, false, date '2020-11-12', '9d005930fac645e05c23794f7b38e436'),
  (2651, true,  date '2020-10-01', 'b7ea7f498d247aa4489c8132718e79bf'),
  (2729, true,  date '2019-05-10', '0c750cfe9afbebd29ac9a774018ff5e1'),
  (2784, false, date '2021-08-24', 'c1b1b829126cb4a58397770edb6cd13b'),
  (2812, false, date '2019-10-23', '02a688022fbd89b687d867bbc7c901ac'),
  (2905, false, date '2015-06-22', '2dd2a64721fd0a873642f1db785eecdf'),
  (3102, false, date '2020-06-30', 'e66a50052f5dd61f3cca22b2a58ecfd7'),
  (3122, false, date '2016-12-12', '7905536c7860c4260958c407e991ff9e'),
  (3185, false, date '2020-01-17', '0e80cd191a0ebd607116c1e961494285'),
  (3203, false, date '2021-04-28', 'd9ce58bf65f0e5ddb966895c5488f152'),
  (3260, true,  date '2018-04-05', 'e66ffed3e4fb7e631e9bb083ae142414'),
  (3266, false, date '2021-09-21', '6e54c1a720a1591f37d13a5e2b94869c'),
  (3311, false, date '2017-12-19', 'd6fbe48575a72820af0033a2dcd619e0'),
  (3397, true,  date '2010-06-25', '52dd9b0b4b1338354e5fddb2bb936b33')
),
p as (
  select a.*, x.id as persona_id
    from a
    join public.persona x
      on md5(upper(regexp_replace(coalesce(x.codice_fiscale, ''),
         '[^A-Za-z0-9]', '', 'g'))) = a.md5
),
d as (
  select p.*, n.origine, n.data_nomina, n.id as nomina_id
    from p
    left join public.nomina n
      on n.persona_id = p.persona_id and n.figura_codice = 'dl_rspp'
),
r(ordine, controllo, trovato, atteso) as (
  select 1, 'le 26: persone trovate',
    (select count(distinct riga) from p), 26
  union all
  select 2, 'le 26: con dl_rspp',
    (select count(*) from d where nomina_id is not null), 26
  union all
  select 3, 'le 20: colonna, data della colonna',
    (select count(*) from d where not gia
       and origine = 'colonna' and data_nomina = data), 20
  union all
  select 4, 'le 6: mansione, senza data, intatte',
    (select count(*) from d where gia
       and origine = 'mansione' and data_nomina is null), 6
  union all
  -- Da colonna: l'import delle nomine di oggi ha gia' scritto un dl_rspp
  -- dalla mansione (riga 1931), che qui non va contato.
  select 5, 'dl_rspp create oggi, da colonna',
    (select count(*) from public.nomina
      where figura_codice = 'dl_rspp' and origine = 'colonna'
        and created_at >= date '2026-09-15'), 20
  union all
  select 6, 'nomine in tutto',
    (select count(*) from public.nomina), 447
)
select ordine, controllo, trovato, atteso,
  case when trovato = atteso then 'ok' else 'NO' end as esito
  from r
 order by ordine;
