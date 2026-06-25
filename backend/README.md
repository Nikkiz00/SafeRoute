# SafeRoute Backend

API REST in Node.js + Express + TypeScript + Prisma + MariaDB.

## Prerequisiti

- Node.js >= 20
- MariaDB >= 10.6 (o MySQL 8)

## Setup

1. Copia le variabili d'ambiente:
   ```bash
   cp .env.example .env
   ```

2. Modifica `.env` con le tue credenziali MariaDB

3. Installa dipendenze:
   ```bash
   npm install
   ```

4. Genera il Prisma client:
   ```bash
   npm run db:generate
   ```

5. Crea le tabelle:
   ```bash
   npm run db:push
   ```

6. Popola il database con dati iniziali:
   ```bash
   npm run db:seed
   ```

7. Avvia il server:
   ```bash
   npm run dev
   ```

## Endpoints

### Health
- `GET /api/health` — stato del server e database

### Auth
- `POST /api/auth/register` — registrazione (name, email, password)
- `POST /api/auth/login` — login (email, password)
- `POST /api/auth/refresh` — rinnova access token (refreshToken in body)
- `POST /api/auth/logout` — logout (refreshToken in body)
- `GET /api/auth/me` — utente corrente (richiede Bearer token)

### OAuth (placeholder)
- `GET /api/auth/google` — non ancora implementato
- `GET /api/auth/apple` — non ancora implementato

### Profile
- `GET /api/profile` — profilo utente corrente (richiede Bearer token)
- `PATCH /api/profile` — aggiorna nome
- `PATCH /api/profile/onboarding` — segna onboarding come completato

### Emergency Contacts
- `GET /api/emergency-contacts` — lista contatti dell'utente
- `POST /api/emergency-contacts` — crea contatto (limite: FREE=2, PREMIUM=5)
- `PATCH /api/emergency-contacts/:id` — aggiorna contatto
- `DELETE /api/emergency-contacts/:id` — elimina contatto

## Struttura

```
src/
├── config/
│   ├── database.ts       # Prisma client singleton
│   └── env.ts            # Validazione variabili d'ambiente
├── middleware/
│   ├── auth.middleware.ts
│   ├── role.middleware.ts
│   └── validate.middleware.ts
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.routes.ts
│   │   ├── auth.schemas.ts
│   │   └── auth.service.ts
│   └── health/
│       └── health.routes.ts
├── utils/
│   ├── hash.utils.ts
│   ├── jwt.utils.ts
│   └── response.utils.ts
└── server.ts
```

## Schema database

Vedere `prisma/schema.prisma` per lo schema completo.
Tabelle principali: users, refresh_tokens, emergency_contacts, cities, zones,
route_sessions, location_pings, safety_feedback, reports, sos_events,
live_tracking_sessions, admin_settings, ai_settings, audit_logs.

## Note importanti

- Il backend gira su port 3000 di default
- MariaDB deve essere avviato prima del server
- Il server parte anche senza DB ma risponde allo health check con `db: unavailable`
- Le API key non vengono mai salvate nel database
- I refresh token sono salvati come hash SHA-256, non in chiaro
