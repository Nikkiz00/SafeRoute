<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Shield, LogOut, LayoutDashboard, Navigation, AlertTriangle, X, ShieldAlert } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useZonesStore } from '@/stores/zones'
import { useRouteStore } from '@/stores/route'
import { useSOSStore } from '@/stores/sos'
import { fetchZoneById } from '@/api/zones'
import { startRoute } from '@/api/routes'
import type { Zone } from '@/types'
import MapView from '@/components/map/MapView.vue'
import ZoneDetailsPanel from '@/components/map/ZoneDetailsPanel.vue'
import RouteStartModal from '@/components/map/RouteStartModal.vue'
import RouteTrackingPanel from '@/components/map/RouteTrackingPanel.vue'
import SOSButton from '@/components/sos/SOSButton.vue'
import SOSFlow from '@/components/sos/SOSFlow.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import MobileBottomNav from '@/components/common/MobileBottomNav.vue'
import DesktopSidebar from '@/components/common/DesktopSidebar.vue'
import { useRouteTracker } from '@/composables/useRouteTracker'

const router = useRouter()
const auth = useAuthStore()
const isDev = import.meta.env.DEV

const routeStore = useRouteStore()
const sosStore = useSOSStore()
const sosFlowRef = ref<InstanceType<typeof SOSFlow> | null>(null)
const mapViewRef = ref<InstanceType<typeof MapView> | null>(null)
const { startTracking, stopTracking } = useRouteTracker()

const selectedZone = ref<Zone | null>(null)
const showZonePanel = ref(false)
const showUserMenu = ref(false)
const showWelcomeBanner = ref(true)
const showRouteStart = ref(false)
const showLogoutConfirm = ref(false)
const routeError = ref<string | null>(null)

onMounted(() => {
  setTimeout(() => {
    showWelcomeBanner.value = false
  }, 3000)
})

function handleZoneClick(zone: Zone) {
  selectedZone.value = zone
  showZonePanel.value = true
}

async function handleSOSActivated() {
  sosStore.startFlow()
  if (!navigator.geolocation) {
    sosStore.setError('Geolocalizzazione non disponibile.')
    return
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      await sosFlowRef.value?.activate(
        pos.coords.latitude,
        pos.coords.longitude,
        pos.coords.accuracy,
      )
    },
    () => {
      // Fallback: trigger SOS without GPS using last known position or 0,0
      const lastPos = routeStore.lastPosition
      sosFlowRef.value?.activate(
        lastPos?.lat ?? 0,
        lastPos?.lng ?? 0,
        undefined,
      )
    },
    { enableHighAccuracy: true, timeout: 8000 },
  )
}

function handleLogout() {
  showUserMenu.value = false
  showLogoutConfirm.value = true
}

async function confirmLogout() {
  showLogoutConfirm.value = false
  await auth.logout()
  router.push('/login')
}

function closeZonePanel() {
  showZonePanel.value = false
}

async function handleZoneUpdated(zoneId: string) {
  try {
    const updatedZone = await fetchZoneById(zoneId)
    selectedZone.value = updatedZone
    const zonesStore = useZonesStore()
    zonesStore.updateZone(updatedZone)  // immediately update polygon color on map
    zonesStore.invalidateCache()         // force full reload on next moveend
  } catch {
    // Non-critical: zone panel stays open with stale data
  }
}

async function handleStartRoute(payload: {
  startLat: number
  startLng: number
  endLat?: number
  endLng?: number
  destinationName: string | null
  routePreference: 'safe' | 'balanced' | 'fast'
}) {
  showRouteStart.value = false
  try {
    const { routePreference, destinationName, ...rest } = payload
    const session = await startRoute({
      ...rest,
      ...(destinationName ? { destinationName } : {}),
    })
    routeStore.setActiveSession(session)
    routeStore.setTracking(true)
    routeStore.setDestinationName(destinationName)
    routeStore.setRoutePreference(routePreference)
    routeStore.setRouteInfo(null, null) // reset while OSRM loads
    startTracking()

    // Draw route on map via OSRM if destination is available
    if (payload.endLat != null && payload.endLng != null) {
      const result = await mapViewRef.value?.drawRoute(
        payload.startLat, payload.startLng,
        payload.endLat, payload.endLng,
      )
      if (result) {
        routeStore.setRouteInfo(result.distanceKm, result.durationMin)
        console.debug('[routing] route calculated:', result.distanceKm, 'km,', result.durationMin, 'min')
      }
    }
  } catch (err) {
    console.error('[route] failed to start route:', err)
    routeError.value = 'Impossibile avviare il percorso. Controlla la connessione.'
    setTimeout(() => { routeError.value = null }, 4000)
    showRouteStart.value = true // re-open modal so user can retry
  }
}

// Stop tracking when route ends
watch(() => routeStore.isTracking, (val) => {
  if (!val) {
    stopTracking()
    mapViewRef.value?.clearRoutePolyline()
  }
})

function handleMapError(msg: string) {
  console.error('[map]', msg)
}
</script>

<template>
  <div class="h-screen overflow-hidden relative">
    <!-- Desktop sidebar -->
    <DesktopSidebar class="hidden md:flex" />

    <!-- Map container — full viewport -->
    <div class="absolute inset-0 md:left-64">
      <MapView
        ref="mapViewRef"
        :user-position="routeStore.lastPosition"
        @zone-click="handleZoneClick"
        @error="handleMapError"
        class="w-full h-full"
      />
    </div>

    <!-- Overlay UI elements (above map) -->
    <div class="absolute inset-0 md:left-64 pointer-events-none">

      <!-- Email verification banner — solo se non verificata -->
      <div
        v-if="auth.user && !auth.user.emailVerified"
        class="pointer-events-auto absolute top-0 left-0 right-0 z-[400] bg-safety-yellow/90 backdrop-blur-sm px-4 py-2 flex items-center justify-between gap-2"
      >
        <div class="flex items-center gap-2 text-yellow-900 dark:text-yellow-900">
          <ShieldAlert :size="14" class="shrink-0" />
          <span class="text-xs font-medium">Email non verificata — funzioni limitate</span>
        </div>
        <button @click="router.push('/profile')" class="text-xs font-semibold text-yellow-900 underline cursor-pointer">
          Verifica ora
        </button>
      </div>

      <!-- Welcome banner -->
      <Transition name="fade-in">
        <div
          v-if="showWelcomeBanner"
          class="pointer-events-auto absolute top-20 left-4 right-4 z-sheet"
        >
          <div class="bg-surface-elevated/95 dark:bg-surface-dark-elevated/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-md border border-border-light dark:border-border-dark">
            <p class="text-sm font-medium text-text-primary dark:text-text-dark-primary">
              Ciao {{ auth.user?.name?.split(' ')[0] }}! Esplora le zone vicino a te.
              <span v-if="isDev" class="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-mono">DEV</span>
            </p>
          </div>
        </div>
      </Transition>

      <!-- Route error toast -->
      <Transition name="fade-in">
        <div
          v-if="routeError"
          class="pointer-events-auto absolute top-20 left-4 right-4 z-sheet"
          role="alert"
        >
          <div class="flex items-center gap-3 bg-safety-red/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-md text-white">
            <AlertTriangle :size="16" class="shrink-0" />
            <p class="text-sm font-medium flex-1">{{ routeError }}</p>
            <button @click="routeError = null" class="p-1 hover:bg-white/10 rounded-lg cursor-pointer">
              <X :size="14" />
            </button>
          </div>
        </div>
      </Transition>

      <!-- Top bar overlay -->
      <div class="pointer-events-auto absolute top-4 left-4 right-4 flex items-center gap-3 z-sheet">
        <!-- Avatar + user menu -->
        <div class="relative">
          <button
            @click="showUserMenu = !showUserMenu"
            class="flex items-center justify-center w-10 h-10 rounded-full bg-brand-blue text-white font-semibold text-sm shadow-md cursor-pointer tap-highlight-none"
            :aria-label="`Menu utente ${auth.user?.name}`"
            :aria-expanded="showUserMenu"
          >
            {{ auth.getInitials() }}
          </button>

          <!-- Dropdown menu -->
          <Transition name="fade-in">
            <div
              v-if="showUserMenu"
              class="absolute top-12 left-0 w-48 bg-surface-elevated dark:bg-surface-dark-elevated rounded-xl shadow-xl border border-border-light dark:border-border-dark overflow-hidden z-modal"
            >
              <div class="px-4 py-3 border-b border-border-light dark:border-border-dark">
                <p class="text-sm font-semibold text-text-primary dark:text-text-dark-primary truncate">{{ auth.user?.name }}</p>
                <p class="text-xs text-text-secondary dark:text-text-dark-secondary truncate">{{ auth.user?.plan }}</p>
              </div>
              <button
                v-if="auth.isAdmin"
                @click="router.push('/admin'); showUserMenu = false"
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary dark:text-text-dark-secondary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <LayoutDashboard :size="16" />
                Admin Panel
              </button>
              <button
                @click="handleLogout"
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-safety-red hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              >
                <LogOut :size="16" />
                Esci
              </button>
            </div>
          </Transition>
        </div>

        <!-- Search bar (disabilitata — geocoding non ancora disponibile) -->
        <div class="flex-1 flex items-center gap-3 px-4 h-12 bg-surface-elevated/95 dark:bg-surface-dark-elevated/95 backdrop-blur-sm rounded-xl border border-border-light dark:border-border-dark shadow-map opacity-50">
          <Search :size="18" class="text-text-secondary dark:text-text-dark-secondary shrink-0" />
          <input
            type="text"
            placeholder="Cerca zona... (in arrivo)"
            disabled
            class="flex-1 bg-transparent text-text-primary dark:text-text-dark-primary placeholder:text-text-secondary dark:placeholder:text-text-dark-secondary text-sm outline-none cursor-not-allowed"
            aria-label="Ricerca zone — non ancora disponibile"
          />
        </div>

        <!-- Theme toggle -->
        <div class="bg-surface-elevated/95 dark:bg-surface-dark-elevated/95 backdrop-blur-sm rounded-xl border border-border-light dark:border-border-dark shadow-map">
          <ThemeToggle />
        </div>
      </div>

      <!-- Click outside to close menu -->
      <div
        v-if="showUserMenu"
        class="pointer-events-auto absolute inset-0"
        @click="showUserMenu = false"
      ></div>

      <!-- Avvia percorso button — only when not tracking -->
      <button
        v-if="!routeStore.isTracking"
        @click="showRouteStart = true"
        class="pointer-events-auto fixed bottom-36 right-4 z-30 md:bottom-20 md:right-6 flex items-center gap-2 px-4 py-2.5 rounded-full bg-brand-blue text-white text-sm font-semibold shadow-lg hover:bg-blue-700 active:scale-95 transition-all cursor-pointer tap-highlight-none"
        aria-label="Avvia percorso sicuro"
      >
        <Navigation :size="14" />
        Percorso
      </button>

      <!-- SOS FAB button -->
      <div class="pointer-events-auto absolute bottom-20 right-4 md:bottom-6 md:right-6 z-sos">
        <SOSButton @activated="handleSOSActivated" />
      </div>
    </div>

    <!-- Zone Details Panel -->
    <ZoneDetailsPanel
      :zone="selectedZone"
      :visible="showZonePanel"
      @close="closeZonePanel"
      @zone-updated="handleZoneUpdated"
    />

    <!-- Route modals -->
    <RouteStartModal
      :visible="showRouteStart"
      @close="showRouteStart = false"
      @start="handleStartRoute"
    />

    <RouteTrackingPanel />

    <!-- SOS Flow overlay -->
    <SOSFlow ref="sosFlowRef" />

    <!-- Mobile bottom nav -->
    <MobileBottomNav class="md:hidden" />

    <!-- Logout confirm modal -->
    <div v-if="showLogoutConfirm" class="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showLogoutConfirm = false"></div>
      <div class="relative bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 class="font-display font-bold text-lg text-text-primary dark:text-text-dark-primary mb-2">Esci dall'account</h3>
        <p class="text-sm text-text-secondary dark:text-text-dark-secondary mb-6">Vuoi davvero uscire dal tuo account?</p>
        <div class="flex gap-3">
          <button @click="showLogoutConfirm = false" class="flex-1 py-3 rounded-xl border border-border-light dark:border-border-dark text-sm font-medium text-text-primary dark:text-text-dark-primary cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Annulla
          </button>
          <button @click="confirmLogout" class="flex-1 py-3 rounded-xl bg-safety-red text-white text-sm font-semibold cursor-pointer hover:brightness-95 transition-all">
            Esci
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
