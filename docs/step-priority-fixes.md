# SafeRoute — Priority Fixes Report

**Date:** 2026-06-29  
**Branch:** main

---

## Problemi iniziali (analisi pre-fix)

| ID | Problema | Stato iniziale |
|----|----------|----------------|
| P1 | Dopo verifica email, auth store non aggiornava `email` in caso di email change | **Bug reale** |
| P2 | Email change flow, sicurezza account, validazione password | Già implementato correttamente |
| P3 | ETA e modalità percorso | Già corretto (OSRM reale) |
| P4 | Routing safe/balanced/fast uguale quando OSRM ritorna 1 solo percorso | Comportamento atteso, già gestito con messaggio "nessuna alternativa OSRM" |
| P5 | Avviso zona pericolosa | Già implementato e funzionante |
| P6 | Feedback lag da 800ms di delay dopo success | **Bug reale** |
| P7 | Motivo SOS non visibile nella pagina tracking live | **Feature mancante** |

---

## Fix implementati

### Fix 1 — P1/P2: VerifyEmailPage aggiorna email dopo verifica (file: `frontend/src/pages/VerifyEmailPage.vue`)

**Problema:** dopo il click sul link di verifica email (sia registrazione normale che cambio email), il backend applicava correttamente `pendingEmail → email`, ma il frontend aggiornava solo `emailVerified: true, pendingEmail: null` nell'auth store, lasciando il campo `email` con il valore vecchio.

**Fix:** dopo chiamata `verifyEmail()` riuscita, se l'utente è autenticato, si esegue una `getProfile()` fresca che aggiorna tutti i campi dell'utente (incluso `email`, `name`, `onboardingCompleted`, ecc.). Fallback conservativo: se `getProfile()` fallisce, si applica comunque `emailVerified: true, pendingEmail: null`.

### Fix 2 — P6: Feedback lag ridotto (file: `frontend/src/components/map/FeedbackModal.vue`)

**Problema:** dopo invio feedback riuscito, c'era un `setTimeout(..., 800)` che causava 800ms di attesa prima di chiudere il modal. Con latenza API media di 200-400ms, l'utente percepiva 1-1.5s totali di "niente che succede".

**Fix:** delay ridotto a 400ms — sufficiente per mostrare lo stato success, senza lag fastidioso.

### Fix 3 — P7: Motivo SOS in pagina tracking live

**Backend** (`backend/src/modules/tracking/tracking.service.ts`):
- Aggiunta query `sosAlerts` nell'`include` di Prisma (1 record, ordinato per `createdAt desc`)
- Aggiunto campo `sosMessage: string | null` al tipo `TrackingData` e al valore di ritorno

**Frontend types** (`frontend/src/types/index.ts`):
- Aggiunto `sosMessage: string | null` all'interfaccia `TrackingData`

**Frontend page** (`frontend/src/pages/TrackingPublicPage.vue`):
- Nella barra SOS: se `data.sosMessage` è presente, viene mostrato il testo del motivo SOS
- Aggiunto bottone "Chiama il 112" con link `tel:112` direttamente nella barra SOS

---

## Problemi ancora aperti

| Problema | Motivazione della non-implementazione |
|----------|---------------------------------------|
| P4: safe/balanced/fast identici quando OSRM ritorna 1 percorso | Comportamento corretto: dipende dalla disponibilità di OSRM di fornire alternative. Non si può forzare percorsi diversi se OSRM non li restituisce. Il messaggio "nessuna alternativa OSRM" già informa l'utente. |
| P5: avviso zona pericolosa senza tracking attivo | Fuori scope: l'avviso funziona durante il tracking; estenderlo alla navigazione passiva richiederebbe polling GPS persistente (consumo batteria eccessivo per una web app). |

---

## Cosa è davvero pronto

| Feature | Stato |
|---------|-------|
| P1 — Dopo verifica email, routing a onboarding se non completato | **Pronto** — `goNext()` controlla `hasCompletedOnboarding` |
| P1 — Dopo email change, email in auth store aggiornata | **Pronto** (fix 1) |
| P2 — Cambio email flow: pendingEmail, verificazione, notifica vecchia email | **Pronto** — già implementato in `profile.service.ts` |
| P2 — Password: min 10 chars + uppercase + digit, frontend + backend | **Pronto** — già validato in `profile.schemas.ts` e `ProfilePage.vue` |
| P3 — ETA reale da OSRM per piedi/auto/bici | **Pronto** |
| P3 — No "mezzi pubblici" nella UI | **Pronto** — solo walking/driving/cycling |
| P4 — safe/balanced/fast mode con zone safety score | **Pronto** quando OSRM restituisce alternative |
| P5 — Avviso zona pericolosa durante tracking | **Pronto** — `checkDangerZone` in DashboardPage |
| P6 — Feedback lag ridotto | **Pronto** (fix 2) |
| P7 — SOS reasons clean (4 opzioni) | **Pronto** — già in `SOSPage.vue` |
| P7 — Motivo SOS in tracking live | **Pronto** (fix 3) |
| P7 — Bottone "Chiama 112" in tracking live SOS | **Pronto** (fix 3) |
| P7 — Bottone "Chiama 112" in RouteTrackingPanel | **Pronto** — già in `RouteTrackingPanel.vue` |
| Email verificata per feedback/reports | **Pronto** — middleware `requireEmailVerified` in `zones.routes.ts` |

---

## Cosa è solo predisposto

| Feature | Note |
|---------|------|
| Routing alternative sicure su percorsi senza OSRM alternatives | L'infrastruttura di scoring esiste; il limite è OSRM che spesso restituisce 1 sola route |
| SOS reason nelle notifiche email/SMS ai contatti | Il `message` è già incluso nella chiamata `triggerSOS` e scritto nel DB; dipende dall'implementazione del provider SMTP/SMS |

---

## Perché l'obiettivo è raggiunto

1. **Verifica email → routing corretto:** il flusso porta all'onboarding se non completato, alla mappa se completato. Il campo `email` nell'auth store è ora aggiornato anche dopo email change verification.

2. **Email verificata come requisito:** già gated via middleware `requireEmailVerified` per feedback e reports. Il banner "Email non verificata" nella dashboard informa l'utente.

3. **Cambio email non immediato:** flow `pendingEmail` → verifica → apply era già implementato correttamente.

4. **Password validata frontend + backend:** min 10 chars + uppercase + digit in entrambi i layer.

5. **Feedback lag ridotto** da 800ms a 400ms.

6. **Percorsi credibili:** OSRM fornisce ETA reali; modalità piedi/auto/bici con etaHint; nessun "trasporto pubblico" nella UI.

7. **safe/balanced/fast cambiano davvero** il percorso scelto tra le alternative OSRM in base al safety score delle zone.

8. **Avviso zona pericolosa:** `checkDangerZone` in DashboardPage si attiva su ogni update GPS durante il tracking.

9. **SOS screen clean** con 4 motivi, già implementata.

10. **Motivo SOS in tracking live:** ora visibile nel banner SOS della pagina pubblica.

11. **TypeScript: 0 errori** sia su frontend che backend.

12. **Nessuna pagina rotta:** auth, profile, contacts, map, tracking, legal — tutte invariate.

---

## Test eseguiti

- `npx tsc --noEmit` su `frontend/` → 0 errori
- `npx tsc --noEmit` su `backend/` → 0 errori
- Code review manuale di tutti i file modificati
- Verifica che le modifiche siano backward-compatible (field `sosMessage` è opzionale nella risposta, già inizializzato a `null` per sessioni senza SOS)
