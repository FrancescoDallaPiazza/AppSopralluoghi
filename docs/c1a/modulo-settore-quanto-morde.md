# Quanto morde il salto sul modulo di settore: oggi zero, al primo import quattro

Tre misure dell'11 settembre 2026, su assegnazione di AppOverall dopo
[`ateco-i-cinque.md`](ateco-i-cinque.md). **Sola lettura, nessuna scrittura.**

AppOverall ha corretto dove sta il difetto, e la correzione e' giusta: il
`continue` di `formazione.ts:863` non e' il difetto. Per quasi tutte le divisioni
il modulo di settore davvero non e' dovuto, e li' saltare e' l'unica cosa
corretta. Il difetto e' che `oreModuloSettore` restituisce `null` per **due cose
diverse** — «per questa divisione nessun modulo e' dovuto» e «la divisione non la
so» — e a valle non c'e' modo di distinguerle.

Queste tre misure dicono quanto e' grande il secondo caso.

---

## 1. SHAMS SERVICE: oggi non morde, e non mordera' nemmeno al primo import

**Nessuno e' nominato RSPP o datore di lavoro-RSPP in SHAMS SERVICE, perche'
nessuno e' nominato niente da nessuna parte.** La tabella `nomina` e' a **zero
righe** — misurata il 10 settembre nell'SQL Editor, `STATO.md:210`, insieme a
`formazione`, `esonero`, `azione` e `adempimento`. Il motore non ha nessun
organigramma su cui girare.

E c'e' un secondo controllo, che guarda avanti invece che indietro: **SHAMS
SERVICE non compare nel foglio «Ruoli SSL»** di `ExportExcel (4).xlsx`. Quando
l'import delle nomine verra' scritto, quelle 141 persone accenderanno il motore su
65 societa' — e SHAMS non e' fra quelle. Il suo `37` sbagliato **non morde oggi e
non morde al primo import**.

Quindi la priorita' non cambia: il difetto e' reale, ma non c'e' niente che stia
sbagliando adesso.

*Limite dichiarato:* il conteggio `nomina = 0` e' di ieri e da qui non ho
credenziali per rileggerlo. Se nel frattempo qualcuno ha nominato qualcuno
dall'app, il numero non vale piu'. La `select` di controllo e' in fondo.

---

## 2. La popolazione in cui i due `null` si leggono uguali

### Dei 262 che un codice ce l'hanno

| | datore di lavoro-RSPP | RSPP / ASPP |
|---|---:|---:|
| divisione con modulo **dovuto** | **48** | **54** |
| divisione con `null` = *nessun modulo dovuto* | **214** | **208** |

I due totali differiscono di 6 perche' la divisione 86 (sanita') vale 12 ore per
RSPP/ASPP e niente per il datore-RSPP: sono i 6 clienti della divisione 86.
Le divisioni "speciali" presenti in archivio sono quattro: `01` (21 clienti),
`43` (17), `41` (8), `42` (2), piu' la `86` (6) per il solo RSPP.

Su questi 262 il `null` e' **quello giusto** 214 volte su 214. Uno solo e'
sbagliato — SHAMS.

### Ma il `null` "non lo so" non viene quasi mai dal codice sbagliato

Viene dal codice **assente**. `oreModuloSettore(null)` restituisce `null` esattamente
come per una divisione non speciale, e `formazione.ts:863` non li distingue:

| stato del cliente | quanti | cosa significa il `null` |
|---|---:|---|
| codice presente, divisione non speciale | 214 | **nessun modulo dovuto** — corretto |
| codice presente, divisione speciale | 48 | modulo dovuto, ore calcolate |
| **cella ATECO vuota** | **352** | **non lo so** |
| **cella con la sola descrizione** | **5** | **non lo so** |
| **codice presente ma divisione sbagliata** | **1** | **non lo so, e credo di sapere** |

**358 clienti su 619 — il 57,8% — ricevono oggi il `continue` silenzioso senza che
nessuno sappia se il modulo fosse dovuto.** Il caso SHAMS e' uno su 358: e' il piu'
insidioso perche' e' l'unico che si traveste da dato buono, ma non e' la massa. La
massa e' il 57% che `STATO.md` porta da settimane, che qui si vede da una terza
angolazione.

Questo sposta anche il rapporto con la campagna di riempimento rinviata: **non e'
un argomento per riaprirla** — e' la misura di cosa si compra, quando verra'
fatta.

### Chi ha una nomina in quei ruoli: oggi nessuno, al primo import quattro

Con `nomina` a zero, **oggi il numero e' zero**: nessun cliente e' nella
popolazione in cui il difetto morde. Guardando avanti, il foglio «Ruoli SSL» dice
chi ci entrera':

| | |
|---|---:|
| societa' con un RSPP nel foglio | **31** |
| — modulo di settore **dovuto** | 6 |
| — `null` corretto (divisione non speciale) | 21 |
| — **`null` "non lo so": nessun ATECO in archivio** | **4** |

Le 31 agganciano tutte una delle 619 attive. I 6 con il modulo dovuto: COLONIAS,
BONIZZATO e SUAVIA (divisione 01, 16h), IDROCLIMA e TWINS SERVICE (43, 16h),
IMPRESA EDILE COMERLATI (41, 16h).

**I quattro casi veri** — quelli in cui, al primo import delle nomine, il motore
tacera' senza sapere:

| cliente | RSPP nel foglio | data incarico |
|---|---|---|
| AUTOFFICINA MORARI DI MORARI LUCA | MORARI LUCA | 01/03/2022 |
| DETROIT SERVICE SRL | AVESANI LUCA | 10/09/2020 |
| GRAFICHE DUEGI DI ZARDINI G & C. SNC | Zardini Giuseppe | 29/04/2019 |
| QUALIFT S.P.A. | GIGLIO GIUSEPPE | 12/11/2019 |

L'unico ASPP dell'intero foglio e' **la stessa persona di GRAFICHE DUEGI**
(Zardini Giuseppe, 14/05/2019), e nel nostro modello anche `aspp` richiede
`RSPP_MOD_B_SETTORE` (mig. `049:114-115`): stesso cliente, stesso silenzio, due
volte.

Quattro clienti su 31, il **13%**. E due dei quattro — GRAFICHE DUEGI e QUALIFT —
sono gia' noti per un'altra ragione: sono fra le tre societa' del foglio senza
codice fiscale (`STATO.md:388`). Le stesse anagrafiche incomplete si ripresentano
su un asse diverso.

---

## 3. La forma delle 267 celle, che e' la misura della malattia

| forma della cella | quante |
|---|---:|
| canonica: `(X.dd.dd) Descrizione;` | **244** |
| codice in testa ma **senza la lettera di sezione**: `(85.51.00) …`, `45.20.1` | **16** |
| **testo o numeri prima del codice** | **2** |
| **nessuna cifra: sola descrizione** | **5** |

Le prime 260 danno il risultato giusto. Le altre 7 sono il conto delle forme
anomale: **il 2,6% delle celle piene non ha la forma canonica**, e su quel 2,6%
si distribuiscono tutti i danni noti — le cinque che non arrivano e SHAMS.

**E c'e' una seconda anomalia che non avevamo contato: 8 celle contengono piu' di
un codice ATECO**, e in **4 di queste i codici stanno su divisioni diverse**:

| riga | cliente | divisione scelta | l'altra |
|---:|---|---|---|
| 37 | ANTICHI SAPORI SRL | 10 | 47 |
| 136 | BONUM SRL | 47 | 56 |
| 478 | LA SALUMOTECA SRL | 55 | 56 |
| 553 | MIGLIORINI MATTEO | 46 | 33 |

Vince il primo che compare nel testo. Non e' un criterio: e' l'ordine in cui
qualcuno ha incollato le righe. **Controllato: nessuna delle 8 scarta una
divisione speciale** — in nessun caso il codice non scelto avrebbe fatto scattare
un modulo di settore. Quattro archiviazioni discutibili, **zero danni sul modulo**.

Sommando le forme che non sono la canonica pulita — 7 anomale piu' 4 ambigue
per multi-codice — **11 celle su 267 (il 4,1%) hanno una forma da cui il
risultato non e' determinato dal contenuto**. La cella e' testo libero non
vincolato nel gestionale, e questo e' il prezzo che quella scelta fa pagare a
valle.

---

## Cosa ne segue per la riparazione (che NON e' fatta qui)

La separazione dei due significati di `null` e' una scrittura sul nostro codice, e
AppOverall ha detto di farla **dopo** questi numeri. I numeri dicono tre cose che
la riguardano:

1. **Non e' urgente.** Zero clienti la subiscono oggi, quattro la subirebbero al
   primo import delle nomine. C'e' tempo per farla bene.
2. **Gli stati da separare sono tre, non due.** «Nessun modulo dovuto» (214),
   «non conosco la divisione perche' non c'e' l'ATECO» (357) e «ho una divisione
   ma potrebbe essere quella sbagliata» (SHAMS, e per costruzione chiunque abbia
   una cella di forma anomala). Un `null` contro un valore non basta: il terzo
   caso non lo distingue nessun tipo di ritorno, lo distingue solo il confronto
   con la cella d'origine.
3. **Il caso grosso e' il secondo, ed e' gia' visibile altrove.** 357 clienti
   senza ATECO sono gia' scritti in `STATO.md` e nel documento di ieri. Quello
   che questi numeri aggiungono e' che quel buco **non si limita a non proporre
   un livello di rischio**: fa anche sparire in silenzio un requisito formativo
   da 16 ore su chi e' nominato RSPP.

---

## Come rileggerlo sul database

```sql
-- 1. il conteggio su cui poggia la risposta "oggi non morde"
select count(*) from nomina;                       -- atteso: 0
select figura_codice, count(*) from nomina
 where figura_codice in ('rspp','aspp','datore_lavoro_rspp')
 group by figura_codice;                           -- atteso: nessuna riga

-- 2. la popolazione del null "non lo so"
select count(*) from cliente where codice_ateco is null;   -- atteso: 357

-- 3. i quattro che il primo import delle nomine accenderebbe al buio
select ragione_sociale, codice_ateco from cliente
 where ragione_sociale ilike any (array[
   'AUTOFFICINA MORARI%','DETROIT SERVICE%','GRAFICHE DUEGI%','QUALIFT%'])
 order by ragione_sociale;                          -- atteso: 4 righe, codice_ateco null
```
