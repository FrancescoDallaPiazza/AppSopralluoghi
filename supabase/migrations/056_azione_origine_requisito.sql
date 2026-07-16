-- 056_azione_origine_requisito.sql
--
-- Chiude la crepa fra i due flussi che alimentano lo scadenzario formativo.
--
-- `backfillAzioniEsoneri` e' idempotente perche' usa azione.id = id
-- dell'attestato (origine_formazione_id) o del credito (origine_esonero_id)
-- vincente. Ma un requisito puo' avere una SCADENZA senza avere nessuno dei
-- due: e' il caso della prima formazione mai erogata, la cui scadenza non
-- viene da un attestato ma dalla legge ("prima formazione entro il ...").
-- Quel requisito non ha una chiave, quindi il backfill lo saltava; e
-- `proponiCoseDaFare` lo saltava a sua volta, assumendo (commento alla mano)
-- che "scadenza valorizzata = monitorata automaticamente dalla 042" --
-- vero solo quando c'e' un attestato dietro. Ognuno dei due dava per scontato
-- che ci pensasse l'altro, e ogni scadenza "prima formazione entro il ..."
-- restava invisibile nello scadenzario, per tutti i clienti.
--
-- Qui si da' a quei requisiti una chiave naturale stabile:
--     origine_requisito_key = persona_id || ':' || corso_codice
-- che e' l'identita' del requisito dentro il cliente, e non cambia finche' non
-- arriva l'attestato (a quel punto il requisito passa su origine_formazione_id
-- e l'azione a chiave requisito viene cancellata come orfana).
--
-- Indice unique PARZIALE: le azioni esistenti hanno la colonna null e non
-- vengono toccate. Il backfill NON usa ON CONFLICT su questa colonna (con un
-- indice parziale l'inferenza non aggancerebbe): risolve prima la chiave in id
-- con una select, poi fa upsert sulla primary key come per tutte le altre.

alter table azione add column if not exists origine_requisito_key text;

create unique index if not exists uq_azione_requisito
  on azione(origine_requisito_key) where origine_requisito_key is not null;

create index if not exists idx_azione_requisito_cliente
  on azione(responsabile_cliente_id) where origine_requisito_key is not null;

comment on column azione.origine_requisito_key is
  'Chiave naturale persona_id:corso_codice per le scadenze formative senza attestato ne esonero (prima formazione da erogare). Null per tutte le altre azioni.';
