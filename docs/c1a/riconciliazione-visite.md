# Riconciliazione delle visite: i due export del campo concordano fra loro

Misura dell'11 settembre 2026. **Sola lettura, nessuna scrittura, nessun dato
personale.** L'import dei ruoli resta in pausa e la colonna 45 resta fuori.

## Risposta breve

Il confronto **808 contro 1.148** non è «aperto contro storico»: è un confronto
fra un numero che ho verificato su **due export indipendenti** e un numero che su
questo disco **non corrisponde a nessun file**. Le tre oculistiche quinquennali
non stanno su nessun cliente, perché **non compaiono in nessuno degli export**.

## 1. Il perimetro

| | foglio `Visite` | `ExportExcelVisiteScadenze` |
|---|---:|---:|
| righe/accertamenti | **808** | **814** (812 con data) |
| **società distinte** | **63** | **62** |
| coppie distinte (CF, tipo) | 801 | 805 |
| oculistica quinquennale | **0** | **assente** |

Società in entrambi: **62**. Solo nello scadenzario: **0**. Solo nel foglio: **1**.

Sono **due export diversi dello stesso gestionale**, presi per vie diverse, e
concordano: stesso perimetro, stesso ordine di grandezza, stessi nove
accertamenti. Su 480 società del file, quelle con sorveglianza sono **63**.

I due non sono la stessa lista: il foglio `Visite` porta l'**ultima esecuzione**
con la scadenza calcolata accanto; `VisiteScadenze` porta **una riga per
scadenza** (la sua colonna `Data` arriva al 2031 — è la scadenza, non
l'esecuzione). Cioè il gestionale, in entrambe le forme, tiene **una riga per
persona e per tipo**, non una storia.

## 2. Passato, scaduto, aperto

Sul foglio `Visite`, a oggi:

| | |
|---|---:|
| esecuzioni nel passato | **808** su 808 |
| esecuzioni nel futuro | 0 |
| scadenze **già scadute** | **311** |
| scadenze ancora valide | **485** |
| senza scadenza | 12 |

Anni di esecuzione: 2018 (3), 2019 (9), 2020 (38), 2021 (48), 2022 (77), 2023
(29), 2024 (57), **2025 (411)**, 2026 (136).

**Quindi il foglio non contiene «solo le scadenze aperte»:** il 39% è già scaduto.
E non è nemmeno uno storico: è **l'ultima esecuzione per persona e per tipo**,
qualunque sia il suo stato. La sotto-intestazione lo dice in due parole — «Ultima
Esecuzione» — ed è la stessa riga che ieri stavo per scartare come rumore.

## 3. Le tre oculistiche quinquennali: non stanno da nessuna parte

Cercate in tutti gli export del gestionale presenti sul disco:

| export | righe | accertamenti sanitari | oculistica quinquennale |
|---|---:|---:|---:|
| `ExportExcel (4).xlsx`, foglio `Visite` | 3.501 | 808 | **0** |
| `ExportExcelVisiteScadenze.xlsx` | 814 | 812 | **assente fra i 9 tipi** |
| `ExportExcelCorsiFatti.xlsx` | 13.350 | **0** | — |
| `ExportExcelCorsiScadenze.xlsx` | 4.899 | **0** | — |
| `ExportExcel.xlsx` | 127 | **0** | — |

`Genere` negli export degli eventi vale **`Formazione` e basta**: enumerato, non
supposto — 13.348 righe su 13.348 in `CorsiFatti`, 127 su 127 in `ExportExcel`.
**Nessun evento di visita esiste in quei file.** Le visite viaggiano solo nei due
export dedicati, e lì le oculistiche quinquennali sono zero.

Non posso quindi dire su quali clienti stiano: **non esistono nei dati che posso
leggere.**

## Cosa ne segue per il conteggio da sciogliere

Il 1.148 viene, secondo la scheda 10, da `staging.catalogo_gestionale` di
AppFormazione. Quella tabella **non l'ho letta e non la leggo**: è la loro corsia
e il loro database. Ma da qui si può dire cosa il 1.148 **non** può essere:

- non può essere lo storico delle visite di questi export, perché **negli export
  degli eventi le visite non ci sono affatto**;
- non può essere un perimetro più largo, perché i due export delle visite
  coprono lo stesso insieme di società (62 su 63, una sola di scarto);
- e contiene 3 accertamenti di un tipo che in entrambi gli export delle visite ha
  **zero** righe.

La spiegazione più semplice compatibile con tutto questo è che il 1.148 **non sia
un conteggio di accertamenti della stessa natura** — per esempio un conteggio di
riga di catalogo, o una somma su un'estrazione diversa da queste. Ma è
un'ipotesi, e non la dichiaro vera: **la verifica sta nel loro staging, non qui.**

*A11, applicata a questo giro.* I due numeri non tornavano, e il primo istinto era
spiegare la differenza. La differenza non andava spiegata: andava verificato il
confronto. Appena l'ho fatto — cercando le visite negli export degli eventi — si è
visto che i due lati non contano la stessa cosa, e che **uno dei due lati non
contiene affatto ciò che credevo contasse.**

## Cosa serve per chiudere, e a chi tocca

Una riga sola da AppFormazione: **da quale file e da quale colonna** nascono i
1.148, e quante righe di quel file hanno `tipo = 'VISITA'`. Se quel file è uno dei
cinque qui sopra, il confronto si chiude da sé — perché in quei cinque le visite
sono 808 e 812, e mai 1.148.
