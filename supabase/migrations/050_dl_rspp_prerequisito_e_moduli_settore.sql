-- =====================================================================
-- 050 - DL-RSPP: prerequisito corretto + moduli di settore ATECO.
--
-- Chiude la confusione sul ruolo "Datore di lavoro che svolge l'RSPP":
--
-- 1) Il "Corso base Datore di lavoro 16h" NON e' un modulo proprio del
--    DL-RSPP: e' il PREREQUISITO, e coincide con la formazione generale del
--    datore di lavoro (corso DATORE_LAVORO, art. 37, ASR 17/04/2025). La 015
--    aveva creato un doppione (DL_RSPP_BASE 16h) e l'aveva messo come requisito
--    della figura dl_rspp, facendo comparire le 16h due volte. Qui il doppione
--    viene rimosso dai requisiti e disattivato a catalogo; il modulo comune 8h
--    punta come prerequisito al corso DATORE_LAVORO.
--
-- 2) I moduli di settore (variabili per ATECO 2007) diventano un requisito con
--    ore VARIABILI, espanse dal motore in app dall'ATECO del cliente (come gia'
--    avviene per la formazione specifica lavoratori con il livello di rischio).
--    Nuovi corsi DL_RSPP_SETTORE (per dl_rspp) e RSPP_MOD_B_SETTORE (per rspp e
--    aspp). Se l'ATECO non rientra nei settori speciali -> nessun modulo di
--    settore (il motore non emette il requisito, non e' un gap).
--
-- 3) Aggiornamenti DISTINTI e non assorbiti: la figura datore_lavoro mantiene
--    il suo 6h/5a (sul corso DATORE_LAVORO); la figura dl_rspp ha il suo 8h/5a
--    a parte, ora ancorato al modulo comune DL_RSPP_COMUNE.
--
-- Tutto ADDITIVO/idempotente: UPDATE su dati esistenti, INSERT con ON CONFLICT,
-- DELETE mirati. Nessuna modifica di struttura. Commenti ASCII-only. I valori
-- restano ASCII per sicurezza nel SQL Editor.
--
-- Mappe ore di settore (il motore in app le applica; qui documentate):
--   DL-RSPP (modulo comune 8h + settore):
--     A 01-02 Agricoltura/silvicoltura/zootecnia .... 16h
--     A 03    Pesca ................................. 12h
--     F       Costruzioni ........................... 16h
--     C 19-20 Coke / prodotti chimici ............... 16h
--     altri ATECO ................................... nessun modulo di settore
--   RSPP/ASPP (Modulo B comune 48h + settore):
--     A 01-02 ...................................... 16h
--     A 03 ......................................... 12h
--     F ............................................ 16h
--     Q 86.1 e 87 Sanita' e assistenza sociale ..... 12h
--     C 19-20 ...................................... 16h
--     altri ATECO .................................. nessun modulo di settore
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rimozione del doppione DL_RSPP_BASE
--    - lo tolgo dai requisiti della figura dl_rspp (le 16h arrivano dalla
--      figura datore_lavoro / dal prerequisito DATORE_LAVORO)
--    - disattivo il corso a catalogo (non hard-delete: eventuali attestati
--      storici che lo referenziano per codice non vanno persi; formazione non
--      ha FK verso corso_catalogo)
-- ---------------------------------------------------------------------
delete from figura_requisito
 where figura_codice = 'dl_rspp' and corso_codice = 'DL_RSPP_BASE';

update corso_catalogo
   set attivo = false,
       note   = 'DEPRECATO dalla 050. Le 16h base del DL-RSPP coincidono col corso DATORE_LAVORO (art. 37) e sono il PREREQUISITO, non un modulo proprio. Conservato solo per compatibilita con attestati storici.'
 where codice = 'DL_RSPP_BASE';

-- ---------------------------------------------------------------------
-- 2. Modulo comune DL-RSPP: prerequisito = DATORE_LAVORO, aggiornamento 8h/5a
-- ---------------------------------------------------------------------
update corso_catalogo
   set prerequisito_codice = 'DATORE_LAVORO',
       aggiornamento_mesi  = 60,
       ore_aggiornamento   = 8,
       note = 'Modulo comune 8h (ASR 17/04/2025). Prerequisito: corso base Datore di lavoro 16h (DATORE_LAVORO, art. 37). Aggiornamento 8h ogni 5 anni, distinto e aggiuntivo rispetto al 6h/5a del datore semplice.'
 where codice = 'DL_RSPP_COMUNE';

-- ---------------------------------------------------------------------
-- 3. Modulo di settore DL-RSPP (ore variabili, espanse da ATECO in app)
-- ---------------------------------------------------------------------
insert into corso_catalogo
  (codice, nome, categoria, ore, aggiornamento_mesi, ore_aggiornamento, prerequisito_codice, note)
values
  ('DL_RSPP_SETTORE', 'Datore di lavoro-RSPP - modulo di settore', 'dl_rspp',
   null, null, null, 'DL_RSPP_COMUNE',
   'Ore variabili per ATECO 2007: A01-02 16h, A03 12h, F 16h, C 19-20 16h; altri settori nessun modulo. Espanso dal motore in app dall ATECO del cliente. Nessun aggiornamento proprio: segue il ciclo del modulo comune.')
on conflict (codice) do update
   set nome                = excluded.nome,
       categoria           = excluded.categoria,
       ore                 = excluded.ore,
       aggiornamento_mesi  = excluded.aggiornamento_mesi,
       ore_aggiornamento   = excluded.ore_aggiornamento,
       prerequisito_codice = excluded.prerequisito_codice,
       note                = excluded.note,
       attivo              = true;

insert into figura_requisito (figura_codice, corso_codice, obbligatorio, per_categoria) values
  ('dl_rspp', 'DL_RSPP_SETTORE', true, false)
on conflict (figura_codice, corso_codice) do nothing;

-- ---------------------------------------------------------------------
-- 4. Modulo di settore RSPP/ASPP (sul Modulo B comune; ore variabili ATECO)
-- ---------------------------------------------------------------------
insert into corso_catalogo
  (codice, nome, categoria, ore, aggiornamento_mesi, ore_aggiornamento, prerequisito_codice, note)
values
  ('RSPP_MOD_B_SETTORE', 'RSPP/ASPP - Modulo B modulo di settore', 'rspp_aspp',
   null, null, null, 'RSPP_MOD_B',
   'Ore variabili per ATECO 2007: A01-02 16h, A03 12h, F 16h, Q 86.1 e 87 12h, C 19-20 16h; altri settori nessun modulo. Espanso dal motore in app dall ATECO del cliente. Nessun aggiornamento proprio: segue il ciclo del Modulo B.')
on conflict (codice) do update
   set nome                = excluded.nome,
       categoria           = excluded.categoria,
       ore                 = excluded.ore,
       aggiornamento_mesi  = excluded.aggiornamento_mesi,
       ore_aggiornamento   = excluded.ore_aggiornamento,
       prerequisito_codice = excluded.prerequisito_codice,
       note                = excluded.note,
       attivo              = true;

insert into figura_requisito (figura_codice, corso_codice, obbligatorio, per_categoria) values
  ('rspp', 'RSPP_MOD_B_SETTORE', true, false),
  ('aspp', 'RSPP_MOD_B_SETTORE', true, false)
on conflict (figura_codice, corso_codice) do nothing;
