<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertTriangle,
  CheckCircle,
  Phone,
  X,
  ArrowLeft,
  Eye,
  HandHelping,
  MessageCircle,
  Check,
  ChevronRight,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useContactsStore } from '@/stores/contacts'
import { triggerSOS } from '@/api/sos'
import { useRouteStore } from '@/stores/route'

const router = useRouter()
const auth = useAuthStore()
const contactsStore = useContactsStore()
const routeStore = useRouteStore()

const isSending = ref(false)
const sendError = ref<string | null>(null)
const notifiedCount = ref(0)

type Phase = 'select' | 'confirm' | 'countdown' | 'sent'

const phase = ref<Phase>('select')
const countdown = ref(5)
const progress = ref(0)
const isPressed = ref(false)
const selectedReasonId = ref<string | null>(null)
const customMessage = ref('')

interface SosReason {
  id: string
  label: string
  icon: object
}

const SOS_REASONS: SosReason[] = [
  { id: 'danger', label: 'Mi sento in pericolo', icon: AlertTriangle },
  { id: 'followed', label: 'Qualcuno mi segue', icon: Eye },
  { id: 'help', label: 'Ho bisogno di aiuto', icon: HandHelping },
  { id: 'other', label: 'Altro', icon: MessageCircle },
]

const selectedReason = computed(() =>
  SOS_REASONS.find((r) => r.id === selectedReasonId.value) ?? null,
)

const showCustomMessage = computed(
  () => selectedReasonId.value !== null && selectedReasonId.value !== 'false_alarm',
)

const LONG_PRESS_DURATION = 1500
const INTERVAL_MS = 15
const circumference = 2 * Math.PI * 28

const dashOffset = ref(circumference)

let pressInterval: ReturnType<typeof setInterval> | null = null
let countdownInterval: ReturnType<typeof setInterval> | null = null

function startPress() {
  if (phase.value !== 'confirm' || pressInterval) return
  isPressed.value = true
  progress.value = 0

  pressInterval = setInterval(() => {
    progress.value += (INTERVAL_MS / LONG_PRESS_DURATION) * 100
    dashOffset.value = circumference - (circumference * progress.value) / 100

    if (progress.value >= 100) {
      clearPress()
      activateSOS()
    }
  }, INTERVAL_MS)
}

function clearPress() {
  if (pressInterval) {
    clearInterval(pressInterval)
    pressInterval = null
  }
  isPressed.value = false
  progress.value = 0
  dashOffset.value = circumference
}

function cancelPress() {
  clearPress()
}

function activateSOS() {
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200])
  }

  const statusEl = document.getElementById('sos-status')
  if (statusEl) statusEl.textContent = 'SOS attivato. Invio tra 5 secondi.'

  phase.value = 'countdown'
  countdown.value = 5

  countdownInterval = setInterval(() => {
    if (navigator.vibrate) navigator.vibrate(100)
    countdown.value--

    const el = document.getElementById('sos-status')
    if (el) el.textContent = `Invio SOS tra ${countdown.value} secondi`

    if (countdown.value <= 0) {
      sendSOS()
    }
  }, 1000)
}

function cancelSOS() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
  phase.value = 'confirm'
  countdown.value = 5

  const el = document.getElementById('sos-status')
  if (el) el.textContent = 'SOS annullato'
}

async function sendSOS() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null }

  isSending.value = true
  sendError.value = null

  let lat = 0, lng = 0, accuracy: number | undefined
  try {
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => { lat = pos.coords.latitude; lng = pos.coords.longitude; accuracy = pos.coords.accuracy; resolve() },
        () => {
          const last = routeStore.lastPosition
          if (last) { lat = last.lat; lng = last.lng }
          resolve()
        },
        { enableHighAccuracy: true, timeout: 5000 },
      )
    })
  } catch { /* silent */ }

  try {
    const result = await triggerSOS({
      lat,
      lng,
      accuracy,
      routeSessionId: routeStore.activeSession?.id,
      message: selectedReasonId.value
        ? `${SOS_REASONS.find(r => r.id === selectedReasonId.value)?.label ?? ''}${customMessage.value ? ': ' + customMessage.value : ''}`
        : customMessage.value || undefined,
    })
    notifiedCount.value = result.notifiedContacts.length
  } catch (err) {
    sendError.value = err instanceof Error ? err.message : 'Errore durante l\'invio'
    console.error('[sos page] failed to send SOS:', err)
  } finally {
    isSending.value = false
    phase.value = 'sent'
  }

  const el = document.getElementById('sos-status')
  if (el) el.textContent = 'SOS inviato. I tuoi contatti sono stati avvisati.'
}

function handleSelectReason(id: string) {
  if (selectedReasonId.value === id) {
    selectedReasonId.value = null
    return
  }
  selectedReasonId.value = id
}

function goToConfirm() {
  phase.value = 'confirm'
}

function markSafe() {
  phase.value = 'select'
  router.push('/map')
}

onUnmounted(() => {
  clearPress()
  if (countdownInterval) clearInterval(countdownInterval)
})
</script>

<template>
  <div class="min-h-screen flex flex-col relative overflow-hidden">
    <!-- Background -->
    <div
      :class="[
        'absolute inset-0 transition-all duration-500',
        phase === 'sent'
          ? 'bg-brand-navy'
          : phase === 'countdown'
          ? 'bg-red-900'
          : 'bg-surface-base dark:bg-surface-dark',
      ]"
    ></div>

    <!-- Accessibility live region -->
    <div id="sos-status" class="sr-only" aria-live="assertive" aria-atomic="true"></div>

    <!-- Header -->
    <div class="relative z-10 flex items-center justify-between p-4">
      <button
        v-if="phase !== 'sent'"
        @click="phase === 'confirm' ? (phase = 'select') : router.push('/map')"
        class="p-3 rounded-xl cursor-pointer transition-colors"
        :class="phase === 'countdown' ? 'text-white/70 hover:text-white' : 'text-text-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800'"
        aria-label="Indietro"
      >
        <ArrowLeft :size="20" />
      </button>
      <div v-else class="w-12"></div>

      <h1
        :class="[
          'font-display font-bold text-lg',
          phase === 'countdown' || phase === 'sent' ? 'text-white' : 'text-text-primary dark:text-text-dark-primary',
        ]"
      >
        {{ phase === 'sent' ? 'SOS Inviato' : 'Emergenza' }}
      </h1>
      <div class="w-10"></div>
    </div>

    <!-- PHASE: SELECT — scelta motivo -->
    <div v-if="phase === 'select'" class="relative z-10 flex-1 flex flex-col px-5 pb-8 overflow-y-auto">

      <!-- Call 112 reminder -->
      <a
        href="tel:112"
        class="flex items-center gap-3 px-4 py-3 rounded-xl bg-safety-red/10 border border-safety-red/20 mb-5 mt-1"
      >
        <Phone :size="16" class="text-safety-red shrink-0" />
        <p class="text-sm text-safety-red font-medium flex-1">Emergenza reale? Chiama il <strong>112</strong></p>
        <ChevronRight :size="16" class="text-safety-red/60" />
      </a>

      <!-- Reason selection card -->
      <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl border border-border-light dark:border-border-dark p-5 mb-4">
        <p class="text-base font-semibold text-text-primary dark:text-text-dark-primary mb-4">
          Cosa sta succedendo?
        </p>
        <div class="flex flex-col gap-2">
          <button
            v-for="reason in SOS_REASONS"
            :key="reason.id"
            @click="handleSelectReason(reason.id)"
            :class="[
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-150 text-left',
              selectedReasonId === reason.id
                ? 'border-brand-blue bg-brand-blue/5 text-text-primary dark:text-text-dark-primary'
                : 'border-border-light dark:border-border-dark text-text-secondary dark:text-text-dark-secondary hover:border-brand-blue/40 hover:text-text-primary dark:hover:text-text-dark-primary',
            ]"
          >
            <component :is="reason.icon" :size="18" class="shrink-0" />
            <span class="flex-1 text-sm font-medium text-left">{{ reason.label }}</span>
            <div v-if="selectedReasonId === reason.id" class="w-4 h-4 rounded-full bg-brand-blue/20 flex items-center justify-center">
              <Check :size="10" class="text-brand-blue" />
            </div>
          </button>
        </div>

        <!-- Optional message textarea -->
        <div v-if="showCustomMessage" class="mt-3">
          <textarea
            v-model="customMessage"
            placeholder="Descrizione opzionale..."
            maxlength="300"
            rows="3"
            class="w-full resize-none rounded-xl border border-border-light dark:border-border-dark bg-surface-base dark:bg-surface-dark text-text-primary dark:text-text-dark-primary placeholder:text-text-secondary dark:placeholder:text-text-dark-secondary text-sm px-4 py-3 outline-none focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] transition"
          ></textarea>
          <p class="text-xs text-text-secondary dark:text-text-dark-secondary text-right mt-1">
            {{ customMessage.length }}/300
          </p>
        </div>
      </div>

      <!-- CTA buttons -->
      <div class="flex flex-col gap-2 mt-auto pt-2">
        <button
          v-if="selectedReasonId"
          @click="goToConfirm"
          class="w-full py-3.5 rounded-xl bg-sos-red text-white font-semibold text-base cursor-pointer hover:brightness-95 transition-all"
        >
          Avanti
        </button>
        <button
          @click="goToConfirm"
          :class="[
            'w-full py-3 rounded-xl font-medium text-sm cursor-pointer transition-colors',
            selectedReasonId
              ? 'text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-primary'
              : 'bg-sos-red text-white hover:brightness-95',
          ]"
        >
          {{ selectedReasonId ? 'Continua senza motivo' : 'Avanti' }}
        </button>
      </div>

      <!-- Safety disclaimer -->
      <p class="text-xs text-center text-text-secondary dark:text-text-dark-secondary mt-4 px-4">
        SafeRoute invia la tua posizione ai tuoi contatti di emergenza. Non sostituisce il 112.
        In caso di pericolo reale, chiama sempre i servizi di emergenza.
      </p>

      <!-- Not authenticated -->
      <div v-if="!auth.isAuthenticated" class="mt-4 p-4 rounded-xl bg-safety-red/10 border border-safety-red/30">
        <p class="text-sm text-safety-red font-medium mb-2">Accedi per inviare SOS ai tuoi contatti</p>
        <div class="flex gap-2">
          <a href="tel:112" class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-safety-red text-white font-semibold cursor-pointer text-sm">
            <Phone :size="16" />
            Chiama 112
          </a>
          <button @click="router.push('/login')" class="flex-1 py-3 rounded-xl border border-safety-red/50 text-safety-red font-semibold cursor-pointer text-sm">
            Accedi
          </button>
        </div>
      </div>
    </div>

    <!-- PHASE: CONFIRM — long press -->
    <div v-else-if="phase === 'confirm'" class="relative z-10 flex-1 flex flex-col items-center px-5 pb-8 overflow-y-auto">

      <!-- Selected reason chip -->
      <div v-if="selectedReason" class="mt-2 mb-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-elevated dark:bg-surface-dark-elevated border border-border-light dark:border-border-dark self-center">
        <component :is="selectedReason.icon" :size="13" class="text-text-secondary dark:text-text-dark-secondary" />
        <span class="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">{{ selectedReason.label }}</span>
      </div>
      <div v-else class="mt-2 mb-6"></div>

      <!-- Instruction -->
      <p class="text-text-secondary dark:text-text-dark-secondary text-sm font-medium mb-8 text-center">
        Tieni premuto il pulsante per inviare SOS
      </p>

      <!-- Big SOS button -->
      <button
        @pointerdown.prevent="startPress"
        @pointerup="cancelPress"
        @pointerleave="cancelPress"
        @pointercancel="cancelPress"
        class="relative flex items-center justify-center w-32 h-32 rounded-full bg-sos-red text-white cursor-pointer tap-highlight-none select-none touch-none shadow-sos"
        :class="isPressed ? 'scale-110' : 'animate-pulse-sos'"
        aria-label="Pulsante SOS di emergenza. Tieni premuto per 1,5 secondi per attivare."
        role="button"
        :aria-pressed="isPressed"
      >
        <!-- Progress ring -->
        <svg class="absolute inset-0 -rotate-90 w-full h-full" viewBox="0 0 128 128" aria-hidden="true">
          <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="6" />
          <circle
            cx="64" cy="64" r="56"
            fill="none" stroke="#FCA5A5" stroke-width="6" stroke-linecap="round"
            :stroke-dasharray="circumference * 2"
            :stroke-dashoffset="dashOffset * 2"
            style="transition: stroke-dashoffset 0.015s linear"
          />
        </svg>
        <AlertTriangle :size="48" class="relative z-10" />
        <span class="font-display font-bold text-sm absolute bottom-5 tracking-widest">SOS</span>
      </button>

      <p class="text-xs text-text-secondary dark:text-text-dark-secondary mt-6 mb-8">
        Rilascia per annullare
      </p>

      <!-- Call 112 -->
      <a href="tel:112" class="flex items-center gap-2 text-sm text-text-secondary dark:text-text-dark-secondary underline cursor-pointer mt-auto">
        <Phone :size="14" />
        Chiama il 112
      </a>
    </div>

    <!-- PHASE: COUNTDOWN -->
    <div v-else-if="phase === 'countdown'" class="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center">
      <p class="text-white/80 text-lg mb-4">SOS verrà inviato tra...</p>

      <div
        aria-live="assertive"
        aria-atomic="true"
        class="font-display text-9xl font-bold text-white mb-2"
      >
        {{ countdown }}
      </div>

      <p class="text-white/60 text-sm mb-10">secondi</p>

      <!-- Progress bar (emptying) -->
      <div class="w-full max-w-xs h-2 bg-white/20 rounded-full overflow-hidden mb-10">
        <div
          class="h-full bg-white rounded-full transition-all duration-1000"
          :style="{ width: `${(countdown / 5) * 100}%` }"
        ></div>
      </div>

      <!-- Cancel button -->
      <button
        @click="cancelSOS"
        class="flex items-center gap-3 px-10 py-4 rounded-full bg-white text-sos-red font-bold text-xl cursor-pointer hover:bg-red-50 transition-colors"
      >
        <X :size="22" />
        Annulla
      </button>
    </div>

    <!-- PHASE: SENT -->
    <div v-else-if="phase === 'sent'" class="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div class="w-20 h-20 mb-8 rounded-full bg-safety-green/20 flex items-center justify-center">
        <CheckCircle :size="48" class="text-safety-green" />
      </div>

      <h2 class="font-display text-3xl font-bold text-white mb-4">SOS inviato</h2>

      <p class="text-white/80 mb-2">
        Notifica inviata a
        <strong>{{ notifiedCount || contactsStore.contacts.length }} contatti</strong>
      </p>
      <p v-if="sendError" class="text-red-300 text-sm mb-2">{{ sendError }}</p>
      <p v-if="isSending" class="text-white/60 text-sm mb-2">Invio in corso...</p>
      <p class="text-white/60 text-sm mb-10">
        Posizione GPS acquisita
      </p>

      <!-- Call 112 -->
      <a
        href="tel:112"
        class="flex items-center justify-center gap-2 w-full max-w-xs py-4 rounded-xl bg-white text-brand-navy font-bold text-lg mb-4 cursor-pointer hover:bg-slate-100 transition-colors"
      >
        <Phone :size="20" />
        Chiama il 112
      </a>

      <!-- Safe actions -->
      <div class="flex flex-col gap-3 w-full max-w-xs">
        <button
          @click="markSafe"
          class="w-full py-3 rounded-xl bg-safety-green text-white font-semibold cursor-pointer hover:bg-green-600 transition-colors"
        >
          Sono al sicuro
        </button>
        <button
          class="w-full py-3 rounded-xl border border-white/30 text-white font-semibold cursor-pointer hover:bg-white/10 transition-colors"
        >
          Ho ancora bisogno di aiuto
        </button>
      </div>
    </div>
  </div>
</template>
