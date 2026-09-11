# L'ordine di un incollaggio decide anche il livello: due clienti, trenta lavoratori

Terza misura dell'11 settembre 2026, su assegnazione di AppOverall dopo
[`modulo-settore-quanto-morde.md`](modulo-settore-quanto-morde.md).
**Sola lettura, nessuna scrittura.**

Avevamo controllato le otto celle multi-codice contro il **modulo di settore** e
concluso «zero danni». Vero, e incompleto: se l'ordine di un incollaggio decide il
modulo di settore, decide anche il **livello di rischio**, che sta a monte di tutto.
AppOverall l'ha visto e ha ragione. Qui il controllo e' rifatto per intero e con
due letture indipendenti.

## 1. Tutte e otto, verificate contro due tabelle che non si parlano

Il confronto di AppOverall e' **confermato**. Per farlo con lo stesso metodo dei
«due zeri spaiati», il livello di ogni divisione e' stato letto **due volte da due
file in due repository diversi**:

- **lettura A** — `src/formazione/atecoDati.ts`, la tabella che l'app usa davvero
  (file generato);
- **lettura B** — `formazione-81-utils-src/allegato_iv_asr2025.js` a `182783e`, il
  sorgente normativo da cui quel file e' generato.

> **88 divisioni per parte, e zero divergenze su livello e sezione.** Il generato
> e' fedele al sorgente su tutte e 88, non solo sulle sei che servivano qui.

| # | riga | cliente | divisione scelta | l'altra | esito |
|---:|---:|---|---|---|---|
| 1 | 37 | ANTICHI SAPORI SRL | **10** *Industrie alimentari* — **alto** | **47** *Commercio al dettaglio* — **basso** | **DIVERGE** |
| 2 | 136 | BONUM SRL | 47 — basso | 56 *Ristorazione* — basso | stesso livello |
| 3 | 139 | BP CHIMICA SRL | 46 — basso | *(nessuna: due codici, entrambi 46)* | non ambiguo |
| 4 | 171 | CARROZZERIA AUTOSTAR SAS | 45 — basso | *(nessuna: entrambi 45)* | non ambiguo |
| 5 | 180 | CARROZZERIA CAZZOLA | 45 — basso | *(nessuna: entrambi 45)* | non ambiguo |
| 6 | 417 | GREEN HAUSE S.R.L. | 41 — alto | *(nessuna: entrambi 41)* | non ambiguo |
| 7 | 478 | LA SALUMOTECA SRL | 55 *Alloggio* — basso | 56 *Ristorazione* — basso | stesso livello |
| 8 | 553 | MIGLIORINI MATTEO | **46** *Commercio all'ingrosso* — **basso** | **33** *Riparazione e manutenzione macchine* — **alto** | **DIVERGE** |

Le due che divergono sono le due indicate da AppOverall, e divergono **di due
classi**. Le altre sei sono a posto: quattro perche' i codici stanno tutti nella
stessa divisione, due perche' le divisioni diverse danno lo stesso livello.

**MIGLIORINI e' il verso che non si vede:** archiviato `basso` con l'alternativa
`alto`. ANTICHI SAPORI sbaglia — se sbaglia — nel verso opposto.

| | livello archiviato | LAV_SPEC dovuta | se valesse l'altro codice |
|---|---|---:|---|
| ANTICHI SAPORI | alto | **12 h** | basso → 4 h *(formazione in eccesso)* |
| MIGLIORINI | basso | **4 h** | alto → 12 h *(**8 ore in meno a testa**)* |

## 2. La misura del danno sono le persone, non i clienti

`LAV_SPEC` e' il corso del **lavoratore**: tocca tutti, non un incaricato. Anche
qui due letture indipendenti, e concordano:

| cliente | `N° DIPENDENTI` in `ElencoSedi` | righe persona nel foglio «Fattori di Rischio» |
|---|---:|---:|
| ANTICHI SAPORI SRL | **27** | **27** |
| MIGLIORINI MATTEO (ditta individuale) | **3** | **3** |

**Trenta lavoratori** stanno dietro a due celle. Di questi:

- **3** (MIGLIORINI) hanno in archivio una formazione specifica da **4 ore** che,
  se il codice primario fosse il 33, dovrebbe essere da **12**;
- **27** (ANTICHI SAPORI) ne hanno una da 12 che, se il primario fosse il 47,
  sarebbe da 4 — formazione in eccesso, che non espone nessuno.

Il rapporto fra i due numeri e' il punto: **il caso piu' pericoloso e' il piu'
piccolo**, e il caso innocuo e' quello che si nota.

### E gia' che si contavano: le persone dietro a tutte le celle anomale

| forma della cella | clienti | persone |
|---|---:|---:|
| nessuna cifra: nessun livello proposto | 5 | 15 |
| divisione sbagliata, livello identico (SHAMS) | 1 | 1 |
| piu' codici, tutti nella stessa divisione | 4 | 20 |
| piu' codici, divisioni diverse, stesso livello | 2 | 21 |
| **piu' codici, divisioni diverse, livello divergente** | **2** | **30** |
| **totale** | **14** | **87** |

**Correzione a un nostro numero.** In `modulo-settore-quanto-morde.md` avevamo
scritto «11 celle su 267, il 4,1%». Sommava 7 forme anomale piu' 4 ambigue e
**lasciava fuori le 4 celle multi-codice con i codici tutti nella stessa
divisione** — non ambigue per il livello, ma anomale per forma come le altre.
L'unione corretta e' **14 celle su 267, il 5,2%**, e dietro ci sono **87
lavoratori**. Le conclusioni di quel documento non cambiano: il modulo di settore
resta a zero danni, e il numero che contava li' — i 358 clienti col `null`
ambiguo — non e' toccato.

## 3. Quale sia il codice primario: nei dati non c'e', e non lo scegliamo noi

**Non c'e' nessuna colonna che dica quale codice sia il primario.** L'export ha una
sola casella ATECO, testo libero, e chi ha incollato due righe non ha lasciato un
ordine dichiarato. Guardate tutte le colonne delle due righe: nient'altro decide.

- **MIGLIORINI MATTEO** — tre persone: *OPERAIO*, *TITOLARE- RSPP*, *APPRENDISTA*.
  Non dicono nulla. `46.49.9` (ingrosso di detergenti per la zootecnia) e `33.12.70`
  (riparazione di macchine per l'agricoltura) sono due mestieri diversi e
  compatibili con la stessa ditta individuale di tre persone. **Nei dati la
  risposta non c'e'.**
- **ANTICHI SAPORI SRL** — qui i dati non decidono ma **corroborano**: delle 27
  mansioni, la stragrande maggioranza e' produzione alimentare (*chiusura
  tortellini a mano*, *cuoco*, *addetta alla produzione ripieni*, *tecnologo
  alimentare*, *confezionamento*); quattro sono commerciali (*agente*) e due
  d'ufficio (*amministrazione*, *legale rappresentante*).
  Il `10` archiviato e' coerente con quello che quelle persone fanno tutti i
  giorni. **Resta una corroborazione, non una fonte:** l'attivita' prevalente e'
  quello che dice la visura, non quello che sembra dall'organigramma.

**Serve una persona, non un criterio.** Per entrambe la domanda e' «qual e'
l'attivita' prevalente?», e la risposta sta in una visura camerale o in una
telefonata al cliente. Qualunque regola automatica — il primo codice, il codice
piu' specifico, il livello piu' alto per prudenza — sarebbe una decisione nostra
travestita da dato. **Non l'abbiamo presa e non va presa a tavolino.**

Se la risposta dovesse arrivare, l'ordine di urgenza e' chiaro: **prima
MIGLIORINI** (tre persone, possibile difetto di 8 ore a testa), poi ANTICHI SAPORI
(ventisette persone, possibile eccesso).

## Una cosa vista di sfuggita, che vale una riga

La mansione del titolare di MIGLIORINI e' scritta **«TITOLARE- RSPP»**, ma nel
foglio «Ruoli SSL» **ne' MIGLIORINI ne' ANTICHI SAPORI hanno una sola colonna di
ruolo valorizzata**. Il ruolo c'e', ed e' scritto nel campo sbagliato: un'altra
informazione che vive in testo libero e che l'import delle nomine non raccogliera'.
E' la stessa malattia dell'ATECO su un campo diverso — non e' questo il passo per
misurarla, ma e' segnata.

## Sulla riparazione: conservare la cella

AppOverall aggiunge che il terzo stato — «ho una divisione e potrebbe essere quella
sbagliata» — non lo esprime nessun tipo di ritorno, e che quindi la riparazione non
e' un enum al posto di un `null`: e' **conservare la cella d'origine**. Questi
numeri lo confermano dal basso. Tutte e tre le anomalie di oggi sono invisibili
guardando l'archivio, e visibili in un secondo guardando la cella:

- SHAMS ha `37` e in archivio sembra una riga come le altre;
- MIGLIORINI ha `46` e in archivio sembra una riga come le altre;
- i 357 senza ATECO almeno **si vedono**, ed e' il caso meno grave dei tre.

Il dato derivato non porta con se' l'unica cosa che permetterebbe di rivederlo.
Quando arrivera' il momento di scriverlo, il posto e' sul cliente accanto a
`codice_ateco` — non in un log dell'import, che risponde alla domanda «cosa e'
successo quel giorno» e non a «questo valore e' affidabile».

## Come rileggerlo sul database

```sql
-- le due celle divergenti: cosa e' finito in archivio
select ragione_sociale, codice_ateco, livello_rischio
from cliente
where ragione_sociale ilike any (array['ANTICHI SAPORI%','MIGLIORINI MATTEO%'])
order by ragione_sociale;
-- atteso: ANTICHI SAPORI -> '10' / alto ; MIGLIORINI -> '46' / basso

-- e quante persone ci sono davvero dietro (il file dice 27 e 3)
select c.ragione_sociale, count(p.id)
from cliente c left join persona p on p.cliente_id = c.id
where c.ragione_sociale ilike any (array['ANTICHI SAPORI%','MIGLIORINI MATTEO%'])
group by c.ragione_sociale;
```
