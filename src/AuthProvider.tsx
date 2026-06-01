import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { azioneAuthIniziale, pulisciHashAuth } from './lib/authFlow';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { risolviTecnico, signOut as doSignOut, TecnicoNonRisolto } from './lib/auth';
import type { Tecnico } from './lib/types';

export type FaseAuth =
  | 'avvio'         // controllo sessione iniziale
  | 'anon'          // nessuna sessione -> Login
  | 'risolvo'       // sessione c'è, sto risolvendo il tecnico
  | 'pronto'        // sessione + tecnico attivo -> app
  | 'non_collegato' // sessione ma nessun tecnico con questo user_id
  | 'disattivato'   // tecnico trovato ma attivo = false
  | 'offline';      // sessione ma tecnico mai risolto e niente rete

interface AuthValue {
  session: Session | null;
  tecnico: Tecnico | null;
  fase: FaseAuth;
  /** true quando si arriva da invito/recovery: va prima impostata la password. */
  richiediPassword: boolean;
  /** Chiamata dopo aver impostato la password: sblocca il flusso normale. */
  confermaPasswordImpostata: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuori da <AuthProvider>');
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [tecnico, setTecnico] = useState<Tecnico | null>(null);
  const [fase, setFase] = useState<FaseAuth>('avvio');
  // invito o recupero password: l'utente deve prima sceglierne una nuova.
  const [richiediPassword, setRichiediPassword] = useState<boolean>(
    azioneAuthIniziale === 'invite' || azioneAuthIniziale === 'recovery',
  );

  // 1) sessione: stato iniziale + sottoscrizione ai cambi
  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (vivo) setSession(data.session);
    });
    // NB: non chiamare altre funzioni supabase *dentro* questa callback
    // (rischio di deadlock in supabase-js v2): la risoluzione del tecnico vive
    // in un effetto separato, guidato da session.user.id.
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      setSession(s);
      // link di recupero password: Supabase emette questo evento.
      if (evt === 'PASSWORD_RECOVERY') setRichiediPassword(true);
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 2) tecnico: si (ri)risolve quando cambia l'utente
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setTecnico(null);
      setFase('anon');
      return;
    }
    let vivo = true;
    setFase('risolvo');
    risolviTecnico(uid)
      .then((t) => {
        if (!vivo) return;
        if (!t) return setFase('non_collegato');
        setTecnico(t);
        setFase(t.attivo ? 'pronto' : 'disattivato');
      })
      .catch((err) => {
        if (!vivo) return;
        setTecnico(null);
        setFase(err instanceof TecnicoNonRisolto ? 'offline' : 'non_collegato');
      });
    return () => {
      vivo = false;
    };
  }, [session?.user?.id]);

  const value: AuthValue = {
    session,
    tecnico,
    fase,
    richiediPassword,
    confermaPasswordImpostata: () => {
      setRichiediPassword(false);
      pulisciHashAuth();
    },
    // onAuthStateChange porterà a 'anon' da solo
    signOut: () => doSignOut(),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
