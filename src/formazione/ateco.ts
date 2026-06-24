// Tabella ATECO -> livello di rischio formativo (Allegato IV ASR 17/04/2025,
// Rep. Atti 59/CSR), ancorata ad ATECO 2007 agg. 2022. Il rischio e' determinato
// dalla DIVISIONE (prime 2 cifre del codice). Usata in anagrafica cliente per
// proporre il codice ATECO e il livello di rischio dell'organigramma.
//
// Dati generati dalla libreria normativa FrancescoDallaPiazza/formazione-81-utils-src
// (allegato_iv_asr2025.js) -> nessuna trascrizione manuale. Livelli in minuscolo
// per combaciare con il vincolo di cliente.livello_rischio ('basso'|'medio'|'alto').

export type RischioAteco = 'basso' | 'medio' | 'alto';

export interface AtecoDivisione {
  divisione: string;    // due cifre, es. '56'
  sezione: string;      // lettera ATECO, es. 'I'
  livello: RischioAteco;
  descrizione: string;
}

// Ordinata per divisione. Fonte: Allegato IV ASR 17/04/2025.
export const ATECO_DIVISIONI: AtecoDivisione[] = [
  { divisione: '01', sezione: 'A', livello: 'medio', descrizione: 'Coltivazioni agricole e produzione di prodotti animali, caccia e servizi connessi' },
  { divisione: '02', sezione: 'A', livello: 'medio', descrizione: 'Silvicoltura ed utilizzo di aree forestali' },
  { divisione: '03', sezione: 'A', livello: 'medio', descrizione: 'Pesca e acquacoltura' },
  { divisione: '05', sezione: 'B', livello: 'alto', descrizione: 'Estrazione di carbone (esclusa torba)' },
  { divisione: '06', sezione: 'B', livello: 'alto', descrizione: 'Estrazione di petrolio greggio e di gas naturale' },
  { divisione: '07', sezione: 'B', livello: 'alto', descrizione: 'Estrazione di minerali metalliferi' },
  { divisione: '08', sezione: 'B', livello: 'alto', descrizione: 'Altre attività di estrazione di minerali da cave e miniere' },
  { divisione: '09', sezione: 'B', livello: 'alto', descrizione: 'Attività dei servizi di supporto all\'estrazione' },
  { divisione: '10', sezione: 'C', livello: 'alto', descrizione: 'Industrie alimentari' },
  { divisione: '11', sezione: 'C', livello: 'alto', descrizione: 'Industria delle bevande' },
  { divisione: '12', sezione: 'C', livello: 'alto', descrizione: 'Industria del tabacco' },
  { divisione: '13', sezione: 'C', livello: 'alto', descrizione: 'Industrie tessili' },
  { divisione: '14', sezione: 'C', livello: 'alto', descrizione: 'Confezione di articoli di abbigliamento; confezione di articoli in pelle e pelliccia' },
  { divisione: '15', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di articoli in pelle e simili' },
  { divisione: '16', sezione: 'C', livello: 'alto', descrizione: 'Industria del legno e dei prodotti in legno e sughero (esclusi i mobili)' },
  { divisione: '17', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di carta e di prodotti di carta' },
  { divisione: '18', sezione: 'C', livello: 'alto', descrizione: 'Stampa e riproduzione di supporti registrati' },
  { divisione: '19', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di coke e prodotti derivanti dalla raffinazione del petrolio' },
  { divisione: '20', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di prodotti chimici' },
  { divisione: '21', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di prodotti farmaceutici di base e di preparati farmaceutici' },
  { divisione: '22', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di articoli in gomma e materie plastiche' },
  { divisione: '23', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di altri prodotti della lavorazione di minerali non metalliferi' },
  { divisione: '24', sezione: 'C', livello: 'alto', descrizione: 'Metallurgia' },
  { divisione: '25', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di prodotti di metallo (esclusi macchinari e attrezzature)' },
  { divisione: '26', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di computer e prodotti di elettronica e ottica' },
  { divisione: '27', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di apparecchiature elettriche e per uso domestico non elettriche' },
  { divisione: '28', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di macchinari ed apparecchiature NCA' },
  { divisione: '29', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di autoveicoli, rimorchi e semirimorchi' },
  { divisione: '30', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di altri mezzi di trasporto' },
  { divisione: '31', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di mobili' },
  { divisione: '32', sezione: 'C', livello: 'alto', descrizione: 'Altre industrie manifatturiere' },
  { divisione: '33', sezione: 'C', livello: 'alto', descrizione: 'Riparazione, manutenzione ed installazione di macchine ed apparecchiature' },
  { divisione: '35', sezione: 'D', livello: 'alto', descrizione: 'Fornitura di energia elettrica, gas, vapore e aria condizionata' },
  { divisione: '36', sezione: 'E', livello: 'alto', descrizione: 'Raccolta, trattamento e fornitura di acqua' },
  { divisione: '37', sezione: 'E', livello: 'alto', descrizione: 'Gestione delle reti fognarie' },
  { divisione: '38', sezione: 'E', livello: 'alto', descrizione: 'Attività di raccolta, trattamento e smaltimento dei rifiuti; recupero dei materiali' },
  { divisione: '39', sezione: 'E', livello: 'alto', descrizione: 'Attività di risanamento e altri servizi di gestione dei rifiuti' },
  { divisione: '41', sezione: 'F', livello: 'alto', descrizione: 'Costruzione di edifici' },
  { divisione: '42', sezione: 'F', livello: 'alto', descrizione: 'Ingegneria civile' },
  { divisione: '43', sezione: 'F', livello: 'alto', descrizione: 'Lavori di costruzione specializzati' },
  { divisione: '45', sezione: 'G', livello: 'basso', descrizione: 'Commercio all\'ingrosso e al dettaglio e riparazione di autoveicoli e motocicli' },
  { divisione: '46', sezione: 'G', livello: 'basso', descrizione: 'Commercio all\'ingrosso, escluso quello di autoveicoli e motocicli' },
  { divisione: '47', sezione: 'G', livello: 'basso', descrizione: 'Commercio al dettaglio, escluso quello di autoveicoli e motocicli' },
  { divisione: '49', sezione: 'H', livello: 'medio', descrizione: 'Trasporto terrestre e trasporto mediante condotte' },
  { divisione: '50', sezione: 'H', livello: 'medio', descrizione: 'Trasporto marittimo e per vie d\'acqua' },
  { divisione: '51', sezione: 'H', livello: 'medio', descrizione: 'Trasporto aereo' },
  { divisione: '52', sezione: 'H', livello: 'medio', descrizione: 'Magazzinaggio e attività di supporto ai trasporti' },
  { divisione: '53', sezione: 'H', livello: 'medio', descrizione: 'Servizi postali e attività di corriere' },
  { divisione: '55', sezione: 'I', livello: 'basso', descrizione: 'Alloggio' },
  { divisione: '56', sezione: 'I', livello: 'basso', descrizione: 'Attività dei servizi di ristorazione' },
  { divisione: '58', sezione: 'J', livello: 'basso', descrizione: 'Attività editoriali' },
  { divisione: '59', sezione: 'J', livello: 'basso', descrizione: 'Attività di produzione cinematografica, video e programmi TV, registrazioni musicali e sonore' },
  { divisione: '60', sezione: 'J', livello: 'basso', descrizione: 'Attività di programmazione e trasmissione' },
  { divisione: '61', sezione: 'J', livello: 'basso', descrizione: 'Telecomunicazioni' },
  { divisione: '62', sezione: 'J', livello: 'basso', descrizione: 'Produzione di software, consulenza informatica e attività connesse' },
  { divisione: '63', sezione: 'J', livello: 'basso', descrizione: 'Attività dei servizi d\'informazione e altri servizi informatici' },
  { divisione: '64', sezione: 'K', livello: 'basso', descrizione: 'Attività di servizi finanziari (escluse assicurazioni e fondi pensione)' },
  { divisione: '65', sezione: 'K', livello: 'basso', descrizione: 'Assicurazioni, riassicurazioni e fondi pensione (escluse assicurazioni sociali obbligatorie)' },
  { divisione: '66', sezione: 'K', livello: 'basso', descrizione: 'Attività ausiliarie dei servizi finanziari e delle attività assicurative' },
  { divisione: '68', sezione: 'L', livello: 'basso', descrizione: 'Attività immobiliari' },
  { divisione: '69', sezione: 'M', livello: 'basso', descrizione: 'Attività legali e contabilità' },
  { divisione: '70', sezione: 'M', livello: 'basso', descrizione: 'Attività di direzione aziendale e di consulenza gestionale' },
  { divisione: '71', sezione: 'M', livello: 'basso', descrizione: 'Attività studi di architettura e d\'ingegneria; collaudi ed analisi tecniche' },
  { divisione: '72', sezione: 'M', livello: 'basso', descrizione: 'Ricerca scientifica e sviluppo' },
  { divisione: '73', sezione: 'M', livello: 'basso', descrizione: 'Pubblicità e ricerche di mercato' },
  { divisione: '74', sezione: 'M', livello: 'basso', descrizione: 'Altre attività professionali, scientifiche e tecniche' },
  { divisione: '75', sezione: 'M', livello: 'basso', descrizione: 'Servizi veterinari' },
  { divisione: '77', sezione: 'N', livello: 'basso', descrizione: 'Attività di noleggio e leasing operativo' },
  { divisione: '78', sezione: 'N', livello: 'basso', descrizione: 'Attività di ricerca, selezione, fornitura di personale' },
  { divisione: '79', sezione: 'N', livello: 'basso', descrizione: 'Attività dei servizi delle agenzie di viaggio, dei tour operator e servizi di prenotazione e attività connesse' },
  { divisione: '80', sezione: 'N', livello: 'basso', descrizione: 'Servizi di vigilanza e investigazione' },
  { divisione: '81', sezione: 'N', livello: 'basso', descrizione: 'Attività di servizi per edifici e paesaggio' },
  { divisione: '82', sezione: 'N', livello: 'basso', descrizione: 'Attività di supporto per le funzioni d\'ufficio e altri servizi di supporto alle imprese' },
  { divisione: '84', sezione: 'O', livello: 'medio', descrizione: 'Amministrazione pubblica e difesa; assicurazione sociale obbligatoria' },
  { divisione: '85', sezione: 'P', livello: 'medio', descrizione: 'Istruzione' },
  { divisione: '86', sezione: 'Q', livello: 'alto', descrizione: 'Assistenza sanitaria' },
  { divisione: '87', sezione: 'Q', livello: 'alto', descrizione: 'Servizi di assistenza sociale residenziale' },
  { divisione: '88', sezione: 'Q', livello: 'medio', descrizione: 'Assistenza sociale non residenziale' },
  { divisione: '90', sezione: 'R', livello: 'basso', descrizione: 'Attività creative, artistiche e di intrattenimento' },
  { divisione: '91', sezione: 'R', livello: 'basso', descrizione: 'Attività di biblioteche, archivi, musei ed altre attività culturali' },
  { divisione: '92', sezione: 'R', livello: 'basso', descrizione: 'Attività riguardanti le lotterie, le scommesse, le case da gioco' },
  { divisione: '93', sezione: 'R', livello: 'basso', descrizione: 'Attività sportive, di intrattenimento e di divertimento' },
  { divisione: '94', sezione: 'S', livello: 'basso', descrizione: 'Attività di organizzazioni associative' },
  { divisione: '95', sezione: 'S', livello: 'basso', descrizione: 'Riparazione di computer e di beni per uso personale e per la casa' },
  { divisione: '96', sezione: 'S', livello: 'basso', descrizione: 'Altre attività di servizi per la persona' },
  { divisione: '97', sezione: 'T', livello: 'basso', descrizione: 'Attività di famiglie e convivenze come datori di lavoro per personale domestico' },
  { divisione: '98', sezione: 'T', livello: 'basso', descrizione: 'Produzione di beni e servizi indifferenziati per uso proprio da parte di famiglie e convivenze' },
  { divisione: '99', sezione: 'U', livello: 'basso', descrizione: 'Organizzazioni ed organismi extraterritoriali' },
];

const PER_DIVISIONE: Record<string, AtecoDivisione> =
  Object.fromEntries(ATECO_DIVISIONI.map((d) => [d.divisione, d]));

// Etichetta breve per la UI.
export const ETICHETTA_RISCHIO: Record<RischioAteco, string> = {
  basso: 'BASSO', medio: 'MEDIO', alto: 'ALTO',
};

// Normalizza un input ATECO in qualunque formato ('56', '56.10', '56.10.20',
// '5610' ...) ed estrae la divisione (prime 2 cifre). Restituisce la voce
// dell'Allegato IV o null se la divisione non e' classificata.
export function risolviAteco(codice: string | null | undefined): AtecoDivisione | null {
  if (!codice) return null;
  const m = String(codice).match(/(\d{1,2})/);
  if (!m) return null;
  const div = m[1].padStart(2, '0');
  return PER_DIVISIONE[div] ?? null;
}

// Toglie accenti e abbassa: per una ricerca testuale tollerante.
function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Suggerimenti per il typeahead: combacia per prefisso di codice (divisione) o
// per sottostringa nella descrizione/sezione. Le voci che combaciano sul codice
// vengono prima. Vuoto -> lista intera (per lo sfoglio iniziale). Di default
// nessun tetto: sono 88 voci e la tendina scrolla; passare `limite` per cap.
export function cercaAteco(query: string, limite = ATECO_DIVISIONI.length): AtecoDivisione[] {
  const q = (query ?? '').trim();
  if (!q) return ATECO_DIVISIONI.slice(0, limite);
  const digits = q.replace(/\D/g, '');
  const qn = norm(q);
  const perCodice: AtecoDivisione[] = [];
  const perTesto: AtecoDivisione[] = [];
  for (const d of ATECO_DIVISIONI) {
    if (digits && d.divisione.startsWith(digits.slice(0, 2))) { perCodice.push(d); continue; }
    if (norm(d.descrizione).includes(qn) || d.sezione.toLowerCase() === qn) perTesto.push(d);
  }
  return [...perCodice, ...perTesto].slice(0, limite);
}
