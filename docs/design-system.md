# Design System - SafeRoute

## Direzione estetica

Prodotto startup pronto per investitori, ispirato a Life360 ma più moderno, pulito e tech.

## Requisiti UI

- Mobile-first;
- responsive desktop/tablet/mobile;
- mappa protagonista;
- bottom sheet per azioni rapide;
- SOS sempre accessibile ma protetto da attivazione accidentale;
- dark mode e light mode coerenti (inclusa la mappa);
- landing page pubblica attrattiva;
- onboarding guidato;
- stato offline gestito esplicitamente.

## Palette

Safety colors:
- Safe Green: `#22C55E`
- Caution Yellow: `#FACC15`
- Danger Red: `#EF4444`
- Critical Purple: `#8B5CF6`
- Unknown White/Gray: `#F8FAFC` / `#CBD5E1`

Brand colors:
- Navy: `#020617`
- Blue: `#2563EB`
- Cyan: `#06B6D4`
- White: `#FFFFFF`

## Componenti principali

- AppShell
- MobileBottomNav
- MapView
- SafetyBottomSheet
- SOSButton
- RouteModeSlider
- EmergencyContactCard
- FeedbackModal
- ZoneDetailsPanel
- AdminTable
- StatusBadge
- ZoneEmptyState
- ConnectivityBanner
- SOSConfirmOverlay

## SOS: protezione da attivazione accidentale

Il pulsante SOS deve essere grande e sempre visibile (accessibilità), ma protetto da press accidentali.

Meccanismo obbligatorio: **long-press con progress bar visiva**.
- L'utente tiene premuto il pulsante per 1.5 secondi.
- Una progress bar circolare mostra il progresso del press.
- Rilasciando prima del completamento, l'azione viene annullata.
- Finestra di annullamento post-attivazione: 5 secondi dal completamento del press, prima che le notifiche SMS/email vengano effettivamente inviate. Durante questi 5 secondi viene mostrato un countdown con pulsante "Annulla".

Alternativa accettata: **slide to confirm** (slider orizzontale da sinistra a destra).

Entrambi i meccanismi devono essere accompagnati da feedback aptico (vibrazione) al completamento.

Il pulsante SOS non ha mai rate limit lato API.

## Mappa in dark mode

OpenStreetMap standard usa tile con sfondo chiaro. In dark mode, la mappa deve usare tile alternative scure.

Tile set consigliato per dark mode:
- **Carto Dark Matter**: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`

Il frontend deve passare la URL delle tile corretta in base al tema attivo (dark/light). Quando il tema cambia dinamicamente, la mappa deve aggiornare il tile layer senza ricaricare la pagina.

Alternativa CSS (meno accurata ma più semplice per MVP): `filter: invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)` applicato al container Leaflet solo in dark mode.

## Empty state: zone senza dati

Per un'app nuova la maggior parte delle zone avrà `safetyScore = null` (bianco/grigio). Questo stato deve comunicare utilità, non assenza di funzionamento.

Comportamento previsto per le zone grigie:
- tooltip/bottom sheet mostra: *"Nessun dato ancora per questa zona. Sii il primo a segnalare."*
- call to action per aggiungere una segnalazione o feedback;
- non mostrare punteggi o percentuali vuote.

Nella landing pubblica, comunicare proattivamente che il servizio cresce con la community e che le zone si colorano con l'uso.

## Geolocalizzazione non disponibile

Se l'utente rifiuta il permesso di geolocalizzazione o il browser la blocca:
- l'onboarding **non si blocca**: lo step geolocalizzazione mostra un messaggio esplicativo e un pulsante "Continua senza posizione";
- la mappa si apre centrata sull'Italia (lat: 41.9, lng: 12.5, zoom: 6);
- un banner fisso in alto avvisa: *"Posizione non disponibile. Alcune funzioni sono limitate."*;
- il pulsante SOS rimane sempre attivo: invia la posizione come `null` e il messaggio include *"Posizione GPS non disponibile"*.

## Stato offline / connessione assente

Il componente `ConnectivityBanner` deve monitorare `navigator.onLine` e gli errori di rete.

Comportamenti:
- banner non intrusivo in basso: *"Connessione assente — modalità limitata"*;
- la mappa mostra le tile già caricate nella cache del browser (Leaflet le mantiene automaticamente);
- i ping di posizione vengono accodati localmente (max 10) e inviati al ritorno della connessione;
- il pulsante SOS rimane sempre visibile e tenta l'invio con retry automatico;
- le funzioni che richiedono connessione (routing, feedback, segnalazioni) mostrano un avviso invece di fallire silenziosamente.

## Timing del feedback post-percorso

Il modal `FeedbackModal` viene mostrato:
- al completamento esplicito del percorso (pulsante "Termina percorso");
- **non** durante il percorso;
- se l'utente chiude la sessione senza terminare, il feedback viene proposto 1 sola volta al successivo avvio dell'app con messaggio: *"Hai un percorso recente — com'è andata?"*;
- il modal non blocca l'app: ha sempre un pulsante "Salta" visibile.

## Contatti emergenza: notifica di aggiunta

Quando un utente aggiunge un contatto emergenza, deve scegliere se inviare un messaggio di avviso al contatto.

Testo default del messaggio:
> *"[Nome utente] ti ha aggiunto come contatto di emergenza su SafeRoute. In caso di emergenza potresti ricevere un messaggio con la loro posizione. Non è richiesta alcuna azione."*

L'opzione di invio deve essere un checkbox (default: attivo) nello step di salvataggio del contatto. L'invio effettivo avviene solo se `phone` o `email` del contatto è disponibile.

Il campo `notifiedOnAdd` su `EmergencyContact` registra se il messaggio è stato inviato.

## Pagina pubblica tracking live

La pagina `GET /track/:token` è accessibile senza login e viene aperta dai contatti emergenza.

Deve mostrare:
- nome dell'utente in pericolo (non email, non ID);
- posizione corrente su mappa (aggiornata in tempo reale via SSE o polling ogni 15s);
- orario ultimo aggiornamento posizione;
- pulsante per chiamare il 112 (o numero emergenza locale);
- nessun altro dato personale.

La pagina mostra un avviso se il token è scaduto o la sessione è conclusa: *"Questo link non è più attivo."*

Il token non è mai rinnovabile dalla pagina pubblica — solo dall'utente autenticato.

## Accessibilità

- Contrasto elevato su tutti i colori safety;
- pulsanti grandi su mobile (min 48×48 px touch target);
- label chiare e descrittive su ogni input;
- stato SOS comunicato con testo + colore + icona (mai solo colore);
- supporto tastiera completo per dashboard e sezione admin;
- `aria-live` regions per aggiornamenti in tempo reale (nuova posizione, stato SOS);
- il meccanismo di long-press SOS deve avere un'alternativa accessibile (es. doppio tap con conferma testuale) per utenti con difficoltà motorie.
