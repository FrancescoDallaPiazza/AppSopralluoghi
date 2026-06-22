-- =====================================================================
-- 037 - Opzione A: riduce le sovrapposizioni coi moduli smart.
--   * archivia il capitolo Cap.2 'Formazione' (coperto dal modulo smart);
--   * rimuove la sezione 'Organigramma' da Cap.1 (cascade sulle voci),
--     coperta dal modulo smart ORGANIGRAMMA;
--   * Cap.1 resta con la sola Riunione periodica -> rinominato di conseguenza.
-- Idempotente. Commenti solo ASCII. Dati conservati (archivio, non delete).
-- =====================================================================

-- archivia Cap.2 Formazione (resta nel catalogo, non piu' selezionabile)
update box_catalogo set attivo = false where codice = 'CAP2';

-- rimuove la sezione Organigramma da Cap.1 (cascade sulle sue voci)
delete from box_sezione
 where codice = 'ORGANIGRAMMA'
   and box_id = (select id from box_catalogo where codice = 'CAP1');

-- Cap.1 ora contiene solo la Riunione periodica
update box_catalogo set nome = 'Riunione periodica' where codice = 'CAP1';
