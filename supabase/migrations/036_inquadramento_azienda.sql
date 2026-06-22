-- =====================================================================
-- 036 - Estrae 'Conformita societaria' da Cap.1 in un capitolo a se':
--   nuovo box generico 'Inquadramento azienda' (INQUADRAMENTO) con 2 sezioni
--   (Profilo attivita + Documenti societari, 5 voci), e RIMOZIONE della
--   sezione Conformita da Cap.1 (cascade sulle sue voci) + rinomina Cap.1.
-- Idempotente: UUID v5 + ON CONFLICT DO NOTHING. Commenti solo ASCII.
-- =====================================================================

-- 1) nuovo capitolo 'Inquadramento azienda'
insert into box_catalogo (id, codice, nome, descrizione, tipo, ordine_default, versione, attivo) values
  ('7bcb23c6-75c7-5747-80aa-5b3b8e0d6a30', 'INQUADRAMENTO', 'Inquadramento azienda',
   'Profilo dell''attivita e documenti societari di inquadramento.', 'generico', 1, 1, true)
on conflict (id) do nothing;

insert into box_sezione (id, box_id, codice, nome, ordine, ripetibile, etichetta_componente) values
  ('069cbcc9-c846-5e82-bf35-a05976b754c8', '7bcb23c6-75c7-5747-80aa-5b3b8e0d6a30', 'PROFILO', 'Profilo dell''attivita', 0, false, null),
  ('b15994db-c98e-5f10-82e4-3dee39abbf7d', '7bcb23c6-75c7-5747-80aa-5b3b8e0d6a30', 'DOCUMENTI', 'Documenti societari', 1, false, null)
on conflict (id) do nothing;

insert into voce_template
  (id, template_id, sezione_id, codice, sezione, ordine, testo_requisito, descrizione,
   tipo, obbligatoria, parent_voce_id, mostra_se_chiave, calendarizzabile, config) values
  ('c5c86167-c625-58e8-938f-fac4fa942e67', null, '069cbcc9-c846-5e82-bf35-a05976b754c8', 'INQ-PRO-01', null, 0, 'Descrizione del ciclo produttivo e delle attività', null, 'testo', false, null, null, false, '{}'::jsonb),
  ('460905af-a4b3-5393-837f-35e6d15a09ab', null, '069cbcc9-c846-5e82-bf35-a05976b754c8', 'INQ-PRO-02', null, 1, 'Numero addetti totali - per tipologia contrattuale', null, 'testo', false, null, null, false, '{}'::jsonb),
  ('1355dd1a-c5bf-552f-b57b-b7bb8cc18097', null, 'b15994db-c98e-5f10-82e4-3dee39abbf7d', 'INQ-DOC-01', null, 0, 'Visura camerale', null, 'scelta', false, null, null, false, '{"opzioni": [{"chiave": "visto", "etichetta": "Visto", "stato": "positivo"}, {"chiave": "da_avere", "etichetta": "Da avere", "stato": "da_fare"}, {"chiave": "non_soggetto", "etichetta": "Non soggetto", "stato": "non_applicabile"}]}'::jsonb),
  ('3eb9821d-bab5-5f70-83ea-63223c6ef1cb', null, 'b15994db-c98e-5f10-82e4-3dee39abbf7d', 'INQ-DOC-02', null, 1, 'Deleghe di ''gestione'' da parte del Titolare effettivo', null, 'scelta', false, null, null, false, '{"opzioni": [{"chiave": "visto", "etichetta": "Visto", "stato": "positivo"}, {"chiave": "da_avere", "etichetta": "Da avere", "stato": "da_fare"}, {"chiave": "non_soggetto", "etichetta": "Non soggetto", "stato": "non_applicabile"}]}'::jsonb),
  ('5548f3b2-9dfb-5af8-8f45-8235ebdc9869', null, 'b15994db-c98e-5f10-82e4-3dee39abbf7d', 'INQ-DOC-03', null, 2, 'Attribuzione incarichi a dirigenti e/o preposti', null, 'scelta', false, null, null, false, '{"opzioni": [{"chiave": "visto", "etichetta": "Visto", "stato": "positivo"}, {"chiave": "da_avere", "etichetta": "Da avere", "stato": "da_fare"}, {"chiave": "non_soggetto", "etichetta": "Non soggetto", "stato": "non_applicabile"}]}'::jsonb)
on conflict (id) do nothing;

-- 2) estrae: rimuove la sezione Conformita da Cap.1 (cascade sulle voci)
delete from box_sezione
 where codice = 'CONFORMIT_SOCIETARIA'
   and box_id = (select id from box_catalogo where codice = 'CAP1');

-- 3) rinomina Cap.1 (ora senza Conformita)
update box_catalogo set nome = 'Organigramma + Riunione periodica' where codice = 'CAP1';
