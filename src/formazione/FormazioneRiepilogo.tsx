// GUSCIO CAMPO del modulo organigramma/formazione (sheet della Compilazione).
// La UI e' interamente nel componente CONDIVISO OrganigrammaView (usato anche
// dal back-office): qui resta solo cio' che e' specifico del campo:
//   - caricamento OFFLINE-FIRST (cache Dexie) + valutazione con assemblaRiepilogo
//     (lo stesso motore puro del back-office);
//   - prefetch best-effort con rete + cache del livello di rischio del cliente;
//   - ADAPTER di scrittura OFFLINE (sync.ts -> outbox), iniettato in OrganigrammaView;
//   - CONFERMA tracciata di fine consultazione (organigramma_conferma) + snapshot
//     versionato (revisione) dedup per firma.

import { useCallback, useEffect, useState } from 'react';
import {
  type RiepilogoCliente, type Catalogo, type LivelloRischio,
  assemblaRiepilogo,
} from '../lib/admin/formazione';
import { costruisciSnapshot, firmaOrganigramma } from './organigramma-revisioni';
import {
  caricaOrganigrammaLocale, prefetchOrganigramma, type OrganigrammaLocale,
  salvaFormazione, salvaFormazioneConAllegato, eliminaFormazione, salvaEsonero, eliminaEsonero,
  salvaConfermaOrganigramma, salvaPersona, eliminaPersona, salvaNomina, eliminaNomina,
  accodaRevisioneOrganigramma,
} from '../lib/sync';
import { supabase, MAX_ATTESTATO_BYTES, urlFirmatoAttestato } from '../lib/supabase';
import { db, type OrganigrammaConferma } from '../lib/db';
import { newId } from '../lib/types';
import OrganigrammaView, { type OrganigrammaAdapter } from './OrganigrammaView';

const RK_KEY = (clienteId: string) => 'formazione:rischio:' + clienteId;
const FIRMA_KEY = (clienteId: string) => 'organigramma:firma:' + clienteId;

function leggiRischioLocale(clienteId: string): LivelloRischio | null {
  try {
    const v = localStorage.getItem(RK_KEY(clienteId));
    return v === 'basso' || v === 'medio' || v === 'alto' ? v : null;
  } catch { return null; }
}

interface Props {
  clienteId: string | null;
  sopralluogoId: string;
  tecnicoId: string;
  tecnicoNome: string | null;
}

const CSS = `
.fzr-shell{font-size:13px;}
.fzr-warn{font-size:11.5px; color:var(--hi-dark,#8f5a06); background:#fbf0d6; border-radius:8px; padding:6px 9px; margin-bottom:10px;}
.fzr-conf{margin-top:14px; border-top:2px solid var(--line,#e7e1d6); padding-top:12px;}
.fzr-conf h4{margin:0 0 6px; font-size:13px; font-weight:800;}
.fzr-conf-last{font-size:11.5px; color:var(--ink-soft,#5c5f66); margin-bottom:8px;}
.fzr-conf textarea{width:100%; box-sizing:border-box; padding:8px 9px; border:1px solid var(--line,#e7e1d6); border-radius:8px; font-size:13px; font-family:inherit; min-height:54px; resize:vertical; background:#fff; color:var(--ink,#2a2c30); margin-bottom:8px;}
.fzr-conf-actions{display:flex; gap:8px;}
.fzr-conf-btn{flex:1; padding:8px 10px; border-radius:8px; border:none; font-size:12.5px; font-weight:800; cursor:pointer;}
.fzr-conf-btn.primary{background:var(--ok,#2e8b4c); color:#fff;}
.fzr-conf-btn.ghost{background:#fff; border:1px solid var(--line,#e7e1d6); color:var(--ink,#2a2c30);}
.fzr-conf-btn:disabled{opacity:.55; cursor:default;}
`;

export default function FormazioneRiepilogo({ clienteId, sopralluogoId, tecnicoId, tecnicoNome }: Props) {
  const [stato, setStato] = useState<'loading' | 'ok' | 'errore'>('loading');
  const [errMsg, setErrMsg] = useState<string>('');
  const [riep, setRiep] = useState<RiepilogoCliente | null>(null);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [org, setOrg] = useState<OrganigrammaLocale | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  const [conferma, setConferma] = useState<OrganigrammaConferma | null>(null);
  const [nota, setNota] = useState('');
  const [confBusy, setConfBusy] = useState(false);
  const [confMsg, setConfMsg] = useState<string>('');

  // Rivaluta SEMPRE dalla cache locale (riflette anche le scritture offline
  // appena fatte, prima della sincronizzazione).
  const ricaricaLocale = useCallback(async () => {
    if (!clienteId) { setStato('errore'); setErrMsg('Cliente non collegato a questo sopralluogo.'); return; }
    const o = await caricaOrganigrammaLocale(clienteId);
    if (o.figure.length === 0) {
      setRiep(null); setOrg(null); setCatalogo(null);
      setStato('errore');
      setErrMsg(navigator.onLine
        ? 'Catalogo formazione non disponibile per questo cliente.'
        : 'Catalogo non disponibile offline: apri con connessione almeno una volta, o usa "Scarica per offline".');
      return;
    }
    const rischio = o.livello_rischio ?? leggiRischioLocale(clienteId);
    const cat: Catalogo = { corsi: o.corsi, figure: o.figure, requisiti: o.requisiti, esoneriAmmessi: o.esoneriAmmessi };
    const r = assemblaRiepilogo(
      clienteId,
      rischio,
      { persone: o.persone, nomine: o.nomine, formazioni: o.formazioni, esoneri: o.esoneri },
      cat,
      {
        rlsTerritoriale: o.rls_territoriale,
        livAntincendio: o.livello_antincendio,
        gruppoPS: o.gruppo_primo_soccorso,
        atecoCliente: o.codice_ateco,
      },
    );
    setOrg(o);
    setCatalogo(cat);
    setRiep(r);
    setStato('ok');
  }, [clienteId]);

  useEffect(() => {
    const su = () => setOnline(true);
    const giu = () => setOnline(false);
    window.addEventListener('online', su);
    window.addEventListener('offline', giu);
    return () => { window.removeEventListener('online', su); window.removeEventListener('offline', giu); };
  }, []);

  useEffect(() => {
    if (!clienteId) { setStato('errore'); setErrMsg('Cliente non collegato a questo sopralluogo.'); return; }
    let vivo = true;
    setStato('loading');
    (async () => {
      if (navigator.onLine) {
        try { await prefetchOrganigramma(clienteId); } catch { /* best-effort */ }
        try {
          const { data } = await supabase.from('cliente').select('livello_rischio').eq('id', clienteId).single();
          localStorage.setItem(RK_KEY(clienteId), String((data as { livello_rischio?: string | null } | null)?.livello_rischio ?? ''));
        } catch { /* best-effort */ }
      }
      try {
        const cs = await db.conferme.where('sopralluogo_id').equals(sopralluogoId).toArray();
        cs.sort((a, b) => (b.data_conferma ?? '').localeCompare(a.data_conferma ?? ''));
        if (vivo && cs.length) setConferma(cs[0] ?? null);
      } catch { /* nessuna conferma locale */ }
      if (!vivo) return;
      try { await ricaricaLocale(); }
      catch { if (vivo) { setStato('errore'); setErrMsg('Impossibile leggere i dati di formazione.'); } }
    })();
    return () => { vivo = false; };
  }, [clienteId, sopralluogoId, ricaricaLocale]);

  // Adapter OFFLINE: tutte le scritture passano per sync.ts (outbox) e poi si
  // rivaluta dalla cache locale (onCambia).
  const adapter: OrganigrammaAdapter = {
    salvaPersona, eliminaPersona, salvaNomina, eliminaNomina,
    salvaFormazione, salvaFormazioneConAllegato, eliminaFormazione, salvaEsonero, eliminaEsonero,
    apriAllegato: async (path: string) => {
      const u = await urlFirmatoAttestato(path);
      if (u) window.open(u, '_blank', 'noopener');
      else window.alert('Allegato non disponibile (offline o permessi insufficienti).');
    },
    maxAllegatoBytes: MAX_ATTESTATO_BYTES,
    onCambia: ricaricaLocale,
  };

  async function conferma_(tipo: 'compilato' | 'confermato' | 'variato') {
    if (confBusy || !clienteId) return;
    setConfBusy(true);
    setConfMsg('');
    try {
      const c: OrganigrammaConferma = {
        id: newId(),
        sopralluogo_id: sopralluogoId,
        cliente_id: clienteId,
        tecnico_id: tecnicoId,
        tecnico_nome: tecnicoNome,
        tipo,
        data_conferma: new Date().toISOString(),
        note: nota.trim() || null,
      };
      const salvata = await salvaConfermaOrganigramma(c);
      setConferma(salvata);
      setNota('');

      // Snapshot versionato (dedup per firma, offline-safe): non deve far fallire
      // la conferma in caso di errore.
      try {
        if (riep && org) {
          const rischioFirma = org.livello_rischio ?? leggiRischioLocale(clienteId);
          const firma = firmaOrganigramma(
            { persone: org.persone, nomine: org.nomine, formazioni: org.formazioni, esoneri: org.esoneri },
            rischioFirma,
          );
          let firmaNota: string | null = null;
          try { firmaNota = localStorage.getItem(FIRMA_KEY(clienteId)); } catch { /* no storage */ }
          if (firma !== firmaNota) {
            let clienteNome = '';
            try { clienteNome = (await db.contesto.get(sopralluogoId))?.cliente_nome ?? ''; } catch { /* best-effort */ }
            await accodaRevisioneOrganigramma({
              id: newId(),
              cliente_id: clienteId,
              creata_il: new Date().toISOString(),
              autore: tecnicoNome,
              autore_tecnico_id: tecnicoId,
              origine: 'campo',
              firma,
              snapshot: costruisciSnapshot(riep, clienteNome),
            });
            try { localStorage.setItem(FIRMA_KEY(clienteId), firma); } catch { /* no storage */ }
          }
        }
      } catch { /* lo snapshot non deve far fallire la conferma */ }

      setConfMsg(tipo === 'variato' ? 'Variazione registrata.' : tipo === 'compilato' ? 'Organigramma compilato.' : 'Organigramma confermato.');
    } catch {
      setConfMsg('Salvataggio non riuscito, riprova.');
    } finally {
      setConfBusy(false);
    }
  }

  if (!clienteId) return <div className="empty">Cliente non collegato a questo sopralluogo.</div>;
  if (stato === 'loading') return <p className="muted">Carico lo stato formativo{'\u2026'}</p>;
  if (stato === 'errore') return <div className="empty">{errMsg || 'Dati non disponibili.'}</div>;
  if (!riep || !catalogo) return <div className="empty">Dati non disponibili.</div>;

  const vuoto = riep.persone.length === 0;

  return (
    <div className="fzr-shell">
      <style>{CSS}</style>

      {!online && <div className="fzr-warn">Sei offline: le modifiche vengono salvate e sincronizzate al ritorno della rete.</div>}

      <OrganigrammaView clienteId={clienteId} riep={riep} catalogo={catalogo} adapter={adapter} />

      <div className="fzr-conf">
        <h4>Conferma organigramma</h4>
        {conferma && (
          <div className="fzr-conf-last">
            Ultima: <b>{conferma.tipo === 'variato' ? 'variato' : conferma.tipo === 'compilato' ? 'compilato' : 'confermato'}</b>
            {conferma.data_conferma ? ' il ' + new Date(conferma.data_conferma).toLocaleDateString('it-IT') : ''}
            {conferma.tecnico_nome ? ' da ' + conferma.tecnico_nome : ''}
          </div>
        )}
        <textarea
          placeholder="Nota sulla conferma (facoltativa)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
        <div className="fzr-conf-actions">
          {vuoto ? (
            <button className="fzr-conf-btn ghost" disabled>Aggiungi almeno una persona</button>
          ) : conferma ? (
            <>
              <button className="fzr-conf-btn primary" disabled={confBusy} onClick={() => void conferma_('confermato')}>Conferma (nessuna variazione)</button>
              <button className="fzr-conf-btn ghost" disabled={confBusy} onClick={() => void conferma_('variato')}>Salva variazione</button>
            </>
          ) : (
            <button className="fzr-conf-btn primary" disabled={confBusy} onClick={() => void conferma_('compilato')}>Conferma organigramma compilato</button>
          )}
        </div>
        {confMsg && <div className="fzr-conf-last" style={{ marginTop: 8 }}>{confMsg}</div>}
      </div>
    </div>
  );
}
