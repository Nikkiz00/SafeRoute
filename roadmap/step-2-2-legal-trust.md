# Step 2.2 — Legal & Trust Layer

**Data:** 2026-06-23
**Tipo:** Legal, Trust, UX transparency
**Scope:** Nessuna nuova feature di prodotto. Solo pagine legali, disclaimer e microcopy.

---

## Obiettivo

Aggiungere il layer di fiducia e trasparenza che rende SafeRoute pubblicabile:
pagine legali (privacy, termini, supporto), disclaimer safety nei punti critici,
microcopy onesto per l'utente, footer professionale, sezione "come funziona".

---

## Cosa è stato aggiunto

### Pagine create

- `frontend/src/pages/PrivacyPage.vue` — Informativa dati personali, pubblica, route `/privacy`
- `frontend/src/pages/TermsPage.vue` — Termini di utilizzo, pubblica, route `/terms`
- `frontend/src/pages/SupportPage.vue` — FAQ e contatti supporto, pubblica, route `/support`

### Router aggiornato

- `frontend/src/router/index.ts` — aggiunte route `/privacy`, `/terms`, `/support` con `meta: { public: true }`

### Componenti aggiornati

- `frontend/src/pages/LandingPage.vue` — footer con link reali a /privacy, /terms, /support; sezione "Come funziona" (4 step); disclaimer safety sotto i CTA hero
- `frontend/src/pages/ContactsPage.vue` — microcopy uso dati contatti emergenza
- `frontend/src/pages/SOSPage.vue` — disclaimer 112 in fondo alla pagina
- `frontend/src/components/map/RouteStartModal.vue` — nota "percorso orientativo" sopra il CTA avvio
- `frontend/src/pages/TrackingPublicPage.vue` — footer disclaimer quando tracking attivo
- `frontend/src/components/map/ZoneDetailsPanel.vue` — nota dati community
- `frontend/src/pages/RegisterPage.vue` — link a /terms e /privacy sopra il pulsante registra

### Punti disclaimer aggiunti

| Posizione | Testo/contenuto |
|---|---|
| `LandingPage.vue` — hero CTA | Disclaimer safety: SafeRoute è uno strumento di supporto, non sostituisce le autorità di emergenza |
| `SOSPage.vue` — fondo pagina | Nota: in caso di pericolo reale, contattare il 112 |
| `RouteStartModal.vue` — sopra CTA | "Percorso orientativo — verifica sempre le condizioni reali" |
| `TrackingPublicPage.vue` — footer | Disclaimer tracking attivo e scopo del servizio |
| `ZoneDetailsPanel.vue` — nota dati | "Dati basati su segnalazioni della community" |
| `ContactsPage.vue` — info dati | Spiegazione uso dati contatti emergenza |
| `RegisterPage.vue` — sopra pulsante | Link e accettazione /terms e /privacy |

---

## File modificati

**Nuovi file:**
- `frontend/src/pages/PrivacyPage.vue`
- `frontend/src/pages/TermsPage.vue`
- `frontend/src/pages/SupportPage.vue`

**File aggiornati:**
- `frontend/src/router/index.ts`
- `frontend/src/pages/LandingPage.vue`
- `frontend/src/pages/ContactsPage.vue`
- `frontend/src/pages/SOSPage.vue`
- `frontend/src/components/map/RouteStartModal.vue`
- `frontend/src/pages/TrackingPublicPage.vue`
- `frontend/src/components/map/ZoneDetailsPanel.vue`
- `frontend/src/pages/RegisterPage.vue`

**Documentazione:**
- `docs/architecture.md` — aggiunta sezione "Pagine pubbliche"
- `roadmap/step-2-2-legal-trust.md` — questo file

---

## Cosa NON è coperto (rimandato)

- GDPR completo (data subject rights formali, DPA, registro trattamenti)
- Cookie banner (nessuna analytics o cookie di terze parti per ora)
- Privacy policy legalmente certificata da avvocato
- Twilio SMS reale
- Cancellazione dati automatica tramite job schedulato

---

## Note

- I testi sono scritti per una startup early-stage onesta, non per una corporate.
- I riferimenti futuri ("in fase di implementazione") sono intenzionalmente onesti.
- La email `support@saferoute.app` e `privacy@saferoute.app` sono placeholder da configurare prima del deploy reale.
- Tutte le nuove route sono marcate `meta: { public: true }` — coerente con il guard esistente nel router.
