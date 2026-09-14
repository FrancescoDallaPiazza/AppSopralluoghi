-- 070_qualifica_fonte_distinta.sql
--
-- LA QUALIFICA DIVENTA LA TERZA FONTE DELLE NOMINE, distinta dalla mansione.
-- Decisa da Francesco il 14 settembre 2026.
--
-- COSA SI E' VISTO, sull'export del 09/09/2026 (foglio "Ruoli SSL"). Accanto alla
-- Mansione (colonna Y) c'e' la Qualifica (X), anche lei testo libero. L'import
-- prendeva la mansione dalla prima colonna non vuota fra mansione, ruolo e
-- qualifica: la Qualifica entrava solo quando la Mansione era vuota, e ci entrava
-- travestita da mansione.
--   - 377 Qualifiche piene, 336 accanto a una Mansione piena e mai lette;
--   - di queste 336, 38 con una parola di ruolo, quasi sempre senza colonna di ruolo;
--   - 7 lette col ripiego (Mansione vuota): le 6 nomine scritte il 14.09 da quelle
--     righe portano origine = 'mansione' e vengono invece dalla Qualifica.
-- Le 160 righe della misura dell'11 settembre (8dab00a) leggevano solo la
-- Mansione: il seme della 068 riapplicato alla sola colonna Y da' 160 righe e 168
-- coppie, esatti.
--
-- COSA FA.
-- 1. `nomina.origine` accetta 'qualifica', e `origine_testo` porta il verbatim
--    anche in quel caso.
-- 2. Cinque forme nuove nel dizionario, viste SOLO nella colonna Qualifica. Le
--    grafie in `varianti` sono copiate dal file carattere per carattere.
--      LAVORATORE E PREPOSTO        -> preposto
--      RLS                          -> rls
--      RLS - LAVORATORE             -> rls   (il lavoratore non si asserisce: il
--                                             dizionario non lo fa mai, e
--                                             l'organigramma lo mette dall'import
--                                             della formazione. Lettura di
--                                             Francesco, 14.09)
--      RSPP-SOCIO                   -> rspp, NON mappabile, come SOCIO/RSPP (068)
--      LEGALE RAPPRESENTANTE/RSPP   -> rspp, NON mappabile: "legale rappresentante"
--                                      non e' scritto "datore di lavoro", e l'RSPP
--                                      secco non dice quale percorso sia
--
-- COSA NON FA.
-- - Non corregge le 6 nomine gia' scritte: e' una scrittura su dati veri, sta in
--   supabase/scripts/correggi_origine_qualifica.sql e si lancia DOPO questa
--   migrazione (prima il vincolo rifiuterebbe 'qualifica').
-- - Non tocca le 27 chiavi della 068: `npm run ruoli:check` legge solo la 068, e
--   gli otto esiti della 0007 restano quelli.
-- - Non tocca `persona.mansione`, che su quelle 7 persone contiene la Qualifica per
--   lo stesso ripiego nell'import delle anagrafiche: e' un'altra decisione.
--
-- Idempotente, ASCII-only. Si applica dall'SQL Editor.

alter table nomina drop constraint if exists nomina_origine_nota;
alter table nomina add constraint nomina_origine_nota
  check (origine is null or origine in ('colonna', 'mansione', 'qualifica', 'manuale'));

comment on column nomina.origine is
  'Da dove viene la nomina, e non si azzera mai: "colonna" (dichiarata in una colonna di ruolo del foglio, con la data dell''incarico), "mansione" o "qualifica" (dedotta dal testo libero di quella colonna con il dizionario ruolo_testo, senza data), "manuale" (inserita a mano). Mansione e qualifica sono due colonne diverse del gestionale e restano due valori (070).';
comment on column nomina.origine_testo is
  'Il testo VERBATIM da cui la nomina e'' stata dedotta: la mansione quando origine = "mansione", la qualifica quando origine = "qualifica" (070). Serve per la stessa ragione di cliente.ateco_origine: il derivato da solo non sa dire se sia affidabile, e senza il testo l''unico modo di rivedere una nomina e'' riaprire un Excel. Null quando origine e'' "colonna" o "manuale".';

insert into ruolo_testo (chiave, varianti, posizione, note) values
  ('LAVORATORE E PREPOSTO', array['Lavoratore e preposto'], 'non_dichiarato', '13 righe nell''export del 09/09/2026, colonna Qualifica'),
  ('RLS', array['RLS'], 'non_dichiarato', '4 righe nell''export del 09/09/2026, colonna Qualifica'),
  ('RLS - LAVORATORE', array['RLS - LAVORATORE'], 'non_dichiarato', '3 righe nell''export del 09/09/2026, colonna Qualifica'),
  ('RSPP-SOCIO', array['RSPP-SOCIO'], 'socio', '1 righe nell''export del 09/09/2026, colonna Qualifica'),
  ('LEGALE RAPPRESENTANTE/RSPP', array['Legale Rappresentante/RSPP'], 'non_dichiarato', '1 righe nell''export del 09/09/2026, colonna Qualifica')
on conflict (chiave) do nothing;

insert into ruolo_testo_figura (chiave, ruolo_asserito, figura_codice) values
  ('LAVORATORE E PREPOSTO', 'preposto', 'preposto'),
  ('RLS', 'rls', 'rls'),
  ('RLS - LAVORATORE', 'rls', 'rls'),
  ('RSPP-SOCIO', 'rspp', null),
  ('LEGALE RAPPRESENTANTE/RSPP', 'rspp', null)
on conflict (chiave, ruolo_asserito) do nothing;
