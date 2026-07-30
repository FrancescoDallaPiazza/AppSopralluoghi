-- Le due divergenze del PASSO 1, risolte a favore della proposta.
-- Sono gli unici due update che sovrascrivono una decisione presa in
-- precedenza: si fanno a mano, uno per uno, perche' ognuno ha una ragione.

-- 1) Transpallet. Era mappato su ATTR_CARRELLO. Il transpallet non rientra
--    fra le attrezzature che richiedono abilitazione art. 73 (Allegato A ASR
--    22/02/2012: i carrelli elevatori semoventi con conducente a bordo, non i
--    transpallet a timone). Lasciarlo su ATTR_CARRELLO farebbe risultare
--    abilitata al carrello una persona che ha fatto 2h di transpallet.
update corso_alias
   set corso_codice = null, is_aggiornamento = false, parziale = false, ignorato = true
 where testo_gestionale = 'CORSO TEORICO E PRATICO PER LAVORATORI ADDETTI ALLA CONDUZIONE DI CARRELLI ELEVATORI DI TIPO TRANSPALLET';

-- 2) Ponteggi. Era stato messo fra gli ignorati per forza di cose: il catalogo
--    non aveva un codice per i ponteggi. La migration 058 lo ha aggiunto, per
--    cui la ragione dell'esclusione non esiste piu'. 28h, aggiornamento 4h ogni
--    4 anni (Allegato XXI).
update corso_alias
   set corso_codice = 'PONTEGGI', is_aggiornamento = false, parziale = false, ignorato = false
 where testo_gestionale = 'LAVORATORI E PREPOSTI ADDETTI AL MONTAGGIO, SMONTAGGIO E TRASFORMAZIONE DI PONTEGGI, USO DPI ANTICADUTA';
