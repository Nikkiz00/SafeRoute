<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Zone } from '@/types'
import { useThemeStore } from '@/stores/theme'
import { useZonesStore } from '@/stores/zones'
import { calculateRoute, clearRoute, type TravelMode } from '@/composables/useRouting'
import { toLeafletLatLngs } from '@/utils/geo'

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
let userMarker: import('leaflet').Marker | null = null
let userAccuracyCircle: import('leaflet').Circle | null = null
let zoneLayers: import('leaflet').Polygon[] = []
let moveDebounceTimer: ReturnType<typeof setTimeout> | null = null
let leafletLib: typeof import('leaflet') | null = null // cached after initMap

const MARKER_TRANSITION = 'transform 0.8s ease-out'

function setMarkerTransition(enabled: boolean) {
  const el = userMarker?.getElement()
  if (el) el.style.transition = enabled ? MARKER_TRANSITION : 'none'
}

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
  if (!map || !leafletLib) return
  const L = leafletLib

  if (userMarker) {
    userMarker.setLatLng([lat, lng])
    // Restore active style in case it was set stale
    const wrap = userMarker.getElement()?.querySelector<HTMLElement>('.sr-marker-wrap')
    if (wrap) wrap.className = 'sr-marker-wrap active'
  } else {
    // Recreate marker if it was removed (e.g. after previous tracking session ended)
    userMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        html: '<div class="sr-marker-wrap active"><div class="sr-ring"></div><div class="sr-dot"><div class="sr-dot-inner"></div></div></div>',
        className: 'sr-marker-outer',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
      zIndexOffset: 1000,
      interactive: false,
    }).addTo(map)
    // Enable transition after initial placement (avoid animating from default to real position)
    setTimeout(() => setMarkerTransition(true), 100)
  }

  // Update accuracy circle
  if (accuracy != null && accuracy > 0 && accuracy <= 200) {
    if (userAccuracyCircle) {
      userAccuracyCircle.setLatLng([lat, lng]).setRadius(accuracy)
    } else {
      userAccuracyCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: '#2563EB',
        fillColor: '#2563EB',
        fillOpacity: 0.08,
        weight: 1,
        opacity: 0.4,
        className: 'user-accuracy-circle',
      }).addTo(map)
    }
  } else if (userAccuracyCircle) {
    userAccuracyCircle.remove()
    userAccuracyCircle = null
  }
}

function setMarkerStale() {
  // When tracking ends, keep marker visible at last known position but style it as inactive
  if (userMarker) {
    const wrap = userMarker.getElement()?.querySelector<HTMLElement>('.sr-marker-wrap')
    if (wrap) wrap.className = 'sr-marker-wrap stale'
  }
  if (userAccuracyCircle) {
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
  leafletLib = L

  // Fix default Leaflet icon paths for Vite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
  })

  const initCenter = props.userPosition
    ? [props.userPosition.lat, props.userPosition.lng] as [number, number]
    : [45.4642, 9.19] as [number, number]
  map = L.map(mapContainer.value, {
    center: initCenter,
    zoom: 13,
    zoomControl: false,
  })
  // Zoom control moved to bottom-left: the default top-left position collides
  // with the dashboard's top bar (avatar/search/theme), which spans the full width.
  L.control.zoom({ position: 'bottomleft' }).addTo(map)

  const isDark = themeStore.isDark
  tileLayer = L.tileLayer(isDark ? TILE_DARK : TILE_LIGHT, {
    attribution: isDark ? ATTRIBUTION_DARK : ATTRIBUTION_LIGHT,
    maxZoom: 19,
  }).addTo(map)

  // Create user marker at tracked position (if tracking active) or default city position
  const initPos = props.userPosition
  const initLat = initPos?.lat ?? 45.4642
  const initLng = initPos?.lng ?? 9.19
  const initActiveClass = initPos ? 'active' : 'stale'
  userMarker = L.marker([initLat, initLng], {
    icon: L.divIcon({
      html: `<div class="sr-marker-wrap ${initActiveClass}"><div class="sr-ring"></div><div class="sr-dot"><div class="sr-dot-inner"></div></div></div>`,
      className: 'sr-marker-outer',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    }),
    zIndexOffset: 1000,
    interactive: false,
  }).addTo(map)
  // Enable transition after initial placement — avoids animating the very first position set
  setTimeout(() => setMarkerTransition(true), 100)
  if (initPos?.accuracy) {
    updateUserMarkerAndAccuracy(initLat, initLng, initPos.accuracy)
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

  // Suspend marker position transition during zoom — Leaflet repositions markers after zoom
  // and we don't want the 0.8s ease-out to animate that repositioning
  map.on('zoomstart', () => setMarkerTransition(false))
  map.on('zoomend', () => { setTimeout(() => setMarkerTransition(true), 100) })
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
      toLeafletLatLngs(zone.geometry),
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
      // Tracking ended: keep marker visible at last known position (greyed out)
      setMarkerStale()
    }
  },
  { immediate: true, deep: true },
)

async function drawRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  preference: 'safe' | 'balanced' | 'fast' = 'balanced',
  travelMode: TravelMode = 'driving',
) {
  if (!map) return null
  return calculateRoute(originLat, originLng, destLat, destLng, map, preference, travelMode)
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
      class="absolute top-2 left-1/2 -translate-x-1/2 z-banner bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-200 text-xs px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 max-w-[90vw] pointer-events-none"
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
      class="absolute bottom-24 md:bottom-4 left-1/2 -translate-x-1/2 z-sheet pointer-events-none"
    >
      <div
        class="backdrop-blur-sm rounded-full px-3 py-1 text-xs shadow-sm flex items-center gap-1.5"
        :class="[
          (props.userPosition.accuracy <= 20)
            ? 'bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-300'
            : (props.userPosition.accuracy <= 50)
            ? 'bg-surface-elevated/90 dark:bg-surface-dark-elevated/90 text-text-secondary dark:text-text-dark-secondary'
            : 'bg-safety-yellow/90 text-amber-900 dark:text-amber-100'
        ]"
      >
        <span
          class="w-1.5 h-1.5 rounded-full flex-shrink-0"
          :class="props.userPosition.accuracy <= 50 ? 'bg-brand-blue' : 'bg-safety-yellow'"
        ></span>
        <span v-if="props.userPosition.accuracy <= 50">
          GPS ~{{ Math.round(props.userPosition.accuracy) }}m
        </span>
        <span v-else>
          GPS poco preciso (~{{ Math.round(props.userPosition.accuracy) }}m)
        </span>
      </div>
    </div>
  </div>
</template>

<style>
/*
 * SafeRoute — user position marker styles.
 * Non-scoped so they apply to Leaflet-injected DOM elements.
 * Classes prefixed sr- to avoid conflicts with other CSS.
 */

/* Neutralise Leaflet's default white box on div icons */
.sr-marker-outer {
  background: none !important;
  border: none !important;
  overflow: visible !important;
}

/* 40×40 container — centred on the geographic coordinate via iconAnchor:[20,20] */
.sr-marker-wrap {
  position: relative;
  width: 40px;
  height: 40px;
}

/*
 * Expanding ring — starts at 26px, scale to 2.5×, fades out.
 * Offset from container edge: (40 - 26) / 2 = 7px.
 * Communicates "live / real-time" without touching the dot's transform.
 */
.sr-ring {
  position: absolute;
  top: 7px;
  left: 7px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(37, 99, 235, 0.55);
  animation: sr-ring-pulse 2s ease-out infinite;
  pointer-events: none;
}

/*
 * Main dot — 26px total (border-box), 3px white border → 20px blue fill.
 * Offset: (40 - 26) / 2 = 7px.
 * Strong multi-layer shadow: visible on light tiles, dark tiles, and coloured zones.
 */
.sr-dot {
  position: absolute;
  top: 7px;
  left: 7px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #2563EB;
  border: 3px solid #ffffff;
  box-sizing: border-box;
  box-shadow:
    0 3px 16px rgba(0, 0, 0, 0.55),
    0 0 0 2px rgba(37, 99, 235, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

/* White centre dot — "bullseye" makes marker unmistakably "tu sei qui" */
.sr-dot-inner {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  flex-shrink: 0;
}

/* ── Stale state (tracking ended) ─────────────────────────────── */
.sr-marker-wrap.stale .sr-ring {
  display: none;
}

.sr-marker-wrap.stale .sr-dot {
  background: #475569;
  border-color: rgba(255, 255, 255, 0.75);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  opacity: 0.75;
}

.sr-marker-wrap.stale .sr-dot-inner {
  display: none;
}

@keyframes sr-ring-pulse {
  0%   { transform: scale(1);   opacity: 0.65; }
  100% { transform: scale(2.5); opacity: 0;    }
}
</style>
