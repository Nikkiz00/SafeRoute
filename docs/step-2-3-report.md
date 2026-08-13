# Report Step 2.3 — Tracking, GPS & Route Stability

**Data:** 2026-06-26
**Tipo:** Technical reliability
**Scope:** Affidabilità tracking live, GPS, pagina pubblica, logging dev.

---

## Stato di partenza

Il roadmap `step-2-3-tracking-stability.md` descriveva 10 fix pianificati. Al momento di questa sessione, quei fix erano **già presenti nel codice** (lavoro di sessioni precedenti). La sessione corrente ha verificato ogni condizione dell'obiettivo e trovato **bug aggiuntivi non coperti dal piano originale**.

---

## Bug trovati e risolti in questa sessione

### Bug 1 — MapView: marker GPS non ricreato dopo fine tracking

**File:** `frontend/src/components/map/MapView.vue`

**Problema:** `updateUserMarkerAndAccuracy()` faceva solo `userMarker.setLatLng()` senza verificare se `userMarker` fosse null. Dopo la fine di un percorso (`removeUserMarker()` era chiamato), se l'utente avviava una seconda sessione di tracking, il marker non veniva ricreato e la posizione non era mai mostrata sulla mappa.

**Causa correlata:** `initMap()` creava il marker solo se `props.userPosition` era null all'avvio. Se il tracking era già attivo al mount del componente (es. navigazione tra pagine), nessun marker veniva creato.

**Fix:**
- `updateUserMarkerAndAccuracy()` ora crea il marker se null (usa `leafletLib` cachato dopo `initMap`)
- `initMap()` crea sempre il marker (a posizione tracking attiva se disponibile, altrimenti posizione default)
- `initMap()` centra la mappa sulla posizione di tracking attiva se già disponibile al mount
- Aggiunto `leafletLib: typeof import('leaflet') | null = null` come cache module-level per evitare re-import dinamici ripetuti

---

### Bug 2 — MapView: marker scompare completamente dopo fine tracking

**File:** `frontend/src/components/map/MapView.vue`

**Problema:** Quando il tracking terminava (`routeStore.clearRoute()` => `lastPosition = null`), il watcher su `props.userPosition` chiamava `removeUserMarker()` e il marker scompariva dalla mappa, lasciando l'utente senza riferimento visivo di posizione.

**Fix:** Aggiunta funzione `setMarkerStale()`: invece di rimuovere il marker, lo rende visivamente "inattivo" (grigio, opacità 0.4). L'utente vede l'ultima posizione nota ma capisce visivamente che il tracking non è attivo. Il marker torna blu/pieno alla ripresa del tracking.

---

### Bug 3 — SSE backend: stream chiuso su status 'sos'

**File:** `backend/src/modules/tracking/tracking.controller.ts`

**Problema:** La funzione `statusHandler` chiamava `res.end()` per QUALSIASI evento di status, incluso `sos`. Questo chiudeva lo stream SSE esattamente nel momento in cui l'utente aveva un'emergenza — quando il tracking live era più critico.

**Sequenza del problema:**
1. Utente con route attiva e SSE connesso su pagina pubblica
2. Utente attiva SOS -> `sos.service.ts` emette `status:token { status: 'sos' }`
3. `statusHandler` scriveva il messaggio e chiamava `res.end()` -> stream chiuso
4. La pagina pubblica perdeva gli aggiornamenti live durante l'emergenza

**Fix:** `statusHandler` ora chiude lo stream solo per `completed` o `cancelled`. Per `sos`, il stream rimane aperto e le posizioni GPS continuano ad arrivare. Aggiunto log `[tracking-sse] session ended (status=...)`.

---

### Bug 4 — TrackingPublicPage: polling si fermava su status 'sos'

**File:** `frontend/src/pages/TrackingPublicPage.vue`

**Problema:** La condizione per fermare il polling era `data.value.status !== 'active'`. Con status `sos`, questa condizione era vera -> il polling si fermava durante un'emergenza.

**Fix:** Condizione aggiornata a `status === 'completed' || status === 'cancelled'`. La stessa fix applicata al handler `handleVisibilityChange` (tab visibility).

---

### Bug 5 — TrackingPublicPage: SSE non avviato per sessioni 'sos' caricate da polling

**File:** `frontend/src/pages/TrackingPublicPage.vue`

**Problema:** In `onMounted`, SSE veniva avviato solo se `data.value?.status === 'active'`. Se un link di tracking veniva aperto mentre la sessione era già in stato `sos`, l'SSE non partiva e la pagina usava solo polling.

**Fix:** SSE avviato per `status === 'active' || status === 'sos'`.

---

### Bug 6 — useRouteTracker: prefisso log errato `[tracker]`

**File:** `frontend/src/composables/useRouteTracker.ts`

**Problema:** Il callback di errore `geolocation` usava il prefisso `[tracker]` nel log principale, non `[gps]`. Questo rendeva difficile filtrare i log per categoria.

**Fix:** Tutti i log del callback di errore ora usano `[gps]`. Log specifici per ogni codice:
- `[gps] geolocation denied — user rejected permission` (code 1)
- `[gps] geolocation unavailable — GPS signal lost or hardware error` (code 2)
- `[gps] geolocation timeout — GPS fix taking too long or signal blocked` (code 3)

---

### Bug 7 — useRouteTracker: errore GPS code 2 non mostrato all'utente

**File:** `frontend/src/composables/useRouteTracker.ts`

**Problema:** Solo l'errore code 1 (permesso negato) chiamava `routeStore.setError()`. Gli errori code 2 (GPS non disponibile) non mostravano nessun messaggio in UI.

**Fix:** Aggiunta chiamata `routeStore.setError()` anche per code 2 con messaggio: "Segnale GPS non disponibile. Verifica che il GPS del dispositivo sia attivo."

---

### Bug 8 — RouteTrackingPanel: nota fallback routing duplicata

**File:** `frontend/src/components/map/RouteTrackingPanel.vue`

**Problema:** La nota "Percorso stimato — dati orientativi" appariva due volte nel pannello: una come `v-else-if` nella riga ETA/distanza, e una come `div` separato `v-if="isRoutingFallback"`.

**Fix:** Rimosso il `div` ridondante. La riga ETA/distanza contiene già la nota fallback.

---

### Bug 9 — TrackingPublicPage: status 'sos' non gestito nel footer

**File:** `frontend/src/pages/TrackingPublicPage.vue`

**Problema:** Il footer mostrava "Percorso annullato" per qualsiasi status non-active/non-completed, incluso 'sos'. Un viewer che apriva un link SOS vedeva un messaggio completamente sbagliato.

**Fix:** Aggiunto banner SOS rosso separato che mostra: "Allerta SOS attiva — In caso di pericolo reale, chiama il 112." Il footer "il percorso si è concluso" ora appare solo per `completed` e `cancelled`.

---

### Bug 10 — TrackingPublicPage: userName non mostrato nell'header

**File:** `frontend/src/pages/TrackingPublicPage.vue`

**Problema:** `TrackingData.userName` era disponibile nel dato caricato ma non veniva mostrato. Chi apriva un link di tracking non sapeva di chi fosse il percorso.

**Fix:** L'header mostra ora "Percorso di [Nome Utente]" invece del generico "SafeRoute".

---

## Fix già presenti in codice (piano originale step-2-3)

I fix 1-10 del piano `roadmap/step-2-3-tracking-stability.md` erano già implementati nelle sessioni precedenti:

| Fix | Stato |
|---|---|
| TrackingPublicPage SSE type safety (init/ping/status) | Presente |
| Polling stop automatico | Corretto in questa sessione (sos bug) |
| Page Visibility API su TrackingPublicPage | Presente |
| Marker smoothing (no re-pan se già nel viewport) | Presente |
| Page Visibility API su useRouteTracker | Presente |
| Log GPS completi con prefisso [gps] | Corretto in questa sessione |
| userName in TrackingData (backend + frontend type) | Presente |
| RouteTrackingPanel fallback message | Corretto in questa sessione |
| RouteStartModal geolocation error messages specifici | Presente |
| routes.service.ts dev logging | Presente |

---

## Problemi ancora aperti (non nel perimetro di questo step)

| Problema | Priorità | Motivazione rinvio |
|---|---|---|
| GPS offline queue (max 10 ping locali) | Media | Richiede service worker o IndexedDB |
| Tracking token revoca manuale | Media | Richiede nuovo endpoint e UI |
| Safety-based routing (penalizza zone pericolose) | Bassa | Richiede Valhalla o OSRM custom weight |
| Redis per last-ping cache | Bassa | Non necessario per MVP |
| GPS adaptive frequency (accelerometro) | Bassa | DeviceMotion API supporto browser limitato |

---

## Comportamento finale del tracking

### Flusso end-to-end verificato nel codice:

1. **Start sessione**: `POST /api/routes` con destinazione obbligatoria (validata in RouteStartModal), startLat/startLng da GPS, endLat/endLng + destinationName da Nominatim. Backend crea RouteSession con trackingToken.

2. **watchPosition**: `useRouteTracker.startTracking()` avvia `navigator.geolocation.watchPosition()` con `enableHighAccuracy: true, maximumAge: 5000, timeout: 10000`. Ogni posizione viene filtrata (accuracy > 50m scartata, distanza < 10m ignorata) e smorzata (low-pass alpha=0.15).

3. **Update backend**: Ogni 15s, posizione smoothed inviata a `PATCH /api/routes/:id/location`. Successo e fallimento loggati con `[gps]`. Backend crea LocationPing e emette evento SSE tramite `trackingEmitter`.

4. **SSE**: `GET /api/tracking/:token/stream` — stream aperto con keepalive ogni 25s. Ping inviati in real-time. Status `sos` NON chiude lo stream. Solo `completed` e `cancelled` chiudono lo stream + log.

5. **Fallback polling**: Dopo 3 retry SSE (delay 3s ciascuno) -> polling ogni 15s. Si ferma solo per `completed`/`cancelled`, non per `sos`.

6. **Stop su complete/cancel**: `handleComplete()/handleCancel()` -> API -> `setActiveSession(updated)` -> 2s timer -> `clearRoute()` -> `isTracking = false` -> DashboardPage watcher -> `stopTracking()` + `clearRoutePolyline()`.

7. **Cleanup corretto**: `stopTracking()` pulisce watchId, visibilityHandler, smoothed GPS state. MapView: marker diventa grigio (stale) ma rimane visibile per non disorientare l'utente.

### Route visuale:
- Destinazione obbligatoria (RouteStartModal non avvia senza selezione Nominatim)
- Destinazione salvata in `RouteSession.destinationName` + `endLat`/`endLng`
- Route OSRM disegnata subito dopo start sessione se endLat/endLng disponibili
- ETA e distanza mostrati solo se OSRM risponde con valori reali
- Fallback dichiarato con banner giallo "Percorso indicativo — routing non disponibile"

---

## Perché l'obiettivo è raggiunto

1. **GPS non oscilla**: low-pass filter alpha=0.15 + accuracy threshold 50m + distanza minima 10m. Marker ricreato correttamente ad ogni sessione.

2. **Letture imprecise filtrate**: `shouldUpdatePosition()` scarta accuracy > 50m e distanza < 10m, con log `[gps] skipped: accuracy Xm > Ym threshold`.

3. **Tracking end-to-end funzionante**: tutti i path verificati — start, watchPosition, update backend, SSE, fallback polling, stop su complete/cancel, cleanup. Caso SOS corretto (stream rimane aperto).

4. **Pagina pubblica stabile**: mostra userName, gestisce tutti gli stati in modo coerente (active/sos/completed/cancelled), disclaimer e banner corretti per ogni stato.

5. **Avvio percorso coerente**: destinazione obbligatoria, salvata correttamente, route OSRM reale, ETA solo da dati reali, fallback chiaramente dichiarato.

6. **Log dev completi**: prefissi standardizzati `[gps]`/`[tracking]`/`[tracking-sse]`/`[routing]`, log per tutti i casi critici (denied, unavailable, timeout, low accuracy, SSE opened/closed/retried, polling fallback, backend update failed, route provider failed).

7. **TypeScript 0 errori**: verificato con `npx tsc --noEmit` su frontend e backend dopo ogni modifica.

8. **Feature non rotte**: nessuna modifica a auth, email verification, profile, contacts, feedback, SOS logic.

---

## File modificati

**Frontend:**
- `frontend/src/components/map/MapView.vue`
- `frontend/src/composables/useRouteTracker.ts`
- `frontend/src/components/map/RouteTrackingPanel.vue`
- `frontend/src/pages/TrackingPublicPage.vue`

**Backend:**
- `backend/src/modules/tracking/tracking.controller.ts`

**Documentazione:**
- `docs/step-2-3-report.md` (questo file)
