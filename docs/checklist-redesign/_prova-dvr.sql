-- =====================================================================
-- PROVA · Check-up iniziale (DVR) ridisegnato per la "modalità di rilievo
-- unica". NON è una migration: è un seed usa-e-getta da incollare nel
-- SQL Editor di Supabase per VEDERE la bozza viva nell'app da campo.
--
-- Sicurezza:
--  * nome e tipo_attivita marcati "PROVA" -> non diventa il default di nessun
--    incarico reale; compare solo come scelta extra nel selettore checklist.
--  * per rimuoverlo: eseguire il blocco "PULIZIA" in fondo.
--
-- Mappature di prova (vedi bozza docs/checklist-redesign/02-checkup-dvr.md):
--  * 'verifica'  -> 'scelta' SENZA opzioni (corpo vuoto: solo testo+evidenze+esito)
--  * sotto-domande che nella bozza pendevano da voci non-'scelta' sono qui rese
--    voci di primo livello sempre visibili (le figlie si aprono solo sulla
--    chiave di una 'scelta').
-- =====================================================================

do $$
declare
  t uuid;
begin
  insert into checklist_template (nome, tipo_attivita, versione, stato, note)
  values ('Check-up DVR — PROVA (modalità unica)', 'PROVA — Check-up DVR', 1, 'attivo',
          'Template di PROVA per valutare la bozza in app. Rimuovere dopo la valutazione.')
  returning id into t;

  -- ---- voci di PRIMO LIVELLO ----
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, descrizione, tipo, config)
  select t, v.codice, v.sezione, v.ordine, v.testo, v.descr, v.tipo, v.config::jsonb
  from (values
    -- Organigramma
    ('datore_lavoro','Organigramma',100,'Datore di lavoro','Ragione / Cognome Nome del datore di lavoro.','testo','{}'),
    ('rspp','Organigramma',110,'RSPP — Responsabile del Servizio di Prevenzione e Protezione',null,'scelta',
      '{"opzioni":[{"chiave":"esterno","etichetta":"RSPP esterno"},{"chiave":"interno","etichetta":"RSPP interno"},{"chiave":"datore","etichetta":"Datore di lavoro (RSPP)"}]}'),
    ('rls','Organigramma',120,'RLS / RLS-T',null,'scelta',
      '{"opzioni":[{"chiave":"rls_interno","etichetta":"RLS (interno)"},{"chiave":"rls_t","etichetta":"RLS-T (esterno)"},{"chiave":"non_nominato","etichetta":"Non nominato"}]}'),
    ('mc','Organigramma',130,'Medico Competente',null,'scelta',
      '{"opzioni":[{"chiave":"nominato","etichetta":"Nominato"},{"chiave":"non_nominato","etichetta":"Non nominato"}]}'),
    ('dirigenti','Organigramma',140,'Dirigenti',null,'scelta',
      '{"opzioni":[{"chiave":"presenti","etichetta":"Presenti"},{"chiave":"assenti","etichetta":"Assenti"}]}'),
    ('preposti','Organigramma',150,'Preposti',null,'scelta',
      '{"opzioni":[{"chiave":"presenti","etichetta":"Presenti"},{"chiave":"assenti","etichetta":"Assenti"}]}'),
    -- Formazione
    ('formazione_personale','Formazione',200,'Formazione svolta dal personale','Cognome/Nome, tipologia corso, data corso.','testo','{}'),
    ('fondo','Formazione',210,'Iscritto a un Fondo Interprofessionale?',null,'scelta',
      '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}'),
    -- Conformità societaria/aziendale
    ('deleghe','Conformità societaria/aziendale',300,'Deleghe di «gestione» del Titolare Effettivo','Presenza ed estremi delle eventuali deleghe.','scelta','{}'),
    ('visura','Conformità societaria/aziendale',310,'Visura camerale',null,'scelta','{}'),
    ('incarichi','Conformità societaria/aziendale',320,'Attribuzione incarichi a dirigenti/preposti',null,'scelta','{}'),
    ('ciclo_produttivo','Conformità societaria/aziendale',330,'Descrizione del ciclo produttivo e delle attività svolte',null,'testo','{}'),
    ('numero_addetti','Conformità societaria/aziendale',340,'Numero addetti totali, divisi per tipologia contrattuale','Se conosciuta.','testo','{}'),
    -- Luoghi di lavoro
    ('planimetrie','Luoghi di lavoro',400,'Planimetrie aggiornate (sede operativa)',null,'scelta','{}'),
    ('agibilita','Luoghi di lavoro',410,'Certificato/licenza d''uso o agibilità (sede)',null,'scelta','{}'),
    ('nulla_osta','Luoghi di lavoro',420,'Nulla osta inizio attività / DIAP / autorizzazione o accreditamento regionale',null,'scelta','{}'),
    -- Impianti
    ('elettrico_dico','Impianti',500,'Impianto elettrico — dichiarazione di conformità',null,'scelta','{}'),
    ('terra_denuncia','Impianti',510,'Messa a terra — denuncia di messa in servizio a INAIL/ARPAV','Annotare data di presentazione e/o numero e data di protocollo.','scelta','{}'),
    ('terra_verifica','Impianti',520,'Messa a terra — verifica periodica di funzionalità','Ditta e registrazioni. Cadenza 2/5 anni.','data','{"scadenza":{"periodicita_default_mesi":24}}'),
    ('terra_civa','Impianti',530,'Messa a terra — comunicazione al portale CIVA/INAIL',null,'scelta','{}'),
    ('scariche','Impianti',540,'Protezione scariche atmosferiche — denuncia INAIL/ARPAV (o autoprotezione)',null,'scelta','{}'),
    ('ascensori_licenza','Impianti',550,'Ascensori/montacarichi — licenza di esercizio comunale',null,'scelta','{}'),
    ('ascensori_verifiche','Impianti',560,'Ascensori/montacarichi — verifiche periodiche','Ditta e registrazioni.','data','{"scadenza":{"periodicita_default_mesi":24}}'),
    ('pressione_presenza','Impianti',570,'Apparecchi in pressione — presenza e caratteristiche tecniche',null,'testo','{}'),
    ('pressione_verifiche','Impianti',580,'Apparecchi in pressione — verifiche periodiche','Ditta e registrazioni.','data','{"scadenza":{"periodicita_default_mesi":24}}'),
    ('riscaldamento','Impianti',590,'Impianti di riscaldamento — presenza','Potenzialità ed eventuale denuncia I.S.P.E.S.L.','testo','{}'),
    ('atex_relazione','Impianti',595,'Rischio esplosione — relazione di classificazione ATEX',null,'scelta','{}'),
    ('atex_messa','Impianti',598,'Rischio esplosione — messa in servizio impianti elettrici in luoghi ATEX (con verifiche)',null,'scelta','{}'),
    -- DVR e rischi specifici
    ('dvr','DVR e rischi specifici',600,'Documento di Valutazione dei Rischi (DVR) — ultima revisione',null,'data','{}'),
    ('dvr_chimico','DVR e rischi specifici',610,'DVR — rischio chimico',null,'scelta','{}'),
    ('sds','DVR e rischi specifici',611,'SDS più aggiornate dei prodotti utilizzati — ultima revisione','Era figlia di «rischio chimico»: resa sempre visibile.','data','{}'),
    ('camp_aerodisperse','DVR e rischi specifici',620,'Campionamento sostanze aerodisperse (rischio chimico) — ultimo campionamento',null,'data','{}'),
    ('dvr_cancerogeno','DVR e rischi specifici',630,'DVR — cancerogeno/mutageno (amianto, silice, legno…) — ultima revisione',null,'data','{}'),
    ('registro_esposti','DVR e rischi specifici',631,'Registro degli esposti (cancerogeni)','Era figlia di «cancerogeno»: resa sempre visibile.','scelta','{}'),
    ('dvr_biologico','DVR e rischi specifici',640,'DVR — biologico — ultima revisione',null,'data','{}'),
    ('dvr_rumore','DVR e rischi specifici',650,'DVR — rumore — ultima revisione',null,'data','{}'),
    ('dvr_vibrazioni','DVR e rischi specifici',660,'DVR — vibrazioni — ultima revisione',null,'data','{}'),
    ('dvr_mmc','DVR e rischi specifici',670,'DVR — movimentazione manuale dei carichi — ultima revisione',null,'data','{}'),
    ('dvr_biomeccanico','DVR e rischi specifici',680,'DVR — sovraccarico biomeccanico arti superiori — ultima revisione',null,'data','{}'),
    ('dvr_posture','DVR e rischi specifici',690,'DVR — posture incongrue — ultima revisione',null,'data','{}'),
    ('dvr_microclima','DVR e rischi specifici',700,'DVR — microclima/macroclima — ultima revisione',null,'data','{}'),
    ('dvr_incendio','DVR e rischi specifici',710,'DVR — incendio — ultima revisione',null,'data','{}'),
    ('dvr_stress','DVR e rischi specifici',720,'DVR — stress lavoro-correlato — ultima revisione',null,'data','{}'),
    ('dvr_roa','DVR e rischi specifici',730,'DVR — radiazioni ottiche artificiali (ROA) — ultima revisione',null,'data','{}'),
    ('dvr_cem','DVR e rischi specifici',740,'DVR — campi elettromagnetici (CEM) — ultima revisione',null,'data','{}'),
    ('dvr_radon','DVR e rischi specifici',750,'DVR — radon (per locali sotterranei)',null,'scelta',
      '{"opzioni":[{"chiave":"valutato","etichetta":"Valutato"},{"chiave":"da_valutare","etichetta":"Da valutare"}]}'),
    ('dvr_atex','DVR e rischi specifici',760,'DVR — atmosfere esplosive — ultima revisione',null,'data','{}'),
    ('dvr_vdt','DVR e rischi specifici',770,'DVR — videoterminali (> 20 ore/sett.) — ultima revisione',null,'data','{}'),
    -- DPI
    ('dpi_idoneita','DPI',900,'Valutazione di idoneità dei DPI (inclusa nel DVR)',null,'scelta','{}'),
    ('dpi_consegna','DPI',910,'Verbali di consegna DPI ai lavoratori (almeno annuale)',null,'scelta','{"scadenza":{"periodicita_default_mesi":12}}'),
    ('dpi_conformita','DPI',920,'Dichiarazione di conformità / certificazione DPI (II e III categoria)',null,'scelta','{}'),
    ('dpi_istruzioni','DPI',930,'Istruzioni del DPI in lingua italiana',null,'scelta','{}'),
    -- Procedure speciali
    ('minorenni','Procedure speciali',800,'Procedura per minorenni — presenza e gestione',null,'scelta','{}'),
    ('soggetti_esterni','Procedure speciali',810,'Soggetti esterni (fornitori, alternanza, volontari…) — presenza e gestione',null,'scelta','{}'),
    ('farmaci','Procedure speciali',820,'Procedura farmaci salvavita — presenza e gestione',null,'scelta','{}'),
    ('gestanti','Procedure speciali',830,'Donne lavoratrici gestanti/puerpere — procedura (data di riferimento)',null,'data','{}'),
    -- Medicina e sorveglianza sanitaria
    ('sorv','Medicina e sorveglianza sanitaria',1000,'La valutazione dei rischi ha definito la necessità di attivare la sorveglianza sanitaria?',null,'scelta',
      '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}'),
    -- Antincendio
    ('anti_attivita','Antincendio',1100,'Attività principale ex Allegato III del DM 7/8/2012','Selezionare le attività soggette applicabili.','multiscelta',
      '{"opzioni":[{"chiave":"1_1c","etichetta":"1.1C — Gas infiammabili/comburenti in ciclo > 25 Nm3/h"},{"chiave":"2_1b","etichetta":"2.1B — Cabine decompressione gas naturale ≤ 2,4 MPa"},{"chiave":"2_2c","etichetta":"2.2C — Compressione/decompressione gas > 50 Nm3/h"},{"chiave":"3_1b","etichetta":"3.1B — Rivendite gas compressi ≥ 0,75 mc"},{"chiave":"3_2b","etichetta":"3.2B — Depositi ≤ 10 mc gas compressi ≥ 0,75 mc"},{"chiave":"3_3c","etichetta":"3.3C — Depositi > 10 mc gas compressi ≥ 0,75 mc"},{"chiave":"3_4c","etichetta":"3.4C — Impianti riempimento gas compressi ≥ 0,75 mc"},{"chiave":"3_5a","etichetta":"3.5A — Depositi GPL ≤ 300 kg"},{"chiave":"3_6b","etichetta":"3.6B — Rivendite GPL ≥ 75 kg"},{"chiave":"3_7b","etichetta":"3.7B — Depositi GPL 300–1.000 kg"},{"chiave":"altro","etichetta":"Altro"}]}'),
    ('anti_lavoratori','Antincendio',1110,'Lavoratori totali presenti (n.)','Più di 10?','numero','{}'),
    ('anti_pubblico','Antincendio',1120,'Luogo aperto al pubblico con > 50 persone contemporanee?',null,'scelta',
      '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}'),
    ('anti_pee','Antincendio',1130,'Piano di emergenza ed evacuazione (PEE)',null,'scelta','{}'),
    ('anti_planimetrie','Antincendio',1140,'Planimetrie di emergenza esposte (estintori, uscite, primo soccorso…)',null,'scelta','{}'),
    ('anti_estintori','Antincendio',1150,'Estintori, idranti, porte','Annotare ditta e disponibilità delle registrazioni degli interventi.','scelta','{}'),
    ('anti_sistemi','Antincendio',1160,'Sistemi di protezione antincendio','Annotare ditta e registrazioni degli interventi.','scelta','{}'),
    -- Attrezzature, macchinari e manutenzioni periodiche
    ('elenco_macchine','Attrezzature e manutenzioni periodiche',1200,'Elenco macchine e attrezzature di lavoro',null,'scelta','{}'),
    ('libretti','Attrezzature e manutenzioni periodiche',1210,'Libretti uso e manutenzione macchine e attrezzature',null,'scelta','{}'),
    ('ce_dico','Attrezzature e manutenzioni periodiche',1220,'Dichiarazioni di conformità CE',null,'scelta','{}'),
    ('ce_archiviazione','Attrezzature e manutenzioni periodiche',1221,'Dichiarazioni CE — luogo di archiviazione','Era figlia di «DC CE»: resa sempre visibile.','testo','{}'),
    ('ce_foto','Attrezzature e manutenzioni periodiche',1222,'Dichiarazioni CE — foto documento (copertina)','Era figlia di «DC CE»: resa sempre visibile.','foto','{}'),
    ('registro_macchine','Attrezzature e manutenzioni periodiche',1230,'Registro controllo macchine/attrezzature (ove previsto)','Conservare i risultati di almeno gli ultimi 3 anni a disposizione degli organi di vigilanza.','scelta','{}'),
    ('carrelli','Attrezzature e manutenzioni periodiche',1240,'Carrelli elevatori — verifica periodica di funzionalità','Ditta e registrazioni.','data','{"scadenza":{"periodicita_default_mesi":12}}'),
    ('sollevamento_dico','Attrezzature e manutenzioni periodiche',1250,'Apparecchi di sollevamento > 200 kg — dichiarazione di conformità e libretto',null,'scelta','{}'),
    ('sollevamento_ispezioni','Attrezzature e manutenzioni periodiche',1260,'Apparecchi di sollevamento > 200 kg — ispezioni periodiche (ASL/Organismo Notificato)','Ditta e registrazioni.','data','{"scadenza":{"periodicita_default_mesi":12}}'),
    -- Cartellonistica
    ('cartelli','Cartellonistica',1500,'Cartellonistica di salute e sicurezza',null,'scelta','{}'),
    ('cartelli_integra','Cartellonistica',1501,'Cartellonistica — è da integrare? Dove?','Compila se Non conforme (era figlia di «cartellonistica»).','testo','{}'),
    ('scaffalature','Cartellonistica',1510,'Scaffalature — verifica UNI EN 15635 / UNI 11636 — ultima verifica',null,'data','{}'),
    -- Gestione rifiuti
    ('rifiuti','Gestione rifiuti',1600,'L''azienda produce rifiuti?',null,'scelta',
      '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}'),
    -- Emissioni in atmosfera
    ('emissioni','Emissioni in atmosfera',1700,'Ci sono camini/sbocchi verso l''esterno collegati a impianti produttivi?',null,'scelta',
      '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}'),
    -- Attività periodiche
    ('riunione','Attività periodiche',1400,'Verbale della riunione periodica (art. 35 D.Lgs. 81/08; annuale)',null,'data','{"scadenza":{"periodicita_default_mesi":12}}'),
    ('evacuazione','Attività periodiche',1410,'Prova di evacuazione annuale (se > 10 dip. o SCIA/VVF) — ultima prova',null,'data','{"scadenza":{"periodicita_default_mesi":12}}'),
    -- Sopralluogo ambienti di lavoro
    ('segnalazioni','Sopralluogo ambienti di lavoro',1800,'Segnalazioni del consulente','Aggiungi una segnalazione per ogni aspetto rilevato. Ogni segnalazione può diventare una cosa da fare e/o una scadenza.','rilievo',
      '{"ripetibile":true,"etichetta_aggiunta":"Aggiungi segnalazione"}')
  ) as v(codice, sezione, ordine, testo, descr, tipo, config);

  -- ---- sotto-domande (figlie) che pendono da una 'scelta' reale ----

  -- Organigramma: dati anagrafici condizionati alla scelta
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  select t, x.codice, 'Organigramma', x.ordine, x.testo, 'testo',
         (select id from voce_template where template_id=t and codice=x.parent), x.chiave, '{}'
  from (values
    ('rspp_esterno',111,'Cognome/Nome + data nomina','rspp','esterno'),
    ('rspp_interno',112,'Cognome/Nome + data nomina','rspp','interno'),
    ('rspp_datore',113,'Cognome/Nome + data nomina + formazione eseguita il','rspp','datore'),
    ('rls_dati',121,'Cognome/Nome + data nomina + formazione eseguita il','rls','rls_interno'),
    ('rls_t_dati',122,'Cognome/Nome + data nomina','rls','rls_t'),
    ('mc_dati',131,'Cognome/Nome + data nomina','mc','nominato'),
    ('dirigenti_dati',141,'Cognome/Nome + data nomina + formazione eseguita il','dirigenti','presenti'),
    ('preposti_dati',151,'Cognome/Nome + data nomina + formazione eseguita il','preposti','presenti')
  ) as x(codice, ordine, testo, parent, chiave);

  -- Formazione: quale fondo (se Sì)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (t,'fondo_quale','Formazione',211,'Quale fondo?','testo',
          (select id from voce_template where template_id=t and codice='fondo'),'si','{}');

  -- Radon: due gate di assoggettabilità (se Valutato)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  select t, x.codice, 'DVR e rischi specifici', x.ordine, x.testo, 'scelta',
         (select id from voce_template where template_id=t and codice='dvr_radon'),'valutato',
         '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}'
  from (values
    ('radon_pareti',751,'Tre pareti interamente sotto il piano di campagna?'),
    ('radon_ore',752,'≈10 ore/mese di permanenza del personale nella zona?')
  ) as x(codice, ordine, testo);

  -- Sorveglianza sanitaria: 4 sotto-voci (se Sì)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  select t, x.codice, 'Medicina e sorveglianza sanitaria', x.ordine, x.testo, 'scelta',
         (select id from voce_template where template_id=t and codice='sorv'),'si', x.config::jsonb
  from (values
    ('sorv_protocollo',1001,'Protocollo sanitario','{}'),
    ('sorv_idoneita',1002,'Idoneità specifiche alla mansione','{}'),
    ('sorv_visita',1003,'Visita periodica del MC agli ambienti di lavoro (annuale)','{"scadenza":{"periodicita_default_mesi":12}}'),
    ('sorv_registro',1004,'Registro lavoratori esposti ad agenti cancerogeni','{}')
  ) as x(codice, ordine, testo, config);

  -- Rifiuti: tipologia + RENTRI (se Sì)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, descrizione, tipo, parent_voce_id, mostra_se_chiave, config)
  values
    (t,'rifiuti_tipologia','Gestione rifiuti',1601,'Tipologia di rifiuti prodotti',null,'multiscelta',
      (select id from voce_template where template_id=t and codice='rifiuti'),'si',
      '{"opzioni":[{"chiave":"pericolosi","etichetta":"Pericolosi"},{"chiave":"non_pericolosi","etichetta":"Non pericolosi"}]}'),
    (t,'rentri','Gestione rifiuti',1602,'Iscrizione al RENTRI effettuata?',
      'Termini per n. dipendenti: < 11 entro 13/02/2026; 11–50 entro 13/08/2025; > 50 entro 13/02/2025. Se «No», aprire una cosa da fare con la scadenza applicabile.',
      'scelta',
      (select id from voce_template where template_id=t and codice='rifiuti'),'si',
      '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}');

  -- Emissioni: autorizzazione Provincia (se Sì)
  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (t,'emissioni_autorizzate','Emissioni in atmosfera',1701,'Sono stati autorizzati/comunicati alla Provincia competente?','scelta',
          (select id from voce_template where template_id=t and codice='emissioni'),'si',
          '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}');

end $$;


-- =====================================================================
-- PULIZIA · rimuove il template di PROVA dopo la valutazione.
-- Le voci spariscono in cascata (voce_template.template_id ON DELETE CASCADE),
-- quindi basta cancellare la riga del template:
-- =====================================================================
-- delete from checklist_template where tipo_attivita = 'PROVA — Check-up DVR';
--
-- NB: se hai APERTO/COMPILATO un sopralluogo di test con questa checklist, la
-- checklist_compilata la blocca (ON DELETE RESTRICT). In quel caso, prima:
-- delete from checklist_compilata where template_id in
--   (select id from checklist_template where tipo_attivita = 'PROVA — Check-up DVR');
-- (gli esiti compilati spariscono in cascata) e poi esegui il delete del template.
