import { ref } from 'vue'
import L from 'leaflet'
import { useZonesStore } from '@/stores/zones'
import type { Zone } from '@/types'
import { findContainingZone } from '@/utils/geo'

export interface RouteResult {
  polyline: [number, number][]
  distanceKm: number
  durationMin: number
  safetyScore: number
  alternativesCount: number
  modeDescription: string
}

export const isRoutingFallback = ref(false)
export const routingFallbackReason = ref<string | null>(null)

let routePolyline: L.Polyline | null = null

// ── Zone safety scoring ────────────────────────────────────────────────────

function zoneScore(zone: Zone | null): number {
  if (!zone || !zone.isServiceActive || zone.safetyScore === null) return 0
  if (zone.safetyScore >= 75) return 2    // green: bonus
  if (zone.safetyScore >= 50) return 0    // yellow: neutral
  if (zone.safetyScore >= 25) return -3   // red: penalty
  return -5                               // purple: heavy penalty
}

function computeRouteSafetyScore(coords: [number, number][], zones: Zone[]): number {
  if (!zones.length) return 50 // no zone data → neutral
  const MAX_SAMPLES = 40
  const step = coords.length <= MAX_SAMPLES ? 1 : Math.floor(coords.length / MAX_SAMPLES)
  let total = 0
  let count = 0
  for (let i = 0; i < coords.length && count < MAX_SAMPLES; i += step) {
    total += zoneScore(findContainingZone(coords[i][0], coords[i][1], zones))
    count++
  }
  // raw range: [-5 * 40, +2 * 40] = [-200, +80] → normalize to 0–100
  return Math.max(0, Math.min(100, Math.round(((total + 200) / 280) * 100)))
}

function safetyLabel(score: number): string {
  if (score >= 75) return 'Ottima'
  if (score >= 50) return 'Buona'
  if (score >= 30) return 'Media'
  return 'Bassa'
}

// ── Route processing ────────────────────────────────────────────────────────

const MODE_COLORS: Record<'safe' | 'balanced' | 'fast', string> = {
  safe: '#22c55e',
  balanced: '#2563EB',
  fast: '#f59e0b',
}

interface OsrmRoute {
  distance: number
  duration: number
  geometry: { coordinates: [number, number][] }
}

interface ProcessedRoute {
  coords: [number, number][]
  distanceKm: number
  durationMin: number
  safety: number
}

export type TravelMode = 'walking' | 'driving' | 'cycling'

// Per-profile OSRM instances from routing.openstreetmap.de.
// These provide genuine profile differentiation:
//   - foot: uses pedestrian paths, footways, parks (real walking ETAs ~4-5 km/h)
//   - bike: uses cycle lanes, bike paths (real cycling ETAs ~15 km/h)
//   - driving: uses only road network (real driving ETAs)
// Unlike the public router.project-osrm.org which serves only driving
// regardless of the URL profile parameter.
const OSRM_BASE: Record<TravelMode, string> = {
  walking: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  driving: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  cycling: 'https://routing.openstreetmap.de/routed-bike/route/v1/bike',
}

// Compute bounding box for zone pre-loading
function computeRouteBbox(coords: [number, number][]): string {
  let minLat = coords[0][0], maxLat = coords[0][0]
  let minLng = coords[0][1], maxLng = coords[0][1]
  for (const [lat, lng] of coords) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
  const pad = 0.015 // ~1.5 km padding
  return [
    (minLng - pad).toFixed(5),
    (minLat - pad).toFixed(5),
    (maxLng + pad).toFixed(5),
    (maxLat + pad).toFixed(5),
  ].join(',')
}

// Fetch raw OSRM routes — returns [] on any error
async function fetchOsrmRaw(url: string): Promise<OsrmRoute[]> {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 10000)
    let res: Response
    try {
      res = await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(t)
    }
    if (!res.ok) return []
    const data = await res.json() as { routes?: OsrmRoute[]; code?: string }
    if (data.code && data.code !== 'Ok') return []
    return data.routes ?? []
  } catch {
    return []
  }
}

// Deduplicate routes with same rounded distance+duration
function deduplicateRoutes(routes: ProcessedRoute[]): ProcessedRoute[] {
  const seen = new Set<string>()
  return routes.filter(r => {
    const key = `${Math.round(r.distanceKm * 10)}_${r.durationMin}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function calculateRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  map: L.Map,
  preference: 'safe' | 'balanced' | 'fast' = 'balanced',
  travelMode: TravelMode = 'driving',
): Promise<RouteResult | null> {
  isRoutingFallback.value = false
  routingFallbackReason.value = null

  try {
    const base = OSRM_BASE[travelMode]
    const coordPair = `${originLng},${originLat};${destLng},${destLat}`
    const url = `${base}/${coordPair}?overview=full&geometries=geojson&alternatives=true`

    console.debug('[routing] OSRM request (pref=%s, mode=%s):', preference, travelMode, url)

    const rawRoutes = await fetchOsrmRaw(url)
    if (!rawRoutes.length) throw new Error('OSRM: nessun percorso restituito')

    // Convert raw OSRM to internal format (OSRM coords = [lng, lat], we use [lat, lng])
    const rawProcessed: ProcessedRoute[] = rawRoutes.map(r => ({
      coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
      distanceKm: Math.round(r.distance / 100) / 10,
      durationMin: Math.round(r.duration / 60),
      safety: 0,
    }))

    const routes = deduplicateRoutes(rawProcessed)

    // Pre-load zones for the route bounding box BEFORE computing safety scores.
    // Without this, safety scoring only uses zones visible in the current viewport,
    // which misses zones at the far end of a long route.
    const routeBbox = computeRouteBbox(routes[0].coords)
    const zonesStore = useZonesStore()
    await zonesStore.loadZones({ bbox: routeBbox })

    // Compute safety scores with accurate zone data
    const zones = zonesStore.zones
    for (const r of routes) {
      r.safety = computeRouteSafetyScore(r.coords, zones)
    }

    const n = routes.length
    const modeLabel: Record<TravelMode, string> = {
      walking: 'A piedi',
      driving: 'In auto',
      cycling: 'In bici',
    }
    const travelLabel = modeLabel[travelMode]

    let idx = 0
    let modeDescription = ''

    if (preference === 'fast') {
      idx = 0
      const r = routes[0]
      modeDescription = `${travelLabel} · Più veloce · ${r.distanceKm} km, ${r.durationMin} min`
    } else if (preference === 'safe') {
      idx = routes.reduce((best, r, i) => (r.safety > routes[best].safety ? i : best), 0)
      const chosen = routes[idx]
      const label = safetyLabel(chosen.safety)
      if (n === 1) {
        modeDescription = `${travelLabel} · Più sicuro · sicurezza ${chosen.safety}/100 (${label}) · percorso unico`
      } else if (idx === 0) {
        modeDescription = `${travelLabel} · Più sicuro (coincide col più veloce) · sicurezza ${chosen.safety}/100 (${label})`
      } else {
        const diff = chosen.durationMin - routes[0].durationMin
        const diffStr = diff > 0 ? ` +${diff} min` : ''
        modeDescription = `${travelLabel} · Più sicuro · sicurezza ${chosen.safety}/100 (${label})${diffStr}`
      }
    } else {
      // balanced: 50% safety + 50% speed
      const maxDur = Math.max(...routes.map(r => r.durationMin))
      const minDur = Math.min(...routes.map(r => r.durationMin))
      const durRange = maxDur - minDur || 1
      idx = routes.reduce(
        (best, r, i) => {
          const composite =
            0.5 * (r.safety / 100) +
            0.5 * (1 - (r.durationMin - minDur) / durRange)
          const bestComposite =
            0.5 * (routes[best].safety / 100) +
            0.5 * (1 - (routes[best].durationMin - minDur) / durRange)
          return composite > bestComposite ? i : best
        },
        0,
      )
      const chosen = routes[idx]
      const label = safetyLabel(chosen.safety)
      const uniqueNote = n === 1 ? ' · percorso unico' : ''
      modeDescription = `${travelLabel} · Bilanciato · sicurezza ${chosen.safety}/100 (${label}), ${chosen.distanceKm} km${uniqueNote}`
    }

    const chosen = routes[idx]

    console.debug(
      '[routing] selected %d/%d pref=%s travel=%s safety=%d(%s) dist=%skm dur=%dmin alts=%d',
      idx, n, preference, travelMode,
      chosen.safety, safetyLabel(chosen.safety),
      chosen.distanceKm, chosen.durationMin, n,
    )

    if (routePolyline) { routePolyline.remove(); routePolyline = null }
    routePolyline = L.polyline(chosen.coords, {
      color: MODE_COLORS[preference],
      weight: 4,
      opacity: 0.85,
    }).addTo(map)
    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] })

    return {
      polyline: chosen.coords,
      distanceKm: chosen.distanceKm,
      durationMin: chosen.durationMin,
      safetyScore: chosen.safety,
      alternativesCount: n,
      modeDescription,
    }
  } catch (e) {
    console.warn('[routing] OSRM failed, showing straight line fallback:', e)
    isRoutingFallback.value = true
    routingFallbackReason.value = 'Percorso indicativo — routing non disponibile al momento'
    if (routePolyline) { routePolyline.remove(); routePolyline = null }
    routePolyline = L.polyline([[originLat, originLng], [destLat, destLng]], {
      color: '#2563EB',
      weight: 3,
      opacity: 0.5,
      dashArray: '8,4',
    }).addTo(map)
    return null
  }
}

export function clearRoute() {
  if (routePolyline) { routePolyline.remove(); routePolyline = null }
  isRoutingFallback.value = false
  routingFallbackReason.value = null
}
