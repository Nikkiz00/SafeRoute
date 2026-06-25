import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import { prisma } from './config/database.js'
import authRoutes from './modules/auth/auth.routes.js'
import healthRoutes from './modules/health/health.routes.js'
import contactsRoutes from './modules/contacts/contacts.routes.js'
import profileRoutes from './modules/profile/profile.routes.js'
import zonesRoutes from './modules/zones/zones.routes.js'
import citiesRoutes from './modules/cities/cities.routes.js'
import routesRoutes from './modules/routes/routes.routes.js'
import trackingRoutes from './modules/tracking/tracking.routes.js'
import sosRoutes from './modules/sos/sos.routes.js'
import adminRoutes from './modules/admin/admin.routes.js'
import devRoutes from './modules/dev/dev.routes.js'

const app = express()

// CORS
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}))

app.use(express.json())

// Rate limiting globale
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, error: 'Troppe richieste, riprova tra qualche minuto' },
  standardHeaders: true,
  legacyHeaders: false,
}))

// Rate limiting più stretto per auth
// In development: 100 req/ora per non bloccare i test manuali
// In production: 10 req/ora per sicurezza
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 100 : 10,
  message: { success: false, error: 'Troppi tentativi di accesso' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Routes
app.use('/api/health', healthRoutes)
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/emergency-contacts', contactsRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/zones', zonesRoutes)
app.use('/api/cities', citiesRoutes)
app.use('/api/routes', routesRoutes)
app.use('/api/tracking', trackingRoutes)
app.use('/api/sos', sosRoutes)
app.use('/api/admin', adminRoutes)

// Dev-only routes
if (env.NODE_ENV === 'development') {
  app.use('/api/dev', devRoutes)
  console.log('[dev] Route /api/dev attive (solo development)')
}

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint non trovato' })
})

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message)
  res.status(500).json({ success: false, error: 'Errore interno del server' })
})

// Start
app.listen(env.PORT, () => {
  console.log(`SafeRoute API running on port ${env.PORT} [${env.NODE_ENV}]`)

  // SMS provider status
  if (env.SMS_PROVIDER === 'none') {
    console.log('[sms] SMS provider: none — le notifiche SMS SOS non verranno inviate')
  } else if (env.SMS_PROVIDER === 'mock') {
    console.log('[sms] SMS provider: mock — SMS simulati (non reali)')
  } else if (env.SMS_PROVIDER === 'twilio') {
    console.log('[sms] SMS provider: twilio — SMS reali attivi')
  }

  // Email status at startup
  const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  if (smtpConfigured) {
    console.log('[email] SMTP configurato — le notifiche email sono attive')
    console.log(`[email] Host: ${process.env.SMTP_HOST}, User: ${process.env.SMTP_USER}`)
  } else {
    console.warn('[email] WARNING: SMTP non configurato — le email non verranno inviate')
    console.warn('[email] Per abilitare: configura SMTP_HOST, SMTP_USER, SMTP_PASS in backend/.env')
    console.warn('[email] In development: i link di verifica email vengono stampati in console')
  }
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

export default app
