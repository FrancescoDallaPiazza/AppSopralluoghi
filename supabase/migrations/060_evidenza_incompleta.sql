-- 060_evidenza_incompleta.sql
--
-- Attestati che documentano solo UNA PARTE del percorso realmente svolto.
--
-- Il caso che l'ha imposta: "INTEGRAZIONE FORMAZIONE PARTICOLARE AGGIUNTIVA
-- PREPOSTI", 3h. E' la parte in aula di un corso preposti da 8h (ante ASR 2025)
-- le cui prime 5h erano in e-learning; il gestionale esporta solo l'aula. Il
-- requisito e' ASSOLTO - il corso si e' concluso prima dell'ASR 17/04/2025 - e
-- la scadenza si calcola bene, perche' l'aula e' l'ultima parte del percorso.
-- Ma agli atti manca l'attestato delle 5h a distanza, e questo va detto: chi
-- apre il libretto formativo legge "3h" senza sapere che ne mancano 5, e a
-- distanza di anni la data di chiusura del modulo online non la ricostruisce
-- piu' nessuno.
--
-- PERCHE' NON BASTAVANO I FLAG CHE CI SONO.
--   `parziale` (059) e' una cosa DIVERSA: dice che l'attestato non assolve e che
--   le sue ore vanno sommate agli altri spezzoni. Usarlo qui riaprirebbe un
--   requisito che e' assolto - e non si chiuderebbe mai, perche' le ore dovute a
--   catalogo sono quelle dell'ASR 2025 (12h) e il percorso vecchio ne valeva 8.
--   `note` e' testo libero: si legge, ma nessuno ci puo' costruire sopra un
--   avviso o una voce in "Cose da fare". Un buco documentale che non genera
--   lavoro non viene chiuso.
-- Quindi: un flag che NON tocca la valutazione di conformita' e apre una
-- pendenza DOCUMENTALE. Stessa logica delle evidenze di nomina (053), dove la
-- nomina e' valida ma l'atto va comunque recuperato.
--
-- DUE TABELLE, come per `pregressa` e `parziale`:
--   corso_alias.evidenza_incompleta : si marca UNA volta sul dizionario.
--   formazione.evidenza_incompleta  : l'import C1b lo copia sull'attestato, ed
--                                     e' li' che il motore lo legge.
-- La spiegazione di COSA manca sta in `note` (dell'alias, che l'import copia
-- sull'attestato): "prime 5h in e-learning" e' un dato per l'uomo, non per il
-- motore, e non merita una colonna sua.
--
-- Idempotente, ASCII-only.

alter table corso_alias add column if not exists evidenza_incompleta boolean not null default false;
alter table formazione  add column if not exists evidenza_incompleta boolean not null default false;

comment on column corso_alias.evidenza_incompleta is
  'L''attestato di questo corso documenta solo una parte del percorso svolto (es. la sola aula di un corso iniziato in e-learning). Non incide sulla conformita'': apre una pendenza documentale.';
comment on column formazione.evidenza_incompleta is
  'Documentazione incompleta: agli atti manca una parte del percorso (vedi `note`). Il requisito resta assolto; la parte mancante va recuperata e registrata.';

-- Si cercano per persona, insieme al resto della sua formazione: l'indice serve
-- a "Cose da fare", che le raccoglie per tutto il cliente.
create index if not exists idx_formazione_evidenza_incompleta
  on formazione(persona_id) where evidenza_incompleta;
