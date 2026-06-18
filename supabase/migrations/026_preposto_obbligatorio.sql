-- 026_preposto_obbligatorio.sql
-- Il Preposto e' figura obbligatoria: passa a obbligo 'sempre' cosi' che, in
-- assenza di incaricato, l'organigramma lo segnali come ruolo scoperto (criticita').

update figura_sicurezza set obbligo = 'sempre' where codice = 'preposto';
