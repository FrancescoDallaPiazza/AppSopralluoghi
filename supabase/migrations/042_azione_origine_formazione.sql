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

-- Backfill: porta nello scadenzario le formazioni gia' esistenti con scadenza.
-- L'azione e' indirizzata all'AREA FORMAZIONE interna (monitoraggio + invito ai
-- corsi); tiene anche il riferimento cliente. Se l'area Formazione non esiste,
-- ripiega sul cliente. id azione = id formazione, idempotente.
insert into azione (id, tipo, descrizione, responsabile_tipo, responsabile_area_id, responsabile_cliente_id, data_scadenza, origine_formazione_id)
select f.id,
       'azione_correttiva'::azione_tipo,
       'Rinnovo formazione - ' || coalesce(f.corso_nome, 'corso')
         || ' (' || trim(coalesce(p.cognome, '') || ' ' || coalesce(p.nome, '')) || ')',
       case when af.id is not null then 'risorsa_interna'::azione_responsabile
            else 'cliente'::azione_responsabile end,
       af.id,
       p.cliente_id,
       f.scadenza,
       f.id
from formazione f
join persona p on p.id = f.persona_id
left join lateral (
  select id from area_interna where attiva and lower(nome) like '%formazione%' order by nome limit 1
) af on true
where f.scadenza is not null
  and p.cliente_id is not null
on conflict (id) do nothing;

-- Correttivo idempotente: re-indirizza all'area Formazione le azioni di scadenza
-- gia' esistenti (es. create da un eventuale run precedente verso il cliente).
update azione a
set responsabile_tipo = 'risorsa_interna',
    responsabile_area_id = af.id
from area_interna af
where a.origine_formazione_id is not null
  and af.attiva and lower(af.nome) like '%formazione%'
  and (a.responsabile_area_id is distinct from af.id or a.responsabile_tipo <> 'risorsa_interna');
