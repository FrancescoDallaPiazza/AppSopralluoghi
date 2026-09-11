# La riparazione dell'ATECO: tre stati, e la cella che li rende dicibili

Scrittura dell'11 settembre 2026, su assegnazione di AppOverall. Chiude l'ultimo
dei tre difetti della stessa famiglia trovati in due giorni.

## Il difetto, in una riga

`cliente.codice_ateco` è un dato **derivato** da una cella di testo libero, e
aveva **due stati** — una divisione, oppure `null`. Ma `null` portava **due
significati diversi sulla stessa variabile**:

- «per questa divisione non c'è niente da fare» → saltare è **giusto**;
- «la divisione non la so» → saltare **nasconde** un requisito che non si sa
  calcolare.

A valle, `formazione.ts` li trattava con lo stesso `continue`. Il risultato non
era un buco visibile: era **una riga in meno**, cioè un silenzio indistinguibile
da «tutto a posto».

## I tre stati

| stato | quando | cosa fa il motore |
|---|---|---|
| **noto** | la divisione c'è e la cella non la smentisce | calcola, come sempre |
| **ignoto** | la divisione non c'è (cella vuota, o testo senza codice) | **dice di non sapere** |
| **incerto** | la divisione c'è **ma la cella dice che potrebbe essere un'altra** | **dice di non sapere**, salvo quando tutte le alternative danno lo stesso esito |

**Il terzo non lo esprime nessun tipo di ritorno.** Non lo distingue un `null` e
non lo distingue un valore: in archivio `37` sta scritto esattamente come ogni
altra divisione giusta. Lo distingue **solo** il confronto con la cella da cui è
stato derivato.

> Per questo `cliente.ateco_origine` non è un extra di comodo: **è ciò che rende
> quello stato esistente.** Senza la cella, `incerto` non è esprimibile, e il
> difetto non si ripara — si sposta.

## Cosa è cambiato

| | |
|---|---|
| `supabase/migrations/065_cliente_ateco_origine.sql` | la colonna `ateco_origine` + i commenti che dicono cosa sono i due campi |
| `src/formazione/ateco.ts` | `classificaAteco()` → `EsitoAteco` (i tre stati) e `moduloSettore()` → `EsitoModuloSettore` (dovuto / non dovuto / **non calcolabile**) |
| `src/lib/admin/anagraficheImport.ts` | l'import scrive la cella **verbatim**, anche quando non se ne ricava niente |
| `src/lib/admin/formazione.ts` | il `continue` unico diventa tre rami; il terzo emette una riga `da_verificare` |
| `src/lib/sync.ts`, `src/lib/db.ts`, `FormazioneRiepilogo.tsx` | la cella arriva anche **in campo**: la valutazione offline resta pari a quella del back-office |
| `src/admin/Anagrafiche.tsx` | in anagrafica, lo stato `incerto` si vede, con le alternative e la cella |
| `scripts/ateco-tre-stati.mjs` | il banco di prova, sui casi veri |

`oreModuloSettore()` resta per la UI dell'anagrafica, che ha solo il codice —
con un commento che dice di **non** usarla nel motore, perché quella firma i tre
stati non li può esprimere.

## Misurato, non affermato

Lo script `npm run ateco:check` compila `src/formazione/ateco.ts` con esbuild e
lo esercita sui casi veri, con le celle **verbatim** dall'export. Tutti passano.
E fatto girare sui 619 clienti attivi ricostruiti dall'export:

| stato | clienti |
|---|---:|
| `noto` / confermato | **256** |
| `incerto` | **6** |
| `ignoto` / cella senza codice | 5 |
| `ignoto` / nessuna cella | 352 |

256 + 6 = i 262 con un codice; 5 + 352 = i 357 senza. I sei `incerto` sono
esattamente quelli già nominati nei documenti: ANTICHI SAPORI, BONUM,
LA SALUMOTECA, MIGLIORINI, BP CHIMICA, SHAMS.

E il modulo di settore, prima e dopo:

| esito | datore-RSPP | RSPP/ASPP |
|---|---:|---:|
| dovuto | 48 | 54 |
| non dovuto *(silenzio giusto)* | **213** | **207** |
| **non calcolabile** *(oggi detto, prima taciuto)* | **358** | **358** |

Prima erano 214 e 208 «non dovuti»: **SHAMS è passato dal silenzio alla riga che
dice di non sapere**, ed è il caso per cui la riparazione esiste.

## Le due cose decise, e il perché

### Dove sta il terzo stato

Nel confronto fra `codice_ateco` e `ateco_origine`, non in un valore speciale
della prima colonna. Un enum con un membro `incerto` avrebbe richiesto che
qualcuno **decidesse** quali righe marcare, e quella decisione è esattamente ciò
che nessuno può prendere a tavolino: si ricalcola dalla cella ogni volta, e se
domani la cella cambia, cambia anche la risposta.

**Un'incertezza non rilevabile non si dichiara certa.** Le righe anteriori alla
065 non hanno la cella: il loro stato è `noto` con riscontro
**`non_verificabile`** — niente le smentisce, ma niente le conferma. È una terza
parola apposta: dire `confermato` sarebbe falso.

### Cosa fa il motore su ciascuno dei tre

- **non dovuto → si salta, in silenzio.** È giusto: un requisito qui sarebbe un
  falso «mancante» su un obbligo che non esiste. Sono 213 clienti, e per loro
  tacere è la risposta corretta.
- **non calcolabile → una riga `da_verificare`**, con dentro la ragione e cosa
  la risolve: *«Modulo di settore: non determinabile perché il cliente non ha un
  codice ATECO. Si risolve compilando l'ATECO del cliente, non registrando un
  attestato.»* Non è `critico` — dire «mai svolto» affermerebbe che il corso
  serve, e non lo sappiamo. Non è l'assenza della riga — quella direbbe che non
  serve, e non lo sappiamo nemmeno.
- **dovuto → come sempre**, con le sue ore.

**Un caso che meritava una scelta e non una regola.** Se la cella è ambigua ma
*tutte* le divisioni plausibili danno lo stesso esito, la risposta **è**
determinata e dire «non lo so» sarebbe un falso allarme. È BP CHIMICA (due codici,
entrambi in divisione 46) e MIGLIORINI (46 oppure 33: nessuna delle due è un
settore speciale, quindi il modulo non è dovuto in nessun caso). Non è SHAMS,
dove 37 non dà modulo e 41 ne dà 16: lì la risposta dipende da quale sia il codice
vero, e quale sia il vero non lo sappiamo.

*Di MIGLIORINI resta aperto il livello di rischio* — 46 è basso, 33 è alto, e per
i suoi tre lavoratori sono 4 ore di formazione specifica invece di 12. Quella
incertezza il motore non la può chiudere: la mostra l'anagrafica, ed è lì che
qualcuno con una visura in mano la risolverà.

### Fin dove arriva

Arriva al **riepilogo dell'organigramma del cliente**: la riga compare fra i
requisiti, lo stato della persona diventa `da_verificare` invece di `conforme`, e
il contatore `da_verificare` la conta. È la schermata di chi guarda quel cliente.

**Non** diventa un'azione in «Cose da fare», e non è una dimenticanza: quelle
azioni sono intestate a una **persona** e si chiudono registrando un attestato.
Questa non si chiude così — si chiude compilando un campo dell'**azienda**.
Metterla lì manderebbe il consulente a cercare un corso invece che una visura.
Un'azione di livello cliente oggi non esiste; se servirà, è una cosa sua e va
progettata, non improvvisata qui.

## Cosa questa riparazione NON fa

**Non riempie niente.** La campagna di riempimento dell'ATECO resta rinviata
(decisione di Francesco dell'11 settembre: «verrà fatta a posteriori»), e i due
casi aperti — MIGLIORINI e ANTICHI SAPORI — restano da chiarire con una visura,
non con un criterio automatico. Qualunque regola («vince il primo codice», «vince
il più specifico», «vince il livello più alto per prudenza») sarebbe una nostra
decisione travestita da dato.

**Non c'è backfill, e non può essercene uno.** La cella d'origine non era
conservata da nessuna parte: le 262 righe esistenti restano senza, e si popolano
da sole al prossimo import delle anagrafiche. È la misura di cosa costa non aver
conservato il testo la prima volta.

> Questa riparazione non riempie: **rende dicibile ciò che oggi è muto.** Chi lo
> dice resta una persona.

## La famiglia, chiusa

Terzo e ultimo caso della stessa forma, trovato tre volte in due giorni su tre
tabelle diverse:

| | il derivato | il testo perduto | cosa non si poteva più dire |
|---|---|---|---|
| ATECO | `codice_ateco` | la cella dell'export | «questa divisione potrebbe essere sbagliata» |
| ruoli sicurezza | la colonna di ruolo | la mansione | `RSPP- NO TITOLARE`, il refuso `TITOLRE` |
| alias corsi | `corso_alias.testo_gestionale` | il titolo verbatim | «il gestionale scrive due spazi» — e un titolo con un a capo dentro |

La regola che ne esce, e che vale oltre l'ATECO:

> **quando si deriva un dato da un testo altrui, il testo altrui è parte del
> dato.** Il derivato, da solo, non sa dire se sia affidabile — e chi arriva dopo
> non ha modo di chiederglielo.
