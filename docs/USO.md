# AppSopralluoghi — Manuale d'uso

Guida operativa passo passo. Descrive l'app come si usa oggi: il **back-office**
(dove prepari clienti, checklist, incarichi e pianifichi) e l'**app da campo**
(dove il tecnico compila il sopralluogo, anche senza rete).

> Come leggere questo manuale: i capitoli 1–7 sono il back-office, nell'ordine in
> cui conviene impostare le cose la prima volta. Il capitolo 8 è il sopralluogo sul
> campo. Il capitolo 9 è lo scadenzario. Il capitolo 10 riassume il giro completo.

---

## 1. Accesso e struttura

L'app ha due ambienti:

- **Back-office**: la preparazione e la regia (clienti, organigrammi, checklist,
  incarichi, pianificazione, scadenzario). È quello che vedi all'apertura.
- **App da campo**: ci si entra dal pulsante **App da campo** in alto a destra. È
  l'interfaccia che il tecnico usa durante il sopralluogo, pensata per il telefono e
  per funzionare **offline**.

In alto nel back-office trovi le schede, nell'ordine:
**Anagrafiche · Tecnici · Aree · Template · Capitoli · Incarichi · Disponibilità ·
Catalogo formazione · Cose da fare**.

Per uscire si usa **Esci** in alto a destra.

L'idea di fondo dell'organizzazione:

- **Anagrafiche** = *chi* è il cliente (dati, sedi, organigramma).
- **Incarichi** = *cosa* facciamo e *quando* (incarichi + pianificazione sedute).
- **Catalogo formazione** = il catalogo condiviso valido per tutti i clienti.
- le altre schede (Tecnici, Aree, Template, Capitoli, Disponibilità, Cose da fare)
  sono di supporto.

---

## 2. Anagrafiche — creare e gestire un cliente

### 2.1 Creare un cliente

1. Apri la scheda **Anagrafiche**.
2. Premi **+ Nuovo cliente**.
3. Compila la **Ragione sociale** (obbligatoria) e gli altri dati: referente,
   telefono, email, località, indirizzo, eventuali latitudine/longitudine e l'ID
   Werp (facoltativo).
4. Premi **Salva cliente**.

Da quel momento il cliente è in elenco. Riaprendolo trovi, sotto i dati, le sue
**Sedi**, il riepilogo **Incarichi** e la sezione **Formazione e organigramma**.

Per mettere fuori uso un cliente che non segui più usa **Disattiva** (resta in
archivio, non viene cancellato).

### 2.2 Sedi del cliente

Una società può avere più sedi. Quando pianifichi una seduta, questa **eredita** la
sede (e la potrai correggere in testata durante il sopralluogo). Se il cliente non ha
sedi registrate, vale l'indirizzo del cliente.

1. Nella scheda del cliente, sezione **Sedi**, premi **+ Aggiungi sede**.
2. Inserisci nome e dati della sede e salva.

### 2.3 Organigramma e formazione del cliente

È la fotografia dei ruoli di sicurezza del cliente e dello stato formativo delle
persone. Si trova **nella scheda del cliente**, sezione *Formazione e organigramma*.

1. **Imposta il livello di rischio** del cliente con il menù a tendina in alto a
   destra della sezione (basso / medio / alto). Serve a calcolare le ore della
   formazione specifica dei lavoratori: se non è impostato, alcune voci non si
   possono calcolare.
2. **Aggiungi le persone** con **+ Persona** (anagrafica del singolo).
3. In testa all'organigramma c'è una **barra di bottoni, uno per ogni figura**
   (RSPP, RLS, addetti antincendio, primo soccorso, preposti, ecc.), raggruppati per
   blocco e colorati per stato:
   - **verde** = figura coperta (c'è almeno un incaricato);
   - **rosso** = figura scoperta (obbligatoria e non assegnata);
   - il numero sul bottone indica quanti incaricati ha.
4. **Clicca un bottone-figura** per aprirne la **scheda** (il bottone mostra `+`/`−`).
   Nella scheda puoi:
   - **Assegnare / modificare** l'incaricato (scegli la persona; quando richiesto,
     indichi se la formazione è *pregressa* sì/no);
   - inserire la **data di nomina**;
   - per ogni requisito, **registrare l'attestato** (con allegato), oppure un
     **esonero/credito**, o segnalare *vedi allegato*;
   - vedere i moduli aggiuntivi e i promemoria.
   Puoi tenere aperte più schede insieme; il `−` (sul bottone o nell'intestazione
   della scheda) la richiude.
5. Le azioni in alto nella sezione:
   - **Genera cose da fare per i gap** → crea nello scadenzario le attività per
     colmare ciò che manca (puoi indirizzarle a un'area interna).
   - **Esporta PDF organigramma** → il riepilogo stampabile.
   - **Storico organigramma** → le revisioni nel tempo (ogni modifica genera in
     automatico uno snapshot versionato).

---

## 3. Tecnici

Nella scheda **Tecnici** inserisci chi esegue i sopralluoghi. Servono per assegnare
le sedute in pianificazione e per l'accesso all'app da campo.

1. **+ Nuovo tecnico**, inserisci i dati, salva.

---

## 4. Aree

Le **Aree** sono le risorse/funzioni interne a cui indirizzare le *cose da fare*
(es. ufficio tecnico, responsabile di reparto). Le usi quando generi attività
dall'organigramma o dal sopralluogo.

1. **+ Nuova area**, dai un nome, salva.

---

## 5. Capitoli e Template — costruire le checklist

La **checklist** che il tecnico compila sul campo si costruisce qui. Due schede
lavorano insieme:

- **Capitoli**: i blocchi riusabili (gruppi di voci). Costruisci una volta, riusi su
  più checklist.
- **Template**: la checklist completa, ottenuta mettendo insieme i capitoli/box.

Procedura tipica:

1. In **Capitoli** crea i blocchi che ti servono e le relative **voci** (ogni voce è
   un punto da verificare).
2. In **Template** crei la checklist, le dai un nome e **componi** la sua struttura
   richiamando i capitoli/box.
3. Rendi il template **attivo**: solo i template attivi sono selezionabili in
   pianificazione e in campo.

> I template sono versionati: la seduta congela la versione con cui è stata aperta,
> così le modifiche successive non alterano i sopralluoghi già svolti.

---

## 6. Catalogo formazione

La scheda **Catalogo formazione** contiene la parte **globale** (uguale per tutti i
clienti): l'editor degli **esoneri ammessi**, cioè titoli, abilitazioni e ruoli
equipollenti riconosciuti, che compaiono come **promemoria** durante la compilazione
dell'organigramma. Da qui li aggiungi, modifichi o togli.

---

## 7. Incarichi — creare l'incarico e pianificare le sedute

L'incarico è l'accordo di consulenza che genera i sopralluoghi. Vive nella scheda
**Incarichi**, che mostra anche la **panoramica di tutti gli incarichi attivi** con
il loro avanzamento.

### 7.1 Creare un incarico

1. Apri la scheda **Incarichi** e premi **+ Nuovo incarico**.
2. **Scegli il cliente** dall'elenco (deve già esistere in Anagrafiche).
3. Inserisci il **tipo di attività** (è solo un'etichetta descrittiva: **non**
   determina la checklist).
4. Definisci i sopralluoghi in uno dei due modi:
   - **Per cadenza** ("1 sopralluogo ogni N giorni/settimane/mesi"): il numero di
     sedute nel periodo viene calcolato in automatico e te ne mostra l'anteprima;
   - **Numero fisso** nel periodo.
5. Imposta **durata** della seduta, eventuale **sede** predefinita, **stato** e il
   **periodo** (inizio/fine).
6. Salva.

Sulla card di ogni incarico hai **Modifica**, il selettore di **Stato** e, se non ha
ancora sedute create, **Elimina**.

### 7.2 Pianificare le sedute

1. Sulla card dell'incarico premi **Pianifica**.
2. Genera le sedute mancanti, poi per ciascuna seduta imposta:
   - **Tecnico** assegnato;
   - **Data** pianificata (con possibilità di ricalibrare le date successive);
   - **Durata** e **Località**;
   - **Checklist** (facoltativa): qui scegli il template della singola seduta.
3. La scheda **Disponibilità** ti aiuta a distribuire il carico tra i tecnici senza
   sovraccaricare nessuno.

> Punto chiave: **la checklist si sceglie qui, per seduta**. Se la imposti, in campo
> la compilazione si apre direttamente su quella; se la lasci vuota, il tecnico la
> sceglie sul campo al momento.

---

## 8. App da campo — eseguire il sopralluogo

Si entra dal pulsante **App da campo**. È pensata per il telefono e funziona
**offline**: il tecnico può lavorare senza rete e i dati si sincronizzano quando la
connessione torna.

1. Il tecnico accede e vede l'elenco dei **suoi sopralluoghi**.
2. Apre la seduta del giorno.
3. **Checklist**: se era stata scelta in pianificazione, si apre **diretta** su
   quella; altrimenti la sceglie ora da un elenco (parte senza preselezione).
4. **Testata**: verifica/aggiusta i dati della seduta (es. la sede).
5. **Compilazione, voce per voce.** Per ogni voce:
   - in cima scegli l'**esito**: **Conforme**, **Non conforme** o **N.A.**;
   - sotto, dietro l'espansore **"Evidenze e azioni"**, inserisci ciò che serve:
     **nota**, **foto**, **cosa da fare** (con l'indicazione di cosa fare, da
     riportare poi al cliente o alla risorsa interna) ed eventuale **scadenza** se è
     un elemento da calendarizzare.
   - L'espansore è chiuso di default per tenere la lista scorrevole; sulle voci
     **Non conformi** si apre da solo, e mostra un riepilogo quando è chiuso.
6. A fine giro **confermi** il sopralluogo (con firma): l'esito viene registrato e,
   appena c'è rete, sincronizzato.

---

## 9. Cose da fare — lo scadenzario

La scheda **Cose da fare** raccoglie tutte le attività generate: dalle non
conformità dei sopralluoghi, dai gap dell'organigramma, e quelle con scadenza da
calendarizzare. Da qui le consulti, le aggiorni e ne segui lo stato nel tempo.

L'elenco delle cose da fare è **vivo**: si aggiorna tra un sopralluogo e l'altro, e
al sopralluogo successivo riparti con lo stato aggiornato del giro precedente.

---

## 10. Il giro completo (riassunto)

1. **Anagrafiche**: crei il cliente, le sue sedi e ne imposti l'organigramma/rischio.
2. **Template/Capitoli**: prepari (una volta) le checklist di riferimento.
3. **Incarichi**: crei l'incarico del cliente e **pianifichi** le sedute (tecnico,
   data, durata, checklist).
4. **Campo**: al giorno previsto il tecnico apre la seduta, compila la checklist
   (esito + evidenze e azioni), conferma e firma — anche offline.
5. **Esiti**: le **cose da fare** finiscono nello scadenzario e sono pronte per il
   cliente e per le risorse interne.
6. **Giro successivo**: alla seduta dopo, l'input è lo **stato aggiornato** delle cose
   da fare; stesso flusso.

---

## 11. Note utili

- **Offline**: l'app da campo lavora senza rete. Perché una seduta sia apribile
  offline serve che sia stata aperta almeno una volta online (prefetch dei dati).
- **Checklist e tipo attività**: il "tipo di attività" dell'incarico è solo
  un'etichetta. La checklist effettiva è quella scelta sulla seduta in pianificazione
  (o sul campo se non impostata).
- **Versioni**: una seduta congela la versione del template con cui è stata aperta.
- **Organigramma**: ogni modifica salva uno snapshot; lo "Storico" ti fa rivedere le
  revisioni e l'"Esporta PDF" ti dà il riepilogo stampabile.
