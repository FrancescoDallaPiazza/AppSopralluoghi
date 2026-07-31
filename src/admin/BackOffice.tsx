// Shell del back-office (solo amministratori). Navigazione a DUE livelli,
// organizzata per flusso di gestione:
//   1. Anagrafiche      - caratterizzazione del cliente (scheda unica)
//   2. Pianificazione   - attivita' dei tecnici (incarichi, tecnici, aree,
//                         template, capitoli, disponibilita, import Werp)
//   3. Cose da fare     - output + scadenzario unico del cliente
//   4. Regole app       - catalogo formazione, import catalogo, alias corsi
//                         del gestionale
// Il primo livello sceglie il GRUPPO; il secondo (se il gruppo ha piu' voci)
// la sezione. I gruppi mono-superficie non mostrano la riga di sotto-tab.

import { useState } from 'react';
import { useAuth } from '../AuthProvider';
import type { Tecnico } from '../lib/types';
import { CSS_BACKOFFICE } from './ui';
import Anagrafiche from './Anagrafiche';
import Tecnici from './Tecnici';
import Aree from './Aree';
import TemplateList from './TemplateList';
import CapitoliList from './CapitoliList';
import Pianificazione from './Pianificazione';
import Disponibilita from './Disponibilita';
import { CatalogoFormazione } from '../formazione';
import CoseDaFare from './CoseDaFare';
import Scadenzario from './Scadenzario';
import ImportWerp from './ImportWerp';
import ImportCatalogo from './ImportCatalogo';
import AliasCorsi from './AliasCorsi';
import ImportFormazione from './ImportFormazione';

type Sezione =
  | 'anagrafiche' | 'tecnici' | 'aree' | 'template' | 'capitoli'
  | 'pianificazione' | 'disponibilita' | 'formazione' | 'cosedafare'
  | 'scadenzario' | 'importwerp' | 'importcatalogo' | 'aliascorsi'
  | 'importformazione';

interface Gruppo {
  key: string;
  label: string;
  sezioni: { k: Sezione; label: string }[];
}

const GRUPPI: Gruppo[] = [
  {
    key: 'anagrafiche', label: 'Anagrafiche',
    sezioni: [
      { k: 'anagrafiche', label: 'Anagrafiche' },
      // Sta qui e non fra le "Regole app": scrive dati dei clienti (persone e
      // attestati), non regole. Il dizionario alias che usa sta invece la',
      // perche' quello e' una regola valida per tutti.
      { k: 'importformazione', label: 'Import formazione' },
    ],
  },
  {
    key: 'pianificazione', label: 'Pianificazione',
    sezioni: [
      { k: 'pianificazione', label: 'Incarichi' },
      { k: 'tecnici', label: 'Tecnici' },
      { k: 'aree', label: 'Aree' },
      { k: 'template', label: 'Template' },
      { k: 'capitoli', label: 'Capitoli' },
      { k: 'disponibilita', label: 'Disponibilità' },
      { k: 'importwerp', label: 'Import Werp' },
    ],
  },
  {
    key: 'scadenzario', label: 'Scadenzario',
    sezioni: [{ k: 'scadenzario', label: 'Scadenzario' }],
  },
  {
    key: 'cosedafare', label: 'Cose da fare',
    sezioni: [{ k: 'cosedafare', label: 'Cose da fare' }],
  },
  {
    key: 'regole', label: 'Regole app',
    sezioni: [
      { k: 'formazione', label: 'Catalogo formazione' },
      { k: 'importcatalogo', label: 'Import catalogo' },
      { k: 'aliascorsi', label: 'Alias corsi' },
    ],
  },
];

export default function BackOffice({
  tecnico, onVaiAllApp,
}: { tecnico: Tecnico; onVaiAllApp?: () => void }) {
  const { signOut } = useAuth();
  const [gruppoKey, setGruppoKey] = useState<string>('anagrafiche');
  const [sezione, setSezione] = useState<Sezione>('anagrafiche');

  const gruppo = GRUPPI.find((g) => g.key === gruppoKey) ?? GRUPPI[0];

  function apriGruppo(g: Gruppo) {
    setGruppoKey(g.key);
    setSezione(g.sezioni[0].k); // prima sezione del gruppo
  }

  return (
    <div className="bo">
      <style>{CSS_BACKOFFICE}</style>

      <header className="bo-top">
        <div className="bo-top-in">
          <div className="bo-brand">Back-office<small>{tecnico.nome}</small></div>
          <span className="bo-sp" />
          {onVaiAllApp && (
            <button className="bo-btn ghost sm" onClick={onVaiAllApp}>App da campo</button>
          )}
          <button className="bo-btn ghost sm" onClick={() => void signOut()}>Esci</button>
        </div>

        {/* livello 1: gruppi-flusso */}
        <nav className="bo-tabs">
          {GRUPPI.map((g) => (
            <button key={g.key}
              className={`bo-tab ${g.key === gruppoKey ? 'on' : ''}`}
              onClick={() => apriGruppo(g)}>{g.label}</button>
          ))}
        </nav>

        {/* livello 2: sezioni del gruppo (solo se piu' d'una) */}
        {gruppo.sezioni.length > 1 && (
          <nav className="bo-subtabs">
            {gruppo.sezioni.map((s) => (
              <button key={s.k}
                className={`bo-subtab ${s.k === sezione ? 'on' : ''}`}
                onClick={() => setSezione(s.k)}>{s.label}</button>
            ))}
          </nav>
        )}
      </header>

      <main className="bo-main">
        {sezione === 'anagrafiche' && <Anagrafiche />}
        {sezione === 'tecnici' && <Tecnici />}
        {sezione === 'aree' && <Aree />}
        {sezione === 'template' && <TemplateList />}
        {sezione === 'capitoli' && <CapitoliList />}
        {sezione === 'pianificazione' && <Pianificazione />}
        {sezione === 'disponibilita' && <Disponibilita />}
        {sezione === 'formazione' && <CatalogoFormazione />}
        {sezione === 'scadenzario' && <Scadenzario />}
        {sezione === 'cosedafare' && <CoseDaFare />}
        {sezione === 'importwerp' && <ImportWerp />}
        {sezione === 'importcatalogo' && <ImportCatalogo />}
        {sezione === 'aliascorsi' && <AliasCorsi />}
        {sezione === 'importformazione' && <ImportFormazione />}
      </main>
    </div>
  );
}
