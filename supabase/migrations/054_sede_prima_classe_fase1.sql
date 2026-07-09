-- =====================================================================
-- 054 - Sede entita' di prima classe (Piano B) - FASE 1: schema + dati.
--
-- Porta l'organigramma dal CLIENTE alla SEDE. Ogni cliente ha 1..N sedi;
-- la sede porta gli stessi campi di compilazione della sede legale, inclusi
-- quelli che guidano l'organigramma (rischio, ATECO, primo soccorso,
-- antincendio, RLS). Le persone (e quindi nomine/formazione/esoneri, legate a
-- persona) appartengono a una sede.
--
-- Questa fase e' NON DISTRUTTIVA e NON BREAKING: aggiunge colonne, crea per ogni
-- cliente una sede "Sede legale" (principale) copiandone i campi, e riaggancia
-- le persone esistenti a quella sede. Il codice attuale (che valuta per cliente)
-- continua a funzionare perche' persona.cliente_id resta. Il motore passera' a
-- sede_id nella Fase 2.
--
-- Copia-e-conferma: il flag da_confermare marca cio' che nasce da una copia di
-- un'altra sede e va rivisto. Le righe migrate qui NON sono copie: da_confermare
-- resta false.
--
-- Idempotente. Commenti solo ASCII (accenti solo nei literal). Canale 3.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Sede: campi anagrafici + campi che guidano l'organigramma
-- ---------------------------------------------------------------------
alter table sede add column if not exists localita                     text;
alter table sede add column if not exists cap                          text;
alter table sede add column if not exists provincia                    text;
alter table sede add column if not exists codice_ateco                 text;
alter table sede add column if not exists livello_rischio              text;
alter table sede add column if not exists livello_antincendio          text;
alter table sede add column if not exists gruppo_primo_soccorso        text;
alter table sede add column if not exists rls_territoriale             boolean not null default false;
alter table sede add column if not exists antincendio_definito_mediante text;
alter table sede add column if not exists principale                   boolean not null default false;
-- Marca una sede (e la sua compilazione) come nata da copia, da confermare.
alter table sede add column if not exists da_confermare                boolean not null default false;

-- Stessi domini di cliente (mig. 048/050): mirror dei check.
alter table sede drop constraint if exists sede_livello_rischio_chk;
alter table sede add constraint sede_livello_rischio_chk
  check (livello_rischio is null or livello_rischio in ('basso', 'medio', 'alto'));
alter table sede drop constraint if exists sede_livello_antincendio_chk;
alter table sede add constraint sede_livello_antincendio_chk
  check (livello_antincendio is null or livello_antincendio in ('1', '2', '3'));
alter table sede drop constraint if exists sede_gruppo_primo_soccorso_chk;
alter table sede add constraint sede_gruppo_primo_soccorso_chk
  check (gruppo_primo_soccorso is null or gruppo_primo_soccorso in ('A', 'B', 'C', 'BC'));

-- Al massimo una sede legale (principale) per cliente.
create unique index if not exists uq_sede_principale on sede(cliente_id) where principale;

-- ---------------------------------------------------------------------
-- 2. Flag "da confermare" sui record dell'organigramma (copia da rivedere)
-- ---------------------------------------------------------------------
alter table persona    add column if not exists da_confermare boolean not null default false;
alter table nomina     add column if not exists da_confermare boolean not null default false;
alter table formazione add column if not exists da_confermare boolean not null default false;
alter table esonero    add column if not exists da_confermare boolean not null default false;

-- ---------------------------------------------------------------------
-- 3. La persona appartiene a una sede (oltre al cliente, che resta)
-- ---------------------------------------------------------------------
alter table persona add column if not exists sede_id uuid references sede(id) on delete cascade;
create index if not exists idx_persona_sede on persona(sede_id);

-- ---------------------------------------------------------------------
-- 4. Migrazione dati: crea la Sede legale per ogni cliente (copiandone i
--    campi) e riaggancia le persone esistenti. Idempotente.
-- ---------------------------------------------------------------------
insert into sede (
  cliente_id, nome, indirizzo, localita, cap, provincia, codice_ateco,
  livello_rischio, livello_antincendio, gruppo_primo_soccorso,
  rls_territoriale, antincendio_definito_mediante, principale, attivo
)
select
  c.id, 'Sede legale', c.indirizzo, c.localita, c.cap, c.provincia, c.codice_ateco,
  c.livello_rischio, c.livello_antincendio, c.gruppo_primo_soccorso,
  coalesce(c.rls_territoriale, false), c.antincendio_definito_mediante, true, true
from cliente c
where not exists (select 1 from sede s where s.cliente_id = c.id and s.principale);

-- Riaggancio: ogni persona senza sede va alla sede legale del suo cliente.
update persona p
set sede_id = s.id
from sede s
where s.cliente_id = p.cliente_id and s.principale and p.sede_id is null;
