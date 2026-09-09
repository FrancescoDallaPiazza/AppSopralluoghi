// GENERATO DA scripts/genera-ateco.mjs — NON MODIFICARE A MANO.
// Fonte: FrancescoDallaPiazza/formazione-81-utils-src (allegato_iv_asr2025.js),
// versione 736699e 2026-09-09. Per aggiornarlo: `node scripts/genera-ateco.mjs`.
//
// Tabella ATECO -> livello di rischio formativo (Allegato IV ASR 17/04/2025,
// Rep. Atti 59/CSR), ancorata ad ATECO 2007 agg. 2022. Il rischio e' determinato
// dalla DIVISIONE (prime 2 cifre del codice). Livelli in minuscolo per combaciare
// con il vincolo di cliente.livello_rischio ('basso'|'medio'|'alto').
//
// IL VALORE E LA SUA PROVENIENZA SONO DUE CAMPI DIVERSI, e restano tali fin dove
// il dato arriva: `fonte` dice da dove viene il livello, `dedotto` dice che una
// parte del ragionamento non e' della norma ma nostra. Su 3 divisioni (30, 86, 87)
// il testo vigente non si legge — l'ultima pagina della tabella e' rotta di
// stampa — e il livello viene dalla fonte primaria del 2011 piu' la deduzione
// che il vigente non abbia inteso declassarle. Chi mostra un livello di rischio
// su queste divisioni deve poter dire da dove viene: in ispezione «l'ha messo il
// programma» non regge. Decisione del 9 settembre 2026, scheda 5 di AppOverall.

export type RischioAteco = 'basso' | 'medio' | 'alto';

export interface AtecoDivisione {
  divisione: string;    // due cifre, es. '56'
  sezione: string;      // lettera ATECO, es. 'I'
  livello: RischioAteco;
  descrizione: string;
  fonte: string;        // da dove viene il livello
  dedotto?: true;       // presente solo dove una parte del ragionamento e' nostra
}

const FONTE_VIGENTE =
  'Allegato IV ASR 17/04/2025 (Rep. Atti 59/CSR) - classificazione ancorata ad ATECO 2007 agg. 2022';
const FONTE_DEDOTTA =
  'Allegato II Accordo 221/CSR del 21/12/2011, GU n.8 dell\'11/01/2012 p. 48, atto 12A00059 — il testo vigente tace per guasto tipografico, non per scelta';

// Ordinata per divisione.
export const ATECO_DIVISIONI: AtecoDivisione[] = [
  { divisione: '01', sezione: 'A', livello: 'medio', descrizione: 'Coltivazioni agricole e produzione di prodotti animali, caccia e servizi connessi', fonte: FONTE_VIGENTE },
  { divisione: '02', sezione: 'A', livello: 'medio', descrizione: 'Silvicoltura ed utilizzo di aree forestali', fonte: FONTE_VIGENTE },
  { divisione: '03', sezione: 'A', livello: 'medio', descrizione: 'Pesca e acquacoltura', fonte: FONTE_VIGENTE },
  { divisione: '05', sezione: 'B', livello: 'alto', descrizione: 'Estrazione di carbone (esclusa torba)', fonte: FONTE_VIGENTE },
  { divisione: '06', sezione: 'B', livello: 'alto', descrizione: 'Estrazione di petrolio greggio e di gas naturale', fonte: FONTE_VIGENTE },
  { divisione: '07', sezione: 'B', livello: 'alto', descrizione: 'Estrazione di minerali metalliferi', fonte: FONTE_VIGENTE },
  { divisione: '08', sezione: 'B', livello: 'alto', descrizione: 'Altre attività di estrazione di minerali da cave e miniere', fonte: FONTE_VIGENTE },
  { divisione: '09', sezione: 'B', livello: 'alto', descrizione: 'Attività dei servizi di supporto all\'estrazione', fonte: FONTE_VIGENTE },
  { divisione: '10', sezione: 'C', livello: 'alto', descrizione: 'Industrie alimentari', fonte: FONTE_VIGENTE },
  { divisione: '11', sezione: 'C', livello: 'alto', descrizione: 'Industria delle bevande', fonte: FONTE_VIGENTE },
  { divisione: '12', sezione: 'C', livello: 'alto', descrizione: 'Industria del tabacco', fonte: FONTE_VIGENTE },
  { divisione: '13', sezione: 'C', livello: 'alto', descrizione: 'Industrie tessili', fonte: FONTE_VIGENTE },
  { divisione: '14', sezione: 'C', livello: 'alto', descrizione: 'Confezione di articoli di abbigliamento; confezione di articoli in pelle e pelliccia', fonte: FONTE_VIGENTE },
  { divisione: '15', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di articoli in pelle e simili', fonte: FONTE_VIGENTE },
  { divisione: '16', sezione: 'C', livello: 'alto', descrizione: 'Industria del legno e dei prodotti in legno e sughero (esclusi i mobili)', fonte: FONTE_VIGENTE },
  { divisione: '17', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di carta e di prodotti di carta', fonte: FONTE_VIGENTE },
  { divisione: '18', sezione: 'C', livello: 'alto', descrizione: 'Stampa e riproduzione di supporti registrati', fonte: FONTE_VIGENTE },
  { divisione: '19', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di coke e prodotti derivanti dalla raffinazione del petrolio', fonte: FONTE_VIGENTE },
  { divisione: '20', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di prodotti chimici', fonte: FONTE_VIGENTE },
  { divisione: '21', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di prodotti farmaceutici di base e di preparati farmaceutici', fonte: FONTE_VIGENTE },
  { divisione: '22', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di articoli in gomma e materie plastiche', fonte: FONTE_VIGENTE },
  { divisione: '23', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di altri prodotti della lavorazione di minerali non metalliferi', fonte: FONTE_VIGENTE },
  { divisione: '24', sezione: 'C', livello: 'alto', descrizione: 'Metallurgia', fonte: FONTE_VIGENTE },
  { divisione: '25', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di prodotti di metallo (esclusi macchinari e attrezzature)', fonte: FONTE_VIGENTE },
  { divisione: '26', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di computer e prodotti di elettronica e ottica', fonte: FONTE_VIGENTE },
  { divisione: '27', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di apparecchiature elettriche e per uso domestico non elettriche', fonte: FONTE_VIGENTE },
  { divisione: '28', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di macchinari ed apparecchiature NCA', fonte: FONTE_VIGENTE },
  { divisione: '29', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di autoveicoli, rimorchi e semirimorchi', fonte: FONTE_VIGENTE },
  { divisione: '30', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di altri mezzi di trasporto', fonte: FONTE_DEDOTTA, dedotto: true },
  { divisione: '31', sezione: 'C', livello: 'alto', descrizione: 'Fabbricazione di mobili', fonte: FONTE_VIGENTE },
  { divisione: '32', sezione: 'C', livello: 'alto', descrizione: 'Altre industrie manifatturiere', fonte: FONTE_VIGENTE },
  { divisione: '33', sezione: 'C', livello: 'alto', descrizione: 'Riparazione, manutenzione ed installazione di macchine ed apparecchiature', fonte: FONTE_VIGENTE },
  { divisione: '35', sezione: 'D', livello: 'alto', descrizione: 'Fornitura di energia elettrica, gas, vapore e aria condizionata', fonte: FONTE_VIGENTE },
  { divisione: '36', sezione: 'E', livello: 'alto', descrizione: 'Raccolta, trattamento e fornitura di acqua', fonte: FONTE_VIGENTE },
  { divisione: '37', sezione: 'E', livello: 'alto', descrizione: 'Gestione delle reti fognarie', fonte: FONTE_VIGENTE },
  { divisione: '38', sezione: 'E', livello: 'alto', descrizione: 'Attività di raccolta, trattamento e smaltimento dei rifiuti; recupero dei materiali', fonte: FONTE_VIGENTE },
  { divisione: '39', sezione: 'E', livello: 'alto', descrizione: 'Attività di risanamento e altri servizi di gestione dei rifiuti', fonte: FONTE_VIGENTE },
  { divisione: '41', sezione: 'F', livello: 'alto', descrizione: 'Costruzione di edifici', fonte: FONTE_VIGENTE },
  { divisione: '42', sezione: 'F', livello: 'alto', descrizione: 'Ingegneria civile', fonte: FONTE_VIGENTE },
  { divisione: '43', sezione: 'F', livello: 'alto', descrizione: 'Lavori di costruzione specializzati', fonte: FONTE_VIGENTE },
  { divisione: '45', sezione: 'G', livello: 'basso', descrizione: 'Commercio all\'ingrosso e al dettaglio e riparazione di autoveicoli e motocicli', fonte: FONTE_VIGENTE },
  { divisione: '46', sezione: 'G', livello: 'basso', descrizione: 'Commercio all\'ingrosso, escluso quello di autoveicoli e motocicli', fonte: FONTE_VIGENTE },
  { divisione: '47', sezione: 'G', livello: 'basso', descrizione: 'Commercio al dettaglio, escluso quello di autoveicoli e motocicli', fonte: FONTE_VIGENTE },
  { divisione: '49', sezione: 'H', livello: 'medio', descrizione: 'Trasporto terrestre e trasporto mediante condotte', fonte: FONTE_VIGENTE },
  { divisione: '50', sezione: 'H', livello: 'medio', descrizione: 'Trasporto marittimo e per vie d\'acqua', fonte: FONTE_VIGENTE },
  { divisione: '51', sezione: 'H', livello: 'medio', descrizione: 'Trasporto aereo', fonte: FONTE_VIGENTE },
  { divisione: '52', sezione: 'H', livello: 'medio', descrizione: 'Magazzinaggio e attività di supporto ai trasporti', fonte: FONTE_VIGENTE },
  { divisione: '53', sezione: 'H', livello: 'medio', descrizione: 'Servizi postali e attività di corriere', fonte: FONTE_VIGENTE },
  { divisione: '55', sezione: 'I', livello: 'basso', descrizione: 'Alloggio', fonte: FONTE_VIGENTE },
  { divisione: '56', sezione: 'I', livello: 'basso', descrizione: 'Attività dei servizi di ristorazione', fonte: FONTE_VIGENTE },
  { divisione: '58', sezione: 'J', livello: 'basso', descrizione: 'Attività editoriali', fonte: FONTE_VIGENTE },
  { divisione: '59', sezione: 'J', livello: 'basso', descrizione: 'Attività di produzione cinematografica, video e programmi TV, registrazioni musicali e sonore', fonte: FONTE_VIGENTE },
  { divisione: '60', sezione: 'J', livello: 'basso', descrizione: 'Attività di programmazione e trasmissione', fonte: FONTE_VIGENTE },
  { divisione: '61', sezione: 'J', livello: 'basso', descrizione: 'Telecomunicazioni', fonte: FONTE_VIGENTE },
  { divisione: '62', sezione: 'J', livello: 'basso', descrizione: 'Produzione di software, consulenza informatica e attività connesse', fonte: FONTE_VIGENTE },
  { divisione: '63', sezione: 'J', livello: 'basso', descrizione: 'Attività dei servizi d\'informazione e altri servizi informatici', fonte: FONTE_VIGENTE },
  { divisione: '64', sezione: 'K', livello: 'basso', descrizione: 'Attività di servizi finanziari (escluse assicurazioni e fondi pensione)', fonte: FONTE_VIGENTE },
  { divisione: '65', sezione: 'K', livello: 'basso', descrizione: 'Assicurazioni, riassicurazioni e fondi pensione (escluse assicurazioni sociali obbligatorie)', fonte: FONTE_VIGENTE },
  { divisione: '66', sezione: 'K', livello: 'basso', descrizione: 'Attività ausiliarie dei servizi finanziari e delle attività assicurative', fonte: FONTE_VIGENTE },
  { divisione: '68', sezione: 'L', livello: 'basso', descrizione: 'Attività immobiliari', fonte: FONTE_VIGENTE },
  { divisione: '69', sezione: 'M', livello: 'basso', descrizione: 'Attività legali e contabilità', fonte: FONTE_VIGENTE },
  { divisione: '70', sezione: 'M', livello: 'basso', descrizione: 'Attività di direzione aziendale e di consulenza gestionale', fonte: FONTE_VIGENTE },
  { divisione: '71', sezione: 'M', livello: 'basso', descrizione: 'Attività studi di architettura e d\'ingegneria; collaudi ed analisi tecniche', fonte: FONTE_VIGENTE },
  { divisione: '72', sezione: 'M', livello: 'basso', descrizione: 'Ricerca scientifica e sviluppo', fonte: FONTE_VIGENTE },
  { divisione: '73', sezione: 'M', livello: 'basso', descrizione: 'Pubblicità e ricerche di mercato', fonte: FONTE_VIGENTE },
  { divisione: '74', sezione: 'M', livello: 'basso', descrizione: 'Altre attività professionali, scientifiche e tecniche', fonte: FONTE_VIGENTE },
  { divisione: '75', sezione: 'M', livello: 'basso', descrizione: 'Servizi veterinari', fonte: FONTE_VIGENTE },
  { divisione: '77', sezione: 'N', livello: 'basso', descrizione: 'Attività di noleggio e leasing operativo', fonte: FONTE_VIGENTE },
  { divisione: '78', sezione: 'N', livello: 'basso', descrizione: 'Attività di ricerca, selezione, fornitura di personale', fonte: FONTE_VIGENTE },
  { divisione: '79', sezione: 'N', livello: 'basso', descrizione: 'Attività dei servizi delle agenzie di viaggio, dei tour operator e servizi di prenotazione e attività connesse', fonte: FONTE_VIGENTE },
  { divisione: '80', sezione: 'N', livello: 'basso', descrizione: 'Servizi di vigilanza e investigazione', fonte: FONTE_VIGENTE },
  { divisione: '81', sezione: 'N', livello: 'basso', descrizione: 'Attività di servizi per edifici e paesaggio', fonte: FONTE_VIGENTE },
  { divisione: '82', sezione: 'N', livello: 'basso', descrizione: 'Attività di supporto per le funzioni d\'ufficio e altri servizi di supporto alle imprese', fonte: FONTE_VIGENTE },
  { divisione: '84', sezione: 'O', livello: 'medio', descrizione: 'Amministrazione pubblica e difesa; assicurazione sociale obbligatoria', fonte: FONTE_VIGENTE },
  { divisione: '85', sezione: 'P', livello: 'medio', descrizione: 'Istruzione', fonte: FONTE_VIGENTE },
  { divisione: '86', sezione: 'Q', livello: 'alto', descrizione: 'Assistenza sanitaria', fonte: FONTE_DEDOTTA, dedotto: true },
  { divisione: '87', sezione: 'Q', livello: 'alto', descrizione: 'Servizi di assistenza sociale residenziale', fonte: FONTE_DEDOTTA, dedotto: true },
  { divisione: '88', sezione: 'Q', livello: 'medio', descrizione: 'Assistenza sociale non residenziale', fonte: FONTE_VIGENTE },
  { divisione: '90', sezione: 'R', livello: 'basso', descrizione: 'Attività creative, artistiche e di intrattenimento', fonte: FONTE_VIGENTE },
  { divisione: '91', sezione: 'R', livello: 'basso', descrizione: 'Attività di biblioteche, archivi, musei ed altre attività culturali', fonte: FONTE_VIGENTE },
  { divisione: '92', sezione: 'R', livello: 'basso', descrizione: 'Attività riguardanti le lotterie, le scommesse, le case da gioco', fonte: FONTE_VIGENTE },
  { divisione: '93', sezione: 'R', livello: 'basso', descrizione: 'Attività sportive, di intrattenimento e di divertimento', fonte: FONTE_VIGENTE },
  { divisione: '94', sezione: 'S', livello: 'basso', descrizione: 'Attività di organizzazioni associative', fonte: FONTE_VIGENTE },
  { divisione: '95', sezione: 'S', livello: 'basso', descrizione: 'Riparazione di computer e di beni per uso personale e per la casa', fonte: FONTE_VIGENTE },
  { divisione: '96', sezione: 'S', livello: 'basso', descrizione: 'Altre attività di servizi per la persona', fonte: FONTE_VIGENTE },
  { divisione: '97', sezione: 'T', livello: 'basso', descrizione: 'Attività di famiglie e convivenze come datori di lavoro per personale domestico', fonte: FONTE_VIGENTE },
  { divisione: '98', sezione: 'T', livello: 'basso', descrizione: 'Produzione di beni e servizi indifferenziati per uso proprio da parte di famiglie e convivenze', fonte: FONTE_VIGENTE },
  { divisione: '99', sezione: 'U', livello: 'basso', descrizione: 'Organizzazioni ed organismi extraterritoriali', fonte: FONTE_VIGENTE },
];
