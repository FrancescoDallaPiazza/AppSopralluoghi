-- 072 . Come e' stato deciso il livello di rischio, accanto al livello.
--
-- Il livello di rischio si applica con un gesto (il bottone RISCHIO della scheda
-- cliente) da quando la scelta dell'ATECO non lo scrive piu' da sola. Il 16
-- settembre 2026, nella verifica a vista, e' emerso che il gesto opposto non
-- esisteva: un livello applicato per prova non si poteva togliere, da nessuna
-- schermata. Deciso da Francesco lo stesso giorno: il gesto si fa, e **chiede una
-- motivazione**.
--
-- La colonna e' la sorella delle due che gia' esistono per gli altri due attributi
-- dell'organigramma -- `antincendio_definito_mediante` (mig. 050) e
-- `primo_soccorso_definito_mediante` (mig. 051): testo libero scritto nella stessa
-- patch del verdetto. La decisione 8 di AppOverall la chiede da sempre per il
-- rischio, e la colloca nella prima migrazione del repo unico; entra qui in
-- anticipo perche' senza di lei il gesto "togli" cancellerebbe un dato **senza
-- lasciare traccia di chi l'ha deciso e perche'**, che e' peggio del gesto
-- mancante.
--
-- Cosa questa colonna NON e' ancora, e va detto perche' non sembri fatta:
--   - non e' vincolata a un vocabolario (`tabella_ateco` / `valutazione_rischi` /
--     `interpello` / `manuale`): e' testo libero, come le sue due sorelle;
--   - non porta CHI ha deciso in una colonna sua, perche' in questo repo non c'e'
--     ancora un vocabolario di operatori a cui agganciarlo. La data la scrive
--     l'applicazione dentro al testo, che e' meno di una colonna e piu' di niente.
-- Il resto e' materiale del repo unico, dove la decisione 8 chiede la stessa forma
-- per tutti e tre gli attributi.
--
-- Nullable di proposito: le righe di oggi non hanno una motivazione e non se la
-- possono inventare. NULL = non sappiamo come e' stato deciso, ed e' la verita'.
--
-- Non si tocca `sede`: la sede rispecchia gli attributi che il motore legge, e il
-- motore non legge la motivazione. Il write-through di salvaCliente continua a
-- copiare solo quelli.
--
-- Idempotente, ASCII-only.

alter table cliente add column if not exists livello_rischio_definito_mediante text;

comment on column cliente.livello_rischio_definito_mediante is
  'Come e'' stato deciso il livello di rischio applicato, testo libero, scritto nella stessa patch del livello. Sorella di antincendio_definito_mediante (050) e primo_soccorso_definito_mediante (051). L''applicazione ci scrive "tabella_ateco" quando il livello viene applicato dal bottone RISCHIO, e la motivazione dell''operatore piu'' la data quando il livello viene tolto. NULL = non sappiamo come e'' stato deciso (tutte le righe anteriori a questa migrazione). La forma piena chiesta dalla decisione 8 di AppOverall - vocabolario, fonte, data e autore in colonne proprie - e'' materiale della prima migrazione del repo unico.';
