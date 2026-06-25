# SafeRoute Backend

API REST Express + TypeScript per SafeRoute.

## Setup sviluppo locale

### 1. Requisiti
- Node.js >= 20
- MariaDB >= 10.6 (o MySQL 8) in esecuzione su porta 3306
- npm

### 2. Variabili d'ambiente
```bash
cp .env.example .env
# Modifica .env con le tue credenziali MariaDB e scegli JWT secrets sicuri
```

### 3. Prima installazione
```bash
npm install
npm run db:push      # Crea le tabelle (MariaDB deve essere avviato)
npm run db:seed      # Popola dati iniziali (AppSettings, city Milano, 5 zone demo)
```

### 4. Avvio
```bash
npm run dev          # Avvia su http://localhost:3000
```

### 5. Verifica
Apri http://localhost:3000/api/health — deve rispondere:
```json
{ "success": true, "data": { "message": "SafeRoute API online", "services": { "database": "ok" } } }
```

Se `database` è `"unavailable"`, verifica che MariaDB sia avviato e che DATABASE_URL sia corretto.

### 6. TypeScript check
```bash
npm run typecheck    # Equivalente a npx tsc --noEmit
```

### 7. Note sviluppo

- Rate limit auth: in development è 100 req/ora (produzione: 10 req/ora)
- I token mock (che iniziano con `mock_`) vengono rifiutati dal backend con 401 — questo è corretto
- Seed crea la city di Milano con 5 zone demo; non crea utenti (registra il primo utente tramite API o UI)
- Zod schema contatti: stringhe vuote `""` sono falsy e vengono normalizzate a `null` nel service (`phone: phone || null`); il refine `.refine(data => data.phone || data.email)` si comporta correttamente

## Script disponibili

| Comando | Descrizione |
|---|---|
| `npm run dev` | Avvia in watch mode (tsx) |
| `npm run build` | Compila TypeScript in `dist/` |
| `npm run typecheck` | Controlla tipi senza compilare |
| `npm start` | Avvia da `dist/server.js` (produzione) |
| `npm run db:push` | Sincronizza schema Prisma al DB |
| `npm run db:migrate` | Crea e applica una migration |
| `npm run db:seed` | Esegue il seed iniziale |
| `npm run db:studio` | Apre Prisma Studio |
