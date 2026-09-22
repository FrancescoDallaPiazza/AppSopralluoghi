-- cancella_verdepositivo.sql - NON e' una migration.
-- Si lancia a mano dall'SQL Editor di Supabase, una volta sola.
--
-- INCOLLA E LANCIA TUTTO IL FILE INSIEME, dalla prima riga
-- all'ultima. Lanciarne un pezzo solo non funziona: i conteggi
-- stanno in tabelle temporanee che servono alla cancellazione.
--
-- COSA FA. Decisione di Francesco del 22 settembre 2026:
-- VERDEPOSITIVO SRL e' fallita, la riga si cancella. L'assegnazione
-- precedente ("completarla" con indirizzo, ATECO e livelli) decade.
-- La riga e' nata il 17 settembre da uno script di AppOverall, nel
-- database di produzione, con ragione sociale e P.IVA soltanto.
--
--   1. trova la riga (deve essere UNA sola, altrimenti si ferma
--      subito senza scrivere niente);
--   2. conta tutto quello che le pende dietro, seguendo le chiavi
--      esterne dal catalogo (pg_constraint), a qualunque profondita'
--      - non un elenco di tabelle scritto a memoria, cosi' non ne
--      scappa una quando lo schema cambia;
--   3. guarda anche le colonne SENZA vincolo (uuid, testo, json)
--      che contengono quell'id: sono quelle che una cancellazione
--      non blocca e non pulisce, e restano orfane;
--   4. stampa i conteggi, uno per tabella, anche quando sono zero;
--   5. cancella SOLO se sono tutti zero. Se qualcosa pende, non
--      cancella: lascia la riga dov'e' e te lo dice.
--
-- PERCHE' LA CANCELLAZIONE NON E' CONDIZIONATA A UN "raise
-- exception". Un errore annulla la transazione e si porta via anche
-- il referto: vedresti l'errore e non i conteggi. Qui il "delete" ha
-- la condizione dentro: se qualcosa pende, cancella zero righe, e
-- il referto finale resta a schermo con scritto cosa ha trovato.
--
-- LA SEDE NON BLOCCA, ed e' una scelta: un cliente nato da un import
-- ha una sede vuota creata insieme a lui, e la sede sparisce in
-- cascata con lui (029: "on delete cascade"). Se dalla sede pende
-- qualcosa - un sopralluogo, un componente - quel qualcosa viene
-- contato e blocca lui. Per far bloccare anche la sede vuota,
-- togli la riga marcata "SEDE" piu' sotto.
--
-- NEANCHE LE PERSONE BLOCCANO PIU', e questa e' la decisione di
-- Francesco del 22.09.2026, presa DOPO aver letto il referto del
-- primo lancio: 4 righe in "persona", anagrafiche nude - formazione,
-- nomina, esonero, azione e adempimento tutti a zero dietro di loro.
-- Se ne vanno in cascata col cliente (015). Sono dati di persone
-- vere e il piano Supabase e' free: se ci si ripensa, si torna
-- indietro PRIMA di lanciare, vedi il commento "PERSONE" sotto.
--
-- SE QUALCOSA PENDE, l'alternativa e' in fondo, commentata:
-- marcarla non attiva invece di cancellarla. Un cliente che chiude
-- ha una storia - attestati, nomine - che un ispettore puo' chiedere
-- anche dopo il fallimento.
--
-- ASCII-only. Righe corte.

-- Le temporanee sopravvivono al commit: si ripulisce prima, cosi'
-- rilanciare il file nella stessa sessione non da' errore.
drop table if exists _bersaglio;
drop table if exists _fk;
drop table if exists _tabelle;
drop table if exists _visto;
drop table if exists _conta;
drop table if exists _sciolte;
drop table if exists _esito;

begin;

-- ------------------------------------------------------------------
-- 1. La riga da cancellare.
-- ------------------------------------------------------------------
create temp table _bersaglio as
select id, ragione_sociale, partita_iva, created_at
from public.cliente
where ragione_sociale ilike '%VERDEPOSITIVO%';

do $$
declare v_n int;
begin
  select count(*) into v_n from _bersaglio;
  if v_n = 0 then
    raise exception
      'Nessun cliente con VERDEPOSITIVO nella ragione sociale: non ho cancellato niente.';
  end if;
  if v_n > 1 then
    raise exception
      'Trovati % clienti con VERDEPOSITIVO: ambiguo, non cancello niente.', v_n;
  end if;
end $$;

-- ------------------------------------------------------------------
-- 2. Le chiavi esterne, dal catalogo.
-- ------------------------------------------------------------------
-- Il "collate" non e' un vezzo: i nomi presi dal catalogo sono di
-- tipo "name", che ha collazione "C". Senza questo, la ricorsione
-- qui sotto rifiuta di partire (42P21) e i confronti con _visto
-- litigano sulla collazione.
create temp table _fk as
select
  con.conname::text                       as nome,
  ((nf.nspname || '.' || cf.relname)::text collate "default") as figlio,
  ((np.nspname || '.' || cp.relname)::text collate "default") as padre,
  (af.attname::text collate "default")     as col_figlio,
  (ap.attname::text collate "default")      as col_padre,
  array_length(con.conkey, 1)             as n_col
from pg_constraint con
join pg_class     cf on cf.oid = con.conrelid
join pg_namespace nf on nf.oid = cf.relnamespace
join pg_class     cp on cp.oid = con.confrelid
join pg_namespace np on np.oid = cp.relnamespace
join pg_attribute af on af.attrelid = con.conrelid
                    and af.attnum = con.conkey[1]
join pg_attribute ap on ap.attrelid = con.confrelid
                    and ap.attnum = con.confkey[1]
where con.contype = 'f'
  and nf.nspname = 'public'
  and np.nspname = 'public';

-- Tutte le tabelle che, direttamente o per interposta tabella,
-- possono appendersi a un cliente. Servono per stampare gli zeri.
create temp table _tabelle as
with recursive g(t) as (
  select 'public.cliente'::text
  union
  select f.figlio from _fk f join g on f.padre = g.t
)
select t as tabella from g where t <> 'public.cliente';

-- ------------------------------------------------------------------
-- 3. Le righe che pendono davvero da QUESTO cliente.
-- ------------------------------------------------------------------
create temp table _visto (
  tabella text not null,
  id      uuid not null,
  primary key (tabella, id)
);
insert into _visto select 'public.cliente', id from _bersaglio;

do $$
declare
  r      record;
  v_pk   text;
  v_tipo text;
  v_n    bigint;
  v_tot  bigint;
  v_giro int := 0;
begin
  loop
    v_giro := v_giro + 1;
    if v_giro > 30 then
      raise exception 'Le chiavi esterne girano in tondo: fermato al giro %.', v_giro;
    end if;
    v_tot := 0;
    for r in
      select * from _fk
      where padre in (select distinct tabella from _visto)
    loop
      if r.n_col > 1 then
        raise exception
          'La chiave esterna % su % ha piu'' di una colonna: non la so seguire, fermato.',
          r.nome, r.figlio;
      end if;

      -- la chiave esterna deve puntare alla chiave primaria del
      -- padre, altrimenti gli id in _visto non sono confrontabili
      if not exists (
        select 1
        from pg_constraint pk
        join pg_attribute a on a.attrelid = pk.conrelid
                           and a.attnum = pk.conkey[1]
        where pk.contype = 'p'
          and pk.conrelid = r.padre::regclass
          and array_length(pk.conkey, 1) = 1
          and a.attname = r.col_padre
      ) then
        raise exception
          'La chiave esterna % non punta alla chiave primaria di %: fermato.',
          r.nome, r.padre;
      end if;

      select a.attname, t.typname into v_pk, v_tipo
      from pg_constraint pk
      join pg_attribute a on a.attrelid = pk.conrelid
                         and a.attnum = pk.conkey[1]
      join pg_type t on t.oid = a.atttypid
      where pk.contype = 'p'
        and pk.conrelid = r.figlio::regclass
        and array_length(pk.conkey, 1) = 1;

      if v_pk is null then
        raise exception
          'La tabella % non ha una chiave primaria a una colonna sola: fermato.',
          r.figlio;
      end if;
      if v_tipo <> 'uuid' then
        raise exception
          'La chiave primaria di % non e'' uuid ma %: fermato.', r.figlio, v_tipo;
      end if;

      execute format(
        'insert into _visto(tabella, id) select %L, f.%I from %s f '
        'join _visto v on v.tabella = %L and v.id = f.%I '
        'on conflict do nothing',
        r.figlio, v_pk, r.figlio, r.padre, r.col_figlio);
      get diagnostics v_n = row_count;
      v_tot := v_tot + v_n;
    end loop;
    exit when v_tot = 0;
  end loop;
end $$;

create temp table _conta as
select t.tabella,
       coalesce((select count(*) from _visto v
                 where v.tabella = t.tabella), 0) as righe
from _tabelle t;

-- ------------------------------------------------------------------
-- 4. Le colonne senza vincolo che contengono quell'id.
--    Una cancellazione non le blocca e non le pulisce: restano
--    orfane in silenzio (es. "azione.origine_requisito_key",
--    migrazione 056). Quindi qui bloccano.
-- ------------------------------------------------------------------
create temp table _sciolte (
  tabella text,
  colonna text,
  righe   bigint
);

do $$
declare
  r      record;
  v_id   uuid;
  v_n    bigint;
  v_dove text;
begin
  select id into v_id from _bersaglio;
  for r in
    select (n.nspname || '.' || c.relname)::text as tabella,
           a.attname::text                       as colonna,
           t.typname::text                       as tipo
    from pg_attribute a
    join pg_class     c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type      t on t.oid = a.atttypid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attnum > 0
      and not a.attisdropped
      and t.typname in ('uuid', 'text', 'varchar', 'json', 'jsonb')
      and not exists (
        select 1 from pg_constraint con
        where con.contype = 'f'
          and con.conrelid = c.oid
          and a.attnum = any (con.conkey))
  loop
    -- la riga del cliente contiene il proprio id: non e' un pendente
    v_dove := '';
    if r.tabella = 'public.cliente' then
      v_dove := ' and t.id <> ' || quote_literal(v_id::text) || '::uuid';
    end if;

    if r.tipo = 'uuid' then
      execute format('select count(*) from %s t where t.%I = %L::uuid%s',
                     r.tabella, r.colonna, v_id, v_dove) into v_n;
    else
      execute format('select count(*) from %s t where t.%I::text like %L%s',
                     r.tabella, r.colonna,
                     '%' || v_id::text || '%', v_dove) into v_n;
    end if;

    if v_n > 0 then
      insert into _sciolte values (r.tabella, r.colonna, v_n);
    end if;
  end loop;
end $$;

-- Ripiego, se il referto finale non arrivasse a schermo.
do $$
declare r record;
begin
  for r in select * from _conta order by tabella loop
    raise notice 'pendenti % : %', r.tabella, r.righe;
  end loop;
  for r in select * from _sciolte order by tabella, colonna loop
    raise notice 'colonna sciolta %.% : %', r.tabella, r.colonna, r.righe;
  end loop;
end $$;

-- ------------------------------------------------------------------
-- 5. La cancellazione, con la condizione dentro.
-- ------------------------------------------------------------------
create temp table _esito (voce text, valore text);
insert into _esito
  values ('clienti prima', (select count(*)::text from public.cliente));

delete from public.cliente
where id = (select id from _bersaglio)
  and not exists (
    select 1 from _conta
    where righe > 0
      and tabella not in ('public.sede', 'public.persona')
  )
  and not exists (
    select 1 from _sciolte
    where righe > 0
      and tabella not in ('public.sede', 'public.persona')
  );
-- PERSONE. Al primo lancio, il 22.09.2026, le 4 persone di
-- VERDEPOSITIVO hanno bloccato. Francesco ha deciso di farle passare
-- in cascata, e questo e' il cambio, rispetto a quel lancio:
--   - nella prima condizione, al posto di
--       and tabella <> 'public.sede'
--     va
--       and tabella not in ('public.sede', 'public.persona')
--   - nella riga qui sopra, al posto di
--       where righe > 0
--     va
--       where righe > 0
--         and tabella not in ('public.sede', 'public.persona')
-- Vanno cambiate tutte e due: la seconda regge le colonne senza
-- vincolo, e "persona.import_key" contiene l'id del cliente, quindi
-- da sola fermerebbe lo script lo stesso.

insert into _esito
  values ('clienti dopo', (select count(*)::text from public.cliente));
insert into _esito
  values ('esito',
    case when exists (select 1 from public.cliente c
                      join _bersaglio b on b.id = c.id)
         then 'NON CANCELLATA: qualcosa pende, guarda i conteggi'
         else 'CANCELLATA' end);

commit;

-- ------------------------------------------------------------------
-- 6. Il referto. E' l'ultima cosa che gira: quello che vedi a
--    schermo e' questo.
-- ------------------------------------------------------------------
select *
from (
  select 1 as ord, 'BERSAGLIO' as sezione,
         ragione_sociale as dettaglio,
         id::text as riferimento,
         null::text as righe
  from _bersaglio
  union all
  select 2, 'PENDENTI (chiavi esterne)', tabella, '', righe::text
  from _conta
  union all
  select 3, 'PENDENTI (colonne senza vincolo)', tabella, colonna,
         righe::text
  from _sciolte
  union all
  select 4, 'ESITO', voce, '', valore
  from _esito
) x
order by ord, dettaglio, riferimento;

-- ------------------------------------------------------------------
-- VERIFICA, in sola lettura, da lanciare DOPO e da sola.
-- Fa fede questa, non la notice e non il messaggio di errore.
--
--   select count(*) as verdepositivo_rimaste
--   from public.cliente
--   where ragione_sociale ilike '%VERDEPOSITIVO%';
--   -- atteso 0 se il referto dice CANCELLATA, 1 se dice NON CANCELLATA
--
--   select count(*) as clienti from public.cliente;
--   -- atteso: il "clienti prima" del referto meno 1 se CANCELLATA,
--   --         uguale a "clienti prima" se NON CANCELLATA
--
-- ------------------------------------------------------------------
-- ALTERNATIVA, se qualcosa pende: non cancellare, marcarla non
-- attiva. La storia resta consultabile, il cliente sparisce dagli
-- elenchi (la colonna "attivo" c'e' dalla 001). Da lanciare al posto
-- di tutto il resto, non insieme:
--
--   update public.cliente
--   set attivo = false
--   where ragione_sociale ilike '%VERDEPOSITIVO%';
--
--   -- verifica, dopo:
--   select attivo, count(*) from public.cliente
--   where ragione_sociale ilike '%VERDEPOSITIVO%'
--   group by attivo;
--   -- atteso: una riga, attivo = false, count 1
