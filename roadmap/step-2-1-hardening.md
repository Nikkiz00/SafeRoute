# Step 2.1 — Critical Hardening Fix

**Data:** 2026-06-23
**Tipo:** Security & Trust hardening
**Scope:** Nessuna nuova feature. Solo fix di problemi critici identificati in code review.

---

## Obiettivo

Correggere i problemi più seri che impedivano a SafeRoute di sembrare una web app professionale e sicura, prima di procedere con nuove feature. I fix riguardano sicurezza CORS, integrità dei log notifiche, robustezza della password policy, chiarezza UX sul fallback routing e qualità del logging strutturato.

---

## Problemi corretti

### 1. SSE CORS wildcard rimosso

L'endpoint SSE `GET /api/track/:token/stream` impostava manualmente `Access-Control-Allow-Origin: *` nel controller, bypassando la policy CORS globale. Questo creava un'incongruenza: tutta l'API aveva CORS ristretto al dominio frontend, ma il tracking stream era aperto a qualsiasi origin.

**File:** `backend/src/modules/tracking/tracking.controller.ts`

**Fix:** rimosso l'header manuale. Il CORS è ora gestito interamente dal middleware globale in `server.ts` con `origin: env.FRONTEND_URL` — uniforme per tutti gli endpoint incluso SSE.

---

### 2. SMS stub bug — falsi positivi nel log notifiche

Quando `SMS_PROVIDER=twilio` ma il pacchetto npm `twilio` non è installato nell'ambiente, il provider restituiva `status: 'sent'` nonostante nessun SMS fosse stato inviato. Questo produceva falsi positivi nei `NotificationLog` e rendeva impossibile distinguere un invio reale da un invio simulato/saltato.

**File:** `backend/src/modules/sos/notifications/sms.provider.ts`

**Fix:** il provider ora restituisce `status: 'skipped'` con un messaggio esplicativo quando il pacchetto non è disponibile. Il valore `skipped` è stato aggiunto come valore valido in `docs/database.md` per `NotificationLog.status`.

---

### 3. Password policy alzata a 10 caratteri

La policy precedente richiedeva un minimo di 8 caratteri, sotto lo standard attuale per applicazioni con dati sensibili (posizione GPS, contatti emergenza). Aggiornato a 10 caratteri.

**File backend:**
- `backend/src/modules/auth/auth.schemas.ts`
- `backend/src/modules/profile/profile.schemas.ts`

**File frontend:**
- `frontend/src/pages/RegisterPage.vue`
- `frontend/src/pages/ProfilePage.vue`

**Fix:** validazione backend (Zod) e frontend allineate a minimo 10 caratteri. Nessuna migrazione database necessaria (il campo `passwordHash` non ha vincoli di lunghezza sul valore hash).

---

### 4. Routing fallback UX — dichiarazione esplicita con avviso visivo

Il composable `useRouting.ts` eseguiva il fallback a linea retta quando OSRM non era disponibile senza esporre questo stato al componente chiamante. L'utente vedeva una linea retta senza capire se fosse un percorso reale o una stima.

**File frontend:**
- `frontend/src/composables/useRouting.ts`
- `frontend/src/components/map/RouteStartModal.vue`

**Fix:** aggiunta variabile reattiva `isRoutingFallback` esportata dal composable. `RouteStartModal.vue` mostra un banner giallo visibile quando OSRM non è disponibile: "Percorso stimato — routing offline non disponibile". Il percorso si avvia comunque normalmente.

---

### 5. Trust messaging migliorato

I messaggi mostrati agli utenti in scenari edge-case erano generici o fuorvianti, danneggiando la fiducia nell'app in momenti critici.

**File frontend:**
- `frontend/src/pages/TrackingPublicPage.vue` — messaggi aggiornati per: tracking terminato, attivazione polling fallback, link non valido o scaduto
- `frontend/src/components/sos/SOSFlow.vue` — messaggio corretto quando nessun contatto di emergenza è configurato (prima mostrava un messaggio neutro, ora avvisa chiaramente che nessuno è stato notificato)

---

### 6. Logging migliorato — mascheramento dati sensibili

I log di debug nei moduli tracking e SMS includevano dati sensibili in chiaro (token completi, numeri di telefono).

**File:**
- `backend/src/modules/tracking/tracking.controller.ts` — token SSE loggato troncato ai primi 8 caratteri con prefisso `[tracking-sse]`
- `backend/src/modules/sos/notifications/sms.provider.ts` — numero di telefono loggato mascherato (es. `+39333***789`) con prefisso `[sms]`

---

## File modificati

**Backend:**
- `backend/src/modules/tracking/tracking.controller.ts`
- `backend/src/modules/sos/notifications/sms.provider.ts`
- `backend/src/modules/auth/auth.schemas.ts`
- `backend/src/modules/profile/profile.schemas.ts`

**Frontend:**
- `frontend/src/pages/RegisterPage.vue`
- `frontend/src/pages/ProfilePage.vue`
- `frontend/src/composables/useRouting.ts`
- `frontend/src/components/map/RouteStartModal.vue`
- `frontend/src/pages/TrackingPublicPage.vue`
- `frontend/src/components/sos/SOSFlow.vue`

**Documentazione:**
- `docs/architecture.md` — nota CORS SSE, prefissi log standardizzati
- `docs/database.md` — valore `skipped` documentato per `NotificationLog.status`

---

## Problemi NON corretti in questo step (rimandati)

- **localStorage per JWT tokens** — rimandato. Richiede migrazione a httpOnly cookie con impatto elevato su auth flow, CSRF protection e deploy (Nginx/reverse proxy). Da pianificare come step dedicato prima del go-live.
- **GDPR / privacy policy page** — rimandato. Richiede testo legale e step dedicato.
- **Twilio reale** — rimandato. Richiede account Twilio, test E2E e configurazione secrets in produzione.
- **Redis / BullMQ / safety score asincrono** — rimandato. L'infrastruttura non è necessaria per MVP locale. Il ricalcolo sincrono è sufficiente nelle fasi attuali.
- **Admin panel** — rimandato. Step dedicato (Day 9+).
- **httpOnly cookie session** — rimandato insieme a localStorage JWT.

---

## Note decisioni

- Il valore `skipped` per `NotificationLog.status` è distinto da `failed`: `failed` indica un tentativo con errore provider; `skipped` indica che il canale non era configurato o disponibile. Questa distinzione permette di filtrare i log e capire se un'assenza di notifica SMS è un problema tecnico o una scelta configurativa.
- Il CORS SSE ora segue la stessa policy globale anche per la pagina di tracking pubblica. La pagina pubblica `/track/:token` non richiede credenziali nell'header SSE, quindi la policy CORS restrittiva non causa problemi funzionali.
- La password policy è stata alzata a 10 senza notificare gli utenti esistenti: le password già esistenti (hash) non cambiano. Il vincolo si applica solo alle nuove registrazioni e ai cambi password.
- `isRoutingFallback` è una variabile reattiva (non un evento) per permettere al template di reagire al cambio stato anche se OSRM torna disponibile dopo un primo fallimento.
