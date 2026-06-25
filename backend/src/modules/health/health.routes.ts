import { Router } from 'express'
import { prisma } from '@/config/database.js'
import { env } from '@/config/env.js'

const router = Router()

router.get('/', async (_req, res) => {
  let dbStatus = 'ok'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'unavailable'
  }

  res.json({
    success: true,
    message: 'SafeRoute API online',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
    },
  })
})

if (env.NODE_ENV === 'development') {
  router.get('/email', async (_req, res) => {
    const configured = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)

    if (!configured) {
      res.json({
        configured: false,
        connected: false,
        smtp_host: env.SMTP_HOST ?? null,
        smtp_user: env.SMTP_USER ?? null,
        smtp_pass_set: !!env.SMTP_PASS,
        smtp_port: env.SMTP_PORT ?? 587,
        status: 'NOT_CONFIGURED',
        note: 'SMTP non configurato. Le email vengono saltate silenziosamente.',
        instructions: [
          '1. Copia backend/.env.example in backend/.env',
          '2. Imposta SMTP_HOST, SMTP_USER, SMTP_PASS',
          '3. Per Gmail: usa App Password (non la password normale)',
          '4. Per Zoho: vai su Zoho Mail > Impostazioni > Sicurezza > App-Specific Passwords',
          '5. Per Brevo/Sendgrid: usa SMTP_USER=apikey e SMTP_PASS=la-tua-api-key',
        ],
      })
      return
    }

    // Actually test the connection
    let connected = false
    let connectionError: string | null = null
    let errorCode: string | null = null

    try {
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? 587,
        secure: env.SMTP_SECURE ?? false,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
      })
      await transporter.verify()
      connected = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      connectionError = msg

      // Classify error
      if (msg.includes('535') || msg.includes('Authentication') || msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('username and password')) {
        errorCode = 'SMTP_AUTH_FAILED'
      } else if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
        errorCode = 'SMTP_UNREACHABLE'
      } else if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
        errorCode = 'SMTP_TIMEOUT'
      } else {
        errorCode = 'SMTP_ERROR'
      }
    }

    const instructions: string[] = []
    if (errorCode === 'SMTP_AUTH_FAILED') {
      instructions.push('Errore 535: autenticazione SMTP fallita.')
      instructions.push('Se usi Gmail: non usare la password normale. Vai su myaccount.google.com > Sicurezza > Password app.')
      instructions.push('Se usi Zoho Mail: vai su Zoho Mail > Impostazioni > Sicurezza > App-Specific Password.')
      instructions.push('Se usi Brevo (ex Sendinblue): imposta SMTP_USER=apikey e SMTP_PASS=<la tua API key SMTP>.')
      instructions.push('Assicurati che SMTP_USER sia l\'indirizzo email completo, non solo il nome utente.')
    } else if (errorCode === 'SMTP_UNREACHABLE') {
      instructions.push(`Host SMTP non raggiungibile: ${env.SMTP_HOST}. Controlla SMTP_HOST e che la porta ${env.SMTP_PORT ?? 587} sia aperta.`)
    } else if (errorCode === 'SMTP_TIMEOUT') {
      instructions.push('Timeout connessione SMTP. Il server SMTP non risponde. Controlla firewall/VPN.')
    }

    res.json({
      configured: true,
      connected,
      smtp_host: env.SMTP_HOST ?? null,
      smtp_user: env.SMTP_USER ?? null,
      smtp_pass_set: !!env.SMTP_PASS,
      smtp_port: env.SMTP_PORT ?? 587,
      smtp_secure: env.SMTP_SECURE ?? false,
      status: connected ? 'OK' : (errorCode ?? 'SMTP_ERROR'),
      error: connectionError,
      note: connected
        ? 'SMTP connesso e autenticato correttamente.'
        : `SMTP configurato ma connessione fallita: ${errorCode}`,
      instructions: instructions.length > 0 ? instructions : undefined,
    })
  })
}

export default router
