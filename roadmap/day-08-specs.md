# Day 8 — Professional Foundation Fix: Specifiche Architetturali

**Data:** 2026-06-22  
**Ruolo documento:** Fonte di verità per backend-agent, frontend-agent, maps-agent. Nessuna implementazione qui.

---

## Indice decisioni

1. Email verification gating
2. Cambio email sicuro
3. Cambio password sicuro
4. Logout con conferma
5. Tracking live — punti critici
6. Routing con destinazione obbligatoria
7. GPS più stabile
8. SOS UI redesign
9. Debug strutturato

---

## 1. Email verification gating

### Decisione

Il gating **non è un middleware globale**. È un controllo a livello di service, chiamato esplicitamente nei service che lo richiedono. Questo evita un middleware troppo invasivo e mantiene chiaro dove il check avviene.

Route che richiedono `emailVerified = true`:
- `POST /api/sos` — SOS reale
- `POST /api/routes` — avvio tracking percorso
- `POST /api/zones/:id/feedback` — feedback sicurezza zona

Route che NON richiedono verifica:
- `GET /api/zones`, `GET /api/zones/:id`, `GET /api/zones/:id/safety-summary` — lettura mappa (pubblica)
- `GET /api/tracking/:token`, `GET /api/tracking/:token/stream` — pubblica, nessuna auth
- `GET /api/profile`, `PATCH /api/profile` — nome/onboarding
- `PATCH /api/profile/email`, `PATCH /api/profile/password` — operazioni account
- `POST /api/zones/:id/reports` — segnalazione anonima consentita
- `POST /api/auth/resend-verification` — serve proprio agli utenti non verificati

### Implementazione check

Ogni service interessato chiama un helper interno:

```typescript
// backend/src/utils/require-verified.utils.ts
import { prisma } from '@/config/database.js'

export async function assertEmailVerified(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true, deletedAt: true },
  })
  if (!user || user.deletedAt) throw Object.assign(new Error('Utente non trovato'), { code: 'USER_NOT_FOUND', status: 404 })
  if (!user.emailVerified) throw Object.assign(new Error('Email non verificata'), { code: 'EMAIL_NOT_VERIFIED', status: 403 })
}
```

Chiamata all'inizio della funzione service, prima di qualsiasi query:
- `sos.service.ts` → `triggerSOS()` chiama `assertEmailVerified(userId)`
- `routes.service.ts` → `startRoute()` chiama `assertEmailVerified(userId)`
- `feedback.service.ts` → `createFeedback()` chiama `assertEmailVerified(userId)`

### Contratto errore API

```json
HTTP 403
{
  "success": false,
  "error": "Email non verificata",
  "code": "EMAIL_NOT_VERIFIED"
}
```

Il controller passa il `status` dall'errore se presente:

```typescript
// Nei controller interessati — pattern da applicare
} catch (err) {
  const e = err as { message?: string; code?: string; status?: number }
  if (e.code === 'EMAIL_NOT_VERIFIED') {
    sendError(res, e.message ?? 'Email non verificata', 403)
    return
  }
  // ...
}
```

### Frontend — comportamento

Il flag `emailVerified` è già incluso nel payload di `GET /api/profile` e viene tenuto in `authStore.user.emailVerified`.

Al login, `auth.service.ts` già restituisce `stripUser` che NON include `emailVerified`. **Fix necessario:** aggiornare `stripUser` in `auth.service.ts` per includere `emailVerified` nella risposta login, così il frontend lo conosce subito senza dover fare una `GET /api/profile`.

Comportamento UI quando arriva 403 `EMAIL_NOT_VERIFIED`:
- **NON** reindirizzare a `/verify-email` automaticamente — troppo aggressivo.
- Mostrare un **banner inline** nella pagina corrente: `"Verifica la tua email per usare questa funzione. [Reinvia verifica]"`.
- Il banner usa il componente esistente di tipo "avviso" o un `toast` persistente (non auto-dismiss).
- Il pulsante "Reinvia verifica" chiama `POST /api/auth/resend-verification` e mostra feedback inline.

Componente da creare: nessuno nuovo. Usare un ref reattivo `showVerifyBanner` nelle pagine/componenti interessati (SOSPage, DashboardPage per routing, FeedbackModal).

---

## 2. Cambio email sicuro

### Decisione

Il cambio email rimane **immediato nel DB** (non staging/pending email). MVP, cambio sicuro tramite:
1. Notifica sicurezza alla vecchia email DOPO l'update (non-blocking).
2. Re-verifica alla nuova email (già implementato).

### Nuova funzione email

Aggiungere in `backend/src/modules/sos/notifications/email.provider.ts`:

```typescript
export async function sendEmailChangedNotification(params: {
  to: string          // vecchia email
  userName: string
  newEmail: string    // nuova email (oscurata parzialmente nell'email)
}): Promise<EmailResult>
```

Template testo: "Ciao [userName], la tua email su SafeRoute è stata cambiata a [new***@domain.com]. Se non sei stato tu, contatta il supporto immediatamente."

L'email oscura parzialmente la nuova email per sicurezza: `new***@domain.com`.

Helper oscuramento:
```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 3)}***@${domain}`
}
```

### Modifica in `profile.service.ts`

Nella funzione `changeEmail()`, dopo `prisma.user.update(...)`, aggiungere chiamata non-blocking PRIMA di inviare la verifica alla nuova email:

```typescript
// Notifica sicurezza alla vecchia email (non-blocking)
sendEmailChangedNotification({
  to: user.email,         // vecchia email, prima dell'update
  userName: user.name,
  newEmail: input.newEmail,
}).catch(e => console.error('[email-change] security notification error:', e))
```

La vecchia email è disponibile nell'oggetto `user` recuperato con `findUnique` prima dell'update.

**Log strutturato da aggiungere:**
```typescript
console.info(`[email-change] user=${userId} changed email, security notification sent to old address`)
```

---

## 3. Cambio password sicuro

### Decisione

Dopo cambio password:
1. Invalida **tutti** i refresh token attivi dell'utente (non solo il corrente).
2. Invia email di sicurezza "Password modificata" (non-blocking).

### Modifica in `profile.service.ts`

Nella funzione `changePassword()`, dopo `prisma.user.update(...)`:

```typescript
// Invalida tutti i refresh token attivi
await prisma.refreshToken.updateMany({
  where: {
    userId,
    revokedAt: null,   // solo quelli ancora attivi
  },
  data: { revokedAt: new Date() },
})

// Notifica sicurezza (non-blocking)
sendPasswordChangedNotification({
  to: user.email,
  userName: user.name,
}).catch(e => console.error('[password-change] security notification error:', e))
```

Il pattern è identico a `softDeleteAccount()` che già usa `refreshToken.updateMany` nella stessa transazione — qui non serve transazione perché l'update password è già avvenuto.

### Nuova funzione email

Aggiungere in `email.provider.ts`:

```typescript
export async function sendPasswordChangedNotification(params: {
  to: string
  userName: string
}): Promise<EmailResult>
```

Template: "Ciao [userName], la tua password su SafeRoute è stata modificata. Se non sei stato tu, contatta il supporto e cambia immediatamente la password."

**Log strutturato:**
```typescript
console.info(`[password-change] user=${userId} password changed, all refresh tokens revoked, security email queued`)
```

### Impatto UX

L'utente che cambia password viene automaticamente disconnesso da tutti gli altri dispositivi al prossimo refresh token. Non serve mostrare un messaggio aggiuntivo in UI — il comportamento è atteso per qualsiasi cambio password sicuro.

---

## 4. Logout con conferma

### Decisione

**Solo frontend.** Nessuna modifica backend.

### Componente/pattern

Il logout viene attivato da:
- `AppShell.vue` (navbar/sidebar)
- Eventuali altri punti (attualmente solo AppShell)

Pattern: sostituire la chiamata diretta `auth.logout()` con apertura di un modal di conferma leggero.

### Specifiche modal

- Tipo: modal bottom-sheet (su mobile) / centered small modal (su desktop)
- Titolo: "Esci dall'account"
- Testo: "Vuoi davvero uscire? Dovrai fare di nuovo il login."
- Pulsanti:
  - "Annulla" — chiude il modal, `variant: ghost`
  - "Esci" — chiama `auth.logout()` e naviga a `/login`, `variant: danger`
- Non aggiungere un componente dedicato: gestire con `ref<boolean> showLogoutConfirm` nel componente che contiene il trigger (AppShell).
- Il modal non blocca la navigazione — usa `v-if` standard, non `<Teleport>` obbligatorio.

---

## 5. Tracking live — punti critici

### Analisi stato attuale

Dall'ispezione di `tracking.controller.ts`:
- SSE init invia `{ type: 'init', ...data }` — il `trackingToken` NON è incluso in `data` (è il token URL, non serve nel payload SSE). **Nessun bug.**
- `statusHandler` chiude la connessione con `res.end()` — corretto.
- `Access-Control-Allow-Origin: *` nell'SSE stream — corretto per pagina pubblica.

### Fix richiesti

**1. Env fallback per pagina pubblica `/track/:token`**

In `TrackingPublicPage.vue`, la costruzione dell'URL backend deve usare un fallback esplicito:

```typescript
const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'
```

Verificare che questo pattern sia già presente. Se usa solo `import.meta.env.VITE_API_URL` senza fallback, aggiungere il fallback.

**2. Nessun fix SSE necessario** — il controller è già corretto.

**3. Cleanup SSE listener**

Verificare che `tracking.controller.ts` rimuova i listener SSE all'evento `close` della connessione:

```typescript
req.on('close', () => {
  trackingEmitter.off(`ping:${token}`, pingHandler)
  trackingEmitter.off(`status:${token}`, statusHandler)
})
```

Se mancante, aggiungere — è un memory leak potenziale su connessioni lunghe.

---

## 6. Routing con destinazione obbligatoria

### Decisione

**Nessun engine routing in Day 8** per la parte backend — le coordinate vengono già salvate in `RouteSession.endLat/endLng`.

Ciò che cambia in Day 8:
- Destinazione **obbligatoria** nel form (non più "(consigliata)")
- Geocoding tramite **Nominatim** (OpenStreetMap, free, no key)
- Routing visuale tramite **OSRM public demo** con polyline Leaflet
- Distanza/ETA calcolati dalla risposta OSRM
- Fallback graceful se OSRM non disponibile

### Backend — nessuna modifica

Il campo `destinationName` e `endLat/endLng` già esistono. Nessun nuovo endpoint.

### Frontend — `RouteStartModal.vue`

**Destinazione obbligatoria:**
- Rimuovere il label "(consigliata)"
- Il bottone "Inizia percorso" è `disabled` finché `selectedDestination` è `null`
- Messaggio placeholder: "Cerca una destinazione..."
- Messaggio sotto campo vuoto: "La destinazione è obbligatoria per avviare il tracking"

**Ricerca con Nominatim (sostituisce la ricerca solo su zone caricate):**

La ricerca attuale filtra solo sulle zone Leaflet caricate in memoria. Limitazione: funziona solo se le zone sono caricate, e copre solo zone note al sistema.

Nominatim permette ricerca full-text su indirizzi globali.

Strategia ibrida (ordine priorità):
1. Prima cerca tra le zone SafeRoute caricate (risposta istantanea, locale)
2. Se meno di 3 risultati, chiama Nominatim per completare

Endpoint Nominatim:
```
GET https://nominatim.openstreetmap.org/search
  ?q={query}
  &format=json
  &limit=5
  &countrycodes=it
  &addressdetails=1
```

Header obbligatorio: `User-Agent: SafeRoute/1.0 (contact: dev@saferoute.app)` — Nominatim policy.

Risultati Nominatim vengono mappati a `{ id: 'nom_'+place_id, name: display_name, cityName: address.city ?? address.town ?? '', lat: parseFloat(lat), lng: parseFloat(lon) }`.

Debounce ricerca: 400ms.

**Routing visuale con OSRM:**

Dopo che l'utente seleziona destinazione E la posizione GPS è disponibile, in background viene chiamato OSRM per ottenere il percorso.

Il composable `useRouteTracker.ts` NON gestisce il routing — il routing è solo visualizzazione, non tracking.

Logica nel composable/componente `RouteStartModal`:

```
// Quando selectedDestination cambia E userPosition è disponibile:
fetchOSRMRoute(userPosition, selectedDestination) → polyline GeoJSON

OSRM endpoint:
GET https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}
  ?overview=full
  &geometries=geojson
```

Response parsing:
```typescript
interface OSRMResponse {
  routes: Array<{
    distance: number    // metri
    duration: number    // secondi
    geometry: {
      type: 'LineString'
      coordinates: [number, number][]   // [lng, lat]
    }
  }>
}
```

ETA display: `Math.round(duration / 60)` minuti. Distanza: `(distance / 1000).toFixed(1)` km.

La polyline viene disegnata su Leaflet SOLO durante la preview nel modal (prima di avviare il percorso). Dopo l'avvio, la polyline rimane visibile nella mappa principale.

**Passaggio polyline alla mappa:**

Il `RouteStartModal` emette un nuovo evento `routePreview` con il GeoJSON della polyline. Il `DashboardPage` lo riceve e lo passa a `MapView` come prop `routePolyline`.

`MapView` disegna la polyline con `L.polyline(coords, { color: '#2563EB', weight: 4, opacity: 0.8 })` e la rimuove al `cancel` del percorso.

**Fallback OSRM non disponibile:**

Se la chiamata OSRM fallisce (errore rete, timeout, HTTP error):
- Disegnare una linea retta `L.polyline([start, end])` tratteggiata
- Mostrare messaggio: "Percorso stimato — routing offline non disponibile"
- ETA: non mostrato
- Il percorso si avvia comunque normalmente

**Nessuna dipendenza NPM aggiuntiva.** OSRM viene chiamato con `fetch` nativo. Niente `leaflet-routing-machine`.

### Contratto evento `RouteStartModal`

Aggiungere emits:

```typescript
routePreview: [data: {
  polyline: [number, number][]   // array [lat, lng] per Leaflet
  distanceKm: number | null
  etaMinutes: number | null
  isFallback: boolean
} | null]
```

Emette `null` quando la destinazione viene deselezionata.

---

## 7. GPS più stabile

### Parametri aggiornati

File: `frontend/src/composables/useRouteTracker.ts`

| Costante | Valore attuale (Day 7.7) | Valore Day 8 |
|---|---|---|
| `GPS_ACCURACY_THRESHOLD` | 35 | 50 |
| `GPS_MIN_DISTANCE_M` | 8 | 10 |
| `EMA_ALPHA` | 0.25 | 0.15 |

Motivazione: 0.15 alpha meno reattivo significa più smoothing (75% del peso sul passato, 15% sul nuovo). Threshold 50m più tollerante per desktop.

### Banner GPS impreciso

Aggiungere in `MapView.vue` (o `useRouteTracker.ts`):

Condizione: `accuracy > 100`

Comportamento:
- Mostrare banner non-bloccante in cima alla mappa: "GPS molto impreciso — usa un dispositivo mobile per maggiore precisione"
- Stile: `bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-b border-yellow-200`
- Il marker rimane visibile
- Il banner scompare automaticamente se `accuracy` torna ≤ 100

Il banner si distingue dall'indicatore colorato accuracy già presente (badge piccolo) — il banner è una comunicazione più esplicita per utenti desktop.

Implementazione: prop/emit o evento condiviso tramite `useRouteTracker` che espone `ref<boolean> isVeryImprecise`.

---

## 8. SOS UI redesign

### Struttura a step (macchina a stati)

Sostituire la struttura corrente di `SOSPage.vue` con flow a 5 step lineari:

```
Step 1: REASON_SELECT
Step 2: MESSAGE_COMPOSE
Step 3: CONFIRM (long press)
Step 4: COUNTDOWN (5s annullabile)
Step 5: SENT
```

Il tipo `Phase` attuale (`'idle' | 'countdown' | 'sent'`) viene sostituito da:

```typescript
type SOSStep = 'reason' | 'compose' | 'confirm' | 'countdown' | 'sent'
```

La navigazione è sempre forward (1→2→3→4→5). Tasto back fisso in alto torna allo step precedente (tranne da `sent`).

### Step 1 — REASON_SELECT

- Titolo: "Cosa sta succedendo?"
- Sottotitolo: "Scegli il motivo del SOS"
- Card motivi: bordo sottile, icona Lucide, testo normale (non bold)
- Colori: neutri (bg-card, border-border) — NO sfondo rosso
- Sempre visibile in fondo: link "Chiama il 112" → `tel:112`, stile `text-danger-red underline`
- Pulsante "Avanti" disabilitato finché nessun motivo selezionato

### Step 2 — MESSAGE_COMPOSE

- Titolo: "Aggiungi un messaggio (opzionale)"
- Textarea max 200 caratteri
- Placeholder: "Es. Sono al parco Sempione, accanto alla fontana"
- Pulsante "Salta" (avanza senza messaggio) — ghost variant
- Pulsante "Avanti" — primary variant
- Tasto back → torna a Step 1

### Step 3 — CONFIRM

- Titolo: "Tieni premuto per inviare l'allarme"
- Long press 1500ms con progress bar circolare (meccanismo già esistente — portarlo qui)
- Sfondo: neutro (base background)
- Il bottone ha bordo rosso ma sfondo bianco/neutro
- Tasto back → torna a Step 2
- Sempre visibile: link "Chiama il 112"

### Step 4 — COUNTDOWN

- **Questo è l'unico step con sfondo rosso** (`bg-danger-red` o `bg-red-600`)
- Countdown 5 secondi
- Testo: "Allarme in invio tra [N]..."
- Pulsante "Annulla" prominente, bianco
- Dopo 0 secondi: chiama `POST /api/sos` → avanza a Step 5

### Step 5 — SENT

- Sfondo: torna neutro
- Icona checkmark grande, verde
- Testo: "Allarme inviato"
- Sub: "[N] contatti notificati"
- Pulsante "Chiama il 112" → `tel:112`
- Pulsante "Sono al sicuro" → chiama followup API → naviga a dashboard

### Layout generale

- Nessun overlay fullscreen fisso durante gli step 1-3
- Step 1-3: layout normale pagina con padding, no modal
- Step 4: fullscreen rosso (come ora)
- Step 5: layout normale

La pagina `/sos` è già una route dedicata — usarla senza cambiare il routing Vue.

### Componenti toccati

- `frontend/src/pages/SOSPage.vue` — refactor completo logica step
- `frontend/src/components/sos/SOSFlow.vue` — valutare se mantenere o fondere in SOSPage

**Decisione:** mantenere `SOSFlow.vue` ma ridurlo a gestire SOLO gli step 4-5 (countdown + sent), che sono i più "modal-like". Gli step 1-3 vivono direttamente in `SOSPage.vue` come sezioni.

---

## 9. Debug strutturato

### Backend

Prefissi `[modulo]` da usare in ogni `console.info/warn/error`:

| Modulo | Prefisso |
|---|---|
| Verifica email | `[auth-verify]` |
| Cambio email | `[email-change]` |
| Cambio password | `[password-change]` |
| Tracking SSE | `[tracking-sse]` |
| Routing | `[routing]` |
| SOS | `[sos]` |
| Email provider | `[email]` |
| SMS provider | `[sms]` |

Regole:
- MAI loggare `passwordHash`, token raw, o email completa in log di livello info/warn
- Le email nei log vanno oscurate: `maskEmail(email)` → `nik***@gmail.com`
- I token nei log usano solo i primi 8 caratteri: `token.slice(0, 8) + '...'`
- Errori SMTP: già gestiti con messaggi specifici — mantenere

### Frontend

Aggiungere in `useRouteTracker.ts` e composables GPS/routing:

```typescript
const isDev = import.meta.env.DEV

function debugLog(module: string, ...args: unknown[]) {
  if (isDev) console.debug(`[${module}]`, ...args)
}
```

Prefissi frontend:
- `[gps]` — useRouteTracker posizioni, filtri
- `[tracking]` — eventi SSE tracking
- `[routing]` — chiamate OSRM, risultati

In production (`isDev = false`) nessun output debug dal frontend.

---

## Contratti API completi

### Endpoint modificati

#### `POST /api/auth/login` (auth.service.ts)

**Aggiunta campo in response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "...",
      "email": "...",
      "role": "USER",
      "plan": "FREE",
      "onboardingCompleted": true,
      "createdAt": "...",
      "emailVerified": false    // <-- AGGIUNTO (era mancante da stripUser in auth.service)
    },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

**Modifica:** `stripUser` in `auth.service.ts` deve includere `emailVerified`.

#### `POST /api/sos` — nuovo errore possibile

```json
HTTP 403
{ "success": false, "error": "Email non verificata", "code": "EMAIL_NOT_VERIFIED" }
```

#### `POST /api/routes` — nuovo errore possibile

```json
HTTP 403
{ "success": false, "error": "Email non verificata", "code": "EMAIL_NOT_VERIFIED" }
```

#### `POST /api/zones/:id/feedback` — nuovo errore possibile

```json
HTTP 403
{ "success": false, "error": "Email non verificata", "code": "EMAIL_NOT_VERIFIED" }
```

#### `PATCH /api/profile/password` — comportamento aggiunto

Nessuna modifica alla response. Aggiunge side effects:
- Tutti i refresh token dell'utente vengono revocati
- Email di sicurezza inviata (non-blocking, non influenza response)

#### `PATCH /api/profile/email` — comportamento aggiunto

Nessuna modifica alla response. Aggiunge side effect:
- Email di sicurezza alla vecchia email (non-blocking)

### Nuovi codici errore

| Codice | HTTP | Dove |
|---|---|---|
| `EMAIL_NOT_VERIFIED` | 403 | SOS, routes start, feedback |
| `USER_NOT_FOUND` | 404 | assertEmailVerified helper |

---

## Contratti UI — componenti toccati

| Componente/Pagina | Modifica |
|---|---|
| `backend/src/modules/auth/auth.service.ts` | Aggiungere `emailVerified` in `stripUser` |
| `backend/src/modules/profile/profile.service.ts` | `changeEmail`: notifica vecchia email; `changePassword`: revoca token + email sicurezza |
| `backend/src/modules/sos/notifications/email.provider.ts` | Aggiungere `sendEmailChangedNotification`, `sendPasswordChangedNotification` |
| `backend/src/utils/require-verified.utils.ts` | **Nuovo file** — helper `assertEmailVerified` |
| `backend/src/modules/sos/sos.service.ts` | Chiamare `assertEmailVerified` |
| `backend/src/modules/routes/routes.service.ts` | Chiamare `assertEmailVerified` |
| `backend/src/modules/zones/feedback.service.ts` | Chiamare `assertEmailVerified` |
| `backend/src/modules/tracking/tracking.controller.ts` | Verificare e aggiungere cleanup SSE listener su `req.on('close')` |
| `frontend/src/pages/SOSPage.vue` | Refactor step-based flow |
| `frontend/src/components/sos/SOSFlow.vue` | Ridurre a step 4-5 (countdown + sent) |
| `frontend/src/components/map/RouteStartModal.vue` | Destinazione obbligatoria, Nominatim, OSRM routing |
| `frontend/src/pages/DashboardPage.vue` | Riceve `routePreview` event, passa polyline a MapView; gestisce banner `EMAIL_NOT_VERIFIED` |
| `frontend/src/components/map/MapView.vue` | Prop `routePolyline`, disegna polyline OSRM; banner GPS impreciso |
| `frontend/src/components/common/AppShell.vue` | Logout con conferma modal |
| `frontend/src/composables/useRouteTracker.ts` | Parametri GPS aggiornati (alpha 0.15, threshold 50m, minDist 10m), debug log |
| `frontend/src/pages/TrackingPublicPage.vue` | Verificare env fallback VITE_API_URL |

---

## Ordine di implementazione consigliato

Le dipendenze tra task determinano l'ordine. I task indipendenti possono essere eseguiti in parallelo da agenti diversi.

### Fase 1 — Backend (nessuna dipendenza frontend)

**1a. `require-verified.utils.ts`** (nuovo helper, nessuna dipendenza)

**1b. Email provider — nuove funzioni**
- `sendEmailChangedNotification`
- `sendPasswordChangedNotification`
- Dipende da: nessuno (file autonomo)

**1c. `profile.service.ts` — fix cambio email e password**
- Dipende da: 1b (funzioni email)

**1d. `auth.service.ts` — aggiungere `emailVerified` in `stripUser`**
- Dipende da: nessuno

**1e. Service gating SOS, routes, feedback**
- Dipende da: 1a (helper assertEmailVerified)

**1f. `tracking.controller.ts` — cleanup SSE listener**
- Dipende da: nessuno (fix isolato)

### Fase 2 — Frontend indipendente

**2a. `AppShell.vue` — logout conferma**
- Dipende da: nessuno (solo UI)

**2b. `useRouteTracker.ts` — GPS params + debug log**
- Dipende da: nessuno

**2c. `SOSPage.vue` + `SOSFlow.vue` — redesign step**
- Dipende da: 1d (per mostrare banner EMAIL_NOT_VERIFIED)

### Fase 3 — Frontend dipendente da Fase 1

**3a. `RouteStartModal.vue` — destinazione obbligatoria + Nominatim + OSRM**
- Dipende da: 1e (per ricevere 403 EMAIL_NOT_VERIFIED e mostrarlo)

**3b. `MapView.vue` — polyline routing + banner GPS impreciso**
- Dipende da: 3a (riceve routePreview event tramite DashboardPage)

**3c. `DashboardPage.vue` — collega routePreview + gestisce EMAIL_NOT_VERIFIED**
- Dipende da: 3a (evento emesso da RouteStartModal), 1e (errore API)

---

## Cosa NON fare (blocklist per gli agenti)

### Backend-agent

- NON aggiungere `emailVerified` come middleware Express globale — il check va nel service
- NON revocare il refresh token corrente durante il cambio email (non richiesto — l'utente sta solo cambiando email)
- NON inviare la notifica sicurezza alla vecchia email come operazione bloccante (deve essere fire-and-forget con `.catch()`)
- NON modificare lo schema Prisma in Day 8 — tutte le colonne necessarie esistono già
- NON introdurre Redis, BullMQ o queue per Day 8 — le operazioni email sono già async

### Frontend-agent

- NON reindirizzare automaticamente a `/verify-email` quando arriva 403 `EMAIL_NOT_VERIFIED` — mostrare banner inline
- NON usare `leaflet-routing-machine` o altre dipendenze NPM per il routing — solo fetch OSRM + Leaflet polyline nativo
- NON usare Google Maps API per geocoding — solo Nominatim
- NON rendere il background di SOS rosso tranne che nello step countdown (Step 4)
- NON creare un modal dedicato per il logout — usare `ref<boolean>` + `v-if` nel componente AppShell

### Maps-agent

- NON installare pacchetti NPM per routing (es. `leaflet-routing-machine`, `@mapbox/polyline`)
- NON chiamare `router.project-osrm.org` per ogni cambio di posizione GPS — solo una volta alla selezione della destinazione nel modal
- NON mostrare ETA se OSRM fallisce — mostrare `null`/dash, non un valore stimato inventato
- NON fare routing safety-based in Day 8 — il peso sicurezza è Day 9+

### Tutti gli agenti

- NON modificare `docs/architecture.md` o `docs/database.md` — non ci sono cambiamenti schema o architetturali strutturali in Day 8
- NON aggiungere dipendenze NPM senza motivazione esplicita
- NON creare mock infiniti se la funzione è reale (Nominatim e OSRM sono free e pubblici)
- NON toccare il seed del database
- NON modificare i rate limit esistenti

---

## Note tecniche aggiuntive

### `assertEmailVerified` — costo query

La funzione esegue una `findUnique` sul DB per ogni operazione gated. Per Day 8 (volume basso) è accettabile. In futuro, includere `emailVerified` nel JWT payload per evitare la query extra — **non farlo in Day 8** perché cambierebbe il payload JWT e richiederebbe migrazione token attivi.

### Nominatim — rate limit

Nominatim ha un rate limit di 1 req/sec per IP. Il debounce 400ms + la ricerca ibrida (prima zone locali) garantiscono rispetto della policy. Nessun token richiesto per uso non commerciale con User-Agent corretto.

### OSRM public demo — disponibilità

`router.project-osrm.org` è un'istanza demo pubblica, senza SLA. Il fallback graceful (linea retta con disclaimer) è obbligatorio per questo motivo. In produzione si raccomanda un'istanza OSRM self-hosted.

### Mascheramento email nei log

La funzione `maskEmail` va in `backend/src/utils/hash.utils.ts` o in un nuovo `backend/src/utils/mask.utils.ts`. Usarla ovunque un'email viene loggata.
