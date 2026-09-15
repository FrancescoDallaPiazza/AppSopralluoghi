-- nomine_dl_rspp_ultime_cinque.sql - NON e' una migration.
--
-- ============================================================================
--  COME SI LANCIA: incollare TUTTO il file nell'SQL Editor e premere Run una
--  volta sola. Non selezionarne una parte. Poi guardare il risultato della
--  query di verifica in fondo: e' quella, non il messaggio, a dire se e' fatto.
-- ============================================================================
--
-- COSA FA. Scrive 5 nomine `dl_rspp` (datore di lavoro che svolge i compiti di
-- RSPP, art. 34) per 5 delle 7 righe che la pagina nomine lasciava "da decidere"
-- dopo il 15.09 (foglio "Ruoli SSL" di ExportExcel (4).xlsx).
--
-- PERCHE'. Decisione di Francesco del 15 settembre 2026, riga per riga:
-- "1097 A, 1503 C, 2146 A, 2326 A, 3451 A, 2248 A, 2461 C", dove A = e' il
-- datore di lavoro e fa da RSPP in proprio. Qui le cinque A:
--   riga 1097  FALEGNAMERIA MAST S.N.C.            colonna RSPP 2015-02-17, senza CF
--   riga 2146  AUTOFFICINA MORARI DI MORARI LUCA   colonna RSPP 2022-03-01
--   riga 2326  MOTUS TEAM di Padovani Marco & C.   colonna RSPP 2021-06-07
--   riga 3451  GRAFICHE DUEGI DI ZARDINI G & C.    colonna RSPP 2019-04-29, senza CF
--   riga 2248  CARROZZERIA TOP CAR S.N.C.          qualifica "RSPP-SOCIO"
-- La 1503 e la 2461 (C) restano da decidere e qui non compaiono.
--
-- COME SCRIVE. Come la pagina: per le quattro dalla colonna, origine 'colonna' e
-- la data della colonna (i seriali di Excel convertiti come `isoData`); per la
-- 2248, origine 'qualifica', il testo in origine_testo e nessuna data. In `note`
-- la decisione.
--
-- LE PERSONE. Le tre con il codice fiscale si riconoscono dall'md5 del CF
-- ripulito. La 1097 e la 3451 non hanno CF e si riconoscono per COGNOME e NOME,
-- confrontati sulle sole lettere A-Z dopo aver tolto gli accenti (DONA', DONA'
-- con l'accento e DONA danno la stessa chiave). Letto il 15.09, prima di scrivere,
-- che ogni chiave trovi esattamente una persona.
--
-- IL CONTROLLO ANNULLA. Un blocco solo, e non scrive niente se:
--   - una voce non trova esattamente una persona;
--   - una delle 5 ha gia' `dl_rspp` (anche: lo script e' gia' stato lanciato);
--   - l'insert non scrive esattamente 5 righe.
--
-- ASCII-only: le vocali accentate si scrivono con chr().

do $$
declare
  v constant jsonb := '[
    {"riga": 1097, "md5": null, "cog": "DONA", "nom": "MASSIMO",
     "fonte": "colonna", "testo": null, "data": "2015-02-17"},
    {"riga": 2146, "md5": "190231bb4d324fe5586401fd3f65baa0", "cog": null, "nom": null,
     "fonte": "colonna", "testo": null, "data": "2022-03-01"},
    {"riga": 2248, "md5": "ff8a8334cfea84a38c2dd37a70a9ae2b", "cog": null, "nom": null,
     "fonte": "qualifica", "testo": "RSPP-SOCIO", "data": null},
    {"riga": 2326, "md5": "faf262b379d28c4db4c8bd48631f7b43", "cog": null, "nom": null,
     "fonte": "colonna", "testo": null, "data": "2021-06-07"},
    {"riga": 3451, "md5": null, "cog": "ZARDINI", "nom": "GIUSEPPE",
     "fonte": "colonna", "testo": null, "data": "2019-04-29"}
  ]';
  accentate constant text := chr(224) || chr(232) || chr(233) || chr(236)
    || chr(242) || chr(249) || chr(192) || chr(200) || chr(201) || chr(204)
    || chr(210) || chr(217);
  n bigint;
begin
  if jsonb_array_length(v) <> 5 then
    raise exception 'Le voci dovevano essere 5, sono %. Niente scritto.',
      jsonb_array_length(v);
  end if;

  create temporary table if not exists pg_temp.voci_ultime_cinque (
    riga int, persona_id uuid, fonte text, testo text, data date
  ) on commit drop;
  delete from pg_temp.voci_ultime_cinque;

  insert into pg_temp.voci_ultime_cinque
  select a.riga, p.id, a.fonte, a.testo, a.data
    from jsonb_to_recordset(v)
      as a(riga int, md5 text, cog text, nom text,
           fonte text, testo text, data date)
    join public.persona p
      on (a.md5 is not null
          and md5(upper(regexp_replace(coalesce(p.codice_fiscale, ''),
                '[^A-Za-z0-9]', '', 'g'))) = a.md5)
      or (a.md5 is null
          and upper(regexp_replace(translate(coalesce(p.cognome, ''),
                accentate, 'aeeiouAEEIOU'), '[^A-Za-z]', '', 'g')) = a.cog
          and upper(regexp_replace(translate(coalesce(p.nome, ''),
                accentate, 'aeeiouAEEIOU'), '[^A-Za-z]', '', 'g')) = a.nom);

  -- 1. Ogni voce trova esattamente una persona.
  select count(*) into n from (
    select a.riga
      from jsonb_to_recordset(v) as a(riga int)
      left join pg_temp.voci_ultime_cinque t on t.riga = a.riga
     group by a.riga
    having count(t.persona_id) <> 1
  ) x;
  if n <> 0 then
    raise exception '% voci su 5 non trovano esattamente una persona. Niente scritto.', n;
  end if;

  -- 2. Nessuna delle 5 ha gia' dl_rspp.
  select count(*) into n
    from pg_temp.voci_ultime_cinque t
    join public.nomina x
      on x.persona_id = t.persona_id and x.figura_codice = 'dl_rspp';
  if n <> 0 then
    raise exception '% voci su 5 hanno gia'' dl_rspp (gia'' lanciato?). Niente scritto.', n;
  end if;

  -- 3. Le 5.
  insert into public.nomina
    (persona_id, figura_codice, data_nomina, attiva, note,
     origine, origine_testo)
  select t.persona_id, 'dl_rspp', t.data, true,
         'Datore di lavoro che fa da RSPP in proprio (art. 34): '
           || 'decisione di Francesco, 15.09.2026.',
         t.fonte, t.testo
    from pg_temp.voci_ultime_cinque t
  on conflict (persona_id, figura_codice) do nothing;
  get diagnostics n = row_count;
  if n <> 5 then
    raise exception 'L''insert doveva scrivere 5 nomine, ne ha scritte %. Annullato.', n;
  end if;

  raise notice 'Controllo superato: 5 nomine dl_rspp scritte.';
end $$;

-- ============================================================================
--  VERIFICA, in sola lettura. Deve dire ok su tutte e 5 le righe.
-- ============================================================================
with a(riga, md5_cf, cog, nom, fonte, testo, data) as (values
  (1097, null, 'DONA', 'MASSIMO', 'colonna', null, date '2015-02-17'),
  (2146, '190231bb4d324fe5586401fd3f65baa0', null, null, 'colonna', null, date '2022-03-01'),
  (2248, 'ff8a8334cfea84a38c2dd37a70a9ae2b', null, null, 'qualifica', 'RSPP-SOCIO', null),
  (2326, 'faf262b379d28c4db4c8bd48631f7b43', null, null, 'colonna', null, date '2021-06-07'),
  (3451, null, 'ZARDINI', 'GIUSEPPE', 'colonna', null, date '2019-04-29')
),
p as (
  select id, codice_fiscale,
    md5(upper(regexp_replace(coalesce(codice_fiscale, ''),
      '[^A-Za-z0-9]', '', 'g'))) as md5_cf,
    upper(regexp_replace(translate(coalesce(cognome, ''),
      chr(224) || chr(232) || chr(233) || chr(236) || chr(242)
      || chr(249) || chr(192) || chr(200) || chr(201) || chr(204)
      || chr(210) || chr(217), 'aeeiouAEEIOU'), '[^A-Za-z]', '', 'g')) as cog,
    upper(regexp_replace(translate(coalesce(nome, ''),
      chr(224) || chr(232) || chr(233) || chr(236) || chr(242)
      || chr(249) || chr(192) || chr(200) || chr(201) || chr(204)
      || chr(210) || chr(217), 'aeeiouAEEIOU'), '[^A-Za-z]', '', 'g')) as nom
  from public.persona
),
d as (
  select a.*, p.id as persona_id, n.id as nomina_id,
    n.origine, n.origine_testo, n.data_nomina
    from a
    join p
      on (a.md5_cf is not null and p.md5_cf = a.md5_cf)
      or (a.md5_cf is null and p.cog = a.cog and p.nom = a.nom)
    left join public.nomina n
      on n.persona_id = p.id and n.figura_codice = 'dl_rspp'
),
r(ordine, controllo, trovato, atteso) as (
  select 1, 'le 5: persone trovate, una ciascuna',
    (select count(*) from (select riga from d group by riga
       having count(distinct persona_id) = 1) x), 5
  union all
  select 2, 'le 5: con dl_rspp',
    (select count(*) from d where nomina_id is not null), 5
  union all
  select 3, 'le 5: origine giusta',
    (select count(*) from d where origine = fonte
       and origine_testo is not distinct from testo), 5
  union all
  select 4, 'le 5: data giusta',
    (select count(*) from d
      where data_nomina is not distinct from data), 5
  union all
  select 5, 'nomine in tutto',
    (select count(*) from public.nomina), 459
)
select ordine, controllo, trovato, atteso,
  case when trovato = atteso then 'ok' else 'NO' end as esito
  from r
 order by ordine;
