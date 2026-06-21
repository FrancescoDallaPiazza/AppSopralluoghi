// Motore di compilazione delle voci, condiviso tra la checklist piatta
// (Compilazione.tsx) e i box generici (BoxGenerico.tsx). Possiede lo stato
// GLOBALE del giro - esiti, cose-da-fare in bozza, scadenze - cosi' che
// `completaSopralluogo` (che legge questo stato da Compilazione) persista in un
// colpo solo sia le voci del template sia quelle dei box.
//
// La sola differenza tra un contesto piatto e uno di box e' l'IDENTITA' degli
// esiti: nei box ripetibili lo stesso `voce_template_id` esiste per N componenti,
// quindi gli esiti portano un `componente_id`. `buildCtx({ voci, componenteId })`
// costruisce un ContestoVoci con le mappe filtrate per quel componente e handler
// che marcano i nuovi esiti con lo stesso `componente_id`. Gli id sono uuid:
// nessuna collisione tra contesti diversi nello stesso store.
//
// Gli handler sono ricreati a ogni `buildCtx` (come le funzioni interne di
// Compilazione prima dell'estrazione): nessuna memoizzazione, stato di proprieta'
// dell'hook. Le scritture passano dai primitivi condivisi (`salvaEsito`,
// `rimuoviEsito`), quindi offline-first e outbox come il resto dell'app.

import { useState } from 'react';
import { db } from './db';
import { salvaEsito, rimuoviEsito } from './sync';
import { figliDi, isRipetibile, nuovoEsito } from './compilazione';
import type { EsitoVoce, EsitoStato, VoceTemplate, AreaInterna } from './types';
import type { TecnicoAssegnabile } from './azioni';
import type { ContestoVoci, Resp, Bozza, BozzaScad } from '../vociRender';

const isoPiuMesi = (mesi: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + mesi);
  return d.toISOString().slice(0, 10);
};
const isoPiuGiorni = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const nuovaBozza = (): Bozza => ({
  id: crypto.randomUUID(), descrizione: '', responsabile: 'cliente',
  tecnicoTargetId: null, areaId: null, scadenza: isoPiuGiorni(30), priorita: 'media',
});

// Anagrafiche per i destinatari interni + identita' del giro: dati che entrano
// nel ContestoVoci ma non sono di proprieta' dell'hook (li passa il chiamante).
export interface ContestoBuild {
  compilataId: string;
  voci: VoceTemplate[];           // voci del contesto (per figliDi/ensureFigli)
  componenteId: string | null;    // null = sezione singola / checklist piatta
  aree: AreaInterna[];
  tecnici: TecnicoAssegnabile[];
  tecnicoId: string;
}

export interface MotoreVoci {
  esiti: EsitoVoce[];
  bozze: Record<string, Bozza[]>;
  scad: Record<string, BozzaScad>;
  setEsiti: React.Dispatch<React.SetStateAction<EsitoVoce[]>>;
  setBozze: React.Dispatch<React.SetStateAction<Record<string, Bozza[]>>>;
  setScad: React.Dispatch<React.SetStateAction<Record<string, BozzaScad>>>;
  // Semina gli esiti mancanti (top non-rilievo) per un insieme di voci e un
  // componente. Idempotente: la presenza si verifica dal persistente (Dexie),
  // cosi' rilanci ravvicinati non duplicano. Pensata per l'apertura di un box.
  assicuraEsiti: (compilataId: string, voci: VoceTemplate[], componenteId: string | null) => Promise<void>;
  buildCtx: (opts: ContestoBuild) => ContestoVoci;
}

export function useCompilazioneVoci(): MotoreVoci {
  const [esiti, setEsiti] = useState<EsitoVoce[]>([]);
  const [bozze, setBozze] = useState<Record<string, Bozza[]>>({});
  const [scad, setScad] = useState<Record<string, BozzaScad>>({});

  const sostituisci = (e: EsitoVoce) => setEsiti((arr) => arr.map((x) => (x.id === e.id ? e : x)));

  async function assicuraEsiti(compilataId: string, voci: VoceTemplate[], componenteId: string | null) {
    const tutti = await db.esiti.where('checklist_compilata_id').equals(compilataId).toArray();
    const presenti = new Set(
      tutti
        .filter((e) => (e.componente_id ?? null) === componenteId && e.parent_esito_id === null)
        .map((e) => e.voce_template_id),
    );
    const daSeminare = voci.filter((v) => v.parent_voce_id === null && !isRipetibile(v) && !presenti.has(v.id));
    if (!daSeminare.length) return;
    const nuovi = daSeminare.map((v) => {
      const e = nuovoEsito(compilataId, v);
      e.componente_id = componenteId;
      return e;
    });
    setEsiti((arr) => {
      const ids = new Set(arr.map((x) => x.id));
      return [...arr, ...nuovi.filter((n) => !ids.has(n.id))];
    });
    for (const e of nuovi) await salvaEsito(e);
  }

  function buildCtx({ compilataId, voci, componenteId, aree, tecnici, tecnicoId }: ContestoBuild): ContestoVoci {
    // Indici filtrati sul componente del contesto.
    const mine = esiti.filter((e) => (e.componente_id ?? null) === componenteId);
    const esitoTop = new Map<string, EsitoVoce>();
    const esitoFiglio = new Map<string, EsitoVoce>();
    const rilieviByVoce = new Map<string, EsitoVoce[]>();
    for (const e of mine) {
      if (!e.voce_template_id) continue;
      if (e.parent_esito_id === null) esitoTop.set(e.voce_template_id, e);
      else esitoFiglio.set(`${e.voce_template_id}:${e.parent_esito_id}`, e);
      if (e.voce_tipo === 'rilievo') {
        const arr = rilieviByVoce.get(e.voce_template_id) ?? [];
        arr.push(e); rilieviByVoce.set(e.voce_template_id, arr);
      }
    }

    // Rivela le sotto-domande condizionate per l'opzione scelta (come la voce
    // padre, marcate con lo stesso componente). Crea solo le mancanti.
    async function ensureFigli(voce: VoceTemplate, parentEsito: EsitoVoce, chiave: string) {
      const figli = figliDi(voci, voce.id).filter((f) => f.mostra_se_chiave === chiave && !isRipetibile(f));
      const nuovi: EsitoVoce[] = [];
      for (const f of figli) {
        if (!esitoFiglio.has(`${f.id}:${parentEsito.id}`)) {
          const e = nuovoEsito(compilataId, f, parentEsito.id);
          e.componente_id = componenteId;
          nuovi.push(e);
        }
      }
      if (nuovi.length) {
        setEsiti((arr) => [...arr, ...nuovi]);
        for (const e of nuovi) await salvaEsito(e);
      }
    }

    async function setScelta(esito: EsitoVoce, voce: VoceTemplate, chiave: string) {
      const corrente = esito.valore === chiave ? null : chiave;
      const agg: EsitoVoce = { ...esito, valore: corrente };
      sostituisci(agg);
      await salvaEsito(agg);
      if (corrente) await ensureFigli(voce, agg, corrente);
    }

    async function setEsito(esito: EsitoVoce, stato: EsitoStato) {
      const next = esito.stato === stato ? null : stato;
      const agg: EsitoVoce = { ...esito, stato: next };
      sostituisci(agg);
      await salvaEsito(agg);
      if (next === 'non_conforme') {
        setBozze((b) => (b[esito.id]?.length ? b : { ...b, [esito.id]: [nuovaBozza()] }));
      }
    }

    async function setMulti(esito: EsitoVoce, voce: VoceTemplate, chiave: string) {
      const arr = Array.isArray(esito.valore) ? [...(esito.valore as string[])] : [];
      const i = arr.indexOf(chiave);
      if (i >= 0) arr.splice(i, 1); else arr.push(chiave);
      const agg = { ...esito, valore: arr.length ? arr : null };
      sostituisci(agg); await salvaEsito(agg);
      void voce;
    }

    async function setValoreSemplice(esito: EsitoVoce, valore: unknown) {
      const agg = { ...esito, valore: valore === '' ? null : valore };
      sostituisci(agg); await salvaEsito(agg);
    }
    async function setNota(esito: EsitoVoce, note: string) {
      sostituisci({ ...esito, note });
    }
    async function salvaNota(esito: EsitoVoce) { await salvaEsito(esito); }

    const aggiungiBozza = (esitoId: string) =>
      setBozze((b) => ({ ...b, [esitoId]: [...(b[esitoId] ?? []), nuovaBozza()] }));
    const rimuoviBozza = (esitoId: string, bozzaId: string) =>
      setBozze((b) => ({ ...b, [esitoId]: (b[esitoId] ?? []).filter((x) => x.id !== bozzaId) }));
    const setBozza = (esitoId: string, bozzaId: string, patch: Partial<Bozza>) =>
      setBozze((b) => ({
        ...b,
        [esitoId]: (b[esitoId] ?? []).map((x) => (x.id === bozzaId ? { ...x, ...patch } : x)),
      }));
    const toggleScad = (id: string, mesiDefault?: number) =>
      setScad((s) => {
        const n = { ...s };
        if (n[id]) delete n[id];
        else { const m = mesiDefault ?? 12; n[id] = { responsabile: 'cliente', tecnicoTargetId: null, areaId: null, mesi: m, data: isoPiuMesi(m) }; }
        return n;
      });
    const setScadPatch = (id: string, patch: Partial<BozzaScad>) =>
      setScad((s) => {
        const cur = s[id]; if (!cur) return s;
        const merged = { ...cur, ...patch };
        if (patch.mesi != null) merged.data = isoPiuMesi(patch.mesi);
        return { ...s, [id]: merged };
      });

    async function aggiungiRilievo(voce: VoceTemplate) {
      const e = nuovoEsito(compilataId, voce);
      e.valore = '';
      e.componente_id = componenteId;
      const esistenti = rilieviByVoce.get(voce.id) ?? [];
      const maxOrd = esistenti.reduce((m, x) => Math.max(m, x.ordine ?? 0), voce.ordine - 1);
      e.ordine = maxOrd + 1;
      setEsiti((arr) => [...arr, e]);
      await salvaEsito(e);
    }
    async function rimuoviRilievo(esito: EsitoVoce) {
      if (!confirm('Eliminare questo rilievo? Verranno rimosse anche le sue foto e l\u2019eventuale cosa da fare collegata.')) return;
      await rimuoviEsito(esito.id);
      setEsiti((arr) => arr.filter((x) => x.id !== esito.id));
      setBozze((b) => { const n = { ...b }; delete n[esito.id]; return n; });
      setScad((s) => { const n = { ...s }; delete n[esito.id]; return n; });
    }
    async function setRilievoTesto(esito: EsitoVoce, testo: string) {
      sostituisci({ ...esito, valore: testo });
    }
    async function salvaRilievo(esito: EsitoVoce) { await salvaEsito(esito); }

    return {
      esitoTop, esitoFiglio, rilieviByVoce, voci, bozze, scad, aree, tecnici, tecnicoId,
      setScelta, setMulti, setValoreSemplice, setNota, salvaNota, setEsito,
      aggiungiRilievo, rimuoviRilievo, setRilievoTesto, salvaRilievo,
      aggiungiBozza, rimuoviBozza, setBozza, toggleScad, setScadPatch,
    };
  }

  return { esiti, bozze, scad, setEsiti, setBozze, setScad, assicuraEsiti, buildCtx };
}
