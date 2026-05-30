-- =====================================================================
-- 004 · Seed checklist #2 "Sopralluogo DVR/Consulenza sicurezza"
--        (audit iniziale / raccolta dati per redazione DVR).
-- tipo_attivita = 'DVR/Consulenza sicurezza'
--
-- Caratteristiche (come concordato):
--  * raccolta dati: ogni risposta/sotto-risposta viene salvata (esito_voce.valore)
--  * vocabolari di risposta diversi per gruppo di voci (Visto/Da avere/Non soggetto,
--    Presente/Non Presente/Non Applicabile, SI/NO/N/A, Presente/Da valutare/Non soggetto)
--  * sotto-domande tipizzate mostrate in base alla risposta (date, testo, select…)
--  * azioni automatiche solo dove previsto (deleghe, visura, incarichi, RENTRI)
--  * alberi profondi (RENTRI) semplificati: registro la risposta e, se serve
--    iscrizione, genero una cosa-da-fare con la scadenza (hint con le date limite)
--  * firma "AUDITOR" rimandata (firma non ancora nel modello)
-- =====================================================================

do $$
declare
  tmpl2 uuid;
  -- vocabolari riusabili -------------------------------------------------
  cfg_vdr jsonb := '{"opzioni":[
    {"chiave":"presente","etichetta":"Presente","stato":"positivo"},
    {"chiave":"non_presente","etichetta":"Non Presente","stato":"da_fare"},
    {"chiave":"na","etichetta":"Non Applicabile","stato":"non_applicabile"}]}';
  cfg_vdr_per jsonb := '{"opzioni":[
    {"chiave":"presente","etichetta":"Presente","stato":"positivo"},
    {"chiave":"non_presente","etichetta":"Non Presente","stato":"da_fare"},
    {"chiave":"na","etichetta":"Non Applicabile","stato":"non_applicabile"}],
    "scadenza":{"abilitata":true}}';
  cfg_doc jsonb := '{"opzioni":[
    {"chiave":"visto","etichetta":"Visto","stato":"positivo"},
    {"chiave":"da_avere","etichetta":"Da avere","stato":"da_fare"},
    {"chiave":"non_soggetto","etichetta":"Non soggetto","stato":"non_applicabile"}]}';
  cfg_doc_az jsonb := '{"opzioni":[
    {"chiave":"visto","etichetta":"Visto","stato":"positivo"},
    {"chiave":"da_avere","etichetta":"Da avere","stato":"da_fare","genera_azione":true},
    {"chiave":"non_soggetto","etichetta":"Non soggetto","stato":"non_applicabile"}]}';
  cfg_doc_per jsonb := '{"opzioni":[
    {"chiave":"visto","etichetta":"Visto","stato":"positivo"},
    {"chiave":"da_avere","etichetta":"Da avere","stato":"da_fare"},
    {"chiave":"non_soggetto","etichetta":"Non soggetto","stato":"non_applicabile"}],
    "scadenza":{"abilitata":true}}';
  cfg_dpi jsonb := '{"opzioni":[
    {"chiave":"presente","etichetta":"Presente","stato":"positivo"},
    {"chiave":"da_valutare","etichetta":"Da valutare","stato":"da_fare"},
    {"chiave":"non_soggetto","etichetta":"Non soggetto","stato":"non_applicabile"}]}';
  cfg_dpi_per jsonb := '{"opzioni":[
    {"chiave":"presente","etichetta":"Presente","stato":"positivo"},
    {"chiave":"da_valutare","etichetta":"Da valutare","stato":"da_fare"},
    {"chiave":"non_soggetto","etichetta":"Non soggetto","stato":"non_applicabile"}],
    "scadenza":{"abilitata":true}}';
  cfg_sino jsonb := '{"opzioni":[
    {"chiave":"si","etichetta":"SI","stato":"neutro"},
    {"chiave":"no","etichetta":"NO","stato":"neutro"},
    {"chiave":"na","etichetta":"N/A","stato":"non_applicabile"}]}';
  cfg_yesno jsonb := '{"opzioni":[
    {"chiave":"yes","etichetta":"Yes","stato":"neutro"},
    {"chiave":"no","etichetta":"No","stato":"neutro"},
    {"chiave":"na","etichetta":"N/A","stato":"non_applicabile"}]}';
begin

  insert into checklist_template (nome, tipo_attivita, versione, stato, note)
  values ('Sopralluogo DVR/Consulenza sicurezza', 'DVR/Consulenza sicurezza', 1, 'attivo',
          'Audit iniziale / raccolta dati per redazione DVR. Cliente nuovo o senza documentazione.')
  returning id into tmpl2;

  -- ====================== VOCI PRINCIPALI ======================

  -- ---- gruppo cfg_vdr (Presente / Non Presente / Non Applicabile) ----
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, descrizione, config)
  select tmpl2, v.codice, v.sezione, v.ordine, v.testo, 'scelta', v.descr, cfg_vdr
  from (values
    ('dirigenti','Organigramma',140,'Dirigenti',null),
    ('preposti','Organigramma',150,'Preposti',null),
    ('dvr','DVR e rischi specifici',600,'Documento di valutazione dei rischi (DVR)',null),
    ('dvr_chimico','DVR e rischi specifici',610,'DVR - rischio chimico',null),
    ('campionamento_aerodispersi','DVR e rischi specifici',620,'Campionamento da sostanze aerodisperse per processi di lavorazione (rischio chimico)',null),
    ('dvr_cancerogeno','DVR e rischi specifici',630,'DVR - cancerogeno/mutageno (amianto, silice, legno...)',null),
    ('dvr_biologico','DVR e rischi specifici',640,'DVR - biologico',null),
    ('dvr_rumore','DVR e rischi specifici',650,'DVR - rumore',null),
    ('dvr_vibrazioni','DVR e rischi specifici',660,'DVR - vibrazioni',null),
    ('dvr_mmc','DVR e rischi specifici',670,'DVR - movimentazione manuale dei carichi',null),
    ('dvr_biomeccanico','DVR e rischi specifici',680,'DVR - sovraccarico biomeccanico arti superiori',null),
    ('dvr_posture','DVR e rischi specifici',690,'DVR - posture incongrue',null),
    ('dvr_microclima','DVR e rischi specifici',700,'DVR - microclima/macroclima',null),
    ('dvr_incendio_dvr','DVR e rischi specifici',710,'DVR - incendio',null),
    ('dvr_stress','DVR e rischi specifici',720,'DVR - stress lavoro-correlato',null),
    ('dvr_roa','DVR e rischi specifici',730,'DVR - radiazioni ottiche artificiali (ROA)',null),
    ('dvr_cem','DVR e rischi specifici',740,'DVR - campi elettromagnetici (CEM)',null),
    ('dvr_radon','DVR e rischi specifici',750,'DVR - radon (per locali sotterranei)',null),
    ('dvr_atex','DVR e rischi specifici',760,'DVR - atmosfere esplosive',null),
    ('dvr_videoterminali','DVR e rischi specifici',770,'DVR da videoterminalismo (> 20 ore/sett.)',null),
    ('proc_minorenni','Procedure speciali',800,'Presenza e gestione procedura per minorenni',null),
    ('soggetti_esterni','Procedure speciali',810,'Presenza e gestione di soggetti esterni alla struttura (fornitori, alternanza scuola/lavoro, volontari, ecc.)',null),
    ('farmaci_salvavita','Procedure speciali',820,'Presenza e gestione procedura farmaci salvavita',null),
    ('pubblico_50','Antincendio',1120,'Luogo di lavoro aperto al pubblico con presenza contemporanea di più di 50 persone (indipendentemente dal numero di lavoratori)?',null),
    ('pee_anti','Antincendio',1130,'Piano di emergenza ed evacuazione (PEE)',null),
    ('planimetrie_emergenza','Antincendio',1140,'Planimetrie di emergenza esposte (con estintori, uscite, cassetta primo soccorso, ecc.)',null),
    ('estintori_idranti_porte','Antincendio',1150,'Antincendio - estintori, idranti, porte','Annotare la ditta e la disponibilità delle registrazioni degli interventi.'),
    ('sistemi_protezione_anti','Antincendio',1160,'Antincendio - sistemi di protezione antincendio','Annotare la ditta e la disponibilità delle registrazioni degli interventi.'),
    ('elenco_macchine','Attrezzature, macchinari e manutenzioni periodiche',1200,'Elenco macchine e attrezzature di lavoro',null),
    ('libretti_macchine','Attrezzature, macchinari e manutenzioni periodiche',1210,'Libretti uso e manutenzione macchine e attrezzature',null),
    ('dico_ce','Attrezzature, macchinari e manutenzioni periodiche',1220,'Dichiarazioni di conformità CE',null),
    ('registro_controllo_macchine','Attrezzature, macchinari e manutenzioni periodiche',1230,'Registro controllo macchine e attrezzature di lavoro (ove previsto)','I risultati dei controlli, almeno quelli degli ultimi 3 anni, vanno conservati e tenuti a disposizione degli organi di vigilanza.'),
    ('sollevamento_dico','Attrezzature, macchinari e manutenzioni periodiche',1250,'Apparecchi di sollevamento > 200 kg - dichiarazione di conformità e libretto uso/manutenzione',null),
    ('cartellonistica','Cartellonistica di salute e sicurezza',1500,'Cartellonistica di salute e sicurezza',null),
    ('scaffalature','Cartellonistica di salute e sicurezza',1510,'Se presenti scaffalature, è stata eseguita la verifica secondo UNI EN 15635 e UNI 11636?',null)
  ) as v(codice, sezione, ordine, testo, descr);

  -- ---- gruppo cfg_vdr_per (Presente/.. + scadenza ricorrente) ----
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, descrizione, config)
  select tmpl2, v.codice, v.sezione, v.ordine, v.testo, 'scelta', v.descr, cfg_vdr_per
  from (values
    ('carrelli_verifica','Attrezzature, macchinari e manutenzioni periodiche',1240,'Carrelli elevatori - verifica periodica di funzionalità','Annotare la ditta e la disponibilità delle registrazioni degli interventi.'),
    ('sollevamento_ispezioni','Attrezzature, macchinari e manutenzioni periodiche',1260,'Apparecchi di sollevamento > 200 kg - ispezioni periodiche (ASL o Organismo Notificato) e manutenzione','Annotare la ditta e la disponibilità delle registrazioni degli interventi.'),
    ('riunione_periodica','Attività periodiche',1400,'Verbale della riunione periodica (ex art. 35 D.Lgs. 81/08; aggiornamento annuale)',null),
    ('prova_evacuazione','Attività periodiche',1410,'Prova di evacuazione annuale (solo se > 10 dipendenti o soggetto a SCIA/VVF)',null)
  ) as v(codice, sezione, ordine, testo, descr);

  -- ---- gruppo cfg_doc (Visto / Da avere / Non soggetto) ----
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, descrizione, config)
  select tmpl2, v.codice, v.sezione, v.ordine, v.testo, 'scelta', v.descr, cfg_doc
  from (values
    ('planimetrie_sede','Luoghi di lavoro',400,'Planimetrie aggiornate (sede operativa)',null),
    ('agibilita','Luoghi di lavoro',410,'Certificato/licenza d''uso o agibilità (sede)',null),
    ('nulla_osta','Luoghi di lavoro',420,'Nulla osta inizio attività / DIAP / autorizzazione o accreditamento regionale specifico',null),
    ('impianto_elettrico_dico','Impianti',500,'Impianto elettrico - dichiarazione di conformità',null),
    ('terra_denuncia','Impianti',510,'Impianto di messa a terra - denuncia di messa in servizio a INAIL/ARPAV','Annotare la data di presentazione e/o il numero con la data di protocollo.'),
    ('terra_comunicazione_civa','Impianti',530,'Impianto di messa a terra - comunicazione al portale telematico CIVA/INAIL (ente erogatore della verifica)',null),
    ('scariche_atmosferiche','Impianti',540,'Impianto protezione scariche atmosferiche - denuncia di messa in servizio a INAIL/ARPAV (o autoprotezione)',null),
    ('ascensori_licenza','Impianti',550,'Ascensori e montacarichi - licenza di esercizio comunale',null),
    ('pressione_presenza','Impianti',570,'Apparecchi in pressione','Indicare presenza, caratteristiche tecniche, ecc.'),
    ('riscaldamento','Impianti',590,'Presenza impianti di riscaldamento','Specificare la potenzialità e l''eventuale denuncia I.S.P.E.S.L.'),
    ('atex_relazione','Impianti',595,'Rischio esplosione - relazione tecnica di classificazione degli ambienti con pericolo di esplosione (ATEX)',null),
    ('atex_messa_servizio','Impianti',598,'Rischio esplosione - messa in servizio di impianti elettrici installati in luoghi con pericolo di esplosione (comprese le relative verifiche)',null)
  ) as v(codice, sezione, ordine, testo, descr);

  -- ---- gruppo cfg_doc_per (Visto/.. + scadenza, verifiche periodiche impianti) ----
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, descrizione, config)
  select tmpl2, v.codice, v.sezione, v.ordine, v.testo, 'scelta', v.descr, cfg_doc_per
  from (values
    ('terra_verifica_periodica','Impianti',520,'Impianto di messa a terra - verifica periodica di funzionalità','Annotare ditta e registrazioni. Attività da svolgere ogni 2/5 anni.'),
    ('ascensori_verifiche','Impianti',560,'Ascensori e montacarichi - verifiche periodiche','Annotare la ditta e la disponibilità delle registrazioni degli interventi.'),
    ('pressione_verifiche','Impianti',580,'Apparecchi in pressione - verifiche periodiche','Annotare la ditta e la disponibilità delle registrazioni degli interventi.')
  ) as v(codice, sezione, ordine, testo, descr);

  -- ---- gruppo cfg_doc_az (Da avere -> genera cosa-da-fare) ----
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, config)
  select tmpl2, v.codice, v.sezione, v.ordine, v.testo, 'scelta', cfg_doc_az
  from (values
    ('deleghe_gestione','Conformità societaria/aziendale',300,'Eventuali deleghe di "gestione" presenti da parte del Titolare Effettivo della società'),
    ('visura_camerale','Conformità societaria/aziendale',310,'Visura camerale'),
    ('attribuzione_incarichi','Conformità societaria/aziendale',320,'Attribuzione degli incarichi a eventuali dirigenti e/o preposti')
  ) as v(codice, sezione, ordine, testo);

  -- ---- gruppo cfg_dpi (Presente / Da valutare / Non soggetto) ----
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, config)
  select tmpl2, v.codice, v.sezione, v.ordine, v.testo, 'scelta',
         case when v.codice = 'dpi_consegna' then cfg_dpi_per else cfg_dpi end
  from (values
    ('dpi_idoneita','Dispositivi di protezione individuale (DPI)',900,'Valutazione di idoneità dei DPI (inclusa nel DVR)'),
    ('dpi_consegna','Dispositivi di protezione individuale (DPI)',910,'Verbali di consegna dei DPI ai lavoratori (almeno annuale)'),
    ('dpi_conformita','Dispositivi di protezione individuale (DPI)',920,'Dichiarazione di conformità (tutte le categorie) e/o certificazione dei DPI (II e III categoria)'),
    ('dpi_istruzioni','Dispositivi di protezione individuale (DPI)',930,'Istruzioni del DPI in lingua italiana')
  ) as v(codice, sezione, ordine, testo);

  -- ---- voci con vocabolari/tipi propri ----
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, descrizione, config) values
    -- organigramma
    (tmpl2,'datore_lavoro','Organigramma',100,'Datore di lavoro','testo',null,'{}'),
    (tmpl2,'rspp','Organigramma',110,'Responsabile del Servizio di Prevenzione e Protezione (RSPP)','scelta',null,
      '{"opzioni":[{"chiave":"esterno","etichetta":"RSPP esterno","stato":"neutro"},{"chiave":"interno","etichetta":"RSPP interno","stato":"neutro"},{"chiave":"datore","etichetta":"Datore di lavoro","stato":"neutro"}]}'),
    (tmpl2,'rls','Organigramma',120,'RLS / RLS-T','scelta',null,
      '{"opzioni":[{"chiave":"rls_interno","etichetta":"RLS (interno)","stato":"neutro"},{"chiave":"rls_t","etichetta":"RLS-T (esterno)","stato":"neutro"},{"chiave":"non_nominato","etichetta":"Non nominato","stato":"da_fare"}]}'),
    (tmpl2,'medico_competente','Organigramma',130,'Medico Competente','scelta',null,
      '{"opzioni":[{"chiave":"nominato","etichetta":"Nominato","stato":"positivo"},{"chiave":"non_nominato","etichetta":"Non nominato","stato":"da_fare"}]}'),
    -- formazione
    (tmpl2,'formazione_personale','Formazione',200,'Formazione svolta dal personale (Cognome/Nome, tipologia corso, data corso)','testo',null,'{}'),
    (tmpl2,'fondo_interprof','Formazione',210,'Iscritto a qualche Fondo Interprofessionale?','scelta',null,cfg_yesno),
    -- conformità societaria (testo)
    (tmpl2,'ciclo_produttivo','Conformità societaria/aziendale',330,'Descrizione del ciclo produttivo e delle attività svolte all''interno dell''organizzazione','testo',null,'{}'),
    (tmpl2,'numero_addetti','Conformità societaria/aziendale',340,'Numero addetti totali, divisi per tipologia contrattuale (se conosciuta)','testo',null,'{}'),
    -- procedure speciali (data)
    (tmpl2,'gestanti','Procedure speciali',830,'Presenza e gestione procedura donne lavoratrici gestanti/puerpere','data','Data di riferimento.','{}'),
    -- medicina e sorveglianza sanitaria (gate)
    (tmpl2,'sorv_necessaria','Medicina e sorveglianza sanitaria',1000,'La valutazione dei rischi ha definito la necessità di attivare la sorveglianza sanitaria?','scelta',null,cfg_sino),
    -- antincendio (multiscelta + numero)
    (tmpl2,'antincendio_attivita','Antincendio',1100,'Attività principale ex Allegato III del DM 7/8/2012','multiscelta','Selezionare le attività soggette applicabili.',
      '{"opzioni":[
        {"chiave":"1_1c","etichetta":"1.1C - Gas infiammabili/comburenti in ciclo > 25 Nm3/h","stato":"neutro"},
        {"chiave":"2_1b","etichetta":"2.1B - Cabine decompressione gas naturale fino a 2,4 MPa","stato":"neutro"},
        {"chiave":"2_2c","etichetta":"2.2C - Compressione/decompressione gas > 50 Nm3/h","stato":"neutro"},
        {"chiave":"3_1b","etichetta":"3.1B - Rivendite gas compressi ≥ 0,75 mc","stato":"neutro"},
        {"chiave":"3_2b","etichetta":"3.2B - Depositi fino a 10 mc gas compressi ≥ 0,75 mc","stato":"neutro"},
        {"chiave":"3_3c","etichetta":"3.3C - Depositi oltre 10 mc gas compressi ≥ 0,75 mc","stato":"neutro"},
        {"chiave":"3_4c","etichetta":"3.4C - Impianti di riempimento gas compressi ≥ 0,75 mc","stato":"neutro"},
        {"chiave":"3_5a","etichetta":"3.5A - Depositi di GPL fino a 300 kg","stato":"neutro"},
        {"chiave":"3_6b","etichetta":"3.6B - Rivendite GPL ≥ 75 kg","stato":"neutro"},
        {"chiave":"3_7b","etichetta":"3.7B - Depositi GPL oltre 300 kg e fino a 1.000 kg","stato":"neutro"},
        {"chiave":"altro","etichetta":"Altro","stato":"neutro"}]}'),
    (tmpl2,'lavoratori_totali','Antincendio',1110,'Lavoratori totali presenti (n.)','numero','Più di 10?','{}'),
    -- emissioni
    (tmpl2,'emissioni_camini','Emissioni in atmosfera',1700,'Ci sono camini o sbocchi/canalizzazioni verso l''esterno collegati a impianti produttivi?','scelta',null,cfg_yesno),
    -- gestione rifiuti (radice albero semplificato)
    (tmpl2,'produco_rifiuti','Gestione rifiuti',1600,'L''azienda produce rifiuti?','scelta',null,
      '{"opzioni":[{"chiave":"si","etichetta":"SI","stato":"neutro"},{"chiave":"no","etichetta":"NO","stato":"neutro"}]}'),
    -- sopralluogo ambienti (rilievi liberi del consulente)
    (tmpl2,'segnalazioni_consulente','Sopralluogo ambienti di lavoro',1800,'Segnalazioni del consulente','rilievo',
      'Aggiungi una segnalazione per ogni aspetto rilevato negli ambienti. Ogni segnalazione può diventare una "cosa da fare".',
      '{"ripetibile":true,"azione_opzionale":true}');

  -- ====================== SOTTO-DOMANDE (figlie) ======================

  -- sotto-domande "Data ultima revisione?" mostrate se Presente (un figlio per voce)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  select tmpl2, p.codice||'_data', p.sezione, p.ordine+1, 'Data ultima revisione?', 'data', p.id, 'presente', '{}'
  from voce_template p
  where p.template_id = tmpl2 and p.codice in (
    'dvr','dvr_biologico','dvr_rumore','dvr_vibrazioni','dvr_mmc','dvr_biomeccanico',
    'dvr_posture','dvr_microclima','dvr_incendio_dvr','dvr_stress','dvr_roa','dvr_cem',
    'dvr_atex','dvr_videoterminali'
  );

  -- organigramma: dati anagrafici condizionati alla scelta
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  select tmpl2, x.codice, 'Organigramma', x.ordine, x.testo, 'testo',
         (select id from voce_template where template_id=tmpl2 and codice=x.parent), x.chiave, '{}'
  from (values
    ('rspp_dati_esterno',111,'Cognome/Nome + data nomina','rspp','esterno'),
    ('rspp_dati_interno',112,'Cognome/Nome + data nomina','rspp','interno'),
    ('rspp_dati_datore',113,'Cognome/Nome + data nomina + formazione eseguita il','rspp','datore'),
    ('rls_dati',121,'Cognome/Nome + data nomina + formazione eseguita il','rls','rls_interno'),
    ('rls_t_dati',122,'Cognome/Nome + data nomina','rls','rls_t'),
    ('mc_dati',131,'Cognome/Nome + data nomina','medico_competente','nominato'),
    ('dirigenti_dati',141,'Cognome/Nome + data nomina + formazione eseguita il','dirigenti','presente'),
    ('preposti_dati',151,'Cognome/Nome + data nomina + formazione eseguita il','preposti','presente')
  ) as x(codice, ordine, testo, parent, chiave);

  -- formazione: fondo "Quale?"
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (tmpl2,'fondo_quale','Formazione',211,'Quale fondo?','testo',
          (select id from voce_template where template_id=tmpl2 and codice='fondo_interprof'),'yes','{}');

  -- DVR chimico -> SDS (se Presente) -> data (se Presente)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (tmpl2,'sds','DVR e rischi specifici',611,'Sono presenti le più aggiornate SDS dei prodotti utilizzati?','scelta',
          (select id from voce_template where template_id=tmpl2 and codice='dvr_chimico'),'presente',cfg_vdr);
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (tmpl2,'sds_data','DVR e rischi specifici',612,'Data ultima revisione?','data',
          (select id from voce_template where template_id=tmpl2 and codice='sds'),'presente','{}');

  -- campionamento aerodisperso -> data ultimo campionamento (se Presente)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (tmpl2,'camp_data','DVR e rischi specifici',621,'Data ultimo campionamento?','data',
          (select id from voce_template where template_id=tmpl2 and codice='campionamento_aerodispersi'),'presente','{}');

  -- cancerogeno -> registro esposti (se Presente) + data (se Presente)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (tmpl2,'registro_esposti','DVR e rischi specifici',631,'È presente il registro degli esposti?','scelta',
          (select id from voce_template where template_id=tmpl2 and codice='dvr_cancerogeno'),'presente',cfg_vdr);
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (tmpl2,'canc_data','DVR e rischi specifici',632,'Data ultima revisione?','data',
          (select id from voce_template where template_id=tmpl2 and codice='dvr_cancerogeno'),'presente','{}');

  -- radon -> due domande SI/NO (se Presente)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values
    (tmpl2,'radon_pareti','DVR e rischi specifici',751,'Sono presenti tre pareti interamente sotto il piano di campagna?','scelta',
      (select id from voce_template where template_id=tmpl2 and codice='dvr_radon'),'presente',cfg_sino),
    (tmpl2,'radon_ore','DVR e rischi specifici',752,'Il personale, nel suo complesso, trascorre indicativamente 10 ore al mese nella zona?','scelta',
      (select id from voce_template where template_id=tmpl2 and codice='dvr_radon'),'presente',cfg_sino);

  -- sorveglianza sanitaria -> 4 sotto-voci (se SI)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  select tmpl2, x.codice, 'Medicina e sorveglianza sanitaria', x.ordine, x.testo, 'scelta',
         (select id from voce_template where template_id=tmpl2 and codice='sorv_necessaria'), 'si',
         case when x.codice='mc_visita_ambienti' then cfg_vdr_per else cfg_vdr end
  from (values
    ('protocollo_sanitario',1001,'Presenza del protocollo sanitario'),
    ('idoneita_specifiche',1002,'Presenza delle idoneità specifiche alla mansione'),
    ('mc_visita_ambienti',1003,'Presenza visita periodica del MC agli ambienti di lavoro (aggiornamento annuale)'),
    ('registro_cancerogeni',1004,'Registro dei lavoratori esposti ad agenti cancerogeni')
  ) as x(codice, ordine, testo);

  -- libretti macchine -> blocco "cosa da fare" (se Presente)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config) values
    (tmpl2,'lib_motivazione','Attrezzature, macchinari e manutenzioni periodiche',1211,'Motivare assenza documento','testo',
      (select id from voce_template where template_id=tmpl2 and codice='libretti_macchine'),'presente','{}'),
    (tmpl2,'lib_azione','Attrezzature, macchinari e manutenzioni periodiche',1212,'Azione correttiva','testo',
      (select id from voce_template where template_id=tmpl2 and codice='libretti_macchine'),'presente','{}'),
    (tmpl2,'lib_scadenza','Attrezzature, macchinari e manutenzioni periodiche',1213,'Data scadenza completamento','data',
      (select id from voce_template where template_id=tmpl2 and codice='libretti_macchine'),'presente','{}'),
    (tmpl2,'lib_priorita','Attrezzature, macchinari e manutenzioni periodiche',1214,'Livello priorità','slider',
      (select id from voce_template where template_id=tmpl2 and codice='libretti_macchine'),'presente','{"min":1,"max":5}');

  -- dichiarazioni CE -> luogo archiviazione + foto copertina (se Presente)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config) values
    (tmpl2,'ce_archiviazione','Attrezzature, macchinari e manutenzioni periodiche',1221,'Luogo di archiviazione','testo',
      (select id from voce_template where template_id=tmpl2 and codice='dico_ce'),'presente','{}'),
    (tmpl2,'ce_foto','Attrezzature, macchinari e manutenzioni periodiche',1222,'Foto documento (copertina)','foto',
      (select id from voce_template where template_id=tmpl2 and codice='dico_ce'),'presente','{}');

  -- prova evacuazione -> data (se Presente)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (tmpl2,'prova_data','Attività periodiche',1411,'Data ultima prova?','data',
          (select id from voce_template where template_id=tmpl2 and codice='prova_evacuazione'),'presente','{}');

  -- cartellonistica -> "è da integrare? dove?" (se Non Presente)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (tmpl2,'cartello_integra','Cartellonistica di salute e sicurezza',1501,'È da integrare? Dove?','testo',
          (select id from voce_template where template_id=tmpl2 and codice='cartellonistica'),'non_presente','{}');

  -- scaffalature -> ultima verifica (se Presente)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (tmpl2,'scaff_data','Cartellonistica di salute e sicurezza',1511,'Ultima verifica eseguita?','data',
          (select id from voce_template where template_id=tmpl2 and codice='scaffalature'),'presente','{}');

  -- emissioni -> autorizzazione provincia (se Yes)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (tmpl2,'emissioni_autorizzati','Emissioni in atmosfera',1701,'Sono stati autorizzati/comunicati alla Provincia competente?','scelta',
          (select id from voce_template where template_id=tmpl2 and codice='emissioni_camini'),'yes',cfg_yesno);

  -- gestione rifiuti (albero RENTRI semplificato, mostrato se SI produce rifiuti)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, descrizione, config) values
    (tmpl2,'rifiuti_tipologia','Gestione rifiuti',1601,'Tipologia di rifiuti prodotti','multiscelta',
      (select id from voce_template where template_id=tmpl2 and codice='produco_rifiuti'),'si',null,
      '{"opzioni":[{"chiave":"pericolosi","etichetta":"Pericolosi","stato":"neutro"},{"chiave":"non_pericolosi","etichetta":"Non pericolosi","stato":"neutro"}]}'),
    (tmpl2,'rentri_iscritto','Gestione rifiuti',1602,'Iscrizione al RENTRI effettuata?','scelta',
      (select id from voce_template where template_id=tmpl2 and codice='produco_rifiuti'),'si',
      'Scadenze iscrizione RENTRI in base ai dipendenti: < 11 entro 13/02/2026; 11–50 entro 13/08/2025; > 50 entro 13/02/2025. Se "No", genera una cosa-da-fare con la scadenza applicabile.',
      '{"opzioni":[{"chiave":"si","etichetta":"SI","stato":"positivo"},{"chiave":"no","etichetta":"NO","stato":"da_fare","genera_azione":true},{"chiave":"non_soggetto","etichetta":"Non soggetto","stato":"non_applicabile"}]}');

end $$;
