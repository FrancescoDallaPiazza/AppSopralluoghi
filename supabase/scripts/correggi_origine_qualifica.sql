-- correggi_origine_qualifica.sql - NON e' una migration. Si lancia a mano
-- dall'SQL Editor, DOPO la 070: prima il vincolo `nomina_origine_nota` rifiuta
-- il valore 'qualifica' e l'update fallisce senza toccare niente.
--
-- LE 6 NOMINE CON LA PROVENIENZA SBAGLIATA. Scritte il 14 settembre 2026 alle
-- 09:07:13 UTC dall'import delle nomine, da righe del foglio "Ruoli SSL" con la
-- Mansione vuota. L'import di allora prendeva la Qualifica come se fosse la
-- mansione, e le ha scritte con origine = 'mansione'. Vengono dalla Qualifica.
-- Lette dal database in sola lettura il 14.09 (docs/STATO.md).
--
-- COSA TOCCA: solo `origine`. Figura, data e `origine_testo` restano come sono:
-- il testo verbatim e' gia' quello della Qualifica.
--
-- COME: per id, e solo se la riga porta ancora origine = 'mansione'. Se qualcuno
-- l'ha gia' cambiata, non la sovrascrive. Il conteggio finale deve dire 6: un
-- numero diverso va guardato prima di fidarsi del risultato.

begin;

update nomina set origine = 'qualifica'
 where origine = 'mansione'
   and id in (
     '918f8431-cdc7-4f74-b14a-1459238076b0',  -- ABD RABOU ESSAM MOHAMED, datore_lavoro, riga 11
     '209b3206-477c-4888-88ad-f321dc4154ae',  -- VEDOVA FLAVIO, datore_lavoro, riga 3289
     '15f15b32-e9bd-407b-9ef1-db0378674b5f',  -- CAFFINI AMEDEO, dirigente, riga 585
     '928db480-635d-48fd-b886-bd2e9073f7de',  -- CUNEGO ELENA, dl_rspp, riga 920
     '57db507b-8ab6-4ea2-a44d-1d31f902ea69',  -- LEZZI FRANCESCO, dl_rspp, riga 1762
     'cdaaa0d6-c66f-43fa-bedb-7a293dbc9307'   -- POLETTO RUGGERO, dl_rspp, riga 2531
   );

-- Deve dire 6.
select count(*) as con_origine_qualifica
  from nomina
 where origine = 'qualifica'
   and id in (
     '918f8431-cdc7-4f74-b14a-1459238076b0',
     '209b3206-477c-4888-88ad-f321dc4154ae',
     '15f15b32-e9bd-407b-9ef1-db0378674b5f',
     '928db480-635d-48fd-b886-bd2e9073f7de',
     '57db507b-8ab6-4ea2-a44d-1d31f902ea69',
     'cdaaa0d6-c66f-43fa-bedb-7a293dbc9307'
   );

commit;
