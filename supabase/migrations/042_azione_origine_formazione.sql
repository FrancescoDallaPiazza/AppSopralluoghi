-- =====================================================================
-- 042 - Monitoraggio automatico delle scadenze di formazione.
--   Una formazione con scadenza genera/aggiorna un'azione di scadenzario
--   COLLEGATA: azione.id = formazione.id (upsert idempotente per id) e
--   azione.origine_formazione_id = formazione.id. Rinnovando la formazione
--   (nuova scadenza) l'azione si aggiorna; eliminando la formazione l'azione
--   collegata sparisce (FK on delete cascade). Se la scadenza viene rimossa,
--   l'app cancella l'azione collegata.
-- Idempotente: add column if not exists + drop/add constraint + index if not exists.
-- Commenti solo ASCII.
-- =====================================================================

alter table azione add column if not exists origine_formazione_id uuid;

alter table azione drop constraint if exists azione_origine_formazione_fk;
alter table azione add constraint azione_origine_formazione_fk
  foreign key (origine_formazione_id) references formazione(id) on delete cascade;

create index if not exists idx_azione_origine_formazione on azione(origine_formazione_id);

-- Backfill: porta nello scadenzario le formazioni gia' esistenti con scadenza
-- (prima d'ora monitorate solo a mano). id azione = id formazione, idempotente.
insert into azione (id, tipo, descrizione, responsabile_tipo, responsabile_cliente_id, data_scadenza, origine_formazione_id)
select f.id,
       'azione_correttiva'::azione_tipo,
       'Rinnovo formazione - ' || coalesce(f.corso_nome, 'corso')
         || ' (' || trim(coalesce(p.cognome, '') || ' ' || coalesce(p.nome, '')) || ')',
       'cliente'::azione_responsabile,
       p.cliente_id,
       f.scadenza,
       f.id
from formazione f
join persona p on p.id = f.persona_id
where f.scadenza is not null
  and p.cliente_id is not null
on conflict (id) do nothing;
