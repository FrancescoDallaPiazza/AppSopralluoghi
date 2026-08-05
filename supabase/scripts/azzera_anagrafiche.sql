-- ============================================================================
-- AZZERAMENTO ANAGRAFICHE - clienti, persone e storico dei rilievi
-- ============================================================================
-- NON e' una migration: non cambia lo schema, cancella DATI. Si esegue a mano
-- nell'SQL Editor di Supabase (Canale 3) e NON va messo in migrations/.
--
-- ATTENZIONE: e' IRREVERSIBILE. Non esiste un "annulla". Supabase tiene i
-- backup automatici solo dai piani a pagamento: se il progetto e' sul piano
-- free, quello che si cancella qui non torna indietro in nessun modo.
--
-- PRIMA di eseguire la PARTE 2, fai un backup:
--   Dashboard -> Database -> Backups (se disponibile sul piano)
--   oppure:  pg_dump "postgresql://..." > backup.sql
--
-- ----------------------------------------------------------------------------
-- COSA VIENE CANCELLATO
--   cliente ............. tutte le anagrafiche aziendali
--    +- persona ......... con nomine, evidenze di nomina, formazioni
--    |                    (attestati importati compresi), esoneri, adempimenti
--    +- sede ............ con i componenti di sito registrati
--    +- organigramma_revisione .. storico versionato degli organigrammi
--    +- werp_da_rivedere / werp_da_chiarire
--   incarico ............ e a cascata i sopralluoghi
--    +- sopralluogo ..... con checklist compilate, esiti voce, foto,
--                         revisioni e box del sopralluogo
--   azione .............. TUTTE le cose da fare e le scadenze, con il loro
--                         storico di aggiornamenti
--   corso_alias ......... il dizionario testo-del-gestionale -> corso_catalogo
--                         (vedi nota sotto: si ricostruisce)
--
-- COSA **NON** VIENE TOCCATO (configurazione, non anagrafica):
--   tecnico, area_interna,
--   checklist_template + voce_template, box_catalogo + box_sezione,
--   corso_catalogo, figura_sicurezza, figura_requisito, esonero_ammesso
--
-- ----------------------------------------------------------------------------
-- SU `corso_alias` - PERCHE' SI PUO' CANCELLARE
-- E' un dizionario, non un dato raccolto: nessuna tabella lo referenzia (i suoi
-- flag vengono COPIATI su `formazione` al momento dell'import, non letti dopo),
-- quindi cancellarlo non trascina via nulla.
-- E si rifa' in tre passi, tutti gia' nel repo - non e' lavoro a mano:
--   1. back-office -> Regole app -> Alias corsi: caricare
--      `elencoAnagraficaFormazioni.xlsx` (268 corsi) e premere Applica;
--   2. eseguire `supabase/scripts/mappatura_alias_gestionale.sql`
--      (motore di regole: 237 mappati, 31 ignorati, 0 da mappare);
--   3. eseguire `supabase/scripts/divergenze_fix.sql` (le 2 decisioni di
--      merito prese a mano: transpallet -> ignorato, ponteggi -> PONTEGGI).
-- Serve pero' avere ancora il file `elencoAnagraficaFormazioni.xlsx`: senza
-- quello il punto 1 non si fa, e gli altri due non hanno righe su cui agire.
-- ASSICURATI DI AVERLO PRIMA DI LANCIARE LA PARTE 2.
--
-- ----------------------------------------------------------------------------
-- PERCHE' QUEST'ORDINE
-- Due vincoli sono `on delete restrict` e bloccano la cancellazione a monte:
--   incarico.cliente_id     -> restrict  (001_init.sql:55)
--   sopralluogo.incarico_id -> restrict  (001_init.sql)
-- Quindi non si puo' partire dai clienti: si scende prima fino ai sopralluoghi.
-- `azione` va cancellata per PRIMA e a mano: i suoi legami col sopralluogo e
-- col cliente sono `on delete set null`, quindi cancellando i sopralluoghi le
-- azioni NON sparirebbero - resterebbero orfane, senza piu' origine, e
-- continuerebbero a comparire in "Cose da fare" e nello Scadenzario.
-- ============================================================================


-- ============================================================================
-- PARTE 1 - CONTA E BASTA (sola lettura, nessuna modifica)
-- Esegui QUESTA e leggi i numeri. Se non sono quelli che ti aspetti, fermati.
-- ============================================================================

select 'cliente'                as tabella, count(*) from cliente
union all select 'persona',               count(*) from persona
union all select '  di cui nomine',       count(*) from nomina
union all select '  di cui formazioni',   count(*) from formazione
union all select '  di cui esoneri',      count(*) from esonero
union all select 'sede',                  count(*) from sede
union all select 'adempimento',           count(*) from adempimento
union all select 'organigramma_revisione', count(*) from organigramma_revisione
union all select 'incarico',              count(*) from incarico
union all select 'sopralluogo',           count(*) from sopralluogo
union all select '  checklist_compilata', count(*) from checklist_compilata
union all select '  esito_voce',          count(*) from esito_voce
union all select '  foto',                count(*) from foto
union all select 'azione',                count(*) from azione
union all select 'corso_alias',           count(*) from corso_alias
union all select '  di cui mappati',      count(*) from corso_alias where corso_codice is not null
order by 1;

-- Controprova: cosa NON deve sparire. Questi numeri devono restare identici
-- anche dopo la PARTE 2.
select 'tecnico'            as configurazione, count(*) from tecnico
union all select 'checklist_template', count(*) from checklist_template
union all select 'box_catalogo',       count(*) from box_catalogo
union all select 'corso_catalogo',     count(*) from corso_catalogo
union all select 'figura_sicurezza',   count(*) from figura_sicurezza
order by 1;


-- ============================================================================
-- PARTE 2 - CANCELLA (IRREVERSIBILE)
-- Esegui solo dopo aver letto i numeri della PARTE 1 e fatto il backup.
-- Tutto in una transazione: se un passo fallisce, non resta un mezzo disastro.
-- ============================================================================

begin;

  -- 1. Azioni. Per prime, e a mano: i legami con sopralluogo e cliente sono
  --    `set null`, quindi nessuna cascata le porterebbe via.
  --    `aggiornamento_azione` cade da sola (cascade su azione_id).
  delete from azione;

  -- 2. Sopralluoghi. Cascata su: checklist_compilata -> esito_voce -> foto,
  --    sopralluogo_revisione, organigramma_conferma, sopralluogo_box.
  delete from sopralluogo;

  -- 3. Incarichi. Ora si puo': non hanno piu' sopralluoghi che li trattengono.
  delete from incarico;

  -- 4. Clienti. Cascata su: persona (-> nomina -> nomina_evidenza, formazione,
  --    esonero, adempimento), sede (-> componente_sito, adempimento),
  --    organigramma_revisione, werp_da_rivedere, werp_da_chiarire.
  delete from cliente;

  -- 5. Dizionario alias del gestionale. Ultimo perche' e' indipendente da tutto
  --    il resto: nessuna tabella lo referenzia. Si ricostruisce coi tre passi
  --    descritti in testa - a patto di avere ancora il file Excel.
  delete from corso_alias;

  -- Verifica dentro la transazione: devono essere tutti 0.
  select 'cliente' as tabella, count(*) from cliente
  union all select 'persona',     count(*) from persona
  union all select 'nomina',      count(*) from nomina
  union all select 'formazione',  count(*) from formazione
  union all select 'esonero',     count(*) from esonero
  union all select 'sede',        count(*) from sede
  union all select 'adempimento', count(*) from adempimento
  union all select 'incarico',    count(*) from incarico
  union all select 'sopralluogo', count(*) from sopralluogo
  union all select 'esito_voce',  count(*) from esito_voce
  union all select 'foto',        count(*) from foto
  union all select 'azione',      count(*) from azione
  union all select 'corso_alias', count(*) from corso_alias
  order by 1;

commit;


-- ============================================================================
-- DOPO
-- ============================================================================
-- 1. GLI ALLEGATI NON SI CANCELLANO DA QUI. I file negli Storage bucket
--    (foto dei sopralluoghi, attestati di formazione, evidenze di nomina)
--    restano dove sono: le righe che li puntavano non ci sono piu', quindi
--    diventano file orfani che occupano spazio e nessuno raggiunge.
--    Si svuotano dal Dashboard -> Storage, bucket per bucket.
--    Falla come operazione separata e consapevole: se un domani volessi
--    recuperare un attestato, quello e' l'unico posto dove sarebbe ancora.
--
-- 2. LE APP IN CAMPO HANNO UNA COPIA LOCALE (Dexie/IndexedDB). Finche' non
--    si sincronizzano continuano a mostrare clienti e persone che sul server
--    non esistono piu', e la loro outbox potrebbe tentare di riscrivere righe
--    verso clienti cancellati. Su ogni dispositivo installato: chiudere e
--    riaprire la PWA, e se restano dati fantasma svuotare i dati del sito.
--
-- 3. Il catalogo corsi, le figure e i template sono intatti: ricreando un
--    cliente, l'organigramma e i requisiti funzionano subito.
--
-- 4. IL DIZIONARIO ALIAS VA RIFATTO PRIMA DEL PROSSIMO IMPORT FORMAZIONE.
--    Con `corso_alias` vuoto l'import del gestionale non riconosce piu' nessun
--    testo-corso: non sbaglia, si ferma: ogni riga risulta "da mappare" e non
--    entra nulla. I tre passi sono in testa a questo file.
