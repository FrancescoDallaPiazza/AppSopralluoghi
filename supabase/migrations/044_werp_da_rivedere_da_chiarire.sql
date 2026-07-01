-- =====================================================================
-- 044 - Import Werp (Fase 0): tabelle di revisione manuale.
--   Il dry-run applicato scrive qui cio' che non decide da solo, come i fogli
--   omonimi del vecchio Excel ma dentro l'app:
--     * werp_da_rivedere: contratto gia' presente con un valore diverso da Werp
--       (es. n_sopralluoghi app != Werp). L'import non sovrascrive: annota i due
--       valori e lascia decidere l'operatore.
--     * werp_da_chiarire: contratto rilevante ma senza numero dichiarato in
--       Documenti -> l'operatore inserisce a mano quanti sopralluoghi/anno.
--   I vincoli UNIQUE reggono l'upsert idempotente dell'import (onConflict).
--   RLS coerente col resto: un solo ruolo staff, accesso pieno.
-- Idempotente. Commenti solo ASCII.
-- =====================================================================

create table if not exists werp_da_rivedere (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references cliente(id) on delete cascade,
  werp_id text not null,
  campo text not null,
  valore_app text,
  valore_werp text,
  note text,
  creato_il timestamptz not null default now(),
  unique (werp_id, campo)
);
create index if not exists idx_werp_rivedere_cliente on werp_da_rivedere(cliente_id);

create table if not exists werp_da_chiarire (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references cliente(id) on delete cascade,
  werp_id text not null unique,
  oggetto text,
  periodo text,
  n_sopr_compilare integer,
  creato_il timestamptz not null default now()
);
create index if not exists idx_werp_chiarire_cliente on werp_da_chiarire(cliente_id);

alter table werp_da_rivedere enable row level security;
drop policy if exists "staff_full" on werp_da_rivedere;
create policy "staff_full" on werp_da_rivedere for all to authenticated using (true) with check (true);

alter table werp_da_chiarire enable row level security;
drop policy if exists "staff_full" on werp_da_chiarire;
create policy "staff_full" on werp_da_chiarire for all to authenticated using (true) with check (true);
