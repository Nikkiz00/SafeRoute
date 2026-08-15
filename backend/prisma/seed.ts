import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // AppSettings
  const settings = [
    { key: 'AI_ENABLED', valueJson: false },
    { key: 'AI_PROVIDER', valueJson: 'none' },
    { key: 'AI_MODEL', valueJson: null },
    { key: 'SMS_PROVIDER', valueJson: 'none' },
    { key: 'EMAIL_PROVIDER', valueJson: 'smtp' },
    { key: 'TRACKING_MAX_DURATION_HOURS', valueJson: 24 },
    { key: 'LOCATION_PING_INTERVAL_SECONDS', valueJson: 15 },
    { key: 'LOCATION_PING_RETENTION_DAYS', valueJson: 7 },
    { key: 'FREE_MAX_EMERGENCY_CONTACTS', valueJson: 2 },
    { key: 'PREMIUM_MAX_EMERGENCY_CONTACTS', valueJson: 5 },
    { key: 'FREE_MAX_ROUTE_HISTORY_DAYS', valueJson: 30 },
    { key: 'PREMIUM_MAX_ROUTE_HISTORY_DAYS', valueJson: 365 },
  ]
  for (const s of settings) {
    await prisma.appSetting.upsert({
      where: { key: s.key },
      update: { valueJson: s.valueJson },
      create: { key: s.key, valueJson: s.valueJson },
    })
  }

  await prisma.aISetting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', provider: 'none', isEnabled: false },
  })

  // ─── MILANO ───────────────────────────────────────────────────
  // Zone geometry is NOT seeded here. Milano's 88 real NIL (Nuclei d'Identità
  // Locale) come from the official Comune di Milano open data source — see
  // backend/src/lib/submunicipal/sources/milano-nil.ts and
  // docs/step-4-2-milano-submunicipal.md. Run after this seed:
  //   npm run import:istat            (adopts this City row, sets istatCode/boundaryJson)
  //   npm run import:submunicipal -- --source=comune-milano-nil
  await prisma.city.upsert({
    where: { id: 'city_mi' },
    update: {},
    create: { id: 'city_mi', name: 'Milano', province: 'MI', region: 'Lombardia', country: 'IT', isActive: true },
  })

  // ─── TORINO ───────────────────────────────────────────────────
  // Zone geometry is NOT seeded here. Torino's 23 real quartieri come from the
  // official Comune di Torino open data source — see
  // backend/src/lib/submunicipal/sources/torino-quartieri.ts and
  // docs/step-4-1-torino-submunicipal.md. Run after this seed:
  //   npm run import:istat            (adopts this City row, sets istatCode/boundaryJson)
  //   npm run import:submunicipal -- --source=comune-torino-quartieri
  await prisma.city.upsert({
    where: { id: 'city_to' },
    update: {},
    create: { id: 'city_to', name: 'Torino', province: 'TO', region: 'Piemonte', country: 'IT', isActive: true },
  })

  // ─── ROMA ─────────────────────────────────────────────────────
  // Zone geometry is NOT seeded here. Roma's 155 real zone urbanistiche come
  // from the official Roma Capitale geoportale — see
  // backend/src/lib/submunicipal/sources/roma-zone-urbanistiche.ts and
  // docs/step-4-3-roma-submunicipal.md. Run after this seed:
  //   npm run import:istat                 (adopts this City row, sets istatCode/boundaryJson)
  //   npm run import:submunicipal -- --source=comune-roma-zone-urbanistiche
  await prisma.city.upsert({
    where: { id: 'city_rm' },
    update: {},
    create: { id: 'city_rm', name: 'Roma', province: 'RM', region: 'Lazio', country: 'IT', isActive: true },
  })

  console.log('Seed completed: Milano/Torino/Roma (city rows only — see import:submunicipal for real zone geometry).')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
