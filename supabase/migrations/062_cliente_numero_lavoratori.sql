-- 062 . Numero di lavoratori occupati dall'azienda (dato di anagrafica).
--
-- Serve a determinare le ore DOVUTE dove la norma le lega alla dimensione
-- aziendale. Caso concreto: aggiornamento annuale dell'RLS, art. 37 c. 11
-- D.Lgs 81/08 -- 4 ore nelle aziende da 15 a 50 lavoratori, 8 ore oltre i 50.
-- Il catalogo (migration 015) tiene fisso il minimo (4h) con una nota che
-- invita a "verificare dimensione": un numero plausibile scritto accanto a una
-- scadenza non si distingue da un numero verificato, e sopra i 50 lavoratori
-- era sbagliato per difetto senza che nulla lo segnalasse.
--
-- Nullable di proposito: finche' il dato non c'e' l'app NON deve dedurlo, deve
-- chiederlo. Le viste mostrano "4h o 8h - da confermare" invece di un numero.
--
-- Idempotente, ASCII-only.

alter table cliente add column if not exists numero_lavoratori integer;

comment on column cliente.numero_lavoratori is
  'Numero di lavoratori occupati. Determina le ore dovute dove la norma le lega alla dimensione aziendale (aggiornamento RLS: 4h fino a 50, 8h oltre - art. 37 c. 11 D.Lgs 81/08). NULL = dato non ancora confermato: non dedurlo, chiederlo.';
