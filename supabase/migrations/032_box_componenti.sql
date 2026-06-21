-- =====================================================================
-- 032 - Modello box-argomento (4/4): REGISTRO COMPONENTI persistente.
-- Decisione D3: i componenti delle sezioni ripetibili appartengono alla
-- SEDE e persistono tra i sopralluoghi (si ri-verificano a ogni giro).
-- esito_voce e azione guadagnano componente_id, cosi' esiti, cose da
-- fare e scadenze sono riconducibili al singolo componente.
-- =====================================================================

create table if not exists componente_sito (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references sede(id) on delete cascade,
  box_id uuid not null references box_catalogo(id) on delete restrict,
  sezione_codice text not null,
  etichetta text not null,
  matricola text,
  ubicazione text,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_componente_upd on componente_sito;
create trigger trg_componente_upd before update on componente_sito
  for each row execute function set_updated_at();
create index if not exists idx_componente_sede on componente_sito(sede_id);

-- per le sezioni ripetibili: esito per voce E per componente; null altrove.
alter table esito_voce add column if not exists componente_id uuid references componente_sito(id) on delete set null;
alter table azione     add column if not exists componente_id uuid references componente_sito(id) on delete set null;
create index if not exists idx_esito_componente on esito_voce(componente_id);
create index if not exists idx_azione_componente on azione(componente_id);

alter table componente_sito enable row level security;
drop policy if exists "staff_full" on componente_sito;
create policy "staff_full" on componente_sito for all to authenticated using (true) with check (true);
