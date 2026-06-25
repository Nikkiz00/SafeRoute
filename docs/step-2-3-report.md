# Report Step 2.3 — Tracking, GPS & Route Stability

**Data:** 2026-06-23

---

## Bug trovati e corretti

### Bug 1 — SSE non-null assertion [FIXED]

**Problema:** `TrackingPublicPage.vue` usava `data.value!` (non-null assertion) nell'handler SSE. In caso di messaggi `init` ricevuti prima che `data` fosse inizializzato, il codice poteva produrre errori runtime silenziosi o dati corrotti.

**Soluzione:** rimossa la non-null assertion. Il messaggio `init` ora aggiorna `data.value` in modo sicuro con un controllo esplicito. Il messaggio `status` con valore `completed` o `cancelled` chiude correttamente l'EventSource.

**File:** `frontend/src/pages/TrackingPublicPage.vue`

---

### Bug 2 — Polling infinito su sessione conclusa [FIXED]

**Problema:** il fallback polling di `TrackingPublicPage.vue` continuava a girare anche dopo che la sessione diventava `completed` o `cancelled`. Ogni intervallo eseguiva una fetch inutile e loggava, consumando risorse.

**Soluzione:** il polling controlla lo stato della sessione ad ogni ciclo. Se la sessione non è più `active`, il polling si ferma autonomamente tramite `clearInterval`.

**File:** `frontend/src/pages/TrackingPublicPage.vue`

---

### Bug 3 — Page Visibility API non cleanup in TrackingPublicPage [FIXED]

**Problema:** l'handler `visibilitychange` veniva aggiunto ma mai rimosso al momento della distruzione del componente. In navigazione SPA con Vue Router, il listener restava attivo in background causando fetch spurie.

**Soluzione:** handler aggiunto in `onMounted` e rimosso in `onUnmounted`. Quando il tab torna visibile e siamo in modalità polling, viene eseguita una fetch immediata per aggiornare subito la posizione senza aspettare il prossimo ciclo.

**File:** `frontend/src/pages/TrackingPublicPage.vue`

---

### Bug 4 — Mappa che salta durante tracking [FIXED]

**Problema:** `updateMarker` chiamava `map.setView()` ad ogni aggiornamento di posizione, anche quando il marker era già visibile nel viewport. Questo causava micro-salti e animazioni indesiderate durante il tracking attivo.

**Soluzione:** `updateMarker` verifica prima se le nuove coordinate sono dentro il bounds corrente della mappa (`map.getBounds().contains()`). Il re-centering avviene solo se il marker esce dal viewport.

**File:** `frontend/src/pages/TrackingPublicPage.vue`

---

### Bug 5 — Page Visibility API non modulare in useRouteTracker [FIXED]

**Problema:** `useRouteTracker.ts` non gestiva il cambio di visibilità del tab. Quando l'utente tornava sull'app dopo aver usato un'altra applicazione, il composable non reimpostava `lastUpdateTime`, potendo inviare ping con timestamp errati.

**Soluzione:** aggiunto handler `visibilitychange` modulare che reimposta `lastUpdateTime` al momento della visibilità. Variabili di modulo documentate con commento esplicito sull'assunzione single-instance.

**File:** `frontend/src/composables/useRouteTracker.ts`

---

### Bug 6 — GPS senza log diagnostici [FIXED]

**Problema:** in caso di problema GPS (segnale scarso, permesso negato, posizioni scartate per accuracy), non erano presenti log leggibili. Il debug richiedeva break point manuali.

**Soluzione:** log strutturati con prefisso `[gps]` per ogni evento rilevante: posizione accettata, skip per accuracy (con valore in metri), skip per distanza minima (con delta in metri), errori geolocation per codice (1/2/3), successo/fallimento dell'aggiornamento backend.

**File:** `frontend/src/composables/useRouteTracker.ts`

---

### Bug 7 — TrackingData senza nome utente [FIXED]

**Problema:** la pagina pubblica di tracking mostrava la posizione dell'utente senza alcun nome. Chi riceveva il link non sapeva a chi appartenesse il tracking. `TrackingData` non includeva `userName`.

**Soluzione:** `TrackingData` nel service backend ora include `userName: string`. La query recupera il nome display dell'utente (solo `name`, niente email o ID). Il tipo `TrackingData` in `frontend/src/types/index.ts` è stato aggiornato in modo coerente.

**File:**
- `backend/src/modules/tracking/tracking.service.ts`
- `frontend/src/types/index.ts`

---

### Bug 8 — Spinner infinito "Calcolo in corso..." nel routing fallback [FIXED]

**Problema:** `RouteTrackingPanel.vue` mostrava "Calcolo in corso..." quando `distanceKm === null`. In modalità fallback (OSRM non disponibile), `distanceKm` rimaneva `null` indefinitamente e lo spinner non spariva mai.

**Soluzione:** aggiunto controllo su `isRoutingFallback`. Se `isRoutingFallback === true` e `distanceKm === null`, il pannello mostra "Percorso non calcolato" al posto dello spinner, comunicando onestamente la situazione.

**File:** `frontend/src/components/map/RouteTrackingPanel.vue`

---

### Bug 9 — Errori GPS con messaggio generico [FIXED]

**Problema:** `RouteStartModal.vue` gestiva tutti gli errori dell'API Geolocation con un unico messaggio generico ("Impossibile ottenere la posizione"). L'utente non poteva distinguere tra permesso negato, GPS non disponibile e timeout.

**Soluzione:** l'error callback ora discrimina per `error.code`: `PERMISSION_DENIED` (code 1) → invita ad abilitare la posizione nelle impostazioni; `POSITION_UNAVAILABLE` (code 2) → suggerisce di uscire all'aperto; `TIMEOUT` (code 3) → invita a riprovare.

**File:** `frontend/src/components/map/RouteStartModal.vue`

---

### Bug 10 — Operazioni route senza log backend [FIXED]

**Problema:** `routes.service.ts` eseguiva `startRoute`, `updateLocation`, `completeRoute` e `cancelRoute` senza produrre alcun log. In sviluppo era impossibile seguire il flusso senza debugger attivo.

**Soluzione:** log strutturati aggiunti per ogni operazione, con esito (successo/fallimento) e dati minimi utili (sessionId, userId, status). Nessun dato sensibile loggato.

**File:** `backend/src/modules/routes/routes.service.ts`

---

## Problemi ancora aperti

| Problema | Priorità | Motivazione rinvio |
|---|---|---|
| GPS adaptive frequency (meno ping in stazionario) | Media | Richiede Accelerometer API / DeviceMotion — supporto browser non uniforme |
| Tracking token revoca manuale | Media | Richiede nuovo endpoint backend e UI dedicata |
| Safety-based routing | Bassa | Richiede Valhalla o OSRM custom weight — Day 9+ |
| Redis per last ping cache | Bassa | Non necessario per MVP locale |
| LocationPing queue offline (max 10 ping) | Bassa | Richiede service worker o IndexedDB — previsto ma non implementato |

---

## Comportamento finale del tracking

Dal lato dell'utente che avvia un percorso: apre `RouteStartModal`, seleziona la destinazione, conferma l'avvio. Il composable `useRouteTracker` acquisisce la posizione GPS con `watchPosition`, filtra i ping per accuracy (> 50 m scartati) e distanza minima (< 10 m ignorati), applica un low-pass filter (alpha = 0.15), e invia ogni ping valido al backend tramite `PATCH /api/routes/:id/location`. Ogni evento rilevante (posizione accettata, skip, errore, risposta backend) produce un log `[gps]` in console.

Dal lato di chi riceve il link e apre la pagina pubblica `/track/:token`: `TrackingPublicPage.vue` apre prima una connessione SSE a `/api/tracking/:token/stream`. In caso di fallimento SSE (fino a 3 tentativi con delay 3 secondi), il componente scende in modalità polling HTTP ogni 15 secondi su `/api/tracking/:token`. La pagina mostra il nome display dell'utente (`userName`), l'ultima posizione su mappa Leaflet e lo stato della sessione. Se il tab viene nascosto e poi mostrato, il polling esegue una fetch immediata. Alla ricezione di uno stato `completed` o `cancelled`, SSE e polling si fermano autonomamente.

In caso di fallback routing (OSRM non raggiungibile), `RouteTrackingPanel` mostra "Percorso non calcolato" invece di uno spinner infinito. In caso di GPS impreciso, `RouteStartModal` mostra un messaggio specifico per il tipo di errore (permesso negato, segnale assente, timeout). In entrambi i casi l'utente riceve un feedback onesto e l'app rimane utilizzabile.

---

## Stato TypeScript

Nessun errore TypeScript introdotto in questo step. Le modifiche riguardano:
- aggiunta del campo `userName: string` in un'interfaccia esistente (modifica additiva, nessun breaking change)
- sostituzione di operatori non-null (`!`) con controlli espliciti (più sicuro, nessun impatto sui tipi)
- aggiunta di blocchi `if/else` e log in funzioni esistenti (nessun impatto sui tipi inferiti)
- aggiunta di messaggi stringa in template Vue (nessun impatto TypeScript)
