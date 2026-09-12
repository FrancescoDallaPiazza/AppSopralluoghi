// ===================== L'IMPORT DELLE NOMINE =====================
//
// Legge il foglio "Ruoli SSL" dell'export del gestionale e ne ricava
// l'organigramma: chi ricopre quale figura di sicurezza, e da quando.
//
// Progetto: docs/c1a/import-nomine-progetto.md (commit 7820c90).
// Schema:   supabase/migrations/068_nomine_provenienza_e_dizionario_ruoli.sql.
// Regola:   src/lib/admin/ruoliTesto.ts, provata da `npm run ruoli:check`.
//
// ---------------------------------------------------------------------------
// LE DUE SORGENTI, CHE NON HANNO LO STESSO PESO
// ---------------------------------------------------------------------------
//
//   A. LE NOVE COLONNE DI RUOLO. Una nomina letta qui e' DICHIARATA: la cella
//      non e' una spunta, e' un seriale data di Excel, e quella data e' la data
//      dell'incarico. Non si inventa col giorno dell'import.
//
//   B. LA MANSIONE, in testo libero. Una nomina letta qui e' DEDOTTA: e'
//      un'interpretazione fatta da una regola, e non porta nessuna data.
//
// Su 301 righe che portano un ruolo, 160 vengono dal testo: non e' un caso
// marginale, e' meta' del totale. Per questo `nomina.origine` esiste e non si
// azzera mai (mig. 068) - `da_confermare` e' un COMPITO e sparisce appena
// qualcuno guarda la riga, portandosi via l'unica traccia dell'interpretazione.
//
// ---------------------------------------------------------------------------
// LA REGOLA CHE GOVERNA TUTTO IL FILE
// ---------------------------------------------------------------------------
//
// Non si indovina, e non si tace. Una riga che il sistema non sa mappare non
// diventa una nomina «migliore di niente» e non sparisce: diventa un fatto
// visibile, con dentro il testo che non e' stato capito.
//
//     STATO.md:245 - «una nomina che punta al ruolo sbagliato e' peggio di una
//     nomina mancante».

import { supabase, leggiTutte } from '../supabase';
import {
  type Foglio, leggiFoglio, normHeader, isoData,
  leggiCampiPersona, raggruppaPersone, type GruppoPersone,
} from './anagraficheImport';
import { type ClienteScelta } from './formazioneImport';
import { valido as cfValido, pulisci as cfPulisci } from '../../formazione/codiceFiscale';
import {
  type Dizionario, type VoceDizionario, type EsitoMansione,
  indicizza, risolviMansione, chiaveTesto,
} from './ruoliTesto';

const S = (v: unknown): string => (v == null ? '' : String(v)).trim();
const newId = (): string => crypto.randomUUID();

// Il foglio dei ruoli. Va chiesto PER NOME: `ExportExcel (4).xlsx` ha quattro
// fogli e i ruoli sono nel quarto - leggere il primo non da' errore, da' un
// risultato parziale in silenzio (lezione del 10 settembre 2026).
export const FOGLIO_RUOLI = 'Ruoli SSL';

// Il prefisso della chiave naturale dell'azione «questa persona ha un ruolo
// scritto e non mappabile» sta in `formazione.ts`, accanto alle altre due forme
// che vivono nella stessa colonna: e' li' che si decide cosa sopravvive alla
// riconciliazione, e una costante lontana dalla regola che la usa e' il modo in
// cui le due si disallineano.
export { CHIAVE_NOMINA_FORMA } from './formazione';
import { CHIAVE_NOMINA_FORMA } from './formazione';

// ---------------------------------------------------------------------------
// [1] LE NOVE COLONNE DI RUOLO, E LE TRE CHE NON ENTRANO
// ---------------------------------------------------------------------------
//
// Enumerate tutte e nove, comprese quelle che restano fuori: una colonna esclusa
// e non nominata e' indistinguibile da una colonna dimenticata, ed e' successo
// gia' due volte su questo stesso file.
export interface ColonnaRuolo {
  intestazione: string;         // come si chiama nel foglio
  chiave: string;               // normHeader dell'intestazione
  figura: string | null;        // null = riconosciuta, NON mappabile
  perche: string | null;        // perche' non e' mappata. Null quando lo e'.
}

export const COLONNE_RUOLO: ColonnaRuolo[] = [
  { intestazione: 'Addetti Antincendio', chiave: normHeader('Addetti Antincendio'),
    figura: 'addetto_antincendio', perche: null },
  { intestazione: 'Addetti Primo Soccorso', chiave: normHeader('Addetti Primo Soccorso'),
    figura: 'addetto_primo_soccorso', perche: null },
  { intestazione: 'Addetti Servizio Prevenzione e Protezione',
    chiave: normHeader('Addetti Servizio Prevenzione e Protezione'),
    figura: 'aspp', perche: null },
  { intestazione: 'Dirigente', chiave: normHeader('Dirigente'), figura: 'dirigente', perche: null },
  { intestazione: 'Preposto', chiave: normHeader('Preposto'), figura: 'preposto', perche: null },
  { intestazione: 'RLS', chiave: normHeader('RLS'), figura: 'rls', perche: null },

  // --- LE TRE CHE NON ENTRANO, e ciascuna per una ragione sua -----------------

  // La colonna dice "RSPP" e il file e' COERENTE CON SE STESSO: la colonna 32
  // ripete gli stessi ruoli in chiaro e le nove mappature combaciano, zero
  // incoerenze. Il difetto sta A MONTE DEL FILE - e' il gestionale che chiama
  // "RSPP" il datore di lavoro che assume l'incarico in proprio (art. 34) - e la
  // prova non e' nel foglio: sta negli attestati, dove 26 righe su 33 sono
  // "AGGIORNAMENTO DATORE DI LAVORO CHE SVOLGE I COMPITI DI RSPP" e la
  // sovrapposizione con chi ha i moduli A/B/C professionali e' ZERO.
  // Mandare queste 31 righe a `rspp` darebbe a quelle persone il percorso del
  // professionista invece di quello del datore. Resta fuori SAPENDO PERCHE',
  // non per prudenza generica, e AppFormazione ha gia' dovuto correggerlo una
  // volta con `togli_ruoli_rspp.sql`.
  { intestazione: 'RSPP', chiave: normHeader('RSPP'), figura: null,
    perche: 'Il gestionale chiama "RSPP" anche il datore che assume l’incarico in proprio '
      + '(art. 34): 26 attestati su 33 sono da datore-RSPP e la sovrapposizione con i moduli '
      + 'A/B/C professionali e’ zero. Mandarle a "rspp" darebbe il percorso sbagliato. '
      + 'Serve sapere chi compila il gestionale.' },

  // Non c'e' una figura per questa colonna, e le due candidate non si
  // equivalgono: `addetto_antincendio` si chiama "Addetto antincendio /
  // gestione emergenze" - il che la rende PLAUSIBILE, non certa. 71 righe sono
  // troppe per deciderlo qui.
  { intestazione: 'Addetti Emergenze ed Evacuazione',
    chiave: normHeader('Addetti Emergenze ed Evacuazione'), figura: null,
    perche: 'Nessuna figura corrisponde. `addetto_antincendio` si chiama "Addetto antincendio / '
      + 'gestione emergenze" e potrebbe essere la stessa cosa, ma "potrebbe" non basta su 71 righe: '
      + 'la domanda va all’Area Formazione.' },

  // Un RESPONSABILE non e' un ADDETTO, e nessuna figura del D.Lgs 81/08 nel
  // nostro elenco corrisponde. Qui la deduzione sarebbe piu' azzardata della
  // precedente, non meno.
  { intestazione: 'Responsabile Emergenze', chiave: normHeader('Responsabile Emergenze'),
    figura: null,
    perche: 'Un responsabile non e’ un addetto, e nessuna delle tredici figure corrisponde. '
      + 'Non si deduce.' },
];

// ---------------------------------------------------------------------------
// [2] IL DIZIONARIO, LETTO DAL DATABASE
// ---------------------------------------------------------------------------
export async function caricaDizionarioRuoli(): Promise<Dizionario> {
  const testi = await leggiTutte<{ chiave: string; varianti: string[]; posizione: string; note: string | null }>(
    (da, a) => supabase.from('ruolo_testo').select('chiave, varianti, posizione, note').order('chiave').range(da, a));
  const figure = await leggiTutte<{ chiave: string; ruolo_asserito: string; figura_codice: string | null }>(
    (da, a) => supabase.from('ruolo_testo_figura').select('chiave, ruolo_asserito, figura_codice')
      .order('chiave').order('ruolo_asserito').range(da, a));

  const voci = new Map<string, VoceDizionario>();
  for (const t of testi) voci.set(t.chiave, { ...t, note: t.note ?? null, asserzioni: [] });
  for (const f of figure) {
    const v = voci.get(f.chiave);
    // Un'asserzione senza il suo testo non e' un caso da ignorare: il vincolo di
    // chiave esterna lo impedisce, quindi se capita il dizionario e' stato
    // toccato a mano e il conto degli esiti non varrebbe piu' niente.
    if (!v) throw new Error(`Dizionario incoerente: asserzione su una chiave assente ("${f.chiave}").`);
    v.asserzioni.push({ ruolo_asserito: f.ruolo_asserito, figura_codice: f.figura_codice });
  }
  return indicizza([...voci.values()]);
}

// ---------------------------------------------------------------------------
// [3] IL PIANO
// ---------------------------------------------------------------------------
export interface NominaProposta {
  riga: number;
  persona_id: string;
  persona: string;              // come si chiama, per l'anteprima
  figura_codice: string;
  data_nomina: string | null;
  origine: 'colonna' | 'mansione';
  origine_testo: string | null; // il verbatim, solo quando origine = 'mansione'
  gia: boolean;                 // la persona ha gia' questa figura: non si tocca
}

// Il SECONDO esito: riconosciuto e non mappabile. Non e' uno scarto - e' un
// lavoro per una persona, e porta il testo dentro perche' il testo E' il dato.
export interface DaDecidere {
  riga: number;
  persona_id: string | null;
  persona: string;
  cliente: string;
  fonte: 'colonna' | 'mansione';
  testo: string;                // la mansione verbatim, o il nome della colonna
  motivo: string;
}

export interface PianoNomine {
  gruppi: GruppoPersone[];      // l'abbinamento riga -> cliente, come per le persone
  proposte: NominaProposta[];
  daDecidere: DaDecidere[];
  // Righe che nominano una persona che in archivio non si trova. Non e' un
  // "da decidere": e' un presupposto mancante, e la risposta e' importare prima
  // le anagrafiche.
  personeNonTrovate: { riga: number; chi: string; cliente: string; motivo: string }[];
  scartate: { riga: number; motivo: string }[];
  // La rete a maglie larghe per i ruoli scritti in una forma che nessuna parola
  // nota intercetta. Sono le mansioni distinte che il dizionario non conosce:
  // 603 su 2.890 righe all'ultima misura, e scorrerle e' lavoro da cinque minuti.
  mansioniNuove: { testo: string; righe: number }[];
  righeLette: number;
}

// Nome leggibile, per l'anteprima e per la descrizione dell'azione.
const nomeDi = (cognome: string, nome: string): string =>
  [cognome, nome].map((x) => S(x)).filter(Boolean).join(' ') || '(senza nome)';

export async function leggiFoglioRuoli(file: File): Promise<Foglio> {
  return leggiFoglio(file, FOGLIO_RUOLI);
}

// Le persone gia' in archivio per i clienti coinvolti, indicizzate come le
// indicizza l'import delle anagrafiche: prima il codice fiscale, poi il nome -
// e il nome SOLO quando non e' ambiguo.
interface IndicePersone {
  perCf: Map<string, { id: string; nome: string }>;
  perNome: Map<string, { id: string; nome: string } | null>;   // null = omonimi
}

function indicizzaPersone(
  righe: { id: string; nome: string | null; cognome: string | null; codice_fiscale: string | null }[],
): IndicePersone {
  const perCf = new Map<string, { id: string; nome: string }>();
  const perNome = new Map<string, { id: string; nome: string } | null>();
  for (const p of righe) {
    const etichetta = nomeDi(p.cognome ?? '', p.nome ?? '');
    if (p.codice_fiscale) perCf.set(cfPulisci(p.codice_fiscale), { id: p.id, nome: etichetta });
    const k = `${chiaveTesto(p.cognome ?? '')}|${chiaveTesto(p.nome ?? '')}`;
    if (k === '|') continue;
    perNome.set(k, perNome.has(k) ? null : { id: p.id, nome: etichetta });
  }
  return { perCf, perNome };
}

// ---------------------------------------------------------------------------
// IL RIPIEGO COGNOME+NOME, ACCESO DELIBERATAMENTE
// ---------------------------------------------------------------------------
//
// Dodici delle 153 righe con un ruolo in colonna non hanno il codice fiscale.
// Agganciando SOLO per CF si perderebbero 19 incarichi in silenzio, e il 100%
// dell'unica riga `Addetti Servizio Prevenzione e Protezione` dell'export -
// cioe' l'unico ASPP, che e' la figura che se manca non manca poco.
//
// Il ripiego esiste gia' nell'import delle anagrafiche e qui si accende con le
// stesse due guardie, non con una in meno: il nome vale come chiave solo se non
// e' ambiguo IN ARCHIVIO e non e' ripetuto NEL FILE. Quando una delle due cade,
// la riga non diventa una nomina su qualcuno «probabile»: diventa una persona
// non trovata, che si vede.
//
// E VA DETTO COSA IL RIPIEGO NON PUO' FARE: aggancia dentro UN cliente, perche'
// l'identita' di una persona in questo archivio e' la coppia (cliente, nome).
// Fuori da li' due omonimi non si distinguono, e il sistema si ferma invece di
// scegliere.
function risolviPersona(
  cf: string, cognome: string, nome: string, idx: IndicePersone, ripetutiNelFile: Set<string>,
): { id: string; nome: string } | { errore: string } {
  if (cf) {
    const p = idx.perCf.get(cf);
    if (p) return p;
    // CF presente nel file e assente in archivio. Non si ripiega sul nome: il
    // file DICE chi e' questa persona, e se in archivio non c'e' il fatto da
    // riportare e' quello, non un aggancio a qualcuno che si chiama uguale.
    return { errore: cfValido(cf)
      ? 'codice fiscale non presente in archivio'
      : 'codice fiscale non valido e non presente in archivio' };
  }
  const k = `${chiaveTesto(cognome)}|${chiaveTesto(nome)}`;
  if (k === '|') return { errore: 'riga senza codice fiscale e senza nome' };
  if (ripetutiNelFile.has(k)) {
    return { errore: 'senza codice fiscale, e lo stesso nome compare piu’ volte nel file' };
  }
  const p = idx.perNome.get(k);
  if (p === null) return { errore: 'senza codice fiscale, e in archivio ci sono due omonimi' };
  if (!p) return { errore: 'senza codice fiscale, e il nome non si trova in archivio' };
  return p;
}

export async function pianificaNomine(
  f: Foglio, clienti: ClienteScelta[], abbinamenti: Record<string, string | null> = {},
): Promise<PianoNomine> {
  const diz = await caricaDizionarioRuoli();
  const { gruppi, scartate } = raggruppaPersone(f, clienti, abbinamenti);

  const proposte: NominaProposta[] = [];
  const daDecidere: DaDecidere[] = [];
  const personeNonTrovate: PianoNomine['personeNonTrovate'] = [];
  const mansioniConteggio = new Map<string, number>();

  // Le colonne che il foglio ha davvero. Una colonna attesa e assente si dice:
  // il file potrebbe essere un export diverso.
  const chiaviFoglio = new Set(f.intestazioni.map(normHeader).filter(Boolean));

  for (const gr of gruppi) {
    if (!gr.cliente_id) continue;   // gruppo non abbinato: lo decide l'operatore

    const esistenti = await leggiTutte<{ id: string; nome: string | null; cognome: string | null; codice_fiscale: string | null }>(
      (da, a) => supabase.from('persona').select('id, nome, cognome, codice_fiscale')
        .eq('cliente_id', gr.cliente_id).order('id').range(da, a));
    const idx = indicizzaPersone(esistenti);

    const nomineGia = await leggiTutte<{ persona_id: string; figura_codice: string }>(
      (da, a) => supabase.from('nomina').select('persona_id, figura_codice')
        .in('persona_id', esistenti.map((p) => p.id)).order('persona_id').range(da, a));
    const gia = new Set(nomineGia.map((n) => `${n.persona_id}|${n.figura_codice}`));

    // I nomi senza CF ripetuti DENTRO il file: stessa guardia dell'import
    // anagrafiche, e va calcolata sul gruppo perche' l'identita' e' per cliente.
    const contaNomi = new Map<string, number>();
    for (const r of gr.righe) {
      const c = leggiCampiPersona(r.col);
      if (!c || c.cf) continue;
      const k = `${chiaveTesto(c.cognome)}|${chiaveTesto(c.nome)}`;
      if (k !== '|') contaNomi.set(k, (contaNomi.get(k) ?? 0) + 1);
    }
    const ripetuti = new Set([...contaNomi.entries()].filter(([, n]) => n > 1).map(([k]) => k));

    for (const r of gr.righe) {
      const campi = leggiCampiPersona(r.col);
      if (!campi) continue;
      const etichetta = nomeDi(campi.cognome, campi.nome);

      // Cosa questa riga asserisce, dalle due sorgenti.
      const dalleColonne = COLONNE_RUOLO
        .filter((c) => chiaviFoglio.has(c.chiave) && S(r.col[c.chiave]) !== '')
        .map((c) => ({ col: c, data: isoData(r.col[c.chiave]) }));
      const mans = S(campi.mansione);
      const esitoMans: EsitoMansione | null = mans ? risolviMansione(mans, diz) : null;
      if (mans) mansioniConteggio.set(mans, (mansioniConteggio.get(mans) ?? 0) + 1);

      const asserisceQualcosa =
        dalleColonne.length > 0 || (esitoMans !== null && esitoMans.asserzioni.length > 0);
      if (!asserisceQualcosa) continue;   // terzo esito: niente, e va bene

      // La persona serve solo se la riga asserisce qualcosa: risolverla per
      // tutte e 3.501 le righe costerebbe senza servire.
      const chi = risolviPersona(campi.cf, campi.cognome, campi.nome, idx, ripetuti);
      if ('errore' in chi) {
        personeNonTrovate.push({ riga: r.n, chi: etichetta, cliente: gr.etichetta, motivo: chi.errore });
        continue;
      }

      // --- A. le colonne ---
      for (const { col, data } of dalleColonne) {
        if (!col.figura) {
          daDecidere.push({
            riga: r.n, persona_id: chi.id, persona: chi.nome, cliente: gr.etichetta,
            fonte: 'colonna', testo: col.intestazione, motivo: col.perche ?? 'colonna non mappata',
          });
          continue;
        }
        proposte.push({
          riga: r.n, persona_id: chi.id, persona: chi.nome, figura_codice: col.figura,
          // La data dell'incarico c'e' nella cella e non si sostituisce con
          // oggi. Se la cella non e' una data leggibile resta null: una data
          // inventata non si distingue piu' da una vera.
          data_nomina: data,
          origine: 'colonna', origine_testo: null,
          gia: gia.has(`${chi.id}|${col.figura}`),
        });
      }

      // --- B. la mansione ---
      for (const a of esitoMans?.asserzioni ?? []) {
        if (!a.figura_codice) {
          daDecidere.push({
            riga: r.n, persona_id: chi.id, persona: chi.nome, cliente: gr.etichetta,
            fonte: 'mansione', testo: mans,
            motivo: esitoMans!.trovata
              ? `il dizionario conosce questa forma e NON ha una regola per "${a.ruolo_asserito}": `
                + 'l’assenza e’ voluta, il ruolo esatto non si deduce'
              : 'forma non a dizionario, ma il testo nomina un ruolo di sicurezza',
          });
          continue;
        }
        proposte.push({
          riga: r.n, persona_id: chi.id, persona: chi.nome, figura_codice: a.figura_codice,
          data_nomina: null,          // dedotta da un testo: nessuna data, e non se ne inventa una
          origine: 'mansione', origine_testo: mans,
          gia: gia.has(`${chi.id}|${a.figura_codice}`),
        });
      }
    }
  }

  // Le mansioni che il dizionario non conosce, in ordine di frequenza: e' la
  // sola rete possibile per un ruolo scritto senza nessuna parola nota.
  const mansioniNuove = [...mansioniConteggio.entries()]
    .filter(([t]) => !diz.perChiave.has(chiaveTesto(t)))
    .map(([testo, righe]) => ({ testo, righe }))
    .sort((a, b) => b.righe - a.righe || a.testo.localeCompare(b.testo));

  return {
    gruppi, proposte, daDecidere, personeNonTrovate, scartate, mansioniNuove,
    righeLette: f.righe.length,
  };
}

// ---------------------------------------------------------------------------
// [4] IL RIEPILOGO, che non puo' dire solo il primo numero
// ---------------------------------------------------------------------------
//
// «161 nomine» e' un riepilogo che mente per omissione. Il secondo conteggio non
// va MAI mostrato come zero implicito: se ci sono sette righe riconosciute e non
// mappabili, il riepilogo dice «161 nomine, 7 da decidere».
export interface RiepilogoNomine {
  daCreare: number;
  giaPresenti: number;
  daDecidere: number;
  personeNonTrovate: number;
  mansioniNuove: number;
  perFigura: { figura: string; n: number }[];
  perOrigine: { colonna: number; mansione: number };
}

export function riepiloga(p: PianoNomine): RiepilogoNomine {
  const nuove = p.proposte.filter((x) => !x.gia);
  const perFigura = new Map<string, number>();
  for (const n of nuove) perFigura.set(n.figura_codice, (perFigura.get(n.figura_codice) ?? 0) + 1);
  return {
    daCreare: nuove.length,
    giaPresenti: p.proposte.length - nuove.length,
    daDecidere: p.daDecidere.length,
    personeNonTrovate: p.personeNonTrovate.length,
    mansioniNuove: p.mansioniNuove.length,
    perFigura: [...perFigura.entries()].map(([figura, n]) => ({ figura, n }))
      .sort((a, b) => b.n - a.n || a.figura.localeCompare(b.figura)),
    perOrigine: {
      colonna: nuove.filter((x) => x.origine === 'colonna').length,
      mansione: nuove.filter((x) => x.origine === 'mansione').length,
    },
  };
}

// ---------------------------------------------------------------------------
// [5] LA SCRITTURA
// ---------------------------------------------------------------------------
//
// Idempotente per costruzione: `nomina` ha `unique (persona_id, figura_codice)`
// dalla migrazione 015, quindi `on conflict do nothing` fa il resto e ripassare
// lo stesso file non crea niente.
//
// E `do nothing` NON e' una scorciatoia rispetto a `do update`: una nomina che
// c'e' gia' e' stata messa da qualcuno - a mano, o da un import precedente - e
// quella e' la sua origine. Riscriverla significherebbe sovrascrivere una
// dichiarazione con un'interpretazione, che e' il verso sbagliato.
export async function applicaNomine(p: PianoNomine): Promise<number> {
  const nuove = p.proposte.filter((x) => !x.gia);
  if (nuove.length === 0) return 0;

  // Una persona potrebbe ricevere la stessa figura da due righe (la colonna e la
  // mansione dicono la stessa cosa: 12 righe lo fanno). Si deduplica QUI, non
  // lasciando che sia il database a scartare la seconda: cosi' il conteggio che
  // l'anteprima ha mostrato e quello che viene scritto coincidono.
  //
  // E fra le due vince la COLONNA, perche' porta la data dell'incarico.
  const perChiave = new Map<string, NominaProposta>();
  for (const n of nuove) {
    const k = `${n.persona_id}|${n.figura_codice}`;
    const gia = perChiave.get(k);
    if (!gia || (gia.origine === 'mansione' && n.origine === 'colonna')) perChiave.set(k, n);
  }

  const righe = [...perChiave.values()].map((n) => ({
    id: newId(),
    persona_id: n.persona_id,
    figura_codice: n.figura_codice,
    data_nomina: n.data_nomina,
    attiva: true,
    note: null,
    origine: n.origine,
    origine_testo: n.origine_testo,
  }));

  const { error } = await supabase.from('nomina')
    .upsert(righe, { onConflict: 'persona_id,figura_codice', ignoreDuplicates: true });
  if (error) throw error;
  return righe.length;
}

// ---------------------------------------------------------------------------
// [6] DOVE FINISCE UNA RIGA CHE NESSUNO HA CAPITO
// ---------------------------------------------------------------------------
//
// Il riepilogo dell'anteprima risponde a «cosa sta per entrare»; questo risponde
// a «chi se ne occupa», che e' una domanda diversa e sopravvive alla chiusura
// della finestra. La descrizione porta il TESTO VERBATIM, perche' e' il dato:
//
//   «CORDIOLI KARL risulta RSPP nella mansione "SOCIO/ RSPP": essere socio non
//    stabilisce di essere il datore, e il ruolo esatto non si deduce.»
//
// E' limitata per costruzione, come quella dell'ATECO: nasce solo dove il testo
// contiene una parola di ruolo nota. Oggi sarebbero sette righe, non 2.890.
export function azioniDaDecidere(
  p: PianoNomine, clienteId: string, areaId: string | null,
): { key: string; az: Record<string, unknown> }[] {
  // Una persona, una riga: se due testi diversi la riguardano, la descrizione li
  // porta entrambi invece di produrre due azioni che si chiudono insieme.
  const perPersona = new Map<string, DaDecidere[]>();
  for (const d of p.daDecidere) {
    if (!d.persona_id) continue;
    const l = perPersona.get(d.persona_id);
    if (l) l.push(d); else perPersona.set(d.persona_id, [d]);
  }

  return [...perPersona.entries()].map(([personaId, righe]) => {
    const key = CHIAVE_NOMINA_FORMA + personaId;
    const chi = righe[0]!.persona;
    const dettaglio = righe
      .map((r) => r.fonte === 'mansione'
        ? `nella mansione "${r.testo}"`
        : `nella colonna "${r.testo}"`)
      .join(', ');
    return {
      key,
      az: {
        tipo: 'azione_correttiva', origine_esito_id: null, sopralluogo_origine_id: null,
        origine_formazione_id: null, origine_esonero_id: null, origine_requisito_key: key,
        responsabile_cliente_id: clienteId,
        // Nessuna data: non c'e' un termine di legge per capire una frase. La
        // vista non la promuove a "SUBITO" - non e' un lavoro in ritardo, e' un
        // ruolo che non si e' potuto leggere.
        data_scadenza: null,
        descrizione: `Ruolo di sicurezza da chiarire - ${chi}: risulta un ruolo ${dettaglio}, `
          + 'e la regola per tradurlo non c’e’ apposta. Il ruolo esatto non si deduce: '
          + 'va deciso e messo a mano, oppure aggiunto al dizionario dei ruoli.',
        ...(areaId
          ? { responsabile_tipo: 'risorsa_interna', responsabile_area_id: areaId }
          : { responsabile_tipo: 'cliente' }),
      },
    };
  });
}
