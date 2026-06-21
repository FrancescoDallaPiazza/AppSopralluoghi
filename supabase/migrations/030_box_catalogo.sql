-- =====================================================================
-- 030 - Modello box-argomento (2/4): CATALOGO box e SEZIONI; le voci
-- (voce_template) vengono generalizzate per appartenere a una sezione.
-- Additivo e idempotente. Decisione D1A: un solo motore voci.
-- I condizionali restano quelli esistenti (parent_voce_id +
-- mostra_se_chiave), che gia' coprono sia i casi piatti sia gli alberi.
-- =====================================================================

-- box riusabile: generico (a voci), smart (incapsula l'organigramma),
-- fisso (es. cose da fare pregresse, vista calcolata).
create table if not exists box_catalogo (
  id uuid primary key default gen_random_uuid(),
  codice text unique not null,
  nome text not null,
  descrizione text,
  tipo text not null default 'generico' check (tipo in ('generico','smart','fisso')),
  ref_smart text,
  ordine_default integer not null default 0,
  versione integer not null default 1,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_box_catalogo_upd on box_catalogo;
create trigger trg_box_catalogo_upd before update on box_catalogo
  for each row execute function set_updated_at();

-- sezione interna del box; ripetibile = N componenti (registro per sede).
create table if not exists box_sezione (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references box_catalogo(id) on delete cascade,
  codice text not null,
  nome text not null,
  ordine integer not null default 0,
  ripetibile boolean not null default false,
  etichetta_componente text,
  unique (box_id, codice)
);
create index if not exists idx_box_sezione_box on box_sezione(box_id);

-- Generalizzazione di voce_template: una voce appartiene a una sezione box
-- OPPURE (legacy) a un template piatto. Si rende template_id nullable.
alter table voce_template add column if not exists sezione_id uuid references box_sezione(id) on delete cascade;
alter table voce_template alter column template_id drop not null;
create index if not exists idx_voce_sezione on voce_template(sezione_id);

-- Integrita': una voce ha esattamente un proprietario (template piatto XOR sezione box).
alter table voce_template drop constraint if exists voce_template_owner_chk;
alter table voce_template add constraint voce_template_owner_chk
  check ((template_id is not null) <> (sezione_id is not null));

-- codice voce univoco dentro la sezione box.
create unique index if not exists uq_box_voce_codice
  on voce_template(sezione_id, codice) where sezione_id is not null and codice is not null;

alter table box_catalogo enable row level security;
drop policy if exists "staff_full" on box_catalogo;
create policy "staff_full" on box_catalogo for all to authenticated using (true) with check (true);

alter table box_sezione enable row level security;
drop policy if exists "staff_full" on box_sezione;
create policy "staff_full" on box_sezione for all to authenticated using (true) with check (true);
