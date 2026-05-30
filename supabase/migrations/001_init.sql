-- =====================================================================
-- App sopralluoghi · Migration iniziale (Fase 1) · Supabase / PostgreSQL
-- Deriva da schema-fase1.sql, con in più: legame ad auth.users,
-- Row Level Security e bucket storage per le foto.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipi enumerati ----------
create type incarico_stato       as enum ('attivo','sospeso','chiuso');
create type checklist_tmpl_stato as enum ('attivo','archiviato');
create type sopralluogo_stato    as enum ('pianificato','in_corso','completato','sincronizzato');
create type esito_stato          as enum ('conforme','non_conforme','non_applicabile');
create type azione_tipo          as enum ('azione_correttiva','scadenza_ricorrente');
create type azione_responsabile  as enum ('cliente','risorsa_interna');
create type azione_priorita      as enum ('bassa','media','alta');
create type azione_stato         as enum ('aperta','in_corso','conclusa');

-- ---------- updated_at ----------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- =====================================================================
-- A. Anagrafiche e contratto
-- =====================================================================
create table cliente (
  id uuid primary key default gen_random_uuid(),
  werp_id text unique,
  ragione_sociale text not null,
  localita text, indirizzo text,
  lat numeric(9,6), lng numeric(9,6),
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_cliente_upd before update on cliente for each row execute function set_updated_at();

-- Il tecnico è anche un utente che fa login: legame opzionale ad auth.users.
create table tecnico (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  nome text not null,
  base_localita text, base_lat numeric(9,6), base_lng numeric(9,6),
  calendario_ref text,
  capienza_ore_settimana numeric(5,1),
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_tecnico_upd before update on tecnico for each row execute function set_updated_at();

create table incarico (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id) on delete restrict,
  werp_id text unique,
  tipo_attivita text not null,
  n_sopralluoghi integer not null check (n_sopralluoghi > 0),
  periodo_inizio date not null,
  periodo_fine date not null,
  durata_seduta_stimata_min integer default 180,
  stato incarico_stato not null default 'attivo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (periodo_fine >= periodo_inizio)
);
create trigger trg_incarico_upd before update on incarico for each row execute function set_updated_at();
create index idx_incarico_cliente on incarico(cliente_id);
create index idx_incarico_tipo on incarico(tipo_attivita);

-- =====================================================================
-- B. Esecuzione del sopralluogo
-- =====================================================================
create table checklist_template (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo_attivita text not null,
  versione integer not null default 1,
  stato checklist_tmpl_stato not null default 'attivo',
  note text,
  created_at timestamptz not null default now(),
  unique (nome, versione)
);
create index idx_tmpl_tipo on checklist_template(tipo_attivita) where stato = 'attivo';

create table voce_template (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_template(id) on delete cascade,
  sezione text,
  ordine integer not null default 0,
  testo_requisito text not null,
  calendarizzabile boolean not null default false,
  unique (template_id, ordine)
);
create index idx_voce_template on voce_template(template_id);

create table sopralluogo (
  id uuid primary key default gen_random_uuid(),
  incarico_id uuid not null references incarico(id) on delete restrict,
  progressivo text,
  tecnico_id uuid references tecnico(id) on delete set null,
  data_pianificata date,
  data_effettiva timestamptz,
  durata_stimata_min integer,
  durata_effettiva_min integer,
  localita text,
  stato sopralluogo_stato not null default 'pianificato',
  werp_attivita_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_sopr_upd before update on sopralluogo for each row execute function set_updated_at();
create index idx_sopr_incarico on sopralluogo(incarico_id);
create index idx_sopr_tecnico on sopralluogo(tecnico_id);
create index idx_sopr_data on sopralluogo(data_pianificata);

create table checklist_compilata (
  id uuid primary key default gen_random_uuid(),
  sopralluogo_id uuid not null references sopralluogo(id) on delete cascade,
  template_id uuid not null references checklist_template(id) on delete restrict,
  template_versione integer not null,
  data_compilazione timestamptz
);
create index idx_compilata_sopr on checklist_compilata(sopralluogo_id);

create table esito_voce (
  id uuid primary key default gen_random_uuid(),
  checklist_compilata_id uuid not null references checklist_compilata(id) on delete cascade,
  voce_testo text not null,
  voce_sezione text,
  ordine integer not null default 0,
  stato esito_stato,
  note text,
  genera_azione boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_esito_upd before update on esito_voce for each row execute function set_updated_at();
create index idx_esito_compilata on esito_voce(checklist_compilata_id);

-- foto.url = path dell'oggetto nel bucket storage 'foto-sopralluoghi'
create table foto (
  id uuid primary key default gen_random_uuid(),
  esito_voce_id uuid not null references esito_voce(id) on delete cascade,
  url text not null,
  thumb_url text,
  scattata_il timestamptz,
  geo_lat numeric(9,6), geo_lng numeric(9,6),
  ordine integer not null default 0
);
create index idx_foto_esito on foto(esito_voce_id);

-- =====================================================================
-- C. Azioni (cuore del sistema)
-- =====================================================================
create table azione (
  id uuid primary key default gen_random_uuid(),
  tipo azione_tipo not null,
  origine_esito_id uuid references esito_voce(id) on delete set null,
  sopralluogo_origine_id uuid references sopralluogo(id) on delete set null,
  descrizione text not null,
  responsabile_tipo azione_responsabile not null,
  responsabile_cliente_id uuid references cliente(id) on delete set null,
  responsabile_interno_id uuid references tecnico(id) on delete set null,
  data_scadenza date,
  priorita azione_priorita not null default 'media',
  stato azione_stato not null default 'aperta',
  sopralluogo_verifica_id uuid references sopralluogo(id) on delete set null,
  data_verifica date,
  werp_attivita_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (responsabile_tipo = 'cliente'        and responsabile_cliente_id is not null) or
    (responsabile_tipo = 'risorsa_interna' and responsabile_interno_id is not null)
  )
);
create trigger trg_azione_upd before update on azione for each row execute function set_updated_at();
create index idx_azione_stato on azione(stato);
create index idx_azione_scadenza on azione(data_scadenza);
create index idx_azione_resp_cli on azione(responsabile_cliente_id);
create index idx_azione_resp_int on azione(responsabile_interno_id);
create index idx_azione_origine on azione(sopralluogo_origine_id);

create table aggiornamento_azione (
  id uuid primary key default gen_random_uuid(),
  azione_id uuid not null references azione(id) on delete cascade,
  data timestamptz not null default now(),
  nuovo_stato azione_stato not null,
  nota text,
  autore_id uuid references tecnico(id) on delete set null
);
create index idx_aggiorn_azione on aggiornamento_azione(azione_id);

-- =====================================================================
-- Row Level Security
-- Fase 1: tutti gli utenti sono staff interno fidato -> accesso pieno
-- agli utenti autenticati. Il filtraggio "le mie cose da fare" avviene
-- lato app (where responsabile_interno_id = mio tecnico).
-- Fase 3 (portale cliente): qui si stringono le policy perché il cliente
-- veda solo i propri dati.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'cliente','tecnico','incarico','checklist_template','voce_template',
    'sopralluogo','checklist_compilata','esito_voce','foto','azione','aggiornamento_azione'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format($p$create policy "staff_full" on %I for all to authenticated using (true) with check (true);$p$, t);
  end loop;
end $$;

-- =====================================================================
-- Storage: bucket privato per le foto + accesso agli autenticati
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('foto-sopralluoghi','foto-sopralluoghi', false)
on conflict (id) do nothing;

create policy "foto_staff_read"  on storage.objects for select to authenticated
  using (bucket_id = 'foto-sopralluoghi');
create policy "foto_staff_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'foto-sopralluoghi');
create policy "foto_staff_del"   on storage.objects for delete to authenticated
  using (bucket_id = 'foto-sopralluoghi');
