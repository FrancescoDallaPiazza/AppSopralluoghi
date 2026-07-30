-- 059_formazione_parziale.sql
--
-- C1a/C1b - formazione FRAZIONATA: attestati che da soli non assolvono
-- l'obbligo, ma sommati fra loro si'.
--
-- Il gestionale espone corsi erogati a spezzoni. Nei dati veri sono 7 righe su
-- 268, e sono di due forme:
--
--   * spezzoni numerati di un corso INIZIALE
--       "FORMAZIONE SPECIFICA RISCHIO ALTO PARZIALE 6H 1\2"   6h
--       "FORMAZIONE SPECIFICA RISCHIO ALTO, PARZIALE 6H 2/2"  6h
--     6 + 6 = 12h = formazione specifica lavoratori rischio alto. Assolto solo
--     avendo entrambi.
--   * spezzoni di un AGGIORNAMENTO periodico
--       "AGGIORNAMENTO PARZIALE PER LAVORATORI"           2h  (su 6h)
--       "AGGIORNAMENTO PARZIALE PER RLS"                  2h  (su 4h)
--       "AGGIORNAMENTO PARZIALE PER RSPP DATORE DI LAVORO RISCHIO ALTO" 2h
--
-- PERCHE' UNA COLONNA E NON UN NOME. Senza un flag esplicito il motore
-- tratterebbe uno spezzone come un attestato qualsiasi: `scegliFormazione`
-- prende il piu' recente per corso_codice e ne calcola la scadenza, quindi 2h
-- su 6 risulterebbero un requisito ASSOLTO. E' un falso verde, cioe' il
-- contrario di quello che l'app serve a fare. Il flag e' l'unica cosa che
-- distingue lo spezzone dall'attestato pieno: le ore da sole non bastano
-- (un aggiornamento lavoratori da 6h e' completo, uno da 6h "1\2" no).
--
-- DUE TABELLE:
--   corso_alias.parziale : lo si marca UNA volta sul dizionario, a mano, come
--                          gia' si fa per `pregressa`.
--   formazione.parziale  : l'import C1b lo copia dall'alias sull'attestato, ed
--                          e' li' che il motore lo legge.
--
-- Le ore dello spezzone stanno gia' in `formazione.ore` (colonna presente dalla
-- 015): non serve nulla di nuovo per sommarle. Le ore RICHIESTE dal requisito
-- sono gia' risolte dal motore (`ORE_SPECIFICA[rischio]` per LAV_SPEC,
-- `oreModuloSettore` per i moduli di settore, `corso.ore` / `ore_aggiornamento`
-- altrove): anche il termine di confronto esiste gia'.
--
-- Idempotente, ASCII-only.

alter table corso_alias add column if not exists parziale boolean not null default false;
alter table formazione  add column if not exists parziale boolean not null default false;

comment on column corso_alias.parziale is
  'L''alias e'' uno SPEZZONE del corso mappato: da solo non assolve, si somma agli altri spezzoni dello stesso corso.';
comment on column formazione.parziale is
  'Attestato di formazione frazionata: concorre al requisito con le sue `ore`, non lo assolve da solo.';

-- Gli spezzoni si cercano sempre per persona + corso: senza indice la somma
-- costringerebbe a scorrere tutte le formazioni della persona.
create index if not exists idx_formazione_parziale
  on formazione(persona_id, corso_codice) where parziale;
