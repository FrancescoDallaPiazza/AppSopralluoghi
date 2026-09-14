// Assemblaggio dati del report (modello "form configurabile").
// Gira lato server con service role: risolve le etichette delle risposte dalle
// opzioni del template, costruisce l'albero esiti/sotto-domande, incorpora le
// foto in base64 e calcola la CONTINUITÀ col giro precedente (azioni chiuse in
// questa visita + ancora aperte dai sopralluoghi precedenti dello stesso incarico).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const BUCKET_FOTO = 'foto-sopralluoghi';
const MAX_FOTO = 4;

export type Variante = 'cliente' | 'interna';

// Dove sta una risposta data dentro un box: il box, la sezione e, per le sezioni
// ripetibili, il componente (etichetta · matricola · ubicazione, come in campo).
export interface GruppoDisplay {
  box: string;
  sezione: string | null;
  componente: string | null;
}
export interface EsitoDisplay {
  sezione: string | null;
  testo: string;
  tipo: string;
  stato: 'conforme' | 'non_conforme' | 'non_applicabile' | null;
  valore: string | null;     // etichetta leggibile della risposta
  note: string | null;
  foto: string[];            // data URI
  figli: EsitoDisplay[];
  gruppo: GruppoDisplay | null;  // null = voce del template piatto
}
export interface AzioneDisplay {
  descrizione: string;
  tipo: 'azione_correttiva' | 'scadenza_ricorrente';
  responsabile_tipo: 'cliente' | 'risorsa_interna';
  responsabile_nome: string;
  data_scadenza: string | null;
  priorita: string;
  periodicita_mesi: number | null;
  origine_voce: string | null;
  stato: string;
}
export interface ReportData {
  variante: Variante;
  cliente: { ragione_sociale: string; localita: string | null; indirizzo: string | null };
  incarico: { tipo_attivita: string | null; n_sopralluoghi: number | null };
  sopralluogo: { progressivo: string | null; data: string | null; durata_min: number | null; localita: string | null };
  revisione: { numero: number; dal: string | null };
  tecnico: { nome: string | null };
  conteggi: { conformi: number; non_conformi: number; non_applicabili: number; totale: number };
  esiti: EsitoDisplay[];
  azioni: AzioneDisplay[];
  continuita: { chiuseQui: AzioneDisplay[]; ancoraAperte: AzioneDisplay[] };
  hasChecklist: boolean;
}

const uno = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));

async function fotoBase64(sb: SupabaseClient, path: string): Promise<string | null> {
  try {
    const { data, error } = await sb.storage.from(BUCKET_FOTO).download(path);
    if (error || !data) return null;
    const buf = new Uint8Array(await data.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const mime = data.type && data.type.startsWith('image/') ? data.type : 'image/jpeg';
    return `data:${mime};base64,${btoa(bin)}`;
  } catch { return null; }
}

function etichettaValore(voce: any, valore: unknown): string | null {
  if (valore === null || valore === undefined || valore === '') return null;
  const opz: any[] = voce?.config?.opzioni ?? [];
  if (voce?.tipo === 'multiscelta' && Array.isArray(valore)) {
    return valore.map((k) => opz.find((o) => o.chiave === k)?.etichetta ?? String(k)).join(', ') || null;
  }
  if (voce?.tipo === 'scelta') {
    return opz.find((o) => o.chiave === valore)?.etichetta ?? String(valore);
  }
  return String(valore);
}

function azioneDisplay(a: any, clienteNome: string): AzioneDisplay {
  const interno = uno<any>(a.responsabile_interno);
  const orig = uno<any>(a.origine);
  return {
    descrizione: a.descrizione,
    tipo: a.tipo,
    responsabile_tipo: a.responsabile_tipo,
    responsabile_nome: a.responsabile_tipo === 'cliente' ? clienteNome : (interno?.nome ?? 'Risorsa interna'),
    data_scadenza: a.data_scadenza,
    priorita: a.priorita,
    periodicita_mesi: a.periodicita_mesi ?? null,
    origine_voce: orig?.voce_testo ?? null,
    stato: a.stato,
  };
}

const SEL_AZIONE = `
  descrizione, tipo, responsabile_tipo, data_scadenza, priorita, periodicita_mesi, stato,
  sopralluogo_origine_id, sopralluogo_verifica_id,
  responsabile_interno:tecnico!responsabile_interno_id ( nome ),
  origine:esito_voce!origine_esito_id ( voce_testo )`;

export async function assemblaReport(
  sb: SupabaseClient, sopralluogoId: string, variante: Variante,
): Promise<ReportData> {
  // 1) sopralluogo + incarico + cliente + tecnico
  const { data: sop, error: e1 } = await sb
    .from('sopralluogo')
    .select(`
      id, incarico_id, progressivo, data_effettiva, data_pianificata, durata_effettiva_min, localita,
      tecnico:tecnico!tecnico_id ( nome ),
      incarico:incarico!incarico_id (
        tipo_attivita, n_sopralluoghi,
        cliente:cliente!cliente_id ( ragione_sociale, localita, indirizzo ) )`)
    .eq('id', sopralluogoId).maybeSingle();
  if (e1) throw e1;
  if (!sop) throw new Error('Sopralluogo non trovato.');
  const inc = uno<any>((sop as any).incarico);
  const cli = uno<any>(inc?.cliente);
  const tec = uno<any>((sop as any).tecnico);
  const clienteNome = cli?.ragione_sociale ?? 'Cliente';
  const incaricoId = (sop as any).incarico_id;

  // 2) compilata + voci (template) + esiti
  const { data: comp } = await sb.from('checklist_compilata')
    .select('id, template_id').eq('sopralluogo_id', sopralluogoId).maybeSingle();

  const esitiTop: EsitoDisplay[] = [];
  let conformi = 0, non_conformi = 0, non_applicabili = 0, totale = 0;

  if (comp) {
    const { data: esRaw } = await sb.from('esito_voce')
      .select('id, voce_template_id, voce_tipo, voce_testo, voce_sezione, ordine, parent_esito_id, stato, valore, note, componente_id')
      .eq('checklist_compilata_id', (comp as any).id)
      .order('ordine', { ascending: true });
    const esiti = (esRaw ?? []) as any[];

    // LE VOCI SI CARICANO PER ID, NON PER TEMPLATE (D2). Le voci dei box hanno
    // `template_id` NULL e `sezione_id` valorizzato (migrazione 030): con il
    // filtro sul template restavano fuori, e le loro risposte uscivano con la
    // chiave grezza e senza dire di quale componente fossero. Qui un errore di
    // lettura ferma il report, perche' un report appiattito in silenzio e'
    // proprio il difetto che si ripara.
    const perIds = async (tabella: string, colonne: string, ids: unknown[]): Promise<any[]> => {
      const unici = [...new Set(ids.filter((x): x is string => typeof x === 'string'))];
      const out: any[] = [];
      for (let i = 0; i < unici.length; i += 100) {
        const { data, error } = await sb.from(tabella).select(colonne).in('id', unici.slice(i, i + 100));
        if (error) throw error;
        out.push(...((data ?? []) as any[]));
      }
      return out;
    };
    const vociById = new Map<string, any>();
    for (const v of await perIds('voce_template', 'id, tipo, config, sezione_id, ordine', esiti.map((e) => e.voce_template_id))) {
      vociById.set(v.id, v);
    }
    const sezById = new Map<string, any>();
    for (const s of await perIds('box_sezione', 'id, box_id, nome, ordine', [...vociById.values()].map((v) => v.sezione_id))) {
      sezById.set(s.id, s);
    }
    const boxById = new Map<string, any>();
    for (const b of await perIds('box_catalogo', 'id, nome', [...sezById.values()].map((s) => s.box_id))) {
      boxById.set(b.id, b);
    }
    const compById = new Map<string, any>();
    for (const c of await perIds('componente_sito', 'id, etichetta, matricola, ubicazione', esiti.map((e) => e.componente_id))) {
      compById.set(c.id, c);
    }
    const ordineBox = new Map<string, number>();
    if (boxById.size) {
      const { data: sbox, error: eBox } = await sb.from('sopralluogo_box')
        .select('box_id, ordine').eq('sopralluogo_id', sopralluogoId);
      if (eBox) throw eBox;
      for (const r of (sbox ?? []) as any[]) ordineBox.set(r.box_id, r.ordine);
    }

    // Il componente si scrive come in campo (BoxGenerico): etichetta · matricola · ubicazione.
    const sezioneDi = (e: any) => sezById.get(vociById.get(e.voce_template_id)?.sezione_id);
    const gruppoDi = (e: any): GruppoDisplay | null => {
      const sez = sezioneDi(e);
      const c = e.componente_id ? compById.get(e.componente_id) : undefined;
      if (!sez && !c) return null;
      return {
        box: boxById.get(sez?.box_id)?.nome ?? 'Box',
        sezione: sez?.nome ?? null,
        componente: c ? [c.etichetta, c.matricola, c.ubicazione].filter(Boolean).join(' · ') : null,
      };
    };

    // foto per esito
    const fotoByEsito = new Map<string, string[]>();
    const ids = esiti.map((e) => e.id);
    if (ids.length) {
      const { data: foto } = await sb.from('foto')
        .select('esito_voce_id, url, thumb_url, ordine').in('esito_voce_id', ids)
        .order('ordine', { ascending: true });
      for (const f of (foto ?? []) as any[]) {
        const arr = fotoByEsito.get(f.esito_voce_id) ?? [];
        if (arr.length < MAX_FOTO) { const u = await fotoBase64(sb, f.thumb_url ?? f.url); if (u) arr.push(u); }
        fotoByEsito.set(f.esito_voce_id, arr);
      }
    }

    const figliByParent = new Map<string, any[]>();
    for (const e of esiti) if (e.parent_esito_id) {
      const arr = figliByParent.get(e.parent_esito_id) ?? []; arr.push(e); figliByParent.set(e.parent_esito_id, arr);
    }
    const haContenuto = (e: any) =>
      (e.valore !== null && e.valore !== undefined && e.valore !== '') ||
      (fotoByEsito.get(e.id)?.length ?? 0) > 0 ||
      (figliByParent.get(e.id)?.length ?? 0) > 0;

    const toDisplay = (e: any): EsitoDisplay => {
      const voce = vociById.get(e.voce_template_id);
      const figli = (figliByParent.get(e.id) ?? []).filter(haContenuto).map(toDisplay);
      return {
        sezione: e.voce_sezione, testo: e.voce_testo, tipo: e.voce_tipo ?? 'scelta',
        stato: e.stato ?? null, valore: etichettaValore(voce, e.valore),
        note: e.note, foto: fotoByEsito.get(e.id) ?? [], figli,
        gruppo: e.parent_esito_id ? null : gruppoDi(e),
      };
    };

    for (const e of esiti) {
      if (e.stato === 'conforme') conformi++;
      else if (e.stato === 'non_conforme') non_conformi++;
      else if (e.stato === 'non_applicabile') non_applicabili++;
      if (e.stato) totale++;
    }

    // L'ordine del campo: prima le voci del template piatto, poi i box
    // nell'ordine del giro, le sezioni nel loro, i componenti per etichetta
    // (come BoxGenerico) e dentro ciascuno l'ordine delle voci. Ordinando solo
    // per `ordine`, le risposte di N componenti alla stessa voce uscivano
    // intrecciate. `sort` e' stabile.
    const chiave = (e: any): [number, number, number, string, string, number] => {
      const sez = sezioneDi(e);
      if (!sez) return [0, 0, 0, '', '', e.ordine ?? 0];
      const c = e.componente_id ? compById.get(e.componente_id) : undefined;
      return [1, ordineBox.get(sez.box_id) ?? Number.MAX_SAFE_INTEGER, sez.ordine ?? 0,
        c?.etichetta ?? '', e.componente_id ?? '', e.ordine ?? 0];
    };
    const confronta = (a: any, b: any): number => {
      const ka = chiave(a), kb = chiave(b);
      return (ka[0] - kb[0]) || (ka[1] - kb[1]) || (ka[2] - kb[2])
        || ka[3].localeCompare(kb[3]) || ka[4].localeCompare(kb[4]) || (ka[5] - kb[5]);
    };
    for (const e of esiti.filter((x) => !x.parent_esito_id).sort(confronta)) {
      if (haContenuto(e)) esitiTop.push(toDisplay(e));
    }
  }

  // 3) azioni generate in QUESTO sopralluogo
  const { data: azRaw } = await sb.from('azione').select(SEL_AZIONE).eq('sopralluogo_origine_id', sopralluogoId);
  const azioni = ((azRaw ?? []) as any[]).map((a) => azioneDisplay(a, clienteNome));

  // 4) continuità: azioni dei sopralluoghi PRECEDENTI dello stesso incarico
  const { data: soprIds } = await sb.from('sopralluogo').select('id').eq('incarico_id', incaricoId);
  const precedenti = ((soprIds ?? []) as any[]).map((s) => s.id).filter((id) => id !== sopralluogoId);
  let chiuseQui: AzioneDisplay[] = [];
  let ancoraAperte: AzioneDisplay[] = [];
  if (precedenti.length) {
    const { data: prevRaw } = await sb.from('azione').select(SEL_AZIONE).in('sopralluogo_origine_id', precedenti);
    for (const a of (prevRaw ?? []) as any[]) {
      const d = azioneDisplay(a, clienteNome);
      if (a.stato === 'conclusa' && a.sopralluogo_verifica_id === sopralluogoId) chiuseQui.push(d);
      else if (a.stato !== 'conclusa') ancoraAperte.push(d);
    }
  }

  // 5) revisione corrente (best-effort: richiede la migration 012; se non c'è
  // ancora, il report continua a funzionare senza la riga revisione)
  let revisione: { numero: number; dal: string | null } = { numero: 1, dal: null };
  try {
    const { data: sr } = await sb.from('sopralluogo')
      .select('revisione_corrente').eq('id', sopralluogoId).maybeSingle();
    const num = (sr as any)?.revisione_corrente ?? 1;
    let dal: string | null = null;
    if (num > 1) {
      const { data: lastRev } = await sb.from('sopralluogo_revisione')
        .select('numero, creata_il').eq('sopralluogo_id', sopralluogoId)
        .order('numero', { ascending: false }).limit(1).maybeSingle();
      dal = (lastRev as any)?.creata_il ?? null;
    }
    revisione = { numero: num, dal };
  } catch { /* migration 012 non ancora applicata */ }

  return {
    variante,
    revisione,
    cliente: { ragione_sociale: clienteNome, localita: cli?.localita ?? null, indirizzo: cli?.indirizzo ?? null },
    incarico: { tipo_attivita: inc?.tipo_attivita ?? null, n_sopralluoghi: inc?.n_sopralluoghi ?? null },
    sopralluogo: {
      progressivo: (sop as any).progressivo ?? null,
      data: (sop as any).data_effettiva ?? (sop as any).data_pianificata ?? null,
      durata_min: (sop as any).durata_effettiva_min ?? null,
      localita: (sop as any).localita ?? null,
    },
    tecnico: { nome: tec?.nome ?? null },
    conteggi: { conformi, non_conformi, non_applicabili, totale },
    esiti: esitiTop,
    azioni,
    continuita: { chiuseQui, ancoraAperte },
    hasChecklist: totale > 0 || esitiTop.length > 0,
  };
}
