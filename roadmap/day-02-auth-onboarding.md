# Day 02 - Auth + Onboarding

## PRD da leggere
- `prd/01-auth-onboarding.md`

## Agent principali
- backend-agent
- frontend-agent
- uiux-agent

## Task
1. Modelli User/EmergencyContact.
2. Register/login/logout.
3. JWT persistente.
4. Middleware auth.
5. Pagine login/register.
6. Onboarding mobile-first.
7. Contatti emergenza con limiti FREE/PREMIUM.

## Output
- Utente registrato e loggato;
- onboarding completabile;
- contatti salvabili;
- commit: `feat: add auth and onboarding`.

## Completato (backend-agent — 2026-06-21)

### File creati

```
backend/package.json               — dipendenze complete (Express, Prisma, JWT, Zod, bcrypt...)
backend/tsconfig.json              — ES2022, moduleResolution bundler, path alias @/*
backend/prisma/schema.prisma       — schema completo (User, RefreshToken, Zone, RouteSession, SOS...)
backend/prisma/seed.ts             — seed AppSettings + AISetting + City Milano + 5 zone demo
backend/src/config/database.ts     — Prisma client singleton
backend/src/config/env.ts          — validazione env con Zod al boot
backend/src/utils/jwt.utils.ts     — signAccessToken, verifyAccessToken, generateRefreshToken, hashToken
backend/src/utils/hash.utils.ts    — hashPassword, comparePassword (bcrypt 12 rounds)
backend/src/utils/response.utils.ts — sendSuccess, sendError
backend/src/middleware/auth.middleware.ts   — requireAuth (Bearer JWT)
backend/src/middleware/role.middleware.ts   — requireRole(...roles)
backend/src/middleware/validate.middleware.ts — validate(ZodSchema)
backend/src/modules/auth/auth.schemas.ts   — registerSchema, loginSchema
backend/src/modules/auth/auth.service.ts   — registerUser, loginUser, refreshTokens, logoutUser, getMe
backend/src/modules/auth/auth.controller.ts — register, login, refresh, logout, me
backend/src/modules/auth/auth.routes.ts    — router /register /login /refresh /logout /me
backend/src/modules/health/health.routes.ts — GET /api/health con db check
backend/src/server.ts              — server Express con CORS, rate limiting, routes
backend/README.md                  — istruzioni setup e avvio
```

### Stato npm install
- 171 pacchetti installati senza errori
- 2 vulnerabilita high severity (dipendenze transitive deprecate, non bloccanti)

### Stato tsc --noEmit
- 0 errori TypeScript

### Avvio backend con MariaDB

1. Assicurarsi che MariaDB sia in esecuzione sulla porta 3306
2. Creare il database: `CREATE DATABASE saferoute;`
3. Copiare `.env.example` in `.env` e compilare le credenziali
4. Eseguire in ordine:
   ```bash
   npm run db:generate   # gia eseguito
   npm run db:push       # crea le tabelle nel DB
   npm run db:seed       # popola AppSettings + zone Milano
   npm run dev           # avvia il server su port 3000
   ```
5. Verificare: `GET http://localhost:3000/api/health`

### Note tecniche
- Token rotation implementata: ogni refresh revoca il vecchio token e ne emette uno nuovo
- Refresh token salvati come SHA-256 hash, mai in chiaro
- Access token: 15 min | Refresh token: 30 giorni
- Health endpoint risponde anche senza DB (db: "unavailable")
- Rate limit auth: 10 req/ora per IP
- `prisma db push` e `db:seed` NON eseguiti (richiedono MariaDB attivo)

## Completato (architect-agent — 2026-06-21)

### Verifiche effettuate

1. **Coerenza Prisma schema ↔ `frontend/src/types/index.ts`** — confronto campo per campo su User, EmergencyContact, Zone, RouteSession, SOSAlert.
2. **Limiti piano FREE/PREMIUM** — verifica seed.ts vs frontend store contacts.ts.
3. **Rate limiting** — verifica server.ts vs docs/architecture.md.
4. **AppSetting keys** — verifica seed.ts vs docs/database.md.
5. **Campo `geometryJson`** — verifica nome nel Prisma vs documentazione vs frontend.
6. **Modello `AISetting`** — verifica presenza nella documentazione.

### Discrepanze trovate e risolte

| # | Discrepanza | Risoluzione |
|---|---|---|
| 1 | `docs/database.md` conteneva `OLLAMA_BASE_URL` tra le chiavi AppSetting, ma questa chiave non esiste nel seed né nello schema Prisma — `baseUrl` è un campo del modello `AISetting` separato | Rimossa `OLLAMA_BASE_URL` dalla tabella AppSetting; aggiunta nota esplicativa e documentazione del modello `AISetting` |
| 2 | `docs/database.md` non documentava il modello `AISetting` (presente in schema.prisma riga 289–298) | Aggiunta sezione `### AISetting` con tutti i campi e note semantiche |
| 3 | `docs/database.md` non spiegava la differenza tra `Zone.geometryJson` (DB) e `Zone.geometry` (API/frontend) | Aggiunta sezione `## API Layer Mapping` con tutte le trasformazioni DB → API |
| 4 | `docs/architecture.md` documentava il rate limiting in modo incompleto: mancavano i valori globali (200 req/15 min) e non distingueva chiaramente i due livelli implementati in server.ts | Aggiunta sezione `## Rate Limiting` con tabella precisa dei valori da server.ts |
| 5 | `docs/architecture.md` menziononava la regola AI key nella sezione Sicurezza ma non nella sezione Rate Limiting dove si introduce `AISetting` | Aggiunta nota esplicita nella nuova sezione Rate Limiting |

### Cose verificate e già coerenti (nessuna modifica necessaria)

- **Limiti emergenza FREE/PREMIUM**: seed.ts (`FREE: 2`, `PREMIUM: 5`) coincide con `frontend/src/stores/contacts.ts` (linea 12: `return auth.user?.plan === 'PREMIUM' ? 5 : 2`) e con `docs/database.md`.
- **User Prisma ↔ frontend `User`**: tutti i campi del DB (`id`, `name`, `email`, `role`, `plan`, `onboardingCompleted`, `createdAt`, `deletedAt`, `provider`) hanno corrispondenza nel frontend. I campi extra del frontend (`geolocationGranted`, `avatarInitials`) sono correttamente solo-client (non DB).
- **EmergencyContact Prisma ↔ frontend**: tutti i campi coincidono (`id`, `userId`, `name`, `phone`, `email`, `isPrimary`, `notifiedOnAdd`, `createdAt`).
- **Rate limit auth 10 req/ora**: già correttamente documentato nelle note backend-agent; ora formalizzato in architecture.md.
- **`geometryJson` nel seed**: il seed usa correttamente `geometryJson` come nome campo, allineato al Prisma schema.

### Rischi tecnici da tenere d'occhio

1. **`SOSAlert.status` — divergenza semantica**: Prisma usa `String` con default `"active"`, il frontend usa il tipo unione `'pending' | 'sent' | 'cancelled' | 'false_alarm'`. Il layer API dovrà fare una validazione esplicita prima di restituire i valori, altrimenti il frontend potrebbe ricevere stringhe non previste.
2. **`RouteSession` — coordinate piatte vs oggetti strutturati**: il DB ha `startLat/startLng/endLat/endLng/endedAt`, il frontend si aspetta `origin`, `destination`, `completedAt`. La trasformazione deve essere implementata esplicitamente nell'API controller quando quel modulo verrà sviluppato.
3. **`AISetting` — riga singleton**: il seed crea sempre una riga con `id: "default"`. Nessun meccanismo impedisce la creazione di righe aggiuntive a livello DB. Il controller AI dovrà usare `findFirst` o imporre questo vincolo a livello applicativo.

### Stato complessivo della coerenza

**Buono** — il backend Prisma schema è ben progettato e allineato alla documentazione nelle parti principali. Le discrepanze trovate erano di documentazione (non di codice) e sono state tutte risolte. Nessuna modifica a schema Prisma, codice TypeScript o file di configurazione è stata necessaria.

## Completato (frontend-agent — 2026-06-21)

### File creati

```
frontend/src/api/client.ts     — fetch wrapper con auto-refresh JWT, ApiError, api.get/post/delete
frontend/src/api/auth.ts       — funzioni register, login, me, logout per /api/auth/*
frontend/src/api/index.ts      — barrel export (api, ApiError, authApi)
```

### File modificati

```
frontend/src/pages/OnboardingPage.vue
  — totalSteps 5 → 6
  — Aggiunto Step 2 "Capire la mappa" (zone pills 2×2 con colori e score range)
  — Step geo: currentStep 2 → 3, key step2 → step3
  — Step contatti: currentStep 3 → 4, key step3 → step4
  — Step SOS: currentStep 4 → 5, key step4 → step5 (contenuto invariato)
  — Step pronto: currentStep 5 → 6, key step5 → step6

frontend/src/pages/DashboardPage.vue
  — Aggiunto const isDev = import.meta.env.DEV
  — Badge <DEV> inline nel welcome banner (solo in development)

frontend/src/pages/LoginPage.vue
  — Aggiunto const isDev = import.meta.env.DEV
  — Container demo buttons wrappato in v-if="isDev" (nascosti in produzione)

frontend/src/pages/admin/AdminDashboardPage.vue
  — Aggiunto const isDev = import.meta.env.DEV
  — Banner DEV mock data sopra il contenuto principale (solo in development)
```

### Note tecniche
- Il layer API è scaffolding per Day 3 — lo store auth.ts rimane mock
- localStorage keys: `sr_access_token` / `sr_refresh_token`
- Logica refresh: 401 → POST /api/auth/refresh → salva nuovi token → riprova request originale
- Se refresh fallisce, entrambe le chiavi vengono rimosse e viene lanciato ApiError(401)
- Il file frontend/.env.example era già presente con VITE_API_URL (nessuna modifica necessaria)
- Demo shortcuts nella LoginPage rimangono visibili in development (import.meta.env.DEV = true con Vite dev server)
