-- 064_corso_alias_commento_chiave.sql
--
-- SOLO COMMENTI. Nessuna colonna, nessun dato, nessun indice: corregge una
-- descrizione di schema che era falsa e che ha gia' fatto sbagliare qualcuno.
--
-- IL COMMENTO SBAGLIATO. La 055 crea la colonna cosi':
--
--     testo_gestionale text not null unique,  -- la stringa esatta esportata
--
-- "La stringa esatta esportata" non e' vero. Cio' che ci finisce dentro passa
-- prima da `normalizzaTestoGestionale` (src/lib/admin/aliasCorsi.ts:99-100):
--
--     s.replace(/\s+/g, ' ').trim().toUpperCase()
--
-- cioe' MAIUSCOLO, spazi interni collassati a uno, niente spazi in testa o in
-- coda. E' una CHIAVE NORMALIZZATA per costruzione, non un verbatim.
--
-- QUANTO e' falso, misurato l'11 settembre 2026 confrontando i 268 alias con i
-- 268 titoli dell'export `elencoAnagraficaFormazioni.xlsx` (docs/c1a/
-- alias-il-testo-non-e-verbatim.md, testi in alias-testi-origine.json):
--
--     identici carattere per carattere ........  57
--     diversi solo per maiuscole/minuscole ....  196
--     diversi anche per gli spazi .............  15
--                                               ---
--                                                268
--
-- Duecentoundici righe su 268 NON sono la stringa esatta esportata. Fra le 15
-- con gli spazi diversi: 8 hanno uno spazio doppio dentro, 6 uno spazio in coda,
-- e UNA contiene un RITORNO A CAPO ("Lavoratori e Preposti addetti al
-- montaggio,\nsmontaggio e trasformazione di ponteggi, uso DPI anticaduta").
--
-- PERCHE' VALE UNA MIGRAZIONE. Il riconoscimento FUNZIONA: l'import normalizza
-- ogni riga del file con la stessa funzione prima di confrontarla
-- (aliasCorsi.ts:120, confronto a :161-165), quindi i due lati sono sempre
-- omogenei e nessun titolo si perde. Non c'e' niente da riparare nei dati.
-- Ma il commento descrive una cosa diversa da quella che il codice fa, e chi
-- legge lo schema senza aprire il codice conclude - ragionevolmente - che li'
-- dentro ci sia il verbatim. E' successo davvero il 2026-09-11: l'altra corsia
-- ne ha dedotto che i titoli con lo spazio doppio non si sarebbero trovati al
-- primo import, e stava per mettere una riparazione dove non serviva.
--
-- Un commento di schema e' un'affermazione, e va tenuto vero come un vincolo.
--
-- COSA NON FA QUESTA MIGRAZIONE. Non aggiunge una colonna `testo_origine`. La
-- forma originale del titolo oggi non e' conservata da nessuna parte - per
-- sapere se il gestionale scrive due spazi bisogna riaprire l'export - ed e' la
-- stessa perdita gia' vista sulla cella ATECO e sulle mansioni. Se si decide di
-- conservarla e' una colonna nuova con il suo backfill, non un commento.
--
-- Idempotente (comment on ... is sovrascrive), ASCII-only.

comment on column corso_alias.testo_gestionale is
  'CHIAVE NORMALIZZATA, non il testo verbatim del gestionale. Prodotta da normalizzaTestoGestionale() in src/lib/admin/aliasCorsi.ts: maiuscolo, spazi interni collassati a uno, trim. L''import applica la stessa funzione a ogni riga del file prima di confrontarla, quindi i due lati sono omogenei e il riconoscimento non dipende da come l''origine spazia o capitalizza. La forma ORIGINALE del titolo non e'' conservata: su 268 alias solo 57 coincidono carattere per carattere con l''export (196 differiscono per il case, 15 anche per gli spazi - uno contiene un ritorno a capo). Chi deve sapere come l''origine scrive davvero un titolo deve riaprire l''export: vedi docs/c1a/alias-testi-origine.json.';

comment on table corso_alias is
  'Dizionario dei titoli corso del gestionale (export elencoAnagraficaFormazioni.xlsx) verso corso_catalogo.codice. La chiave e'' testo_gestionale, che e'' normalizzata e non verbatim: vedi il commento della colonna.';
