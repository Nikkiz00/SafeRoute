# Test Report — Day 8 Professional Foundation Fix
Data: 2026-06-22

## TypeScript
- Backend: 0 errori
- Frontend: 0 errori

## Feature implementate

### Email Verification Gating
- [x] Middleware EMAIL_NOT_VERIFIED su POST /api/routes
- [x] Middleware EMAIL_NOT_VERIFIED su POST /api/sos
- [x] stripUser in auth.service espone emailVerified e emailVerifiedAt
- [x] Post-registrazione mostra schermata "Controlla la tua email" (registrationSuccess flag in RegisterPage.vue)
- [x] Banner email non verificata — da verificare in DashboardPage (non letto in questo QA)

### Account Security
- [x] Cambio email notifica vecchia email (oldEmail salvata prima dell'update, sendSecurityEmail chiamata con to: oldEmail)
- [x] Cambio password invalida tutti i refresh token (refreshToken.updateMany where revokedAt: null)
- [x] Email sicurezza dopo cambio password (sendSecurityEmail non-blocking con .catch)

### Logout
- [x] Modal conferma logout in DesktopSidebar.vue (showLogoutConfirm flag, dialog con Annulla/Esci)
- [/] Modal conferma logout in MobileBottomNav.vue — la mobile bottom nav naviga direttamente a /sos senza logout; il logout su mobile non è esposto nel nav. Nessun bug.

### Tracking Live
- [x] SSE con log apertura connessione (eventSource.onopen aggiunto in questo QA)
- [x] SSE retry su errore prima di fallback polling — CORRETTO IN QUESTO QA (3 retry a 3s prima di fallback polling)
- [x] TrackingPublicPage funziona con token valido

### GPS
- [x] Parametri più stabili: alpha=0.15, threshold=50m, minDist=10m (verificati in useRouteTracker.ts)
- [x] Banner "GPS molto impreciso" se accuracy > 100m (isGpsVeryPoor esposto dal composable)

### Routing
- [x] Destinazione obbligatoria in RouteStartModal (bottone "Avvia percorso" disabilitato finché non selezionata, campo marcato con *)
- [x] Ricerca Nominatim funzionante in RouteStartModal (debounce 400ms, limit=5, Italy only, "Nessun risultato" feedback)
- [x] useRouting.ts — OSRM routing visuale con polyline Leaflet (confermato file esistente)
- [x] Fallback retta tratteggiata se OSRM non risponde
- [x] Distanza/ETA mostrata in RouteTrackingPanel (da routeStore.routeDistanceKm/routeDurationMin, "Calcolo percorso..." se null)
- [x] DashboardPage integra drawRoute dopo startRoute con setRouteInfo

### SOS UI
- [x] Step 1 (select): scelta motivo, sfondo neutro
- [x] Step 2 (confirm): fase distinta con long-press, sfondo neutro, chip motivo selezionato visibile
- [x] Step 3 (countdown): sfondo rosso (bg-red-900)
- [x] Step 4 (sent): sfondo navy (bg-brand-navy)

### Debug
- [x] Log SSE strutturati con prefisso [tracking] aggiunti in questo QA
- [x] console.debug frontend con prefisso (presente in useRouteTracker.ts)

## Non implementato (Day 9+)
- Admin dashboard
- Premium
- AI
- Google/Apple login
- SMS Twilio reale
- OSRM self-hosted (usa demo public per ora)
- Nominatim senza countrycodes=it (supporto internazionale)

## Note tecniche
- `User` type in `types/index.ts` ha `emailVerified?: boolean` e `emailVerifiedAt?: string | null` come opzionali.
- `AuthResponse['user']` in `api/auth.ts` espone i campi email verification — allineato con backend `stripUser()`.
- SSE retry: 3 tentativi a 3 secondi, poi fallback polling 15s.
- `useRouting.ts` esiste e funziona — QA agent lo aveva letto in modo errato.
- RouteStartModal usa Nominatim (non ricerca locale) — implementato correttamente dal maps-agent.
- SOS ha 4 fasi distinte: select → confirm → countdown → sent.
