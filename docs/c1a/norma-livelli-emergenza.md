# La norma sui livelli: cosa dicono i due decreti, verbatim

Lettura dell'11 settembre 2026 per la scheda 11. **Le fonti erano nel corpus**,
in `formazione-81-utils-src/reference/fonti/`, e sono state lette lì — nessuna
fonte presa da altrove, nessuna citazione a memoria.

**Non contiene una decisione.** La scheda 11 la firma chi risponde
dell'adempimento.

## Il risultato in una riga

**Nessuno dei due decreti contiene una clausola di equivalenza fra livelli.**
Entrambi prescrivono una **corrispondenza** fra il livello dell'attività e il tipo
di corso. Che un corso superiore possa sostituire l'inferiore **non è vietato: non
è proprio trattato.**

## Antincendio — DM 2 settembre 2021, allegato III

Fonte: `fonti/D.M. 02_09_2021.pdf`, 59 pagine. Punti **3.2.1, 3.2.2 e 3.2.3 a
pagina 21**; punto **3.2.4 a pagina 22**.

Il punto 3.2.1 comma 1 lega il corso al livello dell'attività:

> «I contenuti minimi dei corsi di formazione e dei corsi di aggiornamento
> antincendio per addetti al servizio antincendio devono essere **correlati al
> livello di rischio dell'attività** così come individuato dal datore di lavoro e
> sulla base degli indirizzi riportati di seguito.»

E poi **ciascuno dei tre punti chiude con un comma 2 della stessa forma** — è qui
che sta la prescrizione, ed è il testo che la scheda 11 cercava:

> **3.2.2 comma 2** (livello 3, pag. 21) — «I corsi di formazione e i corsi di
> aggiornamento per gli addetti operanti nelle sopra riportate attività **devono
> essere basati sui contenuti e la durata riportati nei punti 3.2.5 e 3.2.6 per i
> corsi di tipo 3** (FOR o AGG).»
>
> **3.2.3 comma 2** (livello 2, pag. 21) — stessa frase, «**per i corsi di tipo
> 2**».
>
> **3.2.4 comma 2** (livello 1, pag. 22) — stessa frase, «**per i corsi di tipo
> 1**».

Le durate stanno al punto 3.2.5: **livello 1 → 4 ore, livello 2 → 8 ore, livello
3 → 16 ore**; gli aggiornamenti al 3.2.6: **2, 5 e 8 ore**.

**Cercata e non trovata una clausola di equivalenza.** Le disposizioni transitorie
(art. 7, commi 1-3) riguardano solo i corsi già programmati col vecchio DM
10/03/1998 e la scadenza del primo aggiornamento: **non dicono nulla** sul valore
di un corso di livello diverso da quello dell'attività. L'unica deroga soggettiva
del decreto riguarda il personale del Ministero della difesa (art. 5 comma 4).

## Primo soccorso — DM 388/2003

Fonte: `fonti/Decreto Min. Salute n. 388_2003.pdf`, 12 pagine. Art. 1
«Classificazione delle aziende» a **pagina 1**; art. 3 «Requisiti e formazione
degli addetti al pronto soccorso» a **pagina 7**; allegato 3 a pagina 9, allegato
4 a pagina 11.

### I gruppi NON sono un ordinamento, ed è dimostrato dal testo

Art. 1 comma 1 (pag. 1): il **gruppo A** è definito da un elenco di **tipi di
attività** (industrie a rischio rilevante, centrali termoelettriche, nucleare,
estrattive, esplosivi) più due condizioni su indice INAIL e agricoltura; il
**gruppo B** è «aziende o unità produttive con **tre o più lavoratori** che non
rientrano nel gruppo A»; il **gruppo C** «con **meno di tre lavoratori** che non
rientrano nel gruppo A».

Quindi A si separa da B/C per **tipo di attività**, e B si separa da C per il
**numero di lavoratori**. Non è una scala di gravità crescente: è una
classificazione a due criteri diversi. **L'ipotesi di AppOverall era giusta.**

### E i corsi sono due, non tre

Art. 3 (pag. 7):

> **comma 3** — «Per le aziende o unità produttive **di gruppo A** i contenuti e i
> tempi minimi del corso di formazione sono riportati **nell'allegato 3**, che fa
> parte del presente decreto e **devono prevedere anche la trattazione dei rischi
> specifici dell'attività svolta**.»
>
> **comma 4** — «Per le aziende o unità produttive **di gruppo B e di gruppo C** i
> contenuti ed i tempi minimi del corso di formazione sono riportati
> **nell'allegato 4**.»

`B` e `C` condividono lo stesso corso. Il modello dell'app ha `PS_GRA` e
`PS_GRBC`, ed è **corretto**: la domanda non è ternaria, è binaria.

**Cercata e non trovata una clausola di equivalenza.** L'art. 3 comma 5 dice solo
che restano validi i corsi ultimati prima dell'entrata in vigore, e che la
formazione va ripetuta con **cadenza triennale** almeno per la capacità di
intervento pratico.

### Una riga del comma 3 che vale la pena non perdere

Il corso di gruppo A deve trattare «**anche i rischi specifici dell'attività
svolta**». Cioè quel corso è **legato all'attività in cui la persona opera**, non
solo al gruppo. È un argomento contro la portabilità automatica dell'attestato di
gruppo A **anche fra due aziende entrambe di gruppo A** — e non l'ho visto
discusso da nessuna parte.

## Cosa ne segue, e cosa resta da decidere

Quel che i testi dicono:

| | |
|---|---|
| attività di livello N → corso di tipo N | **scritto**, DM 2021 all. III 3.2.2/3/4 c. 2 |
| azienda gruppo A → allegato 3; gruppi B e C → allegato 4 | **scritto**, DM 388 art. 3 c. 3 e 4 |
| un corso superiore vale per un'attività inferiore | **non trattato** in nessuno dei due |

Quindi la «corrispondenza esatta» **non è una deduzione prudente: è la lettera dei
decreti.** Ciò che resterebbe una deduzione è il contrario — ammettere la
sostituzione verso il basso.

Le due cose su cui serve la firma di chi risponde, e che io non scrivo:

1. se un attestato di livello **inferiore** a quello dell'attività vada
   considerato **non conforme** — i testi lo suggeriscono, ma «non conforme» è un
   giudizio, non una lettura;
2. se un attestato di livello **superiore** possa essere accettato. Qui il testo
   tace, e tacere non è permettere né vietare. Per il primo soccorso la domanda è
   ulteriormente stretta dal comma 3: un corso di gruppo A è cucito sui rischi di
   quell'attività.

**In nessuno dei due casi la scelta va lasciata implicita nel codice**, che è
esattamente quello che succede oggi: `scegliFormazione` accetta qualunque corso
della categoria, e quella è già una risposta — la più permissiva delle tre — data
senza che nessuno l'abbia decisa.
