-- unisci_cinque_piva_condivise.sql - NON e' una migration.
--
-- ============================================================================
--  COME SI LANCIA: incollare TUTTO il file nell'SQL Editor e premere Run una
--  volta sola. Non selezionarne una parte. Poi guardare il risultato della
--  query di verifica in fondo: e' quella, non il messaggio, a dire se e' fatto.
-- ============================================================================
--
-- COSA FA. Cinque coppie di clienti con la stessa P.IVA, trovate il 14 settembre
-- 2026 leggendo tutti i clienti che condividono ancora una P.IVA (docs/STATO.md).
-- Decisione di Francesco, con le sue parole: "tieni solo la sede con persone e
-- dove non ci sono persone la prima sede che incontri in ordine". L'ordine e'
-- quello della tabella mostrata a Francesco (P.IVA, ragione sociale, creazione).
--
--   P.IVA        si tiene                                   si toglie
--   00199400128  LINDE MATERIAL HANDLING, Via del Luguzzone  LINDE, senza indirizzo
--   00967010232  CENTRO ATTIVITA', Via Fratelli Corra' 7     CENTRO ATTIVITA', Via fratelli Corra' 9
--                (21 persone)                               (0 persone)
--   01249140235  CENTRO SOCIALIZZAZIONE (26 persone)         CENTRO SOCIALIZZAZIONE (0 persone)
--   02449980230  MARANI G. SPA, il primo                     MARANI G. SPA, il secondo (identico)
--   04312380233  AZ. AGR. PARAVANTO DI ALBERTO DELIPERI      DELIPERI ALBERTO
--
-- COME. Nell'ordine provato da AppOverall sullo script dei doppioni (10cd71f):
-- si copiano i clienti da togliere, si tolgono (le loro sedi seguono per
-- cascata), e SOLO DOPO si riempiono i campi VUOTI dei clienti tenuti dalla
-- copia. Niente di quello che c'e' gia' viene sovrascritto, e nessun vincolo di
-- unicita' puo' vedere lo stesso valore su due righe.
--
-- IL CONTROLLO ANNULLA. Un blocco solo. Prima di scrivere: le 10 righe sono
-- quelle attese, ogni coppia ha la stessa P.IVA, e niente punta ai clienti da
-- togliere o alle loro sedi (chiavi esterne lette dal catalogo al lancio, e le
-- azioni "cliente-ateco:"). Ogni scrittura controlla quante righe tocca. Dopo:
-- i conteggi rispetto a prima. Se un controllo fallisce, errore e niente
-- scritto. Rilanciarlo e' innocuo: i clienti da togliere non ci sono piu' e il
-- controllo iniziale annulla.
--
-- ASCII-only.

do $$
declare
  tieni uuid[] := array['d0b15ad6-ef25-41d6-b2ed-233bd4b6289d',   -- LINDE MATERIAL HANDLING ITALIA SPA
                        '08344499-ac25-4231-886b-594f65a793a2',   -- CENTRO ATTIVITA', Corra' 7
                        'a4c840e2-0f56-4422-a4c4-2dc69ec1f345',   -- CENTRO SOCIALIZZAZIONE (26)
                        '8130dd73-d2f5-42d1-957d-608da8c167fb',   -- MARANI G. SPA
                        'c4bb073c-a9d5-4b8e-99ab-d2fb75918ae4']::uuid[];  -- AZ. AGR. PARAVANTO
  togli uuid[] := array['bd790392-958d-4a7e-a43a-8eb74953642e',
                        'e1a8a4d4-537d-46c4-8d39-aff9851ddcab',
                        '2e5f7e66-f38b-4d8a-8313-518abb745fb8',
                        'ef8e37aa-040f-4cf7-be5d-5fcc2f12097c',
                        '5f5792ea-3732-4f1c-8573-0c9e7f295d44']::uuid[];
  n bigint;
  totale bigint := 0;
  clienti_prima bigint;
  persone_tenuti_prima bigint;
  fk record;
  col record;
  i integer;
begin
  select count(*) into clienti_prima from public.cliente;
  select count(*) into persone_tenuti_prima from public.persona where cliente_id = any (tieni);

  -- 1. PRIMA DI SCRIVERE -----------------------------------------------------
  select count(*) into n from public.cliente where id = any (tieni);
  if n <> 5 then raise exception 'Attesi 5 clienti da tenere, trovati %. Niente e'' stato scritto.', n; end if;
  select count(*) into n from public.cliente where id = any (togli);
  if n <> 5 then raise exception 'Attesi 5 clienti da togliere, trovati %. Niente e'' stato scritto.', n; end if;

  for i in 1 .. array_length(tieni, 1) loop
    select count(*) into n
      from public.cliente k join public.cliente d on d.id = togli[i]
     where k.id = tieni[i] and k.partita_iva = d.partita_iva;
    if n <> 1 then
      raise exception 'La coppia % non ha la stessa P.IVA (tieni %, togli %). Niente e'' stato scritto.', i, tieni[i], togli[i];
    end if;
  end loop;

  for fk in
    select c.conrelid::regclass::text as tabella, a.attname as colonna, c.confrelid::regclass::text as riferita
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f' and c.confrelid in ('public.cliente'::regclass, 'public.sede'::regclass)
  loop
    if fk.tabella = 'sede' and fk.colonna = 'cliente_id' then continue; end if;   -- la sede vuota segue il cliente
    if fk.riferita = 'cliente' then
      execute format('select count(*) from %s where %I = any ($1)', fk.tabella, fk.colonna) into n using togli;
    else
      execute format('select count(*) from %s where %I in (select s.id from public.sede s where s.cliente_id = any ($1))', fk.tabella, fk.colonna) into n using togli;
    end if;
    if n > 0 then raise notice 'collegati a un cliente da togliere: %.% = %', fk.tabella, fk.colonna, n; totale := totale + n; end if;
  end loop;
  select count(*) into n from public.azione a
   where a.origine_requisito_key = any (array(select 'cliente-ateco:' || x::text from unnest(togli) as x));
  if n > 0 then raise notice 'azioni cliente-ateco su un cliente da togliere: %', n; totale := totale + n; end if;

  if totale > 0 then
    raise exception 'Ai clienti da togliere e'' collegato qualcosa (% righe, vedi le notice). Niente e'' stato scritto.', totale;
  end if;

  -- 2. COPIA, POI VIA, POI I VUOTI ---------------------------------------------
  drop table if exists pg_temp.copia_cinque_piva;
  create temp table copia_cinque_piva as select * from public.cliente where id = any (togli);
  select count(*) into n from pg_temp.copia_cinque_piva;
  if n <> 5 then raise exception 'Copia dei clienti da togliere: % righe invece di 5. Annullato.', n; end if;

  delete from public.cliente where id = any (togli);
  get diagnostics n = row_count;
  if n <> 5 then raise exception 'Rimozione dei clienti: toccate % righe invece di 5. Annullato.', n; end if;

  for i in 1 .. array_length(tieni, 1) loop
    for col in
      select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'cliente'
         and column_name not in ('id', 'created_at', 'updated_at')
         and is_generated = 'NEVER' and is_updatable = 'YES'
    loop
      execute format(
        'update public.cliente k set %1$I = d.%1$I from pg_temp.copia_cinque_piva d where k.id = $1 and d.id = $2 and k.%1$I is null and d.%1$I is not null',
        col.column_name) using tieni[i], togli[i];
    end loop;
  end loop;
  drop table pg_temp.copia_cinque_piva;

  -- 3. DOPO AVER SCRITTO, rispetto a prima -------------------------------------
  select count(*) into n from public.cliente;
  if n <> clienti_prima - 5 then raise exception 'Attesi % clienti, trovati %. Annullato.', clienti_prima - 5, n; end if;
  select count(*) into n from public.cliente where id = any (togli);
  if n <> 0 then raise exception 'Restano % clienti che dovevano essere tolti. Annullato.', n; end if;
  select count(*) into n from public.sede where cliente_id = any (togli);
  if n <> 0 then raise exception 'Restano % sedi dei clienti tolti. Annullato.', n; end if;
  select count(*) into n from public.cliente where id = any (tieni);
  if n <> 5 then raise exception 'Attesi 5 clienti tenuti, trovati %. Annullato.', n; end if;
  select count(*) into n from public.persona where cliente_id = any (tieni);
  if n <> persone_tenuti_prima then raise exception 'Le persone dei clienti tenuti erano %, sono %. Annullato.', persone_tenuti_prima, n; end if;

  raise notice 'Controllo superato: 5 clienti tolti, 5 tenuti con i vuoti riempiti, persone intatte.';
end $$;

-- VERIFICA, in sola lettura. Attese 5 righe, una per P.IVA, e nessun cliente tolto:
--   LINDE MATERIAL HANDLING ITALIA SPA   Via del Luguzzone 3   0 persone
--   CENTRO ATTIVITA' ...                 Via Fratelli Corra' 7 21 persone
--   CENTRO SOCIALIZZAZIONE ...           Via Cantore 6         26 persone
--   MARANI G. SPA                        Via dell'Artigianato  0 persone
--   AZ. AGR. PARAVANTO DI ALBERTO ...    Via Saraina           0 persone
select c.partita_iva, c.ragione_sociale, c.indirizzo, c.cap, c.localita,
       (select count(*) from public.persona p where p.cliente_id = c.id) as persone
  from public.cliente c
 where c.partita_iva in ('00199400128', '00967010232', '01249140235', '02449980230', '04312380233')
 order by c.partita_iva;
