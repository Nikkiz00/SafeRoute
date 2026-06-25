# Day 05 — Feedback sicurezza + Segnalazioni + Aggiornamento safety score

## PRD di riferimento
- `prd/04-safety-score.md` (score algorithm)
- `prd/03-routing-feedback-score.md` (feedback logic)

## Agenti usati
- backend-agent
- frontend-agent
- maps-agent
- qa-agent

## Completato

### Backend

**Nuovo modulo `score.service.ts`**
- `computeSafetyScore(ratings[], approvedReports)` — calcola score 0–100 da dati ultimi 30 giorni
- `recalculateZoneScore(zoneId)` — aggiorna `Zone.safetyScore` in DB dopo ogni feedback
- Nessun aggiornamento se dati insufficienti (< 3 eventi totali): score esistente preservato

**Feedback sicurezza** (`POST /api/zones/:id/feedback`)
- Rating 1–5 con nota opzionale (max 500 chars)
- Anti-abuse: 1 feedback per userId per zona per 30 giorni (409 se duplicato)
- Score ricalcolato sincrono dopo ogni submission
- `GET /api/zones/:id/feedback-summary` — pubblico, aggrega count/avg/distribuzione (30gg)

**Segnalazioni** (`POST /api/zones/:id/reports`)
- 7 categorie: aggression, harassment, theft, dark_area, suspicious_groups, degradation, other
- Status iniziale: `pending` (non impattano subito lo score — solo approved)
- Rate limit: 5 per IP per 15 minuti (express-rate-limit in zones.routes.ts)
- `GET /api/zones/:id/reports-summary` — pubblico, pendingCount + approvedCount + categories (30gg)

### Frontend

**FeedbackModal.vue**
- Bottom sheet mobile-first con 5 pulsanti rating
- Label italiana per ogni voto (1=Molto insicuro → 5=Molto sicuro)
- Nota opzionale (max 500 chars)
- Gestione 409 (già valutato) e successo con auto-chiusura

**ReportModal.vue**
- Grid 2 colonne con 7 chip di categoria
- Descrizione opzionale (max 1000 chars)
- Gestione 429 (rate limit) e successo con auto-chiusura

**ZoneDetailsPanel.vue** (aggiornato)
- Soglie colore corrette: 75/50/25 (era 80/60/35)
- Bottoni "Segnala" e "Valuta"/"Sii il primo!" collegati ai modal
- Emette `zone-updated: [zoneId]` dopo feedback con successo

**DashboardPage.vue** (aggiornato)
- `handleZoneUpdated(zoneId)` — refetch zona, aggiorna selectedZone, chiama `updateZone()` + `invalidateCache()`

**stores/zones.ts** (aggiornato)
- `invalidateCache()` — forza reload al prossimo moveend
- `updateZone(zone)` — aggiorna in-place la zona nello store (aggiorna colore poligono immediatamente)

**MapView.vue** (fix)
- `watch(() => zonesStore.zones, renderZones, { deep: true })` — deep watcher per rilevare mutazioni in-place

**API barrel** (aggiornato)
- `src/api/index.ts` esporta `feedback.ts` e `reports.ts`

## Bug fix inclusi
- Soglie colore backend: 75/50/25 (già corrette da pre-Day 5)
- Soglie colore frontend ZoneDetailsPanel: aggiornate da 80/60/35 a 75/50/25
- `env.d.ts` frontend: aggiunto shim `declare module '*.vue'` (pre-esistente, non Day 5)
- `MapView.vue` watcher: aggiunto `deep: true` mancante

## NON implementato (deferred)
- Score asincrono con BullMQ (aggiornamento sincrono per ora, OK per MVP)
- Redis cache per score
- Dashboard admin per approvare segnalazioni
- SOS reale (Day 6)
- Tracking live SSE (Day 6)

## Soglie colore zona (definitivo)
| Score | Level | Colore |
|---|---|---|
| 75–100 | safe | Verde `#22C55E` |
| 50–74 | caution | Giallo `#FACC15` |
| 25–49 | danger | Rosso `#EF4444` |
| 0–24 | critical | Viola `#8B5CF6` |
| null / inactive | unknown | Grigio `#CBD5E1` |

## File modificati/creati

### Backend
- `src/modules/zones/score.service.ts` *(new)*
- `src/modules/zones/feedback.schemas.ts` *(new)*
- `src/modules/zones/feedback.service.ts` *(new)*
- `src/modules/zones/feedback.controller.ts` *(new)*
- `src/modules/zones/reports.schemas.ts` *(new)*
- `src/modules/zones/reports.service.ts` *(new)*
- `src/modules/zones/reports.controller.ts` *(new)*
- `src/modules/zones/zones.routes.ts` *(updated)*

### Frontend
- `src/api/feedback.ts` *(new)*
- `src/api/reports.ts` *(new)*
- `src/api/index.ts` *(updated)*
- `src/stores/zones.ts` *(updated)*
- `src/components/map/FeedbackModal.vue` *(new)*
- `src/components/map/ReportModal.vue` *(new)*
- `src/components/map/ZoneDetailsPanel.vue` *(updated)*
- `src/components/map/MapView.vue` *(updated)*
- `src/pages/DashboardPage.vue` *(updated)*
- `env.d.ts` *(fix)*

## Commit message
`feat: day 5 — feedback sicurezza, segnalazioni, aggiornamento safety score`
