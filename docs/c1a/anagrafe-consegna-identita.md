# La consegna dell'anagrafe: cosa attraversa il confine, e con quale identità

Consegna del **12 settembre 2026** alla migrazione dati di AppOverall. **Sola
lettura per intero**: nessuna riga scritta, nessuna query sul database di
produzione, nessun dato personale in questa pagina.

Risponde a una domanda sola, che è quella che blocca l'altra corsia:
`sorveglianza.persona_id` deve puntare a persone che nel repo unico non esistono
ancora — **con quale chiave le si riconosce, soprattutto quando il codice fiscale
non c'è.**

> **La risposta breve, per chi legge solo questa riga.** La chiave d'identità
> delle persone **esiste** e si chiama `persona.import_key`. È stabile, è
> idempotente, ed è **verificata**: ripassare lo stesso file dà «0 nuove · 3.420
> aggiornate». Ma **non è portabile fuori da questo database**, perché contiene un
> uuid generato qui. Attraversa il confine solo se attraversa anche la tabella di
> corrispondenza dei clienti. Il §3 è la parte che conta.

---

## 1. Cosa attraversa il confine

| tabella | righe | provenienza scritta? | misurata quando, come |
|---|---:|---|---|
| `cliente` | **619** | **no** | 10.09, `count(*)` in SQL Editor |
| `sede` | **619** | **no** | idem |
| `persona` | **3.419** | **sì**, `import_key` su **3.419 su 3.419** | idem |

Tre cose che i numeri da soli non dicono, e che cambiano cosa una migrazione deve
fare con loro.

**Le 619 sedi non sono un secondo insieme di dati: sono un riflesso del primo.**
La `054` crea per ogni cliente **una** sede «Sede legale» copiandone i campi, e il
salvataggio del cliente fa da sé il write-through (`anagraficheImport.ts:463-464`).
619 = 619 per costruzione, non per coincidenza. E il sito produttivo —
`INDIRIZZO SITO PRODUTTIVO` di `ElencoSedi` — **non viene letto**: c'è nel file e
resta fuori apposta, in attesa di una decisione.

**Quindi `persona.sede_id` oggi non porta informazione.** Esiste
(`054:64`), tutte le persone ci sono state riagganciate (`054:85-87`), ma punta
sempre alla sede legale creata d'ufficio. Chi migra non deve leggerlo come «la
sede dove la persona lavora»: oggi significa «il cliente», detto in un altro modo.

**E i clienti non hanno nessuna provenienza.** `import_key` esiste su `persona`,
`formazione` e `adempimento` (mig. `055`) — **non** su `cliente`. I 619 clienti
sono stati riconciliati per P.IVA e denominazione al momento dell'import, e di
quella riconciliazione **non è rimasta traccia sulla riga**. Il §3.4 dice cosa
comporta.

---

## 2. La regola d'identità delle persone, esatta

È tre righe di codice, e vale la pena leggerle invece di riassumerle
(`src/lib/admin/anagraficheImport.ts:78-89`):

```ts
const chiaveImportPersona = (clienteId, cf, cognome, nome) => {
  if (cf) return `anag:${clienteId}:${cf}`;
  const k = chiaveNome(cognome, nome);
  return k ? `anag:${clienteId}:n:${k}` : null;
};

const chiaveNome = (cognome, nome) => {
  const k = `${normNome(cognome)}|${normNome(nome)}`;   // MAIUSCOLO, spazi collassati
  return k === '|' ? '' : k;
};
```

In prosa, e in quest'ordine:

1. **Se il codice fiscale c'è** — cioè se la cella, ripulita, non è vuota — la
   chiave è `anag:<cliente>:<cf>`.
2. **Se non c'è**, la chiave è `anag:<cliente>:n:<COGNOME>|<NOME>`, normalizzati
   in maiuscolo con gli spazi collassati.
3. **Se non c'è nemmeno il nome**, **la chiave non esiste** — `null` — e la riga
   viene scartata prima (`:540`, motivo «senza nome né cognome»).

**Il cliente sta dentro la chiave, e non è un dettaglio implementativo.** Lo dice
il commento che l'ha introdotta: l'indice unique è **globale**, e la stessa
persona può stare sull'organigramma di **due clienti diversi** — ed è legittimo
che siano **due schede**. Una migrazione che deduplicasse per codice fiscale
attraverso i clienti fonderebbe due righe che questo sistema tiene separate
apposta.

### E il ripiego sul nome non si accontenta del nome

Quando il CF manca, il nome vale come chiave **solo se non è ambiguo**, e
l'ambiguità viene controllata **due volte** (`:697-709`):

- **nell'archivio**: se due persone dello stesso cliente si chiamano uguale, la
  voce diventa inutilizzabile (`perNomePersona` la marca `null`);
- **nel file**: se lo stesso nome senza CF compare più di una volta,
  `nomiSenzaCfNelFile` lo esclude.

Se uno dei due controlli fallisce si torna a `riga:N`, cioè **la persona risulta
sempre nuova**. È una scelta dichiarata nel commento, e va riportata al di là del
confine perché è una scelta di merito:

> «Meglio un doppione che si vede di due persone fuse per sbaglio, che non si vede
> più.»

### E qui la chiave è **garantita**, al di là del confine sarà una stringa

Da questa parte `persona.import_key` non è una convenzione: è protetta da un
indice unique parziale (`uq_persona_import`, mig. `055` — `on persona(import_key)
where import_key is not null`). Se un import prova a scrivere due volte la stessa
chiave, **il database rifiuta**. È successo davvero il 9 settembre, ed è così che
il difetto della paginazione è diventato visibile invece di produrre doppioni in
silenzio.

**Dall'altra parte quella garanzia non c'è per costruzione.** Là l'identità della
persona è il codice fiscale (unique globale), e la chiave che arriva da qui
atterra su `rapporto_lavoro.import_key` — dove **non è un vincolo e non è un
indice: è una stringa**. Ed è esattamente quella stringa a tenere separate le
persone **senza** codice fiscale, che di là non hanno nessuna identità propria.

> **Il che cambia cosa protegge chi.** Qui, se un import sbaglia a comporre la
> chiave, la scrittura fallisce e qualcuno se ne accorge. Là, se un import la
> compone male, **due persone diventano una e nessun vincolo protesta**. La
> garanzia non attraversa il confine insieme al dato: si ferma alla frontiera.
>
> E il caso non è raro — è il **63,5%** del §5: sulla metà *dedotta*
> dell'organigramma il codice fiscale manca in quasi due righe su tre, e per
> quelle la stringa è l'unica cosa che c'è.

*(Registrato anche di là, nella loro `0015`: i due commenti si nominano a vicenda,
e l'unico controllo che ha senso su questa migrazione è che continuino a farlo.)*

---

## 3. Le quattro cose che la regola **non** dice, e che una migrazione darebbe per scontate

Questa è la parte per cui vale la pena aver scritto il documento. Le prime tre
sono verificate sul codice di questo repo; la quarta è un'assenza.

### 3.1 `import_key` **non è portabile**: contiene un uuid generato qui

`cliente.id` è `uuid primary key default gen_random_uuid()` (`001_init.sql:28`).
Non deriva dalla fonte: è stato **generato da questo database** quando il cliente
è stato creato.

Quindi una `import_key` reale ha questa forma — il primo campo è un id locale, non
un dato del gestionale:

    anag:<uuid generato qui>:<codice fiscale>
    anag:<uuid generato qui>:n:<COGNOME>|<NOME>

**Conseguenza diretta, e va detta senza attenuazioni:** se nel repo unico i 619
clienti vengono ricreati con uuid nuovi, **tutte e 3.419 le `import_key` puntano a
un id che là non esiste**. Non si rompono con un errore — si rompono in silenzio,
perché restano stringhe valide che non agganciano niente, e il secondo import
ricrea 3.419 persone.

Le vie d'uscita sono due, e sono una decisione di AppOverall, non mia:

- **portare gli uuid**: i clienti attraversano il confine con **lo stesso** `id`, e
  allora le chiavi continuano a valere alla lettera;
- **portare la corrispondenza**: una tabella `<uuid di qui> → <id di là>`, e le
  chiavi si **riscrivono** in migrazione.

Quel che **non** si può fare è ricalcolare le chiavi da capo dall'export: la
regola del §2 dipende da controlli di ambiguità fatti **su questo archivio**
(§2, primo controllo), e rifarli altrove su un archivio diverso può dare un esito
diverso sulle stesse persone.

### 3.2 Il codice fiscale dentro la chiave **non è validato**

`campi.cf` è `cfPulisci(cfRaw)` (`:814`), e `cfPulisci` è soltanto questo
(`src/formazione/codiceFiscale.ts:21-22`):

```ts
(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
```

Maiuscolo, via tutto ciò che non è lettera o cifra. **Nessun controllo di
lunghezza, nessun carattere di controllo.** La funzione che valida davvero —
`valido()`, che verifica i 16 caratteri e il check digit — **esiste ed è
importata**, ma serve solo a marcare `cfNonValido` per l'avviso a schermo
(`:754`). **Non decide la chiave.**

Quindi `if (cf)` al §2 riga 1 è vero per **qualunque stringa non vuota**: un CF
valido, un CF con un carattere sbagliato, una P.IVA di 11 cifre, un segnaposto.

**Il che è corretto per l'idempotenza** — la chiave deve solo essere stabile, e lo
è — **e sbagliato come garanzia di qualità del dato.** La distinzione conta qui e
non altrove, perché la migrazione che chiede questa consegna deve poi agganciare
le **visite**, e le visite sono indicizzate per codice fiscale (§4). Un
`import_key` che contiene una stringa che *non è* un codice fiscale aggancia la
persona e **non** aggancerà mai la sua visita.

> **Da non fare:** dedurre dal fatto che `import_key` contiene un CF che quel CF
> sia valido. È l'unica riga di questo documento che parla di un rischio
> *silenzioso* in tutte e due le direzioni.

### 3.3 Il ripiego sul nome è **per cliente**, e si arrende

Già detto al §2, ma va isolato perché è il caso che l'assegnazione chiede: la
chiave di ripiego `n:<COGNOME>|<NOME>` **non identifica una persona**, identifica
*una persona dentro un cliente*. Due omonimi nello stesso cliente non sono
distinguibili, e il sistema lo sa e si ferma.

E la normalizzazione è deliberatamente **povera**: maiuscolo, spazi collassati,
punto finale tolto (`normNome`, `:61-62`). Non toglie accenti, non normalizza le
lettere doppie, non tocca gli spazi interni ai cognomi composti. `DE LUCA` e
`DELUCA` sono **due persone diverse** per questa regola.

### 3.4 I clienti attraversano il confine **senza chiave**

Le persone hanno `import_key`; i clienti no. La riconciliazione dei clienti
avviene a ogni import, per **P.IVA quando è usabile, altrimenti per
denominazione** (`:439`, `:549`) — e la guardia sulla P.IVA non è teorica: fra le
sole attive, **58 su 615** sono state ignorate come chiave (`XXXX`,
`00000000000`, e due P.IVA a dieci cifre).

Quindi per i 619 clienti **non esiste, oggi, un fatto scritto sulla riga che dica
da dove viene**: esiste solo una regola che sa ricostruirlo aprendo di nuovo
`ElencoSedi.xlsx`.

È lo stesso difetto che sulle persone è stato chiuso il 9 settembre con `98082cd`,
e sui clienti è ancora aperto. **Non lo chiudo qui** — chiuderlo significa
scrivere su `cliente`, e questa assegnazione è sola lettura — ma lo consegno come
la cosa che va decisa **prima** che i clienti attraversino, non dopo: dopo, l'id
da scrivere nella chiave sarà già cambiato.

---

## 4. Perché tutto questo ricade su `sorveglianza.persona_id`

Le visite, nei due export, sono indicizzate per **(codice fiscale, tipo di
accertamento)** — misurato l'11 settembre, `due-export-visite.md` §2:

| | |
|---|---:|
| coppie *(CF, tipo)* nel foglio `Visite` | **800** |
| coppie nello scadenzario | **804** |
| in entrambi | **769** |
| accertamenti **senza codice fiscale utilizzabile** | **8** per parte |

**La chiave delle visite è il CF, e solo il CF.** Non c'è il nome, non c'è un id
di persona. Il che produce l'unica regola che serve davvero all'altra corsia:

> **Una persona senza codice fiscale in anagrafica non è raggiungibile dalle
> visite, e non lo sarà mai — qualunque cosa faccia la migrazione.** Il ripiego
> cognome+nome del §2 tiene insieme *l'anagrafe*; non tiene insieme *l'anagrafe e
> le visite*, perché dall'altra parte non c'è un nome su cui ripiegare.

E vale nei due versi: gli **8 accertamenti per parte** senza CF utilizzabile non
hanno nessun modo di trovare la loro persona.

**Sui 787 di cui parla l'assegnazione non posso dare una conferma.** Quel numero
non compare in nessun file di questo repo, e i quattro export da cui si
ricaverebbe **non sono su questa macchina** (§6). Quel che questo repo può dire è
sopra: 800 e 804 coppie, 769 comuni, 8 per parte senza chiave. Il passaggio da
coppie a *persone distinte* non è mai stato misurato qui.

---

## 5. Il caso che l'assegnazione nomina: i dodici del foglio dei ruoli

Sul foglio `Ruoli SSL` (misurato il 10.09, `ruoli-ssl-colonne.md`):

| | |
|---|---:|
| righe con almeno un ruolo | **153** |
| di quelle, **senza** codice fiscale | **12** |
| incarichi che si perderebbero agganciando **solo** per CF | **19** |
| righe `Addetti Servizio Prevenzione e Protezione` perse | **1 su 1 — il 100%** |

L'unico ASPP dell'export è in una riga senza codice fiscale. Non è una curiosità
statistica: è la figura che, se manca, non manca **poco**.

**La regola che ne esce non è «accendere il ripiego»** — il ripiego per le persone
c'è già ed è acceso. È questa:

> Il ripiego cognome+nome va acceso **anche sul lettore dei ruoli**, e acceso
> **deliberatamente**, sapendo che aggancia *dentro un cliente* e che sugli
> omonimi si arrende. Un lettore che aggancia solo per CF non sbaglia dodici
> righe su 153: **sbaglia in silenzio**, e la cosa che perde per intero è la sola
> figura che l'export dichiara una volta sola.

E c'era un **buco di misura**, che consegnavo come tale: metà dell'organigramma
non sta nelle colonne ma nella **mansione**, in testo libero — 160 righe, di cui
148 solo lì — e per quelle la copertura del codice fiscale non era mai stata
misurata. Scrivevo che il «12 su 153» non si poteva estendere, perché sarebbe
stato trasformare un silenzio in una conferma.

> ### ⚠ MISURATO la sera del 12 settembre 2026, e non si estende in meglio
>
> Sul foglio `Ruoli SSL` di `ExportExcel.xlsx` (24/12/2023, l'unico export di
> quella famiglia su questa macchina):
>
> | | righe | senza CF | |
> |---|---:|---:|---:|
> | ruolo nelle **colonne** | 204 | 16 | 7,8% |
> | ruolo nella **mansione** | 74 | **47** | **63,5%** |
> | unione | 275 | 63 | |
>
> **Otto volte peggio.** Sulla metà *dedotta* dell'organigramma, agganciare solo
> per codice fiscale perderebbe quasi **due righe su tre**.
>
> **Perché sta qui e non solo nel nostro stato:** questo documento è ciò che la
> migrazione dati leggerà, e fin qui portava soltanto il numero piccolo — dodici
> su 153, diciannove incarichi. Un numero piccolo lasciato solo accanto a una
> decisione la fa sembrare facoltativa: regge finché nessuno la discute, e cade al
> primo che dice «per diciannove righe non vale la pena». Il numero grande va dove
> la decisione verrà riletta.
>
> **Due riserve, e la seconda dice da che parte sbaglia.** È la fotografia del
> **2023**, non quella del 2026 da cui vengono il 153 e il 160. E il dizionario è
> stato costruito **sull'export del 2026**: applicato al 2023 riconosce solo le
> forme che già conosce, quindi **74 è un limite inferiore**. Le forme non
> riconosciute sono per costruzione le più irregolari, e non c'è ragione di
> credere che chi scrive il ruolo in modo irregolare compili meglio il codice
> fiscale — **quindi il 63,5% è probabilmente ottimista**, non solo incerto.

---

## 6. Cosa non ho potuto verificare, dichiarato

**I quattro export su cui poggiano le misure non sono su questa macchina.**
Cercati: `ExportExcelDipendenti.xlsx`, `ExportExcel (4).xlsx`, `ExportExcel (5).xlsx`,
`ElencoSedi (5).xlsx` — **nessuno dei quattro**. Il lavoro dell'11 settembre è
stato fatto altrove e qui è arrivato solo il codice.

**E non ho credenziali per il database**: non c'è `.env.local`, solo l'esempio.
Nessuna delle due cose è un problema da risolvere — sono il motivo per cui le
righe qui sotto restano **da confermare** invece di essere misurate.

### 6.1 Due numeri che non tornano, e li lascio non tornanti

**a) 235, o 233?** `docs/STATO.md` e il diario del 9 settembre dicono **235**
righe senza codice fiscale, di cui **227** con nome univoco e **6** omonime. Ma
227 + 6 = **233**, ed è esattamente il numero che il commento nel codice riporta
(`:690-691`, «233 righe su 3418»).

La lettura che riconcilia i due numeri è che le **2** di differenza siano le due
righe scartate prima della riconciliazione perché senza nome né cognome (`:540`) —
righe che un conteggio grezzo sulla colonna CF conta e che la logica d'identità
non vede mai. **È plausibile e non è verificato**: il file non c'è più. Va
ricontato da chi ce l'ha, prima che il numero entri in un documento di migrazione.

**b) 3.420 scritte, 3.419 contate.** L'import del 9 settembre riporta **3.420**
persone scritte, e la verifica di idempotenza dello stesso giorno dice «0 nuove ·
**3.420** aggiornate». Il `count(*)` del 10 settembre dice **3.419**.

Una riga di differenza, a un giorno di distanza. **Per la migrazione fa fede il
3.419**, che è una misura sul database; il 3.420 è un resoconto dell'import.
Perché differiscano non lo so, e non lo deduco.

### 6.2 Le due cose che andrebbero misurate prima di migrare

Non le misuro io: la prima richiede il database, la seconda il file.

1. **Quante delle 3.419 `import_key` contengono una stringa che non è un codice
   fiscale valido** (§3.2). Sono le persone che attraverseranno l'anagrafe e non
   aggancieranno mai una visita. Sola lettura, un `count`:

   ```sql
   -- persone la cui chiave porta un CF, e il CF non è di 16 caratteri
   select count(*) from persona
   where import_key like 'anag:%' and import_key not like 'anag:%:n:%'
     and length(split_part(import_key, ':', 3)) <> 16;
   ```

   (è un filtro grossolano: cattura la lunghezza, non il carattere di controllo —
   il conto esatto lo dà `valido()`, che sta nel codice dell'app.)

2. **Quante delle 160 righe con il ruolo nella mansione hanno il codice fiscale**
   (§5), sul foglio `Ruoli SSL` di `ExportExcel (4).xlsx`.

---

## 7. La regola, in una riga

Tolto tutto il resto:

> **L'identità di una persona in questo archivio è la coppia (cliente, codice
> fiscale); quando il codice fiscale non c'è è la coppia (cliente, cognome+nome),
> e solo finché quel nome è univoco sia nell'archivio sia nel file. Il cliente non
> è un contorno della chiave: ne è la metà. E siccome quella metà è un uuid
> generato qui, la chiave attraversa il confine solo insieme ai clienti che la
> reggono.**

E il corollario, che è ciò che l'altra corsia aveva chiesto di non dimenticare:

> **Dove la fonte non ha una chiave, la migrazione non se ne inventa una.** Le
> righe senza CF e senza nome univoco restano `riga:N`, cioè *nuove ogni volta*:
> è una perdita dichiarata e visibile, e va portata di là **come tale** — non
> chiusa con un id sintetico che la farebbe sparire dalla vista senza risolverla.

---

## 8. Cosa questa consegna **non** fa

- **Non scrive niente**, né qui né in produzione. Nessuna query è stata eseguita
  sul database: i conteggi del §1 sono quelli misurati il 10 settembre.
- **Non tocca l'import dei ruoli e delle nomine**, che resta **fermo** per
  decisione di Francesco. La `067` e la `068` sono caricate e l'ostacolo tecnico
  non c'è più: **non è un permesso**, e il §5 è una preparazione, non un avvio.
- **Non chiude la provenienza dei clienti** (§3.4), che richiederebbe di scrivere
  su `cliente`.
