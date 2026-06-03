-- 012 · Revisioni dei sopralluoghi completati.
-- Ogni modifica successiva al completamento congela lo stato attuale (esiti +
-- azioni) come snapshot, così la versione precedente resta rileggibile per
-- intero. La riga "viva" in esito_voce/azione resta sempre la revisione
-- corrente; gli snapshot archiviano le versioni superate.

-- contatore della revisione corrente sul sopralluogo (1 = primo completamento)
alter table sopralluogo
  add column if not exists revisione_corrente int not null default 1;

-- archivio delle versioni congelate
create table if not exists sopralluogo_revisione (
  id uuid primary key default gen_random_uuid(),
  sopralluogo_id uuid not null references sopralluogo(id) on delete cascade,
  numero int not null,                       -- numero della versione congelata
  creata_il timestamptz not null default now(),
  autore_tecnico_id uuid references tecnico(id) on delete set null,
  motivo text,
  snapshot jsonb not null,                   -- { creato_il, esiti:[...], azioni:[...] }
  unique (sopralluogo_id, numero)
);

create index if not exists sopralluogo_revisione_sopr_idx
  on sopralluogo_revisione (sopralluogo_id);

-- RLS coerente col resto (Fase 1: permissiva, gating in-app)
alter table sopralluogo_revisione enable row level security;
drop policy if exists "staff_full" on sopralluogo_revisione;
create policy "staff_full" on sopralluogo_revisione
  for all to authenticated using (true) with check (true);
