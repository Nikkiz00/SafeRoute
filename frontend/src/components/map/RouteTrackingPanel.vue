<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { CheckCircle, X, Share2, MapPin, Clock } from 'lucide-vue-next'
import { completeRoute, cancelRoute, shareRoute } from '@/api/routes'
import { useRouteStore } from '@/stores/route'
import { ApiError } from '@/api/client'
import { isRoutingFallback } from '@/composables/useRouting'

const routeStore = useRouteStore()

const isCompleting = ref(false)
const isCancelling = ref(false)
const error = ref<string | null>(null)
const copySuccess = ref(false)

const session = computed(() => routeStore.activeSession)
const position = computed(() => routeStore.lastPosition)
const resolvedDestinationName = computed(
  () => session.value?.destinationName ?? routeStore.destinationName ?? null,
)

const statusLabel = computed(() => {
  switch (session.value?.status) {
    case 'active':
      return 'Percorso attivo'
    case 'completed':
      return 'Percorso completato'
    case 'cancelled':
      return 'Percorso annullato'
    case 'sos':
      return 'SOS attivo'
    default:
      return ''
  }
})

// Elapsed time tracking
const elapsedSeconds = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

watch(
  () => session.value?.status,
  (status) => {
    if (status === 'active' && session.value?.startedAt) {
      elapsedTimer = setInterval(() => {
        elapsedSeconds.value = Math.floor((Date.now() - new Date(session.value!.startedAt).getTime()) / 1000)
      }, 1000)
    } else {
      if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null }
    }
  },
  { immediate: true },
)

onUnmounted(() => { if (elapsedTimer) clearInterval(elapsedTimer) })

async function handleComplete() {
  if (!session.value || isCompleting.value) return
  isCompleting.value = true
  error.value = null
  try {
    const updated = await completeRoute(session.value.id)
    routeStore.setActiveSession(updated)
    setTimeout(() => routeStore.clearRoute(), 2000)
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : 'Errore durante il completamento'
    error.value = msg
    console.error('[route-panel] complete error:', e)
  } finally {
    isCompleting.value = false
  }
}

async function handleCancel() {
  if (!session.value || isCancelling.value) return
  isCancelling.value = true
  error.value = null
  try {
    const updated = await cancelRoute(session.value.id)
    routeStore.setActiveSession(updated)
    setTimeout(() => routeStore.clearRoute(), 2000)
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "Errore durante l'annullamento"
    error.value = msg
    console.error('[route-panel] cancel error:', e)
  } finally {
    isCancelling.value = false
  }
}

async function handleShare() {
  if (!session.value) return
  try {
    const info = await shareRoute(session.value.id)
    await navigator.clipboard.writeText(info.url)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch {
    // clipboard API might fail — fallback: just show the URL
    if (session.value?.shareUrl) {
      await navigator.clipboard.writeText(session.value.shareUrl).catch(() => {})
    }
  }
}
</script>

<template>
  <div
    v-if="routeStore.isTracking && session"
    class="fixed bottom-0 left-0 right-0 z-sheet md:left-64"
    role="region"
    aria-label="Percorso attivo"
  >
    <div
      class="bg-surface-elevated dark:bg-surface-dark-elevated border-t-2 border-brand-blue/30 px-6 pt-4 pb-6 shadow-sheet"
      style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom))"
    >
      <!-- Status header -->
      <div class="flex items-center gap-2 mb-2">
        <span
          :class="[
            'w-2.5 h-2.5 rounded-full',
            session.status === 'active'
              ? 'bg-brand-blue animate-pulse'
              : session.status === 'completed'
                ? 'bg-safety-green'
                : session.status === 'cancelled'
                  ? 'bg-slate-400'
                  : 'bg-safety-red animate-pulse',
          ]"
        ></span>
        <span class="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
          {{ statusLabel }}
        </span>
        <span
          v-if="position"
          class="ml-auto text-xs text-text-secondary dark:text-text-dark-secondary"
        >
          {{ position.lat.toFixed(5) }}, {{ position.lng.toFixed(5) }}
        </span>
      </div>

      <!-- Destination info -->
      <div
        v-if="resolvedDestinationName || session.destination"
        class="flex items-center gap-2 mb-2 text-xs text-text-secondary dark:text-text-dark-secondary"
      >
        <MapPin :size="12" class="shrink-0" />
        <span class="truncate">
          Verso: {{ resolvedDestinationName ?? `${session.destination?.lat.toFixed(4)}, ${session.destination?.lng.toFixed(4)}` }}
        </span>
      </div>

      <!-- Route distance / ETA from OSRM -->
      <div
        v-if="session.status === 'active'"
        class="flex items-center gap-2 mb-2 text-xs text-text-secondary dark:text-text-dark-secondary"
      >
        <Clock :size="12" class="shrink-0" />
        <span v-if="routeStore.routeDistanceKm != null">
          {{ routeStore.routeDistanceKm }} km &bull; {{ routeStore.routeDurationMin }} min (stima)
        </span>
        <span v-else-if="isRoutingFallback" class="italic">Percorso non calcolato — dati orientativi</span>
        <span v-else class="italic">Calcolo percorso in corso...</span>
      </div>

      <!-- Fallback routing note -->
      <div
        v-if="session.status === 'active' && isRoutingFallback"
        class="mb-2 text-xs text-text-secondary dark:text-text-dark-secondary italic"
      >
        Percorso stimato — dati orientativi
      </div>

      <!-- Elapsed time -->
      <div
        v-if="session.status === 'active'"
        class="flex items-center gap-2 mb-2 text-xs text-text-secondary dark:text-text-dark-secondary"
      >
        <Clock :size="12" class="shrink-0" />
        <span>Tempo: {{ formatElapsed(elapsedSeconds) }}</span>
      </div>

      <!-- GPS accuracy -->
      <div
        v-if="position?.accuracy != null && position.accuracy < 100"
        class="text-xs text-text-secondary dark:text-text-dark-secondary mb-3"
      >
        Precisione GPS: ~{{ Math.round(position.accuracy) }}m
      </div>

      <p v-if="error" class="text-sm text-safety-red mb-3">{{ error }}</p>

      <!-- Actions (only when active) -->
      <div v-if="session.status === 'active'" class="flex gap-2">
        <!-- Share -->
        <button
          @click="handleShare"
          class="w-10 h-10 flex items-center justify-center rounded-xl border border-border-light dark:border-border-dark text-text-secondary dark:text-text-dark-secondary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
          :title="copySuccess ? 'Link copiato!' : 'Condividi link'"
          :aria-label="copySuccess ? 'Link copiato' : 'Condividi link di tracking'"
        >
          <Share2 :size="16" :class="copySuccess ? 'text-safety-green' : ''" />
        </button>

        <!-- Cancel -->
        <button
          @click="handleCancel"
          :disabled="isCancelling"
          class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-text-primary dark:text-text-dark-primary font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X :size="16" />
          {{ isCancelling ? 'Annullamento...' : 'Annulla' }}
        </button>

        <!-- Complete ("Sono arrivato") -->
        <button
          @click="handleComplete"
          :disabled="isCompleting"
          class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-safety-green text-white font-semibold text-sm hover:brightness-95 transition-all cursor-pointer disabled:opacity-50"
        >
          <CheckCircle :size="16" />
          {{ isCompleting ? '...' : 'Sono arrivato' }}
        </button>
      </div>

      <!-- Completed/cancelled state -->
      <div v-else class="text-center py-1">
        <p
          class="text-sm font-medium"
          :class="
            session.status === 'completed'
              ? 'text-safety-green'
              : 'text-text-secondary dark:text-text-dark-secondary'
          "
        >
          {{
            session.status === 'completed'
              ? 'Ottimo! Sei arrivato in sicurezza.'
              : 'Percorso annullato.'
          }}
        </p>
      </div>
    </div>
  </div>
</template>
