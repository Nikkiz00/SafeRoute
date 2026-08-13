# Report: Mobile Responsive — Passata completa

**Data:** 2026-07-01
**Scope:** Rendere SafeRoute davvero usabile e coerente da mobile su tutte le schermate principali (landing, auth, onboarding, dashboard mappa, route start/tracking, SOS, profile, contacts, zone details, legal).

---

## Metodologia

Questa passata parte da un audit precedente (2026-06-29, vedi `docs/step-mobile-fixes.md` e la sezione "Audit precedente" più sotto) che aveva già sistemato touch target, iOS zoom, z-index di base e overflow su bottom sheet. Da allora sono cambiate sostanzialmente: `MapView.vue` (routing modes reali), `RouteStartModal.vue`, `RouteTrackingPanel.vue`, `TrackingPublicPage.vue`, `useRouting.ts` (profili a piedi/auto/bici), e le zone sono passate a 28 poligoni organici (nomi più lunghi, vedi `docs/step-3-3-zone-realism.md`).

Per questa sessione ho fatto un audit reale leggendo per intero (non a campione) 16 file/gruppi di componenti — landing, login/register, legal, mappa, route start/tracking, tracking pubblico, zone details, dashboard, SOS, common components, onboarding — e ho verificato nel codice sorgente:
- overflow orizzontale (larghezze fisse, testo lungo senza truncate/min-w-0);
- touch target < 44×44px;
- z-index arbitrari fuori dal sistema `map(10) < sheet(20) < nav(30) < banner(35) < modal(40) < sos(50) < toast(60)`;
- bottom sheet/overlay che finiscono sotto la bottom nav mobile (72px) o dietro altri elementi fissi;
- contenuti critici (pulsante 112, azioni percorso) raggiungibili senza scroll su viewport piccoli (iPhone SE 375×667).

**Limite dichiarato:** in questo ambiente non è disponibile un browser/tool di screenshot (nessun Playwright/Puppeteer installato, e non li ho aggiunti per non introdurre dipendenze non richieste). La verifica è stata quindi fatta a livello di codice sorgente (dimensioni calcolate, struttura flex/overflow, breakpoint) più typecheck reale — non ho potuto osservare visivamente il rendering in un browser mobile. Lo dichiaro esplicitamente come richiesto, invece di affermare un test visivo che non ho fatto.

---

## Problemi trovati e sistemati in questa sessione

### 1. Zoom control della mappa coperto dalla top bar (bug reale)
**File:** `frontend/src/components/map/MapView.vue`
La top bar della dashboard (`absolute left-4 right-4`, avatar+ricerca+theme toggle) copre l'intera larghezza in alto, incluso l'angolo top-left dove Leaflet piazza di default i pulsanti +/− dello zoom. Risultato: zoom control invisibile/non cliccabile, su mobile e desktop.
**Fix:** `zoomControl: false` nelle opzioni della mappa + `L.control.zoom({ position: 'bottomleft' })` aggiunto esplicitamente. In `main.css` aggiunta una regola che solleva `.leaflet-bottom.leaflet-left` di `6rem + safe-area` sotto i 767px, per non finire sotto la bottom nav mobile (72px).

### 2. Bottom sheet coperti dalla bottom nav su mobile (bug reale, 375×667)
**File:** `RouteTrackingPanel.vue`, `ZoneDetailsPanel.vue`
Entrambi usavano `z-sheet` (20), inferiore a `MobileBottomNav` (`z-nav`, 30, sempre montata, sfondo opaco). Su iPhone SE i pulsanti azione (Share/Annulla/Sono arrivato, "Chiama il 112" in stato SOS, Segnala/Valuta) cadevano nella fascia dei 72px della nav e non erano tappabili.
**Fix:** portati a `z-modal` (40), coerente con `RouteStartModal` che già usava correttamente questo livello (sono bottom sheet che devono coprire la nav quando aperti, non convivere con essa).

### 3. Touch target sotto 44px
**File:** `RouteTrackingPanel.vue` — bottone "Share" era `w-10 h-10` (40px) mentre gli altri bottoni della stessa riga erano già a 44px.
**Fix:** `w-10 h-10` → `w-11 h-11`.

### 4. Nomi zona lunghi non gestiti (conseguenza della zone realism)
**File:** `ZoneDetailsPanel.vue`
Con i 28 poligoni organici, nomi come "Stazione Centrale / Buenos Aires" (33 caratteri) vanno a 2 righe su 375px, disallineando verticalmente il badge di stato che era centrato su un titolo ora più alto.
**Fix:** `items-center` → `items-start` sulla riga, `line-clamp-2` + `min-w-0` sul titolo, `shrink-0 mt-0.5` sul badge per mantenerlo allineato in alto.

### 5. Header di TrackingPublicPage a rischio overflow con nomi lunghi
**File:** `TrackingPublicPage.vue`
Il blocco testo (nome utente + stato) non aveva `truncate`/`min-w-0`/`flex-1`, incastrato tra un'icona fissa e il badge "Live" (`ml-auto`): un nome utente lungo poteva schiacciare o far wrappare male il badge.
**Fix:** `min-w-0 flex-1` sul contenitore testo, `truncate` sui due paragrafi, `shrink-0` sull'icona e sul badge Live.

### 6. Pulsante "Chiama il 112" raggiungibile solo con scroll (bug critico — safety)
**File:** `TrackingPublicPage.vue`
Il layout era `min-h-screen` con la mappa a `min-h-[60vh]` (60% viewport) **forzato indipendentemente** dallo spazio restante: su iPhone SE, header + banner polling + mappa (400px) + blocco SOS + disclaimer superavano i 667px disponibili, spingendo il pulsante di chiamata di emergenza fuori dalla vista.
**Fix:** contenitore esterno `min-h-screen` → `h-screen overflow-y-auto` (viewport fisso con scroll di sicurezza per casi estremi); mappa `min-h-[60vh]` → `flex-1 min-h-0` (si adatta esattamente allo spazio residuo). Ora in condizioni normali il pulsante 112 è visibile senza scroll; `overflow-y-auto` resta come rete di sicurezza se un contenuto imprevisto (es. `sosMessage` molto lungo) cresce oltre lo schermo.

### 7. Navbar LandingPage a rischio overflow su 375px
**File:** `LandingPage.vue`
Logo + ThemeToggle + "Accedi" + "Inizia gratis" superavano lo spazio disponibile su iPhone SE (~375px), senza alcun adattamento responsive.
**Fix:** "Accedi" nascosto sotto il breakpoint `sm` (640px — copre tutti i telefoni), dato che `RegisterPage.vue:160-161` offre già "Hai già un account? Accedi" per chi arriva dalla registrazione. Padding di "Inizia gratis" ridotto su mobile (`px-3` → `sm:px-4`) e `whitespace-nowrap` per evitare wrap del testo del CTA.

### 8. Z-index arbitrari fuori dal sistema (drift risk)
**File:** `MapView.vue` (banner "GPS molto impreciso", era `z-[400]`), `ConnectivityBanner.vue` (era `z-[35]`), `DashboardPage.vue` + `DesktopSidebar.vue` (modal conferma logout, erano `z-[9999]`), `DashboardPage.vue` (FAB "Percorso", era `z-30` numerico).
**Fix:** tutti convertiti ai token semantici già esistenti in `tailwind.config.ts` (`z-banner`, `z-modal`, `z-nav`), eliminando i valori arbitrari che rischiavano di rompersi silenziosamente se il sistema di z-index cambia in futuro. Nessun valore numerico è cambiato per gli elementi che già non avevano conflitti — solo il nome usato.

---

## Schermate verificate senza problemi (in questa sessione)

| Schermata | Esito |
|---|---|
| LoginPage / RegisterPage | OK — max-w-md, input 16px, submit full-width, nessun overflow |
| PrivacyPage / TermsPage / SupportPage | OK — max-w-3xl px-4, testo responsive |
| RouteStartModal | OK — già usa `z-modal`, max-height 90dvh, touch target 44px |
| SOSButton / SOSFlow / SOSPage | OK — long-press + progress bar, touch target ok, testo con `+z-10` locali legittimi (stacking interno, non in conflitto col sistema globale) |
| OnboardingPage | OK — fix scroll step 4 già presente dall'audit precedente |
| AppShell / DesktopSidebar (layout) | OK |

---

## Audit precedente (2026-06-29, riportato per continuità)

Riassunto di quanto già sistemato in una sessione precedente e confermato ancora valido in questa passata: iOS input auto-zoom globale (`main.css`, font-size 16px sotto 767px), touch target 44px su close button e back arrow, `max-height: 90dvh` + `overflow-y-auto` su `RouteStartModal`/`FeedbackModal`, fix overflow step 4 onboarding su iPhone SE, `pb-24` sulle pagine con bottom nav, `safe-area-inset-bottom` su tutti i pannelli fissi al fondo. Dettagli completi in `docs/step-mobile-fixes.md`.

---

## TypeScript

```
frontend: npm run typecheck (vue-tsc --noEmit) → 0 errori
backend:  npm run typecheck (tsc --noEmit)     → 0 errori
```
Eseguiti con i comandi ufficiali del progetto (non solo `tsc` grezzo) per validare anche i template `.vue`.

---

## File modificati in questa sessione

- `frontend/src/components/map/MapView.vue` — zoom control riposizionato bottom-left, z-index banner GPS, badge accuracy sollevato sopra la nav mobile
- `frontend/src/assets/main.css` — margine per sollevare il controllo zoom Leaflet sopra la bottom nav mobile
- `frontend/src/components/map/RouteTrackingPanel.vue` — z-sheet → z-modal, touch target Share 40→44px
- `frontend/src/components/map/ZoneDetailsPanel.vue` — z-sheet → z-modal, gestione nomi zona lunghi (line-clamp-2, allineamento badge)
- `frontend/src/pages/TrackingPublicPage.vue` — header con truncate/min-w-0, layout viewport-fisso per rendere il pulsante 112 raggiungibile senza scroll
- `frontend/src/pages/LandingPage.vue` — navbar responsive (Accedi nascosto su mobile, CTA compatta)
- `frontend/src/components/common/ConnectivityBanner.vue` — z-[35] → z-banner
- `frontend/src/pages/DashboardPage.vue` — z-[9999] → z-modal (logout), z-30 → z-nav (FAB percorso)
- `frontend/src/components/common/DesktopSidebar.vue` — z-[9999] → z-modal (logout)

---

## Problemi ancora aperti (non critici, fuori scope di questa passata)

| Problema | Motivazione rinvio |
|---|---|
| FAB "Percorso" e FAB SOS su 375px combaciano bordo-a-bordo (0px di respiro) quando entrambi visibili | Non c'è overlap, solo affollamento visivo minore; richiederebbe ridisegno del layout FAB, fuori scope per una passata di responsive fix mirati |
| Nessun test visivo reale in browser (screenshot/DevTools mobile emulation) | Nessun tool di browser automation disponibile in questo ambiente; non installato per non introdurre dipendenze non richieste. Verifica fatta a livello di codice sorgente + typecheck |
| Onboarding `z-10` locale (sticky header) non convertito al token di sistema | È uno stacking context isolato di pagina, non in conflitto con nessun altro overlay globale — conversione avrebbe zero beneficio pratico, evitato refactor inutile |

---

## Perché l'obiettivo è raggiunto

1. **Zoom mappa e overlay non si sovrappongono più**: il controllo zoom Leaflet non è più coperto dalla top bar; i bottom sheet (route tracking, zone details) ora coprono correttamente la bottom nav invece di finirci sotto.
2. **Touch target**: tutti i pulsanti interattivi verificati sono ≥ 44×44px (Share button corretto in questa sessione, il resto già a norma dall'audit precedente).
3. **Testi lunghi gestiti**: nomi zona (poligoni organici) e nomi utente nel tracking pubblico non rompono più il layout.
4. **Tracking e SOS chiari e immediati da telefono**: il pulsante "Chiama il 112" nella pagina di tracking pubblico è ora raggiungibile senza scroll sui viewport piccoli — la criticità più seria trovata in questo audit, dato che riguardava un flusso di emergenza reale.
5. **Landing coerente su mobile**: la navbar non rischia più overflow su iPhone SE.
6. **Z-index coerente**: eliminati tutti i valori arbitrari (`z-[400]`, `z-[35]`, `z-[9999]`, numeri raw) a favore del sistema a token esistente, riducendo il rischio di regressioni future.
7. **TypeScript pulito**: 0 errori frontend (vue-tsc) e backend, verificato con i comandi ufficiali del progetto dopo tutti i fix.
8. **Nessuna funzione core toccata**: auth, routing OSRM, tracking SSE/polling, SOS long-press, legal pages — logica invariata, solo classi CSS/Tailwind e due righe di configurazione Leaflet.

---

## Riepilogo test eseguiti (reali, non supposizioni)

1. Lettura integrale di 16 file/componenti (non a campione) per individuare problemi concreti con riferimento file:riga.
2. Calcolo manuale delle larghezze navbar LandingPage (logo + theme toggle + 2 bottoni ≈ 388px vs 343px disponibili su 375px viewport) per confermare l'overflow prima del fix.
3. Analisi struttura flex di `TrackingPublicPage` per confermare che `min-h-[60vh]` forzava il superamento del viewport su iPhone SE (667px), non un'ipotesi ma un calcolo su header+banner+mappa+SOS+disclaimer.
4. Verifica dei nomi zona reali in `backend/prisma/seed.ts` (es. "Stazione Centrale / Buenos Aires", 33 caratteri) per confermare che il wrap a 2 righe è uno scenario reale, non teorico.
5. `npm run typecheck` (vue-tsc, valida anche i template `.vue`) su frontend → 0 errori.
6. `npm run typecheck` (tsc) su backend → 0 errori.
7. Verifica che l'edit del modal di logout non avesse rotto la sintassi del tag (`grep` di conferma dopo un errore di editing corretto immediatamente).

**Limite onesto:** non è stato possibile eseguire un test visivo in browser reale (nessun tool di screenshot/emulazione mobile disponibile in questo ambiente). I fix sono basati su calcoli dimensionali precisi dal codice sorgente, non su osservazione visiva diretta.
