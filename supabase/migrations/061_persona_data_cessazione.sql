-- 061_persona_data_cessazione.sql
--
-- Data di cessazione del rapporto (dimissioni/licenziamento/fine contratto).
--
-- Finora l'uscita di una persona era solo il flag `attivo=false` (bottone
-- "Disattiva"): la persona spariva dall'organigramma ma NON restava traccia di
-- QUANDO se n'e' andata. Sulla scheda si vedeva la data di assunzione e nient'altro.
--
-- La colonna e' puramente anagrafica: NON incide sulla valutazione, che continua
-- a guardare `attivo` (il motore filtra `.filter(p => p.attivo)`). Chi ha una
-- data di cessazione e' normalmente anche disattivato - il bottone Disattiva la
-- valorizza e Riattiva la azzera - ma i due dati restano distinti: `attivo` e'
-- il gate, `data_cessazione` e' il fatto.
--
-- Idempotente, ASCII-only.

alter table persona add column if not exists data_cessazione date;

comment on column persona.data_cessazione is
  'Data di cessazione del rapporto (dimissioni/licenziamento/fine contratto). Puramente anagrafica: non incide sulla valutazione, che guarda `attivo`.';
