-- 068_nomine_provenienza_e_dizionario_ruoli.sql
--
-- L'IMPORT DELLE NOMINE: da dove viene una nomina, e come si legge un ruolo
-- scritto dentro la mansione.
--
-- Due cose insieme, perche' la seconda senza la prima e' un dato che non si puo'
-- piu' rivedere.
--
-- ---------------------------------------------------------------------
-- 1. LA PROVENIENZA DELLA NOMINA
-- ---------------------------------------------------------------------
--
-- Meta' dell'organigramma del gestionale non sta nelle colonne dei ruoli: sta
-- scritta dentro la MANSIONE, in testo libero. Misurato l'11 settembre 2026 sul
-- foglio "Ruoli SSL" (docs/c1a/ruoli-fuori-dalla-colonna.md):
--
--     righe con un ruolo nelle COLONNE ........ 153
--     righe con un ruolo nella MANSIONE ....... 160
--     in entrambi .............................. 12
--     unione .................................. 301   -> le colonne ne dichiarano il 51%
--
-- Una nomina letta dalla colonna e' DICHIARATA: porta una data di incarico. Una
-- dedotta da "RSPP/titolare" e' INTERPRETATA da una regola. Non hanno lo stesso
-- peso quando qualcuno dovra' fidarsene, e su 301 righe 160 vengono dal testo:
-- non e' un caso marginale, e' meta' del totale.
--
-- E `da_confermare` (mig. 054) NON basta, ed e' la ragione per cui servono due
-- colonne nuove invece di riusare quella: `da_confermare` e' un COMPITO, non una
-- provenienza. Dice "qualcuno guardi questa riga" e SI AZZERA quando qualcuno la
-- guarda, portandosi via l'unica traccia del fatto che quel ruolo era stato
-- interpretato. Sei mesi dopo si trova una riga pulita. E' la differenza fra
-- "questa cella e' da rivedere" e "questa cella diceva 37054".
--
-- Stessa forma di cliente.ateco_origine (065) e del testo verbatim di
-- corso_alias (064): quando si deriva un dato da un testo altrui, il testo
-- altrui e' parte del dato.
--
-- ---------------------------------------------------------------------
-- 2. IL DIZIONARIO DEI RUOLI SCRITTI A MANO
-- ---------------------------------------------------------------------
--
-- 29 forme distinte su 160 righe: una riga su cinque e' scritta in modo nuovo.
-- Le varianti sono quelle prevedibili - separatore / o - o " - ", maiuscole
-- miste, ordine invertito, l'abbreviazione DL - piu' due che non lo sono: il
-- refuso "TITOLRE/RSPP" e la negazione "RSPP- NO TITOLARE", che non e' rumore ma
-- un'informazione precisa scritta a mano.
--
-- LA GRANA E' (TESTO, RUOLO ASSERITO), NON (TESTO, RUOLO). Cinque frasi ne
-- asseriscono DUE: "RSPP - Datori di Lavoro" dice che quella persona e' il
-- datore E che fa l'RSPP. Sono due fatti, e una frase che asserisce due cose
-- produce due righe. Per questo le tabelle sono due: 27 CHIAVI (da 29 grafie
-- verbatim, perche' RSPP/TITOLARE ne ha tre che differiscono solo per le
-- maiuscole) e 32 ASSERZIONI - le 27 chiavi piu' le cinque frasi che ne
-- asseriscono due.
--
-- CORREZIONE del 12 settembre 2026. Qui c'era scritto 34, e 34 erano le RIGHE
-- LETTERALI dell'insert: la coppia ('RSPP/TITOLARE', 'rspp') compariva tre
-- volte. Le due in piu' non scrivevano niente - `on conflict do nothing` le
-- scarta - quindi il database era gia' giusto e questa correzione non cambia un
-- dato: cambia il numero che qualcuno conterebbe per accorgersi di una
-- divergenza. Una tabella che esiste per essere CONTATA non puo' dichiarare un
-- totale che non e' il suo. Le due righe doppie sono tolte, e adesso
-- `npm run ruoli:check` verifica anche questo.
--
-- E LA POSIZIONE E' PROPRIETA' DEL TESTO, non della singola asserzione: descrive
-- la persona - titolare, socio, non titolare, esterno - e vale su tutte le righe
-- che quel testo genera. E' il meccanismo che fa risolvere "RSPP/titolare" in
-- dl_rspp invece che in rspp.
--
-- PERCHE' UNA TABELLA E NON UNO SWITCH. E' la lezione che corso_alias ha gia'
-- pagato: se la mappa e' in uno switch, qualcuno ci mette il caso mancante a
-- mano. Qui la regola si legge, si conta e si corregge con una riga.
--
-- `figura_codice` NULL non significa "non ancora tradotto": significa
-- RICONOSCIUTO E NON MAPPABILE. Sono le sette righe in cui il testo dice RSPP ma
-- non dice se quella persona sia il datore: essere socio non stabilisce di
-- esserlo, e "RSPP" secco non dice se sia interno o esterno. L'assenza della
-- regola e' VOLUTA, e l'import non deve indovinarla - STATO.md:245, "una nomina
-- che punta al ruolo sbagliato e' peggio di una nomina mancante".
--
-- ---------------------------------------------------------------------
-- LE REGOLE SONO LE STESSE DELLA 0007 DI APPOVERALL, E LO HO VERIFICATO
-- ---------------------------------------------------------------------
--
-- Il dizionario di AppOverall sta in un ALTRO database e da qui non si legge:
-- questa tabella e' una seconda implementazione della stessa regola, ed e'
-- esattamente la situazione in cui due copie divergono. Quindi prima di
-- scriverla ho riprodotto i loro otto esiti, letti da loro sul database dopo il
-- carico:
--
--     dl_rspp 81, antincendio 47, datore_lavoro 22, NON RISOLTE 7
--     preposto 6, rspp 3, aspp 1, dirigente 1          (168 coppie)
--
-- Otto su otto. Al primo tentativo ne sbagliavo due - non avevo l'abbreviazione
-- DL fra le parole che indicano il datore, e "RSPP- DL" cadeva fra le non
-- risolte. Se un giorno i due dizionari divergono, e' questo il conto che lo
-- dice: si rifa' e si guarda quale degli otto e' cambiato.
--
-- ---------------------------------------------------------------------
-- COSA QUESTA MIGRAZIONE NON FA
-- ---------------------------------------------------------------------
--
-- Non importa niente: `nomina` resta a zero righe. Scrive le regole e le colonne
-- che l'import usera', e nient'altro.
--
-- Idempotente, ASCII-only.

alter table nomina add column if not exists origine text;
alter table nomina add column if not exists origine_testo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nomina_origine_nota') then
    alter table nomina add constraint nomina_origine_nota
      check (origine is null or origine in ('colonna', 'mansione', 'manuale'));
  end if;
end $$;

comment on column nomina.origine is
  'Da dove viene questa nomina. "colonna" = letta da una colonna di ruolo dell''export, che porta la data dell''incarico ed e'' una dichiarazione. "mansione" = DEDOTTA dal testo libero della mansione applicando il dizionario ruolo_testo: e'' un''interpretazione, non una dichiarazione. "manuale" = inserita a mano nell''organigramma. NON SI AZZERA MAI: descrive da dove viene il dato, non cosa resta da fare - quello e'' da_confermare, che e'' un compito e si azzera. Null sulle righe anteriori alla mig. 068.';

comment on column nomina.origine_testo is
  'La mansione VERBATIM da cui la nomina e'' stata dedotta, quando origine = "mansione". Serve per la stessa ragione di cliente.ateco_origine: il derivato da solo non sa dire se sia affidabile, e senza il testo l''unico modo di rivedere una nomina e'' riaprire un Excel. Conserva anche cio'' che il dizionario non traduce - "RSPP ESTERNO", "RSPP- NO TITOLARE", "DIRETTORE TECNICO, RSPP E COMMERCIALE" - che sono informazioni vere che nessun codice di figura trattiene. Null quando origine non e'' "mansione".';

-- ---------------------------------------------------------------------
-- Il dizionario: 27 chiavi da 29 grafie, 32 asserzioni
-- ---------------------------------------------------------------------

create table if not exists ruolo_testo (
  chiave text primary key,
  varianti text[] not null,
  posizione text not null,
  note text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ruolo_testo_posizione_nota') then
    alter table ruolo_testo add constraint ruolo_testo_posizione_nota
      check (posizione in ('titolare_socio', 'socio', 'non_titolare', 'esterno', 'non_dichiarato'));
  end if;
end $$;

create table if not exists ruolo_testo_figura (
  chiave text not null references ruolo_testo(chiave) on delete cascade,
  ruolo_asserito text not null,
  figura_codice text references figura_sicurezza(codice) on delete restrict,
  primary key (chiave, ruolo_asserito)
);
create index if not exists idx_ruolo_testo_figura_figura on ruolo_testo_figura(figura_codice);

comment on table ruolo_testo is
  'I testi di MANSIONE del gestionale in cui e'' scritto un ruolo di sicurezza. `varianti` tiene TUTTE le grafie verbatim che producono quella chiave, `chiave` e'' la forma con cui si confronta (spazi collassati, trim, maiuscolo): due colonne perche'' il testo che si conserva e la chiave con cui si cerca sono due cose diverse - tenerne una sola costringe a scegliere fra perdere la forma e non trovare piu'' niente. Una sola chiave puo'' avere piu'' grafie: RSPP/TITOLARE ne ha tre, che differiscono solo per le maiuscole. `posizione` e'' cio'' che il testo dice della PERSONA (titolare, socio, non titolare, esterno) e vale per tutte le asserzioni di quel testo.';
comment on table ruolo_testo_figura is
  'Le figure asserite da un testo di mansione. La grana e'' (testo, ruolo asserito) perche'' una frase puo'' asserire DUE ruoli: "RSPP - Datori di Lavoro" dice che la persona e'' il datore e che fa l''RSPP, e sono due fatti. figura_codice NULL = riconosciuto e NON mappabile: la regola manca ed e'' voluto che manchi - l''import non deve indovinare, deve dirlo.';

-- ---------------------------------------------------------------------
-- Il seme. Generato dalla misura sull'export, non trascritto a mano.
-- Fra parentesi, in `note`, quante righe dell'export del 09/09/2026 avevano
-- quella forma: serve a sapere quali forme sono comuni e quali sono uniche.
-- ---------------------------------------------------------------------

insert into ruolo_testo (chiave, varianti, posizione, note) values
  ('ADD. ANTINCENDIO', array['ADD. ANTINCENDIO'], 'non_dichiarato', '47 righe nell''export del 09/09/2026'),
  ('RSPP/TITOLARE', array['RSPP/TITOLARE', 'RSPP/Titolare', 'RSPP/titolare'], 'titolare_socio', '49 righe nell''export del 09/09/2026 -- RSPP/TITOLARE x1, RSPP/Titolare x11, RSPP/titolare x37'),
  ('DATORE DI LAVORO', array['DATORE DI LAVORO'], 'titolare_socio', '15 righe nell''export del 09/09/2026'),
  ('RSPP- TITOLARE', array['RSPP- titolare'], 'titolare_socio', '14 righe nell''export del 09/09/2026'),
  ('RSPP - DATORI DI LAVORO', array['RSPP - Datori di Lavoro'], 'titolare_socio', '3 righe nell''export del 09/09/2026'),
  ('PREPOSTO', array['PREPOSTO'], 'non_dichiarato', '2 righe nell''export del 09/09/2026'),
  ('PREPOSTO- SUPERVISORE', array['Preposto- Supervisore'], 'non_dichiarato', '2 righe nell''export del 09/09/2026'),
  ('RSPP', array['RSPP'], 'non_dichiarato', '2 righe nell''export del 09/09/2026'),
  ('RSPP - DATORE DI LAVORO', array['RSPP - Datore di Lavoro'], 'titolare_socio', '2 righe nell''export del 09/09/2026'),
  ('RSPP ESTERNO', array['RSPP ESTERNO'], 'esterno', '2 righe nell''export del 09/09/2026'),
  ('RSPP- DL', array['RSPP- DL'], 'titolare_socio', '2 righe nell''export del 09/09/2026'),
  ('SOCIO/ RSPP', array['SOCIO/ RSPP'], 'socio', '2 righe nell''export del 09/09/2026'),
  ('SOCIO/RSPP', array['SOCIO/RSPP'], 'socio', '2 righe nell''export del 09/09/2026'),
  ('TITOLARE- RSPP', array['TITOLARE- RSPP'], 'titolare_socio', '2 righe nell''export del 09/09/2026'),
  ('TITOLARE/RSPP', array['TITOLARE/RSPP'], 'titolare_socio', '2 righe nell''export del 09/09/2026'),
  ('AMMINISTRATORE/DATORE DI LAVORO/RSPP', array['AMMINISTRATORE/DATORE DI LAVORO/RSPP'], 'titolare_socio', '1 righe nell''export del 09/09/2026'),
  ('DATORE DI LAVORO- RSPP', array['DATORE DI LAVORO- RSPP'], 'titolare_socio', '1 righe nell''export del 09/09/2026'),
  ('DIRETTORE TECNICO, RSPP E COMMERCIALE', array['DIRETTORE TECNICO, RSPP E COMMERCIALE'], 'non_dichiarato', '1 righe nell''export del 09/09/2026'),
  ('DIRIGENTE', array['DIRIGENTE'], 'non_dichiarato', '1 righe nell''export del 09/09/2026'),
  ('GOVERNANTE- PREPOSTO', array['GOVERNANTE- PREPOSTO'], 'non_dichiarato', '1 righe nell''export del 09/09/2026'),
  ('PREPOSTO- OPERAIO', array['PREPOSTO- Operaio'], 'non_dichiarato', '1 righe nell''export del 09/09/2026'),
  ('RSPP- NO TITOLARE', array['RSPP- NO TITOLARE'], 'non_titolare', '1 righe nell''export del 09/09/2026'),
  ('RSPP/ TITOLARE', array['RSPP/ Titolare'], 'titolare_socio', '1 righe nell''export del 09/09/2026'),
  ('SOCIO - TITOLARE - RSPP', array['SOCIO - TITOLARE - RSPP'], 'titolare_socio', '1 righe nell''export del 09/09/2026'),
  ('TITOLARE - RSPP', array['TITOLARE - RSPP'], 'titolare_socio', '1 righe nell''export del 09/09/2026'),
  ('TITOLARE ASPP E RSPP', array['TITOLARE ASPP e RSPP'], 'titolare_socio', '1 righe nell''export del 09/09/2026'),
  ('TITOLRE/RSPP', array['TITOLRE/RSPP'], 'titolare_socio', '1 righe nell''export del 09/09/2026')
on conflict (chiave) do nothing;

insert into ruolo_testo_figura (chiave, ruolo_asserito, figura_codice) values
  ('ADD. ANTINCENDIO', 'addetto_antincendio', 'addetto_antincendio'),
  ('DATORE DI LAVORO', 'datore_lavoro', 'datore_lavoro'),
  ('RSPP- TITOLARE', 'rspp', 'dl_rspp'),
  ('RSPP - DATORI DI LAVORO', 'datore_lavoro', 'datore_lavoro'),
  ('RSPP - DATORI DI LAVORO', 'rspp', 'dl_rspp'),
  ('PREPOSTO', 'preposto', 'preposto'),
  ('PREPOSTO- SUPERVISORE', 'preposto', 'preposto'),
  ('RSPP', 'rspp', null),
  ('RSPP - DATORE DI LAVORO', 'datore_lavoro', 'datore_lavoro'),
  ('RSPP - DATORE DI LAVORO', 'rspp', 'dl_rspp'),
  ('RSPP ESTERNO', 'rspp', 'rspp'),
  ('RSPP- DL', 'rspp', 'dl_rspp'),
  ('SOCIO/ RSPP', 'rspp', null),
  ('SOCIO/RSPP', 'rspp', null),
  ('TITOLARE- RSPP', 'rspp', 'dl_rspp'),
  ('TITOLARE/RSPP', 'rspp', 'dl_rspp'),
  ('AMMINISTRATORE/DATORE DI LAVORO/RSPP', 'datore_lavoro', 'datore_lavoro'),
  ('AMMINISTRATORE/DATORE DI LAVORO/RSPP', 'rspp', 'dl_rspp'),
  ('DATORE DI LAVORO- RSPP', 'datore_lavoro', 'datore_lavoro'),
  ('DATORE DI LAVORO- RSPP', 'rspp', 'dl_rspp'),
  ('DIRETTORE TECNICO, RSPP E COMMERCIALE', 'rspp', null),
  ('DIRIGENTE', 'dirigente', 'dirigente'),
  ('GOVERNANTE- PREPOSTO', 'preposto', 'preposto'),
  ('PREPOSTO- OPERAIO', 'preposto', 'preposto'),
  ('RSPP- NO TITOLARE', 'rspp', 'rspp'),
  ('RSPP/ TITOLARE', 'rspp', 'dl_rspp'),
  ('RSPP/TITOLARE', 'rspp', 'dl_rspp'),
  ('SOCIO - TITOLARE - RSPP', 'rspp', 'dl_rspp'),
  ('TITOLARE - RSPP', 'rspp', 'dl_rspp'),
  ('TITOLARE ASPP E RSPP', 'aspp', 'aspp'),
  ('TITOLARE ASPP E RSPP', 'rspp', 'dl_rspp'),
  ('TITOLRE/RSPP', 'rspp', 'dl_rspp')
on conflict (chiave, ruolo_asserito) do nothing;
