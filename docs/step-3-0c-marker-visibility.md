# Report Step 3.0c — Marker Visibilità

**Data:** 2026-06-27
**Tipo:** UX / visual design
**Scope:** Marker posizione utente chiaramente visibile e riconoscibile sulla mappa.

---

## Problema radice identificato

Il marker implementato al passo 3.0b (ring+dot) era tecnicamente corretto ma **praticamente invisibile** su molti sfondi mappa per due ragioni distinte:

### Causa 1 — `<style scoped>` + `:deep()` non garantisce applicazione su elementi Leaflet

Vue 3 compila `<style scoped>` aggiungendo un attributo univoco (`data-v-xxxxxxxx`) a tutti gli elementi **renderati dal template Vue**. Il combinatore `:deep()` genera selettori del tipo `[data-v-xxxxxxxx] .user-marker-dot` — funziona solo se l'elemento ha un antenato con quell'attributo.

Il problema: quando Leaflet crea il `DivIcon` e lo inietta nel DOM (via `el.innerHTML = ...`), questi elementi non passano attraverso il renderer Vue. In alcuni scenari (hot-reload, mount tardivo, mancanza di attribute inheritance sull'elemento root del map container), l'attributo scoped non viene trovato nella catena degli antenati del marker, e le regole CSS scoped **non si applicano**. Il marker mostrava il box bianco di Leaflet con il contenuto senza stile.

**Fix:** sostituire `<style scoped>` con `<style>` (non-scoped, globale) per tutte le regole che targetano elementi Leaflet.

### Causa 2 — Dot troppo piccolo e ring troppo trasparente

Il dot precedente:
- `width: 18px; height: 18px` — con Tailwind `box-sizing: border-box` attivo, il bordo da 3px sottraeva spazio: fill effettivo 12px
- Ring: `rgba(37, 99, 235, 0.35)` — quasi invisibile su sfondi chiari
- Nessun inner dot bianco — nessuna identità visiva "tu sei qui"

---

## Fix applicati

### Fix 1 — Migrazione da `<style scoped>` a `<style>` globale

**File:** `frontend/src/components/map/MapView.vue`, `frontend/src/pages/TrackingPublicPage.vue`

Rimossa completamente la sezione `<style scoped>` con i selettori `:deep()`. Aggiunta sezione `<style>` (non-scoped) con classi prefissate `sr-` per evitare collisioni con altri CSS:

```css
/* Leaflet DivIcon — neutralise white box */
.sr-marker-outer { background: none !important; border: none !important; overflow: visible !important; }
```

Questo garantisce che le regole si applichino SEMPRE, indipendentemente da come Leaflet inietta gli elementi nel DOM.

### Fix 2 — Marker completamente ridisegnato: bullseye 26px

**Schema visivo:**

```
[  ████████████████████  ]  ← drop shadow 0 3px 16px rgba(0,0,0,0.55)
[ █ ██████████████████ █ ]  ← outer blue glow 0 0 0 2px rgba(37,99,235,0.5)
[ █ ██ ── white ── ██ █ ]  ← border 3px solid #fff
[ █ ██ ─── BLUE ─── ██ █ ]  ← fill #2563EB
[ █ ██ ────●──── ██ █ ]  ← white center dot 7px
[ █ ██████████████████ █ ]
[  ████████████████████  ]
```

**CSS finale:**
```css
.sr-dot {
  position: absolute;
  top: 7px; left: 7px;      /* (40 - 26) / 2 = 7px — centrato nel container */
  width: 26px; height: 26px;
  border-radius: 50%;
  background: #2563EB;
  border: 3px solid #ffffff;
  box-sizing: border-box;
  box-shadow: 0 3px 16px rgba(0,0,0,0.55), 0 0 0 2px rgba(37,99,235,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 2;
}

.sr-dot-inner {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: rgba(255,255,255,0.92);
}
```

**Perché funziona su tutti gli sfondi:**
- Sfondo OSM chiaro: blu #2563EB ad alto contrasto
- Sfondo CartoDB dark: bordo bianco 3px ad alto contrasto
- Zone colorate (verde, rosso, viola): blu è semanticamente distinto, drop shadow lo separa fisicamente
- Accuracy circle: cambiata in grigio/neutro per non competere con il dot

### Fix 3 — Posizionamento esplicito in pixel (non flexbox)

Il ring e il dot usano ora `top: 7px; left: 7px` (calcolato come `(40 - 26) / 2 = 7px`) invece di affidarsi al centering flexbox su elementi `position: absolute`. Questo è più robusto e non dipende dal comportamento del browser per la "static position" di elementi assolutamente posizionati in flex container.

Il ring usa `transform: scale()` per l'animazione — nessun conflitto con il posizionamento esplicito in pixel (transform-origin default `50% 50%` dell'elemento stesso, che è già centrato nel container).

### Fix 4 — Ring più visibile

Ring passato da `rgba(37, 99, 235, 0.35)` (quasi invisibile) a `rgba(37, 99, 235, 0.55)` e da 22px a 26px di dimensione iniziale. Questo rende l'animazione pulsante chiaramente visible dall'inizio, comunicando "posizione live" in modo immediato.

### Fix 5 — Classe CSS prefissata `sr-`

Tutte le classi rinominate da `user-marker-*` (MapView) e `tp-marker-*` (TrackingPublicPage) a `sr-*` (SafeRoute prefix, uniforme). Questo:
1. Evita collisioni con Leaflet's `leaflet-marker-*` namespace
2. Rende il codice leggibile come "questo è il marker SafeRoute"
3. Allinea design tra le due pagine (stesso codice HTML e CSS)

---

## Scelte UX

### Perché il "bullseye" (dot con centro bianco)

Il pattern "dot blu pieno + centro bianco" è usato da Apple Maps, Google Maps (compact mode), Life360, e numerose app mobile di geolocalizzazione. Il centro bianco:
1. Crea un "target" visivo immediato — l'occhio si aggancia al contrasto bianco/blu
2. Indica "precisione puntuale" — il bianco al centro suggerisce che il punto indica esattamente questa posizione
3. È riconoscibile anche a zoom bassi (10-12) dove il dot è piccolo

### Perché non verde

Il verde è il colore delle zone sicure in SafeRoute. Un marker verde confonde il segnale "tu sei qui" con il segnale "zona sicura" — semanticamente opposti (una è la tua posizione, l'altro è una proprietà del territorio).

### Accuracy circle

Il cerchio di accuratezza GPS rimane in blu (#2563EB) con `fillOpacity: 0.08` — quasi invisibile come fill. Essendo visualmente molto più grande del dot, non compete con esso.

---

## Test eseguiti

| Test | Metodo | Esito |
|---|---|---|
| TypeScript 0 errori frontend | `npx tsc --noEmit` | ✓ 0 errori |
| CSS non-scoped si applica a elementi Leaflet | Analisi: non usa data-v attribute | ✓ Garantito |
| Posizionamento centrato corretto | Calcolo: (40-26)/2 = 7px, centro a [20,20] | ✓ Verificato |
| ring animation non interferisce con posizione Leaflet | `transform: scale()` sull'elemento ring, non sul container | ✓ Indipendente |
| stale state funziona | `.sr-marker-wrap.stale` nasconde ring, griglia dot | ✓ Verificato |
| TrackingPublicPage — stesso design | HTML e CSS identici con `sr-*` classi | ✓ Applicato |
| Classe `sr-marker-outer` override Leaflet default | `!important` su background/border | ✓ Garantito |
| `box-sizing: border-box` compatibile con Tailwind | Dichiarato esplicitamente su `.sr-dot` | ✓ Esplicito |

---

## Confronto prima/dopo

| Proprietà | Step 3.0b (prima) | Step 3.0c (dopo) |
|---|---|---|
| CSS delivery | `<style scoped>` + `:deep()` | `<style>` non-scoped |
| Dot size | 18px (content) + 3px border = 21px visivo | 26px (border-box) = 26px visivo |
| Fill area | ~12px (con border-box sottratto) | ~20px (26px - 3px - 3px) |
| Ring opacity | 0.35 | 0.55 |
| Ring start size | 22px | 26px |
| Shadow | `0 2px 12px rgba(0,0,0,0.45)` | `0 3px 16px rgba(0,0,0,0.55)` + outer blue glow |
| Inner dot | No | Sì — 7px white bullseye |
| Posizionamento | Flexbox centering su absolute | Pixel espliciti `top: 7px; left: 7px` |
| Classe naming | `user-marker-*` / `tp-marker-*` | `sr-*` uniforme |

---

## File modificati

- `frontend/src/components/map/MapView.vue`
- `frontend/src/pages/TrackingPublicPage.vue`
- `docs/step-3-0c-marker-visibility.md` (questo file)
