# Progetto dell'import delle nomine: cosa fa il sistema quando non capisce

Progetto dell'11 settembre 2026, su assegnazione di AppOverall. **Sola lettura
più questo documento: l'import non è scritto**, e non lo sarà finché la `0007`
non è caricata.

Le tre decisioni sono in ordine di importanza, non di numerazione: la terza
viene prima, perché è quella che decide se il resto invecchia bene.

---

## Ciò che si sta per importare, in numeri

| | |
|---|---:|
| righe persona nel foglio «Ruoli SSL» | 3.501 |
| righe con un ruolo nelle **colonne** | 153 |
| righe con un ruolo scritto nella **mansione** | 160 |
| — di cui in entrambi i posti | 12 |
| **righe che portano un ruolo** | **301** |
| coppie *(riga, ruolo asserito)* | 168 |
| — risolte dal dizionario `0007` | **161** |
| — **non risolte** | **7** |
| mansioni non vuote | 2.890 |
| — stringhe **distinte** (normalizzate) | **603** |
| — distinte che contengono una parola di ruolo | **23** |

Le colonne ne dichiarano il 51%: **metà dell'organigramma sta in un campo di
testo libero**, e questo import è il momento in cui quella metà entra o si perde.

---

## 3. Cosa fa il sistema quando non capisce *(la decisione che viene prima)*

Un import che riconosce 29 forme e **tace** sulla trentesima ricrea in un anno il
difetto appena chiuso, con l'aggravante di sembrare funzionante. La decisione
non è «come indovinare la trentesima»: è **cosa il sistema fa, e dove finisce
quella riga**.

### Gli esiti sono tre, e non due

È la stessa forma dell'ATECO, sulla terza tabella in tre giorni:

| esito | quando | cosa succede |
|---|---|---|
| **risolta** | parola di ruolo nota + posizione nota, e il dizionario ha la regola | si crea la nomina |
| **riconosciuta, non mappabile** | parola di ruolo nota, ma la combinazione non ha una regola | **nessuna nomina**, e una riga che lo dice |
| **non riconosciuta** | testo che non contiene nessuna parola di ruolo nota | niente — *e va bene*, quasi sempre |

`risolta` / `non risolta` sarebbe il `null` a due significati da capo.
«Non ho una regola per *questo*» e «qui non c'è nessun ruolo» sono due fatti
diversi, e solo il primo è un lavoro per qualcuno.

### La regola dura: non si indovina, non si tace

**Mai dedurre il ruolo mancante.** `STATO.md:245` — *«una nomina che punta al
ruolo sbagliato è peggio di una nomina mancante»* — qui ha il suo terzo esempio:
mandare a `rspp` chi è socio darebbe a quelle persone il percorso del
professionista invece di quello del datore.

**Mai scartare in silenzio.** Una riga riconosciuta e non mappata che sparisce è
il difetto della `0004` (*«conosciuto e non mappabile» indistinguibile da «non
ancora curato»*) su una tabella nuova.

### Dove finisce la riga, perché qualcuno la veda

Due posti, e servono entrambi perché rispondono a due domande diverse.

**A. Al momento dell'import — l'anteprima non può dirsi completa.**
Il canale esiste già (`PianoClienti.scartate: {riga, motivo}[]`, mostrato da
`ImportAnagrafiche`). L'anteprima deve riportare i tre conteggi, e **il secondo
mai come zero implicito**: se ci sono 7 righe riconosciute e non mappabili, il
riepilogo dice «161 nomine, **7 da decidere**», non «161 nomine».

**B. Dopo l'import — una riga che resta, per persona.**
Il meccanismo è quello costruito ieri per l'ATECO: un'azione a chiave naturale,
intestata all'**area interna**, che **si chiude da sola**.

```
nomina-forma:<persona_id>     una persona il cui ruolo è scritto e non mappabile
```

Sparisce quando quella persona ha una nomina — messa a mano, o creata da un
import successivo con un dizionario aggiornato. Nessuna spunta, nessuna riga che
si riapre. La descrizione porta **il testo verbatim**, perché è il dato:
*«CORDIOLI KARL (MARCIOR SRL) risulta RSPP nella mansione «SOCIO/ RSPP»: essere
socio non stabilisce di essere il datore, e il ruolo esatto non si deduce.»*

**È limitata per costruzione**, come quella dell'ATECO: nasce solo dove il testo
contiene una parola di ruolo nota. Oggi sarebbero **7 righe**, non 2.890.

### I due modi di sbagliare, e solo uno è rilevabile

Va detto, perché la metà onesta di questa decisione è ammettere cosa non copre.

- **Forma nuova con una parola nota** — `RSPP/amministratore delegato`. È
  **rilevabile**: la parola `RSPP` c'è, la posizione no, e finisce nel secondo
  esito. Questa è coperta.
- **Ruolo scritto senza nessuna parola nota** — `resp. serv. prev. e prot.`,
  `capo squadra emergenze`. **Non è rilevabile**: per il parser è una mansione
  come «operaio», e non produrrà niente né rumore. Questa **non** è coperta da
  nessuna regola, e nessuna regola potrebbe coprirla.

Per la seconda l'unico contrappeso è a monte del parser, e costa poco: **l'import
stampa le stringhe di mansione distinte comparse dall'ultima volta.** Sono 603
distinte su 2.890 righe; un export successivo ne aggiungerà qualche decina, e
scorrerle è lavoro da cinque minuti. Un occhio umano su venti stringhe nuove
prende `resp. serv. prev. e prot.` che nessun `if` avrebbe preso.

> Non è una rete a maglie fini: è l'unica rete possibile per quel caso, e va
> detto che è quella e non un'altra.

---

## 1. Cosa fa l'import con le 7 asserzioni non risolte

Sono `SOCIO/RSPP` (×2), `SOCIO/ RSPP` (×2), `RSPP` secco (×2) e
`DIRETTORE TECNICO, RSPP E COMMERCIALE`. Ricadono nel **secondo esito**, e il
trattamento è quello: **nessuna nomina creata, una riga per persona, il testo
verbatim dentro.**

**Perché non si crea comunque `rspp`.** L'assenza della regola nella `0007` è
*voluta*, e sarebbe irrispettoso trattarla come una lacuna da colmare a valle.
Essere socio non stabilisce di essere il datore; `RSPP` secco non dice se sia
interno o esterno. E non è una sfumatura: il percorso formativo dei due ruoli è
diverso, e il modulo di settore pure.

**Perché non si crea `da_confermare`.** Sarebbe la scorciatoia: nomina a `rspp`
con il flag alzato, «poi qualcuno guarda». Ma `da_confermare` è uno **stato**, e
gli stati si azzerano: appena qualcuno la conferma, quella nomina diventa
indistinguibile da una letta dalla colonna, **e il ruolo resta quello indovinato
dall'import**. Si sarebbe scritto un dato falso con un post-it sopra, e il
post-it si stacca.

**Sette righe su 168 — il 4%.** È poco abbastanza da guardarlo a mano, e questo è
il punto: il progetto regge se quelle sette arrivano a una persona invece di
sparire o di diventare un numero.

---

## 2. Una nomina dedotta resta distinguibile da una dichiarata?

**Oggi, no.** E la risposta è la stessa delle altre due volte, alla terza
tabella.

`nomina` ha `persona_id`, `figura_codice`, `data_nomina`, `attiva`, `note`,
`da_confermare`, `estremi_procura`. **Nessuna provenienza.** Dopo l'import,
una nomina letta dalla colonna `RSPP` (una data, dichiarata) e una dedotta da
`RSPP/titolare` (testo libero, interpretato da una regola) sono **la stessa
riga**.

Su 301 righe, 160 vengono dal testo libero: **non è un caso marginale, è metà
del totale.**

### `da_confermare` non basta, ed è importante capire perché

Esiste già, e sembra la risposta. Non lo è: **è un compito, non una
provenienza.** Dice «qualcuno guardi questa riga», e appena qualcuno la guarda si
azzera — portandosi via l'unica traccia del fatto che quel ruolo era stato
*interpretato*. Sei mesi dopo, chi si chiede «da dove viene questa nomina RSPP?»
trova una riga pulita.

È la stessa differenza fra «questa cella è da rivedere» e «questa cella diceva
`37054`».

### La proposta: due campi, come per l'ATECO

```sql
alter table nomina add column if not exists origine text;        -- 'colonna' | 'mansione' | 'manuale'
alter table nomina add column if not exists origine_testo text;  -- il verbatim, quando origine='mansione'
```

- **`origine`** non si azzera mai: descrive *da dove viene*, non *cosa resta da
  fare*. Convive con `da_confermare`, che resta il compito.
- **`origine_testo`** è la mansione verbatim — `TITOLRE/RSPP`, `RSPP- NO
  TITOLARE`, `SOCIO - TITOLARE - RSPP`. È la stessa colonna, con lo stesso
  scopo, di `cliente.ateco_origine`: senza, l'unico modo di sapere perché quella
  persona è `dl_rspp` è riaprire un Excel.

E porta un guadagno che non si vede finché non serve: il giorno in cui il
dizionario cambia idea su una forma, **le righe da rivedere si trovano con una
query** invece che riaprendo l'export.

> Quando si deriva un dato da un testo altrui, il testo altrui è parte del dato.
> Terza tabella, stessa frase.

---

## Le 81 righe e la traduzione: non va scritta, va letta

Il dizionario `0007` risolve a **`datore_lavoro_rspp`**. Il nostro codice figura
è **`dl_rspp`** (`figura_sicurezza`, migrazione 015; `dl_rspp` è anche ciò che
`DL_RSPP_SETTORE` richiede nella `049`). Sono **81 righe**, cioè il numero che
quella migrazione esiste per non sbagliare.

> **Correzione, stessa giornata.** Qui era scritto che «una traduzione al confine
> ci vuole». **Esiste già**, e scriverne una seconda sarebbe stato il difetto che
> quella tabella è nata per impedire: `ruolo_sicurezza_alias` (AppOverall `0002`)
> porta la riga `('sopralluoghi', 'dl_rspp', 'datore_lavoro_rspp')`, e il suo
> commento dice perché — *«se la mappa è in uno switch, qualcuno ci mette il caso
> mancante a mano, ed è così che `dl_rspp` è diventato `rspp` su 26 righe»*.
> L'import **legge quella mappa**, non ne scrive una.

Due cose da sapere per usarla, verificate sul file e non assunte:

- **la mappa è scritta nel verso `codice_esterno` → loro**, e a noi serve il verso
  opposto. Si può leggere all'indietro perché è **iniettiva**: 13 righe per il
  sistema `sopralluoghi`, 12 destinazioni distinte;
- **la tredicesima non ha destinazione.** `operatore_attrezzatura` mappa su
  `null`, e il commento della colonna dice che `null` non significa «non ancora
  tradotto» ma **«conosciuto e non traducibile da solo»**. All'indietro non ha
  entrata — irrilevante qui, perché fra le 29 forme delle mansioni non c'è
  nessuna attrezzatura, ma da sapere prima che qualcuno concluda che la mappa è
  rotta.

### E una cosa che avevo scritto al contrario

Avevo scritto che `datore_lavoro_art16` «dalla nostra parte esiste come
`datore_lavoro`». **È falso, e nel verso peggiore.**

`datore_lavoro_art16` **è una nostra figura a sé**, aggiunta dalla migrazione
`053` come tredicesima (*«Datore di lavoro delegato (ex art. 16)»*), con i suoi
`estremi_procura` e la sua evidenza — visura camerale più atto notarile. E la
mappa della `0002` la tratta esattamente così: `datore_lavoro` e
`datore_lavoro_art16` mappano **ciascuna su se stessa**, separate.

Chi avesse scritto l'import leggendo la mia riga avrebbe tradotto il delegato nel
datore, che è precisamente la confusione contro cui la riga stessa metteva in
guardia. **La mappa è più affidabile della mia memoria**, ed è il secondo
argomento per leggerla invece di riscriverla.

*Una differenza fra le due corsie che vale segnalare:* dalla loro parte la
domanda «al delegato dell'art. 16 spettano gli obblighi del datore o quelli del
dirigente?» è **aperta** e aspetta una lettura della norma. Dalla nostra, la `053`
**ha già preso posizione** — `datore_lavoro_art16` richiede `DATORE_LAVORO`, con
la nota *«il delegato assume gli obblighi del datore, formazione inclusa»*. Non è
una contraddizione da sanare di corsa: è che una delle due corsie ha deciso e
l'altra no, e conviene saperlo prima che i due modelli si incontrino.

---

## Cosa questo progetto NON decide

- **Non decide le 7.** Dice dove finiscono e chi le vede. Quale ruolo sia il
  giusto per un socio-RSPP è una domanda di diritto, ed è nella lista di ciò che
  aspetta una persona — accanto a MIGLIORINI, ANTICHI SAPORI e KOSME.
- **Non tocca la `0007`.** La sua forma è pubblicata e basta per progettare; se
  quando sarà caricata i conti non torneranno, il progetto si corregge.
- **Non scrive l'import**, né le due migrazioni che propone. Sono proposte, e la
  scrittura è un passo suo.

## Il riassunto, se si legge una riga sola

> L'import deve poter **dire di non aver capito**, e quel «non ho capito» deve
> finire addosso a qualcuno — con dentro il testo che non ha capito. Tutto il
> resto di questo documento è come farlo senza che diventi rumore.
