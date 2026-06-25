<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import L from 'leaflet'
import type { TrackingData } from '@/types'
import { fetchTracking } from '@/api/routes'
import { ApiError } from '@/api/client'

const route = useRoute()
const token = route.params.token as string

const data = ref<TrackingData | null>(null)
const error = ref<string | null>(null)
const isLoading = ref(true)
const isPollingMode = ref(false)

let map: L.Map | null = null
let marker: L.CircleMarker | null = null
let eventSource: EventSource | null = null
let pollingInterval: ReturnType<typeof setInterval> | null = null
let sseRetryCount = 0

const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const POLL_INTERVAL_MS = 15_000
const SSE_MAX_RETRIES = 3
const SSE_RETRY_DELAY_MS = 3000
const isDev = import.meta.env.DEV

const statusMessages: Record<string, string> = {
  active: 'Tracking in tempo reale',
  completed: 'Percorso completato',
  cancelled: 'Percorso annullato',
  sos: 'SOS attivo',
}

function initMap(lat: number, lng: number) {
  if (map) return
  const mapEl = document.getElementById('tracking-map')
  if (!mapEl) return

  map = L.map(mapEl, { zoomControl: true }).setView([lat, lng], 15)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
  }).addTo(map)

  marker = L.circleMarker([lat, lng], {
    radius: 10,
    fillColor: '#2563EB',
    color: '#ffffff',
    weight: 3,
    opacity: 1,
    fillOpacity: 0.9,
  }).addTo(map)
  marker.bindPopup('Posizione attuale').openPopup()
}

// Fix 4: Only re-pan when the marker leaves the current viewport bounds
function updateMarker(lat: number, lng: number) {
  if (!map) {
    initMap(lat, lng)
    return
  }
  marker?.setLatLng([lat, lng])
  if (!map.getBounds().contains([lat, lng])) {
    map.panTo([lat, lng], { animate: true, duration: 0.5 })
  }
}

async function loadTracking() {
  try {
    data.value = await fetchTracking(token)
    if (data.value.lastPosition) {
      const { lat, lng } = data.value.lastPosition
      updateMarker(lat, lng)
    }
    isDev && console.debug('[tracking] poll: status=', data.value?.status)

    // Fix 2: Stop polling when the session is no longer active
    if (isPollingMode.value && data.value && data.value.status !== 'active') {
      isDev && console.debug('[tracking] session ended, stopping polling')
      if (pollingInterval) {
        clearInterval(pollingInterval)
        pollingInterval = null
      }
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      isDev && console.debug('[tracking] token invalid or expired')
      error.value = 'Il link di tracking non è valido o è scaduto.'
    } else {
      error.value = 'Errore nel caricamento della posizione. Riprova.'
    }
  } finally {
    isLoading.value = false
  }
}

function startSSE() {
  if (!window.EventSource) {
    console.debug('[tracking] SSE not supported, falling back to polling')
    isPollingMode.value = true
    startPolling()
    return
  }
  console.debug(`[tracking] SSE connecting (attempt ${sseRetryCount + 1}/${SSE_MAX_RETRIES + 1})`)
  eventSource = new EventSource(`${BACKEND_URL}/api/tracking/${token}/stream`)
  eventSource.onopen = () => {
    console.debug('[tracking] SSE connection opened')
    sseRetryCount = 0
  }

  // Fix 1: Type-safe SSE message handler with proper init/ping/status separation
  eventSource.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data) as { type: string; [key: string]: unknown }

      if (msg.type === 'init') {
        // Full state from server: update position and status if data is already loaded
        const pos = msg.lastPosition as { lat: number; lng: number } | null
        if (pos) updateMarker(pos.lat, pos.lng)
        if (data.value && msg.status) {
          data.value = { ...data.value, status: msg.status as TrackingData['status'] }
        }
        isDev && console.debug('[tracking] SSE init received, status:', msg.status)
      } else if (msg.type === 'ping') {
        // Position-only update — no status field on ping messages
        const pos = msg.position as { lat: number; lng: number } | null
        if (pos) updateMarker(pos.lat, pos.lng)
      } else if (msg.type === 'status') {
        if (data.value) {
          data.value = { ...data.value, status: msg.status as TrackingData['status'] }
        }
        isDev && console.debug('[tracking] SSE status update:', msg.status)
        // Close SSE gracefully when session ends
        if (msg.status === 'completed' || msg.status === 'cancelled') {
          eventSource?.close()
          eventSource = null
        }
      }
    } catch {
      // ignore malformed SSE messages
    }
  }

  eventSource.onerror = () => {
    eventSource?.close()
    eventSource = null
    if (sseRetryCount < SSE_MAX_RETRIES) {
      sseRetryCount++
      console.debug(`[tracking] SSE error, retrying in ${SSE_RETRY_DELAY_MS}ms (${sseRetryCount}/${SSE_MAX_RETRIES})`)
      setTimeout(() => startSSE(), SSE_RETRY_DELAY_MS)
    } else {
      console.debug('[tracking] SSE max retries reached, falling back to polling')
      startPolling()
    }
  }
}

function startPolling() {
  isPollingMode.value = true
  pollingInterval = setInterval(loadTracking, POLL_INTERVAL_MS)
}

// Fix 3: Page Visibility API — fetch immediately when tab becomes visible in polling mode
function handleVisibilityChange() {
  if (document.hidden) {
    isDev && console.debug('[tracking] tab hidden — SSE/polling paused by browser')
  } else {
    isDev && console.debug('[tracking] tab visible — resuming tracking')
    if (isPollingMode.value && data.value?.status === 'active') {
      loadTracking()
    }
  }
}

onMounted(async () => {
  await loadTracking()
  if (data.value?.status === 'active') startSSE()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  eventSource?.close()
  if (pollingInterval) clearInterval(pollingInterval)
  map?.remove()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <div class="min-h-screen bg-surface dark:bg-surface-dark flex flex-col">
    <!-- Header -->
    <header
      class="px-4 py-3 flex items-center gap-3 bg-surface-elevated dark:bg-surface-dark-elevated border-b border-border-light dark:border-border-dark"
    >
      <div class="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
          />
        </svg>
      </div>
      <div>
        <p class="text-xs text-text-secondary dark:text-text-dark-secondary">SafeRoute</p>
        <p class="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
          {{ data ? (statusMessages[data.status] ?? 'Tracking') : 'Caricamento...' }}
        </p>
      </div>
      <span
        v-if="data?.status === 'active'"
        class="ml-auto text-xs px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue font-medium flex items-center gap-1"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-brand-blue animate-pulse"></span>
        Live
      </span>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3">
        <div
          class="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"
        ></div>
        <p class="text-sm text-text-secondary dark:text-text-dark-secondary">
          Caricamento posizione...
        </p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center px-6">
      <div class="text-center">
        <p class="text-4xl mb-3">&#128274;</p>
        <p class="text-base font-semibold text-text-primary dark:text-text-dark-primary mb-1">
          Link non valido
        </p>
        <p class="text-sm text-text-secondary dark:text-text-dark-secondary">{{ error }}</p>
      </div>
    </div>

    <!-- Map + status -->
    <template v-else>
      <!-- Polling mode banner -->
      <div
        v-if="isPollingMode && data?.status === 'active'"
        class="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 flex items-center gap-2"
      >
        <svg class="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p class="text-xs text-yellow-700 dark:text-yellow-300">
          Aggiornamento in tempo reale non disponibile — modalità polling
        </p>
      </div>

      <!-- Map -->
      <div class="flex-1 relative">
        <div id="tracking-map" class="w-full h-full min-h-[60vh]"></div>

        <!-- No position overlay -->
        <div
          v-if="!data?.lastPosition"
          class="absolute inset-0 flex items-center justify-center bg-surface/80 dark:bg-surface-dark/80 backdrop-blur-sm"
        >
          <div class="text-center px-6">
            <p class="text-2xl mb-2">&#128205;</p>
            <p class="text-sm font-medium text-text-primary dark:text-text-dark-primary">
              In attesa della prima posizione...
            </p>
          </div>
        </div>
      </div>

      <!-- Active tracking disclaimer -->
      <div v-if="data?.status === 'active'" class="px-4 py-3 text-center border-t border-border-light dark:border-border-dark">
        <p class="text-xs text-text-secondary dark:text-text-dark-secondary">
          Questa pagina mostra la posizione condivisa volontariamente dall'utente. In caso di emergenza reale, chiama il 112.
        </p>
      </div>

      <!-- Status footer -->
      <div
        v-if="data?.status !== 'active'"
        class="px-6 py-4 bg-surface-elevated dark:bg-surface-dark-elevated border-t border-border-light dark:border-border-dark text-center"
      >
        <p
          class="text-sm font-semibold mb-1"
          :class="
            data?.status === 'completed'
              ? 'text-safety-green'
              : 'text-text-secondary dark:text-text-dark-secondary'
          "
        >
          {{
            data?.status === 'completed'
              ? '&#10003; La persona è arrivata in sicurezza'
              : 'Percorso annullato'
          }}
        </p>
        <p class="text-xs text-text-secondary dark:text-text-dark-secondary">
          Questo link non è più attivo. Il percorso si è concluso.
        </p>
      </div>
    </template>
  </div>
</template>
