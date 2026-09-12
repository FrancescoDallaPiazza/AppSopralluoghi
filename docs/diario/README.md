# Che cos'è questa cartella, e quando **non** si scrive un file qui

Un file per giornata, `AAAA-MM-GG.md`. È il resoconto di **quello che una
sessione ha visto succedere**: cosa si è provato, cosa è andato storto, cosa si è
imparato mentre lo si faceva.

Non è un registro dei commit — quello lo tiene `git log`, e lo tiene meglio. Non è
lo stato del lavoro — quello sta in [`../STATO.md`](../STATO.md), che dice **a che
punto è** ciò che tocca a questa corsia.

## La regola, che è nata da un errore

> **Non si scrive il diario di una giornata che questa postazione non ha visto.**

Il lavoro di queste corsie si svolge su più macchine. Quando una giornata è stata
lavorata **altrove** e su questa copia arriva con un `pull`, qui non c'è nessuna
sessione che l'abbia vissuta: c'è solo il codice, i messaggi di commit e i file in
`c1a/`. Un diario scritto da lì è una **ricostruzione**, e una ricostruzione messa
in una cartella dove tutto il resto è testimonianza diretta **cambia di grado
senza cambiare d'aspetto**.

Chi apre `diario/2026-09-11.md` si aspetta «cosa ha visto chi c'era», e
otterrebbe «cosa dicono i commit». Sono due cose diverse, e la seconda travestita
da prima è la forma di errore che questo repo ha già pagato più volte: **una
risposta plausibile è peggio di una mancante.**

**Cosa si fa invece.** Il contenuto va in `STATO.md`, che è dichiaratamente un
documento *derivato* — lì una ricostruzione è il modo normale di scrivere, non
un'eccezione da segnalare.

**E il buco si dichiara.** Una giornata senza file qui dentro va nominata nella
tabella qui sotto, perché un'assenza non spiegata si rilegge come una
dimenticanza — ed è successo: il 12 settembre la mancanza dei diari del 10 e
dell'11 è stata segnalata come un difetto da chiudere, e i due file sono stati
scritti (`b392190`) prima che qualcuno notasse che **non andavano scritti**.

## Le giornate senza diario, e dove sta il loro contenuto

| giornata | perché non c'è | dove sta il contenuto |
|---|---|---|
| **10 settembre 2026** | lavorata su un'altra macchina; qui arrivata col `pull` del 12 alle 16:56 | `../STATO.md` — sezioni sulla quarantena, sul database guardato, su «Ruoli SSL» e sulla sorveglianza sanitaria, **scritte quel giorno da chi il lavoro l'ha fatto**; la lezione sull'indirizzo dell'app sta in [`../../DEPLOY.md`](../../DEPLOY.md) |
| **11 settembre 2026** | idem | `../STATO.md`, sezione «L'11 settembre, in 19 commit»; il dettaglio nei file `../c1a/` e nelle intestazioni delle migrazioni `064`–`068` |

*Aggiunta il 12 settembre 2026. La stessa scelta è stata fatta nella corsia
`AppFormazione` per la stessa giornata e per la stessa ragione.*
