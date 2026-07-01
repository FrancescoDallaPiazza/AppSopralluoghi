-- 047_overall_datore_lavoro_nomina.sql
-- Correzione dell'import 046: PRADELLA TAZIO era stato nominato solo dl_rspp
-- (Datore che svolge il ruolo di RSPP). Nell'app la figura "Datore di lavoro"
-- (datore_lavoro) e' attesa SEMPRE e restava scoperta. La standalone aveva due
-- incarichi distinti (datore + datoreRspp): qui si aggiunge la nomina mancante.
--
-- Il corso base datore (DATORE_LAVORO, 16h - migration 016) NON richiede un
-- esonero esplicito: con la matrice crediti Allegato III corretta, dl_rspp
-- credita totalmente il datore (riga dlRspp, colonna dl = 'T'), quindi il
-- requisito risulta esonerato "Credito da Datore-RSPP".
--
-- Canale 3 (SQL Editor). Idempotente: on conflict (persona_id, figura_codice).
-- Richiede che 046 sia gia' stato eseguito (la persona Tazio deve esistere).

do $$
declare
  v_tazio uuid;
begin
  select p.id into v_tazio
  from persona p
  join cliente c on c.id = p.cliente_id
  where c.partita_iva = '04534450236'
    and p.codice_fiscale = 'PRDTZA85H24E897O'
  limit 1;

  if v_tazio is null then
    raise notice 'PRADELLA TAZIO non trovato: eseguire prima la migration 046.';
    return;
  end if;

  insert into nomina (persona_id, figura_codice, data_nomina, attiva)
  values (v_tazio, 'datore_lavoro', date '2025-01-01', true)
  on conflict (persona_id, figura_codice) do nothing;
end $$;
