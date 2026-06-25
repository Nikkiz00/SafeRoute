# Report Step 2.2 — Legal & Trust Layer

**Data:** 2026-06-23

---

## Aggiunto

### Pagina Privacy (/privacy) [DONE]

Nuova pagina pubblica `frontend/src/pages/PrivacyPage.vue` accessibile senza autenticazione.
Contiene: titolare del trattamento, dati raccolti (posizione, contatti emergenza, email), finalità d'uso, conservazione, diritti dell'utente, contatto `privacy@saferoute.app`.
Tono: startup early-stage onesta — include note su funzionalità "in fase di implementazione".

### Pagina Termini (/terms) [DONE]

Nuova pagina pubblica `frontend/src/pages/TermsPage.vue` accessibile senza autenticazione.
Contiene: descrizione del servizio, obblighi utente, limitazioni di responsabilità, clausola che SafeRoute non è un servizio di emergenza professionale, contatto `support@saferoute.app`.

### Pagina Supporto (/support) [DONE]

Nuova pagina pubblica `frontend/src/pages/SupportPage.vue` accessibile senza autenticazione.
Contiene: FAQ (zone, SOS, tracking, privacy), form di contatto e/o email di supporto `support@saferoute.app`.

### Router aggiornato [DONE]

`frontend/src/router/index.ts` — aggiunte tre nuove route pubbliche:
- `/privacy` → `PrivacyPage.vue`
- `/terms` → `TermsPage.vue`
- `/support` → `SupportPage.vue`

Tutte con `meta: { public: true }`, coerente con il guard di navigazione esistente.

### Footer pubblico aggiornato [DONE]

`frontend/src/pages/LandingPage.vue` — il footer ora include link funzionanti a:
- `/privacy` — Privacy Policy
- `/terms` — Termini di utilizzo
- `/support` — Supporto

Footer professionale con nome app, anno e link legali. Prima conteneva solo placeholder o nessun link.

### Sezione "Come funziona" nella landing [DONE]

`frontend/src/pages/LandingPage.vue` — aggiunta sezione con 4 step sequenziali:
1. Aggiungi i tuoi contatti di fiducia
2. Scegli il tuo percorso sulla mappa
3. Il tracking live è condiviso con chi hai scelto
4. SOS con un tocco se hai bisogno di aiuto

Aiuta i nuovi utenti a capire il flusso prima della registrazione.

### Disclaimer safety — LandingPage [DONE]

`frontend/src/pages/LandingPage.vue` — aggiunto disclaimer sotto i CTA hero che chiarisce che SafeRoute è uno strumento di supporto alla sicurezza personale e non sostituisce i servizi di emergenza ufficiali (112).

### Microcopy trust — ContactsPage [DONE]

`frontend/src/pages/ContactsPage.vue` — aggiunta nota informativa nel modale/form di aggiunta contatto:

> "I contatti che aggiungi riceveranno una notifica email o SMS se attivi un SOS. Aggiungi solo persone di cui hai il consenso. I loro dati sono usati esclusivamente per le notifiche di emergenza."

### Microcopy trust — SOSPage [DONE]

`frontend/src/pages/SOSPage.vue` — aggiunto disclaimer visibile nella pagina SOS:

> "SafeRoute invia la tua posizione ai tuoi contatti di emergenza. Non sostituisce il 112. In caso di pericolo reale, chiama sempre i servizi di emergenza."

Link diretto a `tel:112` presente in più punti della pagina (fase idle, countdown, sent).

### Microcopy trust — RouteStartModal [DONE]

`frontend/src/components/map/RouteStartModal.vue` — aggiunta nota orientativa sopra il CTA di avvio percorso:

> "Il percorso mostrato e' orientativo. I dati di sicurezza provengono dalla community."

Nota separata per il fallback OSRM (banner giallo da Step 2.1): "Percorso indicativo: al momento non è stato possibile calcolare il tragitto reale. La linea mostrata è solo orientativa."

### Microcopy trust — TrackingPublicPage [DONE]

`frontend/src/pages/TrackingPublicPage.vue` — aggiunto footer disclaimer mostrato quando il tracking è attivo:

> "Questa pagina mostra la posizione condivisa volontariamente dall'utente. In caso di emergenza reale, chiama il 112."

### Microcopy trust — ZoneDetailsPanel [DONE]

`frontend/src/components/map/ZoneDetailsPanel.vue` — aggiunta nota sotto i dati della zona:

> "I dati di sicurezza di questa zona si basano sui feedback della community e non sono verificati da autorita' ufficiali. Usa sempre il tuo giudizio personale."

### Consenso termini — RegisterPage [DONE]

`frontend/src/pages/RegisterPage.vue` — aggiunta riga di consenso sopra il pulsante di registrazione con link reali alle pagine legali:

> "Registrandoti accetti i [Termini di utilizzo] e la [Privacy Policy]."

I link utilizzano `<RouterLink>` a `/terms` e `/privacy`.

---

## Non coperto in questo step

| Elemento | Motivazione rinvio |
|---|---|
| GDPR formale (data subject rights, DPA, registro trattamenti) | Richiede consulenza legale esterna |
| Cookie banner | Nessuna analytics o cookie di terze parti attivi al momento |
| Job cancellazione dati automatica | Richiede BullMQ/scheduler — step tecnico futuro |
| SMS reale (Twilio) | Richiede account provider e secrets produzione |
| Privacy policy certificata da avvocato | Testo attuale è per early-stage, non per go-live legale |

---

## Testi chiave inseriti

I cinque disclaimer più importanti aggiunti in questo step, con localizzazione esatta:

- **SOSPage.vue** (sezione safety disclaimer, stato `idle`): "SafeRoute invia la tua posizione ai tuoi contatti di emergenza. Non sostituisce il 112. In caso di pericolo reale, chiama sempre i servizi di emergenza."

- **ZoneDetailsPanel.vue** (nota dati community, sotto stats zona): "I dati di sicurezza di questa zona si basano sui feedback della community e non sono verificati da autorita' ufficiali. Usa sempre il tuo giudizio personale."

- **RouteStartModal.vue** (sopra pulsante Avvia percorso): "Il percorso mostrato e' orientativo. I dati di sicurezza provengono dalla community."

- **TrackingPublicPage.vue** (footer disclaimer, tracking attivo): "Questa pagina mostra la posizione condivisa volontariamente dall'utente. In caso di emergenza reale, chiama il 112."

- **ContactsPage.vue** (form aggiunta contatto): "I contatti che aggiungi riceveranno una notifica email o SMS se attivi un SOS. Aggiungi solo persone di cui hai il consenso. I loro dati sono usati esclusivamente per le notifiche di emergenza."

---

## Stato TypeScript

Nessun errore TypeScript introdotto in questo step. Le modifiche riguardano esclusivamente:
- aggiunta di nuovi componenti Vue `.vue` (pagine statiche senza logica complessa)
- aggiunta di route nel router (oggetti literal, nessun nuovo tipo)
- aggiunta di testo statico in template `.vue` esistenti (nessun impatto sui tipi)
