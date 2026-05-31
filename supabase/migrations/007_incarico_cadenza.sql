-- =====================================================================
-- 007 · Cadenza di pianificazione sull'incarico. Tutto ADDITIVO, nullable.
--
-- Permette di esprimere un incarico come "1 sopralluogo ogni X giorni /
-- settimane / mesi" invece del solo numero totale. Il campo `n_sopralluoghi`
-- resta e viene RICALCOLATO in automatico dalla cadenza + periodo, così
-- progressivi (k/N), avanzamento della pianificazione e report non cambiano.
--
-- Se cadenza_valore / cadenza_unita sono NULL, l'incarico è a "numero fisso",
-- esattamente come prima della 007.
-- =====================================================================

alter table incarico
  add column if not exists cadenza_valore integer,
  add column if not exists cadenza_unita  text;

alter table incarico drop constraint if exists incarico_cadenza_unita_chk;
alter table incarico add constraint incarico_cadenza_unita_chk
  check (cadenza_unita is null or cadenza_unita in ('giorni', 'settimane', 'mesi'));

alter table incarico drop constraint if exists incarico_cadenza_valore_chk;
alter table incarico add constraint incarico_cadenza_valore_chk
  check (cadenza_valore is null or cadenza_valore > 0);
