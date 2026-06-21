# Modello dati "Box-argomento" — schema CONSOLIDATO

> Stato: **decisioni D1A / D2 / D3 / D4 recepite.** Schema da approvare prima di
> generare le migration (canale 3). Prossima migration libera: 029.

## 0. Principio
Il box e' un livello di composizione SOPRA al motore voci esistente. Un solo
engine di compilazione (quello di `Compilazione.tsx`), nessun fork.

## 1. Si riusa (invariato)
`voce_template` (8 tipi, opzioni+stato, `genera_azione`, scadenza, `mostra_se`) ·
`checklist_compilata`+`esito_voce` · `azione` · `sopralluogo` · `incarico` ·
`cliente` · `area_interna` · subapp organigramma.

## 2. Definizione (catalogo)

**`box_catalogo`** — modulo riusabile: `id`, `codice`, `nome`, `descrizione`,
`tipo` (`generico|smart|fisso`), `ref_smart`, `ordine_default`, `versione`,
`attivo`.

**`box_sezione`** — `id`, `box_id`→box_catalogo, `codice`, `nome`, `ordine`,
**`ripetibile`** (bool), `etichetta_componente` (testo bottone "+ Aggiungi …").

**Voci — D1A:** si generalizza `voce_template`. Aggiunta `sezione_id`→box_sezione;
`checklist_template_id` reso nullable. La voce appartiene alla sezione, non piu'
direttamente al template. Un solo motore voci.

**Composizione di default — D2:** si riusa `checklist_template` (gia' versionato)
come **contenitore di box**, tramite la ponte:
**`checklist_template_box`** — `template_id`, `box_id`, `box_versione`, `ordine`.
Il template non possiede piu' voci direttamente: possiede box. Niente tabella
`template_box` nuova.

## 3. Runtime (compilazione del sopralluogo)

**Sede — D3:** nuova entita'.
**`sede`** — `id`, `cliente_id`→cliente, `nome`, `indirizzo`, `attivo`.
Un cliente ha 1..N sedi. Conseguenze:
- `sopralluogo` += **`sede_id`** (la sede ispezionata).
- `incarico` += **`sede_id`** nullable (sede di default da cui eredita il
  sopralluogo; per incarichi mono-sede).
- componenti e "cose da fare pregresse" si filtrano per **sede**, non per cliente.

**`sopralluogo_box`** — composizione CONGELATA del singolo giro: `id`,
`sopralluogo_id`, `box_id`, **`box_versione`** (D4: puntatore di versione),
`ordine`, `origine` (`template|aggiunto_ufficio|aggiunto_campo|fisso`).
Istanziata dai box del template all'apertura, editabile (aggiungi/togli),
con i box `fisso` iniettati sempre.

**`componente_sito`** — registro persistente per **sede** (cross-sopralluogo):
`id`, **`sede_id`**→sede, `box_id`, `sezione_codice`, `etichetta`, `matricola`
(opz), `ubicazione` (opz), `attivo`, `creato_il`/`creato_da`.

**Colonne sui runtime esistenti:**
- `esito_voce` += `componente_id` (null fk→componente_sito): esito per voce e per
  componente nelle sezioni ripetibili; null nelle sezioni singole.
- `azione` += `componente_id` (null fk): cose da fare/scadenze riconducibili al
  singolo apparecchio.

## 4. Motore condizionale unico (`mostra_se` generalizzato)
`mostra_se = { voce_ref:<codice>, valore:<opzione> }` (estendibile a lista AND),
valutato **a cascata** (visibile se la voce-ref e' visibile e ha quel valore).
Copre cap. 5 (piatto) e cap. 9 (albero). Solo evaluator in `compilazione.ts`,
nessuna tabella.

## 5. Box speciali (nessuna tabella nuova)
- **smart "organigramma"** (`tipo='smart'`, `ref_smart='organigramma'`):
  renderizza `FormazioneRiepilogo` per il cliente; usa le tabelle organigramma.
- **fisso "cose_da_fare_pregresse"** (`tipo='fisso'`): vista sulle `azione` aperte
  dell'incarico **filtrate per sede**, `stato != conclusa`; iniettato sempre.

## 6. RENTRI (localizzato)
Scadenze per fascia di dipendenti = config `fascia→data` sulla voce `numero`, che
imposta `azione.data_scadenza`. Una-tantum, nessun motore generico.

## 7. Relazioni (sketch)
```
cliente ─< sede ─< componente_sito ──┐
   │         │                        ├─ esito_voce.componente_id
incarico(.sede_id) ─< sopralluogo(.sede_id) ─< sopralluogo_box >─ box_catalogo
                          │              (composizione congelata)     │
                          └─< checklist_compilata ─< esito_voce       ├─< box_sezione ─< voce_template* (D1A)
                                                          └─ azione(.componente_id)
checklist_template ─< checklist_template_box >─ box_catalogo   (composizione default, D2)
```

## 8. DDL indicativo (da approvare, non ancora eseguito)
```sql
create table sede (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references cliente(id) on delete cascade,
  nome text not null, indirizzo text, attivo boolean not null default true
);
alter table incarico    add column sede_id uuid references sede(id);
alter table sopralluogo add column sede_id uuid references sede(id);

create table box_catalogo (
  id uuid primary key default gen_random_uuid(),
  codice text unique not null, nome text not null, descrizione text,
  tipo text not null check (tipo in ('generico','smart','fisso')),
  ref_smart text, ordine_default int not null default 0,
  versione int not null default 1, attivo boolean not null default true
);
create table box_sezione (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references box_catalogo(id) on delete cascade,
  codice text not null, nome text not null, ordine int not null default 0,
  ripetibile boolean not null default false, etichetta_componente text
);
alter table voce_template add column sezione_id uuid references box_sezione(id);
-- checklist_template_id reso nullable (legacy migrati, vedi §9)

create table checklist_template_box (
  template_id uuid not null references checklist_template(id) on delete cascade,
  box_id uuid not null references box_catalogo(id),
  box_versione int not null, ordine int not null default 0,
  primary key (template_id, box_id)
);
create table sopralluogo_box (
  id uuid primary key default gen_random_uuid(),
  sopralluogo_id uuid not null references sopralluogo(id) on delete cascade,
  box_id uuid not null references box_catalogo(id),
  box_versione int not null, ordine int not null default 0,
  origine text not null default 'template'
);
create table componente_sito (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references sede(id) on delete cascade,
  box_id uuid not null references box_catalogo(id),
  sezione_codice text not null, etichetta text not null,
  matricola text, ubicazione text, attivo boolean not null default true,
  creato_il timestamptz not null default now()
);
alter table esito_voce add column componente_id uuid references componente_sito(id);
alter table azione     add column componente_id uuid references componente_sito(id);
```

## 9. Versionamento dei box (per D4)
Coerente con `checklist_compilata` che congela `template_versione`: un box, alla
**pubblicazione**, fissa una `versione` immutabile (le modifiche vanno su bozza →
pubblicare incrementa). `checklist_template_box` e `sopralluogo_box` puntano alla
versione, cosi' la composizione congelata resta stabile anche se il box viene poi
modificato.

## 10. Migrazione legacy
Ogni `checklist_template` "piatto": le sue `voce_template` finiscono sotto una
`box_sezione` singola di un box sintetizzato; una riga `checklist_template_box`
collega template→box. Sopralluoghi storici invariati.

## 11. Scelta consequenziale risolta
La **sede** e' riferita sul `sopralluogo` (la seduta avviene in un sito), con
default ereditato da `incarico.sede_id` per gli incarichi mono-sede. Rivedibile se
preferisci legare la sede solo all'incarico.
