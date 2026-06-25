import { ref } from 'vue'
import L from 'leaflet'

export interface RouteResult {
  polyline: [number, number][]
  distanceKm: number
  durationMin: number
}

export const isRoutingFallback = ref(false)
export const routingFallbackReason = ref<string | null>(null)

let routePolyline: L.Polyline | null = null

export async function calculateRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  map: L.Map,
): Promise<RouteResult | null> {
  isRoutingFallback.value = false
  routingFallbackReason.value = null

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`
    console.debug('[routing] calling OSRM:', url)

    const res = await fetch(url)
    if (!res.ok) throw new Error(`OSRM response not ok: ${res.status}`)
    const data = await res.json()

    if (!data.routes?.[0]) return null

    const route = data.routes[0]
    const coords: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
    )

    // Remove old polyline
    if (routePolyline) {
      routePolyline.remove()
      routePolyline = null
    }

    // Draw new polyline
    routePolyline = L.polyline(coords, { color: '#2563EB', weight: 4, opacity: 0.8 }).addTo(map)
    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] })

    return {
      polyline: coords,
      distanceKm: Math.round(route.distance / 100) / 10,
      durationMin: Math.round(route.duration / 60),
    }
  } catch (e) {
    console.warn('[routing] OSRM failed, showing straight line fallback:', e)
    isRoutingFallback.value = true
    routingFallbackReason.value = 'Percorso indicativo — routing non disponibile al momento'
    // Fallback: straight dashed line between the two points
    if (routePolyline) {
      routePolyline.remove()
      routePolyline = null
    }
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
  if (routePolyline) {
    routePolyline.remove()
    routePolyline = null
  }
  isRoutingFallback.value = false
  routingFallbackReason.value = null
}
