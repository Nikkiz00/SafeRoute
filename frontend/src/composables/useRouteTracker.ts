import { ref, onUnmounted } from 'vue'
import { useRouteStore } from '@/stores/route'
import { updateLocation } from '@/api/routes'

const UPDATE_INTERVAL_MS = 15_000 // 15 seconds minimum between API updates
const GPS_ACCURACY_THRESHOLD = 50  // ignore positions with accuracy > 50m (was 35)
const GPS_MIN_DISTANCE_M = 10      // ignore updates if moved < 10m (was 8)
const GPS_ALPHA = 0.15             // smoothing factor: more stable, less reactive (was 0.25)
const GPS_VERY_POOR_THRESHOLD = 100 // above 100m = GPS almost useless

// Module-level state: shared across all useRouteTracker instances.
// Assumption: only one tracker is active at any given time (single session).
// If multiple instances are needed in future, move state inside the composable.
let _smoothedLat: number | null = null
let _smoothedLng: number | null = null
let _visibilityHandler: (() => void) | null = null

function applyLowPassFilter(lat: number, lng: number): { lat: number; lng: number } {
  if (_smoothedLat === null || _smoothedLng === null) {
    _smoothedLat = lat
    _smoothedLng = lng
  } else {
    _smoothedLat = GPS_ALPHA * lat + (1 - GPS_ALPHA) * _smoothedLat
    _smoothedLng = GPS_ALPHA * lng + (1 - GPS_ALPHA) * _smoothedLng
  }
  return { lat: _smoothedLat, lng: _smoothedLng }
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function shouldUpdatePosition(
  newPos: { lat: number; lng: number; accuracy?: number | null },
  lastPos: { lat: number; lng: number } | null,
): boolean {
  // Filter by accuracy
  if (newPos.accuracy != null && newPos.accuracy > GPS_ACCURACY_THRESHOLD) {
    if (import.meta.env.DEV) console.debug(`[gps] skipped: accuracy ${Math.round(newPos.accuracy)}m > ${GPS_ACCURACY_THRESHOLD}m threshold`)
    return false
  }
  // If no last position, always accept
  if (!lastPos) return true
  // Filter by minimum distance (noise reduction)
  const dist = haversineDistance(newPos.lat, newPos.lng, lastPos.lat, lastPos.lng)
  if (dist < GPS_MIN_DISTANCE_M) {
    if (import.meta.env.DEV) console.debug(`[gps] skipped: distance ${Math.round(dist)}m < ${GPS_MIN_DISTANCE_M}m minimum`)
    return false
  }
  return true
}

export function useRouteTracker() {
  const routeStore = useRouteStore()
  const watchId = ref<number | null>(null)
  const lastUpdateTime = ref(0)
  const currentAccuracy = ref<number | null>(null)
  const isGpsVeryPoor = ref(false)
  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator

  function startTracking() {
    if (!isSupported) {
      routeStore.setError('Il tuo browser non supporta la geolocalizzazione.')
      return
    }
    if (watchId.value !== null) return // already tracking

    watchId.value = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords

        // Update current accuracy ref for display
        currentAccuracy.value = accuracy ?? null

        // Update very poor GPS flag
        isGpsVeryPoor.value = accuracy != null && accuracy > GPS_VERY_POOR_THRESHOLD

        // GPS smoothing — skip noisy/static updates
        if (!shouldUpdatePosition({ lat, lng, accuracy }, routeStore.lastPosition)) {
          return
        }

        // Log every accepted GPS update (dev only)
        if (import.meta.env.DEV) {
          const lastPos = routeStore.lastPosition
          const distStr = lastPos ? `${Math.round(haversineDistance(lat, lng, lastPos.lat, lastPos.lng))}m` : 'n/a'
          console.debug(`[gps] position accepted: lat=${lat.toFixed(5)} lng=${lng.toFixed(5)} accuracy=${Math.round(accuracy ?? 0)}m dist=${distStr}`)
        }

        // Apply low-pass filter to smooth oscillations
        const smoothed = applyLowPassFilter(lat, lng)

        const now = Date.now()
        if (now - lastUpdateTime.value < UPDATE_INTERVAL_MS) {
          // Still update local position for live marker, skip API call
          routeStore.setLastPosition({ lat: smoothed.lat, lng: smoothed.lng, accuracy })
          return
        }
        lastUpdateTime.value = now

        const sessionId = routeStore.activeSession?.id
        if (!sessionId) return

        routeStore.setLastPosition({ lat: smoothed.lat, lng: smoothed.lng, accuracy })

        try {
          await updateLocation(sessionId, { lat: smoothed.lat, lng: smoothed.lng, accuracy })
          if (import.meta.env.DEV) console.debug('[gps] location update sent to backend')
        } catch (e) {
          console.warn('[gps] location update failed:', e instanceof Error ? e.message : 'unknown error')
          // Non-critical — local state is still updated
        }
      },
      (err) => {
        const errorMessages: Record<number, string> = {
          1: 'Permesso posizione negato dall\'utente',
          2: 'Posizione non disponibile (segnale GPS debole)',
          3: 'Timeout rilevamento posizione',
        }
        const msg = errorMessages[err.code] ?? err.message
        console.warn('[tracker] geolocation error:', msg, `(code: ${err.code})`)
        if (err.code === 1) {
          routeStore.setError('Permesso posizione negato. Abilita la geolocalizzazione nelle impostazioni del browser.')
        }
        if (err.code === 3) {
          console.warn('[gps] geolocation timeout — GPS may be unavailable or blocked')
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    )

    // Reduce GPS API chatter when tab is hidden
    _visibilityHandler = () => {
      if (!document.hidden) {
        console.debug('[gps] tab visible — next GPS update will trigger immediately')
        lastUpdateTime.value = 0  // force next update to go through to API
      } else {
        console.debug('[gps] tab hidden')
      }
    }
    document.addEventListener('visibilitychange', _visibilityHandler)
  }

  function stopTracking() {
    if (watchId.value !== null) {
      navigator.geolocation.clearWatch(watchId.value)
      watchId.value = null
    }
    if (_visibilityHandler) {
      document.removeEventListener('visibilitychange', _visibilityHandler)
      _visibilityHandler = null
    }
    _smoothedLat = null
    _smoothedLng = null
    lastUpdateTime.value = 0
    currentAccuracy.value = null
    isGpsVeryPoor.value = false
  }

  onUnmounted(stopTracking)

  return { startTracking, stopTracking, isSupported, currentAccuracy, isGpsVeryPoor }
}
