-- =====================================================================
-- 053 - Organigramma: deleghe, tassonomia a due blocchi, evidenze nomina.
--
-- Rivede la scheda organigramma secondo il modello richiesto:
--   * due macro-blocchi delle figure: "obbligatoria" (che ci devono essere)
--     e "eventuale" (valutazione caso per caso) -> nuova colonna
--     figura_sicurezza.macro, seedata per ogni figura.
--   * nuova figura Datore di lavoro DELEGATO ex art. 16 D.Lgs. 81/08 (delega
--     di funzioni), con gli estremi della procura -> nuova colonna
--     nomina.estremi_procura. Stesso percorso formativo del datore (corso base
--     16h, DATORE_LAVORO): un figura_requisito verso lo stesso corso.
--   * evidenze documentali collegate alla NOMINA (non all'attestato): nuova
--     tabella nomina_evidenza (visura camerale, atto/procura notarile, atto di
--     nomina, ...), su Storage come gli attestati.
--   * riallineamento obbligo/gruppo: Preposto e RLS tornano condizionali
--     (dipendono dall'organizzazione / obbligo di sola informativa), cosi' non
--     figurano piu' come ruoli obbligatori scoperti nel semaforo.
--
-- Tutto ADDITIVO e idempotente. Commenti solo ASCII (accenti solo nei literal).
-- Canale 3 (Supabase SQL Editor).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Nuove colonne
-- ---------------------------------------------------------------------
alter table figura_sicurezza add column if not exists macro text;

alter table figura_sicurezza drop constraint if exists figura_sicurezza_macro_chk;
alter table figura_sicurezza add constraint figura_sicurezza_macro_chk
  check (macro is null or macro in ('obbligatoria', 'eventuale'));

-- Estremi della procura del datore delegato ex art. 16 (repertorio/data/notaio).
alter table nomina add column if not exists estremi_procura text;

-- ---------------------------------------------------------------------
-- 2. Nuova figura: Datore di lavoro delegato ex art. 16
-- ---------------------------------------------------------------------
insert into figura_sicurezza (codice, nome, ordine) values
  ('datore_lavoro_art16', 'Datore di lavoro delegato (ex art. 16)', 12)
on conflict (codice) do nothing;

-- Stesso corso base del datore di lavoro (16h): il delegato assume gli obblighi
-- del datore, formazione inclusa.
insert into figura_requisito (figura_codice, corso_codice, obbligatorio, per_categoria) values
  ('datore_lavoro_art16', 'DATORE_LAVORO', true, false)
on conflict (figura_codice, corso_codice) do nothing;

-- ---------------------------------------------------------------------
-- 3. Tassonomia a due blocchi (macro) + riallineamento gruppo/obbligo/guida.
--    UPDATE idempotenti per codice.
-- ---------------------------------------------------------------------

-- Blocco OBBLIGATORIO ------------------------------------------------
update figura_sicurezza set
  macro = 'obbligatoria', gruppo = 'Datore di lavoro e deleghe', gruppo_ordine = 10, ordine = 10, obbligo = 'sempre'
  where codice = 'datore_lavoro';

update figura_sicurezza set
  macro = 'obbligatoria', gruppo = 'Datore di lavoro e deleghe', gruppo_ordine = 10, ordine = 12, obbligo = 'eventuale',
  guida = E'Datore di lavoro delegato ex art. 16 D.Lgs. 81/08 (delega di funzioni): eventuale, solo se esiste una delega scritta con data certa.\nRegistrare gli estremi della procura e allegare la visura camerale e l''atto/procura notarile tra le evidenze della nomina.\nStesso percorso del datore: corso base 16h entro il 19/05/2027, aggiornamento 6h ogni 5 anni.'
  where codice = 'datore_lavoro_art16';

update figura_sicurezza set
  macro = 'obbligatoria', gruppo = 'Servizio di prevenzione e protezione', gruppo_ordine = 20, obbligo = 'condizionale'
  where codice = 'dl_rspp';

update figura_sicurezza set
  macro = 'obbligatoria', gruppo = 'Servizio di prevenzione e protezione', gruppo_ordine = 20, obbligo = 'sempre'
  where codice = 'rspp';

update figura_sicurezza set
  macro = 'obbligatoria', gruppo = 'Servizio di prevenzione e protezione', gruppo_ordine = 20, obbligo = 'eventuale'
  where codice = 'aspp';

update figura_sicurezza set
  macro = 'obbligatoria', gruppo = 'Gestione delle emergenze', gruppo_ordine = 30, ordine = 70, obbligo = 'sempre'
  where codice = 'addetto_primo_soccorso';

update figura_sicurezza set
  macro = 'obbligatoria', gruppo = 'Gestione delle emergenze', gruppo_ordine = 30, ordine = 72, obbligo = 'sempre'
  where codice = 'addetto_antincendio';

update figura_sicurezza set
  macro = 'obbligatoria', gruppo = 'Lavoratori', gruppo_ordine = 40, obbligo = 'sempre'
  where codice = 'lavoratore';

-- Blocco EVENTUALE (valutazione caso per caso) -----------------------
update figura_sicurezza set
  macro = 'eventuale', gruppo = 'Dirigenza e vigilanza', gruppo_ordine = 50, ordine = 30, obbligo = 'eventuale'
  where codice = 'dirigente';

-- Preposto: dipende dal tipo di organizzazione -> condizionale (non piu' 'sempre'
-- della 026): non deve figurare come ruolo obbligatorio scoperto.
update figura_sicurezza set
  macro = 'eventuale', gruppo = 'Dirigenza e vigilanza', gruppo_ordine = 50, ordine = 40, obbligo = 'condizionale'
  where codice = 'preposto';

update figura_sicurezza set
  macro = 'eventuale', gruppo = 'Sorveglianza sanitaria', gruppo_ordine = 60, obbligo = 'condizionale'
  where codice = 'medico_competente';

-- RLS: sul datore grava solo l'obbligo di INFORMATIVA sulla facolta' di nomina;
-- se non eletto subentra l'RLST. Non e' un ruolo obbligatorio scoperto.
update figura_sicurezza set
  macro = 'eventuale', gruppo = 'Rappresentanza dei lavoratori', gruppo_ordine = 70, obbligo = 'condizionale',
  guida = E'Non c''e'' obbligo di averlo nominato: sul datore grava il solo obbligo di informare i lavoratori della facolta'' di eleggere/designare l''RLS.\nSe non eletto, subentra il rappresentante territoriale (RLST).\nFormazione: 32h, aggiornamento annuale 4h fino a 50 lavoratori, 8h oltre.'
  where codice = 'rls';

update figura_sicurezza set
  macro = 'eventuale', gruppo = 'Abilitazioni attrezzature', gruppo_ordine = 80, obbligo = 'eventuale'
  where codice = 'operatore_attrezzatura';

-- Le figure eventualmente presenti senza macro assegnata (robustezza).
update figura_sicurezza set macro = 'eventuale' where macro is null;

-- ---------------------------------------------------------------------
-- 4. Evidenze documentali della nomina (Storage: bucket 'attestati').
--    tipo: visura_camerale | atto_procura | atto_nomina | altro.
-- ---------------------------------------------------------------------
create table if not exists nomina_evidenza (
  id uuid primary key default gen_random_uuid(),
  nomina_id uuid not null references nomina(id) on delete cascade,
  tipo text not null default 'atto_nomina',
  allegato_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nomina_evidenza_tipo_chk
    check (tipo in ('visura_camerale', 'atto_procura', 'atto_nomina', 'altro'))
);
create index if not exists idx_nomina_evidenza_nomina on nomina_evidenza(nomina_id);

-- ---------------------------------------------------------------------
-- 4-bis. Aggancio dello scadenzario ("Cose da fare") alla nomina.
--    Una azione "correttiva" per ogni nomina identificata ma priva di atto
--    ufficiale (evidenza da ottenere). Chiave azione = id nomina; cascade sulla
--    nomina cosi' l'azione sparisce se la nomina viene rimossa. La sincronia
--    (upsert quando manca l'evidenza / delete quando arriva) e' lato client, come
--    per gli esoneri (backfillAzioniNominaEvidenza).
-- ---------------------------------------------------------------------
alter table azione add column if not exists origine_nomina_id uuid;
alter table azione drop constraint if exists azione_origine_nomina_fk;
alter table azione add constraint azione_origine_nomina_fk
  foreign key (origine_nomina_id) references nomina(id) on delete cascade;
create index if not exists idx_azione_origine_nomina on azione(origine_nomina_id);

-- ---------------------------------------------------------------------
-- 5. RLS + trigger updated_at (coerente con 015: staff_full permissiva)
-- ---------------------------------------------------------------------
alter table nomina_evidenza enable row level security;
drop policy if exists staff_full on nomina_evidenza;
create policy staff_full on nomina_evidenza
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_nomina_evidenza_upd on nomina_evidenza;
create trigger trg_nomina_evidenza_upd before update on nomina_evidenza
  for each row execute function set_updated_at();
