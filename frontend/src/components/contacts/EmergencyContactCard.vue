<script setup lang="ts">
import { ref, computed } from 'vue'
import { Trash2, Phone, Mail, CheckCircle } from 'lucide-vue-next'
import type { EmergencyContact } from '@/types'

const props = defineProps<{
  contact: EmergencyContact
}>()

const emit = defineEmits<{
  delete: [id: string]
}>()

const confirmingDelete = ref(false)

const initials = computed(() => {
  return props.contact.name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
})

function handleDelete() {
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    return
  }
  emit('delete', props.contact.id)
  confirmingDelete.value = false
}

function cancelDelete() {
  confirmingDelete.value = false
}
</script>

<template>
  <div
    class="flex items-center gap-4 p-4 bg-surface-elevated dark:bg-surface-dark-elevated border border-border-light dark:border-border-dark rounded-xl shadow-sm hover:shadow-md hover:border-brand-blue/40 transition-all duration-150"
  >
    <!-- Avatar -->
    <div
      class="flex items-center justify-center w-12 h-12 rounded-full bg-brand-blue/20 dark:bg-brand-blue/30 text-brand-blue font-semibold text-lg shrink-0"
      aria-hidden="true"
    >
      {{ initials }}
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 flex-wrap">
        <p class="font-semibold text-text-primary dark:text-text-dark-primary truncate">
          {{ contact.name }}
        </p>
        <span
          v-if="contact.isPrimary"
          class="text-xs px-2 py-0.5 bg-brand-blue/10 text-brand-blue rounded-full font-medium"
        >
          Principale
        </span>
        <span
          v-if="contact.notifiedOnAdd"
          class="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-safety-green/10 text-green-700 dark:text-green-400 rounded-full font-medium"
        >
          <CheckCircle :size="10" />
          Avvisato
        </span>
      </div>

      <div class="flex flex-wrap gap-3 mt-1">
        <span
          v-if="contact.phone"
          class="inline-flex items-center gap-1 text-sm text-text-secondary dark:text-text-dark-secondary"
        >
          <Phone :size="12" />
          {{ contact.phone }}
        </span>
        <span
          v-if="contact.email"
          class="inline-flex items-center gap-1 text-sm text-text-secondary dark:text-text-dark-secondary"
        >
          <Mail :size="12" />
          {{ contact.email }}
        </span>
      </div>
    </div>

    <!-- Delete action -->
    <div class="flex items-center gap-2 shrink-0">
      <template v-if="confirmingDelete">
        <button
          @click="handleDelete"
          class="text-xs px-2 py-1 bg-safety-red text-white rounded-lg font-medium cursor-pointer hover:bg-red-700 transition-colors"
          :aria-label="`Conferma rimozione ${contact.name}`"
        >
          Rimuovi
        </button>
        <button
          @click="cancelDelete"
          class="text-xs px-2 py-1 text-text-secondary dark:text-text-dark-secondary border border-border-light dark:border-border-dark rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Annulla
        </button>
      </template>
      <button
        v-else
        @click="handleDelete"
        class="p-2 -m-2 text-text-secondary dark:text-text-dark-secondary hover:text-safety-red transition-colors cursor-pointer tap-highlight-none"
        :aria-label="`Rimuovi ${contact.name}`"
      >
        <Trash2 :size="18" />
      </button>
    </div>
  </div>
</template>
