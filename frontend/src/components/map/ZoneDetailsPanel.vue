<script setup lang="ts">
import { ref, computed } from 'vue'
import { X, MessageSquare, Flag } from 'lucide-vue-next'
import type { Zone } from '@/types'
import StatusBadge from '@/components/common/StatusBadge.vue'
import FeedbackModal from '@/components/map/FeedbackModal.vue'
import ReportModal from '@/components/map/ReportModal.vue'

const props = defineProps<{
  zone: Zone | null
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  'zone-updated': [zoneId: string]
}>()

const showFeedback = ref(false)
const showReport = ref(false)

const scoreColor = computed(() => {
  if (!props.zone || props.zone.safetyScore === null) return 'text-text-secondary'
  const s = props.zone.safetyScore
  if (s >= 75) return 'text-safety-green'
  if (s >= 50) return 'text-safety-yellow'
  if (s >= 25) return 'text-safety-red'
  return 'text-safety-purple'
})

const scoreBarWidth = computed(() => {
  if (!props.zone || props.zone.safetyScore === null) return '0%'
  return `${props.zone.safetyScore}%`
})

const scoreBarColor = computed(() => {
  if (!props.zone || props.zone.safetyScore === null) return 'bg-safety-gray'
  const s = props.zone.safetyScore
  if (s >= 75) return 'bg-safety-green'
  if (s >= 50) return 'bg-safety-yellow'
  if (s >= 25) return 'bg-safety-red'
  return 'bg-safety-purple'
})

function handleFeedbackSubmitted(newScore: number | null) {
  showFeedback.value = false
  if (props.zone) emit('zone-updated', props.zone.id)
}

function handleReportSubmitted() {
  showReport.value = false
}
</script>

<template>
  <Transition name="sheet">
    <div
      v-if="visible && zone"
      class="fixed bottom-0 left-0 right-0 z-sheet md:left-64"
      role="dialog"
      aria-modal="true"
      :aria-label="`Dettagli zona ${zone.name}`"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[-1] md:left-64"
        @click="emit('close')"
        aria-hidden="true"
      ></div>

      <!-- Sheet content -->
      <div
        class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-t-3xl shadow-sheet px-6 pt-4 pb-8 max-h-[80vh] overflow-y-auto"
        style="padding-bottom: calc(2rem + env(safe-area-inset-bottom))"
      >
        <!-- Handle + close -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex-1 flex justify-center">
            <div class="w-12 h-1.5 bg-border-light dark:bg-border-dark rounded-full"></div>
          </div>
          <button
            @click="emit('close')"
            class="w-8 h-8 flex items-center justify-center rounded-full text-text-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Chiudi pannello"
          >
            <X :size="16" />
          </button>
        </div>

        <!-- Zone name + badge -->
        <div class="flex items-center justify-between mb-1">
          <h2 class="text-xl font-display font-semibold text-text-primary dark:text-text-dark-primary">
            {{ zone.name }}
          </h2>
          <StatusBadge :level="zone.level" />
        </div>
        <p class="text-sm text-text-secondary dark:text-text-dark-secondary mb-4">
          {{ zone.cityName }}<span v-if="zone.region"> · {{ zone.region }}</span>
        </p>

        <!-- Service inactive banner -->
        <div v-if="!zone.isServiceActive" class="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center gap-2">
          <span class="text-xs text-text-secondary dark:text-text-dark-secondary">Servizio non attivo in questa zona</span>
        </div>

        <!-- Safety score -->
        <div v-if="zone.safetyScore !== null" class="mb-6">
          <div class="flex items-end gap-2 mb-2">
            <span :class="['text-4xl font-bold font-display', scoreColor]">{{ zone.safetyScore }}</span>
            <span class="text-text-secondary dark:text-text-dark-secondary text-lg mb-1">/ 100</span>
          </div>
          <div class="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              :class="['h-full rounded-full transition-all duration-500', scoreBarColor]"
              :style="{ width: scoreBarWidth }"
            ></div>
          </div>
          <p class="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">Punteggio sicurezza</p>
        </div>

        <!-- No data state -->
        <div v-else class="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <p class="text-text-secondary dark:text-text-dark-secondary text-sm">
            Nessun dato ancora per questa zona. Sii il primo a segnalare.
          </p>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-3 gap-3 mb-6">
          <div class="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <p class="text-lg font-bold font-display text-text-primary dark:text-text-dark-primary">{{ zone.feedbackCount }}</p>
            <p class="text-xs text-text-secondary dark:text-text-dark-secondary">Feedback</p>
          </div>
          <div class="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <p class="text-lg font-bold font-display text-text-primary dark:text-text-dark-primary">{{ zone.reportsCount }}</p>
            <p class="text-xs text-text-secondary dark:text-text-dark-secondary">Segnalazioni</p>
          </div>
          <div class="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <p class="text-lg font-bold font-display text-text-primary dark:text-text-dark-primary">{{ zone.sosCount }}</p>
            <p class="text-xs text-text-secondary dark:text-text-dark-secondary">SOS (30gg)</p>
          </div>
        </div>

        <!-- Community data disclaimer -->
        <p class="text-xs text-text-secondary dark:text-text-dark-secondary mt-3 mb-4 leading-relaxed">
          I dati di sicurezza di questa zona si basano sui feedback della community e non sono verificati da autorita' ufficiali. Usa sempre il tuo giudizio personale.
        </p>

        <!-- Actions -->
        <div class="flex gap-3">
          <button
            @click="showReport = true"
            class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-brand-blue text-brand-blue font-semibold text-sm hover:bg-brand-blue/5 transition-colors cursor-pointer"
          >
            <Flag :size="16" />
            Segnala
          </button>
          <button
            @click="showFeedback = true"
            :class="[
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors cursor-pointer',
              zone.safetyScore === null
                ? 'bg-brand-blue text-white hover:bg-blue-700'
                : 'border-2 border-slate-200 dark:border-slate-700 text-text-secondary dark:text-text-dark-secondary hover:bg-slate-50 dark:hover:bg-slate-800'
            ]"
          >
            <MessageSquare :size="16" />
            {{ zone.safetyScore === null ? 'Sii il primo!' : 'Valuta' }}
          </button>
        </div>
      </div>

      <!-- Modals -->
      <FeedbackModal
        v-if="zone"
        :zone-id="zone.id"
        :zone-name="zone.name"
        :visible="showFeedback"
        @close="showFeedback = false"
        @submitted="handleFeedbackSubmitted"
      />
      <ReportModal
        v-if="zone"
        :zone-id="zone.id"
        :zone-name="zone.name"
        :visible="showReport"
        @close="showReport = false"
        @submitted="handleReportSubmitted"
      />
    </div>
  </Transition>
</template>
