-- =====================================================================
-- 038 - Sfoltisce il Cap.0 Anagrafica: rimuove le voci che duplicano i
--   metadati del sopralluogo (Azienda, Data, Luogo), ora gestiti in testata
--   di compilazione (cliente da incarico, sede selezionabile, data effettiva).
--   Restano: Rif. Doc. Num. e i due Documenti consegnati/presi in consegna.
-- Idempotente. Commenti solo ASCII.
-- =====================================================================

delete from voce_template
 where codice in ('C0-ANG-02', 'C0-ANG-03', 'C0-ANG-04')
   and sezione_id in (
     select id from box_sezione
      where box_id = (select id from box_catalogo where codice = 'CAP0'));
