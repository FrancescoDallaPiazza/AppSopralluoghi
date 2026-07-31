-- Spezzoni "coda in aula di un corso iniziato in e-learning".
--
-- NON e' una migration: agisce su `corso_alias`, che e' un dizionario POPOLATO
-- DAI DATI (caricamento dell'export del gestionale), non uno schema. Si esegue
-- nell'SQL Editor dopo che gli alias esistono, come mappatura_alias_gestionale.sql.
--
-- Il caso: "INTEGRAZIONE FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI", 3h. Non e'
-- un corso: e' la parte in aula di un corso per preposti le cui prime ore sono
-- state erogate a distanza. Il gestionale esporta solo l'aula, quindi in app
-- quelle 3h arrivavano come un attestato intero e il requisito "preposto"
-- risultava assolto con 3 ore su quelle dovute.
--
-- Marcandolo `parziale`, il motore lo tratta per quello che e': somma le ore
-- degli spezzoni dello stesso corso e chiude l'obbligo solo a soglia raggiunta
-- (`componiSpezzoni` in lib/admin/formazione.ts). Sotto soglia il requisito
-- resta aperto, il dettaglio dice a che punto e' ("3h su Nh") e in Cose da fare
-- compare la voce per recuperare la DATA DI CHIUSURA del modulo e-learning: e'
-- quello che manca davvero, e passati alcuni anni non lo ricostruisce piu'
-- nessuno.
--
-- NON e' ASCII-only e non puo' esserlo: il testo deve combaciare carattere per
-- carattere con quello caricato dal parser.
--
-- Verificato sui dati Ecodent (2026-07-31): 1 riga interessata - DEROSSI
-- FRANCESCO, 08/07/2022, 3h.

begin;

update corso_alias
   set parziale = true
 where testo_gestionale in (
   'INTEGRAZIONE FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI'
 )
   and corso_codice is not null
   and not ignorato;

-- Controllo: deve tornare parziale = true sulla riga sopra.
select testo_gestionale, corso_codice, is_aggiornamento, parziale
  from corso_alias
 where testo_gestionale like 'INTEGRAZIONE%'
 order by testo_gestionale;

commit;

-- ATTENZIONE, da decidere prima di estendere l'elenco. Nell'export ci sono altre
-- righe "INTEGRAZIONE ..." che NON sono lo stesso caso e qui non vanno toccate
-- senza verificarle una per una:
--   * INTEGRAZIONE FORMAZIONE SPECIFICA LAVORATORI - RISCHIO ALTO/MEDIO: e' il
--     passaggio da un livello di rischio inferiore a uno superiore (le ore in
--     piu' dovute). Chi la fa ha gia' un corso intero alle spalle: trattarla da
--     spezzone azzererebbe un requisito assolto.
--   * INTEGRAZIONE R.S.P.P. DATORE DI LAVORO MODULO 3 E 4: moduli di un percorso
--     modulare, gia' gestiti come corsi a se'.
--   * INTEGRAZIONE ADDETTO PLE CON/SENZA STABILIZZATORI: modulo ponte fra le due
--     tipologie di piattaforma.
--
-- Le righe gia' importate NON cambiano da sole: `formazione.parziale` viene
-- scritto al momento dell'import copiando il flag dell'alias. Per allineare
-- quelle esistenti, dopo aver eseguito l'update qui sopra:
--
--   update formazione f
--      set parziale = true
--     from corso_alias a
--    where a.parziale
--      and f.import_key like 'gest:%'
--      and f.corso_codice = a.corso_codice
--      and upper(regexp_replace(f.corso_nome, '\s+', ' ', 'g')) = a.testo_gestionale;
--
-- (l'aggancio e' sul NOME originale conservato in `formazione.corso_nome`, che
-- e' il testo del gestionale: l'import lo scrive apposta.)
