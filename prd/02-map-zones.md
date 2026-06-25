# PRD 02 - Mappa e zone

## Obiettivo

Mostrare una mappa interattiva con zone colorate in base al livello di sicurezza.

## Funzioni

- Leaflet + OpenStreetMap;
- geolocalizzazione utente;
- marker posizione;
- zoom e pan;
- zone ufficiali/quartieri;
- comuni piccoli come zona unica;
- colore zona;
- pannello dettagli zona.

## Stati colore

- Bianco/grigio: servizio non attivo o dati insufficienti;
- verde: sicura;
- giallo: attenzione;
- rosso: pericolosa;
- viola: molto pericolosa.

## Dettagli zona

Mostrare:
- nome zona;
- livello sicurezza;
- ultime segnalazioni 30 giorni;
- SOS ultimi 30 giorni;
- feedback ultimi 30 giorni.

## Import dati

Prevedere seed da file:
- JSON consigliato;
- CSV opzionale;
- geometryJson per poligoni semplificati.

## Criteri accettazione

- Mappa funzionante;
- posizione utente visibile;
- zone colorate;
- click su zona apre dettagli.
