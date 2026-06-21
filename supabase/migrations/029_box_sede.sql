-- =====================================================================
-- 029 - Modello box-argomento (1/4): entita' SEDE/SITO.
-- Additivo e idempotente. Un cliente ha 1..N sedi; il sopralluogo si
-- svolge in una sede (default ereditato dall'incarico per i mono-sede).
-- I componenti e le cose da fare pregresse si filtrano per sede.
-- Canale 3 (SQL Editor). Nessun effetto sul codice.
-- =====================================================================

create table if not exists sede (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id) on delete cascade,
  nome text not null,
  indirizzo text,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_sede_upd on sede;
create trigger trg_sede_upd before update on sede
  for each row execute function set_updated_at();
create index if not exists idx_sede_cliente on sede(cliente_id);

-- La sede ispezionata sul sopralluogo; default sull'incarico (mono-sede).
alter table incarico    add column if not exists sede_id uuid references sede(id) on delete set null;
alter table sopralluogo add column if not exists sede_id uuid references sede(id) on delete set null;
create index if not exists idx_incarico_sede on incarico(sede_id);
create index if not exists idx_sopr_sede on sopralluogo(sede_id);

-- RLS coerente con il resto (staff_full: utenti autenticati).
alter table sede enable row level security;
drop policy if exists "staff_full" on sede;
create policy "staff_full" on sede for all to authenticated using (true) with check (true);
