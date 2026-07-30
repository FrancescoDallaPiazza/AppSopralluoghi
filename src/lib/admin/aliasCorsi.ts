// C1a - catalogo corsi del GESTIONALE -> dizionario `corso_alias`.
//
// Non confondere con `catalogoImport.ts`: quello pulisce l'xlsx ASR (la legge,
// per codici curati). Questo legge l'export "Formazione" del gestionale, cioe'
// i NOMI che il gestionale usa davvero, e li deposita in `corso_alias` per
// essere mappati sui codici del catalogo ASR.
//
// Perche' un dizionario permanente e non un passaggio dell'import: una volta
// mappato un testo, ogni import successivo lo risolve da solo. Il lavoro e'
// decrescente e a regime si mappa solo quando il gestionale inventa un nome
// nuovo. L'export e' l'universo COMPLETO: non si scopre cliente per cliente,
// si carica una volta.
//
// QUALE export. Il gestionale ne offre due che si somigliano e NON sono la
// stessa cosa. Quello giusto e' **elencoAnagraficaFormazioni** (foglio
// "Anagrafica Formazione", 268 corsi): e' l'intero catalogo. "ExportExcel"
// (74 righe) e' la sola categoria "Generica" - verificato: le sue 74 righe
// sono esattamente le 74 righe con Categoria='Generica' del file completo -
// e caricandolo si mappa il 28% del catalogo credendo di averlo finito.
//
// FATTI VERIFICATI SUL FILE (foglio unico):
//  * riga 0 = titolo, riga 1 = header, dati dalla riga 2;
//  * colonne: Corso | Durata (h) | Periodicita' | Tipologia | Categoria;
//  * le ultime due righe NON sono corsi ('https://overall.sgslweb.com/' e
//    'Dati aggiornati al ...'): hanno Durata e Tipologia vuote -> si saltano;
//  * `Tipologia` NON e' un filtro affidabile (in "Formazione generica" stanno
//    sia il carroponte 81/08 sia il patentino fitosanitari): si presentano
//    tutte le righe, il flag `ignorato` fa il lavoro;
//  * `Categoria` invece e' il segnale utile per MAPPARE (non per filtrare):
//    separa il catalogo ufficiale - "Accordo Stato Regioni 2025",
//    "Attrezzature", "Aggiornamenti", "Lavoratore", "RSPP 2016" - dal bucket
//    legacy "Generica", ed e' cio' che distingue un modulo B del 2016 dal suo
//    omonimo ASR 2025. Non si salva in `corso_alias`: come le ore, serve a
//    decidere ed e' sempre a un upload di distanza;
//  * `%20` nella Tipologia e' uno spazio URL-encoded (l'export e' grezzo):
//    si ripulisce solo per mostrarla, non e' un dato che salviamo.
//
// NORMALIZZAZIONE: maiuscolo + spazi collassati + trim, nient'altro. Niente
// rimozione di parole: il catalogo ha quasi-duplicati con ore diverse che NON
// sono errori ("Integrazione formazione specifica lavoratori - rischio alto" 8h
// vs "...lavoratori-rischio alto" 4h). Verificato: le 268 righe danno 268
// chiavi distinte, nessuna collisione.

import * as XLSX from 'xlsx';
import { supabase } from '../supabase';
import { periodicitaMesi } from './catalogoImport';

// ============================ TIPI ============================

// Una riga del catalogo del gestionale, come letta dal file.
export interface RigaCatalogoGestionale {
  testo: string;                    // normalizzato = chiave dell'alias
  originale: string;                // com'e' scritto nell'export
  ore: number | null;
  periodicita_mesi: number | null;
  tipologia: string;
  categoria: string;                // '' sui vecchi export senza colonna E
}

export interface CorsoAlias {
  id: string;
  testo_gestionale: string;
  corso_codice: string | null;      // null e non ignorato = da mappare
  ignorato: boolean;
  pregressa: boolean;
  // true = l'alias e' l'AGGIORNAMENTO periodico di corso_codice, non l'iniziale.
  // Il gestionale ha due righe, corso_catalogo un codice solo: l'aggiornamento
  // e' una coppia di colonne del corso base, non un corso a se'. Quindi le due
  // righe si mappano sullo stesso codice e le distingue solo questo flag.
  is_aggiornamento: boolean;
  note: string | null;
}

// Dry-run del confronto file <-> dizionario in app.
export interface EsitoAlias {
  righe: number;                    // righe-corso lette dal file
  nuovi: RigaCatalogoGestionale[];  // da inserire (corso_codice null)
  presenti: number;                 // gia' nel dizionario
  assenti: CorsoAlias[];            // in app ma non piu' nel file (non si toccano)
}

// ============================ [1] SORGENTE ============================

const S = (v: unknown): string => (v == null ? '' : String(v)).trim();

export const normalizzaTestoGestionale = (s: string): string =>
  s.replace(/\s+/g, ' ').trim().toUpperCase();

// L'export URL-encoda gli spazi ma non gli apostrofi: decodeURIComponent
// romperebbe su stringhe a meta'. Lo spazio e' l'unico caso reale.
export const tipologiaLeggibile = (t: string): string => t.replace(/%20/g, ' ');

export async function leggiCatalogoGestionale(file: File): Promise<RigaCatalogoGestionale[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]!];
  if (!ws) return [];
  const griglia = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false });

  const out: RigaCatalogoGestionale[] = [];
  const visti = new Set<string>();
  for (const r of griglia.slice(2)) { // riga 0 titolo, riga 1 header
    const originale = S(r[0]);
    const durata = S(r[1]);
    const tipologia = S(r[3]);
    if (!originale) continue;
    if (!durata && !tipologia) continue; // coda del file: url + "Dati aggiornati al ..."
    const testo = normalizzaTestoGestionale(originale);
    if (visti.has(testo)) continue;
    visti.add(testo);
    const ore = durata.match(/\d+/);
    out.push({
      testo,
      originale,
      ore: ore ? Number(ore[0]) : null,
      periodicita_mesi: periodicitaMesi(S(r[2])),
      tipologia,
      categoria: S(r[4]),           // manca sui vecchi export: S() la rende ''
    });
  }
  return out;
}

// ============================ [2] DIZIONARIO ============================

export async function caricaAlias(): Promise<CorsoAlias[]> {
  const { data, error } = await supabase
    .from('corso_alias')
    .select('id, testo_gestionale, corso_codice, ignorato, pregressa, is_aggiornamento, note')
    .order('testo_gestionale');
  if (error) throw error;
  return (data ?? []) as CorsoAlias[];
}

export const daMappare = (a: CorsoAlias): boolean => !a.corso_codice && !a.ignorato;

export async function aggiornaAlias(
  id: string,
  patch: Partial<Pick<CorsoAlias, 'corso_codice' | 'ignorato' | 'pregressa' | 'is_aggiornamento' | 'note'>>,
): Promise<void> {
  const { error } = await supabase.from('corso_alias').update(patch).eq('id', id);
  if (error) throw error;
}

// ============================ [3] RICONCILIAZIONE ============================

// Dry-run: nulla va su disco prima della conferma.
export function riconciliaAlias(righe: RigaCatalogoGestionale[], alias: CorsoAlias[]): EsitoAlias {
  const inApp = new Set(alias.map((a) => a.testo_gestionale));
  const nelFile = new Set(righe.map((r) => r.testo));
  return {
    righe: righe.length,
    nuovi: righe.filter((r) => !inApp.has(r.testo)),
    presenti: righe.filter((r) => inApp.has(r.testo)).length,
    assenti: alias.filter((a) => !nelFile.has(a.testo_gestionale)),
  };
}

// Scrive SOLO i nuovi, con corso_codice null ("da mappare", stesso pattern
// "Da chiarire" dei contratti Werp). Le righe gia' presenti non si toccano:
// porterebbero via la mappatura fatta a mano.
export async function applicaAlias(esito: EsitoAlias): Promise<number> {
  if (esito.nuovi.length === 0) return 0;
  const { error } = await supabase.from('corso_alias').insert(
    esito.nuovi.map((r) => ({ testo_gestionale: r.testo, corso_codice: null })),
  );
  if (error) throw error;
  return esito.nuovi.length;
}
