-- unisci_clienti_doppi.sql - NON e' una migration. Si lancia a mano
-- dall'SQL Editor, una volta sola. Rilanciarlo dopo e' innocuo: i controlli
-- iniziali non trovano piu' i clienti da togliere e annullano senza scrivere.
--
-- COSA FA. Decisioni di Francesco del 14 settembre 2026 (docs/STATO.md):
--   - quattro coppie di clienti doppi, creati dall'import del 9.09, diventano
--     un cliente solo. Si tiene un cliente per coppia e gli si riempiono i campi
--     VUOTI con quelli dell'altro, che poi si toglie:
--       GIARDINAGGIO ADAMI  tiene 98a9bfd3, toglie d448dcab (identici)
--       LA TORRE            tiene 49400eec ("Via Trezzolano, 4", come nel file),
--                           toglie 0654ea7c
--       EMERA               tiene 241c7505 (ha l'indirizzo), prende la P.IVA
--                           da cd4885cc e lo toglie
--       IL MAGNIFICO        tiene a4d2fa39 ("IL MAGNIFICO S.R.L.", lo stesso nome
--                           del file persone), prende l'indirizzo di Largo
--                           Pescheria Vecchia 10 da aceced43 e lo toglie
--   - il cliente fittizio "XXXXXXXXXXXX" (5ff86755) si toglie.
--   - IGEA NON si tocca: Via Sorte 48 e Via Michelangelo 7 sono due sedi vere.
--
-- PERCHE' SI PUO' TOGLIERE. Misurato in sola lettura il 14.09: ai clienti da
-- togliere non e' collegato niente, tranne la loro sede vuota. Zero righe sulle
-- 14 chiavi esterne verso cliente e sede, zero riferimenti in 190 colonne di
-- testo, JSON o uuid senza vincolo, zero azioni "cliente-ateco:".
--
-- IL CONTROLLO ANNULLA, NON AVVISA. Prima di scrivere lo script rifa' la misura:
-- se a un cliente da togliere, o alla sua sede, punta qualcosa, solleva un errore
-- e la transazione non scrive niente. Dopo aver scritto, controlla che il
-- risultato sia quello atteso, e se non lo e' annulla tutto.
--
-- ASCII-only.

begin;

create temp table _coppie (tieni uuid primary key, togli uuid not null unique, nome text not null) on commit drop;
insert into _coppie values
  ('98a9bfd3-398d-43cb-8640-69dcc95e8d04', 'd448dcab-47f8-48c2-ae5b-22b8f8bbeae4', 'GIARDINAGGIO ADAMI'),
  ('49400eec-4a1f-40cd-a7bc-b01c34ac8796', '0654ea7c-517f-4194-ac57-59f325f48bbe', 'LA TORRE'),
  ('241c7505-38a1-4414-9b04-e99cf0f290bf', 'cd4885cc-0ed1-4bf7-b1e2-2f46b67f7366', 'EMERA'),
  ('a4d2fa39-f2b3-4391-acb8-c32173629faf', 'aceced43-b1d4-44dc-8f8e-b16d3344a109', 'IL MAGNIFICO');

create temp table _togli (id uuid primary key) on commit drop;
insert into _togli select togli from _coppie;
insert into _togli values ('5ff86755-56f4-453f-af4b-2c28c1b2535f');   -- XXXXXXXXXXXX

create temp table _prima on commit drop as select count(*) as clienti from public.cliente;

-- 1. PRIMA DI SCRIVERE: che i clienti ci siano, e che niente punti a quelli da togliere.
do $$
declare
  n bigint;
  fk record;
  totale bigint := 0;
begin
  select count(*) into n from public.cliente where id in (select tieni from _coppie);
  if n <> 4 then raise exception 'Attesi 4 clienti da tenere, trovati %. Niente e'' stato scritto.', n; end if;
  select count(*) into n from public.cliente where id in (select id from _togli);
  if n <> 5 then raise exception 'Attesi 5 clienti da togliere, trovati %. Niente e'' stato scritto.', n; end if;

  -- Ogni chiave esterna verso cliente o sede, presa dal catalogo al momento del lancio.
  for fk in
    select c.conrelid::regclass::text as tabella, a.attname as colonna, c.confrelid::regclass::text as riferita
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f'
       and c.confrelid in ('public.cliente'::regclass, 'public.sede'::regclass)
  loop
    if fk.tabella = 'sede' and fk.colonna = 'cliente_id' then
      continue;   -- la sede vuota se ne va con il suo cliente
    end if;
    if fk.riferita = 'cliente' then
      execute format('select count(*) from %s where %I in (select id from _togli)', fk.tabella, fk.colonna) into n;
    else
      execute format('select count(*) from %s where %I in (select s.id from public.sede s where s.cliente_id in (select id from _togli))', fk.tabella, fk.colonna) into n;
    end if;
    if n > 0 then
      raise notice 'collegati a un cliente da togliere: %.% = %', fk.tabella, fk.colonna, n;
      totale := totale + n;
    end if;
  end loop;

  select count(*) into n from public.azione a
   where exists (select 1 from _togli t where a.origine_requisito_key = 'cliente-ateco:' || t.id::text);
  if n > 0 then
    raise notice 'azioni cliente-ateco su un cliente da togliere: %', n;
    totale := totale + n;
  end if;

  if totale > 0 then
    raise exception 'Ai clienti da togliere e'' collegato qualcosa (% righe, vedi le notice). Niente e'' stato scritto.', totale;
  end if;
end $$;

-- 2. Si copiano i clienti da togliere, e SOLO DOPO si tolgono. Le loro sedi
--    vuote seguono per cascata.
--    L'ordine conta: riempire il cliente tenuto mentre l'altro esiste ancora fa
--    scattare i vincoli di unicita' (werp_id oggi, uno aggiunto domani), perche'
--    per un momento lo stesso valore starebbe su due righe. Provato da
--    AppOverall su un cluster usa e getta (bdb685b, caso F).
create temp table _copia on commit drop as
  select * from public.cliente where id in (select togli from _coppie);

delete from public.cliente where id in (select id from _togli);

-- 3. I CAMPI VUOTI del cliente che si tiene si riempiono dalla copia dell'altro.
--    Solo i vuoti: niente di quello che c'e' gia' viene sovrascritto.
do $$
declare
  r record;
  col record;
begin
  for r in select * from _coppie loop
    for col in
      select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'cliente'
         and column_name not in ('id', 'created_at', 'updated_at')
         and is_generated = 'NEVER' and is_updatable = 'YES'
    loop
      execute format(
        'update public.cliente k set %1$I = d.%1$I from _copia d where k.id = $1 and d.id = $2 and k.%1$I is null and d.%1$I is not null',
        col.column_name) using r.tieni, r.togli;
    end loop;
  end loop;
end $$;

-- 4. DOPO AVER SCRITTO: il risultato deve essere quello atteso, altrimenti si annulla.
do $$
declare
  n bigint;
  prima bigint;
begin
  select clienti into prima from _prima;
  select count(*) into n from public.cliente;
  if n <> prima - 5 then raise exception 'Attesi % clienti dopo la pulizia, trovati %. Annullato.', prima - 5, n; end if;

  select count(*) into n from public.cliente where id in (select id from _togli);
  if n <> 0 then raise exception 'Restano % clienti che dovevano essere tolti. Annullato.', n; end if;

  select count(*) into n from public.sede where cliente_id in (select id from _togli);
  if n <> 0 then raise exception 'Restano % sedi dei clienti tolti. Annullato.', n; end if;

  select count(*) into n from public.cliente where id in (select tieni from _coppie);
  if n <> 4 then raise exception 'Attesi 4 clienti tenuti, trovati %. Annullato.', n; end if;

  -- IGEA non si tocca: i due clienti (Via Sorte 48 e Via Michelangelo 7) ci sono ancora.
  select count(*) into n from public.cliente
   where id in ('3f485f16-bdf6-4106-8caa-0361e1889a80', 'def8645c-3ac9-48de-80ec-65d7ee44a87e');
  if n <> 2 then raise exception 'Attesi i 2 clienti IGEA intatti, trovati %. Annullato.', n; end if;

  select count(*) into n from public.cliente
   where id = '241c7505-38a1-4414-9b04-e99cf0f290bf' and partita_iva = '09318332023';
  if n <> 1 then raise exception 'EMERA non ha preso la P.IVA 09318332023. Annullato.'; end if;

  select count(*) into n from public.cliente
   where id = 'a4d2fa39-f2b3-4391-acb8-c32173629faf' and indirizzo is not null and localita = 'Verona';
  if n <> 1 then raise exception 'IL MAGNIFICO non ha preso l''indirizzo di Largo Pescheria Vecchia. Annullato.'; end if;

  raise notice 'Controllo superato: 4 coppie unite, 5 clienti tolti, IGEA intatta.';
end $$;

commit;
