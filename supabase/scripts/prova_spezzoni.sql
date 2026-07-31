-- prova_spezzoni.sql - PROVA MANUALE della somma delle formazioni frazionate.
--
-- NON e' una migration e NON va committata come tale: scrive due attestati
-- FINTI in produzione, per vedere il motore comportarsi. Ogni riga porta il
-- marcatore [PROVA SPEZZONI] in `note`, e la sezione PULIZIA in fondo le
-- cancella con quello. Non tocca nient'altro.
--
-- Prerequisito: il deploy con il nuovo motore deve essere gia' in produzione,
-- altrimenti si vede il comportamento vecchio (il primo spezzone assolve).
--
-- Si esegue un passo per volta, guardando la scheda del cliente in mezzo:
-- il punto della prova e' proprio la DIFFERENZA fra il passo 1 e il passo 2.

-- ============ PASSO 0 - scegliere la persona (sola lettura) ============
-- Serve una persona di Ecodent che abbia il requisito LAV_SPEC, cioe' che sia
-- incaricata come lavoratore (o qualunque figura che lo richieda).
-- Annotarsi il suo id.
select p.id, p.nome, p.cognome, c.ragione_sociale, c.livello_rischio
  from persona p
  join cliente c on c.id = p.cliente_id
 where c.ragione_sociale ilike '%ecodent%'
   and p.attivo
 order by p.cognome, p.nome;

-- La soglia della prova dipende dal rischio del cliente letto qui sopra:
--   basso 4h - medio 8h - alto 12h  (formazione specifica lavoratori).
-- Con rischio ALTO i due spezzoni da 6h qui sotto fanno esattamente 12h.
-- Con rischio MEDIO (soglia 8h) il primo da solo non basta lo stesso: la prova
-- resta valida, cambia solo il numero mostrato nel dettaglio.


-- ============ PASSO 1 - primo spezzone ============
-- Sostituire <PERSONA_ID> con l'id copiato sopra.
insert into formazione
  (persona_id, corso_codice, corso_nome, data_completamento, ore,
   is_aggiornamento, parziale, note)
values
  ('<PERSONA_ID>', 'LAV_SPEC',
   'FORMAZIONE SPECIFICA RISCHIO ALTO PARZIALE 6H 1\2',
   '2026-03-10', 6, false, true, '[PROVA SPEZZONI]');

-- ORA GUARDARE la scheda del cliente (Formazione -> persona).
-- Atteso: il requisito "Formazione specifica lavoratori" NON e' assolto, e il
-- dettaglio dice "Formazione frazionata in corso: 6h su 12h".
-- Se invece risulta conforme, il deploy del nuovo motore non e' attivo.


-- ============ PASSO 2 - secondo spezzone ============
insert into formazione
  (persona_id, corso_codice, corso_nome, data_completamento, ore,
   is_aggiornamento, parziale, note)
values
  ('<PERSONA_ID>', 'LAV_SPEC',
   'FORMAZIONE SPECIFICA RISCHIO ALTO, PARZIALE 6H 2/2',
   '2026-04-15', 6, false, true, '[PROVA SPEZZONI]');

-- ORA GUARDARE di nuovo.
-- Atteso: requisito CONFORME, con scadenza calcolata dal 15/04/2026 (la data
-- del secondo spezzone, non del primo) + 60 mesi = 15/04/2031.
-- E' il punto centrale: l'obbligo si chiude quando arriva l'ultimo pezzo.


-- ============ PULIZIA - rimette tutto com'era ============
delete from formazione where note = '[PROVA SPEZZONI]';

-- Verifica che non sia rimasto nulla:
select count(*) as residui from formazione where note = '[PROVA SPEZZONI]';
