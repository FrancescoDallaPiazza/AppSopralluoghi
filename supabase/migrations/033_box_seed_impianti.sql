-- =====================================================================
-- 033 - Seed del box prototipo GENERICO "Impianti" (Cap. 4).
-- Primo box del modello box-argomento: serve a validare end-to-end il
-- renderer (BoxGenerico) con una sezione SINGOLA e una RIPETIBILE.
-- Additivo e idempotente: UUID fissi + ON CONFLICT DO NOTHING, cosi'
-- rilanciare la migration non duplica nulla.
--
-- Struttura:
--   Box "Impianti" (generico, v1)
--     Sezione "Generale" (singola)
--       - DICO       scelta  : dichiarazione di conformita presente?
--       - LIBRETTO   scelta  : libretto di impianto presente?  (+ figlia se "no")
--       - LIBR_NOTE  testo   : figlia condizionata (mostra_se_chiave = 'no')
--       - TERRA      scelta  : verifica impianto di terra (calendarizzabile, 24m)
--     Sezione "Quadri elettrici" (ripetibile, "+ Aggiungi quadro")
--       - QNORMA     scelta  : quadro a norma?
--       - QTERMO     scelta  : verifica termografica (calendarizzabile, 12m)
--
-- Il link ai template (checklist_template_box) aggancia il box a TUTTI i
-- template attivi: e' un prototipo demo per il deployer unico, facilmente
-- restringibile (basta cancellare le righe non volute da checklist_template_box).
-- =====================================================================

-- ---- catalogo box ----
insert into box_catalogo (id, codice, nome, descrizione, tipo, ordine_default, versione, attivo)
values (
  '0c1a4000-0000-4000-8000-000000000401',
  'IMPIANTI', 'Impianti',
  'Capitolo 4 - verifiche su impianti tecnologici e quadri elettrici.',
  'generico', 40, 1, true
)
on conflict (id) do nothing;

-- ---- sezioni ----
insert into box_sezione (id, box_id, codice, nome, ordine, ripetibile, etichetta_componente)
values
  ('0c1a4000-0000-4000-8000-000000000410', '0c1a4000-0000-4000-8000-000000000401',
   'GEN', 'Generale', 0, false, null),
  ('0c1a4000-0000-4000-8000-000000000420', '0c1a4000-0000-4000-8000-000000000401',
   'QUADRI', 'Quadri elettrici', 1, true, 'Aggiungi quadro')
on conflict (id) do nothing;

-- ---- voci della sezione GENERALE ----
insert into voce_template
  (id, template_id, sezione_id, codice, sezione, ordine, testo_requisito, descrizione,
   tipo, obbligatoria, parent_voce_id, mostra_se_chiave, calendarizzabile, config)
values
  ('0c1a4000-0000-4000-8000-000000000411', null, '0c1a4000-0000-4000-8000-000000000410',
   'DICO', null, 0,
   'Dichiarazione di conformita degli impianti (DM 37/08) presente?', null,
   'scelta', false, null, null, false,
   '{"opzioni":[{"chiave":"si","etichetta":"Si","stato":"positivo"},{"chiave":"no","etichetta":"No","stato":"da_fare"},{"chiave":"na","etichetta":"N/A","stato":"non_applicabile"}]}'::jsonb),

  ('0c1a4000-0000-4000-8000-000000000412', null, '0c1a4000-0000-4000-8000-000000000410',
   'LIBRETTO', null, 1,
   'Libretto di impianto / centrale termica presente e aggiornato?', null,
   'scelta', false, null, null, false,
   '{"opzioni":[{"chiave":"si","etichetta":"Si","stato":"positivo"},{"chiave":"no","etichetta":"No","stato":"da_fare"},{"chiave":"na","etichetta":"N/A","stato":"non_applicabile"}]}'::jsonb),

  ('0c1a4000-0000-4000-8000-000000000413', null, '0c1a4000-0000-4000-8000-000000000410',
   'LIBR_NOTE', null, 2,
   'Indicare cosa manca e dove reperirlo', null,
   'testo', false, '0c1a4000-0000-4000-8000-000000000412', 'no', false,
   '{}'::jsonb),

  ('0c1a4000-0000-4000-8000-000000000414', null, '0c1a4000-0000-4000-8000-000000000410',
   'TERRA', null, 3,
   'Verifica periodica impianto di terra (DPR 462/01) effettuata?', null,
   'scelta', false, null, null, true,
   '{"opzioni":[{"chiave":"si","etichetta":"Si","stato":"positivo"},{"chiave":"no","etichetta":"No","stato":"da_fare"},{"chiave":"na","etichetta":"N/A","stato":"non_applicabile"}],"scadenza":{"periodicita_default_mesi":24}}'::jsonb)
on conflict (id) do nothing;

-- ---- voci della sezione QUADRI (ripetibile: una compilazione per componente) ----
insert into voce_template
  (id, template_id, sezione_id, codice, sezione, ordine, testo_requisito, descrizione,
   tipo, obbligatoria, parent_voce_id, mostra_se_chiave, calendarizzabile, config)
values
  ('0c1a4000-0000-4000-8000-000000000421', null, '0c1a4000-0000-4000-8000-000000000420',
   'QNORMA', null, 0,
   'Quadro a norma (targa, grado IP, sezionamento, protezioni)?', null,
   'scelta', false, null, null, false,
   '{"opzioni":[{"chiave":"si","etichetta":"Si","stato":"positivo"},{"chiave":"no","etichetta":"No","stato":"da_fare"},{"chiave":"na","etichetta":"N/A","stato":"non_applicabile"}]}'::jsonb),

  ('0c1a4000-0000-4000-8000-000000000422', null, '0c1a4000-0000-4000-8000-000000000420',
   'QTERMO', null, 1,
   'Verifica termografica del quadro effettuata?', null,
   'scelta', false, null, null, true,
   '{"opzioni":[{"chiave":"si","etichetta":"Si","stato":"positivo"},{"chiave":"no","etichetta":"No","stato":"da_fare"},{"chiave":"na","etichetta":"N/A","stato":"non_applicabile"}],"scadenza":{"periodicita_default_mesi":12}}'::jsonb)
on conflict (id) do nothing;

-- ---- composizione di default: aggancia il box a tutti i template attivi ----
insert into checklist_template_box (template_id, box_id, box_versione, ordine)
select t.id, '0c1a4000-0000-4000-8000-000000000401', 1, 100
from checklist_template t
where t.stato = 'attivo'
on conflict (template_id, box_id) do nothing;
