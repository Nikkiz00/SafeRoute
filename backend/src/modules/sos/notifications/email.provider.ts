import nodemailer from 'nodemailer'
import { env } from '@/config/env.js'

let _warnedOnce = false

function isEmailConfigured(): boolean {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
}

function createTransporter() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE ?? false,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  })
}

export interface EmailResult {
  status: 'sent' | 'failed' | 'skipped'
  provider: string
  error?: string
}

export async function sendSOSEmail(params: {
  to: string
  contactName: string
  userName: string
  lat: number
  lng: number
  trackingUrl: string
  message?: string
}): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    if (!_warnedOnce) {
      _warnedOnce = true
      console.warn('[email] WARNING: SMTP non configurato — le email SOS non verranno inviate. Configura SMTP_HOST, SMTP_USER, SMTP_PASS in .env')
    }
    return { status: 'skipped', provider: 'none' }
  }

  const { to, contactName, userName, lat, lng, trackingUrl, message } = params
  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`

  const subject = `🆘 SOS da ${userName} — SafeRoute`
  const textBody = [
    `Ciao ${contactName},`,
    ``,
    `${userName} ha attivato un allarme SOS tramite SafeRoute.`,
    message ? `Messaggio: "${message}"` : ``,
    ``,
    `Posizione attuale: ${mapsUrl}`,
    ``,
    `Segui la posizione in tempo reale: ${trackingUrl}`,
    ``,
    `⚠️ Se non riesci a contattare ${userName} e ritieni ci sia un pericolo reale, contatta il 112 o il numero di emergenza locale.`,
    ``,
    `— SafeRoute`,
  ].filter(l => l !== undefined).join('\n')

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #EF4444; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">🆘 Allarme SOS</h1>
      </div>
      <div style="background: #FFF; border: 1px solid #E5E7EB; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p>Ciao <strong>${contactName}</strong>,</p>
        <p><strong>${userName}</strong> ha attivato un allarme SOS tramite SafeRoute.</p>
        ${message ? `<p style="background:#FEF2F2; border-left: 3px solid #EF4444; padding: 8px 12px; border-radius: 4px;"><em>${message}</em></p>` : ''}
        <p>
          <a href="${mapsUrl}" style="display:inline-block; background:#2563EB; color:white; padding:10px 20px; border-radius:6px; text-decoration:none; margin-right:8px;">📍 Vedi posizione</a>
          <a href="${trackingUrl}" style="display:inline-block; background:#16A34A; color:white; padding:10px 20px; border-radius:6px; text-decoration:none;">🗺️ Tracking live</a>
        </p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
        <p style="color:#6B7280; font-size:14px;">⚠️ <strong>Se non riesci a contattare ${userName}</strong> e ritieni ci sia un pericolo reale, contatta il <strong>112</strong> o il numero di emergenza locale.</p>
      </div>
    </div>
  `

  try {
    const transporter = createTransporter()
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text: textBody,
      html: htmlBody,
    })
    return { status: 'sent', provider: 'smtp' }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    if (error.includes('535') || error.toLowerCase().includes('authentication') || error.toLowerCase().includes('invalid login')) {
      console.error('[sos email] SMTP Authentication Failed — controlla SMTP_USER e SMTP_PASS nel file .env')
      console.error('[sos email] Per Gmail usa App Password: myaccount.google.com > Sicurezza > Password app')
      console.error('[sos email] Errore originale:', error)
    } else {
      console.error('[sos email] failed:', error)
    }
    return { status: 'failed', provider: 'smtp', error }
  }
}

export async function sendVerificationEmail(params: {
  to: string
  userName: string
  verificationUrl: string
}): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    console.info(`[email] verification email NOT sent (SMTP not configured). URL: ${params.verificationUrl}`)
    return { status: 'skipped', provider: 'none' }
  }
  const { to, userName, verificationUrl } = params
  const subject = `Verifica la tua email — SafeRoute`
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563EB;">SafeRoute</h1>
      <p>Ciao <strong>${userName}</strong>,</p>
      <p>Clicca il link per verificare la tua email:</p>
      <a href="${verificationUrl}" style="display:inline-block; background:#2563EB; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">Verifica email</a>
      <p style="color:#6B7280; font-size:13px; margin-top:20px;">Il link scade in 24 ore. Se non hai richiesto questa email, ignorala.</p>
    </div>
  `
  try {
    const transporter = createTransporter()
    await transporter.sendMail({ from: env.SMTP_FROM, to, subject, html: htmlBody, text: `Verifica la tua email: ${verificationUrl}` })
    return { status: 'sent', provider: 'smtp' }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    if (error.includes('535') || error.toLowerCase().includes('authentication') || error.toLowerCase().includes('invalid login')) {
      console.error('[email] SMTP Authentication Failed — controlla SMTP_USER e SMTP_PASS nel file .env')
      console.error('[email] Per Gmail usa App Password: myaccount.google.com > Sicurezza > Password app')
      console.error('[email] Errore originale:', error)
    } else {
      console.error('[email] verification email failed:', error)
    }
    return { status: 'failed', provider: 'smtp', error }
  }
}

export async function sendSecurityEmail(opts: {
  to: string
  userName: string
  subject: string
  body: string
}): Promise<{ status: 'sent' | 'skipped' | 'failed' }> {
  if (!isEmailConfigured()) {
    console.info(`[email] security email NOT sent (SMTP not configured). Subject: ${opts.subject}`)
    return { status: 'skipped' }
  }
  const { to, userName, subject, body } = opts
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #F59E0B; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">⚠️ Avviso di sicurezza — SafeRoute</h1>
      </div>
      <div style="background: #FFF; border: 1px solid #E5E7EB; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p>Ciao <strong>${userName}</strong>,</p>
        <p>${body}</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
        <p style="color:#6B7280; font-size:13px;">Se non hai eseguito questa operazione, contatta immediatamente il supporto SafeRoute.</p>
      </div>
    </div>
  `
  try {
    const transporter = createTransporter()
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      html: htmlBody,
      text: `${body}\n\nSe non hai eseguito questa operazione, contatta immediatamente il supporto SafeRoute.`,
    })
    return { status: 'sent' }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    console.error('[email] security email failed:', error)
    return { status: 'failed' }
  }
}

export async function sendContactAddedEmail(params: {
  to: string
  contactName: string
  addedByName: string
}): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    console.info(`[email] contact notification NOT sent (SMTP not configured). Contact: ${params.contactName}`)
    return { status: 'skipped', provider: 'none' }
  }
  const { to, contactName, addedByName } = params
  const subject = `${addedByName} ti ha aggiunto come contatto di emergenza — SafeRoute`
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563EB;">SafeRoute</h1>
      <p>Ciao <strong>${contactName}</strong>,</p>
      <p><strong>${addedByName}</strong> ti ha aggiunto come contatto di emergenza su SafeRoute.</p>
      <p>In caso di emergenza, riceverai una notifica con la posizione di ${addedByName}.</p>
      <p style="color:#6B7280; font-size:13px;">Se non conosci questa persona, puoi ignorare questa email.</p>
    </div>
  `
  try {
    const transporter = createTransporter()
    await transporter.sendMail({ from: env.SMTP_FROM, to, subject, html: htmlBody, text: `${addedByName} ti ha aggiunto come contatto di emergenza su SafeRoute.` })
    return { status: 'sent', provider: 'smtp' }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    if (error.includes('535') || error.toLowerCase().includes('authentication') || error.toLowerCase().includes('invalid login')) {
      console.error('[email] SMTP Authentication Failed — controlla SMTP_USER e SMTP_PASS nel file .env')
      console.error('[email] Per Gmail usa App Password: myaccount.google.com > Sicurezza > Password app')
      console.error('[email] Errore originale:', error)
    } else {
      console.error('[email] contact notification failed:', error)
    }
    return { status: 'failed', provider: 'smtp', error }
  }
}
