# Report Step 3.0 — GPS Marker Visual Stability

**Data:** 2026-06-26
**Tipo:** UX/visual reliability
**Scope:** Eliminazione oscillazione visiva del pallino posizione GPS sulla mappa.

---

## Obiettivo

Eliminare o ridurre la visibile oscillazione del marker posizione GPS sulla mappa (`MapView.vue`, `TrackingPublicPage.vue`) senza toccare routing, admin, SOS logic, auth, email, profilo, contatti o feedback.

---

## Cause radice identificate

### Causa 1 — Tipo di marker incompatibile con animazione posizione

`L.CircleMarker` di Leaflet è un elemento SVG. La posizione viene aggiornata tramite attributi `cx`/`cy` SVG, non tramite CSS `transform`. I browser moderni supportano la transizione CSS su `cx`/`cy` solo parzialmente e Leaflet non la imposta. Ogni `setLatLng()` su un `CircleMarker` è un **salto immediato** senza animazione.

`L.Marker` con `DivIcon` invece viene posizionato tramite CSS `transform: translate3d(...)`. Questo attributo supporta `transition` CSS completa, con accelerazione GPU.

**Impatto visivo:** ogni aggiornamento GPS (ogni 2-5s) causava un micro-salto immediato e visibile, specialmente a zoom 16-18 dove 1m corrisponde a 1-2px.

### Causa 2 — Aggiornamento visivo troppo frequente

`routeStore.setLastPosition()` veniva chiamato **ad ogni fix GPS accettato** (ogni 2-5s), anche quando non era ancora il momento di inviare dati al backend (intervallo API 15s). Questo causava il watcher in MapView a chiamare `updateUserMarkerAndAccuracy()` 3-7 volte ogni 15 secondi.

Senza animazione, ogni chiamata produceva un salto visivo. Con animazione ma senza throttle, i salti si sommavano e la transizione partiva da una posizione intermedia prima di completarsi.

### Causa 3 — Alpha del filtro low-pass troppo alto

`GPS_ALPHA = 0.15` significava che ogni posizione raw accettata spostava la posizione smoothed del 15% verso la nuova lettura. Se il GPS fluttuava di 15m (comune in ambiente urbano con accuracy < 50m), la posizione smoothed si spostava di 2.25m per aggiornamento. A zoom 18 (1px ≈ 0.6m), questo equivale a ~4px di spostamento per fix — visibilmente un tremolio.

### Causa 4 — Soglia distanza minima troppo permissiva

`GPS_MIN_DISTANCE_M = 10` accettava letture GPS che diferivano di appena 10m dalla posizione smoothed. In ambienti urbani (palazzi, tunnel parziali, interno), il GPS può fluttuare di 10-20m anche da fermo, causando aggiornamenti continui.

### Causa 5 — Animazione pulse su `transform: scale()` (problema secondario)

Il CSS originale applicava `animation: pulse-dot` con `transform: scale(1.15)` sull'elemento marker. Con `CircleMarker`, questo funzionava perché il transform non interferiva con il posizionamento Leaflet (gestito altrimenti). Con `DivIcon`, il `transform` dell'elemento inner avrebbe interferito con `transform: translate3d()` del container Leaflet. Risolto usando `box-shadow` animation per il ripple.

---

## Fix implementati

### Fix 1 — DivIcon + CSS `transition: transform` in `MapView.vue`

**File:** `frontend/src/components/map/MapView.vue`

Tipo `userMarker` cambiato da `import('leaflet').CircleMarker` a `import('leaflet').Marker`.

Il marker ora usa `L.divIcon()` con un `<div class="user-position-dot active/stale">` all'interno. Leaflet posiziona questo elemento con `transform: translate3d(...)`, e la transizione CSS `transform 0.8s ease-out` applicata tramite JavaScript (`el.style.transition`) rende ogni aggiornamento di posizione un **glide fluido**.

```javascript
// Abilitato dopo il placement iniziale (100ms delay)
function setMarkerTransition(enabled: boolean) {
  const el = userMarker?.getElement()
  if (el) el.style.transition = enabled ? 'transform 0.8s ease-out' : 'none'
}
```

**Gestione zoom:** la transizione viene disabilitata su `zoomstart` e riabilitata 100ms dopo `zoomend`. Senza questo, Leaflet riposiziona i marker dopo lo zoom e la transizione animererebbe quel riposizionamento (cattiva UX).

**Stile attivo/stale via classe CSS:** rimossi tutti i `setStyle()` (API `CircleMarker`-only). Lo stato del marker cambia tramite `dot.className = 'user-position-dot active'` o `dot.className = 'user-position-dot stale'`.

**Pulse animation:** migrata da `transform: scale()` a `box-shadow` animation (ripple ring). Il `box-shadow` non interferisce con il `transform: translate3d()` di Leaflet.

### Fix 2 — Visual throttle a 3s in `useRouteTracker.ts`

**File:** `frontend/src/composables/useRouteTracker.ts`

Aggiunto `VISUAL_UPDATE_INTERVAL_MS = 3_000` e `lastVisualUpdateTime` ref. All'interno della finestra dei 15s tra API call, `routeStore.setLastPosition()` viene chiamato **al massimo ogni 3 secondi** invece di ad ogni fix GPS accettato.

```
GPS fires ogni 2s → filter accetta ogni 4-6s → visual update max ogni 3s → marker update: ~max 1 per 3s
```

Questo riduce il numero di `setLatLng()` chiamate da 3-7 per finestra a 1-5, e con la transizione CSS di 0.8s ogni aggiornamento appare come un glide fluido anche quando la transizione precedente non è ancora finita (CSS gestisce il mid-transition start correttamente).

### Fix 3 — Filtro GPS più aggressivo

**File:** `frontend/src/composables/useRouteTracker.ts`

- `GPS_ALPHA`: `0.15` → `0.10` — 10% verso la lettura raw invece di 15%. Ogni fix accettato sposta la posizione smoothed meno, riducendo la deriva visibile.
- `GPS_MIN_DISTANCE_M`: `10` → `12` — scarta fix più vicini alla posizione corrente, eliminando più rumore GPS urbano da fermo.

Con `alpha=0.10` e un fix raw a 15m dalla posizione smoothed: la posizione smoothed si sposta di `0.10 × 15 = 1.5m`. A zoom 18 (0.6m/px) = 2.5px. Con transizione CSS 0.8s, questo spostamento è completamente invisibile come jitter.

### Fix 4 — Stessa logica in `TrackingPublicPage.vue`

**File:** `frontend/src/pages/TrackingPublicPage.vue`

Tipo `marker` da `L.CircleMarker` a `L.Marker`. `initMap()` usa ora `L.divIcon()`. Transizione abilitata via JavaScript con `el.style.transition = 'transform 1.0s ease-out'` (1s invece di 0.8s — aggiornamenti arrivano ogni 15s da SSE/polling, una transizione più lunga è appropriata e piacevole). Gestione zoom identica a MapView.

---

## Comportamento finale

| Scenario | Prima | Dopo |
|---|---|---|
| Utente fermo, GPS urbano | Micro-salti ogni 2-10s visibili a zoom 15+ | Nessun salto — la posizione non si aggiorna se rimane dentro 12m |
| Utente fermo, piccola deriva GPS | Salto immediato visibile | Glide fluido 0.8s verso nuova posizione (piccolo spostamento) |
| Utente in movimento (walking) | Salti frequenti ogni 2-5s | Glide fluido ogni 3s — la posizione segue gradualmente |
| Cambio zoom | Marker si riposiziona ok | Marker si riposiziona ok (transition sospesa durante zoom) |
| Fine tracking | Marker sparisce o resta statico | Marker rimane a ultima posizione nota, diventa grigio (.stale) |
| Pagina pubblica /track/:token | Salto immediato ogni 15s (SSE/polling) | Glide fluido 1s verso ogni nuovo punto |
| GPS molto impreciso (>100m) | Salti amplificati e molto frequenti | Banner "GPS molto impreciso", posizione non aggiornata (accuracy > 50m = scartata) |

---

## Problemi che rimangono fuori scope

| Problema | Motivazione rinvio |
|---|---|
| GPS adaptive alpha (cambia alpha in base alla velocità stimata) | Richiede accelerometro o Kalman filter — fuori scope MVP |
| Predizione posizione tra aggiornamenti (dead reckoning) | Richiede sensori di movimento del device |
| Differenziare "utente fermo" da "utente che si muove" per stop auto-tracking | Richiede logica di stato aggiuntiva |

---

## TypeScript

`npx tsc --noEmit` eseguito su frontend e backend: **0 errori**.

---

## File modificati

- `frontend/src/components/map/MapView.vue`
- `frontend/src/composables/useRouteTracker.ts`
- `frontend/src/pages/TrackingPublicPage.vue`
- `docs/step-3-0-marker-stability.md` (questo file)
