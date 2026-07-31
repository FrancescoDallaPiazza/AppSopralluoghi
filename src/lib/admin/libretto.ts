// Libretto formativo di UNA persona: dossier di sicurezza (D.Lgs. 81/08), non
// il "libretto formativo del cittadino" del D.Lgs. 276/2003 - quello includerebbe
// titoli di studio, apprendistato ed esperienze lavorative, che l'app non ha e
// che nessuno qui raccoglie.
//
// Perche' esiste: l'organigramma taglia i dati per FIGURA (chi copre il ruolo,
// cosa gli manca). Questo e' il taglio opposto, per PERSONA, ed e' quello che
// serve quando la domanda arriva su un nome: cosa ha fatto, quando, quanto dura
// ancora. E' anche l'unico posto dove compaiono gli attestati che NON servono a
// nessun requisito dei suoi ruoli - il corso antincendio di chi in organigramma
// e' solo lavoratore - che nell'organigramma sono invisibili per costruzione.
//
// Composizione: i ruoli con le date di nomina vengono dal motore (stessa
// sorgente dell'organigramma, quindi non possono divergere), la formazione
// svolta dalle righe grezze di `formazione`.

import { supabase } from '../supabase';
import {
  valutaCliente, caricaCatalogo, addMesi, nomePersona,
  type Formazione, type CorsoCatalogo,
} from './formazione';

export interface VoceLibretto {
  id: string;
  corso_nome: string;
  corso_codice: string | null;
  categoria: string | null;
  data_completamento: string | null;
  ore: number | null;
  ente_formatore: string | null;
  is_aggiornamento: boolean;
  parziale: boolean;
  // Scadenza dell'attestato: quella scritta se c'e', altrimenti calcolata dalla
  // periodicita' del corso a catalogo. Si calcola qui e non si lascia vuota
  // perche' su un libretto la riga senza scadenza si legge come "non scade".
  scadenza: string | null;
  allegato_url: string | null;
  note: string | null;
}

export interface RuoloLibretto {
  codice: string;
  nome: string;
  data_nomina: string | null;
  evidenza_mancante: boolean;
}

export interface GruppoLibretto {
  chiave: string;
  titolo: string;               // nome a catalogo se il corso e' mappato
  categoria: string | null;
  voci: VoceLibretto[];         // dal piu' VECCHIO al piu' recente
  ore_totali: number | null;    // somma delle ore note (null se nessuna lo e')
  // Scadenza corrente della tipologia: quella dell'ultimo attestato INTERO.
  // Gli spezzoni non la spostano - da soli non assolvono niente, e prenderne uno
  // come base direbbe che l'obbligo e' stato rinnovato quando non lo e'.
  scadenza: string | null;
}

export interface Libretto {
  generato_il: string;
  cliente_nome: string;
  persona: {
    nome: string;
    codice_fiscale: string | null;
    mansione: string | null;
    reparto: string | null;
    data_assunzione: string | null;
    livello_rischio: string | null;
    attivo: boolean;
  };
  ruoli: RuoloLibretto[];
  // Lo storico raggruppato per TIPOLOGIA di corso: il corso base e i suoi
  // aggiornamenti stanno insieme, in ordine dal piu' vecchio al piu' recente.
  // E' come si legge un libretto - "questa formazione da quando ce l'ha e a che
  // punto e'" - mentre un elenco unico in ordine di data mescola percorsi
  // diversi e costringe a ricostruire a mente quale aggiornamento rinnova cosa.
  // Include gli spezzoni: sono ore erogate davvero, marcati per non farli
  // leggere come corsi interi.
  gruppi: GruppoLibretto[];
}

// NB: il libretto NON riporta la valutazione dei requisiti (conforme/critico/...).
// E' un registro di FATTI - chi e', che ruoli ricopre, quali corsi ha svolto e
// quando scadono - e i fatti restano veri anche fuori dal contesto in cui il
// documento e' stato generato. Il giudizio "critico" no: dipende dai ruoli di
// oggi e dal catalogo di oggi, e su un foglio consegnato mesi prima diventa
// un'affermazione sbagliata su una persona. Lo stato si guarda in organigramma,
// dove e' vivo.

// Corsi che a catalogo sono righe distinte ma sul libretto sono UN pacchetto.
// La formazione del lavoratore e' il caso: generale (4h, non scade di per se') e
// specifica (4/8/12h secondo il rischio) sono le due meta' di un unico obbligo -
// l'art. 37 le prevede insieme e l'aggiornamento quinquennale le rinnova
// entrambe. Tenerle separate mostrerebbe una tipologia "generale" senza scadenza
// accanto a una "specifica" che scade, come se fossero due percorsi indipendenti
// che si possono avere uno senza l'altro.
// Vale solo per la LETTURA: il motore continua a valutarli come requisiti
// distinti, perche' distinti sono (la generale e' prerequisito della specifica).
const PACCHETTI: { chiave: string; titolo: string; codici: string[] }[] = [
  {
    chiave: 'pkg:LAVORATORE',
    titolo: 'Formazione dei lavoratori (generale + specifica)',
    codici: ['LAV_GEN', 'LAV_SPEC'],
  },
];
const PACCHETTO_DI = new Map<string, { chiave: string; titolo: string }>(
  PACCHETTI.flatMap((p) => p.codici.map(
    (c) => [c, { chiave: p.chiave, titolo: p.titolo }] as [string, { chiave: string; titolo: string }])),
);

function scadenzaVoce(f: Formazione, corso: CorsoCatalogo | undefined): string | null {
  if (f.scadenza) return f.scadenza;
  if (!f.data_completamento) return null;
  const mesi = corso?.aggiornamento_mesi ?? null;
  return mesi ? addMesi(f.data_completamento, mesi) : null;
}

export async function componiLibretto(
  clienteId: string,
  personaId: string,
  clienteNome: string,
): Promise<Libretto> {
  const [riep, cat, righe] = await Promise.all([
    valutaCliente(clienteId),
    caricaCatalogo(),
    supabase.from('formazione').select('*').eq('persona_id', personaId)
      .then(({ data, error }) => { if (error) throw error; return (data ?? []) as Formazione[]; }),
  ]);

  const pv = riep.persone.find((x) => x.persona.id === personaId);
  if (!pv) throw new Error('Persona non trovata fra quelle valutate del cliente.');
  const byCodice = new Map(cat.corsi.map((c) => [c.codice, c]));

  const voci: VoceLibretto[] = righe
    .map((f) => ({
      id: f.id,
      corso_nome: f.corso_nome,
      corso_codice: f.corso_codice,
      categoria: f.categoria,
      data_completamento: f.data_completamento,
      ore: f.ore,
      ente_formatore: f.ente_formatore,
      is_aggiornamento: f.is_aggiornamento,
      parziale: f.parziale,
      scadenza: scadenzaVoce(f, f.corso_codice ? byCodice.get(f.corso_codice) : undefined),
      allegato_url: f.allegato_url,
      note: f.note,
    }))
    // Dal piu' vecchio al piu' recente: dentro una tipologia si legge la storia
    // del corso (base, poi gli aggiornamenti). Le righe senza data restano in
    // testa - esistono, sono attestati registrati a mano di cui non si conosce
    // il giorno, e nasconderle in fondo le farebbe sembrare le piu' recenti.
    .sort((a, b) => (a.data_completamento ?? '').localeCompare(b.data_completamento ?? ''));

  // Raggruppamento per tipologia. La chiave e' il CODICE del corso quando c'e':
  // cosi' il modulo ASR 2025 e l'evidenza pregressa che copre lo stesso
  // requisito finiscono nello stesso gruppo, che e' il punto - sono la storia di
  // un unico obbligo. Senza codice (alias non mappato) si ripiega sul nome
  // normalizzato: meglio un gruppo per nome che una riga sciolta per attestato.
  const gruppi: GruppoLibretto[] = [];
  const perChiave = new Map<string, GruppoLibretto>();
  for (const v of voci) {
    const pkg = v.corso_codice ? PACCHETTO_DI.get(v.corso_codice) : undefined;
    const chiave = pkg?.chiave
      ?? v.corso_codice
      ?? 'nome:' + v.corso_nome.trim().toUpperCase().replace(/\s+/g, ' ');
    let g = perChiave.get(chiave);
    if (!g) {
      const corso = v.corso_codice ? byCodice.get(v.corso_codice) : undefined;
      g = {
        chiave,
        titolo: pkg?.titolo ?? corso?.nome ?? v.corso_nome,
        categoria: corso?.categoria ?? v.categoria,
        voci: [], ore_totali: null, scadenza: null,
      };
      perChiave.set(chiave, g);
      gruppi.push(g);
    }
    g.voci.push(v);
  }
  for (const g of gruppi) {
    const conOre = g.voci.filter((v) => v.ore != null);
    g.ore_totali = conOre.length ? conOre.reduce((s, v) => s + (v.ore ?? 0), 0) : null;
    // Scadenza del gruppo: la PIU' LONTANA fra gli attestati interi, non quella
    // dell'ultimo in ordine di data. In un pacchetto l'attestato piu' recente
    // puo' essere quello che non scade (la generale), e prendere la sua direbbe
    // che la formazione del lavoratore non ha scadenza. La piu' lontana e' la
    // data fino a cui l'obbligo risulta coperto, che e' quello che si cerca.
    // Gli spezzoni restano esclusi: da soli non rinnovano niente.
    g.scadenza = g.voci
      .filter((v) => !v.parziale && v.scadenza)
      .map((v) => v.scadenza!)
      .sort()
      .pop() ?? null;
  }
  // Gruppi in ordine alfabetico di titolo: su un documento da consultare conta
  // ritrovare la tipologia, non sapere quale e' stata aggiornata per ultima.
  gruppi.sort((a, b) => a.titolo.localeCompare(b.titolo));

  return {
    generato_il: new Date().toISOString().slice(0, 10),
    cliente_nome: clienteNome,
    persona: {
      nome: nomePersona(pv.persona),
      codice_fiscale: pv.persona.codice_fiscale,
      mansione: pv.persona.mansione,
      reparto: pv.persona.reparto,
      data_assunzione: pv.persona.data_assunzione,
      livello_rischio: pv.persona.livello_rischio ?? riep.livello_rischio,
      attivo: pv.persona.attivo,
    },
    ruoli: pv.figure.map((f) => ({
      codice: f.codice, nome: f.nome, data_nomina: f.data_nomina,
      evidenza_mancante: f.evidenza_mancante,
    })),
    gruppi,
  };
}

// PDF via Edge Function `libretto-pdf` (stessa pipeline PDFBolt di
// `organigramma-pdf`: le Edge Function girano su Deno e non hanno un browser).
// Ritorna l'URL firmato dell'artefatto - PDF, o HTML se PDFBOLT_API_KEY non e'
// configurata lato server, esattamente come per report e organigramma.
export async function esportaPdfLibretto(libretto: Libretto): Promise<string> {
  const { data, error } = await supabase.functions.invoke('libretto-pdf', { body: { libretto } });
  if (error) throw error;
  const d = data as { url?: string; error?: string };
  if (!d?.url) throw new Error(d?.error ?? 'PDF non generato.');
  return d.url;
}
