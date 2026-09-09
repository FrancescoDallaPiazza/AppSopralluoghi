# Stato della Fase 0 — questa corsia

**Come si legge.** Il piano dei lavori sta in un posto solo
(`AppFormazione/docs/PROGRAMMA.md`, reso su
https://claude.ai/code/artifact/8116d53d-6944-4ce0-a9c0-29a1e072d763): quello dice
**cosa** va fatto. Questo file dice **a che punto è** ciò che tocca a questo repo,
e lo dice qui perché è qui che si lavora — le caselle le riempie chi le chiude.

L'altra corsia legge questo file, non deve chiederlo. Aggiornato quando qualcosa
si chiude, con l'hash del commit accanto: se manca l'hash, non è chiuso.

Ultimo aggiornamento: **9 settembre 2026**.

---

| voce della Fase 0 | stato | commit |
|---|---|---|
| **D1** · cache voci sui template composti | chiuso | `af0aefb`, `bcc3a31` |
| **D4** · `tecnico.cognome`, la migrazione mai scritta | chiuso | `af0aefb` |
| **D3** · quarantena della coda offline | chiuso | `33e5838` |
| **I sette buchi dell'import** | chiuso | `0d0c8a0` |
| Provenienza: `import_key` sulle persone | chiuso | `98082cd` |
| La schermata della quarantena | aperto | — |
| **D2** · il report non conosce i componenti | aperto | — |
| Ricreare i clienti: le 619 anagrafiche attive | **già fatto** (misurato in app) | — |
| Importare le persone: 3.420 scritte | **fatto 9.09** | `af8d945` |
| Paginazione delle letture (PostgREST tronca a 1000) | chiuso su `persona` | `af8d945` |
| L'ATECO mancante sul 57% delle attive | aperto, aspetta la Fase 1 | — |

## Dettaglio di quello che è cambiato oggi

**I sette buchi dell'import** (`0d0c8a0`) sono chiusi tutti. Sei su sette sono
verificati sull'export vero: `Data di Licenziamento` e `Area di Lavoro` ora
agganciano; 95 P.IVA su 3.416 vengono scartate come chiave; delle 235 righe senza
codice fiscale, **227 hanno un nome univoco** e il ripiego cognome+nome le aggancia
invece di duplicarle, 6 restano `riga:N` perché omonime.

Le riparazioni **lato clienti** sono ora verificate anche loro, su
`ElencoSedi.xlsx` (849 righe, intestazione alla riga 1, 41 colonne). Tutte e nove
le colonne che servono agganciano, comprese le quattro che prima si perdevano:

| verifica | prima | adesso |
|---|---|---|
| `INDIRIZZO / CAP / CITTÀ / PROVINCIA LEGALE` | null su ogni voce | **361 indirizzi, 361 CAP, 362 località, 359 province** sulle attive |
| colonna `ATTIVA` (valori `Sì` / `No`) | ignorata | **230 ex clienti scartati**, restano **619 attive** |
| `N° DIPENDENTI` | mai letto | **481 letti**; 138 a zero o vuoto restano «non dichiarato» |
| guardia P.IVA | assente | **58 su 615 ignorate**: `XXXX`, `00000000000`, `0418754028` e `0472097023` a dieci cifre |
| ATECO | — | presente su **267 delle 619 attive** (43%), come il riscontro del 26 agosto |

I numeri combaciano con quel riscontro a meno di una riga (849 contro 847: è un
export rifatto). Resta la decisione aperta su `INDIRIZZO SITO PRODUTTIVO`, che il
file ha e che **non** viene letto come sede legale: è la sede operativa, e finché
non è deciso come trattarla resta fuori apposta.

**La provenienza delle persone** (`98082cd`): `persona.import_key` esisteva dalla
migrazione `055` con il suo indice unique, ma nessuno la scriveva. Ora l'import
anagrafiche la scrive come `anag:<cliente>:<cf>` — col cliente dentro, perché
l'indice è globale e la stessa persona può stare su due organigrammi. È il primo
mattone di ciò che permette a un sistema di sapere cosa ha già ricevuto da un
altro: senza API, quella cosa la sa solo se la riga se la porta scritta.

## Aperto, e appena diventato possibile: i ruoli sicurezza

L'altra corsia ha trovato che il foglio **«Ruoli SSL»** di `ExportExcel (4).xlsx`
contiene davvero i ruoli sicurezza, **con la data dell'incarico** e non una
spunta: 85 addetti primo soccorso, 79 antincendio, 71 emergenze, 35 responsabili
emergenze, 31 RSPP, 25 preposti, 10 RLS. Il ROADMAP diceva da mesi che i ruoli
non erano in nessun export: era falso.

**Misurato da questa parte: sono 141 persone distinte, e 141 su 141 hanno il
codice fiscale fra le 3.420 appena importate.** Aggancio perfetto.

Il foglio non ha la P.IVA, e per l'anagrafica sarebbe un problema. Per le nomine
**non lo è**: la chiave che serve non è quella del cliente, è quella della
persona — e il codice fiscale c'è su tutte.

Perché conta: oggi l'import crea nomine con la sola figura `lavoratore`, e il
motore ricava i requisiti dalle **nomine**, non dagli attestati. Un attestato RLS
o antincendio importato esiste come riga ma è **muto** finché la persona non è
nominata in quel ruolo. Queste 141 nomine accenderebbero esattamente quelle
scadenze.

Con un ridimensionamento onesto, che viene dall'altra corsia: solo **65 società
su 480** hanno almeno un ruolo registrato, e nessun incarico è successivo al
2022. Dieci RLS su 480 aziende non è la realtà: è quello che qualcuno ha scritto
nel gestionale. Non è una raccolta fatta, è un punto di partenza.

## Cosa blocca, e chi lo tiene

- **I clienti NON sono da rifare: ci sono già.** Misurato il 9 settembre
  sull'app vera, anteprima dell'import di `ElencoSedi.xlsx`: **0 nuovi, 1 da
  completare, 618 già a posto, 230 righe scartate**. I conti tornano col file
  (619 attive + 230 ex clienti = 849 righe). «Già a posto» significa che hanno
  anche indirizzo e numero dipendenti: se mancassero, il file glieli darebbe e
  risulterebbero da completare.
- **Correzione a una cosa ripetuta tutto il giorno.** Il TODO diceva «tabula
  rasa dal 5 agosto» e questo file lo ripeteva: **è falso**. Era un documento,
  non una misura, e nessuno l'aveva verificato contro il database. Da qui in
  avanti lo stato del database si dichiara solo dopo averlo guardato.
- **Le 230 righe scartate sono la prova sul campo del filtro `ATTIVA`**: in
  produzione, con i dati veri, gli ex clienti non entrano più.
**Le persone sono dentro: 3.420 scritte** il 9 settembre, dall'export
`ExportExcel (5)` (ricerca dipendenti riesportata quel giorno, 3.502 righe,
intestazioni alla riga 3, 450 gruppi, 12 senza cliente, 2 righe scartate).

Ci sono voluti tre tentativi, e i primi due hanno trovato un difetto che c'era
da sempre. `riconciliaPersone` rileggeva le persone già in archivio **senza
paginare**, e PostgREST tronca a 1000 righe: con 3.400 persone dentro, quelle
oltre la millesima risultavano assenti e l'import provava a ricrearle. Finché
nessuno scriveva la provenienza, il risultato erano **doppioni creati in
silenzio**; da quando `import_key` si scrive, la scrittura si ferma con
`duplicate key value violates unique constraint uq_persona_import`. L'errore
era il sintomo, non la malattia — ed è comparso al primo import su un database
davvero pieno.

**Verificato, e pulito.** Ricaricando lo stesso file dopo l'import riuscito:
**0 nuove · 3.420 aggiornate**. Due cose insieme: i tentativi falliti non hanno
lasciato doppioni, e l'import è **idempotente** — ripassare lo stesso file non
crea più niente. È la prova che la provenienza (`import_key`) fa il suo mestiere.

Per rendere quella verifica possibile è stato aggiunto il totale
«N nuove · M aggiornate» in cima al riepilogo (`0c431b6`): prima il dato esisteva
solo dentro ogni gruppo, e i gruppi sono 450.

**Stessa forma, ancora aperto:** `caricaClientiPerImport` non pagina. Oggi non
rompe perché i clienti sono 619, sotto la soglia.
- **L'ATECO mancante aspetta il raccordo a monte** (`formazione-81-utils-src`),
  che è dell'altra corsia. È l'unico punto in cui questa aspetta quella: una visura
  di oggi porta un codice ATECO 2025, e senza raccordo scriverebbe un livello di
  rischio sbagliato senza segnale. L'import dei due Excel invece non è a rischio,
  perché quei file portano codici 2007.
- **Cosa dobbiamo all'altra corsia:** niente.

## Come sapere cosa ha fatto l'altra corsia

I due repo stanno sullo stesso disco. Non serve chiedere né aspettare un riassunto:

```
git -C ../AppFormazione log --oneline --since="2026-09-09 00:00"
cat ../AppFormazione/docs/STATO.md          # se e quando esiste
cat ../AppFormazione/docs/diario/AAAA-MM-GG.md
```

Vale nei due versi. Il giorno in cui i repo non fossero più sulla stessa macchina,
il punto d'incontro diventa il repo neutro — o, finché non esiste, la pagina
condivisibile del programma.
