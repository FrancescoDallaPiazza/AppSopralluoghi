// Textarea con dettatura vocale (note vocali trascritte).
//
// Usa la Web Speech API del browser (SpeechRecognition): la trascrizione avviene
// sul dispositivo/browser, in italiano, SENZA passare da un server. Se il
// browser non la supporta (o l'utente nega il microfono), il pulsante non
// compare e resta la normale textarea: nessuna regressione.
//
// Due modalità d'uso, per coprire i campi esistenti:
//  * CONTROLLATO   : passa `value` + `onChange(text)` (+ opzionale `onCommit`).
//  * NON CONTROLLATO: passa `defaultValue` + `onCommit(text)` (salva on blur),
//    lasciando `value` undefined.
// In entrambi i casi la voce trascritta viene APPESA al testo già presente.

import { useEffect, useRef, useState } from 'react';

// Tipi minimi per la Web Speech API (non sempre presenti in lib.dom).
type SpeechRecognitionResult = { 0: { transcript: string }; isFinal: boolean };
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export const dettaturaSupportata = (): boolean => getRecognitionCtor() != null;

const unisci = (base: string, aggiunta: string): string => {
  const a = base.trimEnd();
  const b = aggiunta.trim();
  if (!b) return base;
  if (!a) return b;
  return `${a} ${b}`;
};

interface Props {
  value?: string;                       // controllato
  defaultValue?: string;                // non controllato
  placeholder?: string;
  rows?: number;
  className?: string;
  ariaLabel?: string;
  onChange?: (text: string) => void;    // controllato: a ogni modifica
  onCommit?: (text: string) => void;    // salvataggio (onBlur, o dopo la voce)
}

export default function NotaVocale({
  value, defaultValue, placeholder, rows = 2, className = 'note',
  ariaLabel = 'Note', onChange, onCommit,
}: Props) {
  const controllato = value !== undefined;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [ascolto, setAscolto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const supportata = dettaturaSupportata();

  // chiusura pulita del riconoscimento allo smontaggio
  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* */ } }, []);

  // testo corrente (controllato = prop value; non controllato = DOM)
  const testoCorrente = (): string =>
    controllato ? (value ?? '') : (taRef.current?.value ?? '');

  function applica(nuovo: string) {
    if (controllato) {
      onChange?.(nuovo);
    } else if (taRef.current) {
      taRef.current.value = nuovo;
    }
  }

  function toggleAscolto() {
    setErrore(null);
    if (ascolto) { try { recRef.current?.stop(); } catch { /* */ } return; }

    const Ctor = getRecognitionCtor();
    if (!Ctor) { setErrore('Dettatura non supportata da questo browser.'); return; }

    const rec = new Ctor();
    rec.lang = 'it-IT';
    rec.continuous = true;
    rec.interimResults = false;     // appendiamo solo frasi finali, niente sfarfallio
    const partenza = testoCorrente();

    let accumulato = '';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) accumulato = unisci(accumulato, r[0].transcript);
      }
      const completo = unisci(partenza, accumulato);
      applica(completo);
    };
    rec.onerror = (e) => {
      const code = e?.error ?? '';
      setErrore(
        code === 'not-allowed' || code === 'service-not-allowed'
          ? 'Microfono non autorizzato.'
          : code === 'no-speech' ? 'Non ho sentito nulla.'
            : 'Dettatura interrotta.',
      );
    };
    rec.onend = () => {
      setAscolto(false);
      recRef.current = null;
      // salva il risultato (utile in modalità non controllata)
      onCommit?.(testoCorrente());
    };

    recRef.current = rec;
    try { rec.start(); setAscolto(true); }
    catch { setErrore('Impossibile avviare la dettatura.'); }
  }

  return (
    <div className="nv-wrap">
      <textarea
        ref={taRef}
        className={className}
        placeholder={placeholder}
        rows={rows}
        aria-label={ariaLabel}
        {...(controllato
          ? { value, onChange: (e) => onChange?.(e.target.value) }
          : { defaultValue })}
        onBlur={(e) => onCommit?.(e.target.value)}
      />
      {supportata && (
        <button
          type="button"
          className={'nv-mic' + (ascolto ? ' on' : '')}
          onClick={toggleAscolto}
          title={ascolto ? 'Ferma la dettatura' : 'Detta una nota vocale'}
          aria-label={ascolto ? 'Ferma la dettatura' : 'Detta una nota vocale'}
        >
          {ascolto ? '● Stop' : '🎤'}
        </button>
      )}
      {errore && <div className="nv-err">{errore}</div>}
    </div>
  );
}
