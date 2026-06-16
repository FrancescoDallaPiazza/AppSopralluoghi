-- =====================================================================
-- 018 - Organigramma come checklist ragionata.
--
-- Arricchisce figura_sicurezza con i metadati estratti dal "quadro obblighi
-- formativi" della skill consulente-formazione-81 (ASR 17/04/2025): blocco
-- logico (gruppo), ordine di blocco, testo guida (quando scatta / cosa serve)
-- e tipo di obbligo. Aggiunge inoltre la figura "operatore attrezzature"
-- (art. 73 c.5) che mancava. Tutto additivo e idempotente.
-- =====================================================================

-- 1. Nuove colonne descrittive (idempotenti)
alter table figura_sicurezza add column if not exists gruppo text;
alter table figura_sicurezza add column if not exists gruppo_ordine int;
alter table figura_sicurezza add column if not exists guida text;
alter table figura_sicurezza add column if not exists obbligo text;

-- 2. Seed dei metadati ragionati per figura (UPDATE idempotenti per codice)
update figura_sicurezza set gruppo = 'Vertice e deleghe', gruppo_ordine = 10, obbligo = 'sempre',
  guida = 'Sempre presente. Corso base 16h entro il 19/05/2027, aggiornamento 6h ogni 5 anni. Esonerato se ha attestato da dirigente o DL-RSPP. Piu'' 6h cantieri se impresa affidataria.'
  where codice = 'datore_lavoro';

update figura_sicurezza set gruppo = 'Vertice e deleghe', gruppo_ordine = 10, obbligo = 'condizionale',
  guida = 'Solo se il datore gestisce di persona la sicurezza come RSPP. Assegna questa figura alla stessa persona del datore. In aggiunta al corso base: modulo comune 8h piu'' moduli di settore.'
  where codice = 'dl_rspp';

update figura_sicurezza set gruppo = 'Vertice e deleghe', gruppo_ordine = 10, obbligo = 'eventuale',
  guida = 'Chi ha poteri di organizzazione e spesa e dirige l''attivita''. 12h, aggiornamento 6h ogni 5 anni. Piu'' 6h cantieri se impresa affidataria. L''attestato dirigente esonera dal corso datore 16h.'
  where codice = 'dirigente';

update figura_sicurezza set gruppo = 'Servizio di prevenzione e protezione', gruppo_ordine = 20, obbligo = 'sempre',
  guida = 'Obbligatorio in ogni azienda. Puo'' essere il datore stesso (allora assegna anche Datore-RSPP), un interno designato o un professionista esterno.'
  where codice = 'rspp';

update figura_sicurezza set gruppo = 'Servizio di prevenzione e protezione', gruppo_ordine = 20, obbligo = 'eventuale',
  guida = 'Solo se il servizio di prevenzione e protezione e'' articolato con addetti a supporto dell''RSPP.'
  where codice = 'aspp';

update figura_sicurezza set gruppo = 'Vigilanza', gruppo_ordine = 30, obbligo = 'condizionale',
  guida = 'Chiunque sovrintenda e controlli altri lavoratori (capisquadra, capireparto): anche piu'' persone. 12h piu'' aggiornamento ogni 2 anni. Niente e-learning.'
  where codice = 'preposto';

update figura_sicurezza set gruppo = 'Rappresentanza dei lavoratori', gruppo_ordine = 40, obbligo = 'sempre',
  guida = 'Sempre previsto: interno eletto/designato o, in mancanza, territoriale (RLST). 32h, aggiornamento annuale 4h fino a 50 lavoratori, 8h oltre.'
  where codice = 'rls';

update figura_sicurezza set gruppo = 'Gestione delle emergenze', gruppo_ordine = 50, obbligo = 'sempre',
  guida = 'Addetti designati sempre necessari. Livello 1/2/3 (4/8/16h) secondo il rischio incendio dell''azienda; aggiornamento ogni 5 anni.'
  where codice = 'addetto_antincendio';

update figura_sicurezza set gruppo = 'Gestione delle emergenze', gruppo_ordine = 50, obbligo = 'sempre',
  guida = 'Addetti designati sempre necessari. Gruppo A 16h o gruppi B-C 12h secondo la classificazione dell''azienda; aggiornamento ogni 3 anni.'
  where codice = 'addetto_primo_soccorso';

update figura_sicurezza set gruppo = 'Lavoratori', gruppo_ordine = 60, obbligo = 'sempre',
  guida = 'Tutti i lavoratori: generale 4h (credito permanente) piu'' specifica 4/8/12h secondo il rischio, prima dell''adibizione. Aggiornamento 6h ogni 5 anni.'
  where codice = 'lavoratore';

-- 3. Nuova figura: operatore attrezzature ad abilitazione (art. 73 c.5)
insert into figura_sicurezza (codice, nome, ordine, gruppo, gruppo_ordine, obbligo, guida) values
  ('operatore_attrezzatura', 'Operatore attrezzature abilitate (art. 73)', 90,
   'Abilitazioni attrezzature', 70, 'eventuale',
   'Solo se si usano attrezzature ad abilitazione (carrelli, PLE, gru, ecc., art. 73 c.5). Ore secondo l''attrezzatura; aggiornamento ogni 5 anni (min 4h).')
on conflict (codice) do nothing;

insert into figura_requisito (figura_codice, corso_codice, obbligatorio, per_categoria) values
  ('operatore_attrezzatura', 'ATTR_GENERICO', true, true)
on conflict (figura_codice, corso_codice) do nothing;
