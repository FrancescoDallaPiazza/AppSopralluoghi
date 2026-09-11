-- 067_art16_caso_totale_e_citazione.sql
--
-- SOLO TESTO. Nessuna colonna, nessuna riga nuova, nessun requisito cambiato:
-- la `053` resta valida in tutto. Qui si scrive cio' che quella migrazione
-- ASSUMEVA senza dirlo, e si mette la citazione dove c'era una nota.
--
-- ---------------------------------------------------------------------
-- 1. LA CITAZIONE: perche' il delegato segue il percorso del DATORE
-- ---------------------------------------------------------------------
--
-- La `053` scrive "Stesso percorso del datore" e aggiunge "il delegato assume
-- gli obblighi del datore, formazione inclusa". Era vero e non era citato: una
-- affermazione, non una fonte. L'11 settembre 2026 i due articoli sono stati
-- letti e trascritti (formazione-81-utils-src, reference/
-- dlgs-81-2008-articoli-citati.md, commit a1827fd), con due estrazioni
-- indipendenti confrontate a macchina.
--
-- LA PRIMA COSA CHE SI E' VISTA E' UN'ASSENZA: l'art. 16 non nomina mai la
-- formazione. Ne' come obbligo che discende dalla delega, ne' come requisito
-- presupposto; cio' che il delegato deve gia' possedere e' "professionalita' ed
-- esperienza" (lett. b), che il decreto non definisce e che non e' il corso.
-- Quindi l'obbligo formativo del delegato non nasce li': nasce dall'art. 37
-- c. 7, e SOLO attraverso la qualifica che gli si riconosce. E l'art. 37 c. 7
-- nomina datore di lavoro, dirigenti e preposti - il delegato non c'e', non per
-- esclusione ma per silenzio.
--
-- E LA NORMA NON DECIDE ESPRESSAMENTE. Non esiste un periodo che dica "il
-- delegato e' un datore di lavoro": chi lo cerca non lo trova, e va detto prima
-- di tutto il resto. Quello che esiste e' una CONVERGENZA di tre articoli:
--
--   art. 2 c.1 lett. b)  datore e' anche "il soggetto che ha la responsabilita'
--                        dell'organizzazione [...] in quanto esercita i poteri
--                        decisionali e di spesa";
--   art. 16 lett. c)-d)  la delega attribuisce "tutti i poteri di
--                        organizzazione, gestione e controllo" e "l'autonomia di
--                        spesa" - i due attributi di quella definizione;
--   art. 2 c.1 lett. d)  il dirigente invece "attua le direttive del datore di
--                        lavoro", e un delegato non ha direttive da attuare
--                        perche' la delega TRASFERISCE le funzioni. Questo terzo
--                        e' l'argomento piu' forte: esclude l'altra lettura
--                        invece di sostenere questa;
--   art. 299             le posizioni di garanzia gravano "altresi' su colui il
--                        quale, pur sprovvisto di regolare investitura, eserciti
--                        in concreto i poteri giuridici". La qualifica segue i
--                        poteri, non il nome dell'atto.
--
-- La formula che va usata quando qualcuno chiede la fonte, ed e' quella scritta
-- nella guida: CONVERGE, NON PREVEDE.
--
-- ---------------------------------------------------------------------
-- 2. LA DICHIARAZIONE DEL CASO TOTALE, che e' il pezzo che conta
-- ---------------------------------------------------------------------
--
-- L'art. 16 parla sempre di "funzioni delegate" e di poteri "richiesti dalla
-- SPECIFICA NATURA delle funzioni delegate": una delega puo' coprirne solo una
-- parte, e il decreto NON dice a che punto la parte sia abbastanza grande
-- perche' la qualifica di datore ne discenda.
--
-- Il modello ha una figura sola. La riga `figura_requisito` che lega
-- `datore_lavoro_art16` a `DATORE_LAVORO` asserisce quindi "delega piena" - e
-- fino a oggi lo asseriva senza dirlo. Non e' una riga sbagliata: e' una riga
-- NON DICHIARATA, che e' un difetto diverso e piu' difficile da vedere.
--
-- Qui non si modella la delega parziale, e non per pigrizia: il decreto non da'
-- il criterio, quindi non c'e' niente da modellare e inventarne uno sarebbe una
-- nostra decisione travestita da norma. Si scrive DI QUALE CASO PARLA la riga.
--
-- Il valore non e' che il sistema sapra' gestire un delegato parziale. E' che
-- chi ne incontrera' uno, leggendo questa riga, si accorgera' che non e' il suo
-- caso - invece di trovarci dentro una risposta che sembra pertinente. E' la
-- stessa cosa dei tre stati dell'ATECO (mig. 065), applicata a una figura
-- invece che a un calcolo: il silenzio e la risposta sbagliata si somigliano
-- solo finche' nessuno li separa.
--
-- Oggi non morde su nessuno: `nomina` e' a zero righe, quindi di delegati
-- ex art. 16 registrati non ce n'e' nessuno.
--
-- Idempotente (update per codice), ASCII-only.

update figura_sicurezza set
  guida = E'Datore di lavoro delegato ex art. 16 D.Lgs. 81/08 (delega di funzioni): eventuale, solo se esiste una delega scritta con data certa e accettata per iscritto dal delegato (lett. e, aggiunta dal D.L. 159/2025, in vigore dal 31/12/2025).\n' ||
          E'Registrare gli estremi della procura e allegare la visura camerale e l''atto/procura notarile tra le evidenze della nomina.\n' ||
          E'QUESTA RIGA VALE PER LA DELEGA PIENA della sicurezza. L''art. 16 parla di "funzioni delegate" e di poteri "richiesti dalla specifica natura delle funzioni delegate": una delega puo'' coprirne solo una parte, e il decreto non dice a che punto la parte sia abbastanza grande. Se la delega e'' parziale, questo non e'' il caso che descrive: chiedere prima che cosa trasferisce.\n' ||
          E'Stesso percorso del datore: corso base 16h entro il 19/05/2027, aggiornamento 6h ogni 5 anni.\n' ||
          E'Perche'' il percorso e'' quello del datore e non quello del dirigente: la norma non lo dice mai espressamente - CONVERGE, NON PREVEDE. L''art. 16 lett. c-d attribuisce al delegato i poteri di organizzazione, gestione e controllo e l''autonomia di spesa, che sono cio'' con cui l''art. 2 c.1 lett. b definisce il datore; il dirigente (art. 2 c.1 lett. d) invece attua le direttive del datore, e un delegato non ha direttive da attuare; e l''art. 299 fa gravare le posizioni di garanzia su chi esercita in concreto quei poteri. Testo e riscontro: formazione-81-utils-src, reference/dlgs-81-2008-articoli-citati.md.'
  where codice = 'datore_lavoro_art16';

-- La riga che asserisce "delega piena". La nota sta qui perche' e' qui che
-- qualcuno, un giorno, si chiedera' perche' il delegato debba il corso del
-- datore - e deve trovarci la ragione e il perimetro, non solo il legame.
update figura_requisito set
  note = 'Assume la DELEGA PIENA della sicurezza. L''art. 16 ammette deleghe parziali ("funzioni delegate") e non dice a che punto la parte sia abbastanza grande perche'' la qualifica di datore ne discenda: davanti a una delega parziale questa riga non e'' il caso pertinente, e la domanda torna a una persona. Il percorso e'' quello del datore per convergenza di art. 2 c.1 lett. b e d, art. 16 lett. c-d e art. 299 - la norma non lo prevede espressamente. Vedi mig. 067.'
  where figura_codice = 'datore_lavoro_art16' and corso_codice = 'DATORE_LAVORO';

comment on column figura_sicurezza.guida is
  'Testo mostrato sopra il ruolo nell''organigramma, una riga per concetto (il client le separa per newline e manda in un secondo pannello quelle che parlano di esoneri o crediti). Dove una riga afferma un obbligo, deve dire da dove viene: se la fonte non lo prevede espressamente e la conclusione e'' una lettura, la riga lo dichiara - "converge, non prevede" - invece di presentarla come citazione.';
