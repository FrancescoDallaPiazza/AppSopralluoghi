-- =====================================================================
-- 016 - Formazione del datore di lavoro (art. 37, ASR 17/04/2025).
--
-- Aggiunge il corso obbligatorio per il datore di lavoro "semplice" (figura
-- datore_lavoro), che nel seed della 015 era rimasto senza requisiti: l'ASR
-- 17/04/2025 ha introdotto l'obbligo di formazione per tutti i datori di
-- lavoro, distinto dal percorso DL-RSPP (art. 34) gia' a catalogo.
--
-- Solo INSERT idempotenti su tabelle gia' esistenti (corso_catalogo,
-- figura_requisito, esonero_ammesso). Nessuna modifica di struttura.
--
-- NOTA sui numeri: ore e periodicita di aggiornamento sono un default
-- ragionevole da VERIFICARE/ritoccare dal back-office secondo l'Accordo; la
-- valutazione normativa resta in capo al consulente.
-- =====================================================================

-- corso a catalogo
insert into corso_catalogo (codice, nome, categoria, ore, aggiornamento_mesi, ore_aggiornamento, prerequisito_codice, note) values
  ('DATORE_LAVORO', 'Formazione datore di lavoro (art. 37)', 'datore_lavoro', 16, 60, 6, null,
   'Obbligo introdotto dall''ASR 17/04/2025 per tutti i datori di lavoro. Ore e aggiornamento da verificare secondo l''Accordo. Distinto dal percorso DL-RSPP (art. 34).')
on conflict (codice) do nothing;

-- requisito: la figura datore_lavoro richiede il corso
insert into figura_requisito (figura_codice, corso_codice, obbligatorio, per_categoria) values
  ('datore_lavoro', 'DATORE_LAVORO', true, false)
on conflict (figura_codice, corso_codice) do nothing;

-- promemoria di esonero ammesso (Allegato III: credito totale da RSPP/ASPP/
-- Coordinatore/DL-RSPP verso la formazione del datore di lavoro)
insert into esonero_ammesso (corso_codice, figura_codice, tipo, descrizione, riferimento_norm, ordine) values
  ('DATORE_LAVORO', null, 'credito_pregresso',
   'Credito totale per chi possiede formazione da RSPP, ASPP, Coordinatore o DL-RSPP.',
   'Allegato III ASR 17/04/2025', 90)
on conflict do nothing;
