-- =====================================================================
-- 002 · Generalizzazione del modello checklist in "form configurabile".
-- Tutto ADDITIVO: nuove colonne nullable / con default, nessuna modifica
-- distruttiva. Le tre checklist reali (audit conformità, raccolta dati,
-- audit periodico a rilievi liberi) si descrivono con questo modello.
--
-- Idee chiave:
--  * ogni voce ha un TIPO (scelta, testo, data, numero, slider, foto, rilievo…)
--  * le voci a scelta portano le PROPRIE opzioni + conseguenze in `config` (jsonb)
--  * le SOTTO-DOMANDE sono voci figlie (parent_voce_id) mostrate solo quando il
--    genitore assume una certa opzione (mostra_se_chiave)
--  * l'esito salva il VALORE di qualunque tipo (jsonb), oltre allo stato derivato
--  * le azioni di tipo scadenza ricorrente portano la periodicità
-- =====================================================================

-- ---- voce_template: tipo, codice stabile, albero, configurazione ----
alter table voce_template
  add column if not exists tipo          text not null default 'scelta',
  add column if not exists codice        text,
  add column if not exists descrizione   text,
  add column if not exists obbligatoria  boolean not null default false,
  add column if not exists parent_voce_id uuid references voce_template(id) on delete cascade,
  add column if not exists mostra_se_chiave text,
  add column if not exists config        jsonb not null default '{}'::jsonb;

-- tipi ammessi per una voce
alter table voce_template drop constraint if exists voce_template_tipo_chk;
alter table voce_template add constraint voce_template_tipo_chk
  check (tipo in ('scelta','multiscelta','testo','data','numero','slider','foto','rilievo'));

-- le sotto-domande e le voci ripetibili rompono l'unicità per ordine: la rimuovo
alter table voce_template drop constraint if exists voce_template_template_id_ordine_key;

-- codice stabile per voce (usato per linkare i figli nei seed e tra versioni)
create unique index if not exists uq_voce_codice
  on voce_template(template_id, codice) where codice is not null;
create index if not exists idx_voce_parent on voce_template(parent_voce_id);

-- Forma attesa di voce_template.config (jsonb), per tipo:
--  scelta / multiscelta:
--    {
--      "opzioni": [
--        { "chiave":"ok",   "etichetta":"OK - Presente", "stato":"positivo" },
--        { "chiave":"prog", "etichetta":"Da Programmare", "stato":"da_fare",
--          "genera_azione": true },
--        { "chiave":"na",   "etichetta":"N/A",            "stato":"non_applicabile" }
--      ],
--      "scadenza": { "abilitata": true, "periodicita_default_mesi": 24 },
--      "richiedi_foto_se": ["ok"]
--    }
--    ("stato" logico ∈ positivo | da_fare | non_applicabile | neutro)
--  slider:   { "min":1, "max":5 }
--  foto:     { "ripetibile": true }
--  rilievo:  { "ripetibile": true, "azione_opzionale": true }
--  testo/data/numero: {}  (eventuale "placeholder"/"aiuto")

-- ---- esito_voce: salva il valore di qualunque tipo + l'albero compilato ----
alter table esito_voce
  add column if not exists voce_template_id uuid references voce_template(id) on delete set null,
  add column if not exists voce_tipo        text,
  add column if not exists valore           jsonb,
  add column if not exists parent_esito_id  uuid references esito_voce(id) on delete cascade;

create index if not exists idx_esito_parent on esito_voce(parent_esito_id);
create index if not exists idx_esito_voce_tmpl on esito_voce(voce_template_id);

-- `stato` (esito_stato) resta la sintesi a 3 valori per report/statistiche:
--   stato logico positivo        -> 'conforme'
--   stato logico da_fare         -> 'non_conforme'
--   stato logico non_applicabile -> 'non_applicabile'
--   stato logico neutro          -> NULL
-- `valore` conserva la risposta reale (chiave opzione, testo, data, numero,
-- array per multiscelta…), così la raccolta dati della #2 non perde nulla.

-- ---- azione: periodicità per le scadenze ricorrenti ----
alter table azione
  add column if not exists periodicita_mesi integer;
-- usata per rigenerare la scadenza successiva dopo la verifica (giro successivo).
