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
  // Complete redesign — real neighborhood boundaries based on:
  //   • Piazza Castello (center): 7.686°E, 45.071°N
  //   • Porta Nuova station: 7.679°E, 45.062°N
  //   • Po river (E boundary of centro): ~7.702°E
  //   • Dora Riparia river (N boundary): ~45.079-45.081°N
  //   • Railway from SW to NE: diagonal at ~45.062°N (center)
  //   • Lingotto factory: 7.678°E, 45.029°N (far south)
  //
  // Zone sizes intentionally varied (Quadrilatero ~1.5km², Lingotto ~4km²)
  const torino = await prisma.city.upsert({
    where: { id: 'city_to' },
    update: {},
    create: { id: 'city_to', name: 'Torino', province: 'TO', region: 'Piemonte', country: 'IT', isActive: true },
  })

  const torinoZones = [
    {
      id: 'zone_to_001',
      name: 'Centro Storico',
      type: 'district',
      safetyScore: 80,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // Follows the Roman city grid boundaries:
          // S: railway/Corso Vittorio Emanuele II  E: Via Po / Piazza Vittorio
          // N: Corso Regina Margherita (Dora Riparia)  W: Corso Re Umberto
          // NE indent: Mole Antonelliana / Murazzi del Po area
          [7.661, 45.063], [7.673, 45.060], [7.684, 45.059], [7.695, 45.062],
          [7.703, 45.065], [7.706, 45.070], [7.705, 45.076], [7.701, 45.080],
          [7.693, 45.083], [7.681, 45.083], [7.669, 45.081], [7.660, 45.076],
          [7.658, 45.069],
        ]),
      },
    },
    {
      id: 'zone_to_002',
      name: 'Porta Palazzo / Valdocco',
      type: 'district',
      safetyScore: 33,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // Europe's largest outdoor market + Aurora/Valdocco area
          // S: Corso Regina Margherita (Dora)  N: Corso Giulio Cesare
          // Wider than Centro, extends eastward into Aurora
          [7.651, 45.081], [7.662, 45.081], [7.673, 45.082], [7.683, 45.083],
          [7.693, 45.083], [7.703, 45.081], [7.706, 45.087], [7.703, 45.094],
          [7.692, 45.099], [7.677, 45.100], [7.662, 45.097], [7.652, 45.091],
          [7.650, 45.085],
        ]),
      },
    },
    {
      id: 'zone_to_003',
      name: 'Barriera di Milano',
      type: 'district',
      safetyScore: 22,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // NE working-class area, extends towards Stura river
          // Irregular shape: wider in middle, tapers north and south
          // E side follows Via Cigna direction
          [7.703, 45.081], [7.714, 45.080], [7.725, 45.082], [7.733, 45.087],
          [7.736, 45.094], [7.731, 45.103], [7.719, 45.109], [7.704, 45.111],
          [7.691, 45.107], [7.688, 45.099], [7.695, 45.093], [7.703, 45.094],
          [7.706, 45.087],
        ]),
      },
    },
    {
      id: 'zone_to_004',
      name: 'Quadrilatero Romano',
      type: 'district',
      safetyScore: 68,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // The original Roman castrum — intentionally small (~1.6km wide)
          // NW of Piazza Castello, bounded by Porta Palatina area
          // Compact, 9 vertices — reflects its tightly defined historic perimeter
          [7.643, 45.065], [7.651, 45.063], [7.659, 45.063], [7.664, 45.068],
          [7.663, 45.075], [7.658, 45.079], [7.650, 45.080], [7.643, 45.076],
          [7.640, 45.070],
        ]),
      },
    },
    {
      id: 'zone_to_005',
      name: 'San Salvario',
      type: 'district',
      safetyScore: 60,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // South of Porta Nuova, university/bohemian quarter
          // N boundary follows the railway diagonal (SW-NE cut)
          // E boundary: Via Nizza; W: Corso Galileo Ferraris
          [7.660, 45.062], [7.673, 45.059], [7.685, 45.058], [7.696, 45.060],
          [7.703, 45.057], [7.702, 45.049], [7.696, 45.042], [7.681, 45.040],
          [7.667, 45.041], [7.657, 45.047], [7.655, 45.056], [7.658, 45.063],
        ]),
      },
    },
    {
      id: 'zone_to_006',
      name: 'Crocetta',
      type: 'district',
      safetyScore: 75,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // SW affluent residential — Parco del Valentino edge, Corso Sommelier
          // E: Corso Galileo Ferraris; N: Corso Vittorio Emanuele II
          // Slightly concave on W side (Lungo Po Cadorna)
          [7.630, 45.067], [7.641, 45.065], [7.650, 45.065], [7.658, 45.062],
          [7.657, 45.054], [7.655, 45.046], [7.648, 45.042], [7.634, 45.041],
          [7.621, 45.046], [7.619, 45.056], [7.623, 45.065],
        ]),
      },
    },
    {
      id: 'zone_to_007',
      name: 'Vanchiglia',
      type: 'district',
      safetyScore: 52,
      isServiceActive: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // E of centro along the Po — elongated N-S following the river
          // W: Via Po (diagonal); E: Po river bank (Murazzi)
          // Narrower than other zones, follows the riverbank shape
          [7.703, 45.064], [7.712, 45.063], [7.721, 45.065], [7.727, 45.069],
          [7.728, 45.075], [7.722, 45.081], [7.712, 45.082], [7.702, 45.080],
          [7.701, 45.074], [7.702, 45.067],
        ]),
      },
    },
    {
      id: 'zone_to_008',
      name: 'Lingotto',
      type: 'district',
      safetyScore: null,
      isServiceActive: false,
      geometryJson: {
        type: 'Polygon',
        coordinates: closed([
          // The iconic Fiat factory (now Lingotto congress center) — far south
          // Largest zone in area (~4km wide) reflecting the industrial complex scale
          // SW corner follows the Canale Regio Parco curve
          [7.649, 45.043], [7.662, 45.039], [7.675, 45.038], [7.689, 45.038],
          [7.701, 45.040], [7.706, 45.036], [7.704, 45.028], [7.692, 45.024],
          [7.675, 45.023], [7.659, 45.026], [7.648, 45.033], [7.647, 45.040],
        ]),
      },
    },
  ]

  for (const z of torinoZones.map(withBBox)) {
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
      create: { ...z, cityId: torino.id },
    })
  }

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

  console.log('Seed completed: Milano (8 zone), Torino (8 zone), Roma (12 zone).')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
