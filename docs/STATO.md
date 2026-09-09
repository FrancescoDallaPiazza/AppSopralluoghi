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
| La schermata della quarantena | aperto | — |
| **D2** · il report non conosce i componenti | aperto | — |
| Ricreare i clienti: le 618 anagrafiche | **fermo, manca il file** | — |
| L'ATECO mancante sul 57% delle attive | aperto, aspetta la Fase 1 | — |

## Dettaglio di quello che è cambiato oggi

**I sette buchi dell'import** (`0d0c8a0`) sono chiusi tutti. Sei su sette sono
verificati sull'export vero: `Data di Licenziamento` e `Area di Lavoro` ora
agganciano; 95 P.IVA su 3.416 vengono scartate come chiave; delle 235 righe senza
codice fiscale, **227 hanno un nome univoco** e il ripiego cognome+nome le aggancia
invece di duplicarle, 6 restano `riga:N` perché omonime.

Le riparazioni **lato clienti** — colonne `LEGALE`, filtro `ATTIVA`,
`N. DIPENDENTI` — sono scritte ma **non riprovate sui dati**: `ElencoSedi (5).xlsx`
non è più in `~/Downloads`.

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
