// Import Werp (Fase 0) - pipeline a 7 stadi.
//
//   [1] SORGENTE (adapter xlsx)  -> unico pezzo dipendente dal meccanismo
//   [2] ESCLUSIONE (oggetto)     -> sez. 5 istruzioni, prefisso, eccezione RSPP+KIT
//   [3] DERIVA N/anno (Documenti)-> sez. 4, PLATINUM/DIAMOND=1, dedup stesso doc
//   [4] CONTA FATTI (Attivita)   -> SOPRALL chiusi nel periodo, per i rimanenti
//   [5] MATCH (app)              -> incarico per werp_id; cliente per P.IVA/CF poi nome
//   [6] MERGE (filosofia C)      -> non sovrascrive il lavoro manuale
//   [7] ESITO                    -> dry-run: numeri e liste prima di scrivere
//
// analizzaWerp() e' DRY-RUN (non scrive nulla): calcola un piano deterministico
// (id generati qui) e lo restituisce dentro EsitoImport._piano. applicaWerp()
// si limita a scrivere quel piano (upsert per id -> idempotente).
//
// NOTE SUI DATI REALI (export Werp 30/06/2026), che si discostano dal disegno:
//  * Il join Documenti<->contratti va fatto su (Numero Documento + Cliente):
//    nei dati veri "470" e "532" collidono tra clienti diversi. Il numero da
//    solo contaminerebbe cliente A con la dichiarazione di B.
//  * L'export non contiene un id-cliente Werp stabile. Quindi:
//      - incarico.werp_id = contratti.Id (stabile per contratto);
//      - il cliente si aggancia per partita_iva/codice_fiscale (colonna CF di
//        anagrafiche) e in fallback per ragione sociale normalizzata.
//  * L'export Documenti e' una fetta recente: molti contratti non trovano la
//    dichiarazione -> finiscono in "Da chiarire" (numero a mano), com'e' giusto
//    dopo la regola del 30/06 (niente stima da Attivita).
//  * Lo stato sopralluogo non ha 'Annullato': un contratto scaduto/disdetto
//    chiude l'incarico e rimuove i suoi sopralluoghi FUTURI ancora 'pianificato'
//    (reversibile), lasciando intatto tutto il resto.

import * as XLSX from 'xlsx';
import { supabase } from '../supabase';
import { distribuisciDate } from './calendario';
import { caricaClienti, clienteVuoto, salvaCliente, salvaIncarico, incaricoVuoto } from './anagrafiche';
import { eliminaSopralluogo, salvaSopralluogo } from './pianificazione';
import { impostaStatoIncarico, impostaStatoCliente } from './anagrafiche';
import { newId, type Cliente, type Incarico, type Sopralluogo } from '../types';

// ============================ [1] SORGENTE ============================

export interface RigaContratto {
  id: string;
  numero_documento: string;
  tipo_contratto: string;
  data_inizio: string | null;   // ISO
  data_fine: string | null;     // ISO
  data_disdetta: string | null; // ISO
  cliente: string;
  oggetto: string;
}
export interface RigaDocumento {
  numero_completo: string;
  cliente: string;
  rif_cliente: string;
  descrizione: string;
}
export interface RigaAttivita {
  cliente: string;
  descrizione: string;
  doc_numero: string;
  data_chiusura: string | null; // ISO
}
export interface RigaAnagrafica {
  ragione_sociale: string;
  cf: string;        // colonna CF: contiene P.IVA (11 cifre) o C.F. (16 char)
  citta: string;
  indirizzo: string;
  telefono: string;
  email: string;
  ateco: string;
}
export interface SorgenteWerp {
  contratti: RigaContratto[];
  documenti: RigaDocumento[];
  attivita: RigaAttivita[];
  anagrafiche: RigaAnagrafica[];
}

const S = (v: unknown): string => (v == null ? '' : String(v)).trim();
const norm = (n: unknown): string => S(n).replace(/\s+/g, ' ').toUpperCase().replace(/\.+$/, '').trim();

// Werp esporta le date come "DD/MM/YYYY" (o come Date se SheetJS le riconosce).
const toISO = (v: unknown): string | null => {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = S(v).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  const iso = S(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
};

// Lettura tollerante per intestazione: prende la prima colonna il cui header
// (normalizzato) contiene una delle chiavi date.
function campo(row: Record<string, unknown>, ...chiavi: string[]): string {
  const keys = Object.keys(row);
  for (const c of chiavi) {
    const k = keys.find((h) => h.toLowerCase().replace(/\s+/g, ' ').includes(c));
    if (k != null && S(row[k]) !== '') return S(row[k]);
  }
  return '';
}

async function foglio(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]!];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
}

// Adapter di oggi: i 4 xlsx che gia' si esportano da Werp. Domani un adapter
// API rimpiazza SOLO questa funzione, il resto del modulo e' identico.
export async function leggiDaXlsx(files: {
  contratti: File; documenti: File; attivita: File; anagrafiche: File;
}): Promise<SorgenteWerp> {
  const [rc, rd, ra, rn] = await Promise.all([
    foglio(files.contratti), foglio(files.documenti),
    foglio(files.attivita), foglio(files.anagrafiche),
  ]);
  return {
    contratti: rc.map((r) => ({
      id: campo(r, 'id'),
      numero_documento: campo(r, 'numero documento', 'numero doc'),
      tipo_contratto: campo(r, 'tipo contratto'),
      data_inizio: toISO(campo(r, 'data inizio')),
      data_fine: toISO(campo(r, 'data fine')),
      data_disdetta: toISO(campo(r, 'data disdetta')),
      cliente: campo(r, 'cliente'),
      oggetto: campo(r, 'oggetto'),
    })),
    documenti: rd.map((r) => ({
      numero_completo: campo(r, 'numero completo'),
      cliente: campo(r, 'cliente'),
      rif_cliente: campo(r, 'rif. cliente', 'rif cliente'),
      descrizione: campo(r, 'descrizione'),
    })),
    attivita: ra.map((r) => ({
      cliente: campo(r, 'cliente'),
      descrizione: campo(r, 'descrizione'),
      doc_numero: campo(r, 'doc numero'),
      data_chiusura: toISO(campo(r, 'data chiusura')),
    })),
    anagrafiche: rn.map((r) => ({
      ragione_sociale: campo(r, 'ragione sociale', 'cognome nome'),
      cf: campo(r, 'cf'),
      citta: campo(r, 'citta', 'citt'),
      indirizzo: campo(r, 'sede legale', 'indirizzo'),
      telefono: campo(r, 'telefono', 'cellulare'),
      email: campo(r, 'e-mail', 'email'),
      ateco: campo(r, 'ateco'),
    })),
  };
}

// ============================ [2] ESCLUSIONE ============================

// Ritorna il motivo di esclusione (sez. 5) o null se il contratto e' rilevante.
// Solo la regola KIT e' scavalcabile dall'eccezione RSPP+KIT (vedi sotto).
function motivoEsclusione(oggetto: string): { motivo: string; soloKit: boolean } | null {
  const o = norm(oggetto);
  if (o.startsWith('KIT ') || o === 'FORMASUBITO' || o.startsWith('= FORMASUBITO'))
    return { motivo: 'KIT formazione', soloKit: true };
  if (o.startsWith('AMB-') || o.startsWith('AMB ')) return { motivo: 'Scadenzario ambientale', soloKit: false };
  if (o.startsWith('PRIV-') || o.startsWith('PRIV ') || o.includes('GDPR') || o.includes('2016/679'))
    return { motivo: 'Privacy / GDPR', soloKit: false };
  if (o.includes('TRASPARENZA') && o.includes('CORRUZIONE')) return { motivo: 'Trasparenza / Corruzione', soloKit: false };
  if (o.startsWith('RENTRI')) return { motivo: 'RENTRI', soloKit: false };
  if (o.includes('ADR')) return { motivo: 'ADR', soloKit: false };
  if (o.includes('ALBOGESTAMB') || o.includes('AMB-RT') || o.includes('AGA') || o.endsWith('-RT'))
    return { motivo: 'RT / Albo Gestori', soloKit: false };
  if (o.includes('SCADENZARIO DIGITALE')) return { motivo: 'Scadenzario digitale', soloKit: false };
  return null;
}

// ============================ [3] DERIVA N/anno ============================

const RX_VIS = '(?:sopralluogh|sedut[ae]|visit[ae]|audit|intervent)';
// "N. 2 sopralluoghi..."
const rxNumVis = new RegExp('n[\\u00b0\\u00bao.]*\\s*(\\d+)\\s*' + RX_VIS, 'i');
// "SOPRALLUOGHI PERIODICI in n. di 1/anno"
const rxInNdi = new RegExp(RX_VIS + '[^.]{0,40}?in\\s*n[\\u00b0\\u00bao.]*\\s*di\\s*(\\d+)', 'i');
// segnaposto template vuoto: "N./", "N. XX", "N.N."
const rxTemplateVuoto = new RegExp('n[\\u00b0\\u00bao.]*\\s*(?:/|x{1,2}\\b|n\\.)\\s*' + RX_VIS, 'i');

const RIF_CORSO = /(corso|agg\.|aggiorn|kit|x1|progetto form|form\. |e-l|elearning|videoconf|ex libretto)/i;
const RIGA_BONUS = /(videoconferenz|bonus|extra)/i;
const TAG_SCADENZE = /\[scadenze(platinum|diamond|plus|gold|basic)/i;
const OGG_PLATINUM = /(platinum|diamond)/i;

type DerivaN =
  | { esito: 'numero'; n: number; perAnno: boolean }
  | { esito: 'chiarire' };

// Estrae la dichiarazione dalla Descrizione (gia' ripulita dalle righe bonus).
function estraiN(descr: string): DerivaN {
  const t = descr.replace(/\s+/g, ' ');
  const inNdi = rxInNdi.exec(t);
  if (inNdi) return { esito: 'numero', n: Number(inNdi[1]), perAnno: /\/\s*ann|\bann/i.test(t.slice(inNdi.index)) };
  const nv = rxNumVis.exec(t);
  if (nv) {
    const coda = t.slice(nv.index, nv.index + 60);
    const totale = /(durat|arco|nell'arco|nel period|per il period)/i.test(coda);
    return { esito: 'numero', n: Number(nv[1]), perAnno: !totale };
  }
  return { esito: 'chiarire' };
}

// Descrizione unita delle righe Documenti pertinenti (stesso numero + cliente),
// escluse le righe-corso via Rif. Cliente.
function descrizionePertinente(docs: RigaDocumento[]): string {
  return docs.filter((d) => !RIF_CORSO.test(d.rif_cliente)).map((d) => d.descrizione).join('\n');
}

function derivaContratto(oggetto: string, docs: RigaDocumento[]): DerivaN {
  const grezza = descrizionePertinente(docs);
  if (!grezza.trim()) return { esito: 'chiarire' };

  const platinum = TAG_SCADENZE.test(grezza) || OGG_PLATINUM.test(oggetto);
  // PLATINUM/DIAMOND: 1 fisico + 1 videoconferenza -> conta solo il fisico.
  const pulita = grezza.split('\n').filter((r) => !RIGA_BONUS.test(r)).join('\n');
  if (platinum) {
    const d = estraiN(pulita);
    // Il pacchetto dichiara sopralluoghi ma il conteggio fisico e' 1/anno.
    if (d.esito === 'numero') return { esito: 'numero', n: 1, perAnno: true };
    return { esito: 'chiarire' };
  }
  if (rxTemplateVuoto.test(pulita)) return { esito: 'chiarire' };
  return estraiN(pulita);
}

// ============================ [4] CONTA FATTI ============================

function contaFatti(att: RigaAttivita[], cliente: string, numeroDoc: string,
  inizio: string | null, fine: string | null): number {
  const c = norm(cliente);
  return att.filter((a) =>
    norm(a.cliente) === c &&
    /soprall/i.test(a.descrizione) &&
    a.data_chiusura != null &&
    (inizio == null || a.data_chiusura >= inizio) &&
    (fine == null || a.data_chiusura <= fine) &&
    (a.doc_numero === '' || a.doc_numero === numeroDoc),
  ).length;
}

// ============================ ESITO ============================

export interface EsitoImport {
  clientiNuovi: { ragioneSociale: string; werp_id: string | null }[];
  clientiAggiornati: { ragioneSociale: string; campi: string[] }[];
  contrattiScaduti: { cliente: string; werp_id: string }[];
  sopralluoghiGenerati: number;
  daRivedere: { cliente: string; werp_id: string; campo: string; valore_app: string; valore_werp: string }[];
  daChiarire: { cliente: string; werp_id: string; oggetto: string; periodo: string }[];
  esclusi: { cliente: string; oggetto: string; motivo: string }[];
  log: string[];
  _piano: Piano;
}

interface Piano {
  clienti: Cliente[];
  incarichi: Incarico[];
  sopralluoghi: Sopralluogo[];
  daRivedere: { cliente_id: string; werp_id: string; campo: string; valore_app: string; valore_werp: string }[];
  daChiarire: { cliente_id: string; werp_id: string; oggetto: string; periodo: string }[];
  scaduti: { incaricoId: string; clienteId: string; disattivaCliente: boolean }[];
}

// ============================ [5][6][7] MATCH + MERGE + ESITO ============================

const oggiISO = (): string => new Date().toISOString().slice(0, 10);
const anniTra = (a: string, b: string): number =>
  Math.max(0, (Date.parse(b) - Date.parse(a)) / (365.25 * 86_400_000));

// P.IVA (11 cifre) o C.F. (16) dalla colonna CF.
function pivaCf(cf: string): { piva: string | null; codf: string | null } {
  const v = S(cf).toUpperCase();
  if (/^\d{11}$/.test(v)) return { piva: v, codf: null };
  if (/^[A-Z0-9]{16}$/.test(v)) return { piva: null, codf: v };
  return { piva: null, codf: null };
}

export async function analizzaWerp(s: SorgenteWerp): Promise<EsitoImport> {
  const log: string[] = [];

  // indici
  const docByKey = new Map<string, RigaDocumento[]>();
  for (const d of s.documenti) {
    const k = `${d.numero_completo}::${norm(d.cliente)}`;
    (docByKey.get(k) ?? docByKey.set(k, []).get(k)!).push(d);
  }
  const anagByNome = new Map<string, RigaAnagrafica>();
  for (const a of s.anagrafiche) anagByNome.set(norm(a.ragione_sociale), a);

  // clienti esistenti (per P.IVA/CF poi nome)
  const righeCli = await caricaClienti();
  const cliByPiva = new Map<string, Cliente>();
  const cliByNome = new Map<string, Cliente>();
  for (const r of righeCli) {
    if (r.cliente.partita_iva) cliByPiva.set(S(r.cliente.partita_iva), r.cliente);
    if (r.cliente.codice_fiscale) cliByPiva.set(S(r.cliente.codice_fiscale).toUpperCase(), r.cliente);
    cliByNome.set(norm(r.cliente.ragione_sociale), r.cliente);
  }
  // incarichi esistenti per werp_id
  const { data: incRows } = await supabase
    .from('incarico').select('id, cliente_id, werp_id, n_sopralluoghi, stato');
  const incByWerp = new Map<string, { id: string; cliente_id: string; n_sopralluoghi: number; stato: string }>();
  for (const i of (incRows ?? []) as any[]) if (i.werp_id) incByWerp.set(S(i.werp_id), i);

  const esito: EsitoImport = {
    clientiNuovi: [], clientiAggiornati: [], contrattiScaduti: [],
    sopralluoghiGenerati: 0, daRivedere: [], daChiarire: [], esclusi: [], log,
    _piano: { clienti: [], incarichi: [], sopralluoghi: [], daRivedere: [], daChiarire: [], scaduti: [] },
  };

  // raggruppa i contratti per cliente
  const perCliente = new Map<string, RigaContratto[]>();
  for (const c of s.contratti) (perCliente.get(norm(c.cliente)) ?? perCliente.set(norm(c.cliente), []).get(norm(c.cliente))!).push(c);

  const oggi = oggiISO();

  for (const [nomeCli, contratti] of perCliente) {
    // separa rilevanti / esclusi (con eccezione RSPP+KIT)
    const rilevanti: RigaContratto[] = [];
    for (const c of contratti) {
      const ex = motivoEsclusione(c.oggetto);
      if (!ex) { rilevanti.push(c); continue; }
      // eccezione: solo per la regola KIT, se il documento e' RSPP e dichiara sopralluoghi
      if (ex.soloKit) {
        const docs = docByKey.get(`${c.numero_documento}::${nomeCli}`) ?? [];
        const testo = docs.map((d) => d.descrizione).join('\n');
        const eRspp = /\[rspp_assistenza\+kit\]|consulenza continuativa al responsabile del servizio di prevenzione/i.test(testo);
        if (eRspp && derivaContratto(c.oggetto, docs).esito === 'numero') { rilevanti.push(c); continue; }
      }
      esito.esclusi.push({ cliente: c.cliente, oggetto: c.oggetto, motivo: ex.motivo });
    }
    if (rilevanti.length === 0) continue; // cliente con soli contratti esclusi -> fuori

    // risolvi/crea il cliente app
    const anag = anagByNome.get(nomeCli);
    const { piva, codf } = pivaCf(anag?.cf ?? '');
    let cliente = (piva && cliByPiva.get(piva)) || (codf && cliByPiva.get(codf)) || cliByNome.get(nomeCli) || null;
    let clienteNuovo = false;
    if (!cliente) {
      cliente = clienteVuoto();
      cliente.ragione_sociale = S(rilevanti[0]!.cliente);
      clienteNuovo = true;
    }
    // arricchimento non distruttivo: riempi solo i campi vuoti
    const campiTocc: string[] = [];
    const set = (k: keyof Cliente, v: string | null) => {
      if (v && !S((cliente as any)[k])) { (cliente as any)[k] = v; campiTocc.push(k as string); }
    };
    if (anag) {
      set('partita_iva', piva); set('codice_fiscale', codf);
      set('localita', anag.citta || null); set('indirizzo', anag.indirizzo || null);
      set('telefono', anag.telefono || null); set('email', anag.email || null);
      set('codice_ateco', anag.ateco || null);
    }
    if (clienteNuovo) esito.clientiNuovi.push({ ragioneSociale: cliente.ragione_sociale, werp_id: cliente.werp_id });
    else if (campiTocc.length) esito.clientiAggiornati.push({ ragioneSociale: cliente.ragione_sociale, campi: campiTocc });
    if (clienteNuovo || campiTocc.length) esito._piano.clienti.push(cliente);

    // dedup stesso documento: N contato una volta sola per (numero_documento)
    const docUsato = new Set<string>();

    for (const c of rilevanti) {
      const werpId = S(c.id);
      const scaduto = c.data_disdetta != null || (c.data_fine != null && c.data_fine < oggi);
      const esistente = incByWerp.get(werpId);
      const periodoTxt = `${c.data_inizio ?? '?'} - ${c.data_fine ?? '?'}`;

      // contratto scaduto/disdetto
      if (scaduto) {
        esito.contrattiScaduti.push({ cliente: cliente.ragione_sociale, werp_id: werpId });
        if (esistente) {
          esito._piano.scaduti.push({
            incaricoId: esistente.id, clienteId: cliente.id,
            disattivaCliente: false, // deciso in [applica] dopo aver chiuso tutto
          });
        }
        continue; // niente sopralluoghi per gli scaduti
      }

      // deriva N/anno
      const docs = docByKey.get(`${c.numero_documento}::${nomeCli}`) ?? [];
      const dup = c.numero_documento !== '' && docUsato.has(c.numero_documento);
      const der = dup ? { esito: 'chiarire' as const } : derivaContratto(c.oggetto, docs);
      if (der.esito === 'numero' && c.numero_documento !== '') docUsato.add(c.numero_documento);

      if (der.esito !== 'numero') {
        // Da chiarire (numero a mano). I duplicati doc restano fuori dal conteggio.
        if (!dup) esito.daChiarire.push({ cliente: cliente.ragione_sociale, werp_id: werpId, oggetto: c.oggetto, periodo: periodoTxt });
        if (!dup) esito._piano.daChiarire.push({ cliente_id: cliente.id, werp_id: werpId, oggetto: c.oggetto, periodo: periodoTxt });
        continue;
      }

      // N totale sul periodo
      const durata = (c.data_inizio && c.data_fine) ? anniTra(c.data_inizio, c.data_fine) : 1;
      const nTot = Math.max(1, der.perAnno ? Math.round(der.n * durata) : der.n);

      // contratto gia' presente con N diverso -> Da rivedere (non sovrascrive)
      if (esistente) {
        if (esistente.n_sopralluoghi !== nTot) {
          esito.daRivedere.push({
            cliente: cliente.ragione_sociale, werp_id: werpId, campo: 'n_sopralluoghi',
            valore_app: String(esistente.n_sopralluoghi), valore_werp: String(nTot),
          });
          esito._piano.daRivedere.push({
            cliente_id: cliente.id, werp_id: werpId, campo: 'n_sopralluoghi',
            valore_app: String(esistente.n_sopralluoghi), valore_werp: String(nTot),
          });
        }
        continue; // esistente: mai toccato dall'import
      }

      // nuovo incarico + rimanenti = dovuti - fatti, da oggi
      const inc = incaricoVuoto(cliente.id);
      inc.werp_id = werpId;
      inc.tipo_attivita = S(c.oggetto) || 'RSPP';
      inc.periodo_inizio = c.data_inizio ?? oggi;
      inc.periodo_fine = c.data_fine ?? c.data_inizio ?? oggi;
      inc.n_sopralluoghi = nTot;
      esito._piano.incarichi.push(inc);

      const fatti = contaFatti(s.attivita, c.cliente, c.numero_documento, c.data_inizio, c.data_fine);
      const rimanenti = Math.max(nTot - fatti, 0);
      const da = c.data_inizio && c.data_inizio > oggi ? c.data_inizio : oggi;
      const date = distribuisciDate(da, inc.periodo_fine, rimanenti);
      for (let k = 0; k < rimanenti; k++) {
        esito._piano.sopralluoghi.push({
          id: newId(), incarico_id: inc.id,
          progressivo: `${fatti + k + 1}/${nTot}`,
          tecnico_id: null, data_pianificata: date[k] ?? null, data_effettiva: null,
          durata_stimata_min: inc.durata_seduta_stimata_min, durata_effettiva_min: null,
          localita: cliente.localita, stato: 'pianificato',
          werp_attivita_id: null, sede_id: null,
        });
      }
      esito.sopralluoghiGenerati += rimanenti;
      if (fatti > 0) log.push(`${cliente.ragione_sociale}: dovuti ${nTot}, fatti ${fatti}, rimanenti ${rimanenti}`);
    }
  }

  log.unshift(
    `Contratti letti: ${s.contratti.length} | clienti nuovi: ${esito.clientiNuovi.length} | ` +
    `incarichi nuovi: ${esito._piano.incarichi.length} | sopralluoghi: ${esito.sopralluoghiGenerati} | ` +
    `da rivedere: ${esito.daRivedere.length} | da chiarire: ${esito.daChiarire.length} | ` +
    `scaduti: ${esito.contrattiScaduti.length} | esclusi: ${esito.esclusi.length}`,
  );
  return esito;
}

// ============================ APPLICA (scrive) ============================

export interface RisultatoApplica {
  clienti: number; incarichi: number; sopralluoghi: number;
  daRivedere: number; daChiarire: number; scaduti: number;
}

export async function applicaWerp(esito: EsitoImport): Promise<RisultatoApplica> {
  const p = esito._piano;

  for (const c of p.clienti) await salvaCliente(c);
  for (const i of p.incarichi) await salvaIncarico(i);
  for (const sopr of p.sopralluoghi) await salvaSopralluogo(sopr);

  // chiusura contratti scaduti: incarico -> chiuso, rimuovi i sopralluoghi
  // FUTURI ancora 'pianificato' (reversibile), poi disattiva il cliente se
  // non gli resta alcun incarico attivo.
  const oggi = oggiISO();
  const clientiDaVerificare = new Set<string>();
  for (const sc of p.scaduti) {
    await impostaStatoIncarico(sc.incaricoId, 'chiuso');
    const { data } = await supabase
      .from('sopralluogo').select('id, data_pianificata, stato')
      .eq('incarico_id', sc.incaricoId).eq('stato', 'pianificato');
    for (const s of (data ?? []) as any[]) {
      if (!s.data_pianificata || s.data_pianificata >= oggi) {
        try { await eliminaSopralluogo(s.id); } catch { /* ha compilazione: si lascia */ }
      }
    }
    clientiDaVerificare.add(sc.clienteId);
  }
  for (const cid of clientiDaVerificare) {
    const { count } = await supabase
      .from('incarico').select('id', { count: 'exact', head: true })
      .eq('cliente_id', cid).eq('stato', 'attivo');
    if ((count ?? 0) === 0) await impostaStatoCliente(cid, false);
  }

  if (p.daRivedere.length) {
    await supabase.from('werp_da_rivedere').upsert(
      p.daRivedere.map((r) => ({
        cliente_id: r.cliente_id, werp_id: r.werp_id, campo: r.campo,
        valore_app: r.valore_app, valore_werp: r.valore_werp,
      })), { onConflict: 'werp_id,campo' },
    );
  }
  if (p.daChiarire.length) {
    await supabase.from('werp_da_chiarire').upsert(
      p.daChiarire.map((r) => ({
        cliente_id: r.cliente_id, werp_id: r.werp_id, oggetto: r.oggetto, periodo: r.periodo,
      })), { onConflict: 'werp_id' },
    );
  }

  return {
    clienti: p.clienti.length, incarichi: p.incarichi.length, sopralluoghi: p.sopralluoghi.length,
    daRivedere: p.daRivedere.length, daChiarire: p.daChiarire.length, scaduti: p.scaduti.length,
  };
}
