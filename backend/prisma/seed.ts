import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Seed AppSettings
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

  for (const setting of settings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: { valueJson: setting.valueJson },
      create: { key: setting.key, valueJson: setting.valueJson },
    })
  }

  // Seed AISetting (default off)
  await prisma.aISetting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', provider: 'none', isEnabled: false },
  })

  // Seed seed city (Milano)
  const milano = await prisma.city.upsert({
    where: { id: 'city_mi' },
    update: {},
    create: {
      id: 'city_mi',
      name: 'Milano',
      province: 'MI',
      region: 'Lombardia',
      country: 'IT',
      isActive: true,
    },
  })

  // Seed demo zones for Milano
  const zones = [
    {
      id: 'zone_001',
      name: 'Centro Storico',
      type: 'district',
      safetyScore: 85,
      isServiceActive: true,
      geometryJson: { type: 'Polygon', coordinates: [[[9.18, 45.46], [9.195, 45.46], [9.195, 45.47], [9.18, 45.47], [9.18, 45.46]]] },
    },
    {
      id: 'zone_002',
      name: 'Stazione Centrale',
      type: 'district',
      safetyScore: 62,
      isServiceActive: true,
      geometryJson: { type: 'Polygon', coordinates: [[[9.195, 45.47], [9.21, 45.47], [9.21, 45.48], [9.195, 45.48], [9.195, 45.47]]] },
    },
    {
      id: 'zone_003',
      name: 'Quartiere Greco',
      type: 'district',
      safetyScore: 41,
      isServiceActive: true,
      geometryJson: { type: 'Polygon', coordinates: [[[9.21, 45.48], [9.225, 45.48], [9.225, 45.49], [9.21, 45.49], [9.21, 45.48]]] },
    },
    {
      id: 'zone_004',
      name: 'Viale Monza Notte',
      type: 'district',
      safetyScore: 18,
      isServiceActive: true,
      geometryJson: { type: 'Polygon', coordinates: [[[9.2, 45.49], [9.215, 45.49], [9.215, 45.5], [9.2, 45.5], [9.2, 45.49]]] },
    },
    {
      id: 'zone_005',
      name: 'Nuova Lottizzazione Est',
      type: 'district',
      safetyScore: null,
      isServiceActive: false,
      geometryJson: { type: 'Polygon', coordinates: [[[9.165, 45.48], [9.18, 45.48], [9.18, 45.49], [9.165, 45.49], [9.165, 45.48]]] },
    },
  ]

  for (const zone of zones) {
    await prisma.zone.upsert({
      where: { id: zone.id },
      update: { safetyScore: zone.safetyScore },
      create: { ...zone, cityId: milano.id },
    })
  }

  // Seed city: Torino
  const torino = await prisma.city.upsert({
    where: { id: 'city_to' },
    update: {},
    create: {
      id: 'city_to',
      name: 'Torino',
      province: 'TO',
      region: 'Piemonte',
      country: 'IT',
      isActive: true,
    },
  })

  // Seed demo zones for Torino
  const torinoZones = [
    {
      id: 'zone_to_001',
      name: 'Centro Storico',
      type: 'district',
      safetyScore: 78,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [[[7.670, 45.063], [7.685, 45.063], [7.685, 45.072], [7.670, 45.072], [7.670, 45.063]]],
      },
    },
    {
      id: 'zone_to_002',
      name: 'Porta Palazzo',
      type: 'district',
      safetyScore: 45,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [[[7.674, 45.072], [7.684, 45.072], [7.684, 45.079], [7.674, 45.079], [7.674, 45.072]]],
      },
    },
    {
      id: 'zone_to_003',
      name: 'Barriera di Milano',
      type: 'district',
      safetyScore: 28,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [[[7.684, 45.079], [7.700, 45.079], [7.700, 45.090], [7.684, 45.090], [7.684, 45.079]]],
      },
    },
  ]

  for (const zone of torinoZones) {
    await prisma.zone.upsert({
      where: { id: zone.id },
      update: { safetyScore: zone.safetyScore },
      create: { ...zone, cityId: torino.id },
    })
  }

  console.log('Seed completed.')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
