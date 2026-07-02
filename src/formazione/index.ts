// =====================================================================
// MODULO FORMAZIONE / ORGANIGRAMMA - interfaccia pubblica (contratto).
//
// Il resto dell'app importa la parte organigramma/formazione SOLO da qui
// (`from '../formazione'` o `from './formazione'`), mai dai file interni.
// Cosi' il modulo si sviluppa in autonomia: finche' questo file non cambia,
// il lato sopralluoghi non si accorge di nulla. Aggiungere un nuovo aggancio
// = aggiungere UNA riga qui (gesto esplicito e tracciabile).
//
// Nota: il MOTORE puro resta in `src/lib/admin/formazione.ts` (percorso
// canonico, usato anche dall'infrastruttura condivisa sync.ts/db.ts). Questo
// contratto espone solo cio' che serve al codice-feature esterno.
// =====================================================================

// Riepilogo organigramma da montare in campo durante il sopralluogo
// (usato da Compilazione.tsx e BoxGenerico.tsx).
export { default as FormazioneRiepilogo } from './FormazioneRiepilogo';

// Pannello organigramma nella scheda cliente (Anagrafiche.tsx) e catalogo
// formazione globale del back-office (BackOffice.tsx).
export { OrganigrammaCliente, default as CatalogoFormazione } from './Formazione';

// Sezione "Risorse Umane" nella scheda cliente: anagrafica completa del
// personale (CRUD + import massivo), sulla stessa tabella `persona`.
export { RisorseUmane } from './RisorseUmane';

// Tabella ATECO -> rischio e helper, usati dalla scheda cliente.
export { risolviAteco, cercaAteco, ETICHETTA_RISCHIO } from './ateco';
export type { AtecoDivisione, RischioAteco } from './ateco';
