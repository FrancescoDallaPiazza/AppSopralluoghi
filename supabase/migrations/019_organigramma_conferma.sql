-- =====================================================================
-- 019 - Conferma organigramma per sopralluogo.
--
-- Registra l'evidenza che a un dato sopralluogo l'organigramma e' stato
-- compilato / confermato / variato, con tecnico e data. Le modifiche alle
-- figure/persone restano sulle tabelle-cliente (persona/nomina/formazione/
-- esonero); questa tabella tiene solo l'atto di verifica legato al sopralluogo.
--
-- Disegnata per l'outbox offline: chiave primaria id uuid generata lato client,
-- upsert per id. RLS permissiva (staff_full) come le altre tabelle del modulo.
-- =====================================================================

create table if not exists organigramma_conferma (
  id            uuid primary key default gen_random_uuid(),
  sopralluogo_id uuid not null references sopralluogo(id) on delete cascade,
  cliente_id    uuid references cliente(id) on delete set null,
  tecnico_id    uuid,
  tecnico_nome  text,
  tipo          text not null default 'confermato' check (tipo in ('compilato','confermato','variato')),
  data_conferma timestamptz not null default now(),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_org_conferma_sopr on organigramma_conferma (sopralluogo_id);
create index if not exists idx_org_conferma_cli  on organigramma_conferma (cliente_id);

-- RLS permissiva (gating per ruolo lato app), coerente con le tabelle 015
alter table organigramma_conferma enable row level security;
drop policy if exists staff_full on organigramma_conferma;
create policy staff_full on organigramma_conferma for all to authenticated using (true) with check (true);

-- updated_at automatico (guardato: il trigger esiste solo se la funzione c'e')
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists trg_org_conferma_upd on organigramma_conferma;
    create trigger trg_org_conferma_upd before update on organigramma_conferma
      for each row execute function set_updated_at();
  end if;
end $$;
