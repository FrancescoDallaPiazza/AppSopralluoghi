# AppSopralluoghi — Guida d'uso

> **Stato della guida** — allineata al **2026-08-24**, commit `b7a8b5c`.
> Descrive l'app **come si usa oggi**, non come era pensata.

Questa è la guida operativa. Per il *perché* delle scelte (modello dati,
architettura, decisioni di dominio) vedi `PROGETTO.md`; per il lavoro ancora da
fare, `TODO.md`. Qui si dice solo dove si clicca e cosa succede.

**Indice**

| § | Capitolo | A chi serve |
|---|---|---|
| [0](#0-come-è-tenuta-viva-questa-guida) | Come è tenuta viva questa guida | chi sviluppa |
| [1](#1-accesso-e-struttura) | Accesso e struttura | tutti |
| [2](#2-anagrafiche--la-scheda-cliente) | Anagrafiche — la scheda cliente | back-office |
| [3](#3-portare-dentro-i-dati-i-cinque-ingressi) | **Portare dentro i dati: i cinque ingressi** | back-office |
| [4](#4-risorse-umane--il-personale-del-cliente) | Risorse Umane — il personale | back-office |
| [5](#5-organigramma-sicurezza) | Organigramma sicurezza | back-office + campo |
| [6](#6-scadenzario-e-cose-da-fare-non-sono-la-stessa-cosa) | Scadenzario e Cose da fare | back-office |
| [7](#7-pianificazione--incarichi-sedute-checklist) | Pianificazione — incarichi, sedute, checklist | back-office |
| [8](#8-regole-app--catalogo-e-dizionari) | Regole app — catalogo e dizionari | back-office |
| [9](#9-app-da-campo--eseguire-il-sopralluogo) | App da campo | tecnico |
| [10](#10-il-giro-completo) | Il giro completo | tutti |
| [11](#11-limiti-noti-e-trappole) | Limiti noti e trappole | tutti |
| [12](#12-novità--cosè-cambiato-per-chi-usa-lapp) | Novità — cos'è cambiato | tutti |
| [13](#13-mappa-capitolo--sorgenti) | Mappa capitolo → sorgenti | chi sviluppa |

---

## 0. Come è tenuta viva questa guida

Il problema di ogni manuale è che invecchia in silenzio: il codice cambia, la
guida no, e nessuno se ne accorge finché qualcuno non segue un'istruzione che
non esiste più. Questa guida ha un modo per accorgersene.

Il §13 associa ogni capitolo ai **file sorgente** che descrive. Il comando

```bash
npm run guida:check
```

confronta l'ultimo commit che ha toccato `docs/USO.md` con i commit successivi
su quei file, e stampa **quali capitoli sono rimasti indietro** e per colpa di
quali commit. Non corregge nulla — dice dove guardare.

Regola di lavoro, sul modello di quella che vale per `TODO.md`: **una modifica
che cambia ciò che l'utente vede o fa si chiude aggiornando il capitolo
corrispondente e la voce §12**, nello stesso commit. Se il capitolo non cambia,
non si tocca: `guida:check` misura la distanza dall'ultimo commit della guida,
quindi un aggiornamento fittizio azzera l'allarme senza aver letto niente.

Cosa va in §12 e cosa no: §12 è il registro **di ciò che si vede**. Le decisioni
tecniche e le loro motivazioni stanno nella `Cronologia` di `PROGETTO.md` e lì
restano — duplicarle qui vorrebbe dire mantenerle in due posti.

---

## 1. Accesso e struttura

Si entra con email e password. L'app ha **due ambienti**:

- il **back-office**, la scrivania: clienti, organigrammi, checklist, incarichi,
  pianificazione, scadenze. È quello che vede l'amministratore all'apertura;
- l'**app da campo**, dove il tecnico compila il sopralluogo. Ci si entra dal
  pulsante **App da campo** in alto a destra. È pensata per il telefono ma si
  usa anche da tablet e da desktop, e funziona **offline**.

### La navigazione del back-office è a due livelli

Il primo livello sceglie il **gruppo**, il secondo la **sezione**. I gruppi con
una sola sezione non mostrano la seconda riga.

| Gruppo | Sezioni | Cosa ci si fa |
|---|---|---|
| **Anagrafiche** | Anagrafiche · Import formazione | chi è il cliente: dati, sedi, persone, organigramma |
| **Pianificazione** | Incarichi · Tecnici · Aree · Template · Capitoli · Disponibilità · Import Werp | cosa facciamo, quando e con chi |
| **Scadenzario** | — | le scadenze di tutte le ditte |
| **Cose da fare** | — | le attività nate dal campo |
| **Regole app** | Catalogo formazione · Import catalogo · Alias corsi | le regole valide per tutti i clienti |

Il criterio della divisione, che spiega dove cercare una cosa: **Anagrafiche**
scrive dati *dei clienti*, **Regole app** scrive regole valide *per tutti*. Per
questo *Import formazione* (attestati di persone reali) sta fra le Anagrafiche,
mentre *Alias corsi* (il dizionario dei nomi dei corsi) sta fra le Regole.

Si esce con **Esci**, in alto a destra.

---

## 2. Anagrafiche — la scheda cliente

*Anagrafiche → Anagrafiche* è l'elenco dei clienti: ricerca in testa, e per ogni
riga i comandi **Apri**, **Copia** e lo stato. In testa, **+ Nuovo cliente**.

Aprendo un cliente si trova una **scheda a riquadri**. I riquadri sono sei e si
comportano come schede: si clicca il titolo e sotto compare il pannello.

| Riquadro | Contenuto |
|---|---|
| **Dati anagrafici** | identità, ATECO, emergenze, sedi |
| **Risorse Umane** | tutto il personale (§4) |
| **Organigramma sicurezza** | figure, nomine, formazione (§5) |
| **Incarichi** | gli incarichi del cliente e il loro avanzamento |
| **Scadenzario** | lo scadenzario filtrato su questo cliente (§6) |
| **Cose da fare** | le correttive di questo cliente (§6) |

Su un cliente **nuovo** esiste solo *Dati anagrafici*: gli altri cinque
compaiono dopo il primo salvataggio, perché hanno bisogno di un cliente che
esista davvero.

### 2.1 Dati anagrafici

1. **Ragione sociale** (unico campo obbligatorio), **Partita IVA**, **Codice
   fiscale**.
2. **Numero di lavoratori.** Non è decorativo: l'art. 37 c. 11 lega le ore
   dell'aggiornamento RLS alla dimensione dell'azienda (**4h fino a 50
   lavoratori, 8h oltre**). Finché è vuoto, nello scadenzario quella riga dice
   *«4h o 8h — indicare il numero di lavoratori in anagrafica»* invece di un
   numero. L'app non lo indovina: un default plausibile non si distingue da un
   dato verificato.
3. **Referenti** (generale, amministrativo, commerciale) e **canale
   commerciale**.
4. **Indirizzo, CAP, Località, Prov.** — è la **sede legale**.

### 2.2 Codice ATECO → livello di rischio

Il campo **Codice ATECO** è guidato: si digita un codice (`56`) oppure
un'attività (`ristorazione`) e si sceglie dalla tendina.

**Scegliendo la divisione, l'app imposta da sola anche il livello di rischio**
(basso / medio / alto). Non è una deduzione arbitraria: è la tabella
dell'**Allegato IV dell'ASR 17/04/2025**. Il rischio governa le ore della
formazione specifica dei lavoratori — senza, l'organigramma mostra l'avviso
*«Livello di rischio non impostato»* e alcune voci non si possono calcolare.

Digitando un codice **a mano**, il livello viene solo **proposto**: compare il
bottone **Applica** accanto al rischio, e finché non lo si preme un valore già
scelto non viene sovrascritto.

> Il campo conserva la **divisione a due cifre** (`74`), non il codice completo.

### 2.3 Gestione emergenze

Due dati che l'ATECO **non** dà e che nessuna tabella deduce: si scelgono.

- **Livello rischio incendio**: 1 (corso 4h), 2 (8h), 3 (16h), più il campo
  libero *Definito mediante* (da cosa discende la scelta).
- **Gruppo primo soccorso**: il bottone **Determina col flusso** apre un breve
  questionario che propone il gruppo **e registra la motivazione**. Si può
  impostare anche a mano, ma allora sotto compare l'avviso *«Definito
  manualmente (nessuna motivazione registrata)»* — che è il punto: una scelta
  senza motivo scritto resta segnalata.

Se nell'organigramma manca l'addetto, è da questi due valori che il report
ricava **quale corso** vada erogato.

### 2.4 Sedi: legale e operativa

- La **sede legale** sono i campi indirizzo dei dati anagrafici.
- La **sede operativa** è dove si lavora davvero, e si aggiunge nel blocco
  *Sedi* in fondo al pannello. In testata alla scheda compare l'etichetta
  **sede legale** / **sede operativa** a dire quale delle due si sta leggendo.

**Un cliente ha una sola sede operativa.** Non è una limitazione da aggirare: in
app **un cliente = un organigramma**, e gli addetti alle emergenze si designano
**per luogo di lavoro**. Due stabilimenti fusi in un cliente solo farebbero
contare una squadra di emergenza per due posti, e il secondo risulterebbe
coperto senza esserlo.

**Serve un'altra sede operativa?** Bottone **Copia** nell'elenco clienti: nasce
un'anagrafica a sé, stessa P.IVA (che non ha vincolo di unicità: condividerla
fra clienti è previsto), organigramma proprio.

---

## 3. Portare dentro i dati: i cinque ingressi

È la domanda più frequente, quindi in chiaro: **non esiste un unico "importa
anagrafiche"**. Ci sono cinque ingressi, ognuno con una portata diversa, e
sbagliare ingresso è il modo più veloce per ritrovarsi con dati a metà.

| # | Ingresso | Dove | Crea clienti | Crea persone | Crea attestati |
|---|---|---|---|---|---|
| 1 | **+ Nuovo cliente** / **Copia** | Anagrafiche | ✅ a mano | — | — |
| 2 | **Import Werp** | Pianificazione → Import Werp | ✅ (+ incarichi e sopralluoghi) | — | — |
| 3 | **Importa da Excel** | scheda cliente → Risorse Umane | — | ✅ | — |
| 4 | **Import formazione** | Anagrafiche → Import formazione | ❌ **mai** | ✅ opzionale | ✅ |
| 5 | **Script SQL** | Supabase → SQL Editor | ✅ | ✅ | ✅ |

### L'ordine giusto, partendo da zero

1. **Alias corsi** (§8.3) — prima di tutto. Con alias non mappati l'import
   formazione lascia indietro attestati, e il motore valuta su una storia
   incompleta: rossi falsi.
2. **I clienti** — ingresso 1, 2 o 5. Devono esistere prima delle persone.
3. **Le persone** — ingresso 3, oppure direttamente l'ingresso 4, che sa
   crearle.
4. **La formazione** — ingresso 4.

### 3.1 Cliente a mano (l'ingresso normale)

*Anagrafiche* → **+ Nuovo cliente** → compila §2.1–2.4 → **Salva cliente**.

Il minimo per non lasciare buchi che si pagano dopo: ragione sociale, P.IVA,
**ATECO** (che porta il rischio), **numero di lavoratori**, **livello
antincendio**, **gruppo primo soccorso**, sede legale e sede operativa.

Per mettere fuori uso un cliente che non si segue più: **Disattiva** (resta in
archivio). **Elimina** compare solo se non ha incarichi collegati.

### 3.2 Import Werp — clienti, ma dentro una pipeline

*Pianificazione → Import Werp.* Vuole **quattro** export Excel del gestionale
Werp: **Contratti, Documenti, Attività, Anagrafiche**. Poi:

1. **Analizza** → è un **dry-run**: non scrive niente, calcola il piano e mostra
   i numeri e le liste *Da rivedere* / *Da chiarire* / esclusi.
2. Si guardano le liste.
3. **Applica** → scrive il piano.

Cosa fa davvero: aggancia i clienti esistenti per **P.IVA / codice fiscale**, in
fallback per ragione sociale normalizzata; **crea** quelli che non trova; poi
genera **incarichi e sopralluoghi pianificati**. L'arricchimento dei clienti già
presenti è **non distruttivo**: riempie solo i campi vuoti, il lavoro manuale
non viene mai sovrascritto. È idempotente (upsert per id), quindi rilanciarlo
non duplica.

> **Attenzione, due punti.**
>
> **(a)** Non è un ingresso "solo anagrafica": porta con sé incarichi e
> sopralluoghi. Se serve *solo* il cliente, è l'ingresso sbagliato.
>
> **(b)** Un cliente **nato** da Werp ha l'ATECO ma **non** il livello di
> rischio, e non ha né numero di lavoratori né livelli di emergenza. Vanno
> riaperti uno per uno: nel campo ATECO basta premere **Applica** per il
> rischio, il resto si compila.

### 3.3 Persone da Excel — l'import delle anagrafiche personali

È **dentro la scheda del cliente**, non nel menù principale:
*Anagrafiche → apri il cliente → **Risorse Umane** → **Importa da Excel***.

1. **Scarica modello** genera `modello_risorse_umane.xlsx` con le colonne
   giuste e due righe di esempio.
2. Si carica un **.xlsx / .xls / .csv**, una riga per persona. Intestazioni
   riconosciute, **in qualsiasi ordine** e tolleranti a maiuscole, accenti e
   spazi:

   | Colonna | Sinonimi accettati |
   |---|---|
   | **Cognome** | — |
   | **Nome** | Nominativo, Dipendente, Cognome e nome, Nome cognome |
   | **Codice fiscale** | CF, C. fiscale |
   | **Mansione** | Ruolo, Qualifica, Profilo, Profilo professionale |
   | **Reparto** | Area, Settore, Ufficio |
   | **Data assunzione** | Assunzione, Data assunz., Data di assunzione, Data inizio |

3. Compare l'**anteprima**, che **non scrive nulla**: *N nuove, N aggiornate*,
   più le righe scartate e i CF non validi.
4. **Applica**.

Regole che conviene conoscere prima di caricare:

- **Il match è sul codice fiscale**, mai sul nome. Chi ha il CF di una persona
  già presente la **aggiorna**; chi non ha CF entra sempre come persona nuova.
- **Cognome, nome, mansione e reparto vanno in MAIUSCOLO**, sempre. È
  deliberato: `Saldatore` e `SALDATORE` scritti da mani diverse producevano due
  voci per la stessa cosa e rompevano la ricerca per mansione.
- **Le righe senza nome vengono scartate** e contate nell'anteprima.
- **Un CF non valido non blocca**: la riga entra lo stesso, segnalata.
- **Reimportare non riattiva i cessati.** Il file non ha una colonna di
  cessazione, quindi non dice nulla sul punto: comparire in un elenco di
  personale non è la prova che il rapporto sia ripreso.
- Le date si accettano come celle Excel, `gg/mm/aaaa` o `aaaa-mm-gg`.

### 3.4 Import formazione — gli attestati (e, se vuoi, le persone)

*Anagrafiche → Import formazione.* Legge l'export **«Ricerca
Visite/Formazioni»** del gestionale: una riga per attestato, con persona, corso,
data e ore.

> **Non è `scadenzarioSedi.xlsx`.** Quello è un derivato: elenca le scadenze
> *già calcolate* dal gestionale, senza data del corso né ore. Importarlo
> significherebbe dedurre gli attestati invece di leggerli.

Il flusso:

1. Si carica il file. Le righe di **Genere = Visita** vengono scartate e
   contate: le visite mediche non sono formazione (il loro posto è la
   sorveglianza sanitaria).
2. Le righe si raggruppano in **unità = (P.IVA, Sede)**. Ogni unità diventa una
   card.
3. Per ogni card si sceglie **su quale cliente scrivere**. L'app propone
   l'abbinamento (P.IVA + sede operativa), ma **conferma l'operatore**: la
   P.IVA da sola non basta a decidere, perché due sedi della stessa azienda sono
   due clienti distinti (§2.4). Se due card puntano allo stesso cliente, l'app
   **avvisa e dice quale altra card** lo tiene: sono due stabilimenti che stanno
   per finire in un organigramma solo.
4. Due spunte per card:
   - **crea le persone mancanti** — l'aggancio è per **codice fiscale**;
   - **assegna al ruolo Lavoratori** (accesa di default: senza quel ruolo gli
     attestati appena importati non affiorano da nessuna parte).
5. L'anteprima mostra, prima di scrivere: quali **corsi non sa mappare** (lì
   l'import non inventa: lascia indietro), quali attestati hanno **meno ore di
   quelle dovute**, e le incoerenze di luogo.
6. **Applica.**

In cima alla schermata c'è il contatore **«da mappare»**: se non è a zero,
sistemare prima gli alias (§8.3).

> **L'import formazione non crea clienti, ed è voluto.** Un cliente nato dal
> file sarebbe senza ATECO, senza livello di rischio e senza livelli di
> emergenza — dati che il file non ha e che guidano il motore: con
> `livello_rischio` nullo non si sa nemmeno quante ore di formazione specifica
> siano dovute. L'anteprima **segnala l'unità senza cliente e mostra i dati per
> crearlo a mano**, completo.

### 3.5 Script SQL — quando l'import dall'app non basta

Alcune ricostruzioni si fanno da *Supabase → SQL Editor*, non dall'app. Vivono
in `supabase/migrations/` e `supabase/scripts/`, sono **idempotenti** (dedup su
P.IVA e codice fiscale) e quindi rieseguibili senza duplicare.

Il caso tipico è il cliente interno: `046_import_organigramma_overall_standalone.sql`
ricrea OVERALL GROUP con persone, nomine, formazioni ed esoneri, e
`047_overall_datore_lavoro_nomina.sql` aggiunge la nomina a datore.

### 3.6 Cosa **non** c'è ancora

**L'import da visura camerale non è implementato.** È il prossimo lavoro
concordato: caricare il PDF della visura e ricavarne anagrafica, unità locali e
legale rappresentante come *proposte da confermare*. Specifica completa in
`TODO.md` §B — nessuna riga di codice ancora scritta, e `pdfjs-dist` non è
installato. Finché non c'è, i clienti si creano come al §3.1.

---

## 4. Risorse Umane — il personale del cliente

*Scheda cliente → **Risorse Umane***. È **tutto** il personale: l'insieme
superiore dell'organigramma. Non tutti ricoprono una figura di sicurezza — qui
si censiscono tutti i lavoratori, nel tab Organigramma si nominano solo quelli
che una figura la ricoprono. Le due viste leggono e scrivono la **stessa**
tabella: doppioni non se ne creano.

**In testa**: *Importa da Excel* (§3.3) e **+ Aggiungi**.

**Filtri** (compaiono quando servono):

- ricerca libera per cognome, nome, CF, mansione, reparto o ruolo;
- tendina **ruoli** presenti, più la voce *Senza ruolo assegnato*;
- tendina **In forza / Solo cessati / Tutti** coi conteggi — **compare solo se
  qualcuno è davvero cessato**. Con *Tutti* o *Solo cessati*, accanto al cognome
  compare l'etichetta **cessato gg/mm/aaaa**.

Filtrando fino a zero righe il messaggio dice *«Nessuna persona con i filtri
attivi»*, non *«Aggiungine una»*: vuoto per filtro e vuoto davvero sono due cose
diverse.

### 4.1 La scheda persona

Cognome, nome, codice fiscale (validato, con cross-check su data e sesso),
**mansione**, **reparto**, data di assunzione, **data di cessazione**, livello
di rischio individuale, note, e la spunta *formazione pregressa*.

**Mansione e reparto** si scrivono in **stampatello mentre digiti**, e il campo
propone in tendina **le voci già usate in azienda** — due tendine separate, le
mansioni non compaiono fra i reparti. È un `<datalist>`, non una `<select>`:
**una mansione nuova si scrive lo stesso**. La tendina propone anche le
mansioni delle persone cessate e di quelle escluse dal filtro in corso:
restringere l'elenco a schermo non deve togliere voci al vocabolario.

### 4.2 La data di cessazione fa uscire dall'organigramma

È l'unico campo anagrafico che cambia l'esito di conformità, quindi si comporta
in modo esplicito:

- **data passata** → sotto il campo compare l'avviso *«Salvando, esce
  dall'organigramma…»*. Dopo *Salva*, la persona sparisce dall'elenco *In
  forza*, esce dall'organigramma, e **i suoi requisiti e le sue scadenze
  spariscono dal riepilogo e dallo scadenzario**;
- **togliere la data** → la persona rientra in forza coi suoi requisiti;
- **data futura** → avviso **rosso** con i giorni di distanza, e la persona
  **resta in forza**. Nei dati veri una data avanti nel tempo è quasi sempre
  l'anno digitato male; in elenco la riga porta la pill rossa **data da
  verificare**. Le cessazioni programmate non si gestiscono, di proposito.

Il bottone **Disattiva** valorizza la data a oggi, **Riattiva** la azzera, e —
dalla correzione di agosto — non butta più le modifiche non ancora salvate.

### 4.3 Libretto formativo

Bottone **Libretto** sulla riga della persona. È il taglio **per persona**,
complementare all'organigramma che taglia per figura: chi è, che ruoli ricopre
con le date di nomina, **tutta** la formazione svolta in ordine cronologico e
raggruppata per tipologia, con le scadenze. **Esporta PDF** lo produce
stampabile (se la chiave PDF manca, ripiega su HTML invece di fallire).

Due scelte da conoscere:

- **niente valutazione dei requisiti** (conforme / critico): dipende dai ruoli e
  dal catalogo *di oggi*, e su un documento che si consegna e si rilegge mesi
  dopo diventa un'affermazione sbagliata su una persona. Per quello c'è
  l'organigramma, dove è viva;
- è **l'unico posto dell'app** dove compaiono anche gli attestati che non
  servono a nessun requisito dei suoi ruoli — il corso antincendio di chi in
  organigramma è solo lavoratore. Altrove sono invisibili per costruzione.

---

## 5. Organigramma sicurezza

*Scheda cliente → **Organigramma sicurezza***. È la fotografia dei ruoli di
sicurezza e dello stato formativo di chi li ricopre. La stessa identica vista la
usa il tecnico **in campo** durante il sopralluogo: una modifica qui si vede là.

La schermata ha due parti.

### 5.1 Organigramma attuale (chi c'è)

In alto, la fisarmonica dei ruoli **assegnati**, chiusi all'apertura. Sopra, una
**ricerca per persona**: da due caratteri sostituisce la tabella, trova per
cognome, nome, mansione, reparto e codice fiscale, e `rossi mario` e
`mario rossi` trovano la stessa persona.

- clic sulla **riga-testata di un ruolo** → si apre il ruolo intero;
- clic su una **riga-persona** → si apre la **sua sola** scheda, con in testa
  la barra *«Scheda di … · il ruolo ha N incaricati»* e il bottone *Vedi tutti
  gli incaricati (N)*. Serve sui ruoli affollati, i Lavoratori dopo un import.

### 5.2 Organigramma atteso (cosa serve)

Sotto, tutte le figure previste, coperte o no, con la loro **guida normativa**
(sotto la «i» del ruolo). Per ogni figura:

- **Assegna** / **Modifica** — per i Lavoratori il verbo è **Adibisci**. Il
  pannello propone i candidati fra tutte le risorse umane e, dove serve,
  chiede se la formazione è **pregressa**; c'è anche l'**assegnazione di massa**
  per i ruoli che riguardano tutti;
- **+ Persona non in elenco** crea la persona al volo, con la stessa tendina di
  mansioni della scheda Risorse Umane;
- la **data di nomina** e le sue **evidenze documentali** (allegato della
  lettera di incarico);
- per ogni **requisito**: registrare l'**attestato** (con allegato PDF), un
  **esonero / credito**, o segnalare *vedi allegato*. Accanto alla scadenza si
  vede anche la **data di svolgimento**;
- i **moduli aggiuntivi** con il loro semaforo.

I semafori dei requisiti: **Conforme**, **In scadenza**, **Critico**,
**Esonerato**, **Facoltativo**, **Da verificare** (il neutro delle situazioni
pregresse). Su una figura **scoperta** l'app non dice solo «corso da erogare»:
dice anche **chi ha già quel corso** fra il personale.

### 5.3 La barra dei comandi

| Comando | Cosa fa |
|---|---|
| **Genera dai gap** | propone voci di scadenzario per i corsi mancanti o scaduti; si sceglie se includere le scadenze imminenti e a quale **area interna** indirizzarle |
| **+ Schema** | mostra/nasconde il diagramma gerarchico |
| **PDF** | il PDF dell'organigramma con lo storico revisioni |
| **Storico** | l'elenco delle revisioni salvate |

**Ogni modifica salva uno snapshot versionato**: lo storico è integrale, non un
log di differenze.

---

## 6. Scadenzario e Cose da fare non sono la stessa cosa

Sono due tab distinti e la distinzione è la regola, non un dettaglio.

| | **Scadenzario** | **Cose da fare** |
|---|---|---|
| Da dove nascono | da un **fatto registrato**: un attestato, un DVR, un CPI, una visita | dal **campo**: le correttive dei sopralluoghi e le sedute |
| Chi le crea | nessuno: si ricalcolano da sé | tu, a mano, o il sopralluogo |
| Categorie | Formazione · Documenti · Autorizzazioni · Sorveglianza sanitaria | correttive e sedute, con responsabile e ciclo di vita |

Mescolarle rendeva la lista un posto dove metà delle righe si aggiornano da
sole e metà le aggiorni tu.

Entrambe esistono in **due tagli**: la vista globale (gruppo di primo livello,
tutte le ditte) e la vista **filtrata sul cliente** (riquadro nella scheda
cliente).

Nello Scadenzario: filtri per categoria e per stato (*Scadute*, *Prossime*), e
sulle scadenze formative si può cambiare stato. Una persona con un corso **mai
svolto** produce una riga con pill rossa **SUBITO**, in cima a qualunque data, e
conta fra le *Scadute*.

> Il tab Scadenzario globale **non ricalcola da solo**: per vedere l'effetto di
> una modifica all'organigramma, passa **prima** dalla scheda del cliente.

---

## 7. Pianificazione — incarichi, sedute, checklist

### 7.1 Tecnici e Aree

- **Tecnici**: chi esegue i sopralluoghi. Servono per assegnare le sedute e per
  l'accesso all'app da campo. Il campo *capienza ore/settimana* è quello su cui
  si calcola il carico in Disponibilità.
- **Aree**: le risorse o funzioni **interne** a cui indirizzare le cose da fare
  (ufficio tecnico, responsabile di reparto, formazione).

### 7.2 Capitoli e Template — costruire le checklist

- **Capitoli**: i blocchi riusabili, con le loro **voci** (ogni voce è un punto
  da verificare). Si costruiscono una volta e si riusano.
- **Template**: la checklist completa, ottenuta **componendo** i capitoli/box.

Un template va reso **attivo**: solo gli attivi sono selezionabili in
pianificazione e in campo.

> I template sono **versionati**: la seduta congela la versione con cui è stata
> aperta, così le modifiche successive non alterano i sopralluoghi già svolti.

### 7.3 Incarichi

*Pianificazione → Incarichi* mostra la panoramica degli incarichi attivi col
loro avanzamento. **+ Nuovo incarico**:

1. **Cliente** (deve già esistere in Anagrafiche);
2. **tipo di attività** — è solo un'etichetta descrittiva: **non** determina la
   checklist;
3. i sopralluoghi, in uno dei due modi:
   - **per cadenza** («1 ogni N giorni/settimane/mesi»), col numero di sedute
     calcolato e mostrato in anteprima;
   - **numero fisso** nel periodo;
4. **durata** della seduta, eventuale **sede** predefinita, **stato**,
   **periodo** (inizio/fine).

Sulla card: **Modifica**, il selettore di **Stato** e, se non ha ancora sedute,
**Elimina**.

### 7.4 Pianificare le sedute

**Pianifica** sulla card dell'incarico. Si generano le sedute mancanti, poi per
ciascuna si imposta **tecnico**, **data** (con ricalibratura delle successive,
uniforme o a scorrimento), **durata**, **località** e **checklist**.

L'app **suggerisce il tecnico** in base al carico della settimana. La scheda
**Disponibilità** dà la stessa informazione in panoramica: per ogni tecnico,
settimana per settimana, la percentuale di riempimento rispetto alla sua
capienza, su finestre di 4, 8 o 12 settimane. È in sola lettura.

> Punto chiave: **la checklist si sceglie qui, per seduta**. Se la imposti, in
> campo la compilazione si apre direttamente su quella; se la lasci vuota, il
> tecnico la sceglie sul posto.

---

## 8. Regole app — catalogo e dizionari

Questo gruppo scrive **regole valide per tutti i clienti**. Nessun dato di
cliente passa di qui.

### 8.1 Catalogo formazione

L'editor degli **esoneri ammessi**: titoli, abilitazioni e ruoli equipollenti
riconosciuti, che compaiono come **promemoria** durante la compilazione
dell'organigramma. Si aggiungono, modificano, tolgono.

### 8.2 Import catalogo

Carica l'xlsx grezzo del catalogo corsi ASR e ne mostra la **pulizia
normalizzata**: figura riportata a cascata, durata → ore, periodicità → mesi,
aggiornamenti marcati. **È solo anteprima: non scrive nulla.** Il catalogo
dell'app è curato per **codici** (`LAV_GEN`, `DATORE_LAVORO`, `RSPP_MOD_A`…) a
cui il motore si aggancia, e la mappatura nome → codice è una curatela, non un
import meccanico: il seeding resta un passo SQL rivisto.

### 8.3 Alias corsi — il dizionario che sblocca l'import formazione

*Regole app → Alias corsi.* Il gestionale chiama i corsi con nomi suoi; l'app
ragiona per codici. Questa schermata fa da ponte, e sono **due gesti distinti**:

1. **caricare l'export** del catalogo corsi del gestionale
   (`elencoAnagraficaFormazioni.xlsx`, foglio *Anagrafica Formazione*):
   anteprima → conferma, porta dentro i nomi nuovi come *da mappare*. **Non
   tocca mai le righe già mappate.**
2. **mappare**, che è il lavoro vero e si fa anche senza file. Ogni riga finisce
   in uno di tre stati: **mappata** su un corso, **ignorata** (non è un corso
   ASR: ANSF, ECM, privacy, ambiente, saldatura), o **ancora da fare**.

Il contatore **«da mappare»** è in cima perché è ciò che blocca l'import della
formazione: con alias non mappati il motore valuterebbe su una storia formativa
incompleta.

> Attenzione a quale export si carica. Il gestionale ne offre due simili:
> `ExportExcel` (74 righe) è **solo** la categoria *Generica* — caricando quello
> si mapperebbe il 28% del catalogo credendo di aver finito. Quello giusto è
> `elencoAnagraficaFormazioni.xlsx`, **268 corsi**.

---

## 9. App da campo — eseguire il sopralluogo

Si entra dal pulsante **App da campo**. Funziona **offline**: il tecnico lavora
senza rete e i dati si sincronizzano quando la connessione torna. Nessun login
separato — stesso accesso, due schede:

- **I miei sopralluoghi**
- **Le mie cose da fare**

### 9.1 I miei sopralluoghi

L'elenco delle sedute assegnate. In testa il comando **Scarica offline**
(prefetch): perché una seduta sia apribile senza rete deve essere stata
scaricata almeno una volta.

Aprendo una seduta **completata**, la *report-bar* offre:

| Comando | Cosa fa |
|---|---|
| **Report → Cliente** | il PDF nella variante da consegnare |
| **Report → Interno** | la variante interna |
| **Invia al cliente** | genera la variante cliente e la spedisce all'email dell'anagrafica |
| **Modifica** | **congela** lo stato attuale come revisione, poi riapre la seduta |

*Modifica* non riapre e basta: archivia prima la versione precedente, per
intero e rileggibile, e fa avanzare il contatore di revisione.

### 9.2 Compilazione

1. **Checklist**: se era stata scelta in pianificazione si apre **diretta** su
   quella; altrimenti la sceglie ora, senza preselezione.
2. **Testata**: verifica e corregge i dati della seduta (per esempio la sede).
3. **Voce per voce**:
   - in cima l'**esito**: **Conforme**, **Non conforme**, **N.A.**;
   - sotto, dietro l'espansore **«Evidenze e azioni»**: **nota**, **foto**,
     **nota vocale**, **cosa da fare** (con l'indicazione di cosa fare) ed
     eventuale **scadenza**.
   - L'espansore è chiuso di default per tenere la lista scorrevole; sulle voci
     **Non conformi** si apre da solo, e da chiuso mostra un riepilogo.
4. Dentro la compilazione è disponibile anche il **riepilogo organigramma** del
   cliente — la stessa vista del back-office (§5), scritture comprese.
5. A fine giro si **conferma** con firma: l'esito viene registrato e, appena c'è
   rete, sincronizzato.

Al giro successivo il tecnico riparte dallo **stato aggiornato** delle cose da
fare del giro precedente.

---

## 10. Il giro completo

1. **Regole app** — una volta: catalogo, esoneri ammessi, alias corsi.
2. **Anagrafiche** — il cliente: dati, ATECO/rischio, emergenze, sedi (§2).
3. **Dati dentro** — persone e formazione, con l'ingresso giusto (§3).
4. **Organigramma** — nomine, attestati, esoneri; *Genera dai gap* (§5).
5. **Template/Capitoli** — una volta: le checklist di riferimento (§7.2).
6. **Incarichi** — l'incarico del cliente, e **Pianifica** le sedute (§7.3–7.4).
7. **Campo** — il tecnico apre la seduta, compila, conferma e firma, anche
   offline (§9).
8. **Esiti** — le cose da fare finiscono nello scadenzario e sono pronte per il
   cliente e per le risorse interne (§6).
9. **Giro successivo** — l'input è lo stato aggiornato del giro prima.

---

## 11. Limiti noti e trappole

- **Offline**: una seduta è apribile senza rete solo se è stata **scaricata**
  almeno una volta (prefetch).
- **Un cliente = un organigramma = una sede operativa.** Più stabilimenti sono
  più clienti (§2.4). La P.IVA duplicata è prevista.
- **Il "tipo di attività" dell'incarico non determina la checklist**: è solo
  un'etichetta. La checklist è quella della **seduta**.
- **Lo scadenzario globale non sincronizza**: dopo aver toccato un organigramma,
  passa prima dalla scheda del cliente.
- **Doppioni delle cose da fare**: se su un cliente era già stato premuto
  *Genera dai gap*, lo stesso gap può comparire due volte come SUBITO. Vanno
  guardate e decise a mano.
- **Grafie doppie a DB**: il dedup delle mansioni è case-insensitive, ma
  `SALDATORE` e `ADDETTO SALDATURA` restano due voci. Si accorpano a mano.
- **Import da visura camerale**: non esiste ancora (§3.6).
- **Dopo un azzeramento del database**: chiudere e riaprire la PWA su **ogni**
  dispositivo, back-office compreso. La cache locale (IndexedDB) tiene ancora i
  vecchi clienti e la coda può tentare di scrivere verso righe cancellate.

---

## 12. Novità — cos'è cambiato per chi usa l'app

Registro di ciò che si **vede**, dal più recente. Le motivazioni tecniche stanno
nella `Cronologia` di `PROGETTO.md`.

### 2026-08-24 — la guida diventa manutenibile
- Manuale riscritto sull'app di oggi (era fermo al 23/06, prima della
  navigazione a due livelli, di Risorse Umane e di tutti gli import).
- Nuovo §3, **i cinque ingressi dei dati**, che risponde a «come importo
  aziende e persone».
- Nuovo `npm run guida:check`: dice quali capitoli sono rimasti indietro
  rispetto al codice (§0 e §13).

### 2026-08 — persone, mansioni, cessazioni
- **Mansione e reparto** in stampatello automatico, con le voci già usate
  proposte in tendina (§4.1).
- **Data di cessazione**: fa uscire da sola dall'organigramma; data futura
  segnalata in rosso come probabile errore (§4.2).
- **Filtro In forza / Solo cessati / Tutti** in Risorse Umane, coi conteggi.
- **Numero di lavoratori** in anagrafica: decide le 4h o 8h di aggiornamento
  RLS; finché manca, lo scadenzario lo dichiara invece di indovinare (§2.1).
- **Organigramma a fisarmonica**, ricerca per persona, clic su una persona che
  apre la sua sola scheda, assegnazione dalla fisarmonica (§5.1).
- **Scadenzario**: la formazione mai svolta è **SUBITO** ed è la prima riga.

### 2026-07 — formazione, libretto, sedi
- **Libretto formativo per persona** + PDF (§4.3).
- **Import formazione** dal gestionale: abbinamento unità → cliente sulla sede
  operativa, formazione frazionata segnalata, persone create su richiesta
  (§3.4).
- **Alias corsi**: il dizionario dei nomi del gestionale (§8.3).
- **Sede operativa**: si chiede, non si deduce; la città della sede operativa
  compare in testata alla scheda (§2.4).
- **Evidenza incompleta**: l'attestato che documenta solo una parte del
  percorso apre una pendenza documentale, senza toccare la conformità.
- **Figura scoperta**: l'app dice **chi ha già il corso**, non solo che manca.

### 2026-06 e prima
- Navigazione del back-office a **due livelli** per gruppi (§1).
- **Scadenzario** separato da **Cose da fare** (§6).
- **ATECO → livello di rischio** dall'Allegato IV ASR 2025 (§2.2).
- **Risorse Umane** come anagrafica completa del personale, con import Excel
  (§4, §3.3).
- Revisioni versionate del sopralluogo e dell'organigramma.

---

## 13. Mappa capitolo → sorgenti

Tabella letta da `npm run guida:check` (`scripts/guida-check.mjs`). Prima
colonna: il capitolo. Seconda: i file o le cartelle che quel capitolo descrive,
separati da spazi. Aggiungendo una schermata, **aggiungi qui la sua riga**,
altrimenti quella parte di guida invecchia senza che nessuno lo veda.

<!-- MAPPA:inizio -->

| Capitolo | Sorgenti |
|---|---|
| §1 Accesso e struttura | `src/App.tsx` `src/admin/BackOffice.tsx` `src/Login.tsx` `src/AuthProvider.tsx` `src/ImpostaPassword.tsx` `src/CambiaPassword.tsx` |
| §2 Anagrafiche | `src/admin/Anagrafiche.tsx` `src/lib/admin/anagrafiche.ts` `src/lib/admin/sedi.ts` `src/formazione/ateco.ts` |
| §3 Import | `src/admin/ImportWerp.tsx` `src/admin/ImportFormazione.tsx` `src/admin/ImportCatalogo.tsx` `src/lib/admin/werpImport.ts` `src/lib/admin/formazioneImport.ts` `src/lib/admin/catalogoImport.ts` |
| §4 Risorse Umane | `src/formazione/RisorseUmane.tsx` `src/formazione/Libretto.tsx` `src/lib/admin/libretto.ts` `src/formazione/codiceFiscale.ts` |
| §5 Organigramma | `src/formazione/OrganigrammaView.tsx` `src/formazione/Formazione.tsx` `src/lib/admin/formazione.ts` `src/formazione/organigramma-revisioni.ts` `src/formazione/FormazioneRiepilogo.tsx` |
| §6 Scadenzario e Cose da fare | `src/admin/Scadenzario.tsx` `src/admin/CoseDaFare.tsx` `src/lib/admin/scadenzario.ts` `src/lib/admin/cosedafare.ts` |
| §7 Pianificazione | `src/admin/Pianificazione.tsx` `src/admin/EditorIncarico.tsx` `src/admin/Disponibilita.tsx` `src/admin/Tecnici.tsx` `src/admin/Aree.tsx` `src/admin/TemplateList.tsx` `src/admin/TemplateEditor.tsx` `src/admin/CapitoliList.tsx` `src/admin/CapitoloEditor.tsx` `src/admin/ComponiTemplate.tsx` |
| §8 Regole app | `src/admin/AliasCorsi.tsx` `src/lib/admin/aliasCorsi.ts` `src/admin/ImportCatalogo.tsx` |
| §9 App da campo | `src/MieiSopralluoghi.tsx` `src/Compilazione.tsx` `src/MieCoseDaFare.tsx` `src/BoxGenerico.tsx` `src/vociRender.tsx` `src/NotaVocale.tsx` `src/BottoneInviaCliente.tsx` `src/lib/compilazione.ts` `src/lib/sync.ts` `src/lib/prefetch.ts` `src/lib/report.ts` `src/lib/revisioni.ts` `src/main.tsx` |

<!-- MAPPA:fine -->
