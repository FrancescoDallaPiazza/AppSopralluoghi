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
| Ricreare i clienti: le 619 anagrafiche attive | **pronto, da eseguire** | — |
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

## Cosa blocca, e chi lo tiene

- **Le 618 anagrafiche non rientrano senza `ElencoSedi (5).xlsx`.** Il file manca.
  È la cosa che tiene ferma l'uscita della Fase 0, e quindi la Fase 4.
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
