-- 065_cliente_ateco_origine.sql
--
-- LA CELLA DA CUI L'ATECO E' STATO DERIVATO, CONSERVATA ACCANTO AL DERIVATO.
--
-- `cliente.codice_ateco` non e' un dato inserito: e' DERIVATO da una cella di
-- testo libero dell'export del gestionale, prendendo il primo gruppo di 1-2
-- cifre che vi compare (`risolviAteco`). La derivazione e' giusta 261 volte su
-- 262 e la cella d'origine non veniva conservata: non e' rimasto niente con cui
-- rivedere la 262esima.
--
-- I TRE STATI, E PERCHE' IL TERZO ESISTE SOLO CON QUESTA COLONNA.
--
--   noto      la divisione c'e', e la cella non la smentisce;
--   ignoto    la divisione non c'e';
--   incerto   la divisione c'e' MA la cella dice che potrebbe essere un'altra.
--
-- Il terzo non lo esprime nessun tipo di ritorno e nessun valore della colonna
-- `codice_ateco`: in archivio '37' sta scritto esattamente come ogni altra
-- divisione giusta. Lo distingue SOLO il confronto con la cella. Quindi questa
-- colonna non e' un extra di comodo - e' cio' che rende lo stato esistente, e
-- senza di essa il difetto non si ripara, si sposta.
--
-- I DUE CASI VERI, misurati l'11 settembre 2026 su ElencoSedi.xlsx
-- (docs/c1a/ateco-i-cinque.md e docs/c1a/multi-codice-il-livello.md):
--
--   SHAMS SERVICE SRLS    cella: "37054" + a capo + "(F.41.2) COSTRUZIONE DI
--                         EDIFICI RESIDENZIALI E NON RESIDENZIALI". 37054 e' il
--                         CAP di Nogara e vince perche' viene prima. Archiviata
--                         la divisione 37 (gestione reti fognarie) per
--                         un'impresa edile. Il livello di rischio non cambia
--                         (37 e 41 sono entrambe alto, per caso), ma il modulo
--                         di settore si': 16 ore che non verrebbero mai chieste.
--
--   MIGLIORINI MATTEO     cella con DUE codici su divisioni diverse, 46.49.9 e
--                         33.12.70. Vince il primo del testo, che non e' un
--                         criterio ma l'ordine in cui qualcuno ha incollato le
--                         righe. Archiviato BASSO con l'alternativa ALTO: per i
--                         suoi 3 lavoratori sono 4 ore di formazione specifica
--                         invece di 12.
--
-- Su 267 celle piene, 11 hanno una forma da cui il risultato non e' determinato
-- dal contenuto (5 senza nessuna cifra, 2 con testo prima del codice, 4 con piu'
-- codici su divisioni diverse). Due su 262 portano una divisione discutibile.
--
-- COSA NON FA QUESTA MIGRAZIONE. Non riempie niente e non corregge niente: la
-- campagna di riempimento dell'ATECO resta rinviata (decisione di Francesco
-- dell'11 settembre 2026) e i due casi sopra restano da chiarire con una visura,
-- non con un criterio automatico. Questa colonna rende DICIBILE cio' che oggi e'
-- muto; chi lo dice resta una persona.
--
-- BACKFILL: nessuno possibile. La cella d'origine non e' stata conservata da
-- nessuna parte, quindi le righe esistenti restano a null e il loro stato e'
-- `noto` con riscontro `non_verificabile` - niente le smentisce e niente le
-- conferma. Si popolano da sole al prossimo import delle anagrafiche, che ora
-- la scrive (src/lib/admin/anagraficheImport.ts).
--
-- Idempotente, ASCII-only.

alter table cliente add column if not exists ateco_origine text;

comment on column cliente.ateco_origine is
  'La cella ATECO dell''export del gestionale, VERBATIM, da cui codice_ateco e'' stato derivato. Testo libero: puo'' contenere il codice con la sezione ("(C.25.62) Lavori di meccanica generale;"), piu'' codici, un CAP davanti, un a capo, o solo una descrizione a parole senza nessuna cifra. Serve a distinguere il terzo stato dell''ATECO - "ho una divisione e potrebbe essere quella sbagliata" - che nessun valore di codice_ateco puo'' esprimere da solo. Null = cella non conservata (righe anteriori a questa migrazione, o inserimento a mano): lo stato e'' "noto ma non verificabile". Non si normalizza e non si corregge: e'' la fonte, e serve proprio perche'' e'' diversa dal derivato. Vedi classificaAteco() in src/formazione/ateco.ts.';

comment on column cliente.codice_ateco is
  'DIVISIONE ATECO a due cifre (non il codice completo), derivata dalla cella ateco_origine prendendo il primo gruppo di 1-2 cifre. E'' il valore in uso: livello_rischio e le ore del modulo di settore si calcolano da qui. Per sapere se sia affidabile va confrontato con ateco_origine - da solo non lo dice.';
