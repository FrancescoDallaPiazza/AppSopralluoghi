-- correggi_maison22_giacomelli.sql - NON e' una migration.
--
-- ============================================================================
--  COME SI LANCIA: incollare TUTTO il file nell'SQL Editor e premere Run una
--  volta sola. Non selezionarne una parte. Poi guardare il risultato della
--  query di verifica in fondo: e' quella, non il messaggio, a dire se e' fatto.
-- ============================================================================
--
-- Decisioni di Francesco del 14 settembre 2026 (docs/STATO.md).
--
-- 1. MAISON 22 S.R.L. NON e' un doppione: sono due sedi. "Corso Porta Borsari,
--    26, 37121 Verona VR in cui ci sono 4 risorse e Via IV Novembre, 1d, 37126
--    Verona VR con 17". In produzione i due clienti hanno lo stesso indirizzo e
--    tutte e 21 le persone stanno su cc7d7e47. Qui:
--      - f105801a e la sua sede legale prendono Corso Porta Borsari, 26, 37121;
--      - le 4 persone di Porta Borsari, indicate da Francesco (SACCA' ALESSANDRA,
--        PASINATO GIULIA, SGANZERLA MAIRA, SILVA LASITH GIMHAN), passano da
--        cc7d7e47 a f105801a, con la sede e la chiave d'import del nuovo cliente:
--        senza la chiave nuova il prossimo import le ricreerebbe;
--      - CIO' CHE SEGUE LE PERSONE: ogni riga che punta a una delle 4 E al vecchio
--        cliente o a una sua sede (per esempio le visite in `adempimento`) passa
--        al cliente e alla sede nuovi. Le tabelle si prendono dal catalogo al
--        momento del lancio; lo stesso per le azioni che portano la chiave della
--        persona nel testo. Difetto trovato da AppOverall provando la versione
--        f2132a2 (ccace2e, caso 7).
--    ATTENZIONE PER GLI IMPORT: il gestionale esporta le due sedi con lo stesso
--    nome e la stessa sede ("Verona"). Nell'anteprima dell'import delle
--    anagrafiche E della formazione il gruppo MAISON 22 va ESCLUSO, non abbinato
--    a mano. Si chiude solo correggendo la sede nel gestionale.
--
-- 2. "AZIENDA AGRICOLA GIACOMELLI FRANCESCO" (5d6187bd) e' la stessa azienda di
--    "AZ. AGR. GIACOMELLI FRANCESCO" (ee206d24), e porta la P.IVA e il codice
--    fiscale di Aprili Graziano. Si toglie. P.IVA e CF veri della Giacomelli li
--    corregge Francesco dalla scheda cliente: il CF e' di una persona e non si
--    scrive in un file del repository.
--
-- 3. AMARI UMBERTO e GIACOMELLI FRANCESCO NON lavorano per Aprili (0082323b):
--    le loro schede li', create dall'import del 9.09, si tolgono. NEGRETTI LUCA
--    lavora per Aprili e resta.
--
-- IL CONTROLLO ANNULLA. Un blocco solo. Prima di scrivere si verifica che ogni
-- riga sia quella attesa e che niente punti a quello che si toglie. Ogni
-- scrittura controlla quante righe tocca. Dopo, si verificano i conteggi
-- rispetto a prima e che niente delle persone spostate sia rimasto sul vecchio
-- cliente. Se un controllo fallisce, errore e niente scritto. Rilanciarlo e'
-- innocuo: i controlli iniziali non trovano piu' le righe attese e annullano.
--
-- ASCII-only.

do $$
declare
  maison_17   constant uuid := 'cc7d7e47-3a02-49cc-a0f7-9f614e4a4ce9';
  maison_4    constant uuid := 'f105801a-9817-4719-b57d-f3d392625a8e';
  giac_falso  constant uuid := '5d6187bd-20ac-43dc-8621-d46f1f263c7d';
  giac_vero   constant uuid := 'ee206d24-4496-41a4-92a4-4241c9aef921';
  aprili      constant uuid := '0082323b-88a6-4c4e-9a16-d16eb7b97e45';
  sede_nuova  uuid;
  sedi_vecchie uuid[];
  da_spostare uuid[];
  da_togliere uuid[];
  n bigint;
  attesi bigint;
  totale bigint := 0;
  clienti_prima bigint;
  persone_prima bigint;
  maison17_prima bigint;
  aprili_prima bigint;
  fk record;
  col record;
begin
  select count(*) into clienti_prima from public.cliente;
  select count(*) into persone_prima from public.persona;
  select count(*) into maison17_prima from public.persona where cliente_id = maison_17;
  select count(*) into aprili_prima from public.persona where cliente_id = aprili;
  select coalesce(array_agg(id), '{}') into sedi_vecchie from public.sede where cliente_id = maison_17;

  -- 1. PRIMA DI SCRIVERE -----------------------------------------------------
  select count(*) into n from public.cliente
   where id in (maison_17, maison_4) and upper(trim(ragione_sociale)) = 'MAISON 22 S.R.L.';
  if n <> 2 then raise exception 'Attesi i 2 clienti MAISON 22, trovati %. Niente e'' stato scritto.', n; end if;

  select count(*) into n from public.persona where cliente_id = maison_4;
  if n <> 0 then raise exception 'Il cliente MAISON 22 di Porta Borsari doveva essere vuoto, ha % persone. Niente e'' stato scritto.', n; end if;

  select count(*) into n from public.cliente
   where id = maison_4 and upper(coalesce(indirizzo, '')) like 'VIA QUATTRO NOVEMBRE%';
  if n <> 1 then raise exception 'Il cliente MAISON 22 da correggere non ha piu'' l''indirizzo di Via Quattro Novembre. Niente e'' stato scritto.'; end if;

  select id into sede_nuova from public.sede where cliente_id = maison_4 and principale;
  if sede_nuova is null then raise exception 'Il cliente MAISON 22 di Porta Borsari non ha una sede legale. Niente e'' stato scritto.'; end if;

  select array_agg(id) into da_spostare from public.persona
   where cliente_id = maison_17
     and (upper(trim(cognome)), upper(trim(nome))) in
         (('SACCA''', 'ALESSANDRA'), ('PASINATO', 'GIULIA'), ('SGANZERLA', 'MAIRA'), ('SILVA', 'LASITH GIMHAN'));
  if coalesce(array_length(da_spostare, 1), 0) <> 4 then
    raise exception 'Attese 4 persone MAISON 22 da spostare, trovate %. Niente e'' stato scritto.', coalesce(array_length(da_spostare, 1), 0);
  end if;

  select count(*) into n from public.persona p
   where p.id = any (da_spostare) and p.import_key is not null
     and exists (select 1 from public.persona q
                  where q.import_key = replace(p.import_key, 'anag:' || maison_17::text || ':', 'anag:' || maison_4::text || ':'));
  if n <> 0 then raise exception 'La chiave d''import nuova esiste gia'' per % persone. Niente e'' stato scritto.', n; end if;

  select count(*) into n from public.cliente
   where id = giac_falso and upper(trim(ragione_sociale)) = 'AZIENDA AGRICOLA GIACOMELLI FRANCESCO' and partita_iva = '00912140233';
  if n <> 1 then raise exception 'Il cliente AZIENDA AGRICOLA GIACOMELLI FRANCESCO da togliere non e'' quello atteso. Niente e'' stato scritto.'; end if;

  select count(*) into n from public.cliente where id in (giac_vero, aprili);
  if n <> 2 then raise exception 'Attesi AZ. AGR. GIACOMELLI FRANCESCO e Aprili, trovati %. Niente e'' stato scritto.', n; end if;

  select array_agg(id) into da_togliere from public.persona
   where cliente_id = aprili
     and (upper(trim(cognome)), upper(trim(nome))) in (('AMARI', 'UMBERTO'), ('GIACOMELLI', 'FRANCESCO'));
  if coalesce(array_length(da_togliere, 1), 0) <> 2 then
    raise exception 'Attese 2 schede da togliere sotto Aprili, trovate %. Niente e'' stato scritto.', coalesce(array_length(da_togliere, 1), 0);
  end if;

  -- Niente deve puntare alle 2 schede da togliere.
  for fk in
    select c.conrelid::regclass::text as tabella, a.attname as colonna
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f' and c.confrelid = 'public.persona'::regclass
  loop
    execute format('select count(*) from %s where %I = any ($1)', fk.tabella, fk.colonna) into n using da_togliere;
    if n > 0 then raise notice 'collegati alle schede da togliere: %.% = %', fk.tabella, fk.colonna, n; totale := totale + n; end if;
  end loop;
  select count(*) into n from public.azione a
   where exists (select 1 from unnest(da_togliere) as x where a.origine_requisito_key like x::text || ':%');
  if n > 0 then raise notice 'azioni con la chiave di una scheda da togliere: %', n; totale := totale + n; end if;

  -- Niente deve puntare al cliente da togliere o alla sua sede.
  for fk in
    select c.conrelid::regclass::text as tabella, a.attname as colonna, c.confrelid::regclass::text as riferita
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f' and c.confrelid in ('public.cliente'::regclass, 'public.sede'::regclass)
  loop
    if fk.tabella = 'sede' and fk.colonna = 'cliente_id' then continue; end if;
    if fk.riferita = 'cliente' then
      execute format('select count(*) from %s where %I = $1', fk.tabella, fk.colonna) into n using giac_falso;
    else
      execute format('select count(*) from %s where %I in (select s.id from public.sede s where s.cliente_id = $1)', fk.tabella, fk.colonna) into n using giac_falso;
    end if;
    if n > 0 then raise notice 'collegati al cliente da togliere: %.% = %', fk.tabella, fk.colonna, n; totale := totale + n; end if;
  end loop;
  select count(*) into n from public.azione where origine_requisito_key = 'cliente-ateco:' || giac_falso::text;
  if n > 0 then raise notice 'azioni cliente-ateco sul cliente da togliere: %', n; totale := totale + n; end if;

  if totale > 0 then
    raise exception 'A qualcosa da togliere e'' collegato qualcosa (% righe, vedi le notice). Niente e'' stato scritto.', totale;
  end if;

  -- 2. LE SCRITTURE, ognuna con il conto delle righe toccate -------------------
  update public.cliente
     set indirizzo = 'Corso Porta Borsari, 26', cap = '37121', localita = 'VERONA'
   where id = maison_4;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Aggiornamento del cliente MAISON 22: toccate % righe invece di 1. Annullato.', n; end if;

  update public.sede
     set indirizzo = 'Corso Porta Borsari, 26', cap = '37121', localita = 'VERONA'
   where id = sede_nuova;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Aggiornamento della sede MAISON 22: toccate % righe invece di 1. Annullato.', n; end if;

  update public.persona
     set cliente_id = maison_4,
         sede_id = sede_nuova,
         import_key = case when import_key like 'anag:' || maison_17::text || ':%'
                           then replace(import_key, 'anag:' || maison_17::text || ':', 'anag:' || maison_4::text || ':')
                           else import_key end
   where id = any (da_spostare) and cliente_id = maison_17;
  get diagnostics n = row_count;
  if n <> 4 then raise exception 'Spostamento delle persone MAISON 22: toccate % righe invece di 4. Annullato.', n; end if;

  -- 2b. CIO' CHE SEGUE LE 4 PERSONE. Ogni tabella (diversa da persona) che ha una
  --     chiave esterna verso persona E una verso cliente o sede, dal catalogo:
  --     le righe delle 4 che puntano al vecchio cliente o a una sua sede passano
  --     al cliente e alla sede nuovi. Il numero toccato deve essere quello contato.
  for fk in
    select distinct pc.conrelid::regclass::text as tabella, pa.attname as col_persona
      from pg_constraint pc
      join pg_attribute pa on pa.attrelid = pc.conrelid and pa.attnum = any (pc.conkey)
     where pc.contype = 'f' and pc.confrelid = 'public.persona'::regclass
       and pc.conrelid <> 'public.persona'::regclass
       and exists (select 1 from pg_constraint oc
                    where oc.contype = 'f' and oc.conrelid = pc.conrelid
                      and oc.confrelid in ('public.cliente'::regclass, 'public.sede'::regclass))
  loop
    for col in
      select oa.attname as colonna, oc.confrelid::regclass::text as riferita
        from pg_constraint oc
        join pg_attribute oa on oa.attrelid = oc.conrelid and oa.attnum = any (oc.conkey)
       where oc.contype = 'f' and oc.conrelid = fk.tabella::regclass
         and oc.confrelid in ('public.cliente'::regclass, 'public.sede'::regclass)
    loop
      if col.riferita = 'cliente' then
        execute format('select count(*) from %s where %I = any ($1) and %I = $2', fk.tabella, fk.col_persona, col.colonna)
           into attesi using da_spostare, maison_17;
        if attesi > 0 then
          execute format('update %s set %I = $3 where %I = any ($1) and %I = $2', fk.tabella, col.colonna, fk.col_persona, col.colonna)
            using da_spostare, maison_17, maison_4;
          get diagnostics n = row_count;
          if n <> attesi then raise exception 'Spostamento di %.%: toccate % righe invece di %. Annullato.', fk.tabella, col.colonna, n, attesi; end if;
          raise notice 'seguono le persone: %.% = % righe su Porta Borsari', fk.tabella, col.colonna, n;
        end if;
      else
        execute format('select count(*) from %s where %I = any ($1) and %I = any ($2)', fk.tabella, fk.col_persona, col.colonna)
           into attesi using da_spostare, sedi_vecchie;
        if attesi > 0 then
          execute format('update %s set %I = $3 where %I = any ($1) and %I = any ($2)', fk.tabella, col.colonna, fk.col_persona, col.colonna)
            using da_spostare, sedi_vecchie, sede_nuova;
          get diagnostics n = row_count;
          if n <> attesi then raise exception 'Spostamento di %.%: toccate % righe invece di %. Annullato.', fk.tabella, col.colonna, n, attesi; end if;
          raise notice 'seguono le persone: %.% = % righe sulla sede di Porta Borsari', fk.tabella, col.colonna, n;
        end if;
      end if;
    end loop;
  end loop;

  -- Le azioni non hanno una chiave esterna verso persona: la persona sta nel
  -- testo della chiave ("<persona_id>:<corso>"). Quelle delle 4 con il vecchio
  -- cliente come responsabile passano al cliente nuovo.
  select count(*) into attesi from public.azione a
   where a.responsabile_cliente_id = maison_17
     and exists (select 1 from unnest(da_spostare) as x where a.origine_requisito_key like x::text || ':%');
  if attesi > 0 then
    update public.azione a set responsabile_cliente_id = maison_4
     where a.responsabile_cliente_id = maison_17
       and exists (select 1 from unnest(da_spostare) as x where a.origine_requisito_key like x::text || ':%');
    get diagnostics n = row_count;
    if n <> attesi then raise exception 'Spostamento delle azioni: toccate % righe invece di %. Annullato.', n, attesi; end if;
    raise notice 'seguono le persone: azione.responsabile_cliente_id = % righe su Porta Borsari', n;
  end if;

  delete from public.persona where id = any (da_togliere) and cliente_id = aprili;
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'Rimozione delle schede sotto Aprili: toccate % righe invece di 2. Annullato.', n; end if;

  delete from public.cliente where id = giac_falso;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Rimozione del cliente AZIENDA AGRICOLA GIACOMELLI: toccate % righe invece di 1. Annullato.', n; end if;

  -- 3. DOPO AVER SCRITTO, rispetto a prima -------------------------------------
  select count(*) into n from public.persona where cliente_id = maison_4;
  if n <> 4 then raise exception 'MAISON 22 Porta Borsari doveva avere 4 persone, ne ha %. Annullato.', n; end if;
  select count(*) into n from public.persona where cliente_id = maison_17;
  if n <> maison17_prima - 4 then raise exception 'MAISON 22 Via IV Novembre doveva avere % persone, ne ha %. Annullato.', maison17_prima - 4, n; end if;
  select count(*) into n from public.persona
   where id = any (da_spostare) and (sede_id is distinct from sede_nuova or import_key like 'anag:' || maison_17::text || ':%');
  if n <> 0 then raise exception '% persone spostate hanno ancora la sede o la chiave del vecchio cliente. Annullato.', n; end if;

  -- Niente delle 4 deve essere rimasto sul vecchio cliente o sulle sue sedi.
  totale := 0;
  for fk in
    select distinct pc.conrelid::regclass::text as tabella, pa.attname as col_persona
      from pg_constraint pc
      join pg_attribute pa on pa.attrelid = pc.conrelid and pa.attnum = any (pc.conkey)
     where pc.contype = 'f' and pc.confrelid = 'public.persona'::regclass
       and pc.conrelid <> 'public.persona'::regclass
  loop
    for col in
      select oa.attname as colonna, oc.confrelid::regclass::text as riferita
        from pg_constraint oc
        join pg_attribute oa on oa.attrelid = oc.conrelid and oa.attnum = any (oc.conkey)
       where oc.contype = 'f' and oc.conrelid = fk.tabella::regclass
         and oc.confrelid in ('public.cliente'::regclass, 'public.sede'::regclass)
    loop
      if col.riferita = 'cliente' then
        execute format('select count(*) from %s where %I = any ($1) and %I = $2', fk.tabella, fk.col_persona, col.colonna)
           into n using da_spostare, maison_17;
      else
        execute format('select count(*) from %s where %I = any ($1) and %I = any ($2)', fk.tabella, fk.col_persona, col.colonna)
           into n using da_spostare, sedi_vecchie;
      end if;
      if n > 0 then raise notice 'rimasti sul vecchio cliente: %.% = %', fk.tabella, col.colonna, n; totale := totale + n; end if;
    end loop;
  end loop;
  select count(*) into n from public.azione a
   where a.responsabile_cliente_id = maison_17
     and exists (select 1 from unnest(da_spostare) as x where a.origine_requisito_key like x::text || ':%');
  totale := totale + n;
  if totale > 0 then raise exception 'Delle persone spostate restano % righe sul vecchio cliente (vedi le notice). Annullato.', totale; end if;

  select count(*) into n from public.cliente where id = maison_4 and indirizzo = 'Corso Porta Borsari, 26' and cap = '37121';
  if n <> 1 then raise exception 'Il cliente MAISON 22 non ha preso l''indirizzo di Porta Borsari. Annullato.'; end if;
  select count(*) into n from public.persona where cliente_id = aprili;
  if n <> aprili_prima - 2 then raise exception 'Aprili doveva avere % persone, ne ha %. Annullato.', aprili_prima - 2, n; end if;
  select count(*) into n from public.persona
   where cliente_id = aprili and upper(trim(cognome)) = 'NEGRETTI' and upper(trim(nome)) = 'LUCA';
  if n <> 1 then raise exception 'NEGRETTI LUCA doveva restare sotto Aprili, trovate % schede. Annullato.', n; end if;
  select count(*) into n from public.cliente;
  if n <> clienti_prima - 1 then raise exception 'Attesi % clienti, trovati %. Annullato.', clienti_prima - 1, n; end if;
  select count(*) into n from public.persona;
  if n <> persone_prima - 2 then raise exception 'Attese % persone, trovate %. Annullato.', persone_prima - 2, n; end if;

  raise notice 'Controllo superato: MAISON 22 divisa con cio'' che segue le persone, AZIENDA AGRICOLA GIACOMELLI tolta, 2 schede tolte da Aprili.';
end $$;

-- VERIFICA, in sola lettura. Attesi, sui dati del 14.09:
--   AZ. AGR. GIACOMELLI FRANCESCO                  1 persona
--   Impresa Agromeccanica Aprili Graziano         4 persone
--   MAISON 22 S.R.L.  Corso Porta Borsari, 26     4 persone
--   MAISON 22 S.R.L.  VIA QUATTRO NOVEMBRE ...   17 persone
--   nessuna riga AZIENDA AGRICOLA GIACOMELLI FRANCESCO
select c.ragione_sociale, c.indirizzo, c.cap, c.partita_iva,
       (select count(*) from public.persona p where p.cliente_id = c.id) as persone,
       (select count(*) from public.adempimento a where a.cliente_id = c.id) as adempimenti
  from public.cliente c
 where c.id in ('cc7d7e47-3a02-49cc-a0f7-9f614e4a4ce9', 'f105801a-9817-4719-b57d-f3d392625a8e',
                '5d6187bd-20ac-43dc-8621-d46f1f263c7d', 'ee206d24-4496-41a4-92a4-4241c9aef921',
                '0082323b-88a6-4c4e-9a16-d16eb7b97e45')
 order by c.ragione_sociale, c.indirizzo;
