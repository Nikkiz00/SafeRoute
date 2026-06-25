# SafeRoute Starter Pack

Struttura iniziale per sviluppare SafeRoute con Claude Code / Codex in modo modulare, evitando prompt enormi e consumo inutile di token.

## Stack scelto

- Frontend: Vue 3 + Vite + TypeScript + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Database: MariaDB + Prisma ORM
- Mappe: Leaflet + OpenStreetMap
- Auth: JWT con refresh/persistenza login
- Admin: integrata nella stessa app in `/admin`
- SMS: provider economico configurabile, consigliato Twilio/Vonage/MessageBird in base al prezzo finale
- Email: SMTP configurabile
- AI: opzionale, disattivata di default, provider configurabili in futuro

## Come usare questo pack

1. Copia tutto dentro il repository GitHub SafeRoute.
2. Apri Claude Code nella root del progetto.
3. Leggi prima `.claude/CLAUDE.md`.
4. Avvia una giornata alla volta usando i file in `roadmap/`.
5. Non chiedere mai a Claude di sviluppare tutto insieme.

## Ordine consigliato

1. `roadmap/day-01-foundation.md`
2. `roadmap/day-02-auth-onboarding.md`
3. `roadmap/day-03-map-zones.md`
4. `roadmap/day-04-routing-feedback.md`
5. `roadmap/day-05-sos-tracking.md`
6. `roadmap/day-06-admin.md`
7. `roadmap/day-07-polish-deploy.md`
8. `roadmap/day-07-5.md`
9. `roadmap/day-07-6.md`
10. `roadmap/day-07-7.md`

## Configurazione

Copiare `backend/.env.example` in `backend/.env` e compilare i valori:

```bash
cp backend/.env.example backend/.env
```

Il file `.env.example` contiene tutte le variabili accettate con valori placeholder. Le variabili obbligatorie sono `DATABASE_URL`, `JWT_SECRET` e `JWT_REFRESH_SECRET`. Tutte le altre (SMTP, SMS) sono opzionali.

### Aggiornamento schema database

Dopo ogni aggiornamento allo schema Prisma (pull o nuovi task), eseguire:

```bash
cd backend && npx prisma generate && npx prisma db push
```

### Verifica email in development

Se SMTP non è configurato nel `.env`, le email di verifica account **non vengono inviate** ma il **link/token viene stampato in console** dal backend. Questo permette di testare il flusso di verifica senza un server SMTP.

Per testare in development: avviare il backend, registrare un utente, copiare il link dalla console e aprirlo nel browser.

## Configurazione Email (opzionale)

Le notifiche email SOS e la verifica account richiedono un server SMTP. Configurare in `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tuaemail@gmail.com
SMTP_PASS=app-password-qui
SMTP_FROM=SafeRoute <noreply@saferoute.app>
```

Se SMTP non è configurato, le notifiche email vengono saltate silenziosamente.
Il server avvia comunque senza errori.

### Test email in development

```
GET http://localhost:3000/api/health/email   # verifica configurazione
POST http://localhost:3000/api/dev/test-email  # invia email di test
  Body: { "to": "tua@email.com" }
```

### Errori SMTP comuni

**535 Authentication Failed**
Non usare la password normale. Usa una App Password:
- **Gmail**: [myaccount.google.com](https://myaccount.google.com) → Sicurezza → Password per le app
- **Zoho Mail**: Impostazioni → Sicurezza → Password specifiche per app
- **Brevo (ex Sendinblue)**: imposta `SMTP_USER=apikey` e `SMTP_PASS=<API-key-SMTP>`

**Verifica configurazione (solo development)**
```bash
curl http://localhost:3000/api/health/email
```
Risponde con `status: "OK"` se connessione riuscita, `status: "SMTP_AUTH_FAILED"` se autenticazione fallisce.

## Regola principale

Ogni giornata deve concludersi con:

- codice funzionante;
- commit consigliato;
- breve report di cosa è stato fatto;
- problemi aperti;
- task successivi.
