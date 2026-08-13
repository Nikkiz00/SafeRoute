# Report Step 3.1 — Destination Search UX & Performance

**Data:** 2026-06-27
**Tipo:** UX/performance
**Scope:** Ricerca destinazione fluida, leggibile e professionale su mobile.

---

## Cause del lag e dei problemi UX

### Causa 1 — `isSearching` impostato solo dopo il debounce (false positive "no results")

Il flag `isSearching` era impostato a `true` solo *dentro* il callback `setTimeout`, ovvero dopo 400ms. Durante quella finestra di debounce:
- `destinationQuery.length >= 3` → true
- `isSearching` → false
- `searchResults.length === 0` → true

Risultato: il messaggio "Nessun risultato trovato" appariva per 400ms ogni volta che l'utente digitava più di 3 caratteri, prima ancora che la ricerca partisse.

### Causa 2 — Nessun AbortController (risposte stantie)

Ogni keypress avviava un nuovo `fetch` dopo il debounce. Se l'utente digitava velocemente, più richieste erano in volo contemporaneamente. La risposta più vecchia (più lenta da Nominatim) poteva arrivare *dopo* quella recente, sovrascrivendo i risultati corretti con risultati stantii. Questo causava un comportamento apparentemente casuale dei risultati.

### Causa 3 — `display_name` Nominatim mostrato grezzo

Nominatim restituisce un campo `display_name` come:
```
"Via Roma, 1, Bologna, Città metropolitana di Bologna, Emilia-Romagna, 40121, Italia"
```

Questo veniva mostrato:
- **Nei result button**: una singola riga di testo che andava a capo, rompendo il layout
- **Nel campo input dopo la selezione**: la stringa completa (60-100 caratteri) rendeva l'input illeggibile
- **Nel badge di selezione**: stesso problema, troncato con `truncate` ma la parte iniziale visibile era comunque lunga e inutile

### Causa 4 — Nessun limite di altezza per la lista risultati

Con 5 risultati e nomi lunghi che andavano a capo, la lista poteva crescere fino a 300-400px, spingendo i controlli sotto la viewport su telefoni piccoli (iPhone SE, 375px).

### Causa 5 — Touch target insufficiente

I result button non avevano `min-height` definito. Con due righe di testo il tap target era adeguato, ma con una sola riga corta scendeva sotto i 44px raccomandati da HIG/Material Design.

### Causa 6 — Debounce 400ms percepibile

400ms è nella zona grigia — abbastanza lungo da essere percettibile come ritardo. Con la combinazione di no-spinner-immediato + 400ms + no-AbortController, l'utente non aveva feedback e l'interfaccia sembrava "bloccata".

---

## Fix applicati

### Fix 1 — `isSearching = true` immediatamente al primo input valido

```ts
function onDestinationInput() {
  // ...
  if (destinationQuery.value.length < 3) {
    searchResults.value = []
    isSearching.value = false
    return
  }

  isSearching.value = true  // spinner immediato, prima del debounce
  searchResults.value = []
  // ... setTimeout 300ms
}
```

Lo spinner compare istantaneamente quando l'utente digita il 3° carattere. Il messaggio "nessun risultato" non compare mai durante il debounce.

### Fix 2 — AbortController + request ID

```ts
let currentAbortController: AbortController | null = null
let requestId = 0

searchTimeout = setTimeout(async () => {
  const myId = ++requestId
  currentAbortController = new AbortController()

  try {
    const res = await fetch(url, { signal: currentAbortController.signal })
    const data = await res.json()
    if (myId === requestId) {  // ignora risposte stantie
      searchResults.value = data.map(...)
      isSearching.value = false
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return
    if (myId === requestId) { searchResults.value = []; isSearching.value = false }
  }
}, 300)
```

La risposta viene accettata solo se è la più recente (`myId === requestId`). Le richieste precedenti vengono cancellate via `AbortController` per ridurre il carico sulla rete.

### Fix 3 — `parseNominatimName`: parsing intelligente del display_name

```ts
function parseNominatimName(displayName: string): { primary: string; secondary: string } {
  const parts = displayName.split(', ').map(p => p.trim()).filter(Boolean)
  const filtered = parts.filter(p =>
    p !== 'Italia' &&
    !/^\d{5}$/.test(p) &&               // rimuove CAP
    !p.startsWith('Città metropolitana') &&
    !p.startsWith('Municipio')
  )
  // primary = nome/via + numero civico
  // secondary = città + regione (ultimi 2 elementi rilevanti)
}
```

Esempi:
| display_name (raw Nominatim) | primary | secondary |
|---|---|---|
| `Piazza del Duomo, Centro storico, Milano, Città metropolitana di Milano, Lombardia, 20122, Italia` | `Piazza del Duomo` | `Milano, Lombardia` |
| `Via Roma, 1, Bologna, Città metropolitana di Bologna, Emilia-Romagna, 40121, Italia` | `Via Roma, 1` | `Bologna, Emilia-Romagna` |
| `Colosseo, Piazza del Colosseo, Celio, Municipio Roma I, Roma, Roma Capitale, Lazio, 00184, Italia` | `Colosseo` | `Roma Capitale, Lazio` |

### Fix 4 — Debounce ridotto da 400ms a 300ms

Con lo spinner immediato (Fix 1), l'utente ha feedback visivo prima che il debounce scada. 300ms è un buon compromesso: evita richieste eccessive a Nominatim (rate limit: max 1 req/s per IP) e rimane percettivamente reattivo.

### Fix 5 — Lista risultati two-line con touch target 48px

```html
<button
  class="... flex items-start gap-3 px-4 min-h-[48px] py-2.5 ..."
>
  <MapPin :size="14" class="shrink-0 mt-1" />
  <div class="flex-1 min-w-0">
    <div class="text-sm font-medium truncate">{{ result.primary }}</div>
    <div class="text-xs text-text-secondary truncate mt-0.5">{{ result.secondary }}</div>
  </div>
</button>
```

- `min-h-[48px]`: tap target sempre >= 48px (sopra i 44px di HIG e i 48px di Material Design)
- `truncate` su entrambe le righe: nessun overflow di layout
- `flex-1 min-w-0`: il contenitore del testo non supera mai il bordo

### Fix 6 — Lista risultati con max-height e scroll

```html
<div class="... max-h-52 overflow-y-auto">
```

Massimo ~208px di lista (circa 4 risultati a pieno schermo), poi scroll verticale nativo. La lista non spinge mai i controlli fuori dalla viewport.

### Fix 7 — Selezione pulita: input mostra solo `primary`

Prima: dopo selezione, `destinationQuery = result.display_name` (es. "Via Roma, 1, Bologna, Città metropolitana di Bologna, Emilia-Romagna, 40121, Italia")

Dopo: `destinationQuery = result.primary` (es. "Via Roma, 1") — l'input mostra solo il nome principale, leggibile a colpo d'occhio.

### Fix 8 — Badge selezione a due righe

```html
<div class="... bg-brand-blue/5 border border-brand-blue/20">
  <MapPin :size="14" class="text-brand-blue shrink-0" />
  <div class="flex-1 min-w-0">
    <div class="text-sm text-brand-blue font-medium truncate">{{ selectedDestination.primary }}</div>
    <div class="text-xs text-brand-blue/70 truncate">{{ selectedDestination.secondary }}</div>
  </div>
  <X :size="14" /> <!-- pulsante rimuovi -->
</div>
```

Il badge mostra chiaramente il nome principale (blu, grassetto) con il dettaglio geografico sotto (più tenue). L'utente capisce esattamente cosa ha selezionato.

### Fix 9 — `destinationName` emesso: breve e leggibile

Prima: `destinationName = result.display_name` (stringa lunga, salvata in backend e mostrata nel tracking panel)

Dopo: `destName = dest.secondary ? \`${dest.primary} · ${dest.secondary}\` : dest.primary`

Esempio: "Via Roma, 1 · Bologna, Emilia-Romagna"

Questo viene salvato in `RouteSession.destinationName` e mostrato nel `RouteTrackingPanel` ("Verso: Via Roma, 1 · Bologna, Emilia-Romagna") — compatto, leggibile, completo quel che basta.

### Fix 10 — Cleanup su close e unmount

```ts
function handleClose() {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (currentAbortController) currentAbortController.abort()
  isSearching.value = false
  error.value = null
  emit('close')
}

onUnmounted(() => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (currentAbortController) currentAbortController.abort()
})
```

Nessuna richiesta pendente rimane in volo dopo la chiusura del modal.

---

## Miglioramenti UX riassunti

| Aspetto | Prima | Dopo |
|---|---|---|
| Spinner di caricamento | Appare dopo 400ms | Appare immediatamente al 3° carattere |
| Flash "nessun risultato" | Ogni 400ms durante la digitazione | Mai durante la digitazione |
| Risposte stantie | Possibile sovrascrittura dei risultati | Impossibile (AbortController + request ID) |
| Nomi nei risultati | Stringa lunga su singola riga, va a capo | primary (corto, troncato) + secondary muted |
| Input dopo selezione | "Via Roma, 1, Bologna, Città metropolitana..." | "Via Roma, 1" |
| Badge di selezione | Stringa lunga troncata | primary (bold) + secondary su riga separata |
| Touch target risultati | Variabile (nessun min-height) | Sempre ≥ 48px |
| Overflow lista risultati | Possibile overflow fuori viewport | max-h-52 + scroll |
| Debounce | 400ms | 300ms |
| destinationName nel tracking | Stringa da 80-120 caratteri | es. "Via Roma, 1 · Bologna, Emilia-Romagna" |

---

## Problemi ancora aperti

| Problema | Motivazione rinvio |
|---|---|
| Nominatim rate limit (1 req/IP/s) | Non bloccante per MVP — AbortController riduce richieste effettive. Rate limit si applica su IP pubblico, non utente. |
| Risultati fuori dall'Italia | `countrycodes=it` limita a Italia, corretto per MVP |
| Internazionalizzazione | Non in scope MVP |
| Icona diversa per tipo di luogo (edificio/POI/strada) | Nominatim restituisce il campo `type` ma non è ancora usato — fuori scope |
| Animazione fade-in per risultati | Miglioramento visivo non critico |

---

## Perché l'obiettivo è raggiunto

1. **Nessun lag percepibile**: spinner immediato + debounce 300ms + AbortController = feedback istantaneo, nessuna risposta stantia.

2. **Risultati fluidi e ordinati**: max-h-52 scroll, two-line layout, truncate garantito su tutti i dispositivi.

3. **Nomi lunghi non rompono più la UI**: `parseNominatimName` separa primary e secondary, entrambi troncati con `truncate`. Layout sempre stabile.

4. **Leggibili su mobile**: `min-h-[48px]`, icone MapPin, testo primary bold + secondary muted.

5. **Chiaro cosa si sta selezionando**: il design a due righe separa visivamente nome/luogo dalla localizzazione geografica.

6. **Campo pulito dopo selezione**: input mostra solo `primary` (es. "Via Roma, 1"), badge sotto mostra entrambi i livelli. Nessuna stringa kilometrica.

7. **TypeScript 0 errori**: verificato con `npx tsc --noEmit` su frontend e backend.

8. **Nessuna regressione**: unico file modificato è `RouteStartModal.vue`. Mappa, tracking, SOS, auth, profile, legal pages non toccati.

---

## Test eseguiti (codice statico + analisi)

| Test | Metodo | Esito |
|---|---|---|
| TypeScript 0 errori frontend | `npx tsc --noEmit` | ✓ 0 errori |
| TypeScript 0 errori backend | `npx tsc --noEmit` | ✓ 0 errori |
| `parseNominatimName` — Piazza del Duomo Milano | Trace manuale | ✓ primary: "Piazza del Duomo", secondary: "Milano, Lombardia" |
| `parseNominatimName` — Via Roma 1 Bologna | Trace manuale | ✓ primary: "Via Roma, 1", secondary: "Bologna, Emilia-Romagna" |
| `parseNominatimName` — Colosseo Roma | Trace manuale | ✓ primary: "Colosseo", secondary: "Roma Capitale, Lazio" |
| isSearching immediato su 3+ chars | Analisi codice: set prima del setTimeout | ✓ Corretto |
| AbortController cancella richiesta precedente | Analisi codice: abort() su ogni nuovo input | ✓ Corretto |
| Request ID scarta risposte stantie | Analisi: `if (myId === requestId)` | ✓ Corretto |
| max-h-52 overflow-y-auto su lista | CSS analisi | ✓ Applicato |
| min-h-[48px] su ogni result button | Template analisi | ✓ Applicato |
| destinationQuery = result.primary dopo selezione | Analisi: `selectDestination()` | ✓ Corretto |
| destName = "primary · secondary" emesso | Analisi: `handleStart()` | ✓ Corretto |
| cleanup su handleClose + onUnmounted | Analisi codice | ✓ Corretto |
| No regressioni su altri componenti | Verifica glob: solo RouteStartModal modificato | ✓ Confermato |

---

## File modificati

- `frontend/src/components/map/RouteStartModal.vue` — tutti i fix sopra
- `docs/step-3-1-destination-search.md` (questo file)
