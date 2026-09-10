# `figura_requisito`: stato finale, e le migrazioni descrivono il database

Due letture indipendenti dello stesso dato, tenute separate fino in fondo e poi
confrontate. 10 settembre 2026. **Sola lettura**: nessuna scrittura, né sul
database né sulle migrazioni.

La domanda non era «cosa c'è in `figura_requisito`». Era **«le migrazioni
descrivono il database?»** — che nessuno su questo repo aveva mai verificato, e
la cui risposta vale per ogni altra ricostruzione fatta dai file.

## Lettura 1 — simulazione dalle migrazioni

### I punti che toccano la tabella, enumerati

Con il comando, non a memoria:

```
grep -nE "insert into figura_requisito|update figura_requisito|delete from figura_requisito" supabase/migrations/*.sql
```

**Sono questi sette, e sono tutti:**

| # | file | riga | operazione | righe |
|---:|---|---:|---|---:|
| 1 | `015_formazione_organigramma.sql` | 325 | insert | 16 |
| 2 | `016_formazione_datore_lavoro.sql` | 24 | insert | 1 |
| 3 | `018_organigramma_checklist_ragionata.sql` | 65 | insert | 1 |
| 4 | `049_dl_rspp_prerequisito_e_moduli_settore.sql` | 53 | **delete** | −1 |
| 5 | `049_…` | 90 | insert | 1 |
| 6 | `049_…` | 113 | insert | 2 |
| 7 | `053_organigramma_deleghe_evidenze_nomina.sql` | 44 | insert | 1 |

**Ho allargato la ricerca invece di fidarmi di quel grep**, che è
case-sensitive e cerca tre forme: se ne esistesse una quarta (un `DELETE`
maiuscolo, un `on conflict do update`, una cancellazione dentro un blocco `do`)
non la vedrebbe. Con `grep -rn -i "figura_requisito"` i file che la nominano sono
**nove**, ma i quattro in più — `017`, `024`, `045`, `058` — la citano **solo nei
commenti**, e dicono una cosa che serve sapere: le attrezzature e il medico
competente **non** entrano in `figura_requisito`, e non per dimenticanza.

Nessun `update`: la tabella non è mai stata modificata, solo riempita e sfoltita
di una riga.

### Lo stato finale che ne risulta

22 righe inserite − 1 cancellata dalla `049` (`dl_rspp` + `DL_RSPP_BASE`) = **21**.

## Lettura 2 — dal database

SQL Editor, progetto `AppSopralluoghi` (`pvbwcfrgatkqashstxjc`), `main`
PRODUCTION. Query dichiarata, sola lettura:

```sql
select figura_codice, corso_codice, obbligatorio, per_categoria, note
  from figura_requisito
 order by figura_codice, corso_codice;
```

Risultato: **21 righe**.

## Il confronto

| solo nelle migrazioni | solo nel database | in entrambe |
|---:|---:|---:|
| **0** | **0** | **21** |

**È un risultato positivo, non una non-notizia.** Su questo repo, oggi, si può
affermare una cosa che ieri nessuno poteva: per questa tabella **le migrazioni
descrivono il database**. La `049` risulta applicata (`DL_RSPP_BASE` non c'è né
di qua né di là), e nessuno ha toccato la tabella a mano.

Vale per `figura_requisito`. Non è una prova per le altre tabelle — è una prova
che il metodo di ricostruzione **funziona**, che è la cosa che serviva sapere.

## Lo stato finale, 21 righe

| figura | corso | obbligatorio | per_categoria |
|---|---|:-:|:-:|
| `addetto_antincendio` | `AI_LIV2` | true | **true** |
| `addetto_primo_soccorso` | `PS_GRBC` | true | **true** |
| `aspp` | `RSPP_MOD_A` | true | false |
| `aspp` | `RSPP_MOD_B` | true | false |
| `aspp` | `RSPP_MOD_B_SETTORE` | true | false |
| `datore_lavoro` | `DATORE_LAVORO` | true | false |
| `datore_lavoro_art16` | `DATORE_LAVORO` | true | false |
| `dirigente` | `DIRIGENTE` | true | false |
| `dl_rspp` | `DL_RSPP_COMUNE` | true | false |
| `dl_rspp` | `DL_RSPP_SETTORE` | true | false |
| `lavoratore` | `LAV_GEN` | true | false |
| `lavoratore` | `LAV_SPEC` | true | false |
| `operatore_attrezzatura` | `ATTR_GENERICO` | true | **true** |
| `preposto` | `LAV_GEN` | true | false |
| `preposto` | `LAV_SPEC` | true | false |
| `preposto` | `PREPOSTO` | true | false |
| `rls` | `RLS` | true | false |
| `rspp` | `RSPP_MOD_A` | true | false |
| `rspp` | `RSPP_MOD_B` | true | false |
| `rspp` | `RSPP_MOD_B_SETTORE` | true | false |
| `rspp` | `RSPP_MOD_C` | true | false |

`obbligatorio` è **true su tutte e 21**, e `note` è **NULL su tutte e 21**: due
colonne che esistono e non sono mai state usate.

## `is_aggiornamento`: la fonte NON lo porta

Domanda diretta, risposta diretta: **no**. Lo schema è
(`015_formazione_organigramma.sql:79`):

```
id · figura_codice · corso_codice · obbligatorio · per_categoria · note
unique (figura_codice, corso_codice)
```

Non c'è nessun campo che distingua il corso iniziale dall'aggiornamento, e non
c'è nessun modo di dedurlo dalle righe: `preposto → PREPOSTO` è una riga sola.

**Il motivo è che qui la distinzione vive altrove**: sta su `corso_catalogo`, che
porta `aggiornamento_mesi` e `ore_aggiornamento`. Un requisito punta a un corso, e
il corso sa da sé ogni quanto si rinnova. Non è un'omissione, è un modello diverso
dal vostro.

Quindi, se nella vostra tabella `is_aggiornamento` sta in chiave primaria, la
trasformazione «1 requisito → 2 righe» **è una decisione e non una deduzione**,
e va presa sapendo che qui non c'è nulla da leggere. Non la prendo io.

## Attenzione a `per_categoria`, che è la trappola di questa tabella

Tre righe hanno `per_categoria = true`, e il commento nello schema dice cosa
significa: *«il requisito è soddisfatto da QUALSIASI corso della stessa categoria
del corso indicato (es. addetto antincendio: vale liv.1/2/3)»*.

Cioè `addetto_antincendio → AI_LIV2` **non vuol dire** che serve il livello 2:
vuol dire che serve un corso della categoria antincendio, e AI_LIV2 è il
rappresentante scritto nella riga. Una mappatura che copiasse la coppia
letteralmente renderebbe obbligatorio il livello 2 e **dichiarerebbe scoperti i
livelli 1 e 3**. Le tre righe sono `addetto_antincendio`,
`addetto_primo_soccorso` e `operatore_attrezzatura` — cioè proprio quelle dove i
corsi sono una famiglia e non un titolo unico.

## Le figure senza nessun requisito

Le figure seminate sono **13** (`015` ×10, `018` ×1, `024` ×1, `053` ×1), e il
conteggio combacia con `figura_sicurezza = 13` misurato nel database.

Una sola non ha requisiti: **`medico_competente`**, e per scelta dichiarata —
`024_figura_medico_competente.sql:3` dice «nessun `figura_requisito`», perché di
lui si registra la nomina e la sua abilitazione non è formazione ex art. 37.

**Sulle attrezzature, la risposta è diversa da quella che la domanda si aspetta.**
Qui non esiste una figura per attrezzatura: esiste **una sola** riga,
`operatore_attrezzatura → ATTR_GENERICO` con `per_categoria = true`, e le
migrazioni `045` e `058` dichiarano esplicitamente che le attrezzature **non**
vengono aggiunte a `figura_requisito` perché sono abilitazioni, non figure.
Quindi non posso dire «quali delle 12 attrezzature non hanno requisito»: in
questo modello **nessuna ce l'ha, e nessuna dovrebbe averlo**.

Le «15 figure + 12 attrezzature + 9 attività» sono la tassonomia della `0002` di
AppOverall, non di questo repo. La corrispondenza fra le due la può fare solo chi
ha davanti entrambe: qui c'è la seconda fonte, non la traduzione.
