-- =====================================================================
-- 013 · Rigenerazione automatica delle scadenze ricorrenti.
--
-- Quando una "cosa da fare" di tipo `scadenza_ricorrente` viene VERIFICATA
-- (stato -> 'conclusa'), si crea automaticamente il CICLO SUCCESSIVO: una
-- nuova azione identica, con `data_scadenza` spostata avanti di
-- `periodicita_mesi` e stato 'aperta'. Così lo scadenzario non resta mai
-- "scoperto" dopo una verifica e la scadenza ricompare nel giro successivo
-- dello stesso incarico (eredita `sopralluogo_origine_id` e `origine_esito_id`).
--
-- Perché lato DB e non in app:
--   * una scadenza può essere chiusa da più punti (verifica in campo,
--     "Le mie cose da fare", back-office) e anche offline-poi-sincronizzata;
--     un trigger sull'UPDATE di `azione` le copre TUTTE con un solo punto;
--   * è IDEMPOTENTE: il ciclo successivo è individuato in modo deterministico
--     da (origine_esito_id, sopralluogo_origine_id, data calcolata), quindi
--     chiusure ripetute o re-sync della stessa azione non creano doppioni;
--   * niente rischio di duplicati tra client e server: la nuova riga nasce
--     solo qui, con un id generato dal DB.
--
-- Email: la nuova azione è 'aperta' con `notificata_il` = NULL e NON fa
-- scattare invii (il webhook su `azione` è dismesso, vedi §4 del PROGETTO);
-- l'eventuale avviso resta manuale dal back-office.
--
-- Semantica: si rigenera SOLO su transizione a 'conclusa' (AFTER UPDATE), cioè
-- su una vera "verifica". Le righe importate/inserite già concluse (AFTER
-- INSERT) non rigenerano nulla, per non spawnare cicli su backfill storici.
-- Per interrompere una serie basta non verificare l'ultimo ciclo (o eliminarlo).
--
-- Nessuna colonna nuova: usa solo colonne esistenti della tabella `azione`.
-- =====================================================================

create or replace function azione_rigenera_scadenza_ricorrente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prossima date;
begin
  -- Solo scadenze ricorrenti appena passate a 'conclusa', con periodicità e
  -- data di scadenza valorizzate. (La condizione di tipo/stato è anche nel
  -- WHEN del trigger; qui ricontrolliamo il resto e la transizione.)
  if coalesce(old.stato, '') = 'conclusa' then
    return new;                      -- era già chiusa: nessuna nuova verifica
  end if;
  if new.periodicita_mesi is null or new.periodicita_mesi <= 0 then
    return new;
  end if;
  if new.data_scadenza is null then
    return new;
  end if;

  prossima := (new.data_scadenza + make_interval(months => new.periodicita_mesi))::date;

  -- Idempotenza: non duplicare se il ciclo successivo (stessa serie, stessa
  -- data calcolata) esiste già.
  if exists (
    select 1
    from azione a
    where a.tipo = 'scadenza_ricorrente'
      and a.data_scadenza = prossima
      and a.origine_esito_id      is not distinct from new.origine_esito_id
      and a.sopralluogo_origine_id is not distinct from new.sopralluogo_origine_id
  ) then
    return new;
  end if;

  insert into azione (
    id, tipo, origine_esito_id, sopralluogo_origine_id, descrizione,
    responsabile_tipo, responsabile_cliente_id, responsabile_interno_id,
    responsabile_area_id, data_scadenza, priorita, stato,
    sopralluogo_verifica_id, data_verifica, periodicita_mesi,
    werp_attivita_id, notificata_il
  ) values (
    gen_random_uuid(), new.tipo, new.origine_esito_id, new.sopralluogo_origine_id,
    new.descrizione, new.responsabile_tipo, new.responsabile_cliente_id,
    new.responsabile_interno_id, new.responsabile_area_id, prossima, new.priorita,
    'aperta', null, null, new.periodicita_mesi, new.werp_attivita_id, null
  );

  return new;
end;
$$;

drop trigger if exists trg_azione_rigenera_scadenza on azione;

create trigger trg_azione_rigenera_scadenza
  after update on azione
  for each row
  when (new.tipo = 'scadenza_ricorrente' and new.stato = 'conclusa')
  execute function azione_rigenera_scadenza_ricorrente();
