# Architecture - SafeRoute

## Struttura generale

SafeRoute è divisa in:

- `frontend/`: Vue web app mobile-first;
- `backend/`: API Express;
- `database/`: seed zone iniziali;
- `docs/`: documentazione;
- `.claude/`: regole, agenti e comandi per Claude Code.

## Moduli principali

1. Auth e ruoli
2. Onboarding
3. Emergency contacts
4. Map zones
5. Safety score
6. Route sessions
7. Feedback percorso/zona
8. SOS
9. Tracking live
10. Admin dashboard
11. AI opzionale
12. Premium foundation

## Zone

Il sistema usa zone ufficiali:
- quartieri per città grandi;
- zona unica per piccoli comuni;
- estendibile a tutta Italia;
- estero previsto in futuro.

Il file iniziale delle zone deve essere importabile da CSV o JSON.
Formato obbligatorio: GeoJSON FeatureCollection con ogni Feature avente `properties.name`, `properties.cityId`, `properties.type`. Per MVP è accettabile usare poligoni semplificati.

Il seed deve usare insert batch in transazioni da max 100 zone per non bloccare il database durante l'import.

## Colori zone

Il colore è sempre derivato a runtime dal `safetyScore` — non è persisto nel database.

| Score | Colore | Significato |
|---|---|---|
| null / inactive | Bianco/grigio | Servizio non attivo o dati insufficienti |
| 75–100 | Verde | Zona sicura |
| 50–74 | Giallo | Attenzione |
| 25–49 | Rosso | Zona pericolosa |
| 0–24 | Viola | Zona molto pericolosa |

## Safety score

Ogni zona ha uno score 0-100 aggiornato in modo **asincrono** tramite job queue (BullMQ o equivalente). Il feedback viene salvato immediatamente; il ricalcolo avviene entro pochi secondi senza bloccare la risposta API.

Segnali che contribuiscono all'aggiornamento:
- feedback sicurezza post-percorso;
- SOS reali (abbassano molto) / falsi allarmi (penalità minima);
- segnalazioni zona approvate;
- percorsi completati senza problemi (alzano lievemente).

Aggiornamento sincrono diretto sul record `Zone` è vietato in produzione per evitare race condition su zone ad alto traffico.

## Routing engine

Leaflet è esclusivamente una libreria di rendering — non calcola percorsi.

Per il routing è necessario un engine separato:
- **MVP consigliato**: Leaflet Routing Machine + OSRM pubblico (`router.project-osrm.org`) o istanza self-hosted;
- **alternativa**: Valhalla self-hosted (supporta weight personalizzati per safety);
- **da non fare**: disegnare percorsi a mano o fingere routing senza engine reale (pericoloso per l'utente).

Il peso sicurezza si applica modificando il costo dei segmenti che attraversano zone rosse/viola, o escludendoli se possibile nel path-finding.

## Real-time: tracking live

La pagina di tracking live richiede aggiornamenti di posizione in tempo reale. Meccanismo scelto: **Server-Sent Events (SSE)**.

Motivazione: SSE è unidirezionale (server→client), nativo nei browser, non richiede librerie aggiuntive lato client, e ha overhead inferiore a WebSocket per questo caso d'uso.

Flusso:
1. Il client apre una connessione `GET /api/track/:token/stream` (SSE).
2. Il backend invia un evento `position` ogni volta che arriva un nuovo `LocationPing` per quella sessione.
3. La connessione si chiude automaticamente alla scadenza del `trackingToken` o alla chiusura della sessione.

**CORS SSE**: l'endpoint SSE non imposta header `Access-Control-Allow-Origin` propri. Segue la policy CORS globale definita in `server.ts` con `origin: env.FRONTEND_URL`. Nessun wildcard `*` — nemmeno per la pagina pubblica di tracking.

Fallback: se SSE non è supportato, il client può fare polling HTTP `GET /api/track/:token/latest` ogni 15 secondi.

**Dati esposti dalla pagina pubblica tracking:**
Il payload del token di tracking include: stato sessione, ora inizio, scadenza, ultima posizione, e nome display dell'utente (`userName`). NON include email, ID utente o altri dati sensibili.

## Frequenza LocationPing

La frequenza di invio dei ping di posizione deve essere configurabile in `AppSetting`:
- default: ogni 15 secondi;
- minimo consentito: 5 secondi;
- massimo consentito: 60 secondi.

Comportamento adattivo consigliato: se l'accelerometro rileva assenza di movimento per 60 secondi, ridurre la frequenza a ogni 60 secondi fino alla ripresa del movimento.

Ogni ping non inviato per connessione assente viene accodato localmente e inviato alla prima connessione disponibile (max 10 ping in coda).

## API zone: filtering per bounding box

Le zone non vengono mai caricate tutte in una sola risposta.

`GET /api/zones?bbox=minLng,minLat,maxLng,maxLat`

Il backend restituisce solo le zone la cui geometria interseca il bounding box del viewport corrente. Le geometrie vengono cachate HTTP con `Cache-Control: max-age=3600, public` (cambiano raramente) e `ETag` per invalidazione selettiva.

## Caching

Livelli di caching previsti:

| Dato | Strategia | TTL |
|---|---|---|
| Geometrie zone | HTTP `Cache-Control` + CDN edge | 1 ora |
| Safety score zone (aggregato) | Redis | 5 minuti |
| AppSetting | Memoria applicazione al boot + refresh ogni 10 min | — |
| Ultimo LocationPing per sessione | Redis | durata sessione |

Redis è opzionale per MVP locale ma obbligatorio prima di andare in produzione con utenti reali.

## Connection pooling

Prisma richiede configurazione esplicita del pool di connessioni in `DATABASE_URL`:

```
mysql://user:pass@host:3306/db?connection_limit=10&pool_timeout=30
```

In deploy multi-istanza, il totale delle connessioni aperte = `connection_limit × numero istanze`. Non superare `max_connections` di MariaDB (default 151).

## Sicurezza trasversale

**HTTPS**: obbligatorio in ogni ambiente non-locale. Su VPS usare Nginx + Let's Encrypt (Certbot). Su Railway/Render è automatico.

**CORS**: il backend deve configurare `cors` con `origin` whitelist esplicita (dominio frontend). Nessun wildcard `*` in produzione.

**Rate limiting**: middleware `express-rate-limit` applicato in due livelli distinti (vedi sezione dedicata sotto).

**Validazione input**: tutti gli input esterni (body, query, params) devono essere validati con Zod prima di raggiungere il database. I campi `description`, `note`, `message` devono essere sanitizzati prima della visualizzazione nel frontend (no HTML crudo).

## Rate Limiting

Implementato con `express-rate-limit` in `backend/src/server.ts`. Configurazione attuale:

| Scope | Window | Max richieste | Route |
|---|---|---|---|
| Globale | 15 minuti | 200 | Tutte le route (`app.use`) |
| Auth | 60 minuti | 10 | `/api/auth/*` (sovrascrive il globale) |

Regole specifiche per route sensibili (da implementare quando i moduli saranno aggiunti):

| Route | Window | Max | Note |
|---|---|---|---|
| `POST /api/reports` | 15 minuti | 5 per IP | Segnalazioni anonime anti-spam |
| `POST /api/sos` | — | nessun limite | Sicurezza prioritaria |

Il rate limit Auth (`/api/auth`) è più restrittivo del globale ed è applicato come middleware separato prima del router, sovrascrivendo di fatto il contatore globale per quelle route.

**Nota AI key**: le API key AI (OpenAI, Anthropic, OpenRouter, ecc.) non vengono mai salvate nel database. In `AppSetting` e `AISetting` si salvano solo il nome del provider e del modello. Le chiavi rimangono esclusivamente in variabili d'ambiente sul server.

## Logging e monitoring

Il backend deve produrre log strutturati (JSON) con livelli `info`, `warn`, `error`.

Campi minimi per ogni log:
- `timestamp`;
- `level`;
- `route`;
- `method`;
- `statusCode`;
- `durationMs`;
- `userId` (se autenticato, non esponendo dati sensibili).

I log SOS e di invio notifiche devono essere sempre registrati con esito (successo/fallimento + provider).

Prefissi `[modulo]` standardizzati (aggiornati in Step 2.1):

| Modulo | Prefisso |
|---|---|
| Verifica email | `[auth-verify]` |
| Cambio email | `[email-change]` |
| Cambio password | `[password-change]` |
| Tracking SSE | `[tracking-sse]` |
| GPS tracking frontend | `[gps]` |
| Tracking SSE frontend | `[tracking]` |
| Routing | `[routing]` |
| SOS | `[sos]` |
| Email provider | `[email]` |
| SMS provider | `[sms]` |

Regole trasversali sui log: MAI loggare `passwordHash`, token raw, o email completa in log `info`/`warn`. Le email vanno oscurate (`nik***@gmail.com`); i token usano solo i primi 8 caratteri (`token.slice(0, 8) + '...'`).

Per MVP è sufficiente `pino` o `winston`. In produzione, inviare i log a un servizio esterno (Logtail, BetterStack, o simile).

## AI opzionale

L'AI NON è obbligatoria.

Modalità base:
- algoritmo classico per safety score.

Modalità futura/configurabile admin:
- AI attiva/disattiva via `AppSetting`;
- provider: Ollama, OpenRouter, OpenAI, Anthropic;
- AI usata per analisi feedback, classificazione segnalazioni e suggerimenti routing.

Se AI non è configurata, il sistema deve funzionare perfettamente con algoritmo classico.

Le API key AI non devono mai essere salvate in chiaro nel database. Usare crittografia a livello applicazione o variabili d'ambiente; in `AppSetting` salvare solo il provider e il modello scelto.

## Pagine pubbliche

Le pagine seguenti sono accessibili senza autenticazione:

| Path | Componente | Descrizione |
|---|---|---|
| `/` | `LandingPage.vue` | Landing pubblica con hero, feature, come funziona, footer |
| `/login` | `LoginPage.vue` | Login utente |
| `/register` | `RegisterPage.vue` | Registrazione con link a termini e privacy |
| `/privacy` | `PrivacyPage.vue` | Informativa dati personali |
| `/terms` | `TermsPage.vue` | Termini di utilizzo |
| `/support` | `SupportPage.vue` | FAQ e contatti supporto |
| `/verify-email` | `VerifyEmailPage.vue` | Verifica email da link |
| `/track/:token` | `TrackingPublicPage.vue` | Tracking live pubblico |

Tutte le pagine pubbliche seguono il meta `{ public: true }` nel router. Non richiedono autenticazione e non reindirizzano al login.

## Stato Day 3 (2026-06-21)

### Completato
- Auth JWT reale: register, login, refresh, logout, me
- Profilo utente: GET/PATCH + completamento onboarding
- Emergency contacts CRUD: GET/POST/PATCH/DELETE con limiti FREE/PREMIUM
- Frontend collegato al backend: auth store, contacts store, router guard con init()
- Token persistenza: access token 15min + refresh token 30gg con auto-rotation
- Mock shortcuts DEV preservati

### Completato — Day 4 (2026-06-21)
- GET /api/zones?bbox=... con filtro bounding box (application-level AABB)
- GET /api/zones, /api/zones/:id, /api/zones/:id/safety-summary
- GET /api/cities, /api/cities/:id
- Seed aggiornato: Milano (5 zone) + Torino (3 zone)
- Safety score algoritmo classico (feedback rating + report penalty, no AI)
- Colori derivati a runtime da safetyScore (non persisti in DB)
- Frontend mappa collegata all'API zone (mockZones rimossi da MapView)
- Bbox loading su moveend (debounced 500ms)
- ZoneDetailsPanel mostra cityName, reportsCount, isServiceActive

### Completato — Day 5 (2026-06-21)
- POST /api/zones/:id/feedback (anti-abuso 30gg, score ricalcolato sincrono)
- GET /api/zones/:id/feedback-summary (count/avg/distribuzione, 30gg)
- POST /api/zones/:id/reports (7 categorie, pending, rate limit 5/IP/15min)
- GET /api/zones/:id/reports-summary (pending/approved counts + per categoria)
- score.service.ts: computeSafetyScore + recalculateZoneScore (30gg sliding window)
- FeedbackModal.vue: rating 1–5, nota opzionale, anti-abuso 409 handling
- ReportModal.vue: 7 chip categoria, descrizione opzionale, 429 handling
- ZoneDetailsPanel.vue: soglie 75/50/25 corrette, bottoni collegati ai modal
- zonesStore: invalidateCache() + updateZone() per refresh mappa immediato
- MapView.vue: deep watcher per rilevare mutazioni in-place nello store

### Completato — Day 6 (2026-06-21)
- POST /api/routes — avvia RouteSession (trackingToken 24h)
- PATCH /api/routes/:id/location — aggiunge LocationPing, broadcast SSE
- POST /api/routes/:id/complete|cancel — chiude sessione, notifica SSE
- POST /api/routes/:id/share — restituisce URL condivisibile
- GET /api/tracking/:token — snapshot JSON (pubblico)
- GET /api/tracking/:token/stream — SSE real-time (pubblico, fallback polling)
- Sicurezza: ownership check su tutte le route, status guard su location update
- Frontend: RouteStartModal, RouteTrackingPanel ("Sono arrivato" + "Annulla" + share)
- Pagina pubblica /track/:token — Leaflet map + SSE + polling fallback, no auth
- MapView: marker blu pulsante user-position durante tracking attivo
- useRouteTracker composable: watchPosition 15s throttle, cleanup onUnmounted

### Completato — Day 7 (2026-06-21)
- POST /api/sos — auth, nessun rate limit, crea SOSAlert + notifica contatti
- GET /api/sos/:id — dettaglio SOS con followup (owner only)
- POST /api/sos/:id/followup — "Ora sei al sicuro?" (4 opzioni)
- email.provider.ts — nodemailer SMTP, graceful skip se non configurato
- sms.provider.ts — provider astratto: none/mock/twilio-stub
- notification.service.ts — Promise.allSettled per-contatto, try/catch per canale
- GPS (0,0) fallback: usa ultimo LocationPing della route session
- routes.service.ts: updateLocation accetta status='sos' (tracking continua)
- SOSFlow.vue: overlay dark full-screen, 5 stati, link tracking, follow-up modal
- SOS store state machine: idle→locating→sending→active→followup→done
- .env.example aggiornato con SMTP/SMS vars (tutte opzionali)

### Completato — Day 7.6 (2026-06-22)

#### Email Verification Flow (Updated in Day 7.6)

Alla registrazione viene inviata un'email con link di verifica (non-blocking, fallback console in dev se SMTP non configurato).

Endpoint:
- `POST /api/auth/verify-email` — accetta `{ token: string }` nel body, verifica hash, setta `emailVerified = true`. Pubblico, nessuna auth richiesta.
- `POST /api/auth/resend-verification` — reinvia email di verifica all'utente autenticato. Richiede JWT. Rate limit: incluso nel limite globale `/api/auth/*`.

Pagina frontend: `/verify-email?token=xxx` — `VerifyEmailPage.vue`. Legge il token dalla query string e chiama l'endpoint sopra.

Comportamento cambio email: `PATCH /api/profile/email` reimposta `emailVerified = false`, reinvia verifica alla nuova email.

#### Profile Management (Updated in Day 7.6)

Nuovi endpoint su `/api/profile`:

| Metodo | Path | Descrizione | Note |
|---|---|---|---|
| `PATCH` | `/api/profile/email` | Cambia email | Richiede `{ newEmail, password }`. Reimposta emailVerified. |
| `PATCH` | `/api/profile/password` | Cambia password | Richiede `{ currentPassword, newPassword }`. |
| `DELETE` | `/api/profile` | Soft delete account | Richiede `{ password }`. Setta `deletedAt`. |

Il `GET /api/profile` esistente ora espone anche `emailVerified` e `emailVerifiedAt`.

#### Route Destination (Updated in Day 7.6)

Il modello `RouteSession` ha il nuovo campo `destinationName` (String nullable). Viene salvato alla creazione della sessione se l'utente seleziona una destinazione nominale. Viene restituito da tutti gli endpoint che espongono dati della route session.

Il frontend `RouteStartModal` permette di cercare una destinazione per nome tra le zone caricate, e uno slider `routePreference` (sicurezza/bilanciato/velocità). Il `RouteTrackingPanel` mostra il nome della destinazione, il tempo trascorso e l'accuratezza GPS.

#### GPS Smoothing (Updated in Day 7.6)

Il composable `useRouteTracker` applica filtri al segnale GPS prima di inviare ogni `LocationPing`:

| Parametro | Valore | Descrizione |
|---|---|---|
| Accuracy threshold | 50 m | Ping con `accuracy > 50m` vengono scartati |
| Distanza minima | 5 m | Ping con spostamento < 5m dall'ultimo ping valido vengono ignorati |

Questi filtri riducono il rumore GPS (jitter in ambienti chiusi) e le chiamate API inutili.

### Completato — Day 7.7 (2026-06-22) — Debug & UX Fixes

#### SMTP Health Check
`GET /api/health/email` ora esegue una connessione SMTP reale tramite `transporter.verify()` invece di limitarsi a verificare la presenza delle variabili d'ambiente. Gli errori vengono classificati con codici distinti:

| Codice | Causa |
|---|---|
| `SMTP_AUTH_FAILED` | Credenziali errate (es. codice 535) — richiede App Password |
| `SMTP_UNREACHABLE` | Host/porta non raggiungibili |
| `SMTP_TIMEOUT` | Connessione scaduta |
| `SMTP_ERROR` | Errore generico SMTP |

#### GPS Smoothing (aggiornato rispetto a Day 7.6)
Il composable `useRouteTracker` applica ora parametri aggiornati:

| Parametro | Day 7.6 | Day 7.7 | Descrizione |
|---|---|---|---|
| Accuracy threshold | 50 m | 35 m | Ping con accuracy > 35m vengono scartati |
| Distanza minima | 5 m | 8 m | Ping con spostamento < 8m vengono ignorati |
| Low-pass filter | — | alpha = 0.25 | Smorzamento oscillazioni lat/lng |

Il low-pass filter applica la formula: `filtered = alpha * raw + (1 - alpha) * prev`, riducendo il jitter GPS in ambienti chiusi o con segnale degradato.

#### Map: Accuracy Indicator
`MapView.vue` mostra ora:
- **Cerchio accuracy**: cerchio Leaflet attorno al marker utente con raggio pari all'accuracy GPS in metri.
- **Indicatore colorato**: badge accuracy con colore dipendente dalla precisione (verde ≤ 15m, blu ≤ 35m, giallo > 35m).
- **Animazione marker**: pulsazione ridotta per minore distrazione visiva durante tracking attivo.

#### DashboardPage: FAB Layout
I pulsanti flottanti su `DashboardPage` sono stati riposizionati per eliminare l'overlap:
- Pulsante Percorso: `bottom-36`
- Pulsante SOS: `bottom-20`

Aggiunto error toast visibile se l'avvio route fallisce (es. backend non raggiungibile o utente non autenticato).

### Completato — Day 8 (2026-06-22) — Professional Foundation Fix

#### Email Verification Gating
Alcune route sensibili richiedono email verificata oltre all'autenticazione JWT. Il middleware `requireEmailVerified` legge `emailVerified` direttamente da DB (non dal JWT) e risponde 403 `{ code: 'EMAIL_NOT_VERIFIED' }` se non verificata.

Route protette da `requireEmailVerified`:
- `POST /api/routes` — avvio sessione percorso
- `POST /api/sos` — invio SOS

Note: Il middleware viene applicato dopo `requireAuth`, quindi richiede un token JWT valido come prerequisito.

#### Account Security
Cambiamenti security-critical nel modulo profilo:

| Operazione | Comportamento |
|---|---|
| Cambio email | Vecchia email riceve security email prima dell'update. `emailVerified` reimpostato a false. |
| Cambio password | Tutti i refresh token attivi (`revokedAt: null`) vengono revocati via `updateMany`. Security email all'utente. |
| Soft delete | Tutti i refresh token revocati in transazione con il soft delete. |

#### Routing Engine (Day 8 status)
OSRM routing non ancora implementato nel frontend (`useRouting.ts` non esiste). La destinazione è salvata come `destinationName` (stringa) e coordinate opzionali nella RouteSession. Il `RouteStartModal` permette ricerca locale tra zone caricate — Nominatim geocoding rinviato a Day 9.

#### GPS — Parametri aggiornati (Day 8)

| Parametro | Day 7.7 | Day 8 | Descrizione |
|---|---|---|---|
| Accuracy threshold | 35 m | 50 m | Ping con accuracy > 50m scartati |
| Distanza minima | 8 m | 10 m | Ping con spostamento < 10m ignorati |
| Low-pass alpha | 0.25 | 0.15 | Più stabile, meno reattivo |
| GPS very poor | — | 100 m | Banner warning se accuracy > 100m |

#### SOS Flow (Day 8 UI)
Il flow SOS usa 3 fasi lineari (non 4):
1. `idle` — scelta motivo + long-press button per conferma (sfondo neutro)
2. `countdown` — conto alla rovescia 5s con possibilità annullamento (sfondo rosso)
3. `sent` — conferma invio con azioni follow-up (sfondo navy)

#### SSE Retry (Day 8)
`TrackingPublicPage.vue` implementa retry SSE prima del fallback polling:
- Fino a 3 tentativi, delay 3 secondi tra ogni tentativo
- Log console strutturati con prefisso `[tracking]`
- Fallback polling a 15 secondi solo dopo esaurimento retry

### Prossimo — Day 9
- useRouting.ts con OSRM public demo
- Nominatim geocoding in RouteStartModal
- Admin dashboard: lista zone, segnalazioni pending, SOS log
- Moderazione: approva/rifiuta Report
- Route: /admin protetta da ruolo ADMIN
