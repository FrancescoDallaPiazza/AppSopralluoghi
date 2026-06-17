-- =====================================================================
-- 020 - Modulo aggiuntivo cantieri: da "esonero del corso base" a
--       "modulo formativo condizionato della figura".
--
-- In 017 i due promemoria cantieri erano stati attaccati al corso base
-- (corso_codice DIRIGENTE / DATORE_LAVORO, figura_codice null, tipo 'altro'):
-- cosi' comparivano sotto la sezione Esonero della card evidenze, che e'
-- fuorviante perche' non sono un esonero ma una formazione in piu'.
--
-- Qui li riagganciamo: corso_codice -> CANTIERI (il corso 6h gia' a catalogo)
-- e figura_codice -> la figura interessata. Cosi':
--   * non compaiono piu' tra i promemoria del corso base (il motore associa i
--     promemoria per corso_codice del requisito);
--   * sono individuabili come "modulo aggiuntivo della figura" e mostrati in
--     campo formazione con una spunta di applicabilita'.
-- Restano di tipo 'altro' (marcatore di modulo aggiuntivo condizionato).
-- Idempotente: dopo l'update il where non corrisponde piu'.
-- =====================================================================

update esonero_ammesso
   set corso_codice = 'CANTIERI', figura_codice = 'dirigente'
 where tipo = 'altro' and corso_codice = 'DIRIGENTE' and figura_codice is null;

update esonero_ammesso
   set corso_codice = 'CANTIERI', figura_codice = 'datore_lavoro'
 where tipo = 'altro' and corso_codice = 'DATORE_LAVORO' and figura_codice is null;
