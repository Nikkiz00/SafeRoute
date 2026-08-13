<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { X, Navigation, MapPin, Shield, Scale, Zap, Footprints, Car, Bike } from 'lucide-vue-next'
import { isRoutingFallback, type TravelMode } from '@/composables/useRouting'

defineProps<{ visible: boolean }>()

const emit = defineEmits<{
  close: []
  start: [payload: {
    startLat: number
    startLng: number
    endLat?: number
    endLng?: number
    destinationName: string | null
    routePreference: 'safe' | 'balanced' | 'fast'
    travelMode: TravelMode
  }]
}>()

const isLocating = ref(false)
const isStarting = ref(false)
const error = ref<string | null>(null)

type RoutePreference = 'safe' | 'balanced' | 'fast'
const routePreference = ref<RoutePreference>('balanced')
const travelMode = ref<TravelMode>('driving')

const travelModes: { id: TravelMode; label: string; icon: object; etaHint: string }[] = [
  { id: 'walking', label: 'A piedi', icon: Footprints, etaHint: '~5 km/h' },
  { id: 'driving', label: 'In auto', icon: Car, etaHint: '~50 km/h' },
  { id: 'cycling', label: 'In bici', icon: Bike, etaHint: '~15 km/h' },
]

const routePreferences = [
  { id: 'safe' as const, label: 'Più sicuro', icon: Shield, activeClass: 'text-safety-green bg-safety-green/5' },
  { id: 'balanced' as const, label: 'Bilanciato', icon: Scale, activeClass: 'text-brand-blue bg-brand-blue/5' },
  { id: 'fast' as const, label: 'Più veloce', icon: Zap, activeClass: 'text-amber-600 dark:text-amber-400 bg-safety-yellow/5' },
]

const modeDescriptions: Record<RoutePreference, string> = {
  safe: 'Preferisce zone sicure (verdi). Può essere più lungo ma passa per strade più sicure.',
  balanced: 'Compromesso ottimale tra velocità e sicurezza delle zone attraversate.',
  fast: 'Percorso più breve, senza considerare la sicurezza delle zone.',
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  primary: string
  secondary: string
}

function parseNominatimName(displayName: string): { primary: string; secondary: string } {
  const parts = displayName.split(', ').map(p => p.trim()).filter(Boolean)
  const filtered = parts.filter(p =>
    p !== 'Italia' &&
    !/^\d{5}$/.test(p) &&
    !p.startsWith('Città metropolitana') &&
    !p.startsWith('Municipio')
  )
  if (filtered.length === 0) return { primary: displayName, secondary: '' }

  let primaryEnd = 1
  if (filtered.length > 1 && /^\d+[a-zA-Z]?$/.test(filtered[1])) primaryEnd = 2
  const primary = filtered.slice(0, primaryEnd).join(', ')
  const rest = filtered.slice(primaryEnd).filter(p => !p.startsWith('Quartiere') && p.length < 50)
  const secondary = rest.slice(-2).join(', ')
  return { primary, secondary }
}

const destinationQuery = ref('')
const searchResults = ref<NominatimResult[]>([])
const selectedDestination = ref<NominatimResult | null>(null)
const isSearching = ref(false)

let searchTimeout: ReturnType<typeof setTimeout> | null = null
let currentAbortController: AbortController | null = null
let requestId = 0

function onDestinationInput() {
  selectedDestination.value = null
  if (searchTimeout) clearTimeout(searchTimeout)
  if (currentAbortController) currentAbortController.abort()

  if (destinationQuery.value.length < 3) {
    searchResults.value = []
    isSearching.value = false
    return
  }

  isSearching.value = true
  searchResults.value = []

  searchTimeout = setTimeout(async () => {
    const myId = ++requestId
    currentAbortController = new AbortController()

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destinationQuery.value)}&format=json&limit=5&countrycodes=it`,
        {
          headers: { 'Accept-Language': 'it' },
          signal: currentAbortController.signal,
        },
      )
      const data: Array<{ place_id: number; display_name: string; lat: string; lon: string }> = await res.json()
      if (myId === requestId) {
        searchResults.value = data.map(r => ({ ...r, ...parseNominatimName(r.display_name) }))
        isSearching.value = false
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      if (myId === requestId) {
        searchResults.value = []
        isSearching.value = false
      }
    }
  }, 300)
}

function selectDestination(result: NominatimResult) {
  selectedDestination.value = result
  destinationQuery.value = result.primary
  searchResults.value = []
  isSearching.value = false
}

function clearDestination() {
  selectedDestination.value = null
  destinationQuery.value = ''
  searchResults.value = []
  isSearching.value = false
}

function handleClose() {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (currentAbortController) currentAbortController.abort()
  isSearching.value = false
  error.value = null
  emit('close')
}

onUnmounted(() => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (currentAbortController) currentAbortController.abort()
})

async function handleStart() {
  if (!selectedDestination.value) {
    error.value = 'Seleziona una destinazione prima di avviare il percorso.'
    return
  }
  if (!navigator.geolocation) {
    error.value = 'Geolocalizzazione non disponibile sul tuo dispositivo.'
    return
  }

  isLocating.value = true
  isStarting.value = true
  error.value = null

  const dest = selectedDestination.value
  const destName = dest.secondary ? `${dest.primary} · ${dest.secondary}` : dest.primary

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      isLocating.value = false
      isStarting.value = false
      emit('start', {
        startLat: pos.coords.latitude,
        startLng: pos.coords.longitude,
        endLat: parseFloat(dest.lat),
        endLng: parseFloat(dest.lon),
        destinationName: destName,
        routePreference: routePreference.value,
        travelMode: travelMode.value,
      })
    },
    (err) => {
      isLocating.value = false
      isStarting.value = false
      const messages: Record<number, string> = {
        1: 'Permesso posizione negato. Abilita la geolocalizzazione nelle impostazioni del browser.',
        2: 'Posizione non disponibile. Verifica il GPS del dispositivo.',
        3: "Timeout rilevamento posizione. Riprova in un'area con segnale GPS migliore.",
      }
      error.value = messages[err.code] ?? 'Errore nel rilevamento della posizione.'
      console.warn('[gps] RouteStartModal geolocation error:', err.code, err.message)
    },
    { enableHighAccuracy: true, timeout: 10000 },
  )
}
</script>

<template>
  <Transition name="sheet">
    <div
      v-if="visible"
      class="fixed bottom-0 left-0 right-0 z-modal md:left-64"
      role="dialog"
      aria-modal="true"
      aria-label="Avvia percorso"
    >
      <div
        class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[-1]"
        @click="handleClose"
        aria-hidden="true"
      ></div>

      <div
        class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-t-3xl shadow-sheet px-6 pt-4 overflow-y-auto"
        style="max-height: 90dvh; max-height: 90vh; padding-bottom: calc(2rem + env(safe-area-inset-bottom))"
      >
        <!-- Handle + Close -->
        <div class="flex items-center justify-between mb-5">
          <div class="flex-1 flex justify-center">
            <div class="w-12 h-1.5 bg-border-light dark:bg-border-dark rounded-full"></div>
          </div>
          <button
            @click="handleClose"
            class="w-11 h-11 flex items-center justify-center rounded-full text-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Chiudi"
          >
            <X :size="18" />
          </button>
        </div>

        <!-- Title -->
        <div class="flex items-center gap-3 mb-2">
          <div class="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center">
            <Navigation :size="20" class="text-brand-blue" />
          </div>
          <h2 class="text-xl font-display font-semibold text-text-primary dark:text-text-dark-primary">
            Avvia percorso sicuro
          </h2>
        </div>

        <p class="text-sm text-text-secondary dark:text-text-dark-secondary mb-6">
          La tua posizione verrà aggiornata ogni 15 secondi. Potrai condividere il link di tracking
          con i tuoi contatti.
        </p>

        <!-- Destination search -->
        <div class="mb-5">
          <label class="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1.5 block">
            Destinazione <span class="text-safety-red">*</span>
          </label>

          <!-- Input + spinner -->
          <div class="relative">
            <MapPin :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-text-dark-secondary pointer-events-none" />
            <input
              v-model="destinationQuery"
              @input="onDestinationInput"
              type="text"
              placeholder="Cerca indirizzo o luogo..."
              autocomplete="off"
              class="w-full pl-9 pr-10 py-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-base dark:bg-surface-dark text-text-primary dark:text-text-dark-primary text-sm focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)] transition-all"
            />
            <div v-if="isSearching" class="absolute right-3 top-1/2 -translate-y-1/2">
              <div class="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>

          <!-- Results dropdown -->
          <div
            v-if="searchResults.length > 0"
            class="mt-1 border border-border-light dark:border-border-dark rounded-xl overflow-hidden bg-surface-elevated dark:bg-surface-dark-elevated shadow-lg max-h-52 overflow-y-auto"
          >
            <button
              v-for="result in searchResults"
              :key="result.place_id"
              @click="selectDestination(result)"
              class="w-full text-left flex items-start gap-3 px-4 min-h-[48px] py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700 border-b border-border-light dark:border-border-dark last:border-0 cursor-pointer transition-colors"
            >
              <MapPin :size="14" class="text-text-secondary dark:text-text-dark-secondary shrink-0 mt-1" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-text-primary dark:text-text-dark-primary truncate">{{ result.primary }}</div>
                <div v-if="result.secondary" class="text-xs text-text-secondary dark:text-text-dark-secondary truncate mt-0.5">{{ result.secondary }}</div>
              </div>
            </button>
          </div>

          <!-- No results (only after search completes with empty data) -->
          <p
            v-if="!isSearching && destinationQuery.length >= 3 && searchResults.length === 0 && !selectedDestination"
            class="mt-1.5 text-xs text-text-secondary dark:text-text-dark-secondary px-1"
          >
            Nessun risultato trovato. Prova un indirizzo diverso.
          </p>

          <!-- Selected destination badge -->
          <div
            v-if="selectedDestination"
            class="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-brand-blue/5 border border-brand-blue/20"
          >
            <MapPin :size="14" class="text-brand-blue shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <div class="text-sm text-brand-blue font-medium truncate">{{ selectedDestination.primary }}</div>
              <div v-if="selectedDestination.secondary" class="text-xs text-brand-blue/70 truncate mt-0.5">{{ selectedDestination.secondary }}</div>
            </div>
            <button
              @click="clearDestination"
              class="text-brand-blue/60 hover:text-brand-blue cursor-pointer shrink-0 mt-0.5"
              aria-label="Rimuovi destinazione"
            >
              <X :size="14" />
            </button>
          </div>
        </div>

        <!-- Travel mode -->
        <div class="mb-5">
          <label class="text-sm font-medium text-text-primary dark:text-text-dark-primary mb-2 block">Modalità di trasporto</label>
          <div class="flex gap-2">
            <button
              v-for="mode in travelModes"
              :key="mode.id"
              @click="travelMode = mode.id"
              :class="[
                'flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-medium transition-all cursor-pointer',
                travelMode === mode.id
                  ? 'border-brand-blue text-brand-blue bg-brand-blue/5'
                  : 'border-border-light dark:border-border-dark text-text-secondary dark:text-text-dark-secondary hover:border-slate-300 dark:hover:border-slate-600'
              ]"
              :aria-pressed="travelMode === mode.id"
            >
              <component :is="mode.icon" :size="18" />
              <span>{{ mode.label }}</span>
              <span class="text-[10px] opacity-60">{{ mode.etaHint }}</span>
            </button>
          </div>
        </div>

        <!-- Route preference -->
        <div class="mb-5">
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-text-primary dark:text-text-dark-primary">Preferenza percorso</label>
            <span
              class="text-xs font-medium px-2 py-0.5 rounded-full"
              :class="{
                'bg-safety-green/10 text-safety-green': routePreference === 'safe',
                'bg-brand-blue/10 text-brand-blue': routePreference === 'balanced',
                'bg-safety-yellow/10 text-amber-600 dark:text-amber-400': routePreference === 'fast',
              }"
            >
              {{ { safe: 'Più sicuro', balanced: 'Bilanciato', fast: 'Più veloce' }[routePreference] }}
            </span>
          </div>

          <div class="flex gap-2">
            <button
              v-for="pref in routePreferences"
              :key="pref.id"
              @click="routePreference = pref.id"
              :class="[
                'flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-medium transition-all cursor-pointer',
                routePreference === pref.id
                  ? `border-current ${pref.activeClass}`
                  : 'border-border-light dark:border-border-dark text-text-secondary dark:text-text-dark-secondary hover:border-slate-300 dark:hover:border-slate-600'
              ]"
            >
              <component :is="pref.icon" :size="18" />
              {{ pref.label }}
            </button>
          </div>
          <p class="text-xs text-text-secondary dark:text-text-dark-secondary mt-2 text-center italic">
            {{ modeDescriptions[routePreference] }}
          </p>
        </div>

        <p v-if="error" class="text-sm text-safety-red mb-4">{{ error }}</p>

        <div v-if="isRoutingFallback" class="mt-3 mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-2">
          <svg class="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="text-sm text-yellow-700 dark:text-yellow-300">
            Percorso indicativo: al momento non è stato possibile calcolare il tragitto reale. La linea mostrata è solo orientativa.
          </p>
        </div>

        <p class="text-xs text-text-secondary dark:text-text-dark-secondary text-center mt-2 mb-1">
          Il percorso mostrato è orientativo. I dati di sicurezza provengono dalla community.
        </p>

        <button
          @click="handleStart"
          :disabled="!selectedDestination || isStarting"
          class="w-full py-3.5 rounded-xl font-semibold text-base transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-brand-blue text-white hover:bg-blue-700 mt-3"
        >
          {{ isLocating ? 'Rilevamento posizione...' : 'Avvia percorso' }}
        </button>

        <p v-if="!selectedDestination" class="text-center text-xs text-text-secondary dark:text-text-dark-secondary mt-2">
          Cerca e seleziona una destinazione per iniziare
        </p>
      </div>
    </div>
  </Transition>
</template>
