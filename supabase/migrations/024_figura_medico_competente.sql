-- 024_figura_medico_competente.sql
-- Aggiunge la figura Medico competente all'organigramma. Non ha un percorso
-- formativo sicurezza (si registra la nomina): nessun figura_requisito. Obbligo
-- condizionale (solo se il DVR prevede sorveglianza sanitaria). ASCII-only.

insert into figura_sicurezza (codice, nome, ordine) values
  ('medico_competente', 'Medico competente', 35)
on conflict (codice) do nothing;

update figura_sicurezza
   set gruppo = 'Sorveglianza sanitaria', gruppo_ordine = 25, obbligo = 'condizionale',
       guida = E'Nominato dal datore di lavoro quando il DVR prevede sorveglianza sanitaria\nMedico specialista in medicina del lavoro o titoli equipollenti (art. 38 D.Lgs. 81/08)\nNon e'' un percorso formativo sicurezza: si registra la nomina del medico'
 where codice = 'medico_competente';
