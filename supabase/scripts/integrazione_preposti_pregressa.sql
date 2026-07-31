-- "INTEGRAZIONE FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI" (3h): evidenza
-- PREGRESSA, non spezzone.
--
-- NON e' una migration: agisce su `corso_alias`, che e' un dizionario POPOLATO
-- DAI DATI (caricamento dell'export del gestionale), non uno schema. Si esegue
-- nell'SQL Editor dopo che gli alias esistono, come mappatura_alias_gestionale.sql.
--
-- Cos'e' quella riga: la parte IN AULA di un corso per preposti da 8h (art. 37
-- c.7, regime ante ASR 2025) le cui prime 5h erano in e-learning. Il gestionale
-- esporta solo l'aula, quindi in app arriva un attestato da 3 ore.
--
-- Decisione (2026-07-31): il corso e' CONCLUSO prima dell'ASR 17/04/2025, quindi
-- il requisito da preposto e' assolto e la riga si tratta come evidenza
-- pregressa - non come spezzone. Trattarla da spezzone avrebbe lasciato il
-- requisito aperto per sempre: le ore dovute a catalogo sono 12 (ASR 2025) e la
-- somma 3 + 5 non arriva a 12 nemmeno recuperando la parte a distanza. Il
-- percorso vecchio non si giudica con il monte ore del nuovo.
--
-- Conseguenze, tutte volute:
--   * il motore prende l'attestato e calcola la scadenza da data +
--     `aggiornamento_mesi` (24 per PREPOSTO): l'aggiornamento biennale resta
--     dovuto, ed e' li' che il regime nuovo entra in gioco;
--   * la DATA e' corretta senza recuperare nulla - l'aula e' l'ultima parte del
--     corso, quindi l'8/7/2022 e' la conclusione, non un pezzo a meta';
--   * il motore mostra la dicitura originale dell'attestato al posto del nome a
--     catalogo (marcatore "Evidenza pregressa"), cosi' chi legge ritrova sul
--     cartaceo esattamente quel titolo;
--   * il libretto formativo e l'anteprima dell'import la mostrano come
--     "evidenza incompleta", con scritto cosa manca, e in "Cose da fare" compare
--     la voce per recuperare l'attestato delle 5h. Il requisito resta assolto:
--     e' una pendenza documentale, non di conformita'.
-- RICHIEDE la migration 060 (`evidenza_incompleta` su corso_alias e formazione),
-- da eseguire prima di questo script.
--
-- NON e' ASCII-only e non puo' esserlo: il testo deve combaciare carattere per
-- carattere con quello caricato dal parser.
--
-- Verificato sui dati Ecodent (2026-07-31): 1 riga interessata - DEROSSI
-- FRANCESCO, 08/07/2022, 3h.

begin;

update corso_alias
   set pregressa = true,
       parziale = false,
       -- Il requisito e' assolto, ma agli atti manca l'attestato delle 5h in
       -- e-learning: `evidenza_incompleta` (migration 060) apre la pendenza
       -- DOCUMENTALE senza toccare la conformita'. Senza questo flag il buco
       -- resterebbe scritto solo in una nota che nessuno trasforma in lavoro.
       evidenza_incompleta = true,
       note = 'Prime 5h in e-learning non agli atti: recuperare l''attestato e la data di chiusura del modulo a distanza.'
 where testo_gestionale in (
   'INTEGRAZIONE FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI'
 )
   and corso_codice is not null
   and not ignorato;

-- Allinea le righe GIA' importate: `formazione.pregressa` non esiste come
-- colonna - il marcatore e' la nota, la stessa che scrive l'import - mentre
-- `parziale` va tolto se una passata precedente lo aveva acceso e
-- `evidenza_incompleta` va acceso. L'aggancio e' sul NOME originale conservato
-- in `formazione.corso_nome`: e' il testo del gestionale, l'import lo scrive
-- apposta.
update formazione f
   set parziale = false,
       evidenza_incompleta = true,
       note = 'Evidenza pregressa (import gestionale) - prime 5h in e-learning non agli atti: recuperare l''attestato e la data di chiusura del modulo a distanza.'
 where f.import_key like 'gest:%'
   and upper(regexp_replace(f.corso_nome, '\s+', ' ', 'g'))
       = 'INTEGRAZIONE FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI';

-- Controllo: la riga deve risultare pregressa e NON parziale.
select testo_gestionale, corso_codice, is_aggiornamento, pregressa, parziale, evidenza_incompleta
  from corso_alias
 where testo_gestionale like 'INTEGRAZIONE%'
 order by testo_gestionale;

commit;

-- ATTENZIONE, da decidere prima di estendere l'elenco. Nell'export ci sono altre
-- righe "INTEGRAZIONE ..." che NON sono lo stesso caso e qui non vanno toccate
-- senza verificarle una per una:
--   * INTEGRAZIONE FORMAZIONE SPECIFICA LAVORATORI - RISCHIO ALTO/MEDIO: e' il
--     passaggio da un livello di rischio inferiore a uno superiore (le ore in
--     piu' dovute). Chi la fa ha gia' un corso intero alle spalle.
--   * INTEGRAZIONE R.S.P.P. DATORE DI LAVORO MODULO 3 E 4: moduli di un percorso
--     modulare, gia' gestiti come corsi a se'.
--   * INTEGRAZIONE ADDETTO PLE CON/SENZA STABILIZZATORI: modulo ponte fra le due
--     tipologie di piattaforma.
--
-- Il meccanismo degli SPEZZONI resta e serve: lo usano le 7 righe "... PARZIALE
-- 6H 1\2" / "2/2" del dizionario, che sono davvero mezzi corsi.
