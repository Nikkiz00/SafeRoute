<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Zone } from '@/types'
import { useThemeStore } from '@/stores/theme'
import { useZonesStore } from '@/stores/zones'
import { calculateRoute, clearRoute } from '@/composables/useRouting'

const GPS_VERY_POOR_THRESHOLD = 100 // above 100m = GPS almost useless (keep in sync with useRouteTracker)

const props = defineProps<{
  userPosition?: { lat: number; lng: number; accuracy?: number } | null
}>()

const isGpsVeryPoor = computed(
  () => props.userPosition?.accuracy != null && props.userPosition.accuracy > GPS_VERY_POOR_THRESHOLD,
)

const emit = defineEmits<{
  'zone-click': [zone: Zone]
  'error': [message: string]
}>()

const mapContainer = ref<HTMLDivElement | null>(null)
const themeStore = useThemeStore()
const zonesStore = useZonesStore()

let map: import('leaflet').Map | null = null
let tileLayer: import('leaflet').TileLayer | null = null
let userMarker: import('leaflet').CircleMarker | null = null
let userAccuracyCircle: import('leaflet').Circle | null = null
let zoneLayers: import('leaflet').Polygon[] = []
let moveDebounceTimer: ReturnType<typeof setTimeout> | null = null

const TILE_LIGHT = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATTRIBUTION_LIGHT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const ATTRIBUTION_DARK = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

function getBboxString(): string {
  if (!map) return ''
  const b = map.getBounds()
  return `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`
}

async function loadZonesForViewport() {
  if (!map) return
  const bbox = getBboxString()
  await zonesStore.loadZones({ bbox })
  if (zonesStore.error) emit('error', zonesStore.error)
}

function updateUserMarkerAndAccuracy(lat: number, lng: number, accuracy?: number | null) {
  if (!map) return

  if (userMarker) {
    userMarker.setLatLng([lat, lng])
  }

  // Update accuracy circle
  if (accuracy != null && accuracy > 0 && accuracy <= 200) {
    if (userAccuracyCircle) {
      userAccuracyCircle.setLatLng([lat, lng]).setRadius(accuracy)
    } else {
      import('leaflet').then((L) => {
        if (!map) return
        userAccuracyCircle = L.circle([lat, lng], {
          radius: accuracy,
          color: '#2563EB',
          fillColor: '#2563EB',
          fillOpacity: 0.08,
          weight: 1,
          opacity: 0.4,
          className: 'user-accuracy-circle',
        }).addTo(map!)
      })
    }
  } else if (userAccuracyCircle) {
    userAccuracyCircle.remove()
    userAccuracyCircle = null
  }
}

function removeUserMarker() {
  if (userMarker) { userMarker.remove(); userMarker = null }
  if (userAccuracyCircle) { userAccuracyCircle.remove(); userAccuracyCircle = null }
}

async function initMap() {
  if (!mapContainer.value) return
  const L = await import('leaflet')

  // Fix default Leaflet icon paths for Vite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
  })

  map = L.map(mapContainer.value, {
    center: [45.4642, 9.19],
    zoom: 13,
    zoomControl: true,
  })

  const isDark = themeStore.isDark
  tileLayer = L.tileLayer(isDark ? TILE_DARK : TILE_LIGHT, {
    attribution: isDark ? ATTRIBUTION_DARK : ATTRIBUTION_LIGHT,
    maxZoom: 19,
  }).addTo(map)

  // Only create the default geolocation marker if no prop-driven position is active
  if (!props.userPosition) {
    userMarker = L.circleMarker([45.4642, 9.19], {
      radius: 10,
      color: '#FFFFFF',
      weight: 3,
      fillColor: '#2563EB',
      fillOpacity: 1,
      className: 'user-position-marker',
    }).addTo(map)
  }

  // Try to get user's real position
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!map) return
        const { latitude, longitude } = pos.coords
        if (userMarker) {
          userMarker.setLatLng([latitude, longitude])
        }
        map.setView([latitude, longitude], 14)
        // Refetch zones for new position
        loadZonesForViewport()
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: 'permesso negato',
          2: 'segnale GPS non disponibile',
          3: 'timeout'
        }
        console.warn(`[map] geolocation: ${msgs[err.code] ?? err.message} — uso posizione default (Milano)`)
      },
    )
  }

  // Load zones for initial viewport
  await loadZonesForViewport()

  // Re-fetch on map move (debounced)
  map.on('moveend', () => {
    if (moveDebounceTimer) clearTimeout(moveDebounceTimer)
    moveDebounceTimer = setTimeout(() => {
      loadZonesForViewport()
    }, 500)
  })
}

function renderZones(L: typeof import('leaflet')) {
  if (!map) return

  // Remove existing zone layers
  zoneLayers.forEach((layer) => layer.remove())
  zoneLayers = []

  const fillOpacity = themeStore.isDark ? 0.45 : 0.35

  for (const zone of zonesStore.zones) {
    const color = zone.color

    const polygon = L.polygon(
      zone.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]),
      {
        color,
        weight: 2,
        opacity: 0.8,
        fillColor: color,
        fillOpacity,
      },
    ).addTo(map!)

    polygon.bindTooltip(zone.name, { permanent: false, direction: 'top' })

    polygon.on('click', () => {
      zoneLayers.forEach((l) => l.setStyle({ fillOpacity }))
      polygon.setStyle({ fillOpacity: fillOpacity + 0.2 })
      emit('zone-click', zone)
    })

    zoneLayers.push(polygon)
  }
}

// Watch zones store — re-render when zones change (deep: true catches in-place array mutations)
watch(
  () => zonesStore.zones,
  async () => {
    const L = await import('leaflet')
    renderZones(L)
  },
  { deep: true },
)

// Watch theme changes
watch(
  () => themeStore.isDark,
  async (isDark) => {
    if (!map || !tileLayer) return
    const L = await import('leaflet')
    tileLayer.remove()
    tileLayer = L.tileLayer(isDark ? TILE_DARK : TILE_LIGHT, {
      attribution: isDark ? ATTRIBUTION_DARK : ATTRIBUTION_LIGHT,
      maxZoom: 19,
    }).addTo(map)
    renderZones(L)
  },
)

// Watch userPosition prop — update or remove the marker for active route tracking
watch(
  () => props.userPosition,
  (pos) => {
    if (pos) {
      updateUserMarkerAndAccuracy(pos.lat, pos.lng, pos.accuracy)
    } else {
      removeUserMarker()
    }
  },
  { immediate: true, deep: true },
)

async function drawRoute(originLat: number, originLng: number, destLat: number, destLng: number) {
  if (!map) return null
  return calculateRoute(originLat, originLng, destLat, destLng, map)
}

function clearRoutePolyline() {
  clearRoute()
}

defineExpose({ drawRoute, clearRoutePolyline })

onMounted(() => { initMap() })

onUnmounted(() => {
  if (moveDebounceTimer) clearTimeout(moveDebounceTimer)
  clearRoute()
  removeUserMarker()
  if (map) { map.remove(); map = null }
})
</script>

<template>
  <div class="relative w-full h-full">
    <div
      ref="mapContainer"
      class="w-full h-full z-map"
      aria-label="Mappa zone sicurezza"
      role="img"
    ></div>

    <!-- GPS very poor banner -->
    <div
      v-if="isGpsVeryPoor"
      class="absolute top-2 left-1/2 -translate-x-1/2 z-[400] bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-200 text-xs px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 max-w-[90vw] pointer-events-none"
    >
      <span class="font-medium">GPS molto impreciso</span>
      <span class="text-yellow-700 dark:text-yellow-300">— usa un dispositivo mobile per risultati migliori</span>
    </div>

    <!-- Loading indicator -->
    <div
      v-if="zonesStore.isLoading"
      class="absolute top-2 left-1/2 -translate-x-1/2 z-sheet pointer-events-none"
    >
      <div class="bg-surface-elevated/90 dark:bg-surface-dark-elevated/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-text-secondary dark:text-text-dark-secondary shadow-sm">
        Caricamento zone...
      </div>
    </div>

    <!-- Error indicator (when zones fail to load but map still works) -->
    <div
      v-if="zonesStore.error && !zonesStore.isLoading"
      class="absolute top-2 left-1/2 -translate-x-1/2 z-sheet pointer-events-none"
    >
      <div class="bg-safety-red/90 rounded-full px-3 py-1 text-xs text-white shadow-sm">
        Zone non disponibili
      </div>
    </div>

    <!-- GPS accuracy indicator -->
    <div
      v-if="props.userPosition?.accuracy != null"
      class="absolute bottom-4 left-1/2 -translate-x-1/2 z-sheet pointer-events-none"
    >
      <div
        class="backdrop-blur-sm rounded-full px-3 py-1 text-xs shadow-sm flex items-center gap-1.5"
        :class="[
          (props.userPosition.accuracy <= 20)
            ? 'bg-safety-green/90 text-green-900 dark:text-green-100'
            : (props.userPosition.accuracy <= 50)
            ? 'bg-surface-elevated/90 dark:bg-surface-dark-elevated/90 text-text-secondary dark:text-text-dark-secondary'
            : 'bg-safety-yellow/90 text-amber-900 dark:text-amber-100'
        ]"
      >
        <span
          class="w-1.5 h-1.5 rounded-full flex-shrink-0"
          :class="props.userPosition.accuracy <= 20 ? 'bg-safety-green' : props.userPosition.accuracy <= 50 ? 'bg-brand-blue' : 'bg-safety-yellow'"
        ></span>
        <span v-if="props.userPosition.accuracy <= 50">
          Precisione: ~{{ Math.round(props.userPosition.accuracy) }}m
        </span>
        <span v-else>
          Posizione poco precisa (~{{ Math.round(props.userPosition.accuracy) }}m)
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.user-position-marker) {
  animation: pulse-dot 2.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.15); }
}
</style>
