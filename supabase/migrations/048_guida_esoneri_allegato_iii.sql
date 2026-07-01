-- 048_guida_esoneri_allegato_iii.sql
-- Allinea le righe "esonero/credito" mostrate nella scheda di ogni figura
-- (figura_sicurezza.guida) alla matrice crediti dell'Allegato III ASR
-- 17/04/2025. Il testo corretto e' quello gia' presente e blessato nelle
-- esonero_ammesso.descrizione (seed 015, allineato dalla 017): qui viene
-- propagato nella guida, che era rimasta indietro (mostrava solo
-- "dirigente o DL-RSPP" per il datore, e nulla per le altre figure).
--
-- Canale 3 (SQL Editor). Idempotente: replace mirato per il datore, append
-- con guardia NOT LIKE per le altre (nessun doppione al re-run). Non tocca le
-- righe ore/ATECO/aggiornamento gia' presenti. Solo aggiornamento di dati.
--
-- Figure senza crediti incrociati (addetto_antincendio, addetto_primo_soccorso:
-- regime proprio DM 02/09/2021 e DM 388/2003) restano senza riga esonero.
-- dl_rspp non ha un testo di credito autorizzato a catalogo: non modificato.

-- Datore di lavoro: lista Allegato III completa (era monca).
update figura_sicurezza
   set guida = replace(
     guida,
     'Esonerato se ha attestato da dirigente o DL-RSPP.',
     'Esonero / credito totale per chi possiede attestato da dirigente, RSPP, ASPP, Coordinatore o DL-RSPP.')
 where codice = 'datore_lavoro'
   and guida like '%Esonerato se ha attestato da dirigente o DL-RSPP.%';

-- Dirigente.
update figura_sicurezza
   set guida = guida || E'\nCredito totale per chi possiede formazione da RSPP, ASPP, Coordinatore o DL-RSPP.'
 where codice = 'dirigente'
   and guida not like '%Credito totale per chi possiede formazione da RSPP, ASPP, Coordinatore o DL-RSPP%';

-- Preposto (credito "stessa azienda").
update figura_sicurezza
   set guida = guida || E'\nPossibile credito totale, se il ruolo è svolto nella stessa azienda, per chi possiede formazione da RSPP, ASPP, Coordinatore, DL-RSPP o dirigente. Verificare azienda.'
 where codice = 'preposto'
   and guida not like '%Possibile credito totale, se il ruolo è svolto nella stessa azienda%';

-- Lavoratore (generale totale; specifica totale stessa azienda).
update figura_sicurezza
   set guida = guida || E'\nCredito totale della formazione generale per chi possiede formazione da RSPP, ASPP, Coordinatore, DL-RSPP o dirigente. Formazione specifica a credito totale se il ruolo è svolto nella stessa azienda.'
 where codice = 'lavoratore'
   and guida not like '%Credito totale della formazione generale%';

-- RLS.
update figura_sicurezza
   set guida = guida || E'\nCredito totale per chi possiede formazione da RSPP, ASPP o Coordinatore. Per chi proviene da DL-RSPP: frequenza (nessun credito).'
 where codice = 'rls'
   and guida not like '%Credito totale per chi possiede formazione da RSPP, ASPP o Coordinatore%';

-- RSPP (crediti/esoneri sui moduli A/B/C).
update figura_sicurezza
   set guida = guida || E'\nModulo A a credito per chi proviene da ASPP, Coordinatore o DL-RSPP (o esonero per laurea tra le classi indicate). Moduli B/C: crediti parziali per percorsi RSPP/ASPP/Coordinatore, da verificare (Allegato III).'
 where codice = 'rspp'
   and guida not like '%Modulo A a credito per chi proviene da ASPP%';
