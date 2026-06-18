-- 025_organigramma_guida_verbatim.sql
-- Riscrive le descrizioni (guida) delle figure ESATTAMENTE come nell'allegato
-- cliente (quadro obblighi ASR 17/04/2025): testo verbatim, sotto-voci dove
-- indicate. Supera la 022. Le sotto-voci iniziano con "- ". I valori sono UTF-8
-- (accenti, trattino lungo); i commenti restano ASCII.

update figura_sicurezza set guida = E'Corso base 16h entro il 19/05/2027 +\n- 6h cantieri se impresa affidataria ex art. 97, comma 3 ter, 81/2008 (cantieri temporanei e mobili).\nAggiornamento 6h ogni 5 anni\nEsonerato se ha attestato da dirigente o DL-RSPP.' where codice = 'datore_lavoro';
update figura_sicurezza set guida = E'Prerequisito: Frequenza Corso base Datore di lavoro 16h\nModulo comune 8h +\n- 16 h se ATECO 2007: A 01-02 – Agricoltura, Silvicoltura e Zootecnia\n- 12 h se ATECO 2007: A 03 – Pesca\n- 16 h se ATECO 2007: F – Costruzioni\n- 16 h se ATECO 2007: C – Attività manifatturiere (19 – Fabbricazione di coke e 20 – Fabbricazione di prodotti chimici)\nAggiornamento 8h ogni 5 anni' where codice = 'dl_rspp';
update figura_sicurezza set guida = E'Corso 12h\nAggiornamento 6h ogni 5 anni' where codice = 'dirigente';
update figura_sicurezza set guida = E'Modulo A 28h\nModulo B comune 48h +\n- 16 h se ATECO 2007: A 01-02 – Agricoltura, Silvicoltura e Zootecnia\n- 12 h se ATECO 2007: A 03 – Pesca\n- 16 h se ATECO 2007: F – Costruzioni\n- 12 h se ATECO 2007: Q. 86.1 e 87 – Sanità ed assistenza sociale\n- 16 h se ATECO 2007: C – Attività manifatturiere (19 – Fabbricazione di coke e 20 – Fabbricazione di prodotti chimici)\nAggiornamento 40h ogni 5 anni' where codice = 'rspp';
update figura_sicurezza set guida = E'Prerequisito: Frequenza Corso formazione lavoratore base + specifica\nCorso 12h\nAggiornamento 6h ogni 2 anni' where codice = 'preposto';
update figura_sicurezza set guida = E'Corso formazione generale 4h +\n- Se rischio BASSO, corso formazione specifica 4h\n- Se rischio MEDIO, corso formazione specifica 8h\n- Se rischio ALTO, corso formazione specifica 12h\nAggiornamento 6h ogni 5 anni' where codice = 'lavoratore';
update figura_sicurezza set guida = E'Corso formazione 32h\nAggiornamento:\n- 4h ogni anno per aziende con meno di 50 dipendenti\n- 8h ogni anno per aziende con almeno 50 dipendenti' where codice = 'rls';
update figura_sicurezza set guida = E'Corso formazione Livello 1 4h – Aggiornamento 2h ogni 5 anni\nCorso formazione Livello 2 8h – Aggiornamento 5h ogni 5 anni\nCorso formazione Livello 3 16h – Aggiornamento 8h ogni 5 anni' where codice = 'addetto_antincendio';
update figura_sicurezza set guida = E'Corso formazione Gruppo A 16h\nCorso formazione Gruppi B-C 12h\nAggiornamento:\n- 6h ogni 3 anni per aziende Gruppo A\n- 4h ogni 3 anni per aziende Gruppi B-C' where codice = 'addetto_primo_soccorso';
