# Day 06 — Route Session + Tracking Live

## PRD di riferimento
- `prd/04-sos-tracking.md` (tracking live flow)

## Agenti usati
- backend-agent
- frontend-agent
- maps-agent
- qa-agent

## Completato

### Backend

**Route Session module** (`src/modules/routes/`)
- `POST /api/routes` — avvia percorso, genera trackingToken (24h), status='active'
- `GET /api/routes/:id` — recupera sessione con ultima posizione (auth, solo owner)
- `PATCH /api/routes/:id/location` — aggiunge LocationPing, emette evento SSE (auth, solo owner, solo se active)
- `POST /api/routes/:id/complete` — status='completed', endedAt=now, emette evento status (auth, owner)
- `POST /api/routes/:id/cancel` — status='cancelled', endedAt=now, emette evento status (auth, owner)
- `POST /api/routes/:id/share` — restituisce URL condivisibile con trackingToken

**Tracking module** (`src/modules/tracking/`)
- `GET /api/tracking/:token` — posizione attuale JSON (pubblico, polling)
- `GET /api/tracking/:token/stream` — SSE real-time (pubblico, nessuna auth)
- `tracking.events.ts` — EventEmitter singleton (maxListeners=500) per broadcast SSE
- Token scaduto (trackingTokenExpiresAt < now) → 404 per sessioni ancora 'active'
- Sessioni completed/cancelled restano accessibili anche dopo scadenza

**Sicurezza**
- Tutte le route di modifica verificano `session.userId !== userId` → 404 se non owner
- LocationPing rifiutato se `session.status !== 'active'`
- `/:token/stream` registrata PRIMA di `/:token` in Express

### Frontend

**Tipi aggiornati** (`src/types/index.ts`)
- `RouteSession`: nuovi campi `endedAt`, `shareEnabled`, `shareUrl`, `latestPosition`; rimossi `completedAt`, `locationPings`
- `TrackingData`: nuovo, per risposta `/api/tracking/:token`

**API** (`src/api/routes.ts`)
- `startRoute`, `getRoute`, `updateLocation`, `completeRoute`, `cancelRoute`, `shareRoute`, `fetchTracking`
- `fetchTracking` usa `skipAuth: true` (pagina pubblica)

**Store** (`src/stores/route.ts`)
- `activeSession`, `lastPosition`, `isTracking`, `error`
- `setActiveSession`, `setLastPosition`, `setTracking`, `clearRoute`

**Composable** (`src/composables/useRouteTracker.ts`)
- `navigator.geolocation.watchPosition` con throttle 15s per chiamate API
- `onUnmounted(stopTracking)` — cleanup garantito
- Errori geolocalizzazione non bloccanti (log silenzioso)

**Componenti**
- `RouteStartModal.vue` — bottom sheet per avviare il percorso (rileva posizione, confirm)
- `RouteTrackingPanel.vue` — pannello persistente durante tracking: stato, "Sono arrivato", "Annulla", share link; auto-dismiss 2s dopo completamento

**Pagina pubblica**
- `TrackingPublicPage.vue` — `/track/:token`, no auth
- Leaflet map con marker blu sulla posizione tracciata
- SSE primario + polling 15s fallback
- Stato percorso (live / completato / annullato)

**Mappa** (`MapView.vue`)
- Prop `userPosition` → marker blu pulsante (CSS `@keyframes pulse-dot`)
- `watch` con `{ immediate: true, deep: true }` per aggiornamento in-place
- `removeUserMarker()` in `onUnmounted`

**Router**
- `/track/:token` — `requiresAuth: false`, non reindirizzata al login

**DashboardPage.vue**
- Bottone "Percorso" floating (visibile solo quando non tracking)
- `handleStartRoute` → POST start → routeStore + useRouteTracker.startTracking()
- `watch(isTracking)` → stopTracking quando percorso termina
- MapView riceve `:user-position="routeStore.lastPosition"`

## Bug fix inclusi
- `mockRouteSession` in `mock/data.ts` aggiornato al nuovo tipo RouteSession

## NON implementato (deferred)
- SMS/email reali (Day 7+)
- SOS integration con tracking (già presente nel schema, da collegare)
- Adattamento frequenza ping con accelerometro
- Redis per ultimo LocationPing
- Zone crossing detection durante percorso

## File modificati/creati

### Backend
- `src/modules/routes/routes.types.ts` *(new)*
- `src/modules/routes/routes.schemas.ts` *(new)*
- `src/modules/routes/routes.service.ts` *(new)*
- `src/modules/routes/routes.controller.ts` *(new)*
- `src/modules/routes/routes.routes.ts` *(new)*
- `src/modules/tracking/tracking.events.ts` *(new)*
- `src/modules/tracking/tracking.service.ts` *(new)*
- `src/modules/tracking/tracking.controller.ts` *(new)*
- `src/modules/tracking/tracking.routes.ts` *(new)*
- `src/server.ts` *(updated)*

### Frontend
- `src/types/index.ts` *(updated)*
- `src/api/routes.ts` *(new)*
- `src/api/index.ts` *(updated)*
- `src/stores/route.ts` *(new)*
- `src/composables/useRouteTracker.ts` *(new)*
- `src/components/map/RouteStartModal.vue` *(new)*
- `src/components/map/RouteTrackingPanel.vue` *(new)*
- `src/components/map/MapView.vue` *(updated)*
- `src/pages/TrackingPublicPage.vue` *(new)*
- `src/pages/DashboardPage.vue` *(updated)*
- `src/router/index.ts` *(updated)*
- `src/mock/data.ts` *(fix)*

## Commit message
`feat: day 6 — route session, live tracking SSE, public tracking page`
