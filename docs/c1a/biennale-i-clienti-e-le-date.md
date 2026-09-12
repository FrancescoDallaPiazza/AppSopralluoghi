# Le righe «PREPOSTI - BIENNALE»: i clienti, e «due aule» non regge

Misura del **12 settembre 2026**, chiesta da AppOverall perché Francesco ha
domandato ad AppFormazione come riconoscere quelle due aule — cioè a chi andare a
chiedere. **Sola lettura.** Nessun nome, nessun codice fiscale: solo società,
date e conteggi.

> **Il file non è quello che serviva, ed è il motivo per cui questa pagina va
> letta con le sue riserve.** `ExportExcelCorsiFatti.xlsx` non è su questa
> macchina. Quello usato qui è **`ExportExcel (3).xls`**, un export
> *«Elenco Visite/Formazioni»* che dichiara in fondo **«Dati aggiornati al
> 28/10/2024 15:11»**. È un'altra fotografia, di due anni prima.

---

## 1. Il risultato che serviva a Francesco: il cliente

Righe con il titolo **esatto** `FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI - BIENNALE`
in questo export: **54**, su **cinque** date e **tre** società.

| `Data` nel file | righe | società |
|---|---:|---|
| 2023-12-27 | 4 | MAEMA SRL UNIPERSONALE |
| 2025-11-08 | 1 | Impresa Agromeccanica Aprili Graziano |
| 2026-03-29 | 9 | MAEMA SRL UNIPERSONALE |
| **2026-05-20** | **14** | **Rittal RCS Cooling Solutions S.r.l.** |
| **2026-09-05** | **26** | **Rittal RCS Cooling Solutions S.r.l.** |

**Le due aule che si cercavano sono di `Rittal RCS Cooling Solutions S.r.l.`** —
si veda il §2 per il perché sono proprio quelle, malgrado l'anno diverso.

*E non è un nome nuovo in questa indagine:* Rittal RCS è la stessa società delle
**dieci righe `PIANIFICATA`** dello scadenzario sanitario — «tutte e dieci della
stessa società», persone senza storico. Che sia la stessa azienda a comparire in
due anomalie diverse non prova niente da solo, ma è un fatto da tenere davanti a
chi andrà a chiedere.

## 2. Perché sono le stesse due aule, malgrado l'anno

`preposto-un-codice-tre-corsi.md` registra le due aule come **20.05.2024** e
**05.09.2024**. Qui compaiono **2026-05-20** e **2026-09-05**: stesso giorno,
stesso mese, **esattamente due anni dopo**, su entrambe.

Due coincidenze esatte di giorno *e* mese su due date indipendenti non sono un
caso. E la direzione la decide un fatto che il file dichiara di sé:

> **Il file dice «dati aggiornati al 28/10/2024» e contiene righe datate
> 2026-05-20 e 2026-09-05.** Un export non può registrare come *svolto* un corso
> che si terrà diciannove mesi dopo. Quindi in questo export la colonna `Data`
> **non è la data di erogazione**: per queste righe è una data **futura**, e la
> lettura che torna sui numeri è la **scadenza** — erogazione + 2 anni, cioè il
> ciclo che il titolo stesso chiama «biennale».

## 3. E quindi «due aule» non regge

Era la frase che reggeva il ragionamento: *«non è una popolazione diffusa nel
tempo: sono due aule»*. In questo export **non lo è**:

- **cinque** date, non due;
- **tre** società, non una;
- e la coda non è nel 2025 come sospettavo, è **prima**: applicando lo stesso
  scarto di due anni, le altre tre sarebbero erogazioni del **2021-12**, del
  **2023-11** e del **2024-03**.

Se quello scarto vale (e vale su due date su due, verificate), **il titolo
«- BIENNALE» esiste dal 2021**, non da maggio 2024. Il che toglie anche l'altro
argomento del documento — *«il `- BIENNALE` comincia a maggio 2024 e finisce a
dicembre 2025, cioè scavalca l'Accordo in entrambi i versi: è un prodotto suo»* —
perché scavalcare l'Accordo partendo dal 2021 è un'altra affermazione.

## 4. Cosa questa misura NON dice, e sono quattro cose

**a) Non risolve il 30 contro 31.** Quel conteggio è sull'export del 2026, questo
è un altro file: 54 righe qui non si confrontano con 31 là.

**b) Non conferma che siano le righe da 12 ore.** *Questo export non ha nessuna
colonna di ore o durata* — verificato, non assunto. Il filtro «12 ore» del
documento originale viene da un'altra fonte, e qui non è riproducibile.

**c) I conteggi delle due aule non combaciano: 14 e 26 qui, 5 e 25 là.** Sul
secondo la differenza è di uno; sul primo è di nove, e non la spiego. Può essere
la finestra temporale diversa, può essere un filtro che non conosco, può essere un
errore in una delle due letture.

**d) La lettura «`Data` = scadenza» vale per questo export e per queste righe.**
Non la estendo agli altri file senza misurarla: è esattamente il tipo di salto che
è già costato una volta oggi.

## 5. La conseguenza che non riguarda il preposto, e pesa di più

Se in un export del gestionale la colonna `Data` è una **scadenza** e non una
**erogazione**, allora questa riga del nostro codice è in discussione:

    formazioneImport.ts:230   ->   data_completamento

`preposto-un-codice-tre-corsi.md` lo diceva già come dubbio — *«l'export non
dichiara cosa contenga»* — e lo lasciava aperto. **Adesso c'è un caso concreto in
cui quella colonna non può essere l'erogazione**, perché è successiva alla data
dei dati.

Non cambio niente: non so se l'export che l'import legge davvero abbia la stessa
semantica, e i due file hanno intestazioni diverse. Ma la domanda «cosa misuri la
colonna `Data`» — che AppOverall ha già in cima alla lista per l'Area Formazione —
**ha adesso un dato dietro invece di un sospetto**, e questa è la sua prova.

## 6. Come rifarla

```
node -  # con xlsx: foglio 0, intestazioni alla riga 2 (indice 2)
        # colonne: Società, Sede, Tipo, Data, Stato
        # filtro: Tipo === 'FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI - BIENNALE'
```

**Una nota su come leggere le date, che ha già prodotto un errore qui dentro.**
La prima estrazione dava `2026-05-19` e `2026-09-04` — un giorno prima — perché
usava `toISOString()`: a mezzanotte locale in fuso CEST quello torna il giorno
**precedente** in UTC. Le date vanno formattate dal calendario locale
(`getFullYear` / `getMonth` / `getDate`). Con l'errore, la corrispondenza esatta
col 20.05 e col 05.09 **non si sarebbe vista**, e tutto il §2 non esisterebbe.
