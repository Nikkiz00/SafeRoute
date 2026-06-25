<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import ConnectivityBanner from '@/components/common/ConnectivityBanner.vue'

// Initialize theme on mount
useThemeStore()
</script>

<template>
  <div class="min-h-screen bg-surface-base dark:bg-surface-dark font-sans">
    <!-- Accessibility live regions -->
    <div aria-live="polite" aria-atomic="true" class="sr-only" id="map-updates"></div>
    <div aria-live="assertive" aria-atomic="true" class="sr-only" id="sos-status"></div>

    <ConnectivityBanner />

    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </div>
</template>
