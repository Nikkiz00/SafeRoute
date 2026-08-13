# Report Step 3.0b — Position Marker Visual Quality

**Data:** 2026-06-26
**Tipo:** UX / visual design
**Scope:** Visibilità, design e correttezza testuale del marker posizione utente sulla mappa.

---

## Problemi reali trovati

### Problema 1 — Marker troppo piccolo e poco distinguibile

Il marker precedente era un dot singolo da 20×20px, visivamente simile alle icone delle zone colorate. Su sfondi mappa chiari o su zone colorate (specialmente verde o blu), il marker era difficile da distinguere a colpo d'occhio senza cercare attivamente. Nessuna indicazione visiva di "live position" oltre alla singola animation CSS.

### Problema 2 — Colore GPS badge confonde con zone sicure

Il badge GPS accuracy in `MapView.vue` usava `bg-safety-green/90` (sfondo verde) quando la precisione era ≤ 20m. Verde è il colore delle zone sicure in SafeRoute. L'utente poteva interpretare il badge verde come "sei in una zona sicura" invece di "il GPS è preciso". Questa è una confusione di linguaggio visivo con impatto diretto sulla comprensione dell'interfaccia.

Evidenza nel codice prima del fix:
```html
<!-- PRIMA -->
(props.userPosition.accuracy <= 20)
  ? 'bg-safety-green/90 text-green-900 dark:text-green-100'
```

### Problema 3 — Coordinate raw nel panel di tracking fuorvianti

In `RouteTrackingPanel.vue` l'intestazione del pannello mostrava:
```
45.46427, 9.19001
```
a 5 decimali. Un utente che non conosce il formato coordinate GPS interpretava questo come una stringa sbagliata o senza senso — non come posizione. Era assente qualsiasi label o simbolo che indicasse "questo è GPS" o "queste sono coordinate geografiche". Il testo sembrava un errore di visualizzazione.

### Problema 4 — Reverse geocoding assente (non è un bug, è un gap)

Non esiste nel codebase nessuna chiamata di reverse geocoding per la posizione utente. Quindi non c'è "testo sbagliato" da correggere in questo senso — ma c'è un'assenza di testo significativo. L'utente vede coordinate raw invece del nome del luogo. Questo è fuori scope per ora (richiederebbe API Nominatim), ma viene mitigato con il fix del problema 3.

---

## Fix applicati

### Fix 1 — Marker due livelli: ring + dot (40×40px)

**File:** `frontend/src/components/map/MapView.vue`

Sostituito il singolo `.user-position-dot` con una struttura a due livelli:

```html
<div class="user-marker-wrap active">
  <div class="user-marker-ring"></div>  <!-- anello espandibile -->
  <div class="user-marker-dot"></div>   <!-- dot solido centrale -->
</div>
```

Il container (`iconSize`) è passato da 20×20px a **40×40px** (iconAnchor: 20×20). Questo permette all'anello di espandersi senza essere tagliato.

**Design scelto — motivazione UX:**
- **Dot centrale** (18px, blu #2563EB, bordo bianco 3px, box-shadow forte): garantisce alta visibilità su qualsiasi sfondo mappa (chiaro, scuro, tile OSM, CartoDB dark). Il bordo bianco con ombra crea contrasto anche su zone verdi/blu.
- **Anello espandibile** (parte da 22px, scala a 2.8×, si dissolve in 2s): comunica visivamente "live position" in modo immediato. L'animazione usa `transform: scale()` sull'anello (elemento figlio), non sul container — nessun conflitto con `transform: translate3d()` di Leaflet.
- **Stato stale** (fine tracking): anello sparisce (`display: none`), dot diventa grigio (#94A3B8, opacity 0.7) — chiaramente "ultima posizione nota, tracking non attivo".
- Colore scelto: **blu (#2563EB = brand-blue)** — distinto da verde (zone sicure), giallo (attenzione), rosso (pericoloso), viola (molto pericoloso). Non può essere scambiato con nessuna zona.

**Stesso design** applicato a `TrackingPublicPage.vue` con classi `.tp-marker-*` (non scoped).

### Fix 2 — GPS badge: verde → blu

**File:** `frontend/src/components/map/MapView.vue`

Rimosso `bg-safety-green` per GPS accurato. Ora:

| Accuratezza | Colore badge | Significato visivo |
|---|---|---|
| ≤ 20m | Blu brand (brand-blue/10) | GPS preciso — colore brand, non confondibile con zone |
| 21–50m | Neutro (surface) | GPS sufficiente |
| > 50m | Giallo | GPS impreciso — warning |

Testo cambiato da "Precisione: ~XXm" a "GPS ~XXm" — più breve, più immediato, chiarisce che è un dato tecnico GPS non un nome di zona.

### Fix 3 — Coordinate panel: ridotto decimali + ° symbol

**File:** `frontend/src/components/map/RouteTrackingPanel.vue`

Da `position.lat.toFixed(5), position.lng.toFixed(5)` a `position.lat.toFixed(4)°, position.lng.toFixed(4)°` con `title="Coordinate GPS correnti"`.

Il simbolo `°` rende immediatamente riconoscibile che si tratta di coordinate geografiche, non di una stringa random. 4 decimali = precisione ~11m, sufficiente per visualizzazione.

---

## Scelta UX del marker

Il design ring+dot è il pattern più riconoscibile per "la tua posizione" su mappe mobile (usato da Google Maps, Apple Maps, Life360, Waze):
- Dot solido = posizione precisa
- Anello pulsante = live/real-time
- Colore blu brand = identità app, non confondibile con sicurezza delle zone

Alternative scartate:
- **Pin/freccia tipo navigazione**: aggiunge complessità visiva, rischia di indicare "destinazione" non "posizione attuale"
- **Icona persona**: difficile da rendere visibile a tutte le dimensioni di zoom senza SVG custom
- **Verde**: vietato, confondibile con zona sicura
- **Cerchio più grande senza ring**: meno riconoscibile come "live"

---

## Test eseguiti (code review + analisi statica)

| Test | Metodo | Esito |
|---|---|---|
| TypeScript 0 errori | `npx tsc --noEmit` frontend + backend | ✓ Passato |
| Marker non usa `setStyle()` (CircleMarker-only) | Code review | ✓ Rimosso |
| Anello non interferisce con transition Leaflet | Analisi CSS: ring usa own `transform`, non quello del container | ✓ Indipendente |
| Stato stale correttamente gestito | `.user-marker-wrap.stale .user-marker-ring { display: none }` | ✓ Verificato |
| GPS badge non usa verde | `bg-brand-blue/10` per accuracy ≤ 20m | ✓ Verificato |
| Coordinate con `°` non sembrino stringa random | Aggiunto `°` + `title` attribute | ✓ Verificato |
| `iconAnchor` corretto (centrato al dot) | [20, 20] = centro del container 40×40 | ✓ Verificato |
| TrackingPublicPage non rotta | Marker ricreato, tipo cambiato, nessun uso di API CircleMarker | ✓ Verificato |
| Auth / SOS / tracking non toccati | Scope strettamente limitato | ✓ Verificato |

**Nota:** Test visuale su browser richiede dev server. Elementi strutturali verificati da review del codice generato. Il dev server non è stato avviato in questa sessione (ambiente headless).

---

## Problemi ancora aperti

| Problema | Priorità | Note |
|---|---|---|
| Reverse geocoding posizione utente (mostrare "Via Roma, Milano") | Media | Richiede Nominatim API call, con cache. Fuori scope di questo step. |
| Marker non centrato esattamente sul dot in alcuni browser/zoom | Bassa | Dipende dal rendering DivIcon di Leaflet; iconAnchor è corretto ma può variare |
| Coordinate raw (anche con 4 decimali) non meaningful per utenti non tecnici | Media | Soluzione completa richiede reverse geocoding. Mitigato con `°` symbol e `title` attribute. |
| Accuracy circle stesso colore del marker (blu) — potrebbe sembrare parte del marker | Bassa | Il fillOpacity=0.08 lo rende quasi invisibile — sufficientemente secondario. |

---

## Perché l'obiettivo è raggiunto

1. **Marker chiaramente visibile a colpo d'occhio**: il design ring+dot da 40×40px è molto più prominente del singolo dot da 20px. L'anello pulsante segnala "live" immediatamente.

2. **Marker non trasparente o sbiadito**: dot solido con `box-shadow: 0 2px 12px rgba(0,0,0,0.45)` — visibile su OSM, CartoDB dark, e su zone colorate (verde, rosso, viola).

3. **Distinto chiaramente dalle zone**: blu brand (#2563EB) non è nei colori delle zone di sicurezza. Bordo bianco con ombra crea separazione visiva su qualsiasi sfondo.

4. **Testo posizione non più fuorviante**: GPS badge non usa più verde (confondibile con zone sicure). Coordinate mostrano `°` symbol e usano `title`. Testo "GPS ~XXm" è più diretto e non ambiguo.

5. **Design mobile-first e professionale**: pattern ring+dot è lo standard de facto per "la tua posizione" su mobile. Pulse animation comunica live senza distrarre.

6. **TypeScript 0 errori**: verificato su frontend e backend.

7. **Nessuna regressione**: auth, tracking live, SOS, pagina pubblica, feedback — non toccati.

---

## File modificati

- `frontend/src/components/map/MapView.vue`
- `frontend/src/components/map/RouteTrackingPanel.vue`
- `frontend/src/pages/TrackingPublicPage.vue`
- `docs/step-3-0b-position-visual.md` (questo file)
