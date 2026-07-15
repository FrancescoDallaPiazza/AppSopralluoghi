-- 055_adempimento_corso_alias_import.sql
--
-- Fase A dell'import da gestionale esterno + scadenzario a 4 blocchi.
--
-- 1. `adempimento` : scadenze NON formative che pendono dal cliente.
--    Tre categorie con la STESSA forma (tipo, date, periodicita', allegato):
--      - documento      : DVR e valutazioni specifiche (rumore, vibrazioni...)
--      - autorizzazione : CPI, messa a terra, albo gestori, AIA, manutenzioni
--      - sorveglianza   : visite mediche (pendono da persona, non da sede)
--    Una tabella sola: la forma e' identica, cambia solo da cosa pende.
--    Se la sorveglianza cresce (giudizio di idoneita', prescrizioni,
--    limitazioni) si scorpora: quei campi su un CPI non hanno senso.
--
-- 2. `corso_alias` : dizionario testo-del-gestionale -> corso_catalogo.
--    corso_catalogo_id null = "da mappare" (stesso pattern "Da chiarire" dei
--    contratti Werp): l'import non si blocca, le voci ignote finiscono in lista.
--
-- 3. `import_key` su formazione/persona : idempotenza dell'import.
--    Indice unique PARZIALE (where import_key is not null): le righe gia' in
--    produzione hanno null e non vengono toccate. Nessun vincolo sui dati
--    esistenti, quindi nessun rischio di migrazione fallita.
--
-- NB: gli adempimenti NON materializzano righe in `azione`. La riga di
-- adempimento HA gia' data_scadenza: lo scadenzario la legge diretta e ne
-- deriva lo stato. Un backfill verso `azione` duplicherebbe il dato per
-- ri-ottenere un campo che c'e' gia'.

-- ---------------------------------------------------------------------
-- 1. Adempimenti (documenti / autorizzazioni / sorveglianza sanitaria)
-- ---------------------------------------------------------------------
create table if not exists adempimento (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id) on delete cascade,
  categoria text not null,
  -- documento/autorizzazione pendono dalla sede; sorveglianza dalla persona.
  sede_id uuid references sede(id) on delete cascade,
  persona_id uuid references persona(id) on delete cascade,
  tipo text not null,                     -- 'CPI', 'TERRA', 'Visita Medica Biennale'...
  descrizione text,
  data_rilascio date,
  data_scadenza date,
  periodicita_mesi int,                   -- null = una tantum
  medico text,                            -- solo sorveglianza
  note text,
  allegato_path text,
  import_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adempimento_categoria_chk
    check (categoria in ('documento', 'autorizzazione', 'sorveglianza')),
  -- una visita medica senza discente non e' una visita medica.
  constraint adempimento_sorveglianza_chk
    check (categoria <> 'sorveglianza' or persona_id is not null)
);
create index if not exists idx_adempimento_cliente on adempimento(cliente_id);
create index if not exists idx_adempimento_sede on adempimento(sede_id);
create index if not exists idx_adempimento_persona on adempimento(persona_id);
create index if not exists idx_adempimento_scadenza on adempimento(data_scadenza);
create unique index if not exists uq_adempimento_import
  on adempimento(import_key) where import_key is not null;

-- ---------------------------------------------------------------------
-- 2. Dizionario alias corsi del gestionale
-- ---------------------------------------------------------------------
create table if not exists corso_alias (
  id uuid primary key default gen_random_uuid(),
  testo_gestionale text not null unique,  -- la stringa esatta esportata
  corso_codice text,                      -- soft ref a corso_catalogo.codice; null = da mappare
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_corso_alias_corso on corso_alias(corso_codice);
create index if not exists idx_corso_alias_damappare
  on corso_alias(testo_gestionale) where corso_codice is null;

-- ---------------------------------------------------------------------
-- 3. Chiavi di idempotenza dell'import
-- ---------------------------------------------------------------------
alter table formazione add column if not exists import_key text;
create unique index if not exists uq_formazione_import
  on formazione(import_key) where import_key is not null;

alter table persona add column if not exists import_key text;
create unique index if not exists uq_persona_import
  on persona(import_key) where import_key is not null;

-- ---------------------------------------------------------------------
-- 4. RLS + trigger updated_at (coerente con 015/053: staff_full permissiva)
-- ---------------------------------------------------------------------
alter table adempimento enable row level security;
drop policy if exists staff_full on adempimento;
create policy staff_full on adempimento
  for all to authenticated using (true) with check (true);

alter table corso_alias enable row level security;
drop policy if exists staff_full on corso_alias;
create policy staff_full on corso_alias
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_adempimento_upd on adempimento;
create trigger trg_adempimento_upd before update on adempimento
  for each row execute function set_updated_at();

drop trigger if exists trg_corso_alias_upd on corso_alias;
create trigger trg_corso_alias_upd before update on corso_alias
  for each row execute function set_updated_at();
