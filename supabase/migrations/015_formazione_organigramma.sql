-- =====================================================================
-- 015 - Subapp "Organigramma sicurezza & Formazione".
--
-- Modulo per tenere, per ogni cliente, l'organigramma della sicurezza
-- (persone + figure ricoperte) e tracciarne la rispondenza al percorso
-- formativo previsto (D.Lgs. 81/08 + ASR 17/04/2025).
--
-- Tutto ADDITIVO e idempotente: nuove tabelle + una colonna nullable su
-- cliente. Nessuna modifica distruttiva. RLS coerente con la Fase 1
-- (policy "staff_full": utenti autenticati, gating per ruolo lato app).
--
-- Idee chiave:
--   * corso_catalogo  = "percorso previsto" come DATO editabile (ore, mesi di
--     aggiornamento, prerequisito). E' il riferimento.
--   * figura_sicurezza + figura_requisito = quali corsi servono a ogni figura
--     dell'organigramma. "per_categoria" = soddisfatto da un qualunque corso
--     della stessa categoria (tipico di antincendio e primo soccorso, dove il
--     livello/gruppo lo si registra sull'attestato).
--   * persona = elenco del personale del cliente.
--   * nomina  = quali figure ricopre una persona (l'organigramma vero).
--   * formazione = gli attestati effettivi (lo "stato attuale").
--   * cliente.livello_rischio (basso/medio/alto) -> il motore in app espande le
--     ore della formazione specifica lavoratori (4/8/12) e ne ricava lo stato.
--
-- I "codice" sono stabili e referenziati per chiave naturale: figura_requisito
-- e nomina usano FK verso figura_sicurezza(codice) / corso_catalogo(codice).
-- formazione.corso_codice resta testo libero (no FK) per poter registrare anche
-- attestati storici o corsi fuori catalogo; il match col catalogo lo fa il
-- motore lato app.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Pre-requisito: livello di rischio del cliente (additivo)
-- ---------------------------------------------------------------------
alter table cliente
  add column if not exists livello_rischio text;

alter table cliente drop constraint if exists cliente_livello_rischio_chk;
alter table cliente add constraint cliente_livello_rischio_chk
  check (livello_rischio is null or livello_rischio in ('basso','medio','alto'));

-- ---------------------------------------------------------------------
-- 1. Catalogo dei corsi (il "percorso previsto")
-- ---------------------------------------------------------------------
create table if not exists corso_catalogo (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique,            -- chiave stabile (es. LAV_GEN)
  nome text not null,
  categoria text not null,                -- lavoratore, preposto, dirigente,
                                          -- dl_rspp, rspp_aspp, antincendio,
                                          -- primo_soccorso, rls, attrezzature, altro
  ore numeric(5,1),                       -- null = variabile (es. LAV_SPEC by rischio)
  aggiornamento_mesi int,                 -- periodicita aggiornamento; null = non si aggiorna
  ore_aggiornamento numeric(5,1),
  prerequisito_codice text,               -- soft ref a un altro corso del catalogo
  note text,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_corso_catalogo_categoria on corso_catalogo(categoria);

-- ---------------------------------------------------------------------
-- 2. Figure della sicurezza (i ruoli dell'organigramma)
-- ---------------------------------------------------------------------
create table if not exists figura_sicurezza (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique,            -- es. preposto, lavoratore, dl_rspp
  nome text not null,
  ordine int not null default 0,
  attiva boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Requisiti formativi per figura (il "percorso previsto" per ruolo)
-- ---------------------------------------------------------------------
create table if not exists figura_requisito (
  id uuid primary key default gen_random_uuid(),
  figura_codice text not null references figura_sicurezza(codice) on delete cascade,
  corso_codice text not null references corso_catalogo(codice) on delete cascade,
  obbligatorio boolean not null default true,
  -- true = il requisito e' soddisfatto da QUALSIASI corso della stessa
  -- categoria del corso indicato (es. addetto antincendio: vale liv.1/2/3).
  per_categoria boolean not null default false,
  note text,
  unique (figura_codice, corso_codice)
);
create index if not exists idx_figura_requisito_figura on figura_requisito(figura_codice);

-- ---------------------------------------------------------------------
-- 4. Personale del cliente
-- ---------------------------------------------------------------------
create table if not exists persona (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id) on delete cascade,
  nome text not null,
  cognome text,
  codice_fiscale text,
  mansione text,
  reparto text,
  data_assunzione date,
  -- override opzionale del rischio per la formazione specifica lavoratori;
  -- se null, si eredita cliente.livello_rischio.
  livello_rischio text,
  attivo boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint persona_livello_rischio_chk
    check (livello_rischio is null or livello_rischio in ('basso','medio','alto'))
);
create index if not exists idx_persona_cliente on persona(cliente_id);

-- ---------------------------------------------------------------------
-- 5. Nomine: quali figure ricopre una persona (l'organigramma)
-- ---------------------------------------------------------------------
create table if not exists nomina (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references persona(id) on delete cascade,
  figura_codice text not null references figura_sicurezza(codice) on delete restrict,
  data_nomina date,
  attiva boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (persona_id, figura_codice)
);
create index if not exists idx_nomina_persona on nomina(persona_id);

-- ---------------------------------------------------------------------
-- 6. Formazione svolta (gli attestati = lo "stato attuale")
-- ---------------------------------------------------------------------
create table if not exists formazione (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references persona(id) on delete cascade,
  corso_codice text,                      -- soft ref a corso_catalogo.codice
  corso_nome text not null,               -- snapshot/etichetta (anche fuori catalogo)
  categoria text,
  data_completamento date,
  ore numeric(5,1),
  ente_formatore text,
  is_aggiornamento boolean not null default false,
  -- scadenza esplicita; se null, il motore in app la calcola dalla data +
  -- aggiornamento_mesi del corso a catalogo.
  scadenza date,
  allegato_url text,                      -- eventuale PDF su Storage
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_formazione_persona on formazione(persona_id);
create index if not exists idx_formazione_corso on formazione(corso_codice);

-- ---------------------------------------------------------------------
-- 6-bis. Esoneri / crediti documentati
--   Marca un requisito come soddisfatto SENZA un corso corrispondente, sulla
--   base di un titolo, un'abilitazione, un ruolo equipollente o formazione
--   pregressa riconosciuta. NON e' una decisione automatica dell'app: e' un
--   atto registrato dal back-office con motivazione e riferimento normativo,
--   cosi resta tracciabile (audit) che il requisito poggia su un credito.
--
--   Ambito:
--     * corso_codice valorizzato  -> esonero su quello specifico corso/modulo
--       (es. RSPP_MOD_B per titolo di laurea, art. 32 c.5 D.Lgs 81/08);
--     * figura_codice valorizzato (e corso null) -> esonero esteso alla figura;
--     * entrambi -> esonero di quel corso limitatamente a quella figura.
--   Il motore in app tratta un esonero attivo come requisito soddisfatto, con
--   stato distinto "esonerato" (neutro), separato da "conforme".
--
--   I crediti AUTOMATICI (formazione generale permanente; corso condiviso da
--   piu' ruoli della stessa persona contato una volta) NON usano questa tabella:
--   li applica direttamente il motore. Qui finiscono solo gli esoneri motivati.
-- ---------------------------------------------------------------------
create table if not exists esonero (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references persona(id) on delete cascade,
  corso_codice text,                      -- soft ref a corso_catalogo.codice; null = intera figura
  figura_codice text references figura_sicurezza(codice) on delete cascade,
  tipo text not null default 'credito_pregresso',
  motivazione text not null,
  riferimento_norm text,                  -- es. art. 32 c.5 D.Lgs 81/08
  documento_url text,                     -- eventuale titolo/abilitazione su Storage
  data_riconoscimento date,
  attivo boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint esonero_tipo_chk
    check (tipo in ('titolo_studio','abilitazione','ruolo_equipollente','credito_pregresso','altro')),
  -- almeno uno tra corso e figura deve essere indicato
  constraint esonero_ambito_chk
    check (corso_codice is not null or figura_codice is not null)
);
create index if not exists idx_esonero_persona on esonero(persona_id);

-- ---------------------------------------------------------------------
-- 6-ter. Catalogo degli ESONERI AMMESSI (informativo, per il campo)
--   Promemoria mostrato dal tecnico accanto a un requisito: "possibile esonero
--   se ...". NON e' una decisione e non incide sul semaforo finche' non si
--   registra un vero `esonero` per la persona. Serve a evitare che il tecnico
--   debba consultare l'Accordo per sapere quali esoneri esistono.
--   Editabile dal back-office: lo seed parte dai casi piu' consolidati.
--   Ambito: per corso (corso_codice) e/o per figura (figura_codice).
-- ---------------------------------------------------------------------
create table if not exists esonero_ammesso (
  id uuid primary key default gen_random_uuid(),
  corso_codice text references corso_catalogo(codice) on delete cascade,
  figura_codice text references figura_sicurezza(codice) on delete cascade,
  tipo text not null default 'titolo_studio',
  descrizione text not null,              -- etichetta mostrata in campo
  riferimento_norm text,
  ordine int not null default 0,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint esonero_ammesso_tipo_chk
    check (tipo in ('titolo_studio','abilitazione','ruolo_equipollente','credito_pregresso','altro')),
  constraint esonero_ammesso_ambito_chk
    check (corso_codice is not null or figura_codice is not null)
);
create index if not exists idx_esonero_ammesso_corso on esonero_ammesso(corso_codice);
create index if not exists idx_esonero_ammesso_figura on esonero_ammesso(figura_codice);

-- ---------------------------------------------------------------------
-- 7. Trigger updated_at (guardati, come in 009)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists trg_corso_catalogo_upd on corso_catalogo;
    create trigger trg_corso_catalogo_upd before update on corso_catalogo
      for each row execute function set_updated_at();

    drop trigger if exists trg_figura_sicurezza_upd on figura_sicurezza;
    create trigger trg_figura_sicurezza_upd before update on figura_sicurezza
      for each row execute function set_updated_at();

    drop trigger if exists trg_persona_upd on persona;
    create trigger trg_persona_upd before update on persona
      for each row execute function set_updated_at();

    drop trigger if exists trg_nomina_upd on nomina;
    create trigger trg_nomina_upd before update on nomina
      for each row execute function set_updated_at();

    drop trigger if exists trg_formazione_upd on formazione;
    create trigger trg_formazione_upd before update on formazione
      for each row execute function set_updated_at();

    drop trigger if exists trg_esonero_upd on esonero;
    create trigger trg_esonero_upd before update on esonero
      for each row execute function set_updated_at();

    drop trigger if exists trg_esonero_ammesso_upd on esonero_ammesso;
    create trigger trg_esonero_ammesso_upd before update on esonero_ammesso
      for each row execute function set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 8. RLS (Fase 1: permissiva, gating per ruolo lato app)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'corso_catalogo','figura_sicurezza','figura_requisito',
    'persona','nomina','formazione','esonero','esonero_ammesso'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists staff_full on %I', t);
    execute format(
      'create policy staff_full on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 9. SEED - catalogo corsi
--   ore di aggiornamento e periodicita secondo D.Lgs. 81/08 + ASR 17/04/2025;
--   valori editabili dal back-office. Le note segnalano le varianti.
-- ---------------------------------------------------------------------
insert into corso_catalogo (codice, nome, categoria, ore, aggiornamento_mesi, ore_aggiornamento, prerequisito_codice, note) values
  ('LAV_GEN',        'Formazione generale lavoratori',            'lavoratore',     4,    null, null, null,            'Parte comune, non scade di per se; l''aggiornamento quinquennale del lavoratore e'' modellato su LAV_SPEC.'),
  ('LAV_SPEC',       'Formazione specifica lavoratori',           'lavoratore',     null, 60,   6,    'LAV_GEN',       'Ore secondo rischio: basso 4, medio 8, alto 12. Aggiornamento 6h ogni 5 anni.'),
  ('PREPOSTO',       'Formazione preposto',                       'preposto',       12,   24,   6,    'LAV_SPEC',      'ASR 17/04/2025: aggiornamento biennale 6h. Richiede la formazione da lavoratore.'),
  ('DIRIGENTE',      'Formazione dirigenti',                      'dirigente',      16,   60,   6,    null,            'Aggiornamento 6h ogni 5 anni.'),
  ('DL_RSPP_BASE',   'Datore di lavoro-RSPP - modulo base',       'dl_rspp',        16,   60,   6,    null,            'Modulo base art. 34. Ore aggiornamento storicamente 6/10/14 per rischio: verificare caso.'),
  ('DL_RSPP_COMUNE', 'Datore di lavoro-RSPP - modulo comune',     'dl_rspp',        8,    null, null, 'DL_RSPP_BASE',  'Modulo comune introdotto dall''ASR 17/04/2025.'),
  ('RSPP_MOD_A',     'RSPP/ASPP - Modulo A',                      'rspp_aspp',      28,   null, null, null,            'Propedeutico, comune a RSPP e ASPP.'),
  ('RSPP_MOD_B',     'RSPP/ASPP - Modulo B (comune)',             'rspp_aspp',      48,   60,   40,   'RSPP_MOD_A',    'Aggiornamento RSPP 40h/5 anni, ASPP 20h/5 anni: verificare figura.'),
  ('RSPP_MOD_C',     'RSPP - Modulo C',                           'rspp_aspp',      24,   null, null, 'RSPP_MOD_B',    'Solo per RSPP.'),
  ('AI_LIV1',        'Addetto antincendio - livello 1',           'antincendio',    4,    60,   2,    null,            'DM 02/09/2021. Aggiornamento 2h ogni 5 anni.'),
  ('AI_LIV2',        'Addetto antincendio - livello 2',           'antincendio',    8,    60,   5,    null,            'DM 02/09/2021. Aggiornamento 5h ogni 5 anni.'),
  ('AI_LIV3',        'Addetto antincendio - livello 3',           'antincendio',    16,   60,   8,    null,            'DM 02/09/2021. Aggiornamento 8h ogni 5 anni.'),
  ('PS_GRA',         'Addetto primo soccorso - gruppo A',         'primo_soccorso', 16,   36,   6,    null,            'DM 388/2003. Aggiornamento 6h ogni 3 anni.'),
  ('PS_GRBC',        'Addetto primo soccorso - gruppi B e C',     'primo_soccorso', 12,   36,   4,    null,            'DM 388/2003. Aggiornamento 4h ogni 3 anni.'),
  ('RLS',            'Rappresentante dei lavoratori (RLS)',       'rls',            32,   12,   4,    null,            'Aggiornamento annuale 4h (fino a 50 lavoratori) o 8h (oltre): verificare dimensione.'),
  ('ATTR_GENERICO',  'Attrezzatura abilitante (art. 73)',         'attrezzature',   null, 60,   4,    null,            'Carrelli/PLE/gru ecc.: ore per attrezzatura. Aggiornamento min. 4h ogni 5 anni.')
on conflict (codice) do nothing;

-- ---------------------------------------------------------------------
-- 10. SEED - figure della sicurezza
-- ---------------------------------------------------------------------
insert into figura_sicurezza (codice, nome, ordine) values
  ('datore_lavoro',           'Datore di lavoro',                          10),
  ('dl_rspp',                 'Datore di lavoro che svolge il ruolo di RSPP', 15),
  ('rspp',                    'RSPP',                                      20),
  ('aspp',                    'ASPP',                                      25),
  ('dirigente',               'Dirigente',                                 30),
  ('preposto',                'Preposto',                                  40),
  ('lavoratore',              'Lavoratore',                                50),
  ('rls',                     'RLS',                                       60),
  ('addetto_antincendio',     'Addetto antincendio / gestione emergenze',  70),
  ('addetto_primo_soccorso',  'Addetto primo soccorso',                    80)
on conflict (codice) do nothing;

-- ---------------------------------------------------------------------
-- 11. SEED - requisiti formativi per figura (percorso previsto)
-- ---------------------------------------------------------------------
insert into figura_requisito (figura_codice, corso_codice, obbligatorio, per_categoria) values
  ('dl_rspp',                'DL_RSPP_BASE',   true,  false),
  ('dl_rspp',                'DL_RSPP_COMUNE', true,  false),
  ('rspp',                   'RSPP_MOD_A',     true,  false),
  ('rspp',                   'RSPP_MOD_B',     true,  false),
  ('rspp',                   'RSPP_MOD_C',     true,  false),
  ('aspp',                   'RSPP_MOD_A',     true,  false),
  ('aspp',                   'RSPP_MOD_B',     true,  false),
  ('dirigente',              'DIRIGENTE',      true,  false),
  ('preposto',               'LAV_GEN',        true,  false),
  ('preposto',               'LAV_SPEC',       true,  false),
  ('preposto',               'PREPOSTO',       true,  false),
  ('lavoratore',             'LAV_GEN',        true,  false),
  ('lavoratore',             'LAV_SPEC',       true,  false),
  ('rls',                    'RLS',            true,  false),
  ('addetto_antincendio',    'AI_LIV2',        true,  true),
  ('addetto_primo_soccorso', 'PS_GRBC',        true,  true)
on conflict (figura_codice, corso_codice) do nothing;

-- ---------------------------------------------------------------------
-- 12. SEED - esoneri ammessi (promemoria informativi, editabili)
--   Casi 1 (promemoria): testi ricavati dall'Allegato III dell'ASR 17/04/2025
--   (matrice crediti). Forma condizionale, mostrati in campo accanto al
--   requisito. La decisione e la verifica della "stessa azienda" (asterisco
--   dell'Allegato) spettano al consulente. Testi in ASCII per sicurezza nel
--   SQL Editor: gli accenti si possono sistemare poi dal Table Editor.
--   La matrice deterministica completa (Caso 2) e' un passo successivo.
-- ---------------------------------------------------------------------
insert into esonero_ammesso (corso_codice, figura_codice, tipo, descrizione, riferimento_norm, ordine) values
  ('RSPP_MOD_A', null, 'titolo_studio',
   'Possibile esonero dal Modulo A per laurea tra le classi indicate. Modulo A inoltre a credito per chi proviene da ASPP, Coordinatore o DL-RSPP.',
   'art. 32 c.5 D.Lgs 81/08; Allegato III ASR 17/04/2025', 10),
  ('RSPP_MOD_B', null, 'titolo_studio',
   'Possibile esonero dal Modulo B per laurea tra le classi indicate. Tra percorsi RSPP/ASPP/Coordinatore sono previsti crediti parziali: verificare i moduli specialistici.',
   'art. 32 c.5 D.Lgs 81/08; Allegato III ASR 17/04/2025', 20),
  ('RSPP_MOD_C', null, 'credito_pregresso',
   'Per chi proviene da Coordinatore o DL-RSPP il Modulo C puo'' restare da frequentare (credito parziale). Verificare Allegato III.',
   'Allegato III ASR 17/04/2025', 30),
  ('LAV_GEN', null, 'credito_pregresso',
   'Credito totale per chi possiede formazione da RSPP, ASPP, Coordinatore, DL-RSPP o dirigente. La formazione generale non si ripete cambiando azienda o settore.',
   'Allegato III ASR 17/04/2025', 40),
  ('LAV_SPEC', null, 'credito_pregresso',
   'Possibile credito totale, se il ruolo e'' svolto nella stessa azienda, per chi possiede formazione da RSPP, ASPP, Coordinatore, DL-RSPP o dirigente. Verificare azienda.',
   'Allegato III ASR 17/04/2025', 50),
  ('PREPOSTO', null, 'credito_pregresso',
   'Possibile credito totale, se il ruolo e'' svolto nella stessa azienda, per chi possiede formazione da RSPP, ASPP, Coordinatore, DL-RSPP o dirigente. Verificare azienda.',
   'Allegato III ASR 17/04/2025', 60),
  ('DIRIGENTE', null, 'credito_pregresso',
   'Credito totale per chi possiede formazione da RSPP, ASPP, Coordinatore o DL-RSPP.',
   'Allegato III ASR 17/04/2025', 70),
  ('RLS', null, 'credito_pregresso',
   'Credito totale per chi possiede formazione da RSPP, ASPP o Coordinatore. Per chi proviene da DL-RSPP: frequenza (nessun credito).',
   'Allegato III ASR 17/04/2025', 80)
on conflict do nothing;

