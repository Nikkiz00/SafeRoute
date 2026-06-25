<script setup lang="ts">
import MobileBottomNav from '@/components/common/MobileBottomNav.vue'
import DesktopSidebar from '@/components/common/DesktopSidebar.vue'

defineProps<{
  fullscreen?: boolean
}>()
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Desktop sidebar -->
    <DesktopSidebar />

    <!-- Main content area -->
    <main
      :class="[
        'flex-1 flex flex-col overflow-hidden',
        'md:ml-64',
      ]"
    >
      <slot />
    </main>

    <!-- Mobile bottom nav -->
    <MobileBottomNav class="md:hidden" />
  </div>
</template>
