-- =====================================================================
-- 034 - Box SMART (organigramma) e FISSO (cose da fare pregresse).
-- Completano i tre tipi del modello box: BoxGenerico ora instrada anche
-- smart (-> FormazioneRiepilogo) e fisso (-> vista azioni dei giri
-- precedenti). Additivo e idempotente (UUID fissi + ON CONFLICT DO NOTHING).
--
-- SMART "Organigramma": ref_smart='organigramma'. Va agganciato ai template
-- (come i generici) via checklist_template_box: qui a tutti i template attivi
-- (demo per il deployer unico, restringibile cancellando le righe).
--
-- FISSO "Cose da fare pregresse": i box fissi sono auto-iniettati in OGNI
-- sopralluogo da assicuraComposizione (legge box_catalogo tipo='fisso'),
-- quindi NON serve alcun link di template. La vista mostra, in sola lettura,
-- le azioni ancora aperte dei giri precedenti dello stesso incarico.
-- =====================================================================

-- ---- box smart: organigramma / formazione ----
insert into box_catalogo (id, codice, nome, descrizione, tipo, ref_smart, ordine_default, versione, attivo)
values (
  '0c1a4000-0000-4000-8000-000000000901',
  'ORGANIGRAMMA', 'Organigramma e formazione',
  'Stato dei ruoli e della formazione del cliente (modulo organigramma).',
  'smart', 'organigramma', 90, 1, true
)
on conflict (id) do nothing;

-- ---- box fisso: cose da fare pregresse (auto-iniettato, nessun link) ----
insert into box_catalogo (id, codice, nome, descrizione, tipo, ordine_default, versione, attivo)
values (
  '0c1a4000-0000-4000-8000-000000000902',
  'PREGRESSE', 'Cose da fare pregresse',
  'Azioni ancora aperte dai giri precedenti, da rivedere in questo sopralluogo.',
  'fisso', 95, 1, true
)
on conflict (id) do nothing;

-- ---- aggancio del solo box smart ai template attivi ----
insert into checklist_template_box (template_id, box_id, box_versione, ordine)
select t.id, '0c1a4000-0000-4000-8000-000000000901', 1, 90
from checklist_template t
where t.stato = 'attivo'
on conflict (template_id, box_id) do nothing;
