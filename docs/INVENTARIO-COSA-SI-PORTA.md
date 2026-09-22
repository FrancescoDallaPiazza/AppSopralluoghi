# Inventario: cosa si porta come codice

Scritto il 22 settembre 2026, su assegnazione di AppOverall (`docs/PROGRAMMA.md`,
sezione 8, voce del 21 settembre: *«completare VERDEPOSITIVO SRL; poi lo stesso
inventario sul campo, con dentro cosa si porta come codice»*).

## Perché questo documento non è un elenco di perdite

Due fatti di Francesco cambiano la domanda, e vanno scritti prima dei numeri.

**Il primo** è la risposta alla DOMANDA 1 di `cosa-non-puo-mancare.md`:

> «Si fanno su carta e si può continuare a farli su carta se necessario dal
> 1.1.27. AppSopralluoghi non è mai stata utilizzata.»

Quindi per il campo il passaggio al nuovo **non è una migrazione: è una
partenza**. Non c'è uno storico da salvare — il database di produzione al 10
settembre ha zero sopralluoghi, zero foto, zero report — e la carta è un ripiego
**dichiarato accettabile** anche oltre il 1 gennaio. Nessuna riga di questo
documento è quindi urgente per il motivo per cui di solito un inventario è
urgente.

**Il secondo** è il mandato del 21 settembre: dal 1 gennaio 2027 si lavora solo
nel nuovo ecosistema, e **anche questa app si archivia quel giorno**.

Da cui la conseguenza che regge tutto il resto: le **27.512 righe** di `src/` non
sono un'app da sostituire, sono un **magazzino di pezzi già scritti**. La domanda
non è «cosa perdiamo», è «cosa si porta come codice».

## Il metro, e perché è questo

Il criterio è quello dell'assegnazione: **la logica su dati senza interfaccia
viaggia; quello che è intrecciato con le schermate o con Dexie si riscrive.**

Il metro è meccanico e ripetibile, non un giudizio:

- un file che importa React (`from 'react'`, `useState`, `useEffect`) **si
  riscrive**: la sua forma è la schermata, e la schermata di AppOverall sarà
  un'altra;
- un file che importa Dexie o `lib/db` **si riscrive**: la coda offline è un
  modello di dati, non una libreria, e chi la tocca ne ha la forma addosso;
- tutto il resto **viaggia**, con una distinzione fra chi non dipende da niente
  e chi parla con Supabase.

Misurato con `wc -l` su tutti gli 86 file `.ts`/`.tsx` di `src/`, il
22 settembre 2026, su `main`:

| categoria | righe | che vuol dire |
|---|---|---|
| **A · pura** — né React, né Dexie, né Supabase | **1.991** | si copia e compila. Zero lavoro |
| **B · logica su dati, nessuna UI, parla con Supabase** | **8.252** | la logica viaggia, le query si ripuntano sullo schema nuovo |
| **C · React o Dexie** | **17.269** | si riscrive |
| | **27.512** | |

**Si portano 10.243 righe su 27.512 (37%). Se ne riscrivono 17.269 (63%).**

Ma 10.243 è il lordo. Di quelle, **1.787 non vanno portate** perché AppOverall le
ha già — quasi sempre in SQL — e portarle sarebbe un secondo modo di dire la
stessa cosa. Il netto è **8.456**, ed è dimostrato al punto (a) in fondo.

E c'è un blocco **fuori** dalle 27.512 che nessuno ha contato finora, perché non
sta in `src/`: le **sei Edge Functions**, **1.983 righe** in
`supabase/functions/`. Sono Deno lato server, senza UI e senza Dexie: sono la
categoria A e B in purezza. Contandole, le righe che viaggiano diventano
**12.226**.

| Edge Function | righe |
|---|---|
| `genera-report/` (`index` 232 + `report-data` 309 + `report-html` 201) | 742 |
| `organigramma-pdf/index.ts` | 366 |
| `libretto-pdf/index.ts` | 274 |
| `invita-tecnico/index.ts` | 229 |
| `calendario-ics/index.ts` | 215 |
| `notifica-azione/index.ts` | 150 |
| `_shared/cors.ts` | 7 |
| | **1.983** |

## Pezzo per pezzo

### 1 · Il lettore Excel degli export — 2.966 righe di logica, e viaggia quasi intatto

| file | righe | tocca Supabase su |
|---|---|---|
| `src/lib/admin/anagraficheImport.ts` | 916 | **2 righe** |
| `src/lib/admin/formazioneImport.ts` | 745 | 6 righe |
| `src/lib/admin/nomineImport.ts` | 715 | 7 righe |
| `src/lib/admin/werpImport.ts` | 511 | 6 righe |
| `src/lib/admin/catalogoImport.ts` | 79 | 0 |
| **logica** | **2.966** | **21 righe in tutto** |
| le cinque schermate (`admin/Import*.tsx`) | 1.406 | — |

**Si porta com'è.** È il risultato più netto della misura: 2.966 righe di
lettura, normalizzazione, raggruppamento e riconciliazione toccano il database in
**21 righe**. Nessuna importa React. `leggiFoglio` apre l'xlsx con SheetJS
(`XLSX.read` su un `ArrayBuffer`), e da lì in giù è aritmetica su griglie.

Dipende da: `xlsx` (`^0.18.5`, già installata qui — **AppOverall non ce l'ha**:
nel suo `app/package.json` non c'è nessuna libreria per Excel, e i soli lettori
xlsx di là sono tre script Python `openpyxl` di migrazione one-shot, fuori
dall'app), più `formazione/ateco` e `formazione/codiceFiscale`.

E qui c'è una correzione a quello che sembrava: quelle due **non vanno portate**,
perché AppOverall le ha già in SQL (`ateco_classe` nella `0026`,
`codice_fiscale_valido()` nella `0016`). L'import va **ripuntato** su di loro, non
accompagnato dalle sue copie. Sono 521 + 164 righe che restano qui.

Lo blocca: **la chiave del cliente**. `anagraficheImport` deduplica su P.IVA e su
codice fiscale e usa la chiave `anag:<cliente>:<codice fiscale>`; se in AppOverall
i 619 clienti non attraversano il confine con gli stessi uuid, la riconciliazione
va rifatta sulla tabella di corrispondenza (è la decisione già aperta in
`STATO.md`, «Cosa dobbiamo all'altra corsia»).

Le 1.406 righe delle schermate si riscrivono: sono anteprima, tendine di
abbinamento e barre di avanzamento.

### 2 · La coda offline (Dexie) e la quarantena — 1.005 righe, e si riscrivono tutte

| file | righe |
|---|---|
| `src/lib/db.ts` | 282 |
| `src/lib/sync.ts` | 529 |
| `src/Quarantena.tsx` | 194 |
| | **1.005** |

**Si riscrive.** Per definizione del metro: `db.ts` *è* Dexie — 28 tabelle, 7
versioni di schema — e `sync.ts` lo usa in 66 punti. Non c'è una logica
estraibile sotto: la coda *è* la forma dei dati locali.

Ma il pezzo da portare non è il codice, è **quello che questo codice ha imparato**,
e sta scritto nei suoi commenti:

- una sola operazione respinta in modo definitivo fermava il drenaggio **per
  sempre e in silenzio**, trascinandosi dietro gli esiti e le foto di un'intera
  giornata. La quarantena esiste per questo;
- *«Ritenta rimette l'operazione in coda com'era. Se la causa del rifiuto è
  ancora lato server, l'operazione torna qui identica: il bottone lo dice, perché
  un ritentativo che finge di riparare è peggio di nessun bottone.»*

Lo blocca — ed è un limite **scritto nel file**, non una scoperta di oggi: la
quarantena vive in IndexedDB, quindi **il back-office non la vede e non la
vedrà**. Chi la guarda è il tecnico, in campo, spesso senza rete.
`cosa-non-puo-mancare.md` lo ha già recepito: «FERMA in forma minima… non si
porta com'è».

C'è anche un debito mai pagato, aperto in `TODO.md`: **`updated_at` per riga**,
«altrimenti l'ultimo che sincronizza sovrascrive». Se la coda si riscrive, si
riscrive con quello dentro.

E una nota che vale come prova che «portare la lezione invece del codice»
funziona: la **prima migrazione di AppOverall**, la `0001`, cita alla riga 26 «il
drenaggio della coda offline» di questa app come precedente. Zero righe di codice
hanno attraversato il confine; l'insegnamento sì.

### 3 · Il compositore dei template — 1.331 righe di logica, e nessun documento di AppOverall lo nomina

| file | righe |
|---|---|
| `src/lib/admin/composizione.ts` | 183 |
| `src/lib/admin/templates.ts` | 200 |
| `src/lib/admin/capitoli.ts` | 229 |
| `src/lib/box.ts` | 273 |
| `src/lib/compilazione.ts` | 446 |
| **logica** | **1.331** |
| `admin/TemplateEditor` 483 · `CapitoloEditor` 358 · `ComponiTemplate` 280 · `CapitoliList` 125 · `TemplateList` 107 | **1.353** |

**Misto, e va diviso in due.**

`composizione.ts`, `templates.ts` e `capitoli.ts` (612 righe) non hanno UI né
Dexie: **viaggiano**, ripuntando le query. Sono il modello «box-argomento» delle
migrazioni 029–035: un template si assembla dai capitoli invece che dalle voci
piatte, con i moduli speciali (ORGANIGRAMMA `smart`, PREGRESSE `fisso`) *proposti*
e non auto-iniettati.

`box.ts` (273) e `compilazione.ts` (446) **si riscrivono**: entrambi importano
Dexie perché il loro mestiere è mettere in cache il catalogo per il campo.

Lo blocca: **è il pezzo più isolato di tutti.** Su `origin/main` di AppOverall,
in tutto `docs/`, la parola «composizione» compare **zero volte**; «capitoli»
compare **una volta sola**, nella riga di `cosa-non-puo-mancare.md` che dice
«l'editor: PEGGIO — ripiego: si modificano in SQL». Quella riga tratta i template
come **dati** (e come dati migrano: 16 box), ma il **compositore** — la logica che
dei capitoli fa un template — non è nominato da nessuna parte.

### 4 · Il report al cliente — 871 righe, e le 742 che contano sono fuori da `src/`

| file | righe | dove |
|---|---|---|
| `supabase/functions/genera-report/index.ts` | 232 | Edge Function |
| `supabase/functions/genera-report/report-data.ts` | 309 | Edge Function |
| `supabase/functions/genera-report/report-html.ts` | 201 | Edge Function |
| `src/lib/report.ts` | 59 | client (sola chiamata) |
| `src/BottoneInviaCliente.tsx` | 70 | client |
| | **871** | |

**Si porta com'è, ed è il pezzo che il metro premia di più.** Il report non è mai
stato dentro l'app: gira lato server con service role. `report-html.ts` (201
righe) è una funzione pura da `ReportData` a stringa HTML — CSS inline, foto in
base64, stampabile A4 — **senza una sola dipendenza oltre i propri tipi**. Si
copia.

`report-data.ts` (309) assembla i dati: risolve le etichette delle risposte dalle
opzioni del template, costruisce l'albero esiti/sotto-domande, incorpora le foto e
calcola la **continuità col giro precedente** (azioni chiuse in questa visita +
ancora aperte dai sopralluoghi precedenti dello stesso incarico). Viaggia, con le
query ripuntate.

E la DOMANDA 2 di `cosa-non-puo-mancare.md` — «il report può uscire in HTML da
stampare per i primi mesi?» — ha risposta **«si»** da Francesco. Il che chiude il
cerchio: **quello che già esce è HTML.** Non c'è niente da costruire per
soddisfare quella risposta, c'è da copiare `report-html.ts`.

Lo blocca, ed è aperto in `TODO.md`: *«Il report non conosce i componenti»*
(`genera-report/report-data.ts`). Da verificare prima di dichiararlo portato.

### 5 · Le foto con geolocalizzazione — 8 righe di geo, e il resto è coda offline

La geolocalizzazione è `src/vociRender.tsx:37-45`, otto righe:

```ts
const posizione = (): Promise<{ lat: number; lng: number } | undefined> =>
  new Promise((res) => {
    if (!navigator.geolocation) return res(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(undefined),
      { enableHighAccuracy: true, timeout: 4000 },
    );
  });
```

`navigator.geolocation` e basta: API nativa del browser, nessuna libreria, e
degrada a `undefined` senza rompere niente. **Non si porta: si riscrive in otto
righe, o si ricopia. Non è un pezzo, è una chiamata.**

Quello che invece è un pezzo è `aggiungiFoto` (`src/lib/sync.ts:32-50`, 19
righe): ridimensiona, scrive il blob in Dexie, scrive la riga foto, accoda
l'upload. **Si riscrive** — è coda offline, categoria C — e il campo `geo_lat` /
`geo_lng` è già nello schema (`lib/types.ts`, `Foto`).

Va segnalato: **«geolocalizzazione» non compare in nessun documento di
AppOverall.** Le foto sì, 47 volte; la geolocalizzazione zero. È un dato che
oggi si scrive e che nessuno ha ancora chiesto di conservare.

### 6 · Il prefetch — 118 righe, e valgono per l'ordine non per il codice

`src/lib/prefetch.ts`, 118 righe. **Si riscrive**: importa Dexie e non fa altro
che orchestrare.

Ma 118 righe sono poche perché il valore sta in **cosa chiama e in che ordine**:
i template attivi, le azioni degli incarichi, l'organigramma, il catalogo box, le
sedi-componenti, le composizioni. È la lista di «cosa serve a un tecnico in
capannone senza rete», e quella lista è costata l'uso vero dell'app.
Si riscrive il codice, si copia la sequenza.

`cosa-non-puo-mancare.md` lo tiene **FERMA**: *«in capannone la rete non c'è: è il
motivo per cui l'app esiste»*.

### 7 · L'organigramma — 6.900 righe, il pezzo più grosso, e per un quarto viaggia

| file | righe | categoria |
|---|---|---|
| `src/lib/admin/formazione.ts` | **2.208** | **B — nessuna UI, nessuna Dexie** |
| `src/formazione/OrganigrammaView.tsx` | 2.198 | C |
| `src/formazione/Formazione.tsx` | 838 | C |
| `src/formazione/RisorseUmane.tsx` | 619 | C |
| `supabase/functions/organigramma-pdf/index.ts` | 366 | Edge, viaggia |
| `src/formazione/FormazioneRiepilogo.tsx` | 253 | C |
| `src/formazione/organigramma-revisioni.ts` | 240 | B |
| `src/lib/admin/ruoliTesto.ts` | 178 | **A — pura** |
| | **6.900** | |

**`formazione.ts` è la scoperta della misura.** È il file più grande del repo ed
è **categoria B**: non importa React e non importa Dexie (l'unica occorrenza di
«Dexie» è dentro un commento, riga 1232). 2.208 righe che toccano Supabase in 57
punti, e che il file stesso divide in sezioni dichiarate:

| sezione | righe | |
|---|---|---|
| TIPI | 1–288 | pure |
| COSTANTI / HELPER | 289–571 | pure |
| **MOTORE (puro)** | **572–1111** | **540 righe, e lo dice il file** |
| CARICAMENTO DATI | 1112–1431 | query |
| CRUD | 1432–2061 | scritture |
| GENERA COSE DA FARE | 2062–2208 | misto |

Il motore è quello che, «dati una persona, le sue nomine e i suoi attestati,
calcola per ogni requisito previsto lo stato (conforme / in_scadenza / critico /
esonerato), la scadenza, e i promemoria di possibile esonero». Con i crediti
automatici dell'Allegato III e la dedup per codice corso.

**Questo è il pezzo che AppOverall ha già in altra forma, ed è il primo dei due
avvertimenti dell'assegnazione**: lo scadenzario di AppOverall calcola le stesse
scadenze in SQL, e non in abbozzo — `v_obbligo_persona`, `v_scadenza_formazione`,
`v_scadenza_visita` e la tabella `scadenzario_preavviso` nella `0026`, il motore
v2 nella `0027`, `v_scadenzario` e `v_scadenzario_cliente` nella `0028`, il
taglio dell'arretrato nella `0034`. Portare `formazione.ts` intero significherebbe
avere **due motori che dicono la stessa cosa in due linguaggi**, e il giorno in
cui non dicessero la stessa cosa nessuno saprebbe quale ha ragione. Il rischio non
è teorico: è esattamente la forma del guaio dei «due orologi» già registrato in
`PROGRAMMA.md`.

Quindi: del motore **non si porta il codice, si porta il collaudo**. Le 540 righe
sono il miglior banco di prova che esista per verificare che le viste SQL di
AppOverall rispondano uguale — girate sugli stessi dati, devono dare lo stesso
stato per ogni persona. Portarle come *secondo motore* è un errore; usarle come
*controprova* è quasi gratis.

`ruoliTesto.ts` (178, categoria A pura) e `organigramma-revisioni.ts` (240)
viaggiano senza discussione.

Le 2.198 righe di `OrganigrammaView.tsx` si riscrivono — ed è il conto che la
DOMANDA 4 aveva messo in gioco. La risposta di Francesco è arrivata:

> «organigramma si compila in azienda dalle utenze autorizzate, in campo il
> tecnico verifica e se abbisogna di modifiche le mette nelle cose da fare»

Che è la risposta che **riduce** il lavoro: in campo serve la **vista**, non
l'editor. Le modifiche diventano cose da fare.

Due cose da sapere, dall'altra parte, prima di dare per fatto l'organigramma:

- **lo schema c'è già ed è completo**: `nomina` (`0001:308`), `v_organigramma`
  (`0001`, rivista in `0002`/`0010`/`0020`), `ruolo_sicurezza` con 36 codici e
  `ruolo_sicurezza_alias` (`0002`), `posizione_persona` (`0010`),
  `v_ruolo_da_confermare` (`0027`);
- **ma non si scrive**: su `nomina` c'è solo `grant select`. Manca il grant di
  scrittura, e manca qualsiasi pagina di organigramma in `app/src/`. È il buco
  che `cosa-non-puo-mancare.md` già segna. Quindi qui non c'è codice da portare —
  c'è un grant da dare e una schermata da fare.

### 8 · La pianificazione — 1.828 righe, e la metà viaggia

| file | righe | categoria |
|---|---|---|
| `src/admin/Pianificazione.tsx` | 541 | C |
| `src/lib/admin/pianificazione.ts` | 232 | B |
| `src/admin/Disponibilita.tsx` | 219 | C |
| `supabase/functions/calendario-ics/index.ts` | 215 | Edge, viaggia |
| `src/admin/EditorIncarico.tsx` | 204 | C |
| `src/lib/admin/calendario.ts` | 196 | **A — pura** |
| `src/lib/admin/assistita.ts` | 119 | **A — pura** |
| `src/lib/admin/disponibilita.ts` | 102 | **A — pura** |
| | **1.828** | |

**Misto, ma con una sorpresa buona**: `calendario.ts`, `assistita.ts` e
`disponibilita.ts` — 417 righe — sono **categoria A pura**. Nessuna dipendenza,
niente. `assistita.ts` è la pianificazione assistita: distanza dalla base del
tecnico (`base_lat/lng`) al cliente (`lat/lng`), e da lì la proposta. È
aritmetica, e si copia.

`cosa-non-puo-mancare.md` chiede «FERMA in forma minima — incarico, tecnico,
data, sede». La forma minima **non ha bisogno** di `assistita.ts` né del
calendario ICS: sono il giro dopo. Quindi qui la cosa lazy è portare le 232 righe
dello strato dati e lasciare le 417 pure dove sono, pronte, finché qualcuno le
chiede.

**Attenzione a un equivoco che il nome può creare.** AppOverall ha *una*
pianificazione, ma è quella dei **corsi**: `edizione`, `sessione`, `iscrizione`,
`presenza` nella `0036`, con `v_da_collocare` e `v_edizione_in_ritardo` nella
`0038`. Dei **sopralluoghi** non ha niente: nessuna tabella `incarico`, `seduta`,
`tecnico`, `area`, nessuna disponibilità. Le due pianificazioni si chiamano
uguale e non sono la stessa cosa — e «disponibilità» non compare mai in
`PROGRAMMA.md`.

### 9 · Quello che nessuno aveva contato: le altre cinque Edge Functions

`invita-tecnico` (229) è già dichiarato «si porta» in `cosa-non-puo-mancare.md`
(sezione E, creare gli utenti). `libretto-pdf` (274), `notifica-azione` (150) e
`calendario-ics` (215) no.

Sono 639 righe di codice server-side senza UI, che nessuna riga di AppOverall
nomina.

## Le due domande che valgono più dell'elenco

### (a) I pezzi che AppOverall ha già in altra forma — portarli sarebbe dirlo due volte

| pezzo | AppOverall ce l'ha come | conseguenza |
|---|---|---|
| **il motore delle scadenze** (`formazione.ts` 572–1111, 540 righe) | viste e funzioni SQL nelle sue migrazioni; `/scadenze` e `/cliente/:id` sono dichiarati **fatto** | **non portare.** Due motori, due verità. Usare le 540 righe come **controprova**, non come codice |
| **registrare un attestato o una visita** | `/registra`, col controllo ASR 2025 — **fatto** | non portare |
| **lo scadenzario** (`admin/Scadenzario.tsx` 380 + `scadenzario.ts` 203) | **fatto** | non portare le 583 righe |
| **anagrafe persone** | `persona` e `rapporto_lavoro` si scrivono già (`0033`) | portare solo l'**import**, non lo strato dati |
| **gli alias dei corsi** (`aliasCorsi.ts` 181) | `corso_alias` nella `0004:351-378`, con i **268 giudizi presi a mano** nel seed (`supabase/seed/`, 672 righe) | non portare le 181 righe |
| **ATECO** (`ateco.ts` 396 + `atecoDati.ts` 125) | `create table ateco_classe` nella `0026:33-45`: divisione a due cifre → sezione, classe basso/medio/alto, flag `dedotto`, fonte. Col seed completo | **non portare le 521 righe.** Il dubbio che avevo è sciolto: è già di là, e in SQL |
| **il codice fiscale** (`codiceFiscale.ts` 127 + `.check.ts` 37) | **due volte**: `codice_fiscale_valido()` nella `0016:49-71` (carattere di controllo e omocodia) e `app/src/estrai.ts:27-45` | **non portare le 164 righe — sono già passate.** La `0016` è dichiarata un port di `valido()` di questo repo |
| **il vocabolario dei ruoli** (`ruoliTesto.ts` 178) | `ruolo_testo`, `ruolo_testo_parola`, `ruolo_da_parola` nella `0007`, più `ruolo_sicurezza` (36 codici) e `ruolo_sicurezza_alias` nella `0002` | non portare le 178 righe |
| **il livello di rischio** | `valutazione_sede` nella `0001:229-257`, con `motivazione` **obbligatoria**, `fonte`, `deciso_il`, `deciso_da`, `revocato_il` e l'indice «una viva per attributo» | non portare. È la stessa decisione dei commit del 16–22 settembre di questo repo, presa di là |

**Il conto di quello che viaggerebbe ma non deve**, contando solo i file di
categoria A e B (quelli C si riscrivono comunque):

| | righe |
|---|---|
| il motore (`formazione.ts` 572–1111) | 540 |
| ATECO (`ateco.ts` + `atecoDati.ts`) | 521 |
| scadenzario (`lib/admin/scadenzario.ts`) | 203 |
| codice fiscale (`codiceFiscale.ts` + `.check.ts`) | 164 |
| vocabolario ruoli (`ruoliTesto.ts`) | 178 |
| alias corsi (`lib/admin/aliasCorsi.ts`) | 181 |
| | **1.787** |

**Su 10.243 righe che potrebbero viaggiare, 1.787 non devono**: dall'altra parte
esistono già, e quasi sempre **in SQL**. Il codice da portare davvero scende a
**8.456**.

E c'è una prova che il meccanismo funziona: il codice fiscale **ha già
attraversato il confine**. La `0016` di AppOverall è il port di `valido()` di
questo repo, riscritto in PL/pgSQL. Non è una duplicazione da evitare: è il
modello di come si fa.

### (b) I pezzi che nessun documento di AppOverall nomina — questi si perdono davvero

Misurato con `git grep -i` su tutti i `.md` di `origin/main` di AppOverall, il 22
settembre 2026. Va distinto **ciò che è nominato ma non scritto** (rischio noto:
qualcuno sa che manca) da **ciò che non è nominato affatto** (rischio muto).

**Nominati ma non scritti** — non li elenco qui perché il rischio è già
governato: coda offline, quarantena, template, report al cliente, foto, prefetch,
pianificazione sopralluoghi, cose da fare, import Excel in app, import WERP,
invito utenti. Stanno tutti in `cosa-non-puo-mancare.md` e in `processi.md`.

**Non nominati da nessuna parte**, e questo è l'elenco che conta:

| pezzo | ricorrenze in tutti i documenti di AppOverall | righe qui |
|---|---|---|
| **il compositore dei template** («composizione») | **0**; «capitoli» 1 sola volta, solo per dire che l'editor è PEGGIO — e **0 volte in `PROGRAMMA.md`** | **1.331** di logica + 1.353 di editor |
| **EXIF** | **0 assolute** — codice, SQL, documenti | — |
| **coordinate / GPS / latitudine / longitudine** | **0 pertinenti** (gli unici riscontri sono «coordinatore», il ruolo CSP/CSE) | 8 |
| la **geolocalizzazione** delle foto | **1**, e mai spiegata: non c'è una riga su come la coordinata arrivi né se la si voglia | 8 |
| `libretto-pdf`, `notifica-azione`, `calendario-ics` | 0 | 639 |
| **dove finiranno i file** (bucket/Storage di AppOverall) | nominati **solo come cosa di AppSopralluoghi**: di là non è deciso da nessuna parte, pur essendo l'app che oggi legge PDF e foto degli attestati e **non li conserva** | — |
| la disponibilità dei tecnici | 5 in tutto, **0 in `PROGRAMMA.md`** | 321 |
| la nota vocale | 1 — già classificata PEGGIO, ripiego accettato | 157 |

**Il pezzo più grosso che AppOverall non ha e non nomina è il compositore dei
template: 1.331 righe di logica (`composizione.ts` 183, `templates.ts` 200,
`capitoli.ts` 229, `box.ts` 273, `compilazione.ts` 446), più 1.353 righe di
editor.** Il modello «box-argomento» delle migrazioni 029–035 — un sopralluogo
che si assembla da capitoli riusabili invece che da una lista piatta di voci — è
la cosa più specifica che questo repo abbia costruito. Nelle 39 migrazioni di
AppOverall non esiste nessuna tabella `template`, `capitolo` o `voce`; nei suoi
7.015 righe di `PROGRAMMA.md` la parola «capitoli» non compare mai.

Va detto con onestà: **non è urgente.** I sopralluoghi si fanno su carta e
possono continuare. Ma è l'unico pezzo per cui «si perde» vuol dire davvero si
perde, perché nessuno sa che c'è.

**E c'è un secondo buco, più piccolo ma più insidioso**, che non riguarda il
codice di qui: AppOverall legge oggi PDF e foto degli attestati
(`pdfjs-dist` + `tesseract.js`, `app/src/lettura.ts`) e **non li conserva**. Dove
vadano a finire i file non è deciso in nessun documento. Non è una riga di questo
inventario — è una riga che questo inventario ha trovato guardando dall'altra
parte.

## VERDEPOSITIVO SRL: fermato, e perché

L'assegnazione dice «completare VERDEPOSITIVO SRL». `PROGRAMMA.md:3554` dice cosa
vuol dire:

> **AppSopralluoghi** | completare VERDEPOSITIVO SRL: nato con ragione sociale e
> P.IVA soltanto — **indirizzo, ATECO, livelli**

VERDEPOSITIVO SRL **non esiste in questo repo**: non nel codice, non nei
documenti, non nella storia git. Cercato con `git grep -i` su tutto il repo e su
tutti i commit. È una riga creata il 17 settembre da uno script di AppOverall
nel **database di produzione**.

Completarla vuol dire **scrivere tre campi su un cliente vero**. Non è una cosa
che si fa leggendo e scrivendo documenti.

**Quindi è fermata qui, e non è stata fatta.** Il piano Supabase è free: nessun
backup automatico, e ogni scrittura sbagliata è definitiva davvero. Un permesso
su dati veri non si accetta di seconda mano: lo autorizza Francesco
direttamente.

Due cose da sapere prima di autorizzarla, e sono già misurate:

- **l'ATECO si propone da solo**, non si inventa: `formazione/ateco.ts` risolve
  il codice sulla tabella Allegato IV ASR 2025, e la riga porta `fonte` e
  `dedotto` come **due campi distinti** — «se in ispezione la risposta è 'l'ha
  messo il programma', la decisione non ha retto» (`STATO.md`);
- **i livelli antincendio e primo soccorso nessun file può darli.** È scritto in
  `TODO.md`: restano da compilare a mano, e l'import li elenca riga per riga come
  mancanti. Quindi per VERDEPOSITIVO servono a Francesco tre informazioni che
  solo lui ha: indirizzo della sede legale, e i due livelli.

## Il conto

| | righe |
|---|---|
| `src/` in 86 file | **27.512** |
| di cui **si portano** (A 1.991 + B 8.252) | **10.243** — il 37% |
| di cui **si riscrivono** (React o Dexie) | **17.269** — il 63% |
| **meno** quello che AppOverall ha già, quasi sempre in SQL | **−1.787** |
| **da portare davvero, da `src/`** | **8.456** — il 31% |
| Edge Functions, **fuori** dalle 27.512, che viaggiano quasi intatte | **+1.983** |
| **totale netto che viaggia** | **10.439** |

E il numero che conta più degli altri: **2.966 righe di lettori Excel toccano il
database in 21 righe**, e AppOverall non ha nessuna libreria per leggere un
Excel. Se dal magazzino si porta via una cosa sola, è quella.

---

Misure fatte il 22 settembre 2026 con `wc -l` e `git grep` su `main` di questo
repo e su `origin/main` di AppOverall. Nessuna stima: dove non ho misurato, ho
scritto che non ho misurato.
