# SafeRoute — Frontend Design Specification (Giornata 1)

> Documento di riferimento per il frontend-agent. Descrive il design system completo, i layout per ogni pagina, i componenti chiave, le animazioni e la struttura dei mock data.
> Tutti i valori di codice sono in inglese; le descrizioni sono in italiano.

---

## 1. Tailwind Tokens

### 1.1 Colori — estensione `tailwind.config.ts`

```ts
// tailwind.config.ts
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand
        'brand-navy':  '#020617',  // Sfondo primario dark
        'brand-blue':  '#2563EB',  // Azione principale (link, focus, primary button)
        'brand-cyan':  '#06B6D4',  // Accento secondario, highlights interattivi
        'brand-white': '#FFFFFF',

        // Safety
        'safety-green':  '#22C55E',  // Zona sicura (score 80–100)
        'safety-yellow': '#FACC15',  // Zona attenzione (score 60–79)
        'safety-red':    '#EF4444',  // Zona pericolosa (score 35–59)
        'safety-purple': '#8B5CF6',  // Zona molto pericolosa (score 0–34)
        'safety-gray':   '#CBD5E1',  // Zona senza dati (score null)

        // Surface (semantici)
        'surface-base':     '#F8FAFC',  // Background light mode
        'surface-elevated': '#FFFFFF',  // Card, bottom sheet light
        'surface-dark':     '#0F172A',  // Background dark mode (slate-900)
        'surface-dark-elevated': '#1E293B', // Card, bottom sheet dark (slate-800)

        // Text semantici
        'text-primary':   '#0F172A',  // Testo principale light
        'text-secondary': '#64748B',  // Testo secondario light
        'text-dark-primary':   '#F1F5F9', // Testo principale dark
        'text-dark-secondary': '#94A3B8', // Testo secondario dark

        // SOS
        'sos-red':        '#DC2626',  // SOS button background
        'sos-red-glow':   '#EF4444',  // SOS pulse shadow
        'sos-red-ring':   '#FCA5A5',  // SOS progress ring (light)

        // Utility
        'offline-yellow': '#F59E0B',  // ConnectivityBanner warning
        'border-light':   '#E2E8F0',  // Bordo card light
        'border-dark':    '#334155',  // Bordo card dark
      },
    },
  },
}
```

### 1.2 Typography

Font scelti: **Inter** (body + UI) e **Space Grotesk** (heading display). Entrambi da Google Fonts.

```ts
// tailwind.config.ts — aggiungere dentro extend:
fontFamily: {
  sans:    ['Inter', 'system-ui', 'sans-serif'],
  display: ['Space Grotesk', 'Inter', 'sans-serif'],
  mono:    ['JetBrains Mono', 'monospace'],
},
fontSize: {
  'xs':   ['0.75rem',  { lineHeight: '1rem' }],       // 12px
  'sm':   ['0.875rem', { lineHeight: '1.25rem' }],    // 14px
  'base': ['1rem',     { lineHeight: '1.5rem' }],     // 16px
  'lg':   ['1.125rem', { lineHeight: '1.75rem' }],    // 18px
  'xl':   ['1.25rem',  { lineHeight: '1.75rem' }],    // 20px
  '2xl':  ['1.5rem',   { lineHeight: '2rem' }],       // 24px
  '3xl':  ['1.875rem', { lineHeight: '2.25rem' }],    // 30px
  '4xl':  ['2.25rem',  { lineHeight: '2.5rem' }],     // 36px
  '5xl':  ['3rem',     { lineHeight: '1' }],          // 48px
},
fontWeight: {
  normal:    '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
},
```

Import Google Fonts in `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700;800&display=swap" rel="stylesheet">
```

### 1.3 Border Radius

```ts
borderRadius: {
  'none': '0',
  'sm':   '4px',
  'md':   '8px',
  'lg':   '12px',
  'xl':   '16px',
  '2xl':  '20px',
  '3xl':  '24px',
  'full': '9999px',  // Pill, FAB, avatar
},
```

### 1.4 Shadow Scale

```ts
boxShadow: {
  'sm':      '0 1px 2px 0 rgba(0,0,0,0.05)',
  'md':      '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
  'lg':      '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
  'xl':      '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
  '2xl':     '0 25px 50px -12px rgba(0,0,0,0.25)',
  'sos':     '0 0 0 8px rgba(239,68,68,0.25), 0 8px 25px rgba(220,38,38,0.5)',
  'sos-pulse':'0 0 0 16px rgba(239,68,68,0.1)',
  'map':     '0 2px 12px rgba(0,0,0,0.15)',
  'sheet':   '0 -4px 24px rgba(0,0,0,0.12)',
  'inner':   'inset 0 2px 4px 0 rgba(0,0,0,0.06)',
},
```

### 1.5 Z-Index Scale

```ts
zIndex: {
  'map':    '10',   // Mappa Leaflet base
  'sheet':  '20',   // Bottom sheet / ZoneDetailsPanel
  'nav':    '30',   // Bottom nav mobile / sidebar desktop
  'banner': '35',   // ConnectivityBanner / geolocation banner
  'modal':  '40',   // Modal overlay e finestre di dialogo
  'sos':    '50',   // SOSButton, SOSConfirmOverlay — MAI sovrapposto
  'toast':  '60',   // Notifiche toast (sopra tutto)
},
```

### 1.6 Spacing Custom

```ts
spacing: {
  // Estende il default Tailwind, aggiunge:
  'safe-top':    'env(safe-area-inset-top)',
  'safe-bottom': 'env(safe-area-inset-bottom)',
  '18': '4.5rem',   // 72px — altezza bottom nav mobile
  '22': '5.5rem',   // 88px — altezza bottom nav con safe area
  '15': '3.75rem',  // 60px — header mobile
},
```

---

## 2. Strategia Dark/Light Mode

### Approccio scelto: Tailwind `class` strategy

Configurazione in `tailwind.config.ts`:
```ts
darkMode: 'class',
```

Comportamento:
- La classe `dark` viene aggiunta/rimossa sull'elemento `<html>` tramite un composable Vue (`useDarkMode`).
- Il tema iniziale si legge da `localStorage.getItem('theme')` oppure da `window.matchMedia('(prefers-color-scheme: dark)')`.
- Cambio tema in runtime: transizione CSS globale di 200ms su background e colori testo.

Classe radice da gestire in `App.vue`:
```ts
// Aggiungere/rimuovere sul documento root
document.documentElement.classList.toggle('dark', isDark)
```

Regola CSS globale per la transizione fluida del tema:
```css
/* src/assets/main.css */
*, *::before, *::after {
  transition: background-color 200ms ease, border-color 200ms ease, color 150ms ease;
}
/* Eccetto animazioni già definite (non sovrascrivere) */
.no-theme-transition {
  transition: none !important;
}
```

### Mappa in dark mode

In dark mode la mappa Leaflet usa le tile Carto Dark Matter:
```
https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
```

In light mode:
```
https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

Il tile layer viene sostituito dinamicamente quando cambia il tema, senza ricaricare la pagina (via `tileLayer.setUrl()` o rimozione e ri-aggiunta del layer).

---

## 3. Layout Generale

### 3.1 AppShell

Struttura a due livelli:

**Mobile (< 768px):**
```
┌─────────────────────────────┐
│  ConnectivityBanner (top)   │  z-35, condizionale
├─────────────────────────────┤
│                             │
│    <RouterView />           │  flex-1, overflow
│    (contenuto pagina)       │
│                             │
├─────────────────────────────┤
│  MobileBottomNav            │  h-18 + safe-area, z-30
└─────────────────────────────┘
```

**Desktop (>= 768px):**
```
┌──────────┬──────────────────┐
│          │ ConnectivityBanner│  z-35
│ Sidebar  ├──────────────────┤
│ (w-64)   │                  │
│  z-30    │  <RouterView />  │
│          │                  │
│          │                  │
└──────────┴──────────────────┘
```

### 3.2 Z-Index Scale riepilogativa

| Layer | z-index | Componente |
|-------|---------|-----------|
| Mappa base | 10 | `MapView` (Leaflet container) |
| Overlay mappa | 15 | Marker, zone poligoni, routing line |
| Bottom sheet | 20 | `SafetyBottomSheet`, `ZoneDetailsPanel` |
| Navigation | 30 | `MobileBottomNav`, `DesktopSidebar` |
| Banner | 35 | `ConnectivityBanner`, banner geolocalizzazione |
| Modal | 40 | `FeedbackModal`, dialog di conferma |
| SOS | 50 | `SOSButton` FAB, `SOSConfirmOverlay` |
| Toast | 60 | Notifiche temporanee |

### 3.3 Mobile Bottom Nav — 5 voci

| Posizione | Icona | Label | Route |
|-----------|-------|-------|-------|
| 1 | `MapIcon` | Mappa | `/app/map` |
| 2 | `RouteIcon` | Percorsi | `/app/routes` |
| 3 | `AlertTriangleIcon` | SOS | — (apre overlay SOS, non naviga) |
| 4 | `UsersIcon` | Contatti | `/app/contacts` |
| 5 | `UserCircleIcon` | Profilo | `/app/profile` |

La voce SOS (posizione centrale) è più grande delle altre (48px vs 40px), con colore rosso (`bg-sos-red`), sempre visibile.

Specifiche visive bottom nav:
- Altezza: `h-18` (72px) + `padding-bottom: env(safe-area-inset-bottom)`
- Background: `bg-surface-elevated dark:bg-surface-dark-elevated`
- Border top: `border-t border-border-light dark:border-border-dark`
- Icone attive: `text-brand-blue`; inattive: `text-text-secondary dark:text-text-dark-secondary`
- Dot indicatore attivo: punto 4px sotto l'icona, colore `brand-blue`

### 3.4 Desktop Sidebar

- Larghezza: `w-64` (256px) fissa
- Stessa lista di voci del bottom nav, disposte verticalmente
- Logo SafeRoute in alto (`h-16`, padding `px-6`)
- Footer sidebar: avatar utente + nome + pulsante logout
- Background: `bg-surface-elevated dark:bg-surface-dark-elevated`
- Border right: `border-r border-border-light dark:border-border-dark`

---

## 4. Design di Ogni Pagina

### 4.1 Landing Pubblica (`/`)

**Obiettivo:** Convertire visitatori in utenti registrati. Ispirare fiducia, mostrare valore immediato.

**Layout mobile:**
```
┌─────────────────────────────┐
│  Navbar (logo + CTA login)  │  h-16, sticky
├─────────────────────────────┤
│  Hero Section               │
│  - Mappa blur in background │
│  - Overlay scuro 60%        │
│  - Headline (font: display) │
│  - Subheadline              │
│  - CTA: [Inizia gratis]     │
│  - CTA secondario: [Login]  │
├─────────────────────────────┤
│  3 Feature Cards (stacked)  │
├─────────────────────────────┤
│  Social Proof + Trust bar   │
├─────────────────────────────┤
│  CTA bottom + Footer        │
└─────────────────────────────┘
```

**Layout desktop:** Hero full-width, feature cards in griglia 3 colonne, max-width 1200px centrato.

**Specifiche Hero:**
- Background: immagine o iframe mappa Leaflet blurrata (`filter: blur(8px) brightness(0.4)`)
- Overlay: `bg-brand-navy/60`
- Titolo: `font-display text-4xl md:text-5xl font-extrabold text-white`
  - Testo suggerito: *"Muoviti in città con più sicurezza"*
- Sottotitolo: `text-lg text-slate-300 max-w-lg`
- CTA primario: `bg-brand-blue hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold text-lg`
- CTA secondario: `border border-white/40 text-white px-8 py-4 rounded-xl`

**Feature Cards (3):**
- Zona sicura / Zone colorate / SOS istantaneo
- Icona SVG (Lucide) 32px, colore safety corrispondente
- Titolo `font-semibold text-lg`, descrizione `text-sm text-text-secondary`
- Card: `bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl p-6 shadow-md`
- Bordo sottile con gradiente colore safety: `border-l-4 border-safety-green` etc.

**Comportamento dark/light:** La navbar e le card rispettano il tema; la hero section è sempre dark (by design).

**Trust bar:** "X zone monitorate · Y utenti · Sicuro e gratuito" — testo piccolo, colori neutri.

**Footer:** Link legali, copyright, icona GitHub.

---

### 4.2 Login (`/login`)

**Layout:** Centrato verticalmente e orizzontalmente. Max-width 400px. Background `surface-base dark:surface-dark`.

**Componenti:**
- Logo SafeRoute in cima (`h-10`)
- Titolo: *"Accedi al tuo account"* (`text-2xl font-display font-bold`)
- Form: email + password
- Checkbox "Ricordami"
- CTA: `[Accedi]` (full-width, `bg-brand-blue`)
- Link: *"Non hai un account? Registrati"* — `text-brand-blue`
- Link: *"Password dimenticata?"* — `text-text-secondary text-sm`

**Validazione:** errori inline sotto ogni campo, bordo `border-safety-red` in caso di errore, testo `text-safety-red text-sm`.

**Mobile vs Desktop:** Identico, il form occupa il 90% della viewport su mobile e 400px fissi su desktop.

**Micro-interazioni:**
- Campo focus: bordo `brand-blue` + glow `shadow-[0_0_0_3px_rgba(37,99,235,0.2)]`
- Button hover: `opacity-90` + `translateY(-1px)` 150ms
- Errore: shake animation 300ms su submit fallito

---

### 4.3 Register (`/register`)

**Layout:** Identico al Login, max-width 440px.

**Form fields:**
1. Nome completo
2. Email
3. Password (con toggle visibilità, icona Lucide `EyeIcon`/`EyeOffIcon`)
4. Conferma password

**Validazione live** (on blur, non on keypress):
- Nome: min 2 caratteri
- Email: formato valido
- Password: min 8 caratteri, almeno 1 numero (indicatore forza password — barra 3 step: rosso/giallo/verde)
- Conferma: match con password

**Indicatore forza password:**
```
[■■■□] — 3 barre colorate (safety-red / safety-yellow / safety-green)
         Testo: "Debole" / "Media" / "Forte"
```

**CTA:** `[Crea account]` (full-width, `bg-brand-blue`, disabilitato finché form non valido).

**Link:** *"Hai già un account? Accedi"*

---

### 4.4 Onboarding (5 step, `/onboarding`)

Struttura: full-screen, step tracker in alto (5 punti/linee), pulsante "Avanti" fisso in fondo.

**Step tracker:** `flex gap-2` di 5 pallini: attivo = `bg-brand-blue w-8 h-2 rounded-full`; passati = `bg-brand-blue/40`; futuri = `bg-border-light`.

**Step 1 — Welcome**
- Illustrazione SVG/PNG centrata (mappa stilizzata, zone colorate)
- Titolo: *"Benvenuto su SafeRoute"* `font-display text-3xl font-bold`
- Testo: *"Scopri le zone sicure della tua città, imposta i tuoi contatti di emergenza e muoviti con più serenità."*
- CTA: `[Inizia]`

**Step 2 — Geolocalizzazione**
- Icona Lucide `MapPinIcon` 64px `text-brand-blue`
- Titolo: *"Dove ti trovi?"*
- Testo: *"Consenti la posizione per vedere le zone di sicurezza intorno a te."*
- CTA primario: `[Consenti posizione]` — triggera `navigator.geolocation.getCurrentPosition()`
- CTA secondario (link): *"Continua senza posizione"* — `text-text-secondary text-sm`
- Fallback (se negato): banner giallo informativo, testo: *"Puoi attivare la posizione in qualsiasi momento dalle impostazioni."* CTA: `[Continua senza posizione]`

**Step 3 — Aggiungi contatto emergenza**
- Icona `UsersIcon` 64px `text-safety-green`
- Titolo: *"Chi ti aspetta a casa?"*
- Form: Nome, Telefono (o Email), checkbox "Avvisa questo contatto che lo stai aggiungendo" (default: checked)
- CTA: `[Salva contatto]` + link `[Salta per ora]`
- Nota info: *"Potrai aggiungere fino a 3 contatti (piano gratuito)."*

**Step 4 — Spiega SOS**
- Animazione: il bottone SOS con progress ring che si riempie in loop
- Titolo: *"Il tasto SOS"*
- Testo: *"Tieni premuto il pulsante rosso per 1,5 secondi. I tuoi contatti riceveranno la tua posizione immediatamente."*
- Nota: *"Hai 5 secondi per annullare dopo l'invio."*
- CTA: `[Capito]`

**Step 5 — Entra nella mappa**
- Illustrazione celebrativa (check verde, mappa)
- Titolo: *"Sei pronto!"*
- Testo: *"Esplora la mappa, segnala le zone, resta al sicuro."*
- CTA: `[Apri la mappa]` → naviga a `/app/map`

**Animazione tra step:** slide orizzontale (step avanti = slide-left 300ms; indietro = slide-right 300ms). Usare CSS transform + transition, non animazioni che causano reflow.

---

### 4.5 Dashboard / Mappa (`/app/map`)

**Concetto:** La mappa occupa il 100% della viewport. Tutti gli UI element sono overlay floating.

```
┌─────────────────────────────────┐
│ [ConnectivityBanner] (top, z35) │  condizionale
│ ┌───────────────────────────┐   │
│ │ SearchBar (overlay, top)  │   │  z-20, mx-4 mt-4
│ └───────────────────────────┘   │
│                                 │
│        MAPPA LEAFLET            │  z-10, h-screen w-full
│    (zone colorate, pin utente)  │
│                                 │
│                       [SOS FAB] │  z-50, bottom-right
│                                 │
├─────────────────────────────────┤
│         MobileBottomNav         │  z-30
└─────────────────────────────────┘
```

**SearchBar (overlay):**
- Posizione: `absolute top-4 left-4 right-4` (mobile); `top-4 left-4 right-64` con sidebar attiva (desktop non ha bottom nav)
- Background: `bg-surface-elevated/95 dark:bg-surface-dark-elevated/95 backdrop-blur-sm`
- Border: `border border-border-light dark:border-border-dark rounded-xl`
- Altezza: 48px, padding `px-4`
- Icona Lucide `SearchIcon` a sinistra, `text-text-secondary`
- Placeholder: *"Cerca una via o zona..."*
- Ombra: `shadow-map`

**SOSButton FAB:**
- Vedi sezione 5.1 per specifica completa
- Posizione: `absolute bottom-24 right-4` (mobile, sopra bottom nav); `bottom-8 right-8` (desktop)

**Zone colorate sulla mappa:**
- Poligoni Leaflet con `fillColor` e `color` derivati da `safetyScore`
- Opacità fill: `0.35` (light mode), `0.45` (dark mode)
- Bordo: `weight: 2`, stessa tonalità del fill ma `opacity: 0.8`
- On click zona: apre `ZoneDetailsPanel` (bottom sheet) con slide-up

**Pin posizione utente:**
- Icona custom SVG: cerchio pieno `brand-blue` + bordo bianco + pulse ring animato
- Dimensione: 20px core + 40px ring

**Comportamento mobile vs desktop:**
- Mobile: SearchBar full-width, SOSButton sopra bottom nav
- Desktop: sidebar a sinistra, SearchBar occupa il centro, SOSButton in basso a destra

---

### 4.6 Gestione Contatti Emergenza (`/app/contacts`)

**Layout:** Lista verticale, full-width mobile, max-width 600px su desktop centrata.

**Header pagina:**
- Titolo: *"Contatti di emergenza"*
- Badge piano: `[FREE — 1/3 contatti]` oppure `[PREMIUM — illimitati]`
  - FREE: `bg-safety-yellow/20 text-yellow-700 dark:text-yellow-300 rounded-full px-3 py-1 text-sm font-medium`
  - PREMIUM: `bg-safety-green/20 text-green-700 dark:text-green-300 rounded-full px-3 py-1 text-sm font-medium`

**Lista contatti:**
- Ogni contatto è una `EmergencyContactCard` (vedi sezione 5.5)
- Drag-to-reorder opzionale (MVP: pulsanti su/giù)

**Pulsante aggiungi:**
- Se sotto limite: `[+ Aggiungi contatto]` — `bg-brand-blue text-white rounded-xl w-full py-3 font-semibold`
- Se al limite FREE: pulsante disabilitato + banner: *"Hai raggiunto il limite di 3 contatti per il piano gratuito. [Passa a Premium]"*
  - Link `[Passa a Premium]`: `text-brand-blue underline`

**Stato vuoto:**
- Illustrazione: icona `UsersIcon` 64px `text-text-secondary`
- Testo: *"Nessun contatto di emergenza. Aggiungine uno per essere più sicuro."*
- CTA: `[Aggiungi il primo contatto]`

---

### 4.7 Pagina SOS (`/app/sos` o overlay su `/app/map`)

La pagina SOS non è una route separata ma un layer sovrapposto alla mappa (z-50).

**Fasi:**

**Fase 0 — FAB visibile sulla mappa (normale)**
- Pulsante rosso 64px (vedi SOSButton spec)

**Fase 1 — Long-press in corso**
- Progress ring SVG che si riempie in 1.5 secondi
- Fondo FAB: `bg-sos-red` con pulse animation rossa
- Vibrazione aptica su mobile a completamento

**Fase 2 — Countdown annullamento (5 secondi)**
- Overlay full-screen: `bg-sos-red/90 backdrop-blur-sm` (z-50)
- Countdown numerico grande al centro: `text-8xl font-display font-bold text-white`
- Testo: *"SOS verrà inviato tra..."*
- Pulsante: `[Annulla]` — `bg-white text-sos-red rounded-full px-8 py-4 text-xl font-bold`
- Barra progresso inverted: si svuota in 5 secondi
- Vibrazione aptica a ogni secondo del countdown

**Messaggi rapidi (opzionale durante countdown):**
- 3 chip selezionabili: *"Sono in pericolo"* / *"Sono in un luogo sicuro"* / *"Falso allarme"*
- Se selezionato "Falso allarme": equivale ad Annulla

**Fase 3 — SOS inviato**
- Overlay rimane: testo *"SOS inviato. I tuoi contatti sono stati avvisati."*
- Icona check verde 64px
- Bottone: `[Chiudi]` dopo 3 secondi
- Pulsante 112: `[Chiama il 112]` — `tel:112`

**Accessibilità SOS:**
- `aria-label="Pulsante SOS di emergenza. Tieni premuto per 1,5 secondi per attivare."`
- `role="button"` con `aria-pressed`
- Alternativa tastiera: `Enter` + tasto tenuto premuto (via keydown/keyup events)
- Durante countdown: `aria-live="assertive"` sul countdown numerico

---

### 4.8 Admin Dashboard (`/admin`)

**Nota:** Placeholder per giornata 1. Solo frontend mock, nessuna funzione reale.

**Layout:** Sidebar admin a sinistra (separata dalla sidebar utente), contenuto a destra.

**Sidebar admin:**
- Voci: Overview, Utenti, Zone, Segnalazioni, Impostazioni
- Background: `bg-brand-navy text-white` (sempre dark, anche in light mode)
- Logo in cima, versione testo piccolo "Admin Panel"

**Overview cards (4):**

| Card | Valore mock | Icona | Colore bordo |
|------|------------|-------|-------------|
| Utenti totali | 1.247 | `UsersIcon` | brand-blue |
| Zone attive | 342 | `MapIcon` | safety-green |
| SOS inviati (30gg) | 18 | `AlertTriangleIcon` | safety-red |
| Feedback ricevuti | 892 | `StarIcon` | safety-yellow |

Card spec: `bg-surface-elevated dark:bg-surface-dark-elevated rounded-xl p-6 shadow-md border-l-4`

**Tabella utenti mock:**
- Colonne: ID, Nome, Email, Piano, Registrato, Stato
- Righe: 5 mock users
- Paginazione mock: `< 1 2 3 >`
- Barra di ricerca sopra la tabella
- Badge Piano: `FREE` (grigio) / `PREMIUM` (verde)
- Badge Stato: `Attivo` (verde) / `Sospeso` (rosso)

**Desktop only:** L'admin dashboard non ha versione mobile ottimizzata in giornata 1. Su mobile mostra banner: *"La dashboard admin è disponibile solo su desktop."*

---

## 5. Componenti Chiave — Visual Spec

### 5.1 `SOSButton`

```
Tipo: FAB (Floating Action Button)
Dimensioni: 64×64px
Shape: border-radius: full (cerchio)
Colore default: bg-sos-red (#DC2626)
Icona: AlertTriangleIcon (Lucide) 28px, colore white
Shadow default: shadow-sos
```

| Stato | Stile |
|-------|-------|
| Default | `bg-sos-red shadow-sos` |
| Hover | `bg-red-700 scale-105 transition-transform 150ms` |
| Long-press in corso | Progress ring SVG sovrapposto, pulse animation rossa `animate-pulse` |
| Disabled (es. offline) | `bg-safety-gray opacity-60 cursor-not-allowed` — ma per policy SOS mai completamente disabilitato |
| Dark mode | Nessuna variazione (il rosso rimane invariato per urgenza) |

**Progress ring SVG:**
- `<svg>` 72×72px sovrapposto al button
- `<circle>` stroke: `sos-red-ring`, stroke-dasharray dinamico via JS
- `stroke-width: 4`, `fill: none`
- Animazione: `stroke-dashoffset` da 226 a 0 in 1500ms linear

**Pulse animation:**
```css
@keyframes sos-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
  50%       { box-shadow: 0 0 0 12px rgba(239,68,68,0); }
}
```

---

### 5.2 `StatusBadge`

```
Tipo: pill inline
Altezza: 24px (testo sm)
Padding: px-3 py-1
Border-radius: full
```

| Variante | Background | Testo | Dot |
|----------|-----------|-------|-----|
| safe | `bg-safety-green/15` | `text-green-700 dark:text-green-400` | `bg-safety-green` |
| caution | `bg-safety-yellow/15` | `text-yellow-700 dark:text-yellow-300` | `bg-safety-yellow` |
| danger | `bg-safety-red/15` | `text-red-700 dark:text-red-400` | `bg-safety-red` |
| critical | `bg-safety-purple/15` | `text-purple-700 dark:text-purple-400` | `bg-safety-purple` |
| unknown | `bg-safety-gray/20` | `text-text-secondary` | `bg-safety-gray` |
| offline | `bg-offline-yellow/15` | `text-amber-700 dark:text-amber-300` | `bg-offline-yellow` |

Struttura interna: `[dot 8px] [testo]` — il dot è sempre presente (non solo il colore).

---

### 5.3 `ZoneDetailsPanel`

Tipo: bottom sheet, appare quando l'utente clicca una zona sulla mappa.

```
Width: 100vw (mobile) / max-width 480px centrato (desktop)
Border-radius: rounded-t-3xl (mobile), rounded-2xl (desktop — modale centrata)
Background: bg-surface-elevated dark:bg-surface-dark-elevated
Shadow: shadow-sheet
Padding: px-6 pt-4 pb-8 + safe-bottom
```

**Contenuto:**
- Handle grip: `w-12 h-1.5 bg-border-light dark:bg-border-dark rounded-full mx-auto mb-4`
- Nome zona: `text-xl font-display font-semibold`
- `StatusBadge` per il livello di sicurezza
- Safety score: numero grande `text-4xl font-bold` + label "/ 100"
  - Se score null: *"Nessun dato"* in grigio, testo esplicativo
- 3 statistiche mock: Segnalazioni, Percorsi completati, Feedback
- Separator
- CTA: `[Segnala questa zona]` (outline button) + `[Aggiungi feedback]`
- Se score null: CTA prominente: *"Sii il primo a segnalare"* in blue

**Drag to dismiss:** on swipe-down, chiude con slide-down animation 250ms.

**Animazione apertura:** `translateY(100%) → translateY(0)` 300ms spring (cubic-bezier(0.34, 1.56, 0.64, 1)).

---

### 5.4 `ConnectivityBanner`

```
Position: fixed top-0 left-0 right-0
Height: auto (min 48px)
z-index: z-banner (35)
Padding: px-4 py-3
```

| Stato | Background | Testo | Icona |
|-------|-----------|-------|-------|
| Offline | `bg-offline-yellow` | `text-amber-900` | `WifiOffIcon` |
| Connessione lenta | `bg-orange-500` | `text-white` | `SignalIcon` |
| Geolocalizzazione non disponibile | `bg-slate-700` | `text-white` | `MapPinOffIcon` |

**Struttura:** `[Icona] [Testo messaggio] [pulsante X opzionale]`

Testi:
- Offline: *"Connessione assente — modalità limitata"*
- Geo negata: *"Posizione non disponibile. Alcune funzioni sono limitate."*

**Comportamento:** Appare/scompare con slide-down/up animation 200ms. Occupa spazio nel layout (non overlay), quindi il contenuto sottostante viene spostato giù.

---

### 5.5 `EmergencyContactCard`

```
Border-radius: rounded-xl (12px)
Background: bg-surface-elevated dark:bg-surface-dark-elevated
Border: border border-border-light dark:border-border-dark
Padding: p-4
Shadow: shadow-sm
```

**Layout interno:**
```
[Avatar] [Nome + Info]      [Delete button]
  48px    Nome: font-semibold  36×36px, ghost
           Tel/Email: text-sm text-secondary
```

**Avatar:** Cerchio 48×48px, `bg-brand-blue/20 dark:bg-brand-blue/30 text-brand-blue`, iniziali nome (2 lettere maiuscole), `font-semibold text-lg`.

**Delete button:** Icona `Trash2Icon` 18px, colore `text-text-secondary hover:text-safety-red`, `transition-colors 150ms`. Su click: conferma modale inline ("Rimuovere [Nome]?") prima di eliminare.

**Stato hover card:** `hover:shadow-md hover:border-brand-blue/40 transition-all 150ms`.

**Notifica inviata:** badge piccolo `[Avvisato]` in verde se `notifiedOnAdd = true`.

---

### 5.6 `SafetyBottomSheet`

Componente generico riutilizzato da `ZoneDetailsPanel`, `FeedbackModal`, e altri pannelli.

```
Position: fixed bottom-0 left-0 right-0
z-index: z-sheet (20)
Background: bg-surface-elevated dark:bg-surface-dark-elevated
Border-radius: rounded-t-3xl
Backdrop: ::before pseudo-element, bg-black/40 backdrop-blur-sm, z-10
```

**Animazione:**
- Apertura: `transform: translateY(100%) → translateY(0)`, durata 300ms, easing `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring leggero)
- Chiusura: `translateY(0) → translateY(100%)`, durata 200ms, easing `ease-in`
- Backdrop: `opacity: 0 → 1` parallelo all'apertura, 300ms `ease-out`

**Handle drag:**
- Striscia `w-12 h-1.5` centrata in cima al sheet
- On swipe-down (>100px): chiude il sheet
- Touch threshold: 10px per evitare chiusure accidentali

**Accessibilità:**
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- Focus trap: il focus rimane all'interno del sheet quando aperto
- `Escape` per chiudere
- `aria-hidden="true"` sul contenuto dietro il backdrop

---

## 6. Animazioni e Microinterazioni

### 6.1 Page Transitions

Transizione applicata da Vue Router su `<RouterView>`:
- Tipo: fade + slide-up leggero
- Durata: 150ms ease-out
- Implementazione: Vue transition `<Transition name="page">`

```css
/* src/assets/transitions.css */
.page-enter-active { transition: opacity 150ms ease-out, transform 150ms ease-out; }
.page-leave-active { transition: opacity 100ms ease-in, transform 100ms ease-in; }
.page-enter-from   { opacity: 0; transform: translateY(8px); }
.page-leave-to     { opacity: 0; transform: translateY(-4px); }
```

### 6.2 Bottom Sheet Slide-Up

```css
.sheet-enter-active { transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.sheet-leave-active { transition: transform 200ms ease-in; }
.sheet-enter-from   { transform: translateY(100%); }
.sheet-leave-to     { transform: translateY(100%); }
```

### 6.3 SOSButton Long-Press

1. `pointerdown`: avvia `setInterval` ogni 15ms, incrementa progress (0→100 in 1500ms)
2. Aggiorna `stroke-dashoffset` del progress ring SVG: `226 - (226 * progress / 100)`
3. Aggiunge classe `animate-pulse` al shadow
4. `pointerup` prima del 100%: reset, rimuove animazioni
5. A 100%: triggera feedback aptico (`navigator.vibrate([200, 100, 200])`), avvia countdown 5s

### 6.4 Mappa — Click Zona

1. Utente tocca poligono zona
2. Poligono: `fillOpacity: 0.35 → 0.55` in 150ms (Leaflet `setStyle`)
3. `SafetyBottomSheet` appare con slide-up 300ms (spring)
4. Se altra zona era selezionata: reset prima, poi nuova selezione

### 6.5 Dark/Light Switch

Transizione globale 200ms su background e colori (vedi sezione 2). La mappa aggiorna il tile layer senza reload.

### 6.6 Onboarding Step Transition

```css
/* Avanzamento step */
.step-enter-from { opacity: 0; transform: translateX(32px); }
.step-enter-to   { opacity: 1; transform: translateX(0); }

/* Indietro */
.step-leave-to   { opacity: 0; transform: translateX(-32px); }
```
Durata 250ms ease-out.

### 6.7 Form Validation Shake

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}
.shake { animation: shake 300ms ease-out; }
```

### 6.8 `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .sheet-enter-active,
  .sheet-leave-active,
  .page-enter-active,
  .page-leave-active { transition: opacity 150ms ease !important; }
}
```

---

## 7. Accessibilità

### 7.1 Touch Targets

Tutti i controlli interattivi: minimo **48×48px** su mobile.
- Bottom nav: ogni voce `min-w-[64px] min-h-[48px] flex items-center justify-center`
- SOSButton: 64×64px (sopra il minimo)
- Delete button EmergencyContactCard: `p-2 -m-2` per espandere l'area toccabile senza ingrandire visivamente

### 7.2 Focus Ring

Classe globale applicata via `@layer base` in Tailwind:
```css
:focus-visible {
  outline: 2px solid theme('colors.brand-blue');
  outline-offset: 2px;
  border-radius: 4px;
}
:focus:not(:focus-visible) {
  outline: none;
}
```

### 7.3 Contrasto Colori

| Combinazione | Ratio minimo richiesto | Note |
|-------------|----------------------|------|
| Testo su background light | 4.5:1 (AA) | `text-primary` (#0F172A) su #F8FAFC = OK |
| Testo su background dark | 4.5:1 (AA) | `text-dark-primary` (#F1F5F9) su #0F172A = OK |
| Badge safety su background | 3:1 (UI non-testo) | Tutti i safety colors su sfondo bianco superano |
| Testo su safety-yellow | **Attenzione**: testo scuro obbligatorio | `text-yellow-900` o `text-amber-900` |

### 7.4 Colori Non Unici

I colori di sicurezza sono sempre accompagnati da:
- `StatusBadge`: dot + testo label ("Sicuro", "Attenzione", "Pericoloso", "Molto pericoloso", "Sconosciuto")
- Zone mappa: tooltip al click con nome e descrizione testuale del livello
- Pulsante SOS: icona + label `aria-label` + testo alternativo

### 7.5 Regioni Live

```html
<!-- In App.vue o nel componente mappa -->
<div aria-live="polite" aria-atomic="true" class="sr-only" id="map-updates">
  <!-- Aggiornato via JS quando la posizione cambia -->
</div>
<div aria-live="assertive" aria-atomic="true" class="sr-only" id="sos-status">
  <!-- Aggiornato durante SOS countdown -->
</div>
```

### 7.6 Testo Solo Schermo (`sr-only`)

Classe Tailwind `sr-only` per etichette aggiuntive non visibili ma lette dagli screen reader:
- Icone standalone senza testo: `<span class="sr-only">Apri menu</span>`
- Valori numerici: `<span class="sr-only">Safety score:</span> 78`

### 7.7 Labels Input

Tutti gli `<input>` hanno:
- `<label>` associato con `for`/`id`
- `placeholder` NON sostituisce la label
- `aria-describedby` sull'errore inline quando presente

---

## 8. Mock Data Structure

File da creare: `src/mock/data.ts`

### 8.1 `mockUser`

```ts
export const mockUser = {
  id: 'usr_001',
  name: 'Giulia Ferretti',
  email: 'giulia.ferretti@example.com',
  role: 'USER',
  plan: 'FREE',                   // 'FREE' | 'PREMIUM'
  onboardingCompleted: true,
  geolocationGranted: true,
  createdAt: '2025-03-15T10:30:00Z',
  avatarInitials: 'GF',
}
```

### 8.2 `mockAdminUser`

```ts
export const mockAdminUser = {
  id: 'usr_admin_001',
  name: 'Marco Rossi',
  email: 'admin@saferoute.app',
  role: 'ADMIN',
  plan: 'PREMIUM',
  onboardingCompleted: true,
  geolocationGranted: true,
  createdAt: '2025-01-01T09:00:00Z',
  avatarInitials: 'MR',
}
```

### 8.3 `mockEmergencyContacts`

```ts
export const mockEmergencyContacts = [
  {
    id: 'ec_001',
    userId: 'usr_001',
    name: 'Luca Ferretti',
    phone: '+39 333 1234567',
    email: null,
    notifiedOnAdd: true,
    createdAt: '2025-03-15T10:35:00Z',
  },
  {
    id: 'ec_002',
    userId: 'usr_001',
    name: 'Sara Conti',
    phone: null,
    email: 'sara.conti@example.com',
    notifiedOnAdd: false,
    createdAt: '2025-03-20T14:20:00Z',
  },
]
```

### 8.4 `mockZones`

```ts
export const mockZones = [
  {
    id: 'zone_001',
    name: 'Centro Storico',
    cityId: 'city_mi',
    safetyScore: 85,                // Verde (80–100)
    color: '#22C55E',               // derivato a runtime, incluso nel mock per semplicità
    level: 'safe',                  // 'safe' | 'caution' | 'danger' | 'critical' | 'unknown'
    feedbackCount: 142,
    routeCount: 893,
    sosCount: 0,
    geometry: { type: 'Polygon', coordinates: [[/* punti GeoJSON */]] },
  },
  {
    id: 'zone_002',
    name: 'Stazione Centrale',
    cityId: 'city_mi',
    safetyScore: 62,                // Giallo (60–79)
    color: '#FACC15',
    level: 'caution',
    feedbackCount: 78,
    routeCount: 341,
    sosCount: 3,
    geometry: { type: 'Polygon', coordinates: [[/* punti GeoJSON */]] },
  },
  {
    id: 'zone_003',
    name: 'Quartiere Greco',
    cityId: 'city_mi',
    safetyScore: 41,                // Rosso (35–59)
    color: '#EF4444',
    level: 'danger',
    feedbackCount: 34,
    routeCount: 98,
    sosCount: 7,
    geometry: { type: 'Polygon', coordinates: [[/* punti GeoJSON */]] },
  },
  {
    id: 'zone_004',
    name: 'Viale Monza Notte',
    cityId: 'city_mi',
    safetyScore: 18,                // Viola (0–34)
    color: '#8B5CF6',
    level: 'critical',
    feedbackCount: 12,
    routeCount: 24,
    sosCount: 11,
    geometry: { type: 'Polygon', coordinates: [[/* punti GeoJSON */]] },
  },
  {
    id: 'zone_005',
    name: 'Nuova Lottizzazione Est',
    cityId: 'city_mi',
    safetyScore: null,              // Grigio / unknown
    color: '#CBD5E1',
    level: 'unknown',
    feedbackCount: 0,
    routeCount: 2,
    sosCount: 0,
    geometry: { type: 'Polygon', coordinates: [[/* punti GeoJSON */]] },
  },
]
```

### 8.5 `mockRouteSession`

```ts
export const mockRouteSession = {
  id: 'route_001',
  userId: 'usr_001',
  status: 'active',               // 'active' | 'completed' | 'abandoned'
  startedAt: '2026-06-21T21:30:00Z',
  completedAt: null,
  origin: { lat: 45.4654, lng: 9.1866 },
  destination: { lat: 45.4719, lng: 9.2025 },
  trackingToken: 'tok_abc123xyz',
  trackingTokenExpiresAt: '2026-06-21T23:30:00Z',
  locationPings: [
    { lat: 45.4654, lng: 9.1866, timestamp: '2026-06-21T21:30:00Z', accuracy: 10 },
    { lat: 45.4661, lng: 9.1880, timestamp: '2026-06-21T21:30:15Z', accuracy: 8 },
  ],
}
```

### 8.6 `mockSOSAlerts`

```ts
export const mockSOSAlerts = [
  {
    id: 'sos_001',
    userId: 'usr_001',
    status: 'sent',               // 'pending' | 'sent' | 'cancelled' | 'false_alarm'
    triggeredAt: '2026-06-10T23:15:00Z',
    cancelledAt: null,
    location: { lat: 45.4654, lng: 9.1866 },
    locationAvailable: true,
    message: 'SOS automatico da SafeRoute',
    contactsNotified: ['ec_001', 'ec_002'],
    smsDelivered: true,
    emailDelivered: true,
  },
  {
    id: 'sos_002',
    userId: 'usr_001',
    status: 'cancelled',
    triggeredAt: '2026-06-18T22:00:00Z',
    cancelledAt: '2026-06-18T22:00:04Z',  // Annullato in 4 secondi
    location: { lat: 45.4700, lng: 9.1900 },
    locationAvailable: true,
    message: null,
    contactsNotified: [],
    smsDelivered: false,
    emailDelivered: false,
  },
]
```

---

## 9. Checklist Pre-Implementazione

Prima di consegnare il codice al team, il frontend-agent deve verificare:

- [ ] Nessuna emoji usata come icona (usare SVG: Lucide Vue)
- [ ] `cursor-pointer` su tutti gli elementi cliccabili
- [ ] Hover state con transizione 150–300ms su tutti i controlli interattivi
- [ ] Contrasto testo 4.5:1 minimo in light mode
- [ ] Focus ring visibile in navigazione da tastiera
- [ ] `prefers-reduced-motion` rispettato
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] Nessun contenuto nascosto sotto navbar fisse senza padding compensativo
- [ ] Nessuno scroll orizzontale su mobile
- [ ] Touch target minimo 48×48px su tutti i controlli mobile
- [ ] Colori safety mai comunicati solo col colore (sempre testo + icona + colore)
- [ ] SOS button visibile in tutte le condizioni (inclusa modalità offline)
- [ ] `aria-live` regions attivi per posizione e stato SOS
- [ ] Dark mode: mappa usa Carto Dark Matter, non CSS filter

---

## 10. Note e Problemi Rilevati nei Documenti Esistenti

I seguenti punti sono **coerenti** tra i documenti; nessun conflitto critico trovato. Si riportano alcune ambiguità minori per il team:

1. **`design-system.md` parla di ConnectivityBanner in basso** (*"banner non intrusivo in basso"*), mentre la specifica di layout in questo documento lo posiziona in alto. Il posizionamento in **alto** è corretto per garantire visibilità senza interferire con la bottom nav e il SOSButton. Il documento originale va interpretato come linea guida di non-intrusività, non di posizione letterale.

2. **Long-press SOS: 1,5 secondi vs countdown 5 secondi**: il `design-system.md` indica correttamente 1,5s per il long-press e 5s per il countdown post-attivazione. Questa specifica mantiene entrambi i valori distinti.

3. **Geolocalizzazione — step onboarding vs banner**: il design-system.md descrive il fallback geo durante l'onboarding (step 2 non si blocca) e un banner fisso sulla mappa. Questa specifica implementa entrambi come indicato.

4. **"vue" non è nelle opzioni `--stack` della skill `ui-ux-pro-max`** (sono disponibili: `html-tailwind`, `react`, `nextjs`). La skill è stata consultata a livello di codice sorgente e i principi applicati sono stati adattati allo stack Vue 3 + Tailwind.

5. **Python non disponibile nell'ambiente di sviluppo**: gli script `.claude/skills/ui-ux-pro-max/scripts/search.py` non hanno potuto essere eseguiti (Python non installato). Il design system è stato prodotto integralmente dai documenti del progetto + knowledge base integrata.
