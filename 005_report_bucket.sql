-- =====================================================================
-- 003 · Seed checklist #1 "Simulazione ispettiva ULSS/INL" e
--        checklist #3 "Audit periodico RSPP/Consulenza".
-- La #2 (DVR/Consulenza, raccolta dati) arriva nella 004.
--
-- NB tipo_attivita: è la chiave di aggancio con incarico.tipo_attivita.
--   #1 -> 'Simulazione ispettiva ULSS/INL'  (confermato)
--   #3 -> 'RSPP/Audit periodico'
-- =====================================================================

do $$
declare
  tmpl1 uuid;
  tmpl3 uuid;
  -- opzioni standard #1: OK-Presente / Da Programmare (genera cosa-da-fare) / N/A
  -- scadenza ricorrente sempre OFFERTA su OK: è il tecnico a decidere in campo.
  cfg_ulss jsonb := '{
    "opzioni": [
      { "chiave":"ok",   "etichetta":"OK - Presente",   "stato":"positivo" },
      { "chiave":"prog", "etichetta":"Da Programmare",  "stato":"da_fare", "genera_azione": true },
      { "chiave":"na",   "etichetta":"N/A",             "stato":"non_applicabile" }
    ],
    "scadenza": { "abilitata": true }
  }'::jsonb;
begin

  -- ============ #1 · SIMULAZIONE ISPETTIVA ULSS/INL ============
  insert into checklist_template (nome, tipo_attivita, versione, stato, note)
  values ('Simulazione ispettiva ULSS/INL', 'Simulazione ispettiva ULSS/INL', 1, 'attivo',
          'Audit documentale di conformità (simulazione visita ULSS/INL).')
  returning id into tmpl1;

  -- voci a scelta (tutte con cfg_ulss). La 19 ha una sotto-domanda (vedi sotto).
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, config)
  select tmpl1, v.codice, v.sezione, v.ordine, v.testo, 'scelta', cfg_ulss
  from (values
    ('dvr',                    'A. Documentazione e valutazione dei rischi', 10,
       'Documento di valutazione dei rischi (DVR) – ultima data di revisione'),
    ('dvr_specifiche',         'A. Documentazione e valutazione dei rischi', 20,
       'Valutazioni specifiche eseguite (DVR) – ultime date di revisione'),
    ('nomina_rspp',            'B. Nomine, formazione e addestramento', 30,
       'Nomina RSPP datata e firmata per accettazione, con attestati di formazione/aggiornamento'),
    ('nomina_addetti',         'B. Nomine, formazione e addestramento', 40,
       'Nomina addetti al primo soccorso e alla prevenzione incendi, con attestati di formazione/aggiornamento'),
    ('formazione_lavoratori',  'B. Nomine, formazione e addestramento', 50,
       'Formazione generale e specifica dei lavoratori (art. 37)'),
    ('addestramento_non_normate','B. Nomine, formazione e addestramento', 60,
       'Addestramento "sul campo" di macchine/attrezzature considerate NON normate'),
    ('preposti',               'B. Nomine, formazione e addestramento', 70,
       'Individuazione del/dei preposto/i (art. 18 c.1 lett. b-bis) e relativo attestato di formazione'),
    ('altra_formazione',       'B. Nomine, formazione e addestramento', 80,
       'Altra specifica formazione e addestramento (impianti elettrici in/fuori tensione, spazi confinati, carroponte, ecc.)'),
    ('addestramento_dpi3',     'B. Nomine, formazione e addestramento', 90,
       'Addestramento DPI di III categoria (imbracature, maschere/semimaschere, casco ventilato, ecc.)'),
    ('consegna_dpi',           'B. Nomine, formazione e addestramento', 100,
       'Verbale di consegna DPI dei lavoratori'),
    ('nomina_mc',              'C. Sorveglianza sanitaria', 110,
       'Nomina Medico Competente datata e firmata per accettazione'),
    ('idoneita_mansione',      'C. Sorveglianza sanitaria', 120,
       'Idoneità alla mansione (visite mediche periodiche/preassuntive)'),
    ('verifica_ambiente_mc',   'C. Sorveglianza sanitaria', 130,
       'Verbale di verifica dell''ambiente di lavoro da parte del Medico Competente'),
    ('dico_elettrico',         'D. Impianti e attrezzature', 140,
       'Dichiarazione di conformità impianto elettrico e di messa a terra e relativa denuncia CIVA/INAIL/ARPAV'),
    ('verifica_periodica_elettrico','D. Impianti e attrezzature', 150,
       'Verifica periodica impianto elettrico (ex DPR 462/01) con schemi, ricevute d''invio agli enti e schema unifilare'),
    ('altri_impianti_civa',    'D. Impianti e attrezzature', 160,
       'Altri impianti soggetti a obblighi CIVA/INAIL (in pressione, generatori di vapore, sollevamento, ecc.)'),
    ('registro_attrezzature',  'D. Impianti e attrezzature', 170,
       'Registro e verifiche periodiche di macchine/attrezzature/impianti (libretti uso e manutenzione, marcatura CE)'),
    ('pratica_incendi',        'E. Prevenzione incendi ed emergenze', 180,
       'Pratica di prevenzione incendi (CPI/SCIA – VVF) e attività soggette'),
    ('vdr_incendio',           'E. Prevenzione incendi ed emergenze', 190,
       'Valutazione dei rischi d''incendio secondo D.M. 3 settembre 2021'),
    ('pee',                    'E. Prevenzione incendi ed emergenze', 200,
       'Piano di emergenza ed evacuazione con planimetrie affisse')
  ) as v(codice, sezione, ordine, testo);

  -- voce 19: sotto-domanda mostrata solo se "OK - Presente"
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo,
                             parent_voce_id, mostra_se_chiave, config)
  values (tmpl1, 'basso_non_basso', 'E. Prevenzione incendi ed emergenze', 191,
          'Luogo di lavoro considerato BASSO (Mini-Codice) o NON BASSO?', 'scelta',
          (select id from voce_template where template_id = tmpl1 and codice = 'vdr_incendio'),
          'ok',
          '{ "opzioni": [
               { "chiave":"basso",     "etichetta":"BASSO (Mini-Codice)", "stato":"neutro" },
               { "chiave":"non_basso", "etichetta":"NON BASSO",           "stato":"neutro" }
             ] }'::jsonb);

  -- voce 21: indagine fotografica (solo foto, ripetibile)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, config)
  values (tmpl1, 'indagine_fotografica', 'F. Documentazione fotografica', 210,
          'Indagine fotografica – ambienti di lavoro', 'foto',
          '{ "ripetibile": true }'::jsonb);


  -- ============ #3 · AUDIT PERIODICO RSPP/CONSULENZA ============
  -- Non un diario: è il ciclo di audit periodico. I rilievi liberi possono
  -- generare cose-da-fare con scadenza; le azioni aperte del giro precedente
  -- rientrano in automatico (meccanismo "giro precedente" già nell'app) per
  -- essere verificate/chiuse. L'output di una visita è l'input della successiva.
  insert into checklist_template (nome, tipo_attivita, versione, stato, note)
  values ('Ordine di lavoro RSPP/Consulenza - Audit periodico',
          'RSPP/Audit periodico', 1, 'attivo',
          'Audit periodico su cliente continuativo: rilievi liberi -> azioni/scadenze + giro precedente.')
  returning id into tmpl3;

  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, descrizione, config)
  values (tmpl3, 'descrizione_attivita', 'Attività', 10,
          'Descrizione attività / rilievo', 'rilievo',
          'Aggiungi un rilievo per ogni aspetto rilevato. Ogni rilievo può diventare una "cosa da fare" con responsabile, scadenza e priorità.',
          '{ "ripetibile": true, "azione_opzionale": true }'::jsonb);

end $$;
