-- correggi_data_antincendio_fiorio.sql - NON e' una migration.
--
-- ============================================================================
--  COME SI LANCIA: incollare TUTTO il file nell'SQL Editor e premere Run una
--  volta sola. Non selezionarne una parte. Poi guardare il risultato della
--  query di verifica in fondo: e' quella, non il messaggio, a dire se e' fatto.
-- ============================================================================
--
-- COSA FA. Corregge la data di UNA nomina. FIORIO STEFANO (I.VAR INDUSTRY SRL,
-- riga 1298 del foglio "Ruoli SSL" di ExportExcel (4).xlsx) ha nel gestionale
-- "Addetti Antincendio" 2004-01-07 e "Addetti Emergenze ed Evacuazione"
-- 2001-05-14. Il 14 settembre 2026 Francesco ha deciso che le due colonne sono lo
-- stesso ruolo e che la nomina porta la data PIU' VECCHIA ("emergenze 2022 e'
-- l'aggiornamento quinquennale di antincendio 2017"). La nomina esiste gia' con
-- 2004-01-07, scritta dalla colonna Antincendio, e l'import non riscrive una
-- nomina esistente: la data 2001-05-14 va messa a mano, qui.
--
-- IL CONTROLLO ANNULLA. Un blocco solo: se la nomina non e' esattamente una, non
-- ha la data 2004-01-07, o l'update non tocca esattamente una riga, solleva un
-- errore e non resta scritto niente.
--
-- ASCII-only.

do $$
declare
  n bigint;
begin
  select count(*) into n
    from public.nomina nm
    join public.persona p on p.id = nm.persona_id
    join public.cliente c on c.id = p.cliente_id
   where upper(trim(p.cognome)) = 'FIORIO' and upper(trim(p.nome)) = 'STEFANO'
     and upper(trim(c.ragione_sociale)) = 'I.VAR INDUSTRY SRL'
     and nm.figura_codice = 'addetto_antincendio';
  if n <> 1 then
    raise exception 'Attesa 1 nomina addetto_antincendio di FIORIO STEFANO in I.VAR INDUSTRY SRL, trovate %. Niente e'' stato scritto.', n;
  end if;

  update public.nomina nm
     set data_nomina = date '2001-05-14'
    from public.persona p, public.cliente c
   where p.id = nm.persona_id and c.id = p.cliente_id
     and upper(trim(p.cognome)) = 'FIORIO' and upper(trim(p.nome)) = 'STEFANO'
     and upper(trim(c.ragione_sociale)) = 'I.VAR INDUSTRY SRL'
     and nm.figura_codice = 'addetto_antincendio'
     and nm.data_nomina = date '2004-01-07';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'L''update doveva toccare 1 riga (data 2004-01-07), ne ha toccate %. Annullato: niente e'' stato scritto.', n;
  end if;

  raise notice 'Controllo superato: la nomina addetto_antincendio di FIORIO STEFANO ora ha 2001-05-14.';
end $$;

-- VERIFICA, in sola lettura. Atteso: una riga, data_nomina = 2001-05-14.
select p.cognome, p.nome, c.ragione_sociale, nm.figura_codice, nm.data_nomina, nm.origine
  from public.nomina nm
  join public.persona p on p.id = nm.persona_id
  join public.cliente c on c.id = p.cliente_id
 where upper(trim(p.cognome)) = 'FIORIO' and upper(trim(p.nome)) = 'STEFANO'
   and upper(trim(c.ragione_sociale)) = 'I.VAR INDUSTRY SRL'
   and nm.figura_codice = 'addetto_antincendio';
