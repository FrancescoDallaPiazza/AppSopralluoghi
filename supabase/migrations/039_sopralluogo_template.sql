-- 039: template della checklist scelto in PIANIFICAZIONE, per singola seduta.
-- Finora il template veniva scelto in campo, con default per tipo_attivita
-- dell'incarico. Ora la scelta avviene in pianificazione, sulla seduta, e il
-- tipo_attivita dell'incarico resta solo un'etichetta (non determina il template).
-- Colonne NULLABLE: le sedute senza template scelto ripiegano sulla scelta in
-- campo. Nessun backfill. ASCII-only comments (SQL Editor friendly). Idempotente.

alter table sopralluogo
  add column if not exists template_id uuid references checklist_template(id),
  add column if not exists template_versione integer;

comment on column sopralluogo.template_id is 'Checklist scelta in pianificazione per questa seduta (nullable: se assente, scelta in campo).';
comment on column sopralluogo.template_versione is 'Versione del template scelto in pianificazione.';
