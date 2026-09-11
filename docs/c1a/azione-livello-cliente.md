# L'azione di livello cliente: chi la prende in carico, e come sparisce da sola

Scrittura dell'11 settembre 2026, su assegnazione di AppOverall. Completa
[`ateco-tre-stati-riparazione.md`](ateco-tre-stati-riparazione.md), che aveva
lasciato dichiarato questo limite invece di improvvisarlo.

## Il problema che chiude

La riparazione dell'ATECO fa comparire nei riepiloghi righe `da_verificare` che
dicono: *«il modulo di settore non è determinabile perché manca l'ATECO»*. Sono
righe giuste — prima quel silenzio era indistinguibile da «tutto a posto» — ma
**una cosa che si vede e non si può chiudere diventa rumore in due settimane**.

Le azioni di «Cose da fare» sono intestate a una **persona** e si chiudono
registrando un **attestato**. Questa non si chiude così: si chiude compilando un
campo dell'**azienda**. Serviva una forma nuova.

## Il vincolo che ha guidato tutto: non è la campagna di riempimento

La campagna resta rinviata da Francesco. La differenza fra rispettarla e
riaprirla è:

| | |
|---|---|
| ✗ la campagna | «ecco i 357 clienti senza ATECO, comincia» |
| ✓ questo | «questo cliente ha un buco, e serve a questo» |

**La riga non nasce dal campo vuoto: nasce da un calcolo che si è fermato.** È
attesa solo dove qualcuno è **davvero nominato** in un ruolo che richiede il
modulo di settore (`rspp`, `aspp`, `datore_lavoro_rspp`) e il calcolo non si può
fare.

| | clienti con la riga |
|---|---:|
| clienti senza ATECO | 357 |
| **clienti con la riga, oggi** | **0** — `nomina` è a zero righe |
| clienti con la riga al primo import delle nomine | **4** |

I quattro sono già misurati e hanno un nome: AUTOFFICINA MORARI, DETROIT SERVICE,
GRAFICHE DUEGI, QUALIFT (vedi
[`modulo-settore-quanto-morde.md`](modulo-settore-quanto-morde.md)).

**Non può diventare una campagna per costruzione**, non per disciplina: è guidata
dall'organigramma, non dal campo vuoto. Un cliente senza ATECO e senza nessuno
nominato in quei ruoli non produce niente — e va bene così, perché per lui quel
buco non sta bloccando nulla.

## Le due cose decise

### 1. A chi è intestata

**All'area interna «Formazione»**, con `responsabile_cliente_id` a dire di quale
cliente si parla — la stessa intestazione di tutte le altre righe dello
scadenzario formativo.

Non a una persona: non c'è un discente. Ma **nemmeno al nulla**: il lavoro è
nostro, ed è una visura o una telefonata, non un corso. Se l'area interna non
esiste, il codice esistente ripiega su `responsabile_tipo = 'cliente'`, e per
questa riga il ripiego regge meglio che per le altre: il proprio ATECO il cliente
lo sa meglio di chiunque.

### 2. Quando sparisce

**Da sola, e senza che nessuno la spunti.**

La riga è *attesa* solo finché esiste un requisito che porta la marcatura
`atecoNonDeterminato`. Appena la cella arriva, `moduloSettore` risponde `dovuto`
o `non_dovuto`, il requisito non porta più quella marcatura, l'azione non è più
fra le attese, e la cancellazione degli orfani a chiave requisito — che esisteva
già dalla `056` — la rimuove.

Questo è il motivo tecnico per cui la chiave sta nella **stessa colonna** delle
altre (`azione.origine_requisito_key`) invece che in una sua: quella colonna è
già riconciliata. Una colonna nuova avrebbe richiesto di riscrivere la
riconciliazione, e **la chiusura automatica era il requisito principale**.

Conseguenza voluta: essendo derivata, **non si riapre al prossimo import** e non
sopravvive a un ATECO corretto a mano. Il rischio nominato nell'assegnazione —
«358 azioni chiuse a mano che si riaprono» — non può verificarsi, perché non
esiste una chiusura a mano da rifare.

## La chiave, e perché ha un prefisso

```
persona_id:corso_codice      una prima formazione da erogare   (mig. 056)
cliente-ateco:<cliente_id>   un dato dell'azienda che manca    (mig. 066)
```

Davanti ai due punti c'è un uuid di **persona** nella prima e un id di
**cliente** nella seconda. Cercare il secondo nella tabella `persona` non dà un
errore: **non trova niente**, e la riga comparirebbe senza discente e senza
corso. Un danno silenzioso invece che rumoroso — la stessa forma del difetto che
abbiamo passato due giorni a cercare.

Il prefisso è ciò che rende il caso riconoscibile **prima** di sbagliare. I due
lettori sono aggiornati: `cosedafare.ts` esclude quelle chiavi dalla ricerca
delle persone, `scadenzario.ts` le riconosce per non promuoverle a «SUBITO».

## Perché non è «SUBITO»

Una riga di formazione senza data, nello scadenzario, viene mostrata come
**SUBITO** e messa davanti a ogni scadenza datata: è per costruzione un corso
dovuto e mai erogato.

Questa non ha una data per la ragione **opposta**: non è un lavoro in ritardo, è
un dato che manca, e nessun termine di legge dice entro quando compilarlo.
Promuoverla a SUBITO la metterebbe in cima allo scadenzario davanti a formazione
davvero dovuta. È la stessa distinzione che il codice già faceva per gli
adempimenti senza data — *«non è un lavoro in ritardo: è una riga a cui manca il
dato»* — applicata a un caso nuovo.

E non si inventa una data: né oggi, né oggi+30. Sarebbe un dato dedotto
indistinguibile da uno vero, che è precisamente il difetto da cui è nata tutta
questa famiglia.

## Cosa è cambiato

| | |
|---|---|
| `src/lib/admin/formazione.ts` | `atecoNonDeterminato` sul requisito; la costante `CHIAVE_ATECO_CLIENTE`; l'azione nel backfill |
| `src/lib/admin/cosedafare.ts` | non cerca una persona dove c'è un id di cliente |
| `src/lib/admin/scadenzario.ts` | `rigaLivelloCliente()`: niente «SUBITO» |
| `supabase/migrations/066_…sql` | il commento della colonna descrive **due** forme di chiave, non una |
| `scripts/ateco-tre-stati.mjs` | tre controlli in più, sull'invariante |

## I controlli in più

`npm run ateco:check` verifica ora anche l'invariante che regge questa riga:

```
l’azione di livello cliente si chiude da sola
  ok  senza ATECO la ragione c’e’ (non_calcolabile)
  ok  con l’ATECO la ragione non c’e’ piu’ (dovuto)
  ok  un ATECO noto e non speciale non produce nessuna ragione (non_dovuto)
```

Il terzo è quello che guarda il vincolo: se un giorno qualcuno facesse nascere la
riga dal campo vuoto invece che dal calcolo fermo, **quel controllo fallirebbe** —
ed è il modo migliore che conosco per impedire che questa cosa diventi la
campagna di riempimento senza che nessuno se ne accorga.

## La migrazione 066, che è solo un commento

Seconda migrazione di soli commenti in due giorni, e per la stessa ragione. Il
commento della `056` descriveva **una** forma di chiave; adesso ce ne sono due, e
la colonna è letta da tre file diversi. Lasciarlo a metà sarebbe stato ripetere
l'errore del *«la stringa esatta esportata»* della `055` — quello che ha fatto
progettare a un'altra corsia una riparazione nel posto sbagliato — due giorni
dopo averlo imparato.

> Un commento di schema è un'affermazione, e vale di più dove c'è meno codice
> accanto a smentirlo.
