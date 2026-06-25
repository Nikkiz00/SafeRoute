# Day 04 — Zone Reali + Mappa Reale + Safety Score Base

> Data: 2026-06-21

## Obiettivo

Collegare la mappa Vue/Leaflet al backend reale, sostituire i mockZones con dati dal database, implementare il safety score base con algoritmo classico.

## Completato

### Backend
- [x] `GET /api/cities` — elenco città attive con conteggio zone
- [x] `GET /api/cities/:id` — dettaglio città
- [x] `GET /api/zones` — zone con filtri cityId e bbox (bounding box viewport)
- [x] `GET /api/zones/:id` — dettaglio zona
- [x] `GET /api/zones/:id/safety-summary` — sommario live (calcolato da DB)
- [x] Safety score algoritmo classico (no AI):
  - Input: feedback rating 1-5, segnalazioni approvate (ultimi 30gg)
  - Se < 3 data points: usa score salvato in DB
  - Altrimenti: ratingScore - reportPenalty, clampato 0-100
- [x] Colori zona derivati a runtime da safetyScore (non persisti)
- [x] Filtro bbox in application code (pronto per spatial index futuro)
- [x] Seed aggiornato: Milano (5 zone) + Torino (3 zone)

### Frontend
- [x] `src/types/index.ts`: Zone tipo aggiornato (cityName, region, reportsCount, lastUpdated, isServiceActive)
- [x] `src/api/zones.ts`: fetchZones, fetchZoneById, fetchZoneSafetySummary
- [x] `src/stores/zones.ts`: Pinia store con loading/error state
- [x] `MapView.vue`: sostituisce mockZones con API reale, bbox loading su moveend
- [x] `ZoneDetailsPanel.vue`: mostra cityName, reportsCount, isServiceActive
- [x] `frontend/.env`: VITE_API_URL=http://localhost:3000

## Formato import zone (documentazione)

Per importare zone da file esterno in futuro:

**Formato: GeoJSON FeatureCollection**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Nome Quartiere",
        "cityId": "city_mi",
        "type": "district"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[9.18, 45.46], ...]]
      }
    }
  ]
}
```

Script di import (TODO Day 5+): `backend/scripts/import-zones.ts`
- Legge il GeoJSON FeatureCollection
- Per ogni Feature: `prisma.zone.upsert` con batch da max 100
- Genera un ID deterministico da cityId + name (slug)

## Cosa NON è stato implementato (rimandato)

- Import massivo zone da file (struttura documentata, script da creare in Day 5+)
- Routing avanzato (Leaflet Routing Machine / OSRM)
- Feedback sicurezza utente (form) — Day 5
- Segnalazioni utente complete — Day 5
- Redis caching del safety score — da fare prima di produzione
- Aggiornamento asincrono score via BullMQ — da fare prima di produzione
- sosCount reale (richiede spatial query) — TODO

## Prossimo — Day 5

- POST /api/feedback (ZoneFeedback con anti-abuso 30gg)
- POST /api/reports (segnalazioni con rate limiting)
- Ricalcolo safety score dopo feedback/segnalazione
- SOS reale: invio notifica + email
- Tracking live (SSE)

## Commit

```
feat: day 4 — real zones API, bbox loading, safety score base
```
