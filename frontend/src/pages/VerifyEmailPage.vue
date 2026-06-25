<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-vue-next'
import { verifyEmail } from '@/api/profile'

const route = useRoute()
const router = useRouter()

type Status = 'loading' | 'success' | 'error'
const status = ref<Status>('loading')
const message = ref('')

onMounted(async () => {
  const token = route.query.token
  if (typeof token !== 'string' || !token) {
    status.value = 'error'
    message.value = 'Token mancante o non valido'
    return
  }
  try {
    const result = await verifyEmail(token)
    status.value = 'success'
    message.value = result.message
  } catch (err) {
    status.value = 'error'
    message.value = err instanceof Error ? err.message : 'Errore durante la verifica'
  }
})
</script>

<template>
  <div class="min-h-screen bg-surface-base dark:bg-surface-dark flex items-center justify-center px-6">
    <div class="max-w-sm w-full text-center">
      <!-- Loading -->
      <div v-if="status === 'loading'" class="space-y-4">
        <div class="w-16 h-16 mx-auto rounded-full bg-brand-blue/10 flex items-center justify-center">
          <Loader2 :size="32" class="text-brand-blue animate-spin" />
        </div>
        <p class="text-text-secondary dark:text-text-dark-secondary">Verifica email in corso...</p>
      </div>

      <!-- Success -->
      <div v-else-if="status === 'success'" class="space-y-4">
        <div class="w-16 h-16 mx-auto rounded-full bg-safety-green/10 flex items-center justify-center">
          <CheckCircle :size="32" class="text-safety-green" />
        </div>
        <h1 class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary">Email verificata!</h1>
        <p class="text-text-secondary dark:text-text-dark-secondary">{{ message }}</p>
        <button @click="router.push('/map')"
                class="w-full py-3.5 rounded-xl bg-brand-blue text-white font-semibold hover:bg-blue-700 transition-colors cursor-pointer">
          Vai alla mappa
        </button>
      </div>

      <!-- Error -->
      <div v-else class="space-y-4">
        <div class="w-16 h-16 mx-auto rounded-full bg-safety-red/10 flex items-center justify-center">
          <AlertCircle :size="32" class="text-safety-red" />
        </div>
        <h1 class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary">Verifica fallita</h1>
        <p class="text-text-secondary dark:text-text-dark-secondary">{{ message }}</p>
        <div class="space-y-2">
          <button @click="router.push('/profile')"
                  class="w-full py-3 rounded-xl bg-brand-blue text-white font-semibold hover:bg-blue-700 transition-colors cursor-pointer">
            Torna al profilo
          </button>
          <button @click="router.push('/map')"
                  class="w-full py-3 rounded-xl border border-border-light dark:border-border-dark text-text-secondary dark:text-text-dark-secondary font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
            Vai alla mappa
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
