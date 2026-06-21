-- =====================================================================
-- 031 - Modello box-argomento (3/4): COMPOSIZIONE.
-- Decisione D2: checklist_template fa da contenitore di box (default per
-- incarico) tramite la ponte checklist_template_box. Il singolo
-- sopralluogo congela la composizione effettiva in sopralluogo_box
-- (Decisione D4: puntatore di versione box_versione).
-- Tutte le tabelle hanno id uuid per l'upsert offline (outbox).
-- =====================================================================

-- composizione di DEFAULT salvata sul template (versione box congelata).
create table if not exists checklist_template_box (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_template(id) on delete cascade,
  box_id uuid not null references box_catalogo(id) on delete restrict,
  box_versione integer not null,
  ordine integer not null default 0,
  unique (template_id, box_id)
);
create index if not exists idx_ctb_template on checklist_template_box(template_id);

-- composizione EFFETTIVA e congelata del singolo sopralluogo.
-- origine: da template, aggiunto da ufficio/campo, oppure box fisso iniettato.
create table if not exists sopralluogo_box (
  id uuid primary key default gen_random_uuid(),
  sopralluogo_id uuid not null references sopralluogo(id) on delete cascade,
  box_id uuid not null references box_catalogo(id) on delete restrict,
  box_versione integer not null,
  ordine integer not null default 0,
  origine text not null default 'template'
    check (origine in ('template','aggiunto_ufficio','aggiunto_campo','fisso')),
  unique (sopralluogo_id, box_id)
);
create index if not exists idx_sbox_sopralluogo on sopralluogo_box(sopralluogo_id);

alter table checklist_template_box enable row level security;
drop policy if exists "staff_full" on checklist_template_box;
create policy "staff_full" on checklist_template_box for all to authenticated using (true) with check (true);

alter table sopralluogo_box enable row level security;
drop policy if exists "staff_full" on sopralluogo_box;
create policy "staff_full" on sopralluogo_box for all to authenticated using (true) with check (true);
