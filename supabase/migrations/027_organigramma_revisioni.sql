-- 027 . Revisioni (snapshot) dell'organigramma sicurezza, per cliente.
--
-- Ogni modifica dell'organigramma (back-office o campo) congela uno snapshot
-- completo dello stato: figure + incaricati + stato formativo + ruoli scoperti.
-- Serve per la storia (chi/quando/cosa) e per l'esportazione PDF a richiesta.
--
-- Dedup applicativo: lo snapshot porta una "firma" dei soli fatti rilevanti
-- (persone, nomine, attestati, esoneri, rischio). Si crea una nuova revisione
-- solo se la firma differisce dall'ultima del cliente, cosi' aprire la scheda o
-- ri-salvare senza variazioni non genera revisioni a vuoto.
--
-- Online (back-office) e offline (campo via coda) condividono la stessa tabella:
-- il progressivo per cliente viene assegnato lato DB da un trigger, cosi' il
-- numero non deve essere noto dal client (in campo arriva null dalla coda).

create table if not exists organigramma_revisione (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id) on delete cascade,
  numero int,                                    -- progressivo per cliente (trigger)
  creata_il timestamptz not null default now(),
  autore text,                                   -- nome leggibile (admin o tecnico)
  autore_tecnico_id uuid references tecnico(id) on delete set null,
  origine text not null default 'back-office',   -- 'back-office' | 'campo'
  firma text not null default '',                -- firma dei fatti, per dedup
  snapshot jsonb not null,                       -- { cliente_nome, conteggi, persone, ... }
  unique (cliente_id, numero)
);

create index if not exists organigramma_revisione_cli_idx
  on organigramma_revisione (cliente_id, numero desc);

-- Progressivo per cliente assegnato lato DB. Funziona sia online (back-office,
-- numero null in insert) sia offline (campo: la riga arriva dalla coda con
-- numero null e viene numerata qui, all'upsert lato server).
create or replace function organigramma_revisione_numera()
returns trigger language plpgsql as $$
begin
  if new.numero is null then
    select coalesce(max(numero), 0) + 1 into new.numero
    from organigramma_revisione where cliente_id = new.cliente_id;
  end if;
  return new;
end;
$$;

drop trigger if exists organigramma_revisione_numera_t on organigramma_revisione;
create trigger organigramma_revisione_numera_t
  before insert on organigramma_revisione
  for each row execute function organigramma_revisione_numera();

-- RLS coerente col resto del progetto (Fase 1: permissiva, gating in-app).
alter table organigramma_revisione enable row level security;
drop policy if exists "staff_full" on organigramma_revisione;
create policy "staff_full" on organigramma_revisione
  for all to authenticated using (true) with check (true);
