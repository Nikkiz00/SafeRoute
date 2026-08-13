# step-routing-realism.md — Routing Realism

## Obiettivo

Rendere il routing genuinamente credibile: percorsi realistici, differenze reali tra modalità di trasporto, differenze percepibili tra preferenze Safe/Balanced/Fast, ETA coerenti, sistema onesto su ciò che può o non può fare.

---

## Problema identificato: OSRM pubblico non distingue i profili

### Indagine

Testato `router.project-osrm.org` con il profilo `foot` per Arco della Pace → Castello Sforzesco (Milano, rotta attraverso Parco Sempione dove i pedoni possono tagliare ma le auto non possono):

```
FOOT:    dist=2137m dur=222s  ← velocità 34 km/h = auto!
DRIVING: dist=2137m dur=222s  ← identico
BIKE:    dist=2137m dur=222s  ← identico
```

**Conclusione**: `router.project-osrm.org` è il server demo OSRM, serve solo il profilo auto e ignora silenziosamente il profilo nell'URL. Tutti e tre i profili restituivano lo stesso percorso stradale in auto.

### Soluzione: routing.openstreetmap.de

Testata la soluzione su `routing.openstreetmap.de`, che mantiene istanze OSRM separate per profilo:

```
FOOT:    dist=723m  dur=578s  (4.5 km/h camminata) ← usa Parco Sempione ✓
BIKE:    dist=724m  dur=490s  (5.3 km/h bici)      ← usa Parco Sempione ✓
DRIVING: dist=2137m dur=222s  (34 km/h auto)        ← gira intorno al parco ✓
```

Test su rotta lunga Duomo → CityLife (4-5 km):

```
FOOT[0]:    4.03km  54min  (48 pts alternativa)
BIKE[0]:    4.12km  23min
DRIVING[0]: 4.26km   9min
DRIVING[1]: 5.00km  10min  (2 alternative per auto)
```

Differenze reali e significative. CORS: `Access-Control-Allow-Origin: *` ✓.

---

## Modifiche implementate

### 1. `frontend/src/composables/useRouting.ts` — riscrittura completa

**URL per profilo**:
```typescript
const OSRM_BASE: Record<TravelMode, string> = {
  walking: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  driving: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  cycling: 'https://routing.openstreetmap.de/routed-bike/route/v1/bike',
}
```

**Zone pre-loading**: Prima di calcolare il safety score, carica le zone che coprono il bounding box dell'intero percorso (con 0.015° di padding). Prima le zone erano caricate solo per il viewport corrente, perdendo quelle al capo lontano del percorso.

**Safety scoring accurato**: Ray-casting point-in-polygon per ogni punto del percorso (campionato a max 40 punti), punteggio +2/0/-3/-5 per zona verde/giallo/rosso/viola, normalizzato 0-100.

**Preferenze reali**:
- `fast` → sempre l'alternativa `routes[0]` da OSRM (più breve/veloce)
- `safe` → alternativa con il safety score massimo tra quelle disponibili; mostra il delta di tempo rispetto alla più veloce
- `balanced` → funzione composita 50% safety + 50% velocità normalizzata

**Fix bug n=1**: In precedenza, con una sola alternativa, `modeDescription` mostrava sempre "Più veloce" indipendentemente dalla preferenza. Ora:
- n=1 + safe → "Più sicuro · sicurezza X/100 (Label) · percorso unico"
- n=1 + balanced → "Bilanciato · sicurezza X/100 (Label), Y km · percorso unico"
- n=1 + fast → "Più veloce · Y km, Z min"

**Rimozione `exclude=motorway`**: Testato su `routing.openstreetmap.de/routed-car` — restituisce `code: InvalidValue`. Rimosso. La diversità di percorsi viene ora dall'opzione `alternatives=true`.

**Fallback onesto**: Se OSRM fallisce → linea retta tratteggiata + banner "Percorso indicativo — routing non disponibile al momento". Nessun percorso inventato.

### 2. `frontend/src/stores/route.ts`

Aggiunto `routeSafetyScore: ref<number | null>(null)` e parametro opzionale `safetyScore` in `setRouteInfo()`. Il campo viene cancellato in `clearRoute()`.

### 3. `frontend/src/components/map/RouteTrackingPanel.vue`

Aggiunto badge visivo safety score nel panel di tracking attivo:
```html
<div :class="[safetyBadgeClass.bg, safetyBadgeClass.text, 'ml-auto px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1']">
  <Shield :size="10" />
  {{ routeStore.routeSafetyScore }}/100 · {{ safetyBadgeClass.label }}
</div>
```
Colori: verde (≥75 Ottima), ambra (≥50 Buona), rosso (≥30 Media), viola (<30 Bassa).

### 4. `frontend/src/pages/DashboardPage.vue`

Aggiornata la chiamata `setRouteInfo` per passare `result.safetyScore`:
```typescript
routeStore.setRouteInfo(result.distanceKm, result.durationMin, result.modeDescription, result.safetyScore)
```

---

## Cosa era già corretto (non modificato)

| Funzionalità | Stato |
|---|---|
| Leaflet per rendering mappa | Corretto — usato per visualizzare il percorso |
| Parametro `alternatives=true` | Corretto — già presente |
| Fallback a linea retta | Corretto — già implementato |
| Zone safety scoring base | Corretto — ray-casting era già implementato |
| Timeout AbortController (10s) | Corretto — già presente |

---

## Risultato verifica TypeScript

```
Frontend: 0 errori
Backend:  0 errori
```

---

## Onestà del sistema

| Scenario | Comportamento |
|---|---|
| Routing disponibile | Percorso reale con ETA reale |
| Routing non disponibile | Linea retta + banner esplicito "percorso indicativo" |
| Transit non supportato | Non esposto (non c'è modalità "transit" nell'UI) |
| 1 sola alternativa | Indicato "percorso unico" nella descrizione |
| Preferenza safe = stessa del fast | Indicato "coincide col più veloce" |

---

## File modificati

- `frontend/src/composables/useRouting.ts` — riscrittura URL profili + fix bug n=1 + pre-loading zone
- `frontend/src/stores/route.ts` — aggiunto `routeSafetyScore`
- `frontend/src/components/map/RouteTrackingPanel.vue` — badge safety score + computed `safetyBadgeClass`
- `frontend/src/pages/DashboardPage.vue` — pass `safetyScore` a `setRouteInfo`

---

## Commit suggerito

```
fix(routing): use per-profile OSRM instances for real walking/cycling/driving differences

router.project-osrm.org ignores the profile parameter and returns car routes
for all modes. Switch to routing.openstreetmap.de which runs separate OSRM
instances per profile (routed-foot/bike/car), giving real pedestrian paths,
cycle lanes, and road-only routes. Also fix modeDescription for n=1 routes
and add safety score badge to RouteTrackingPanel.
```
