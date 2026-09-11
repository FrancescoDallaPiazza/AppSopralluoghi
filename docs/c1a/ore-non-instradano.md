# Le ore ci sono, e non instradano

Verifica dell'11 settembre 2026 per l'import, su richiesta di AppOverall: *l'export
del gestionale porta le ore per riga?* Sì. **Ma la regola che ci si voleva
appoggiare sopra non regge, e va fermata prima di scriverla.**

Fonte: `ExportExcelCorsiFatti.xlsx`, 13.350 righe. **Sola lettura.**

## La risposta letterale: sì, le ore ci sono

Colonna **26, `Durata Formazione`**. Su 13.350 righe: **2 vuote, 0 non
numeriche**. È un dato affidabile e presente.

## La risposta utile: non separano l'art. 37 dall'art. 34

La regola proposta era *6 ore → art. 37, 8 ore → art. 34*. Misurata contro i dati
veri:

| ore | righe | tipi distinti | di cui riconducibili al datore |
|---:|---:|---:|---:|
| **6** | **1.651** | 14 | **76** |
| **8** | **1.749** | 21 | **31** |

A 6 ore il tipo più frequente è `Aggiornamento Lavoratori 6 ore` — **1.031
righe**, lavoratori e basta. Poi 290 aggiornamenti di primo soccorso, 222 di
preposto. Il numero 6 non dice «datore»: dice «sei ore», che è una durata comune a
mezzo catalogo.

## E il punto che chiude la questione: a 6 ore c'è l'art. 34, non l'art. 37

L'unico tipo a 6 ore che riguarda il datore è:

> `AGGIORNAMENTO R.S.P.P. DATORE DI LAVORO RISCHIO BASSO` — **76 righe, 6 ore**

che è **art. 34** (il datore che svolge in proprio i compiti di RSPP), cioè
esattamente ciò che la regola voleva mandare dall'altra parte. Gli aggiornamenti
dell'art. 34 nell'export seguono il rischio:

| tipo | ore | righe |
|---|---:|---:|
| `AGGIORNAMENTO R.S.P.P. DATORE DI LAVORO RISCHIO BASSO` | **6** | 76 |
| `AGGIORNAMENTO R.S.P.P. DATORE DI LAVORO RISCHIO MEDIO` | 10 | 23 |
| `AGGIORNAMENTO R.S.P.P. DATORE DI LAVORO RISCHIO ALTO` | 14 | 36 |
| `AGGIORNAMENTO DATORE DI LAVORO CHE SVOLGE I COMPITI DI RSPP` | 8 | 26 |

**Da dove nasce l'equivoco.** Nel nostro catalogo `DATORE_LAVORO` (art. 37) ha
`ore_aggiornamento = 6` (migrazione `016`) e `DL_RSPP_COMUNE` (art. 34) ha
`ore_aggiornamento = 8`. Dentro quel modello semplificato «6 contro 8» separa
davvero. **Ma il gestionale non usa quel modello:** usa le ore reali dell'Accordo,
che per l'art. 34 sono 6/10/14 secondo il rischio. Quindi il 6 dell'art. 37 e il 6
dell'art. 34-rischio-basso **sono lo stesso numero**, e collidono proprio dove la
regola doveva tagliare.

Instradare per ore porterebbe **76 aggiornamenti dell'art. 34 dentro l'art. 37**,
in silenzio e con la riga che sembra giusta.

## Cosa funziona invece

**Il titolo.** I quattro tipi qui sopra si distinguono senza ambiguità dal testo,
e il testo è esattamente ciò che il dizionario `corso_alias` già mappa — 268 voci,
237 mappate. Non serve un discriminatore nuovo: serve non sostituire quello che
c'è con uno più debole.

Le ore restano utili per quello che sono: **verificare** che un attestato mappato
abbia la durata attesa, e segnalare quando non l'ha. È un controllo, non una
chiave.

## Il ripiego proposto, e perché qui non serve

Il ripiego indicato era «se le ore non ci sono, si usa la nomina». Le ore **ci
sono**, quindi il ripiego non scatta — ma andrebbe comunque tenuto per un'altra
ragione: un attestato dice cosa una persona **ha fatto**, la nomina dice cosa
**deve** fare. Per decidere se un aggiornamento è dovuto come art. 37 o come art.
34, la fonte giusta è la seconda, non la durata della prima.
