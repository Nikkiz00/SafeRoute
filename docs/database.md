# Database - SafeRoute

Database: MariaDB con Prisma ORM.

## Entità principali

### User
- id
- name
- email (unique)
- passwordHash
- provider: `email` / `google` / `apple`
- role: `USER` / `ADMIN` / `STAFF` / `FAMILY`
- plan: `FREE` / `PREMIUM`
- onboardingCompleted (boolean, default false)
- createdAt
- updatedAt
- deletedAt (nullable — soft delete per GDPR)
- emailVerified (boolean, default false — aggiunto Day 7.6)
- emailVerifiedAt (nullable DateTime — aggiunto Day 7.6)

**Ruoli:**
- `USER`: utente standard, accesso completo alle funzioni app;
- `ADMIN`: accesso a `/admin`, può modificare zone, approvare segnalazioni, gestire settings;
- `STAFF`: accesso limitato a `/admin` (solo visualizzazione SOS attivi e segnalazioni, nessun accesso a dati utente);
- `FAMILY`: identico a USER ma può essere aggiunto come contatto emergenza con accesso al tracking live tramite token.

**Soft delete**: un utente con `deletedAt != null` è considerato cancellato. Tutte le query devono filtrare `WHERE deletedAt IS NULL`. I dati correlati (LocationPing, ZoneFeedback) vengono anonimizzati entro 30 giorni dalla cancellazione tramite job schedulato.

---

### RefreshToken
- id
- userId
- tokenHash (hash SHA-256 del token — non salvare il token in chiaro)
- expiresAt
- revokedAt (nullable)
- createdAt

Al logout viene settato `revokedAt`. Al refresh viene verificato che `revokedAt IS NULL` e `expiresAt > NOW()`. Ogni refresh emette un nuovo token e revoca il vecchio (token rotation).

Durata consigliata:
- access token JWT: 15 minuti;
- refresh token: 30 giorni.

---

### EmergencyContact
- id
- userId
- name
- phone (nullable)
- email (nullable)
- isPrimary
- notifiedOnAdd (boolean — se l'utente ha scelto di inviare un messaggio di benvenuto al contatto)
- createdAt

**Vincolo**: almeno uno tra `phone` e `email` deve essere non null. Validazione a livello applicazione (Zod) e idealmente constraint DB: `CHECK (phone IS NOT NULL OR email IS NOT NULL)`.

Max contatti:
- FREE: 2;
- PREMIUM: 5.

---

### City
- id
- name
- province
- region
- country
- isActive

---

### Zone
- id
- cityId
- name
- type: `district` / `single_area`
- geometryJson (GeoJSON Polygon o MultiPolygon)
- isServiceActive
- safetyScore (nullable — null significa dati insufficienti)
- updatedAt

**Il colore della zona si deriva a runtime da `safetyScore`** — non esiste un campo `colorStatus` nel database. La mappatura è definita in `docs/architecture.md`.

I contatori `reportsCount30d`, `sosCount30d`, `feedbackCount30d` **non vengono persisti**: vengono calcolati con query aggregate al momento della richiesta e cachati in Redis per 5 minuti. Questo evita race condition e valori stale.

---

### RouteSession
- id
- userId
- status: `active` / `completed` / `cancelled` / `sos`
- startLat
- startLng
- endLat (nullable — destinazione opzionale)
- endLng (nullable)
- startedAt
- endedAt (nullable)
- trackingToken (stringa random 256-bit, generata con `crypto.randomBytes(32)`)
- trackingTokenExpiresAt (default: startedAt + 24 ore, configurabile in AppSetting)
- shareEnabled
- destinationName (nullable — nome leggibile destinazione, aggiunto Day 7.6)

---

### LocationPing
- id
- routeSessionId
- lat
- lng
- accuracy (nullable — precisione GPS in metri)
- createdAt

**Retention policy**: i ping di sessioni con status `completed`, `cancelled` o `sos` risolto vengono eliminati dopo 7 giorni (configurabile in AppSetting `LOCATION_PING_RETENTION_DAYS`). Per sessioni SOS con status `active` o `resolved` i ping sono conservati 90 giorni a scopo di analisi sicurezza.

---

### ZoneFeedback
- id
- userId
- zoneId
- routeSessionId (nullable)
- rating: intero 1–5
- note (nullable, max 500 caratteri)
- createdAt

**Nota su `feeling`**: il campo `feeling` (enum testuale) è stato rimosso perché duplicava semanticamente `rating`. La scala numerica 1–5 è sufficiente e univoca:
- 1 = molto insicuro;
- 2 = insicuro;
- 3 = neutro;
- 4 = sicuro;
- 5 = molto sicuro.

**Regola anti-abuso**: stesso utente può influenzare una stessa zona massimo 1 volta ogni 30 giorni, salvo SOS. La verifica avviene tramite query su `ZoneFeedback WHERE userId = ? AND zoneId = ? AND createdAt > NOW() - INTERVAL 30 DAY`. Nessun campo denormalizzato necessario.

---

### Report
- id
- userId (nullable — segnalazione anonima possibile)
- zoneId
- category: enum `lighting` / `aggression` / `theft` / `vandalism` / `drug_activity` / `harassment` / `unsafe_road` / `other`
- description (nullable, max 1000 caratteri)
- createdAt
- status: `pending` / `approved` / `rejected`

**Accesso**: pubblico vede solo category + zone + status. Admin vede anche userId e description completa.

**Rate limiting**: max 5 segnalazioni per IP ogni 15 minuti (applicato a livello middleware — vedi `docs/architecture.md`).

---

### SOSAlert
- id
- userId
- routeSessionId (nullable)
- lat
- lng
- message (nullable — l'utente può inviare SOS senza testo)
- status: `active` / `resolved` / `false_alarm`
- createdAt
- resolvedAt (nullable)
- resolvedFeedback (nullable — `false_alarm` / `real_danger` / `other`)

---

### NotificationLog
- id
- userId
- sosAlertId (nullable)
- channel: `email` / `sms`
- recipient (email o numero oscurato nei log pubblici)
- status: `sent` / `failed` / `pending` / `skipped`
- provider
- errorMessage (nullable — dettaglio errore in caso di fallimento)
- createdAt

**Valori `status`:**
- `sent` — notifica inviata con successo dal provider
- `failed` — tentativo fallito (errore provider o rete)
- `pending` — in attesa di elaborazione
- `skipped` — notifica saltata intenzionalmente (es. `SMS_PROVIDER=twilio` ma pacchetto npm non installato, o provider `none`). Non è un errore: indica che il canale non era configurato o disponibile in questo ambiente.

---

### AdminAuditLog
- id
- adminId (userId dell'admin che ha eseguito l'azione)
- action: `zone_score_override` / `report_approve` / `report_reject` / `user_role_change` / `settings_change` / `sos_resolve`
- targetType: `zone` / `report` / `user` / `sos_alert` / `setting`
- targetId
- previousValue (JSON nullable — valore prima della modifica)
- newValue (JSON nullable — valore dopo la modifica)
- createdAt

Questa tabella è in sola scrittura — nessuna modifica o cancellazione è consentita dall'applicazione. Serve per accountability GDPR e audit di sicurezza.

---

### AppSetting
- key (primary key)
- valueJson

Chiavi previste (allineate al seed `backend/prisma/seed.ts`):

| Key | Tipo | Default |
|---|---|---|
| `AI_ENABLED` | boolean | false |
| `AI_PROVIDER` | string | `none` |
| `AI_MODEL` | string | null |
| `SMS_PROVIDER` | string | `none` |
| `EMAIL_PROVIDER` | string | `smtp` |
| `TRACKING_MAX_DURATION_HOURS` | number | 24 |
| `LOCATION_PING_INTERVAL_SECONDS` | number | 15 |
| `LOCATION_PING_RETENTION_DAYS` | number | 7 |
| `FREE_MAX_EMERGENCY_CONTACTS` | number | 2 |
| `PREMIUM_MAX_EMERGENCY_CONTACTS` | number | 5 |
| `FREE_MAX_ROUTE_HISTORY_DAYS` | number | 30 |
| `PREMIUM_MAX_ROUTE_HISTORY_DAYS` | number | 365 |

**Nota**: la chiave `OLLAMA_BASE_URL` non fa parte di `AppSetting`. Il campo `baseUrl` per Ollama è invece gestito dal modello separato `AISetting` (vedi sotto).

**Fonte di verità**: le impostazioni in `AppSetting` sovrascrivono le variabili d'ambiente per le configurazioni modificabili a runtime dall'admin. Le variabili d'ambiente restano la fonte per i segreti (credenziali SMTP, SMS, database) che non devono mai entrare nel database.

Le API key (SMS, email, AI) **non vengono salvate in `AppSetting`**. Rimangono esclusivamente in variabili d'ambiente sul server.

---

### AISetting

Modello separato da `AppSetting` per gestire la configurazione AI con struttura tipizzata.

- id (default: `"default"` — esiste sempre una sola riga)
- provider: stringa (`none` / `ollama` / `openrouter` / `openai` / `anthropic`)
- model (nullable — nome del modello scelto)
- baseUrl (nullable — usato da Ollama per endpoint self-hosted)
- isEnabled (boolean, default false)
- updatedAt

**Nota importante**: `AISetting` contiene solo provider, modello e URL base — mai chiavi API. Le credenziali AI rimangono esclusivamente in variabili d'ambiente.

La distinzione con `AppSetting`:
- `AppSetting` contiene flag e limiti modificabili a runtime (emergencyContacts, pingInterval, ecc.);
- `AISetting` contiene la configurazione strutturata del provider AI, con schema tipizzato.

---

## API Layer Mapping

I dati che il database persiste non corrispondono sempre 1:1 ai campi esposti dall'API REST. Questa sezione documenta le trasformazioni principali.

### Zone: `geometryJson` (DB) → `geometry` (API)

Nel Prisma schema il campo si chiama `geometryJson` (tipo `Json`) per chiarire che è un blob JSON grezzo nel database MySQL. L'API REST lo espone come `geometry` (senza suffisso `Json`) nelle risposte JSON, perché in quel contesto è già un oggetto GeoJSON tipizzato.

```
DB (Prisma):   Zone.geometryJson  — tipo Json (blob MySQL)
API response:  Zone.geometry      — oggetto ZoneGeometry { type, coordinates }
Frontend type: Zone.geometry      — interface ZoneGeometry
```

Il frontend TypeScript (`frontend/src/types/index.ts`) usa correttamente `geometry` perché lavora con la risposta API, non con il record Prisma diretto.

### RouteSession: coordinate piatte → oggetti strutturati

Nel database le coordinate sono colonne separate per performance di query:

```
DB:  startLat, startLng, endLat (nullable), endLng (nullable), endedAt
API: origin: { lat, lng }, destination: { lat, lng } | null, completedAt
```

Il layer API converte le colonne piatte in oggetti strutturati prima di restituire la risposta.

### SOSAlert: status values

Il database usa stringhe libere con default `"active"`. Il frontend prevede un sottoinsieme tipizzato: `'pending' | 'sent' | 'cancelled' | 'false_alarm'`. Il layer API deve garantire che solo valori validi vengano restituiti.

### User: campi solo frontend

L'interfaccia `User` del frontend include campi che non esistono nel database Prisma e sono calcolati o gestiti lato client:
- `geolocationGranted`: stato permesso browser, non persistito
- `avatarInitials`: derivato da `name` a runtime

---

---

## Day 7.6 Changes (2026-06-22)

### Nuova tabella: EmailVerificationToken

Tabella dedicata ai token di verifica email. Separata da `RefreshToken` per chiarezza semantica e lifecycle indipendente.

**Colonne:**
- `id` — CUID primary key
- `userId` — FK su `users.id` (CASCADE delete)
- `tokenHash` — SHA-256 del token grezzo (unico, mai salvare il token in chiaro)
- `expiresAt` — scadenza token (raccomandato: 24 ore)
- `usedAt` — timestamp utilizzo (nullable — null = non ancora usato)
- `createdAt`

**Mappatura DB:** `email_verification_tokens`

**Flusso:**
1. Alla registrazione viene generato un token, hashato e salvato in questa tabella.
2. L'email contiene il link `FRONTEND_URL/verify-email?token=<raw_token>`.
3. Il frontend chiama `POST /api/auth/verify-email` con il token grezzo.
4. Il backend calcola l'hash, verifica `usedAt IS NULL` e `expiresAt > NOW()`, poi setta `users.emailVerified = true` e `usedAt = NOW()`.
5. In development, se SMTP non è configurato, il link viene stampato in console.

---

### Nuovi campi su User

Due campi aggiunti al modello `User` per tracciare lo stato di verifica email:

| Campo | Tipo | Default | Note |
|---|---|---|---|
| `emailVerified` | Boolean | false | true dopo verifica link |
| `emailVerifiedAt` | DateTime? | null | timestamp prima verifica |

**Comportamento:**
- Cambio email via `PATCH /api/profile/email` reimposta `emailVerified = false` e `emailVerifiedAt = null`, poi reinvia l'email di verifica.
- Il campo è esposto da `GET /api/profile`.
- Soft delete (`deletedAt != null`) non è condizionato a `emailVerified`.

---

### Nuovo campo su RouteSession

| Campo | Tipo | Default | Note |
|---|---|---|---|
| `destinationName` | String? | null | Nome leggibile della destinazione |

Il campo affianca i campi coordinata `endLat`/`endLng` già esistenti e viene valorizzato quando l'utente seleziona una destinazione nominale (es. nome di una zona). Viene restituito nelle risposte API della route session e visualizzato nel `RouteTrackingPanel` frontend.

---

### Indici aggiornati

Nessun nuovo indice richiesto per le tabelle Day 7.6. `email_verification_tokens.tokenHash` è già `@unique` (lookup O(1)). Il join `userId` su `email_verification_tokens` è coperto dal FK.

---

## Indici obbligatori

Questi indici devono essere definiti nello schema Prisma e sono critici per le performance in produzione:

| Tabella | Colonne | Tipo | Uso |
|---|---|---|---|
| `ZoneFeedback` | `(userId, zoneId, createdAt)` | composto | Anti-abuso 30 giorni |
| `LocationPing` | `(routeSessionId, createdAt)` | composto | Tracking live, retrieval ping |
| `SOSAlert` | `(status, createdAt)` | composto | Admin SOS attivi in tempo reale |
| `RouteSession` | `(userId, status)` | composto | Storico percorsi utente |
| `RouteSession` | `(trackingToken)` | unico | Lookup pagina tracking pubblica |
| `Report` | `(zoneId, status)` | composto | Admin segnalazioni per zona |
| `RefreshToken` | `(tokenHash)` | unico | Validazione refresh |
| `AdminAuditLog` | `(adminId, createdAt)` | composto | Storico azioni admin |
| `User` | `(email)` | unico | Login |
| `User` | `(deletedAt)` | singolo | Filtro soft delete |
