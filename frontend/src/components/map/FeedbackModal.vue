<script setup lang="ts">
import { ref } from 'vue'
import { X, ShieldOff, ShieldAlert, Minus, ShieldCheck, Shield } from 'lucide-vue-next'
import { submitFeedback } from '@/api/feedback'
import { ApiError } from '@/api/client'

const props = defineProps<{
  zoneId: string
  zoneName: string
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  submitted: [newScore: number | null]
}>()

const selectedRating = ref<number | null>(null)
const note = ref('')
const isSubmitting = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

const RATING_OPTIONS = [
  { value: 1, label: 'Molto insicuro', icon: ShieldOff, color: 'text-purple-600 dark:text-purple-400' },
  { value: 2, label: 'Insicuro', icon: ShieldAlert, color: 'text-safety-red' },
  { value: 3, label: 'Neutro', icon: Minus, color: 'text-amber-500' },
  { value: 4, label: 'Sicuro', icon: ShieldCheck, color: 'text-green-500' },
  { value: 5, label: 'Molto sicuro', icon: Shield, color: 'text-safety-green' },
] as const

function reset() {
  selectedRating.value = null
  note.value = ''
  error.value = null
  success.value = false
  isSubmitting.value = false
}

function handleClose() {
  reset()
  emit('close')
}

async function handleSubmit() {
  if (!selectedRating.value) return
  isSubmitting.value = true
  error.value = null
  try {
    const result = await submitFeedback(props.zoneId, {
      rating: selectedRating.value,
      note: note.value.trim() || undefined,
    })
    success.value = true
    setTimeout(() => {
      emit('submitted', result.newScore)
      handleClose()
    }, 400)
  } catch (e) {
    if (e instanceof ApiError) {
      error.value = e.status === 409
        ? 'Hai già valutato questa zona negli ultimi 30 giorni.'
        : e.message
    } else {
      error.value = 'Errore durante l\'invio. Riprova.'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Transition name="sheet">
    <div
      v-if="visible"
      class="fixed bottom-0 left-0 right-0 z-modal md:left-64"
      role="dialog"
      aria-modal="true"
      :aria-label="`Valuta sicurezza: ${zoneName}`"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[-1]"
        @click="handleClose"
        aria-hidden="true"
      ></div>

      <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-t-3xl shadow-sheet px-6 pt-4 overflow-y-auto"
           style="max-height: 90dvh; max-height: 90vh; padding-bottom: calc(2rem + env(safe-area-inset-bottom))">

        <!-- Handle + close -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex-1 flex justify-center">
            <div class="w-12 h-1.5 bg-border-light dark:bg-border-dark rounded-full"></div>
          </div>
          <button @click="handleClose"
            class="w-11 h-11 flex items-center justify-center rounded-full text-text-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Chiudi">
            <X :size="18" />
          </button>
        </div>

        <!-- Title -->
        <h2 class="text-xl font-display font-semibold text-text-primary dark:text-text-dark-primary mb-1">
          Come ti sei sentito in questa zona?
        </h2>
        <p class="text-sm text-text-secondary dark:text-text-dark-secondary mb-6">{{ zoneName }}</p>

        <!-- Success state -->
        <div v-if="success" class="flex flex-col items-center py-6 gap-3">
          <div class="w-14 h-14 rounded-full bg-safety-green/15 flex items-center justify-center">
            <svg class="w-7 h-7 text-safety-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <p class="text-base font-semibold text-text-primary dark:text-text-dark-primary">Grazie!</p>
          <p class="text-sm text-text-secondary dark:text-text-dark-secondary">Il tuo feedback è stato registrato.</p>
        </div>

        <!-- Rating cards -->
        <div v-else>
          <div class="flex flex-col gap-2 mb-5">
            <button
              v-for="option in RATING_OPTIONS"
              :key="option.value"
              @click="selectedRating = option.value"
              :class="[
                'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                selectedRating === option.value
                  ? 'border-brand-blue bg-brand-blue/5 text-text-primary dark:text-text-dark-primary'
                  : 'border-border-light dark:border-border-dark text-text-primary dark:text-text-dark-primary hover:border-brand-blue/40'
              ]"
              :aria-label="`Valutazione ${option.value} — ${option.label}`"
              :aria-pressed="selectedRating === option.value"
            >
              <component :is="option.icon" :size="20" :class="option.color" class="shrink-0" />
              <span class="text-xs font-semibold text-text-secondary dark:text-text-dark-secondary w-4 text-center">{{ option.value }}</span>
              <span class="text-sm font-medium">{{ option.label }}</span>
            </button>
          </div>

          <!-- Optional note -->
          <textarea
            v-model="note"
            placeholder="Nota opzionale (max 500 caratteri)"
            maxlength="500"
            rows="2"
            class="w-full resize-none rounded-xl border border-border-light dark:border-border-dark bg-transparent text-text-primary dark:text-text-dark-primary placeholder:text-text-secondary dark:placeholder:text-text-dark-secondary text-sm px-4 py-3 mb-4 outline-none focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] transition"
            :aria-label="'Nota opzionale per il feedback'"
          ></textarea>

          <!-- Error message -->
          <p v-if="error" class="text-sm text-safety-red mb-3">{{ error }}</p>

          <!-- Submit button -->
          <button
            @click="handleSubmit"
            :disabled="!selectedRating || isSubmitting"
            class="w-full py-3.5 rounded-xl font-semibold text-base transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            :class="selectedRating && !isSubmitting ? 'bg-brand-blue text-white hover:bg-blue-700' : 'bg-slate-200 dark:bg-slate-700 text-text-secondary dark:text-text-dark-secondary'"
          >
            {{ isSubmitting ? 'Invio in corso...' : 'Invia valutazione' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
