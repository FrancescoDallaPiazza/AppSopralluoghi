// Classificatore alias gestionale -> corso_catalogo ASR.
// Regole ORDINATE: vince la prima che matcha. `dub` marca le righe da rivedere
// a mano (la scelta non e' deterministica dal solo nome del corso).
const R = [];
const r = (re, d) => R.push({ re, d });

// ---------- 1. FUORI PERIMETRO SICUREZZA 81/08 -> ignorato ----------
r(/^MV \d+/i,                         { ign: 'ANSF - manutenzione rotabili' });
r(/QUALIFICA SALDATORE/i,             { ign: 'qualifica di processo, non 81/08' });
r(/PRIVACY|GDPR/i,                    { ign: 'privacy' });
r(/ABC RIFIUTI/i,                     { ign: 'ambiente' });
r(/IGIENE ALIMENTI/i,                 { ign: 'HACCP' });
r(/GESTIONE DELLA QUALIT/i,           { ign: 'qualita' });
r(/fitosanitari/i,                    { ign: 'patentino fitosanitari' });
r(/diisocianati/i,                    { ign: 'REACH diisocianati, non ASR' });
r(/Coronavirus|anticontagio/i,        { ign: 'emergenza COVID, non un requisito' });
r(/^Appalti e Subappalti/i,           { ign: 'formazione gestionale, nessun requisito' });

// ---------- 2. PARZIALI / INTEGRAZIONI (frazioni di corso) ----------
r(/AGGIORNAMENTO PARZIALE/i,          { ign: 'tranche parziale', dub: 'parziale' });
r(/PARZIALE 6H/i,                     { ign: 'tranche parziale', dub: 'parziale' });
r(/^INTEGRAZIONE R\.S\.P\.P\. DATORE DI LAVORO MODULO 3 E 4/i, { ign: 'integrazione di modulo', dub: 'parziale' });
r(/^INTEGRAZIONE FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI/i, { ign: 'integrazione', dub: 'parziale' });
r(/^Integrazione formazione specifica lavoratori/i,            { ign: 'integrazione ore', dub: 'parziale' });
r(/^integrazione Addetto alla conduzione di Piattaforme/i,     { ign: 'integrazione variante PLE', dub: 'parziale' });

// ---------- 3. VECCHIO REGIME -> pregressa ----------
r(/^Pre ASR_2015_/i,                                       { c: 'ATTR_CARRELLO', pre: 1 });
r(/^AGGIORNAMENTO R\.S\.P\.P\. DATORE DI LAVORO RISCHIO/i, { c: 'DL_RSPP_COMUNE', agg: 1, pre: 1 });
r(/^R\.S\.P\.P\. DATORE DI LAVORO RISCHIO/i,               { c: 'DL_RSPP_COMUNE', pre: 1 });
r(/^Aggiornamento A\.S\.P\.P\. A\.S\.R\. 2016/i,           { c: 'RSPP_MOD_B', agg: 1, pre: 1 });
r(/^Aggiornamento R\.S\.P\.P\. A\.S\.R\. 2016/i,           { c: 'RSPP_MOD_B', agg: 1, pre: 1 });
r(/^R\.S\.P\.P\. - Modulo C - A\.S\.R\. 2016/i,            { c: 'RSPP_MOD_C', pre: 1 });
r(/Modulo A - A\.S\.R\. 2016/i,                            { c: 'RSPP_MOD_A', pre: 1 });
r(/modulo B-SP\d/i,                                        { c: 'RSPP_MOD_B_SETTORE', pre: 1 });
r(/^R\.S\.P\.P\. \/ A\.S\.P\.P\. modulo B$/i,              { c: 'RSPP_MOD_B', pre: 1, dub: '12h: modulo B monco del vecchio regime' });

// ---------- 4. RSPP / ASPP (regime ASR 2025) ----------
r(/MODULO B di specializzazione SP\d/i,   { c: 'RSPP_MOD_B_SETTORE' });
r(/^Modulo integrativo \d.*RSPP/i,        { c: 'DL_RSPP_SETTORE' });
r(/RSPP ?\/ ?ASPP MODULO A/i,             { c: 'RSPP_MOD_A' });
r(/RSPP MODULO C/i,                       { c: 'RSPP_MOD_C' });
r(/modulo B COMUNE/i,                     { c: 'RSPP_MOD_B' });
r(/^AGGIORNAMENTO R\.SP\.P\.\/A\.S\.P\.P\. - MODULO B/i, { c: 'RSPP_MOD_B', agg: 1 });
r(/^Aggiornamento (RSPP|ASPP)$/i,         { c: 'RSPP_MOD_B', agg: 1 });

// ---------- 5. DATORE DI LAVORO / DL-RSPP ----------
r(/DATORE DI LAVORO CHE SVOLGE I COMPITI DI RSPP MODULO COMUNE/i, { c: 'DL_RSPP_COMUNE' });
r(/AGGIORNAMENTO DATORE DI LAVORO CHE SVOLGE I COMPITI DI RSPP/i, { c: 'DL_RSPP_COMUNE', agg: 1 });
r(/^Modulo Aggiuntivo .Cantieri. per Datori/i,    { c: 'CANTIERI' });
r(/^MODULO AGGIUNTIVO .CANTIERI. PER DIRIGENTE/i, { c: 'CANTIERI' });
r(/^Aggiornamento Datore di Lavoro con Modulo aggiuntivo/i, { c: 'DATORE_LAVORO', agg: 1, dub: 'pacchetto DL + modulo cantieri' });
r(/^Aggiornamento Datore di Lavoro$/i,            { c: 'DATORE_LAVORO', agg: 1 });
r(/^Datore di Lavoro con Modulo aggiuntivo/i,     { c: 'DATORE_LAVORO', dub: 'pacchetto DL + modulo cantieri' });
r(/^Datore di Lavoro$/i,                          { c: 'DATORE_LAVORO' });

// ---------- 6. DIRIGENTE / PREPOSTO / LAVORATORI / RLS ----------
r(/AGGIORNAMENTO DIRIGENTE\s+con modulo aggiuntivo cantieri/i,     { c: 'DIRIGENTE', agg: 1, dub: 'pacchetto dirigente + cantieri' });
r(/^(Aggiornamento Dirigenti|CORSO DI AGGIORNAMENTO DIRIGENTE)$/i, { c: 'DIRIGENTE', agg: 1 });
r(/^CORSO PER DIRIGENTE con modulo aggiuntivo cantieri/i,          { c: 'DIRIGENTE', dub: 'pacchetto dirigente + cantieri' });
r(/^(CORSO PER DIRIGENTE|Dirigenti)$/i,           { c: 'DIRIGENTE' });

r(/AGGIORNAMENTO LAVORATORI PREPOSTI/i,           { c: 'PREPOSTO', agg: 1 });
r(/AGGIORNAMENTO PER PREPOSTI/i,                  { c: 'PREPOSTO', agg: 1 });
r(/FORMAZIONE PARTICOLARE AGGIUNTIVA PREPOSTI/i,  { c: 'PREPOSTO' });
r(/FORMAZIONE PER PREPOSTI/i,                     { c: 'PREPOSTO' });

r(/^Aggiornamento formazione dei lavoratori Rischio/i, { c: 'LAV_SPEC', agg: 1 });
r(/^AGGIORNAMENTO LAVORATORI - 6 ORE/i,           { c: 'LAV_SPEC', agg: 1 });
r(/^Aggiornamento Lavoratori 6 ore/i,             { c: 'LAV_SPEC', agg: 1 });
r(/^Formazione dei lavoratori \(generale\)/i,     { c: 'LAV_GEN' });
r(/^Formazione (dei )?lavoratori Rischio/i,       { c: 'LAV_SPEC' });

r(/^Aggiornamento R\.L\.S\./i,                    { c: 'RLS', agg: 1 });
r(/^R\.L\.S\.$/i,                                 { c: 'RLS' });

// ---------- 7. ANTINCENDIO ----------
r(/aggiornamento antincendio per addetti antincendio in attivit. di livello 1/i, { c: 'AI_LIV1', agg: 1 });
r(/aggiornamento antincendio per addetti antincendio in attivit. di livello 2/i, { c: 'AI_LIV2', agg: 1 });
r(/aggiornamento antincendio per addetti antincendio in attivit. di livello 3/i, { c: 'AI_LIV3', agg: 1 });
r(/antincendio per addetti antincendio in attivit. di livello 1/i, { c: 'AI_LIV1' });
r(/antincendio per addetti antincendio in attivit. di livello 2/i, { c: 'AI_LIV2' });
r(/antincendio per addetti antincendio in attivit. di livello 3/i, { c: 'AI_LIV3' });
r(/^Aggiornamento addetto prevenzione incendio.*basso/i, { c: 'AI_LIV1', agg: 1 });
r(/^Aggiornamento addetto prevenzione incendio.*medio/i, { c: 'AI_LIV2', agg: 1 });
r(/^Aggiornamento addetto antincendio rischio alto/i,    { c: 'AI_LIV3', agg: 1 });
r(/^Addetto prevenzione incendio.*basso/i,               { c: 'AI_LIV1' });
r(/^Addetto prevenzione incendio.*medio/i,               { c: 'AI_LIV2' });
r(/^Corso Antincendio Rischio Alto/i,                    { c: 'AI_LIV3' });

// ---------- 8. PRIMO SOCCORSO / BLSD ----------
r(/AGGIORNAMENTO ADDETTO PRIMO SOCCORSO.*GRUPPO A/i,   { c: 'PS_GRA', agg: 1 });
r(/AGGIORNAMENTO ADDETTO PRIMO SOCCORSO.*GRUPPO B-C/i, { c: 'PS_GRBC', agg: 1 });
r(/ADDETTO PRIMO SOCCORSO.*GRUPPO A/i,                 { c: 'PS_GRA' });
r(/ADDETTO PRIMO SOCCORSO.*GRUPPO B-C/i,               { c: 'PS_GRBC' });
r(/^AGGIORNAMENTO BLS-D.*LAICO/i,                      { c: 'PS_BLSD_LAICO', agg: 1 });
r(/BLS-?D.*(PER SANITARI|SANITARIO)/i,                 { c: 'PS_BLSD_SANITARIO' });
r(/^BLS-D .*\(laico\)|^BLS-D .*LAICO/i,                { c: 'PS_BLSD_LAICO' });
r(/^ESECUTORE BLSD/i,                                  { c: 'PS_BLSD_LAICO', dub: 'BLSD "categoria B": laico o sanitario?' });

// ---------- 9. AMBIENTI CONFINATI / QUOTA / ELETTRICI ----------
r(/Lavori in Ambienti Confinati \(Aggiornamento/i,     { c: 'ATTR_AMB_CONFINATI', agg: 1 });
r(/Aggiornamento per lavoratori.*ambienti sospetti di inquinamento o confinati/i, { c: 'ATTR_AMB_CONFINATI', agg: 1 });
r(/spazi confinati|ambienti sospetti di inquinamento o confinati/i, { c: 'ATTR_AMB_CONFINATI' });
r(/Ambienti Sospetti di Presenza Amianto/i,            { ign: 'amianto: nessun corso a catalogo', dub: 'senza codice' });

r(/^Aggiornamento formazione lavori in quota/i,        { c: 'ATTR_LAV_QUOTA', agg: 1 });
r(/lavori in quota/i,                                  { c: 'ATTR_LAV_QUOTA' });
r(/LAVORI IN QUOTA E ALL.UTILIZZO DI SCALE/i,          { c: 'ATTR_LAV_QUOTA' });
r(/ATTIVITA. IN QUOTA PER LAVORATORI ADDETTI/i,        { c: 'ATTR_LAV_QUOTA' });

r(/^Aggiornamento PES E PAV/i,                         { c: 'ATTR_LAV_ELETTRICI', agg: 1 });
r(/PES,? PAV,? PEI|PEI, PES E PAV/i,                   { c: 'ATTR_LAV_ELETTRICI' });

// ---------- 10. ATTREZZATURE art. 73 (base + aggiornamento) ----------
const attr = (re, c) => {
  r(new RegExp('^(Aggiornamento|Corso di aggiornamento).*(' + re.source + ')', 'i'), { c, agg: 1 });
  r(re, { c });
};
attr(/CARRELLI ELEVATORI DI TIPO TRANSPALLET/i, 'ATTR_GENERICO');
attr(/carrelli elevatori/i,            'ATTR_CARRELLO');
attr(/piattaforme di lavoro mobili elevabili|\(PLE/i, 'ATTR_PLE');
attr(/gru a torre/i,                   'ATTR_GRU_TORRE');
attr(/gru mobili/i,                    'ATTR_GRU_MOBILI');
attr(/gru per autocarro/i,             'ATTR_GRU_AUTOCARRO');
attr(/carroponte|carriponte|gru a ponte|gru a bandiera|gru a cavalletto/i, 'ATTR_CARROPONTE');
attr(/escavatori|pale caricatrici|terne/i, 'ATTR_ESCAVATORI');
attr(/trattori agricoli o forestali.*(cingoli e ruote|ruote e a cingoli)/i, 'ATTR_TRATT_RUOTE');
attr(/trattori agricoli o forestali.*cingoli/i, 'ATTR_TRATT_CINGOLI');
attr(/trattori agricoli o forestali.*ruote/i,   'ATTR_TRATT_RUOTE');
attr(/autoribaltabili a cingoli/i,     'ATTR_GENERICO');
attr(/pompe per calcestruzzo/i,        'ATTR_GENERICO');
attr(/caricatori per la movimentazione di materiali/i, 'ATTR_GENERICO');
attr(/raccoglifrutta/i,                'ATTR_GENERICO');

// ---------- 11. SICUREZZA MA SENZA CODICE A CATALOGO ----------
r(/ponteggi/i,                         { ign: 'ponteggi (PIMUS): nessun corso a catalogo', dub: 'senza codice' });
r(/Coordinator[ei].*[Ss]icurezza|COORDINATORI PER LA PROGETTAZIONE/i, { ign: 'CSP/CSE: nessun corso ne figura a catalogo', dub: 'senza codice' });
r(/Segnaletica Stradale/i,             { ign: 'segnaletica stradale: nessun corso a catalogo', dub: 'senza codice' });

module.exports = { R };
