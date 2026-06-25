<script setup lang="ts">
import { ref, computed } from 'vue'
import { Copy, Check, X, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-vue-next'
import { useSOSStore } from '@/stores/sos'
import { useRouteStore } from '@/stores/route'
import { triggerSOS, submitSOSFollowup } from '@/api/sos'
import { ApiError } from '@/api/client'
import type { SOSFollowupOption } from '@/types'

const sosStore = useSOSStore()
const routeStore = useRouteStore()

const copied = ref(false)
const selectedFollowup = ref<SOSFollowupOption['value'] | null>(null)
const followupNotes = ref('')
const isSubmittingFollowup = ref(false)

const FOLLOWUP_OPTIONS: SOSFollowupOption[] = [
  { value: 'false_alarm', label: 'Sì, falso allarme', emoji: '✅' },
  { value: 'resolved', label: 'Sì, situazione risolta', emoji: '🙏' },
  { value: 'still_danger', label: 'No, sono ancora in pericolo', emoji: '🆘' },
  { value: 'no_response', label: 'Preferisco non rispondere', emoji: '🔇' },
]

const notificationStatusLabel = computed(() => {
  switch (sosStore.activationResult?.notificationStatus) {
    case 'sent': return { text: 'Notifiche inviate', color: 'text-safety-green' }
    case 'partial': return { text: 'Notifiche parziali', color: 'text-safety-yellow' }
    case 'failed': return { text: 'Invio notifiche fallito', color: 'text-safety-red' }
    case 'no_contacts': return { text: 'Nessun contatto di emergenza configurato', color: 'text-safety-yellow' }
    default: return { text: '', color: '' }
  }
})

async function copyTrackingUrl() {
  const url = sosStore.activationResult?.trackingUrl
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // clipboard write failed silently
  }
}

async function handleFollowupSubmit() {
  if (!selectedFollowup.value || !sosStore.sosId) return
  isSubmittingFollowup.value = true
  try {
    if (selectedFollowup.value !== 'no_response') {
      await submitSOSFollowup(sosStore.sosId, {
        response: selectedFollowup.value,
        notes: followupNotes.value.trim() || undefined,
      })
    }
    sosStore.completeFollowup()
  } catch {
    // Non-critical: dismiss anyway
    sosStore.completeFollowup()
  } finally {
    isSubmittingFollowup.value = false
  }
}

async function activate(lat: number, lng: number, accuracy?: number) {
  sosStore.setSending()
  try {
    const result = await triggerSOS({
      lat,
      lng,
      accuracy,
      routeSessionId: routeStore.activeSession?.id,
    })
    sosStore.setActive(result)
  } catch (e) {
    if (e instanceof ApiError) {
      sosStore.setError(e.message)
    } else {
      sosStore.setError('Impossibile inviare SOS. Chiama il 112.')
    }
  }
}

defineExpose({ activate })
</script>

<template>
  <Transition name="fade">
    <div
      v-if="sosStore.showFlow"
      class="fixed inset-0 z-sos bg-black/95 flex flex-col"
      role="alertdialog"
      aria-modal="true"
      aria-label="SOS attivato"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 pt-safe pt-4 pb-4 border-b border-red-900">
        <div class="flex items-center gap-2">
          <AlertTriangle :size="20" class="text-sos-red" />
          <span class="font-display font-bold text-white text-lg">SafeRoute SOS</span>
        </div>
        <button
          v-if="sosStore.flowState === 'active' || sosStore.flowState === 'error'"
          @click="sosStore.requestFollowup"
          class="text-gray-400 hover:text-white transition-colors cursor-pointer p-1"
          aria-label="Chiudi SOS"
        >
          <X :size="20" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto px-5 py-6 space-y-5">

        <!-- Locating state -->
        <div v-if="sosStore.flowState === 'locating'" class="flex flex-col items-center gap-4 py-10">
          <div class="w-16 h-16 border-4 border-sos-red border-t-transparent rounded-full animate-spin"></div>
          <p class="text-white font-medium">Rilevamento posizione...</p>
        </div>

        <!-- Sending state -->
        <div v-else-if="sosStore.flowState === 'sending'" class="flex flex-col items-center gap-4 py-10">
          <div class="w-16 h-16 border-4 border-sos-red border-t-transparent rounded-full animate-spin"></div>
          <p class="text-white font-medium">Invio SOS in corso...</p>
          <p class="text-gray-400 text-sm text-center">Avviso i tuoi contatti di emergenza...</p>
        </div>

        <!-- Error state -->
        <div v-else-if="sosStore.flowState === 'error'" class="flex flex-col items-center gap-4 py-10">
          <div class="w-16 h-16 rounded-full bg-red-900 flex items-center justify-center">
            <AlertTriangle :size="32" class="text-sos-red" />
          </div>
          <p class="text-white font-bold text-center">Errore durante invio SOS</p>
          <p class="text-red-300 text-sm text-center">{{ sosStore.error }}</p>
          <p class="text-gray-300 text-sm font-semibold">Per un'emergenza reale, chiama il 112</p>
        </div>

        <!-- Active state (SOS sent) -->
        <template v-else-if="sosStore.flowState === 'active' && sosStore.activationResult">
          <!-- Status badge -->
          <div class="flex items-center gap-2 py-2 px-3 rounded-xl bg-red-950 border border-red-800">
            <span class="w-2.5 h-2.5 bg-sos-red rounded-full animate-pulse"></span>
            <span class="text-white font-semibold text-sm">SOS attivato</span>
            <span :class="['ml-auto text-xs font-medium', notificationStatusLabel.color]">
              {{ notificationStatusLabel.text }}
            </span>
          </div>

          <!-- Contacts notified -->
          <div v-if="sosStore.activationResult.notifiedContacts.length > 0">
            <p class="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">Contatti avvisati</p>
            <div class="space-y-2">
              <div
                v-for="contact in sosStore.activationResult.notifiedContacts"
                :key="contact.contactId"
                class="flex items-center justify-between py-2.5 px-3 rounded-xl bg-gray-900"
              >
                <span class="text-white font-medium text-sm">{{ contact.name }}</span>
                <div class="flex gap-1.5">
                  <span
                    v-for="ch in contact.channels"
                    :key="ch.channel"
                    :class="[
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      ch.status === 'sent' ? 'bg-green-900 text-green-300' :
                      ch.status === 'failed' ? 'bg-red-900 text-red-300' :
                      'bg-gray-800 text-gray-400'
                    ]"
                  >
                    {{ ch.channel === 'email' ? '✉️' : '📱' }}
                    {{ ch.status === 'sent' ? '✓' : ch.status === 'failed' ? '✗' : '—' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="py-3 px-4 rounded-xl bg-yellow-900/50 border border-yellow-700">
            <p class="text-yellow-300 text-sm font-medium mb-1">SOS inviato — nessun contatto emergenza configurato</p>
            <p class="text-yellow-400 text-xs">Aggiungi contatti di emergenza dal tuo profilo per ricevere notifiche automatiche.</p>
          </div>

          <!-- Tracking URL -->
          <div>
            <p class="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">Link tracking live</p>
            <div class="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-gray-900 border border-gray-700">
              <span class="text-gray-200 text-sm flex-1 truncate">{{ sosStore.activationResult.trackingUrl }}</span>
              <button
                @click="copyTrackingUrl"
                class="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                :aria-label="copied ? 'Copiato' : 'Copia link'"
              >
                <Check v-if="copied" :size="16" class="text-safety-green" />
                <Copy v-else :size="16" class="text-gray-400" />
              </button>
            </div>
          </div>

          <!-- Emergency reminder -->
          <div class="py-3 px-4 rounded-xl bg-gray-900 border border-gray-700">
            <p class="text-gray-300 text-sm">
              ⚠️ Se sei in pericolo reale e non riesci a comunicare,
              <strong class="text-white">chiama il 112</strong> o il numero di emergenza locale.
            </p>
          </div>

          <!-- "Ora sei al sicuro?" button -->
          <button
            @click="sosStore.requestFollowup"
            class="w-full py-3 rounded-xl border border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-900 transition-colors cursor-pointer"
          >
            Ora sei al sicuro?
          </button>
        </template>

        <!-- Followup state -->
        <template v-else-if="sosStore.flowState === 'followup_pending'">
          <div class="flex flex-col items-center gap-2 mb-2">
            <HelpCircle :size="36" class="text-sos-red" />
            <h2 class="text-white font-display font-bold text-xl">Ora sei al sicuro?</h2>
            <p class="text-gray-400 text-sm text-center">Il tuo feedback aiuta a migliorare SafeRoute</p>
          </div>

          <div class="grid grid-cols-1 gap-2">
            <button
              v-for="opt in FOLLOWUP_OPTIONS"
              :key="opt.value"
              @click="selectedFollowup = opt.value"
              :class="[
                'py-3.5 px-4 rounded-xl text-left font-medium text-sm transition-all cursor-pointer border-2',
                selectedFollowup === opt.value
                  ? 'border-sos-red bg-red-950 text-white'
                  : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
              ]"
              :aria-pressed="selectedFollowup === opt.value"
            >
              {{ opt.emoji }} {{ opt.label }}
            </button>
          </div>

          <textarea
            v-model="followupNotes"
            v-if="selectedFollowup && selectedFollowup !== 'no_response'"
            placeholder="Descrizione opzionale (max 500 caratteri)"
            maxlength="500"
            rows="2"
            class="w-full resize-none rounded-xl border border-gray-700 bg-gray-900 text-white placeholder:text-gray-500 text-sm px-4 py-3 outline-none focus:border-gray-500 transition"
          ></textarea>

          <button
            @click="handleFollowupSubmit"
            :disabled="!selectedFollowup || isSubmittingFollowup"
            class="w-full py-3.5 rounded-xl font-semibold text-base transition-all cursor-pointer disabled:opacity-50"
            :class="selectedFollowup ? 'bg-sos-red text-white' : 'bg-gray-800 text-gray-400'"
          >
            {{ isSubmittingFollowup ? 'Invio...' : 'Conferma' }}
          </button>
        </template>

        <!-- Followup done -->
        <div v-else-if="sosStore.flowState === 'followup_done'" class="flex flex-col items-center gap-4 py-10">
          <CheckCircle :size="48" class="text-safety-green" />
          <p class="text-white font-bold">Grazie per il feedback</p>
          <p class="text-gray-400 text-sm">Rimani al sicuro!</p>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
