-- =====================================================================
-- 009 · Aree/funzioni interne come destinatari delle "cose da fare".
--
-- Finora una cosa-da-fare interna (responsabile_tipo = 'risorsa_interna')
-- poteva puntare SOLO a un tecnico (responsabile_interno_id -> tecnico).
-- Ma la risorsa interna può essere anche un'AREA/funzione del team che non è
-- un tecnico sul campo (es. Formazione, Preventivi, Amministrazione).
--
-- Modellazione: una tabella leggera `area_interna` + una nuova FK opzionale su
-- azione (`responsabile_area_id`). Una cosa-da-fare interna è valida se ha un
-- tecnico OPPURE un'area. Tutto ADDITIVO: le azioni esistenti restano valide
-- (hanno responsabile_interno_id), e il vecchio CHECK viene sostituito da uno
-- più permissivo.
-- =====================================================================

-- 1) anagrafica aree interne -----------------------------------------------
create table if not exists area_interna (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,                 -- per il futuro invio esiti/notifiche all'area
  attiva boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists trg_area_interna_upd on area_interna;
    create trigger trg_area_interna_upd before update on area_interna
      for each row execute function set_updated_at();
  end if;
end $$;

-- RLS coerente col resto della Fase 1 (staff_full: utenti autenticati).
alter table area_interna enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'area_interna' and policyname = 'area_interna_staff_full'
  ) then
    create policy area_interna_staff_full on area_interna
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- 2) nuova FK opzionale su azione ------------------------------------------
alter table azione
  add column if not exists responsabile_area_id uuid references area_interna(id) on delete set null;

create index if not exists idx_azione_resp_area on azione(responsabile_area_id);

-- 3) CHECK aggiornato: interna = tecnico OPPURE area -----------------------
-- Trova e rimuove il vecchio CHECK su responsabile (nome generato), poi crea
-- quello nuovo con un nome esplicito.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'azione' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%responsabile_interno_id%'
      and pg_get_constraintdef(con.oid) ilike '%responsabile_cliente_id%'
  loop
    execute format('alter table azione drop constraint %I', c.conname);
  end loop;
end $$;

alter table azione drop constraint if exists azione_responsabile_chk;
alter table azione add constraint azione_responsabile_chk check (
  (responsabile_tipo = 'cliente'
     and responsabile_cliente_id is not null) or
  (responsabile_tipo = 'risorsa_interna'
     and (responsabile_interno_id is not null or responsabile_area_id is not null))
);
