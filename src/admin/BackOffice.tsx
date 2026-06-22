// Shell del back-office (solo amministratori). Sezioni: Anagrafiche, Tecnici,
// Aree, Template, Pianificazione, Disponibilità, Cose da fare. Header con switch
// opzionale verso l'app da campo.

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
import Formazione from './Formazione';
import CoseDaFare from './CoseDaFare';

type Sezione =
  | 'anagrafiche' | 'tecnici' | 'aree' | 'template' | 'capitoli'
  | 'pianificazione' | 'disponibilita' | 'formazione' | 'cosedafare';

export default function BackOffice({
  tecnico, onVaiAllApp,
}: { tecnico: Tecnico; onVaiAllApp?: () => void }) {
  const { signOut } = useAuth();
  const [sezione, setSezione] = useState<Sezione>('anagrafiche');

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
        <nav className="bo-tabs">
          <button className={`bo-tab ${sezione === 'anagrafiche' ? 'on' : ''}`}
            onClick={() => setSezione('anagrafiche')}>Anagrafiche</button>
          <button className={`bo-tab ${sezione === 'tecnici' ? 'on' : ''}`}
            onClick={() => setSezione('tecnici')}>Tecnici</button>
          <button className={`bo-tab ${sezione === 'aree' ? 'on' : ''}`}
            onClick={() => setSezione('aree')}>Aree</button>
          <button className={`bo-tab ${sezione === 'template' ? 'on' : ''}`}
            onClick={() => setSezione('template')}>Template</button>
          <button className={`bo-tab ${sezione === 'capitoli' ? 'on' : ''}`}
            onClick={() => setSezione('capitoli')}>Capitoli</button>
          <button className={`bo-tab ${sezione === 'pianificazione' ? 'on' : ''}`}
            onClick={() => setSezione('pianificazione')}>Pianificazione</button>
          <button className={`bo-tab ${sezione === 'disponibilita' ? 'on' : ''}`}
            onClick={() => setSezione('disponibilita')}>Disponibilità</button>
          <button className={`bo-tab ${sezione === 'formazione' ? 'on' : ''}`}
            onClick={() => setSezione('formazione')}>Formazione</button>
          <button className={`bo-tab ${sezione === 'cosedafare' ? 'on' : ''}`}
            onClick={() => setSezione('cosedafare')}>Cose da fare</button>
        </nav>
      </header>

      <main className="bo-main">
        {sezione === 'anagrafiche' && <Anagrafiche />}
        {sezione === 'tecnici' && <Tecnici />}
        {sezione === 'aree' && <Aree />}
        {sezione === 'template' && <TemplateList />}
        {sezione === 'capitoli' && <CapitoliList />}
        {sezione === 'pianificazione' && <Pianificazione />}
        {sezione === 'disponibilita' && <Disponibilita />}
        {sezione === 'formazione' && <Formazione />}
        {sezione === 'cosedafare' && <CoseDaFare />}
      </main>
    </div>
  );
}
