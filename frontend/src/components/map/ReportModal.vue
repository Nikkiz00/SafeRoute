<script setup lang="ts">
import { ref } from 'vue'
import { X } from 'lucide-vue-next'
import { submitReport, REPORT_CATEGORIES, REPORT_CATEGORY_LABELS } from '@/api/reports'
import type { ReportCategory } from '@/api/reports'
import { ApiError } from '@/api/client'

const props = defineProps<{
  zoneId: string
  zoneName: string
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  submitted: []
}>()

const selectedCategory = ref<ReportCategory | null>(null)
const description = ref('')
const isSubmitting = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

function reset() {
  selectedCategory.value = null
  description.value = ''
  error.value = null
  success.value = false
  isSubmitting.value = false
}

function handleClose() {
  reset()
  emit('close')
}

async function handleSubmit() {
  if (!selectedCategory.value) return
  isSubmitting.value = true
  error.value = null
  try {
    await submitReport(props.zoneId, {
      category: selectedCategory.value,
      description: description.value.trim() || undefined,
    })
    success.value = true
    setTimeout(() => {
      emit('submitted')
      handleClose()
    }, 1500)
  } catch (e) {
    if (e instanceof ApiError) {
      error.value = e.status === 429
        ? 'Hai inviato troppe segnalazioni di recente. Riprova tra qualche minuto.'
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
      :aria-label="`Segnala problema: ${zoneName}`"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[-1]"
        @click="handleClose"
        aria-hidden="true"
      ></div>

      <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-t-3xl shadow-sheet px-6 pt-4 pb-8 max-h-[85vh] overflow-y-auto"
           style="padding-bottom: calc(2rem + env(safe-area-inset-bottom))">

        <!-- Handle + close -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex-1 flex justify-center">
            <div class="w-12 h-1.5 bg-border-light dark:bg-border-dark rounded-full"></div>
          </div>
          <button @click="handleClose"
            class="w-8 h-8 flex items-center justify-center rounded-full text-text-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Chiudi">
            <X :size="16" />
          </button>
        </div>

        <!-- Title -->
        <h2 class="text-xl font-display font-semibold text-text-primary dark:text-text-dark-primary mb-1">
          Segnala un problema
        </h2>
        <p class="text-sm text-text-secondary dark:text-text-dark-secondary mb-5">{{ zoneName }}</p>

        <!-- Success state -->
        <div v-if="success" class="flex flex-col items-center py-6 gap-3">
          <div class="w-14 h-14 rounded-full bg-brand-blue/10 flex items-center justify-center">
            <svg class="w-7 h-7 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <p class="text-base font-semibold text-text-primary dark:text-text-dark-primary">Segnalazione ricevuta</p>
          <p class="text-sm text-text-secondary dark:text-text-dark-secondary text-center">
            Il team la verificherà prima di pubblicarla.
          </p>
        </div>

        <!-- Category selection -->
        <div v-else>
          <p class="text-sm font-medium text-text-primary dark:text-text-dark-primary mb-3">Tipo di problema *</p>
          <div class="grid grid-cols-2 gap-2 mb-4">
            <button
              v-for="cat in REPORT_CATEGORIES"
              :key="cat"
              @click="selectedCategory = cat"
              :class="[
                'py-2.5 px-3 rounded-xl text-sm font-medium transition-all cursor-pointer border-2 text-left',
                selectedCategory === cat
                  ? 'bg-brand-blue/10 border-brand-blue text-brand-blue'
                  : 'border-border-light dark:border-border-dark text-text-secondary dark:text-text-dark-secondary hover:border-brand-blue/40'
              ]"
              :aria-pressed="selectedCategory === cat"
            >{{ REPORT_CATEGORY_LABELS[cat] }}</button>
          </div>

          <!-- Optional description -->
          <textarea
            v-model="description"
            placeholder="Descrizione opzionale (max 1000 caratteri)"
            maxlength="1000"
            rows="3"
            class="w-full resize-none rounded-xl border border-border-light dark:border-border-dark bg-transparent text-text-primary dark:text-text-dark-primary placeholder:text-text-secondary dark:placeholder:text-text-dark-secondary text-sm px-4 py-3 mb-4 outline-none focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] transition"
            aria-label="Descrizione opzionale"
          ></textarea>

          <p class="text-xs text-text-secondary dark:text-text-dark-secondary mb-4">
            La segnalazione sarà verificata prima di essere pubblicata. Non cambierà immediatamente la zona.
          </p>

          <!-- Error message -->
          <p v-if="error" class="text-sm text-safety-red mb-3">{{ error }}</p>

          <!-- Submit button -->
          <button
            @click="handleSubmit"
            :disabled="!selectedCategory || isSubmitting"
            class="w-full py-3.5 rounded-xl font-semibold text-base transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            :class="selectedCategory && !isSubmitting ? 'bg-brand-blue text-white hover:bg-blue-700' : 'bg-slate-200 dark:bg-slate-700 text-text-secondary dark:text-text-dark-secondary'"
          >
            {{ isSubmitting ? 'Invio in corso...' : 'Invia segnalazione' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
