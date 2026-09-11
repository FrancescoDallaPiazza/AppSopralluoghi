# L'ATECO che abbiamo: 262 divisioni, e il livello è derivato

Misura dell'11 settembre 2026, su richiesta di AppOverall dopo aver scoperto che
in AppFormazione `clienti.ateco` è vuota su tutti e 480. **Sola lettura, nessuna
scrittura.**

## Quanti

| | |
|---|---:|
| clienti | **619** |
| **con codice ATECO** | **262** |
| senza | **357** (57,7%) |
| divisioni distinte | **46** |

Il 57% mancante è quello che `STATO.md` porta da settimane. Ma c'è uno scarto da
segnalare: il riscontro del 9 settembre diceva **267 sull'export `ElencoSedi`**, e
nel database ne trovo **262**. **Cinque non sono arrivati**, e non so quali — il
confronto è fra un file e una tabella, non l'ho fatto riga per riga.

## Che cosa sono davvero: divisioni, non codici

**I valori sono di due caratteri.** `25`, `43`, `86`, `01`… Non sono codici ATECO
completi come `25.62.00`: sono **divisioni**.

Questo cambia la domanda sull'annata. Le eccezioni ISTAT 2025↔2007 che la libreria
porta sono **9 su 1.290 codici foglia**: a livello di divisione non possono
applicarsi, perché una divisione non ha il dettaglio su cui quelle eccezioni
mordono. La distinzione 2007/2025 qui **morde solo dove cambia la divisione
intera** — cioè esattamente i tre casi della decisione 5.

E di quei tre, **nei nostri dati c'è solo la 86**: 6 clienti. Le divisioni 30 e 87
non compaiono.

## Risolvono? Tutte

**262 su 262** risolvono contro `classificaRischio` della libreria a monte. Zero
codici orfani, zero che non trovano una classe.

## E la domanda che interessava di più: il livello è DERIVATO

| | |
|---|---:|
| livello scritto **=** livello dal raccordo | **262** |
| **divergono** | **0** |
| clienti con ATECO **ma senza** livello | **0** |
| clienti con livello **ma senza** ATECO | **0** |

**Zero divergenze su 262, e nessun caso spaiato nei due versi.** Non è una
classificazione scritta a mano che *per caso* coincide: è una derivazione. Se
qualcuno avesse deciso a mano anche solo una manciata di livelli, su 46 divisioni
e 262 clienti se ne vedrebbe traccia — e soprattutto esisterebbe almeno un cliente
con un livello e senza un codice, che è la firma tipica dell'inserimento manuale.

**Quindi non c'è nessuna divergenza da contare**, e la qualità di quei 262 livelli
è esattamente la qualità del raccordo che li produce.

## La provenienza: una sola divisione poggia su una deduzione

Tutte e 46 le divisioni portano `fonte`. Quarantacinque citano l'**Allegato IV ASR
17/04/2025 (Rep. Atti 59/CSR)** con `dedotto = false`.

**Una sola ha `dedotto = true`: la divisione 86** — *Assistenza sanitaria*,
**6 clienti**, classificata ALTO sull'*Allegato II Accordo 221/CSR del 21/12/2011,
GU n. 8 dell'11/01/2012*. È la decisione 5, e qui si vede quanto pesa in concreto:
**6 clienti su 262**, il 2,3%.

## E la risposta che AppOverall voleva subito: il livello antincendio non c'è

Misurato oggi, e lo confermo perché cambia la `0006`:

| | righe | valorizzate |
|---|---:|---:|
| `cliente.livello_antincendio` | 619 | **0** |
| `cliente.gruppo_primo_soccorso` | 619 | **0** |
| `sede.livello_antincendio` | 619 | **0** |
| `sede.gruppo_primo_soccorso` | 619 | **0** |

**Nessuno dei quattro posti è valorizzato.** La decisione di tenere antincendio e
primo soccorso fuori da `corso_assolve` regge: non c'è nessun livello da cui
partire.

## Cosa si sposterebbe, se qualcuno lo chiedesse

La domanda di AppOverall era «cosa si sposterebbe, prima che qualcuno chieda il
permesso». La risposta:

- **262 divisioni a due cifre**, non codici completi. Se la loro `clienti.ateco`
  si aspetta un codice pieno, questi **non lo sono**, e il trasferimento non è una
  copia: è un cambio di grana;
- **tutte e 262 risolvono** contro la libreria che sta a monte di entrambi, quindi
  il dato è utilizzabile da lì così com'è;
- **il livello va ricalcolato, non copiato.** Da noi è derivato, e derivarlo di
  nuovo da loro dà lo stesso risultato — copiarlo invece porterebbe dall'altra
  parte un valore che non si sa più da dove viene.

*Una riga di cautela sull'aggancio, che nessuno ha ancora verificato:* perché
quei 262 codici finiscano sui clienti giusti serve una chiave comune fra i due
database, e il documento `05-import-storico.md` di AppFormazione dice che **non
c'è nessun identificativo cliente negli export** e che la P.IVA non è una chiave
(404 valori per 438 ragioni sociali, `00000000000` su 36 aziende, più una
collisione reale). **Il dato esiste; l'aggancio è un problema aperto**, e non è
questo lavoro ad averlo risolto.
