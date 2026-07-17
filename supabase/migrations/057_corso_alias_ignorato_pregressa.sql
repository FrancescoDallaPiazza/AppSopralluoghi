-- 057_corso_alias_ignorato_pregressa.sql
--
-- C1a - import del catalogo corsi del gestionale + mappatura alias.
--
-- Il catalogo del gestionale (export "Formazione", 74 righe) e' l'universo
-- COMPLETO degli alias: si carica una volta e si mappa. Due colonne mancavano
-- perche' il dizionario possa chiudersi davvero:
--
--   ignorato  : via d'uscita per le righe non pertinenti (ANSF, ECM, PRIVACY,
--               AMBIENTE, SALDATURA ~ 15 su 74). Senza, l'import di C1b -
--               che si blocca finche' restano alias da mappare - resterebbe
--               bloccato in eterno su corsi che non si mapperanno mai.
--   pregressa : l'alias copre un requisito ASR con un attestato di vecchio
--               regime (MARCA_PREGRESSA). L'import di C1b scrivera'
--               note = 'Evidenza pregressa', corso_codice = requisito coperto,
--               corso_nome = nome vero del vecchio corso. Nei dati veri e' UNA
--               riga su 74: e' un alias marcato a mano, non una regola nel
--               parser.
--
-- Non e' una convenzione del gestionale ne' un campo derivabile dal file:
-- entrambe le colonne le decide l'operatore in fase di mappatura.

alter table corso_alias add column if not exists ignorato  boolean not null default false;
alter table corso_alias add column if not exists pregressa boolean not null default false;
