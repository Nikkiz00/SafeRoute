# Day 01 - Foundation

## Agent principali
- architect-agent
- backend-agent
- frontend-agent

## Obiettivo
Setup progetto funzionante.

## Task
1. Creare frontend Vue 3 + Vite + TS + Tailwind.
2. Creare backend Express + TS.
3. Configurare Prisma + MariaDB.
4. Creare `.env.example` FE/BE.
5. Healthcheck backend: `GET /api/health`.
6. Collegare frontend a healthcheck.
7. Impostare lint/format base.

## Non fare
- Login;
- mappa;
- admin;
- SOS.

## Output
- App avviabile;
- backend online;
- database configurato;
- commit: `chore: initialize SafeRoute foundation`.

---

## Completato (frontend-agent — 2026-06-21)

### File di configurazione
- `frontend/package.json` — Vue 3, Vite, TypeScript, Tailwind, Pinia, Vue Router 4, Leaflet, lucide-vue-next
- `frontend/index.html` — con Google Fonts (Inter + Space Grotesk)
- `frontend/vite.config.ts` — alias `@/`, proxy `/api` → localhost:3000
- `frontend/tsconfig.json` — strict mode, paths configurati
- `frontend/tailwind.config.ts` — token completi dal design-system (colori brand, safety, surface, SOS, ombre, z-index, animazioni)
- `frontend/postcss.config.js`
- `frontend/env.d.ts`
- `frontend/public/favicon.svg`

### Sorgenti src/
- `src/main.ts` — entry point con Pinia, router, Leaflet CSS
- `src/App.vue` — RouterView con transizioni, aria-live regions, ConnectivityBanner
- `src/assets/main.css` — Tailwind + transizioni page/sheet/step + shake + reduced-motion
- `src/types/index.ts` — User, EmergencyContact, Zone, RouteSession, SOSAlert
- `src/mock/data.ts` — mockUser, mockAdminUser, mockEmergencyContacts, mockZones (5 zone Milano con GeoJSON), mockSOSAlerts, mockAdminUsers
- `src/router/index.ts` — 8 route con guard requiresAuth/requiresAdmin

### Stores Pinia
- `src/stores/auth.ts` — login/register/logout/completeOnboarding, localStorage persist
- `src/stores/theme.ts` — dark/light con localStorage + prefers-color-scheme
- `src/stores/contacts.ts` — CRUD contatti emergenza, limite FREE/PREMIUM

### Componenti comuni
- `src/components/common/ConnectivityBanner.vue` — banner offline, slide-in/out
- `src/components/common/StatusBadge.vue` — pill con dot, 5 varianti (safe/caution/danger/critical/unknown)
- `src/components/common/ThemeToggle.vue` — Sun/Moon, accessibile
- `src/components/common/AppShell.vue` — wrapper layout con sidebar desktop + bottom nav mobile
- `src/components/common/MobileBottomNav.vue` — 5 voci, SOS centrale elevato, active state
- `src/components/common/DesktopSidebar.vue` — sidebar 256px, logo, nav, user footer

### Componenti mappa
- `src/components/map/MapView.vue` — Leaflet dinamico, tile OSM/Carto Dark, zone colorate da mockZones, user marker, click→emit zone
- `src/components/map/ZoneDetailsPanel.vue` — bottom sheet slide-up, score bar, stats, CTA

### Componenti SOS
- `src/components/sos/SOSButton.vue` — FAB long-press 1.5s, SVG progress ring, vibrazione, emit activated

### Componenti contatti
- `src/components/contacts/EmergencyContactCard.vue` — avatar iniziali, badge Principale/Avvisato, delete con conferma inline

### Pagine
- `src/pages/LandingPage.vue` — navbar sticky, hero dark fullscreen con zone circles, 3 feature card, social proof, footer
- `src/pages/LoginPage.vue` — form email/password, validazione, shake animation, demo/admin quick login
- `src/pages/RegisterPage.vue` — form 4 campi, password strength indicator (3 step), validazione on-blur
- `src/pages/OnboardingPage.vue` — 5 step, progress dots, transizioni forward/back, geo request, form contatto
- `src/pages/DashboardPage.vue` — mappa fullscreen, SearchBar overlay, avatar menu, ThemeToggle, SOSButton FAB, ZoneDetailsPanel
- `src/pages/ContactsPage.vue` — lista contatti, add modal, limite FREE/PREMIUM
- `src/pages/SOSPage.vue` — 3 fasi (idle→countdown→sent), long-press SOS, countdown 5s con annulla, messaggi rapidi
- `src/pages/admin/AdminDashboardPage.vue` — sidebar admin dark, tab Overview/Utenti/Zone, metric card, tabelle mock, mobile fallback

### Stato
- `npm install`: OK (133 pacchetti)
- `vue-tsc --noEmit`: 0 errori TypeScript
- Avvio: `cd frontend && npm run dev` → http://localhost:5173

---

## Da fare in Day 02

- Backend Express + TypeScript (setup base)
- Prisma schema: User, Zone, EmergencyContact, RouteSession, SOSAlert
- MariaDB local setup
- `GET /api/health` endpoint
- `.env.example` per frontend e backend
- Auth JWT: register, login, me
- Connessione frontend → backend (replace mock login con richieste HTTP reali)
- Seed zone Milano (CSV/JSON → database)
- Middleware auth guard lato backend
