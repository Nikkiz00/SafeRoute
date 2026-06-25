# Day 07 — SOS Reale + Notifiche + Follow-up

## PRD di riferimento
- `prd/04-sos-tracking.md` (SOS flow, notifiche, tracking live)

## Agenti usati
- backend-agent
- frontend-agent
- architect-agent
- qa-agent

## Completato

### Backend

**SOS module** (`src/modules/sos/`)

**Endpoint:**
- `POST /api/sos` — auth richiesta, nessun rate limit (sicurezza prioritaria)
  - Legge lat/lng/accuracy/message dal body
  - Trova RouteSession attiva (active→sos) o ne crea una emergency-only
  - Crea SOSAlert con routeSessionId
  - Notifica tutti i contatti di emergenza (email + SMS) con Promise.allSettled
  - Salva NotificationLog per ogni tentativo
  - Restituisce: sosId, trackingUrl, trackingToken, notifiedContacts, notificationStatus
- `GET /api/sos/:id` — auth, solo owner, restituisce dettaglio SOS + followup
- `POST /api/sos/:id/followup` — registra risposta "Ora sei al sicuro?"

**Notification service** (`src/modules/sos/notifications/`)
- `email.provider.ts` — nodemailer SMTP, skip graceful se non configurato
  - Messaggio HTML con posizione GPS, link tracking, istruzione 112
  - `createTransporter()` lazy (non crasha all'avvio se SMTP mancante)
- `sms.provider.ts` — provider astratto: none/mock/twilio-stub
  - Stub strutturale per Twilio (da attivare con package + credenziali reali)
  - Mock: logga e restituisce 'sent'
  - None: salta silenziosamente
- `notification.service.ts` — fan-out email + SMS per ogni contatto
  - Promise.allSettled: failure di un contatto non blocca gli altri
  - Try/catch per ogni canale: log DB failure non blocca l'email/SMS
  - Salva sempre results (anche in caso di errore)

**Safety e robustezza**
- GPS (0,0) fallback: se frontend non ha posizione, usa l'ultimo LocationPing della route session
- Se anche quel ping manca: message = 'posizione non disponibile'
- `routes.service.ts` updateLocation: accetta status 'sos' (tracking continua durante SOS)
- env.ts: tutti i campi SMTP/SMS `.optional()` o `.default()` — nessun process.exit

**env.ts aggiornato:**
```
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM (optional)
SMS_PROVIDER (default: 'none'), TWILIO_* (optional)
```

### Frontend

**SOS Flow** (`src/components/sos/SOSFlow.vue`)
- Full-screen dark overlay, z-sos (z=50)
- 5 stati interni: locating → sending → active → followup_pending → followup_done
- Stato 'active': badge SOS, lista contatti con canali (✉️✓/📱✗), link tracking con copy
- Warning se nessun contatto configurato
- Reminder "chiama il 112"
- Bottone "Ora sei al sicuro?" → follow-up
- Stato 'followup': 4 opzioni (falso allarme, risolto, ancora in pericolo, non rispondo)
- Auto-dismiss 2s dopo follow-up completato

**SOS Store** (`src/stores/sos.ts`)
- State machine: idle→locating→sending→active→followup_pending→followup_done/error
- Gestisce sosId, activationResult, showFlow, error

**API** (`src/api/sos.ts`)
- `triggerSOS`, `submitSOSFollowup`

**DashboardPage.vue** (aggiornato)
- `handleSOSActivated`: geolocate → `sosFlowRef.value?.activate(lat, lng, accuracy)`
- Fallback GPS: usa `routeStore.lastPosition` se navigator.geolocation timeout
- `<SOSFlow ref="sosFlowRef" />` montato in template
- `@activated="handleSOSActivated"` su SOSButton

**Tipi** (`src/types/index.ts`)
- `SOSNotificationChannel`, `SOSNotifiedContact`, `SOSNotificationStatus`, `SOSActivationResult`, `SOSFollowupOption`

**CSS** (`src/assets/main.css`)
- `.fade-enter-active/.leave-active/.enter-from/.leave-to` aggiunte a livello globale (necessario per Vue `<Transition name="fade">`)

## Bug fix e hardening inclusi
- `notification.service.ts`: try/catch per ogni contatto, results sempre pushati
- `sos.service.ts`: GPS (0,0) fallback con ultimo LocationPing
- `routes.service.ts`: `status !== 'active' && status !== 'sos'` guard aggiornato
- `.fade-*` CSS spostato da scoped a globale (Vue Transition non usa scoped attr)

## NON implementato (deferred)
- Twilio SMS reale (package non installato, stub strutturale pronto)
- Admin dashboard per moderare SOS
- Dashboard log notifiche per admin
- Push notification (mobile)
- SOS pre-set messages selezionabili (Day 8+)

## File modificati/creati

### Backend
- `src/config/env.ts` *(updated)*
- `src/modules/sos/sos.schemas.ts` *(new)*
- `src/modules/sos/sos.types.ts` *(new)*
- `src/modules/sos/sos.service.ts` *(new)*
- `src/modules/sos/sos.controller.ts` *(new)*
- `src/modules/sos/sos.routes.ts` *(new)*
- `src/modules/sos/notifications/email.provider.ts` *(new)*
- `src/modules/sos/notifications/sms.provider.ts` *(new)*
- `src/modules/sos/notifications/notification.service.ts` *(new)*
- `src/modules/routes/routes.service.ts` *(updated — sos status guard)*
- `src/server.ts` *(updated)*
- `.env.example` *(updated)*

### Frontend
- `src/types/index.ts` *(updated)*
- `src/api/sos.ts` *(new)*
- `src/api/index.ts` *(updated)*
- `src/stores/sos.ts` *(new)*
- `src/components/sos/SOSFlow.vue` *(new)*
- `src/pages/DashboardPage.vue` *(updated)*
- `src/assets/main.css` *(updated)*

## Commit message
`feat: day 7 — SOS reale con email, SMS provider astratto, follow-up "Ora sei al sicuro?"`
