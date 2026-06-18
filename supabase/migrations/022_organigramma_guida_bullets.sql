-- 022_organigramma_guida_bullets.sql
-- Descrizioni (guida) delle figure dell'organigramma in formato elenco puntato,
-- secondo il quadro obblighi formativi ASR 17/04/2025. Solo dati di catalogo
-- (testo a video). ASCII-only. Le sotto-voci iniziano con "- ".

update figura_sicurezza set guida = E'Corso base 16h entro il 19/05/2027\n6h cantieri se impresa affidataria ex art. 97 c.3-ter D.Lgs. 81/2008 (cantieri temporanei e mobili)\nAggiornamento 6h ogni 5 anni\nEsonerato se ha attestato da dirigente o DL-RSPP' where codice = 'datore_lavoro';
update figura_sicurezza set guida = E'Prerequisito: corso base Datore di lavoro 16h\nModulo comune 8h, piu'' moduli di settore (ATECO 2007):\n- 16h  A 01-02 Agricoltura, silvicoltura e zootecnia\n- 12h  A 03 Pesca\n- 16h  F Costruzioni\n- 16h  C Manifatturiere (19 coke, 20 prodotti chimici)\nAggiornamento 8h ogni 5 anni' where codice = 'dl_rspp';
update figura_sicurezza set guida = E'Corso 12h\nAggiornamento 6h ogni 5 anni' where codice = 'dirigente';
update figura_sicurezza set guida = E'Modulo A 28h\nModulo B comune 48h, piu'' moduli di settore (ATECO 2007):\n- 16h  A 01-02 Agricoltura, silvicoltura e zootecnia\n- 12h  A 03 Pesca\n- 16h  F Costruzioni\n- 12h  Q 86.1 e 87 Sanita'' e assistenza sociale\n- 16h  C Manifatturiere (19 coke, 20 prodotti chimici)\nAggiornamento 40h ogni 5 anni' where codice = 'rspp';
update figura_sicurezza set guida = E'Prerequisito: corso lavoratore (generale + specifica)\nCorso 12h\nAggiornamento 6h ogni 2 anni' where codice = 'preposto';
update figura_sicurezza set guida = E'Formazione generale 4h\nFormazione specifica per rischio:\n- BASSO  4h\n- MEDIO  8h\n- ALTO  12h\nAggiornamento 6h ogni 5 anni' where codice = 'lavoratore';
update figura_sicurezza set guida = E'Corso formazione 32h\nAggiornamento annuale:\n- 4h se azienda con meno di 50 dipendenti\n- 8h se azienda con almeno 50 dipendenti' where codice = 'rls';
update figura_sicurezza set guida = E'Livello 1: corso 4h, aggiornamento 2h ogni 5 anni\nLivello 2: corso 8h, aggiornamento 5h ogni 5 anni\nLivello 3: corso 16h, aggiornamento 8h ogni 5 anni' where codice = 'addetto_antincendio';
update figura_sicurezza set guida = E'Gruppo A: corso 16h\nGruppi B-C: corso 12h\nAggiornamento ogni 3 anni:\n- 6h aziende Gruppo A\n- 4h aziende Gruppi B-C' where codice = 'addetto_primo_soccorso';
