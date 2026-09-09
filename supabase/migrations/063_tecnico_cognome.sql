-- 063 - tecnico.cognome: la colonna che il codice usa da sempre e che nessuna
-- migrazione ha mai creato.
--
-- Il commento in src/lib/admin/tecnici.ts cita la "migration 010", ma la 010
-- aggiunge azione.notificata_il; il commit e29107c ("nome e cognome separati")
-- tocca cinque file src/ e zero migrazioni. In produzione la colonna e' stata
-- aggiunta a mano, quindi l'app funziona: il difetto e' la RIPRODUCIBILITA'.
-- Su un ambiente ricreato dalle migrazioni, risolviTecnico (src/lib/auth.ts:14)
-- la mette nella select del login, PostgREST risponde errore, si ripiega sulla
-- cache e senza cache l'utente finisce in fase 'offline': login rotto per
-- tutti, con un messaggio che dice "sei offline" mentre sei online.
--
-- Idempotente: su produzione, dove la colonna gia' c'e', non fa nulla.
-- Nullable per retrocompatibilita' con le righe esistenti, come il codice
-- gia' assume (tecnici.ts legge t.cognome ?? '').

alter table tecnico add column if not exists cognome text;
