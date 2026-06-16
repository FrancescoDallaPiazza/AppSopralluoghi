-- =====================================================================
-- 017 - Allineamento del catalogo formativo al "quadro obblighi formativi"
--       della skill consulente-formazione-81 (verifica giugno 2026).
--
-- Riferimenti: D.Lgs. 81/08 art. 37; ASR 17/04/2025; D.M. 02/09/2021
-- (antincendio); D.M. 388/2003 (primo soccorso). Vedi quadro_obblighi_formativi.
--
-- Da applicare DOPO 015 e 016. Solo correzioni di dati e aggiunte idempotenti,
-- nessuna modifica di struttura. La rifinitura legale resta in capo al consulente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CORREZIONE - Dirigente: il nuovo ASR porta la formazione iniziale
--    da 16h a 12h (erano 16h con l'accordo 2011).
-- ---------------------------------------------------------------------
update corso_catalogo
   set ore  = 12,
       note = 'ASR 17/04/2025: 12h (erano 16h con accordo 2011). Aggiornamento 6h ogni 5 anni. Piu'' 6h modulo cantieri se dirigente dell''impresa affidataria (art. 97 c.3-ter).'
 where codice = 'DIRIGENTE';

-- ---------------------------------------------------------------------
-- 2. RIFINITURA - Datore di lavoro base: conferma termine 19/05/2027 e
--    aggiunge l'esonero da attestato dirigente; richiama il modulo cantieri.
-- ---------------------------------------------------------------------
update corso_catalogo
   set note = 'Obbligo introdotto dall''ASR 17/04/2025 per tutti i datori di lavoro; prima applicazione entro 19/05/2027. Aggiornamento 6h ogni 5 anni. Esonero se gia'' in possesso di attestato da dirigente o da DL-RSPP. Piu'' 6h modulo cantieri se datore di lavoro dell''impresa affidataria (art. 97 c.3-ter). Distinto dal percorso DL-RSPP (art. 34).'
 where codice = 'DATORE_LAVORO';

update esonero_ammesso
   set descrizione = 'Esonero / credito totale per chi possiede attestato da dirigente, RSPP, ASPP, Coordinatore o DL-RSPP.'
 where corso_codice = 'DATORE_LAVORO' and tipo = 'credito_pregresso';

-- ---------------------------------------------------------------------
-- 3. AGGIUNTA - Modulo aggiuntivo cantieri (6h) a catalogo. Condizionato
--    all'impresa affidataria: non e' un requisito generale, quindi NON
--    viene aggiunto a figura_requisito (eviterebbe falsi "mancante");
--    e' reso disponibile come corso e segnalato come promemoria (punto 4).
-- ---------------------------------------------------------------------
insert into corso_catalogo (codice, nome, categoria, ore, aggiornamento_mesi, ore_aggiornamento, prerequisito_codice, note) values
  ('CANTIERI', 'Modulo aggiuntivo cantieri', 'cantieri', 6, null, null, null,
   'Modulo aggiuntivo 6h per datore di lavoro e dirigente dell''impresa affidataria in cantieri (art. 97 c.3-ter). Termine prima applicazione 19/05/2027. Segue il ciclo di aggiornamento della figura.')
on conflict (codice) do nothing;

-- ---------------------------------------------------------------------
-- 4. AGGIUNTA - Promemoria del modulo cantieri sulle figure interessate
--    (mostrato sotto il requisito della figura, senza segnarlo obbligatorio).
--    Idempotente via where-not-exists sull'ordine.
-- ---------------------------------------------------------------------
insert into esonero_ammesso (corso_codice, figura_codice, tipo, descrizione, riferimento_norm, ordine)
select 'DIRIGENTE', null, 'altro',
       'Modulo aggiuntivo: se dirigente dell''impresa affidataria in cantieri, occorrono 6h in piu'' (modulo cantieri).',
       'art. 97 c.3-ter D.Lgs 81/08; ASR 17/04/2025', 100
where not exists (
  select 1 from esonero_ammesso where corso_codice = 'DIRIGENTE' and tipo = 'altro' and ordine = 100
);

insert into esonero_ammesso (corso_codice, figura_codice, tipo, descrizione, riferimento_norm, ordine)
select 'DATORE_LAVORO', null, 'altro',
       'Modulo aggiuntivo: se datore di lavoro dell''impresa affidataria in cantieri, occorrono 6h in piu'' (modulo cantieri).',
       'art. 97 c.3-ter D.Lgs 81/08; ASR 17/04/2025', 101
where not exists (
  select 1 from esonero_ammesso where corso_codice = 'DATORE_LAVORO' and tipo = 'altro' and ordine = 101
);
