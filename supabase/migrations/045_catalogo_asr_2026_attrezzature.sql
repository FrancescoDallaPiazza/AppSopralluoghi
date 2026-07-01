-- =====================================================================
-- 045 - Catalogo ASR 2026: attrezzature splittate per tipo + lavori speciali
--   e BLSD. Seeding dei corsi mancanti dall'xlsx ASR26-TabellaCorsi, con la
--   pulizia gia' applicata (durata -> ore; periodicita in mesi; riga base e
--   riga "aggiornamento" fuse su un solo corso: ore + aggiornamento_mesi +
--   ore_aggiornamento).
--
--   AMBITO: SOLO AGGIUNTA di corsi di RIFERIMENTO nuovi. Non tocca i corsi
--   gia' esistenti (LAV_GEN, LAV_SPEC, PREPOSTO, DIRIGENTE, RSPP_MOD_*,
--   DL_RSPP_*, PS_GRA/PS_GRBC, AI_LIV1/2/3, RLS, DATORE_LAVORO), che restano
--   com'erano. In particolare LAV_SPEC resta a ore variabili per rischio
--   (calcolate nel motore), quindi NON viene splittato.
--
--   Le attrezzature erano modellate da un unico corso generico ATTR_GENERICO
--   (obbligo art. 73), che RESTA. Qui si aggiungono i corsi specifici per
--   TIPO, disponibili da registrare come formazione della persona. NON sono
--   legati alle figure (nessun figura_requisito): quali attrezzature servano
--   dipende dal cliente, e l'obbligo generico continua a passare per
--   ATTR_GENERICO. L'eventuale requisito puntuale e' un passo per-cliente.
--
--   Aggiornamento attrezzature: 4h ogni 5 anni (60 mesi). BLSD: retraining
--   ogni 24 mesi.
-- Idempotente (on conflict codice). Commenti solo ASCII.
-- =====================================================================

insert into corso_catalogo
  (codice, nome, categoria, ore, aggiornamento_mesi, ore_aggiornamento, prerequisito_codice, note) values
  -- Attrezzature (art. 73) - un corso per tipo. Ore = variante base tipica.
  ('ATTR_CARRELLO',      'Carrello elevatore (art. 73)',                 'attrezzature',   12, 60, 4, null, 'Varianti: industriali semoventi, a braccio telescopico, rotativi (12-16h).'),
  ('ATTR_PLE',           'Piattaforme di lavoro elevabili PLE (art. 73)','attrezzature',   10, 60, 4, null, 'Con e/o senza stabilizzatori.'),
  ('ATTR_TRATT_CINGOLI', 'Trattori agricoli/forestali a cingoli (art. 73)','attrezzature', 8,  60, 4, null, null),
  ('ATTR_TRATT_RUOTE',   'Trattori agricoli/forestali a ruote (art. 73)','attrezzature',   8,  60, 4, null, null),
  ('ATTR_ESCAVATORI',    'Escavatori, pale caricatrici, terne (art. 73)','attrezzature',   10, 60, 4, null, 'Idraulici/a fune; combinato con pale/terne 16h.'),
  ('ATTR_GRU_AUTOCARRO', 'Gru su autocarro (art. 73)',                   'attrezzature',   12, 60, 4, null, null),
  ('ATTR_GRU_TORRE',     'Gru a torre (art. 73)',                        'attrezzature',   12, 60, 4, null, 'Rotazione in basso/in alto; entrambe 14h.'),
  ('ATTR_GRU_MOBILI',    'Gru mobili (art. 73)',                         'attrezzature',   14, 60, 4, null, 'Modulo aggiuntivo falcone telescopico/brandeggiabile 8h.'),
  ('ATTR_CARROPONTE',    'Carroponte / gru a ponte (art. 73)',           'attrezzature',   10, 60, 4, null, 'Comando in cabina/pensile/radiocomandato (10-11h).'),
  -- Lavori speciali (categoria a se': non attrezzature, non legati a figure).
  ('ATTR_LAV_QUOTA',     'Lavori in quota e DPI anticaduta',             'lavori_speciali',8,  60, 4, null, null),
  ('ATTR_LAV_ELETTRICI', 'Lavori elettrici PES/PAV/PEI (CEI 11-27)',     'lavori_speciali',16, 60, 4, null, 'Norme e lavori sotto tensione secondo mansione.'),
  ('ATTR_AMB_CONFINATI', 'Ambienti sospetti di inquinamento o confinati','lavori_speciali',12, 60, 4, null, null),
  -- BLSD (defibrillazione) - complemento del primo soccorso.
  ('PS_BLSD_LAICO',      'BLSD laico (IRC)',                             'primo_soccorso', 5,  24, 3, null, 'Retraining ogni 24 mesi.'),
  ('PS_BLSD_SANITARIO',  'BLSD sanitario (IRC)',                         'primo_soccorso', 8,  24, null, null, 'Solo personale sanitario/soccorritori. Retraining ogni 24 mesi.')
on conflict (codice) do update set
  nome = excluded.nome,
  categoria = excluded.categoria,
  ore = excluded.ore,
  aggiornamento_mesi = excluded.aggiornamento_mesi,
  ore_aggiornamento = excluded.ore_aggiornamento,
  note = excluded.note,
  attivo = true,
  updated_at = now();
