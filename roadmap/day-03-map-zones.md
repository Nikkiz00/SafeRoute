# Day 03 - Map + Zones

## PRD da leggere
- `prd/02-map-zones.md`

## Agent principali
- maps-agent
- frontend-agent
- backend-agent

## Task
1. Integrare Leaflet.
2. Mostrare posizione utente.
3. Creare modelli City/Zone.
4. Seed zone da JSON.
5. API zone attive.
6. Colorare zone sulla mappa.
7. Click zona con dettagli.

## Output
- Mappa funzionante;
- zone colorate;
- seed pronto;
- commit: `feat: add interactive map and safety zones`.

## Completato - backend-agent (2026-06-21)

### File modificati
- `backend/src/modules/auth/auth.service.ts` — rimossi dynamic import, aggiunto `hashToken` all'import statico

### File creati
- `backend/src/modules/contacts/contacts.schemas.ts` — schema Zod per create/update contatti
- `backend/src/modules/contacts/contacts.service.ts` — logica business contatti con limite per piano
- `backend/src/modules/contacts/contacts.controller.ts` — controller list/create/update/remove
- `backend/src/modules/contacts/contacts.routes.ts` — route `/api/emergency-contacts`
- `backend/src/modules/profile/profile.schemas.ts` — schema Zod per update profilo
- `backend/src/modules/profile/profile.service.ts` — logica business getProfile/updateProfile/completeOnboarding
- `backend/src/modules/profile/profile.controller.ts` — controller getProfile/updateProfile/completeOnboarding
- `backend/src/modules/profile/profile.routes.ts` — route `/api/profile`

### File aggiornati
- `backend/src/server.ts` — aggiunte route `/api/emergency-contacts` e `/api/profile`
- `backend/README.md` — aggiunti endpoint Profile ed Emergency Contacts

### Verifica TypeScript
`npx tsc --noEmit` — nessun errore

## Completato - frontend-agent (2026-06-21)

### File creati
- `frontend/src/api/contacts.ts` — API client per emergency contacts (list/create/update/delete)
- `frontend/src/api/profile.ts` — API client per profilo (getProfile/updateProfile/completeOnboarding)

### File modificati
- `frontend/src/api/client.ts` — aggiunto metodo `api.patch<T>()`
- `frontend/src/api/index.ts` — aggiunte esportazioni `contactsApi` e `profileApi`
- `frontend/src/stores/auth.ts` — riscritto completamente: API reale, token `sr_access_token`/`sr_refresh_token`, `init()`, `isInitialized`, `isLoading`, mock shortcuts `loginAsMockUser`/`loginAsMockAdmin`
- `frontend/src/stores/contacts.ts` — riscritto completamente: API reale, `fetchContacts()`, `add()`/`remove()`/`setPrimary()` asincroni, `isLoading`, `error`, rimossa dipendenza da `mockEmergencyContacts`
- `frontend/src/pages/LoginPage.vue` — `handleSubmit` usa `await auth.login()` reale, rimosse mock sleep, demo buttons aggiornati a `loginAsMockUser`/`loginAsMockAdmin`
- `frontend/src/pages/RegisterPage.vue` — `handleSubmit` usa `await auth.register()` con password, aggiunto `errorMessage` ref e display errore nel template, rimossa mock sleep
- `frontend/src/pages/OnboardingPage.vue` — `saveContact()` e `finish()` diventano async, usano API reali
- `frontend/src/pages/ContactsPage.vue` — aggiunto `onMounted` per `fetchContacts()`, `handleSave()` diventa async, aggiunti stati loading/error nel template
- `frontend/src/router/index.ts` — guard aggiornato ad async con `auth.init()` al primo avvio, redirect `/onboarding`, protezione onboarding non completato

### Flusso funzionante
`register` → API reale → token salvati → `/onboarding` → `completeOnboarding()` PATCH → `/map`
`login` → API reale → token salvati → `/map` o `/onboarding` se non completato
`/contacts` → `fetchContacts()` on mount → lista reale dal backend

## Nota: Day 3 ridefinito

Il Day 3 originale prevedeva mappa+zone. Per garantire una base solida, il Day 3 è stato dedicato al completamento del collegamento frontend↔backend per auth, onboarding e contatti emergenza.

Le attività mappa+zone sono spostate al Day 4.
