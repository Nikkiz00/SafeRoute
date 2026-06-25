# PRD - SafeRoute

## 1. Panoramica del progetto
SafeRoute è una web application pensata per migliorare la sicurezza percepita durante gli spostamenti urbani, in particolare di notte o in contesti poco familiari. Il prodotto offre un’interfaccia moderna e intuitiva per selezionare percorsi urbani ottimizzati per la sicurezza, monitorare la posizione in tempo reale e attivare rapidamente un allarme SOS.

## 2. Problema da risolvere
La sicurezza urbana rappresenta un fenomeno multidimensionale che combina aspetti oggettivi (reati registrati) e soggettivi (percezione di insicurezza). Secondo i dati dell’Agenzia dell’Unione Europea per i Diritti Fondamentali (FRA) e dell’Istat (2023-2025), oltre il 60% delle donne europee e italiane dichiara di sentirsi insicura camminando da sola di notte, con l’Italia che registra uno dei divari di genere più marcati: solo il 44% delle donne italiane si sente al sicuro dopo il tramonto, contro il 76% degli uomini (divario di 32 punti percentuali).

Questa percezione di vulnerabilità limita la mobilità urbana: a Milano, oltre il 20% delle donne evita di uscire di notte per timore di aggressioni, contro il 3,8% degli uomini. I dati Eurostat e UNODC (2023-2024) evidenziano un aumento della violenza sessuale (+94,2% dal 2014) e un tasso di omicidi contenuto (0,5 per 100.000 abitanti in Italia), ma con una concentrazione di reati predatori nelle grandi città come Milano, Roma e Firenze, dove le denunce superano i 6.000 per 100.000 abitanti.

Le infrastrutture urbane contribuiscono al problema: il 28,1% delle strade milanesi necessita di migliore illuminazione, e la desertificazione commerciale (diminuzione del 17% dei negozi dal 2012) aumenta il degrado percepito. La mobilità notturna è limitata: solo città come Bologna e Roma offrono reti notturne estese, ma la percezione di insicurezza sui mezzi pubblici rimane elevata.

In sintesi, la mancanza di strumenti digitali che combinano routing prudente (basato su strade illuminate, aree commerciali e trasporti notturni) con funzioni di emergenza aumenta l’ansia e limita la libertà di movimento, specialmente per donne, giovani e turisti.

## 3. Obiettivi del prodotto
- Offrire un’esperienza web con una mappa interattiva e percorsi orientati alla sicurezza.
- Ridurre la sensazione di pericolo durante gli spostamenti notturni o in aree sconosciute.
- Consentire la condivisione rapida della posizione con contatti fidati.
- Fornire un pulsante SOS facilmente accessibile per emergenze.
- Realizzare un MVP dimostrabile e responsive, adatto a un concorso o a una presentazione.

## 4. Target utenti
- Donne e ragazze, che rappresentano il segmento più colpito dalla percezione di insicurezza (44% si sente al sicuro di notte in Italia, vs 76% uomini, FRA 2024).
- Studenti universitari e delle scuole superiori, spesso in movimento notturno in città sconosciute.
- Turisti e visitatori di nuove città, specialmente in aree metropolitane come Milano, Roma e Firenze (con denunce >6.000/100k abitanti).
- Persone che si spostano in città di sera, limitate dalla mobilità notturna e illuminazione insufficiente.
- Utenti che viaggiano o telefonano da soli, in contesti di degrado urbano e desertificazione commerciale.

## 5. Funzionalità principali
1. Mappa interattiva con selezione di punti di partenza e destinazione.
2. Calcolo di percorsi più sicuri rispetto ai percorsi standard, basato su dati di illuminazione pubblica, densità commerciale, presenza di trasporti notturni e aree a rischio ridotto (secondo statistiche FRA, Istat e Eurostat).
3. Pulsante SOS per inviare la posizione in emergenza.
4. Condivisione della propria posizione in tempo reale con un contatto fidato.
5. Visualizzazione delle informazioni di sicurezza del percorso e delle aree da evitare.

## 6. User stories
- Come utente, voglio inserire un punto di partenza e una destinazione per vedere il percorso più sicuro.
- Come utente, voglio confrontare il percorso sicuro con un percorso standard per capire la differenza.
- Come utente, voglio premere un pulsante SOS per inviare subito la mia posizione a un contatto fidato.
- Come utente, voglio condividere la mia posizione in tempo reale durante il tragitto.
- Come utente, desidero un’interfaccia semplice e leggibile anche su dispositivi mobili.

## 7. Requisiti funzionali
- RF1: Visualizzare una mappa interattiva con zoom, pan e selezione dei punti.
- RF2: Inserire partenza e destinazione tramite form con autocompletamento opzionale.
- RF3: Calcolare e mostrare un percorso ottimizzato per sicurezza.
- RF4: Mostrare icone e layer per indicare aree ad alto rischio o zone da evitare.
- RF5: Abilitare un pulsante SOS che invia la posizione a un contatto fidato.
- RF6: Fornire un meccanismo di condivisione della posizione in tempo reale.
- RF7: Offrire feedback visivo chiaro su stato del percorso e avvisi di emergenza.
- RF8: Supportare layout responsive su desktop, tablet e mobile.

## 8. Requisiti non funzionali
- RNF1: Prestazioni rapide nel rendering della mappa e nel calcolo dei percorsi.
- RNF2: Sicurezza dei dati dell’utente e crittografia delle informazioni sensibili.
- RNF3: Alta affidabilità del pulsante SOS e della condivisione posizione.
- RNF4: Interfaccia accessibile e leggibile, con contrasti adeguati e testi chiari.
- RNF5: Scalabilità per supportare l’aggiunta di nuovi criteri di sicurezza.
- RNF6: Compatibilità cross-browser moderna (Chrome, Edge, Firefox, Safari).
- RNF7: Disclaimer legale chiaro: i percorsi sono consigli orientativi basati su dati pubblici, non garanzia di sicurezza assoluta (per mitigare rischi legali su responsabilità).

## 9. Struttura delle pagine
- Home / Dashboard
  - Titolo, slogan, breve descrizione
  - Mappa interattiva principale
  - Modulo rapido per partenza/destinazione
  - Indicazioni sul percorso sicuro e stato attuale
- Pagina Percorso
  - Dettagli del percorso consigliato
  - Alternative e confronto con percorso standard
  - Metriche di sicurezza (es. zone evitate, tempo stimato)
- Pagina SOS / Emergenza
  - Pulsante SOS sempre visibile
  - Stato invio posizione
  - Contatto fidato configurato
- Pagina Condividi posizione
  - Avvio / stop condivisione in tempo reale
  - Notifiche su condivisione attiva
  - Informazioni sul destinatario della condivisione
- Pagina Info / About
  - Descrizione del servizio
  - Come funziona SafeRoute
  - Slogan e stile del progetto

## 10. Flussi utente
1. Flusso principale di navigazione sicura
   - L’utente arriva sulla homepage.
   - Inserisce partenza e destinazione.
   - Il sistema calcola e mostra il percorso più sicuro sulla mappa.
   - L’utente visualizza i dettagli e avvia il tragitto.
2. Flusso SOS
   - L’utente preme il pulsante SOS.
   - Il sistema rileva la posizione attuale.
   - Viene inviata la localizzazione a un contatto fidato (via SMS, email, o link condiviso).
   - L’utente riceve conferma di invio.
3. Flusso condivisione in tempo reale
   - L’utente attiva la condivisione posizione.
   - Viene creato un link o un canale di monitoraggio condivisibile.
   - Il contatto fidato visualizza la posizione aggiornata sulla mappa.
   - L’utente può disattivare la condivisione in qualsiasi momento.

## 11. Priorità MVP
### Must-have
- Mappa interattiva con selezione di partenza e destinazione.
- Calcolo percorso sicuro e visualizzazione su mappa.
- Pulsante SOS con invio posizione.
- Layout responsive e stile professionale.
### Should-have
- Condivisione della posizione in tempo reale.
- Indicazione di aree pericolose o zone da evitare.
- Pagina informazioni e supporto al prodotto.
### Could-have
- Autenticazione utente e gestione contatti fidati.
- Profilo utente con preferenze di sicurezza.
- Punteggio di sicurezza del percorso e statistiche.
### Won’t-have (per l’MVP)
- Funzionalità avanzate di social network.
- Integrazione con sistemi di emergenza locale.
- Sistema di punteggio sociale o gamification.

## 12. Possibili sviluppi futuri
- Implementazione di profili utente e autenticazione.
- Aggiunta di mappe basate su dati di crimine, illuminazione e densità pedonale.
- Integrazione con API di trasporti pubblici e servizi di mobilità notturna (es. linee N di Bologna e Roma).
- Notifiche push geolocalizzate per cambi di percorso in tempo reale.
- Funzionalità di community reporting per segnalare aree pericolose.
- Modalità offline e salvataggio di percorsi sicuri.
- Focus su coesione sociale: suggerimenti per aree con alta densità commerciale per ridurre degrado percepito.

## 13. Indicazioni UI/UX
- Layout moderno, minimal e professionale.
- Tema scuro con accenti in verde neon, blu acceso e bianco.
- Contrasto elevato e tipografia chiara per accessibilità.
- Pulsante SOS grande e sempre visibile, preferibilmente fisso in basso.
- Mappa dominante nella UI, con informazioni di contesto sovrapposte in modo pulito.
- Elementi interattivi evidenti e facilmente cliccabili su mobile.
- Animazioni leggere per transizioni di percorso e conferme di azione.

## 14. Suggerimento stack tecnico
### Frontend
- React (o Vue) per il rendering dinamico.
- Libreria mappe: Mapbox GL JS, Leaflet con OpenStreetMap oppure Google Maps API.
- CSS: Tailwind CSS, SCSS o styled-components per lo stile moderno.
- Responsive design mobile-first.
### Backend
- Node.js con Express o Fastify per API REST.
- Database leggero: PostgreSQL, SQLite o MongoDB per impostazioni e contatti.
- Servizio di geocoding/directions: Mapbox Directions, OpenRouteService o Google Directions.
### Infrastruttura
- Deploy su Vercel, Netlify o Azure Static Web Apps per il frontend.
- Backend su Heroku, Railway o Azure App Service.
- Logging e monitoring basilare per tracciamento errori.

## 15. Criteri di accettazione
- Il sito web mostra una mappa interattiva funzionante e responsive.
- L’utente può inserire partenza e destinazione e ricevere un percorso sicuro.
- È presente un pulsante SOS operativo con invio della posizione.
- L’interfaccia rispetta lo stile moderno, minimal e professionale descritto.
- L’applicazione è navigabile su desktop e mobile senza rotture evidenti.
- I requisiti funzionali principali sono verificati con test manuali: percorso sicuro, SOS, condivisione base.
- Il documento è pronto per essere usato come base di sviluppo dell’MVP.
