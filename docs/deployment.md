# Deployment

## MVP consigliato

Frontend:
- Vercel o Netlify

Backend:
- VPS, Railway o Render

Database:
- MariaDB su VPS o servizio managed

## Variabili env principali

Backend:
- DATABASE_URL
- JWT_SECRET
- JWT_REFRESH_SECRET
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS
- SMS_PROVIDER
- SMS_API_KEY
- AI_ENABLED=false
- AI_PROVIDER=none

Frontend:
- VITE_API_URL
- VITE_APP_NAME=SafeRoute
