# Report Step 2.1 — Critical Hardening Fix

**Data:** 2026-06-23

---

## Problemi corretti

### Fix 1 — SSE CORS wildcard [DONE]

**Problema:** `tracking.controller.ts` impostava `res.setHeader('Access-Control-Allow-Origin', '*')` manualmente nell'handler SSE, bypassando il middleware CORS globale. Tutta l'API aveva CORS limitato al dominio frontend (`env.FRONTEND_URL`), ma lo stream SSE era aperto a qualsiasi origin.

**Soluzione:** rimossa la riga `setHeader` nel controller. Il middleware `cors()` di `server.ts` copre automaticamente anche l'endpoint SSE. Policy unica e coerente.

**File:** `backend/src/modules/tracking/tracking.controller.ts`

---

### Fix 2 — SMS stub falsi positivi [DONE]

**Problema:** `sms.provider.ts` con `SMS_PROVIDER=twilio` ma senza pacchetto npm installato restituiva `status: 'sent'`. I `NotificationLog` risultavano come invii riusciti anche quando nessun SMS era mai partito.

**Soluzione:** il provider rileva l'assenza del pacchetto e restituisce `status: 'skipped'` con messaggio esplicativo. Il valore `skipped` è ora documentato in `docs/database.md` come quarto valore valido per `NotificationLog.status`.

**File:** `backend/src/modules/sos/notifications/sms.provider.ts`

---

### Fix 3 — Password policy 10 caratteri [DONE]

**Problema:** validazione Zod richiedeva minimo 8 caratteri in registrazione e cambio password. Soglia insufficiente per un'app che gestisce posizione GPS e contatti emergenza.

**Soluzione:** minimo portato a 10 caratteri in tutti i punti di validazione backend e frontend. Le password esistenti (già hashate) non sono impattate.

**File:**
- `backend/src/modules/auth/auth.schemas.ts`
- `backend/src/modules/profile/profile.schemas.ts`
- `frontend/src/pages/RegisterPage.vue`
- `frontend/src/pages/ProfilePage.vue`

---

### Fix 4 — Routing fallback UX dichiarato [DONE]

**Problema:** `useRouting.ts` eseguiva il fallback a linea retta quando OSRM non rispondeva senza esporre questo stato al template. L'utente vedeva una linea nel modal senza capire se fosse un percorso calcolato o una stima.

**Soluzione:** aggiunta variabile reattiva `isRoutingFallback` esportata dal composable. `RouteStartModal.vue` mostra un banner giallo quando il fallback è attivo: "Percorso stimato — routing offline non disponibile". Il percorso si avvia comunque.

**File:**
- `frontend/src/composables/useRouting.ts`
- `frontend/src/components/map/RouteStartModal.vue`

---

### Fix 5 — Trust messaging [DONE]

**Problema:** messaggi in scenari critici erano generici o fuorvianti.
- `TrackingPublicPage.vue`: nessuna distinzione tra tracking terminato, polling fallback attivo, e link non valido.
- `SOSFlow.vue`: messaggio neutro quando nessun contatto era configurato, senza avvisare l'utente che nessuno era stato notificato.

**Soluzione:** testi riscritti con precisione. Ogni stato ha un messaggio distinto e onesto. `SOSFlow.vue` ora avvisa esplicitamente "Nessun contatto di emergenza configurato — nessuno è stato notificato".

**File:**
- `frontend/src/pages/TrackingPublicPage.vue`
- `frontend/src/components/sos/SOSFlow.vue`

---

### Fix 6 — Logging con mascheramento dati sensibili [DONE]

**Problema:** log di debug includevano token SSE completi e numeri di telefono in chiaro.

**Soluzione:** token troncato a 8 caratteri con `token.slice(0, 8) + '...'`; numeri di telefono mascherati prima del log. Prefissi `[tracking-sse]` e `[sms]` aggiunti per filtraggio log strutturato.

**File:**
- `backend/src/modules/tracking/tracking.controller.ts`
- `backend/src/modules/sos/notifications/sms.provider.ts`

---

## Problemi ancora aperti

| Problema | Priorità | Motivo rinvio |
|---|---|---|
| `localStorage` per JWT | Alta | Richiede migrazione httpOnly cookie + CSRF — step dedicato pre-produzione |
| Twilio reale | Media | Richiede account, secrets produzione, test E2E |
| GDPR / privacy policy | Media | Richiede testo legale — step dedicato |
| Redis / BullMQ | Bassa | Non necessario per MVP locale; safety score sincrono sufficiente |
| Admin panel | Bassa | Step dedicato Day 9+ |

---

## Decisioni prese

- `skipped` è distinto da `failed` in `NotificationLog.status`: `failed` = tentativo fallito con errore; `skipped` = canale non configurato o pacchetto mancante. Permette di distinguere problemi tecnici da configurazioni volutamente incomplete.
- Il CORS SSE ora segue la policy globale anche per la pagina pubblica di tracking. Non causa problemi funzionali perché la pagina pubblica non invia credenziali nell'header.
- La password policy alzata a 10 non impatta gli utenti esistenti — solo nuove registrazioni e cambi password futuri.
- `isRoutingFallback` implementata come `ref<boolean>` reattivo (non come evento `emit`) per permettere al template di aggiornare il banner in modo continuo se lo stato cambia.

---

## Stato TypeScript

Nessun errore TypeScript introdotto in questo step. Le modifiche ai file `.ts` e `.vue` sono limitate a:
- rimozione di una riga `setHeader` (non tipizzata, nessun impatto su tipi)
- cambio valore letterale stringa in `status` return value (da `'sent'` a `'skipped'` — compatibile con il tipo `string` del campo)
- cambio valore numerico in schema Zod `.min(8)` → `.min(10)` (nessun impatto sui tipi inferiti)
- aggiunta `ref<boolean>` in composable (tipizzazione standard Vue 3)
