<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { WifiOff } from 'lucide-vue-next'

const isOffline = ref(!navigator.onLine)

function handleOnline() {
  isOffline.value = false
}

function handleOffline() {
  isOffline.value = true
}

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<template>
  <Transition name="banner">
    <div
      v-if="isOffline"
      class="fixed top-0 left-0 right-0 z-[35] flex items-center gap-3 px-4 py-3 bg-offline-yellow text-amber-900"
      role="alert"
      aria-live="assertive"
    >
      <WifiOff :size="18" class="shrink-0" />
      <span class="text-sm font-medium">Connessione assente — modalità limitata</span>
    </div>
  </Transition>
</template>

<style scoped>
.banner-enter-active { transition: transform 200ms ease-out, opacity 200ms ease-out; }
.banner-leave-active { transition: transform 200ms ease-in, opacity 200ms ease-in; }
.banner-enter-from   { transform: translateY(-100%); opacity: 0; }
.banner-leave-to     { transform: translateY(-100%); opacity: 0; }
</style>
