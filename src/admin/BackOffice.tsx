// Shell del back-office (solo amministratori). Due sezioni: Template e
// Pianificazione. Header con switch opzionale verso l'app da campo.

import { useState } from 'react';
import { useAuth } from '../AuthProvider';
import type { Tecnico } from '../lib/types';
import { CSS_BACKOFFICE } from './ui';
import TemplateList from './TemplateList';
import Pianificazione from './Pianificazione';

type Sezione = 'template' | 'pianificazione';

export default function BackOffice({
  tecnico, onVaiAllApp,
}: { tecnico: Tecnico; onVaiAllApp?: () => void }) {
  const { signOut } = useAuth();
  const [sezione, setSezione] = useState<Sezione>('template');

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
          <button className={`bo-tab ${sezione === 'template' ? 'on' : ''}`}
            onClick={() => setSezione('template')}>Template</button>
          <button className={`bo-tab ${sezione === 'pianificazione' ? 'on' : ''}`}
            onClick={() => setSezione('pianificazione')}>Pianificazione</button>
        </nav>
      </header>

      <main className="bo-main">
        {sezione === 'template' ? <TemplateList /> : <Pianificazione />}
      </main>
    </div>
  );
}
