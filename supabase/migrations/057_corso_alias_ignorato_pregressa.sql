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
--   is_aggiornamento : l'alias e' l'AGGIORNAMENTO periodico del corso mappato,
--               non la sua formazione iniziale. Il gestionale ha una riga per
--               l'uno e una per l'altro; corso_catalogo no: l'aggiornamento
--               non e' un corso a se', e' una coppia di colonne del corso base
--               (aggiornamento_mesi, ore_aggiornamento). Percio' entrambe le
--               righe del gestionale si mappano sullo STESSO corso_codice e
--               questo flag e' l'unica cosa che le distingue. L'import di C1b
--               lo copiera' su formazione.is_aggiornamento.
--               NB: il motore non lo legge -- la scadenza esce comunque giusta
--               perche' scegliFormazione prende l'attestato piu' recente per
--               corso_codice e statoDaScadenza somma aggiornamento_mesi a
--               data_completamento. Il flag serve a non spacciare un
--               aggiornamento per un'iniziale nei dati.
--
-- Non e' una convenzione del gestionale ne' un campo derivabile dal file:
-- le tre colonne le decide l'operatore in fase di mappatura.

alter table corso_alias add column if not exists ignorato         boolean not null default false;
alter table corso_alias add column if not exists pregressa        boolean not null default false;
alter table corso_alias add column if not exists is_aggiornamento boolean not null default false;
