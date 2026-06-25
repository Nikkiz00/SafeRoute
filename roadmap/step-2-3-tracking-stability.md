# Step 2.3 — Tracking, GPS & Route Stability

**Data:** 2026-06-23
**Tipo:** Technical reliability
**Scope:** Affidabilità tracking live, GPS, pagina pubblica, logging dev. Nessuna nuova feature prodotto.

---

## Obiettivo

Rendere il tracking live e la gestione GPS affidabili prima di procedere con nuove feature.
Risolvere bug tecnici che impattano l'esperienza core: SSE safety, polling stop automatico, Page Visibility API, GPS logging, dati esposti in TrackingData.

---

## Fix implementati

### Fix 1 — TrackingPublicPage.vue: SSE type safety e init completo

Rimosso uso di `data.value!` (non-null assertion) nell'handler SSE. Messaggio `init` ora aggiorna `data.value` in modo sicuro. Messaggio `status` con valore `completed` o `cancelled` chiude l'EventSource. Log strutturati con prefisso `[tracking]`.

**File:** `frontend/src/pages/TrackingPublicPage.vue`

---

### Fix 2 — TrackingPublicPage.vue: polling stop automatico

Il polling si ferma automaticamente quando la sessione diventa non-`active`. Prevenzione del loop infinito di polling su sessioni concluse (completed/cancelled).

**File:** `frontend/src/pages/TrackingPublicPage.vue`

---

### Fix 3 — TrackingPublicPage.vue: Page Visibility API

Handler `visibilitychange` aggiunto e rimosso correttamente nel ciclo di vita del componente. Quando il tab diventa visibile e siamo in polling, viene eseguito un fetch immediato. Log `[tracking] tab hidden` / `[tracking] tab visible`.

**File:** `frontend/src/pages/TrackingPublicPage.vue`

---

### Fix 4 — TrackingPublicPage.vue: marker smoothing

`updateMarker` non re-centra la mappa se il marker è già nel viewport corrente. Riduzione degli scatti visivi durante il tracking attivo.

**File:** `frontend/src/pages/TrackingPublicPage.vue`

---

### Fix 5 — useRouteTracker.ts: Page Visibility API

Handler `visibilitychange` modulare: quando il tab viene nascosto o mostrato, `lastUpdateTime` viene reimpostato. Variabili di modulo documentate con commento su assunzione single-instance.

**File:** `frontend/src/composables/useRouteTracker.ts`

---

### Fix 6 — useRouteTracker.ts: log GPS completi

Log per ogni posizione accettata (`[gps] position accepted`). Log per skip accuracy e skip distanza con valori numerici. Log per errori geolocation: denied (code 1), unavailable (code 2), timeout (code 3). Log per successo e fallimento dell'aggiornamento backend.

**File:** `frontend/src/composables/useRouteTracker.ts`

---

### Fix 7 — tracking.service.ts: userName in TrackingData

`TrackingData` ora include il campo `userName: string`. La query include la relation user (o query separata) per recuperare il nome display. Nessun dato sensibile esposto: solo nome display, niente email o ID utente. Tipo aggiornato anche in frontend.

**File:**
- `backend/src/modules/tracking/tracking.service.ts`
- `frontend/src/types/index.ts`

---

### Fix 8 — RouteTrackingPanel.vue: routing fallback message

Quando `isRoutingFallback === true` e `distanceKm === null`, il pannello mostra "Percorso non calcolato" invece di "Calcolo in corso...", evitando uno spinner infinito fuorviante.

**File:** `frontend/src/components/map/RouteTrackingPanel.vue`

---

### Fix 9 — RouteStartModal.vue: error messages geolocation

L'error callback della geolocation mostra ora messaggi specifici per i tre codici di errore: `PERMISSION_DENIED` (code 1), `POSITION_UNAVAILABLE` (code 2), `TIMEOUT` (code 3). Prima il messaggio era generico.

**File:** `frontend/src/components/map/RouteStartModal.vue`

---

### Fix 10 — routes.service.ts: dev logging

Log strutturati per `startRoute`, `updateLocation` (successo e fallimento), `completeRoute`, `cancelRoute`. Ogni operazione loggata con il risultato effettivo per facilitare il debug in sviluppo.

**File:** `backend/src/modules/routes/routes.service.ts`

---

## File modificati

**Frontend:**
- `frontend/src/pages/TrackingPublicPage.vue` (Fix 1, 2, 3, 4)
- `frontend/src/composables/useRouteTracker.ts` (Fix 5, 6)
- `frontend/src/components/map/RouteTrackingPanel.vue` (Fix 8)
- `frontend/src/components/map/RouteStartModal.vue` (Fix 9)
- `frontend/src/types/index.ts` (Fix 7)

**Backend:**
- `backend/src/modules/tracking/tracking.service.ts` (Fix 7)
- `backend/src/modules/routes/routes.service.ts` (Fix 10)

**Documentazione:**
- `docs/architecture.md` — aggiunta nota `userName` in TrackingData; aggiunti prefissi `[gps]` e `[tracking]` nella tabella logging
- `roadmap/step-2-3-tracking-stability.md` — questo file

---

## Problemi NON corretti (rimandati)

| Problema | Motivazione rinvio |
|---|---|
| GPS adaptive frequency (riduzione automatica in stazionario) | Richiederebbe Accelerometer API (DeviceMotion) — supporto browser limitato |
| Tracking token revoca manuale | Richiede nuovo endpoint e UI — step dedicato |
| Safety-based routing (percorso che penalizza zone pericolose) | Richiede Valhalla o OSRM custom weight — Day 9+ |
| Redis per last ping cache | Non necessario per MVP; valutare prima del go-live in produzione |
| LocationPing queue offline (max 10 ping) | Architettura prevista, non implementata — richiede service worker o IndexedDB |
