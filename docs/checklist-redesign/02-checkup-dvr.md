# Bozza checklist · Check-up iniziale (DVR/Consulenza sicurezza)

> **Scopo del documento.** Ridisegnare i *contenuti* della checklist #2
> (`Sopralluogo DVR/Consulenza sicurezza`, seed `004`) per la **modalità di
> rilievo unica** introdotta con le Fasi A–C. È materiale da **ribattere
> nell'editor template del back-office**: non è codice, non è una migration.
> La struttura (sezioni, voci, tipi, opzioni, sotto-domande) è una proposta;
> i contenuti di dominio sicurezza sono da confermare/correggere da te.
>
> `tipo_attivita` (aggancio con l'incarico): **`DVR/Consulenza sicurezza`**

---

## Come leggere questa bozza

Ogni voce è una riga:

> **Testo della voce** · `tipo` — *eventuale hint (campo «descrizione»)*

Le **sotto-domande** (figlie condizionate) sono indentate sotto la voce padre,
introdotte da `se «opzione»` (compaiono in campo solo se il tecnico ha scelto
quell'opzione sul padre).

Tipi disponibili nell'editor: `verifica` *(vedi nota A)* · `scelta` ·
`multiscelta` · `testo` · `data` · `numero` · `slider` · `foto` · `rilievo`.

---

## Regole di ridisegno applicate (modalità unica)

Dopo le Fasi A–C, **ogni** voce — a prescindere dal tipo — espone sempre, in
coda alla card: **evidenze** (nota testuale + dettatura vocale + foto),
**cose da fare** (con destinatario cliente/interno, scadenza, priorità),
**scadenza ricorrente** ed **esito esplicito** (Conforme / Non conforme / N.A.).
Di conseguenza il template non deve più codificare nulla di tutto ciò. Regole:

- **R1 · Niente opzioni-verdetto.** Le voci che prima erano una `scelta` con
  opzioni di sola conformità (`Presente/Non Presente/NA`,
  `Visto/Da avere/Non soggetto`, `Presente/Da valutare/Non soggetto`,
  `SI/NO/NA` usato come giudizio) diventano voci di **pura verifica**: nessuna
  opzione. Il giudizio lo dà l'**esito** — *Conforme* = presente/a norma,
  *Non conforme* = assente o da sistemare, *N.A.* = non applicabile.
- **R2 · «Documento X → ultima revisione» collassa in una voce `data`.** Dove
  prima c'era «\[Presente/Non presente] → se Presente, Data ultima revisione»,
  ora c'è **una sola** voce `data` («Data ultima revisione/emissione»): la data
  è l'input, l'esito cattura presenza/conformità, la foto del documento va nelle
  evidenze. Meno tap, stessa informazione.
- **R3 · `scelta`/`multiscelta` solo come *gate* o dato realmente descrittivo.**
  Si tengono le opzioni quando piloteranno sotto-domande condizionate
  (es. RSPP interno/esterno/datore; «Produce rifiuti? SI/NO») o quando serve una
  multiscelta vera (attività antincendio, tipologia rifiuti). Qui l'opzione è una
  risposta, **non** un verdetto: l'esito resta libero.
- **R4 · Scadenze ricorrenti = solo un *default* di periodicità.** Niente più
  flag «abilita scadenza». La scadenza è proponibile ovunque; imposto un
  *default mesi* solo dove c'è una cadenza tipica (terra, carrelli, riunione
  periodica, prova evacuazione…). Il tecnico può sempre cambiarla o non crearla.
- **R5 · Niente automatismi di azione.** Via `genera_azione`/auto-seed dalle
  opzioni. Le cose da fare sono un gesto manuale (l'app già propone una bozza
  vuota quando si marca *Non conforme*). Gli *hint normativi su scadenze*
  (es. termini RENTRI) restano nel testo «descrizione» della voce.

> **Nota A — il tipo `verifica`.** Le voci R1 sono concettualmente «verifica e
> basta»: testo + evidenze + esito, nessun input strutturato. Oggi nel modello
> **non** esiste un tipo dedicato; lo si ottiene con una `scelta` **senza
> opzioni** (il corpo resta vuoto, la card mostra solo testo → evidenze →
> esito). Funziona, ma è un piccolo trucco. **Decisione da prendere** (è codice,
> non contenuto): introdurre un `tipo = 'verifica'` esplicito, oppure accettare
> la convenzione «scelta vuota». In questa bozza scrivo `verifica` per chiarezza;
> finché non esiste, nell'editor lo si crea come `scelta` lasciando vuoto
> l'elenco opzioni.

---

## Sezioni

`Organigramma · Formazione · Conformità societaria/aziendale · Luoghi di lavoro ·
Impianti · DVR e rischi specifici · DPI · Procedure speciali · Medicina e
sorveglianza sanitaria · Antincendio · Attrezzature e manutenzioni periodiche ·
Cartellonistica · Gestione rifiuti · Emissioni in atmosfera · Attività periodiche
· Sopralluogo ambienti di lavoro`

---

### Organigramma

- **Datore di lavoro** · `testo` — *Ragione/Cognome Nome del datore di lavoro.*
- **RSPP — Responsabile del Servizio di Prevenzione e Protezione** · `scelta`
  → opzioni: `RSPP esterno` · `RSPP interno` · `Datore di lavoro (RSPP)`
  - se *RSPP esterno* → **Cognome/Nome + data nomina** · `testo`
  - se *RSPP interno* → **Cognome/Nome + data nomina** · `testo`
  - se *Datore di lavoro* → **Cognome/Nome + data nomina + formazione eseguita il** · `testo`
- **RLS / RLS-T** · `scelta`
  → opzioni: `RLS (interno)` · `RLS-T (esterno)` · `Non nominato`
  - se *RLS (interno)* → **Cognome/Nome + data nomina + formazione eseguita il** · `testo`
  - se *RLS-T (esterno)* → **Cognome/Nome + data nomina** · `testo`
- **Medico Competente** · `scelta`
  → opzioni: `Nominato` · `Non nominato`
  - se *Nominato* → **Cognome/Nome + data nomina** · `testo`
- **Dirigenti** · `scelta` → opzioni: `Presenti` · `Assenti`
  - se *Presenti* → **Cognome/Nome + data nomina + formazione eseguita il** · `testo`
- **Preposti** · `scelta` → opzioni: `Presenti` · `Assenti`
  - se *Presenti* → **Cognome/Nome + data nomina + formazione eseguita il** · `testo`

> *Nota.* Qui le `scelta` restano (R3): pilotano i dati anagrafici condizionati.
> «Dirigenti»/«Preposti» mantengono una scelta binaria presente/assente perché
> deve aprire il blocco dati; l'esito Conforme/NC esprime poi l'adeguatezza
> (es. formazione mancante).

### Formazione

- **Formazione svolta dal personale** · `testo` — *Cognome/Nome, tipologia corso, data corso.*
- **Iscritto a un Fondo Interprofessionale?** · `scelta` → opzioni: `Sì` · `No`
  - se *Sì* → **Quale fondo?** · `testo`

### Conformità societaria/aziendale

- **Deleghe di «gestione» del Titolare Effettivo** · `verifica` — *Presenza ed estremi delle eventuali deleghe.*
- **Visura camerale** · `verifica`
- **Attribuzione incarichi a dirigenti/preposti** · `verifica`
- **Descrizione del ciclo produttivo e delle attività svolte** · `testo`
- **Numero addetti totali, divisi per tipologia contrattuale** · `testo` — *Se conosciuta.*

### Luoghi di lavoro

- **Planimetrie aggiornate (sede operativa)** · `verifica`
- **Certificato/licenza d'uso o agibilità (sede)** · `verifica`
- **Nulla osta inizio attività / DIAP / autorizzazione o accreditamento regionale** · `verifica`

### Impianti

- **Impianto elettrico — dichiarazione di conformità** · `verifica`
- **Messa a terra — denuncia di messa in servizio a INAIL/ARPAV** · `verifica` — *Annotare data di presentazione e/o numero e data di protocollo.*
- **Messa a terra — verifica periodica di funzionalità** · `data` — *Ditta e registrazioni. Cadenza 2/5 anni.* · **scadenza default: 24 mesi**
- **Messa a terra — comunicazione al portale CIVA/INAIL** · `verifica`
- **Protezione scariche atmosferiche — denuncia INAIL/ARPAV (o autoprotezione)** · `verifica`
- **Ascensori/montacarichi — licenza di esercizio comunale** · `verifica`
- **Ascensori/montacarichi — verifiche periodiche** · `data` — *Ditta e registrazioni.* · **scadenza default: 24 mesi**
- **Apparecchi in pressione — presenza e caratteristiche tecniche** · `testo`
- **Apparecchi in pressione — verifiche periodiche** · `data` — *Ditta e registrazioni.* · **scadenza default: 24 mesi**
- **Impianti di riscaldamento — presenza** · `testo` — *Potenzialità ed eventuale denuncia I.S.P.E.S.L.*
- **Rischio esplosione — relazione di classificazione ATEX** · `verifica`
- **Rischio esplosione — messa in servizio impianti elettrici in luoghi ATEX (con verifiche)** · `verifica`

> *Nota R2.* «Verifica periodica terra/ascensori/pressione» le ho rese `data`
> (ultima verifica eseguita) con default di scadenza ricorrente; l'esito segnala
> se scaduta/mancante.

### DVR e rischi specifici

- **Documento di Valutazione dei Rischi (DVR) — ultima revisione** · `data`
- **DVR — rischio chimico** · `verifica`
  - **Sono presenti le SDS più aggiornate dei prodotti utilizzati? — ultima revisione** · `data`
- **Campionamento sostanze aerodisperse (rischio chimico) — ultimo campionamento** · `data`
- **DVR — cancerogeno/mutageno (amianto, silice, legno…) — ultima revisione** · `data`
  - **Registro degli esposti** · `verifica`
- **DVR — biologico — ultima revisione** · `data`
- **DVR — rumore — ultima revisione** · `data`
- **DVR — vibrazioni — ultima revisione** · `data`
- **DVR — movimentazione manuale dei carichi — ultima revisione** · `data`
- **DVR — sovraccarico biomeccanico arti superiori — ultima revisione** · `data`
- **DVR — posture incongrue — ultima revisione** · `data`
- **DVR — microclima/macroclima — ultima revisione** · `data`
- **DVR — incendio — ultima revisione** · `data`
- **DVR — stress lavoro-correlato — ultima revisione** · `data`
- **DVR — radiazioni ottiche artificiali (ROA) — ultima revisione** · `data`
- **DVR — campi elettromagnetici (CEM) — ultima revisione** · `data`
- **DVR — radon (per locali sotterranei)** · `scelta` → opzioni: `Valutato` · `Da valutare`
  - se *Valutato* → **Tre pareti interamente sotto il piano di campagna?** · `scelta` → `Sì` · `No`
  - se *Valutato* → **≈10 ore/mese di permanenza del personale nella zona?** · `scelta` → `Sì` · `No`
- **DVR — atmosfere esplosive — ultima revisione** · `data`
- **DVR — videoterminali (> 20 ore/sett.) — ultima revisione** · `data`

> *Nota R2/R3.* Quasi tutti i «DVR — rischio X» diventano `data` (ultima
> revisione). Il **radon** resta `scelta` perché il suo «Valutato» apre le due
> domande di assoggettabilità (gate, R3). Chimico/cancerogeno mantengono una
> sotto-voce (SDS / registro esposti) perché è un controllo distinto.

### DPI — Dispositivi di protezione individuale

- **Valutazione di idoneità dei DPI (inclusa nel DVR)** · `verifica`
- **Verbali di consegna DPI ai lavoratori (almeno annuale)** · `verifica` · **scadenza default: 12 mesi**
- **Dichiarazione di conformità / certificazione DPI (II e III categoria)** · `verifica`
- **Istruzioni del DPI in lingua italiana** · `verifica`

### Procedure speciali

- **Procedura per minorenni — presenza e gestione** · `verifica`
- **Soggetti esterni alla struttura (fornitori, alternanza, volontari…) — presenza e gestione** · `verifica`
- **Procedura farmaci salvavita — presenza e gestione** · `verifica`
- **Donne lavoratrici gestanti/puerpere — procedura (data di riferimento)** · `data`

### Medicina e sorveglianza sanitaria

- **La valutazione dei rischi ha definito la necessità di attivare la sorveglianza sanitaria?** · `scelta` → opzioni: `Sì` · `No`
  - se *Sì* → **Protocollo sanitario** · `verifica`
  - se *Sì* → **Idoneità specifiche alla mansione** · `verifica`
  - se *Sì* → **Visita periodica del MC agli ambienti di lavoro (annuale)** · `verifica` · **scadenza default: 12 mesi**
  - se *Sì* → **Registro lavoratori esposti ad agenti cancerogeni** · `verifica`

### Antincendio

- **Attività principale ex Allegato III del DM 7/8/2012** · `multiscelta`
  — *Selezionare le attività soggette applicabili.*
  → opzioni: `1.1C — Gas infiammabili/comburenti in ciclo > 25 Nm³/h` ·
  `2.1B — Cabine decompressione gas naturale ≤ 2,4 MPa` ·
  `2.2C — Compressione/decompressione gas > 50 Nm³/h` ·
  `3.1B — Rivendite gas compressi ≥ 0,75 mc` ·
  `3.2B — Depositi ≤ 10 mc gas compressi ≥ 0,75 mc` ·
  `3.3C — Depositi > 10 mc gas compressi ≥ 0,75 mc` ·
  `3.4C — Impianti riempimento gas compressi ≥ 0,75 mc` ·
  `3.5A — Depositi GPL ≤ 300 kg` ·
  `3.6B — Rivendite GPL ≥ 75 kg` ·
  `3.7B — Depositi GPL 300–1.000 kg` · `Altro`
- **Lavoratori totali presenti (n.)** · `numero` — *Più di 10?*
- **Luogo aperto al pubblico con > 50 persone contemporanee?** · `scelta` → opzioni: `Sì` · `No`
- **Piano di emergenza ed evacuazione (PEE)** · `verifica`
- **Planimetrie di emergenza esposte (estintori, uscite, primo soccorso…)** · `verifica`
- **Estintori, idranti, porte** · `verifica` — *Annotare ditta e disponibilità delle registrazioni degli interventi.*
- **Sistemi di protezione antincendio** · `verifica` — *Annotare ditta e registrazioni degli interventi.*

### Attrezzature, macchinari e manutenzioni periodiche

- **Elenco macchine e attrezzature di lavoro** · `verifica`
- **Libretti uso e manutenzione macchine e attrezzature** · `verifica`
- **Dichiarazioni di conformità CE** · `verifica`
  - **Luogo di archiviazione** · `testo`
  - **Foto documento (copertina)** · `foto`
- **Registro controllo macchine/attrezzature (ove previsto)** · `verifica` — *Conservare i risultati di almeno gli ultimi 3 anni a disposizione degli organi di vigilanza.*
- **Carrelli elevatori — verifica periodica di funzionalità** · `data` — *Ditta e registrazioni.* · **scadenza default: 12 mesi**
- **Apparecchi di sollevamento > 200 kg — dichiarazione di conformità e libretto uso/manutenzione** · `verifica`
- **Apparecchi di sollevamento > 200 kg — ispezioni periodiche (ASL/Organismo Notificato) e manutenzione** · `data` — *Ditta e registrazioni.* · **scadenza default: 12 mesi**

> *Nota.* I 4 sotto-campi liberi del vecchio «libretti» (motivazione, azione
> correttiva, data, priorità) erano un mini-modulo «cosa da fare»: oggi
> ridondante con il blocco *cose da fare* universale. Rimossi (R5).

### Cartellonistica di salute e sicurezza

- **Cartellonistica di salute e sicurezza** · `verifica`
  - **È da integrare? Dove?** · `testo` — *(compila se non conforme)*
- **Scaffalature — verifica secondo UNI EN 15635 / UNI 11636 — ultima verifica** · `data`

> *Nota.* «È da integrare?» non è più gated su un'opzione (R1 toglie le opzioni):
> la lascio come sotto-campo `testo` sempre visibile, da compilare quando l'esito
> è Non conforme. In alternativa l'informazione può stare nella nota-evidenza.

### Gestione rifiuti

- **L'azienda produce rifiuti?** · `scelta` → opzioni: `Sì` · `No`
  - se *Sì* → **Tipologia di rifiuti prodotti** · `multiscelta` → `Pericolosi` · `Non pericolosi`
  - se *Sì* → **Iscrizione al RENTRI effettuata?** · `scelta` → `Sì` · `No`
    — *Termini iscrizione RENTRI per n. dipendenti: < 11 entro 13/02/2026;
    11–50 entro 13/08/2025; > 50 entro 13/02/2025. Se «No», aprire una cosa da
    fare con la scadenza applicabile.*

### Emissioni in atmosfera

- **Ci sono camini/sbocchi verso l'esterno collegati a impianti produttivi?** · `scelta` → opzioni: `Sì` · `No`
  - se *Sì* → **Sono stati autorizzati/comunicati alla Provincia competente?** · `scelta` → `Sì` · `No`

### Attività periodiche

- **Verbale della riunione periodica (art. 35 D.Lgs. 81/08; annuale)** · `data` · **scadenza default: 12 mesi**
- **Prova di evacuazione annuale (se > 10 dip. o soggetto a SCIA/VVF) — ultima prova** · `data` · **scadenza default: 12 mesi**

### Sopralluogo ambienti di lavoro

- **Segnalazioni del consulente** · `rilievo` — *ripetibile* · etichetta bottone: «Aggiungi segnalazione»
  — *Aggiungi una segnalazione per ogni aspetto rilevato negli ambienti. Ogni
  segnalazione può diventare una cosa da fare e/o una scadenza.*

---

## Punti aperti da decidere con te

1. **Tipo `verifica`** (Nota A): introdurlo davvero come tipo, o tenere la
   convenzione «scelta senza opzioni»? È l'unica cosa che tocca codice.
2. **Collasso R2** (documenti → voce `data`): ti torna come ergonomia in campo,
   o preferisci tenere «presente/non presente» + data separata?
3. **Default di periodicità** proposti (terra 24, carrelli/sollevamento/riunione/
   evacuazione 12…): confermi i valori o li tariamo?
4. **«È da integrare?» cartellonistica**: sotto-campo `testo` sempre visibile,
   oppure lo deleghiamo alla nota-evidenza?
5. Voci di dominio da **aggiungere/togliere/riformulare**: questo è il livello
   dove serve il tuo occhio da consulente.
