// Crediti tra ruoli - Allegato III ASR 17/04/2025 (port dalla standalone).
//
// La matrice dice, per ogni RUOLO POSSEDUTO (riga) e ogni CORSO RICHIESTO da un
// altro ruolo della stessa persona (colonna), se il primo credita il secondo:
//   'T'     = credito totale
//   'Tstar' = credito totale ma "stessa azienda" (nell'app le figure di una
//             persona sono tutte nello stesso cliente -> vale sempre)
//   'F'/'-' = nessun credito / se stesso
//
// Innesto non distruttivo: `applicaCreditiAllegatoIII` opera sui requisiti gia'
// calcolati da valutaPersona e marca 'esonerato' quelli coperti da un credito,
// SENZA toccare il resto del motore (assemblaRiepilogo resta la fonte di verita').
//
// Regola conservativa (piu' stretta della standalone, per un tool di conformita'
// non deve MAI nascondere un gap): una figura credita solo se TUTTI i suoi
// obbligatori risultano gia' coperti (conforme/in scadenza/esonerato). La
// derivazione parte dalla copertura BASE (pre-credito), in un solo passaggio.

import type { RequisitoValutato, StatoRequisito, EsitoAggiornamento } from './../lib/admin/formazione';

type Credito = 'T' | 'Tstar' | 'F' | '-';
type Colonna = 'rls' | 'dl' | 'lavGen' | 'lavSpec' | 'dirigente' | 'preposto';

const CREDITI_RUOLI: Record<string, Record<Colonna, Credito>> = {
  rspp: { rls: 'T', dl: 'T', lavGen: 'T', lavSpec: 'Tstar', dirigente: 'T', preposto: 'Tstar' },
  aspp: { rls: 'T', dl: 'T', lavGen: 'T', lavSpec: 'Tstar', dirigente: 'T', preposto: 'Tstar' },
  dlRspp: { rls: 'F', dl: 'T', lavGen: 'T', lavSpec: 'Tstar', dirigente: 'T', preposto: 'Tstar' },
  dl: { rls: 'F', dl: '-', lavGen: 'T', lavSpec: 'Tstar', dirigente: 'T', preposto: 'Tstar' },
  rls: { rls: '-', dl: 'F', lavGen: 'T', lavSpec: 'F', dirigente: 'T', preposto: 'T' },
  lavGen: { rls: 'F', dl: 'F', lavGen: '-', lavSpec: 'F', dirigente: 'F', preposto: 'F' },
  lavSpec: { rls: 'F', dl: 'F', lavGen: '-', lavSpec: '-', dirigente: 'F', preposto: 'F' },
  dirigente: { rls: 'F', dl: 'T', lavGen: 'T', lavSpec: 'Tstar', dirigente: '-', preposto: 'Tstar' },
  preposto: { rls: 'F', dl: 'F', lavGen: 'F', lavSpec: 'F', dirigente: 'F', preposto: '-' },
};

// Figura app (figura_sicurezza.codice, come in figureSet) -> riga della matrice.
// 'lavoratore' non credita altri ruoli (righe lavGen/lavSpec tutte 'F'): non
// mappato. addetto_antincendio/addetto_primo_soccorso non creditano: non mappati.
const FIGURA_TO_ROLE: Record<string, string> = {
  rspp: 'rspp', aspp: 'aspp',
  dl_rspp: 'dlRspp', datore_lavoro: 'dl',
  dirigente: 'dirigente', preposto: 'preposto', rls: 'rls',
};

// Corso richiesto -> colonna della matrice.
const COURSE_TO_COL: Record<string, Colonna> = {
  DATORE_LAVORO: 'dl', DIRIGENTE: 'dirigente', PREPOSTO: 'preposto',
  RLS: 'rls', LAV_GEN: 'lavGen', LAV_SPEC: 'lavSpec',
};

const coperto = (s: StatoRequisito): boolean =>
  s === 'conforme' || s === 'in_scadenza' || s === 'esonerato';

export function applicaCreditiAllegatoIII(
  requisiti: RequisitoValutato[],
  figureSet: Set<string>,
  nomeFigura: (codice: string) => string,
  // Regola A: dato il requisito creditato, calcola lo stato del rinnovo se il corso
  // e' periodico; ritorna null se il corso non ha aggiornamento (credito copre tutto).
  calcolaAggiornamento?: (r: RequisitoValutato) => EsitoAggiornamento | null,
): void {
  // copertura BASE per figura (pre-credito)
  const acquisita = new Map<string, boolean>();
  for (const figura of figureSet) {
    const obbl = requisiti.filter((r) => r.obbligatorio && r.figura_codici.includes(figura));
    acquisita.set(figura, obbl.length > 0 && obbl.every((r) => coperto(r.stato)));
  }

  for (const r of requisiti) {
    if (coperto(r.stato)) continue;
    const col = COURSE_TO_COL[r.corso_codice];
    if (!col) continue;

    let best: Credito | null = null;
    let fonte: string | null = null;
    for (const figura of figureSet) {
      if (r.figura_codici.includes(figura)) continue; // non da chi lo richiede
      const role = FIGURA_TO_ROLE[figura];
      if (!role || !acquisita.get(figura)) continue;
      const st = CREDITI_RUOLI[role]?.[col];
      if (st !== 'T' && st !== 'Tstar') continue;
      if (!best || (best === 'Tstar' && st === 'T')) { best = st; fonte = figura; }
    }
    if (best && fonte) {
      const nota = `Credito da ${nomeFigura(fonte)} (Allegato III ASR 17/04/2025${best === 'Tstar' ? ', stessa azienda' : ''})`;
      const agg = calcolaAggiornamento?.(r) ?? null;
      if (agg) {
        // Il credito copre l'iniziale; il rinnovo resta dovuto (scadenza normale).
        r.stato = agg.stato;
        r.esonero_id = null;
        r.scadenza = agg.scadenza;
        r.formazione_id = agg.formazione_id;
        r.allegato_url = agg.allegato_url;
        if (agg.ore != null) r.ore = agg.ore;
        r.dettaglio = nota + ' (iniziale) \u00b7 ' + agg.dettaglio;
      } else {
        r.stato = 'esonerato';
        r.esonero_id = null;
        r.scadenza = null;
        r.dettaglio = nota;
      }
    }
  }
}
