delete from checklist_compilata where template_id in (select id from checklist_template where tipo_attivita = 'PROVA — Check-up DVR');
delete from checklist_template where tipo_attivita = 'PROVA — Check-up DVR';

do $$
declare
  t uuid;
begin
  insert into checklist_template (nome, tipo_attivita, versione, stato, note)
  values ('Check-up DVR — PROVA (modalità unica)', 'PROVA — Check-up DVR', 1, 'attivo',
          'Template di PROVA per valutare la bozza in app. Rimuovere dopo la valutazione.')
  returning id into t;

  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, descrizione, tipo, config)
  select t, v.codice, v.sezione, v.ordine, v.testo, v.descr, v.tipo, v.config::jsonb
  from (values
    ('datore_lavoro','Organigramma',1000,'Datore di lavoro','Ragione / Cognome Nome del datore di lavoro.','testo','{}'),
    ('rspp','Organigramma',1010,'RSPP — Responsabile del Servizio di Prevenzione e Protezione',null,'scelta',
      '{"opzioni":[{"chiave":"esterno","etichetta":"RSPP esterno"},{"chiave":"interno","etichetta":"RSPP interno"},{"chiave":"datore","etichetta":"Datore di lavoro (RSPP)"}]}'),
    ('rls','Organigramma',1020,'RLS / RLS-T',null,'scelta',
      '{"opzioni":[{"chiave":"rls_interno","etichetta":"RLS (interno)"},{"chiave":"rls_t","etichetta":"RLS-T (esterno)"},{"chiave":"non_nominato","etichetta":"Non nominato"}]}'),
    ('mc','Organigramma',1030,'Medico Competente',null,'scelta',
      '{"opzioni":[{"chiave":"nominato","etichetta":"Nominato"},{"chiave":"non_nominato","etichetta":"Non nominato"}]}'),
    ('dirigenti','Organigramma',1040,'Dirigenti',null,'scelta',
      '{"opzioni":[{"chiave":"presenti","etichetta":"Presenti"},{"chiave":"assenti","etichetta":"Assenti"}]}'),
    ('preposti','Organigramma',1050,'Preposti',null,'scelta',
      '{"opzioni":[{"chiave":"presenti","etichetta":"Presenti"},{"chiave":"assenti","etichetta":"Assenti"}]}'),
    ('deleghe','Organigramma',1060,'Deleghe di «gestione» del Titolare Effettivo','Presenza ed estremi delle eventuali deleghe.','scelta','{}'),
    ('visura','Organigramma',1070,'Visura camerale',null,'scelta','{}'),
    ('incarichi','Organigramma',1080,'Attribuzione incarichi a dirigenti/preposti',null,'scelta','{}'),
    ('ciclo_produttivo','Organigramma',1090,'Descrizione del ciclo produttivo e delle attività svolte',null,'testo','{}'),
    ('numero_addetti','Organigramma',1100,'Numero addetti totali, divisi per tipologia contrattuale','Se conosciuta.','testo','{}'),
    ('riunione','Organigramma',1110,'Verbale della riunione periodica (art. 35 D.Lgs. 81/08; annuale)',null,'data','{"scadenza":{"periodicita_default_mesi":12}}'),

    ('formazione_personale','Formazione',2000,'Formazione svolta dal personale','Cognome/Nome, tipologia corso, data corso.','testo','{}'),
    ('fondo','Formazione',2010,'Iscritto a un Fondo Interprofessionale?',null,'scelta',
      '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}'),

    ('planimetrie','Luoghi di lavoro',3000,'Planimetrie aggiornate (sede operativa)',null,'scelta','{}'),
    ('agibilita','Luoghi di lavoro',3010,'Certificato/licenza d''uso o agibilità (sede)',null,'scelta','{}'),
    ('nulla_osta','Luoghi di lavoro',3020,'Nulla osta inizio attività / DIAP / autorizzazione o accreditamento regionale',null,'scelta','{}'),
    ('cartelli','Luoghi di lavoro',3030,'Cartellonistica di salute e sicurezza',null,'scelta','{}'),
    ('cartelli_integra','Luoghi di lavoro',3040,'Cartellonistica — è da integrare? Dove?','Compila se Non conforme.','testo','{}'),
    ('scaffalature','Luoghi di lavoro',3050,'Scaffalature — verifica UNI EN 15635 / UNI 11636 — ultima verifica',null,'data','{}'),

    ('elettrico_dico','Impianti',4000,'Impianto elettrico — dichiarazione di conformità',null,'scelta','{}'),
    ('terra_denuncia','Impianti',4010,'Messa a terra — denuncia di messa in servizio a INAIL/ARPAV','Annotare data di presentazione e/o numero e data di protocollo.','scelta','{}'),
    ('terra_verifica','Impianti',4020,'Messa a terra — verifica periodica di funzionalità','Ditta e registrazioni. Cadenza 2/5 anni.','data','{"scadenza":{"periodicita_default_mesi":24}}'),
    ('terra_civa','Impianti',4030,'Messa a terra — comunicazione al portale CIVA/INAIL',null,'scelta','{}'),
    ('scariche','Impianti',4040,'Protezione scariche atmosferiche — denuncia INAIL/ARPAV (o autoprotezione)',null,'scelta','{}'),
    ('ascensori_licenza','Impianti',4050,'Ascensori/montacarichi — licenza di esercizio comunale',null,'scelta','{}'),
    ('ascensori_verifiche','Impianti',4060,'Ascensori/montacarichi — verifiche periodiche','Ditta e registrazioni.','data','{"scadenza":{"periodicita_default_mesi":24}}'),
    ('pressione_presenza','Impianti',4070,'Apparecchi in pressione — presenza e caratteristiche tecniche',null,'testo','{}'),
    ('pressione_verifiche','Impianti',4080,'Apparecchi in pressione — verifiche periodiche','Ditta e registrazioni.','data','{"scadenza":{"periodicita_default_mesi":24}}'),
    ('riscaldamento','Impianti',4090,'Impianti di riscaldamento — presenza','Potenzialità ed eventuale denuncia I.S.P.E.S.L.','testo','{}'),
    ('atex_relazione','Impianti',4100,'Rischio esplosione — relazione di classificazione ATEX',null,'scelta','{}'),
    ('atex_messa','Impianti',4110,'Rischio esplosione — messa in servizio impianti elettrici in luoghi ATEX (con verifiche)',null,'scelta','{}'),

    ('dvr','DVR',5000,'Documento di Valutazione dei Rischi (DVR) — ultima revisione',null,'data','{}'),
    ('dvr_chimico','DVR',5010,'DVR — rischio chimico',null,'scelta','{}'),
    ('sds','DVR',5020,'SDS più aggiornate dei prodotti utilizzati — ultima revisione','Era figlia di «rischio chimico»: resa sempre visibile.','data','{}'),
    ('camp_aerodisperse','DVR',5030,'Campionamento sostanze aerodisperse (rischio chimico) — ultimo campionamento',null,'data','{}'),
    ('dvr_cancerogeno','DVR',5040,'DVR — cancerogeno/mutageno (amianto, silice, legno…) — ultima revisione',null,'data','{}'),
    ('registro_esposti','DVR',5050,'Registro degli esposti (cancerogeni)','Era figlia di «cancerogeno»: resa sempre visibile.','scelta','{}'),
    ('dvr_biologico','DVR',5060,'DVR — biologico — ultima revisione',null,'data','{}'),
    ('dvr_rumore','DVR',5070,'DVR — rumore — ultima revisione',null,'data','{}'),
    ('dvr_vibrazioni','DVR',5080,'DVR — vibrazioni — ultima revisione',null,'data','{}'),
    ('dvr_mmc','DVR',5090,'DVR — movimentazione manuale dei carichi — ultima revisione',null,'data','{}'),
    ('dvr_biomeccanico','DVR',5100,'DVR — sovraccarico biomeccanico arti superiori — ultima revisione',null,'data','{}'),
    ('dvr_posture','DVR',5110,'DVR — posture incongrue — ultima revisione',null,'data','{}'),
    ('dvr_microclima','DVR',5120,'DVR — microclima/macroclima — ultima revisione',null,'data','{}'),
    ('dvr_incendio','DVR',5130,'DVR — incendio — ultima revisione',null,'data','{}'),
    ('dvr_stress','DVR',5140,'DVR — stress lavoro-correlato — ultima revisione',null,'data','{}'),
    ('dvr_roa','DVR',5150,'DVR — radiazioni ottiche artificiali (ROA) — ultima revisione',null,'data','{}'),
    ('dvr_cem','DVR',5160,'DVR — campi elettromagnetici (CEM) — ultima revisione',null,'data','{}'),
    ('dvr_radon','DVR',5170,'DVR — radon (per locali sotterranei)',null,'scelta',
      '{"opzioni":[{"chiave":"valutato","etichetta":"Valutato"},{"chiave":"da_valutare","etichetta":"Da valutare"}]}'),
    ('dvr_atex','DVR',5180,'DVR — atmosfere esplosive — ultima revisione',null,'data','{}'),
    ('dvr_vdt','DVR',5190,'DVR — videoterminali (> 20 ore/sett.) — ultima revisione',null,'data','{}'),
    ('dpi_idoneita','DVR',5200,'DPI — valutazione di idoneità (inclusa nel DVR)',null,'scelta','{}'),
    ('dpi_consegna','DVR',5210,'DPI — verbali di consegna ai lavoratori (almeno annuale)',null,'scelta','{"scadenza":{"periodicita_default_mesi":12}}'),
    ('dpi_conformita','DVR',5220,'DPI — dichiarazione di conformità / certificazione (II e III categoria)',null,'scelta','{}'),
    ('dpi_istruzioni','DVR',5230,'DPI — istruzioni in lingua italiana',null,'scelta','{}'),
    ('minorenni','DVR',5300,'Procedura per minorenni — presenza e gestione',null,'scelta','{}'),
    ('soggetti_esterni','DVR',5310,'Soggetti esterni (fornitori, alternanza, volontari…) — presenza e gestione',null,'scelta','{}'),
    ('farmaci','DVR',5320,'Procedura farmaci salvavita — presenza e gestione',null,'scelta','{}'),
    ('gestanti','DVR',5330,'Donne lavoratrici gestanti/puerpere — procedura (data di riferimento)',null,'data','{}'),

    ('sorv','Sorveglianza sanitaria',6000,'La valutazione dei rischi ha definito la necessità di attivare la sorveglianza sanitaria?',null,'scelta',
      '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}'),

    ('anti_attivita','Antincendio',7000,'Attività principale ex Allegato III del DM 7/8/2012','Selezionare le attività soggette applicabili.','multiscelta',
      '{"opzioni":[{"chiave":"1_1c","etichetta":"1.1C — Gas infiammabili/comburenti in ciclo > 25 Nm3/h"},{"chiave":"2_1b","etichetta":"2.1B — Cabine decompressione gas naturale ≤ 2,4 MPa"},{"chiave":"2_2c","etichetta":"2.2C — Compressione/decompressione gas > 50 Nm3/h"},{"chiave":"3_1b","etichetta":"3.1B — Rivendite gas compressi ≥ 0,75 mc"},{"chiave":"3_2b","etichetta":"3.2B — Depositi ≤ 10 mc gas compressi ≥ 0,75 mc"},{"chiave":"3_3c","etichetta":"3.3C — Depositi > 10 mc gas compressi ≥ 0,75 mc"},{"chiave":"3_4c","etichetta":"3.4C — Impianti riempimento gas compressi ≥ 0,75 mc"},{"chiave":"3_5a","etichetta":"3.5A — Depositi GPL ≤ 300 kg"},{"chiave":"3_6b","etichetta":"3.6B — Rivendite GPL ≥ 75 kg"},{"chiave":"3_7b","etichetta":"3.7B — Depositi GPL 300–1.000 kg"},{"chiave":"altro","etichetta":"Altro"}]}'),
    ('anti_lavoratori','Antincendio',7010,'Lavoratori totali presenti (n.)','Più di 10?','numero','{}'),
    ('anti_pubblico','Antincendio',7020,'Luogo aperto al pubblico con > 50 persone contemporanee?',null,'scelta',
      '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}'),
    ('anti_pee','Antincendio',7030,'Piano di emergenza ed evacuazione (PEE)',null,'scelta','{}'),
    ('anti_planimetrie','Antincendio',7040,'Planimetrie di emergenza esposte (estintori, uscite, primo soccorso…)',null,'scelta','{}'),
    ('anti_estintori','Antincendio',7050,'Estintori, idranti, porte','Annotare ditta e disponibilità delle registrazioni degli interventi.','scelta','{}'),
    ('anti_sistemi','Antincendio',7060,'Sistemi di protezione antincendio','Annotare ditta e registrazioni degli interventi.','scelta','{}'),
    ('evacuazione','Antincendio',7070,'Prova di evacuazione annuale (se > 10 dip. o SCIA/VVF) — ultima prova',null,'data','{"scadenza":{"periodicita_default_mesi":12}}'),

    ('elenco_macchine','Attrezzature, macchinari e manutenzioni periodiche',8000,'Elenco macchine e attrezzature di lavoro',null,'scelta','{}'),
    ('libretti','Attrezzature, macchinari e manutenzioni periodiche',8010,'Libretti uso e manutenzione macchine e attrezzature',null,'scelta','{}'),
    ('ce_dico','Attrezzature, macchinari e manutenzioni periodiche',8020,'Dichiarazioni di conformità CE',null,'scelta','{}'),
    ('ce_archiviazione','Attrezzature, macchinari e manutenzioni periodiche',8030,'Dichiarazioni CE — luogo di archiviazione','Era figlia di «DC CE»: resa sempre visibile.','testo','{}'),
    ('ce_foto','Attrezzature, macchinari e manutenzioni periodiche',8040,'Dichiarazioni CE — foto documento (copertina)','Era figlia di «DC CE»: resa sempre visibile.','foto','{}'),
    ('registro_macchine','Attrezzature, macchinari e manutenzioni periodiche',8050,'Registro controllo macchine/attrezzature (ove previsto)','Conservare i risultati di almeno gli ultimi 3 anni a disposizione degli organi di vigilanza.','scelta','{}'),
    ('carrelli','Attrezzature, macchinari e manutenzioni periodiche',8060,'Carrelli elevatori — verifica periodica di funzionalità','Ditta e registrazioni.','data','{"scadenza":{"periodicita_default_mesi":12}}'),
    ('sollevamento_dico','Attrezzature, macchinari e manutenzioni periodiche',8070,'Apparecchi di sollevamento > 200 kg — dichiarazione di conformità e libretto',null,'scelta','{}'),
    ('sollevamento_ispezioni','Attrezzature, macchinari e manutenzioni periodiche',8080,'Apparecchi di sollevamento > 200 kg — ispezioni periodiche (ASL/Organismo Notificato)','Ditta e registrazioni.','data','{"scadenza":{"periodicita_default_mesi":12}}'),

    ('rifiuti','Ambiente',9000,'L''azienda produce rifiuti?',null,'scelta',
      '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}'),
    ('emissioni','Ambiente',9010,'Ci sono camini/sbocchi verso l''esterno collegati a impianti produttivi?',null,'scelta',
      '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}')
  ) as v(codice, sezione, ordine, testo, descr, tipo, config);

  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  select t, x.codice, 'Organigramma', x.ordine, x.testo, 'testo',
         (select id from voce_template where template_id=t and codice=x.parent), x.chiave, '{}'
  from (values
    ('rspp_esterno',1011,'Cognome/Nome + data nomina','rspp','esterno'),
    ('rspp_interno',1012,'Cognome/Nome + data nomina','rspp','interno'),
    ('rspp_datore',1013,'Cognome/Nome + data nomina + formazione eseguita il','rspp','datore'),
    ('rls_dati',1021,'Cognome/Nome + data nomina + formazione eseguita il','rls','rls_interno'),
    ('rls_t_dati',1022,'Cognome/Nome + data nomina','rls','rls_t'),
    ('mc_dati',1031,'Cognome/Nome + data nomina','mc','nominato'),
    ('dirigenti_dati',1041,'Cognome/Nome + data nomina + formazione eseguita il','dirigenti','presenti'),
    ('preposti_dati',1051,'Cognome/Nome + data nomina + formazione eseguita il','preposti','presenti')
  ) as x(codice, ordine, testo, parent, chiave);

  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (t,'fondo_quale','Formazione',2011,'Quale fondo?','testo',
          (select id from voce_template where template_id=t and codice='fondo'),'si','{}');

  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  select t, x.codice, 'DVR', x.ordine, x.testo, 'scelta',
         (select id from voce_template where template_id=t and codice='dvr_radon'),'valutato',
         '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}'
  from (values
    ('radon_pareti',5171,'Tre pareti interamente sotto il piano di campagna?'),
    ('radon_ore',5172,'≈10 ore/mese di permanenza del personale nella zona?')
  ) as x(codice, ordine, testo);

  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  select t, x.codice, 'Sorveglianza sanitaria', x.ordine, x.testo, 'scelta',
         (select id from voce_template where template_id=t and codice='sorv'),'si', x.config::jsonb
  from (values
    ('sorv_protocollo',6001,'Protocollo sanitario','{}'),
    ('sorv_idoneita',6002,'Idoneità specifiche alla mansione','{}'),
    ('sorv_visita',6003,'Visita periodica del MC agli ambienti di lavoro (annuale)','{"scadenza":{"periodicita_default_mesi":12}}'),
    ('sorv_registro',6004,'Registro lavoratori esposti ad agenti cancerogeni','{}')
  ) as x(codice, ordine, testo, config);

  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, descrizione, tipo, parent_voce_id, mostra_se_chiave, config)
  values
    (t,'rifiuti_tipologia','Ambiente',9001,'Tipologia di rifiuti prodotti',null,'multiscelta',
      (select id from voce_template where template_id=t and codice='rifiuti'),'si',
      '{"opzioni":[{"chiave":"pericolosi","etichetta":"Pericolosi"},{"chiave":"non_pericolosi","etichetta":"Non pericolosi"}]}'),
    (t,'rentri','Ambiente',9002,'Iscrizione al RENTRI effettuata?',
      'Termini per n. dipendenti: < 11 entro 13/02/2026; 11–50 entro 13/08/2025; > 50 entro 13/02/2025. Se «No», aprire una cosa da fare con la scadenza applicabile.',
      'scelta',
      (select id from voce_template where template_id=t and codice='rifiuti'),'si',
      '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}');

  insert into voce_template (template_id, codice, sezione, ordine, testo_requisito, tipo, parent_voce_id, mostra_se_chiave, config)
  values (t,'emissioni_autorizzate','Ambiente',9011,'Sono stati autorizzati/comunicati alla Provincia competente?','scelta',
          (select id from voce_template where template_id=t and codice='emissioni'),'si',
          '{"opzioni":[{"chiave":"si","etichetta":"Sì"},{"chiave":"no","etichetta":"No"}]}');

end $$;
