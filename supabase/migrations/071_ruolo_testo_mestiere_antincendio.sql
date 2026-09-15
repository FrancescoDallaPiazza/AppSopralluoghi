-- 071_ruolo_testo_mestiere_antincendio.sql
--
-- UN MESTIERE CHE CONTIENE LA PAROLA "ANTINCENDIO" NON E' UN RUOLO.
--
-- COSA SI E' VISTO. Sull'export del 09/09/2026 (ExportExcel (4).xlsx, foglio
-- "Ruoli SSL") nove righe di DER ERSTE s.r.l. hanno la mansione
-- "INSTALLATORE/MANUTENTORE IMPIANTI ANTINCENDIO E ANTIFURTO": righe 180, 277,
-- 278, 919, 1825, 2260, 2381, 2670, 2868. Il testo non e' a dizionario e contiene
-- ANTINCENDIO, quindi `risolviMansione` lo tratta come una forma nuova di un
-- ruolo (`contieneParolaDiRuolo`, src/lib/admin/ruoliTesto.ts) e l'import delle
-- nomine le mette tutte e nove fra le "da decidere". E' un mestiere: chi installa
-- impianti antincendio non e' per questo addetto antincendio della sua azienda.
-- Gia' annotato come rumore il 14.09 (STATO.md, "tre forme non a dizionario").
--
-- LA DECISIONE. Francesco, 15.09.2026: la forma entra nel dizionario come testo
-- che NON asserisce nessun ruolo.
--
-- COME. Una riga in `ruolo_testo` e NESSUNA in `ruolo_testo_figura`. Una voce
-- trovata senza asserzioni e' il "terzo esito" di `risolviMansione`: la riga non
-- asserisce niente, non diventa ne' nomina ne' "da decidere" (nomineImport.ts,
-- `asserisceQualcosa`). `caricaDizionarioRuoli` tiene le chiavi senza figure con
-- `asserzioni: []`. `posizione` e' 'non_dichiarato': il testo non dice niente
-- della posizione della persona.
--
-- COSA NON FA.
-- - Non tocca le nomine gia' scritte: nessuna delle nove righe ha una nomina
--   nata da questo testo, perche' finora finivano fra le "da decidere".
-- - Non tocca il seme della 068: `npm run ruoli:check` e `dizionario:check`
--   leggono solo quella, e restano 27 chiavi e 32 asserzioni.
-- - Per AppOverall, che tiene la gemella del dizionario: questa voce e' una
--   decisione sul testo del gestionale, e la loro 0007 non la ha.
--
-- Si verifica, dopo, in sola lettura:
--   select t.chiave, t.posizione,
--          (select count(*) from ruolo_testo_figura f where f.chiave = t.chiave) as figure
--     from ruolo_testo t
--    where t.chiave = 'INSTALLATORE/MANUTENTORE IMPIANTI ANTINCENDIO E ANTIFURTO';
-- Atteso: una riga, posizione non_dichiarato, figure 0. E l'anteprima delle
-- nomine sullo stesso file passa da 51 a 42 da decidere (mansione da 16 a 7).
--
-- Idempotente, ASCII-only. Si applica dall'SQL Editor.

insert into ruolo_testo (chiave, varianti, posizione, note) values
  ('INSTALLATORE/MANUTENTORE IMPIANTI ANTINCENDIO E ANTIFURTO',
   array['INSTALLATORE/MANUTENTORE IMPIANTI ANTINCENDIO E ANTIFURTO'],
   'non_dichiarato',
   'Mestiere, non ruolo: 9 righe di DER ERSTE nell''export del 09/09/2026, colonna Mansione. Nessuna figura, per decisione di Francesco del 15.09.2026')
on conflict (chiave) do nothing;
