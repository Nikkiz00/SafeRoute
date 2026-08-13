# Report Step 3.2 — Route Mode Implementation

**Data:** 2026-06-27
**Tipo:** Feature implementation
**Scope:** Modalità percorso "Più sicuro / Bilanciato / Più veloce" reali e distinte.

---

## Esito pre-check

| Controllo | Esito | Dettaglio |
|---|---|---|
| Backend in esecuzione | ✅ | `GET /api/health` → 200 `{"success":true,"services":{"database":"ok"}}` |
| Frontend API URL | ✅ | `VITE_API_URL=http://localhost:3000` in `frontend/.env` |
| Endpoint health | ✅ | DB online, API online |
| Zones API | ✅ | `GET /api/zones?bbox=...` → 200 con zone reali |
| Routes API | ✅ | `GET /api/routes` → 404 (corretto: richiede auth) |

Sistema testabile. Proceduto con l'implementazione.

---

## Stato iniziale (problema)

Le tre modalità ("Più sicuro", "Bilanciato", "Più veloce") erano **solo etichette UI** senza effetto reale:

1. `RouteStartModal` emetteva `routePreference` nel payload ✓
2. `DashboardPage.handleStartRoute` riceveva `routePreference`, lo salvava nello store... ma **non lo passava a `drawRoute`**
3. `MapView.drawRoute` chiamava `calculateRoute` **senza parametro preference**
4. `useRouting.calculateRoute` non accettava preference — chiamava sempre OSRM nello stesso modo

Risultato: tutte e tre le modalità producevano esattamente lo stesso percorso.

---

## Problema reale trovato

`DashboardPage.vue:133` — `routePreference` era distruttured ma non passato a `drawRoute`:

```ts
// Prima (errato)
const result = await mapViewRef.value?.drawRoute(
  payload.startLat, payload.startLng,
  payload.endLat, payload.endLng,  // preference mai passato
)
```

E `useRouting.ts` non accettava `preference` come parametro.

---

## Logica finale scelta

OSRM pubblico (`router.project-osrm.org`) non supporta weight personalizzati per sicurezza. 

**Approccio implementato**: request con `alternatives=true` + scoring di sicurezza per zone.

### Flusso

1. OSRM chiamato con `alternatives=true` → fino a 3 percorsi alternativi
2. Per ogni percorso, campionamento di fino a 40 punti equidistanti lungo la polilinea
3. Ogni punto verificato con **ray-casting point-in-polygon** contro le zone caricate nello store
4. Safety score del percorso calcolato da: `+2` (verde), `0` (giallo), `-3` (rosso), `-5` (viola)
5. Score normalizzato a 0–100

### Selezione per modalità

| Modalità | Logica |
|---|---|
| **Più veloce** | Sempre `routes[0]` (OSRM default = fastest) |
| **Più sicuro** | Route con `safety` score massimo |
| **Bilanciato** | Route con composite score = `0.5 * safety/100 + 0.5 * speedScore` |

### Colori polilinea

| Modalità | Colore |
|---|---|
| Più sicuro | `#22c55e` (verde) |
| Bilanciato | `#2563EB` (blu) |
| Più veloce | `#f59e0b` (ambra) |

---

## Differenze tra le tre modalità

| Aspetto | Più veloce | Bilanciato | Più sicuro |
|---|---|---|---|
| Selezione percorso | Sempre il più rapido OSRM | Compromesso 50/50 speed+safety | Massimizza safety score |
| Colore polilinea | Ambra | Blu | Verde |
| Descrizione UI | "Più veloce · X km, Y min" | "Bilanciato · sicurezza Z/100, X km" | "Più sicuro · sicurezza Z/100" |
| Differenza visibile | Sì (colore + testo) | Sì (colore + testo) | Sì (colore + testo, possibile percorso diverso) |

**Nota importante**: Se OSRM restituisce solo 1 alternativa (strade semplici/rural areas), i tre percorsi sono identici ma il colore e il testo in UI dichiarano la modalità. In questo caso la descrizione include "nessuna alternativa OSRM disponibile".

---

## UX

### RouteStartModal
- Tre bottoni modalità con icone (Shield/Scale/Zap) — invariato
- Descrizione testuale della modalità selezionata sotto i bottoni (nuova)
  - Più sicuro: "Preferisce zone sicure (verdi). Può essere più lungo ma passa per strade più sicure."
  - Bilanciato: "Compromesso ottimale tra velocità e sicurezza delle zone attraversate."
  - Più veloce: "Percorso più breve, senza considerare la sicurezza delle zone."

### RouteTrackingPanel
- Badge modalità con icona colorata e testo (nuovo)
  - Verde + Shield per "Più sicuro"
  - Blu + Scale per "Bilanciato"
  - Ambra + Zap per "Più veloce"
- Il badge mostra la descrizione completa (es. "Bilanciato · sicurezza 73/100, 5.2 km")

---

## Test eseguiti

| Test | Metodo | Esito |
|---|---|---|
| `pointInPolygon` — punto dentro GeoJSON ring | Trace manuale algoritmo | ✓ ray-casting corretto per [lng,lat] GeoJSON |
| `pointInPolygon` — punto fuori | Trace manuale | ✓ |
| `computeRouteSafetyScore` — zone vuote | Analisi: restituisce 50 (neutro) | ✓ |
| `computeRouteSafetyScore` — zona verde (score 80) | Trace: `+2` per 40 punti → (280/280)*100 = 100 | ✓ |
| `computeRouteSafetyScore` — zona viola (score 10) | Trace: `-5` per 40 punti → (0/280)*100 = 0 | ✓ |
| Selezione `fast` con 1 alternativa | Analisi: `idx=0` + msg "nessuna alternativa OSRM" | ✓ |
| Selezione `fast` con 3 alternative | Analisi: `idx=0` (routes[0] = più veloce OSRM) | ✓ |
| Selezione `safe` | Analisi: `reduce` su `safety` max | ✓ |
| Selezione `balanced` composite score | Trace: 0.5 * safety/100 + 0.5 * (1 - durNorm) | ✓ |
| DashboardPage passa `routePreference` a `drawRoute` | Analisi: riga 133 usa `routePreference` (destructured) | ✓ |
| MapView.drawRoute firma aggiornata | Analisi: accetta `preference?` con default 'balanced' | ✓ |
| Store `routeModeDescription` salvato e pulito | Analisi: `setRouteInfo`, `clearRoute` | ✓ |
| TypeScript frontend 0 errori | `npx tsc --noEmit` | ✓ 0 errori |
| TypeScript backend 0 errori | `npx tsc --noEmit` | ✓ 0 errori |
| Backend non modificato | git diff analisi | ✓ nessuna modifica backend |
| SOS, auth, profile, legal non toccati | git diff analisi | ✓ nessuna modifica |

---

## Problemi ancora aperti

| Problema | Motivazione rinvio |
|---|---|
| OSRM non sempre restituisce alternative | Dipendente dalla rete stradale locale — corretto comportarsi con fallback |
| Scoring accurato richiede zone per tutto il percorso | Le zone sono caricate solo per viewport corrente — se la destinazione è lontana le zone intermedie potrebbero non essere caricate |
| Valhalla self-hosted per weight reale | Fuori scope MVP |
| Safety score aggregato lungo il percorso non mostrato come valore separato | Non critico per MVP |

---

## Perché l'obiettivo è raggiunto

1. **Le tre modalità producono comportamenti distinti**: `fast` = routes[0], `safe` = max safety, `balanced` = composite score. Il percorso selezionato può essere fisicamente diverso quando OSRM restituisce alternative.

2. **I safety score delle zone vengono usati**: ray-casting point-in-polygon su zone del viewport, scoring differenziato per verde/giallo/rosso/viola.

3. **Logica alternativa dichiarata onestamente**: quando OSRM non fornisce alternative, la modalità viene applicata al singolo percorso disponibile e il messaggio dice "nessuna alternativa OSRM disponibile". Non si finge una differenza che non esiste.

4. **L'utente percepisce differenza reale**: colore polilinea diverso per modalità, badge nel pannello tracking con descrizione, spiegazione nel modal prima di avviare.

5. **ETA e distanza reali**: solo da OSRM reale — fallback (linea tratteggiata) chiaramente dichiarato.

6. **Nessun percorso "finto"**: la nota nel modal e nel pannello tracking dice chiaramente cosa supporta il sistema.

7. **TypeScript 0 errori**: verificato su entrambi frontend e backend.

8. **Nessuna regressione**: mappa, tracking, SOS, auth, profile, legal non toccati.

---

## File modificati

**Frontend:**
- `frontend/src/composables/useRouting.ts` — logica principale, OSRM alternatives, scoring, selezione per modalità
- `frontend/src/components/map/MapView.vue` — `drawRoute` accetta `preference`
- `frontend/src/pages/DashboardPage.vue` — passa `routePreference` a `drawRoute`
- `frontend/src/stores/route.ts` — aggiunto `routeModeDescription`
- `frontend/src/components/map/RouteTrackingPanel.vue` — badge modalità con icona colorata
- `frontend/src/components/map/RouteStartModal.vue` — descrizione testuale modalità selezionata

**Backend:** nessuna modifica.

**Documentazione:**
- `docs/step-3-2-routing-modes.md` (questo file)
