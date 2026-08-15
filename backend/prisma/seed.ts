import { PrismaClient } from '@prisma/client'
import { computeBBox, type ZoneGeometry } from '../src/lib/geo.js'

const prisma = new PrismaClient()

// Close a GeoJSON polygon ring (first point repeated at end)
function closed(coords: [number, number][]): [number, number][][] {
  return [[...coords, coords[0]]]
}

function withBBox<T extends { geometryJson: ZoneGeometry }>(zone: T) {
  const bbox = computeBBox(zone.geometryJson)
  return {
    ...zone,
    bboxMinLng: bbox.minLng,
    bboxMinLat: bbox.minLat,
    bboxMaxLng: bbox.maxLng,
    bboxMaxLat: bbox.maxLat,
  }
}

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
  // Center: Piazza del Duomo at 9.190°E, 45.464°N
  // Major reference: railway NW (Porta Garibaldi), Navigli canals SW,
  // Stazione Centrale NE, ring roads (Circonvallazione Esterna)
  const milano = await prisma.city.upsert({
    where: { id: 'city_mi' },
    update: {},
    create: { id: 'city_mi', name: 'Milano', province: 'MI', region: 'Lombardia', country: 'IT', isActive: true },
  })

  const milanoZones = [
    {
      id: 'zone_001',
      name: 'Duomo / Centro Storico',
      type: 'district',
      safetyScore: 85,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // Follows Cerchia dei Bastioni (inner ring): irregular oval shape
          // S: Largo Augusto / Via Torino area; E: Porta Venezia area
          [9.173, 45.456], [9.181, 45.453], [9.189, 45.452], [9.197, 45.454],
          [9.204, 45.457], [9.207, 45.463], [9.206, 45.469], [9.201, 45.474],
          [9.192, 45.476], [9.183, 45.474], [9.175, 45.471], [9.169, 45.465],
          [9.169, 45.459],
        ]),
      },
    },
    {
      id: 'zone_002',
      name: 'Stazione Centrale / Buenos Aires',
      type: 'district',
      safetyScore: 60,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // Station area: E-W elongated, railway cuts SW corner
          [9.194, 45.473], [9.203, 45.470], [9.210, 45.471], [9.217, 45.474],
          [9.221, 45.479], [9.220, 45.486], [9.214, 45.491], [9.204, 45.492],
          [9.195, 45.490], [9.188, 45.485], [9.187, 45.479], [9.190, 45.475],
        ]),
      },
    },
    {
      id: 'zone_003',
      name: 'Quartiere Greco / Turro',
      type: 'district',
      safetyScore: 42,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // NE working-class area, irregular NW indent (railway line)
          [9.207, 45.478], [9.216, 45.476], [9.224, 45.477], [9.231, 45.480],
          [9.235, 45.487], [9.233, 45.494], [9.226, 45.498], [9.215, 45.499],
          [9.205, 45.496], [9.202, 45.489], [9.204, 45.482],
        ]),
      },
    },
    {
      id: 'zone_004',
      name: 'Viale Monza / Niguarda',
      type: 'district',
      safetyScore: 19,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // N area, elongated along Viale Monza, larger than adjacent zones
          [9.190, 45.488], [9.199, 45.486], [9.208, 45.487], [9.216, 45.491],
          [9.220, 45.497], [9.218, 45.504], [9.209, 45.508], [9.200, 45.508],
          [9.191, 45.505], [9.186, 45.499], [9.187, 45.492],
        ]),
      },
    },
    {
      id: 'zone_005',
      name: 'Navigli / Porta Ticinese',
      type: 'district',
      safetyScore: 72,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // Canal area: follows the Naviglio Grande and Pavese diagonals
          // More irregular due to the canal cuts through the neighborhood
          [9.154, 45.448], [9.163, 45.445], [9.170, 45.444], [9.179, 45.447],
          [9.187, 45.450], [9.192, 45.455], [9.191, 45.462], [9.185, 45.466],
          [9.176, 45.467], [9.166, 45.465], [9.157, 45.461], [9.151, 45.455],
          [9.151, 45.450],
        ]),
      },
    },
    {
      id: 'zone_006',
      name: 'Isola / Garibaldi',
      type: 'district',
      safetyScore: 80,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // Trendy area north of old railway (now Parco Biblioteca degli Alberi)
          // Slightly concave on S due to railway underpass area
          [9.172, 45.478], [9.181, 45.476], [9.189, 45.477], [9.197, 45.480],
          [9.202, 45.485], [9.200, 45.492], [9.194, 45.496], [9.184, 45.496],
          [9.175, 45.494], [9.169, 45.489], [9.168, 45.484], [9.170, 45.480],
        ]),
      },
    },
    {
      id: 'zone_007',
      name: 'Città Studi / Piola',
      type: 'district',
      safetyScore: 64,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // University area east of center, more elongated E-W
          [9.214, 45.462], [9.223, 45.459], [9.231, 45.460], [9.239, 45.463],
          [9.244, 45.469], [9.244, 45.475], [9.238, 45.480], [9.229, 45.481],
          [9.220, 45.479], [9.213, 45.476], [9.211, 45.470], [9.212, 45.464],
        ]),
      },
    },
    {
      id: 'zone_008',
      name: 'Bovisa / Dergano',
      type: 'district',
      safetyScore: null,
      isServiceActive: false,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // NW industrial/residential, Politecnico area, irregular shape
          [9.149, 45.488], [9.158, 45.485], [9.168, 45.484], [9.177, 45.487],
          [9.182, 45.493], [9.180, 45.500], [9.173, 45.505], [9.163, 45.506],
          [9.152, 45.503], [9.146, 45.498], [9.147, 45.491],
        ]),
      },
    },
  ]

  for (const z of milanoZones.map(withBBox)) {
    await prisma.zone.upsert({
      where: { id: z.id },
      update: {
        name: z.name,
        type: z.type,
        safetyScore: z.safetyScore,
        isServiceActive: z.isServiceActive,
        geometryJson: z.geometryJson,
        bboxMinLng: z.bboxMinLng,
        bboxMinLat: z.bboxMinLat,
        bboxMaxLng: z.bboxMaxLng,
        bboxMaxLat: z.bboxMaxLat,
      },
      create: { ...z, cityId: milano.id },
    })
  }

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
  // Center: Pantheon 12.477°E, 41.898°N — Colosseo 12.492°E, 41.890°N
  // Major features: Tiber river (W/NW), Aurelia wall, Ferrovie Rome-Napoli
  const roma = await prisma.city.upsert({
    where: { id: 'city_rm' },
    update: {},
    create: { id: 'city_rm', name: 'Roma', province: 'RM', region: 'Lazio', country: 'IT', isActive: true },
  })

  const romaZones = [
    {
      id: 'zone_rm_001',
      name: 'Centro Storico / Pantheon',
      type: 'district',
      safetyScore: 88,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // Bounded by Tiber (W), Largo Argentina area (S), Via Nazionale (E)
          // NE indent follows the curve at Piazza Venezia / Vittoriano
          [12.461, 41.892], [12.469, 41.889], [12.477, 41.888], [12.487, 41.890],
          [12.494, 41.894], [12.496, 41.900], [12.493, 41.906], [12.485, 41.910],
          [12.475, 41.910], [12.465, 41.907], [12.459, 41.902], [12.458, 41.896],
        ]),
      },
    },
    {
      id: 'zone_rm_002',
      name: 'Trastevere',
      type: 'district',
      safetyScore: 74,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // West bank of Tiber, Janiculum hill cuts in on W side
          // Narrower at N (river crossing), wider towards S (Monteverde direction)
          [12.453, 41.879], [12.460, 41.876], [12.468, 41.875], [12.476, 41.877],
          [12.483, 41.880], [12.486, 41.887], [12.484, 41.893], [12.477, 41.897],
          [12.467, 41.897], [12.457, 41.895], [12.451, 41.890], [12.451, 41.883],
        ]),
      },
    },
    {
      id: 'zone_rm_003',
      name: 'Termini / Esquilino',
      type: 'district',
      safetyScore: 44,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // Termini station hub — E side follows Via dello Scalo San Lorenzo (railway)
          [12.487, 41.895], [12.495, 41.892], [12.504, 41.892], [12.514, 41.895],
          [12.520, 41.900], [12.521, 41.906], [12.516, 41.912], [12.507, 41.913],
          [12.496, 41.912], [12.487, 41.908], [12.483, 41.902],
        ]),
      },
    },
    {
      id: 'zone_rm_004',
      name: 'Prati / Borgo',
      type: 'district',
      safetyScore: 82,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // W of Tiber, near Vatican — SW edge follows the Castel Sant'Angelo moat
          [12.447, 41.899], [12.455, 41.896], [12.464, 41.895], [12.472, 41.898],
          [12.479, 41.902], [12.481, 41.909], [12.478, 41.915], [12.470, 41.917],
          [12.460, 41.917], [12.451, 41.914], [12.446, 41.909], [12.445, 41.903],
        ]),
      },
    },
    {
      id: 'zone_rm_005',
      name: 'Testaccio',
      type: 'district',
      safetyScore: 62,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // Small, compact area — former slaughterhouse district, now trendy
          // Follows Tiber on W side; Aventino hill on E
          [12.470, 41.874], [12.478, 41.871], [12.487, 41.872], [12.494, 41.875],
          [12.498, 41.881], [12.497, 41.888], [12.490, 41.892], [12.480, 41.892],
          [12.472, 41.889], [12.468, 41.883],
        ]),
      },
    },
    {
      id: 'zone_rm_006',
      name: 'Pigneto',
      type: 'district',
      safetyScore: 55,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // E of center, between railway lines — irregular due to rail cuts
          [12.524, 41.882], [12.533, 41.879], [12.542, 41.879], [12.551, 41.882],
          [12.558, 41.887], [12.557, 41.894], [12.550, 41.899], [12.539, 41.900],
          [12.528, 41.897], [12.522, 41.891],
        ]),
      },
    },
    {
      id: 'zone_rm_007',
      name: 'Tor Bella Monaca',
      type: 'district',
      safetyScore: 18,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // Far E periphery — large public housing complex, distinctive shape
          [12.609, 41.857], [12.619, 41.854], [12.631, 41.854], [12.642, 41.857],
          [12.647, 41.864], [12.643, 41.872], [12.633, 41.876], [12.621, 41.876],
          [12.610, 41.872], [12.606, 41.865],
        ]),
      },
    },
    {
      id: 'zone_rm_008',
      name: 'Parioli',
      type: 'district',
      safetyScore: 91,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // N of center, affluent — Villa Borghese park boundary cuts SE corner
          [12.497, 41.913], [12.506, 41.911], [12.515, 41.912], [12.524, 41.914],
          [12.529, 41.920], [12.526, 41.927], [12.518, 41.932], [12.507, 41.932],
          [12.498, 41.929], [12.492, 41.923], [12.493, 41.916],
        ]),
      },
    },
    {
      id: 'zone_rm_009',
      name: 'EUR',
      type: 'district',
      safetyScore: 78,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // Far south — Mussolini-era planned city, more regular but not rectangular
          // Slightly elongated N-S following the planned road grid
          [12.452, 41.822], [12.463, 41.819], [12.475, 41.818], [12.488, 41.820],
          [12.497, 41.824], [12.500, 41.831], [12.498, 41.839], [12.488, 41.844],
          [12.474, 41.845], [12.460, 41.843], [12.451, 41.837], [12.449, 41.829],
        ]),
      },
    },
    {
      id: 'zone_rm_010',
      name: 'Torpignattara',
      type: 'district',
      safetyScore: 30,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // SE periphery, Via Casilina corridor cuts through
          [12.549, 41.869], [12.558, 41.866], [12.568, 41.865], [12.578, 41.868],
          [12.584, 41.874], [12.582, 41.881], [12.575, 41.886], [12.563, 41.887],
          [12.552, 41.884], [12.546, 41.877],
        ]),
      },
    },
    {
      id: 'zone_rm_011',
      name: 'Nomentano / Trieste',
      type: 'district',
      safetyScore: 70,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // NE of center, follows Via Nomentana diagonal on E side
          [12.509, 41.905], [12.519, 41.902], [12.528, 41.903], [12.537, 41.906],
          [12.544, 41.911], [12.543, 41.918], [12.537, 41.924], [12.526, 41.925],
          [12.515, 41.923], [12.508, 41.918], [12.506, 41.910],
        ]),
      },
    },
    {
      id: 'zone_rm_012',
      name: 'Ostiense / Garbatella',
      type: 'district',
      safetyScore: null,
      isServiceActive: false,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // S of center, Tiber on W, railway on E — narrow corridor shape
          [12.473, 41.858], [12.483, 41.855], [12.493, 41.854], [12.504, 41.857],
          [12.512, 41.862], [12.512, 41.869], [12.507, 41.875], [12.496, 41.877],
          [12.483, 41.876], [12.474, 41.872], [12.471, 41.865],
        ]),
      },
    },
  ]

  for (const z of romaZones.map(withBBox)) {
    await prisma.zone.upsert({
      where: { id: z.id },
      update: {
        name: z.name,
        type: z.type,
        safetyScore: z.safetyScore,
        isServiceActive: z.isServiceActive,
        geometryJson: z.geometryJson,
        bboxMinLng: z.bboxMinLng,
        bboxMinLat: z.bboxMinLat,
        bboxMaxLng: z.bboxMaxLng,
        bboxMaxLat: z.bboxMaxLat,
      },
      create: { ...z, cityId: roma.id },
    })
  }

  console.log('Seed completed: Milano (8 zone), Torino (city row only — see import:submunicipal), Roma (12 zone).')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
