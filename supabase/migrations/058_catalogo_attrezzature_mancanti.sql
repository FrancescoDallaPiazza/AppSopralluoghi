-- 058_catalogo_attrezzature_mancanti.sql
--
-- C1a - buchi del catalogo emersi mappando l'export COMPLETO del gestionale.
--
-- L'export usato finora ("ExportExcel", 74 righe) era in realta' la sola
-- categoria "Generica" del gestionale. L'export completo
-- ("elencoAnagraficaFormazioni", 268 righe) contiene anche le categorie
-- ufficiali - Accordo Stato Regioni 2025, Attrezzature, Aggiornamenti - e li'
-- compaiono cinque abilitazioni che il catalogo ASR dell'app non ha mai avuto
-- un codice per rappresentare. Senza codice l'alias resterebbe "da mappare"
-- per sempre, e il contatore non arriverebbe mai a 0: cioe' C1b (import della
-- formazione) resterebbe bloccato.
--
-- Scelta: codici dedicati e non il generico ATTR_GENERICO, per coerenza con
-- gli altri ATTR_* gia' introdotti dalla 045 (un codice per tipo di
-- attrezzatura) e per non trasformare ATTR_GENERICO in un contenitore
-- ambiguo che il motore leggerebbe come copertura di qualunque requisito
-- attrezzature.
--
-- Ore e periodicita' sono quelle dichiarate dal gestionale nell'export
-- (colonne "Durata (h)" e "Periodicita'"), che per queste voci coincidono con
-- l'Allegato A dell'ASR 22/02/2012 e successive:
--
--   ATTR_AUTORIBALTABILI       10h base / 4h ogni 5 anni
--   ATTR_CMM                    8h base / 4h ogni 5 anni
--   ATTR_CRF                    8h base / 4h ogni 5 anni
--   ATTR_POMPE_CLS             14h base / 4h ogni 5 anni
--   ATTR_TRATT_RUOTE_CINGOLI   13h base / 4h ogni 5 anni
--   PONTEGGI                   28h base / 4h ogni 4 anni  (art. 136 All. XXI)
--
-- ATTR_TRATT_RUOTE_CINGOLI e' il corso CONGIUNTO ruote+cingoli, che l'Allegato A
-- prevede come percorso a se' (13h, non 8+8): il gestionale lo espone come una
-- riga sola e il catalogo aveva solo i due codici separati. Senza un terzo
-- codice l'alias andrebbe forzato su uno dei due, dichiarando abilitata una
-- sola delle due tipologie di trattore.
--
-- PONTEGGI sta in 'lavori_speciali' e non in 'attrezzature': non e'
-- un'abilitazione art. 73 su attrezzatura, e' la formazione del montatore
-- (e del preposto alla sorveglianza) dell'Allegato XXI, con periodicita'
-- quadriennale propria. Stessa collocazione di ATTR_LAV_QUOTA.
--
-- NON vengono aggiunti a figura_requisito: come per la 045, sono abilitazioni
-- che dipendono dalla mansione, non requisiti di una figura dell'organigramma.
-- Aggiungerli li' produrrebbe falsi "mancante" su ogni cliente.
--
-- Idempotente (on conflict do update), ASCII-only.

insert into corso_catalogo
  (codice, nome, categoria, ore, aggiornamento_mesi, ore_aggiornamento, prerequisito_codice, note) values
  ('ATTR_AUTORIBALTABILI', 'Autoribaltabili a cingoli (art. 73)',                     'attrezzature',    10, 60, 4, null, null),
  ('ATTR_CMM',            'Caricatori per movimentazione materiali - CMM (art. 73)',  'attrezzature',     8, 60, 4, null, null),
  ('ATTR_CRF',            'Macchina agricola raccoglifrutta - CRF (art. 73)',         'attrezzature',     8, 60, 4, null, null),
  ('ATTR_POMPE_CLS',      'Pompe per calcestruzzo (art. 73)',                         'attrezzature',    14, 60, 4, null, null),
  ('ATTR_TRATT_RUOTE_CINGOLI', 'Trattori agricoli/forestali a ruote e a cingoli (art. 73)', 'attrezzature', 13, 60, 4, null,
   'Percorso congiunto dell''Allegato A (13h): non e'' la somma dei due corsi separati ATTR_TRATT_RUOTE + ATTR_TRATT_CINGOLI.'),
  ('PONTEGGI',            'Montaggio, smontaggio e trasformazione di ponteggi',       'lavori_speciali', 28, 48, 4, null,
   'Allegato XXI D.Lgs 81/08: vale anche per il preposto alla sorveglianza. Aggiornamento 4h ogni 4 anni.')
on conflict (codice) do update set
  nome = excluded.nome,
  categoria = excluded.categoria,
  ore = excluded.ore,
  aggiornamento_mesi = excluded.aggiornamento_mesi,
  ore_aggiornamento = excluded.ore_aggiornamento,
  note = excluded.note,
  attivo = true,
  updated_at = now();
