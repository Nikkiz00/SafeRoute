import { env } from '@/config/env.js'

export interface SMSResult {
  status: 'sent' | 'failed' | 'skipped'
  provider: string
  error?: string
}

export async function sendSOSSMS(params: {
  to: string
  userName: string
  lat: number
  lng: number
  trackingUrl: string
}): Promise<SMSResult> {
  const { to, userName, lat, lng, trackingUrl } = params
  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`
  const smsBody = `🆘 SOS da ${userName}. Posizione: ${mapsUrl} | Tracking: ${trackingUrl} | Se in pericolo reale, chiama il 112.`

  const provider = env.SMS_PROVIDER

  const maskedTo = `****${to.slice(-4)}`

  if (provider === 'none') {
    console.log(`[sms] provider=none — SMS non inviato to=${maskedTo}`)
    return { status: 'skipped', provider: 'none' }
  }

  if (provider === 'mock') {
    console.log(`[sms mock] SMS simulato (non reale) to=${maskedTo}`)
    return { status: 'sent', provider: 'mock' }
  }

  if (provider === 'twilio') {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
      console.warn('[sms twilio] credentials not configured — skipping')
      return { status: 'skipped', provider: 'twilio' }
    }
    try {
      // Twilio SDK would be imported here when the package is installed:
      // const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
      // await client.messages.create({ body: smsBody, from: env.TWILIO_FROM_NUMBER, to })
      // console.log(`[sms twilio] SMS sent to=${maskedTo}`)
      // For now: structural stub until twilio package is installed
      console.warn('[sms twilio] twilio package not installed — SMS NOT sent (skipped)')
      return { status: 'skipped', provider: 'twilio-stub', error: 'Twilio package not installed. Install twilio npm package and uncomment the implementation.' }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      return { status: 'failed', provider: 'twilio', error }
    }
  }

  return { status: 'skipped', provider: 'unknown' }
}
